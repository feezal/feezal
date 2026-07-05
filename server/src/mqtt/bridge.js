'use strict';

/**
 * Server-side MQTT bridge.
 *
 * Connects to the configured broker, subscribes to '#', and builds an
 * in-memory topic trie used for topic autocomplete in the editor.
 *
 * One singleton connection is maintained for the process.  When the
 * connection config changes (on getSite / deploy) it disconnects, clears
 * the trie, and reconnects with the new settings.
 */

const fs = require('fs').promises;
const path = require('path');
const mqtt = require('mqtt');
const discovery = require('./discovery.js');

// ── Trie ───────────────────────────────────────────────────────────────────
const topicTrie = {};
// Symbol marker so terminal (actually-seen) topics are distinguishable from
// pure intermediate segments — and invisible to Object.keys() so the
// completion walk below is unaffected.
const TERMINAL = Symbol('terminal');

function insertTopic(topic) {
    if (!topic || /[#+]/.test(topic)) return;
    let node = topicTrie;
    for (const seg of topic.split('/')) {
        if (!node[seg]) node[seg] = {};
        node = node[seg];
    }
    node[TERMINAL] = true;
}

/** Flat list of every topic actually seen (U26 — for the AI topic-search tool). */
function getAllTopics() {
    const out = [];
    (function walk(node, prefix) {
        if (node[TERMINAL]) out.push(prefix);
        for (const seg of Object.keys(node)) {
            walk(node[seg], prefix ? prefix + '/' + seg : seg);
        }
    })(topicTrie, '');
    return out;
}

function _clearTrie() {
    for (const key of Object.keys(topicTrie)) delete topicTrie[key];
    lastPayloads.clear();
}

// ── Last-payload store (U26) ────────────────────────────────────────────────
// topic → { payload, raw, retain, ts }. Updated for EVERY message (not just
// retained, unlike the hub's replay cache) so the AI payload-peek tool can see
// current state topics. Bounded (oldest-evicted) to cap memory on busy brokers.
const lastPayloads = new Map();
const LAST_PAYLOAD_CAP = 20000;

function recordPayload(topic, parsed, raw, retain) {
    if (lastPayloads.has(topic)) lastPayloads.delete(topic);   // refresh insertion order
    else if (lastPayloads.size >= LAST_PAYLOAD_CAP) {
        lastPayloads.delete(lastPayloads.keys().next().value); // evict oldest
    }
    lastPayloads.set(topic, {payload: parsed, raw, retain, ts: Date.now()});
}

/** Last-known payload for an exact topic, or null if none seen. */
function getLastPayload(topic) {
    return lastPayloads.get(topic) || null;
}

function getTopicCompletions(prefix) {
    const endsSlash = prefix.endsWith('/');
    const parts = prefix.split('/');
    const parentSegs = endsSlash ? parts.filter(s => s) : parts.slice(0, -1);
    const partial    = endsSlash ? '' : (parts[parts.length - 1] || '');
    const parentPath = parentSegs.length > 0 ? parentSegs.join('/') + '/' : '';

    let node = topicTrie;
    for (const seg of parentSegs) {
        if (!node[seg]) return [];
        node = node[seg];
    }

    return Object.keys(node)
        .filter(k => k.startsWith(partial))
        .map(k => {
            const full = parentPath + k;
            return Object.keys(node[k]).length > 0 ? full + '/' : full;
        })
        .slice(0, 20);
}

// ── Connection ─────────────────────────────────────────────────────────────
let client          = null;
let activeUri       = null;
let activeCertDir   = null;
let activeVersion   = null;
let _logger         = null;
let _relayCallback  = null;

/** Called by hub.js once broadcast() is defined, so incoming broker messages
 *  are forwarded to all subscribed Socket.IO clients (editor + viewer). */
function setRelayCallback(fn) {
    _relayCallback = fn;
}

function connect(config, logger, certDir) {
    if (logger) _logger = logger;

    const uri = config?.uri;

    // Only connect for direct-MQTT viewer configs
    if (!uri || config?.backend !== 'mqtt') {
        _logger?.debug('mqtt-bridge: no MQTT URI or non-mqtt backend — not connecting');
        return;
    }

    // N9: MQTT protocol version — 4 (3.1.1, default) or 5 (MQTT 5.0).
    const protocolVersion = Number(config.protocolVersion) === 5 ? 5 : 4;

    // Skip if already connected to the same broker with the same cert dir + version
    if (activeUri === uri && activeCertDir === (certDir || null) && activeVersion === protocolVersion) {
        _logger?.debug('mqtt-bridge: already connected to ' + uri);
        return;
    }

    disconnect();
    _clearTrie();
    discovery.clearEntities();
    activeUri = uri;
    activeCertDir = certDir || null;
    activeVersion = protocolVersion;

    _logger?.info('mqtt-bridge: connecting to ' + uri);

    buildConnectOptions(config, certDir)
        .then(options => _doConnect(uri, options))
        .catch(err => _logger?.error('mqtt-bridge: ' + err.message));
}

/**
 * mqtt.js connect options from the stored connection config: credentials,
 * protocol version (N9) and — when a cert dir is given — the site's TLS
 * material (N8: CA trust + mTLS client cert/key). Exported for tests.
 */
async function buildConnectOptions(config, certDir) {
    const options = {
        clientId:  'feezal-bridge-' + Math.random().toString(16).slice(2, 10),
        reconnectPeriod: 5000,
        connectTimeout: 10000,
        // N9: MQTT protocol version — 4 (3.1.1, default) or 5 (MQTT 5.0)
        protocolVersion: Number(config.protocolVersion) === 5 ? 5 : 4
    };
    if (config.username) options.username = config.username;
    if (config.password) options.password = config.password;

    if (certDir) {
        const loadPem = (file, key) =>
            fs.readFile(path.join(certDir, file))
                .then(pem => { options[key] = pem; })
                .catch(() => { /* file not present — connect without it */ });
        await Promise.all([
            loadPem('ca.pem', 'ca'),
            loadPem('client.crt', 'cert'),
            loadPem('client.key', 'key')
        ]);
    }

    return options;
}

function _doConnect(uri, options) {
    try {
        client = mqtt.connect(uri, options);
    } catch (err) {
        _logger?.error('mqtt-bridge: connect threw ' + err.message);
        client = null;
        activeUri = null;
        activeCertDir = null;
        activeVersion = null;
        return;
    }

    client.on('connect', () => {
        _logger?.info('mqtt-bridge: connected, subscribing to #');
        client.subscribe('#', {qos: 0});
    });

    client.on('message', (topic, payload, packet) => {
        insertTopic(topic);
        discovery.handleMessage(topic, payload);
        const payloadStr = payload ? payload.toString() : '';
        let parsed = payloadStr;
        if (payloadStr.startsWith('{') || payloadStr.startsWith('[')) {
            try { parsed = JSON.parse(payloadStr); } catch {}
        }
        const retain = packet && packet.retain === true;
        recordPayload(topic, parsed, payloadStr, retain);
        if (_relayCallback) {
            _relayCallback({topic, payload: parsed, retain});
        }
    });

    client.on('error', err => {
        _logger?.warn('mqtt-bridge: ' + err.message);
    });

    client.on('close', () => {
        _logger?.debug('mqtt-bridge: connection closed');
    });
}

function disconnect() {
    if (client) {
        try { client.end(true); } catch {}
        client       = null;
        activeUri    = null;
        activeCertDir = null;
        activeVersion = null;
    }
}

/** Publish a message to the broker (used by the feezal-backend viewer). */
function publish(message) {
    if (!client) {
        _logger?.warn('mqtt-bridge: publish skipped — no broker connection');
        return;
    }
    const payload = message.payload == null
        ? ''
        : typeof message.payload === 'string'
            ? message.payload
            : JSON.stringify(message.payload);
    client.publish(message.topic, payload);
    _logger?.debug('mqtt-bridge: publish ' + message.topic);
}

module.exports = { connect, disconnect, publish, insertTopic, getTopicCompletions, getAllTopics, getLastPayload, recordPayload, setRelayCallback, buildConnectOptions, getDiscoveredEntities: discovery.getDiscoveredEntities, getDiscoveredEntity: discovery.getDiscoveredEntity, getDeviceGroups: discovery.getDeviceGroups };

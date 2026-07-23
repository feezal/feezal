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
const tls = require('tls');
const mqtt = require('mqtt');
const WebSocket = require('ws');
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

// Connection status for the editor's indicator (Connection settings tab).
// lastError survives reconnect attempts so the user can see WHY the bridge
// is not connected (TLS trust, auth, unreachable host, …).
const _status = {connected: false, uri: null, lastError: null};

/** Current bridge status: {connected, uri, lastError: {message, ts}|null,
 * certDir}. `certDir` lets callers detect whether the bridge is using a
 * given site's TLS material (see the cert routes). */
function getStatus() {
    return {..._status, certDir: activeCertDir};
}

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
        _status.connected = false;
        _status.uri = null;
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
    _status.uri = uri;
    _status.connected = false;
    _status.lastError = null;   // fresh target — old errors no longer apply

    _logger?.info('mqtt-bridge: connecting to ' + uri);

    buildConnectOptions(config, certDir)
        .then(options => _doConnect(uri, options))
        .catch(err => _logger?.error('mqtt-bridge: ' + err.message));
}

/**
 * Wrap a WebSocket so zero-length sends are dropped.
 *
 * mqtt.js writes every MQTT packet field as its own stream chunk; an empty
 * payload — the retained-empty publish that IS the MQTT retained-clear
 * convention (viewer presence clears, N24) — produces a zero-length chunk
 * that the ws transport sends as an EMPTY WebSocket frame. mosquitto rejects
 * that frame as a protocol error ("RESERVED packet") and closes the
 * connection — so every presence clear killed the ws/wss bridge, which then
 * missed all broker traffic (viewer statuses!) until the 5s reconnect.
 * A zero-length frame carries no MQTT bytes, so dropping it changes nothing
 * on the wire. (Reproduced with mqtt.js 5.15.2 / mosquitto 2.1.2.)
 *
 * Exported for tests.
 */
function guardEmptyWsFrames(socket) {
    const send = socket.send.bind(socket);
    socket.send = (data, options, callback) => {
        if (typeof options === 'function') {
            callback = options;
            options = undefined;
        }
        const len = data == null ? 0 : (data.length ?? data.byteLength ?? 0);
        if (len === 0) {
            if (callback) callback();
            return;
        }
        return send(data, options, callback);
    };
    return socket;
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
        protocolVersion: Number(config.protocolVersion) === 5 ? 5 : 4,
        // Only consulted by the ws/wss transport — see guardEmptyWsFrames.
        createWebsocket: (url, protocols, opts) =>
            guardEmptyWsFrames(new WebSocket(url, protocols, opts.wsOptions))
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
        // An uploaded CA must ADD trust for the private CA, not replace the
        // system store — options.ca alone would make the bridge distrust
        // brokers with publicly-signed (e.g. Let's Encrypt) certificates
        // while browsers keep working, which is near-impossible to debug.
        if (options.ca) {
            options.ca = [...tls.rootCertificates, options.ca.toString()];
        }
    }

    return options;
}

function _doConnect(uri, options) {
    try {
        client = mqtt.connect(uri, options);
    } catch (err) {
        _logger?.error('mqtt-bridge: connect threw ' + err.message);
        _status.lastError = {message: err.message, ts: Date.now()};
        client = null;
        activeUri = null;
        activeCertDir = null;
        activeVersion = null;
        return;
    }

    client.on('connect', () => {
        _logger?.info('mqtt-bridge: connected, subscribing to #');
        _status.connected = true;
        _status.lastError = null;
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
        _status.lastError = {message: err.message, ts: Date.now()};
    });

    client.on('close', () => {
        _logger?.debug('mqtt-bridge: connection closed');
        _status.connected = false;
    });
}

/**
 * Re-subscribe filters so the broker replays their retained messages —
 * called by the hub on every socket subscribe. Needed because the broker
 * strips the RETAIN flag on live deliveries [MQTT-3.3.1-9]: a message
 * retained AFTER the bridge's '#' subscribe is only ever seen live
 * (retain=0), so the hub's known-retained replay cache misses it and a
 * reloading editor gets nothing. A fresh (overlapping) subscription makes
 * the broker resend matching retained messages with retain=1 through the
 * normal relay path, which both populates the cache and reaches the
 * just-subscribed socket. The extra filter is dropped right after the
 * SUBACK — the broker queues the retained replay while processing the
 * SUBSCRIBE, so the later UNSUBSCRIBE cannot race it. '#' is skipped:
 * that IS the standing relay subscription (its retained state was
 * replayed at connect) and unsubscribing it would kill the relay.
 */
function refreshRetained(filters) {
    if (!client) return;
    const list = (Array.isArray(filters) ? filters : [filters])
        .filter(f => typeof f === 'string' && f.length > 0 && f !== '#');
    if (list.length === 0) return;
    client.subscribe(list, {qos: 0}, err => {
        if (!err && client) client.unsubscribe(list);
    });
}

function disconnect() {
    if (client) {
        try { client.end(true); } catch {}
        client       = null;
        activeUri    = null;
        activeCertDir = null;
        activeVersion = null;
        _status.connected = false;
        _status.uri = null;
    }
}

/**
 * Force a fresh connection even when uri/certDir/protocolVersion are
 * unchanged. connect() deliberately skips that case, but the TLS material is
 * only READ at connect time — after a cert upload/removal the same certDir
 * holds different files, and without this the new CA only took effect on a
 * server restart.
 */
function reconnect(config, logger, certDir) {
    disconnect();
    connect(config, logger, certDir);
}

/** Publish a message to the broker (used by the feezal-backend viewer). */
function publish(message) {
    // B19: an undefined/empty topic reaches mqtt.js synchronously
    // (packet.topic.toString() in _sendPacket) and the throw takes the whole
    // server process down — never forward a message without a valid topic.
    if (!message || typeof message.topic !== 'string' || message.topic.length === 0) {
        _logger?.warn('mqtt-bridge: publish skipped — invalid topic (' + JSON.stringify(message?.topic) + ')');
        return;
    }

    if (!client) {
        _logger?.warn('mqtt-bridge: publish skipped — no broker connection');
        return;
    }
    const payload = message.payload == null
        ? ''
        : typeof message.payload === 'string'
            ? message.payload
            : JSON.stringify(message.payload);
    // N24: forward the retain flag (viewer presence status is retained; an
    // empty retained publish clears it).
    client.publish(message.topic, payload, {retain: message.retain === true});
    _logger?.debug('mqtt-bridge: publish ' + message.topic + (message.retain === true ? ' (retained)' : ''));
}

module.exports = { connect, disconnect, reconnect, getStatus, publish, insertTopic, getTopicCompletions, getAllTopics, getLastPayload, recordPayload, setRelayCallback, buildConnectOptions, guardEmptyWsFrames, refreshRetained, getDiscoveredEntities: discovery.getDiscoveredEntities, getDiscoveredEntity: discovery.getDiscoveredEntity, getDeviceGroups: discovery.getDeviceGroups, setDiscoveryStale: discovery.setHomematicClimateStale };

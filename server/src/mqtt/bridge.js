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

function insertTopic(topic) {
    if (!topic || /[#+]/.test(topic)) return;
    let node = topicTrie;
    for (const seg of topic.split('/')) {
        if (!node[seg]) node[seg] = {};
        node = node[seg];
    }
}

function _clearTrie() {
    for (const key of Object.keys(topicTrie)) delete topicTrie[key];
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

    // Skip if already connected to the same broker with the same cert dir
    if (activeUri === uri && activeCertDir === (certDir || null)) {
        _logger?.debug('mqtt-bridge: already connected to ' + uri);
        return;
    }

    disconnect();
    _clearTrie();
    discovery.clearEntities();
    activeUri = uri;
    activeCertDir = certDir || null;

    _logger?.info('mqtt-bridge: connecting to ' + uri);

    const options = {
        clientId:  'feezal-bridge-' + Math.random().toString(16).slice(2, 10),
        reconnectPeriod: 5000,
        connectTimeout: 10000
    };
    if (config.username) options.username = config.username;
    if (config.password) options.password = config.password;

    // Load TLS CA cert if present (N8)
    const doConnect = certDir
        ? fs.readFile(path.join(certDir, 'ca.pem'))
            .then(ca => { options.ca = ca; })
            .catch(() => { /* no CA cert — connect without it */ })
            .then(() => _doConnect(uri, options))
        : Promise.resolve(_doConnect(uri, options));

    doConnect.catch(err => _logger?.error('mqtt-bridge: ' + err.message));
}

function _doConnect(uri, options) {
    try {
        client = mqtt.connect(uri, options);
    } catch (err) {
        _logger?.error('mqtt-bridge: connect threw ' + err.message);
        client = null;
        activeUri = null;
        activeCertDir = null;
        return;
    }

    client.on('connect', () => {
        _logger?.info('mqtt-bridge: connected, subscribing to #');
        client.subscribe('#', {qos: 0});
    });

    client.on('message', (topic, payload) => {
        insertTopic(topic);
        discovery.handleMessage(topic, payload);
        if (_relayCallback) {
            let payloadStr = payload ? payload.toString() : '';
            let parsed = payloadStr;
            if (payloadStr.startsWith('{') || payloadStr.startsWith('[')) {
                try { parsed = JSON.parse(payloadStr); } catch {}
            }
            _relayCallback({topic, payload: parsed});
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
    }
}

module.exports = { connect, disconnect, insertTopic, getTopicCompletions, setRelayCallback, getDiscoveredEntities: discovery.getDiscoveredEntities, getDiscoveredEntity: discovery.getDiscoveredEntity };

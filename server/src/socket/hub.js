'use strict';

const path = require('path');
const prettyHtml = require('@starptech/prettyhtml');
const topicMatch = require('../topic-match.js');
const bridge = require('../mqtt/bridge.js');

/**
 * Attaches Socket.IO handlers for editor ↔ server communication.
 *
 * The Socket.IO connection is editor-only. The viewer never connects here —
 * it speaks MQTT-WS directly to the broker.
 *
 * Events handled:
 *   deploy   — Save site HTML + config, trigger viewer build, notify clients to reload.
 *   getSite  — Load site HTML + config and return to caller.
 *   subscribe — Track topic subscriptions, replay cache for matching topics.
 *   send     — Store message in cache and echo back (local message bus, no MQTT bridge yet).
 *   disconnect — Clean up per-socket state.
 *
 * @param {import('socket.io').Server} io
 * @param {object} opts
 * @param {import('../storage/adapter')} opts.storage
 * @param {object}   opts.logger
 */
function createHub(io, {storage, logger}) {
    // In-memory message cache: topic → last message object
    const cache = {};

    // Per-socket subscription tracking: socket.id → Set<topic>
    const socketSubscriptions = new Map();

    io.on('connection', socket => {
        const address = socket.handshake.address;
        logger.debug('connect from ' + address);

        const subscriptions = new Set();
        socketSubscriptions.set(socket.id, subscriptions);

        // ------------------------------------------------------------------ deploy
        socket.on('deploy', async (data, callback) => {
            try {
                data.site = data.site || {name: 'default'};
                const siteName = data.site.name;

                const formattedHtml = prettyHtml(data.html, {
                    tabWidth: 4,
                    prettier: {jsxBracketSameLine: true}
                }).toString();

                await storage.saveSite(siteName, {
                    html: formattedHtml,
                    config: {viewer: data.viewer, connection: data.connection}
                });

                logger.info('saved site ' + siteName);

                // Reconnect bridge if connection settings changed
                const certDir = storage.dataDir
                    ? path.join(storage.dataDir, 'certs', siteName)
                    : null;
                bridge.connect(data.connection, logger, certDir);

                io.emit('reload');
            } catch (err) {
                logger.error('deploy error: ' + err.message);
            } finally {
                if (typeof callback === 'function') {
                    callback();
                }
            }
        });

        // ------------------------------------------------------------------ getSite
        socket.on('getSite', async (site, callback) => {
            site = site || 'default';
            logger.debug('getSite ' + site);

            try {
                const {html: views, config: viewer} = await storage.getSite(site);
                callback({views, viewer});
                // Auto-connect bridge with the stored connection config
                const certDir = storage.dataDir
                    ? path.join(storage.dataDir, 'certs', site)
                    : null;
                bridge.connect(viewer?.connection, logger, certDir);
            } catch (err) {
                logger.warn('getSite error for ' + site + ': ' + err.message);
                callback({views: '', viewer: {}});
            }
        });

        // ------------------------------------------------------------------ subscribe
        socket.on('subscribe', topics => {
            topics.forEach(topic => {
                logger.debug('subscribe ' + topic);
                subscriptions.add(topic);

                // Replay cached messages that match the new subscription
                Object.keys(cache)
                    .filter(t => topicMatch(t, topic) !== null)
                    .forEach(t => socket.emit('input', cache[t]));
            });
        });

        // ------------------------------------------------------------------ send
        socket.on('send', message => {
            logger.debug('send ' + message.topic);
            bridge.insertTopic(message.topic);
            cache[message.topic] = {cached: true, ...message};
            // Forward to the MQTT broker so feezal-backend viewers can publish
            bridge.publish(message);
            // Echo back so the editor can observe its own publishes
            socket.emit('input', message);
        });

        // ------------------------------------------------------------------ topicSeen
        // Editor reports each topic it receives (from broker replay) so the
        // autocomplete trie is populated even for subscribe-only topics.
        socket.on('topicSeen', topic => {
            bridge.insertTopic(topic);
        });

        // ------------------------------------------------------------------ disconnect
        socket.on('disconnect', () => {
            logger.debug('disconnect ' + address);
            socketSubscriptions.delete(socket.id);
        });
    });

    io.on('connect_error', err => {
        logger.debug('connect_error ' + err.message);
    });

    /**
     * Push an incoming message to all subscribed sockets.
     * Called both from the MQTT bridge (live broker messages) and from the
     * `send` event handler (editor self-publishes).
     *
     * @param {{topic: string, payload: *}} message
     */
    function broadcast(message) {
        bridge.insertTopic(message.topic);
        cache[message.topic] = {cached: true, ...message};
        io.sockets.sockets.forEach((socket, id) => {
            const subs = socketSubscriptions.get(id);
            if (subs && [...subs].some(t => topicMatch(message.topic, t) !== null)) {
                socket.emit('input', message);
            }
        });
    }

    // Wire the MQTT bridge so incoming broker messages are relayed to all
    // subscribed Socket.IO clients (editor preview AND feezal-bridge viewers).
    bridge.setRelayCallback(broadcast);

    return {broadcast, getTopicCompletions: bridge.getTopicCompletions};
}

module.exports = createHub;

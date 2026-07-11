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

    /**
     * Known-retained last-value cache — replayed to newly subscribing sockets.
     *
     * The broker strips the RETAIN flag on live deliveries [MQTT-3.3.1-9]:
     * retain=1 only ever marks the stored-retained replay right after
     * subscribing. A topic seen with retain=1 is therefore known to be in the
     * broker's retained store — a state topic. Every later message on it
     * (delivered with retain=0 even when the publisher set retain) refreshes
     * the cached payload, so replay always serves the last value. An empty
     * payload evicts — the MQTT retained-clear convention; its live delivery
     * also arrives as retain=0 + empty. Topics never seen retained (commands,
     * reload, …) are never cached, so no stale command is ever replayed.
     */
    function updateCache(message) {
        const empty = message.payload === '' || message.payload === null || message.payload === undefined;
        if (empty) {
            delete cache[message.topic];
        } else if (message.retain) {
            cache[message.topic] = {cached: true, ...message};
        } else if (cache[message.topic]) {
            cache[message.topic] = {...cache[message.topic], payload: message.payload};
        }
    }

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
                    ? path.join(storage.dataDir, 'sites', siteName, 'certs')
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
                    ? path.join(storage.dataDir, 'sites', site, 'certs')
                    : null;
                bridge.connect(viewer?.connection, logger, certDir);
            } catch (err) {
                logger.warn('getSite error for ' + site + ': ' + err.message);
                callback({views: '', viewer: {}});
            }
        });

        // ------------------------------------------------------------------ subscribe
        socket.on('subscribe', topics => {
            // B19: same crash class as send — a non-array payload throws in
            // the handler and kills the process.
            if (!Array.isArray(topics)) return;
            const valid = topics.filter(t => typeof t === 'string' && t.length > 0);
            valid.forEach(topic => {
                logger.debug('subscribe ' + topic);
                subscriptions.add(topic);

                // Replay only cached retained messages that match the new subscription
                const matches = Object.keys(cache)
                    .filter(t => topicMatch(t, topic) !== null);
                matches.forEach(t => {
                    logger.debug('hub: cache replay topic=' + t + ' to socket=' + socket.id);
                    socket.emit('input', cache[t]);
                });
            });
            // Ask the broker to replay its retained state for these filters —
            // the cache above only knows topics this process has seen with
            // retain=1; anything retained after the bridge's '#' subscribe is
            // missing from it (the broker strips the flag on live deliveries).
            bridge.refreshRetained(valid);
        });

        // ------------------------------------------------------------------ unsubscribe
        // The client emits this when the last subscriber of a topic goes away
        // (element deleted / replaced) — without a handler the per-socket set
        // grew stale and kept replaying topics nothing listens to anymore.
        socket.on('unsubscribe', topics => {
            if (!Array.isArray(topics)) return;   // B19: see subscribe
            topics.forEach(topic => {
                logger.debug('unsubscribe ' + topic);
                subscriptions.delete(topic);
            });
        });

        // ------------------------------------------------------------------ send
        socket.on('send', message => {
            // B19: a malformed send (missing/empty topic) must never reach
            // bridge.publish — mqtt.js throws synchronously on an undefined
            // topic and crashes the whole server. Drop it here.
            if (!message || typeof message.topic !== 'string' || message.topic.length === 0) {
                logger.warn('hub: ignoring send without topic from ' + address);
                return;
            }

            logger.debug('send ' + message.topic);
            bridge.insertTopic(message.topic);
            updateCache(message);
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

        // ------------------------------------------------------------------ presence (N24)
        // Bridge-backend viewers register their retained status topic; the
        // server clears it when the socket goes away — the bridge equivalent
        // of a direct-MQTT viewer's broker LWT.
        socket.on('presence', data => {
            socket._presenceTopic = (data && typeof data.topic === 'string' && data.topic) ? data.topic : null;
            if (socket._presenceTopic) logger.debug('presence ' + socket._presenceTopic);
        });

        // ------------------------------------------------------------------ disconnect
        socket.on('disconnect', () => {
            logger.debug('disconnect ' + address);
            socketSubscriptions.delete(socket.id);
            // N24: clear the viewer's retained presence status (empty retained
            // publish) — locally (hub cache + connected sockets) and on the
            // broker.
            if (socket._presenceTopic) {
                const clear = {topic: socket._presenceTopic, payload: '', retain: true};
                broadcast(clear);
                bridge.publish(clear);
            }
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
        updateCache(message);
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

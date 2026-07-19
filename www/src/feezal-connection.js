// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal viewer runtime
import {LitElement} from 'lit';

/**
 * feezal-connection
 *
 * Connection abstraction. Delegates to a backend implementation:
 *   backend="feezal" (default) — Socket.IO to the standalone feezal server (editor use)
 *   backend="mqtt"             — Direct MQTT-WS to a broker (viewer use)
 *
 * Manages subscriptions and fans out incoming messages to registered callbacks
 * using MQTT-style topic matching.
 */
class FeezalConnection extends LitElement {
    static properties = {
        connected: {type: Boolean, reflect: true},
        backend: {type: String, reflect: true},
        config: {type: Object}
    };

    constructor() {
        super();
        this.connected = false;
        this.backend = 'feezal';
        this.subscriptions = [];
    }

    /** MQTT wildcard topic matching */
    static topicMatch(topic, wildcard) {
        if (topic === wildcard) {
            return [];
        }

        if (wildcard === '#') {
            return [topic];
        }

        const res = [];
        const t = String(topic).split('/');
        const w = String(wildcard).split('/');

        let i = 0;
        for (let lt = t.length; i < lt; i++) {
            if (w[i] === '+') {
                res.push(t[i]);
            } else if (w[i] === '#') {
                res.push(t.slice(i).join('/'));
                return res;
            } else if (w[i] !== t[i]) {
                return null;
            }
        }

        if (w[i] === '#') {
            i += 1;
        }

        return (i === w.length) ? res : null;
    }

    connectedCallback() {
        super.connectedCallback();

        // Flush subscriptions queued before this element was upgraded
        // (Polymer elements call feezal.connection.subscribe in connectedCallback;
        // if feezal-connection wasn't upgraded yet a stub queued them here).
        if (feezal._subQueue && feezal._subQueue.length) {
            feezal._subQueue.forEach(({topic, options, callback}) => this.sub(topic, options, callback));
            feezal._subQueue = null;
        }

        const backend = this.getAttribute('backend') || 'feezal';

        // Use explicit string literals in import() so Rollup emits proper lazy chunks.
        // A variable-based import() cannot be statically analysed and produces 404s.
        const importPromise = backend === 'mqtt'
            ? import('./feezal-connection-mqtt.js')
            : import('./feezal-connection-feezal.js');

        importPromise.then(() => {
            const tagName = backend === 'mqtt'
                ? 'feezal-connection-mqtt'
                : 'feezal-connection-feezal';

            this.conn = document.createElement(tagName);
            if (backend === 'mqtt' && this.config) {
                this.conn.config = this.config;
            }

            this.shadowRoot.append(this.conn);
            this.conn.connect();

            this.conn.addEventListener('connected', e => {
                console.log('feezal-connection: connected');
                this.connected = true;
                if (this.subscriptions.length > 0) {
                    this.conn.subscribe([...new Set(this.subscriptions.map(s => s.topic))]);
                }

                this.dispatchEvent(new CustomEvent('connected', {
                    bubbles: true,
                    composed: true,
                    detail: e.detail || {}
                }));
            });

            this.conn.addEventListener('disconnected', () => {
                console.log('feezal-connection: disconnected');
                this.connected = false;
                this.dispatchEvent(new Event('disconnected'));
            });

            this.conn.addEventListener('message', event => {
                const msg = event.detail;
                console.log('[feezal-msg] topic=%s payload=%o retain=%o', msg.topic, msg.payload, msg.retain);
                this._spreadMessage(msg);
                // E39 (splash): re-dispatch a public 'message' event on the
                // connection so the splash element can time its retained-message
                // settle window against the raw broker stream. `_spreadMessage`
                // stays the subscription fan-out; nothing else consumes this.
                this.dispatchEvent(new CustomEvent('message', {detail: msg}));
            });
        });
    }

    _spreadMessage(message) {
        this.subscriptions
            .filter(s => FeezalConnection.topicMatch(message.topic, s.topic) !== null)
            .forEach(s => s.callback(message));
    }

    getSite(site, callback) {
        this.conn.getSite(site, callback);
    }

    sub(topic, options, callback) {
        if (!topic) {
            return;
        }

        if (typeof options === 'function') {
            callback = options;
            options = {};
        }

        if (this.conn && this.connected && !this.subscriptions.some(s => s.topic === topic)) {
            this.conn.subscribe([topic]);
        }

        const subscription = {topic, options, callback};
        this.subscriptions.push(subscription);
        return subscription;
    }

    unsubscribe(subscription) {
        if (!subscription) {
            return;
        }

        this.subscriptions = this.subscriptions.filter(s => s !== subscription);
        if (this.conn && !this.subscriptions.some(s => s.topic === subscription.topic)) {
            this.conn.unsubscribe([subscription.topic]);
        }
    }

    pub(topic, payload, options = {}) {
        console.log('[feezal-pub] topic=%s payload=%o conn=%o connected=%o', topic, payload, !!this.conn, this.connected);
        if (options.local) {
            this._spreadMessage({topic, payload});
        } else if (this.conn && this.connected) {
            // N24: retained publishes (viewer presence status) carry the flag
            // through both backends (mqtt directly, bridge via the hub).
            this.conn.publish({topic, payload, retain: options.retain === true}, options);
        } else {
            console.warn('[feezal-pub] BLOCKED — conn=%o connected=%o topic=%s', !!this.conn, this.connected, topic);
        }
    }

    /** N24: viewer-presence handshake — bridge-backend viewers register their
     * status topic with the server so it can clear it (retained empty publish)
     * when the socket disconnects; direct-MQTT viewers use a broker LWT
     * instead. No-op on backends without presence support. */
    presence(statusTopic) {
        this.conn?.presence?.(statusTopic);
    }

    deploy(data, callback) {
        this.conn.deploy(data, callback);
    }
}

window.customElements.define('feezal-connection', FeezalConnection);

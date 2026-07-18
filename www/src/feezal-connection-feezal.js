// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal viewer runtime
import {LitElement} from 'lit';
import {io} from 'socket.io-client';

/**
 * feezal-connection-feezal
 *
 * Connects the editor to the standalone feezal server via Socket.IO.
 * Used for editor operations only: deploy, getSite, subscribe (local preview), send.
 *
 * The viewer never uses this — it uses feezal-connection-mqtt directly.
 */
class FeezalConnectionFeezal extends LitElement {
    static properties = {
        connected: {type: Boolean, reflect: true}
    };

    constructor() {
        super();
        this.connected = false;
        this.reconnectCounter = 0;
    }

    connect() {
        const socketPath = '/socket.io';
        console.log('feezal-connection-feezal connecting, path=', socketPath);

        this.socket = io({path: socketPath, reconnection: true});

        this.socket.on('connect', () => {
            console.log('feezal-connection-feezal connected');
            this.connected = true;
            // NOT bubbles/composed: this element lives inside the
            // feezal-connection wrapper's shadow root — a composed event would
            // cross the shadow boundary and fire on the wrapper host IN
            // ADDITION to the wrapper's own re-dispatch, so every listener saw
            // 'connected' twice (reconnect: 0 both times) → getSite/loadViews
            // ran twice, elements were built twice, and the hub's retained
            // replay raced the second generation (state missing ~50/50 per
            // editor load). The wrapper listens directly on this element and
            // re-dispatches the single public 'connected'.
            this.dispatchEvent(new CustomEvent('connected', {
                detail: {reconnect: this.reconnectCounter++}
            }));
        });

        this.socket.on('disconnect', () => {
            console.log('feezal-connection-feezal disconnected');
            this.connected = false;
            this.dispatchEvent(new Event('disconnected'));
        });

        // N32 — the server pushes 'reload' after a deploy. Only the viewer
        // runtime obeys (never the editor, which would lose its session),
        // and only for the site that was actually deployed.
        this.socket.on('reload', data => {
            if (window.feezal?.isEditor) return;
            if (data?.site && window.feezal?.siteName && data.site !== window.feezal.siteName) return;
            window.location.reload();
        });

        this.socket.on('input', message => {
            this.dispatchEvent(new CustomEvent('message', {detail: message}));
            // Feed topic into the server's autocomplete trie
            if (message && message.topic) {
                this.socket.emit('topicSeen', message.topic);
            }
        });

        this.socket.on('connect_error', err => {
            console.error('feezal socket error', err.message);
        });
    }

    subscribe(topics) {
        this.socket.emit('subscribe', topics);
    }

    unsubscribe(topics) {
        this.socket.emit('unsubscribe', topics);
    }

    publish(message) {
        this.socket.emit('send', message);
    }

    /** N24: register this client's presence status topic with the server —
     * the hub clears it (retained empty publish) when the socket disconnects;
     * the bridge-backend equivalent of a broker LWT. */
    presence(statusTopic) {
        this.socket.emit('presence', {topic: statusTopic});
    }

    deploy(data, callback) {
        this.socket.emit('deploy', data, callback);
    }

    getSite(site, callback) {
        this.socket.emit('getSite', site, callback);
    }
}

window.customElements.define('feezal-connection-feezal', FeezalConnectionFeezal);

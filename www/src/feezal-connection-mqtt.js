// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal viewer runtime
import {LitElement} from 'lit';
import mqtt from 'mqtt';

function random32bit() {
    const u = new Uint32Array(1);
    window.crypto.getRandomValues(u);
    const string = u[0].toString(16).toUpperCase();
    return '00000000'.slice(string.length) + string;
}

/**
 * feezal-connection-mqtt
 *
 * Direct MQTT-over-WebSocket connection for the viewer (and optionally the editor preview).
 * Replaces the previous Paho-based implementation with mqtt.js v5.
 */
class FeezalConnectionMqtt extends LitElement {
    static properties = {
        connected: {type: Boolean, reflect: true},
        config: {type: Object}
    };

    constructor() {
        super();
        this.connected = false;
    }

    connect() {
        const cfg = this.config || {};

        // N10: static exports carry no credentials — the config carries a
        // credentialPrompt flag instead. Ask the user on first load; the
        // entered credentials live in session/local storage on the device.
        if (cfg.credentialPrompt && !this._runtimeCreds) {
            this._runtimeCreds = this._loadStoredCredentials();
            if (!this._runtimeCreds) {
                this._showCredentialPrompt();
                return; // connect() re-runs after the prompt is submitted
            }
        }

        const clientId = cfg.clientId || ('feezal-' + random32bit());
        const uri = this._runtimeCreds?.uri || cfg.uri;

        console.log('feezal-connection-mqtt connecting to', uri);

        const options = {
            clientId,
            // N9: MQTT protocol version — 4 (3.1.1, default) or 5 (MQTT 5.0)
            protocolVersion: Number(cfg.protocolVersion) === 5 ? 5 : 4,
            // mqtt.js writes each MQTT packet field as its own chunk; an empty
            // payload (retained clear — presence rename, element clears) becomes
            // an EMPTY WebSocket frame, which mosquitto rejects as a protocol
            // error and closes the connection. A zero-length frame carries no
            // MQTT bytes — dropping the send is a no-op on the wire.
            // (Same guard server-side in server/src/mqtt/bridge.js.)
            createWebsocket: (url, protocols) => {
                const socket = new WebSocket(url, protocols);
                const send = socket.send.bind(socket);
                socket.send = data => {
                    const len = data == null ? 0 : (data.length ?? data.byteLength ?? 0);
                    if (len === 0) return;
                    send(data);
                };
                return socket;
            }
        };

        if (this._runtimeCreds?.username) {
            options.username = this._runtimeCreds.username;
        }

        if (this._runtimeCreds?.password) {
            options.password = this._runtimeCreds.password;
        }

        if (cfg.lwt && cfg.lwp) {
            options.will = {topic: cfg.lwt, payload: cfg.lwp, retain: false, qos: 0};
        } else {
            // N24: viewer presence — the presence module provides a will that
            // clears the retained status topic on ungraceful disconnect
            // (retained empty publish). An explicitly configured LWT wins.
            const presenceWill = window.feezal?.presenceWill?.();
            if (presenceWill) {
                options.will = {topic: presenceWill.topic, payload: presenceWill.payload ?? '', retain: presenceWill.retain === true, qos: 0};
            }
        }

        this.client = mqtt.connect(uri, options);

        this.client.on('connect', () => {
            console.log('feezal-connection-mqtt connected');
            this.connected = true;
            if (cfg.oct && cfg.ocp) {
                this.client.publish(cfg.oct, cfg.ocp);
            }

            this.dispatchEvent(new Event('connected'));
        });

        this.client.on('close', () => {
            console.log('feezal-connection-mqtt disconnected');
            this.connected = false;
            this.dispatchEvent(new Event('disconnected'));
        });

        this.client.on('error', err => {
            console.error('feezal-connection-mqtt error', err.message);
            // N10: bad credentials (CONNACK 4/5) → clear the stored ones and
            // re-prompt instead of hammering the broker with retries.
            if (cfg.credentialPrompt && (err.code === 4 || err.code === 5 || /authoriz|password/i.test(String(err.message)))) {
                this.client.end(true);
                this._clearStoredCredentials();
                this._runtimeCreds = null;
                this._showCredentialPrompt('Broker rejected the credentials — please try again.');
            }
        });

        this.client.on('message', (topic, payload) => {
            let payloadStr = payload.toString();
            let parsed = payloadStr;
            if (payloadStr.startsWith('{') || payloadStr.startsWith('[')) {
                try {
                    parsed = JSON.parse(payloadStr);
                } catch {}
            }

            this.dispatchEvent(new CustomEvent('message', {
                detail: {topic, payload: parsed}
            }));
        });
    }

    subscribe(topics) {
        topics.forEach(topic => {
            if (topic) {
                console.log('feezal-connection-mqtt subscribe', topic);
                this.client.subscribe(topic);
            }
        });
    }

    unsubscribe(topics) {
        topics.forEach(topic => {
            if (topic) {
                this.client.unsubscribe(topic);
            }
        });
    }

    publish(message, _options = {}) {
        console.log('[feezal-mqtt-pub] connected=%o topic=%s payload=%o retain=%o', this.connected, message.topic, message.payload, message.retain);
        if (this.connected && message.topic) {
            // N24: retained publishes (presence status) pass the flag through.
            this.client.publish(message.topic, String(message.payload), {retain: message.retain === true});
            console.log('[feezal-mqtt-pub] sent OK');
        } else {
            console.warn('[feezal-mqtt-pub] BLOCKED — connected=%o topic=%s', this.connected, message.topic);
        }
    }

    // ── N10: runtime credential prompt (static exports) ──────────────────────
    // The export never contains credentials; the person opening the page
    // enters them once. sessionStorage by default (cleared when the tab
    // closes), localStorage with the "Remember" checkbox.

    static CREDENTIAL_KEY = 'feezal-mqtt-credentials';

    _loadStoredCredentials() {
        for (const store of [window.sessionStorage, window.localStorage]) {
            try {
                const raw = store.getItem(FeezalConnectionMqtt.CREDENTIAL_KEY);
                if (raw) {
                    return JSON.parse(raw);
                }
            } catch { /* storage unavailable or corrupt entry */ }
        }

        return null;
    }

    _storeCredentials(creds, remember) {
        try {
            const store = remember ? window.localStorage : window.sessionStorage;
            store.setItem(FeezalConnectionMqtt.CREDENTIAL_KEY, JSON.stringify(creds));
        } catch { /* storage unavailable (private mode) — session-only in memory */ }
    }

    _clearStoredCredentials() {
        for (const store of [window.sessionStorage, window.localStorage]) {
            try {
                store.removeItem(FeezalConnectionMqtt.CREDENTIAL_KEY);
            } catch { /* ignore */ }
        }
    }

    /** Plain-DOM overlay — no Shoelace (editor-only) and no external assets. */
    _showCredentialPrompt(errorMessage = '') {
        this._removeCredentialPrompt();
        const cfg = this.config || {};

        const overlay = document.createElement('div');
        overlay.id = 'feezal-credential-prompt';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;'
            + 'justify-content:center;background:rgba(0,0,0,0.55);font-family:inherit;';
        overlay.innerHTML = `
            <form style="background:var(--primary-background-color,#fff);color:var(--primary-text-color,#333);
                border-radius:8px;padding:24px;min-width:280px;max-width:92vw;box-shadow:0 8px 32px rgba(0,0,0,0.35);
                display:flex;flex-direction:column;gap:10px;">
                <div style="font-size:16px;font-weight:600;">Connect to MQTT broker</div>
                ${errorMessage ? `<div data-role="error" style="color:#d32f2f;font-size:13px;">${errorMessage}</div>` : ''}
                <label style="display:flex;flex-direction:column;gap:3px;font-size:12px;opacity:0.85;">Broker URL
                    <input name="uri" type="text" required value="" style="font:inherit;padding:6px 8px;border:1px solid #9994;border-radius:4px;background:inherit;color:inherit;">
                </label>
                <label style="display:flex;flex-direction:column;gap:3px;font-size:12px;opacity:0.85;">Username
                    <input name="username" type="text" autocomplete="username" style="font:inherit;padding:6px 8px;border:1px solid #9994;border-radius:4px;background:inherit;color:inherit;">
                </label>
                <label style="display:flex;flex-direction:column;gap:3px;font-size:12px;opacity:0.85;">Password
                    <input name="password" type="password" autocomplete="current-password" style="font:inherit;padding:6px 8px;border:1px solid #9994;border-radius:4px;background:inherit;color:inherit;">
                </label>
                <label style="display:flex;align-items:center;gap:6px;font-size:12px;">
                    <input name="remember" type="checkbox"> Remember on this device
                </label>
                <button type="submit" style="font:inherit;padding:8px;border:none;border-radius:4px;cursor:pointer;
                    background:var(--primary-color,#0284c7);color:#fff;font-weight:600;">Connect</button>
            </form>`;
        overlay.querySelector('input[name=uri]').value = cfg.uri || '';
        overlay.querySelector('form').addEventListener('submit', event => {
            event.preventDefault();
            const field = name => event.target.querySelector(`[name=${name}]`);
            const creds = {
                uri: field('uri').value.trim(),
                username: field('username').value.trim(),
                password: field('password').value
            };
            this._storeCredentials(creds, field('remember').checked);
            this._runtimeCreds = creds;
            this._removeCredentialPrompt();
            this.connect();
        });
        document.body.append(overlay);
        overlay.querySelector('input[name=username]').focus();
    }

    _removeCredentialPrompt() {
        document.querySelector('#feezal-credential-prompt')?.remove();
    }
}

window.customElements.define('feezal-connection-mqtt', FeezalConnectionMqtt);

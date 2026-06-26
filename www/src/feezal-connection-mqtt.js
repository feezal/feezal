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
        const clientId = cfg.clientId || ('feezal-' + random32bit());

        console.log('feezal-connection-mqtt connecting to', cfg.uri);

        const options = {clientId};

        if (cfg.lwt && cfg.lwp) {
            options.will = {topic: cfg.lwt, payload: cfg.lwp, retain: false, qos: 0};
        }

        this.client = mqtt.connect(cfg.uri, options);

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
        if (this.connected && message.topic) {
            this.client.publish(message.topic, String(message.payload));
        }
    }
}

window.customElements.define('feezal-connection-mqtt', FeezalConnectionMqtt);

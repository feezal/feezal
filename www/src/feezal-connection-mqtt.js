import {PolymerElement} from '@polymer/polymer/polymer-element';
import {Paho} from './paho-mqtt.js';

function random32bit() {
    const u = new Uint32Array(1);
    window.crypto.getRandomValues(u);
    const str = u[0].toString(16).toUpperCase();
    return '00000000'.slice(str.length) + str;
}

class FeezalConnectionMqtt extends PolymerElement {
    static get properties() {
        return {
            connected: {
                type: Boolean,
                reflectToAttribute: true,
                value: false
            },
            config: {
                type: Object
            }
        };
    }

    connect() {
        console.log('feezal-connection-mqtt connecting...', this.config.uri);

        this.client = new Paho.MQTT.Client(this.config.uri, this.config.clientId || ('feezal-' + random32bit()));

        this.client.onConnected = reconnect => {
            console.log('feezal-connection-mqtt connected reconnect=' + reconnect);
            this.connected = true;
            const event = new Event('connected');
            this.dispatchEvent(event);
        };

        this.client.onConnectionLost = responseObject => {
            console.error('feezal-connection-mqtt disconnected', responseObject);
            this.connected = false;
            const event = new Event('disconnected');
            this.dispatchEvent(event);
        };

        this.client.onMessageArrived = message => {
            //console.log('feezal-connection-mqtt onMessageArrived', message);
            const msg = {
                topic: message.destinationName,
                payload: message.payloadString,
                cached: message.retained
            };
            const event = new CustomEvent('message', {detail: msg});
            this.dispatchEvent(event);
        };

        this.client.connect({
            uris: [this.config.uri]
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
                console.log('feezal-connection-mqtt unsubscribe', topic);
                this.client.unsubscribe(topic);
            }
        });
    }

    publish(msg, options = {}) {
        if (this.connected && msg.topic) {
            const message = new Paho.MQTT.Message(String(msg.payload));
            message.destinationName = msg.topic;
            this.client.send(message);
        }
    }
}

window.customElements.define('feezal-connection-mqtt', FeezalConnectionMqtt);

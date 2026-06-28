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
            this.dispatchEvent(new CustomEvent('connected', {
                bubbles: true,
                composed: true,
                detail: {reconnect: this.reconnectCounter++}
            }));
        });

        this.socket.on('disconnect', () => {
            console.log('feezal-connection-feezal disconnected');
            this.connected = false;
            this.dispatchEvent(new Event('disconnected'));
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

    deploy(data, callback) {
        this.socket.emit('deploy', data, callback);
    }

    getSite(site, callback) {
        this.socket.emit('getSite', site, callback);
    }
}

window.customElements.define('feezal-connection-feezal', FeezalConnectionFeezal);

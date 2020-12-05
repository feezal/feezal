import {PolymerElement} from '@polymer/polymer/polymer-element';

function getScript(source, callback) {
    let script = document.createElement('script');
    const prior = document.querySelectorAll('script')[0];
    script.async = 1;

    script.addEventListener('load', script.onreadystatechange = function (_, isAbort) {
        if (isAbort || !script.readyState || /loaded|complete/.test(script.readyState)) {
            script.addEventListener('load', script.onreadystatechange = null);
            script = undefined;

            if (!isAbort && callback) {
                setTimeout(callback, 0);
            }
        }
    });

    script.src = source;
    prior.parentNode.insertBefore(script, prior);
}

class FeezalConnectionNodeRed extends PolymerElement {
    static get properties() {
        return {
            connected: {
                type: Boolean,
                reflectToAttribute: true,
                value: false
            },
            socketPath: {
                type: String,
                value: location.pathname.replace(/feezal\/(editor|viewer)\/.*/, 'feezal/socket.io'),
                reflectToAttribute: true
            }
        };
    }

    constructor() {
        super();
    }

    init() {
        console.log('feezal-connection-node-red connect', this.socketPath);
        this.socket = io.connect({path: this.socketPath, secure: false, reconnect: true, rejectUnauthorized: false});

        this.socket.on('input', msg => {
            console.log('input', msg);
            const event = new CustomEvent('message', {detail: msg});
            this.dispatchEvent(event);
        });

        this.socket.on('error', error => {
            console.error(error);
        });

        this.socket.on('connect_error', error => {
            console.error(error);
        });

        this.socket.on('connect_timeout', timeout => {
            console.error('connect timeout', timeout);
        });

        this.socket.on('connect', () => {
            console.log('node-red socket connected.');
            const event = new CustomEvent('connected', {bubbles: true, composed: true, detail: {reconnect: this.reconnectCounter++}});
            this.dispatchEvent(event);
        });
    }

    connect() {
        const url = feezal.isEditor ? '../socket.io/socket.io.js' : 'node_modules/socket.io-client/dist/socket.io.js';
        getScript(url, () => {
            console.log('socket.io loaded!');
            console.log('socketPath', this.socketPath);
            if (typeof io === 'undefined') {
                throw new TypeError('socket.io missing');
            }

            this.reconnectCounter = 0;
            this.init();
        });
    }

    subscribe(topics) {
        console.log('subscribe...', topics);
        this.socket.emit('subscribe', topics);
    }

    unsubscribe(topics) {
        this.socket.emit('unsubscribe', topics);
    }

    publish(msg) {
        this.socket.emit('send', msg);
    }

    deploy(data, callback) {
        this.socket.emit('deploy', data, callback);
    }

    getSite(site, callback) {
        this.socket.emit('getSite', site, callback);
    }
}

window.customElements.define('feezal-connection-node-red', FeezalConnectionNodeRed);

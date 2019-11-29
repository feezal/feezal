import {PolymerElement, html} from '@polymer/polymer/polymer-element';

class FeezalConnection extends PolymerElement {
    static get properties() {
        return {
            connected: {
                type: Boolean,
                reflectToAttribute: true
            },
            subscriptions: {
                type: Array,
                value: []
            },
            backend: {
                type: String,
                default: 'node-red',
                reflectToAttribute: true
            },
            config: {
                type: Object
            }
        };
    }

    static get template() {
        return html``;
    }

    /**
     * Match a (mqtt) topic against a wildcard
     * @param topic
     * @param wildcard
     * @returns {*}
     */
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

        switch (this.backend) {
            case 'mqtt':
                import('./feezal-connection-mqtt.js').then(() => {
                    this.conn = document.createElement('feezal-connection-mqtt');
                    this.conn.config = this.config;
                    this.connect();
                });
                break;

            default:
                import('./feezal-connection-node-red.js').then(() => {
                    this.conn = document.createElement('feezal-connection-node-red');
                    this.connect();
                });
                break;
        }
    }

    connect() {
        this.shadowRoot.appendChild(this.conn);
        this.conn.connect();

        this.conn.addEventListener('connected', () => {
            console.log('connected');
            this.connected = true;
            this.conn.subscribe([...new Set(this.subscriptions.map(s => s.topic))]);
        });

        this.conn.addEventListener('disconnected', () => {
            console.log('disconnected');
            this.connected = false;
        });

        if (!feezal.isEditor) {
            this.conn.addEventListener('message', event => {
                console.log('message', event.detail.topic, event.detail.payload);
                this.spreadMessage(event.detail);
            });
        }
    }

    spreadMessage(msg) {
        this.subscriptions
            .filter(s => FeezalConnection.topicMatch(msg.topic, s.topic))
            .forEach(s => {
                // Console.log('callback!')
                s.callback(msg);
            });
    }

    getViews(callback) {
        this.conn.getViews(callback);
    }

    getSite(site, callback) {
        this.conn.getSite(site, callback);
    }

    subscribe(topic, options, callback) {
        console.log('subscribe', topic);
        if (feezal.isEditor || !topic) {
            return;
        }

        if (typeof options === 'function') {
            callback = options;
            options = {};
        }

        if (this.conn && this.connected && this.subscriptions.filter(s => topic === s.topic).length === 0) {
            this.conn.subscribe([topic]);
        }

        const subscription = {topic, options, callback};
        this.subscriptions.push(subscription);
        //console.log('connection.subscribe', topic, this.subscriptions.length);
        return subscription;
    }

    unsubscribe(subscription) {
        if (!subscription) {
            return;
        }

        this.subscriptions = this.subscriptions.filter(s => subscription !== s);
        if (this.conn && this.subscriptions.filter(s => subscription.topic === s.topic).length === 0) {
            this.conn.unsubscribe([subscription.topic]);
        }
    }

    publish(topic, payload, options = {}) {
        console.log('publish', topic, payload, options);
        if (options.local) {
            this.spreadMessage({topic, payload});
        } else if (this.conn && this.connected) {
            this.conn.publish({topic, payload}, options);
        } else {
            console.error('could not publish', Boolean(this.conn), this.connected, topic, payload);
        }
    }

    deploy(data, callback) {
        console.log('deploy', data);
        this.conn.deploy(data, callback);
    }
}

window.customElements.define('feezal-connection', FeezalConnection);

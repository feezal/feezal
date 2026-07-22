import {FeezalPolymerElement, html} from "@feezal/feezal-element/feezal-polymer-element.js";

import '@polymer/paper-tabs/paper-tabs';
import '@polymer/paper-tabs/paper-tab';

class FeezalElementPaperTabs extends FeezalPolymerElement {
    static get template() {
        return html`
            <style include="feezal-style-element">
                iframe {
                    border: var(--feezal-basic-iframe-border);
                    padding: 0;
                    margin: 0;
                    width: 100%;
                    height: 100%;
                    box-sizing: border-box;
                }
            </style>
            <paper-tabs id="tabs" selected="{{selected}}">
                <template is="dom-repeat" items="{{arrItems}}">
                    <paper-tab>{{item}}</paper-tab>
                </template>
            </paper-tabs>
            
        `;
    }
    static get properties() {
        return {
            subscribe: {
                type: String,
                reflectToAttribute: true
            },
            publish: {
                type: String,
                reflectToAttribute: true
            },
            publishLocal: {
                type: Boolean,
                value: false,
                reflectToAttribute: true
            },
            items: {
                type: String,
                value: '',
                reflectToAttribute: true,
                observer: '_itemsChanged'
            },
            arrItems: {
                type: Array
            },
            refresh: {
                type: Number,
                value: 0,
                reflectToAttribute: true
            },
            selected: {
                type: String,
                reflectToAttribute: true,
                notify: true
            }
        }
    }
    static get feezal() {
        return {
            palette: {
                category: 'Paper',
                name: 'Tabs',
                color: '#4a6080'
            },
            attributes: [
                'subscribe',
                'messageProperty',
                'publish',
                // E117: converged on the shared publish-local descriptor
                // (Polymer — inline copy, same wording as @feezal/feezal-element).
                {name: 'publish-local', type: 'boolean', default: false,
                    help: 'Publish page-locally instead of to the broker: the payload reaches only subscribers in THIS browser tab (dialog triggers, view switches, wiring elements together). Nothing is sent over MQTT, nothing is retained, and it works while disconnected.'},
                {name: 'items', type: 'objectList', itemFields: [{key: '', placeholder: 'tab name'}],
                    help: 'Tab names — one per row. Stored as a JSON array; legacy slash-separated strings keep working.'},
                {name: 'refresh', type: 'number', label: 'Refresh interval (s)'}
            ],
            baseAttribute: 'selected',
            styles: [
                'top',
                'left',
                'width',
                'height',
                'border',
                '--paper-tabs-selection-bar-color'
            ],
            restrict: {
                minWidth: 12,
                minHeight: 12
            }
        };
    }
    connectedCallback() {
        super.connectedCallback();
        this.$.tabs.addEventListener('selected-item-changed', e => {
            console.log('tabs', e);
            if (e.detail && e.detail.value) {
                const item = e.detail.value.innerHTML;
                feezal.connection.pub(this.publish, item, {local: this.publishLocal});
            }
        })


        if (this.subscribe) {
            // addSubscription tracks the subscription so disconnectedCallback
            // releases it (a bare feezal.connection.sub() would leak).
            this.addSubscription(this.subscribe, msg => {
                this.$.tabs.selected = this.arrItems.indexOf(msg.payload);
            });
        }

    }
    _itemsChanged(items) {
        // U35: the list editor stores a JSON array of tab names; legacy
        // slash-separated strings ("One/Two") keep working as a fallback.
        const raw = String(items ?? '').trim();
        if (raw.startsWith('[')) {
            try {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) {
                    this.arrItems = arr.map(String);
                    return;
                }
            } catch { /* fall through to slash-split */ }
        }
        this.arrItems = raw ? raw.split('/') : [];
    }
}

window.customElements.define('feezal-element-paper-tabs', FeezalElementPaperTabs);

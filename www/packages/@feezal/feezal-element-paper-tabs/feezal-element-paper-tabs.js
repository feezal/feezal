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
                'publishLocal',
                {name: 'items', help: 'Slash-separated list of tab names'},
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


        if (!feezal.isEditor && this.subscribe) {
            feezal.connection.sub(this.subscribe, msg => {
                this.$.tabs.selected = this.arrItems.indexOf(msg.payload);
            });
        }

    }
    _itemsChanged(items) {
        this.arrItems = items.split('/')
    }
}

window.customElements.define('feezal-element-paper-tabs', FeezalElementPaperTabs);

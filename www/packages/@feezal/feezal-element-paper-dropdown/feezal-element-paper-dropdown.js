import {FeezalPolymerElement, html} from "@feezal/feezal-element/feezal-polymer-element.js";

import '@polymer/paper-dropdown-menu/paper-dropdown-menu';
import '@polymer/paper-item/paper-item';
import '@polymer/paper-listbox/paper-listbox';

class FeezalElementPaperDropdown extends FeezalPolymerElement {
    static get template() {
        return html`
            <style include="feezal-style-element"></style>
            <paper-dropdown-menu id="dropdown" label="[[label]]" placeholder="[[placeholder]]">
                <paper-listbox slot="dropdown-content" attr-for-selected="data-value" selected="{{value}}" on-selected-changed="_changed">
                     <template is="dom-repeat" items="[[items]]">
                        <paper-item data-value$="[[item.value]]">[[item.name]]</paper-item>
                     </template>
                </paper-listbox>
            </paper-dropdown-menu>
        `;
    }
    static get properties() {
        return {
            subscribe: {
                type: String,
                value: '',
                reflectToAttribute: true,
            },
            publish: {
                type: String,
                value: '',
                reflectToAttribute: true,
            },
            label: {
                type: String,
                value: '',
                reflectToAttribute: true,
            },
            placeholder: {
                type: String,
                value: '',
                reflectToAttribute: true,
            },
            items: {
                type: Array,
                reflectToAttribute: true,
                notify: true
            },
            value: {
                type: String,
                value: '',
                reflectToAttribute: true,
                notify: true
            }
        }
    }

    static get feezal() {
        return {
            palette: {
                category: 'Paper',
                name: 'Dropdown',
                color: '#4a6080'
            },
            attributes: [
                'subscribe',
                'messageProperty',
                'publish',
                'label',
                'placeholder',
                {
                    name: 'items',
                    elemProperties: ['name', 'value']
                }
            ],
            baseAttribute: 'value',
            styles: [
                'top',
                'left',
                'width',
                'height'
            ],
            restrict: {
                minWidth: 36,
                minHeight: 12
            },
            defaultStyle: {
                width: '140px',
                height: '60px'
            }
        };
    }

    _deserializeValue(value, type) {
        if (type === Object || type === Array) {
            return JSON.parse(value.replace(/&quot;/g, '"'));
        } else {
            return super._deserializeValue(value, type);
        }
    }

    _serializeValue(value) {
        if (typeof value === 'object') {
            return JSON.stringify(value).replace(/"/g, '&quot;');
        }
        return super._serializeValue(value);
    }
    _changed(event) {
        console.log(event)
        if (this.publish && event.detail.value) {
            feezal.connection.pub(this.publish, event.detail.value);
        }
    }
}

window.customElements.define('feezal-element-paper-dropdown', FeezalElementPaperDropdown);

export {FeezalElementPaperDropdown};
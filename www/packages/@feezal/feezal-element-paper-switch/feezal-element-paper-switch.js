import {FeezalPolymerElement, html} from "@feezal/feezal-element/feezal-polymer-element.js";

import '@polymer/paper-toggle-button';

class FeezalElementPaperSwitch extends FeezalPolymerElement {
    static get template() {
        return html`
            <style include="feezal-style-element"></style>
            <style>
                :host {
                    overflow: visible;
                }
            </style>
            <paper-toggle-button id="switch"
                noink="[[noink]]" 
                disabled="[[disabled]]" 
                invalid="[[invalid]]"
                checked="{{checked}}"
                id="toggle"
            >[[label]]</paper-toggle-button>
        `;
    }
    static get properties() {
        return {
            label: {
                type: String,
                value: '',
                reflectToAttribute: true
            },
            subscribe: {
                type: String,
                value: '',
                reflectToAttribute: true
            },
            publish: {
                type: String,
                value: '',
                reflectToAttribute: true
            },
            disabled: {
                type: Boolean,
                value: false,
                reflectToAttribute: true
            },
            invalid: {
                type: Boolean,
                value: false,
                reflectToAttribute: true
            },
            checked: {
                type: Boolean,
                reflectToAttribute: true
            },
            noink: {
                type: Boolean,
                value: false,
                reflectToAttribute: true
            },
            payloadOn: {
                type: String,
                value: 'ON',
                reflectToAttribute: true
            },
            payloadOff: {
                type: String,
                value: 'OFF',
                reflectToAttribute: true
            }
        }
    }
    static get feezal() {
        return {
            palette: {
                category: 'Paper',
                name: 'Switch',
                color: '#4a6080'
            },
            discovery: {
                component: 'switch',
                map: {
                    state_topic:    'subscribe',
                    command_topic:  'publish',
                    payload_on:     'payload-on',
                    payload_off:    'payload-off',
                    name:           'label',
                    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'}
                }
            },
            attributes: [
                'label',
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload.'},
                'publish',
                {name: 'payload-on',  type: 'string', default: 'ON',
                    help: 'Payload published and expected when the switch is on.'},
                {name: 'payload-off', type: 'string', default: 'OFF',
                    help: 'Payload published and expected when the switch is off.'},
                {name: 'noink'},
                {name: 'invalid'},
                {name: 'disabled'}
            ],
            baseAttribute: 'checked',
            styles: [
                'top',
                'left',
                'width',
                'height',
                {property: '--paper-toggle-button-unchecked-bar-color', label: 'unchecked-bar-color', type: 'color'},
                {property: '--paper-toggle-button-unchecked-button-color', label: 'unchecked-button-color', type: 'color'},
                {property: '--paper-toggle-button-unchecked-ink-color', label: 'unchecked-ink-color', type: 'color'},
                {property: '--paper-toggle-button-checked-bar-color', label: 'checked-bar-color', type: 'color'},
                {property: '--paper-toggle-button-checked-button-color', label: 'checked-button-color', type: 'color'},
                {property: '--paper-toggle-button-checked-ink-color', label: 'checked-ink-color', type: 'color'},
                {property: '--paper-toggle-button-invalid-bar-color', label: 'invalid-bar-color', type: 'color'},
                {property: '--paper-toggle-button-invalid-button-color', label: 'invalid-button-color', type: 'color'},
                {property: '--paper-toggle-button-invalid-ink-color', label: 'invalid-ink-color', type: 'color'},
                {property: '--paper-toggle-button-label-color', label: 'label-color', type: 'color'},
                {property: '--paper-toggle-button-label-spacing', label: 'label-spacing'}
            ],
            restrict: {
                minWidth: 50,
                minHeight: 26
            }
        }
    }

    _subscribe() {
        if (!this.subscribe) return;
        this._subscriptions.push(feezal.connection.sub(this.subscribe, msg => {
            const v = this.getProperty(msg, this.messageProperty);
            const on = this.payloadOn || 'ON';
            const isOn = v === on || v === true || v === 1 || v === '1';
            if (isOn) {
                this.setAttribute('checked', '');
            } else {
                this.removeAttribute('checked');
            }
        }));
    }

    connectedCallback() {
        super.connectedCallback();
        this.$.switch.addEventListener('checked-changed', e => {
            feezal.connection.pub(this.publish, this.$.switch.checked
                ? (this.payloadOn || 'ON')
                : (this.payloadOff || 'OFF'));
        });
    }
}

window.customElements.define('feezal-element-paper-switch', FeezalElementPaperSwitch);

export {FeezalElementPaperSwitch};
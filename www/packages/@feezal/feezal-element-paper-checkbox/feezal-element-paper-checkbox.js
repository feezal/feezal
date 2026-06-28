import {FeezalPolymerElement, html} from "@feezal/feezal-element/feezal-polymer-element.js";

import '@polymer/paper-checkbox';

class FeezalElementPaperCheckbox extends FeezalPolymerElement {
    static get template() {
        return html`
            <style include="feezal-style-element"></style>
            <style>
                :host {
                    overflow: visible;
                }
                paper-checkbox {
                    width: 100%;
                    height: 100%;
                }
            </style>
            <paper-checkbox 
                noink="[[noink]]" 
                disabled="[[disabled]]" 
                invalid="[[invalid]]"
                checked="[[checked]]"
                id="checkbox"
            >[[label]]</paper-checkbox>
        `;
    }
    static get properties() {
        return {
            topic: {
                type: String,
                    value: '',
                    reflectToAttribute: true
            },
            label: {
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
            publish: {
                type: String,
                value: '',
                reflectToAttribute: true
            },
            payloadOn: {
                type: String,
                value: 'true',
                reflectToAttribute: true
            },
            payloadOff: {
                type: String,
                value: 'false',
                reflectToAttribute: true
            }
        }
    }
    static get feezal() {
        return {
            palette: {
                category: 'Paper',
                    name: 'Checkbox',
                    color: '#4a6080'
            },
            discovery: {
                component: 'switch',
                map: {
                    state_topic:    'topic',
                    command_topic:  'publish',
                    payload_on:     'payload-on',
                    payload_off:    'payload-off',
                    name:           'label',
                    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'}
                }
            },
            baseAttribute: 'checked',
            styles: [
                'top',
                'left',
                'width',
                'height',
                '--paper-checkbox-size'
            ],
            attributes: [
                'topic',
                'label',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload.'},
                'noink',
                'publish',
                {name: 'payload-on',  type: 'string', default: 'true',
                    help: 'Payload published and expected when the checkbox is checked.'},
                {name: 'payload-off', type: 'string', default: 'false',
                    help: 'Payload published and expected when the checkbox is unchecked.'},
                'disabled'
            ],
            restrict: {
                minWidth: 40,
                minHeight: 22
            }
        }

    }

    connectedCallback() {
        super.connectedCallback();
        feezal.connection.sub(this.topic, msg => {
            const v = this.getProperty(msg, this.messageProperty);
            if (String(v) === (this.payloadOn || 'true')) {
                this.setAttribute('checked', '');
            } else {
                this.removeAttribute('checked');
            }
        });
        this.$.checkbox.addEventListener('checked-changed', event => {
            const topic = this.publish || this.topic;
            if (topic) {
                const payload = event.detail.value
                    ? (this.payloadOn || 'true')
                    : (this.payloadOff || 'false');
                feezal.connection.pub(topic, payload);
            }
        });
    }
}

window.customElements.define('feezal-element-paper-checkbox', FeezalElementPaperCheckbox);

export {FeezalElementPaperCheckbox};
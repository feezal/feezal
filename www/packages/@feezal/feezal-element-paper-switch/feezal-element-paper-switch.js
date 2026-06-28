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
                    state_topic:   'subscribe',
                    command_topic: 'publish',
                    name:          'label'
                }
            },
            attributes: [
                'label',
                'subscribe',
                'messageProperty',
                'publish',
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

    connectedCallback() {
        super.connectedCallback();
        this.$.switch.addEventListener('checked-changed', e => {
            feezal.connection.pub(this.publish, this.$.switch.checked);
        });
    }
}

window.customElements.define('feezal-element-paper-switch', FeezalElementPaperSwitch);

export {FeezalElementPaperSwitch};
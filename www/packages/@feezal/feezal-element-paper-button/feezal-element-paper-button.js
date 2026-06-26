import {FeezalPolymerElement, html} from "@feezal/feezal-element/feezal-polymer-element.js";

import '@polymer/paper-button/paper-button';

class FeezalElementPaperButton extends FeezalPolymerElement {
    static get template() {
        return html`
            <style include="feezal-style-element"></style>
            <style>
                :host {
                    overflow: visible;
                }
                paper-button {
                    text-transform: none;
                    margin: 0;
                    width: 100%; 
                    height: 100%;
                    background-color: var(--paper-button-background-color);
                    border: var(--paper-button-border);
                    box-sizing: border-box;
                }
            </style>
            <paper-button 
                noink="[[noink]]" 
                disabled="[[disabled]]" 
                raised="[[raised]]"
                checked="[[checked]]"
                on-click="_click"
            >[[label]]</paper-button>
        `;
    }
    static get properties() {
        return {
            label: {
                type: String,
                value: ' ',
                reflectToAttribute: true
            },
            publish: {
                type: String,
                value: '',
                reflectToAttribute: true
            },
            payload: {
                type: String,
                value: '1',
                reflectToAttribute: true
            },
            disabled: {
                type: Boolean,
                value: false,
                reflectToAttribute: true
            },
            raised: {
                type: Boolean,
                value: true,
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
                name: 'Button',
                color: '#4a6080'
            },
            attributes: [
                'publish',
                'label',
                'payload',
                'raised',
                'noink',
                'disabled'
            ],
            styles: [
                'top',
                'left',
                'width',
                'height',
                'font',
                'color',
                '--paper-button-background-color',
                '--paper-button-border',
            ],
            defaultStyle: {
                width: '60px',
                height: '22px',
                color: 'var(--primary-text-color)'
            },
            restrict: {
                minWidth: 40,
                minHeight: 22
            }
        };
    }
    static get editorOptions() {
        return {

        }
    }
    _click() {
        feezal.connection.pub(this.publish, this.payload);
    }
}

window.customElements.define('feezal-element-paper-button', FeezalElementPaperButton);

export {FeezalElementPaperButton};
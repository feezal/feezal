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
                    /* E79: state-feedback colours mapped onto the paper token —
                       both default to the plain background, so nothing changes
                       until a theme/style overrides them. */
                    background-color: var(--feezal-button-inactive-color, var(--paper-button-background-color));
                    border: var(--paper-button-border);
                    box-sizing: border-box;
                }
                :host([active]) paper-button {
                    background-color: var(--feezal-button-active-color, var(--paper-button-background-color));
                }
            </style>
            <paper-button
                noink="[[noink]]"
                disabled="[[disabled]]"
                raised="[[raised]]"
                on-click="_click"
            >[[label]]</paper-button>
        `;
    }
    static get properties() {
        return {
            // E117: page-local publish (see publishLocalAttribute in the base pkg)
            publishLocal: {
                type: Boolean,
                value: false,
                reflectToAttribute: true
            },
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
            },
            // E79: state feedback — same contract as material-button.
            payloadActive: {
                type: String,
                value: '1',
                reflectToAttribute: true
            },
            payloadInactive: {
                type: String,
                value: '0',
                reflectToAttribute: true
            },
            // Reflected so theme rules can target feezal-element-paper-button[active].
            active: {
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
                {name: 'publish-local', type: 'boolean', default: false,
                    help: 'Publish page-locally instead of to the broker: the payload reaches only subscribers in THIS browser tab (dialog triggers, view switches, wiring elements together). Nothing is sent over MQTT, nothing is retained, and it works while disconnected.'},
                'label',
                'payload',
                // E79: state feedback — same attribute contract as material-button.
                {name: 'subscribe', type: 'mqttTopic', help: 'State feedback topic — payloads matching payload-active/-inactive drive the active highlight.'},
                'messageProperty',
                {name: 'payload-active',   type: 'string', default: '1', help: 'Feedback payload meaning active (highlight on). Empty together with payload-inactive = feature off.'},
                {name: 'payload-inactive', type: 'string', default: '0', help: 'Feedback payload meaning inactive. Any other payload leaves the state unchanged.'},
                'raised',
                'noink',
                {name: 'disabled', help: 'Disable the button (blocks clicking/publishing). UI-only guard — the MQTT topic itself stays writable; E50 conditions can toggle this from state.'}
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
                {property: '--feezal-button-active-color',   type: 'color', help: 'Background while the state feedback is active. Defaults to --paper-button-background-color.'},
                {property: '--feezal-button-inactive-color', type: 'color', help: 'Background while inactive. Defaults to --paper-button-background-color.'},
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

    connectedCallback() {
        super.connectedCallback();
        // E79: state feedback — matching payloads drive the active highlight;
        // anything else leaves the state unchanged. Both payloads empty =
        // feature off. The base class handles the control-topic channel.
        if (this.subscribe && (this.payloadActive || this.payloadInactive)) {
            this.addSubscription(this.subscribe, msg => {
                const v = String(this.getProperty(msg, this.messageProperty));
                if (this.payloadActive !== '' && v === String(this.payloadActive)) {
                    this.active = true;
                } else if (this.payloadInactive !== '' && v === String(this.payloadInactive)) {
                    this.active = false;
                }
            });
        }
    }

    _click() {
        if (this.disabled) return;   // E79: UI guard only — not a security boundary
        if (this.publish) {
            feezal.connection.pub(this.publish, this.payload, {local: this.publishLocal});
        }
    }
}

window.customElements.define('feezal-element-paper-button', FeezalElementPaperButton);

export {FeezalElementPaperButton};
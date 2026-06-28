/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@material/web/checkbox/checkbox.js';

class FeezalElementMaterialCheckbox extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Checkbox', category: 'Material', color: '#4a6080', icon: 'check_box'},
            description: 'MD3 checkbox — subscribes to a boolean topic and publishes checked state.',
            discovery: {
                component: 'switch',
                map: {
                    state_topic:   {attr: 'subscribe'},
                    command_topic: {attr: 'publish'},
                    payload_on:    {attr: 'payload-on'},
                    payload_off:   {attr: 'payload-off'},
                    name:          'label',
                    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
                },
            },
            attributes: [
                {name: 'subscribe',   type: 'mqttTopic', help: 'Topic to read checked state from.'},
                {name: 'publish',     type: 'mqttTopic', help: 'Topic to publish state changes to.'},
                {name: 'payload-on',  type: 'string',    help: 'Payload meaning checked. Default: ON'},
                {name: 'payload-off', type: 'string',    help: 'Payload meaning unchecked. Default: OFF'},
                {name: 'label',       type: 'string',    help: 'Label text shown beside the checkbox.'},
                {name: 'disabled',    type: 'boolean',   help: 'Disable user interaction.'},
            ],
            styles: ['top', 'left', 'width', 'height'],
            defaultStyle: {width: '140px', height: '40px'},
        };
    }

    static properties = {
        subscribe:  {type: String,  reflect: true},
        publish:    {type: String,  reflect: true},
        payloadOn:  {type: String,  reflect: true, attribute: 'payload-on'},
        payloadOff: {type: String,  reflect: true, attribute: 'payload-off'},
        label:      {type: String,  reflect: true},
        disabled:   {type: Boolean, reflect: true},
        _checked:   {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px;
            box-sizing: border-box;
            --md-sys-color-primary: var(--sl-color-primary-600, #0284c7);
        }
        label {
            font-size: 14px;
            color: var(--primary-text-color, #333);
            cursor: pointer;
            user-select: none;
        }
        .editor-ph {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            height: 100%;
            padding: 4px;
            box-sizing: border-box;
            font-size: 14px;
            color: var(--primary-text-color, #555);
        }
        .editor-ph .box {
            width: 18px;
            height: 18px;
            border: 2px solid var(--sl-color-primary-600, #0284c7);
            border-radius: 2px;
            flex-shrink: 0;
        }
    `];

    constructor() {
        super();
        this.subscribe  = '';
        this.publish    = '';
        this.payloadOn  = 'ON';
        this.payloadOff = 'OFF';
        this.label      = '';
        this.disabled   = false;
        this._checked   = false;
    }

    connectedCallback() {
        super.connectedCallback();
        if (!feezal.isEditor && this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                this._checked = v === this.payloadOn || v === true || v === 1 || v === '1' || v === 'true';
            });
        }
    }

    _onChange(e) {
        if (!this.publish) return;
        this._checked = e.target.checked;
        feezal.connection.pub(this.publish, this._checked ? this.payloadOn : this.payloadOff);
    }

    render() {
        if (feezal.isEditor) {
            return html`<div class="editor-ph"><div class="box"></div>${this.label || 'Checkbox'}</div>`;
        }
        return html`
            <md-checkbox
                ?checked="${this._checked}"
                ?disabled="${this.disabled}"
                @change="${this._onChange}">
            </md-checkbox>
            ${this.label ? html`<label @click="${() => this.shadowRoot.querySelector('md-checkbox')?.click()}">${this.label}</label>` : ''}`;
    }
}

customElements.define('feezal-element-material-checkbox', FeezalElementMaterialCheckbox);
export {FeezalElementMaterialCheckbox};

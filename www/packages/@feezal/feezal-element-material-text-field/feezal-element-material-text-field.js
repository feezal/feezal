/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@material/web/textfield/outlined-text-field.js';

class FeezalElementMaterialTextField extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Text Field', category: 'Material', color: '#4a6080', icon: 'text_fields'},
            description: 'MD3 outlined text field — subscribes to a text topic and publishes on Enter or blur.',
            attributes: [
                {name: 'label',            type: 'string',    help: 'Floating label above the input.'},
                {name: 'subscribe',        type: 'mqttTopic', help: 'Topic to read current text value from.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'publish',          type: 'mqttTopic', help: 'Topic to publish text value to.'},
                {name: 'placeholder',      type: 'string',    help: 'Placeholder text when the field is empty.'},
                {name: 'type',             type: 'select',    options: ['text', 'number', 'email', 'tel', 'url', 'password'], help: 'HTML input type.'},
                {name: 'publish-on-input', type: 'boolean',   help: 'Publish on every keystroke (real-time).'},
                {name: 'suffix',           type: 'string',    help: 'Suffix text shown inside the field (e.g. unit).'},
                {name: 'disabled',         type: 'boolean',   help: 'Disable user input.'},
            ],
            styles: ['top', 'left', 'width', 'height'],
            defaultStyle: {width: '200px', height: '56px'},
        };
    }

    static properties = {
        label:          {type: String,  reflect: true},
        subscribe:      {type: String,  reflect: true},
        publish:        {type: String,  reflect: true},
        placeholder:    {type: String,  reflect: true},
        type:           {type: String,  reflect: true},
        publishOnInput: {type: Boolean, reflect: true, attribute: 'publish-on-input'},
        suffix:         {type: String,  reflect: true},
        disabled:       {type: Boolean, reflect: true},
        _value:         {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            align-items: center;
            box-sizing: border-box;
            --md-sys-color-primary: var(--sl-color-primary-600, #0284c7);
            --md-sys-color-on-surface: var(--primary-text-color, #333);
            --md-sys-color-surface: var(--card-background-color, #fff);
            --md-sys-color-outline: var(--divider-color, #ccc);
        }
        md-outlined-text-field {
            width: 100%;
        }
        .editor-ph {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            height: 40px;
            padding: 0 12px;
            border: 1px solid var(--divider-color, #ccc);
            border-radius: 4px;
            font-size: 14px;
            color: var(--secondary-text-color, #666);
            box-sizing: border-box;
        }
    `];

    constructor() {
        super();
        this.label          = '';
        this.subscribe      = '';
        this.publish        = '';
        this.placeholder    = '';
        this.type           = 'text';
        this.publishOnInput = false;
        this.suffix         = '';
        this.disabled       = false;
        this._value         = '';
    }

    connectedCallback() {
        super.connectedCallback();
        if (!feezal.isEditor && this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                this._value = String(this.getProperty(msg, this.messageProperty) ?? '');
            });
        }
    }

    _pub() {
        if (this.publish) {
            feezal.connection.pub(this.publish, this._value);
        }
    }

    _onInput(e) {
        this._value = e.target.value;
        if (this.publishOnInput) this._pub();
    }

    _onKeydown(e) {
        if (e.key === 'Enter') this._pub();
    }

    _onBlur() {
        this._pub();
    }

    render() {
        if (feezal.isEditor) {
            return html`<div class="editor-ph"><span>${this.label || this.placeholder || 'Text Field'}</span></div>`;
        }
        return html`
            <md-outlined-text-field
                label="${this.label}"
                value="${this._value}"
                type="${this.type || 'text'}"
                placeholder="${this.placeholder}"
                suffix-text="${this.suffix}"
                ?disabled="${this.disabled}"
                @input="${this._onInput}"
                @keydown="${this._onKeydown}"
                @blur="${this._onBlur}">
            </md-outlined-text-field>`;
    }
}

customElements.define('feezal-element-material-text-field', FeezalElementMaterialTextField);
export {FeezalElementMaterialTextField};

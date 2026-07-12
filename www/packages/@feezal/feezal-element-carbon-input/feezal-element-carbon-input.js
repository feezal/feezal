/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@carbon/web-components/es/components/text-input/text-input.js';

class FeezalElementCarbonInput extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Input', category: 'Carbon', color: '#393939', icon: 'text_fields'},
            description: 'IBM Carbon text input — subscribes to a text topic and publishes on Enter or blur.',
            attributes: [
                {name: 'label',            type: 'string',    help: 'Label shown above the input.'},
                {name: 'subscribe',        type: 'mqttTopic', help: 'Topic to read current text value from.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'publish',          type: 'mqttTopic', help: 'Topic to publish text value to.'},
                {name: 'placeholder',      type: 'string',    help: 'Placeholder text when the field is empty.'},
                {name: 'type',             type: 'select',    options: ['text', 'number', 'email', 'tel', 'url', 'password'], help: 'HTML input type.'},
                {name: 'publish-on-input', type: 'boolean',   help: 'Publish on every keystroke (real-time).'},
                {name: 'disabled',         type: 'boolean',   help: 'Disable user input.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-text-field-color',            type: 'color', default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))', help: 'Focus outline colour.'},
                {property: '--feezal-text-field-text-color',       type: 'color', default: 'var(--primary-text-color)',    help: 'Input text and label colour.'},
                {property: '--feezal-text-field-background-color', type: 'color', default: 'var(--card-background-color)', help: 'Field background colour.'},
                {property: '--feezal-text-field-border-color',     type: 'color', default: 'var(--primary-color)',        help: 'Bottom border colour.'},
            ],
            defaultStyle: {width: '200px', height: '64px'},
        };
    }

    static properties = {
        label:          {type: String,  reflect: true},
        subscribe:      {type: String,  reflect: true},
        publish:        {type: String,  reflect: true},
        placeholder:    {type: String,  reflect: true},
        type:           {type: String,  reflect: true},
        publishOnInput: {type: Boolean, reflect: true, attribute: 'publish-on-input'},
        disabled:       {type: Boolean, reflect: true},
        _value:         {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            align-items: center;
            box-sizing: border-box;
            --feezal-text-field-color:            var(--primary-color, var(--sl-color-primary-600, #0284c7));
            --feezal-text-field-text-color:       var(--primary-text-color, var(--feezal-color, #333));
            --feezal-text-field-background-color: var(--card-background-color, var(--feezal-bg, #fff));
            --feezal-text-field-border-color:     var(--primary-color, var(--sl-color-primary-600, #0284c7));
            /* Carbon token wiring — the field surface is a "layer". */
            --cds-layer:            var(--feezal-text-field-background-color);
            --cds-layer-01:         var(--feezal-text-field-background-color);
            --cds-field:            var(--feezal-text-field-background-color);
            --cds-field-01:         var(--feezal-text-field-background-color);
            --cds-text-primary:     var(--feezal-text-field-text-color);
            --cds-text-secondary:   var(--feezal-text-field-text-color);
            --cds-border-strong:    var(--feezal-text-field-border-color);
            --cds-border-strong-01: var(--feezal-text-field-border-color);
            --cds-focus:            var(--feezal-text-field-color);
        }
        cds-text-input { width: 100%; }
    `];

    constructor() {
        super();
        this.label          = '';
        this.subscribe      = '';
        this.publish        = '';
        this.placeholder    = '';
        this.type           = 'text';
        this.publishOnInput = false;
        this.disabled       = false;
        this._value         = '';
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
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

    render() {
        return html`
            <cds-text-input
                label="${this.label}"
                ?hide-label="${!this.label}"
                .value="${this._value}"
                type="${this.type || 'text'}"
                placeholder="${this.placeholder}"
                ?disabled="${this.disabled}"
                @input="${this._onInput}"
                @keydown="${this._onKeydown}"
                @focusout="${this._pub}">
            </cds-text-input>`;
    }
}

customElements.define('feezal-element-carbon-input', FeezalElementCarbonInput);
export {FeezalElementCarbonInput};

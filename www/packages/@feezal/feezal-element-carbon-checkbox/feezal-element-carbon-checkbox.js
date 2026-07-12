/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@carbon/web-components/es/components/checkbox/checkbox.js';

class FeezalElementCarbonCheckbox extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Checkbox', category: 'Carbon', color: '#393939', icon: 'check_box'},
            description: 'IBM Carbon checkbox — subscribes to a boolean topic and publishes checked state.',
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
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'publish',     type: 'mqttTopic', help: 'Topic to publish state changes to.'},
                {name: 'payload-on',  type: 'string',    help: 'Payload meaning checked. Default: ON'},
                {name: 'payload-off', type: 'string',    help: 'Payload meaning unchecked. Default: OFF'},
                {name: 'label',       type: 'string',    help: 'Label text shown beside the checkbox.'},
                {name: 'disabled',    type: 'boolean',   help: 'Disable user interaction.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-checkbox-color',       type: 'color', default: 'var(--primary-color)', help: 'Checkbox box fill (checked) and border colour.'},
                {property: '--feezal-checkbox-check-color', type: 'color', default: 'var(--primary-text-color)', help: 'Checkmark colour inside the checked box.'},
                {property: '--feezal-checkbox-label-color', type: 'color', default: 'var(--primary-text-color, #333)', help: 'Label text colour.'},
            ],
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
            box-sizing: border-box;
            /* Let the focus outline extend past the element edges. */
            overflow: visible;
            --feezal-checkbox-color:       var(--primary-color, var(--sl-color-primary-600, #0284c7));
            --feezal-checkbox-check-color: var(--primary-text-color, var(--feezal-color, #161616));
            --feezal-checkbox-label-color: var(--primary-text-color, var(--feezal-color, #333));
            /* Carbon token wiring — the box border/fill follow icon-primary. */
            --cds-icon-primary:    var(--feezal-checkbox-color);
            --cds-icon-inverse:    var(--feezal-checkbox-check-color);
            --cds-text-primary:    var(--feezal-checkbox-label-color);
            --cds-focus:           var(--primary-color, var(--sl-color-primary-600, #0284c7));
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
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                this._checked = v === this.payloadOn || v === true || v === 1 || v === '1' || v === 'true';
            });
        }
    }

    _onChange(e) {
        this._checked = e.target.checked;
        if (this.publish) {
            feezal.connection.pub(this.publish, this._checked ? this.payloadOn : this.payloadOff);
        }
    }

    render() {
        return html`
            <cds-checkbox
                ?checked="${this._checked}"
                ?disabled="${this.disabled}"
                label-text="${this.label}"
                @cds-checkbox-changed="${this._onChange}">
            </cds-checkbox>`;
    }
}

customElements.define('feezal-element-carbon-checkbox', FeezalElementCarbonCheckbox);
export {FeezalElementCarbonCheckbox};

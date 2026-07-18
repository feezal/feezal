/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@material/web/checkbox/checkbox.js';

class FeezalElementMaterialCheckbox extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Checkbox', category: 'Simple', color: '#4a6080', icon: 'check_box'},
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
                {property: '--feezal-checkbox-color',         type: 'color', default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))', help: 'Checkbox fill and border colour when checked.'},
                {property: '--feezal-checkbox-inactive-color', type: 'color', default: 'var(--divider-color, #757575)', help: 'Border colour when unchecked.'},
                {property: '--feezal-checkbox-label-color',    type: 'color', default: 'var(--primary-text-color, #333)', help: 'Label text colour.'},
                {property: '--feezal-checkbox-size',           default: '18px', help: 'Checkbox box size, e.g. "18px" or "24px".'},
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
            gap: 8px;
            padding: 4px;
            box-sizing: border-box;
            /* Let the MD3 state layer (hover/focus ripple) extend past the element
               edges instead of being clipped — it is centred on the box and larger
               than it, so it can't fit inside a small checkbox element. */
            overflow: visible;
            /* E38: scale the box + label with the element size (cqmin = 1% of the
               smaller of width/height). An explicit --feezal-checkbox-size still wins. */
            container-type: size;
            --feezal-checkbox-color:          var(--primary-color, var(--sl-color-primary-600, #0284c7));
            --feezal-checkbox-inactive-color: var(--divider-color, #757575);
            --feezal-checkbox-label-color:    var(--primary-text-color, #333);
            --feezal-checkbox-size:           55cqmin;
            /* MD3 token wiring */
            --md-sys-color-primary:                          var(--feezal-checkbox-color);
            --md-checkbox-selected-container-color:          var(--feezal-checkbox-color);
            --md-checkbox-selected-focus-container-color:    var(--feezal-checkbox-color);
            --md-checkbox-selected-hover-container-color:    var(--feezal-checkbox-color);
            --md-checkbox-selected-pressed-container-color:  var(--feezal-checkbox-color);
            --md-checkbox-outline-color:                     var(--feezal-checkbox-inactive-color);
            --md-checkbox-hover-outline-color:               var(--feezal-checkbox-inactive-color);
            --md-checkbox-focus-outline-color:               var(--feezal-checkbox-inactive-color);
            /* Correct size tokens (the box is --md-checkbox-container-size, not handle-*). */
            --md-checkbox-container-size:                     var(--feezal-checkbox-size);
            --md-checkbox-icon-size:                          calc(var(--feezal-checkbox-size) * 0.9);
            --md-checkbox-state-layer-size:                   calc(var(--feezal-checkbox-size) * 1.7);
        }
        label {
            font-size: 32cqmin;
            color: var(--feezal-checkbox-label-color);
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
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
            color: var(--feezal-checkbox-label-color, var(--primary-text-color, #555));
        }
        .editor-ph .box {
            width: var(--feezal-checkbox-size, 18px);
            height: var(--feezal-checkbox-size, 18px);
            border: 2px solid var(--feezal-checkbox-color);
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
        if (this.subscribe) {
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

/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@material/web/chips/filter-chip.js';

class FeezalElementMaterialChip extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Filter Chip', category: 'Material', color: '#4a6080', icon: 'label'},
            description: 'MD3 filter chip — subscribes to a boolean topic and publishes selected state.',
            discovery: {
                component: 'switch',
                map: {
                    state_topic:   {attr: 'subscribe'},
                    command_topic: {attr: 'publish'},
                    payload_on:    {attr: 'payload-on'},
                    payload_off:   {attr: 'payload-off'},
                    name:          'label',
                },
            },
            attributes: [
                {name: 'label',       type: 'string',    help: 'Chip label text.'},
                {name: 'subscribe',   type: 'mqttTopic', help: 'Topic to read selected state from.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'publish',     type: 'mqttTopic', help: 'Topic to publish state changes to.'},
                {name: 'payload-on',  type: 'string',    help: 'Payload for selected state. Default: ON'},
                {name: 'payload-off', type: 'string',    help: 'Payload for deselected state. Default: OFF'},
                {name: 'icon',        type: 'string',    help: 'Material icon name shown in the chip.'},
                {name: 'disabled',    type: 'boolean',   help: 'Disable user interaction.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-chip-color', type: 'color', default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))', help: 'Chip selected state colour.'},
            ],
            defaultStyle: {width: '120px', height: '36px'},
        };
    }

    static properties = {
        subscribe:  {type: String,  reflect: true},
        publish:    {type: String,  reflect: true},
        payloadOn:  {type: String,  reflect: true, attribute: 'payload-on'},
        payloadOff: {type: String,  reflect: true, attribute: 'payload-off'},
        label:      {type: String,  reflect: true},
        icon:       {type: String,  reflect: true},
        disabled:   {type: Boolean, reflect: true},
        _selected:  {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            --feezal-chip-color: var(--primary-color, var(--sl-color-primary-600, #0284c7));
            --md-sys-color-primary: var(--feezal-chip-color);
            --md-sys-color-on-surface: var(--primary-text-color, #333);
            --md-sys-color-surface-container-low: var(--card-background-color, #f5f5f5);
        }
        .editor-ph {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 8px;
            border: 1px solid var(--feezal-chip-color);
            font-size: 14px;
            color: var(--primary-text-color, #555);
            background: var(--card-background-color, #f5f5f5);
        }
    `];

    constructor() {
        super();
        this.subscribe  = '';
        this.publish    = '';
        this.payloadOn  = 'ON';
        this.payloadOff = 'OFF';
        this.label      = 'Chip';
        this.icon       = '';
        this.disabled   = false;
        this._selected  = false;
    }

    connectedCallback() {
        super.connectedCallback();
        if (!feezal.isEditor && this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                this._selected = v === this.payloadOn || v === true || v === 1 || v === '1' || v === 'true';
            });
        }
    }

    _onChange(e) {
        if (!this.publish) return;
        this._selected = e.target.selected;
        feezal.connection.pub(this.publish, this._selected ? this.payloadOn : this.payloadOff);
    }

    render() {
        if (feezal.isEditor) {
            return html`<div class="editor-ph">${this.label || 'Filter Chip'}</div>`;
        }
        return html`
            <md-filter-chip
                label="${this.label}"
                ?selected="${this._selected}"
                ?disabled="${this.disabled}"
                @click="${this._onChange}">
            </md-filter-chip>`;
    }
}

customElements.define('feezal-element-material-chip', FeezalElementMaterialChip);
export {FeezalElementMaterialChip};

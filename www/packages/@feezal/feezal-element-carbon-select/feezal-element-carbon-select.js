/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@carbon/web-components/es/components/select/select.js';
import '@carbon/web-components/es/components/select/select-item.js';

class FeezalElementCarbonSelect extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Select', category: 'Carbon', color: '#393939', icon: 'arrow_drop_down_circle'},
            description: 'IBM Carbon select dropdown — subscribes to current value and publishes on user selection.',
            discovery: {
                component: 'select',
                map: {
                    state_topic:   'subscribe',
                    command_topic: 'publish',
                    options:       {attr: 'options', transform: 'join'},
                    name:          'label',
                },
            },
            attributes: [
                {name: 'label',     type: 'string',    help: 'Label shown above the select field.'},
                {name: 'subscribe', type: 'mqttTopic', help: 'Topic to read current selected value from.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'publish',   type: 'mqttTopic', help: 'Topic to publish selected value to.'},
                {name: 'options',   type: 'objectList', itemFields: [{key: 'value'}, {key: 'label'}], help: 'Select options — one row per option (value published, label shown). Stored as a JSON array.'},
                {name: 'disabled',  type: 'boolean',   help: 'Disable the select field.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-select-color',            type: 'color', default: 'var(--primary-color)', help: 'Select field focus colour.'},
                {property: '--feezal-select-text-color',       type: 'color', default: 'var(--primary-text-color)',    help: 'Text colour of the selected value and label.'},
                {property: '--feezal-select-background-color', type: 'color', default: 'var(--card-background-color)', help: 'Background colour of the closed select field.'},
                {property: '--feezal-select-popup-background-color', type: 'color', default: 'var(--card-background-color)', help: 'Background colour of the dropdown option list. Native dropdown — some browsers (Safari, mobile pickers) ignore option styling.'},
                {property: '--feezal-select-border-color',     type: 'color', default: 'var(--primary-color)',        help: 'Bottom border colour.'},
            ],
            defaultStyle: {width: '200px', height: '64px'},
        };
    }

    static properties = {
        label:     {type: String,  reflect: true},
        subscribe: {type: String,  reflect: true},
        publish:   {type: String,  reflect: true},
        options:   {type: String,  reflect: true},
        disabled:  {type: Boolean, reflect: true},
        _value:    {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            align-items: center;
            box-sizing: border-box;
            --feezal-select-color:            var(--primary-color, var(--sl-color-primary-600, #0284c7));
            --feezal-select-text-color:       var(--primary-text-color, var(--feezal-color, #333));
            --feezal-select-background-color: var(--card-background-color, var(--feezal-bg, #fff));
            --feezal-select-popup-background-color: var(--card-background-color, var(--feezal-bg, #fff));
            --feezal-select-border-color:     var(--primary-color, var(--sl-color-primary-600, #0284c7));
            /* Carbon token wiring — the field surface is a "layer". */
            --cds-layer:            var(--feezal-select-background-color);
            --cds-layer-01:         var(--feezal-select-background-color);
            --cds-layer-02:         var(--feezal-select-background-color);
            --cds-field:            var(--feezal-select-background-color);
            --cds-field-01:         var(--feezal-select-background-color);
            --cds-field-02:         var(--feezal-select-background-color);
            --cds-text-primary:     var(--feezal-select-text-color);
            --cds-text-secondary:   var(--feezal-select-text-color);
            --cds-icon-primary:     var(--feezal-select-text-color);
            --cds-border-strong:    var(--feezal-select-border-color);
            --cds-border-strong-01: var(--feezal-select-border-color);
            --cds-focus:            var(--feezal-select-color);
        }
        cds-select { width: 100%; }
    `];

    constructor() {
        super();
        this.label     = '';
        this.subscribe = '';
        this.publish   = '';
        this.options   = '[]';
        this.disabled  = false;
        this._value    = '';
    }

    get _options() {
        const raw = (this.options || '').trim();
        if (!raw) return [];
        if (raw.startsWith('[')) {
            try {
                const parsed = JSON.parse(raw);
                return parsed.map(o => (typeof o === 'string' ? {value: o, label: o} : o));
            } catch { /* fall through to comma-split */ }
        }
        return raw.split(',').map(s => s.trim()).filter(Boolean).map(s => ({value: s, label: s}));
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                this._value = String(this.getProperty(msg, this.messageProperty) ?? '');
            });
        }
    }

    /**
     * cds-select renders a native <select>; Carbon ships no option styling, so
     * the dropdown popup would ignore the theme. Adopt a small sheet into the
     * cds-select shadow root — custom properties inherit across the boundary,
     * so --feezal-select-* set on this host (or by a theme) reach the options.
     * (Popup styling is best-effort by nature: Safari and mobile native
     * pickers ignore option CSS.)
     */
    firstUpdated(changed) {
        super.firstUpdated?.(changed);
        const select = this.shadowRoot.querySelector('cds-select');
        select?.updateComplete.then(() => {
            if (!select.shadowRoot || typeof CSSStyleSheet !== 'function') return;
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(`
                option {
                    background-color: var(--feezal-select-popup-background-color, #fff);
                    color: var(--feezal-select-text-color, inherit);
                }`);
            select.shadowRoot.adoptedStyleSheets = [...select.shadowRoot.adoptedStyleSheets, sheet];
        });
    }

    _onChange(e) {
        const val = e.detail.value;
        this._value = val;
        if (this.publish) {
            feezal.connection.pub(this.publish, val);
        }
    }

    render() {
        const opts = this._options;
        return html`
            <cds-select
                label-text="${this.label}"
                ?hide-label="${!this.label}"
                value="${this._value}"
                ?disabled="${this.disabled}"
                @cds-select-selected="${this._onChange}">
                ${opts.map(o => html`
                    <cds-select-item
                        value="${o.value ?? o}"
                        ?selected="${String(o.value ?? o) === this._value}">${o.label ?? o.value ?? o}</cds-select-item>`)}
            </cds-select>`;
    }
}

customElements.define('feezal-element-carbon-select', FeezalElementCarbonSelect);
export {FeezalElementCarbonSelect};

/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';

class FeezalElementMaterialSelect extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Select', category: 'Material', color: '#4a6080', icon: 'arrow_drop_down_circle'},
            description: 'MD3 select dropdown — subscribes to current value and publishes on user selection.',
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
                {name: 'label',     type: 'string',    help: 'Floating label above the select field.'},
                {name: 'subscribe', type: 'mqttTopic', help: 'Topic to read current selected value from.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'publish',   type: 'mqttTopic', help: 'Topic to publish selected value to.'},
                {name: 'options',   type: 'objectList', itemFields: [{key: 'value'}, {key: 'label'}], help: 'Select options — one row per option (value published, label shown). Stored as a JSON array.'},
                {name: 'disabled',  type: 'boolean',   help: 'Disable the select field.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-select-color',            type: 'color', default: 'var(--primary-color)', help: 'Select field focus / active colour.'},
                {property: '--feezal-select-text-color',       type: 'color', default: 'var(--primary-text-color)',        help: 'Text colour of the selected value and label.'},
                {property: '--feezal-select-background-color', type: 'color', default: 'var(--card-background-color)',     help: 'Background colour of the closed select field.'},
                {property: '--feezal-select-popup-background-color', type: 'color', default: 'var(--card-background-color)', help: 'Background colour of the dropdown popup.'},
                {property: '--feezal-select-border-color',     type: 'color', default: 'var(--primary-text-color)',             help: 'Outline / border colour.'},
            ],
            defaultStyle: {width: '200px', height: '56px'},
        };
    }

    static properties = {
        label:     {type: String,  reflect: true},
        subscribe: {type: String,  reflect: true},
        publish:   {type: String,  reflect: true},
        options:   {type: String,  reflect: true},
        disabled:  {type: Boolean, reflect: true},
        _value:    {state: true},
        _fontScale:{state: true},
        _pad:      {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            align-items: center;
            box-sizing: border-box;
            --feezal-select-color:             var(--primary-color);
            --feezal-select-text-color:        var(--primary-text-color);
            --feezal-select-background-color:  var(--card-background-color);
            --feezal-select-popup-background-color: var(--card-background-color);
            --feezal-select-border-color:      var(--primary-text-color);
            /* MD3 system token wiring */
            --md-sys-color-primary:            var(--feezal-select-color);
            --md-sys-color-on-surface:         var(--feezal-select-text-color);
            --md-sys-color-on-surface-variant: var(--feezal-select-text-color);
            --md-sys-color-surface:            var(--feezal-select-background-color);
            --md-sys-color-outline:            var(--feezal-select-border-color);
            /* Popup / menu background */
            --md-menu-container-color:             var(--feezal-select-popup-background-color);
            --md-sys-color-surface-container:      var(--feezal-select-popup-background-color);
            --md-sys-color-surface-container-high: var(--feezal-select-popup-background-color);
        }
        md-outlined-select {
            width: 100%;
            /* B22: md-outlined-select ships :host{min-width:210px} — below that
               element width the control overflowed the host and its right border
               was clipped. Let it shrink with the element instead (same pattern
               as the slider's min-inline-size: 0, E38). */
            min-inline-size: 0;
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
        this.label     = '';
        this.subscribe = '';
        this.publish   = '';
        this.options   = '[]';
        this.disabled  = false;
        this._value    = '';
        this._fontScale = 16;
        this._pad      = 16;
        this._ro       = null;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._ro) { this._ro.disconnect(); this._ro = null; }
    }

    /**
     * E38: scale the field with the element height. md-outlined-select has a
     * fixed-positioned dropdown, so `container-type` is unsafe here (it would make
     * the element a containing block for the fixed menu). A ResizeObserver drives
     * shadow-scoped tokens instead — never serialized into the saved HTML:
     *  - the value/label font size, and
     *  - the field's top/bottom padding, so the outlined control grows to fill the
     *    element height (field height ≈ 2·pad + line-height) instead of staying a
     *    fixed ~56 px box centred in an over-tall element.
     */
    _scaleFont() {
        const h = this.clientHeight;
        if (!h) return;
        const fs = Math.max(11, Math.min(30, h * 0.28));
        const pad = Math.max(4, (h - fs * 1.4) / 2);
        if (Math.abs(fs - this._fontScale) > 0.3 || Math.abs(pad - this._pad) > 0.3) {
            this._fontScale = fs;
            this._pad = pad;
        }
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
        this._ro = new ResizeObserver(() => this._scaleFont());
        this._ro.observe(this);
    }

    _onChange(e) {
        if (!this.publish) return;
        const val = e.target.value;
        this._value = val;
        feezal.connection.pub(this.publish, val);
    }

    render() {
        const opts = this._options;
        return html`
            <md-outlined-select
                style="--md-sys-typescale-body-large-size:${this._fontScale}px;--md-sys-typescale-body-large-line-height:${(this._fontScale * 1.4).toFixed(1)}px;--md-outlined-field-top-space:${this._pad.toFixed(1)}px;--md-outlined-field-bottom-space:${this._pad.toFixed(1)}px"
                label="${this.label}"
                ?disabled="${this.disabled}"
                @change="${this._onChange}">
                ${opts.map(o => html`
                    <md-select-option
                        value="${o.value ?? o}"
                        ?selected="${String(o.value ?? o) === this._value}">
                        <div slot="headline">${o.label ?? o.value ?? o}</div>
                    </md-select-option>`)}
            </md-outlined-select>`;
    }
}

customElements.define('feezal-element-material-select', FeezalElementMaterialSelect);
export {FeezalElementMaterialSelect};

/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';

class FeezalElementMaterialSelect extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Select', category: 'Material', color: '#4a6080', icon: 'arrow_drop_down_circle'},
            description: 'MD3 select dropdown — subscribes to current value and publishes on user selection.',
            attributes: [
                {name: 'label',     type: 'string',    help: 'Floating label above the select field.'},
                {name: 'subscribe', type: 'mqttTopic', help: 'Topic to read current selected value from.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'publish',   type: 'mqttTopic', help: 'Topic to publish selected value to.'},
                {name: 'options',   type: 'string',    help: 'JSON array of options, e.g. [{"value":"1","label":"One"},{"value":"2","label":"Two"}]'},
                {name: 'disabled',  type: 'boolean',   help: 'Disable the select field.'},
            ],
            styles: ['top', 'left', 'width', 'height'],
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
        md-outlined-select {
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
        this.label     = '';
        this.subscribe = '';
        this.publish   = '';
        this.options   = '[]';
        this.disabled  = false;
        this._value    = '';
    }

    get _options() {
        try {
            return JSON.parse(this.options);
        } catch {
            return [];
        }
    }

    connectedCallback() {
        super.connectedCallback();
        if (!feezal.isEditor && this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                this._value = String(this.getProperty(msg, this.messageProperty) ?? '');
            });
        }
    }

    _onChange(e) {
        if (!this.publish) return;
        const val = e.target.value;
        this._value = val;
        feezal.connection.pub(this.publish, val);
    }

    render() {
        const opts = this._options;
        if (feezal.isEditor) {
            const first = opts[0]?.label || opts[0]?.value || 'Select…';
            return html`<div class="editor-ph"><span>${this.label || first}</span><span>▾</span></div>`;
        }
        return html`
            <md-outlined-select
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

/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-material-value
 *
 * Material Design 3 styled value tile. Shows a large numeric or text value
 * with an optional label, unit, prefix, and icon. Pure Lit — no @material/web
 * dependency, styled with MD3 CSS custom properties.
 */
class FeezalElementMaterialValue extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                name: 'Value',
                category: 'Material',
                color: '#1565c0'
            },
            description: 'Material Design 3 styled value tile. Shows a large numeric or text value from an MQTT topic.',
            attributes: [
                'subscribe',
                {name: 'label',           type: 'string',  help: 'Caption shown above or below the value.'},
                {name: 'unit',            type: 'string',  help: 'Unit string shown after the value (e.g. °C, %, W).'},
                {name: 'prefix',          type: 'string',  help: 'String prepended before the value (e.g. $, #).'},
                {name: 'icon',            type: 'string',  help: 'Material Icons ligature shown in the top-left corner (e.g. thermostat).'},
                {name: 'digits',          type: 'number',  help: 'Number of decimal places to round numeric values to. Leave empty for no rounding.'},
                {name: 'label-position',  type: 'select',  options: ['below', 'above'], default: 'below',
                    help: 'Whether the label appears above or below the value.'}
            ],
            styles: [
                'top', 'left', 'width', 'height',
                'background', 'border-radius', 'color', 'font-family'
            ],
            defaultStyle: {width: '120px', height: '80px', borderRadius: '12px'}
        };
    }

    static properties = {
        label:         {type: String, reflect: true},
        unit:          {type: String, reflect: true},
        prefix:        {type: String, reflect: true},
        icon:          {type: String, reflect: true},
        digits:        {type: Number, reflect: true},
        labelPosition: {type: String, reflect: true, attribute: 'label-position'},
        _rawValue:     {state: true}
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: center;
            padding: 10px 14px;
            background: var(--feezal-bg, #fff);
            color: var(--feezal-color, #333);
            border-radius: 12px;
            overflow: hidden;
            box-sizing: border-box;
        }
        .icon {
            font-family: 'Material Icons', sans-serif;
            font-size: 18px; font-style: normal;
            color: var(--sl-color-primary-600, #0284c7);
            line-height: 1; margin-bottom: 2px;
        }
        .value-row {
            display: flex;
            align-items: baseline;
            gap: 2px;
            line-height: 1;
            flex-wrap: nowrap;
            overflow: hidden;
            max-width: 100%;
        }
        .prefix { font-size: 0.55em; opacity: 0.8; flex-shrink: 0; }
        .value  {
            font-size: clamp(18px, 2.4em, 48px);
            font-weight: 500; white-space: nowrap;
            overflow: hidden; text-overflow: ellipsis;
        }
        .unit   { font-size: 0.55em; opacity: 0.75; flex-shrink: 0; }
        .label  {
            font-size: 11px; opacity: 0.65;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            max-width: 100%;
        }
        .editor-ph {
            width: 100%; height: 100%;
            display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
            gap: 4px; padding: 10px 14px; box-sizing: border-box;
        }
        .editor-ph .val   { font-size: 24px; font-weight: 500; color: var(--feezal-color,#333); }
        .editor-ph .lbl   { font-size: 11px; opacity: 0.6; }
    `];

    constructor() {
        super();
        this.label         = '';
        this.unit          = '';
        this.prefix        = '';
        this.icon          = '';
        this.digits        = undefined;
        this.labelPosition = 'below';
        this._rawValue     = null;
    }

    connectedCallback() {
        super.connectedCallback();
        if (!feezal.isEditor && this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                this._rawValue = this.getProperty(msg, this.messageProperty);
            });
        }
    }

    _formatted() {
        if (this._rawValue === null || this._rawValue === undefined) return '—';
        const v = this._rawValue;
        if (this.digits !== undefined && !isNaN(Number(v))) {
            return Number(v).toFixed(this.digits);
        }
        return String(v);
    }

    _labelEl() {
        return this.label ? html`<div class="label">${this.label}</div>` : '';
    }

    render() {
        if (feezal.isEditor) {
            return html`
                <div class="editor-ph">
                    ${this.icon ? html`<span class="icon">${this.icon}</span>` : ''}
                    ${this.labelPosition === 'above' ? this._labelEl() : ''}
                    <div class="val">
                        ${this.prefix || ''}42${this.unit ? html`<span style="font-size:0.5em"> ${this.unit}</span>` : ''}
                    </div>
                    ${this.labelPosition !== 'above' ? this._labelEl() : ''}
                </div>`;
        }

        return html`
            ${this.icon ? html`<span class="icon">${this.icon}</span>` : ''}
            ${this.labelPosition === 'above' ? this._labelEl() : ''}
            <div class="value-row">
                ${this.prefix ? html`<span class="prefix">${this.prefix}</span>` : ''}
                <span class="value">${this._formatted()}</span>
                ${this.unit   ? html`<span class="unit">${this.unit}</span>` : ''}
            </div>
            ${this.labelPosition !== 'above' ? this._labelEl() : ''}`;
    }
}

customElements.define('feezal-element-material-value', FeezalElementMaterialValue);
export {FeezalElementMaterialValue};

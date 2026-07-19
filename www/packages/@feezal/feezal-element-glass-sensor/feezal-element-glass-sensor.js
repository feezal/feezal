/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {applySizePreset} from '@feezal/feezal-glass';

/**
 * feezal-element-glass-sensor (E58)
 *
 * Frosted-glass sensor card: icon, big numeral value + unit, label.
 * Display-only. See feezal-element-glass-button for the family conventions
 * (frost vars, degrade, squircle).
 */

class FeezalElementGlassSensor extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Sensor', category: 'Glass', color: '#7aa5c9', icon: 'thermostat'},
            description: 'Frosted-glass sensor card — big numeral value with unit and label.',
            baseAttribute: 'value',
            discovery: {
                component: 'sensor',
                map: {
                    state_topic:         {attr: 'subscribe'},
                    unit_of_measurement: {attr: 'unit'},
                    value_template:      {attr: 'message-property', transform: 'valueTemplateToPath'},
                    name:                'label',
                },
            },
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x2', '2x1'], default: '',
                    help: 'Preset size: 2x2 = square (150×150), 2x1 = wide (150×75). Empty keeps the current/manual size.'},
                {name: 'label',     type: 'string', help: 'Label shown under the value.'},
                {name: 'icon',      type: 'string', default: 'thermostat', help: 'Icon name.'},
                {name: 'subscribe', type: 'mqttTopic', help: 'Value topic.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.temperature" to navigate into a JSON payload.'},
                {name: 'unit',      type: 'string', help: 'Unit rendered after the value (e.g. °C).'},
                {name: 'decimals',  type: 'number', min: 0, max: 6, help: 'Round numeric values to this many decimals. Empty = show the payload as-is.'},
                {name: 'degrade',   type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-accent', type: 'color', default: '#ff9f0a', help: 'Icon colour.'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-icon-size', default: '28px', help: 'Icon font size.'},
                {property: '--feezal-glass-font-size-value', default: '26px', help: 'Value font size.'},
                {property: '--feezal-glass-font-size-unit', default: '12px', help: 'Unit font size.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Label font size.'},
            ],
            defaultStyle: {width: '150px', height: '110px'},
            restrict: {minWidth: 70, minHeight: 60},
        };
    }

    static properties = {
        size:     {type: String, reflect: true},
        label:    {type: String, reflect: true},
        icon:     {type: String, reflect: true},
        unit:     {type: String, reflect: true},
        decimals: {type: String, reflect: true},
        value:    {type: String, reflect: true},
        _value:   {state: true},
        degrade:  {type: Boolean, reflect: true},
    };

    static styles = [feezalBaseStyles, css`
        :host { display: block; box-sizing: border-box; container-type: size; overflow: visible; }
        .card {
            position: absolute; inset: var(--feezal-glass-margin, 6px); box-sizing: border-box;
            display: flex; flex-direction: column; justify-content: space-between;
            padding: 12px; gap: 2px;
            border-radius: var(--feezal-glass-radius, 24px);
            background: var(--feezal-glass-tint, rgba(255,255,255,0.35));
            -webkit-backdrop-filter: blur(var(--feezal-glass-blur, 20px));
            backdrop-filter: blur(var(--feezal-glass-blur, 20px));
            border: 1px solid var(--feezal-glass-border, rgba(255,255,255,0.55));
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            color: var(--feezal-glass-color, #1d1d1f);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            user-select: none;
        }
        @supports (corner-shape: squircle) { .card { corner-shape: squircle; } }
        :host([degrade]) .card {
            -webkit-backdrop-filter: none; backdrop-filter: none;
            background: var(--feezal-glass-solid, rgba(245,245,247,0.94));
        }
        feezal-icon { font-size: var(--feezal-glass-icon-size, 28px); line-height: 1; color: var(--feezal-glass-accent, #ff9f0a); }
        .value {
            font-size: var(--feezal-glass-font-size-value, 26px); font-weight: 700; line-height: 1.05;
            font-variant-numeric: tabular-nums;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .value .unit { font-size: var(--feezal-glass-font-size-unit, 12px); font-weight: 500; opacity: 0.6; margin-left: 2px; }
        .label {
            font-size: var(--feezal-glass-font-size-label, 12px); font-weight: 600; line-height: 1.2;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        /* E105: much wider than tall → horizontal layout (Apple-Home wide
           tile): icon left, value/label stacked right of it. */
        @container (min-aspect-ratio: 2/1) {
            .card {
                display: grid;
                grid-template: 'icon value' auto 'icon label' auto / auto 1fr;
                align-content: center;
                align-items: center;
                column-gap: 10px;
                text-align: left;
            }
            .card > feezal-icon { grid-area: icon; }
            .card .value { grid-area: value; align-self: end; }
            .card .label { grid-area: label; align-self: start; }
        }
    `];

    constructor() {
        super();
        this.size = '';
        this.label = '';
        this.icon = 'thermostat';
        this.unit = '';
        this.decimals = '';
        this.value = '';
        this._value = null;
        this.degrade = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this._wireSubscriptions();
    }

    _wireSubscriptions() {
        this.__wireSig = this.subscribe ?? '';
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                this._value = this.getProperty(msg, this.messageProperty);
            });
        }
    }

    updated(changed) {
        super.updated(changed);
        // Topic set on the live canvas → rewire (see glass-light).
        if (this.isConnected && this.__wireSig !== undefined && (this.subscribe ?? '') !== this.__wireSig) {
            this._unsubscribe();
            this._wireSubscriptions();
        }
        // The size grid writes the element's inline geometry (editor keeps
        // full manual control afterwards).
        if (changed.has('size')) applySizePreset(this);
    }

    get displayValue() {
        const raw = this._value ?? this.value;
        if (raw === null || raw === undefined || raw === '') {
            return feezal.isEditor ? '21.5' : '—';
        }
        const n = Number(raw);
        if (this.decimals !== '' && this.decimals !== null && Number.isFinite(n)) {
            return n.toFixed(Math.max(0, Math.min(6, Number(this.decimals) || 0)));
        }
        return typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
    }

    render() {
        return html`
            <div class="card">
                <feezal-icon name="${this.icon || 'thermostat'}"></feezal-icon>
                <span class="value">${this.displayValue}${this.unit ? html`<span class="unit">${this.unit}</span>` : ''}</span>
                <span class="label">${this.label || (feezal.isEditor ? 'Sensor' : '')}</span>
            </div>
        `;
    }
}

customElements.define('feezal-element-glass-sensor', FeezalElementGlassSensor);
export {FeezalElementGlassSensor};

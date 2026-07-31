/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {applySizePreset, glassCardStyles} from '@feezal/feezal-glass';
import {readonlyClimateAxes, NUMERIC_SENSOR_ICONS} from '@feezal/feezal-element/feezal-discovery-fragments.js';
import {formatNumber} from '@feezal/feezal-element/feezal-locale.js';

/**
 * feezal-element-glass-value (E58, E138)
 *
 * Frosted-glass numeric value card: icon, big numeral value + unit, label.
 * Display-only. See feezal-element-glass-button for the family conventions
 * (frost vars, degrade, squircle).
 */

class FeezalElementGlassValue extends FeezalElement {
    static get feezal() {
        return {
            // E138: numeric value card — "sensor" now means the boolean/alarm card family-wide.
            palette: {name: 'Value', category: 'Glass', color: '#7aa5c9', icon: 'thermostat'},
            description: 'Frosted-glass value card — big numeral value with unit and label.',
            baseAttribute: 'value',
            discovery: {
                component: 'sensor',
                // B85: a thermostat's actual temperature, humidity and valve
                // position live INSIDE its climate entity, so a sensor-only
                // picker could never see them. Read-only axes; never a
                // command topic.
                accepts: readonlyClimateAxes,
                map: {
                    state_topic:         {attr: 'subscribe'},
                    unit_of_measurement: {attr: 'unit'},
                    value_template:      {attr: 'message-property', transform: 'valueTemplateToPath'},
                    // E160: stamp a device_class-appropriate icon (humidity, pressure, CO2, PM…).
                    device_class:      {attr: 'icon', valueMap: NUMERIC_SENSOR_ICONS},
                    // E161: a discovered mdi:* icon (mapped to a Material Symbol)
                    // wins over the device_class default; an unmapped one is
                    // skipped so the device_class icon above stands. Order matters.
                    icon:              {attr: 'icon', transform: 'mdiIcon'},
                    name:                'label',
                },
            },
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x2', '2x1'], default: '',
                    help: 'Preset size: 2x2 = square (150×150), 2x1 = wide (150×75). Empty keeps the current/manual size.'},
                {name: 'label',     type: 'string', help: 'Label shown under the value.'},
                {name: 'icon',      type: 'string', default: 'sensors', help: 'Icon name — a neutral default; a discovered sensor gets a fitting icon from its type, and any card can override it here.'},
                {name: 'subscribe', type: 'mqttTopic', help: 'Value topic.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.temperature" to navigate into a JSON payload.'},
                {name: 'unit',      type: 'string', help: 'Unit rendered after the value (e.g. °C).'},
                {name: 'decimals',  type: 'number', min: 0, max: 6, help: 'Round numeric values to this many decimals. Empty = show the payload as-is.'},
                {name: 'grouping', type: 'boolean', default: false,
                    help: 'Format the value with thousands separators per the site locale (1.234 / 1,234). Off by default.'},
                {name: 'degrade',   type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
                // B67: opt-in availability — a badge appears while unavailable
                // (the last value stays shown). Base class wires the subscription.
                {name: 'subscribe-availability', type: 'mqttTopic', section: 'Availability', help: 'Optional availability topic — a badge appears while unavailable.'},
                {name: 'payload-available',   type: 'string', default: 'online',  section: 'Availability', help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', section: 'Availability', help: 'Payload meaning unavailable.'},
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
            defaultStyle: {width: '172px', height: '128px'},
            restrict: {minWidth: 70, minHeight: 60},
        };
    }

    static properties = {
        size:     {type: String, reflect: true},
        label:    {type: String, reflect: true},
        icon:     {type: String, reflect: true},
        unit:     {type: String, reflect: true},
        decimals: {type: String, reflect: true},
        grouping: {type: Boolean, reflect: true},
        value:    {type: String, reflect: true},
        _value:   {state: true},
        degrade:  {type: Boolean, reflect: true},
    };

    static styles = [feezalBaseStyles, glassCardStyles, css`
        .card {
            gap: 2px;
            /* B67: the availability badge anchors to the shared .card, which is
               already position:absolute -- do NOT override to position:relative
               here, or inset stops filling the host and the card collapses to
               content size (no longer tracks the element's width/height). */
        }
        .unavail {
            position: absolute; top: 6px; right: 8px;
            font-size: 14px; line-height: 1;
            color: var(--error-color);
            opacity: 0.85; pointer-events: none; z-index: 2;
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
        this.icon = 'sensors';
        this.unit = '';
        this.decimals = '';
        this.grouping = false;
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
            // N38: the editor sample localizes too, so the canvas previews the site locale
            return feezal.isEditor ? formatNumber(21.5, {digits: 1}) : '—';
        }
        const n = Number(raw);
        if (this.decimals !== '' && this.decimals !== null && Number.isFinite(n)) {
            return formatNumber(n, {digits: Math.max(0, Math.min(6, Number(this.decimals) || 0)), grouping: this.grouping});
        }
        if (typeof raw === 'object') return JSON.stringify(raw);
        // N38: numeric payloads localize even without a decimals setting
        return Number.isFinite(n) ? formatNumber(n, {grouping: this.grouping}) : String(raw);
    }

    render() {
        return html`
            <div class="card">
                ${this.subscribeAvailability && !this._available ? html`<span class="unavail" title="Device unavailable">⚠</span>` : ''}
                <feezal-icon name="${this.icon || 'sensors'}"></feezal-icon>
                <span class="value">${this.displayValue}${this.unit ? html`<span class="unit">${this.unit}</span>` : ''}</span>
                <span class="label">${this.label || (feezal.isEditor ? 'Value' : '')}</span>
            </div>
        `;
    }
}

customElements.define('feezal-element-glass-value', FeezalElementGlassValue);
export {FeezalElementGlassValue};

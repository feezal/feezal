/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {svg} from 'lit';

// All metric slots — used both for subscription setup and render
const METRIC_DEFS = [
    {key: 'moisture',     prop: 'subscribe',           minProp: 'moistureMin',  maxProp: 'moistureMax',  label: 'Moisture', unit: '%',    icon: '💧'},
    {key: 'light',        prop: 'subscribeLight',        minProp: 'lightMin',     maxProp: 'lightMax',     label: 'Light',    unit: 'lx',   icon: '☀'},
    {key: 'temperature',  prop: 'subscribeTemperature',  minProp: 'tempMin',      maxProp: 'tempMax',      label: 'Temp',     unit: '\u00b0C', icon: '🌡'},
    {key: 'conductivity', prop: 'subscribeConductivity', minProp: 'condMin',      maxProp: 'condMax',      label: 'Fert.',    unit: '\u00b5S', icon: '⚡'},
    {key: 'humidity',     prop: 'subscribeHumidity',     minProp: 'humidityMin',  maxProp: 'humidityMax',  label: 'Humidity', unit: '%',    icon: '💦'},
];

function leafSvg() {
    return svg`
        <svg viewBox="0 0 24 24" style="width:100%;height:100%">
            <path fill="currentColor"
                  d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3
                     22 3c-1 2-8 3-8 3l-1 2a11.06 11.06 0 0 1 4 9c-.95-.85-2.15-1.49-3.5-1.75L14
                     12l-3 1z"/>
        </svg>`;
}

// ── Element ───────────────────────────────────────────────────────────────────
class FeezalElementMaterialPlant extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Plant', category: 'Material', color: '#1565c0', icon: 'local_florist'},
            description: 'Plant health monitor — shows moisture, illuminance, temperature, conductivity and humidity sensor readings against configured healthy ranges.',
            attributes: [
                {name: 'name',      type: 'string', default: '', help: 'Plant name displayed in the card header.'},
                {name: 'image-url', type: 'string', default: '', help: 'Optional plant photo URL. Falls back to a leaf icon.'},
                {name: 'layout',    type: 'select', options: ['compact', 'detailed'], default: 'compact',
                    help: 'compact = coloured bar badges; detailed = labelled rows with values.'},
                // Moisture
                {name: 'subscribe',          type: 'mqttTopic', help: 'Soil moisture topic (primary). Also serves as base for dynamic attribute overrides via `<subscribe>/#`.'},
                {name: 'moisture-min',       type: 'number',    default: 15,    help: 'Minimum healthy moisture (%).'},
                {name: 'moisture-max',       type: 'number',    default: 65,    help: 'Maximum healthy moisture (%).'},
                // Illuminance
                {name: 'subscribe-light',    type: 'mqttTopic', help: 'Illuminance (lux).'},
                {name: 'light-min',          type: 'number',    default: 1500,  help: 'Minimum healthy light level (lx).'},
                {name: 'light-max',          type: 'number',    default: 35000, help: 'Maximum healthy light level (lx).'},
                // Temperature
                {name: 'subscribe-temperature', type: 'mqttTopic', help: 'Temperature (\u00b0C).'},
                {name: 'temp-min',              type: 'number',    default: 15,   help: 'Minimum healthy temperature (\u00b0C).'},
                {name: 'temp-max',              type: 'number',    default: 32,   help: 'Maximum healthy temperature (\u00b0C).'},
                // Conductivity
                {name: 'subscribe-conductivity', type: 'mqttTopic', help: 'Conductivity / fertility (\u00b5S/cm).'},
                {name: 'cond-min',               type: 'number',    default: 350,  help: 'Minimum healthy conductivity (\u00b5S/cm).'},
                {name: 'cond-max',               type: 'number',    default: 2000, help: 'Maximum healthy conductivity (\u00b5S/cm).'},
                // Humidity (air)
                {name: 'subscribe-humidity',     type: 'mqttTopic', help: 'Relative humidity (%).'},
                {name: 'humidity-min',           type: 'number',    default: 40,   help: 'Minimum healthy humidity (%).'},
                {name: 'humidity-max',           type: 'number',    default: 80,   help: 'Maximum healthy humidity (%).'},
                // Battery
                {name: 'subscribe-battery',      type: 'mqttTopic', help: 'Battery level (%). Shown as a badge, no healthy range.'},
                {name: 'show-battery',           type: 'boolean',   default: true, help: 'Show the battery level badge.'},
                // Dry binary sensor
                {name: 'subscribe-dry',          type: 'mqttTopic', help: 'Dry binary sensor topic. Shows a warning badge when the plant is dry.'},
                {name: 'payload-dry-on',         type: 'string',    default: 'true', help: 'Payload value that means the plant is dry.'},
                // Per-metric JSON path overrides (for single-topic JSON devices such as zigbee2mqtt)
                {name: 'message-property-moisture',     type: 'string', default: '', help: 'JSON path for moisture reading. Overrides the element-level message-property for this metric.'},
                {name: 'message-property-temperature',  type: 'string', default: '', help: 'JSON path for temperature reading.'},
                {name: 'message-property-humidity',     type: 'string', default: '', help: 'JSON path for humidity reading.'},
                {name: 'message-property-battery',      type: 'string', default: '', help: 'JSON path for battery reading.'},
                {name: 'message-property-dry',          type: 'string', default: '', help: 'JSON path for dry flag within the payload object.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-plant-ok-color',   type: 'color', default: 'var(--success-color, #4caf50)',  help: 'Badge colour for in-range values.'},
                {property: '--feezal-plant-warn-color', type: 'color', default: 'var(--warning-color, #ff9800)', help: 'Badge colour for out-of-range values.'},
                {property: '--feezal-plant-text-color', type: 'color', default: 'var(--primary-text-color)',     help: 'Label and value text colour.'},
            ],
            restrict:     {minWidth: 160, minHeight: 80},
            defaultStyle: {width: '200px', height: '120px'},
            discovery: {
                component: 'device-group',
                requires: [{component: 'sensor', device_class: 'moisture'}],
                map: {
                    'device.name': 'name',
                    sensors: {
                        moisture:    {topic: 'subscribe',              path: 'message-property-moisture'},
                        temperature: {topic: 'subscribe-temperature',  path: 'message-property-temperature'},
                        humidity:    {topic: 'subscribe-humidity',     path: 'message-property-humidity'},
                        battery:     {topic: 'subscribe-battery',      path: 'message-property-battery'},
                    },
                    binary_sensors: {
                        dry: {topic: 'subscribe-dry', path: 'message-property-dry', payload_on: 'payload-dry-on'},
                    },
                },
            },
        };
    }

    static properties = {
        name:                  {type: String,  reflect: true},
        imageUrl:              {type: String,  reflect: true, attribute: 'image-url'},
        layout:                {type: String,  reflect: true},
        moistureMin:           {type: Number,  reflect: true, attribute: 'moisture-min'},
        moistureMax:           {type: Number,  reflect: true, attribute: 'moisture-max'},
        subscribeLight:        {type: String,  reflect: true, attribute: 'subscribe-light'},
        lightMin:              {type: Number,  reflect: true, attribute: 'light-min'},
        lightMax:              {type: Number,  reflect: true, attribute: 'light-max'},
        subscribeTemperature:  {type: String,  reflect: true, attribute: 'subscribe-temperature'},
        tempMin:               {type: Number,  reflect: true, attribute: 'temp-min'},
        tempMax:               {type: Number,  reflect: true, attribute: 'temp-max'},
        subscribeConductivity: {type: String,  reflect: true, attribute: 'subscribe-conductivity'},
        condMin:               {type: Number,  reflect: true, attribute: 'cond-min'},
        condMax:               {type: Number,  reflect: true, attribute: 'cond-max'},
        subscribeHumidity:     {type: String,  reflect: true, attribute: 'subscribe-humidity'},
        humidityMin:           {type: Number,  reflect: true, attribute: 'humidity-min'},
        humidityMax:           {type: Number,  reflect: true, attribute: 'humidity-max'},
        subscribeBattery:      {type: String,  reflect: true, attribute: 'subscribe-battery'},
        showBattery:           {type: Boolean, reflect: true, attribute: 'show-battery'},
        subscribeDry:              {type: String,  reflect: true, attribute: 'subscribe-dry'},
        payloadDryOn:              {type: String,  reflect: true, attribute: 'payload-dry-on'},
        messagePropMoisture:       {type: String,  reflect: true, attribute: 'message-property-moisture'},
        messagePropTemperature:    {type: String,  reflect: true, attribute: 'message-property-temperature'},
        messagePropHumidity:       {type: String,  reflect: true, attribute: 'message-property-humidity'},
        messagePropBattery:        {type: String,  reflect: true, attribute: 'message-property-battery'},
        messagePropDry:            {type: String,  reflect: true, attribute: 'message-property-dry'},
        _readings: {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            padding: 6px;
            box-sizing: border-box;
            overflow: hidden;
            gap: 4px;
            --feezal-plant-ok-color:   var(--success-color, var(--feezal-success, #4caf50));
            --feezal-plant-warn-color: var(--warning-color, var(--feezal-warning, #ff9800));
            --feezal-plant-text-color: var(--primary-text-color, var(--feezal-color, #333));
        }
        .header {
            display: flex; align-items: center; gap: 6px;
        }
        .plant-icon-wrap {
            width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
            overflow: hidden; display: flex; align-items: center; justify-content: center;
            color: var(--feezal-plant-ok-color);
        }
        .plant-icon-wrap img { width: 100%; height: 100%; object-fit: cover; }
        .plant-name {
            font-size: 12px; font-weight: 600; color: var(--feezal-plant-text-color);
            flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .battery-badge {
            font-size: 10px; padding: 1px 5px; border-radius: 8px;
            background: var(--feezal-plant-text-color); color: var(--primary-background-color, #fff);
            opacity: 0.6; white-space: nowrap;
        }
        .dry-badge {
            font-size: 10px; padding: 1px 6px; border-radius: 8px;
            background: var(--feezal-plant-warn-color); color: #fff;
            white-space: nowrap; font-weight: 600;
        }
        /* compact mode */
        .metrics { display: flex; flex-wrap: wrap; gap: 4px; }
        .metric  { display: flex; flex-direction: column; align-items: center; min-width: 34px; gap: 1px; }
        .metric-bar-bg {
            width: 30px; height: 5px; border-radius: 3px;
            background: var(--secondary-background-color, #e0e0e0); overflow: hidden;
        }
        .metric-bar { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
        .metric-label { font-size: 9px; opacity: 0.55; color: var(--feezal-plant-text-color); }
        .metric-val   { font-size: 9px; font-weight: 600; color: var(--feezal-plant-text-color); }
        /* detailed mode */
        .metrics-detailed { display: flex; flex-direction: column; gap: 3px; }
        .detail-row {
            display: flex; align-items: center; gap: 5px; width: 100%;
        }
        .detail-lbl { font-size: 11px; flex: 1; color: var(--feezal-plant-text-color); }
        .detail-val {
            font-size: 11px; font-weight: 600; color: var(--feezal-plant-text-color);
            min-width: 44px; text-align: right;
        }
        .detail-bar-bg {
            width: 48px; height: 4px; border-radius: 2px;
            background: var(--secondary-background-color, #e0e0e0); overflow: hidden; flex-shrink: 0;
        }
        .detail-bar { height: 100%; border-radius: 2px; transition: width 0.5s ease; }
    `];

    constructor() {
        super();
        this.name                  = '';
        this.imageUrl              = '';
        this.layout                = 'compact';
        this.moistureMin           = 15;
        this.moistureMax           = 65;
        this.subscribeLight        = '';
        this.lightMin              = 1500;
        this.lightMax              = 35000;
        this.subscribeTemperature  = '';
        this.tempMin               = 15;
        this.tempMax               = 32;
        this.subscribeConductivity = '';
        this.condMin               = 350;
        this.condMax               = 2000;
        this.subscribeHumidity     = '';
        this.humidityMin           = 40;
        this.humidityMax           = 80;
        this.subscribeBattery      = '';
        this.showBattery           = true;
        this.subscribeDry          = '';
        this.payloadDryOn          = 'true';
        this.messagePropMoisture    = '';
        this.messagePropTemperature = '';
        this.messagePropHumidity    = '';
        this.messagePropBattery     = '';
        this.messagePropDry         = '';
        this._readings             = {};
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    connectedCallback() {
        super.connectedCallback();

        const subs = [
            [this.subscribe,            'moisture',     this.messagePropMoisture    || this.messageProperty],
            [this.subscribeLight,        'light',        this.messageProperty],
            [this.subscribeTemperature,  'temperature',  this.messagePropTemperature || this.messageProperty],
            [this.subscribeConductivity, 'conductivity', this.messageProperty],
            [this.subscribeHumidity,     'humidity',     this.messagePropHumidity    || this.messageProperty],
            [this.subscribeBattery,      'battery',      this.messagePropBattery     || this.messageProperty],
        ];

        for (const [topic, key, path] of subs) {
            if (!topic) continue;
            this.addSubscription(topic, msg => {
                const v = Number(this.getProperty(msg, path));
                if (!isNaN(v)) this._readings = {...this._readings, [key]: v};
            });
        }

        if (this.subscribeDry) {
            this.addSubscription(this.subscribeDry, msg => {
                const path = this.messagePropDry || this.messageProperty;
                const raw  = this.getProperty(msg, path);
                const isDry = String(raw) === String(this.payloadDryOn);
                this._readings = {...this._readings, dry: isDry};
            });
        }
    }

    _inRange(val, min, max) {
        return val !== undefined && val !== null && val >= min && val <= max;
    }

    _barPct(val, min, max) {
        if (val === undefined || val === null) return 0;
        return Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
    }

    _activeMetrics() {
        return METRIC_DEFS.map(m => ({
            ...m,
            min: this[m.minProp],
            max: this[m.maxProp],
            active: !!this[m.prop],
        })).filter(m => m.active);
    }

    render() {
        const metrics = this._activeMetrics();

        const header = html`
            <div class="header">
                <div class="plant-icon-wrap">
                    ${this.imageUrl
                        ? html`<img src="${this.imageUrl}" alt="plant">`
                        : leafSvg()}
                </div>
                <span class="plant-name">${this.name || 'Plant'}</span>
                ${this.showBattery && this._readings.battery != null
                    ? html`<span class="battery-badge">${Math.round(this._readings.battery)}\u2009%</span>`
                    : ''}
                ${this._readings.dry
                    ? html`<span class="dry-badge">💧 Dry!</span>`
                    : ''}
            </div>`;

        if (this.layout === 'detailed') {
            return html`
                ${header}
                <div class="metrics-detailed">
                    ${metrics.map(m => {
                        const val = this._readings[m.key] ?? null;
                        const ok  = this._inRange(val, m.min, m.max);
                        const pct = this._barPct(val, m.min, m.max);
                        const color = ok ? 'var(--feezal-plant-ok-color)' : 'var(--feezal-plant-warn-color)';
                        return html`
                            <div class="detail-row">
                                <span class="detail-lbl">${m.label}</span>
                                <span class="detail-val" style="color:${val != null ? color : 'inherit'}">
                                    ${val != null ? `${val}\u2009${m.unit}` : '\u2014'}
                                </span>
                                <div class="detail-bar-bg">
                                    <div class="detail-bar" style="width:${pct}%;background:${color}"></div>
                                </div>
                            </div>`;
                    })}
                </div>`;
        }

        // compact
        return html`
            ${header}
            <div class="metrics">
                ${metrics.map(m => {
                    const val = this._readings[m.key] ?? null;
                    const ok  = this._inRange(val, m.min, m.max);
                    const pct = this._barPct(val, m.min, m.max);
                    const color = ok ? 'var(--feezal-plant-ok-color)' : 'var(--feezal-plant-warn-color)';
                    return html`
                        <div class="metric">
                            <div class="metric-bar-bg">
                                <div class="metric-bar" style="width:${pct}%;background:${color}"></div>
                            </div>
                            <span class="metric-label">${m.label}</span>
                            ${val != null ? html`<span class="metric-val" style="color:${color}">${val}</span>` : ''}
                        </div>`;
                })}
            </div>`;
    }
}

customElements.define('feezal-element-material-plant', FeezalElementMaterialPlant);
export {FeezalElementMaterialPlant};

/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@material/web/switch/switch.js';
import '@material/web/slider/slider.js';

// ── Unavailability badge ─────────────────────────────────────────────────────
const UNAVAIL = html`<svg viewBox="0 0 24 24"><path fill="currentColor"
    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;

// Speed % → rotation duration: faster = shorter period
function speedDuration(pct) {
    if (pct <= 0)   return '4s';
    if (pct <= 25)  return '3s';
    if (pct <= 60)  return '1.5s';
    return '0.7s';
}

// ── Element ───────────────────────────────────────────────────────────────────
class FeezalElementMaterialFan extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Fan', category: 'Device', color: '#1565c0', icon: 'mode_fan'},
            description: 'Smart fan card — on/off toggle with animated blade SVG, optional speed percentage slider and preset mode buttons.',
            discovery: {
                component: 'fan',
                map: {
                    state_topic:                {attr: 'subscribe'},
                    command_topic:              {attr: 'publish'},
                    payload_on:                 {attr: 'payload-on'},
                    payload_off:                {attr: 'payload-off'},
                    // HA uses either value_template (generic) or state_value_template (fan-specific)
                    value_template:             {attr: 'message-property', transform: 'valueTemplateToPath'},
                    state_value_template:       {attr: 'message-property', transform: 'valueTemplateToPath'},
                    percentage_state_topic:     {attr: 'subscribe-speed'},
                    percentage_command_topic:   {attr: 'publish-speed'},
                    percentage_value_template:  {attr: 'message-property-speed',  transform: 'valueTemplateToPath'},
                    speed_range_min:            {attr: 'speed-range-min'},
                    speed_range_max:            {attr: 'speed-range-max'},
                    preset_modes:               {attr: 'preset-modes', transform: 'jsonStringify'},
                    preset_mode_state_topic:    {attr: 'subscribe-preset'},
                    preset_mode_command_topic:  {attr: 'publish-preset'},
                    preset_mode_value_template: {attr: 'message-property-preset', transform: 'valueTemplateToPath'},
                    availability_topic:         {attr: 'subscribe-availability'},
                    payload_available:          {attr: 'payload-available'},
                    payload_not_available:      {attr: 'payload-unavailable'},
                    name:                       'label',
                },
            },
            attributes: [
                {name: 'subscribe',              type: 'mqttTopic', help: 'Topic receiving the fan on/off state.'},
                {name: 'message-property',       type: 'string',    default: 'payload', help: 'Property path within state messages (dot-notation). Blank = top-level payload.'},
                {name: 'publish',                type: 'mqttTopic', help: 'Topic to publish on/off commands.'},
                {name: 'payload-on',             type: 'string',    default: 'ON',  help: 'Payload for "on".'},
                {name: 'payload-off',            type: 'string',    default: 'OFF', help: 'Payload for "off".'},
                {name: 'subscribe-speed',        type: 'mqttTopic', help: 'Topic receiving current speed percentage (0–100).'},
                {name: 'message-property-speed', type: 'string',    default: 'payload', help: 'Property path within speed messages. Defaults to message-property.'},
                {name: 'publish-speed',          type: 'mqttTopic', help: 'Topic to publish target speed percentage.'},
                {name: 'subscribe-preset',       type: 'mqttTopic', help: 'Topic receiving current preset mode name.'},
                {name: 'message-property-preset', type: 'string',   default: 'payload', help: 'Property path within preset messages. Defaults to message-property.'},
                {name: 'publish-preset',         type: 'mqttTopic', help: 'Topic to publish selected preset mode name.'},
                {name: 'preset-modes',           type: 'objectList', itemFields: [{key: '', placeholder: 'preset name'}], default: '[]',
                    help: 'JSON array of preset mode names, e.g. ["low","medium","high"].'},
                {name: 'label',                  type: 'string',    default: '', help: 'Optional card label.'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Availability topic.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',      type: 'string',    default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable',    type: 'string',    default: 'offline', help: 'Payload meaning unavailable.'},
                {name: 'speed-range-min', type: 'number', default: 1,   help: 'Raw speed minimum (from discovery speed_range_min). Slider shows 0–100%; raw values are scaled to this range.'},
                {name: 'speed-range-max', type: 'number', default: 100, help: 'Raw speed maximum (from discovery speed_range_max). e.g. 9 for IKEA STARKVIND.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-fan-on-color',    type: 'color', default: 'var(--primary-text-color)',   help: 'Fan blade colour when on.'},
                {property: '--feezal-fan-off-color',   type: 'color', default: 'var(--secondary-text-color)', help: 'Fan blade colour when off.'},
                {property: '--feezal-fan-text-color',  type: 'color', default: 'var(--primary-text-color)',   help: 'Text and control colour.'},
                {property: '--feezal-fan-error-color', type: 'color', default: 'var(--error-color, #b00020)', help: 'Unavailability badge colour.'},
            ],
            restrict:     {minWidth: 100, minHeight: 120},
            defaultStyle: {width: '160px', height: '200px'},
        };
    }

    static properties = {
        subscribe:             {type: String,  reflect: true},
        publish:               {type: String,  reflect: true},
        payloadOn:             {type: String,  reflect: true, attribute: 'payload-on'},
        payloadOff:            {type: String,  reflect: true, attribute: 'payload-off'},
        subscribeSpeed:        {type: String,  reflect: true, attribute: 'subscribe-speed'},
        publishSpeed:          {type: String,  reflect: true, attribute: 'publish-speed'},
        subscribePreset:       {type: String,  reflect: true, attribute: 'subscribe-preset'},
        publishPreset:         {type: String,  reflect: true, attribute: 'publish-preset'},
        presetModes:           {type: String,  reflect: true, attribute: 'preset-modes'},
        label:                 {type: String,  reflect: true},
        subscribeAvailability: {type: String,  reflect: true, attribute: 'subscribe-availability'},
        payloadAvailable:      {type: String,  reflect: true, attribute: 'payload-available'},
        payloadUnavailable:    {type: String,  reflect: true, attribute: 'payload-unavailable'},
        speedRangeMin:         {type: Number,  reflect: true, attribute: 'speed-range-min'},
        speedRangeMax:         {type: Number,  reflect: true, attribute: 'speed-range-max'},
        msgPropSpeed:          {type: String,  reflect: true, attribute: 'message-property-speed'},
        msgPropPreset:         {type: String,  reflect: true, attribute: 'message-property-preset'},
        msgPropAvailability:   {type: String,  reflect: true, attribute: 'message-property-availability'},
        discoveryId:           {type: String,  reflect: true, attribute: 'discovery-id'},
        _on:        {state: true},
        _speed:     {state: true},  // 0–100 or null
        _preset:    {state: true},
        _available: {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 6px;
            box-sizing: border-box;
            overflow: hidden;
            gap: 4px;
            position: relative;
            --feezal-fan-on-color:    var(--primary-text-color, var(--feezal-color, #333));
            --feezal-fan-off-color:   var(--secondary-text-color, var(--feezal-color-sub, #999));
            --feezal-fan-text-color:  var(--primary-text-color, var(--feezal-color, #333));
            --feezal-fan-error-color: var(--error-color, #b00020);
            /* Use the themed accent colour for interactive controls (switch track, preset active).
               --primary-color is the feezal/Shoelace accent; --primary-text-color is used for
               the blade colour only so it can stay white on dark themes. */
            --feezal-fan-accent-color: var(--primary-color, var(--sl-color-primary-600, #0284c7));
            --md-sys-color-primary:              var(--feezal-fan-accent-color);
            --md-slider-active-track-color:      var(--feezal-fan-accent-color);
            --md-slider-handle-color:            var(--feezal-fan-accent-color);
            --md-slider-inactive-track-color:    var(--feezal-fan-off-color);
            --md-switch-track-width:  44px;
            --md-switch-track-height: 26px;
        }
        .unavail {
            position: absolute; top: 4px; right: 4px;
            width: 18px; height: 18px;
            color: var(--feezal-fan-error-color);
            opacity: 0.8; pointer-events: none; z-index: 2;
        }
        .unavail svg { width: 100%; height: 100%; display: block; }
        .svg-wrap {
            flex: 1; width: 100%; min-height: 0;
            display: flex; align-items: center; justify-content: center;
        }
        svg.fan { width: min(100%, 120px); height: min(100%, 120px); display: block; overflow: visible; }
        .toggle-row {
            display: flex; align-items: center; gap: 6px;
        }
        .toggle-label { font-size: 12px; color: var(--feezal-fan-text-color); min-width: 36px; }
        .speed-row { display: flex; align-items: center; width: 100%; }
        .speed-row.disabled { opacity: 0.35; pointer-events: none; }
        md-slider { flex: 1; }
        .preset-row { display: flex; gap: 3px; flex-wrap: wrap; justify-content: center; }
        .preset-btn {
            padding: 2px 8px; border: 1.5px solid currentColor; border-radius: 12px;
            background: transparent; cursor: pointer; font-size: 10px; font-weight: 600;
            color: var(--feezal-fan-text-color);
        }
        .preset-btn.active {
            background: var(--feezal-fan-accent-color);
            color: var(--primary-background-color, #fff);
            border-color: var(--feezal-fan-accent-color);
        }
        .label {
            font-size: 11px; opacity: 0.65; text-align: center;
            color: var(--feezal-fan-text-color);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;
        }
    `];

    constructor() {
        super();
        this.subscribe             = '';
        this.publish               = '';
        this.payloadOn             = 'ON';
        this.payloadOff            = 'OFF';
        this.subscribeSpeed        = '';
        this.publishSpeed          = '';
        this.speedRangeMin         = 1;
        this.speedRangeMax         = 100;
        this.subscribePreset       = '';
        this.publishPreset         = '';
        this.presetModes           = '[]';
        this.label                 = '';
        this.subscribeAvailability = '';
        this.payloadAvailable      = 'online';
        this.payloadUnavailable    = 'offline';
        this.msgPropSpeed          = '';
        this.msgPropPreset         = '';
        this.msgPropAvailability   = '';
        this.discoveryId           = '';
        this._on        = false;
        this._speed     = null;
        this._preset    = null;
        this._available = true;
    }

    _subscribe() { /* intentionally empty */ }

    connectedCallback() {
        super.connectedCallback();

        if (this.subscribeAvailability) {
            this.addSubscription(this.subscribeAvailability, msg => {
                let v = this.getProperty(msg, this.msgPropAvailability || this.messageProperty);
                if (typeof v === 'string') {
                    try { const p = JSON.parse(v); if (p && 'state' in p) v = p.state; } catch { /* not JSON */ }
                } else if (v && typeof v === 'object' && 'state' in v) { v = v.state; }
                const s = String(v).toLowerCase();
                this._available = String(v) === this.payloadAvailable ||
                    (s !== String(this.payloadUnavailable).toLowerCase() &&
                     s !== 'offline' && s !== 'false' && s !== '0' && s !== 'unavailable');
            });
        }

        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                let v = this.getProperty(msg, this.messageProperty);
                if (typeof v === 'string') {
                    try { const p = JSON.parse(v); if (p && 'state' in p) v = p.state; } catch { /* raw */ }
                } else if (v && typeof v === 'object' && 'state' in v) { v = v.state; }
                this._on = String(v).toUpperCase() === this.payloadOn.toUpperCase() ||
                    v === true || v === 1 || v === '1';
            });
        }

        if (this.subscribeSpeed) {
            this.addSubscription(this.subscribeSpeed, msg => {
                const raw = Number(this.getProperty(msg, this.msgPropSpeed || this.messageProperty));
                if (!isNaN(raw)) {
                    const lo = this.speedRangeMin ?? 1;
                    const hi = this.speedRangeMax ?? 100;
                    // Normalise raw device units to 0–100% for the slider
                    this._speed = (hi === lo) ? 0 : Math.max(0, Math.min(100, ((raw - lo) / (hi - lo)) * 100));
                }
            });
        }

        if (this.subscribePreset) {
            this.addSubscription(this.subscribePreset, msg => {
                this._preset = String(this.getProperty(msg, this.msgPropPreset || this.messageProperty));
            });
        }
    }

    _toggle(e) {
        this._on = e.target.selected;
        if (this.publish) feezal.connection.pub(this.publish, this._on ? this.payloadOn : this.payloadOff);
    }

    _setSpeed(e) {
        const pct = e.target.value;
        this._speed = pct;
        if (this.publishSpeed) {
            const lo = this.speedRangeMin ?? 1;
            const hi = this.speedRangeMax ?? 100;
            // De-normalise percentage back to raw device units
            const raw = (lo === hi) ? lo : Math.round(lo + (pct / 100) * (hi - lo));
            feezal.connection.pub(this.publishSpeed, String(raw));
        }
    }

    _setPreset(mode) {
        this._preset = mode;
        if (this.publishPreset) feezal.connection.pub(this.publishPreset, mode);
    }

    _fanSvg(on, speed) {
        const bladeColor = on ? 'var(--feezal-fan-on-color)' : 'var(--feezal-fan-off-color)';
        const bladeOpacity = on ? '0.9' : '0.45';
        const duration = on ? speedDuration(speed ?? 50) : '';
        const animStyle = on ? `animation: feezalFanSpin linear ${duration} infinite` : '';

        // 3 elliptic blades at 120° apart, each offset from centre (cx=50, cy=26)
        // then rotated around fan centre (50,50).
        return html`
            <svg class="fan" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <style>
                    @keyframes feezalFanSpin {
                        from { transform: rotate(0deg); }
                        to   { transform: rotate(360deg); }
                    }
                </style>
                <g style="${animStyle}; transform-origin: 50px 50px;">
                    <ellipse cx="50" cy="26" rx="13" ry="23"
                             fill="${bladeColor}" opacity="${bladeOpacity}"
                             transform="rotate(0 50 50)"/>
                    <ellipse cx="50" cy="26" rx="13" ry="23"
                             fill="${bladeColor}" opacity="${bladeOpacity}"
                             transform="rotate(120 50 50)"/>
                    <ellipse cx="50" cy="26" rx="13" ry="23"
                             fill="${bladeColor}" opacity="${bladeOpacity}"
                             transform="rotate(240 50 50)"/>
                    <circle cx="50" cy="50" r="9"
                            fill="${bladeColor}" opacity="${on ? '1' : '0.6'}"/>
                </g>
            </svg>`;
    }

    render() {
        let presets = [];
        try { presets = JSON.parse(this.presetModes); } catch { presets = []; }

        const speedPct = this._speed ?? 0;

        return html`
            ${!this._available ? html`<div class="unavail">${UNAVAIL}</div>` : ''}
            <div class="svg-wrap">${this._fanSvg(this._on, speedPct)}</div>
            <div class="toggle-row">
                <md-switch .selected="${this._on}" @change="${this._toggle}"></md-switch>
                <span class="toggle-label">
                    ${this._on
                        ? (this._speed != null ? `${Math.round(this._speed)}\u2009%` : 'On')
                        : 'Off'}
                </span>
            </div>
            ${this.subscribeSpeed ? html`
                <div class="speed-row${this._on ? '' : ' disabled'}">
                    <md-slider min="1" max="100" .value="${this._speed ?? 50}"
                               ?disabled="${!this._on}"
                               @change="${this._setSpeed}"></md-slider>
                </div>
            ` : ''}
            ${presets.length > 0 ? html`
                <div class="preset-row">
                    ${presets.map(p => html`
                        <button class="preset-btn ${this._preset === p ? 'active' : ''}"
                                @click="${() => this._setPreset(p)}">${p}</button>`)}
                </div>
            ` : ''}
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-material-fan', FeezalElementMaterialFan);
export {FeezalElementMaterialFan};

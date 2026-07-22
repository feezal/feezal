/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {SENSOR_TYPE_OPTIONS, SENSOR_DEVICE_CLASS_MAP, sensorType, batteryLowAttributes, batteryLowFromValue} from '@feezal/feezal-element/feezal-sensor-types.js';
import {svg} from 'lit';

// ── Unavailability badge ─────────────────────────────────────────────────────
const UNAVAIL = html`<svg viewBox="0 0 24 24"><path fill="currentColor"
    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;

// ── SVG helpers ───────────────────────────────────────────────────────────────

// PIR-style: person silhouette with three radiating arcs to the right.
// Arcs are centred on (20, 30); radii 15, 22, 30.
function motionSvg(isActive) {
    const ac = isActive ? 'var(--feezal-motion-active-color)' : 'currentColor';
    const ao = isActive ? 1 : 0.35;
    return svg`
        <circle cx="20" cy="11" r="7"
                fill="${isActive ? 'currentColor' : 'none'}" fill-opacity="${isActive ? 0.85 : 0}"
                stroke="currentColor" stroke-width="2.5"/>
        <path d="M11,20 C11,20 10,40 20,40 C30,40 29,20 29,20"
              fill="${isActive ? 'currentColor' : 'none'}" fill-opacity="${isActive ? 0.7 : 0}"
              stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M30,19 A15,15 0 0,1 30,41"
              fill="none" stroke="${ac}" stroke-width="2.5" stroke-linecap="round"
              opacity="${ao}"/>
        <path d="M34,13 A22,22 0 0,1 34,47"
              fill="none" stroke="${ac}" stroke-width="2.5" stroke-linecap="round"
              opacity="${isActive ? 0.7 : 0.25}"/>
        <path d="M39,7 A30,30 0 0,1 39,53"
              fill="none" stroke="${ac}" stroke-width="2" stroke-linecap="round"
              opacity="${isActive ? 0.45 : 0.15}"/>`;
}

// Presence/occupancy: full-body person centred inside a glowing zone circle.
function presenceSvg(isActive) {
    const ac = isActive ? 'var(--feezal-motion-active-color)' : 'currentColor';
    return svg`
        <circle cx="30" cy="30" r="26"
                fill="${isActive ? 'var(--feezal-motion-active-color)' : 'none'}"
                fill-opacity="${isActive ? 0.18 : 0}"
                stroke="${ac}" stroke-width="3"/>
        <circle cx="30" cy="20" r="7"
                fill="currentColor" fill-opacity="${isActive ? 1 : 0.5}"/>
        <path d="M19,31 C19,31 18,48 30,48 C42,48 41,31 41,31"
              fill="currentColor" fill-opacity="${isActive ? 1 : 0.5}" stroke="none"/>
        ${isActive ? svg`
            <circle cx="30" cy="30" r="19"
                    fill="none" stroke="${ac}" stroke-width="1.5"
                    stroke-dasharray="4 3" opacity="0.4"/>
        ` : ''}`;
}

// mmWave radar: expanding semicircular arcs from a sensor node at the bottom.
function radarSvg(isActive) {
    const ac = isActive ? 'var(--feezal-motion-active-color)' : 'currentColor';
    return svg`
        <circle cx="30" cy="52" r="4" fill="${ac}"/>
        <path d="M16,52 A16,16 0 0,1 44,52"
              fill="${isActive ? 'var(--feezal-motion-active-color)' : 'none'}"
              fill-opacity="${isActive ? 0.2 : 0}"
              stroke="${ac}" stroke-width="2.5" stroke-linecap="round"
              opacity="${isActive ? 1 : 0.5}"/>
        <path d="M7,52 A25,25 0 0,1 53,52"
              fill="none" stroke="${ac}" stroke-width="2.5" stroke-linecap="round"
              opacity="${isActive ? 0.7 : 0.3}"/>
        <path d="M-1,52 A33,33 0 0,1 61,52"
              fill="none" stroke="${ac}" stroke-width="2" stroke-linecap="round"
              opacity="${isActive ? 0.4 : 0.15}"/>`;
}

// Zone/room: rectangular area that highlights when motion is detected.
function zoneSvg(isActive) {
    const ac = isActive ? 'var(--feezal-motion-active-color)' : 'currentColor';
    return svg`
        <rect x="4" y="6" width="52" height="50" rx="2"
              fill="${isActive ? 'var(--feezal-motion-active-color)' : 'none'}"
              fill-opacity="${isActive ? 0.18 : 0}"
              stroke="${ac}" stroke-width="3"/>
        <circle cx="30" cy="24" r="6"
                fill="currentColor" fill-opacity="${isActive ? 0.9 : 0.3}"/>
        <path d="M21,34 C21,34 20,48 30,48 C40,48 39,34 39,34"
              fill="currentColor" fill-opacity="${isActive ? 0.9 : 0.3}" stroke="none"/>`;
}

// ── Element ───────────────────────────────────────────────────────────────────
class FeezalElementMaterialMotion extends FeezalElement {
    static get feezal() {
        return {
            // E132: palette name "Sensor" — the generalized boolean-sensor
            // card (motion + water/smoke/gas/… hazard classes). The tag stays
            // material-motion until the alias mechanism exists.
            palette: {name: 'Sensor', category: 'Circle', color: '#1565c0', icon: 'motion_sensor_active'},
            description: 'Boolean-sensor card (motion, presence, water leak, smoke, gas, …). Motion types keep their ' +
                'dedicated visuals (PIR arcs, zone, radar); hazard classes render the E134 circle state disc with the ' +
                'type icon — error-coloured while an alarm class is triggered.',
            discovery: {
                component: 'binary_sensor',
                map: {
                    state_topic:           {attr: 'subscribe'},
                    payload_on:            {attr: 'payload-active'},
                    payload_off:           {attr: 'payload-clear'},
                    device_class:          {attr: 'type', valueMap: SENSOR_DEVICE_CLASS_MAP},   // E132: shared hazard-aware map
                    // N31: availability is mapped automatically from the canonical discovery record.
                    value_template:        {attr: 'message-property', transform: 'valueTemplateToPath'},
                    name:                  'label',
                },
            },
            attributes: [
                {name: 'subscribe',              type: 'mqttTopic', help: 'Topic reporting motion or presence state.'},
                {name: 'message-property',       type: 'string',    default: 'payload', help: 'Property path within the message payload (dot-notation). Blank = top-level payload.'},
                {name: 'payload-active',         type: 'string',    default: 'ON',  help: 'Payload meaning motion detected / zone occupied.'},
                {name: 'payload-clear',          type: 'string',    default: 'OFF', help: 'Payload meaning no motion / zone vacant.'},
                {name: 'type',                   type: 'select',
                    options: SENSOR_TYPE_OPTIONS,
                    default: 'motion',
                    help: 'E132: sensor class. Motion/presence/radar/zone keep their dedicated visuals; hazard classes (water-leak, smoke, gas, co, vibration, tamper, generic) render the circle state disc with the type icon — alarm classes go error-coloured while triggered.'},
                {name: 'icon-active', type: 'icon', help: 'Disc icon while triggered — overrides the type default (empty = type default; disc types only).'},
                {name: 'icon-clear',  type: 'icon', help: 'Disc icon while clear — overrides the type default (empty = type default; disc types only).'},
                {name: 'text-active', type: 'string', default: '', help: 'State text while triggered. Empty = the type default (e.g. "Leak!" for water-leak).'},
                {name: 'text-clear',  type: 'string', default: '', help: 'State text while clear. Empty = the type default.'},
                // E124: dedicated low-battery warning (shared descriptor trio).
                ...batteryLowAttributes,
                {name: 'label',                  type: 'string',    default: '',    help: 'Optional card label shown below the visual.'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',      type: 'string',    default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable',    type: 'string',    default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-motion-active-color', type: 'color', default: 'var(--primary-color)', help: 'Colour shown when motion is detected or zone is occupied.'},
                {property: '--feezal-motion-text-color',   type: 'color', default: 'var(--primary-text-color)',    help: 'Label text colour.'},
                {property: '--feezal-motion-error-color',  type: 'color', default: 'var(--error-color)', help: 'Unavailability badge colour.'},
            ],
            restrict:     {minWidth: 60, minHeight: 80},
            defaultStyle: {width: '80px', height: '120px'},
        };
    }

    static properties = {
        subscribe:             {type: String, reflect: true},
        payloadActive:         {type: String, reflect: true, attribute: 'payload-active'},
        payloadClear:          {type: String, reflect: true, attribute: 'payload-clear'},
        type:                  {type: String, reflect: true},
        iconActive:            {type: String, reflect: true, attribute: 'icon-active'},
        iconClear:             {type: String, reflect: true, attribute: 'icon-clear'},
        textActive:            {type: String, reflect: true, attribute: 'text-active'},
        textClear:             {type: String, reflect: true, attribute: 'text-clear'},
        // E124 — dedicated low-battery warning
        subscribeBatteryLow:   {type: String, reflect: true, attribute: 'subscribe-battery-low'},
        msgPropBatteryLow:     {type: String, reflect: true, attribute: 'message-property-battery-low'},
        payloadBatteryLow:     {type: String, reflect: true, attribute: 'payload-battery-low'},
        batteryLowThreshold:   {type: Number, reflect: true, attribute: 'battery-low-threshold'},
        label:                 {type: String, reflect: true},
        // N31: availability inherited from FeezalElement.
        discoveryId:           {type: String, reflect: true, attribute: 'discovery-id'},
        _active:     {state: true},
        _batteryLow: {state: true},
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
            --feezal-motion-active-color: var(--warning-color, var(--feezal-warning, #ff9800));
            --feezal-motion-text-color:   var(--primary-text-color, var(--feezal-color, #333));
            --feezal-motion-error-color:  var(--error-color, #b00020);
            color: var(--feezal-motion-text-color);
        }
        .unavail {
            position: absolute; top: 4px; right: 4px;
            width: 18px; height: 18px;
            color: var(--feezal-motion-error-color);
            opacity: 0.8; pointer-events: none; z-index: 2;
        }
        .unavail svg { width: 100%; height: 100%; display: block; }
        /* E124: low-battery warning, top-left (unavail owns top-right). */
        .batt {
            position: absolute; top: 4px; left: 4px;
            font-size: 15px; color: var(--warning-color, #ff9800);
            opacity: 0.9; pointer-events: none; z-index: 2;
        }
        .svg-wrap { flex: 1; width: 100%; min-height: 0; }
        svg.motion { width: 100%; height: 100%; display: block; overflow: visible; }
        /* E132: hazard-class rendering (icon + state text; E134 turns this
           into the circle state disc). Alarm classes flag error colour. */
        .hazard {
            height: 100%; display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 4px;
        }
        .hazard feezal-icon { font-size: 34px; opacity: 0.5; }
        .hazard.active feezal-icon { opacity: 1; color: var(--feezal-motion-active-color); }
        .hazard.alarm.active feezal-icon,
        .hazard.alarm.active .htext { color: var(--feezal-motion-error-color); }
        .htext { font-size: 12px; font-weight: 600; }
        .label {
            font-size: 11px; opacity: 0.65; text-align: center;
            color: var(--feezal-motion-text-color);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;
        }
    `];

    constructor() {
        super();
        this.subscribe             = '';
        this.payloadActive         = 'ON';
        this.payloadClear          = 'OFF';
        this.type                  = 'motion';
        this.iconActive            = '';
        this.iconClear             = '';
        this.textActive            = '';
        this.textClear             = '';
        this.subscribeBatteryLow   = '';
        this.msgPropBatteryLow     = '';
        this.payloadBatteryLow     = 'true';
        this.batteryLowThreshold   = 15;
        this.label                 = '';
        this.discoveryId           = '';
        this._active    = false;
        this._batteryLow = false;
    }

    // Device cards manage subscriptions manually; suppress the base-class path.
    _subscribe() { /* intentionally empty */ }

    connectedCallback() {
        super.connectedCallback();

        // N31: availability subscription handled by the FeezalElement base.

        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                let v = this.getProperty(msg, this.messageProperty);
                if (typeof v === 'string') {
                    try { const p = JSON.parse(v); if (p && 'state' in p) v = p.state; } catch { /* not JSON */ }
                } else if (v && typeof v === 'object' && 'state' in v) { v = v.state; }
                this._active = String(v) === String(this.payloadActive) ||
                    v === true || v === 1 || v === '1';
            });
        }
        // E124: dedicated low-battery warning — a weak battery is a badge,
        // never a blackout (the state above keeps updating).
        if (this.subscribeBatteryLow) {
            this.addSubscription(this.subscribeBatteryLow, msg => {
                const v = this.getProperty(msg, this.msgPropBatteryLow || this.messageProperty);
                this._batteryLow = batteryLowFromValue(v, this.payloadBatteryLow, this.batteryLowThreshold);
            });
        }
    }

    /** The four motion types keep their dedicated SVG visuals. */
    _legacySvgType() {
        return ['motion', 'presence', 'radar', 'zone'].includes(this.type);
    }

    _shapeSvg(isActive) {
        if (this.type === 'presence') return presenceSvg(isActive);
        if (this.type === 'radar')    return radarSvg(isActive);
        if (this.type === 'zone')     return zoneSvg(isActive);
        return motionSvg(isActive);
    }

    render() {
        const t = sensorType(this.type);
        return html`
            ${!this._available ? html`<div class="unavail">${UNAVAIL}</div>` : ''}
            ${this._batteryLow ? html`<feezal-icon class="batt" name="battery_alert" title="Battery low"></feezal-icon>` : ''}
            <div class="svg-wrap">
                ${this._legacySvgType() ? html`
                    <svg class="motion" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                        ${this._shapeSvg(this._active)}
                    </svg>` : html`
                    <div class="hazard ${this._active ? 'active' : ''} ${t.alarm ? 'alarm' : ''}">
                        <feezal-icon name="${(this._active ? this.iconActive : this.iconClear)
                            || (this._active ? t.icon : t.iconClear)}"></feezal-icon>
                        <span class="htext">${this._active
                            ? (this.textActive || t.textActive)
                            : (this.textClear || t.textClear)}</span>
                    </div>`}
            </div>
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-material-motion', FeezalElementMaterialMotion);
export {FeezalElementMaterialMotion};

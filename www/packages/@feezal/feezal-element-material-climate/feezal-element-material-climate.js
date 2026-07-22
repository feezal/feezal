/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@feezal/feezal-element/feezal-topic-input.js';
import {svg, LitElement} from 'lit';
import '@material/web/icon/icon.js';
import '@material/web/chips/filter-chip.js';

// ─── Arc geometry ─────────────────────────────────────────────────────────────
// Convention: 0° = 12 o'clock, clockwise (same as feezal-element-material-light).
// B29: radius/track/knob are proportionally IDENTICAL to material-light's ring
// (radius 80 % of the viewBox half-size, track 7 % / knob 10 % of the viewBox
// width) so both cards side by side show perfectly aligned circle-sliders.
// This viewBox is 200 (light: 100) — constants here are the light values × 2.
const ARC_CX    = 100;
const ARC_CY    = 100;
const ARC_R     = 80;    // outer arc centre-line radius (= light TRACK_R 40 × 2)
const ARC_W     = 14;    // track stroke width (= light RING_W 7 × 2)
const VALVE_R   = 62;    // inner valve-arc centre-line radius
const VALVE_W   = 4;
const ARC_START = 225;   // degrees — 7:30 position
const ARC_SPAN  = 270;   // total arc span in degrees

function tPolarXY(deg, r = ARC_R) {
    const rad = (deg - 90) * Math.PI / 180;
    return [+(ARC_CX + r * Math.cos(rad)).toFixed(2), +(ARC_CY + r * Math.sin(rad)).toFixed(2)];
}

// SVG arc path: clockwise from fromDeg, spanning spanDeg degrees.
function tArcPath(fromDeg, spanDeg, r = ARC_R) {
    if (Math.abs(spanDeg) < 0.05) return '';
    const [ax, ay] = tPolarXY(fromDeg, r);
    const [bx, by] = tPolarXY((fromDeg + spanDeg) % 360, r);
    return `M${ax},${ay} A${r},${r} 0 ${spanDeg > 180 ? 1 : 0},1 ${bx},${by}`;
}

// Temperature → span in degrees from ARC_START.
function tTempToSpan(temp, min, max) {
    return Math.max(0, Math.min(ARC_SPAN, ((temp - min) / (max - min)) * ARC_SPAN));
}

// SVG angle → temperature, snapped to step.
function tAngleToTemp(deg, min, max, step) {
    const arcEnd = (ARC_START + ARC_SPAN) % 360; // 135
    let offset;
    if (deg >= ARC_START) {
        offset = deg - ARC_START;
    } else if (deg <= arcEnd) {
        offset = deg + (360 - ARC_START);
    } else {
        // gap zone (135°–225°) — clamp to nearest end
        offset = deg < 180 ? ARC_SPAN : 0;
    }
    const frac = Math.max(0, Math.min(1, offset / ARC_SPAN));
    const raw  = min + frac * (max - min);
    return +( Math.round(raw / step) * step ).toFixed(2);
}

// Format temperature: strip trailing .00 → "22°C", keep .5 → "22.5°C".
function fmtTemp(val, unit) {
    if (val === null || val === undefined || isNaN(+val)) return '\u2014';
    const n = +val;
    return (Number.isInteger(n) ? n.toString() : n.toFixed(1)) + '\u00a0' + (unit || '°C');
}

// ─── Element ──────────────────────────────────────────────────────────────────
class FeezalElementMaterialClimate extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Climate', category: 'Material', color: '#1565c0', icon: 'thermostat'},
            description: 'Smart thermostat card — circular arc setpoint slider, actual temperature, optional mode chips, valve indicator, and humidity display.',
            // ── N6 custom inspector ───────────────────────────────────────────
            inspector: 'feezal-element-material-climate-inspector',
            // ── N12 Auto-Discovery descriptor ─────────────────────────────────
            // N12 Auto-Discovery descriptor for HA MQTT climate devices.
            // zigbee2mqtt TRVs (and similar) publish a schema:json discovery config
            // where all state topics point to the same base topic (a JSON object)
            // and all command topics point to the /set endpoint.
            // ESPHome uses separate topics (no schema key); discovery still maps
            // temperature range, unit, modes, and name automatically.
            discovery: {
                component: 'climate',
                map: {
                    // Schema → payload mode (json = zigbee2mqtt; absent = separate)
                    schema: {attr: 'payload-mode', valueMap: {json: 'json', _default: 'separate'}},
                    // Base-topic wiring — used by JSON-schema devices (zigbee2mqtt);
                    // harmless to set for separate-mode devices since subscribe/publish
                    // are not consumed in separate mode.
                    temperature_state_topic:   {attr: 'subscribe-setpoint'},
                    temperature_command_topic: {attr: 'publish-setpoint'},
                    // Separate-mode per-property topic mappings (ESPHome, HA MQTT)
                    current_temperature_topic: {attr: 'subscribe-actual'},
                    mode_state_topic:          {attr: 'subscribe-mode'},
                    mode_command_topic:        {attr: 'publish-mode'},
                    action_topic:              {attr: 'subscribe-valve'},
                    // E108: native-discovery-only keys (HA/z2m entities lack them
                    // and simply skip these — additive, backwards compatible).
                    // Homematic synthesised entities carry message_property:'val'
                    // and the valve device range (BidCoS 0–100, HmIP 0–1).
                    message_property: {attr: 'message-property'},
                    // Per-topic message-property twins — native reads use these
                    // per-topic (their 'payload' default never falls back), so the
                    // recognizer stamps each to payload.val too. HA/z2m absent → skipped.
                    message_property_setpoint:        {attr: 'message-property-setpoint'},
                    message_property_actual:          {attr: 'message-property-actual'},
                    message_property_mode:            {attr: 'message-property-mode'},
                    message_property_valve:           {attr: 'message-property-valve'},
                    message_property_boost_remaining: {attr: 'message-property-boost-remaining'},
                    // B54: device-reported boost active state (hm BOOST_MODE).
                    boost_state_topic:            {attr: 'subscribe-boost-state'},
                    message_property_boost_state: {attr: 'message-property-boost-state'},
                    valve_min:        {attr: 'valve-min'},
                    valve_max:        {attr: 'valve-max'},
                    // Range + step (apply in both modes)
                    min_temp:         {attr: 'min'},
                    max_temp:         {attr: 'max'},
                    temp_step:        {attr: 'step'},
                    temperature_unit: {attr: 'unit', valueMap: {C: '°C', F: '°F', _default: '°C'}},
                    // Modes: HA gives ["heat","cool","off"]; _parsedModes() coerces to [{value,label}].
                    modes: {attr: 'modes', transform: 'jsonStringify'},
                    // N31: availability is mapped automatically from the canonical discovery record.
                    // Label
                    name: 'label',
                },
            },
            attributes: [
                // ── Wiring mode ────────────────────────────────────────────────
                {name: 'payload-mode', type: 'select', options: ['separate', 'json'], default: 'separate',
                    help: 'separate = one topic per property (default, hand-wiring); json = single topic carrying the full climate JSON object.'},
                // ── JSON mode ──────────────────────────────────────────────────
                {name: 'subscribe', type: 'mqttTopic', help: 'json mode: base topic carrying the climate state JSON object.'},
                {name: 'publish',   type: 'mqttTopic', help: 'json mode: command/set topic (e.g. zigbee2mqtt/TRV/set).'},
                {name: 'json-map',  type: 'string', default: '',
                    help: 'json mode: optional JSON map overriding default keys. E.g. {"setpoint":"target_temp","actual":"temperature"}.'},                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'json mode: dot-notation path to the state JSON object within the MQTT message. Default "payload" reads msg.payload directly.'},                // ── Separate mode — setpoint ───────────────────────────────────
                {name: 'subscribe-setpoint', type: 'mqttTopic', help: 'separate: topic publishing the current setpoint.'},
                {name: 'message-property-setpoint', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the setpoint message. Blank = fall back to element-level message-property.'},
                {name: 'publish-setpoint',   type: 'mqttTopic', help: 'separate: topic to publish a new setpoint to.'},
                // ── Separate mode — actual ─────────────────────────────────────
                {name: 'subscribe-actual', type: 'mqttTopic', help: 'Topic for the actual measured temperature.'},
                {name: 'message-property-actual', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the actual temperature message. Blank = fall back to element-level message-property.'},
                // ── Separate mode — mode ──────────────────────────────────────
                {name: 'subscribe-mode', type: 'mqttTopic', help: 'separate: topic publishing the current operating mode.'},
                {name: 'message-property-mode', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the mode message. Blank = fall back to element-level message-property.'},
                {name: 'publish-mode',   type: 'mqttTopic', help: 'separate: topic to publish the selected mode to.'},
                // ── Separate mode — valve / humidity ──────────────────────────
                {name: 'subscribe-valve',    type: 'mqttTopic', help: 'Optional: valve/position level. Scaled from valve-min…valve-max to 0–100 %. ' +
                    'Wall thermostats and heating groups have no valve of their own — point this at a member TRV or a pre-aggregated topic, and scale it via valve-min/valve-max.'},
                {name: 'message-property-valve', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the valve message. Blank = fall back to element-level message-property.'},
                {name: 'valve-min', type: 'number', default: 0,
                    help: 'E102: valve device range minimum. Homematic BidCoS reports VALVE_STATE 0–100 (leave default); HmIP reports LEVEL 0…1 → set valve-max to 1. Incoming values scale from valve-min…valve-max to 0–100 %.'},
                {name: 'valve-max', type: 'number', default: 100,
                    help: 'E102: valve device range maximum. 100 for BidCoS VALVE_STATE (default), 1 for HmIP LEVEL.'},
                {name: 'subscribe-humidity', type: 'mqttTopic', help: 'Optional: relative humidity percentage (0–100).'},
                {name: 'message-property-humidity', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the humidity message. Blank = fall back to element-level message-property.'},
                // ── Range / unit ──────────────────────────────────────────────
                {name: 'min',  type: 'number', default: 5,    help: 'Minimum setpoint value.'},
                {name: 'max',  type: 'number', default: 30,   help: 'Maximum setpoint value.'},
                {name: 'step', type: 'number', default: 0.5,  help: 'Setpoint snap increment.'},
                {name: 'unit', type: 'string', default: '°C', help: 'Temperature unit label shown on the card.'},
                // ── Mode chips ────────────────────────────────────────────────
                {name: 'modes', type: 'string', default: '',
                    help: 'JSON array of mode entries. Simple: [{"value":"heat","label":"Heat"},…] publishes the value on publish-mode. ' +
                        'E102 per-entry overrides: add "publish"+"payload" to write a specific datapoint — payload is a string OR a JSON ' +
                        'object (published as-is, e.g. to a putParamset topic hm/paramset/<channel>/VALUES with {"CONTROL_MODE":1,"SET_POINT_TEMPERATURE":4.5}). ' +
                        '"$setpoint" in a payload resolves to the last real setpoint (Homematic MANU_MODE=$setpoint; "off" = manual + 4.5). ' +
                        'A "momentary":true entry (boost) is a push button — activate publishes it; deactivate runs "off": {"publish","payload"} ' +
                        '(HmIP BOOST_MODE=false) or "off":"restore" (BidCoS — re-apply the pre-boost mode). ' +
                        'The paramset segment is VALUES, not MASTER — MASTER is device configuration such as week programs, never needed for mode/setpoint control. ' +
                        'Boost is per-generation: HmIP is a BOOST_MODE true/false toggle; BidCoS is a trigger whose deactivate restores the previous mode. ' +
                        'An "off" entry may carry "match-setpoint-max" (e.g. 4.5): when several entries share the same mode read-back value, the entry with match-setpoint-max shows active only while the effective setpoint is <= that number (so "Off" wins over "Manu" at <= 4.5, "Manu" above). ' +
                        'Virtual heating groups need no special setup — HM-CC-VG-1 behaves like a BidCoS TRV and HmIP-HEATING like a wall thermostat: pick the matching generation profile and use the group :1 channel address.'},
                // ── Boost countdown (E102 WP2) ────────────────────────────────
                {name: 'boost-duration', type: 'number', default: 5,
                    help: 'E102 boost countdown: duration in minutes (Homematic default 5). When a momentary (boost) mode goes active and no subscribe-boost-remaining topic is wired, a client-side mm:ss countdown starts from this value. A page reload while boost is active (without the device topic) restarts the client timer from full — accepted degradation.'},
                {name: 'subscribe-boost-remaining', type: 'mqttTopic',
                    help: 'E102 boost countdown: optional device-reported remaining time. When wired, the active boost badge shows this live value (converted to seconds via boost-remaining-unit) instead of the client timer.'},
                {name: 'message-property-boost-remaining', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the boost-remaining message. Blank = fall back to element-level message-property.'},
                {name: 'boost-remaining-unit', type: 'select', options: ['minutes', 'seconds'], default: 'minutes',
                    help: 'E102 boost countdown: unit of the subscribe-boost-remaining value. BidCoS BOOST_STATE reports minutes; HmIP unit is device-dependent and verify-gated.'},
                // ── Boost active state (B54) ──────────────────────────────────
                {name: 'subscribe-boost-state', type: 'mqttTopic',
                    help: 'B54: optional device-reported boost active state (Homematic BOOST_MODE, true/false). While truthy, the momentary (boost) mode entry is shown active regardless of the mode read-back — HmIP SET_POINT_MODE keeps reporting Manu during boost. Also makes boost started at the wall dial visible.'},
                {name: 'message-property-boost-state', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the boost-state message. Blank = fall back to element-level message-property.'},
                // ── Display ───────────────────────────────────────────────────
                {name: 'label', type: 'string', default: '', help: 'Optional card title shown at the bottom.'},
                // ── Availability ──────────────────────────────────────────────
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Optional availability topic. A badge appears when unavailable; controls stay enabled.'},
                {name: 'message-property-availability', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the availability message. Blank = fall back to element-level message-property.'},
                {name: 'payload-available',      type: 'string', default: 'online',  help: 'Payload meaning the device is online.'},
                {name: 'payload-unavailable',    type: 'string', default: 'offline', help: 'Payload meaning the device is offline.'},
                // ── Discovery linkage ─────────────────────────────────────────
                {name: 'discovery-id', type: 'string', default: '', help: 'Linked auto-discovery entity id (set automatically by N12).'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                // Theme-aware colour tokens. Leave blank to inherit from theme.
                {property: '--feezal-climate-heat-color', type: 'color',
                    default: 'var(--accent-color, #ff7043)',
                    help: 'Arc fill, handle and mode-chip active colour when heating.'},
                {property: '--feezal-climate-cool-color', type: 'color',
                    default: 'var(--info-color, #29b6f6)',
                    help: 'Arc fill colour when cooling.'},
                {property: '--feezal-climate-idle-color', type: 'color',
                    default: 'var(--secondary-text-color, #aaa)',
                    help: 'Background track and off/idle arc colour.'},
                {property: '--feezal-climate-text-color', type: 'color',
                    default: 'var(--primary-text-color, #212121)',
                    help: 'Temperature text, chip text, and icon colour.'},
                {property: '--feezal-climate-error-color', type: 'color',
                    default: 'var(--error-color, #b00020)',
                    help: 'Unavailability badge colour.'},
                // B29 — arc geometry, unitless % of the slider viewBox; the same
                // numbers on material-light give an identical-looking slider.
                {property: '--feezal-climate-track-width', default: '7',
                    help: 'Setpoint-arc track width — unitless, in % of the circle viewBox (default 7). Same scale as --feezal-light-track-width.'},
                {property: '--feezal-climate-knob-size', default: '10',
                    help: 'Drag-knob diameter — unitless, in % of the circle viewBox (default 10). Same scale as --feezal-light-knob-size.'},
            ],
            restrict:     {minWidth: 160, minHeight: 200},
            defaultStyle: {width: '180px', height: '220px'},
        };
    }

    static properties = {
        payloadMode:           {type: String,  reflect: true, attribute: 'payload-mode'},
        subscribe:             {type: String,  reflect: true},
        publish:               {type: String,  reflect: true},
        jsonMap:               {type: String,  reflect: true, attribute: 'json-map'},
        subscribeSetpoint:     {type: String,  reflect: true, attribute: 'subscribe-setpoint'},
        publishSetpoint:       {type: String,  reflect: true, attribute: 'publish-setpoint'},
        subscribeActual:       {type: String,  reflect: true, attribute: 'subscribe-actual'},
        subscribeMode:         {type: String,  reflect: true, attribute: 'subscribe-mode'},
        publishMode:           {type: String,  reflect: true, attribute: 'publish-mode'},
        subscribeValve:        {type: String,  reflect: true, attribute: 'subscribe-valve'},
        valveMin:              {type: Number,  reflect: true, attribute: 'valve-min'},
        valveMax:              {type: Number,  reflect: true, attribute: 'valve-max'},
        boostDuration:           {type: Number, reflect: true, attribute: 'boost-duration'},
        subscribeBoostRemaining: {type: String, reflect: true, attribute: 'subscribe-boost-remaining'},
        msgPropBoostRemaining:   {type: String, reflect: true, attribute: 'message-property-boost-remaining'},
        boostRemainingUnit:      {type: String, reflect: true, attribute: 'boost-remaining-unit'},
        subscribeBoostState:     {type: String, reflect: true, attribute: 'subscribe-boost-state'},
        msgPropBoostState:       {type: String, reflect: true, attribute: 'message-property-boost-state'},
        subscribeHumidity:     {type: String,  reflect: true, attribute: 'subscribe-humidity'},
        // N31: availability inherited from FeezalElement.
        min:                   {type: Number,  reflect: true},
        max:                   {type: Number,  reflect: true},
        step:                  {type: Number,  reflect: true},
        unit:                  {type: String,  reflect: true},
        modes:                 {type: String,  reflect: true},
        label:                 {type: String,  reflect: true},
        discoveryId:           {type: String,  reflect: true, attribute: 'discovery-id'},
        msgPropSetpoint:       {type: String,  reflect: true, attribute: 'message-property-setpoint'},
        msgPropActual:         {type: String,  reflect: true, attribute: 'message-property-actual'},
        msgPropMode:           {type: String,  reflect: true, attribute: 'message-property-mode'},
        msgPropValve:          {type: String,  reflect: true, attribute: 'message-property-valve'},
        msgPropHumidity:       {type: String,  reflect: true, attribute: 'message-property-humidity'},
        // Internal state — never as class fields (Lit 3 rule)
        _setpoint:   {state: true},   // null | number
        _actual:     {state: true},   // null | number
        _mode:       {state: true},   // null | string
        _valve:      {state: true},   // null | number (0–100)
        _humidity:   {state: true},   // null | number
        _dragSpan:   {state: true},   // null | number — live arc span during drag
        _momentaryActive: {state: true},   // E102: active momentary (boost) entry value
        _boostRemaining:  {state: true},   // E102 WP2: boost remaining seconds (null when inactive)
        _boostForced:     {state: true},   // B54: device-reported boost state overrides the mode read-back
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 8px;
            box-sizing: border-box;
            overflow: hidden;
            gap: 4px;
            position: relative;

            /* ── Theme-aware colour tokens ────────────────────────────────────
               Override per-element via the Style inspector or a theme rule.  */
            --feezal-climate-heat-color:  var(--accent-color,         var(--feezal-accent,  #ff7043));
            --feezal-climate-cool-color:  var(--info-color,           var(--feezal-info,    #29b6f6));
            --feezal-climate-idle-color:  var(--secondary-text-color, var(--feezal-color2,  #aaa));
            --feezal-climate-text-color:  var(--primary-text-color,   var(--feezal-color,   #212121));
            --feezal-climate-error-color: var(--error-color, #b00020);

            /* MD3 bridge — filter-chips follow the thermostat theme */
            --md-sys-color-on-surface-variant: var(--feezal-climate-idle-color);
            --md-filter-chip-outline-color:    var(--feezal-climate-idle-color);
            --md-filter-chip-label-text-color: var(--feezal-climate-text-color);
            --md-filter-chip-selected-container-color:   var(--feezal-climate-heat-color);
            --md-filter-chip-selected-label-text-color:  #fff;
            --md-sys-color-primary: var(--feezal-climate-heat-color);
        }
        .unavail {
            position: absolute;
            top: 6px; right: 6px;
            width: 18px; height: 18px;
            color: var(--feezal-climate-error-color);
            opacity: 0.8; pointer-events: none; z-index: 2;
        }
        .unavail svg { width: 100%; height: 100%; display: block; }
        /* B37: width-driven, top-anchored — the exact material-light ring
           pattern (.ring-wrap / aspect-ratio:1). Same-size cards side by side
           get identical circle position AND size; rows below (chips, valve,
           humidity, label) stack under the arc and clip on too-short cards,
           exactly like the light card's controls do. */
        .arc-wrap {
            width: 100%;
            flex-shrink: 0;
        }
        svg.arc {
            width: 100%;
            aspect-ratio: 1;
            overflow: visible;
            touch-action: none;
            user-select: none;
            display: block;
            cursor: crosshair;
        }
        .mode-row {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            justify-content: center;
            width: 100%;
        }
        md-filter-chip {
            --md-filter-chip-container-height: 24px;
            --md-filter-chip-label-text-size: 11px;
        }
        .valve-row {
            width: 90%;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .valve-label {
            font-size: 10px;
            opacity: 0.6;
            white-space: nowrap;
            color: var(--feezal-climate-text-color);
        }
        .valve-bar {
            flex: 1;
            height: 4px;
            background: var(--feezal-climate-idle-color);
            border-radius: 2px;
            overflow: hidden;
        }
        .valve-fill {
            height: 100%;
            border-radius: 2px;
            background: var(--feezal-climate-heat-color);
            transition: width 0.4s;
        }
        .hum-row {
            font-size: 11px;
            opacity: 0.65;
            color: var(--feezal-climate-text-color);
        }
        .label {
            font-size: 11px;
            opacity: 0.65;
            text-align: center;
            color: var(--feezal-climate-text-color);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 100%;
        }
    `];

    constructor() {
        super();
        this.payloadMode           = 'separate';
        this.subscribe             = '';
        this.publish               = '';
        this.jsonMap               = '';
        this.subscribeSetpoint     = '';
        this.publishSetpoint       = '';
        this.subscribeActual       = '';
        this.subscribeMode         = '';
        this.publishMode           = '';
        this.subscribeValve        = '';
        this.valveMin              = 0;
        this.valveMax              = 100;
        this.boostDuration           = 5;
        this.subscribeBoostRemaining = '';
        this.msgPropBoostRemaining   = '';
        this.boostRemainingUnit      = 'minutes';
        this.subscribeBoostState     = '';
        this.msgPropBoostState       = '';
        this.subscribeHumidity     = '';
        this.min                   = 5;
        this.max                   = 30;
        this.step                  = 0.5;
        this.unit                  = '°C';
        this.modes                 = '';
        this.label                 = '';
        this.discoveryId           = '';
        this.msgPropSetpoint       = '';
        this.msgPropActual         = '';
        this.msgPropMode           = '';
        this.msgPropValve          = '';
        this.msgPropHumidity       = '';
        this._setpoint             = null;
        this._actual               = null;
        this._mode                 = null;
        this._valve                = null;
        this._humidity             = null;
        this._dragSpan             = null;
        // E102 — mode-entry machinery
        this._lastRealSetpoint     = null;   // remembered setpoint > off sentinel (for $setpoint)
        this._preBoostMode         = null;   // mode before a momentary/boost entry (for off:"restore")
        this._momentaryActive      = null;   // value of the currently-active momentary entry
        // E102 WP2 — boost countdown
        this._boostRemaining       = null;   // remaining seconds while boost active (null = inactive)
        this._boostTimer           = null;   // non-reactive setInterval handle
        // B54 — device-reported boost state
        this._boostForced          = false;  // subscribe-boost-state read truthy
    }

    // The thermostat manages all subscriptions itself.
    _subscribe() { /* intentionally empty */ }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopBoostCountdown();   // E102 WP2: never leak the interval
    }

    connectedCallback() {
        super.connectedCallback();

        // N31: availability subscription handled by the FeezalElement base.

        // E102 WP2: device-reported boost remaining time (both payload modes).
        if (this.subscribeBoostRemaining) {
            this.addSubscription(this.subscribeBoostRemaining, msg => {
                const v = Number(this.getProperty(msg, this.msgPropBoostRemaining || this.messageProperty));
                if (!isNaN(v)) this._applyBoostRemaining(v);
            });
        }
        // B54: device-reported boost active state (both payload modes).
        if (this.subscribeBoostState) {
            this.addSubscription(this.subscribeBoostState, msg => {
                this._applyBoostState(this.getProperty(msg, this.msgPropBoostState || this.messageProperty));
            });
        }

        if (this.payloadMode === 'json') {
            if (this.subscribe) {
                this.addSubscription(this.subscribe, msg => {
                    let obj = this.getProperty(msg, this.messageProperty);
                    if (typeof obj === 'string') {
                        try { obj = JSON.parse(obj); } catch { return; }
                    }
                    if (obj && typeof obj === 'object') this._applyJsonState(obj);
                });
            }
            return;
        }

        // ── Separate mode ──────────────────────────────────────────────────────
        if (this.subscribeSetpoint) {
            this.addSubscription(this.subscribeSetpoint, msg => {
                const v = Number(this.getProperty(msg, this.msgPropSetpoint || this.messageProperty));
                if (!isNaN(v)) { this._setpoint = v; if (v > 4.5) this._lastRealSetpoint = v; }   // E102: remember real setpoint for $setpoint
            });
        }
        if (this.subscribeActual) {
            this.addSubscription(this.subscribeActual, msg => {
                const v = Number(this.getProperty(msg, this.msgPropActual || this.messageProperty));
                if (!isNaN(v)) this._actual = v;
            });
        }
        if (this.subscribeMode) {
            this.addSubscription(this.subscribeMode, msg => {
                this._applyModeReadback(String(this.getProperty(msg, this.msgPropMode || this.messageProperty)));
            });
        }
        if (this.subscribeValve) {
            this.addSubscription(this.subscribeValve, msg => {
                const v = Number(this.getProperty(msg, this.msgPropValve || this.messageProperty));
                if (!isNaN(v)) this._valve = this._scaleValve(v);
            });
        }
        if (this.subscribeHumidity) {
            this.addSubscription(this.subscribeHumidity, msg => {
                const v = Number(this.getProperty(msg, this.msgPropHumidity || this.messageProperty));
                if (!isNaN(v)) this._humidity = Math.max(0, Math.min(100, v));
            });
        }
    }

    /**
     * E102: scale an incoming valve value from the device range
     * [valve-min, valve-max] to 0–100 %. Defaults 0/100 → unchanged (BidCoS
     * VALVE_STATE); set valve-max=1 for HmIP LEVEL (0…1). Guards a zero span.
     */
    _scaleValve(v) {
        const lo = Number(this.valveMin), hi = Number(this.valveMax);
        const pct = (hi === lo) ? v : ((v - lo) / (hi - lo)) * 100;
        return Math.max(0, Math.min(100, pct));
    }

    // ─── JSON payload mode ────────────────────────────────────────────────────
    get _jsonMap() {
        const defaults = {
            setpoint: 'current_heating_setpoint',
            actual:   'local_temperature',
            mode:     'system_mode',
            valve:    'position',
            humidity: 'humidity',
        };
        if (this.jsonMap) {
            try { return {...defaults, ...JSON.parse(this.jsonMap)}; } catch { /* fall through */ }
        }
        return defaults;
    }

    _applyJsonState(obj) {
        const map = this._jsonMap;
        const get = key => this.getProperty(obj, key);
        const sp = Number(get(map.setpoint));
        if (!isNaN(sp)) { this._setpoint = sp; if (sp > 4.5) this._lastRealSetpoint = sp; }   // E102
        const ac = Number(get(map.actual));
        if (!isNaN(ac)) this._actual = ac;
        const mode = get(map.mode);
        if (mode !== null && mode !== undefined) this._applyModeReadback(String(mode));
        const valve = Number(get(map.valve));
        if (!isNaN(valve)) this._valve = this._scaleValve(valve);
        const hum = Number(get(map.humidity));
        if (!isNaN(hum)) this._humidity = Math.max(0, Math.min(100, hum));
    }

    // ─── Publish helpers ──────────────────────────────────────────────────────
    _pub(topic, value, jsonObj) {
        if (this.payloadMode === 'json') {
            if (this.publish) feezal.connection.pub(this.publish, JSON.stringify(jsonObj));
        } else if (topic) {
            feezal.connection.pub(topic, String(value));
        }
    }

    /**
     * E102 — publish a per-mode-entry override to an explicit topic. `payload`
     * may be a string OR a JSON object (published as-is → the bridge's
     * putParamset topic, e.g. hm/paramset/<channel>/VALUES with
     * {CONTROL_MODE:1, SET_POINT_TEMPERATURE:4.5}). String values (also inside
     * object values) support the `$setpoint` placeholder → the remembered last
     * real setpoint (covers Homematic MANU_MODE=<temp>).
     */
    _pubEntry(topic, payload) {
        if (feezal.isEditor || !topic) return;
        const resolved = this._resolveModePayload(payload);
        feezal.connection.pub(topic,
            (resolved !== null && typeof resolved === 'object') ? JSON.stringify(resolved) : String(resolved ?? ''));
    }

    /** E102 — recursively substitute `$setpoint` in a string / object payload.
     * B58: type-preserving — a value that IS the bare sentinel becomes the
     * numeric setpoint (hm2mqtt putParamset silently drops FLOAT params sent as
     * JSON strings); the string replace only serves embedded occurrences. */
    _resolveModePayload(payload) {
        const sp = Number(this._lastRealSetpoint ?? this._setpoint ?? this.min);
        const sub = v => v === '$setpoint' ? sp
            : (typeof v === 'string' ? v.replace(/\$setpoint/g, String(sp)) : v);
        if (payload !== null && typeof payload === 'object') {
            const out = Array.isArray(payload) ? [] : {};
            for (const [k, val] of Object.entries(payload)) {
                out[k] = (val !== null && typeof val === 'object') ? this._resolveModePayload(val) : sub(val);
            }
            return out;
        }
        return sub(payload);
    }

    _setSetpoint(temp) {
        const clamped = +(Math.min(this.max, Math.max(this.min, Math.round(temp / this.step) * this.step))).toFixed(2);
        this._setpoint  = clamped;
        if (clamped > 4.5) this._lastRealSetpoint = clamped;   // E102: $setpoint memory
        this._dragSpan  = null;
        this._pub(this.publishSetpoint, clamped, {[this._jsonMap.setpoint]: clamped});
    }

    /**
     * E102 — apply a mode entry. Plain entries publish the mode value (default
     * publish-mode / json write, unchanged). Entries with a per-entry `publish`
     * write their `payload` (string or object, `$setpoint`-resolved) to that
     * topic instead — covers Homematic's per-mode action datapoints
     * (AUTO_MODE=true, MANU_MODE=$setpoint) and the HmIP combined putParamset
     * write. A `momentary` entry (boost) toggles with its own off-strategy.
     */
    _setMode(entry) {
        if (feezal.isEditor) return;
        // Back-compat: callers may still pass a bare string value.
        if (typeof entry === 'string') entry = {value: entry};

        if (entry.momentary) { this._toggleMomentary(entry); return; }

        this._mode = entry.value;
        if (entry.publish) {
            this._pubEntry(entry.publish, entry.payload ?? entry.value);
        } else {
            this._pub(this.publishMode, entry.value, {[this._jsonMap.mode]: entry.value});
        }
    }

    /**
     * E102 — momentary mode (boost). Activate publishes the entry; deactivate
     * runs its off-strategy: `off: {publish, payload}` (HmIP BOOST_MODE=false)
     * or `off: "restore"` (BidCoS — re-apply the pre-boost mode via the same
     * per-entry machinery; the pre-boost mode is client-remembered, so a reload
     * during boost degrades gracefully to "restore = the current read-back").
     */
    _toggleMomentary(entry) {
        const active = this._boostForced || this._momentaryActive === entry.value || this._mode === entry.value;
        if (active) {
            this._momentaryActive = null;
            this._boostForced = false;   // B54: tap-off — the device read-back will confirm
            this._clearBoost();   // E102 WP2: tap-off clears the badge/timer
            if (entry.off === 'restore') {
                const prev = this._preBoostMode;
                const prevEntry = this._parsedModes().find(m => m.value === prev && !m.momentary);
                if (prevEntry) this._setMode(prevEntry);
                else if (prev != null) this._pub(this.publishMode, prev, {[this._jsonMap.mode]: prev});
            } else if (entry.off && entry.off.publish) {
                this._pubEntry(entry.off.publish, entry.off.payload);
            }
        } else {
            this._preBoostMode = this._mode;
            this._momentaryActive = entry.value;
            if (entry.publish) this._pubEntry(entry.publish, entry.payload ?? entry.value);
            else this._pub(this.publishMode, entry.value, {[this._jsonMap.mode]: entry.value});
            this._startBoostCountdown();   // E102 WP2
        }
    }

    // ─── E102 WP2 — boost countdown badge ─────────────────────────────────────
    /**
     * Route a mode read-back: update _mode and, if the read-back no longer
     * matches the active boost value, clear the boost badge/timer (deactivation
     * via read-back change, as opposed to an explicit tap-off).
     */
    _applyModeReadback(v) {
        this._mode = v;
        // B54: while the device reports boost active, the mode read-back must
        // not clear it — HmIP SET_POINT_MODE keeps reporting Manu during boost.
        if (!this._boostForced && this._momentaryActive !== null && String(v) !== String(this._momentaryActive)) {
            this._momentaryActive = null;
            this._clearBoost();
        }
    }

    /**
     * B54 — device-reported boost active state (hm BOOST_MODE true/false).
     * Truthy forces the momentary entry active regardless of the mode read-back
     * and starts the countdown (covers boost begun at the wall dial and a page
     * reload mid-boost); falsy returns the display to the mode-derived state.
     */
    _applyBoostState(raw) {
        const active = raw === true || raw === 1
            || String(raw).toLowerCase() === 'true' || String(raw) === '1';
        if (active && !this._boostForced) {
            this._boostForced = true;
            if (this._boostRemaining === null) this._startBoostCountdown();
        } else if (!active && this._boostForced) {
            this._boostForced = false;
            this._momentaryActive = null;
            this._clearBoost();
        }
    }

    /** Device-reported remaining time → seconds (via boost-remaining-unit). */
    _applyBoostRemaining(v) {
        const secs = this.boostRemainingUnit === 'seconds' ? Math.round(v) : Math.round(v * 60);
        this._boostRemaining = Math.max(0, secs);
    }

    /**
     * Start the boost badge. When a subscribe-boost-remaining topic is wired the
     * device drives the value (leave it alone); otherwise run a client-side
     * per-second countdown from boost-duration (minutes → seconds).
     */
    _startBoostCountdown() {
        this._stopBoostCountdown();
        if (this.subscribeBoostRemaining) return;   // device topic drives the badge
        const mins = Number(this.boostDuration);
        const secs = (isNaN(mins) ? 0 : mins) * 60;
        if (secs <= 0) { this._boostRemaining = null; return; }
        this._boostRemaining = secs;
        this._boostTimer = setInterval(() => {
            const next = (this._boostRemaining ?? 0) - 1;
            if (next <= 0) { this._boostRemaining = 0; this._stopBoostCountdown(); }
            else this._boostRemaining = next;
        }, 1000);
    }

    _stopBoostCountdown() {
        if (this._boostTimer) { clearInterval(this._boostTimer); this._boostTimer = null; }
    }

    /** Clear the badge + timer (deactivation / read-back change). */
    _clearBoost() {
        this._stopBoostCountdown();
        this._boostRemaining = null;
    }

    /** Format the remaining seconds as an mm:ss badge ('' when inactive). */
    _boostBadge() {
        const s = this._boostRemaining;
        if (s === null || s === undefined || s < 0) return '';
        const mm = Math.floor(s / 60);
        const ss = s % 60;
        return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }

    // ─── Arc interaction ──────────────────────────────────────────────────────
    _onArcPointerDown(e) {
        if (feezal.isEditor) return;
        const svgEl = e.currentTarget;
        svgEl.setPointerCapture(e.pointerId);

        const move = ev => {
            const pt = new DOMPoint(ev.clientX, ev.clientY);
            const sp = pt.matrixTransform(svgEl.getScreenCTM().inverse());
            const dx = sp.x - ARC_CX, dy = sp.y - ARC_CY;
            // SVG angle: 0° = right; convert to 0° = top, clockwise
            let deg = Math.atan2(dy, dx) * 180 / Math.PI + 90;
            if (deg < 0) deg += 360;
            const temp  = tAngleToTemp(deg, this.min, this.max, this.step);
            const clamped = Math.min(this.max, Math.max(this.min, temp));
            this._dragSpan = tTempToSpan(clamped, this.min, this.max);
        };

        const up = () => {
            svgEl.removeEventListener('pointermove', move);
            svgEl.removeEventListener('pointerup', up);
            if (this._dragSpan !== null) {
                const frac = this._dragSpan / ARC_SPAN;
                this._setSetpoint(this.min + frac * (this.max - this.min));
            }
        };

        svgEl.addEventListener('pointermove', move);
        svgEl.addEventListener('pointerup', up);
        move(e); // immediate feedback on mousedown
    }

    // ─── Arc fill color based on mode ─────────────────────────────────────────
    get _arcFillColor() {
        const mode = this._mode;
        if (!mode || mode === 'heat' || mode === 'emergency_heat') return 'var(--feezal-climate-heat-color)';
        if (mode === 'cool') return 'var(--feezal-climate-cool-color)';
        if (mode === 'off') return 'var(--feezal-climate-idle-color)';
        return 'var(--feezal-climate-heat-color)'; // auto, fan_only, etc.
    }

    // ─── SVG rendering ────────────────────────────────────────────────────────
    _renderArc() {
        const editorSetpoint = (this.min + this.max) / 2 + this.step * 3; // e.g. 17.5 + 1.5 = 19
        const setpoint  = this._setpoint ?? null;
        const actual    = this._actual;
        const fillColor = this._arcFillColor;
        // B53: off-by-setpoint sentinel active (and not mid-drag) → park the
        // arc and show the mode label instead of the 4.5° target.
        const offEntry  = this._dragSpan === null ? this._offSentinelEntry() : null;

        // Current arc span (drag preview or committed)
        const spanDeg   = this._dragSpan ??
            (offEntry ? 0 : (setpoint !== null ? tTempToSpan(setpoint, this.min, this.max) : 0));

        // Actual temperature indicator on the track (if present and different from setpoint)
        const actualSpan = actual !== null ? tTempToSpan(actual, this.min, this.max) : null;

        // Background full arc
        const bgPath   = tArcPath(ARC_START, ARC_SPAN);

        // Filled setpoint arc
        const fillPath = spanDeg > 0 ? tArcPath(ARC_START, spanDeg) : null;

        // Handle position
        const handleAngle = (ARC_START + spanDeg) % 360;
        const [hx, hy]    = tPolarXY(handleAngle);

        // Actual temperature tick mark on the track
        let actualTick = null;
        if (actualSpan !== null) {
            const tickAngle = (ARC_START + actualSpan) % 360;
            const [tx, ty] = tPolarXY(tickAngle, ARC_R);
            const [tx2, ty2] = tPolarXY(tickAngle, ARC_R - ARC_W - 2);
            actualTick = svg`<line x1="${tx}" y1="${ty}" x2="${tx2}" y2="${ty2}"
                stroke="var(--feezal-climate-text-color)" stroke-width="2"
                stroke-opacity="0.5" stroke-linecap="round"/>`;
        }

        // Valve inner arc
        let valveArc = null;
        if (this._valve !== null) {
            const vSpan    = (this._valve / 100) * ARC_SPAN;
            const valvePath = tArcPath(ARC_START, vSpan, VALVE_R);
            valveArc = svg`
                <path d="${tArcPath(ARC_START, ARC_SPAN, VALVE_R)}" fill="none"
                    stroke="var(--feezal-climate-idle-color)" stroke-opacity="0.3"
                    stroke-width="${VALVE_W}" stroke-linecap="round"/>
                ${vSpan > 0 ? svg`<path d="${valvePath}" fill="none"
                    stroke="${fillColor}" stroke-opacity="0.5"
                    stroke-width="${VALVE_W}" stroke-linecap="round"/>` : svg``}`;
        }

        // Centre text \u2014 B53: while the off sentinel is active the setpoint line
        // shows the mode label ("Off") instead of the 4.5\u00b0 target.
        const spLine     = offEntry ? (offEntry.label ?? offEntry.value)
            : (setpoint !== null ? '\u2192\u00a0' + fmtTemp(setpoint, this.unit) : '');
        const dispActual = actual !== null ? fmtTemp(actual, this.unit) : '\u2014';

        return svg`
            <!-- Background track (B29: width configurable, unitless % of viewBox; ×2 = this viewBox scale) -->
            <path d="${bgPath}" fill="none"
                stroke="var(--feezal-climate-idle-color)" stroke-opacity="0.25"
                stroke-width="${ARC_W}" stroke-linecap="round"
                style="stroke-width: calc(var(--feezal-climate-track-width, 7) * 2px)"/>

            <!-- Valve inner arc -->
            ${valveArc ?? svg``}

            <!-- Setpoint fill arc -->
            ${fillPath ? svg`
                <path d="${fillPath}" fill="none"
                    stroke="${fillColor}"
                    stroke-width="${ARC_W}" stroke-linecap="round"
                    style="stroke-width: calc(var(--feezal-climate-track-width, 7) * 2px)"/>
            ` : svg``}

            <!-- Actual temperature tick on track -->
            ${actualTick ?? svg``}

            <!-- Drag handle (B29: diameter configurable, matches light's knob) -->
            <circle cx="${hx}" cy="${hy}" r="10"
                fill="${fillColor}" stroke="var(--feezal-climate-text-color)"
                stroke-opacity="0.3" stroke-width="1.5"
                style="cursor:grab; r: calc(var(--feezal-climate-knob-size, 10) * 1px)"/>

            <!-- Actual temperature — large, centred -->
            <text x="${ARC_CX}" y="${ARC_CY + 8}"
                text-anchor="middle" dominant-baseline="middle"
                font-size="22" font-weight="600"
                fill="var(--feezal-climate-text-color)"
                style="font-family:inherit">${dispActual}</text>

            <!-- Setpoint label below actual (B53: mode label while Off) -->
            ${spLine ? svg`
                <text x="${ARC_CX}" y="${ARC_CY + 30}"
                    text-anchor="middle" dominant-baseline="middle"
                    font-size="11" fill="var(--feezal-climate-text-color)"
                    fill-opacity="0.6" style="font-family:inherit">
                    ${spLine}
                </text>
            ` : svg``}
        `;
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    _parsedModes() {
        if (!this.modes) return [];
        let arr;
        try { arr = JSON.parse(this.modes); } catch { return []; }
        if (!Array.isArray(arr)) return [];
        // Support both [{value,label},...] objects (hand-wired) and plain
        // string arrays emitted by HA/zigbee2mqtt discovery.
        // B55: drop empty/invalid entries WITHOUT a truthiness test — Homematic
        // Auto is {value: 0} and must survive (same filter in glass/metro).
        return arr.map(m => typeof m === 'string'
            ? {value: m, label: m.charAt(0).toUpperCase() + m.slice(1).replace(/_/g, ' ')}
            : m)
            .filter(m => m && m.value !== null && m.value !== undefined && m.value !== '');
    }

    /**
     * E102 — pick the single active (non-momentary) mode entry for the current
     * mode read-back and effective setpoint. An entry is a candidate when its
     * value matches the read-back AND (its `match-setpoint-max` is undefined, or
     * the effective setpoint <= that max). A candidate carrying match-setpoint-max
     * wins over one without (more specific — so an "Off" entry sharing its value
     * with "Manu" shows active only while sp <= its max); otherwise the first
     * match wins (today's order). Returns null when nothing matches. Backwards
     * compatible: entries without match-setpoint-max behave exactly as before.
     */
    _activeModeEntry(list) {
        const v = this._mode;
        if (v === null || v === undefined || v === '') return null;
        // B53: compare against the CURRENT setpoint — preferring the remembered
        // real one meant a device switched Off (read-back 4.5) after running at
        // 21° never matched the Off sentinel (21 <= 4.5 is false).
        const sp = this._setpoint ?? this._lastRealSetpoint;
        const capOk = m => {
            const cap = m['match-setpoint-max'];
            if (cap === null || cap === undefined) return true;
            return sp !== null && sp !== undefined && Number(sp) <= Number(cap);
        };
        const candidates = list.filter(m => !m.momentary && String(m.value) === String(v) && capOk(m));
        if (candidates.length === 0) return null;
        return candidates.find(m => {
            const cap = m['match-setpoint-max'];
            return cap !== null && cap !== undefined;
        }) ?? candidates[0];
    }

    /**
     * B53 — the active entry when it is an off-by-setpoint sentinel (carries
     * `match-setpoint-max`, e.g. Homematic "Off" = Manu @ 4.5°); null otherwise.
     * While active, the target-temperature display is suppressed (mode label
     * instead of "→ 4.5°", parked arc) — the actual temperature stays visible.
     */
    _offSentinelEntry() {
        const e = this._activeModeEntry(this._parsedModes());
        return (e && e['match-setpoint-max'] !== null && e['match-setpoint-max'] !== undefined) ? e : null;
    }

    render() {
        const showUnavail = this.subscribeAvailability && !this._available;
        const modeList    = this._parsedModes();
        const showModes   = modeList.length > 0;
        const showValve   = this._valve !== null;
        const showHum     = this._humidity !== null;
        const activeMode  = this._activeModeEntry(modeList);   // E102: match-setpoint-max-aware active chip

        return html`
            ${showUnavail ? html`
                <div class="unavail" title="Device unavailable">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 8.98C20.93 5.9 16.69 4 12 4c-1.69 0-3.32.25-4.86.71l2.5 2.5c.77-.14 1.55-.21 2.36-.21 3.42 0 6.7 1.21 9.32 3.42L24 8.98zM2.81 2.81L1.39 4.22l2.05 2.05C2.2 6.92 1.05 7.86 0 8.98l1.68 1.43c.93-.78 1.94-1.45 3.01-2L6.4 9.83c-1.2.55-2.31 1.3-3.28 2.21L4.81 13.46C5.96 12.38 7.4 11.62 9 11.27l2.16 2.16c-1.3.18-2.5.74-3.46 1.59L12 19.51l1.94-1.94 5.84 5.84 1.41-1.41L2.81 2.81zM12 16.5l-1.41-1.41L12 13.68c.5 0 .96.06 1.42.13l1.71 1.71c-.99-.65-2.18-1.02-3.13-1.02z"/>
                    </svg>
                </div>
            ` : ''}

            <div class="arc-wrap">
                <svg class="arc" viewBox="0 0 200 200"
                    @pointerdown="${this._onArcPointerDown}">
                    ${this._renderArc()}
                </svg>
            </div>

            ${showModes ? html`
                <div class="mode-row">
                    ${modeList.map(m => {
                        // B54: _boostForced (device-reported BOOST_MODE) wins over the mode read-back.
                        const boostActive = m.momentary && (this._boostForced || this._momentaryActive === m.value || this._mode === m.value);
                        const badge = boostActive ? this._boostBadge() : '';
                        return html`
                            <md-filter-chip
                                label="${(m.label ?? m.value)}${badge ? ' ' + badge : ''}"
                                ?selected="${m.momentary ? boostActive : m === activeMode}"
                                @click="${() => this._setMode(m)}">
                            </md-filter-chip>`;
                    })}
                </div>
            ` : ''}

            ${showValve ? html`
                <div class="valve-row">
                    <span class="valve-label">Valve</span>
                    <div class="valve-bar">
                        <div class="valve-fill" style="width:${this._valve}%"></div>
                    </div>
                    <span class="valve-label">${Math.round(this._valve)}&nbsp;%</span>
                </div>
            ` : ''}

            ${showHum ? html`
                <div class="hum-row">&#x1F4A7;&nbsp;${Math.round(this._humidity)}&nbsp;%</div>
            ` : ''}

            ${this.label ? html`<div class="label">${this.label}</div>` : ''}
        `;
    }
}

customElements.define('feezal-element-material-climate', FeezalElementMaterialClimate);
export {FeezalElementMaterialClimate};

// ─── N6 Custom Inspector ──────────────────────────────────────────────────────
// Two-tab inspector (Topics + Config).
// Topics tab: json mode → State & Control + Availability toggle.
//             separate mode → Setpoint/Actual (always-on) + capability-gated
//             Mode, Valve, Humidity, Availability sections.
// Config tab: Payload mode, temperature range/step/unit, modes JSON builder, label.

const CLIMATE_SECTIONS = [
    // Separate-mode capability-gated sections
    {id: 'mode', title: 'Mode', topics: [
        {attr: 'subscribe-mode', label: 'Subscribe (current mode)'},
        {attr: 'publish-mode',   label: 'Publish (set mode)'},
    ]},
    {id: 'valve', title: 'Valve / Position', topics: [
        {attr: 'subscribe-valve', label: 'Subscribe (0\u2013100\u00a0%)'},
    ]},
    {id: 'humidity', title: 'Humidity', topics: [
        {attr: 'subscribe-humidity', label: 'Subscribe (0\u2013100\u00a0%)'},
    ]},
    {id: 'availability', title: 'Availability', topics: [
        {attr: 'subscribe-availability', label: 'Subscribe'},
    ]},
];

const JSON_CAPABILITIES = [
    // In JSON mode, mode/valve/humidity are read from the main subscribe topic.
    // The only dedicated section is Availability (always a separate topic).
    {id: 'availability', title: 'Availability', topics: [
        {attr: 'subscribe-availability', label: 'Subscribe'},
    ]},
];

class FeezalElementMaterialClimateInspector extends LitElement {
    static properties = {
        element: {attribute: false},
        _tab:    {state: true},
        _open:   {state: true},
    };

    static styles = css`
        :host { display: block; font-size: 12px; color: var(--feezal-color, #333); }
        sl-tab-panel::part(base) { padding: 8px 2px; }
        .section { border: 1px solid var(--feezal-border, #e0e0e0); border-radius: 6px; margin-bottom: 8px; }
        .sec-head {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 8px; font-weight: 600;
            background: var(--feezal-bg-sub, #f5f5f5);
            border-radius: 6px 6px 0 0;
        }
        .sec-head.collapsed { border-radius: 6px; }
        .sec-title { flex: 1; }
        .sec-body { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
        .field { display: flex; flex-direction: column; gap: 2px; }
        .field > label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; }
        sl-input, sl-select { width: 100%; }
        /* Match the standard inspector Shoelace theming */
        sl-input::part(form-control-label), sl-select::part(form-control-label) {
            color: var(--sl-input-label-color, inherit); font-size: 12px;
        }
        sl-input::part(base), sl-select::part(combobox) {
            background: var(--feezal-bg, #fff);
            border-color: var(--feezal-border, #ccc);
            color: var(--feezal-color, #333);
        }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        sl-switch { color: var(--feezal-color, inherit); }
        .row { display: flex; gap: 6px; }
        /* min-width:0 lets the number inputs shrink to an equal 1/3 share on a
           narrow sidebar instead of keeping their intrinsic (wider) width. */
        .row > .field { flex: 1 1 0; min-width: 0; }
        .hint { font-size: 10px; opacity: 0.55; padding: 0 2px 4px; }
    `;

    constructor() {
        super();
        this.element = null;
        this._tab    = 'topics';
        this._open   = {};
    }

    willUpdate(changed) {
        if (changed.has('element')) this._open = {};
    }

    _val(name)  { return this.element?.getAttribute(name) ?? ''; }
    _bool(name, defaultVal = false) {
        if (!this.element) return defaultVal;
        return this.element.hasAttribute(name) ? true : defaultVal;
    }

    _emit(name, value, rerender = false) {
        this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
            bubbles: true, composed: true, detail: {name, value},
        }));
        if (rerender) this.requestUpdate();
    }

    _onInput(name, e)  { this._emit(name, e.target.value); }
    _onSelect(name, e) { this._emit(name, e.target.value, true); }

    _sectionEnabled(sec) {
        if (this._open[sec.id]) return true;
        return sec.topics.some(t => this._val(t.attr) !== '');
    }

    _toggleSection(sec, e) {
        const on = e.target.checked;
        if (on) {
            this._open = {...this._open, [sec.id]: true};
        } else {
            sec.topics.forEach(t => this._emit(t.attr, ''));
            this._open = {...this._open, [sec.id]: false};
        }
        this.requestUpdate();
    }

    _topicInput(t) {
        return html`
            <div class="field">
                <label>${t.label}</label>
                <feezal-topic-input size="small"
                    placeholder="${t.placeholder ?? 'mqtt/topic'}"
                    value="${this._val(t.attr)}"
                    @sl-change="${e => this._onInput(t.attr, e)}"></feezal-topic-input>
            </div>`;
    }

    render() {
        if (!this.element) return html``;
        return html`
            <sl-tab-group @sl-tab-show="${e => { this._tab = e.detail.name; }}">
                <sl-tab slot="nav" panel="topics" ?active="${this._tab === 'topics'}">Topics</sl-tab>
                <sl-tab slot="nav" panel="config"  ?active="${this._tab === 'config'}">Config</sl-tab>
                <sl-tab-panel name="topics">${this._renderTopics()}</sl-tab-panel>
                <sl-tab-panel name="config">${this._renderConfig()}</sl-tab-panel>
            </sl-tab-group>
        `;
    }

    _renderTopics() {
        const isJson = (this._val('payload-mode') || 'separate') === 'json';
        if (isJson) {
            return html`
                <div class="hint">JSON mode — one topic carries the whole climate state object.</div>
                <div class="section">
                    <div class="sec-head">State &amp; Control</div>
                    <div class="sec-body">
                        ${this._topicInput({attr: 'subscribe', label: 'Subscribe (state topic)'})}
                        ${this._topicInput({attr: 'publish',   label: 'Publish (\u2026/set)'})}
                    </div>
                </div>
                ${JSON_CAPABILITIES.map(sec => {
                    const enabled = this._sectionEnabled(sec);
                    return html`
                        <div class="section">
                            <div class="sec-head ${enabled ? '' : 'collapsed'}">
                                <span class="sec-title">${sec.title}</span>
                                <sl-switch size="small" ?checked="${enabled}"
                                    @sl-change="${e => this._toggleSection(sec, e)}"></sl-switch>
                            </div>
                            ${enabled ? html`<div class="sec-body">${sec.topics.map(t => this._topicInput(t))}</div>` : ''}
                        </div>`;
                })}`;
        }

        // ── Separate mode ──────────────────────────────────────────────────────
        return html`
            <div class="section">
                <div class="sec-head">Setpoint</div>
                <div class="sec-body">
                    ${this._topicInput({attr: 'subscribe-setpoint', label: 'Subscribe (current setpoint)'})}
                    ${this._topicInput({attr: 'publish-setpoint',   label: 'Publish (set new setpoint)'})}
                </div>
            </div>
            <div class="section">
                <div class="sec-head">Actual temperature</div>
                <div class="sec-body">
                    ${this._topicInput({attr: 'subscribe-actual', label: 'Subscribe'})}
                </div>
            </div>
            ${CLIMATE_SECTIONS.map(sec => {
                const enabled = this._sectionEnabled(sec);
                return html`
                    <div class="section">
                        <div class="sec-head ${enabled ? '' : 'collapsed'}">
                            <span class="sec-title">${sec.title}</span>
                            <sl-switch size="small" ?checked="${enabled}"
                                @sl-change="${e => this._toggleSection(sec, e)}"></sl-switch>
                        </div>
                        ${enabled ? html`<div class="sec-body">${sec.topics.map(t => this._topicInput(t))}</div>` : ''}
                    </div>`;
            })}`;
    }

    _renderConfig() {
        const payloadMode = this._val('payload-mode') || 'separate';
        return html`
            <div class="section">
                <div class="sec-head">Payload mode</div>
                <div class="sec-body">
                    <sl-select size="small" value="${payloadMode}"
                        @sl-change="${e => this._onSelect('payload-mode', e)}">
                        <sl-option value="separate">separate (one topic per property, default)</sl-option>
                        <sl-option value="json">json (single topic, auto-discovery)</sl-option>
                    </sl-select>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Temperature range</div>
                <div class="sec-body">
                    <div class="row">
                        <div class="field">
                            <label>Min</label>
                            <sl-input size="small" type="number" autocomplete="off"
                                value="${this._val('min') || '5'}"
                                @sl-change="${e => this._onInput('min', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Max</label>
                            <sl-input size="small" type="number" autocomplete="off"
                                value="${this._val('max') || '30'}"
                                @sl-change="${e => this._onInput('max', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Step</label>
                            <sl-input size="small" type="number" autocomplete="off"
                                value="${this._val('step') || '0.5'}"
                                @sl-change="${e => this._onInput('step', e)}"></sl-input>
                        </div>
                    </div>
                    <div class="field">
                        <label>Unit</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="°C"
                            value="${this._val('unit') || '°C'}"
                            @sl-change="${e => this._onInput('unit', e)}"></sl-input>
                    </div>
                    <!-- E102: valve device range → scaled to 0–100 %. HmIP LEVEL is 0…1 (set Max=1). -->
                    <div class="row">
                        <div class="field">
                            <label>Valve min</label>
                            <sl-input size="small" type="number" autocomplete="off"
                                value="${this._val('valve-min') || '0'}"
                                @sl-change="${e => this._onInput('valve-min', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Valve max</label>
                            <sl-input size="small" type="number" autocomplete="off"
                                value="${this._val('valve-max') || '100'}"
                                @sl-change="${e => this._onInput('valve-max', e)}"></sl-input>
                        </div>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Mode chips</div>
                <div class="sec-body">
                    <div class="hint">JSON array of mode objects. When non-empty, a chip row is shown below the arc. Example: [{"value":"heat","label":"Heat"},{"value":"cool","label":"Cool"},{"value":"off","label":"Off"}]</div>
                    <div class="field">
                        <sl-input size="small" autocomplete="off"
                            placeholder='[{"value":"heat","label":"Heat"},{"value":"off","label":"Off"}]'
                            value="${this._val('modes')}"
                            @sl-change="${e => this._onInput('modes', e)}"></sl-input>
                    </div>
                </div>
            </div>

            ${payloadMode === 'json' ? html`
                <div class="section">
                    <div class="sec-head">JSON key map</div>
                    <div class="sec-body">
                        <div class="hint">Override default JSON keys. Defaults: {"setpoint":"current_heating_setpoint","actual":"local_temperature","mode":"system_mode","valve":"position","humidity":"humidity"}</div>
                        <div class="field">
                            <sl-input size="small" autocomplete="off"
                                placeholder='{"setpoint":"target_temp","actual":"temperature"}'
                                value="${this._val('json-map')}"
                                @sl-change="${e => this._onInput('json-map', e)}"></sl-input>
                        </div>
                    </div>
                </div>
            ` : ''}

            <div class="section">
                <div class="sec-head">Display</div>
                <div class="sec-body">
                    <div class="field">
                        <label>Label</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="Kitchen"
                            value="${this._val('label')}"
                            @sl-change="${e => this._onInput('label', e)}"></sl-input>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Availability</div>
                <div class="sec-body">
                    ${this._topicInput({attr: 'subscribe-availability', label: 'Availability topic'})}
                    <div class="row">
                        <div class="field">
                            <label>Online payload</label>
                            <sl-input size="small" autocomplete="off"
                                value="${this._val('payload-available') || 'online'}"
                                @sl-change="${e => this._onInput('payload-available', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Offline payload</label>
                            <sl-input size="small" autocomplete="off"
                                value="${this._val('payload-unavailable') || 'offline'}"
                                @sl-change="${e => this._onInput('payload-unavailable', e)}"></sl-input>
                        </div>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Message property</div>
                <div class="sec-body">
                    <div class="hint">Dot-notation path to extract a value from each message (e.g. <code>payload</code>, <code>data.value</code>). Blank = read top-level payload.</div>
                    <div class="field">
                        <label>Global (all topics)</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="payload"
                            value="${this._val('message-property')}"
                            @sl-change="${e => this._onInput('message-property', e)}"></sl-input>
                    </div>
                    <div class="field">
                        <label>Setpoint topic</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="payload"
                            value="${this._val('message-property-setpoint')}"
                            @sl-change="${e => this._onInput('message-property-setpoint', e)}"></sl-input>
                    </div>
                    <div class="field">
                        <label>Actual temperature topic</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="payload"
                            value="${this._val('message-property-actual')}"
                            @sl-change="${e => this._onInput('message-property-actual', e)}"></sl-input>
                    </div>
                    <div class="field">
                        <label>Mode topic</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="payload"
                            value="${this._val('message-property-mode')}"
                            @sl-change="${e => this._onInput('message-property-mode', e)}"></sl-input>
                    </div>
                    <div class="field">
                        <label>Valve topic</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="payload"
                            value="${this._val('message-property-valve')}"
                            @sl-change="${e => this._onInput('message-property-valve', e)}"></sl-input>
                    </div>
                    <div class="field">
                        <label>Humidity topic</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="payload"
                            value="${this._val('message-property-humidity')}"
                            @sl-change="${e => this._onInput('message-property-humidity', e)}"></sl-input>
                    </div>
                    <div class="field">
                        <label>Availability topic</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="payload"
                            value="${this._val('message-property-availability')}"
                            @sl-change="${e => this._onInput('message-property-availability', e)}"></sl-input>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('feezal-element-material-climate-inspector', FeezalElementMaterialClimateInspector);
export {FeezalElementMaterialClimateInspector};

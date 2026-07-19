/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@feezal/feezal-element/feezal-topic-input.js';
import {LitElement} from 'lit';
import {applySizePreset, payloadMatch, glassCardStyles, glassPopupStyles} from '@feezal/feezal-glass';

/**
 * feezal-element-glass-light (E58)
 *
 * Frosted-glass light card — the Apple-Home-style tile: tap toggles,
 * long-press (or the tune button) opens the Apple-Home-style details popup:
 * big vertical brightness slider, colour-temperature slider, round
 * hue/saturation wheel — sections appear per capability.
 *
 * MQTT capability contract mirrors feezal-element-material-light — SAME
 * attribute names, both payload modes (json / separate), the E77
 * brightness-derived on/off (Homematic dimmers), brightness-min/max range
 * scaling, colour temperature (kelvin locally, kelvin|mired on the wire),
 * RGB / hue-saturation and HA discovery (schema → payload-mode, capability
 * ranges, supported_color_modes → mode). Effects/white channels remain
 * material-light's domain. The `mode` attribute picks the back-side detail
 * sliders: brightness / brightness_ct / color_temp / rgb / hs.
 *
 * Family conventions (frost vars, degrade, squircle): see glass-button.
 */

/** Ring % → raw MQTT value — identical semantics to material-light's export:
 * integer ranges publish whole numbers, sub-integer ranges (Homematic LEVEL
 * 0–1) keep the needed decimals. */
export function pctToRaw(pct, min, max) {
    const value = min + (pct / 100) * (max - min);
    const step = Math.abs(max - min) / 100;
    if (step >= 1 || step === 0) return Math.round(value);
    const decimals = Math.min(6, Math.ceil(-Math.log10(step)));
    return Number(value.toFixed(decimals));
}

/** Raw MQTT value → 0–100 %, clamped. */
export function rawToPct(raw, min, max) {
    const n = Number(raw);
    if (!Number.isFinite(n) || max === min) return null;
    return Math.max(0, Math.min(100, Math.round(((n - min) / (max - min)) * 100)));
}

// ── Colour helpers (private in material-light — duplicated, keep in sync) ──
function hsvToRgb(h, s, v) {
    const f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
    return [f(5), f(3), f(1)].map(x => Math.round(x * 255));
}

function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
    }
    return [h, max === 0 ? 0 : d / max, max];
}

function parseRgb(raw) {
    try {
        const arr = typeof raw === 'string' && raw.trim().startsWith('[') ? JSON.parse(raw)
            : typeof raw === 'string' ? raw.split(',').map(Number) : raw;
        if (Array.isArray(arr) && arr.length >= 3 && arr.slice(0, 3).every(n => !isNaN(Number(n)))) {
            return arr.slice(0, 3).map(Number);
        }
    } catch { /* unparseable */ }
    return null;
}

function xyToRgb(x, y, bri = 1) {
    const z = 1 - x - y;
    const Y = bri, X = (Y / y) * x, Z = (Y / y) * z;
    let r = X * 1.612 - Y * 0.203 - Z * 0.302;
    let g = -X * 0.509 + Y * 1.412 + Z * 0.066;
    let b = X * 0.026 - Y * 0.072 + Z * 0.962;
    [r, g, b] = [r, g, b].map(c => c <= 0.0031308 ? 12.92 * c : 1.055 * (c ** (1 / 2.4)) - 0.055);
    const max = Math.max(r, g, b, 1);
    return [r, g, b].map(c => Math.round(Math.max(0, c / max) * 255));
}

const LONG_PRESS_MS = 450;

class FeezalElementGlassLight extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Light', category: 'Glass', color: '#7aa5c9', icon: 'lightbulb'},
            description: 'Frosted-glass light tile — tap toggles; long-press (or the ⋯ button) opens the details popup: ' +
                'vertical brightness slider, colour-temperature slider and hue/saturation wheel (per capability). ' +
                'Same wiring contract as the material light card.',
            inspector: 'feezal-element-glass-light-inspector',
            discovery: {
                component: 'light',
                map: {
                    schema:           {attr: 'payload-mode', valueMap: {json: 'json', _default: 'separate'}},
                    state_topic:      'subscribe',
                    command_topic:    {attr: 'publish', onlyWhen: {schema: 'json'}},
                    brightness_state_topic:   'subscribe-brightness',
                    brightness_command_topic: 'publish-brightness',
                    brightness_scale: {attr: 'brightness-max'},
                    color_temp_state_topic:   'subscribe-color-temp',
                    color_temp_command_topic: 'publish-color-temp',
                    supported_color_modes:    {attr: 'mode', transform: 'colorMode'},
                    min_mireds: {attr: 'color-temp-max', unit: 'mired→kelvin', alsoSet: {'color-temp-unit': 'mired'}},
                    max_mireds: {attr: 'color-temp-min', unit: 'mired→kelvin'},
                    // N31: availability is mapped automatically from the canonical discovery record.
                    name: 'label',
                },
            },
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x2', '2x1'], default: '',
                    help: 'Preset size: 2x2 = square (150×150), 2x1 = wide (150×75). Empty keeps the current/manual size.'},
                {name: 'payload-mode', type: 'select', options: ['separate', 'json'], default: 'separate',
                    help: 'separate = one topic per property; json = single topic carrying a JSON object.'},
                {name: 'subscribe', type: 'mqttTopic', help: 'JSON mode: base topic carrying the state JSON. Separate mode: on/off state topic.'},
                {name: 'publish',   type: 'mqttTopic', help: 'json mode: command topic (usually …/set) accepting a partial JSON object.'},
                {name: 'json-map',  type: 'string', default: '', help: 'json mode: optional JSON string overriding the default {state, brightness} key map.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Property path within message payloads (dot-notation). json mode: extracts the state object; separate mode: global fallback.'},
                {name: 'on-off-source', type: 'select', options: ['topic', 'brightness'], default: 'topic',
                    help: 'topic = dedicated on/off state topic; brightness = derive on/off from the brightness value (Homematic dimmers, LEVEL 0–1).'},
                {name: 'subscribe-state', type: 'mqttTopic', help: 'Separate mode: on/off state topic. Falls back to subscribe when empty.'},
                {name: 'message-property-state', type: 'string', default: 'payload', help: 'Property path for the on/off topic. Defaults to message-property.'},
                {name: 'publish-state', type: 'mqttTopic', help: 'Topic to publish on/off.'},
                {name: 'payload-on',  type: 'string', default: 'on',  help: 'Payload representing "on". on-off-source=brightness: published to the brightness topic on toggle-on (Homematic: 1.005 restores the last level).'},
                {name: 'payload-off', type: 'string', default: 'off', help: 'Payload representing "off". on-off-source=brightness: numeric value meaning off (non-numeric falls back to brightness-min).'},
                {name: 'subscribe-brightness', type: 'mqttTopic', help: 'Current brightness topic.'},
                {name: 'message-property-brightness', type: 'string', default: 'payload', help: 'Property path for the brightness topic. Defaults to message-property.'},
                {name: 'publish-brightness', type: 'mqttTopic', help: 'Publish brightness on slider release.'},
                {name: 'brightness-min', type: 'number', default: 0,   help: 'Minimum brightness value on the MQTT topic.'},
                {name: 'brightness-max', type: 'number', default: 100, help: 'Maximum brightness value on the MQTT topic (z2m: 254, Homematic: 1).'},
                {name: 'mode', type: 'select', options: ['brightness', 'brightness_ct', 'color_temp', 'rgb', 'hs'], default: 'brightness',
                    help: 'Capability declaration for json mode (which popup sections exist): brightness, brightness + colour temperature, colour temperature, RGB or hue/saturation. Separate mode derives sections from the configured topics.'},
                {name: 'subscribe-color-temp', type: 'mqttTopic', help: 'Current colour temperature.'},
                {name: 'message-property-color-temp', type: 'string', default: 'payload', help: 'Property path for the colour-temperature topic. Defaults to message-property.'},
                {name: 'publish-color-temp', type: 'mqttTopic', help: 'Publish colour temperature.'},
                {name: 'color-temp-unit', type: 'select', options: ['kelvin', 'mired'], default: 'kelvin', help: 'Unit used on colour-temp topics.'},
                {name: 'color-temp-min', type: 'number', default: 2700, help: 'Minimum colour temperature (K).'},
                {name: 'color-temp-max', type: 'number', default: 6500, help: 'Maximum colour temperature (K).'},
                {name: 'subscribe-rgb', type: 'mqttTopic', help: 'Current RGB value (JSON [r,g,b] or "r,g,b").'},
                {name: 'message-property-rgb', type: 'string', default: 'payload', help: 'Property path for the RGB topic. Defaults to message-property.'},
                {name: 'publish-rgb', type: 'mqttTopic', help: 'Publish RGB value as JSON [r,g,b].'},
                {name: 'subscribe-hs', type: 'mqttTopic', help: 'Current hue/saturation (JSON [h,s]).'},
                {name: 'message-property-hs', type: 'string', default: 'payload', help: 'Property path for the hue/saturation topic. Defaults to message-property.'},
                {name: 'publish-hs', type: 'mqttTopic', help: 'Publish hue/saturation as JSON [h,s].'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability — a badge appears when unavailable, the tile stays usable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path for the availability topic. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
                {name: 'label', type: 'string', help: 'Card label.'},
                {name: 'label-on',  type: 'string', default: 'On',  help: 'Displayed state text while the light is on (localise, e.g. "Ein"); the brightness suffix "• x %" keeps appending. Display only — NOT the MQTT payload (payload-on) and NOT the card title (label).'},
                {name: 'label-off', type: 'string', default: 'Off', help: 'Displayed state text while the light is off (localise, e.g. "Aus"). Display only — NOT the MQTT payload (payload-off) and NOT the card title (label).'},
                {name: 'icon',  type: 'string', default: 'lightbulb', help: 'Icon name.'},
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-accent', type: 'color', default: '#ff9f0a', help: 'Icon/state colour while on.'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-icon-size', default: '28px', help: 'Icon font size.'},
                {property: '--feezal-glass-font-size-state', default: '15px', help: 'State line font size.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Label font size.'},
                {property: '--feezal-glass-font-size-unit', default: '12px', help: 'Flip/detail button icon size.'},
            ],
            defaultStyle: {width: '150px', height: '110px'},
            restrict: {minWidth: 90, minHeight: 70},
        };
    }

    static properties = {
        size:                {type: String, reflect: true},
        payloadMode:         {type: String, reflect: true, attribute: 'payload-mode'},
        publish:             {type: String, reflect: true},
        jsonMap:             {type: String, reflect: true, attribute: 'json-map'},
        onOffSource:         {type: String, reflect: true, attribute: 'on-off-source'},
        subscribeState:      {type: String, reflect: true, attribute: 'subscribe-state'},
        msgPropState:        {type: String, reflect: true, attribute: 'message-property-state'},
        publishState:        {type: String, reflect: true, attribute: 'publish-state'},
        payloadOn:           {type: String, reflect: true, attribute: 'payload-on'},
        payloadOff:          {type: String, reflect: true, attribute: 'payload-off'},
        subscribeBrightness: {type: String, reflect: true, attribute: 'subscribe-brightness'},
        msgPropBrightness:   {type: String, reflect: true, attribute: 'message-property-brightness'},
        publishBrightness:   {type: String, reflect: true, attribute: 'publish-brightness'},
        brightnessMin:       {type: Number, reflect: true, attribute: 'brightness-min'},
        brightnessMax:       {type: Number, reflect: true, attribute: 'brightness-max'},
        mode:                {type: String, reflect: true},
        subscribeColorTemp:  {type: String, reflect: true, attribute: 'subscribe-color-temp'},
        msgPropColorTemp:    {type: String, reflect: true, attribute: 'message-property-color-temp'},
        publishColorTemp:    {type: String, reflect: true, attribute: 'publish-color-temp'},
        colorTempUnit:       {type: String, reflect: true, attribute: 'color-temp-unit'},
        colorTempMin:        {type: Number, reflect: true, attribute: 'color-temp-min'},
        colorTempMax:        {type: Number, reflect: true, attribute: 'color-temp-max'},
        subscribeRgb:        {type: String, reflect: true, attribute: 'subscribe-rgb'},
        msgPropRgb:          {type: String, reflect: true, attribute: 'message-property-rgb'},
        publishRgb:          {type: String, reflect: true, attribute: 'publish-rgb'},
        subscribeHs:         {type: String, reflect: true, attribute: 'subscribe-hs'},
        msgPropHs:           {type: String, reflect: true, attribute: 'message-property-hs'},
        publishHs:           {type: String, reflect: true, attribute: 'publish-hs'},
        // N31: availability inherited from FeezalElement.
        label:               {type: String, reflect: true},
        labelOn:             {type: String, reflect: true, attribute: 'label-on'},
        labelOff:            {type: String, reflect: true, attribute: 'label-off'},
        icon:                {type: String, reflect: true},
        degrade:             {type: Boolean, reflect: true},
        discoveryId:         {type: String, reflect: true, attribute: 'discovery-id'},
        _on:        {state: true},
        _brt:       {state: true},   // 0–100 % (null = unknown)
        _colorTemp: {state: true},   // Kelvin (null = unknown)
        _rgb:       {state: true},   // [r, g, b]
        _hs:        {state: true},   // [h 0–360, s 0–100]
        _details:   {state: true},   // details popup open
    };

    static styles = [feezalBaseStyles, glassCardStyles, glassPopupStyles, css`
        .card {
            cursor: pointer;
            gap: 2px;
            transition: transform 0.15s ease, background 0.2s ease;
            touch-action: manipulation;
        }
        .card:active { transform: scale(0.97); }
        .card.on { background: var(--feezal-glass-on-tint, rgba(255,255,255,0.62)); }
        feezal-icon {
            font-size: var(--feezal-glass-icon-size, 28px); line-height: 1;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            transition: color 0.2s ease;
        }
        .card.on feezal-icon { color: var(--feezal-glass-accent, #ff9f0a); }
        .state { font-size: var(--feezal-glass-font-size-state, 15px); font-weight: 700; }
        .label {
            font-size: var(--feezal-glass-font-size-label, 12px); font-weight: 600; line-height: 1.2;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .unavail {
            position: absolute; bottom: 8px; right: 10px;
            font-size: 12px; color: var(--error-color, #d32f2f); opacity: 0.85;
        }
        /* E105: much wider than tall → horizontal layout (Apple-Home wide
           tile): icon left, state/label stacked right of it. flip-btn and
           unavail stay absolutely positioned in their corners. */
        @container (min-aspect-ratio: 2/1) {
            .card {
                display: grid;
                grid-template: 'icon state' auto 'icon label' auto / auto 1fr;
                align-content: center;
                align-items: center;
                column-gap: 10px;
                text-align: left;
            }
            .card > feezal-icon { grid-area: icon; }
            .card .state { grid-area: state; align-self: end; }
            .card .label { grid-area: label; align-self: start; }
        }
        /* Big vertical brightness slider — the Apple pill: filled from the
           bottom, drag anywhere on it. */
        .vslider {
            position: relative; width: 72px; height: 170px; flex: 0 0 auto;
            border-radius: 20px; overflow: hidden; cursor: grab;
            background: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 12%, transparent);
            touch-action: none; user-select: none;
        }
        .vslider .fill {
            position: absolute; left: 0; right: 0; bottom: 0;
            background: var(--feezal-glass-on-tint, rgba(255,255,255,0.95));
        }
        .vslider .pct {
            position: absolute; left: 0; right: 0; bottom: 10px; text-align: center;
            font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums;
            pointer-events: none;
        }
        .vslider feezal-icon {
            position: absolute; left: 0; right: 0; top: 12px; text-align: center;
            font-size: 22px; pointer-events: none;
        }
        /* Horizontal colour-temperature slider */
        input[type="range"].ct {
            -webkit-appearance: none; appearance: none;
            width: 100%; height: 24px; border-radius: 12px; cursor: pointer;
            background: linear-gradient(to right, #ff8c00, #fff8ee 50%, #aac4ff);
        }
        input[type="range"].ct::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none;
            width: 22px; height: 22px; border-radius: 50%;
            background: #fff; border: 1px solid rgba(0,0,0,0.25);
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        input[type="range"].ct::-moz-range-thumb {
            width: 22px; height: 22px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.25);
            background: #fff;
        }
        /* Round hue/saturation picker — hue by angle, saturation by radius. */
        .wheel {
            position: relative; width: 130px; height: 130px; flex: 0 0 auto;
            border-radius: 50%; cursor: crosshair; touch-action: none;
            background:
                radial-gradient(circle, #fff 0%, rgba(255,255,255,0) 72%),
                conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
            box-shadow: inset 0 0 6px rgba(0,0,0,0.2);
        }
        .wheel .knob {
            position: absolute; width: 18px; height: 18px; border-radius: 50%;
            border: 2px solid #fff; box-shadow: 0 0 4px rgba(0,0,0,0.5);
            transform: translate(-50%, -50%); pointer-events: none;
        }
    `];

    constructor() {
        super();
        this.size = '';
        this.payloadMode = 'separate';
        this.publish = '';
        this.jsonMap = '';
        this.onOffSource = 'topic';
        this.subscribeState = '';
        this.msgPropState = '';
        this.publishState = '';
        this.payloadOn = 'on';
        this.payloadOff = 'off';
        this.subscribeBrightness = '';
        this.msgPropBrightness = '';
        this.publishBrightness = '';
        this.brightnessMin = 0;
        this.brightnessMax = 100;
        this.mode = 'brightness';
        this.subscribeColorTemp = '';
        this.msgPropColorTemp = '';
        this.publishColorTemp = '';
        this.colorTempUnit = 'kelvin';
        this.colorTempMin = 2700;
        this.colorTempMax = 6500;
        this.subscribeRgb = '';
        this.msgPropRgb = '';
        this.publishRgb = '';
        this.subscribeHs = '';
        this.msgPropHs = '';
        this.publishHs = '';
        this.label = '';
        this.labelOn = 'On';
        this.labelOff = 'Off';
        this.icon = 'lightbulb';
        this.degrade = false;
        this.discoveryId = '';
        this._on = false;
        this._brt = null;
        this._colorTemp = null;
        this._rgb = null;
        this._hs = null;
        this._details = false;
        this._pressTimer = null;
        this._longPressed = false;
        this._suppressTap = false;
        // Outside tap closes the details popup; a tap landing back on the
        // card must not also toggle the light.
        this.__outsideDown = e => {
            const path = e.composedPath();
            if (path.includes(this.renderRoot?.querySelector('.details'))) return;
            this._closeDetails();
            if (path.includes(this)) this._suppressTap = true;
        };
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    get _map() {
        const defaults = {state: 'state', brightness: 'brightness', color_temp: 'color_temp', color: 'color'};
        if (this.jsonMap) {
            try { return {...defaults, ...JSON.parse(this.jsonMap)}; } catch { /* defaults */ }
        }
        return defaults;
    }

    /** The numeric raw value meaning "off" in brightness-derived mode. */
    get _offRaw() {
        const n = Number(this.payloadOff);
        return Number.isFinite(n) ? n : Number(this.brightnessMin) || 0;
    }

    connectedCallback() {
        super.connectedCallback();
        this._wireSubscriptions();
    }

    /** Everything that identifies the subscription wiring — when it changes
     * at runtime (inspector edits on the live canvas, MQTT setattribute),
     * updated() rewires instead of silently keeping the stale topics. */
    _wireSignature() {
        return [this.payloadMode, this.onOffSource, this.subscribe, this.subscribeState,
            this.subscribeBrightness, this.subscribeColorTemp, this.subscribeRgb, this.subscribeHs].join('|');
    }

    _wireSubscriptions() {
        this.__wireSig = this._wireSignature();

        if (this.payloadMode === 'json') {
            if (this.subscribe) {
                this.addSubscription(this.subscribe, msg => {
                    let obj = this.getProperty(msg, this.messageProperty);
                    if (typeof obj === 'string') {
                        try { obj = JSON.parse(obj); } catch { obj = null; }
                    }
                    // Tolerance: message-property pointing at a leaf — the
                    // state object is the payload itself.
                    if ((obj === null || typeof obj !== 'object') && msg.payload && typeof msg.payload === 'object') {
                        obj = msg.payload;
                    }
                    if (!obj || typeof obj !== 'object') return;
                    const map = this._map;
                    const state = this.getProperty(obj, map.state);
                    if (state !== undefined && state !== null) {
                        this._on = payloadMatch(state, this.payloadOn);
                    }
                    const raw = this.getProperty(obj, map.brightness);
                    if (raw !== undefined && raw !== null) {
                        this._applyBrightness(raw);
                    }
                    let ct = Number(this.getProperty(obj, map.color_temp));
                    if (!isNaN(ct) && ct > 0) {
                        if (this.colorTempUnit === 'mired') ct = Math.round(1_000_000 / ct);
                        this._colorTemp = ct;
                    }
                    const color = this.getProperty(obj, map.color);
                    if (color && typeof color === 'object') {
                        if (color.hue !== undefined || color.h !== undefined) {
                            this._hs = [Number(color.hue ?? color.h), Number(color.saturation ?? color.s ?? 100)];
                        } else if (color.r !== undefined) {
                            this._rgb = [Number(color.r), Number(color.g), Number(color.b)];
                        } else if (color.x !== undefined && color.y !== undefined) {
                            this._rgb = xyToRgb(Number(color.x), Number(color.y));
                        }
                    }
                });
            }
            return;
        }

        // ── separate mode ────────────────────────────────────────────────────
        const stateTopic = this.subscribeState || (this.onOffSource !== 'brightness' ? this.subscribe : '');
        if (this.onOffSource !== 'brightness' && stateTopic) {
            this.addSubscription(stateTopic, msg => {
                const v = this.getProperty(msg, this.msgPropState || this.messageProperty);
                this._on = payloadMatch(v, this.payloadOn);
            });
        }
        if (this.subscribeBrightness) {
            this.addSubscription(this.subscribeBrightness, msg => {
                const raw = this.getProperty(msg, this.msgPropBrightness || this.messageProperty);
                this._applyBrightness(raw);
            });
        }
        if (this.subscribeColorTemp) {
            this.addSubscription(this.subscribeColorTemp, msg => {
                let v = Number(this.getProperty(msg, this.msgPropColorTemp || this.messageProperty));
                if (!isNaN(v) && v > 0) {
                    if (this.colorTempUnit === 'mired') v = Math.round(1_000_000 / v);
                    this._colorTemp = v;
                }
            });
        }
        if (this.subscribeRgb) {
            this.addSubscription(this.subscribeRgb, msg => {
                const rgb = parseRgb(this.getProperty(msg, this.msgPropRgb || this.messageProperty));
                if (rgb) this._rgb = rgb;
            });
        }
        if (this.subscribeHs) {
            this.addSubscription(this.subscribeHs, msg => {
                try {
                    const raw = this.getProperty(msg, this.msgPropHs || this.messageProperty);
                    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    if (Array.isArray(arr) && arr.length >= 2) this._hs = arr.slice(0, 2).map(Number);
                } catch { /* unparseable */ }
            });
        }
    }

    updated(changed) {
        super.updated(changed);
        // Topic/mode attributes changed at runtime → drop the old
        // subscriptions and wire the new ones (a fresh subscription also
        // triggers the broker's retained replay — this is what makes topics
        // configured through the inspector show state on the live canvas).
        if (this.isConnected && this.__wireSig !== undefined && this._wireSignature() !== this.__wireSig) {
            this._unsubscribe();
            this._wireSubscriptions();
        }
        // The size grid writes the element's inline geometry (editor keeps
        // full manual control afterwards).
        if (changed.has('size')) applySizePreset(this);
        // Promote the details popup into the top layer (system-pin pattern).
        // Removing it from the DOM on close dismisses the popover.
        if (changed.has('_details') && this._details) {
            const popup = this.renderRoot.querySelector('.details');
            if (popup?.showPopover && !popup.matches(':popover-open')) {
                try { popup.showPopover(); } catch { /* fixed+z-index fallback */ }
            }
            this._positionDetails();
        }
    }

    /** Store brightness %, deriving on/off when on-off-source=brightness (E77). */
    _applyBrightness(raw) {
        const pct = rawToPct(raw, Number(this.brightnessMin) || 0, Number(this.brightnessMax) ?? 100);
        if (pct !== null) {
            this._brt = pct;
        }
        if (this.onOffSource === 'brightness') {
            const n = Number(raw);
            this._on = Number.isFinite(n) ? n !== this._offRaw : false;
        }
    }

    // ── publishing ────────────────────────────────────────────────────────────

    _pubJson(obj) {
        if (this.publish) feezal.connection.pub(this.publish, JSON.stringify(obj));
    }

    toggle() {
        if (feezal.isEditor) return;
        const next = !this._on;
        this._on = next;
        if (this.payloadMode === 'json') {
            this._pubJson({[this._map.state]: next ? this.payloadOn : this.payloadOff});
            return;
        }
        if (this.onOffSource === 'brightness') {
            // E77: on/off travels over the brightness topic (Homematic:
            // payload-on 1.005 restores the previous level, payload-off 0).
            if (this.publishBrightness) {
                feezal.connection.pub(this.publishBrightness, next ? this.payloadOn : this.payloadOff);
            }
            return;
        }
        if (this.publishState) {
            feezal.connection.pub(this.publishState, next ? this.payloadOn : this.payloadOff);
        }
    }

    setBrightness(pct) {
        if (feezal.isEditor) return;
        const clamped = Math.max(0, Math.min(100, Math.round(Number(pct))));
        this._brt = clamped;
        const raw = pctToRaw(clamped, Number(this.brightnessMin) || 0, Number(this.brightnessMax) ?? 100);
        if (this.payloadMode === 'json') {
            this._pubJson({[this._map.brightness]: raw});
            return;
        }
        if (this.publishBrightness) {
            feezal.connection.pub(this.publishBrightness, raw);
        }
        if (this.onOffSource === 'brightness') {
            this._on = raw !== this._offRaw;
        }
    }

    setColorTemp(kelvin) {
        if (feezal.isEditor) return;
        const ct = Math.round(Number(kelvin));
        this._colorTemp = ct;
        const v = this.colorTempUnit === 'mired' ? Math.round(1_000_000 / ct) : ct;
        if (this.payloadMode === 'json') {
            this._pubJson({[this._map.color_temp]: v});
            return;
        }
        if (this.publishColorTemp) {
            feezal.connection.pub(this.publishColorTemp, String(v));
        }
    }

    setHueSat(hue, sat) {
        if (feezal.isEditor) return;
        if (this.mode === 'rgb') {
            const rgb = hsvToRgb(hue, sat / 100, 1);
            this._rgb = rgb;
            if (this.payloadMode === 'json') {
                this._pubJson({[this._map.color]: {r: rgb[0], g: rgb[1], b: rgb[2]}});
            } else if (this.publishRgb) {
                feezal.connection.pub(this.publishRgb, JSON.stringify(rgb));
            }
        } else {
            const hs = [Math.round(hue), Math.round(sat)];
            this._hs = hs;
            if (this.payloadMode === 'json') {
                this._pubJson({[this._map.color]: {hue: hs[0], saturation: hs[1]}});
            } else if (this.publishHs) {
                feezal.connection.pub(this.publishHs, JSON.stringify(hs));
            }
        }
    }

    /** Current [hue, sat%] for the colour sliders, from _hs or _rgb. */
    _hueSat() {
        if (this.mode === 'hs' && this._hs) return this._hs;
        if (this._rgb) {
            const [h, s] = rgbToHsv(...this._rgb);
            return [h, s * 100];
        }
        return this._hs ?? [0, 100];
    }

    // ── interaction: tap toggles, long-press (or ⋯) opens the details popup ──

    _onPointerDown() {
        if (feezal.isEditor) return;
        this._longPressed = false;
        clearTimeout(this._pressTimer);
        this._pressTimer = setTimeout(() => {
            this._longPressed = true;
            this.openDetails();
        }, LONG_PRESS_MS);
    }

    _onPointerUp() {
        clearTimeout(this._pressTimer);
        if (this._suppressTap) {
            this._suppressTap = false;
            return;
        }
        if (!this._longPressed && !this._details) {
            this.toggle();
        }
    }

    _onPointerLeave() {
        clearTimeout(this._pressTimer);
    }

    openDetails() {
        if (feezal.isEditor || this._details) return;
        this._details = true;
        // Deferred: don't catch the very tap that opened the popup.
        setTimeout(() => {
            if (this._details) document.addEventListener('pointerdown', this.__outsideDown);
        });
    }

    _closeDetails() {
        this._details = false;
        document.removeEventListener('pointerdown', this.__outsideDown);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearTimeout(this._pressTimer);
        document.removeEventListener('pointerdown', this.__outsideDown);
    }

    // ── details popup controls ────────────────────────────────────────────────

    /** Vertical brightness pill: pointer position → %; publish on release. */
    _vsliderDown(e) {
        if (feezal.isEditor) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        this.__vsliderDragging = true;
        this._vsliderApply(e);
    }

    _vsliderMove(e) {
        if (this.__vsliderDragging) this._vsliderApply(e);
    }

    _vsliderUp(e) {
        if (!this.__vsliderDragging) return;
        this.__vsliderDragging = false;
        this._vsliderApply(e);
        this.setBrightness(this._brt ?? 0);
    }

    _vsliderApply(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = Math.round((1 - (e.clientY - rect.top) / rect.height) * 100);
        this._brt = Math.max(0, Math.min(100, pct));
    }

    /** Round hue/saturation wheel: angle → hue (0 = top, clockwise),
     * radius → saturation; publish on release. */
    _wheelDown(e) {
        if (feezal.isEditor) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        this.__wheelDragging = true;
        this._wheelApply(e, false);
    }

    _wheelMove(e) {
        if (this.__wheelDragging) this._wheelApply(e, false);
    }

    _wheelUp(e) {
        if (!this.__wheelDragging) return;
        this.__wheelDragging = false;
        this._wheelApply(e, true);
    }

    _wheelApply(e, publish) {
        const rect = e.currentTarget.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const hue = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
        const sat = Math.min(1, Math.sqrt(dx * dx + dy * dy) / (rect.width / 2)) * 100;
        // Live preview via the local state; the wire publish happens on release.
        if (this.mode === 'rgb') this._rgb = hsvToRgb(hue, sat / 100, 1);
        else this._hs = [Math.round(hue), Math.round(sat)];
        if (publish) this.setHueSat(hue, sat);
    }

    /** Knob position (CSS %) for the current hue/sat. */
    _wheelKnobPos() {
        const [hue, sat] = this._hueSat();
        const r = (sat / 100) * 50;
        const rad = hue * Math.PI / 180;
        return {x: 50 + r * Math.sin(rad), y: 50 - r * Math.cos(rad)};
    }

    _stateText() {
        if (!this._on) return this.labelOff || 'Off';
        const on = this.labelOn || 'On';
        return this._brt !== null ? `${on} • ${this._brt} %` : on;
    }

    /** Capabilities decide which popup sections exist — NOT the mode alone:
     * brightness is always offered when the lamp is dimmable (Apple Home
     * behaviour); CT and colour additionally show for their topics or, in
     * json mode, when the mode declares them. */
    _capabilities() {
        const mode = this.mode || 'brightness';
        const json = this.payloadMode === 'json';
        return {
            brightness: Boolean(this.subscribeBrightness || this.publishBrightness || json),
            ct: Boolean(this.subscribeColorTemp || this.publishColorTemp ||
                (json && (mode === 'brightness_ct' || mode === 'color_temp'))),
            color: Boolean(this.subscribeRgb || this.publishRgb || this.subscribeHs || this.publishHs ||
                (json && (mode === 'rgb' || mode === 'hs'))),
        };
    }


    /** Place the details popup above the card (below when there is no room),
     * horizontally centred on it, clamped so nothing goes off-screen. */
    _positionDetails() {
        const popup = this.renderRoot.querySelector('.details');
        if (!popup) return;
        const host = this.getBoundingClientRect();
        const pw = popup.offsetWidth;
        const ph = popup.offsetHeight;
        const margin = 8;
        const gap = 12;
        let left = host.left + host.width / 2 - pw / 2;
        left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin));
        let top = host.top - ph - gap;                       // preferred: above
        if (top < margin) top = host.bottom + gap;           // no room -> below
        top = Math.max(margin, Math.min(top, window.innerHeight - ph - margin));
        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
    }

    _renderDetails() {
        const caps = this._capabilities();
        const knob = this._wheelKnobPos();
        return html`
            <div class="details" popover="manual">
                <div class="title">${this.label || 'Light'}</div>
                ${caps.brightness ? html`
                    <div class="vslider"
                        @pointerdown="${this._vsliderDown}"
                        @pointermove="${this._vsliderMove}"
                        @pointerup="${this._vsliderUp}">
                        <div class="fill" style="height:${this._brt ?? 0}%"></div>
                        <feezal-icon name="${this.icon || 'lightbulb'}"></feezal-icon>
                        <div class="pct">${this._brt ?? 0} %</div>
                    </div>` : ''}
                ${caps.ct ? html`
                    <input type="range" class="ct" title="Colour temperature"
                        min="${this.colorTempMin || 2700}" max="${this.colorTempMax || 6500}" step="1"
                        .value="${String(this._colorTemp ?? this.colorTempMin ?? 2700)}"
                        @change="${e => this.setColorTemp(e.target.value)}">` : ''}
                ${caps.color ? html`
                    <div class="wheel"
                        @pointerdown="${this._wheelDown}"
                        @pointermove="${this._wheelMove}"
                        @pointerup="${this._wheelUp}">
                        <div class="knob" style="left:${knob.x}%; top:${knob.y}%"></div>
                    </div>` : ''}
            </div>`;
    }

    render() {
        const caps = this._capabilities();
        const hasDetail = caps.brightness || caps.ct || caps.color;

        return html`
            <div class="card ${this._on ? 'on' : ''}" role="button" tabindex="0"
                @pointerdown="${this._onPointerDown}"
                @pointerup="${this._onPointerUp}"
                @pointerleave="${this._onPointerLeave}"
                @keydown="${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(); } }}">
                ${hasDetail ? html`
                    <button class="flip-btn" title="Details"
                        @pointerdown="${e => e.stopPropagation()}"
                        @pointerup="${e => e.stopPropagation()}"
                        @click="${e => { e.stopPropagation(); this.openDetails(); }}">tune</button>` : ''}
                ${!this._available ? html`<span class="unavail" title="Device unavailable">⚠</span>` : ''}
                <feezal-icon name="${this.icon || 'lightbulb'}"></feezal-icon>
                <span class="state">${this._stateText()}</span>
                <span class="label">${this.label || (feezal.isEditor ? 'Light' : '')}</span>
            </div>
            ${this._details ? this._renderDetails() : ''}
        `;
    }
}

customElements.define('feezal-element-glass-light', FeezalElementGlassLight);

// ── N6 custom inspector ──────────────────────────────────────────────────────
// Two-tab Topics/Config inspector following the material device-card pattern
// (material-cover/-light): capability-gated sections on the Topics tab,
// payload/behaviour settings on Config. Uses <sl-*> without importing
// Shoelace (editor-only).

class FeezalElementGlassLightInspector extends LitElement {
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
            display: flex; align-items: center; gap: 8px; padding: 6px 8px; font-weight: 600;
            background: var(--feezal-bg-sub, #f5f5f5); border-radius: 6px 6px 0 0;
        }
        .sec-head.collapsed { border-radius: 6px; }
        .sec-title { flex: 1; }
        .sec-body { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
        .field { display: flex; flex-direction: column; gap: 2px; }
        .field > label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; }
        sl-input, sl-select { width: 100%; }
        sl-input::part(form-control-label), sl-select::part(form-control-label) { color: var(--sl-input-label-color, inherit); font-size: 12px; }
        sl-input::part(base), sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        sl-switch { color: var(--feezal-color, inherit); }
        .row { display: flex; gap: 6px; }
        .row > .field { flex: 1; }
        .hint { font-size: 10px; opacity: 0.55; padding: 0 2px 4px; }
    `;

    constructor() {
        super();
        this.element = null;
        this._tab = 'topics';
        this._open = {};
    }

    willUpdate(changed) {
        if (changed.has('element')) this._open = {};
    }

    _val(name) { return this.element?.getAttribute(name) ?? ''; }
    _emit(name, value, rerender = false) {
        this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
            bubbles: true, composed: true, detail: {name, value},
        }));
        if (rerender) this.requestUpdate();
    }

    _topicInput(attr, label, placeholder = 'mqtt/topic') {
        return html`
            <div class="field">
                <label>${label}</label>
                <feezal-topic-input size="small" placeholder="${placeholder}"
                    value="${this._val(attr)}"
                    @sl-change="${e => this._emit(attr, e.target.value)}"></feezal-topic-input>
            </div>`;
    }

    _textInput(attr, label, placeholder = '') {
        return html`
            <div class="field">
                <label>${label}</label>
                <sl-input size="small" autocomplete="off" placeholder="${placeholder}"
                    value="${this._val(attr)}"
                    @sl-change="${e => this._emit(attr, e.target.value)}"></sl-input>
            </div>`;
    }

    _availabilityEnabled() {
        return this._open.availability || this._val('subscribe-availability') !== '';
    }

    _toggleAvailability(e) {
        if (e.target.checked) {
            this._open = {...this._open, availability: true};
        } else {
            this._emit('subscribe-availability', '');
            this._open = {...this._open, availability: false};
        }
        this.requestUpdate();
    }

    render() {
        if (!this.element) return html``;
        return html`
            <sl-tab-group @sl-tab-show="${e => { this._tab = e.detail.name; }}">
                <sl-tab slot="nav" panel="topics" ?active="${this._tab === 'topics'}">Topics</sl-tab>
                <sl-tab slot="nav" panel="config" ?active="${this._tab === 'config'}">Config</sl-tab>
                <sl-tab-panel name="topics">${this._renderTopics()}</sl-tab-panel>
                <sl-tab-panel name="config">${this._renderConfig()}</sl-tab-panel>
            </sl-tab-group>
        `;
    }

    _renderTopics() {
        const isJson = (this._val('payload-mode') || 'separate') === 'json';
        const availability = this._availabilityEnabled();
        const availabilitySection = html`
            <div class="section">
                <div class="sec-head ${availability ? '' : 'collapsed'}">
                    <span class="sec-title">Availability</span>
                    <sl-switch size="small" ?checked="${availability}"
                        @sl-change="${this._toggleAvailability}"></sl-switch>
                </div>
                ${availability ? html`<div class="sec-body">
                    ${this._topicInput('subscribe-availability', 'Subscribe')}
                </div>` : ''}
            </div>`;

        if (isJson) {
            return html`
                <div class="hint">JSON mode — one topic carries the whole state object ({state, brightness}).</div>
                <div class="section">
                    <div class="sec-head">State &amp; Control</div>
                    <div class="sec-body">
                        ${this._topicInput('subscribe', 'Subscribe (state topic)')}
                        ${this._topicInput('publish', 'Publish (…/set)')}
                    </div>
                </div>
                ${availabilitySection}`;
        }

        const brightnessSource = (this._val('on-off-source') || 'topic') === 'brightness';
        return html`
            ${brightnessSource ? '' : html`
                <div class="section">
                    <div class="sec-head">On / Off</div>
                    <div class="sec-body">
                        ${this._topicInput('subscribe-state', 'Subscribe (falls back to subscribe)')}
                        ${this._topicInput('publish-state', 'Publish')}
                    </div>
                </div>`}
            <div class="section">
                <div class="sec-head">Brightness</div>
                <div class="sec-body">
                    ${this._topicInput('subscribe-brightness', 'Subscribe')}
                    ${this._topicInput('publish-brightness', 'Publish')}
                </div>
            </div>
            <div class="section">
                <div class="sec-head">Color Temperature</div>
                <div class="sec-body">
                    ${this._topicInput('subscribe-color-temp', 'Subscribe')}
                    ${this._topicInput('publish-color-temp', 'Publish')}
                </div>
            </div>
            <div class="section">
                <div class="sec-head">Color — RGB / HS</div>
                <div class="sec-body">
                    ${this._topicInput('subscribe-rgb', 'Subscribe RGB')}
                    ${this._topicInput('publish-rgb', 'Publish RGB')}
                    ${this._topicInput('subscribe-hs', 'Subscribe HS')}
                    ${this._topicInput('publish-hs', 'Publish HS')}
                </div>
            </div>
            ${availabilitySection}`;
    }

    _renderConfig() {
        return html`
            <div class="section">
                <div class="sec-head">Wiring</div>
                <div class="sec-body">
                    <div class="field">
                        <label>Mode (popup sections in json mode)</label>
                        <sl-select size="small" value="${this._val('mode') || 'brightness'}"
                            @sl-change="${e => this._emit('mode', e.target.value, true)}">
                            <sl-option value="brightness">Brightness</sl-option>
                            <sl-option value="brightness_ct">Brightness + Color temp</sl-option>
                            <sl-option value="color_temp">Color temperature</sl-option>
                            <sl-option value="rgb">RGB</sl-option>
                            <sl-option value="hs">Hue / Saturation</sl-option>
                        </sl-select>
                    </div>
                    <div class="field">
                        <label>Payload mode</label>
                        <sl-select size="small" value="${this._val('payload-mode') || 'separate'}"
                            @sl-change="${e => this._emit('payload-mode', e.target.value, true)}">
                            <sl-option value="separate">separate (one topic per property)</sl-option>
                            <sl-option value="json">json (single topic)</sl-option>
                        </sl-select>
                    </div>
                    <div class="field">
                        <label>On/off source</label>
                        <sl-select size="small" value="${this._val('on-off-source') || 'topic'}"
                            @sl-change="${e => this._emit('on-off-source', e.target.value, true)}">
                            <sl-option value="topic">topic (dedicated state topic)</sl-option>
                            <sl-option value="brightness">brightness (derive from level — Homematic)</sl-option>
                        </sl-select>
                    </div>
                    ${(this._val('payload-mode') || 'separate') === 'json'
                        ? this._textInput('json-map', 'JSON key map (optional)', '{"state":"state","brightness":"brightness"}')
                        : ''}
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Payloads &amp; range</div>
                <div class="sec-body">
                    <div class="row">
                        ${this._textInput('payload-on', 'On', 'on')}
                        ${this._textInput('payload-off', 'Off', 'off')}
                    </div>
                    <div class="row">
                        ${this._textInput('brightness-min', 'Brightness min', '0')}
                        ${this._textInput('brightness-max', 'Brightness max', '100')}
                    </div>
                    <div class="field">
                        <label>Color temp unit (topics)</label>
                        <sl-select size="small" value="${this._val('color-temp-unit') || 'kelvin'}"
                            @sl-change="${e => this._emit('color-temp-unit', e.target.value)}">
                            <sl-option value="kelvin">kelvin</sl-option>
                            <sl-option value="mired">mired</sl-option>
                        </sl-select>
                    </div>
                    <div class="row">
                        ${this._textInput('color-temp-min', 'Color temp min (K)', '2700')}
                        ${this._textInput('color-temp-max', 'Color temp max (K)', '6500')}
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Display</div>
                <div class="sec-body">
                    <div class="field">
                        <label>Size</label>
                        <sl-select size="small" value="${this._val('size') || ''}"
                            @sl-change="${e => this._emit('size', e.target.value)}">
                            <sl-option value="">Auto (manual size)</sl-option>
                            <sl-option value="2x2">2x2</sl-option>
                            <sl-option value="2x1">2x1</sl-option>
                        </sl-select>
                    </div>
                    ${this._textInput('label', 'Label', 'Ceiling light')}
                    ${this._textInput('label-on', 'State text on', 'On')}
                    ${this._textInput('label-off', 'State text off', 'Off')}
                    ${this._textInput('icon', 'Icon', 'lightbulb')}
                    <div class="field">
                        <sl-switch size="small" ?checked="${this.element.hasAttribute('degrade')}"
                            @sl-change="${e => this._emit('degrade', e.target.checked || null)}">
                            Degrade (no live blur — weak GPUs)
                        </sl-switch>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Availability payloads</div>
                <div class="sec-body">
                    <div class="row">
                        ${this._textInput('payload-available', 'Online', 'online')}
                        ${this._textInput('payload-unavailable', 'Offline', 'offline')}
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Message property</div>
                <div class="sec-body">
                    <div class="hint">Dot-notation path per topic; blank falls back to the global one.</div>
                    ${this._textInput('message-property', 'Global (all topics)', 'payload')}
                    ${this._textInput('message-property-state', 'On/off topic', 'payload')}
                    ${this._textInput('message-property-brightness', 'Brightness topic', 'payload')}
                    ${this._textInput('message-property-availability', 'Availability topic', 'payload')}
                </div>
            </div>
        `;
    }
}

customElements.define('feezal-element-glass-light-inspector', FeezalElementGlassLightInspector);

export {FeezalElementGlassLight};

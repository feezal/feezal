/* global feezal */
import {html, css} from '@feezal/feezal-element';
import '@feezal/feezal-element/feezal-topic-input.js';
import {LitElement} from 'lit';
import {MetroTileBase} from '@feezal/feezal-element-metro-tile';

/**
 * feezal-element-metro-light (E55)
 *
 * Light tile: tap toggles on/off (whole tile, Metro-style); the back holds
 * the detail controls per `mode` — brightness / brightness+ct / colour
 * temperature / RGB / hue-saturation sliders.
 *
 * The MQTT wiring contract deliberately mirrors material-light:
 *  - payload-mode separate (one topic per property, subscribe-state/
 *    publish-state + per-capability topics) or json (single base topic +
 *    …/set command topic carrying a JSON object — the zigbee2mqtt shape).
 *  - on-off-source topic|brightness — E77 Homematic/HmIP dimmers have no
 *    separate on/off datapoint: off is LEVEL = payload-off, toggle-on
 *    restores the last level (numeric payload-on like 1.005 = OLD_LEVEL is
 *    published verbatim).
 *  - colour temperature in Kelvin locally, kelvin|mired on the wire.
 *  - the discovery descriptor is material-light's (schema → payload-mode,
 *    capability ranges, supported_color_modes → mode), so auto-wiring a
 *    zigbee2mqtt light fills brightness/ct/colour exactly like the card.
 * Not carried over (tile scope): effects, white channels, availability.
 */

// ── Helpers (private in material-light — duplicated, keep in sync) ──────────
export function pctToRaw(pct, min, max) {
    return Math.round((min + (pct / 100) * (max - min)) * 100) / 100;
}

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

class FeezalElementMetroLight extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Light', category: 'Metro', color: '#1ba1e2', icon: 'lightbulb'},
            description: 'Metro light tile: tap toggles; the back holds the mode\'s detail sliders (brightness / colour temperature / RGB / hue-saturation). Wiring contract identical to material-light incl. json payload mode and brightness-derived on/off (HmIP/Homematic dimmers).',
            inspector: 'feezal-element-metro-light-inspector',
            // material-light's discovery descriptor (minus effects/availability):
            // zigbee2mqtt / HA discovery emits the JSON schema → payload-mode
            // json with base topic + …/set, capability ranges + active mode.
            discovery: {
                component: 'light',
                map: {
                    schema:        {attr: 'payload-mode', valueMap: {json: 'json', _default: 'separate'}},
                    state_topic:   'subscribe',
                    command_topic: {attr: 'publish', onlyWhen: {schema: 'json'}},
                    brightness_state_topic:   'subscribe-brightness',
                    brightness_command_topic: 'publish-brightness',
                    brightness_scale:         {attr: 'brightness-max'},
                    color_temp_state_topic:   'subscribe-color-temp',
                    color_temp_command_topic: 'publish-color-temp',
                    supported_color_modes:    {attr: 'mode', transform: 'colorMode'},
                    min_mireds: {attr: 'color-temp-max', unit: 'mired→kelvin', alsoSet: {'color-temp-unit': 'mired'}},
                    max_mireds: {attr: 'color-temp-min', unit: 'mired→kelvin'},
                    // E108 native Homematic (separate-mode dimmer) — HA-absent keys,
                    // additive (brightness_state/command_topic already mapped above).
                    // NOTE: metro-light has no availability attributes (tile scope),
                    // so availability_normalized is stamped but harmlessly ignored.
                    payload_mode:             'payload-mode',
                    brightness_min:           {attr: 'brightness-min'},
                    on_off_source:            'on-off-source',
                    payload_off:              'payload-off',
                    payload_on:               'payload-on',
                    message_property:             'message-property',
                    message_property_brightness:  'message-property-brightness',
                    message_property_state:       'message-property-state',
                    name: 'label',
                    // NO value_template mapping (matches material-light): in
                    // json mode message-property must stay 'payload' — the
                    // whole state object, not a leaf like payload.state.
                },
            },
            attributes: [
                ...MetroTileBase.tileAttributes,
                // Wiring mode (material-light contract)
                {name: 'payload-mode', type: 'select', options: ['separate', 'json'], default: 'separate', help: 'separate = one topic per property; json = single topic carrying a JSON object.'},
                {name: 'subscribe', type: 'mqttTopic', help: 'JSON mode: base topic carrying the whole state JSON object. Separate mode: on/off state topic (subscribe-state takes precedence).'},
                {name: 'publish',   type: 'mqttTopic', help: 'json mode: command topic (usually …/set) that accepts a partial JSON object.'},
                {name: 'json-map',  type: 'string', default: '', help: 'json mode: optional JSON string overriding the default property→key map.'},
                {name: 'message-property', type: 'string', default: 'payload', help: 'Property path within message payloads (dot-notation). json mode: extracts the JSON state object; separate mode: global fallback for all topics.'},
                // On/off
                {name: 'on-off-source', type: 'select', options: ['topic', 'brightness'], default: 'topic',
                    help: 'topic = dedicated on/off state topic; brightness = derive on/off from the brightness value (off when it equals payload-off — e.g. Homematic/HmIP dimmers, LEVEL 0–1).'},
                {name: 'subscribe-state', type: 'mqttTopic', help: 'Separate mode: on/off state topic. Falls back to `subscribe` when empty.'},
                {name: 'message-property-state', type: 'string', default: 'payload', help: 'Property path for the on/off state topic. Defaults to message-property.'},
                {name: 'publish-state', type: 'mqttTopic', help: 'Topic to publish on/off.'},
                {name: 'payload-on',  type: 'string', default: 'on',  help: 'Payload representing "on". on-off-source=brightness: compared against / published to the brightness topic; Homematic: 1.005 restores the last brightness (OLD_LEVEL).'},
                {name: 'payload-off', type: 'string', default: 'off', help: 'Payload representing "off". on-off-source=brightness: numeric value compared against the brightness topic (non-numeric falls back to brightness-min).'},
                // Brightness
                {name: 'subscribe-brightness', type: 'mqttTopic', help: 'Current brightness topic.'},
                {name: 'message-property-brightness', type: 'string', default: 'payload', help: 'Property path for brightness topic. Defaults to message-property.'},
                {name: 'publish-brightness', type: 'mqttTopic', help: 'Publish brightness on slider release.'},
                {name: 'brightness-min', type: 'number', default: 0,   help: 'Minimum brightness value on the MQTT topic.'},
                {name: 'brightness-max', type: 'number', default: 100, help: 'Maximum brightness value on the MQTT topic (255 for zigbee2mqtt, 1 for HmIP LEVEL).'},
                // Colour temperature
                {name: 'subscribe-color-temp', type: 'mqttTopic', help: 'Current colour temperature.'},
                {name: 'message-property-color-temp', type: 'string', default: 'payload', help: 'Property path for colour-temperature topic. Defaults to message-property.'},
                {name: 'publish-color-temp', type: 'mqttTopic', help: 'Publish colour temperature.'},
                {name: 'color-temp-unit', type: 'select', options: ['kelvin', 'mired'], default: 'kelvin', help: 'Unit used on colour-temp topics.'},
                {name: 'color-temp-min', type: 'number', default: 2700, help: 'Minimum colour temperature (K).'},
                {name: 'color-temp-max', type: 'number', default: 6500, help: 'Maximum colour temperature (K).'},
                // RGB / HS
                {name: 'subscribe-rgb', type: 'mqttTopic', help: 'Current RGB value (JSON [r,g,b] or "r,g,b").'},
                {name: 'message-property-rgb', type: 'string', default: 'payload', help: 'Property path for RGB topic. Defaults to message-property.'},
                {name: 'publish-rgb', type: 'mqttTopic', help: 'Publish RGB value as JSON [r,g,b].'},
                {name: 'subscribe-hs', type: 'mqttTopic', help: 'Current hue/saturation (JSON [h,s]).'},
                {name: 'message-property-hs', type: 'string', default: 'payload', help: 'Property path for hue/saturation topic. Defaults to message-property.'},
                {name: 'publish-hs', type: 'mqttTopic', help: 'Publish hue/saturation as JSON [h,s].'},
                // Mode
                {name: 'mode', type: 'select', options: ['brightness', 'brightness_ct', 'color_temp', 'rgb', 'hs'], default: 'brightness', help: 'Detail controls shown on the tile back.'},
                // State icons
                {name: 'icon-on',  type: 'icon', help: 'Icon shown while ON (empty = the base icon).'},
                {name: 'icon-off', type: 'icon', help: 'Icon shown while OFF (empty = the base icon).'},
            ],
            styles: [
                ...MetroTileBase.tileStyles,
                {property: '--feezal-metro-off-color', type: 'color', default: '#333333', help: 'Tile colour in the OFF state.'},
            ],
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
        };
    }

    static properties = {
        payloadMode:   {type: String, reflect: true, attribute: 'payload-mode'},
        publish:       {type: String, reflect: true},
        jsonMap:       {type: String, reflect: true, attribute: 'json-map'},
        onOffSource:   {type: String, reflect: true, attribute: 'on-off-source'},
        subscribeState: {type: String, reflect: true, attribute: 'subscribe-state'},
        msgPropState:   {type: String, reflect: true, attribute: 'message-property-state'},
        publishState:   {type: String, reflect: true, attribute: 'publish-state'},
        payloadOn:      {type: String, reflect: true, attribute: 'payload-on'},
        payloadOff:     {type: String, reflect: true, attribute: 'payload-off'},
        subscribeBrightness: {type: String, reflect: true, attribute: 'subscribe-brightness'},
        msgPropBrightness:   {type: String, reflect: true, attribute: 'message-property-brightness'},
        publishBrightness:   {type: String, reflect: true, attribute: 'publish-brightness'},
        brightnessMin: {type: Number, reflect: true, attribute: 'brightness-min'},
        brightnessMax: {type: Number, reflect: true, attribute: 'brightness-max'},
        subscribeColorTemp: {type: String, reflect: true, attribute: 'subscribe-color-temp'},
        msgPropColorTemp:   {type: String, reflect: true, attribute: 'message-property-color-temp'},
        publishColorTemp:   {type: String, reflect: true, attribute: 'publish-color-temp'},
        colorTempUnit: {type: String, reflect: true, attribute: 'color-temp-unit'},
        colorTempMin:  {type: Number, reflect: true, attribute: 'color-temp-min'},
        colorTempMax:  {type: Number, reflect: true, attribute: 'color-temp-max'},
        subscribeRgb: {type: String, reflect: true, attribute: 'subscribe-rgb'},
        msgPropRgb:   {type: String, reflect: true, attribute: 'message-property-rgb'},
        publishRgb:   {type: String, reflect: true, attribute: 'publish-rgb'},
        subscribeHs:  {type: String, reflect: true, attribute: 'subscribe-hs'},
        msgPropHs:    {type: String, reflect: true, attribute: 'message-property-hs'},
        publishHs:    {type: String, reflect: true, attribute: 'publish-hs'},
        mode:         {type: String, reflect: true},
        iconOn:       {type: String, reflect: true, attribute: 'icon-on'},
        iconOff:      {type: String, reflect: true, attribute: 'icon-off'},
        discoveryId:  {type: String, reflect: true, attribute: 'discovery-id'},
        _on:        {state: true},
        _brt:       {state: true},   // brightness 0–100 %
        _colorTemp: {state: true},   // Kelvin
        _rgb:       {state: true},   // [r, g, b]
        _hs:        {state: true},   // [h 0–360, s 0–100]
    };

    static styles = [MetroTileBase.styles, css`
        :host { --feezal-metro-off-color: #333; }
        .face { transition: background 0.15s; }
        :host(:not([data-on])) .face { background: var(--feezal-metro-off-color); }
        .state { font-size: 12px; text-transform: lowercase; opacity: 0.85; }
        .onoff { display: flex; justify-content: center; gap: 8px; }
        input[type='range'].hue {
            background: linear-gradient(to right,
                #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
            height: 8px;
        }
        input[type='range'].ct {
            background: linear-gradient(to right, #ff8c00, #fff8ee 50%, #aac4ff);
            height: 8px;
        }
    `];

    constructor() {
        super();
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
        this.mode = 'brightness';
        this.iconOn = '';
        this.iconOff = '';
        this.discoveryId = '';
        this._on = false;
        this._brt = null;
        this._colorTemp = null;
        this._rgb = null;
        this._hs = null;
        // E77: widget-remembered last non-off brightness % for toggle-on restore
        this._lastBrt = null;
    }

    // Fully self-managed subscriptions (like material-light) — suppress the
    // generic base path, which would treat the json base topic as a control
    // channel.
    _subscribe() { /* intentionally empty — see connectedCallback */ }

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
                    // Tolerance: message-property pointing at a leaf (e.g.
                    // payload.state) — in json mode the extractor must yield
                    // the whole state OBJECT; fall back to the payload itself
                    // instead of silently ignoring every message.
                    if ((obj === null || typeof obj !== 'object') && msg.payload && typeof msg.payload === 'object') {
                        obj = msg.payload;
                    }
                    if (obj && typeof obj === 'object') this._applyJsonState(obj);
                });
            }
            return;
        }

        // Separate (per-topic) mode — state topic skipped in E77 brightness
        // mode (the brightness value is the single source of truth there).
        const stateTopic = this.subscribeState || this.subscribe;
        if (stateTopic && this.onOffSource !== 'brightness') {
            this.addSubscription(stateTopic, msg => {
                let v = this.getProperty(msg, this.msgPropState || this.messageProperty);
                // Tolerance: a JSON object on the state topic (zigbee2mqtt
                // base topic wired in separate mode — e.g. stale pre-json
                // discovery wiring). Read its state/brightness keys instead
                // of silently matching nothing.
                if (v && typeof v === 'object') {
                    const map = this._jsonMap;
                    const bri = Number(this.getProperty(v, map.brightness));
                    if (!isNaN(bri)) this._brt = Math.max(0, Math.min(100, (bri / (this.brightnessMax || 100)) * 100));
                    v = this.getProperty(v, map.state);
                }
                this._on = v === this.payloadOn || v === true || v === 1 || v === '1' ||
                           (typeof v === 'string' && v.toLowerCase() === 'on');
            });
        }
        if (this.subscribeBrightness) {
            this.addSubscription(this.subscribeBrightness, msg => {
                const v = Number(this.getProperty(msg, this.msgPropBrightness || this.messageProperty));
                if (!isNaN(v)) {
                    const min = this.brightnessMin ?? 0;
                    const max = this.brightnessMax ?? 100;
                    this._brt = max === min ? 0 : Math.max(0, Math.min(100, (v - min) / (max - min) * 100));
                    if (this.onOffSource === 'brightness') {
                        this._on = v !== this._effOffRaw();
                        if (this._on) this._lastBrt = this._brt;
                    }
                }
            });
        }
        if (this.subscribeColorTemp) {
            this.addSubscription(this.subscribeColorTemp, msg => {
                let v = Number(this.getProperty(msg, this.msgPropColorTemp || this.messageProperty));
                if (!isNaN(v)) {
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

    // ── JSON payload mode (material-light contract) ───────────────────────────

    get _jsonMap() {
        const defaults = {
            state: 'state', brightness: 'brightness',
            color_mode: 'color_mode', color_temp: 'color_temp', color: 'color',
        };
        if (this.jsonMap) {
            try { return {...defaults, ...JSON.parse(this.jsonMap)}; } catch { /* fall through */ }
        }
        return defaults;
    }

    _applyJsonState(obj) {
        const map = this._jsonMap;
        const get = key => this.getProperty(obj, key);

        const state = get(map.state);
        if (state !== undefined && state !== null) {
            const s = String(state).toLowerCase();
            this._on = state === this.payloadOn || state === true || state === 1 ||
                       s === 'on' || s === 'true' || s === '1';
        }

        const bri = Number(get(map.brightness));
        if (!isNaN(bri)) {
            const max = this.brightnessMax || 100;
            this._brt = Math.max(0, Math.min(100, (bri / max) * 100));
            if (state === undefined || state === null) this._on = bri > 0;
        }

        let ct = Number(get(map.color_temp));
        if (!isNaN(ct)) {
            if (this.colorTempUnit === 'mired') ct = Math.round(1_000_000 / ct);
            this._colorTemp = ct;
        }

        const color = get(map.color);
        if (color && typeof color === 'object') {
            if (color.hue !== undefined || color.h !== undefined) {
                this._hs = [Number(color.hue ?? color.h), Number(color.saturation ?? color.s ?? 100)];
            } else if (color.r !== undefined) {
                this._rgb = [Number(color.r), Number(color.g), Number(color.b)];
            } else if (color.x !== undefined && color.y !== undefined) {
                this._rgb = xyToRgb(Number(color.x), Number(color.y));
            }
        }
    }

    /** json mode: merged object to `publish`; separate mode: value to topic. */
    _pub(topic, value, jsonObj) {
        if (this.payloadMode === 'json') {
            if (this.publish) feezal.connection.pub(this.publish, JSON.stringify(jsonObj));
        } else if (topic) {
            feezal.connection.pub(topic, value);
        }
    }

    // ── On/off (incl. E77 brightness-derived) ─────────────────────────────────

    _effOffRaw() {
        const n = Number(this.payloadOff);
        return (this.payloadOff !== '' && this.payloadOff !== null && !isNaN(n))
            ? n
            : (this.brightnessMin ?? 0);
    }

    baseAction() {
        if (feezal.isEditor) return;   // also reachable from the back-face buttons
        if (this.payloadMode !== 'json' && this.onOffSource === 'brightness') {
            this._toggleViaBrightness();
            return;
        }
        this._on = !this._on;
        const payload = this._on ? this.payloadOn : this.payloadOff;
        this._pub(this.publishState || this.publish, payload, {[this._jsonMap.state]: payload});
    }

    _toggleViaBrightness() {
        const min = this.brightnessMin ?? 0;
        const max = this.brightnessMax ?? 100;
        if (this._on) {
            this._on = false;
            this._brt = 0;
            const offNum = Number(this.payloadOff);
            const raw = (this.payloadOff !== '' && !isNaN(offNum)) ? String(this.payloadOff) : String(min);
            this._pub(this.publishBrightness, raw, {[this._jsonMap.brightness]: raw});
            return;
        }

        this._on = true;
        const onNum = Number(this.payloadOn);
        if (this.payloadOn !== '' && !isNaN(onNum)) {
            // Numeric payload-on published verbatim (Homematic OLD_LEVEL 1.005
            // = "restore last level"); in-range values predict the local %.
            this._pub(this.publishBrightness, String(this.payloadOn), {[this._jsonMap.brightness]: onNum});
            if (onNum >= Math.min(min, max) && onNum <= Math.max(min, max)) {
                this._brt = max === min ? 0 : Math.max(0, Math.min(100, (onNum - min) / (max - min) * 100));
            }
        } else {
            const pct = this._lastBrt ?? 100;
            this._brt = pct;
            const raw = pctToRaw(pct, min, max);
            this._pub(this.publishBrightness, String(raw), {[this._jsonMap.brightness]: raw});
        }
    }

    // ── Back-face slider handlers ─────────────────────────────────────────────

    _onBrt(e) {
        if (feezal.isEditor) return;
        const pct = Number(e.target.value);
        this._brt = pct;
        // E77: in brightness mode the level IS the on/off state.
        if (this.payloadMode !== 'json' && this.onOffSource === 'brightness') {
            this._on = pct > 0;
            if (pct > 0) this._lastBrt = pct;
        }
        const raw = pctToRaw(pct, this.brightnessMin ?? 0, this.brightnessMax ?? 100);
        const jsonRaw = pctToRaw(pct, 0, this.brightnessMax || 100);
        this._pub(this.publishBrightness, String(raw), {[this._jsonMap.brightness]: jsonRaw});
    }

    _onCt(e) {
        if (feezal.isEditor) return;
        const ct = Number(e.target.value);
        this._colorTemp = ct;
        const v = this.colorTempUnit === 'mired' ? Math.round(1_000_000 / ct) : ct;
        this._pub(this.publishColorTemp, String(v), {[this._jsonMap.color_temp]: v});
    }

    _onHueSat(hue, sat) {
        if (feezal.isEditor) return;
        if (this.mode === 'rgb') {
            const rgb = hsvToRgb(hue, sat / 100, 1);
            this._rgb = rgb;
            this._pub(this.publishRgb, JSON.stringify(rgb),
                {[this._jsonMap.color]: {r: rgb[0], g: rgb[1], b: rgb[2]}});
        } else {
            const hs = [Math.round(hue), Math.round(sat)];
            this._hs = hs;
            this._pub(this.publishHs, JSON.stringify(hs),
                {[this._jsonMap.color]: {hue: hs[0], saturation: hs[1]}});
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

    updated(changed) {
        super.updated(changed);
        if (changed.has('_on')) this.toggleAttribute('data-on', this._on);
        // Topic/mode attributes changed at runtime → drop the old
        // subscriptions and wire the new ones (fresh subscriptions also
        // trigger the broker's retained replay for the new topics).
        if (this.isConnected && this.__wireSig !== undefined && this._wireSignature() !== this.__wireSig) {
            this._unsubscribe();
            this._wireSubscriptions();
        }
    }

    // ── Faces ─────────────────────────────────────────────────────────────────

    renderFront() {
        const pct = this._brt !== null && this._on ? ` ${Math.round(this._brt)}%` : '';
        const icon = (this._on ? this.iconOn : this.iconOff) || this.icon;
        return html`
            ${icon ? html`<feezal-icon name="${icon}"></feezal-icon>` : ''}
            <div class="state">${this._on ? `on${pct}` : 'off'}</div>`;
    }

    renderBack() {
        const mode = this.mode || 'brightness';
        const showBrt = mode === 'brightness' || mode === 'brightness_ct';
        const showCt = mode === 'brightness_ct' || mode === 'color_temp';
        const showColor = mode === 'rgb' || mode === 'hs';
        const [hue, sat] = this._hueSat();
        return html`
            <div class="onoff">
                <button class="mbtn ${this._on ? 'active' : ''}" @click="${() => { if (!this._on) this.baseAction(); }}">ON</button>
                <button class="mbtn ${this._on ? '' : 'active'}" @click="${() => { if (this._on) this.baseAction(); }}">OFF</button>
            </div>
            ${showBrt ? html`
                <div class="rowline">
                    <feezal-icon name="brightness_6"></feezal-icon>
                    <input type="range" min="0" max="100" step="1"
                        .value="${String(this._brt ?? 0)}" @change="${this._onBrt}">
                </div>` : ''}
            ${showCt ? html`
                <div class="rowline">
                    <feezal-icon name="thermostat"></feezal-icon>
                    <input type="range" class="ct" min="${this.colorTempMin || 2700}" max="${this.colorTempMax || 6500}" step="1"
                        .value="${String(this._colorTemp ?? this.colorTempMin ?? 2700)}" @change="${this._onCt}">
                </div>` : ''}
            ${showColor ? html`
                <div class="rowline">
                    <feezal-icon name="palette"></feezal-icon>
                    <input type="range" class="hue" min="0" max="360" step="1"
                        .value="${String(hue)}" @change="${e => this._onHueSat(Number(e.target.value), sat)}">
                </div>
                <div class="rowline">
                    <feezal-icon name="opacity"></feezal-icon>
                    <input type="range" min="0" max="100" step="1"
                        .value="${String(sat)}" @change="${e => this._onHueSat(hue, Number(e.target.value))}">
                </div>` : ''}`;
    }
}

customElements.define('feezal-element-metro-light', FeezalElementMetroLight);
export {FeezalElementMetroLight};

// ─── N6 custom inspector ─────────────────────────────────────────────────────
// Mirrors material-light's inspector: Topics tab (json mode = single State &
// Control section; separate mode = State + capability-gated sections, with
// the E77 hint when on/off derives from brightness) and a Config tab (mode,
// payload mode, on/off source, payloads, scales, tile settings).
const METRO_LIGHT_SECTIONS = [
    {id: 'brightness', title: 'Brightness', topics: [
        {attr: 'subscribe-brightness', label: 'Subscribe'},
        {attr: 'publish-brightness',   label: 'Publish'},
    ]},
    {id: 'color_temp', title: 'Color Temperature', topics: [
        {attr: 'subscribe-color-temp', label: 'Subscribe'},
        {attr: 'publish-color-temp',   label: 'Publish'},
    ]},
    {id: 'color', title: 'Color — RGB / HS', topics: [
        {attr: 'subscribe-rgb', label: 'Subscribe RGB'},
        {attr: 'publish-rgb',   label: 'Publish RGB'},
        {attr: 'subscribe-hs',  label: 'Subscribe HS'},
        {attr: 'publish-hs',    label: 'Publish HS'},
    ]},
];

class FeezalElementMetroLightInspector extends LitElement {
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
        sl-input::part(form-control-label), sl-select::part(form-control-label) { color: var(--sl-input-label-color, inherit); font-size: 12px; }
        sl-input::part(base), sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        sl-switch { color: var(--feezal-color, inherit); }
        .row { display: flex; gap: 6px; }
        .row > .field { flex: 1; min-width: 0; }
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
                <feezal-topic-input size="small" placeholder="mqtt/topic" value="${this._val(t.attr)}"
                    @sl-change="${e => this._emit(t.attr, e.target.value)}"></feezal-topic-input>
            </div>`;
    }

    _numInput(attr, label, placeholder) {
        return html`
            <div class="field">
                <label>${label}</label>
                <sl-input size="small" type="number" autocomplete="off" placeholder="${placeholder ?? ''}"
                    value="${this._val(attr)}" @sl-change="${e => this._emit(attr, e.target.value)}"></sl-input>
            </div>`;
    }

    render() {
        if (!this.element) return html``;
        return html`
            <sl-tab-group @sl-tab-show="${e => { this._tab = e.detail.name; }}">
                <sl-tab slot="nav" panel="topics" ?active="${this._tab === 'topics'}">Topics</sl-tab>
                <sl-tab slot="nav" panel="config" ?active="${this._tab === 'config'}">Config</sl-tab>
                <sl-tab-panel name="topics">${this._renderTopics()}</sl-tab-panel>
                <sl-tab-panel name="config">${this._renderConfig()}</sl-tab-panel>
            </sl-tab-group>`;
    }

    _renderTopics() {
        // json mode → single State & Control section (material-light pattern)
        if (this._val('payload-mode') === 'json') {
            return html`
                <div class="hint">JSON mode — one topic carries the whole state object.</div>
                <div class="section">
                    <div class="sec-head">State &amp; Control</div>
                    <div class="sec-body">
                        ${this._topicInput({attr: 'subscribe', label: 'Subscribe (state)'})}
                        ${this._topicInput({attr: 'publish',   label: 'Publish (…/set)'})}
                    </div>
                </div>`;
        }

        // separate mode → State + capability-gated sections. E77: with
        // on-off-source=brightness the state topics are unused.
        const brightnessSource = (this._val('on-off-source') || 'topic') === 'brightness';
        return html`
            <div class="section">
                <div class="sec-head">State</div>
                <div class="sec-body">
                    ${brightnessSource ? html`
                        <div class="hint">On/off derives from the <b>Brightness</b> topic
                            (On/off source: brightness) — state topics are unused.</div>
                    ` : html`
                        ${this._topicInput({attr: 'subscribe-state', label: 'Subscribe'})}
                        ${this._topicInput({attr: 'publish-state',   label: 'Publish'})}
                    `}
                </div>
            </div>
            ${METRO_LIGHT_SECTIONS.map(sec => {
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
        const isJson = this._val('payload-mode') === 'json';
        const ctEnabled = isJson || this._sectionEnabled(METRO_LIGHT_SECTIONS[1]);
        const brEnabled = isJson || this._sectionEnabled(METRO_LIGHT_SECTIONS[0]);
        return html`
            <div class="section">
                <div class="sec-head">Mode</div>
                <div class="sec-body">
                    <div class="field">
                        <label>Active control</label>
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
                    ${isJson ? '' : html`
                        <div class="field">
                            <label>On/off source</label>
                            <sl-select size="small" value="${this._val('on-off-source') || 'topic'}"
                                @sl-change="${e => this._emit('on-off-source', e.target.value, true)}">
                                <sl-option value="topic">topic (dedicated state topic)</sl-option>
                                <sl-option value="brightness">brightness (HmIP/Homematic dimmers)</sl-option>
                            </sl-select>
                        </div>`}
                </div>
            </div>
            <div class="section">
                <div class="sec-head">State payloads</div>
                <div class="sec-body">
                    <div class="row">
                        <div class="field"><label>ON</label>
                            <sl-input size="small" autocomplete="off" placeholder="on" value="${this._val('payload-on')}"
                                @sl-change="${e => this._emit('payload-on', e.target.value)}"></sl-input></div>
                        <div class="field"><label>OFF</label>
                            <sl-input size="small" autocomplete="off" placeholder="off" value="${this._val('payload-off')}"
                                @sl-change="${e => this._emit('payload-off', e.target.value)}"></sl-input></div>
                    </div>
                    <div class="field"><label>message-property</label>
                        <sl-input size="small" autocomplete="off" placeholder="payload" value="${this._val('message-property')}"
                            @sl-change="${e => this._emit('message-property', e.target.value)}"></sl-input></div>
                </div>
            </div>
            ${brEnabled ? html`
                <div class="section">
                    <div class="sec-head">Brightness scale</div>
                    <div class="sec-body">
                        <div class="row">
                            ${this._numInput('brightness-min', 'Min', '0')}
                            ${this._numInput('brightness-max', 'Max (255 = z2m, 1 = HmIP)', '100')}
                        </div>
                    </div>
                </div>` : ''}
            ${ctEnabled ? html`
                <div class="section">
                    <div class="sec-head">Color temperature</div>
                    <div class="sec-body">
                        <div class="field">
                            <label>Topic unit</label>
                            <sl-select size="small" value="${this._val('color-temp-unit') || 'kelvin'}"
                                @sl-change="${e => this._emit('color-temp-unit', e.target.value)}">
                                <sl-option value="kelvin">kelvin</sl-option>
                                <sl-option value="mired">mired</sl-option>
                            </sl-select>
                        </div>
                        <div class="row">
                            ${this._numInput('color-temp-min', 'Min (K)', '2700')}
                            ${this._numInput('color-temp-max', 'Max (K)', '6500')}
                        </div>
                    </div>
                </div>` : ''}
            <div class="section">
                <div class="sec-head">Tile</div>
                <div class="sec-body">
                    <div class="field"><label>Label</label>
                        <sl-input size="small" autocomplete="off" value="${this._val('label')}"
                            @sl-change="${e => this._emit('label', e.target.value)}"></sl-input></div>
                    <div class="field"><label>Icon</label>
                        <feezal-icon-input .value="${this._val('icon')}"
                            @feezal-change="${e => { e.stopPropagation(); this._emit('icon', e.detail.value); }}"></feezal-icon-input></div>
                    <div class="row">
                        <div class="field"><label>Icon ON</label>
                            <feezal-icon-input .value="${this._val('icon-on')}"
                                @feezal-change="${e => { e.stopPropagation(); this._emit('icon-on', e.detail.value); }}"></feezal-icon-input></div>
                        <div class="field"><label>Icon OFF</label>
                            <feezal-icon-input .value="${this._val('icon-off')}"
                                @feezal-change="${e => { e.stopPropagation(); this._emit('icon-off', e.detail.value); }}"></feezal-icon-input></div>
                    </div>
                    <div class="field"><label>Size</label>
                        <sl-select size="small" value="${this._val('size')}"
                            @sl-change="${e => this._emit('size', e.target.value, true)}">
                            <sl-option value="">manual</sl-option>
                            <sl-option value="1x1">1x1</sl-option>
                            <sl-option value="2x2">2x2</sl-option>
                            <sl-option value="4x2">4x2</sl-option>
                            <sl-option value="4x4">4x4</sl-option>
                        </sl-select></div>
                </div>
            </div>`;
    }
}

customElements.define('feezal-element-metro-light-inspector', FeezalElementMetroLightInspector);
export {FeezalElementMetroLightInspector};

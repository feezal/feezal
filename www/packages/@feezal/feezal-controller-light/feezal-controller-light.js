/**
 * @feezal/feezal-controller-light (E137 — the light slice)
 *
 * The smart-light MQTT contract as a Lit Reactive Controller — the ENTIRE
 * behavior extracted from the light cards: both payload modes (json = z2m /
 * HA single-topic, separate = per-property topics), on/off (dedicated topic
 * OR derived from brightness — E77 Homematic dimmers incl. the 1.005
 * OLD_LEVEL restore and the widget-remembered last level), brightness
 * min/max scaling (pctToRaw — sub-integer ranges survive), E127 ramp
 * settling folded BEHIND the command surface (elements no longer touch
 * SettlingController), colour temperature (kelvin/mired), RGB / HS colour,
 * effects, and the white/warm-white/cold-white channels.
 *
 * The family element is a VIEW: it reads the controller's plain state
 * fields, renders its own chrome (ring, pill, tile, 1-bit block), and
 * forwards gestures to the commands (`toggle`, `setBrightnessPct`,
 * `setColorTempK`, `pickColor`, `setEffect`, `setWhite`).
 *
 * E137 packaging: controller + attribute fragment + discovery.map fragment
 * as one unit; `LIGHT_CONSUMED_ATTRIBUTES` feeds the E114 parity derivation.
 * Colour/scaling machinery is cross-controller (shared with wled) and lives
 * in @feezal/feezal-element/feezal-color.js — re-exported here.
 */

import {SettlingController} from '@feezal/feezal-element/feezal-settling.js';
import {pctToRaw, kelvinToRgb, rgbToHex, rgbToHsv, hsvToRgb, parseRgb, xyToRgb}
    from '@feezal/feezal-element/feezal-color.js';

export {pctToRaw, kelvinToRgb, rgbToHex, rgbToHsv, hsvToRgb, parseRgb, xyToRgb};

// E122: attribute rows that only apply to dimmable modes (hidden for a relay
// lamp). Part of the contract, not family chrome — every family's generic
// inspector gates identically; custom inspectors simply ignore it.
const DIMMABLE = {visibleWhen: {attr: 'mode', equals: ['brightness', 'brightness_ct', 'color_temp', 'rgb', 'hs']}};
const CT_ONLY  = {visibleWhen: {attr: 'mode', equals: ['brightness_ct', 'color_temp']}};

/** Shared attribute descriptors — spread into every family's `feezal.attributes`. */
export const lightAttributes = [
    {name: 'payload-mode', type: 'select', options: ['separate', 'json'], default: 'separate', help: 'separate = one topic per property; json = single topic carrying a JSON object.'},
    {name: 'subscribe', type: 'mqttTopic', help: 'JSON mode: base topic carrying the whole state JSON object. Separate mode: on/off state topic. Also serves as base for dynamic attribute overrides via `<subscribe>/#`.'},
    {name: 'publish',   type: 'mqttTopic', help: 'json mode: command topic (usually …/set) that accepts a partial JSON object.'},
    {name: 'json-map',  type: 'string', default: '', help: 'json mode: optional JSON string overriding the default property→key map.'},
    {name: 'message-property',  type: 'string', default: 'payload', help: 'Property path within message payloads (dot-notation). json mode: extracts the JSON state object; separate mode: global fallback for all topics.'},
    // On/off
    {name: 'on-off-source', type: 'select', options: ['topic', 'brightness'], default: 'topic', ...DIMMABLE,
        help: 'topic = dedicated on/off state topic; brightness = derive on/off from the brightness value (off when it equals payload-off — e.g. Homematic dimmers, LEVEL 0–1).'},
    {name: 'subscribe-state',   type: 'mqttTopic', help: 'Separate mode: on/off state topic. Falls back to `subscribe` when empty (back-compat).'},
    {name: 'message-property-state', type: 'string', default: 'payload', help: 'Property path for the on/off state topic. Defaults to message-property.'},
    {name: 'publish-state',     type: 'mqttTopic', help: 'Topic to publish on/off.'},
    {name: 'payload-on',        type: 'string',    default: 'on',  help: 'Payload representing "on". on-off-source=brightness: compared against / published to the brightness topic; Homematic: 1.005 restores the last brightness (OLD_LEVEL).'},
    {name: 'payload-off',       type: 'string',    default: 'off', help: 'Payload representing "off". on-off-source=brightness: numeric value compared against the brightness topic (non-numeric falls back to brightness-min).'},
    // Brightness (E122: hidden in on_off mode — a relay lamp has none)
    {name: 'subscribe-brightness', type: 'mqttTopic', ...DIMMABLE, help: 'Current brightness (0–100 %).'},
    {name: 'publish-brightness',   type: 'mqttTopic', ...DIMMABLE, help: 'Publish brightness on release.'},
    {name: 'brightness-min', type: 'number', default: 0,   size: 'half', ...DIMMABLE, help: 'Minimum brightness value on the MQTT topic.'},
    {name: 'brightness-max', type: 'number', default: 100, size: 'half', ...DIMMABLE, help: 'Maximum brightness value on the MQTT topic.'},
    // E127: ramp settling (absorbed into the light contract — E137)
    {name: 'subscribe-working', type: 'mqttTopic', ...DIMMABLE, help: 'WORKING datapoint topic (true while the level ramps, e.g. hm/status/<dimmer>/WORKING). While true, brightness reports are suppressed instead of making the control jump; false applies the final value. Distinct topic — not a property of the brightness topic.'},
    {name: 'message-property-working', type: 'string', default: 'payload.val', ...DIMMABLE, help: 'Property path for the WORKING topic (mqtt-smarthome publishes {"val": true} → payload.val).'},
    {name: 'subscribe-settled', type: 'mqttTopic', ...DIMMABLE, help: 'Settled-values topic carrying only final levels (RedMatic: …/LEVEL_NOTWORKING). When set, the control follows THIS topic; subscribe-brightness keeps the live % readout updating during ramps.'},
    {name: 'message-property-settled', type: 'string', default: 'payload.val', ...DIMMABLE, help: 'Property path for the settled topic (mqtt-smarthome: payload.val).'},
    {name: 'settle-timeout', type: 'number', default: 5, size: 'half', ...DIMMABLE, help: 'Seconds after a command before the control reconciles to the last reported value (covers interrupted ramps and sentinel commands like 1.005).'},
    {name: 'report-delay-ms', type: 'number', default: 100, size: 'half', ...DIMMABLE, help: 'Only with subscribe-working: delay before showing an incoming brightness report — a WORKING=true arriving within the window suppresses ramp jitter from changes made elsewhere (interfaces deliver WORKING up to ~100 ms late). 0 disables.'},
    // Colour temperature
    {name: 'subscribe-color-temp', type: 'mqttTopic', ...CT_ONLY, help: 'Current colour temperature.'},
    {name: 'publish-color-temp',   type: 'mqttTopic', ...CT_ONLY, help: 'Publish colour temperature.'},
    {name: 'color-temp-unit', type: 'select', options: ['kelvin', 'mired'], default: 'kelvin', ...CT_ONLY, help: 'Unit used on colour-temp topics.'},
    {name: 'color-temp-min',  type: 'number', default: 2700, ...CT_ONLY, help: 'Minimum colour temperature (K).'},
    {name: 'color-temp-max',  type: 'number', default: 6500, ...CT_ONLY, help: 'Maximum colour temperature (K).'},
    // RGB / HS
    {name: 'subscribe-rgb', type: 'mqttTopic', visibleWhen: {attr: 'mode', equals: 'rgb'}, help: 'Current RGB value (JSON [r,g,b] or "r,g,b").'},
    {name: 'publish-rgb',   type: 'mqttTopic', visibleWhen: {attr: 'mode', equals: 'rgb'}, help: 'Publish RGB value as JSON [r,g,b].'},
    {name: 'subscribe-hs',  type: 'mqttTopic', visibleWhen: {attr: 'mode', equals: 'hs'}, help: 'Current hue/saturation (JSON [h,s]).'},
    {name: 'publish-hs',    type: 'mqttTopic', visibleWhen: {attr: 'mode', equals: 'hs'}, help: 'Publish hue/saturation as JSON [h,s].'},
    // Mode (E122: on_off = pure switch)
    {name: 'mode', type: 'select', options: ['on_off', 'brightness', 'brightness_ct', 'color_temp', 'rgb', 'hs'], default: 'brightness', help: 'Control mode. on_off = a lamp that can only be switched (relay/plug): no brightness control.'},
    // Effects
    {name: 'subscribe-effect', type: 'mqttTopic', ...DIMMABLE, help: 'Current effect name.'},
    {name: 'publish-effect',   type: 'mqttTopic', ...DIMMABLE, help: 'Publish selected effect name.'},
    {name: 'effects',          type: 'string',    default: '', ...DIMMABLE, help: 'Comma-separated list of available effect names.'},
    // White / RGBW / RGBWW
    {name: 'subscribe-white',      type: 'mqttTopic', ...DIMMABLE, help: 'White channel (0–100 %) for RGBW lamps.'},
    {name: 'publish-white',        type: 'mqttTopic', ...DIMMABLE, help: 'Publish white channel.'},
    {name: 'subscribe-warm-white', type: 'mqttTopic', ...DIMMABLE, help: 'Warm-white channel (0–100 %) for RGBWW lamps.'},
    {name: 'publish-warm-white',   type: 'mqttTopic', ...DIMMABLE, help: 'Publish warm-white channel.'},
    {name: 'subscribe-cold-white', type: 'mqttTopic', ...DIMMABLE, help: 'Cold-white channel (0–100 %) for RGBWW lamps.'},
    {name: 'publish-cold-white',   type: 'mqttTopic', ...DIMMABLE, help: 'Publish cold-white channel.'},
    // Per-topic message-property overrides (separate mode)
    {name: 'message-property-brightness',  type: 'string', default: 'payload', ...DIMMABLE, help: 'Property path for brightness topic. Defaults to message-property.'},
    {name: 'message-property-color-temp',  type: 'string', default: 'payload', ...CT_ONLY, help: 'Property path for colour-temperature topic. Defaults to message-property.'},
    {name: 'message-property-rgb',         type: 'string', default: 'payload', visibleWhen: {attr: 'mode', equals: 'rgb'}, help: 'Property path for RGB topic. Defaults to message-property.'},
    {name: 'message-property-hs',          type: 'string', default: 'payload', visibleWhen: {attr: 'mode', equals: 'hs'}, help: 'Property path for hue/saturation topic. Defaults to message-property.'},
    {name: 'message-property-effect',      type: 'string', default: 'payload', ...DIMMABLE, help: 'Property path for effect topic. Defaults to message-property.'},
    {name: 'message-property-white',       type: 'string', default: 'payload', ...DIMMABLE, help: 'Property path for white-channel topic. Defaults to message-property.'},
    {name: 'message-property-warm-white',  type: 'string', default: 'payload', ...DIMMABLE, help: 'Property path for warm-white topic. Defaults to message-property.'},
    {name: 'message-property-cold-white',  type: 'string', default: 'payload', ...DIMMABLE, help: 'Property path for cold-white topic. Defaults to message-property.'},
];

/** Shared discovery.map fragment (HA `light` + the E108/E126/E127 native keys). */
export const lightDiscoveryMap = {
    schema:        {attr: 'payload-mode', valueMap: {json: 'json', _default: 'separate'}},
    state_topic:   'subscribe',
    state_command_topic: 'publish-state',
    command_topic: {attr: 'publish', onlyWhen: {schema: 'json'}},
    brightness_scale:      {attr: 'brightness-max'},
    supported_color_modes: {attr: 'mode', transform: 'colorMode'},
    min_mireds: {attr: 'color-temp-max', unit: 'mired→kelvin', alsoSet: {'color-temp-unit': 'mired'}},
    max_mireds: {attr: 'color-temp-min', unit: 'mired→kelvin'},
    effect_list: {attr: 'effects', transform: 'join'},
    payload_mode:             'payload-mode',
    brightness_state_topic:   'subscribe-brightness',
    brightness_command_topic: 'publish-brightness',
    brightness_min:           {attr: 'brightness-min'},
    on_off_source:            'on-off-source',
    payload_off:              'payload-off',
    payload_on:               'payload-on',
    message_property:             'message-property',
    message_property_brightness:  'message-property-brightness',
    message_property_state:       'message-property-state',
    working_topic:            'subscribe-working',
    message_property_working: 'message-property-working',
    settled_topic:            'subscribe-settled',
    message_property_settled: 'message-property-settled',
    name: 'label',
};

/** Attribute names this controller consumes (parity-set derivation, E114). */
export const LIGHT_CONSUMED_ATTRIBUTES = lightAttributes.map(a => a.name);

export class LightController {
    /**
     * @param {import('lit').ReactiveControllerHost & HTMLElement} host
     * @param {object} options — family quirks (none needed yet; flags, not forks).
     */
    constructor(host, options = {}) {
        this.host = host;
        this.options = options;
        host.addController?.(this);
        // ── state (plain fields, E137 decided) ──
        this.on = false;
        this.brt = null;          // brightness 0–100 %
        this.brtLive = null;      // E127 dual-topic: live % readout while the control holds
        this.colorTemp = null;    // Kelvin
        this.rgb = null;          // [r, g, b]
        this.hs = null;           // [h, s]  h: 0–360, s: 0–100
        this.effect = '';
        this.white = null;
        this.warmWhite = null;
        this.coldWhite = null;
        this._lastBrt = null;     // E77: remembered last non-off % for toggle-on restore
        this._settling = null;
    }

    // ── attribute access ─────────────────────────────────────────────────────
    _attr(name, fallback = '') {
        const v = this.host.getAttribute(name);
        return v === null ? fallback : v;
    }

    _num(name, fallback) {
        const v = Number(this._attr(name));
        return this._attr(name) !== '' && Number.isFinite(v) ? v : fallback;
    }

    _prop(msg, specific, fallback) {
        return this.host.getProperty(msg, this._attr(specific) || fallback || this._attr('message-property') || 'payload');
    }

    get payloadMode()   { return this._attr('payload-mode', 'separate'); }
    get mode()          { return this._attr('mode') || 'brightness'; }
    get onOffSource()   { return this._attr('on-off-source', 'topic'); }
    get payloadOn()     { return this._attr('payload-on', 'on'); }
    get payloadOff()    { return this._attr('payload-off', 'off'); }
    get brightnessMin() { return this._num('brightness-min', 0); }
    get brightnessMax() { return this._num('brightness-max', 100); }
    get colorTempMin()  { return this._num('color-temp-min', 2700); }
    get colorTempMax()  { return this._num('color-temp-max', 6500); }
    get colorTempUnit() { return this._attr('color-temp-unit', 'kelvin'); }

    // ── lifecycle ────────────────────────────────────────────────────────────
    signature() {
        return ['payload-mode', 'on-off-source', 'subscribe', 'subscribe-state', 'subscribe-brightness',
            'subscribe-working', 'subscribe-settled', 'settle-timeout', 'report-delay-ms',
            'subscribe-color-temp', 'subscribe-rgb', 'subscribe-hs', 'subscribe-effect',
            'subscribe-white', 'subscribe-warm-white', 'subscribe-cold-white']
            .map(a => this._attr(a)).join('|');
    }

    hostConnected() { this.wire(); }

    hostDisconnected() {
        // E127: clear pending hold/buffer timers with the subscriptions.
        this._settling?.dispose();
        this._settling = null;
    }

    /** Call from the host's updated() to re-wire on live topic edits. */
    rewireIfChanged() {
        if (this.__sig !== undefined && this.signature() !== this.__sig) {
            this.host._unsubscribe();
            this.wire();
        }
    }

    rawToPct(v) {
        const min = this.brightnessMin, max = this.brightnessMax;
        return max === min ? 0 : Math.max(0, Math.min(100, (v - min) / (max - min) * 100));
    }

    /** E77: the raw brightness value that means "off" in brightness mode —
     * numeric payload-off wins, the default 'off' degrades to brightness-min. */
    _effOffRaw() {
        const n = Number(this.payloadOff);
        return (this.payloadOff !== '' && this.payloadOff !== null && !isNaN(n)) ? n : this.brightnessMin;
    }

    wire() {
        this.__sig = this.signature();
        const update = () => this.host.requestUpdate();
        const sub = (topic, cb) => { if (topic) this.host.addSubscription(topic, cb); };

        if (this.payloadMode === 'json') {
            sub(this._attr('subscribe'), msg => {
                let obj = this.host.getProperty(msg, this._attr('message-property') || 'payload');
                if (typeof obj === 'string') {
                    try { obj = JSON.parse(obj); } catch { return; }
                }
                if (obj && typeof obj === 'object') { this.applyJsonState(obj); update(); }
            });
            return;
        }

        // ── Separate (per-topic) mode ──────────────────────────────────────
        // E77: `subscribe-state` with `subscribe` fallback (back-compat);
        // skipped in on-off-source=brightness mode (level is the truth).
        const stateTopic = this._attr('subscribe-state') || this._attr('subscribe');
        if (stateTopic && this.onOffSource !== 'brightness') {
            sub(stateTopic, msg => {
                const v = this._prop(msg, 'message-property-state');
                this.on = v === this.payloadOn || v === true || v === 1 || v === '1' ||
                          (typeof v === 'string' && v.toLowerCase() === 'on');
                update();
            });
        }

        if (this._attr('subscribe-brightness')) {
            // E127: raw brightness reports run through the SettlingController —
            // it decides which ones may reach the control (hold-at-target after
            // an own command, WORKING-gated suppression, settled-values topic).
            const applyBrt = v => {
                this.brt = this.rawToPct(v);
                this.brtLive = null;
                if (this.onOffSource === 'brightness') {
                    this.on = v !== this._effOffRaw();
                    if (this.on) this._lastBrt = this.brt;
                }
                update();
            };
            this._settling?.dispose();
            this._settling = new SettlingController({
                apply: applyBrt,
                timeoutMs: (Math.max(0, this._num('settle-timeout', 5)) || 5) * 1000,
                reportDelayMs: Math.max(0, this._num('report-delay-ms', 100) || 0),
                workingWired: Boolean(this._attr('subscribe-working')),
                settledWired: Boolean(this._attr('subscribe-settled')),
            });
            sub(this._attr('subscribe-brightness'), msg => {
                const v = Number(this._prop(msg, 'message-property-brightness'));
                if (isNaN(v)) return;
                if (this._attr('subscribe-settled')) {
                    // Dual-topic (RedMatic): live topic keeps the % readout
                    // updating during ramps; the control follows settled.
                    this.brtLive = this.rawToPct(v);
                    update();
                }
                this._settling.live(v);
            });
            sub(this._attr('subscribe-working'), msg => {
                const v = this._prop(msg, 'message-property-working', 'payload.val');
                this._settling.working(v === true || v === 'true' || v === 1 || v === '1');
            });
            sub(this._attr('subscribe-settled'), msg => {
                const v = Number(this._prop(msg, 'message-property-settled', 'payload.val'));
                if (!isNaN(v)) this._settling.settled(v);
            });
        }

        sub(this._attr('subscribe-color-temp'), msg => {
            let v = Number(this._prop(msg, 'message-property-color-temp'));
            if (!isNaN(v)) {
                if (this.colorTempUnit === 'mired') v = Math.round(1_000_000 / v);
                this.colorTemp = v;
                update();
            }
        });
        sub(this._attr('subscribe-rgb'), msg => {
            const rgb = parseRgb(this._prop(msg, 'message-property-rgb'));
            if (rgb) { this.rgb = rgb; update(); }
        });
        sub(this._attr('subscribe-hs'), msg => {
            try {
                const raw = this._prop(msg, 'message-property-hs');
                const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (Array.isArray(arr) && arr.length >= 2) { this.hs = arr.slice(0, 2).map(Number); update(); }
            } catch {}
        });
        sub(this._attr('subscribe-effect'), msg => {
            this.effect = String(this._prop(msg, 'message-property-effect') ?? '');
            update();
        });
        const mkWhite = (field, topicAttr, propAttr) => {
            sub(this._attr(topicAttr), msg => {
                const v = Number(this._prop(msg, propAttr));
                if (!isNaN(v)) { this[field] = Math.max(0, Math.min(100, v)); update(); }
            });
        };
        mkWhite('white',     'subscribe-white',      'message-property-white');
        mkWhite('warmWhite', 'subscribe-warm-white', 'message-property-warm-white');
        mkWhite('coldWhite', 'subscribe-cold-white', 'message-property-cold-white');
    }

    // ── json key map ─────────────────────────────────────────────────────────
    get jsonMap() {
        const defaults = {
            state: 'state', brightness: 'brightness',
            color_mode: 'color_mode', color_temp: 'color_temp',
            color: 'color', effect: 'effect',
        };
        const raw = this._attr('json-map');
        if (raw) {
            try { return {...defaults, ...JSON.parse(raw)}; } catch { /* defaults */ }
        }
        return defaults;
    }

    applyJsonState(obj) {
        const map = this.jsonMap;
        const get = key => this.host.getProperty(obj, key);

        const state = get(map.state);
        if (state !== undefined && state !== null) {
            const s = String(state).toLowerCase();
            this.on = state === this.payloadOn || state === true || state === 1 ||
                      s === 'on' || s === 'true' || s === '1';
        }

        const bri = Number(get(map.brightness));
        if (!isNaN(bri)) {
            const max = this.brightnessMax || 100;
            this.brt = Math.max(0, Math.min(100, (bri / max) * 100));
            // E77: no state key in the message → derive on/off from brightness.
            if (state === undefined || state === null) this.on = bri > 0;
        }

        let ct = Number(get(map.color_temp));
        if (!isNaN(ct)) {
            if (this.colorTempUnit === 'mired') ct = Math.round(1_000_000 / ct);
            this.colorTemp = ct;
        }

        const color = get(map.color);
        if (color && typeof color === 'object') {
            if (color.hue !== undefined || color.h !== undefined) {
                this.hs = [Number(color.hue ?? color.h), Number(color.saturation ?? color.s ?? 100)];
            } else if (color.r !== undefined) {
                this.rgb = [Number(color.r), Number(color.g), Number(color.b)];
            } else if (color.x !== undefined && color.y !== undefined) {
                this.rgb = xyToRgb(Number(color.x), Number(color.y));
            }
        }

        const effect = get(map.effect);
        if (effect !== undefined && effect !== null) this.effect = String(effect);
    }

    // ── commands ─────────────────────────────────────────────────────────────
    _pub(topic, value, jsonObj) {
        if (window.feezal?.isEditor) return;
        if (this.payloadMode === 'json') {
            const p = this._attr('publish');
            if (p) window.feezal.connection.pub(p, JSON.stringify(jsonObj));
        } else if (topic) {
            window.feezal.connection.pub(topic, value);
        }
    }

    /** E77: in on-off-source=brightness mode dragging from "off" is the natural
     * way to turn a dimmer on — the control stays draggable while off. */
    dragFromOffAllowed() {
        return this.payloadMode !== 'json' && this.onOffSource === 'brightness';
    }

    toggle() {
        // E77: Homematic dimmer mode — on/off IS the brightness value.
        if (this.payloadMode !== 'json' && this.onOffSource === 'brightness') {
            this._toggleViaBrightness();
            this.host.requestUpdate();
            return;
        }
        this.on = !this.on;
        const payload = this.on ? this.payloadOn : this.payloadOff;
        this._pub(this._attr('publish-state'), payload, {[this.jsonMap.state]: payload});
        this.host.requestUpdate();
    }

    _toggleViaBrightness() {
        const min = this.brightnessMin, max = this.brightnessMax;
        if (this.on) {
            // OFF → numeric payload-off verbatim, else the raw minimum.
            this.on = false;
            this.brt = 0;
            const offNum = Number(this.payloadOff);
            const raw = (this.payloadOff !== '' && !isNaN(offNum)) ? String(this.payloadOff) : String(min);
            this._pub(this._attr('publish-brightness'), raw, {[this.jsonMap.brightness]: raw});
            this._settling?.command(Number(raw));
            return;
        }
        this.on = true;
        const onNum = Number(this.payloadOn);
        if (this.payloadOn !== '' && !isNaN(onNum)) {
            // Numeric payload-on → publish verbatim. In-range values predict
            // the local brightness; out-of-range values are device commands
            // (Homematic OLD_LEVEL 1.005 = "restore last level").
            this._pub(this._attr('publish-brightness'), String(this.payloadOn), {[this.jsonMap.brightness]: onNum});
            // E127: sentinel targets are never echoed verbatim — hold ONLY when
            // a WORKING/settled signal can end the hold.
            const onInRange = onNum >= Math.min(min, max) && onNum <= Math.max(min, max);
            if (onInRange || this._attr('subscribe-working') || this._attr('subscribe-settled')) this._settling?.command(onNum);
            if (onInRange) this.brt = this.rawToPct(onNum);
        } else {
            // Non-numeric payload-on ('on') → restore the widget-remembered
            // last brightness (fallback 100 %) through pctToRaw.
            const pct = this._lastBrt ?? 100;
            this.brt = pct;
            const raw = pctToRaw(pct, min, max);
            this._pub(this._attr('publish-brightness'), String(raw), {[this.jsonMap.brightness]: raw});
            this._settling?.command(Number(raw));
        }
    }

    /** Commit a brightness percentage (drag/slider release). */
    setBrightnessPct(pct) {
        this.brt = pct;
        // E77: in brightness mode the level IS the on/off state.
        if (this.dragFromOffAllowed()) {
            this.on = pct > 0;
            if (pct > 0) this._lastBrt = pct;
        }
        const raw = pctToRaw(pct, this.brightnessMin, this.brightnessMax);
        const jsonRaw = pctToRaw(pct, 0, this.brightnessMax || 100);
        this._pub(this._attr('publish-brightness'), String(raw), {[this.jsonMap.brightness]: jsonRaw});
        this._settling?.command(Number(raw));
        this.host.requestUpdate();
    }

    /** Commit a colour temperature in Kelvin (publishes in the wire unit). */
    setColorTempK(ct, publish = true) {
        this.colorTemp = ct;
        if (publish) {
            const v = this.colorTempUnit === 'mired' ? Math.round(1_000_000 / ct) : ct;
            this._pub(this._attr('publish-color-temp'), String(v), {[this.jsonMap.color_temp]: v});
        }
        this.host.requestUpdate();
    }

    /** Commit a colour pick (hue 0–360, sat 0–1) per the active mode. */
    pickColor(hue, sat) {
        if (this.mode === 'rgb') {
            const rgb = hsvToRgb(hue, sat, 1);
            this.rgb = rgb;
            this._pub(this._attr('publish-rgb'), JSON.stringify(rgb),
                {[this.jsonMap.color]: {r: rgb[0], g: rgb[1], b: rgb[2]}});
        } else if (this.mode === 'hs') {
            const hs = [Math.round(hue), Math.round(sat * 100)];
            this.hs = hs;
            this._pub(this._attr('publish-hs'), JSON.stringify(hs),
                {[this.jsonMap.color]: {hue: hs[0], saturation: hs[1]}});
        }
        this.host.requestUpdate();
    }

    setEffect(name) {
        this.effect = name;
        this._pub(this._attr('publish-effect'), name, {[this.jsonMap.effect]: name});
        this.host.requestUpdate();
    }

    /** Commit a white channel ('white' | 'warmWhite' | 'coldWhite', 0–100). */
    setWhite(channel, v) {
        const topics = {white: 'publish-white', warmWhite: 'publish-warm-white', coldWhite: 'publish-cold-white'};
        this[channel] = v;
        const topic = this._attr(topics[channel]);
        if (topic && !window.feezal?.isEditor) window.feezal.connection.pub(topic, String(v));
        this.host.requestUpdate();
    }

    /** Live colour of the light as a CSS color string (views' accent). */
    accentColor() {
        if (!this.on) return 'var(--feezal-light-off-color)';
        const mode = this.mode;
        if (mode === 'rgb' && this.rgb) return rgbToHex(...this.rgb);
        if (mode === 'hs'  && this.hs)  return rgbToHex(...hsvToRgb(this.hs[0], this.hs[1] / 100, 1));
        if ((mode === 'color_temp' || mode === 'brightness_ct') && this.colorTemp) return rgbToHex(...kelvinToRgb(this.colorTemp));
        return 'var(--feezal-light-on-color)';
    }
}

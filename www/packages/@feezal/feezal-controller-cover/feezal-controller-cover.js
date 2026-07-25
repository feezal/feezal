/**
 * @feezal/feezal-controller-cover (E137 — the cover slice)
 *
 * The window-cover/blind MQTT contract as a Lit Reactive Controller — the
 * behavior extracted from the cover cards: both payload modes (json = z2m /
 * HA single-topic with state-inferred position, separate = per-property
 * topics), B26 position/tilt device-range scaling (Homematic LEVEL 0…1 →
 * max=1) and dedicated per-direction command topics (publish-up/-stop/-down
 * win over publish-command / the json publish), up/stop/down payloads, and
 * slat/tilt angle.
 *
 * The family element is a VIEW: it reads `position`/`tilt`, renders its own
 * chrome (window SVG, pill, tile, 1-bit bar) with its own display-only
 * `invert`, and forwards gestures to `up()/stop()/down()/setPosition(pct)/
 * setTilt(pct)`.
 *
 * E128 landed INSIDE this controller, so every cover family got it at once:
 *   - **ramp settling** — E127's `SettlingController`, unchanged, on the
 *     position (and the slat/tilt angle, which ramps the same way on venetian
 *     actuators). Blind travel is far slower than a dimmer ramp, hence the
 *     generous `settle-timeout` default (60 s vs. the light's 5 s). Separate
 *     mode only: the WORKING / LEVEL_NOTWORKING tiers are the Homematic
 *     dialect this exists for, and the json (z2m/HA) path infers position from
 *     several fields at once — routing that through a numeric settler would
 *     change z2m behaviour for no gain.
 *   - **`DIRECTION` indicator** — the blind extra: an optional movement
 *     datapoint read as up / down / idle (`parseDirection`), exposed as
 *     `direction` for the family views to render.
 *
 * E137 packaging: controller + attribute fragment + discovery.map fragment
 * as one unit; `COVER_CONSUMED_ATTRIBUTES` feeds the E114 parity derivation.
 */

import {SettlingController} from '@feezal/feezal-element/feezal-settling.js';
import {parseDirection} from '@feezal/feezal-element/feezal-movement.js';

/** Shared attribute descriptors — spread into every family's `feezal.attributes`. */
export const coverAttributes = [
    {name: 'payload-mode', type: 'select', options: ['json', 'separate'], default: 'json',
        help: 'json = single topic carrying a JSON object (default, matches zigbee2mqtt); separate = one topic per property.'},
    {name: 'subscribe', type: 'mqttTopic', help: 'json mode: base topic carrying the cover state (position, state, …).'},
    {name: 'publish',   type: 'mqttTopic', help: 'json mode: command/set topic (accepts {position:50} or {state:"OPEN"}).'},
    {name: 'json-map',  type: 'string', default: '', help: 'json mode: optional JSON string overriding the default key map.'},
    {name: 'message-property', type: 'string', default: 'payload',
        help: 'json mode: dot-notation path to the JSON state object within the MQTT message. Default "payload" reads msg.payload directly.'},
    // Separate-mode per-property topics
    {name: 'subscribe-position', type: 'mqttTopic', help: 'separate mode: current position (0=closed, 100=open).'},
    {name: 'message-property-position', type: 'string', default: 'payload',
        help: 'Dot-notation path within the position message. Blank = fall back to element-level message-property.'},
    {name: 'publish-position',   type: 'mqttTopic', help: 'separate mode: target position topic.'},
    {name: 'publish-command',    type: 'mqttTopic', help: 'separate mode: up/stop/down command topic.'},
    {name: 'publish-up',   type: 'mqttTopic', help: 'Optional dedicated topic for the Up button. Takes precedence over publish-command.'},
    {name: 'publish-stop', type: 'mqttTopic', help: 'Optional dedicated topic for the Stop button. Takes precedence over publish-command.'},
    {name: 'publish-down', type: 'mqttTopic', help: 'Optional dedicated topic for the Down button. Takes precedence over publish-command.'},
    // Command payloads
    {name: 'payload-up',   type: 'string', default: 'OPEN',  help: 'Payload sent by the Up button.'},
    {name: 'payload-stop', type: 'string', default: 'STOP',  help: 'Payload sent by the Stop button.'},
    {name: 'payload-down', type: 'string', default: 'CLOSE', help: 'Payload sent by the Down button.'},
    // Position range (B26)
    {name: 'min', type: 'number', default: 0,   help: 'Device position range minimum. Incoming positions are scaled from min…max to 0–100 %, published targets scaled back (Homematic reports 0…1: set max to 1).'},
    {name: 'max', type: 'number', default: 100, help: 'Device position range maximum. Incoming positions are scaled from min…max to 0–100 %, published targets scaled back (Homematic reports 0…1: set max to 1).'},
    // Tilt / slat angle
    {name: 'slat-angle',         type: 'mqttTopic', help: 'Subscribe: venetian-blind tilt/slat angle (0–100).'},
    {name: 'message-property-tilt', type: 'string', default: 'payload',
        help: 'Dot-notation path within the slat-angle message. Blank = fall back to element-level message-property.'},
    {name: 'publish-slat-angle', type: 'mqttTopic', help: 'Publish: topic to publish new slat angle to (0–100).'},
    {name: 'slat-min', type: 'number', default: 0,   help: 'Device slat-angle range minimum. Incoming angles are scaled from slat-min…slat-max to 0–100 %, published angles scaled back.'},
    {name: 'slat-max', type: 'number', default: 100, help: 'Device slat-angle range maximum. Incoming angles are scaled from slat-min…slat-max to 0–100 %, published angles scaled back.'},
    // E128: ramp settling — the same contract as the light family (E127).
    // separate mode only; the json (z2m/HA) path is unaffected.
    {name: 'subscribe-working', type: 'mqttTopic', section: 'Movement',
        help: 'WORKING datapoint topic (true while the blind travels, e.g. hm/status/<blind>/WORKING). While true, position reports are suppressed instead of making the slider jump; false applies the final value. Distinct topic — not a property of the position topic.'},
    {name: 'message-property-working', type: 'string', default: 'payload.val', section: 'Movement',
        help: 'Property path for the WORKING topic (mqtt-smarthome publishes {"val": true} → payload.val).'},
    {name: 'subscribe-settled', type: 'mqttTopic', section: 'Movement',
        help: 'Settled-values topic carrying only final positions (RedMatic: …/LEVEL_NOTWORKING). When set, the slider follows THIS topic instead of the live position topic.'},
    {name: 'message-property-settled', type: 'string', default: 'payload.val', section: 'Movement',
        help: 'Property path for the settled topic (mqtt-smarthome: payload.val).'},
    {name: 'settle-timeout', type: 'number', default: 60, size: 'half', section: 'Movement',
        help: 'Seconds after a command before the slider reconciles to the last reported position. Generous by default — a blind can travel 30–60 s, far longer than a dimmer ramp.'},
    {name: 'report-delay-ms', type: 'number', default: 100, size: 'half', section: 'Movement',
        help: 'Only with subscribe-working: delay before showing an incoming position report — a WORKING=true arriving within the window suppresses travel jitter from changes made elsewhere (interfaces deliver WORKING up to ~100 ms late). 0 disables.'},
    // E128: the blind extra — a movement-direction indicator on the card.
    {name: 'subscribe-direction', type: 'mqttTopic', section: 'Movement',
        help: 'Optional movement topic (Homematic DIRECTION: NONE / UP / DOWN / UNDEFINED). While it reports up or down, the card shows a travel-direction indicator. Purely a display signal — it never moves the blind.'},
    {name: 'message-property-direction', type: 'string', default: 'payload.val', section: 'Movement',
        help: 'Property path for the direction topic (mqtt-smarthome: payload.val).'},
    {name: 'payload-direction-up',   type: 'string', default: 'UP',   size: 'half', section: 'Movement',
        help: 'Value on the direction topic meaning "travelling up / opening". The Homematic enum index (1) is also accepted.'},
    {name: 'payload-direction-down', type: 'string', default: 'DOWN', size: 'half', section: 'Movement',
        help: 'Value on the direction topic meaning "travelling down / closing". The Homematic enum index (2) is also accepted. Anything else (NONE / UNDEFINED / 0) reads as idle.'},
];

/** Shared discovery.map fragment (HA `cover` + the E108/E120 native keys). */
export const coverDiscoveryMap = {
    position_topic:     {attr: 'subscribe'},
    set_position_topic: {attr: 'publish'},
    command_topic:      {attr: 'publish'},
    state_open:    {attr: 'payload-up'},
    state_closed:  {attr: 'payload-down'},
    state_stopped: {attr: 'payload-stop'},
    payload_open:  {attr: 'payload-up'},
    payload_close: {attr: 'payload-down'},
    payload_stop:  {attr: 'payload-stop'},
    tilt_status_topic:  {attr: 'slat-angle'},
    tilt_command_topic: {attr: 'publish-slat-angle'},
    // E108 native Homematic (separate mode) — HA/z2m absent → skipped.
    payload_mode:             {attr: 'payload-mode'},
    position_state_topic:     {attr: 'subscribe-position'},
    position_command_topic:   {attr: 'publish-position'},
    stop_command_topic:       {attr: 'publish-stop'},
    // E120: Up/Down drive the LEVEL set topic.
    open_command_topic:       {attr: 'publish-up'},
    close_command_topic:      {attr: 'publish-down'},
    position_min:             {attr: 'min'},
    position_max:             {attr: 'max'},
    message_property:          {attr: 'message-property'},
    message_property_position: {attr: 'message-property-position'},
    // E128: observed-only Homematic extras — the recognizer emits these keys
    // ONLY for datapoints actually seen on the broker (never guessed), exactly
    // like E127 does for the dimmer.
    working_topic:              {attr: 'subscribe-working'},
    message_property_working:   {attr: 'message-property-working'},
    settled_topic:              {attr: 'subscribe-settled'},
    message_property_settled:   {attr: 'message-property-settled'},
    direction_topic:            {attr: 'subscribe-direction'},
    message_property_direction: {attr: 'message-property-direction'},
    name: 'label',
};

/** Attribute names this controller consumes (parity-set derivation, E114). */
export const COVER_CONSUMED_ATTRIBUTES = coverAttributes.map(a => a.name);

// Device scale (min/max) ↔ 0–100 % — B26.
function rangeOf(minValue, maxValue) {
    let min = Number(minValue);
    let max = Number(maxValue);
    if (isNaN(min)) min = 0;
    if (isNaN(max)) max = 100;
    if (max === min) { min = 0; max = 100; }
    return {min, max};
}

function scaleIn(v, {min, max})    { return ((v - min) / (max - min)) * 100; }
function scaleOut(pct, {min, max}) { return Math.round((min + (pct / 100) * (max - min)) * 10000) / 10000; }

export class CoverController {
    /**
     * @param {import('lit').ReactiveControllerHost & HTMLElement} host
     * @param {{json?: boolean}} options — family quirks (flags, not forks);
     *   {json: false} for a family without the json payload mode.
     */
    constructor(host, options = {}) {
        this.host = host;
        this.options = {json: true, ...options};
        host.addController?.(this);
        // ── state (plain fields, E137 decided) ──
        this.position = null;   // 0–100 %, null = unknown
        this.tilt = null;       // 0–100 %, null = not configured
        // E128: '' = idle / not wired, 'up' | 'down' while the motor runs.
        this.direction = '';
        this._settling = null;      // position settler (separate mode)
        this._tiltSettling = null;  // slat-angle settler (separate mode)
    }

    /** E128: true while the movement datapoint reports travel. */
    get moving() { return this.direction !== ''; }

    // ── attribute access ─────────────────────────────────────────────────────
    _attr(name, fallback = '') {
        const v = this.host.getAttribute(name);
        return v === null ? fallback : v;
    }

    /** `fallback` is the descriptor default for topics whose payload shape is
     *  fixed by the dialect (E128's mqtt-smarthome `payload.val` twins) — it
     *  wins over the element-level message-property, which describes the
     *  position/state payload, not these. */
    _prop(msg, specific, fallback) {
        return this.host.getProperty(msg, this._attr(specific) || fallback || this._attr('message-property') || 'payload');
    }

    get payloadMode() { return this.options.json ? this._attr('payload-mode', 'json') : 'separate'; }
    get payloadUp()   { return this._attr('payload-up', 'OPEN'); }
    get payloadStop() { return this._attr('payload-stop', 'STOP'); }
    get payloadDown() { return this._attr('payload-down', 'CLOSE'); }
    get range()       { return rangeOf(this._attr('min', '0'), this._attr('max', '100')); }
    get slatRange()   { return rangeOf(this._attr('slat-min', '0'), this._attr('slat-max', '100')); }

    _num(name, fallback) {
        const n = Number(this._attr(name, String(fallback)));
        return Number.isFinite(n) ? n : fallback;
    }

    posIn(v)      { return scaleIn(v, this.range); }
    posOut(pct)   { return scaleOut(pct, this.range); }
    tiltIn(v)     { return scaleIn(v, this.slatRange); }
    tiltOut(pct)  { return scaleOut(pct, this.slatRange); }

    // ── lifecycle ────────────────────────────────────────────────────────────
    signature() {
        return ['payload-mode', 'subscribe', 'subscribe-position', 'slat-angle',
            'subscribe-working', 'subscribe-settled', 'subscribe-direction',
            'settle-timeout', 'report-delay-ms']
            .map(a => this._attr(a)).join('|');
    }

    hostConnected() { this.wire(); }

    hostDisconnected() {
        // E128: clear pending hold/buffer timers with the subscriptions.
        this._disposeSettling();
    }

    _disposeSettling() {
        this._settling?.dispose();
        this._tiltSettling?.dispose();
        this._settling = this._tiltSettling = null;
    }

    /** Call from the host's updated() to re-wire on live topic edits. */
    rewireIfChanged() {
        if (this.__sig !== undefined && this.signature() !== this.__sig) {
            this.host._unsubscribe();
            this.wire();
        }
    }

    wire() {
        this.__sig = this.signature();
        const update = () => this.host.requestUpdate();
        const sub = (topic, cb) => { if (topic) this.host.addSubscription(topic, cb); };

        this._disposeSettling();
        // E128: the movement indicator is a pure display signal and works in
        // BOTH payload modes — it is its own topic, not part of the state object.
        this._wireDirection(sub, update);

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

        // E128: raw position reports run through the SettlingController — it
        // decides which of them may reach the slider (hold-at-target after an
        // own command, WORKING-gated suppression, settled-values topic).
        const workingWired = Boolean(this._attr('subscribe-working'));
        const settledWired = Boolean(this._attr('subscribe-settled'));
        const timeoutMs = (Math.max(0, this._num('settle-timeout', 60)) || 60) * 1000;
        const reportDelayMs = Math.max(0, this._num('report-delay-ms', 100) || 0);

        this._settling = new SettlingController({
            apply: v => { this.position = Math.max(0, Math.min(100, this.posIn(v))); update(); },
            timeoutMs, reportDelayMs, workingWired, settledWired,
        });
        sub(this._attr('subscribe-position'), msg => {
            const v = Number(this._prop(msg, 'message-property-position'));
            if (!isNaN(v)) this._settling.live(v);
        });

        // Venetian slat angles ramp the same way the position does, so the same
        // helper covers the tilt slider. The channel's WORKING datapoint covers
        // BOTH movements, hence the shared signal below.
        this._tiltSettling = new SettlingController({
            apply: v => { this.tilt = Math.max(0, Math.min(100, this.tiltIn(v))); update(); },
            timeoutMs, reportDelayMs, workingWired,
            // LEVEL_NOTWORKING carries the position only — the tilt slider must
            // keep following its own live topic.
            settledWired: false,
        });
        sub(this._attr('slat-angle'), msg => {
            const v = Number(this._prop(msg, 'message-property-tilt'));
            if (!isNaN(v)) this._tiltSettling.live(v);
        });

        sub(this._attr('subscribe-working'), msg => {
            const v = this._prop(msg, 'message-property-working', 'payload.val');
            const active = v === true || v === 'true' || v === 1 || v === '1';
            this._settling.working(active);
            this._tiltSettling.working(active);
        });
        sub(this._attr('subscribe-settled'), msg => {
            const v = Number(this._prop(msg, 'message-property-settled', 'payload.val'));
            if (!isNaN(v)) this._settling.settled(v);
        });
    }

    _wireDirection(sub, update) {
        this.direction = '';
        sub(this._attr('subscribe-direction'), msg => {
            const v = this._prop(msg, 'message-property-direction', 'payload.val');
            const dir = parseDirection(v,
                this._attr('payload-direction-up', 'UP'),
                this._attr('payload-direction-down', 'DOWN'));
            if (dir !== this.direction) { this.direction = dir; update(); }
        });
    }

    // ── json key map ─────────────────────────────────────────────────────────
    get jsonMap() {
        const defaults = {state: 'state', position: 'position', tilt: 'tilt'};
        const raw = this._attr('json-map');
        if (raw) {
            try { return {...defaults, ...JSON.parse(raw)}; } catch { /* defaults */ }
        }
        return defaults;
    }

    applyJsonState(obj) {
        const map = this.jsonMap;
        const get = key => this.host.getProperty(obj, key);

        // Position from numeric field (primary)
        const pos = get(map.position);
        if (pos !== null && pos !== undefined) {
            const n = Number(pos);
            if (!isNaN(n)) this.position = Math.max(0, Math.min(100, this.posIn(n)));
        }

        // State field: infer position when numeric position is absent
        // (z2m reports state:"CLOSE" before position:0 arrives).
        if (this.position === null) {
            const state = get(map.state);
            if (state !== null && state !== undefined) {
                const s = String(state).toUpperCase();
                if (s === this.payloadDown.toUpperCase() || s === 'CLOSE' || s === 'CLOSED') {
                    this.position = 0;
                } else if (s === this.payloadUp.toUpperCase() || s === 'OPEN' || s === 'OPENED') {
                    this.position = 100;
                }
            }
        }

        const tilt = get(map.tilt);
        if (tilt !== null && tilt !== undefined) {
            const n = Number(tilt);
            if (!isNaN(n)) this.tilt = Math.max(0, Math.min(100, this.tiltIn(n)));
        }
    }

    // ── commands ─────────────────────────────────────────────────────────────
    _pub(topic, value, jsonObj) {
        if (window.feezal?.isEditor) return;
        if (this.payloadMode === 'json') {
            const p = this._attr('publish');
            if (p) window.feezal.connection.pub(p, JSON.stringify(jsonObj));
        } else if (topic) {
            window.feezal.connection.pub(topic, String(value));
        }
    }

    /** Dedicated per-direction topic wins over publish-command / json publish. */
    _cmd(dedicatedAttr, payload) {
        const dedicated = this._attr(dedicatedAttr);
        if (dedicated) {
            if (!window.feezal?.isEditor) window.feezal.connection.pub(dedicated, String(payload));
            return;
        }
        this._pub(this._attr('publish-command'), payload, {[this.jsonMap.state]: payload});
    }

    up()   { this._cmd('publish-up',   this.payloadUp);   this._settleFromPayload(this.payloadUp); }
    down() { this._cmd('publish-down', this.payloadDown); this._settleFromPayload(this.payloadDown); }
    stop() {
        this._cmd('publish-stop', this.payloadStop);
        // E128: the blind halts mid-travel — the target is void, let reports through.
        this._settling?.cancel();
        this._tiltSettling?.cancel();
    }

    /**
     * E128: Up/Down carry a numeric target on Homematic (the recognizer wires
     * both to the LEVEL set topic with payload 1 / 0), so the slider can hold
     * at it exactly like a position command. A non-numeric or out-of-range
     * payload (OPEN/CLOSE on z2m, or a device sentinel) predicts nothing —
     * leave the slider following reports.
     */
    _settleFromPayload(payload) {
        if (!this._settling) return;
        const n = Number(payload);
        if (payload === '' || !Number.isFinite(n)) return;
        const {min, max} = this.range;
        if (n < Math.min(min, max) || n > Math.max(min, max)) return;
        this._settling.command(n);
    }

    /** Commit a position % (clamped/rounded; publishes the device-range raw). */
    setPosition(pos) {
        const clamped = Math.max(0, Math.min(100, Math.round(Number(pos))));
        this.position = clamped;
        const raw = this.posOut(clamped);
        this._pub(this._attr('publish-position'), raw, {[this.jsonMap.position]: raw});
        // E128: hold the slider at the target while the blind travels.
        this._settling?.command(Number(raw));
        this.host.requestUpdate();
        return clamped;
    }

    /** Commit a slat/tilt % (clamped/rounded; publishes the device-range raw). */
    setTilt(tilt) {
        const clamped = Math.max(0, Math.min(100, Math.round(Number(tilt))));
        this.tilt = clamped;
        const raw = this.tiltOut(clamped);
        this._pub(this._attr('publish-slat-angle'), raw, {[this.jsonMap.tilt]: raw});
        this._tiltSettling?.command(Number(raw));
        this.host.requestUpdate();
        return clamped;
    }
}

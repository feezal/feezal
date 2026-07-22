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
 * E128 (Homematic settling + DIRECTION indicator) lands INSIDE this
 * controller when its slice comes up — every cover family gets it at once.
 *
 * E137 packaging: controller + attribute fragment + discovery.map fragment
 * as one unit; `COVER_CONSUMED_ATTRIBUTES` feeds the E114 parity derivation.
 */

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
    }

    // ── attribute access ─────────────────────────────────────────────────────
    _attr(name, fallback = '') {
        const v = this.host.getAttribute(name);
        return v === null ? fallback : v;
    }

    _prop(msg, specific) {
        return this.host.getProperty(msg, this._attr(specific) || this._attr('message-property') || 'payload');
    }

    get payloadMode() { return this.options.json ? this._attr('payload-mode', 'json') : 'separate'; }
    get payloadUp()   { return this._attr('payload-up', 'OPEN'); }
    get payloadStop() { return this._attr('payload-stop', 'STOP'); }
    get payloadDown() { return this._attr('payload-down', 'CLOSE'); }
    get range()       { return rangeOf(this._attr('min', '0'), this._attr('max', '100')); }
    get slatRange()   { return rangeOf(this._attr('slat-min', '0'), this._attr('slat-max', '100')); }

    posIn(v)      { return scaleIn(v, this.range); }
    posOut(pct)   { return scaleOut(pct, this.range); }
    tiltIn(v)     { return scaleIn(v, this.slatRange); }
    tiltOut(pct)  { return scaleOut(pct, this.slatRange); }

    // ── lifecycle ────────────────────────────────────────────────────────────
    signature() {
        return ['payload-mode', 'subscribe', 'subscribe-position', 'slat-angle']
            .map(a => this._attr(a)).join('|');
    }

    hostConnected() { this.wire(); }

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

        sub(this._attr('subscribe-position'), msg => {
            const v = Number(this._prop(msg, 'message-property-position'));
            if (!isNaN(v)) { this.position = Math.max(0, Math.min(100, this.posIn(v))); update(); }
        });
        sub(this._attr('slat-angle'), msg => {
            const v = Number(this._prop(msg, 'message-property-tilt'));
            if (!isNaN(v)) { this.tilt = Math.max(0, Math.min(100, this.tiltIn(v))); update(); }
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

    up()   { this._cmd('publish-up',   this.payloadUp); }
    stop() { this._cmd('publish-stop', this.payloadStop); }
    down() { this._cmd('publish-down', this.payloadDown); }

    /** Commit a position % (clamped/rounded; publishes the device-range raw). */
    setPosition(pos) {
        const clamped = Math.max(0, Math.min(100, Math.round(Number(pos))));
        this.position = clamped;
        const raw = this.posOut(clamped);
        this._pub(this._attr('publish-position'), raw, {[this.jsonMap.position]: raw});
        this.host.requestUpdate();
        return clamped;
    }

    /** Commit a slat/tilt % (clamped/rounded; publishes the device-range raw). */
    setTilt(tilt) {
        const clamped = Math.max(0, Math.min(100, Math.round(Number(tilt))));
        this.tilt = clamped;
        const raw = this.tiltOut(clamped);
        this._pub(this._attr('publish-slat-angle'), raw, {[this.jsonMap.tilt]: raw});
        this.host.requestUpdate();
        return clamped;
    }
}

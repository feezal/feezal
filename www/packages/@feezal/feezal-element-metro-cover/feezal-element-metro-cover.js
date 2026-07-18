/* global feezal */
import {html, css} from '@feezal/feezal-element';
import '@feezal/feezal-element/feezal-topic-input.js';
import {LitElement} from 'lit';
import {MetroTileBase} from '@feezal/feezal-element-metro-tile';

/**
 * feezal-element-metro-cover (E104)
 *
 * Cover / shutter tile: the FRONT shows the current position in flat Metro
 * style (percentage figure + a flat fill descending from the top — no
 * skeuomorphic slats); tapping the tile flips to the BACK holding a position
 * slider, up/stop/down buttons and — only when tilt topics are configured —
 * a tilt slider.
 *
 * The MQTT wiring contract deliberately mirrors material-cover 1:1:
 *  - payload-mode json (single base topic + …/set command topic carrying a
 *    JSON object, the zigbee2mqtt shape, default) or separate (one topic per
 *    property: subscribe-position/publish-position + publish-command).
 *  - publish-up/-stop/-down dedicated per-direction topics take precedence
 *    over publish-command (B26), with payload-up/-stop/-down payloads.
 *  - min/max and slat-min/slat-max device-range scaling (B26): incoming
 *    values scale to 0–100 %, published targets scale back (Homematic
 *    reports 0…1 → set max to 1).
 *  - slat-angle / publish-slat-angle tilt topics, invert, show-position,
 *    label, and material-cover's discovery descriptor for component 'cover'.
 *  - Availability is N31 base-class machinery — this element only declares
 *    the attributes and renders the Metro `!` badge from `this._available`.
 */

class FeezalElementMetroCover extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Cover', category: 'Metro', color: '#1ba1e2', icon: 'blinds'},
            description: 'Metro cover/shutter tile: the front shows the position as a flat fill + percentage; tap flips to the back with a position slider, up/stop/down buttons and an optional tilt slider. Wiring contract identical to material-cover incl. json payload mode, dedicated up/stop/down topics and min/max range scaling (Homematic 0…1).',
            inspector: 'feezal-element-metro-cover-inspector',
            // material-cover's discovery descriptor (N31: availability is
            // mapped automatically from the canonical discovery record —
            // no availability lines here).
            discovery: {
                component: 'cover',
                map: {
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
                    name: 'label',
                },
            },
            attributes: [
                ...MetroTileBase.tileAttributes,
                // ── Wiring mode (material-cover contract) ─────────────────────
                {name: 'payload-mode', type: 'select', options: ['json', 'separate'], default: 'json',
                    help: 'json = single topic carrying a JSON object (default, matches zigbee2mqtt); separate = one topic per property.'},
                {name: 'subscribe', type: 'mqttTopic', help: 'json mode: base topic carrying the cover state (position, state, …).'},
                {name: 'publish',   type: 'mqttTopic', help: 'json mode: command/set topic (accepts {position:50} or {state:"OPEN"}).'},
                {name: 'json-map',  type: 'string', default: '', help: 'json mode: optional JSON string overriding the default key map.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'json mode: dot-notation path to the JSON state object within the MQTT message. Default "payload" reads msg.payload directly.'},
                // ── Separate-mode per-property topics ─────────────────────────
                {name: 'subscribe-position', type: 'mqttTopic', help: 'separate mode: current position (0=closed, 100=open).'},
                {name: 'message-property-position', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the position message. Blank = fall back to element-level message-property.'},
                {name: 'publish-position',   type: 'mqttTopic', help: 'separate mode: target position topic.'},
                {name: 'publish-command',    type: 'mqttTopic', help: 'separate mode: up/stop/down command topic.'},
                {name: 'publish-up',   type: 'mqttTopic', help: 'Optional dedicated topic for the Up button. Takes precedence over publish-command.'},
                {name: 'publish-stop', type: 'mqttTopic', help: 'Optional dedicated topic for the Stop button. Takes precedence over publish-command.'},
                {name: 'publish-down', type: 'mqttTopic', help: 'Optional dedicated topic for the Down button. Takes precedence over publish-command.'},
                // ── Command payloads ──────────────────────────────────────────
                {name: 'payload-up',   type: 'string', default: 'OPEN',  help: 'Payload sent by the Up button.'},
                {name: 'payload-stop', type: 'string', default: 'STOP',  help: 'Payload sent by the Stop button.'},
                {name: 'payload-down', type: 'string', default: 'CLOSE', help: 'Payload sent by the Down button.'},
                // ── Position range (B26) ──────────────────────────────────────
                {name: 'min', type: 'number', default: 0,   help: 'Device position range minimum. Incoming positions are scaled from min…max to 0–100 %, published targets scaled back (Homematic reports 0…1: set max to 1).'},
                {name: 'max', type: 'number', default: 100, help: 'Device position range maximum. Incoming positions are scaled from min…max to 0–100 %, published targets scaled back (Homematic reports 0…1: set max to 1).'},
                // ── Tilt / slat angle ─────────────────────────────────────────
                {name: 'slat-angle',         type: 'mqttTopic', help: 'Subscribe: venetian-blind tilt/slat angle. The back shows a tilt slider when a tilt topic is configured.'},
                {name: 'message-property-tilt', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the slat-angle message. Blank = fall back to element-level message-property.'},
                {name: 'publish-slat-angle', type: 'mqttTopic', help: 'Publish: topic to publish new slat angle to.'},
                {name: 'slat-min', type: 'number', default: 0,   help: 'Device slat-angle range minimum. Incoming angles are scaled from slat-min…slat-max to 0–100 %, published angles scaled back.'},
                {name: 'slat-max', type: 'number', default: 100, help: 'Device slat-angle range maximum. Incoming angles are scaled from slat-min…slat-max to 0–100 %, published angles scaled back.'},
                // ── Display ───────────────────────────────────────────────────
                {name: 'invert',        type: 'boolean', default: false, help: 'Invert position scale: 0=open, 100=closed.'},
                {name: 'show-position', type: 'boolean', default: true,  help: 'Show the numeric position percentage on the tile front.'},
                // ── Availability (N31 base-class machinery) ───────────────────
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability — a ! badge appears while unavailable; controls stay enabled.'},
                {name: 'message-property-availability', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the availability message. Blank = fall back to element-level message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning the device is online.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning the device is offline.'},
            ],
            styles: [
                ...MetroTileBase.tileStyles,
                {property: '--feezal-metro-cover-fill', type: 'color',
                    default: 'rgba(0, 0, 0, 0.28)',
                    help: 'Overlay colour of the closed portion of the tile (the flat fill descending from the top).'},
            ],
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
        };
    }

    static properties = {
        payloadMode:      {type: String,  reflect: true, attribute: 'payload-mode'},
        publish:          {type: String,  reflect: true},
        jsonMap:          {type: String,  reflect: true, attribute: 'json-map'},
        subscribePosition: {type: String, reflect: true, attribute: 'subscribe-position'},
        msgPropPosition:  {type: String,  reflect: true, attribute: 'message-property-position'},
        publishPosition:  {type: String,  reflect: true, attribute: 'publish-position'},
        publishCommand:   {type: String,  reflect: true, attribute: 'publish-command'},
        publishUp:        {type: String,  reflect: true, attribute: 'publish-up'},
        publishStop:      {type: String,  reflect: true, attribute: 'publish-stop'},
        publishDown:      {type: String,  reflect: true, attribute: 'publish-down'},
        payloadUp:        {type: String,  reflect: true, attribute: 'payload-up'},
        payloadStop:      {type: String,  reflect: true, attribute: 'payload-stop'},
        payloadDown:      {type: String,  reflect: true, attribute: 'payload-down'},
        min:              {type: Number,  reflect: true},
        max:              {type: Number,  reflect: true},
        slatAngle:        {type: String,  reflect: true, attribute: 'slat-angle'},
        msgPropTilt:      {type: String,  reflect: true, attribute: 'message-property-tilt'},
        publishSlatAngle: {type: String,  reflect: true, attribute: 'publish-slat-angle'},
        slatMin:          {type: Number,  reflect: true, attribute: 'slat-min'},
        slatMax:          {type: Number,  reflect: true, attribute: 'slat-max'},
        invert:           {type: Boolean, reflect: true},
        showPosition:     {type: Boolean, reflect: true, attribute: 'show-position'},
        // N31: availability inherited from FeezalElement.
        discoveryId:      {type: String,  reflect: true, attribute: 'discovery-id'},
        _position: {state: true},   // 0–100 %, null = unknown
        _tilt:     {state: true},   // 0–100 %, null = unknown
    };

    static styles = [MetroTileBase.styles, css`
        :host { --feezal-metro-cover-fill: rgba(0, 0, 0, 0.28); }
        /* Flat fill layer — spans the whole face (the .center wrapper stops
           18px above the bottom, hence the negative inset). Content sits on
           top via position:relative + DOM order. */
        .center > * { position: relative; }
        .fill { position: absolute; inset: 0 0 -18px 0; pointer-events: none; }
        .value { font-size: min(26px, 28cqh); font-weight: 300; }
        .cmds { display: flex; justify-content: center; gap: 8px; }
        .cmds .mbtn { padding: 2px 8px; }
        .cmds feezal-icon { font-size: 18px; vertical-align: middle; }
    `];

    constructor() {
        super();
        this.payloadMode = 'json';
        this.publish = '';
        this.jsonMap = '';
        this.subscribePosition = '';
        this.msgPropPosition = '';
        this.publishPosition = '';
        this.publishCommand = '';
        this.publishUp = '';
        this.publishStop = '';
        this.publishDown = '';
        this.payloadUp = 'OPEN';
        this.payloadStop = 'STOP';
        this.payloadDown = 'CLOSE';
        this.min = 0;
        this.max = 100;
        this.slatAngle = '';
        this.msgPropTilt = '';
        this.publishSlatAngle = '';
        this.slatMin = 0;
        this.slatMax = 100;
        this.invert = false;
        this.showPosition = true;
        this.discoveryId = '';
        this._position = null;
        this._tilt = null;
    }

    // Fully self-managed subscriptions (like material-cover) — suppress the
    // generic base path, which would treat the json base topic as a control
    // channel. Availability stays base-class business (independent of this).
    _subscribe() { /* intentionally empty — see connectedCallback */ }

    connectedCallback() {
        super.connectedCallback();
        this._wireSubscriptions();
    }

    /** Everything that identifies the subscription wiring — when it changes
     * at runtime (inspector edits on the live canvas, MQTT setattribute),
     * updated() rewires instead of silently keeping the stale topics. */
    _wireSignature() {
        return [this.payloadMode, this.subscribe, this.subscribePosition, this.slatAngle].join('|');
    }

    _wireSubscriptions() {
        this.__wireSig = this._wireSignature();

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

        // ── Separate (per-topic) mode ──────────────────────────────────────
        if (this.subscribePosition) {
            this.addSubscription(this.subscribePosition, msg => {
                const v = Number(this.getProperty(msg, this.msgPropPosition || this.messageProperty));
                if (!isNaN(v)) this._position = Math.max(0, Math.min(100, this._posIn(v)));
            });
        }
        if (this.slatAngle) {
            this.addSubscription(this.slatAngle, msg => {
                const v = Number(this.getProperty(msg, this.msgPropTilt || this.messageProperty));
                if (!isNaN(v)) this._tilt = Math.max(0, Math.min(100, this._tiltIn(v)));
            });
        }
    }

    // ─── Value ranges — device scale (min/max, slat-min/slat-max) <-> 0–100 % ─
    // (B26 — identical to material-cover, keep in sync.)
    static _rangeOf(minValue, maxValue) {
        let min = Number(minValue);
        let max = Number(maxValue);
        if (isNaN(min)) min = 0;
        if (isNaN(max)) max = 100;
        if (max === min) { min = 0; max = 100; }
        return {min, max};
    }

    static _scaleIn(v, {min, max}) {
        return ((v - min) / (max - min)) * 100;
    }

    static _scaleOut(pct, {min, max}) {
        return Math.round((min + (pct / 100) * (max - min)) * 10000) / 10000;
    }

    get _range()     { return this.constructor._rangeOf(this.min, this.max); }
    get _slatRange() { return this.constructor._rangeOf(this.slatMin, this.slatMax); }

    _posIn(v)     { return this.constructor._scaleIn(v, this._range); }
    _posOut(pct)  { return this.constructor._scaleOut(pct, this._range); }
    _tiltIn(v)    { return this.constructor._scaleIn(v, this._slatRange); }
    _tiltOut(pct) { return this.constructor._scaleOut(pct, this._slatRange); }

    // ─── JSON payload mode (material-cover contract) ──────────────────────────
    get _jsonMap() {
        const defaults = {state: 'state', position: 'position', tilt: 'tilt'};
        if (this.jsonMap) {
            try { return {...defaults, ...JSON.parse(this.jsonMap)}; } catch { /* fall through */ }
        }
        return defaults;
    }

    _applyJsonState(obj) {
        const map = this._jsonMap;
        const get = key => this.getProperty(obj, key);

        // Position from numeric field (primary)
        const pos = get(map.position);
        if (pos !== null && pos !== undefined) {
            const n = Number(pos);
            if (!isNaN(n)) this._position = Math.max(0, Math.min(100, this._posIn(n)));
        }

        // State field: infer position when numeric position is absent
        // e.g. zigbee2mqtt cover reports state:"CLOSE" before position:0 arrives
        if (this._position === null) {
            const state = get(map.state);
            if (state !== null && state !== undefined) {
                const s = String(state).toUpperCase();
                if (s === this.payloadDown.toUpperCase() || s === 'CLOSE' || s === 'CLOSED') {
                    this._position = 0;
                } else if (s === this.payloadUp.toUpperCase() || s === 'OPEN' || s === 'OPENED') {
                    this._position = 100;
                }
            }
        }

        const tilt = get(map.tilt);
        if (tilt !== null && tilt !== undefined) {
            const n = Number(tilt);
            if (!isNaN(n)) this._tilt = Math.max(0, Math.min(100, this._tiltIn(n)));
        }
    }

    // Unified publish: json mode → JSON object on `publish`;
    // separate mode → raw string on `topic`.
    _pub(topic, value, jsonObj) {
        if (this.payloadMode === 'json') {
            if (this.publish) feezal.connection.pub(this.publish, JSON.stringify(jsonObj));
        } else if (topic) {
            feezal.connection.pub(topic, String(value));
        }
    }

    // ─── Controls ─────────────────────────────────────────────────────────────
    // Dedicated per-direction topic (publish-up/-stop/-down) wins over the
    // single publish-command topic / json publish topic (B26).
    _cmd(dedicatedTopic, payload) {
        if (feezal.isEditor) return;
        if (dedicatedTopic) {
            feezal.connection.pub(dedicatedTopic, String(payload));
            return;
        }
        this._pub(this.publishCommand, payload, {[this._jsonMap.state]: payload});
    }

    _cmdUp()   { this._cmd(this.publishUp,   this.payloadUp); }
    _cmdStop() { this._cmd(this.publishStop, this.payloadStop); }
    _cmdDown() { this._cmd(this.publishDown, this.payloadDown); }

    _onPos(e) {
        if (feezal.isEditor) return;
        const clamped = Math.max(0, Math.min(100, Math.round(Number(e.target.value))));
        this._position = clamped;
        const raw = this._posOut(clamped);
        this._pub(this.publishPosition, raw, {[this._jsonMap.position]: raw});
    }

    _onTilt(e) {
        if (feezal.isEditor) return;
        const clamped = Math.max(0, Math.min(100, Math.round(Number(e.target.value))));
        this._tilt = clamped;
        const raw = this._tiltOut(clamped);
        this._pub(this.publishSlatAngle, raw, {[this._jsonMap.tilt]: raw});
    }

    updated(changed) {
        super.updated(changed);
        // Topic/mode attributes changed at runtime → drop the old
        // subscriptions and wire the new ones (fresh subscriptions also
        // trigger the broker's retained replay for the new topics).
        if (this.isConnected && this.__wireSig !== undefined && this._wireSignature() !== this.__wireSig) {
            this._unsubscribe();
            this._wireSubscriptions();
        }
    }

    // ─── Faces ────────────────────────────────────────────────────────────────

    /** Front tap flips to the back (a cover has no single toggle action).
     * Editor-guarded by the base's _frontClick. */
    baseAction() {
        this._flip(true);
    }

    /** N31 availability — the Metro `!` badge, like metro-contact. */
    renderBadge() {
        return this._available ? '' : '!';
    }

    renderFront() {
        const displayPos = this._position ?? (feezal.isEditor ? 50 : null);
        const eff = displayPos === null ? null : (this.invert ? 100 - displayPos : displayPos);
        const closed = eff === null ? 0 : Math.max(0, Math.min(100, 100 - eff));
        return html`
            <div class="fill" style="background: linear-gradient(to bottom, var(--feezal-metro-cover-fill) ${closed}%, transparent ${closed}%)"></div>
            ${this.icon ? html`<feezal-icon name="${this.icon}"></feezal-icon>` : ''}
            ${this.showPosition ? html`
                <div class="value">${displayPos === null ? '—' : `${Math.round(displayPos)}%`}</div>` : ''}
        `;
    }

    renderBack() {
        const hasTilt = !!(this.slatAngle || this.publishSlatAngle);
        const pos = this._position ?? (feezal.isEditor ? 50 : 0);
        return html`
            <div class="cmds">
                <button class="mbtn up"   title="Up"   @click="${this._cmdUp}"><feezal-icon name="keyboard_arrow_up"></feezal-icon></button>
                <button class="mbtn stop" title="Stop" @click="${this._cmdStop}"><feezal-icon name="stop"></feezal-icon></button>
                <button class="mbtn down" title="Down" @click="${this._cmdDown}"><feezal-icon name="keyboard_arrow_down"></feezal-icon></button>
            </div>
            <div class="rowline">
                <feezal-icon name="height"></feezal-icon>
                <input type="range" class="pos" min="0" max="100" step="1"
                    .value="${String(Math.round(pos))}" @change="${this._onPos}">
            </div>
            ${hasTilt ? html`
                <div class="rowline">
                    <feezal-icon name="line_weight"></feezal-icon>
                    <input type="range" class="tilt" min="0" max="100" step="1"
                        .value="${String(Math.round(this._tilt ?? 0))}" @change="${this._onTilt}">
                </div>` : ''}`;
    }
}

customElements.define('feezal-element-metro-cover', FeezalElementMetroCover);
export {FeezalElementMetroCover};

// ─── N6 custom inspector ─────────────────────────────────────────────────────
// Mirrors material-cover's inspector in the metro-light two-tab shape:
// Topics tab — json mode: State & Control section + capability-gated Tilt /
// Availability; separate mode: Position + Command sections + gated Tilt /
// Availability. Config tab — payload mode, command payloads, value ranges,
// display options, availability payloads, message properties, tile settings.

const COVER_SECTIONS = [
    // Separate-mode capability-gated sections
    {id: 'tilt', title: 'Tilt / Slat angle', topics: [
        {attr: 'slat-angle',         label: 'Subscribe (angle)'},
        {attr: 'publish-slat-angle', label: 'Publish (angle)'},
    ]},
    {id: 'availability', title: 'Availability', topics: [
        {attr: 'subscribe-availability', label: 'Subscribe'},
    ]},
];

const JSON_CAPABILITIES = [
    // In json mode there are no per-property topic fields; tilt is read
    // from the JSON object when the `tilt` key is present. We still let
    // the user wire a separate tilt publish topic if needed.
    {id: 'tilt', title: 'Tilt / Slat angle', topics: [
        {attr: 'publish-slat-angle', label: 'Publish separate tilt topic (optional)', placeholder: 'mqtt/cover/slat/set'},
    ]},
    {id: 'availability', title: 'Availability', topics: [
        {attr: 'subscribe-availability', label: 'Subscribe'},
    ]},
];

class FeezalElementMetroCoverInspector extends LitElement {
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

    _bool(name, defaultVal = false) {
        if (!this.element) return defaultVal;
        if (!this.element.hasAttribute(name)) return defaultVal;
        return true;
    }

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
                <feezal-topic-input size="small" placeholder="${t.placeholder ?? 'mqtt/topic'}" value="${this._val(t.attr)}"
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

    _textInput(attr, label, placeholder) {
        return html`
            <div class="field">
                <label>${label}</label>
                <sl-input size="small" autocomplete="off" placeholder="${placeholder ?? ''}"
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

    _gatedSections(sections) {
        return sections.map(sec => {
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
        });
    }

    _renderTopics() {
        const isJson = (this._val('payload-mode') || 'json') === 'json';
        if (isJson) {
            return html`
                <div class="hint">JSON mode — one topic carries the whole state object.</div>
                <div class="section">
                    <div class="sec-head">State &amp; Control</div>
                    <div class="sec-body">
                        ${this._topicInput({attr: 'subscribe', label: 'Subscribe (state topic)'})}
                        ${this._topicInput({attr: 'publish',   label: 'Publish (…/set)'})}
                    </div>
                </div>
                ${this._gatedSections(JSON_CAPABILITIES)}`;
        }

        // ── Separate mode ──────────────────────────────────────────────────
        return html`
            <div class="section">
                <div class="sec-head">Position</div>
                <div class="sec-body">
                    ${this._topicInput({attr: 'subscribe-position', label: 'Subscribe'})}
                    ${this._topicInput({attr: 'publish-position',   label: 'Publish'})}
                </div>
            </div>
            <div class="section">
                <div class="sec-head">Command</div>
                <div class="sec-body">
                    ${this._topicInput({attr: 'publish-command', label: 'Up / Stop / Down'})}
                    ${this._topicInput({attr: 'publish-up',   label: 'Up (dedicated topic, optional)'})}
                    ${this._topicInput({attr: 'publish-stop', label: 'Stop (dedicated topic, optional)'})}
                    ${this._topicInput({attr: 'publish-down', label: 'Down (dedicated topic, optional)'})}
                </div>
            </div>
            ${this._gatedSections(COVER_SECTIONS)}`;
    }

    _renderConfig() {
        const payloadMode = this._val('payload-mode') || 'json';
        return html`
            <div class="section">
                <div class="sec-head">Payload mode</div>
                <div class="sec-body">
                    <div class="field">
                        <sl-select size="small" value="${payloadMode}"
                            @sl-change="${e => this._emit('payload-mode', e.target.value, true)}">
                            <sl-option value="json">json (single topic, default)</sl-option>
                            <sl-option value="separate">separate (one topic per property)</sl-option>
                        </sl-select>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Commands</div>
                <div class="sec-body">
                    ${this._textInput('payload-up',   'Up',   'OPEN')}
                    ${this._textInput('payload-stop', 'Stop', 'STOP')}
                    ${this._textInput('payload-down', 'Down', 'CLOSE')}
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Value ranges</div>
                <div class="sec-body">
                    <div class="hint">Device value scale — incoming values are scaled to 0–100&nbsp;%, published targets scaled back (Homematic: min 0, max 1).</div>
                    <div class="row">
                        ${this._numInput('min', 'Position min', '0')}
                        ${this._numInput('max', 'Position max', '100')}
                    </div>
                    <div class="row">
                        ${this._numInput('slat-min', 'Slat angle min', '0')}
                        ${this._numInput('slat-max', 'Slat angle max', '100')}
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Display</div>
                <div class="sec-body">
                    <div class="field">
                        <sl-switch size="small"
                            ?checked="${this._bool('invert', false)}"
                            @sl-change="${e => this._emit('invert', e.target.checked || null, true)}">
                            Invert (0 = open)
                        </sl-switch>
                    </div>
                    <div class="field">
                        <sl-switch size="small"
                            ?checked="${this._bool('show-position', true)}"
                            @sl-change="${e => this._emit('show-position', e.target.checked || null, true)}">
                            Show position %
                        </sl-switch>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Availability</div>
                <div class="sec-body">
                    <div class="row">
                        ${this._textInput('payload-available',   'Online payload',  'online')}
                        ${this._textInput('payload-unavailable', 'Offline payload', 'offline')}
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Message property</div>
                <div class="sec-body">
                    <div class="hint">Dot-notation path to extract a value from each message (e.g. <code>payload</code>, <code>data.value</code>). Blank = read top-level payload.</div>
                    ${this._textInput('message-property',              'Global (all topics)', 'payload')}
                    ${this._textInput('message-property-position',     'Position topic',      'payload')}
                    ${this._textInput('message-property-tilt',         'Tilt / slat topic',   'payload')}
                    ${this._textInput('message-property-availability', 'Availability topic',  'payload')}
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Tile</div>
                <div class="sec-body">
                    ${this._textInput('label', 'Label', 'Kitchen blinds')}
                    <div class="field"><label>Icon</label>
                        <feezal-icon-input .value="${this._val('icon')}"
                            @feezal-change="${e => { e.stopPropagation(); this._emit('icon', e.detail.value); }}"></feezal-icon-input></div>
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

customElements.define('feezal-element-metro-cover-inspector', FeezalElementMetroCoverInspector);
export {FeezalElementMetroCoverInspector};

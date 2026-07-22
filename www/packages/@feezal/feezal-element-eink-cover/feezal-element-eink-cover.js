/* global feezal */
import {feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {EinkBase, einkCardStyles} from '@feezal/feezal-eink';

/**
 * feezal-element-eink-cover (E57)
 *
 * E-ink shutter/cover card: oversized position numeral ("73 %", or the state
 * word when no position has arrived), a thick bordered horizontal position bar
 * (1-bit: fill = black, track = white; tap to set a target position) and three
 * flat bordered ▲ ■ ▼ buttons (≥44px tap targets). 1-bit discipline: no
 * transitions, no colors, no shadows; unavailability shows the ! badge.
 *
 * Full glass-cover wiring contract (feezal-element-glass-cover): json/separate
 * payload modes, up/stop/down command payloads, dedicated per-direction
 * publish topics (B26), position subscribe/publish with min/max value-range
 * scaling (B26), per-topic message-property twins, invert, availability and
 * the same HA/Homematic discovery map.
 *
 * Tilt/slat attributes (slat-angle, publish-slat-angle, slat-min, slat-max,
 * message-property-tilt) are DECLARED for contract/discovery parity with the
 * glass cover — incoming tilt is tracked but there is intentionally NO tilt
 * UI on the e-ink card (no room in the 1-bit layout; use the glass/material
 * card where tilt control matters).
 */

class FeezalElementEinkCover extends EinkBase {
    static get feezal() {
        return {
            palette: {name: 'Cover', category: 'Eink', color: '#222222', icon: 'blinds'},
            description: 'E-ink shutter/cover card — oversized position numeral, bordered position bar, ' +
                '▲ ■ ▼ buttons, 1-bit. Same wiring contract as the glass cover card (tilt attributes ' +
                'declared for parity, no tilt UI).',
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
                    // ── E108: native Homematic (separate-mode) keys ───────────
                    // Native-only (HA/z2m absent → skipped, additive). Homematic
                    // covers are SEPARATE mode: LEVEL position goes to the
                    // separate-mode attrs, not the json base. LEVEL is 0.0–1.0 →
                    // position_max 1 sets max=1 so the element scales to 0–100 %.
                    payload_mode:             {attr: 'payload-mode'},
                    position_state_topic:     {attr: 'subscribe-position'},
                    position_command_topic:   {attr: 'publish-position'},
                    stop_command_topic:       {attr: 'publish-stop'},
                    // E120: native Homematic — Up/Down buttons drive the LEVEL set
                    // topic (payload_open/close 1/0 arrive via the payload map above).
                    open_command_topic:       {attr: 'publish-up'},
                    close_command_topic:      {attr: 'publish-down'},
                    position_min:             {attr: 'min'},
                    position_max:             {attr: 'max'},
                    message_property:          {attr: 'message-property'},
                    message_property_position: {attr: 'message-property-position'},
                    // N31: availability is mapped automatically from the canonical discovery record.
                    name: 'label',
                },
            },
            attributes: [
                {name: 'payload-mode', type: 'select', options: ['json', 'separate'], default: 'json',
                    help: 'json = single topic carrying a JSON object (default, matches zigbee2mqtt); separate = one topic per property.'},
                {name: 'subscribe', type: 'mqttTopic', help: 'json mode: base topic carrying the cover state (position, state, …).'},
                {name: 'publish',   type: 'mqttTopic', help: 'json mode: command/set topic (accepts {position:50} or {state:"OPEN"}).'},
                {name: 'json-map',  type: 'string', default: '', help: 'json mode: optional JSON string overriding the default {state, position, tilt} key map.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'json mode: dot-notation path to the JSON state object within the MQTT message. Default: payload'},
                {name: 'subscribe-position', type: 'mqttTopic', help: 'separate mode: current position (0=closed, 100=open).'},
                {name: 'message-property-position', type: 'string', default: 'payload', help: 'Property path within position messages. Defaults to message-property.'},
                {name: 'publish-position', type: 'mqttTopic', help: 'separate mode: target position topic.'},
                {name: 'publish-command',  type: 'mqttTopic', help: 'separate mode: up/stop/down command topic.'},
                {name: 'publish-up',   type: 'mqttTopic', help: 'Optional dedicated topic for the Up button. Takes precedence over publish-command.'},
                {name: 'publish-stop', type: 'mqttTopic', help: 'Optional dedicated topic for the Stop button. Takes precedence over publish-command.'},
                {name: 'publish-down', type: 'mqttTopic', help: 'Optional dedicated topic for the Down button. Takes precedence over publish-command.'},
                {name: 'payload-up',   type: 'string', default: 'OPEN',  help: 'Payload sent by the Up button.'},
                {name: 'payload-stop', type: 'string', default: 'STOP',  help: 'Payload sent by the Stop button.'},
                {name: 'payload-down', type: 'string', default: 'CLOSE', help: 'Payload sent by the Down button.'},
                {name: 'min', type: 'number', default: 0,   help: 'Device position range minimum. Incoming positions are scaled from min…max to 0–100 %, published targets scaled back (Homematic reports 0…1: set max to 1).'},
                {name: 'max', type: 'number', default: 100, help: 'Device position range maximum. Incoming positions are scaled from min…max to 0–100 %, published targets scaled back (Homematic reports 0…1: set max to 1).'},
                // Tilt attributes: contract/discovery parity only — no tilt UI (see doc comment).
                {name: 'slat-angle',   type: 'mqttTopic', help: 'Subscribe: venetian-blind tilt/slat angle (0–100). Declared for wiring parity — the e-ink card has no tilt UI.'},
                {name: 'message-property-tilt', type: 'string', default: 'payload', help: 'Property path within slat-angle messages. Defaults to message-property.'},
                {name: 'publish-slat-angle', type: 'mqttTopic', help: 'Publish: new slat angle (0–100). Declared for wiring parity — the e-ink card has no tilt UI.'},
                {name: 'slat-min', type: 'number', default: 0,   help: 'Device slat-angle range minimum. Incoming angles are scaled from slat-min…slat-max to 0–100 %.'},
                {name: 'slat-max', type: 'number', default: 100, help: 'Device slat-angle range maximum. Incoming angles are scaled from slat-min…slat-max to 0–100 %.'},
                {name: 'invert',        type: 'boolean', default: false, help: 'Invert position scale: 0=open, 100=closed.'},
                {name: 'show-position', type: 'boolean', default: true,  help: 'Show the numeric position % as the oversized value (state word otherwise).'},
                {name: 'label', type: 'string', help: 'Label line (rendered uppercase).'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability — a ! badge appears while unavailable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-eink-font-size-value', default: '34px', help: 'Position numeral font size.'},
                {property: '--feezal-eink-font-size-label', default: '13px', help: 'Label font size.'},
                {property: '--feezal-eink-rule', default: '3px', help: 'Rule/border thickness (≥2px).'},
            ],
            defaultStyle: {width: '200px', height: '150px'},
            restrict: {minWidth: 120, minHeight: 90},
        };
    }

    static properties = {
        payloadMode:       {type: String,  reflect: true, attribute: 'payload-mode'},
        publish:           {type: String,  reflect: true},
        jsonMap:           {type: String,  reflect: true, attribute: 'json-map'},
        subscribePosition: {type: String,  reflect: true, attribute: 'subscribe-position'},
        msgPropPosition:   {type: String,  reflect: true, attribute: 'message-property-position'},
        publishPosition:   {type: String,  reflect: true, attribute: 'publish-position'},
        publishCommand:    {type: String,  reflect: true, attribute: 'publish-command'},
        publishUp:         {type: String,  reflect: true, attribute: 'publish-up'},
        publishStop:       {type: String,  reflect: true, attribute: 'publish-stop'},
        publishDown:       {type: String,  reflect: true, attribute: 'publish-down'},
        payloadUp:         {type: String,  reflect: true, attribute: 'payload-up'},
        payloadStop:       {type: String,  reflect: true, attribute: 'payload-stop'},
        payloadDown:       {type: String,  reflect: true, attribute: 'payload-down'},
        min:               {type: Number,  reflect: true},
        max:               {type: Number,  reflect: true},
        slatMin:           {type: Number,  reflect: true, attribute: 'slat-min'},
        slatMax:           {type: Number,  reflect: true, attribute: 'slat-max'},
        slatAngle:         {type: String,  reflect: true, attribute: 'slat-angle'},
        msgPropTilt:       {type: String,  reflect: true, attribute: 'message-property-tilt'},
        publishSlatAngle:  {type: String,  reflect: true, attribute: 'publish-slat-angle'},
        invert:            {type: Boolean, reflect: true},
        showPosition:      {type: Boolean, reflect: true, attribute: 'show-position'},
        label:             {type: String,  reflect: true},
        // N31: availability inherited from FeezalElement.
        discoveryId:       {type: String,  reflect: true, attribute: 'discovery-id'},
        _position: {state: true},   // 0–100, null = unknown
        _tilt:     {state: true},   // tracked for parity, not rendered
    };

    static styles = [feezalBaseStyles, einkCardStyles, css`
        .card { gap: 4px; }
        .value { text-align: center; }
        /* Position bar — 1-bit: bordered track (bg), solid fg fill = open portion. */
        .bar {
            position: relative; height: 18px; flex: 0 0 auto;
            border: var(--feezal-eink-rule, 3px) solid var(--_fg);
            background: var(--_bg); overflow: hidden; cursor: pointer;
            border-radius: var(--feezal-eink-radius, 0px);
        }
        .bar .fill { position: absolute; top: 0; bottom: 0; left: 0; background: var(--_fg); }
        .buttons { display: flex; gap: 6px; }
        .buttons button {
            flex: 1; min-height: 44px;
            border: var(--feezal-eink-rule, 3px) solid var(--_fg); background: var(--_bg);
            color: var(--_fg); font: inherit; font-size: 20px; line-height: 1; cursor: pointer;
            border-radius: var(--feezal-eink-radius, 0px);
        }
        .buttons button:active { background: var(--_fg); color: var(--_bg); }
        .label { text-align: center; }
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
        this.slatMin = 0;
        this.slatMax = 100;
        this.slatAngle = '';
        this.msgPropTilt = '';
        this.publishSlatAngle = '';
        this.invert = false;
        this.showPosition = true;
        this.label = '';
        this.discoveryId = '';
        this._position = null;
        this._tilt = null;
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    get _map() {
        const defaults = {state: 'state', position: 'position', tilt: 'tilt'};
        if (this.jsonMap) {
            try { return {...defaults, ...JSON.parse(this.jsonMap)}; } catch { /* defaults */ }
        }
        return defaults;
    }

    // Device value range (min/max, slat-min/slat-max attributes) <-> displayed 0–100 %.
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

    _posIn(v)    { return this.constructor._scaleIn(v, this._range); }
    _posOut(pct) { return this.constructor._scaleOut(pct, this._range); }
    _tiltIn(v)   { return this.constructor._scaleIn(v, this._slatRange); }

    connectedCallback() {
        super.connectedCallback();
        this._wireSubscriptions();
    }

    /** Topic attributes changed at runtime (inspector edits on the live
     * canvas) → updated() rewires instead of keeping the stale topics. */
    _wireSignature() {
        return [this.payloadMode, this.subscribe, this.subscribePosition, this.slatAngle].join('|');
    }

    updated(changed) {
        super.updated(changed);
        if (this.isConnected && this.__wireSig !== undefined && this._wireSignature() !== this.__wireSig) {
            this._unsubscribe();
            this._wireSubscriptions();
        }
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

    // Identical inference to glass/material-cover: numeric position primary,
    // state string fallback when no position arrived yet.
    _applyJsonState(obj) {
        const map = this._map;
        const get = key => this.getProperty(obj, key);

        const pos = get(map.position);
        if (pos !== null && pos !== undefined) {
            const n = Number(pos);
            if (!isNaN(n)) this._position = Math.max(0, Math.min(100, this._posIn(n)));
        }

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

    _pub(topic, value, jsonObj) {
        if (feezal.isEditor) return;
        if (this.payloadMode === 'json') {
            if (this.publish) feezal.connection.pub(this.publish, JSON.stringify(jsonObj));
        } else if (topic) {
            feezal.connection.pub(topic, String(value));
        }
    }

    // Dedicated per-direction topic (publish-up/-stop/-down, B26) wins over
    // the single publish-command topic / json publish topic.
    _cmd(dedicatedTopic, payload) {
        if (feezal.isEditor) return;
        if (dedicatedTopic) {
            feezal.connection.pub(dedicatedTopic, String(payload));
            return;
        }
        this._pub(this.publishCommand, payload, {[this._map.state]: payload});
    }

    cmdUp()   { this._cmd(this.publishUp,   this.payloadUp); }
    cmdStop() { this._cmd(this.publishStop, this.payloadStop); }
    cmdDown() { this._cmd(this.publishDown, this.payloadDown); }

    setPosition(pos) {
        if (feezal.isEditor) return;
        const clamped = Math.max(0, Math.min(100, Math.round(Number(pos))));
        this._position = clamped;
        const raw = this._posOut(clamped);
        this._pub(this.publishPosition, raw, {[this._map.position]: raw});
    }

    /** Tap on the position bar → target position (effective %, invert-aware). */
    _barClick(e) {
        if (feezal.isEditor) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
        const eff = Math.max(0, Math.min(100, pct));
        this.setPosition(this.invert ? 100 - eff : eff);
    }

    /** Effective open % (0 = closed), invert-aware; null = unknown. */
    _effPos() {
        const pos = this._position ?? (feezal.isEditor && !this.subscribe && !this.subscribePosition ? 73 : null);
        if (pos === null) return null;
        const eff = this.invert ? 100 - pos : pos;
        return Math.round(eff);
    }

    /** Oversized line: "73 %", or the state word (no position / show-position off). */
    _valueText() {
        const eff = this._effPos();
        if (eff === null) return '—';
        const word = eff <= 0 ? 'CLOSED' : (eff >= 100 ? 'OPEN' : null);
        if (!this.showPosition) return word ?? `${eff} %`;
        return word && (eff <= 0 || eff >= 100) ? word : `${eff} %`;
    }

    /** E57 redraw dedup: everything visibly rendered, values as shown. */
    renderSignature() {
        const eff = this._effPos();
        return [this._valueText(), eff === null ? '' : eff, this._available, this.label].join('|');
    }

    render() {
        const eff = this._effPos();
        return html`
            <div class="card">
                ${!this._available ? html`<span class="badge-tr" title="Device unavailable">!</span>` : ''}
                <span class="value">${this._valueText()}</span>
                <div class="bar" title="Set position" @click="${this._barClick}">
                    <div class="fill" style="width:${eff ?? 0}%"></div>
                </div>
                <div class="buttons">
                    <button title="Up" @click="${this.cmdUp}">▲</button>
                    <button title="Stop" @click="${this.cmdStop}">■</button>
                    <button title="Down" @click="${this.cmdDown}">▼</button>
                </div>
                ${this.label ? html`<span class="label">${this.label}</span>` : ''}
            </div>
        `;
    }
}

customElements.define('feezal-element-eink-cover', FeezalElementEinkCover);
export {FeezalElementEinkCover};

/* global feezal */
import {feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {SettlingController} from '@feezal/feezal-element/feezal-settling.js';
import {EinkBase, einkCardStyles, payloadMatch} from '@feezal/feezal-eink';

/**
 * feezal-element-eink-light (E57)
 *
 * E-ink light card: state word (card inverts while on), brightness percent as
 * an oversized numeral, flat bordered − / + buttons stepping brightness by
 * 10 %. Tap anywhere else on the card toggles.
 *
 * MQTT wiring contract mirrors feezal-element-glass-light — SAME attribute
 * names, both payload modes (json / separate), the E77 brightness-derived
 * on/off (Homematic dimmers), brightness-min/max range scaling, per-topic
 * message-property twins and the E127 ramp-settling machinery
 * (WORKING / settled topics via SettlingController).
 *
 * 1-bit scope decision: there is NO color UI on e-paper. Every color `mode`
 * value (hs / rgb / brightness_ct / color_temp) degrades to plain
 * 'brightness' behaviour — a discovered color lamp still dims and toggles.
 * The color-only attributes that glass-light's discovery map stamps
 * (subscribe/publish-color-temp, color-temp-unit/min/max, and the RGB/HS
 * topic set) are still DECLARED below so discovery stamps identically and
 * the contract stays parity-compatible, but they are UNUSED: nothing is
 * subscribed or published on them. `mode: on_off` (E122) is honoured — a
 * switch-only lamp renders the state word oversized without stepper buttons.
 *
 * Family conventions (1-bit palette, redraw dedup): see @feezal/feezal-eink.
 */

// ── Range helpers — duplicated from glass-light's exports, keep in sync ──────
// (importing them from the glass package would pull the whole glass element
// chain into the eink bundle).

/** % → raw MQTT value: integer ranges publish whole numbers, sub-integer
 * ranges (Homematic LEVEL 0–1) keep the needed decimals. */
function pctToRaw(pct, min, max) {
    const value = min + (pct / 100) * (max - min);
    const step = Math.abs(max - min) / 100;
    if (step >= 1 || step === 0) return Math.round(value);
    const decimals = Math.min(6, Math.ceil(-Math.log10(step)));
    return Number(value.toFixed(decimals));
}

/** Raw MQTT value → 0–100 %, clamped. */
function rawToPct(raw, min, max) {
    const n = Number(raw);
    if (!Number.isFinite(n) || max === min) return null;
    return Math.max(0, Math.min(100, Math.round(((n - min) / (max - min)) * 100)));
}

const BRIGHTNESS_STEP = 10;   // % per −/+ tap

class FeezalElementEinkLight extends EinkBase {
    static get feezal() {
        return {
            palette: {name: 'Light', category: 'Eink', color: '#222222', icon: 'lightbulb'},
            description: 'E-ink light card — state word (inverted while on), oversized brightness %, ' +
                'flat − / + steppers (10 % per tap), tap toggles. Same wiring contract as the glass ' +
                'light card; color modes degrade to brightness (1-bit).',
            // Copied as-is from glass-light so discovery stamps identically.
            discovery: {
                component: 'light',
                map: {
                    schema:           {attr: 'payload-mode', valueMap: {json: 'json', _default: 'separate'}},
                    state_topic:      'subscribe',
                    // E126: native Homematic relay-as-light — on/off command topic.
                    state_command_topic: 'publish-state',
                    command_topic:    {attr: 'publish', onlyWhen: {schema: 'json'}},
                    brightness_state_topic:   'subscribe-brightness',
                    brightness_command_topic: 'publish-brightness',
                    brightness_scale: {attr: 'brightness-max'},
                    color_temp_state_topic:   'subscribe-color-temp',
                    color_temp_command_topic: 'publish-color-temp',
                    supported_color_modes:    {attr: 'mode', transform: 'colorMode'},
                    min_mireds: {attr: 'color-temp-max', unit: 'mired→kelvin', alsoSet: {'color-temp-unit': 'mired'}},
                    max_mireds: {attr: 'color-temp-min', unit: 'mired→kelvin'},
                    // E108 native Homematic (separate-mode dimmer) — HA-absent keys,
                    // additive (brightness_state/command_topic already mapped above).
                    payload_mode:             'payload-mode',
                    brightness_min:           {attr: 'brightness-min'},
                    on_off_source:            'on-off-source',
                    payload_off:              'payload-off',
                    payload_on:               'payload-on',
                    message_property:             'message-property',
                    message_property_brightness:  'message-property-brightness',
                    message_property_state:       'message-property-state',
                    // E127: ramp settling — emitted only when the recognizer has
                    // observed the topics (WORKING / RedMatic LEVEL_NOTWORKING).
                    working_topic:            'subscribe-working',
                    message_property_working: 'message-property-working',
                    settled_topic:            'subscribe-settled',
                    message_property_settled: 'message-property-settled',
                    // N31: availability is mapped automatically from the canonical discovery record.
                    name: 'label',
                },
            },
            attributes: [
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
                {name: 'publish-brightness', type: 'mqttTopic', help: 'Publish brightness on − / + steps.'},
                {name: 'brightness-min', type: 'number', default: 0,   help: 'Minimum brightness value on the MQTT topic.'},
                {name: 'brightness-max', type: 'number', default: 100, help: 'Maximum brightness value on the MQTT topic (z2m: 254, Homematic: 1).'},
                // E127: ramp settling (Homematic dimmers report every intermediate
                // level while ramping — these keep the displayed % from jumping).
                {name: 'subscribe-working', type: 'mqttTopic', help: 'WORKING datapoint topic (true while the level ramps, e.g. hm/status/<dimmer>/WORKING). While true, brightness reports are suppressed instead of redrawing the panel per step; false applies the final value.'},
                {name: 'message-property-working', type: 'string', default: 'payload.val', help: 'Property path for the WORKING topic (mqtt-smarthome publishes {"val": true} → payload.val).'},
                {name: 'subscribe-settled', type: 'mqttTopic', help: 'Settled-values topic carrying only final levels (RedMatic: …/LEVEL_NOTWORKING). When set, the displayed % follows THIS topic.'},
                {name: 'message-property-settled', type: 'string', default: 'payload.val', help: 'Property path for the settled topic (mqtt-smarthome: payload.val).'},
                {name: 'settle-timeout', type: 'number', default: 5, help: 'Seconds after a command before the displayed % reconciles to the last reported value (covers interrupted ramps and sentinel commands like 1.005).'},
                {name: 'report-delay-ms', type: 'number', default: 100, help: 'Only with subscribe-working: delay before showing an incoming brightness report — a WORKING=true within the window suppresses ramp jitter from changes made elsewhere. 0 disables.'},
                {name: 'mode', type: 'select', options: ['on_off', 'brightness', 'brightness_ct', 'color_temp', 'rgb', 'hs'], default: 'brightness',
                    help: 'Capability declaration (kept parity-compatible with glass-light). 1-bit e-ink has no color UI: every color value (brightness_ct / color_temp / rgb / hs) behaves as plain brightness. on_off (E122) = switch-only lamp — no stepper buttons.'},
                // ── Declared for discovery/contract parity — UNUSED on 1-bit e-ink ──
                {name: 'subscribe-color-temp', type: 'mqttTopic', help: 'Unused on e-ink (no color UI) — declared so discovery stamps identically to glass-light.'},
                {name: 'message-property-color-temp', type: 'string', default: 'payload', help: 'Unused on e-ink — declared for contract parity.'},
                {name: 'publish-color-temp', type: 'mqttTopic', help: 'Unused on e-ink — declared for contract parity.'},
                {name: 'color-temp-unit', type: 'select', options: ['kelvin', 'mired'], default: 'kelvin', help: 'Unused on e-ink — declared for contract parity (discovery may stamp mired).'},
                {name: 'color-temp-min', type: 'number', default: 2700, help: 'Unused on e-ink — declared for contract parity.'},
                {name: 'color-temp-max', type: 'number', default: 6500, help: 'Unused on e-ink — declared for contract parity.'},
                {name: 'subscribe-rgb', type: 'mqttTopic', help: 'Unused on e-ink (no color UI) — declared for contract parity.'},
                {name: 'message-property-rgb', type: 'string', default: 'payload', help: 'Unused on e-ink — declared for contract parity.'},
                {name: 'publish-rgb', type: 'mqttTopic', help: 'Unused on e-ink — declared for contract parity.'},
                {name: 'subscribe-hs', type: 'mqttTopic', help: 'Unused on e-ink (no color UI) — declared for contract parity.'},
                {name: 'message-property-hs', type: 'string', default: 'payload', help: 'Unused on e-ink — declared for contract parity.'},
                {name: 'publish-hs', type: 'mqttTopic', help: 'Unused on e-ink — declared for contract parity.'},
                // ── Availability (N31) ──
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability — a ! badge appears while unavailable, the card stays usable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
                {name: 'label', type: 'string', help: 'Label line (rendered uppercase).'},
                {name: 'label-on',  type: 'string', default: 'On',  help: 'Displayed state word while the light is on (localise, e.g. "Ein"). Display only — NOT the MQTT payload (payload-on) and NOT the card title (label).'},
                {name: 'label-off', type: 'string', default: 'Off', help: 'Displayed state word while the light is off (localise, e.g. "Aus"). Display only — NOT the MQTT payload (payload-off) and NOT the card title (label).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-eink-font-size-value', default: '34px', help: 'Brightness numeral font size.'},
                {property: '--feezal-eink-font-size-label', default: '13px', help: 'Label/state word font size.'},
                {property: '--feezal-eink-rule', default: '3px', help: 'Rule/border thickness (≥2px).'},
            ],
            defaultStyle: {width: '200px', height: '120px'},
            restrict: {minWidth: 120, minHeight: 80},
        };
    }

    static properties = {
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
        // E127: ramp settling
        subscribeWorking:    {type: String, reflect: true, attribute: 'subscribe-working'},
        msgPropWorking:      {type: String, reflect: true, attribute: 'message-property-working'},
        subscribeSettled:    {type: String, reflect: true, attribute: 'subscribe-settled'},
        msgPropSettled:      {type: String, reflect: true, attribute: 'message-property-settled'},
        settleTimeout:       {type: Number, reflect: true, attribute: 'settle-timeout'},
        reportDelayMs:       {type: Number, reflect: true, attribute: 'report-delay-ms'},
        mode:                {type: String, reflect: true},
        // Declared for discovery/contract parity — unused on 1-bit e-ink.
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
        discoveryId:         {type: String, reflect: true, attribute: 'discovery-id'},
    };

    static styles = [feezalBaseStyles, einkCardStyles, css`
        .card { gap: 3px; cursor: pointer; }
        .row { display: flex; align-items: center; gap: 8px; }
        .brt { flex: 1; text-align: center; }
        .stepbtn {
            flex: 0 0 auto; min-width: 40px; min-height: 44px;
            border: var(--feezal-eink-rule, 3px) solid currentColor; background: none;
            color: inherit; font: inherit; font-size: 26px; line-height: 1; cursor: pointer;
            border-radius: var(--feezal-eink-radius, 0px);
        }
        .state {
            font-size: var(--feezal-eink-font-size-label, 13px); font-weight: 700;
            text-transform: uppercase; letter-spacing: 0.06em; text-align: center;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        /* on_off lamps: the state word IS the value. */
        .value.stateword { text-align: center; text-transform: uppercase; }
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
        // E127: ramp settling
        this.subscribeWorking = '';
        this.msgPropWorking = 'payload.val';
        this.subscribeSettled = '';
        this.msgPropSettled = 'payload.val';
        this.settleTimeout = 5;
        this.reportDelayMs = 100;
        this.mode = 'brightness';
        // Parity-only (unused, see doc comment).
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
        this.discoveryId = '';
        // E57 dedup: MQTT-driven state lives in PLAIN fields (not reactive
        // properties) — handlers mutate + requestUpdate(), and EinkBase drops
        // the redraw whenever renderSignature() is unchanged.
        this._on = false;
        this._brt = null;       // 0–100 % (null = unknown)
        this._brtLive = null;   // E127 dual-topic mode: live % while settled holds
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    get _map() {
        const defaults = {state: 'state', brightness: 'brightness'};
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
            this.subscribeBrightness,
            // E127
            this.subscribeWorking, this.subscribeSettled, this.settleTimeout, this.reportDelayMs].join('|');
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
                    // Color keys (color_temp/color) are ignored — no color UI on 1-bit.
                    this.requestUpdate();
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
                this.requestUpdate();
            });
        }
        if (this.subscribeBrightness) {
            // E127: brightness reports run through the SettlingController — it
            // decides which ones may reach the display (hold-at-target after
            // own commands, WORKING-gated suppression, optional settled topic).
            this._settling?.dispose();
            this._settling = new SettlingController({
                apply: raw => { this._applyBrightness(raw); this.requestUpdate(); },
                timeoutMs: (Math.max(0, Number(this.settleTimeout)) || 5) * 1000,
                reportDelayMs: Math.max(0, Number(this.reportDelayMs ?? 100) || 0),
                workingWired: Boolean(this.subscribeWorking),
                settledWired: Boolean(this.subscribeSettled),
            });
            this.addSubscription(this.subscribeBrightness, msg => {
                const raw = this.getProperty(msg, this.msgPropBrightness || this.messageProperty);
                const v = Number(raw);
                if (isNaN(v)) return;
                if (this.subscribeSettled) {
                    // Dual-topic mode (RedMatic): live topic keeps the % text
                    // updating; the settled topic ends the hold. On e-ink the
                    // dedup means intermediate identical values cost nothing.
                    this._brtLive = rawToPct(raw, Number(this.brightnessMin) || 0, Number(this.brightnessMax) ?? 100);
                    this.requestUpdate();
                }
                this._settling.live(v);
            });
            if (this.subscribeWorking) {
                this.addSubscription(this.subscribeWorking, msg => {
                    const v = this.getProperty(msg, this.msgPropWorking || 'payload.val');
                    this._settling.working(v === true || v === 'true' || v === 1 || v === '1');
                });
            }
            if (this.subscribeSettled) {
                this.addSubscription(this.subscribeSettled, msg => {
                    const v = Number(this.getProperty(msg, this.msgPropSettled || 'payload.val'));
                    if (!isNaN(v)) this._settling.settled(v);
                });
            }
        }
        // Color-temp/RGB/HS topics: intentionally NOT wired (1-bit, no color UI).
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
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        // E127: clear pending hold/buffer timers with the subscriptions.
        this._settling?.dispose();
        this._settling = null;
    }

    /** Store brightness %, deriving on/off when on-off-source=brightness (E77). */
    _applyBrightness(raw) {
        const pct = rawToPct(raw, Number(this.brightnessMin) || 0, Number(this.brightnessMax) ?? 100);
        if (pct !== null) {
            this._brt = pct;
            this._brtLive = null;   // E127: settled — live readout re-syncs
        }
        if (this.onOffSource === 'brightness') {
            const n = Number(raw);
            this._on = Number.isFinite(n) ? n !== this._offRaw : false;
        }
    }

    // ── publishing (identical semantics to glass-light) ──────────────────────

    _pubJson(obj) {
        if (this.publish) feezal.connection.pub(this.publish, JSON.stringify(obj));
    }

    toggle() {
        if (feezal.isEditor) return;
        const next = !this._on;
        this._on = next;
        this.requestUpdate();
        if (this.payloadMode === 'json') {
            this._pubJson({[this._map.state]: next ? this.payloadOn : this.payloadOff});
            return;
        }
        if (this.onOffSource === 'brightness') {
            // E77: on/off travels over the brightness topic (Homematic:
            // payload-on 1.005 restores the previous level, payload-off 0).
            if (this.publishBrightness) {
                const payload = next ? this.payloadOn : this.payloadOff;
                feezal.connection.pub(this.publishBrightness, payload);
                // E127: sentinel targets (1.005 OLD_LEVEL) are never echoed
                // verbatim, so they hold ONLY when a WORKING/settled signal can
                // end the hold — otherwise ramp reports keep flowing as before.
                const n = Number(payload);
                const min = Number(this.brightnessMin) || 0;
                const max = Number(this.brightnessMax) ?? 100;
                const inRange = Number.isFinite(n) && n >= Math.min(min, max) && n <= Math.max(min, max);
                if (inRange || this.subscribeWorking || this.subscribeSettled) this._settling?.command(n);
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
        this.requestUpdate();
        const raw = pctToRaw(clamped, Number(this.brightnessMin) || 0, Number(this.brightnessMax) ?? 100);
        if (this.payloadMode === 'json') {
            this._pubJson({[this._map.brightness]: raw});
            return;
        }
        if (this.publishBrightness) {
            feezal.connection.pub(this.publishBrightness, raw);
            this._settling?.command(Number(raw));
        }
        if (this.onOffSource === 'brightness') {
            this._on = raw !== this._offRaw;
        }
    }

    _stepBrightness(direction) {
        if (feezal.isEditor) return;
        const current = this._brt ?? 0;
        this.setBrightness(current + direction * BRIGHTNESS_STEP);
    }

    _onCardClick() {
        if (feezal.isEditor) return;
        this.toggle();
    }

    // ── rendering ─────────────────────────────────────────────────────────────

    /** on_off (E122) = switch-only lamp, no stepper row. Every OTHER mode —
     * including all color modes — behaves as plain brightness on 1-bit. */
    _dimmable() {
        if ((this.mode || 'brightness') === 'on_off') return false;
        return Boolean(this.subscribeBrightness || this.publishBrightness ||
            this.payloadMode === 'json' || this.onOffSource === 'brightness');
    }

    _stateWord() {
        return this._on ? (this.labelOn || 'On') : (this.labelOff || 'Off');
    }

    /** Displayed brightness % (live topic during ramps) — null hides the numeral. */
    _brtShown() {
        const brt = this._brtLive ?? this._brt;
        if (brt !== null && brt !== undefined) return Math.round(brt);
        // Editor placeholder when nothing is wired yet.
        if (feezal.isEditor && !this.subscribeBrightness && !this.subscribe) return 72;
        return null;
    }

    /** E57 redraw dedup: everything visibly rendered, values as shown. */
    renderSignature() {
        const brt = this._brtShown();
        return [this._stateWord(), this._on, brt === null ? '—' : brt,
            this._dimmable(), this._available].join('|');
    }

    render() {
        const dimmable = this._dimmable();
        const brt = this._brtShown();
        const word = this._stateWord();
        return html`
            <div class="card ${this._on ? 'inv' : ''}" role="button" tabindex="0"
                @click="${this._onCardClick}"
                @keydown="${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(); } }}">
                ${!this._available ? html`<span class="badge-tr" title="Device unavailable">!</span>` : ''}
                ${dimmable ? html`
                    <span class="state">${word}</span>
                    <div class="row">
                        <button class="stepbtn" title="Dim −${BRIGHTNESS_STEP} %"
                            @click="${e => { e.stopPropagation(); this._stepBrightness(-1); }}">−</button>
                        <span class="value brt">${brt === null ? '—' : html`${brt}<span class="unit">%</span>`}</span>
                        <button class="stepbtn" title="Dim +${BRIGHTNESS_STEP} %"
                            @click="${e => { e.stopPropagation(); this._stepBrightness(1); }}">+</button>
                    </div>` : html`
                    <span class="value stateword">${word}</span>`}
                ${this.label || feezal.isEditor ? html`<span class="label">${this.label || (feezal.isEditor ? 'Light' : '')}</span>` : ''}
            </div>
        `;
    }
}

customElements.define('feezal-element-eink-light', FeezalElementEinkLight);
export {FeezalElementEinkLight};

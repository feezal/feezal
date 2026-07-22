/**
 * @feezal/feezal-controller-climate (E137 — the decided-first slice)
 *
 * The thermostat MQTT contract as a Lit Reactive Controller — the ENTIRE
 * behavior extracted from the three climate cards (whose B53–B58 fixes are
 * this controller's regression fixtures): both payload modes (json = z2m
 * TRVs, separate = per-property topics), setpoint/actual/mode/valve/
 * humidity/boost wiring, the E102 mode-entry machinery (per-entry publish,
 * type-preserving `$setpoint` — B58, `match-setpoint-max` off-sentinel with
 * the CURRENT-setpoint comparison — B53, momentary boost with both
 * off-strategies + countdown — E102 WP2, device-reported boost state —
 * B54), valve scaling, and the **E124 low-battery contract** (climate/TRVs
 * are battery devices more often than not).
 *
 * The family element is a VIEW: it reads the controller's plain state
 * fields, renders its own chrome, and forwards gestures to the commands
 * (`setSetpoint`, `setMode`). Config is read from HOST ATTRIBUTES; family
 * quirks are constructor options, not forks:
 *   {json: false}                 — metro has no json payload mode
 *   {actualFromSubscribe: true}   — metro reads the actual temp from `subscribe`
 *   {humidity: true}              — material shows humidity
 *
 * E137 packaging: controller + attribute fragment + discovery.map fragment
 * as one unit; `consumes` feeds the E114 parity-set derivation.
 */

import {batteryLowAttributes, batteryLowFromValue} from '@feezal/feezal-element/feezal-sensor-types.js';

export {batteryLowFromValue};

const MODES_HELP =
    'JSON array of mode entries. Simple: [{"value":"heat","label":"Heat"},…] publishes the value on publish-mode. ' +
    'E102 per-entry overrides: add "publish"+"payload" to write a specific datapoint — payload is a string OR a JSON ' +
    'object (published as-is, e.g. to a putParamset topic hm/paramset/<channel>/VALUES with {"CONTROL_MODE":1,"SET_POINT_TEMPERATURE":4.5}). ' +
    '"$setpoint" in a payload resolves to the last real setpoint (Homematic MANU_MODE=$setpoint; "off" = manual + 4.5). ' +
    'A "momentary":true entry (boost) is a push button — activate publishes it; deactivate runs "off": {"publish","payload"} ' +
    '(HmIP BOOST_MODE=false) or "off":"restore" (BidCoS — re-apply the pre-boost mode). ' +
    'An "off" entry may carry "match-setpoint-max" (e.g. 4.5): when several entries share the same mode read-back value, ' +
    'the entry with match-setpoint-max shows active only while the CURRENT setpoint is <= that number.';

/** Shared attribute descriptors — spread into every family's `feezal.attributes`. */
export const climateAttributes = [
    {name: 'payload-mode', type: 'select', options: ['separate', 'json'], default: 'separate',
        help: 'separate = one topic per property (default); json = single topic carrying the full climate JSON object (zigbee2mqtt TRVs).'},
    {name: 'subscribe', type: 'mqttTopic', help: 'json mode: base topic carrying the climate state JSON object.'},
    {name: 'publish',   type: 'mqttTopic', help: 'json mode: command/set topic (e.g. zigbee2mqtt/TRV/set).'},
    {name: 'json-map',  type: 'string', default: '', help: 'json mode: optional JSON map overriding default keys. E.g. {"setpoint":"target_temp","actual":"temperature"}.'},
    {name: 'message-property', type: 'string', default: 'payload', help: 'Dot-notation path to the value within the MQTT message. Default: payload'},
    {name: 'subscribe-setpoint', type: 'mqttTopic', help: 'separate: topic publishing the current setpoint.'},
    {name: 'message-property-setpoint', type: 'string', default: 'payload', help: 'Dot-notation path within setpoint messages. Blank = element-level message-property.'},
    {name: 'publish-setpoint', type: 'mqttTopic', help: 'separate: topic to publish a new setpoint to.'},
    {name: 'subscribe-actual', type: 'mqttTopic', help: 'Topic for the actual measured temperature.'},
    {name: 'message-property-actual', type: 'string', default: 'payload', help: 'Dot-notation path within actual-temperature messages. Blank = element-level message-property.'},
    {name: 'subscribe-mode', type: 'mqttTopic', help: 'separate: topic publishing the current operating mode.'},
    {name: 'message-property-mode', type: 'string', default: 'payload', help: 'Dot-notation path within mode messages. Blank = element-level message-property.'},
    {name: 'publish-mode', type: 'mqttTopic', help: 'separate: topic to publish the selected mode to.'},
    {name: 'subscribe-valve', type: 'mqttTopic',
        help: 'Optional: valve/position level. Scaled from valve-min…valve-max to 0–100 %. Wall thermostats and heating groups have no valve of their own — point this at a member TRV or a pre-aggregated topic.'},
    {name: 'message-property-valve', type: 'string', default: 'payload', help: 'Dot-notation path within the valve message. Blank = element-level message-property.'},
    {name: 'valve-min', type: 'number', default: 0, help: 'E102: valve device range minimum (BidCoS VALVE_STATE 0–100 → leave default; HmIP LEVEL 0…1 → set valve-max to 1).'},
    {name: 'valve-max', type: 'number', default: 100, help: 'E102: valve device range maximum (100 for BidCoS, 1 for HmIP LEVEL; stamped from real metadata by discovery — B56).'},
    {name: 'min',  type: 'number', default: 5,    help: 'Minimum setpoint value.'},
    {name: 'max',  type: 'number', default: 30,   help: 'Maximum setpoint value.'},
    {name: 'step', type: 'number', default: 0.5,  help: 'Setpoint snap increment.'},
    {name: 'unit', type: 'string', default: '°C', help: 'Temperature unit label.'},
    {name: 'modes', type: 'string', default: '', help: MODES_HELP},
    {name: 'boost-duration', type: 'number', default: 5,
        help: 'E102 boost countdown: duration in minutes (Homematic default 5). Without subscribe-boost-remaining a client-side mm:ss countdown starts from this value.'},
    {name: 'subscribe-boost-remaining', type: 'mqttTopic',
        help: 'E102 boost countdown: optional device-reported remaining time (badge shows this instead of the client timer).'},
    {name: 'message-property-boost-remaining', type: 'string', default: 'payload', help: 'Dot-notation path within the boost-remaining message. Blank = element-level message-property.'},
    {name: 'boost-remaining-unit', type: 'select', options: ['minutes', 'seconds'], default: 'minutes',
        help: 'Unit of the subscribe-boost-remaining value (BidCoS BOOST_STATE reports minutes).'},
    {name: 'subscribe-boost-state', type: 'mqttTopic',
        help: 'B54: optional device-reported boost active state (Homematic BOOST_MODE). While truthy the boost entry shows active regardless of the mode read-back.'},
    {name: 'message-property-boost-state', type: 'string', default: 'payload', help: 'Dot-notation path within the boost-state message. Blank = element-level message-property.'},
    // E124: TRVs are battery devices in most cases (presence-checked stamping
    // keeps mains-powered wall thermostats badge-free).
    ...batteryLowAttributes,
];

/** Shared discovery.map fragment (HA `climate` + the E108 native keys). */
export const climateDiscoveryMap = {
    schema: {attr: 'payload-mode', valueMap: {json: 'json', _default: 'separate'}},
    temperature_state_topic:   {attr: 'subscribe-setpoint'},
    temperature_command_topic: {attr: 'publish-setpoint'},
    current_temperature_topic: {attr: 'subscribe-actual'},
    mode_state_topic:          {attr: 'subscribe-mode'},
    mode_command_topic:        {attr: 'publish-mode'},
    action_topic:              {attr: 'subscribe-valve'},
    message_property:          {attr: 'message-property'},
    value_template:            {attr: 'message-property', transform: 'valueTemplateToPath'},
    message_property_setpoint:        {attr: 'message-property-setpoint'},
    message_property_actual:          {attr: 'message-property-actual'},
    message_property_mode:            {attr: 'message-property-mode'},
    message_property_valve:           {attr: 'message-property-valve'},
    message_property_boost_remaining: {attr: 'message-property-boost-remaining'},
    boost_state_topic:            {attr: 'subscribe-boost-state'},
    message_property_boost_state: {attr: 'message-property-boost-state'},
    valve_min:        {attr: 'valve-min'},
    valve_max:        {attr: 'valve-max'},
    min_temp:         {attr: 'min'},
    max_temp:         {attr: 'max'},
    temp_step:        {attr: 'step'},
    temperature_unit: {attr: 'unit', valueMap: {C: '°C', F: '°F', _default: '°C'}},
    modes: {attr: 'modes', transform: 'jsonStringify'},
    name: 'label',
};

/** Attribute names this controller consumes (parity-set derivation, E114). */
export const CLIMATE_CONSUMED_ATTRIBUTES = climateAttributes.map(a => a.name);

export class ClimateController {
    /**
     * @param {import('lit').ReactiveControllerHost & HTMLElement} host
     * @param {{json?: boolean, actualFromSubscribe?: boolean, humidity?: boolean}} options
     *   family quirks — flags, not forks (E137 decided).
     */
    constructor(host, options = {}) {
        this.host = host;
        this.options = {json: true, actualFromSubscribe: false, humidity: false, ...options};
        host.addController?.(this);
        // ── state (plain fields, E137 decided) ──
        this.setpoint = null;
        this.actual = null;
        this.mode = null;             // raw read-back value ('' = none yet)
        this.valve = null;            // 0–100 % or null
        this.humidity = null;
        this.batteryLow = false;
        this.momentaryActive = null;  // value of the active momentary entry
        this.boostForced = false;     // B54 device-reported boost
        this.boostRemaining = null;   // seconds, null = inactive
        this._lastRealSetpoint = null;
        this._preBoostMode = null;
        this._boostTimer = null;
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

    _prop(msg, specific) {
        return this.host.getProperty(msg, this._attr(specific) || this._attr('message-property') || 'payload');
    }

    get payloadMode() { return this.options.json ? this._attr('payload-mode', 'separate') : 'separate'; }
    get min()  { return this._num('min', 5); }
    get max()  { return this._num('max', 30); }
    get step() { return this._num('step', 0.5) || 0.5; }
    get unit() { return this._attr('unit', '°C'); }

    // ── lifecycle ────────────────────────────────────────────────────────────
    signature() {
        return ['payload-mode', 'subscribe', 'subscribe-setpoint', 'subscribe-actual', 'subscribe-mode',
            'subscribe-valve', 'subscribe-humidity', 'subscribe-boost-remaining', 'subscribe-boost-state',
            'subscribe-battery-low'].map(a => this._attr(a)).join('|');
    }

    hostConnected() { this.wire(); }

    hostDisconnected() { this._stopBoostCountdown(); }   // never leak the interval

    wire() {
        this.__sig = this.signature();
        const sub = (topic, cb) => { if (topic) this.host.addSubscription(topic, cb); };
        const update = () => this.host.requestUpdate();

        if (this.payloadMode === 'json') {
            sub(this._attr('subscribe'), msg => {
                let obj = this.host.getProperty(msg, this._attr('message-property') || 'payload');
                if (typeof obj === 'string') {
                    try { obj = JSON.parse(obj); } catch { obj = null; }
                }
                if ((obj === null || typeof obj !== 'object') && msg.payload && typeof msg.payload === 'object') {
                    obj = msg.payload;
                }
                if (!obj || typeof obj !== 'object') return;
                const map = this.jsonMap;
                const sp = Number(this.host.getProperty(obj, map.setpoint));
                if (!Number.isNaN(sp)) { this.setpoint = sp; if (sp > 4.5) this._lastRealSetpoint = sp; }
                const ac = Number(this.host.getProperty(obj, map.actual));
                if (!Number.isNaN(ac)) this.actual = ac;
                const mode = this.host.getProperty(obj, map.mode);
                if (mode !== null && mode !== undefined) this.applyModeReadback(String(mode));
                const valve = Number(this.host.getProperty(obj, map.valve));
                if (!Number.isNaN(valve)) this.valve = this._scaleValve(valve);
                if (this.options.humidity) {
                    const hum = Number(this.host.getProperty(obj, map.humidity));
                    if (!Number.isNaN(hum)) this.humidity = Math.max(0, Math.min(100, hum));
                }
                update();
            });
        } else {
            sub(this._attr('subscribe-setpoint'), msg => {
                const v = Number(this._prop(msg, 'message-property-setpoint'));
                if (!Number.isNaN(v)) {
                    this.setpoint = v;
                    if (v > 4.5) this._lastRealSetpoint = v;   // E102 $setpoint memory
                    update();
                }
            });
            sub(this._attr('subscribe-mode'), msg => {
                const v = this._prop(msg, 'message-property-mode');
                if (v !== null && v !== undefined) { this.applyModeReadback(String(v)); update(); }
            });
        }

        // Actual temperature: its own topic works in BOTH payload modes; metro
        // reads it from `subscribe` (family quirk flag).
        const actualTopic = this.options.actualFromSubscribe
            ? (this.payloadMode === 'separate' ? this._attr('subscribe') : '')
            : this._attr('subscribe-actual');
        sub(actualTopic, msg => {
            const v = Number(this._prop(msg, 'message-property-actual'));
            if (!Number.isNaN(v)) { this.actual = v; update(); }
        });
        if (this.options.actualFromSubscribe) {
            // metro also honours subscribe-actual when present (map parity).
            sub(this._attr('subscribe-actual'), msg => {
                const v = Number(this._prop(msg, 'message-property-actual'));
                if (!Number.isNaN(v)) { this.actual = v; update(); }
            });
        }

        sub(this._attr('subscribe-valve'), msg => {
            const v = Number(this._prop(msg, 'message-property-valve'));
            if (!Number.isNaN(v)) { this.valve = this._scaleValve(v); update(); }
        });

        if (this.options.humidity) {
            sub(this._attr('subscribe-humidity'), msg => {
                const v = Number(this._prop(msg, 'message-property-humidity'));
                if (!Number.isNaN(v)) { this.humidity = Math.max(0, Math.min(100, v)); update(); }
            });
        }

        sub(this._attr('subscribe-boost-remaining'), msg => {
            const v = Number(this._prop(msg, 'message-property-boost-remaining'));
            if (!Number.isNaN(v)) { this.applyBoostRemaining(v); update(); }
        });

        // B54: device-reported boost active state.
        sub(this._attr('subscribe-boost-state'), msg => {
            this.applyBoostState(this._prop(msg, 'message-property-boost-state'));
            update();
        });

        // E124: dedicated low-battery warning.
        sub(this._attr('subscribe-battery-low'), msg => {
            const v = this._prop(msg, 'message-property-battery-low');
            this.batteryLow = batteryLowFromValue(v,
                this._attr('payload-battery-low', 'true'),
                Number(this._attr('battery-low-threshold', '15')));
            update();
        });
    }

    /** Call from the host's updated() to re-wire on live topic edits. */
    rewireIfChanged() {
        if (this.__sig !== undefined && this.signature() !== this.__sig) {
            this.host._unsubscribe();
            this.wire();
        }
    }

    // ── json key map (z2m TRV shape) ─────────────────────────────────────────
    get jsonMap() {
        const defaults = {
            setpoint: 'current_heating_setpoint',
            actual:   'local_temperature',
            mode:     'system_mode',
            valve:    'position',
            humidity: 'humidity',
        };
        const raw = this._attr('json-map');
        if (raw) {
            try { return {...defaults, ...JSON.parse(raw)}; } catch { /* defaults */ }
        }
        return defaults;
    }

    // ── scaling ──────────────────────────────────────────────────────────────
    /** E102: device range [valve-min, valve-max] → 0–100 % (zero-span guarded). */
    _scaleValve(v) {
        const lo = this._num('valve-min', 0);
        const hi = this._num('valve-max', 100);
        const pct = (hi === lo) ? v : ((v - lo) / (hi - lo)) * 100;
        return Math.max(0, Math.min(100, pct));
    }

    // ── mode machinery (E102 + the B53–B58 fixes) ────────────────────────────
    /** `modes` attribute → [{value, label, …}] — sanitized WITHOUT truthiness (B55). */
    parsedModes() {
        let arr;
        try { arr = JSON.parse(this._attr('modes') || '[]'); } catch { return []; }
        if (!Array.isArray(arr)) return [];
        return arr.map(m => typeof m === 'string'
            ? {value: m, label: m.charAt(0).toUpperCase() + m.slice(1).replace(/_/g, ' ')}
            : (m ? {...m, label: m.label ?? m.value} : m))
            .filter(m => m && m.value !== null && m.value !== undefined && m.value !== '');
    }

    /**
     * The single active (non-momentary) entry for the current read-back +
     * setpoint. B53: the `match-setpoint-max` cap compares the CURRENT
     * setpoint (lastReal only as fallback); the capped entry wins ties.
     */
    activeModeEntry(list = this.parsedModes()) {
        const v = this.mode;
        if (v === null || v === undefined || v === '') return null;
        const sp = this.setpoint ?? this._lastRealSetpoint;
        const capOk = m => {
            const cap = m['match-setpoint-max'];
            if (cap === null || cap === undefined) return true;
            return sp !== null && sp !== undefined && Number(sp) <= Number(cap);
        };
        const candidates = list.filter(m => !m.momentary && String(m.value) === String(v) && capOk(m));
        if (candidates.length === 0) return null;
        return candidates.find(m => m['match-setpoint-max'] !== null && m['match-setpoint-max'] !== undefined)
            ?? candidates[0];
    }

    /** B53: the active entry when it is an off-by-setpoint sentinel, else null. */
    offSentinelEntry() {
        const e = this.activeModeEntry();
        return (e && e['match-setpoint-max'] !== null && e['match-setpoint-max'] !== undefined) ? e : null;
    }

    /** Is this momentary entry displayed active (B54 forced wins)? */
    momentaryEntryActive(entry) {
        return Boolean(entry.momentary
            && (this.boostForced || this.momentaryActive === entry.value || this.mode === entry.value));
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

    _pubEntry(topic, payload) {
        if (window.feezal?.isEditor || !topic) return;
        const resolved = this._resolveModePayload(payload);
        window.feezal.connection.pub(topic,
            (resolved !== null && typeof resolved === 'object') ? JSON.stringify(resolved) : String(resolved ?? ''));
    }

    /** B58: type-preserving `$setpoint` substitution (bare sentinel → NUMBER). */
    _resolveModePayload(payload) {
        const sp = Number(this._lastRealSetpoint ?? this.setpoint ?? this.min);
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

    /** Clamp + snap + publish a new setpoint. */
    setSetpoint(temp) {
        const clamped = +(Math.min(this.max, Math.max(this.min, Math.round(temp / this.step) * this.step))).toFixed(2);
        this.setpoint = clamped;
        if (clamped > 4.5) this._lastRealSetpoint = clamped;
        this._pub(this._attr('publish-setpoint'), clamped, {[this.jsonMap.setpoint]: clamped});
        this.host.requestUpdate();
        return clamped;
    }

    /** Apply a mode entry (plain / per-entry publish / momentary boost). */
    setMode(entry) {
        if (window.feezal?.isEditor) return;
        if (typeof entry === 'string') entry = {value: entry};
        if (entry.momentary) { this._toggleMomentary(entry); return; }
        this.mode = entry.value;
        if (entry.publish) this._pubEntry(entry.publish, entry.payload ?? entry.value);
        else this._pub(this._attr('publish-mode'), entry.value, {[this.jsonMap.mode]: entry.value});
        this.host.requestUpdate();
    }

    _toggleMomentary(entry) {
        const active = this.boostForced || this.momentaryActive === entry.value || this.mode === entry.value;
        if (active) {
            this.momentaryActive = null;
            this.boostForced = false;   // B54: tap-off — the read-back confirms
            this._clearBoost();
            if (entry.off === 'restore') {
                const prev = this._preBoostMode;
                const prevEntry = this.parsedModes().find(m => m.value === prev && !m.momentary);
                if (prevEntry) this.setMode(prevEntry);
                else if (prev != null) this._pub(this._attr('publish-mode'), prev, {[this.jsonMap.mode]: prev});
            } else if (entry.off && entry.off.publish) {
                this._pubEntry(entry.off.publish, entry.off.payload);
            }
        } else {
            this._preBoostMode = this.mode;
            this.momentaryActive = entry.value;
            if (entry.publish) this._pubEntry(entry.publish, entry.payload ?? entry.value);
            else this._pub(this._attr('publish-mode'), entry.value, {[this.jsonMap.mode]: entry.value});
            this._startBoostCountdown();
        }
        this.host.requestUpdate();
    }

    /**
     * B54 — device-reported boost active state (hm BOOST_MODE true/false).
     * Truthy forces the momentary entry active regardless of the mode
     * read-back and starts the countdown; falsy returns to mode-derived state.
     */
    applyBoostState(raw) {
        const active = raw === true || raw === 1
            || String(raw).toLowerCase() === 'true' || String(raw) === '1';
        if (active && !this.boostForced) {
            this.boostForced = true;
            if (this.boostRemaining === null) this._startBoostCountdown();
        } else if (!active && this.boostForced) {
            this.boostForced = false;
            this.momentaryActive = null;
            this._clearBoost();
        }
    }

    /** Device-reported remaining time → seconds (via boost-remaining-unit). */
    applyBoostRemaining(v) {
        const secs = this._attr('boost-remaining-unit', 'minutes') === 'seconds'
            ? Math.round(v) : Math.round(v * 60);
        this.boostRemaining = Math.max(0, secs);
    }

    /** Mode read-back routing (B54: never clears a device-forced boost). */
    applyModeReadback(v) {
        this.mode = v;
        if (!this.boostForced && this.momentaryActive !== null && String(v) !== String(this.momentaryActive)) {
            this.momentaryActive = null;
            this._clearBoost();
        }
    }

    // ── boost countdown (E102 WP2) ───────────────────────────────────────────
    _startBoostCountdown() {
        this._stopBoostCountdown();
        if (this._attr('subscribe-boost-remaining')) return;   // device drives the badge
        const secs = this._num('boost-duration', 5) * 60;
        if (secs <= 0) { this.boostRemaining = null; return; }
        this.boostRemaining = secs;
        this._boostTimer = setInterval(() => {
            const next = (this.boostRemaining ?? 0) - 1;
            if (next <= 0) { this.boostRemaining = 0; this._stopBoostCountdown(); }
            else this.boostRemaining = next;
            this.host.requestUpdate();
        }, 1000);
    }

    _stopBoostCountdown() {
        if (this._boostTimer) { clearInterval(this._boostTimer); this._boostTimer = null; }
    }

    _clearBoost() {
        this._stopBoostCountdown();
        this.boostRemaining = null;
    }

    /** mm:ss badge for the active boost ('' when inactive). */
    boostBadge() {
        const s = this.boostRemaining;
        if (s === null || s === undefined || s < 0) return '';
        return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }
}

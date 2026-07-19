/* global feezal */
import {html, css} from '@feezal/feezal-element';
import {MetroTileBase} from '@feezal/feezal-element-metro-tile';

/**
 * feezal-element-metro-climate (E55)
 *
 * Thermostat tile: front shows the current temperature (+ small setpoint);
 * the back holds a setpoint stepper and, when configured, mode chips.
 */
class FeezalElementMetroClimate extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Climate', category: 'Metro', color: '#1ba1e2', icon: 'thermostat'},
            description: 'Metro thermostat tile: current temperature on the front, setpoint stepper + mode chips on the back.',
            attributes: [
                ...MetroTileBase.tileAttributes,
                // U39: grouped inspector; message-property-* twins tuck behind Advanced.
                {name: 'subscribe', type: 'mqttTopic', section: 'Connection', help: 'Current temperature topic.'},
                {name: 'message-property', type: 'string', default: 'payload', section: 'Connection', advanced: true,
                    help: 'Dot-notation path within current-temperature messages. Default: payload'},
                {name: 'subscribe-setpoint', type: 'mqttTopic', section: 'Connection', help: 'Setpoint state topic.'},
                {name: 'message-property-setpoint', type: 'string', default: 'payload', section: 'Connection', advanced: true,
                    help: 'Dot-notation path within setpoint messages. Default: payload'},
                {name: 'publish-setpoint', type: 'mqttTopic', section: 'Connection', help: 'Setpoint command topic (enables the back stepper).'},
                {name: 'subscribe-mode', type: 'mqttTopic', section: 'Connection', help: 'Mode state topic.'},
                {name: 'message-property-mode', type: 'string', default: 'payload', section: 'Connection', advanced: true,
                    help: 'Dot-notation path within mode messages. Default: payload'},
                {name: 'publish-mode', type: 'mqttTopic', section: 'Connection', help: 'Mode command topic (enables the back mode chips).'},
                // ── Valve / Position (E102) ──
                {name: 'subscribe-valve',    type: 'mqttTopic', section: 'Valve',
                    help: 'Optional: valve/position level. Scaled from valve-min…valve-max to 0–100 %. ' +
                        'Wall thermostats and heating groups have no valve of their own — point this at a member TRV or a pre-aggregated topic, and scale it via valve-min/valve-max.'},
                {name: 'message-property-valve', type: 'string', default: 'payload', section: 'Valve', advanced: true,
                    help: 'Dot-notation path within the valve message. Blank = fall back to element-level message-property.'},
                {name: 'valve-min', type: 'number', default: 0, section: 'Valve',
                    help: 'E102: valve device range minimum. Homematic BidCoS reports VALVE_STATE 0–100 (leave default); HmIP reports LEVEL 0…1 → set valve-max to 1. Incoming values scale from valve-min…valve-max to 0–100 %.'},
                {name: 'valve-max', type: 'number', default: 100, section: 'Valve',
                    help: 'E102: valve device range maximum. 100 for BidCoS VALVE_STATE (default), 1 for HmIP LEVEL.'},
                {name: 'step', type: 'number', default: 0.5, section: 'Setpoint', help: 'Setpoint stepper increment.'},
                {name: 'min',  type: 'number', default: 5,  section: 'Setpoint', help: 'Setpoint minimum.'},
                {name: 'max',  type: 'number', default: 30, section: 'Setpoint', help: 'Setpoint maximum.'},
                {name: 'unit', type: 'string', default: '°C', section: 'Setpoint', help: 'Temperature unit.'},
                {name: 'modes', type: 'objectList', itemFields: [{key: '', placeholder: 'heat'}], section: 'Display',
                    help: 'Selectable modes, e.g. off / heat / cool / auto. E102 per-entry overrides (edit the attribute as JSON): add ' +
                        '"publish"+"payload" to a {"value":...} entry to write a specific datapoint — payload is a string OR a JSON ' +
                        'object (published as-is, e.g. to a putParamset topic hm/paramset/<channel>/VALUES with {"CONTROL_MODE":1,"SET_POINT_TEMPERATURE":4.5}). ' +
                        '"$setpoint" in a payload resolves to the last real setpoint (Homematic MANU_MODE=$setpoint; "off" = manual + 4.5). ' +
                        'A "momentary":true entry (boost) is a push button — activate publishes it; deactivate runs "off": {"publish","payload"} ' +
                        '(HmIP BOOST_MODE=false) or "off":"restore" (BidCoS — re-apply the pre-boost mode). ' +
                        'The paramset segment is VALUES, not MASTER — MASTER is device configuration such as week programs, never needed for mode/setpoint control. ' +
                        'Boost is per-generation: HmIP is a BOOST_MODE true/false toggle; BidCoS is a trigger whose deactivate restores the previous mode. ' +
                        'An "off" entry may carry "match-setpoint-max" (e.g. 4.5): when several entries share the same mode read-back value, the entry with match-setpoint-max shows active only while the effective setpoint is <= that number (so "Off" wins over "Manu" at <= 4.5, "Manu" above). ' +
                        'Virtual heating groups need no special setup — HM-CC-VG-1 behaves like a BidCoS TRV and HmIP-HEATING like a wall thermostat: pick the matching generation profile and use the group :1 channel address.'},
                // ── Boost countdown (E102 WP2) ──
                {name: 'boost-duration', type: 'number', default: 5, section: 'Display',
                    help: 'E102 boost countdown: duration in minutes (Homematic default 5). When a momentary (boost) mode goes active and no subscribe-boost-remaining topic is wired, a client-side mm:ss countdown starts from this value. A page reload while boost is active (without the device topic) restarts the client timer from full — accepted degradation.'},
                {name: 'subscribe-boost-remaining', type: 'mqttTopic', section: 'Display',
                    help: 'E102 boost countdown: optional device-reported remaining time. When wired, the active boost badge shows this live value (converted to seconds via boost-remaining-unit) instead of the client timer.'},
                {name: 'message-property-boost-remaining', type: 'string', default: 'payload', section: 'Display', advanced: true,
                    help: 'Dot-notation path within the boost-remaining message. Blank = fall back to element-level message-property.'},
                {name: 'boost-remaining-unit', type: 'select', options: ['minutes', 'seconds'], default: 'minutes', section: 'Display',
                    help: 'E102 boost countdown: unit of the subscribe-boost-remaining value. BidCoS BOOST_STATE reports minutes; HmIP unit is device-dependent and verify-gated.'},
            ],
            styles: MetroTileBase.tileStyles,
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
            discovery: {
                component: 'climate',
                map: {
                    current_temperature_topic:  'subscribe',
                    temperature_state_topic:    'subscribe-setpoint',
                    temperature_command_topic:  'publish-setpoint',
                    mode_state_topic:           'subscribe-mode',
                    mode_command_topic:         'publish-mode',
                    action_topic:               'subscribe-valve',
                    modes:                      'modes',
                    min_temp:                   'min',
                    max_temp:                   'max',
                    temp_step:                  'step',
                    name:                       'label',
                    value_template:             {attr: 'message-property', transform: 'valueTemplateToPath'},
                },
            },
        };
    }

    static properties = {
        subSetpoint:     {type: String, reflect: true, attribute: 'subscribe-setpoint'},
        msgPropSetpoint: {type: String, reflect: true, attribute: 'message-property-setpoint'},
        pubSetpoint:     {type: String, reflect: true, attribute: 'publish-setpoint'},
        step: {type: Number, reflect: true},
        min:  {type: Number, reflect: true},
        max:  {type: Number, reflect: true},
        unit: {type: String, reflect: true},
        subMode:     {type: String, reflect: true, attribute: 'subscribe-mode'},
        msgPropMode: {type: String, reflect: true, attribute: 'message-property-mode'},
        pubMode:     {type: String, reflect: true, attribute: 'publish-mode'},
        modes:       {type: String, reflect: true},
        subValve:     {type: String, reflect: true, attribute: 'subscribe-valve'},
        msgPropValve: {type: String, reflect: true, attribute: 'message-property-valve'},
        valveMin:     {type: Number, reflect: true, attribute: 'valve-min'},
        valveMax:     {type: Number, reflect: true, attribute: 'valve-max'},
        boostDuration:        {type: Number, reflect: true, attribute: 'boost-duration'},
        subBoostRemaining:    {type: String, reflect: true, attribute: 'subscribe-boost-remaining'},
        msgPropBoostRemaining: {type: String, reflect: true, attribute: 'message-property-boost-remaining'},
        boostRemainingUnit:   {type: String, reflect: true, attribute: 'boost-remaining-unit'},
        _current:  {state: true},
        _setpoint: {state: true},
        _mode:     {state: true},
        _valve:    {state: true},   // null | number (0–100 %)
        _momentaryActive: {state: true},   // E102: value of the currently-active momentary (boost) entry
        _boostRemaining:  {state: true},   // E102 WP2: boost remaining seconds (null when inactive)
    };

    static styles = [MetroTileBase.styles, css`
        .current { font-size: min(34px, 30cqh); font-weight: 300; line-height: 1; }
        .setpoint { font-size: 12px; opacity: 0.85; }
        .stepper { display: flex; align-items: center; justify-content: center; gap: 10px; }
        .stepper .val { font-size: 20px; font-weight: 300; min-width: 4ch; text-align: center; }
        .chips { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
        .chips .mbtn { padding: 2px 8px; font-size: 11px; }
        /* E102 WP2: mm:ss boost countdown badge on the active momentary chip. */
        .chips .mbtn .boost-badge {
            display: inline-block; margin-left: 4px;
            font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums;
        }
        /* E102: flat Metro valve readout on the flip-face (bar + %). */
        .valve { display: flex; align-items: center; gap: 6px; font-size: 11px; }
        .valve-track {
            flex: 1; height: 4px;
            background: color-mix(in srgb, var(--feezal-metro-text, #fff) 30%, transparent);
        }
        .valve-fill { height: 100%; background: var(--feezal-metro-text, #fff); }
        .valve-pct { min-width: 3.5ch; text-align: right; font-variant-numeric: tabular-nums; }
    `];

    constructor() {
        super();
        this.subSetpoint = '';
        this.msgPropSetpoint = '';
        this.pubSetpoint = '';
        this.step = 0.5;
        this.min = 5;
        this.max = 30;
        this.unit = '°C';
        this.subMode = '';
        this.msgPropMode = '';
        this.pubMode = '';
        this.modes = '[]';
        this.subValve = '';
        this.msgPropValve = '';
        this.valveMin = 0;
        this.valveMax = 100;
        this.boostDuration = 5;
        this.subBoostRemaining = '';
        this.msgPropBoostRemaining = '';
        this.boostRemainingUnit = 'minutes';
        this._current = null;
        this._setpoint = null;
        this._mode = '';
        this._valve = null;
        // E102 — mode-entry machinery
        this._lastRealSetpoint = null;   // remembered setpoint > off sentinel (for $setpoint)
        this._preBoostMode     = null;   // mode before a momentary/boost entry (for off:"restore")
        this._momentaryActive  = null;   // value of the currently-active momentary entry
        // E102 WP2 — boost countdown
        this._boostRemaining   = null;   // remaining seconds while boost active (null = inactive)
        this._boostTimer       = null;   // non-reactive setInterval handle
    }

    connectedCallback() {
        super.connectedCallback();
        const sub = (topic, cb) => { if (topic) this.addSubscription(topic, cb); };
        sub(this.subscribe, msg => {
            const v = Number(this.getProperty(msg, this.messageProperty));
            if (!isNaN(v)) this._current = v;
        });
        sub(this.subSetpoint, msg => {
            const v = Number(this.getProperty(msg, this.msgPropSetpoint || this.messageProperty));
            if (!isNaN(v)) { this._setpoint = v; if (v > 4.5) this._lastRealSetpoint = v; }   // E102: remember real setpoint for $setpoint
        });
        sub(this.subMode, msg => {
            const v = this.getProperty(msg, this.msgPropMode || this.messageProperty);
            if (v !== null && v !== undefined) this._applyModeReadback(String(v));
        });
        sub(this.subValve, msg => {                                             // E102
            const v = Number(this.getProperty(msg, this.msgPropValve || this.messageProperty));
            if (!isNaN(v)) this._valve = this._scaleValve(v);
        });
        sub(this.subBoostRemaining, msg => {                                    // E102 WP2
            const v = Number(this.getProperty(msg, this.msgPropBoostRemaining || this.messageProperty));
            if (!isNaN(v)) this._applyBoostRemaining(v);
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopBoostCountdown();   // E102 WP2: never leak the interval
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

    /** Modes attribute → [{value, label, ...}] (material-climate coercion). E102:
     * object entries keep all fields (publish/payload/momentary/off), not just value/label. */
    _parsedModes() {
        try {
            const raw = JSON.parse(this.modes || '[]');
            return (Array.isArray(raw) ? raw : []).map(m =>
                typeof m === 'string' ? {value: m, label: m} : {...m, label: m.label || m.value})
                .filter(m => m.value);
        } catch {
            return [];
        }
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
        const sp = this._lastRealSetpoint ?? this._setpoint;
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

    _stepSetpoint(direction) {
        if (feezal.isEditor) return;
        const step = Number(this.step) || 0.5;
        const current = this._setpoint ?? (this.min + this.max) / 2;
        const next = Math.min(this.max, Math.max(this.min, Math.round((current + direction * step) * 100) / 100));
        this._setpoint = next;
        if (next > 4.5) this._lastRealSetpoint = next;   // E102: $setpoint memory
        if (this.pubSetpoint) feezal.connection.pub(this.pubSetpoint, String(next));
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

    /** E102 — recursively substitute `$setpoint` in a string / object payload. */
    _resolveModePayload(payload) {
        const sp = this._lastRealSetpoint ?? this._setpoint ?? this.min;
        const sub = v => typeof v === 'string' ? v.replace(/\$setpoint/g, String(sp)) : v;
        if (payload !== null && typeof payload === 'object') {
            const out = Array.isArray(payload) ? [] : {};
            for (const [k, val] of Object.entries(payload)) {
                out[k] = (val !== null && typeof val === 'object') ? this._resolveModePayload(val) : sub(val);
            }
            return out;
        }
        return sub(payload);
    }

    /**
     * E102 — apply a mode entry. Plain entries publish the mode value on
     * publish-mode (unchanged). Entries with a per-entry `publish` write their
     * `payload` (string or object, `$setpoint`-resolved) to that topic instead
     * — covers Homematic's per-mode action datapoints (AUTO_MODE=true,
     * MANU_MODE=$setpoint) and the HmIP combined putParamset write. A
     * `momentary` entry (boost) toggles with its own off-strategy.
     */
    _setMode(entry) {
        if (feezal.isEditor) return;
        // Back-compat: callers may still pass a bare string value.
        if (typeof entry === 'string') entry = {value: entry};

        if (entry.momentary) { this._toggleMomentary(entry); return; }

        this._mode = entry.value;
        if (entry.publish) {
            this._pubEntry(entry.publish, entry.payload ?? entry.value);
        } else if (this.pubMode) {
            feezal.connection.pub(this.pubMode, entry.value);
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
        const active = this._momentaryActive === entry.value || this._mode === entry.value;
        if (active) {
            this._momentaryActive = null;
            this._clearBoost();   // E102 WP2: tap-off clears the badge/timer
            if (entry.off === 'restore') {
                const prev = this._preBoostMode;
                const prevEntry = this._parsedModes().find(m => m.value === prev && !m.momentary);
                if (prevEntry) this._setMode(prevEntry);
                else if (prev != null && this.pubMode) feezal.connection.pub(this.pubMode, prev);
            } else if (entry.off && entry.off.publish) {
                this._pubEntry(entry.off.publish, entry.off.payload);
            }
        } else {
            this._preBoostMode = this._mode;
            this._momentaryActive = entry.value;
            if (entry.publish) this._pubEntry(entry.publish, entry.payload ?? entry.value);
            else if (this.pubMode) feezal.connection.pub(this.pubMode, entry.value);
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
        if (this._momentaryActive !== null && String(v) !== String(this._momentaryActive)) {
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
        if (this.subBoostRemaining) return;   // device topic drives the badge
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

    renderFront() {
        const current = this._current ?? (feezal.isEditor && !this.subscribe ? 21.5 : null);
        return html`
            <div class="current">${current === null ? '—' : `${current}${this.unit}`}</div>
            ${this._setpoint !== null ? html`<div class="setpoint">→ ${this._setpoint}${this.unit}</div>` : ''}`;
    }

    renderBack() {
        const modes = this._parsedModes();
        const hasModes = modes.length > 0;
        const active = this._activeModeEntry(modes);   // E102: match-setpoint-max-aware active chip
        return html`
            <div class="stepper">
                <button class="mbtn" @click="${() => this._stepSetpoint(-1)}">−</button>
                <span class="val">${this._setpoint === null ? '—' : `${this._setpoint}${this.unit}`}</span>
                <button class="mbtn" @click="${() => this._stepSetpoint(1)}">+</button>
            </div>
            ${hasModes ? html`
                <div class="chips">
                    ${modes.map(m => {
                        const boostActive = m.momentary && (this._momentaryActive === m.value || this._mode === m.value);
                        const badge = boostActive ? this._boostBadge() : '';
                        return html`
                            <button class="mbtn ${boostActive || m === active ? 'active' : ''}"
                                @click="${() => this._setMode(m)}">${m.label ?? m.value}${badge ? html`<span class="boost-badge">${badge}</span>` : ''}</button>`;
                    })}
                </div>` : ''}
            ${this._valve !== null ? html`
                <div class="valve">
                    <span>Valve</span>
                    <div class="valve-track"><div class="valve-fill" style="width:${this._valve}%"></div></div>
                    <span class="valve-pct">${Math.round(this._valve)}&nbsp;%</span>
                </div>` : ''}`;
    }
}

customElements.define('feezal-element-metro-climate', FeezalElementMetroClimate);
export {FeezalElementMetroClimate};

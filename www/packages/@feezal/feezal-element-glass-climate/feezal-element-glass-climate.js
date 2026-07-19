/* global feezal */
import {feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {applySizePreset, glassCardStyles, glassPopupStyles, FeezalGlassCard} from '@feezal/feezal-glass';

/**
 * feezal-element-glass-climate (E58, renamed from glass-thermostat)
 *
 * Frosted-glass thermostat card: actual + set temperature and the heating
 * mode on the front; tap (or ⋯) opens the Apple-Home-style details popup —
 * a big vertical setpoint pill (drag like the glass-light brightness pill,
 * snapped to `step`, publish on release) with the mode buttons beneath it.
 *
 * MQTT capability contract mirrors feezal-element-material-climate for the
 * setpoint + actual + mode subset — SAME attribute names, both payload
 * modes (json = zigbee2mqtt TRVs with the same default key map, separate =
 * per-property topics), min/max/step/unit, the same `modes` format and HA
 * discovery descriptor. Valve/humidity extras stay material-climate's.
 *
 * Family conventions (frost vars, degrade, squircle): see glass-button.
 */

const MODE_ICONS = {
    off: 'power_settings_new',
    heat: 'local_fire_department',
    cool: 'ac_unit',
    auto: 'auto_mode',
    dry: 'water_drop',
    fan_only: 'mode_fan',
};

class FeezalElementGlassClimate extends FeezalGlassCard {
    static get feezal() {
        return {
            palette: {name: 'Climate', category: 'Glass', color: '#7aa5c9', icon: 'thermostat'},
            description: 'Frosted-glass thermostat card — actual/set temperature and mode; tap opens the ' +
                'details popup with a vertical setpoint slider and mode buttons. Same wiring contract as ' +
                'the material thermostat card (setpoint/actual/mode subset).',
            discovery: {
                component: 'climate',
                map: {
                    schema: {attr: 'payload-mode', valueMap: {json: 'json', _default: 'separate'}},
                    temperature_state_topic:   {attr: 'subscribe'},
                    temperature_command_topic: {attr: 'publish'},
                    current_temperature_topic: {attr: 'subscribe-actual'},
                    mode_state_topic:          {attr: 'subscribe-mode'},
                    mode_command_topic:        {attr: 'publish-mode'},
                    action_topic:              {attr: 'subscribe-valve'},
                    // E108: native-discovery-only keys (Homematic synthesised
                    // entities). HA/z2m lack them → skipped (additive).
                    message_property: {attr: 'message-property'},
                    valve_min:        {attr: 'valve-min'},
                    valve_max:        {attr: 'valve-max'},
                    min_temp:         {attr: 'min'},
                    max_temp:         {attr: 'max'},
                    temp_step:        {attr: 'step'},
                    temperature_unit: {attr: 'unit', valueMap: {C: '°C', F: '°F', _default: '°C'}},
                    modes: {attr: 'modes', transform: 'jsonStringify'},
                    // N31: availability is mapped automatically from the canonical discovery record.
                    name: 'label',
                },
            },
            // U39: section/visibleWhen/advanced structure the ~25-attribute
            // inspector — only the relevant payload-mode's topics show, and the
            // message-property-* twins tuck behind each section's Advanced group.
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x2', '2x1'], default: '', section: 'Layout',
                    help: 'Preset size: 2x2 = square (150×150), 2x1 = wide (150×75). Empty keeps the current/manual size.'},
                {name: 'payload-mode', type: 'select', options: ['separate', 'json'], default: 'separate', section: 'Connection',
                    help: 'separate = one topic per property; json = single topic carrying the full climate JSON object (zigbee2mqtt TRVs).'},
                // ── Connection · json mode ──
                {name: 'subscribe', type: 'mqttTopic', section: 'Connection', visibleWhen: {attr: 'payload-mode', equals: 'json'},
                    help: 'json mode: base topic carrying the climate state JSON object.'},
                {name: 'publish',   type: 'mqttTopic', section: 'Connection', visibleWhen: {attr: 'payload-mode', equals: 'json'},
                    help: 'json mode: command/set topic (e.g. zigbee2mqtt/TRV/set).'},
                {name: 'json-map',  type: 'string', default: '', section: 'Connection', advanced: true, visibleWhen: {attr: 'payload-mode', equals: 'json'},
                    help: 'json mode: optional JSON map overriding default keys. E.g. {"setpoint":"target_temp","actual":"temperature"}.'},
                {name: 'message-property', type: 'string', default: 'payload', section: 'Connection', advanced: true, visibleWhen: {attr: 'payload-mode', equals: 'json'},
                    help: 'json mode: dot-notation path to the state JSON object within the MQTT message. Default: payload'},
                // ── Connection · separate mode ──
                {name: 'subscribe-setpoint', type: 'mqttTopic', section: 'Connection', visibleWhen: {attr: 'payload-mode', equals: 'separate'},
                    help: 'separate: topic publishing the current setpoint.'},
                {name: 'message-property-setpoint', type: 'string', default: 'payload', section: 'Connection', advanced: true, visibleWhen: {attr: 'payload-mode', equals: 'separate'}, help: 'Property path within setpoint messages. Defaults to message-property.'},
                {name: 'publish-setpoint', type: 'mqttTopic', section: 'Connection', visibleWhen: {attr: 'payload-mode', equals: 'separate'}, help: 'separate: topic to publish a new setpoint to.'},
                {name: 'subscribe-actual', type: 'mqttTopic', section: 'Connection', visibleWhen: {attr: 'payload-mode', equals: 'separate'}, help: 'Topic for the actual measured temperature.'},
                {name: 'message-property-actual', type: 'string', default: 'payload', section: 'Connection', advanced: true, visibleWhen: {attr: 'payload-mode', equals: 'separate'}, help: 'Property path within actual-temperature messages. Defaults to message-property.'},
                {name: 'subscribe-mode', type: 'mqttTopic', section: 'Connection', visibleWhen: {attr: 'payload-mode', equals: 'separate'}, help: 'separate: topic publishing the current operating mode.'},
                {name: 'message-property-mode', type: 'string', default: 'payload', section: 'Connection', advanced: true, visibleWhen: {attr: 'payload-mode', equals: 'separate'}, help: 'Property path within mode messages. Defaults to message-property.'},
                {name: 'publish-mode', type: 'mqttTopic', section: 'Connection', visibleWhen: {attr: 'payload-mode', equals: 'separate'}, help: 'separate: topic to publish the selected mode to.'},
                // ── Setpoint ──
                {name: 'min',  type: 'number', default: 5,    section: 'Setpoint', help: 'Minimum setpoint value.'},
                {name: 'max',  type: 'number', default: 30,   section: 'Setpoint', help: 'Maximum setpoint value.'},
                {name: 'step', type: 'number', default: 0.5,  section: 'Setpoint', help: 'Setpoint snap increment.'},
                {name: 'unit', type: 'string', default: '°C', section: 'Setpoint', help: 'Temperature unit label.'},
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
                // ── Display ──
                {name: 'modes', type: 'string', default: '', section: 'Display',
                    help: 'Mode buttons in the popup — JSON array of strings (["off","heat","auto"]) or {value,label} objects. Empty = no mode row. ' +
                        'E102 per-entry overrides: add "publish"+"payload" to write a specific datapoint — payload is a string OR a JSON ' +
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
                {name: 'label', type: 'string', section: 'Display', help: 'Card label.'},
                {name: 'icon',  type: 'string', default: 'thermostat', section: 'Display', help: 'Icon name.'},
                {name: 'degrade', type: 'boolean', default: false, section: 'Display', advanced: true,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
                // ── Availability (collapsed by default) ──
                {name: 'subscribe-availability', type: 'mqttTopic', section: 'Availability', help: 'Optional availability topic — badge when unavailable, controls stay enabled.'},
                {name: 'payload-available',   type: 'string', default: 'online',  section: 'Availability', help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', section: 'Availability', help: 'Payload meaning unavailable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', section: 'Availability', advanced: true, help: 'Property path within availability messages. Defaults to message-property.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-accent', type: 'color', default: '#ff9f0a', help: 'Setpoint/heating accent colour.'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-icon-size', default: '28px', help: 'Icon font size.'},
                {property: '--feezal-glass-font-size-value', default: '26px', help: 'Actual temperature font size.'},
                {property: '--feezal-glass-font-size-state', default: '15px', help: 'State line font size.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Label font size.'},
                {property: '--feezal-glass-font-size-unit', default: '12px', help: 'Flip/detail button icon size.'},
            ],
            defaultStyle: {width: '172px', height: '128px'},
            restrict: {minWidth: 90, minHeight: 70},
        };
    }

    static properties = {
        size:             {type: String, reflect: true},
        payloadMode:      {type: String, reflect: true, attribute: 'payload-mode'},
        publish:          {type: String, reflect: true},
        jsonMap:          {type: String, reflect: true, attribute: 'json-map'},
        subscribeSetpoint: {type: String, reflect: true, attribute: 'subscribe-setpoint'},
        msgPropSetpoint:   {type: String, reflect: true, attribute: 'message-property-setpoint'},
        publishSetpoint:   {type: String, reflect: true, attribute: 'publish-setpoint'},
        subscribeActual:   {type: String, reflect: true, attribute: 'subscribe-actual'},
        msgPropActual:     {type: String, reflect: true, attribute: 'message-property-actual'},
        subscribeMode:     {type: String, reflect: true, attribute: 'subscribe-mode'},
        msgPropMode:       {type: String, reflect: true, attribute: 'message-property-mode'},
        publishMode:       {type: String, reflect: true, attribute: 'publish-mode'},
        subscribeValve:    {type: String, reflect: true, attribute: 'subscribe-valve'},
        msgPropValve:      {type: String, reflect: true, attribute: 'message-property-valve'},
        valveMin:          {type: Number, reflect: true, attribute: 'valve-min'},
        valveMax:          {type: Number, reflect: true, attribute: 'valve-max'},
        boostDuration:           {type: Number, reflect: true, attribute: 'boost-duration'},
        subscribeBoostRemaining: {type: String, reflect: true, attribute: 'subscribe-boost-remaining'},
        msgPropBoostRemaining:   {type: String, reflect: true, attribute: 'message-property-boost-remaining'},
        boostRemainingUnit:      {type: String, reflect: true, attribute: 'boost-remaining-unit'},
        min:  {type: Number, reflect: true},
        max:  {type: Number, reflect: true},
        step: {type: Number, reflect: true},
        unit: {type: String, reflect: true},
        modes: {type: String, reflect: true},
        label: {type: String, reflect: true},
        icon:  {type: String, reflect: true},
        // N31: availability inherited from FeezalElement.
        degrade:     {type: Boolean, reflect: true},
        discoveryId: {type: String,  reflect: true, attribute: 'discovery-id'},
        _setpoint:  {state: true},
        _actual:    {state: true},
        _mode:      {state: true},
        _valve:     {state: true},   // null | number (0–100 %)
        _dragSp:    {state: true},   // live setpoint while dragging the pill
        _momentaryActive: {state: true},   // E102: value of the currently-active momentary (boost) entry
        _boostRemaining:  {state: true},   // E102 WP2: boost remaining seconds (null when inactive)
    };

    static styles = [feezalBaseStyles, glassCardStyles, glassPopupStyles, css`
        .card {
            cursor: pointer;
            gap: 2px;
            transition: transform 0.15s ease, background 0.2s ease;
            touch-action: manipulation;
        }
        .card:active { transform: scale(0.97); }
        .head { display: flex; align-items: baseline; gap: 6px; }
        feezal-icon { font-size: var(--feezal-glass-icon-size, 28px); line-height: 1; color: var(--feezal-glass-accent, #ff9f0a); }
        .actual { font-size: var(--feezal-glass-font-size-value, 26px); font-weight: 700; font-variant-numeric: tabular-nums; }
        .state {
            font-size: var(--feezal-glass-font-size-state, 15px); font-weight: 600;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
        }
        .state b { color: var(--feezal-glass-accent, #ff9f0a); }
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
           tile): icon left, actual/state/label stacked right of it.
           display:contents dissolves .head so the icon and the actual
           temperature become grid items; flip-btn and unavail stay
           absolutely positioned in their corners. */
        @container (min-aspect-ratio: 2/1) {
            .card {
                display: grid;
                grid-template: 'icon actual' auto 'icon state' auto 'icon label' auto / auto 1fr;
                align-content: center;
                align-items: center;
                column-gap: 10px;
                text-align: left;
            }
            .head { display: contents; }
            .head feezal-icon { grid-area: icon; }
            .card .actual { grid-area: actual; }
            .card .state { grid-area: state; }
            .card .label { grid-area: label; }
        }

        /* ── details popup (glass-light pattern) ── */
        .vslider {
            position: relative; width: 72px; height: 170px; flex: 0 0 auto;
            border-radius: 20px; overflow: hidden; cursor: grab;
            background: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 12%, transparent);
            touch-action: none; user-select: none;
        }
        .vslider .fill {
            position: absolute; left: 0; right: 0; bottom: 0;
            background: color-mix(in srgb, var(--feezal-glass-accent, #ff9f0a) 55%, #fff);
        }
        .vslider .sp {
            position: absolute; left: 0; right: 0; bottom: 10px; text-align: center;
            font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums;
            pointer-events: none;
        }
        .vslider .cur {
            position: absolute; left: 0; right: 0; top: 12px; text-align: center;
            font-size: 11px; font-weight: 600; opacity: 0.65; pointer-events: none;
        }
        /* E102: subtle valve-opening mark on the setpoint pill (a thin line at
           the valve % height) — the glass analogue of material-climate's inner
           valve arc. */
        .vslider .valve-mark {
            position: absolute; left: 0; right: 0; height: 2px;
            background: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 45%, transparent);
            pointer-events: none;
        }
        .valve-line {
            font-size: 12px; font-weight: 600; text-align: center;
            font-variant-numeric: tabular-nums;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
        }
        .modes { display: flex; gap: 8px; align-self: stretch; justify-content: center; flex-wrap: wrap; }
        .modes button {
            border: none; cursor: pointer; padding: 8px 10px; border-radius: 12px;
            background: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 8%, transparent);
            color: var(--feezal-glass-color, #1d1d1f);
            font-family: 'Material Icons'; font-size: 18px; line-height: 1;
        }
        .modes button.text { font-family: inherit; font-size: 12px; font-weight: 600; }
        .modes button.active { background: var(--feezal-glass-accent, #ff9f0a); color: #fff; }
        /* E102 WP2: mm:ss boost countdown badge on the active momentary button. */
        .modes button .boost-badge {
            display: block; margin-top: 2px;
            font-family: inherit; font-size: 10px; font-weight: 700; line-height: 1;
            font-variant-numeric: tabular-nums;
        }
    `];

    constructor() {
        super();
        this.size = '';
        this.payloadMode = 'separate';
        this.publish = '';
        this.jsonMap = '';
        this.subscribeSetpoint = '';
        this.msgPropSetpoint = '';
        this.publishSetpoint = '';
        this.subscribeActual = '';
        this.msgPropActual = '';
        this.subscribeMode = '';
        this.msgPropMode = '';
        this.publishMode = '';
        this.subscribeValve = '';
        this.msgPropValve = '';
        this.valveMin = 0;
        this.valveMax = 100;
        this.boostDuration = 5;
        this.subscribeBoostRemaining = '';
        this.msgPropBoostRemaining = '';
        this.boostRemainingUnit = 'minutes';
        this.min = 5;
        this.max = 30;
        this.step = 0.5;
        this.unit = '°C';
        this.modes = '';
        this.label = '';
        this.icon = 'thermostat';
        this.degrade = false;
        this.discoveryId = '';
        this._setpoint = null;
        this._actual = null;
        this._mode = '';
        this._valve = null;
        this._dragSp = null;
        // E102 — mode-entry machinery
        this._lastRealSetpoint = null;   // remembered setpoint > off sentinel (for $setpoint)
        this._preBoostMode     = null;   // mode before a momentary/boost entry (for off:"restore")
        this._momentaryActive  = null;   // value of the currently-active momentary entry
        // E102 WP2 — boost countdown
        this._boostRemaining   = null;   // remaining seconds while boost active (null = inactive)
        this._boostTimer       = null;   // non-reactive setInterval handle
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    /** json key map — material-climate defaults (zigbee2mqtt TRV shape). */
    get _jsonMap() {
        const defaults = {
            setpoint: 'current_heating_setpoint',
            actual:   'local_temperature',
            mode:     'system_mode',
            valve:    'position',
        };
        if (this.jsonMap) {
            try { return {...defaults, ...JSON.parse(this.jsonMap)}; } catch { /* defaults */ }
        }
        return defaults;
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

    _wireSignature() {
        return [this.payloadMode, this.subscribe, this.subscribeSetpoint, this.subscribeActual,
            this.subscribeMode, this.subscribeValve, this.subscribeBoostRemaining].join('|');
    }

    updated(changed) {
        super.updated(changed);
        // Topic attributes changed on the live canvas → rewire (glass pattern).
        if (this.isConnected && this.__wireSig !== undefined && this._wireSignature() !== this.__wireSig) {
            this._unsubscribe();
            this._wireSubscriptions();
        }
        // The size grid writes the element's inline geometry (editor keeps
        // full manual control afterwards).
        if (changed.has('size')) applySizePreset(this);
        // Promote the details popup into the top layer.
        if (changed.has('_details') && this._details) {
            const popup = this.renderRoot.querySelector('.details');
            if (popup?.showPopover && !popup.matches(':popover-open')) {
                try { popup.showPopover(); } catch { /* fixed+z-index fallback */ }
            }
            this._positionDetails();
        }
    }

    connectedCallback() {
        super.connectedCallback();
        this._wireSubscriptions();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopBoostCountdown();   // E102 WP2: never leak the interval
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
                    if ((obj === null || typeof obj !== 'object') && msg.payload && typeof msg.payload === 'object') {
                        obj = msg.payload;
                    }
                    if (!obj || typeof obj !== 'object') return;
                    const map = this._jsonMap;
                    const sp = Number(this.getProperty(obj, map.setpoint));
                    if (!isNaN(sp)) { this._setpoint = sp; if (sp > 4.5) this._lastRealSetpoint = sp; }   // E102
                    const ac = Number(this.getProperty(obj, map.actual));
                    if (!isNaN(ac)) this._actual = ac;
                    const mode = this.getProperty(obj, map.mode);
                    if (mode !== null && mode !== undefined) this._applyModeReadback(String(mode));
                    const valve = Number(this.getProperty(obj, map.valve));   // E102
                    if (!isNaN(valve)) this._valve = this._scaleValve(valve);
                });
            }
        } else {
            const sub = (topic, cb) => { if (topic) this.addSubscription(topic, cb); };
            sub(this.subscribeSetpoint, msg => {
                const v = Number(this.getProperty(msg, this.msgPropSetpoint || this.messageProperty));
                if (!isNaN(v)) { this._setpoint = v; if (v > 4.5) this._lastRealSetpoint = v; }   // E102: remember real setpoint for $setpoint
            });
            sub(this.subscribeMode, msg => {
                const v = this.getProperty(msg, this.msgPropMode || this.messageProperty);
                if (v !== null && v !== undefined) this._applyModeReadback(String(v));
            });
        }

        // The actual temperature often comes from a separate sensor topic in
        // BOTH payload modes.
        if (this.subscribeActual) {
            this.addSubscription(this.subscribeActual, msg => {
                const v = Number(this.getProperty(msg, this.msgPropActual || this.messageProperty));
                if (!isNaN(v)) this._actual = v;
            });
        }
        // E102: valve/position — separate topic works in BOTH payload modes
        // (the JSON path above reads map.valve; a dedicated topic wins here).
        if (this.subscribeValve) {
            this.addSubscription(this.subscribeValve, msg => {
                const v = Number(this.getProperty(msg, this.msgPropValve || this.messageProperty));
                if (!isNaN(v)) this._valve = this._scaleValve(v);
            });
        }
        // E102 WP2: device-reported boost remaining time (both payload modes).
        if (this.subscribeBoostRemaining) {
            this.addSubscription(this.subscribeBoostRemaining, msg => {
                const v = Number(this.getProperty(msg, this.msgPropBoostRemaining || this.messageProperty));
                if (!isNaN(v)) this._applyBoostRemaining(v);
            });
        }
    }

    // ── publishing (material-climate semantics) ───────────────────────────────

    _pub(topic, value, jsonObj) {
        if (feezal.isEditor) return;
        if (this.payloadMode === 'json') {
            if (this.publish) feezal.connection.pub(this.publish, JSON.stringify(jsonObj));
        } else if (topic) {
            feezal.connection.pub(topic, String(value));
        }
    }

    setSetpoint(temp) {
        const step = Number(this.step) || 0.5;
        const clamped = +(Math.min(this.max, Math.max(this.min, Math.round(temp / step) * step))).toFixed(2);
        this._setpoint = clamped;
        if (clamped > 4.5) this._lastRealSetpoint = clamped;   // E102: $setpoint memory
        this._pub(this.publishSetpoint, clamped, {[this._jsonMap.setpoint]: clamped});
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
     * E102 — apply a mode entry. Plain entries publish the mode value (default
     * publish-mode / json write, unchanged). Entries with a per-entry `publish`
     * write their `payload` (string or object, `$setpoint`-resolved) to that
     * topic instead — covers Homematic's per-mode action datapoints
     * (AUTO_MODE=true, MANU_MODE=$setpoint) and the HmIP combined putParamset
     * write. A `momentary` entry (boost) toggles with its own off-strategy.
     */
    _setMode(entry) {
        if (feezal.isEditor) return;
        // Back-compat: callers may still pass a bare string value.
        if (typeof entry === 'string') entry = {value: entry};

        if (entry.momentary) { this._toggleMomentary(entry); return; }

        this._mode = entry.value;
        if (entry.publish) {
            this._pubEntry(entry.publish, entry.payload ?? entry.value);
        } else {
            this._pub(this.publishMode, entry.value, {[this._jsonMap.mode]: entry.value});
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
                else if (prev != null) this._pub(this.publishMode, prev, {[this._jsonMap.mode]: prev});
            } else if (entry.off && entry.off.publish) {
                this._pubEntry(entry.off.publish, entry.off.payload);
            }
        } else {
            this._preBoostMode = this._mode;
            this._momentaryActive = entry.value;
            if (entry.publish) this._pubEntry(entry.publish, entry.payload ?? entry.value);
            else this._pub(this.publishMode, entry.value, {[this._jsonMap.mode]: entry.value});
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
        if (this.subscribeBoostRemaining) return;   // device topic drives the badge
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

    // ── details popup ─────────────────────────────────────────────────────────

    _onCardClick() {
        if (this._suppressTap) {
            this._suppressTap = false;
            return;
        }
        this.openDetails();
    }

    /** Setpoint pill: pointer position → temperature (snapped); publish on release. */
    _spDown(e) {
        if (feezal.isEditor) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        this.__spDragging = true;
        this._spApply(e);
    }

    _spMove(e) {
        if (this.__spDragging) this._spApply(e);
    }

    _spUp(e) {
        if (!this.__spDragging) return;
        this.__spDragging = false;
        this._spApply(e);
        const temp = this._dragSp;
        this._dragSp = null;
        if (temp !== null) this.setSetpoint(temp);
    }

    _spApply(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const t = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
        const step = Number(this.step) || 0.5;
        const temp = this.min + t * (this.max - this.min);
        this._dragSp = +(Math.round(temp / step) * step).toFixed(2);
    }

    _fmt(v) {
        return v === null || v === undefined ? '—' : `${v}${this.unit}`;
    }


    _renderDetails() {
        const sp = this._dragSp ?? this._setpoint ?? (this.min + this.max) / 2;
        const fill = Math.max(0, Math.min(100, ((sp - this.min) / ((this.max - this.min) || 1)) * 100));
        const modes = this._parsedModes();
        const active = this._activeModeEntry(modes);   // E102: match-setpoint-max-aware active button
        const valve = this._valve;
        return html`
            <div class="details" popover="manual">
                <div class="title">${this.label || 'Climate'}</div>
                <div class="vslider"
                    @pointerdown="${this._spDown}"
                    @pointermove="${this._spMove}"
                    @pointerup="${this._spUp}">
                    <div class="fill" style="height:${fill}%"></div>
                    ${valve !== null ? html`<div class="valve-mark" style="bottom:${valve}%"></div>` : ''}
                    <div class="cur">${this._fmt(this._actual)}</div>
                    <div class="sp">${this._fmt(sp)}</div>
                </div>
                ${valve !== null ? html`<div class="valve-line">Valve ${Math.round(valve)}&nbsp;%</div>` : ''}
                ${modes.length > 0 ? html`
                    <div class="modes">
                        ${modes.map(m => {
                            const boostActive = m.momentary && (this._momentaryActive === m.value || this._mode === m.value);
                            const badge = boostActive ? this._boostBadge() : '';
                            return html`
                                <button class="${MODE_ICONS[m.value] ? '' : 'text'} ${boostActive || m === active ? 'active' : ''}"
                                    title="${m.label}"
                                    @click="${() => this._setMode(m)}">${MODE_ICONS[m.value] || m.label}${badge ? html`<span class="boost-badge">${badge}</span>` : ''}</button>`;
                        })}
                    </div>` : ''}
            </div>`;
    }

    render() {
        const actual = this._actual ?? (feezal.isEditor && !this.subscribeActual && !this.subscribe ? 21.5 : null);
        return html`
            <div class="card" role="button" tabindex="0"
                @click="${this._onCardClick}"
                @keydown="${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._onCardClick(); } }}">
                <button class="flip-btn" title="Details"
                    @click="${e => { e.stopPropagation(); this.openDetails(); }}">tune</button>
                ${!this._available ? html`<span class="unavail" title="Device unavailable">⚠</span>` : ''}
                <div class="head">
                    <feezal-icon name="${this.icon || 'thermostat'}"></feezal-icon>
                    <span class="actual">${this._fmt(actual)}</span>
                </div>
                <span class="state">→ <b>${this._fmt(this._setpoint)}</b>${this._mode ? ` • ${this._mode}` : ''}</span>
                <span class="label">${this.label || (feezal.isEditor ? 'Climate' : '')}</span>
            </div>
            ${this._details ? this._renderDetails() : ''}
        `;
    }
}

customElements.define('feezal-element-glass-climate', FeezalElementGlassClimate);
export {FeezalElementGlassClimate};

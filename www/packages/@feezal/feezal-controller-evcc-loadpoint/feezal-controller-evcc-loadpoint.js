/* global feezal */
/**
 * @feezal/feezal-controller-evcc-loadpoint (E109)
 *
 * The evcc loadpoint control contract as a Lit Reactive Controller — shared by
 * the glass / metro / circle loadpoint cards. A loadpoint is the control surface
 * of an evcc install: charge mode (Off / Solar / Min+Solar / Fast), charge
 * power, vehicle SoC + limit, session energy, current limits and phases. evcc
 * publishes flat retained scalars (message-property `payload`) and accepts
 * writes on a `/set` suffix; the native recognizer (E108/E109) wires every topic.
 *
 * Heating loadpoints (heat pumps / water heaters) carry `chargerFeature/heating`
 * — evcc reuses `vehicleSoc` = current temperature °C and `limitSoc` = target
 * temperature °C. The `heating` attribute drives a reduced, °C-labelled view.
 *
 * E137 packaging: controller + attribute fragment + discovery.map fragment as
 * one unit; `EVCC_LOADPOINT_CONSUMED_ATTRIBUTES` feeds the E114 parity-set.
 */

/** The four evcc charge modes, with their user-facing labels. */
export const EVCC_MODES = [
    {value: 'off',   label: 'Off'},
    {value: 'pv',    label: 'Solar'},
    {value: 'minpv', label: 'Min+Solar'},
    {value: 'now',   label: 'Fast'},
];

/** Shared attribute descriptors — spread into every family's `feezal.attributes`. */
export const evccLoadpointAttributes = [
    {name: 'heating', type: 'boolean', default: false, help: 'Heating loadpoint (heat pump / water heater): shows a reduced, °C-labelled view (vehicle SoC → temperature). Auto-set by evcc discovery.'},
    // ── read topics ──
    {name: 'subscribe-mode',           type: 'mqttTopic', help: 'Charge mode topic (off|pv|minpv|now).'},
    {name: 'subscribe-charge-power',   type: 'mqttTopic', help: 'Charge power topic (W).'},
    {name: 'subscribe-session-energy', type: 'mqttTopic', help: 'Session energy topic (Wh).'},
    {name: 'subscribe-connected',      type: 'mqttTopic', help: 'Connected boolean topic.'},
    {name: 'subscribe-charging',       type: 'mqttTopic', help: 'Charging boolean topic.'},
    {name: 'subscribe-enabled',        type: 'mqttTopic', help: 'Enabled boolean topic.'},
    {name: 'subscribe-vehicle-title',  type: 'mqttTopic', help: 'Vehicle display-name topic.'},
    {name: 'subscribe-vehicle-soc',    type: 'mqttTopic', help: 'Vehicle SoC topic (%, or °C for heating).'},
    {name: 'subscribe-vehicle-range',  type: 'mqttTopic', help: 'Vehicle range topic (km).'},
    {name: 'subscribe-limit-soc',      type: 'mqttTopic', help: 'SoC limit topic (%, or target °C for heating).'},
    {name: 'subscribe-min-current',    type: 'mqttTopic', help: 'Minimum current topic (A).'},
    {name: 'subscribe-max-current',    type: 'mqttTopic', help: 'Maximum current topic (A).'},
    {name: 'subscribe-phases',         type: 'mqttTopic', help: 'Active phases topic.'},
    // ── write topics (/set) ──
    {name: 'publish-mode',        type: 'mqttTopic', help: 'Charge-mode command topic (…/mode/set).'},
    {name: 'publish-limit-soc',   type: 'mqttTopic', help: 'SoC-limit command topic (…/limitSoc/set).'},
    {name: 'publish-min-current', type: 'mqttTopic', help: 'Min-current command topic (…/minCurrent/set).'},
    {name: 'publish-max-current', type: 'mqttTopic', help: 'Max-current command topic (…/maxCurrent/set).'},
    {name: 'publish-phases',      type: 'mqttTopic', help: 'Phases command topic (…/phasesConfigured/set).'},
    {name: 'label', type: 'string', help: 'Card label (defaults to the loadpoint title).'},
];

/** Shared discovery.map fragment — the native recognizer's config keys → attributes. */
export const evccLoadpointDiscoveryMap = {
    name: 'label',
    heating:                 {attr: 'heating'},
    subscribe_mode:          {attr: 'subscribe-mode'},
    publish_mode:            {attr: 'publish-mode'},
    subscribe_charge_power:  {attr: 'subscribe-charge-power'},
    subscribe_session_energy:{attr: 'subscribe-session-energy'},
    subscribe_connected:     {attr: 'subscribe-connected'},
    subscribe_charging:      {attr: 'subscribe-charging'},
    subscribe_enabled:       {attr: 'subscribe-enabled'},
    subscribe_vehicle_title: {attr: 'subscribe-vehicle-title'},
    subscribe_vehicle_soc:   {attr: 'subscribe-vehicle-soc'},
    subscribe_vehicle_range: {attr: 'subscribe-vehicle-range'},
    subscribe_limit_soc:     {attr: 'subscribe-limit-soc'},
    publish_limit_soc:       {attr: 'publish-limit-soc'},
    subscribe_min_current:   {attr: 'subscribe-min-current'},
    publish_min_current:     {attr: 'publish-min-current'},
    subscribe_max_current:   {attr: 'subscribe-max-current'},
    publish_max_current:     {attr: 'publish-max-current'},
    subscribe_phases:        {attr: 'subscribe-phases'},
    publish_phases:          {attr: 'publish-phases'},
};

/** Attribute names this controller consumes (parity-set derivation, E114). */
export const EVCC_LOADPOINT_CONSUMED_ATTRIBUTES = evccLoadpointAttributes.map(a => a.name);

const asBool = v => v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';
const asNum = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

export class EvccLoadpointController {
    /** @param {import('lit').ReactiveControllerHost & HTMLElement} host */
    constructor(host) {
        this.host = host;
        host.addController?.(this);
        this.mode = null;          // 'off' | 'pv' | 'minpv' | 'now'
        this.chargePower = null;   // W
        this.sessionEnergy = null; // Wh
        this.connected = false;
        this.charging = false;
        this.enabled = false;
        this.vehicleTitle = '';
        this.vehicleSoc = null;    // % (or °C when heating)
        this.vehicleRange = null;  // km
        this.limitSoc = null;      // % (or target °C when heating)
        this.minCurrent = null;    // A
        this.maxCurrent = null;    // A
        this.phases = null;        // count
    }

    _attr(name, fallback = '') {
        const v = this.host.getAttribute(name);
        return (v === null || v === '') ? fallback : v;
    }

    /** Heating loadpoint (heat pump / water heater) → vehicleSoc/limitSoc are °C.
     *  Read straight off the attribute: a reflected Lit boolean `true` becomes an
     *  EMPTY attribute (`heating=""`), so anything present-but-not-"false" is on. */
    get heating() { const v = this.host.getAttribute('heating'); return v !== null && v !== 'false'; }

    signature() {
        return ['subscribe-mode', 'subscribe-charge-power', 'subscribe-session-energy',
            'subscribe-connected', 'subscribe-charging', 'subscribe-enabled',
            'subscribe-vehicle-title', 'subscribe-vehicle-soc', 'subscribe-vehicle-range',
            'subscribe-limit-soc', 'subscribe-min-current', 'subscribe-max-current', 'subscribe-phases']
            .map(a => this._attr(a)).join('|');
    }

    hostConnected() { this.wire(); }

    wire() {
        this.__sig = this.signature();
        const sub = (attr, cb) => {
            const topic = this._attr(attr);
            if (topic) this.host.addSubscription(topic, msg => { cb(this.host.getProperty(msg, this._attr('message-property', 'payload'))); this.host.requestUpdate(); });
        };
        sub('subscribe-mode',           v => { this.mode = v == null ? null : String(v); });
        sub('subscribe-charge-power',   v => { this.chargePower = asNum(v); });
        sub('subscribe-session-energy', v => { this.sessionEnergy = asNum(v); });
        sub('subscribe-connected',      v => { this.connected = asBool(v); });
        sub('subscribe-charging',       v => { this.charging = asBool(v); });
        sub('subscribe-enabled',        v => { this.enabled = asBool(v); });
        sub('subscribe-vehicle-title',  v => { this.vehicleTitle = v == null ? '' : String(v); });
        sub('subscribe-vehicle-soc',    v => { this.vehicleSoc = asNum(v); });
        sub('subscribe-vehicle-range',  v => { this.vehicleRange = asNum(v); });
        sub('subscribe-limit-soc',      v => { this.limitSoc = asNum(v); });
        sub('subscribe-min-current',    v => { this.minCurrent = asNum(v); });
        sub('subscribe-max-current',    v => { this.maxCurrent = asNum(v); });
        sub('subscribe-phases',         v => { this.phases = asNum(v); });
    }

    // ── commands ──
    _pub(attr, payload) { const t = this._attr(attr); if (t) feezal.connection.pub(t, String(payload)); }
    setMode(m)       { this.mode = m; this._pub('publish-mode', m); this.host.requestUpdate(); }
    setLimitSoc(v)   { this._pub('publish-limit-soc', v); }
    setMinCurrent(v) { this._pub('publish-min-current', v); }
    setMaxCurrent(v) { this._pub('publish-max-current', v); }
    setPhases(v)     { this._pub('publish-phases', v); }

    /** Current activity label ('Charging' / 'Connected' / 'Idle'). */
    get statusText() {
        if (this.charging) return 'Charging';
        if (this.connected) return 'Connected';
        return 'Idle';
    }

    rewireIfChanged() {
        if (this.__sig !== undefined && this.signature() !== this.__sig) {
            this.host._unsubscribe();
            this.wire();
        }
    }
}

'use strict';

/**
 * evcc native recognizer (A30 — extracted from native-discovery.js; E109).
 *
 * evcc (evcc.io) publishes a flat, retained MQTT tree with NO Home Assistant
 * discovery, so a native recognizer is required. The root prefix is
 * user-configurable (default `evcc`) — detect by STRUCTURE, not a literal
 * prefix. Everything is flat scalars (message-property `payload`), the LWT is
 * `<root>/status` (online/offline), and writes use a `/set` suffix.
 *
 * Two entity kinds per root: ONE `energy-flow` site entity (grid/pv/home/battery
 * power + SoC, wired to material-energy-flow) and ONE `evcc-loadpoint` entity
 * per loadpoint (the control surface — mode/limits/currents/phases). Vehicles
 * are deferred (live SoC lives on the loadpoint, per the docs).
 *
 * Topic + sign facts confirmed against docs.evcc.io + evcc-io/evcc core/keys
 * (07/2026): site `homePower`/`pvPower`/`grid/power`/`battery/power`/`battery/soc`;
 * grid + = import; battery + = DISCHARGE (⚠ inverted vs. our flow element, hence
 * invert_battery); a heating loadpoint carries `chargerFeature/heating: true` and
 * reuses `vehicleSoc`/`limitSoc` as °C. All assembly lives in evccTopics() so a
 * wrong assumption is a one-line fix (there is no local evcc to test against).
 *
 * Self-contained — needs none of the shared HM helpers. See native-discovery.js
 * for the recognizer contract.
 */

/** Single source of truth for evcc topic assembly (site + a loadpoint's keys). */
function evccTopics(root, n) {
    const site = `${root}/site`;
    const lp = n != null ? `${root}/loadpoints/${n}` : null;
    return {
        status:      `${root}/status`,
        homePower:   `${site}/homePower`,
        pvPower:     `${site}/pvPower`,
        gridPower:   `${site}/grid/power`,
        batteryPower:`${site}/battery/power`,
        batterySoc:  `${site}/battery/soc`,
        lp: lp && {
            mode:          `${lp}/mode`,
            chargePower:   `${lp}/chargePower`,
            sessionEnergy: `${lp}/sessionEnergy`,
            connected:     `${lp}/connected`,
            charging:      `${lp}/charging`,
            enabled:       `${lp}/enabled`,
            vehicleTitle:  `${lp}/vehicleTitle`,
            vehicleSoc:    `${lp}/vehicleSoc`,
            vehicleRange:  `${lp}/vehicleRange`,
            limitSoc:      `${lp}/limitSoc`,
            limitEnergy:   `${lp}/limitEnergy`,
            minCurrent:    `${lp}/minCurrent`,
            maxCurrent:    `${lp}/maxCurrent`,
            phasesActive:  `${lp}/phasesActive`,
            phasesConfigured: `${lp}/phasesConfigured`,
        },
    };
}

// Site keys whose presence proves an evcc root (grid/power + battery/soc are the
// always-present anchors; homePower/pvPower can be empty in some setups).
const EVCC_SITE_KEY = /^(homePower|pvPower|grid\/power|battery\/power|battery\/soc|greenShareHome)$/;

function evccAvail(root) {
    return {entries: [{topic: `${root}/status`}], mode: 'all', payloadAvailable: 'online', payloadUnavailable: 'offline'};
}

const evccRecognizer = {
    id: 'evcc',
    // root → {siteSeen, loadpoints: Map<n, {title, heating}>}
    state: {roots: new Map()},

    match(topic) {
        let m = topic.match(/^(.+)\/site\/(.+)$/);
        if (m && EVCC_SITE_KEY.test(m[2])) return {root: m[1], kind: 'site', key: m[2]};
        m = topic.match(/^(.+)\/loadpoints\/(\d+)\/(.+)$/);
        if (m) return {root: m[1], kind: 'loadpoint', n: Number(m[2]), key: m[3]};
        return null;
    },

    accumulate(state, parsed, value) {
        let r = state.roots.get(parsed.root);
        if (!r) { r = {siteSeen: false, loadpoints: new Map()}; state.roots.set(parsed.root, r); }
        if (parsed.kind === 'site') { r.siteSeen = true; return {root: parsed.root, target: 'site'}; }
        // loadpoint
        let lp = r.loadpoints.get(parsed.n);
        if (!lp) { lp = {}; r.loadpoints.set(parsed.n, lp); }
        if (parsed.key === 'title') lp.title = value == null ? '' : String(value);
        if (parsed.key === 'chargerFeature/heating') lp.heating = value === true || String(value) === 'true';
        return {root: parsed.root, target: 'lp', n: parsed.n};
    },

    promote(cs) {
        const r = this.state.roots.get(cs.root);
        if (!r) return null;
        if (cs.target === 'site') return this._siteEntity(cs.root, r);
        return this._loadpointEntity(cs.root, cs.n, r.loadpoints.get(cs.n) || {});
    },

    _siteEntity(root) {
        const t = evccTopics(root);
        const config = {
            name: 'evcc Energy Flow',
            subscribe_solar:       t.pvPower,
            subscribe_grid:        t.gridPower,
            subscribe_load:        t.homePower,
            subscribe_battery:     t.batteryPower,
            subscribe_battery_soc: t.batterySoc,
            invert_battery:        true,     // evcc battery power is +=discharge
            // Wire the flow's EV/charge node to loadpoint 1's power (evcc IDs
            // always start at 1; a single total-charge-power topic does not
            // exist — multi-loadpoint summing is a documented follow-up). Wired
            // deterministically so it does not depend on message ordering.
            subscribe_charge:      evccTopics(root, 1).lp.chargePower,
            availability_normalized: evccAvail(root),
        };
        return {discovery_id: `evcc:${root}:site`, component: 'energy-flow', source: 'evcc', sourceLabel: 'evcc', name: config.name, config};
    },

    _loadpointEntity(root, n, lp) {
        const t = evccTopics(root, n).lp;
        const name = lp.title || `Loadpoint ${n}`;
        const config = {
            name,
            // Only stamp `heating` when true — a reflected Lit boolean treats an
            // absent attribute as false (and any present value as on).
            ...(lp.heating ? {heating: 'true'} : {}),
            subscribe_mode:      t.mode,        publish_mode:      `${t.mode}/set`,
            subscribe_charge_power:   t.chargePower,
            subscribe_session_energy: t.sessionEnergy,
            subscribe_connected: t.connected,
            subscribe_charging:  t.charging,
            subscribe_enabled:   t.enabled,
            subscribe_vehicle_title: t.vehicleTitle,
            subscribe_vehicle_soc:   t.vehicleSoc,
            subscribe_vehicle_range: t.vehicleRange,
            subscribe_limit_soc: t.limitSoc,    publish_limit_soc: `${t.limitSoc}/set`,
            subscribe_min_current: t.minCurrent,   publish_min_current: `${t.minCurrent}/set`,
            subscribe_max_current: t.maxCurrent,   publish_max_current: `${t.maxCurrent}/set`,
            subscribe_phases:    t.phasesActive, publish_phases:    `${t.phasesConfigured}/set`,
            availability_normalized: evccAvail(root),
        };
        return {discovery_id: `evcc:${root}:lp:${n}`, component: 'evcc-loadpoint', source: 'evcc', sourceLabel: 'evcc', name, config};
    },

    reset() { this.state.roots.clear(); },
};

module.exports = {evccRecognizer, evccTopics};

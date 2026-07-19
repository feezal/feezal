/**
 * climate-profiles.js — E102 WP3 device-profile presets (built-in editor module).
 *
 * A profile is a *template*: `build(baseTopic, channel)` returns a flat
 * `{attrName: value}` map that the inspector stamps onto a selected climate
 * element (material / glass / metro) through the normal change pipeline
 * (dirty + undo). Values are strings, OR objects/arrays which the commit path
 * (_onCustomAttrChanged) JSON-stringifies — the `modes` array and its
 * putParamset object payloads use that. After stamping, everything is plain,
 * hand-editable attributes; nothing switches at runtime.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ LIVE-SYSTEM VERIFICATION GATE (E102 WP3)
 *
 * The exact hm2mqtt read/set TOPIC STRING SHAPES below are **pending live-system
 * verification**. They follow the documented hm2mqtt conventions and the
 * RedMatic-HomeKit device analysis (see ROADMAP §E102), but the precise segment
 * naming (`hm/status/…` vs `hm/set/…`, device-vs-channel path) must be confirmed
 * against a running bridge before the two Homematic presets are frozen. The
 * putParamset key `VALUES` (NOT `MASTER`) and the datapoint names
 * (SET_TEMPERATURE / SET_POINT_TEMPERATURE, CONTROL_MODE / SET_POINT_MODE,
 * AUTO_MODE / MANU_MODE / BOOST_MODE, VALVE_STATE / LEVEL, ACTUAL_TEMPERATURE)
 * are confirmed from the RedMatic analysis.
 *
 * To adjust the topic shapes after live verification, edit ONLY the small
 * `hmTopics()` helper — every Homematic topic in this module is assembled
 * through it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * hm2mqtt topic assembly. `prefix` is the bridge prefix (default `hm`);
 * `channel` is the `<device>/<channel>` path or channel address (e.g. `TRV/4`,
 * `OEQ1234567:1`). The verb (status / set / paramset) sits between the prefix
 * and the channel, matching the ROADMAP examples
 * (`hm/set/TRV/4/AUTO_MODE`, `hm/paramset/WTH:1/VALUES`).
 *
 * THIS is the single point to change if live verification shows a different
 * hm2mqtt topic layout.
 */
export function hmTopics(prefix, channel) {
    const p = String(prefix || 'hm').replace(/\/+$/, '');
    const ch = String(channel || '').replace(/^\/+|\/+$/g, '');
    return {
        status: dp => `${p}/status/${ch}/${dp}`,
        set: dp => `${p}/set/${ch}/${dp}`,
        paramset: () => `${p}/paramset/${ch}/VALUES`,
    };
}

/** Trim trailing slashes for the non-Homematic (base/…) shapes. */
function trimBase(base) {
    return String(base || '').replace(/\/+$/, '');
}

// ─── BidCoS TRV (HM-CC-RT-DN dialect) ────────────────────────────────────────
// Read CONTROL_MODE (0=auto 1=manu 2=party 3=boost); write per-mode action
// datapoints; off = MANU_MODE 4.5 sentinel; boost = trigger + restore-previous.
function buildBidcos(baseTopic, channel) {
    const t = hmTopics(baseTopic, channel);
    const actual = t.status('ACTUAL_TEMPERATURE');
    return {
        'payload-mode': 'separate',
        // material/glass read actual from subscribe-actual; metro reads it from subscribe.
        'subscribe': actual,
        'subscribe-actual': actual,
        'subscribe-setpoint': t.status('SET_TEMPERATURE'),
        'publish-setpoint': t.set('SET_TEMPERATURE'),
        'subscribe-mode': t.status('CONTROL_MODE'),
        'publish-mode': t.set('CONTROL_MODE'),
        'subscribe-valve': t.status('VALVE_STATE'),
        'valve-min': '0',
        'valve-max': '100',
        'boost-duration': '5',
        'boost-remaining-unit': 'minutes',
        'modes': [
            {value: 0, label: 'Auto', publish: t.set('AUTO_MODE'), payload: 'true'},
            {value: 1, label: 'Manu', publish: t.set('MANU_MODE'), payload: '$setpoint'},
            {value: 1, label: 'Off', 'match-setpoint-max': 4.5,
                publish: t.set('MANU_MODE'), payload: '4.5'},
            {value: 3, label: 'Boost', momentary: true,
                publish: t.set('BOOST_MODE'), payload: 'true', off: 'restore'},
        ],
    };
}

// ─── HmIP TRV (eTRV dialect) ─────────────────────────────────────────────────
// Read SET_POINT_MODE (0=auto 1=manual); Auto writes CONTROL_MODE=0;
// Off/Manu are combined via putParamset (VALUES) — one atomic publish;
// boost = plain BOOST_MODE true/false toggle. Valve LEVEL 0…1 (valve-max 1).
function buildHmip(baseTopic, channel) {
    const t = hmTopics(baseTopic, channel);
    const actual = t.status('ACTUAL_TEMPERATURE');
    return {
        'payload-mode': 'separate',
        'subscribe': actual,
        'subscribe-actual': actual,
        'subscribe-setpoint': t.status('SET_POINT_TEMPERATURE'),
        'publish-setpoint': t.set('SET_POINT_TEMPERATURE'),
        'subscribe-mode': t.status('SET_POINT_MODE'),
        'publish-mode': t.set('CONTROL_MODE'),
        'subscribe-valve': t.status('LEVEL'),
        'valve-min': '0',
        'valve-max': '1',
        'boost-duration': '5',
        'boost-remaining-unit': 'minutes',
        'modes': [
            {value: 0, label: 'Auto', publish: t.set('CONTROL_MODE'), payload: '0'},
            {value: 1, label: 'Manu', publish: t.paramset(),
                payload: {CONTROL_MODE: 1, SET_POINT_TEMPERATURE: '$setpoint'}},
            {value: 1, label: 'Off', 'match-setpoint-max': 4.5, publish: t.paramset(),
                payload: {CONTROL_MODE: 1, SET_POINT_TEMPERATURE: 4.5}},
            {value: 3, label: 'Boost', momentary: true,
                publish: t.set('BOOST_MODE'), payload: 'true',
                off: {publish: t.set('BOOST_MODE'), payload: 'false'}},
        ],
    };
}

// ─── Node-RED / RedMatic flows ───────────────────────────────────────────────
// Single logical command topics under the base — the flow does the combined
// (off = manual + 4.5) write, so no paramset here; plain publish-mode / mode
// values. Boost = momentary with restore-previous-mode.
function buildNodered(baseTopic) {
    const b = trimBase(baseTopic) || 'thermostat';
    const actual = `${b}/actual`;
    return {
        'payload-mode': 'separate',
        'subscribe': actual,
        'subscribe-actual': actual,
        'subscribe-setpoint': `${b}/setpoint`,
        'publish-setpoint': `${b}/setpoint/set`,
        'subscribe-mode': `${b}/mode`,
        'publish-mode': `${b}/mode/set`,
        'subscribe-valve': `${b}/valve`,
        'valve-min': '0',
        'valve-max': '100',
        'boost-duration': '5',
        'modes': [
            {value: 'auto', label: 'Auto'},
            {value: 'manu', label: 'Manu'},
            {value: 'off', label: 'Off'},
            {value: 'boost', label: 'Boost', momentary: true, off: 'restore'},
        ],
    };
}

// ─── zigbee2mqtt TRV ─────────────────────────────────────────────────────────
// JSON payload mode: state JSON on <base>, commands to <base>/set. z2m TRV
// exposes conventions: system_mode / occupied_heating_setpoint / local_temperature.
function buildZ2m(baseTopic) {
    const b = trimBase(baseTopic) || 'zigbee2mqtt/TRV';
    return {
        'payload-mode': 'json',
        'subscribe': b,
        'publish': `${b}/set`,
        'message-property': 'payload',
        'json-map': {
            setpoint: 'occupied_heating_setpoint',
            actual: 'local_temperature',
            mode: 'system_mode',
            valve: 'position',
        },
        'valve-min': '0',
        'valve-max': '100',
        'boost-duration': '5',
        'modes': [
            {value: 'off', label: 'Off'},
            {value: 'heat', label: 'Heat'},
            {value: 'auto', label: 'Auto'},
        ],
    };
}

// ─── Generic ─────────────────────────────────────────────────────────────────
// Minimal separate-mode wiring, empty modes, no Homematic specifics.
function buildGeneric(baseTopic) {
    const b = trimBase(baseTopic) || 'climate';
    return {
        'payload-mode': 'separate',
        'subscribe': `${b}/actual`,
        'subscribe-actual': `${b}/actual`,
        'subscribe-setpoint': `${b}/setpoint`,
        'publish-setpoint': `${b}/setpoint/set`,
        'modes': [],
    };
}

/**
 * The five profile templates. Each: {id, label, build(baseTopic, channel)}.
 * The `channel` argument is only meaningful for the two Homematic profiles.
 */
export const CLIMATE_PROFILES = [
    {id: 'hm2mqtt-bidcos', label: 'hm2mqtt · Homematic BidCoS (HM-CC-RT-DN)',
        build: (baseTopic, channel) => buildBidcos(baseTopic, channel)},
    {id: 'hm2mqtt-hmip', label: 'hm2mqtt · Homematic IP (eTRV)',
        build: (baseTopic, channel) => buildHmip(baseTopic, channel)},
    {id: 'nodered-flows', label: 'Node-RED / RedMatic flows',
        build: baseTopic => buildNodered(baseTopic)},
    {id: 'z2m-trv', label: 'zigbee2mqtt TRV',
        build: baseTopic => buildZ2m(baseTopic)},
    {id: 'generic', label: 'Generic (minimal)',
        build: baseTopic => buildGeneric(baseTopic)},
];

/** Look a profile up by id. */
export function getClimateProfile(id) {
    return CLIMATE_PROFILES.find(p => p.id === id) || null;
}

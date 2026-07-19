'use strict';

/**
 * Native device self-discovery (E108).
 *
 * A generic "recognizer" framework layered onto the same MQTT firehose the
 * bridge already feeds through discovery.js. Where a device ecosystem does NOT
 * emit Home-Assistant discovery configs (Homematic via hm2mqtt / RedMatic, and
 * WLED with its HA-sync interface disabled), these recognizers watch the native
 * topic patterns and synthesize the exact same normalized entity shape the HA
 * discovery path produces ({discovery_id, component, config, availability_normalized}).
 *
 * A recognizer is:
 *   {
 *     id:    string,
 *     state: <private accumulator>,
 *     match(topic)            → parsed | null   // cheap topic test + parse
 *     accumulate(state, parsed, value) → channelState | null
 *     promote(channelState)   → entity | null   // null until signature complete
 *     reset()                                    // clear accumulator
 *   }
 *
 * handleNativeMessage(topic, payloadOrBuf) runs every recognizer; promoted
 * entities are kept in a namespaced Map exposed via getNativeEntities().
 *
 * Homematic payloads follow the MQTT-Smarthome "JSON Extended" convention
 * ({"val":…,"ts":…}); the framework extracts `.val` as the value. Guarded so a
 * non-JSON / malformed payload never throws.
 */

// ── Config ──────────────────────────────────────────────────────────────────
// Homematic bridge prefix (hm2mqtt / RedMatic default). Configurable.
let hmPrefix = 'hm';
function setHomematicPrefix(p) { hmPrefix = String(p || 'hm').replace(/\/+$/, ''); }

// Thermostat datapoint whitelist — only these are worth tracking off the firehose.
const HM_THERMOSTAT_DPS = new Set([
    'SET_TEMPERATURE',
    'SET_POINT_TEMPERATURE',
    'CONTROL_MODE',
    'SET_POINT_MODE',
    'ACTUAL_TEMPERATURE',
    'VALVE_STATE',
    'LEVEL',
    'BOOST_MODE',
    'HUMIDITY',
]);

// ── Homematic topic + mode builder (ported from www/src/climate-profiles.js) ──
function hmSet(p, ch, dp) { return `${p}/set/${ch}/${dp}`; }
function hmStatus(p, ch, dp) { return `${p}/status/${ch}/${dp}`; }
function hmParamset(p, ch) { return `${p}/paramset/${ch}/VALUES`; }

/**
 * Port of climate-profiles.js buildBidcos()/buildHmip() `modes` arrays — driven
 * by the OBSERVED prefix + channelName instead of typed input. Mirrors the
 * client builder exactly (Auto/Manu/Off with match-setpoint-max 4.5 sentinel +
 * momentary Boost with the generation's off-strategy; HmIP Off/Manu via
 * putParamset hm/paramset/<ch>/VALUES).
 */
function buildHmModes(generation, p, ch) {
    if (generation === 'bidcos') {
        // BidCoS (HM-CC-RT-DN dialect): read CONTROL_MODE, write per-mode action
        // datapoints; off = MANU_MODE 4.5 sentinel; boost = trigger + restore-previous.
        return [
            {value: 0, label: 'Auto', publish: hmSet(p, ch, 'AUTO_MODE'), payload: 'true'},
            {value: 1, label: 'Manu', publish: hmSet(p, ch, 'MANU_MODE'), payload: '$setpoint'},
            {value: 1, label: 'Off', 'match-setpoint-max': 4.5,
                publish: hmSet(p, ch, 'MANU_MODE'), payload: '4.5'},
            {value: 3, label: 'Boost', momentary: true,
                publish: hmSet(p, ch, 'BOOST_MODE'), payload: 'true', off: 'restore'},
        ];
    }
    // HmIP (eTRV dialect): read SET_POINT_MODE; Auto writes CONTROL_MODE=0;
    // Off/Manu combined via putParamset VALUES; boost = plain BOOST_MODE toggle.
    return [
        {value: 0, label: 'Auto', publish: hmSet(p, ch, 'CONTROL_MODE'), payload: '0'},
        {value: 1, label: 'Manu', publish: hmParamset(p, ch),
            payload: {CONTROL_MODE: 1, SET_POINT_TEMPERATURE: '$setpoint'}},
        {value: 1, label: 'Off', 'match-setpoint-max': 4.5, publish: hmParamset(p, ch),
            payload: {CONTROL_MODE: 1, SET_POINT_TEMPERATURE: 4.5}},
        {value: 3, label: 'Boost', momentary: true,
            publish: hmSet(p, ch, 'BOOST_MODE'), payload: 'true',
            off: {publish: hmSet(p, ch, 'BOOST_MODE'), payload: 'false'}},
    ];
}

// ── Recognizer 1: Homematic climate ──────────────────────────────────────────
const hmClimateRecognizer = {
    id: 'homematic-climate',
    state: {channels: new Map()},   // channelName → {channelName, dps:Set}

    match(topic) {
        // hm/status/<channelName>/<DATAPOINT> — channelName is a single level.
        if (!topic.startsWith(hmPrefix + '/status/')) return null;
        const parts = topic.split('/');
        if (parts.length !== 4) return null;            // exactly prefix/status/ch/DP
        const datapoint = parts[3];
        if (!HM_THERMOSTAT_DPS.has(datapoint)) return null;
        return {channelName: parts[2], datapoint};
    },

    accumulate(state, parsed /* , value */) {
        let ch = state.channels.get(parsed.channelName);
        if (!ch) {
            ch = {channelName: parsed.channelName, dps: new Set()};
            state.channels.set(parsed.channelName, ch);
        }
        ch.dps.add(parsed.datapoint);
        return ch;
    },

    promote(channelState) {
        const dps = channelState.dps;
        const ch = channelState.channelName;

        // Signature → generation (E102 device matrix).
        let generation;
        let setpointDp;
        let modeDp;
        if (dps.has('SET_TEMPERATURE') && dps.has('CONTROL_MODE')) {
            generation = 'bidcos'; setpointDp = 'SET_TEMPERATURE'; modeDp = 'CONTROL_MODE';
        } else if (dps.has('SET_POINT_TEMPERATURE') && dps.has('SET_POINT_MODE')) {
            generation = 'hmip'; setpointDp = 'SET_POINT_TEMPERATURE'; modeDp = 'SET_POINT_MODE';
        } else {
            return null;    // incomplete — wait for more datapoints
        }

        // Valve wiring: VALVE_STATE (BidCoS 0–100) | LEVEL (HmIP 0.0–1.0) ⇒ TRV.
        const hasValveState = dps.has('VALVE_STATE');
        const hasLevel = dps.has('LEVEL');
        const valveDp = hasValveState ? 'VALVE_STATE' : (hasLevel ? 'LEVEL' : null);
        const isTRV = valveDp !== null;
        const valveMax = (generation === 'hmip' && hasLevel) ? 1 : 100;

        const p = hmPrefix;
        const config = {
            name: ch,
            schema: 'separate',
            temperature_state_topic:   hmStatus(p, ch, setpointDp),
            temperature_command_topic: hmSet(p, ch, setpointDp),
            current_temperature_topic: hmStatus(p, ch, 'ACTUAL_TEMPERATURE'),
            mode_state_topic:          hmStatus(p, ch, modeDp),
            min_temp: 4.5, max_temp: 30.5, temp_step: 0.5, temperature_unit: 'C',
            modes: buildHmModes(generation, p, ch),
            // Native extras consumed by the climate discovery.map keys.
            message_property: 'val',
            valve_min: 0,
            valve_max: valveMax,
        };
        if (isTRV) config.action_topic = hmStatus(p, ch, valveDp);

        // Availability (the :0 maintenance UNREACH) is out of MVP scope for HM.
        return {
            discovery_id: 'hm-climate:' + ch,
            component: 'climate',
            source: 'homematic',
            name: ch,
            config,
        };
    },

    reset() { this.state.channels.clear(); },
};

// ── Recognizer 2: WLED ────────────────────────────────────────────────────────
const wledRecognizer = {
    id: 'wled',
    state: {devices: new Set()},

    match(topic) {
        // wled/<deviceTopic>/v (full state) OR wled/<deviceTopic>/status (LWT).
        if (!topic.startsWith('wled/')) return null;
        const parts = topic.split('/');
        if (parts.length !== 3) return null;            // deviceTopic is a single level
        const leaf = parts[2];
        if (leaf !== 'v' && leaf !== 'status') return null;
        return {deviceTopic: parts[1]};
    },

    accumulate(state, parsed /* , value */) {
        state.devices.add(parsed.deviceTopic);
        return parsed;
    },

    promote(channelState) {
        const dt = channelState.deviceTopic;
        const status = 'wled/' + dt + '/status';
        return {
            discovery_id: 'wled:' + dt,
            component: 'wled',
            source: 'wled',
            name: dt,
            config: {
                name: dt,
                device_topic: 'wled/' + dt,
                availability_topic: status,
            },
            availability_normalized: {
                entries: [{topic: status}],
                mode: 'all',
                payloadAvailable: 'online',
                payloadUnavailable: 'offline',
            },
        };
    },

    reset() { this.state.devices.clear(); },
};

// ── Framework ─────────────────────────────────────────────────────────────────
const recognizers = [hmClimateRecognizer, wledRecognizer];

/** @type {Map<string, object>} discovery_id → promoted native entity */
const nativeEntities = new Map();

/**
 * Extract a value from a raw MQTT payload. MQTT-Smarthome "JSON Extended"
 * ({"val":…}) → `.val`; other JSON → the parsed object; otherwise the string.
 * Guarded — never throws.
 */
function extractValue(payloadOrBuf) {
    const str = Buffer.isBuffer(payloadOrBuf)
        ? payloadOrBuf.toString()
        : (payloadOrBuf == null ? '' : String(payloadOrBuf));
    if (str.length && (str[0] === '{' || str[0] === '[')) {
        try {
            const j = JSON.parse(str);
            if (j && typeof j === 'object' && !Array.isArray(j) && 'val' in j) return j.val;
            return j;
        } catch { /* fall through to raw */ }
    }
    return str;
}

/**
 * Run every recognizer over one MQTT message. Cheap: each recognizer's match()
 * does a startsWith/suffix guard before any work. A throwing recognizer is
 * isolated so it can never break the others (or the HA path that calls this).
 *
 * @param {string} topic
 * @param {Buffer|string} payloadOrBuf
 */
function handleNativeMessage(topic, payloadOrBuf) {
    for (const rec of recognizers) {
        let parsed;
        try { parsed = rec.match(topic); } catch { parsed = null; }
        if (!parsed) continue;

        let value;
        try { value = extractValue(payloadOrBuf); } catch { value = undefined; }

        let channelState;
        try { channelState = rec.accumulate(rec.state, parsed, value); } catch { continue; }
        if (!channelState) continue;

        let entity;
        try { entity = rec.promote(channelState); } catch { continue; }
        if (entity && entity.discovery_id) nativeEntities.set(entity.discovery_id, entity);
    }
}

/** All promoted native entities, same shape as discovery.js entities. */
function getNativeEntities() {
    return [...nativeEntities.values()];
}

/** One promoted native entity by discovery_id, or null. */
function getNativeEntity(id) {
    return nativeEntities.get(id) ?? null;
}

/** Clear promoted entities AND every recognizer's accumulator. */
function clearNativeEntities() {
    nativeEntities.clear();
    for (const rec of recognizers) {
        try { rec.reset(); } catch { /* ignore */ }
    }
}

module.exports = {
    handleNativeMessage,
    getNativeEntities,
    getNativeEntity,
    clearNativeEntities,
    setHomematicPrefix,
    // exported for tests / reuse
    buildHmModes,
    recognizers,
};

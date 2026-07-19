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
 *     accumulate(state, parsed, value, payload) → channelState | null
 *         // `payload` is the full parsed JSON-Extended object (or null) so a
 *         // recognizer can read the CCU metadata in payload.hm.
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

// Setpoint datapoints (per generation) — the presence of one on the CONTROL
// channel is what tells us the generation, and its payload's datapointMin/Max
// give the real setpoint range.
const HM_SETPOINT_DPS = new Set(['SET_POINT_TEMPERATURE', 'SET_TEMPERATURE']);
// CCU channelTypes of the climate-control channel (HmIP + BidCoS dialects).
// Exact allowlist — extend as new device generations are confirmed. Channels
// whose channelType is absent or unlisted fall through to the datapoint-signature
// path in promote(), so metadata-less / unknown devices still work.
const CONTROL_CHANNEL_TYPES = new Set([
    'HEATING_CLIMATECONTROL_TRANSCEIVER',  // HmIP (WTH/eTRV/STHD/HEATING groups) — confirmed
    'CLIMATECONTROL_RT_TRANSCEIVER',       // BidCoS classic (HM-CC-RT-DN) — confirmed
    'THERMALCONTROL_TRANSMIT',             // BidCoS wall (HM-TC-IT-WM-W-EU) — documented, unconfirmed
]);

// ── Recognizer 1: Homematic climate ──────────────────────────────────────────
// Rebuilt (E108 follow-up) to consume the rich CCU metadata carried in each
// MQTT-Smarthome JSON-Extended payload's `hm` object — the authoritative source
// for device grouping, the control channel (`channelType`), and setpoint range —
// instead of guessing the channel from datapoint signatures. The datapoint-only
// signature path survives as a fallback for metadata-less payloads.
const hmClimateRecognizer = {
    id: 'homematic-climate',
    // deviceId → {deviceId, deviceName, deviceType, iface, channels: Map<seg, chan>}
    // chan = {seg, channelType, channelAddr, dps:Set, min, max}
    state: {devices: new Map()},

    match(topic) {
        // hm/status/<seg>/<DATAPOINT> — <seg> is one level (may be empty for a
        // nameless device: hm/status//SET_POINT_TEMPERATURE).
        if (!topic.startsWith(hmPrefix + '/status/')) return null;
        const parts = topic.split('/');
        if (parts.length !== 4) return null;            // exactly prefix/status/seg/DP
        const datapoint = parts[3];
        if (!HM_THERMOSTAT_DPS.has(datapoint)) return null;
        return {seg: parts[2], datapoint};
    },

    accumulate(state, parsed, value, payload) {
        const hm = (payload && typeof payload === 'object' && payload.hm && typeof payload.hm === 'object')
            ? payload.hm : null;

        // Group by the CCU device id (space-free, stable). Fall back to the topic
        // segment with its trailing :<n> stripped when metadata is absent.
        const deviceId = (hm && hm.device) ? String(hm.device)
            : parsed.seg.replace(/:\d+$/, '');

        let dev = state.devices.get(deviceId);
        if (!dev) {
            dev = {deviceId, deviceName: undefined, deviceType: undefined,
                iface: undefined, channels: new Map()};
            state.devices.set(deviceId, dev);
        }
        // Metadata is authoritative but only present on annotated payloads; keep
        // the last non-empty value we saw.
        if (hm) {
            if (hm.deviceName != null) dev.deviceName = hm.deviceName;
            if (hm.deviceType != null) dev.deviceType = hm.deviceType;
            if (hm.iface != null) dev.iface = hm.iface;
        }

        let chan = dev.channels.get(parsed.seg);
        if (!chan) {
            chan = {seg: parsed.seg, channelType: undefined, channelAddr: undefined,
                dps: new Set(), min: undefined, max: undefined};
            dev.channels.set(parsed.seg, chan);
        }
        if (hm) {
            if (hm.channelType != null) chan.channelType = hm.channelType;
            if (hm.channel != null) chan.channelAddr = hm.channel;
        }
        chan.dps.add(parsed.datapoint);
        // Capture the real setpoint range from the setpoint datapoint's own
        // metadata (other datapoints carry unrelated min/max).
        if (hm && HM_SETPOINT_DPS.has(parsed.datapoint)) {
            if (hm.datapointMin != null) chan.min = hm.datapointMin;
            if (hm.datapointMax != null) chan.max = hm.datapointMax;
        }
        return dev;
    },

    // Generation + read datapoint names, derived from the setpoint datapoint
    // OBSERVED on the control channel (SET_POINT_TEMPERATURE ⇒ HmIP, SET_TEMPERATURE
    // ⇒ BidCoS). Null until a setpoint has been seen there.
    _detectGeneration(chan) {
        if (chan.dps.has('SET_POINT_TEMPERATURE')) {
            return {generation: 'hmip', setpointDp: 'SET_POINT_TEMPERATURE', modeDp: 'SET_POINT_MODE'};
        }
        if (chan.dps.has('SET_TEMPERATURE')) {
            return {generation: 'bidcos', setpointDp: 'SET_TEMPERATURE', modeDp: 'CONTROL_MODE'};
        }
        return null;
    },

    // Datapoint-only completeness (fallback when channelType metadata is absent).
    _hasCompleteSignature(chan) {
        return (chan.dps.has('SET_TEMPERATURE') && chan.dps.has('CONTROL_MODE'))
            || (chan.dps.has('SET_POINT_TEMPERATURE') && chan.dps.has('SET_POINT_MODE'));
    },

    promote(dev) {
        const channels = [...dev.channels.values()];

        // Pick the control channel: prefer the CCU-declared climate-control
        // channelType; fall back to any channel with a complete datapoint
        // signature (metadata-less payloads).
        let control = channels.find(c => c.channelType && CONTROL_CHANNEL_TYPES.has(c.channelType));
        if (!control) control = channels.find(c => this._hasCompleteSignature(c));
        if (!control) return null;

        // The control channel must have a setpoint observed to fix the generation
        // (and thus the mode datapoint name). Mode topic is CONSTRUCTED — we needn't
        // have seen the mode datapoint's own message.
        const gen = this._detectGeneration(control);
        if (!gen) return null;   // wait for the setpoint
        const {generation, setpointDp, modeDp} = gen;

        // Valve: wire only if a VALVE_STATE (BidCoS 0–100) or LEVEL (HmIP 0.0–1.0)
        // datapoint was observed on ANY channel of the device; use that channel.
        let valveChan = null, valveDp = null;
        for (const c of channels) {
            if (c.dps.has('VALVE_STATE')) { valveChan = c; valveDp = 'VALVE_STATE'; break; }
            if (c.dps.has('LEVEL')) { valveChan = c; valveDp = 'LEVEL'; }
        }
        const isTRV = valveDp !== null;
        const valveMax = valveDp === 'LEVEL' ? 1 : 100;

        // Read topics use the topic segment; write/paramset topics use the segment
        // when non-empty, else the channel address (nameless device).
        const p = hmPrefix;
        const readSeg = control.seg;
        const writeSeg = control.seg !== '' ? control.seg : (control.channelAddr || control.seg);

        const deviceId = dev.deviceId;
        const name = dev.deviceName
            || (dev.deviceType ? dev.deviceType + ' ' + deviceId : deviceId);

        const config = {
            name,
            schema: 'separate',
            temperature_state_topic:   hmStatus(p, readSeg, setpointDp),
            temperature_command_topic: hmSet(p, writeSeg, setpointDp),
            current_temperature_topic: hmStatus(p, readSeg, 'ACTUAL_TEMPERATURE'),
            mode_state_topic:          hmStatus(p, readSeg, modeDp),
            min_temp: control.min != null ? control.min : 4.5,
            max_temp: control.max != null ? control.max : 30.5,
            temp_step: 0.5,
            temperature_unit: 'C',
            modes: buildHmModes(generation, p, writeSeg),
            // Native extras consumed by the climate discovery.map keys.
            // MQTT-Smarthome JSON-Extended: the value lives at `.val` inside the
            // payload — feezal message-property paths start at the message root,
            // so it's `payload.val` (not `val`).
            message_property: 'payload.val',
            // Per-topic message-property twins: each *-climate element reads its
            // per-topic path WITHOUT falling back to the element-level one (their
            // default 'payload' is truthy), so every one must be stamped to
            // payload.val too. Set unconditionally — an unused one is harmless
            // since its subscribe-* topic is unset.
            message_property_setpoint: 'payload.val',
            message_property_actual: 'payload.val',
            message_property_mode: 'payload.val',
            message_property_valve: 'payload.val',
            message_property_boost_remaining: 'payload.val',
            valve_min: 0,
            valve_max: valveMax,
        };
        if (isTRV) config.action_topic = hmStatus(p, valveChan.seg, valveDp);
        // Mode WRITE topic (→ publish-mode). HmIP writes the mode via CONTROL_MODE;
        // BidCoS has no single mode-write datapoint (its per-entry `modes` publishes
        // handle it), so publish-mode stays unset there.
        if (generation === 'hmip') config.mode_command_topic = hmSet(p, writeSeg, 'CONTROL_MODE');

        // Availability: the device's :0 maintenance channel UNREACH datapoint
        // (UNREACH val=true ⇒ unreachable, so payload-available=false /
        // payload-unavailable=true). Derive the :0 channel from the control
        // channel's name-based segment (device-name:1 → device-name:0), or its
        // address for a nameless device. property `payload.val` reads the
        // JSON-Extended value.
        const availBase = readSeg !== '' ? readSeg : (control.channelAddr || readSeg);
        const availSeg = availBase.replace(/:\d+$/, ':0');
        // availability_normalized lives INSIDE config (the HA convention — the
        // client's _applyDiscovery reads cfg.availability_normalized).
        config.availability_normalized = {
            entries: [{topic: hmStatus(p, availSeg, 'UNREACH'), property: 'payload.val'}],
            mode: 'all',
            payloadAvailable: false,
            payloadUnavailable: true,
        };

        // Device-level discovery_id → one entry per physical device; re-promotes
        // (updates) as more datapoints arrive.
        return {
            discovery_id: 'hm-climate:' + deviceId,
            component: 'climate',
            source: 'homematic',
            sourceLabel: 'hm',
            name,
            config,
        };
    },

    reset() { this.state.devices.clear(); },
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
            sourceLabel: 'WLED',
            name: dt,
            config: {
                name: dt,
                device_topic: 'wled/' + dt,
                availability_topic: status,
                // Inside config (HA convention — _applyDiscovery reads cfg.availability_normalized).
                availability_normalized: {
                    entries: [{topic: status}],
                    mode: 'all',
                    payloadAvailable: 'online',
                    payloadUnavailable: 'offline',
                },
            },
        };
    },

    reset() { this.state.devices.clear(); },
};

// ── Recognizer 3: Homematic contact ───────────────────────────────────────────
// STATE is a generic datapoint on many device kinds (switches, actors, …), so a
// STATE message alone is NOT evidence of a contact. Promotion is gated on the CCU
// channelType — only these two channel types are window/door contacts. If the
// channelType metadata is absent we cannot classify the channel, so we do NOT
// promote (contacts need the metadata to avoid false positives on switches etc.).
const CONTACT_CHANNEL_TYPES = new Set([
    'SHUTTER_CONTACT',            // HM-Sec-SC / HmIP-SWDO — boolean STATE (false=closed, true=open)
    'ROTARY_HANDLE_TRANSCEIVER',  // HM-Sec-RHS / HmIP-SRH — tristate STATE (0/1/2)
]);

const hmContactRecognizer = {
    id: 'homematic-contact',
    // deviceId → {deviceId, deviceName, deviceType, channels: Map<seg, chan>}
    // chan = {seg, channelType, channelAddr}
    state: {devices: new Map()},

    match(topic) {
        // hm/status/<seg>/STATE — STATE only (whitelisted datapoint).
        if (!topic.startsWith(hmPrefix + '/status/')) return null;
        const parts = topic.split('/');
        if (parts.length !== 4) return null;            // exactly prefix/status/seg/DP
        if (parts[3] !== 'STATE') return null;
        return {seg: parts[2], datapoint: 'STATE'};
    },

    accumulate(state, parsed, value, payload) {
        const hm = (payload && typeof payload === 'object' && payload.hm && typeof payload.hm === 'object')
            ? payload.hm : null;

        // Group by the CCU device id; fall back to the topic segment with its
        // trailing :<n> stripped when metadata is absent.
        const deviceId = (hm && hm.device) ? String(hm.device)
            : parsed.seg.replace(/:\d+$/, '');

        let dev = state.devices.get(deviceId);
        if (!dev) {
            dev = {deviceId, deviceName: undefined, deviceType: undefined, channels: new Map()};
            state.devices.set(deviceId, dev);
        }
        if (hm) {
            if (hm.deviceName != null) dev.deviceName = hm.deviceName;
            if (hm.deviceType != null) dev.deviceType = hm.deviceType;
        }

        let chan = dev.channels.get(parsed.seg);
        if (!chan) {
            chan = {seg: parsed.seg, channelType: undefined, channelAddr: undefined};
            dev.channels.set(parsed.seg, chan);
        }
        if (hm) {
            if (hm.channelType != null) chan.channelType = hm.channelType;
            if (hm.channel != null) chan.channelAddr = hm.channel;
        }
        return dev;
    },

    promote(dev) {
        const channels = [...dev.channels.values()];

        // ONLY promote when the channel's channelType is a known contact type.
        // channelType absent ⇒ metadata-less ⇒ cannot classify ⇒ no promotion.
        const contact = channels.find(c => c.channelType && CONTACT_CHANNEL_TYPES.has(c.channelType));
        if (!contact) return null;

        const p = hmPrefix;
        const seg = contact.seg;
        const deviceId = dev.deviceId;
        const name = dev.deviceName
            || (dev.deviceType ? dev.deviceType + ' ' + deviceId : deviceId);

        // The map's value_template → message-property via valueTemplateToPath
        // yields payload.val (MQTT-Smarthome JSON-Extended value path).
        const config = {
            name,
            state_topic: hmStatus(p, seg, 'STATE'),
            value_template: '{{ value_json.val }}',
            device_class: 'window',
        };

        if (contact.channelType === 'ROTARY_HANDLE_TRANSCEIVER') {
            // Tristate STATE. NOTE: these numeric values (0=closed, 1=tilted,
            // 2=open) are ASSUMED from the common CCU rotary-handle convention —
            // easy to adjust here should a device report differently.
            config.payload_off = '0';
            config.payload_tilted = '1';
            config.payload_on = '2';
        } else {
            // SHUTTER_CONTACT: STATE is BidCoS boolean (false=closed/true=open)
            // OR HmIP numeric (0=closed/1=open). Use '1'/'0' — the contact's
            // payloadMatch matches BidCoS booleans via its true↔1 / false↔0
            // aliases AND HmIP numerics by string equality, so one mapping covers
            // both generations. No tilt.
            config.payload_on = '1';
            config.payload_off = '0';
        }

        // Availability from the device's :0 maintenance channel — derive the :0
        // segment from the contact channel's name-based segment (device:1 →
        // device:0), or its channel address for a nameless device.
        const availBase = seg !== '' ? seg : (contact.channelAddr || seg);
        const availSeg = availBase.replace(/:\d+$/, ':0');
        // availability_normalized lives INSIDE config (HA convention — the client's
        // _applyDiscovery reads cfg.availability_normalized). TWO entries: UNREACH +
        // LOWBAT (both JSON-Extended .val). mode 'all' ⇒ the element shows
        // unavailable when unreachable OR battery low — acceptable since contacts
        // have no dedicated battery attribute of their own.
        config.availability_normalized = {
            entries: [
                {topic: hmStatus(p, availSeg, 'UNREACH'), property: 'payload.val'},
                {topic: hmStatus(p, availSeg, 'LOWBAT'), property: 'payload.val'},
            ],
            mode: 'all',
            payloadAvailable: false,
            payloadUnavailable: true,
        };

        return {
            discovery_id: 'hm-contact:' + deviceId,
            component: 'binary_sensor',
            source: 'homematic',
            sourceLabel: 'hm',
            name,
            config,
        };
    },

    reset() { this.state.devices.clear(); },
};

// ── Framework ─────────────────────────────────────────────────────────────────
const recognizers = [hmClimateRecognizer, wledRecognizer, hmContactRecognizer];

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
 * Parse a raw MQTT payload into its full JSON object (MQTT-Smarthome JSON-Extended
 * — {"val":…,"ts":…,"hm":{…}}), so a recognizer can read the rich CCU metadata in
 * `payload.hm`. Returns null for non-object / non-JSON payloads. Guarded — never
 * throws. WLED and other non-JSON-Extended payloads simply get null here.
 */
function parsePayload(payloadOrBuf) {
    const str = Buffer.isBuffer(payloadOrBuf)
        ? payloadOrBuf.toString()
        : (payloadOrBuf == null ? '' : String(payloadOrBuf));
    if (str.length && str[0] === '{') {
        try {
            const j = JSON.parse(str);
            if (j && typeof j === 'object' && !Array.isArray(j)) return j;
        } catch { /* not JSON */ }
    }
    return null;
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

        // Full parsed JSON-Extended object (or null) so a recognizer can read the
        // authoritative CCU metadata in payload.hm. Parsed once, guarded.
        let payload;
        try { payload = parsePayload(payloadOrBuf); } catch { payload = null; }

        let channelState;
        try { channelState = rec.accumulate(rec.state, parsed, value, payload); } catch { continue; }
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
    extractValue,
    parsePayload,
    buildHmModes,
    recognizers,
};

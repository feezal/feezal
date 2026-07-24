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

// Staleness ("grace period") filter for CLIMATE ONLY. Premise: a live thermostat
// publishes ACTUAL_TEMPERATURE periodically, so a heating device whose newest
// `ts` is older than the window is a likely "ghost" — old RETAINED topics from a
// replaced device. The window must be generous, because a stable HEATING GROUP
// (or a thermostat whose setpoint hasn't changed and whose room is quiet) can
// legitimately go a while without a fresh ts. Configurable from Editor Settings →
// Autodiscovery (persisted in editor.json, applied via setHomematicClimateStale);
// default ON with a 30-day grace. NOT applied to contact/cover/light — those are
// event-driven and legitimately quiet, so a stale ts there means nothing.
const DAY_MS = 24 * 60 * 60 * 1000;
let hmClimateStaleMs = 30 * DAY_MS;
function setHomematicClimateStaleMs(ms) { hmClimateStaleMs = Number(ms) || 0; }
// {enabled, days} form used by the editor-prefs plumbing (enabled:false → off).
function setHomematicClimateStale({enabled, days} = {}) {
    hmClimateStaleMs = enabled ? Math.max(0, Number(days) || 0) * DAY_MS : 0;
}

// Thermostat datapoint whitelist — only these are worth tracking off the firehose.
const HM_THERMOSTAT_DPS = new Set([
    'SET_TEMPERATURE',
    'SET_POINT_TEMPERATURE',
    'CONTROL_MODE',
    'SET_POINT_MODE',
    'ACTUAL_TEMPERATURE',
    'VALVE',          // B56: newer HmIP TRVs report the percentage here
    'VALVE_STATE',
    'LEVEL',
    'BOOST_MODE',
    'HUMIDITY',
]);

// B56: valve candidates — their payload metadata (datapointMin/Max) is captured
// per datapoint so promote() can range-gate instead of trusting names. On HmIP,
// VALVE_STATE is an adaptation-status ENUM (max ~8), not a percentage.
const HM_VALVE_DPS = new Set(['VALVE', 'VALVE_STATE', 'LEVEL']);

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
    'THERMALCONTROL_TRANSMIT',             // BidCoS wall (HM-TC-IT-WM-W-EU) — confirmed (channel :2)
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
        // E124: also observe the :0 battery datapoints for the presence check
        // (mains-powered TRVs/wall thermostats must not grow a battery slot).
        if (!HM_THERMOSTAT_DPS.has(datapoint) && !HM_BATTERY_DPS.has(datapoint)) return null;
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
                iface: undefined, channels: new Map(), lastTs: 0, batteryDp: undefined};
            state.devices.set(deviceId, dev);
        }
        // E124: presence-checked battery — remember the observed :0 name.
        if (HM_BATTERY_DPS.has(parsed.datapoint) && /:0$/.test(parsed.seg)) {
            dev.batteryDp = parsed.datapoint;
        }
        // Newest datapoint timestamp across the device — the liveness signal for
        // the climate staleness filter (a live thermostat updates constantly).
        if (payload && typeof payload.ts === 'number' && payload.ts > dev.lastTs) {
            dev.lastTs = payload.ts;
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
                dps: new Set(), min: undefined, max: undefined, dpMeta: {}};
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
        // B56: capture valve-candidate metadata per datapoint — promote()
        // range-gates on datapointMax (percent vs adaptation enum).
        if (hm && HM_VALVE_DPS.has(parsed.datapoint)) {
            const meta = chan.dpMeta[parsed.datapoint] || (chan.dpMeta[parsed.datapoint] = {});
            if (hm.datapointMin != null) meta.min = hm.datapointMin;
            if (hm.datapointMax != null) meta.max = hm.datapointMax;
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
        // Staleness ghost-filter is applied at read time in getNativeEntities()
        // (keyed on the entity's newest `ts`), so a config change from Editor
        // Settings → Autodiscovery takes effect immediately without waiting for a
        // fresh message to re-promote each device.
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

        // B56: valve wiring — trust the metadata, not the datapoint name.
        // Preference: VALVE (newer HmIP TRVs, range-validated) → VALVE_STATE
        // (only when its metadata says percentage, or metadata-less BidCoS —
        // on HmIP it is an adaptation-status ENUM, max ~8) → LEVEL (HmIP 0…1).
        // valve_min/max are stamped from the actual datapointMin/Max when
        // present instead of the old name-based 1/100 guess.
        const meta = (c, dp) => c.dpMeta ? c.dpMeta[dp] : undefined;
        // Enum-like: a max well below any percentage scale but above the 0…1
        // float range (HmIP VALVE_STATE enum max ~8).
        const enumLike = m => m && m.max != null && m.max > 1.5 && m.max < 10;
        let valveChan = null, valveDp = null;
        for (const c of channels) {
            if (c.dps.has('VALVE') && !enumLike(meta(c, 'VALVE'))) { valveChan = c; valveDp = 'VALVE'; break; }
        }
        if (!valveDp) {
            for (const c of channels) {
                const m = meta(c, 'VALVE_STATE');
                const percentByMeta = m && m.max != null && m.max >= 10;
                const metadataLess = !m || m.max == null;
                if (c.dps.has('VALVE_STATE') && (percentByMeta || (metadataLess && generation === 'bidcos'))) {
                    valveChan = c; valveDp = 'VALVE_STATE'; break;
                }
            }
        }
        if (!valveDp) {
            for (const c of channels) {
                if (c.dps.has('LEVEL')) { valveChan = c; valveDp = 'LEVEL'; }
            }
        }
        const isTRV = valveDp !== null;
        const valveMeta = isTRV ? meta(valveChan, valveDp) : undefined;
        const valveMax = (valveMeta && valveMeta.max != null) ? valveMeta.max
            : (valveDp === 'LEVEL' ? 1 : 100);
        const valveMin = (valveMeta && valveMeta.min != null) ? valveMeta.min : 0;

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
            // B54: device-reported boost active state — stamped for BOTH
            // generations (BidCoS CONTROL_MODE=3 also detects boost; the state
            // topic is harmless redundancy there, decisive on HmIP where
            // SET_POINT_MODE keeps reporting Manu during boost).
            boost_state_topic: hmStatus(p, readSeg, 'BOOST_MODE'),
            message_property_boost_state: 'payload.val',
            valve_min: valveMin,
            valve_max: valveMax,
        };
        if (isTRV) config.action_topic = hmStatus(p, valveChan.seg, valveDp);
        // Mode WRITE topic (→ publish-mode). HmIP writes the mode via CONTROL_MODE;
        // BidCoS has no single mode-write datapoint (its per-entry `modes` publishes
        // handle it), so publish-mode stays unset there.
        if (generation === 'hmip') config.mode_command_topic = hmSet(p, writeSeg, 'CONTROL_MODE');

        // Availability (:0 UNREACH) + battery (:0 LOWBAT/LOW_BAT) are resolved at
        // READ time (B65) via the device→:0 maintenance index — the :0 segment
        // can't always be string-derived from a custom-named channel. Store the
        // inputs; applyHmAvailability() builds the config keys on read.
        const availBase = readSeg !== '' ? readSeg : (control.channelAddr || readSeg);

        // Device-level discovery_id → one entry per physical device; re-promotes
        // (updates) as more datapoints arrive.
        return {
            discovery_id: 'hm-climate:' + deviceId,
            component: 'climate',
            source: 'homematic',
            sourceLabel: 'hm',
            name,
            config,
            _availResolve: {deviceId, availBase, batteryDp: dev.batteryDp || null},
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
        // hm/status/<seg>/STATE — the state datapoint; plus the :0 battery
        // datapoints (E124 presence check: LOWBAT BidCoS / LOW_BAT HmIP).
        if (!topic.startsWith(hmPrefix + '/status/')) return null;
        const parts = topic.split('/');
        if (parts.length !== 4) return null;            // exactly prefix/status/seg/DP
        if (parts[3] !== 'STATE' && !HM_BATTERY_DPS.has(parts[3])) return null;
        return {seg: parts[2], datapoint: parts[3]};
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
            dev = {deviceId, deviceName: undefined, deviceType: undefined,
                channels: new Map(), batteryDp: undefined};
            state.devices.set(deviceId, dev);
        }
        if (hm) {
            if (hm.deviceName != null) dev.deviceName = hm.deviceName;
            if (hm.deviceType != null) dev.deviceType = hm.deviceType;
        }

        // E124: remember WHICH battery datapoint this device publishes on :0
        // (fixes the HmIP LOW_BAT-never-read bug — only LOWBAT was known).
        if (HM_BATTERY_DPS.has(parsed.datapoint) && /:0$/.test(parsed.seg)) {
            dev.batteryDp = parsed.datapoint;
        }
        if (parsed.datapoint !== 'STATE') return dev;

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

        // Availability (:0 UNREACH) + battery resolved at READ time (B65) via the
        // device→:0 maintenance index. E124: UNREACH is the SOLE availability
        // source; a weak battery is a dedicated warning, not a blackout.
        const availBase = seg !== '' ? seg : (contact.channelAddr || seg);

        return {
            discovery_id: 'hm-contact:' + deviceId,
            component: 'binary_sensor',
            source: 'homematic',
            sourceLabel: 'hm',
            name,
            config,
            _availResolve: {deviceId, availBase, batteryDp: dev.batteryDp || null},
        };
    },

    reset() { this.state.devices.clear(); },
};

// ── Recognizer 4: Homematic cover ─────────────────────────────────────────────
// Blind / shutter actuators. Two dialects, gated on the CCU channelType metadata
// (LEVEL alone is not evidence — dimmers and TRV valves report LEVEL too), so a
// channel with absent/unlisted channelType is NOT promoted:
//
//   BidCoS  BLIND                  — one physical output = ONE BLIND channel;
//                                    each such channel → one cover entity.
//   HmIP    BLIND_VIRTUAL_RECEIVER — a blind/shutter actuator lays out each output
//                                    as a BLIND_TRANSMITTER channel followed by 3
//                                    BLIND_VIRTUAL_RECEIVER channels; the output is
//                                    the FIRST virtual receiver (transmitter+1).
//                                    The transmitter gaps split the virtual
//                                    receivers into one consecutive-index RUN per
//                                    output, so we wire the cover to the first of
//                                    each run (hmipVirtualGroup). The discovery_id
//                                    is keyed on the leader's channelIndex (…:c14),
//                                    stable regardless of the retained burst's
//                                    (name-sorted) arrival order; superseded
//                                    run-leaders are dropped at read time.
//
// Position is Homematic LEVEL (0.0–1.0): the entity ships position_min 0 /
// position_max 1 so the client element scales it to 0–100 % (max=1, no server
// scaling). STOP is a write-only datapoint, so it is not part of the match; it is
// simply constructed as the stop_command_topic.
const COVER_BIDCOS_TYPES = new Set(['BLIND']);            // single channel, any index
const COVER_HMIP_TYPES = new Set(['BLIND_VIRTUAL_RECEIVER']); // transmitter-gap runs, output = first of run

// Shared HmIP virtual-receiver grouping (used by cover BLIND_VIRTUAL_RECEIVER,
// light DIMMER_VIRTUAL_RECEIVER and switch SWITCH_VIRTUAL_RECEIVER). Each physical
// output is a *_TRANSMITTER channel followed by three *_VIRTUAL_RECEIVER channels;
// the output is the FIRST virtual receiver (transmitter+1). The transmitter gaps
// split the virtual receivers into one consecutive-index RUN per output, so the
// output is the first channel of the given channel's run. Returns that leader +
// a per-output ordinal, computed against the FULL current sorted set of that
// channelType so the retained-message burst converges to a stable per-group id.
function hmipVirtualGroup(dev, chan, channelType) {
    const vr = [...dev.channels.values()]
        .filter(c => c.channelType === channelType && c.channelIndex != null)
        .sort((a, b) => a.channelIndex - b.channelIndex);
    const pos = vr.indexOf(chan);
    if (pos < 0) return null;
    // B64: each physical output on an HmIP actuator is a *_TRANSMITTER channel
    // followed by THREE consecutive *_VIRTUAL_RECEIVER channels; the
    // controllable output is the FIRST virtual receiver (transmitter+1). The
    // transmitter is a different channelType (absent from `vr`), so its index
    // gap splits the virtual receivers into one consecutive-index RUN per
    // output. The output/leader is therefore the first channel of chan's run.
    // This is device-agnostic — it absorbs the per-device base index and the
    // step-4 block layout (RedMatic-HomeKit: BLIND_ base 2, SWITCH_ DRSI4 base
    // 6 / OC8 base 10, all step 4) with NO per-device table — and replaces the
    // earlier position-chunk-of-3, which mis-aligned whenever the virtual
    // receivers didn't start at a clean multiple of 3 (the OC8 B64 bug).
    let start = pos;
    while (start > 0 && vr[start - 1].channelIndex === vr[start].channelIndex - 1) start--;
    // Stable per-output ordinal: number of run boundaries before `start`.
    let groupIndex = 0;
    for (let i = 1; i <= start; i++) {
        if (vr[i].channelIndex !== vr[i - 1].channelIndex + 1) groupIndex++;
    }
    return {leader: vr[start], groupIndex};
}

const hmCoverRecognizer = {
    id: 'homematic-cover',
    // deviceId → {deviceId, deviceName, deviceType, channels: Map<seg, chan>}
    // chan = {seg, channelType, channelIndex, channelAddr, channelName}
    state: {devices: new Map()},

    match(topic) {
        // hm/status/<seg>/LEVEL — LEVEL only (whitelisted DP; STOP is write-only).
        if (!topic.startsWith(hmPrefix + '/status/')) return null;
        const parts = topic.split('/');
        if (parts.length !== 4) return null;            // exactly prefix/status/seg/DP
        if (parts[3] !== 'LEVEL') return null;
        return {seg: parts[2], datapoint: 'LEVEL'};
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
            chan = {seg: parsed.seg, channelType: undefined, channelIndex: undefined,
                channelAddr: undefined, channelName: undefined};
            dev.channels.set(parsed.seg, chan);
        }
        if (hm) {
            if (hm.channelType != null) chan.channelType = hm.channelType;
            if (hm.channelIndex != null) chan.channelIndex = hm.channelIndex;
            if (hm.channel != null) chan.channelAddr = hm.channel;
            if (hm.channelName != null) chan.channelName = hm.channelName;
        }
        // Carry the just-updated channel so promote emits THIS channel's cover /
        // its HmIP group (a device can hold several independent covers).
        return {dev, chan};
    },

    _build(dev, chan, discoveryId, name) {
        const p = hmPrefix;
        const readSeg = chan.seg;
        // Write/stop topics use the segment when non-empty, else the channel
        // address (nameless device) — mirrors the climate/contact recognizers.
        const writeSeg = chan.seg !== '' ? chan.seg : (chan.channelAddr || chan.seg);

        const config = {
            name,
            // Homematic is SEPARATE mode — position goes to the separate-mode attrs.
            payload_mode: 'separate',
            position_state_topic:   hmStatus(p, readSeg, 'LEVEL'),
            position_command_topic: hmSet(p, writeSeg, 'LEVEL'),
            stop_command_topic:     hmSet(p, writeSeg, 'STOP'),
            // E120: Up/Down buttons — full open/close via the SAME LEVEL set
            // topic (LEVEL is 0.0–1.0: 1 = fully open, 0 = fully closed).
            // Without these the discovered cover's Up/Down buttons published
            // nowhere. The payloads double as command values only — Homematic
            // state is position-based, so the elements' state_open/state_closed
            // interpretation of payload-up/-down is never exercised here.
            open_command_topic:  hmSet(p, writeSeg, 'LEVEL'),
            close_command_topic: hmSet(p, writeSeg, 'LEVEL'),
            payload_open:  '1',
            payload_close: '0',
            // LEVEL is 0.0–1.0 → the client scales max=1 to 0–100 % (no server scaling).
            position_min: 0,
            position_max: 1,
            // MQTT-Smarthome JSON-Extended: the value lives at payload.val.
            message_property: 'payload.val',
            message_property_position: 'payload.val',
        };

        // Availability (:0 UNREACH) resolved at READ time (B65) via the
        // device→:0 maintenance index. Covers carry no battery entry (mains).
        const availBase = readSeg !== '' ? readSeg : (chan.channelAddr || readSeg);

        return {
            discovery_id: discoveryId,
            component: 'cover',
            source: 'homematic',
            sourceLabel: 'hm',
            name,
            config,
            _availResolve: {deviceId: dev.deviceId, availBase, batteryDp: null},
        };
    },

    promote(state) {
        const {dev, chan} = state;
        // channelType absent/unlisted ⇒ cannot know the group structure ⇒ no
        // promotion (covers need the metadata; see the group-of-3 note above).
        if (!chan.channelType) return null;

        if (COVER_BIDCOS_TYPES.has(chan.channelType)) {
            // One BLIND channel = one cover. Prefer the channel's own name so
            // sibling blinds on one device stay distinct.
            const id = 'hm-cover:' + (chan.channelAddr || chan.seg);
            const name = chan.channelName || dev.deviceName
                || (dev.deviceType ? dev.deviceType + ' ' + dev.deviceId : dev.deviceId);
            return this._build(dev, chan, id, name);
        }

        if (COVER_HMIP_TYPES.has(chan.channelType)) {
            const grp = hmipVirtualGroup(dev, chan, 'BLIND_VIRTUAL_RECEIVER');
            if (!grp) return null;
            const {leader, groupIndex} = grp;
            // Stable per-output id keyed on the LEADER's channel index (…:c14),
            // NOT the run ordinal: retained bursts arrive name-sorted (not index-
            // sorted), so an ordinal would shift and drop outputs (B64).
            const id = 'hm-cover:' + dev.deviceId + ':c' + leader.channelIndex;
            // Prefer a distinct leader channel name; else deviceName + group number.
            const name = (leader.channelName && leader.channelName !== dev.deviceName)
                ? leader.channelName
                : ((dev.deviceName
                    || (dev.deviceType ? dev.deviceType + ' ' + dev.deviceId : dev.deviceId))
                    + ' ' + (groupIndex + 1));
            const entity = this._build(dev, leader, id, name);
            entity._hmGroup = {recognizerId: this.id, deviceId: dev.deviceId, channelType: chan.channelType, leaderIndex: leader.channelIndex};
            return entity;
        }

        return null;
    },

    reset() { this.state.devices.clear(); },
};

// ── Recognizer 5: Homematic light (dimmer) ────────────────────────────────────
// Dimmable-light actuators. Two dialects, gated on the CCU channelType metadata
// (LEVEL alone is not evidence — covers and TRV valves report LEVEL too), so a
// channel with absent/unlisted channelType is NOT promoted:
//
//   BidCoS  DIMMER                  — one physical output = ONE DIMMER channel
//                                     (the channel number varies per device, so
//                                     we key off the channelType, not the index);
//                                     each such channel → one light entity.
//   HmIP    DIMMER_VIRTUAL_RECEIVER — a dimmer actuator lays out each output as a
//                                     DIMMER_TRANSMITTER channel + 3 DIMMER_VIRTUAL_
//                                     RECEIVER channels; the output is the first
//                                     virtual receiver (transmitter+1). We reuse
//                                     hmipVirtualGroup() to wire the light to the
//                                     first of each transmitter-gap run; the
//                                     discovery_id is keyed on the leader's
//                                     channelIndex (order-independent, stale
//                                     run-leaders dropped at read time).
//
// Homematic dimmers have NO on/off datapoint — on/off is derived from the level
// (on-off-source=brightness). Brightness is Homematic LEVEL (0.0–1.0): the entity
// ships brightness_min 0 / brightness_scale 1 so the client element treats max=1
// (feezal's internal 0–100 % scales to 0…1, no server scaling).
const LIGHT_BIDCOS_TYPES = new Set(['DIMMER']);                    // single channel, any index
const LIGHT_HMIP_TYPES = new Set(['DIMMER_VIRTUAL_RECEIVER']);     // transmitter-gap runs, output = first of run

const hmLightRecognizer = {
    id: 'homematic-light',
    // deviceId → {deviceId, deviceName, deviceType, channels: Map<seg, chan>}
    // chan = {seg, channelType, channelIndex, channelAddr, channelName}
    state: {devices: new Map()},

    match(topic) {
        // hm/status/<seg>/LEVEL — LEVEL only. Covers + climate also match LEVEL;
        // each recognizer independently gates on its own channelType, so a
        // DIMMER's LEVEL only promotes here.
        // E127: WORKING and LEVEL_NOTWORKING (RedMatic) are additionally
        // OBSERVED — never promoted on their own, but their presence makes the
        // emitted config wire the ramp-settling attributes. No blind guessing:
        // only topics actually seen on the broker are wired.
        if (!topic.startsWith(hmPrefix + '/status/')) return null;
        const parts = topic.split('/');
        if (parts.length !== 4) return null;            // exactly prefix/status/seg/DP
        if (parts[3] !== 'LEVEL' && parts[3] !== 'WORKING' && parts[3] !== 'LEVEL_NOTWORKING') return null;
        return {seg: parts[2], datapoint: parts[3]};
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
            chan = {seg: parsed.seg, channelType: undefined, channelIndex: undefined,
                channelAddr: undefined, channelName: undefined,
                hasWorking: false, hasNotWorking: false};
            dev.channels.set(parsed.seg, chan);
        }
        if (hm) {
            if (hm.channelType != null) chan.channelType = hm.channelType;
            if (hm.channelIndex != null) chan.channelIndex = hm.channelIndex;
            if (hm.channel != null) chan.channelAddr = hm.channel;
            if (hm.channelName != null) chan.channelName = hm.channelName;
        }
        // E127: remember which settling topics this channel actually publishes.
        if (parsed.datapoint === 'WORKING') chan.hasWorking = true;
        if (parsed.datapoint === 'LEVEL_NOTWORKING') chan.hasNotWorking = true;
        // Carry the just-updated channel so promote emits THIS channel's light /
        // its HmIP group (a device can hold several independent dimmers).
        return {dev, chan};
    },

    _build(dev, chan, discoveryId, name) {
        const p = hmPrefix;
        const readSeg = chan.seg;
        // Write topics use the segment when non-empty, else the channel address
        // (nameless device) — mirrors the cover/climate/contact recognizers.
        const writeSeg = chan.seg !== '' ? chan.seg : (chan.channelAddr || chan.seg);

        const config = {
            name,
            // Homematic is SEPARATE mode — brightness goes to the separate-mode attrs.
            payload_mode: 'separate',
            brightness_state_topic:   hmStatus(p, readSeg, 'LEVEL'),
            brightness_command_topic: hmSet(p, writeSeg, 'LEVEL'),
            // LEVEL is 0.0–1.0 → the client treats max=1 (feezal 0–100 % scales to
            // 0…1, no server scaling). brightness_scale → brightness-max.
            brightness_min: 0,
            brightness_scale: 1,
            // Homematic dimmers have no on/off datapoint — derive on/off from level.
            on_off_source: 'brightness',
            payload_off: '0',                     // LEVEL 0 = off
            // Homematic OLD_LEVEL restore convention: publishing 1.005 to LEVEL
            // restores the last non-zero level on toggle-on. ASSUMED / device-
            // specific — a plain '1' (full-on) is the alternative if a device
            // doesn't honour the OLD_LEVEL sentinel.
            payload_on: '1.005',
            // Plain dimmer, no colour. supported_color_modes → mode via colorMode
            // transform yields 'brightness' (reuses the existing map key, no new
            // key needed).
            supported_color_modes: ['brightness'],
            // MQTT-Smarthome JSON-Extended: the value lives at payload.val. Each
            // per-topic twin is stamped too — the per-read paths don't fall back
            // to the element-level one (their default 'payload' is truthy).
            message_property: 'payload.val',
            message_property_brightness: 'payload.val',
            message_property_state: 'payload.val',
        };

        // E127: ramp settling — wire only topics actually observed on the broker.
        // WORKING gates report suppression; LEVEL_NOTWORKING (RedMatic) carries
        // settled values only and takes over the slider, LEVEL stays the live
        // readout. Both may be present; the element handles either or both.
        if (chan.hasWorking) {
            config.working_topic = hmStatus(p, readSeg, 'WORKING');
            config.message_property_working = 'payload.val';
        }
        if (chan.hasNotWorking) {
            config.settled_topic = hmStatus(p, readSeg, 'LEVEL_NOTWORKING');
            config.message_property_settled = 'payload.val';
        }

        // Availability (:0 UNREACH) resolved at READ time (B65) via the
        // device→:0 maintenance index. Dimmers carry no battery entry (mains).
        const availBase = readSeg !== '' ? readSeg : (chan.channelAddr || readSeg);

        return {
            discovery_id: discoveryId,
            component: 'light',
            source: 'homematic',
            sourceLabel: 'hm',
            name,
            config,
            _availResolve: {deviceId: dev.deviceId, availBase, batteryDp: null},
        };
    },

    promote(state) {
        const {dev, chan} = state;
        // channelType absent/unlisted ⇒ cannot know the group structure ⇒ no
        // promotion (dimmers need the metadata; see the group-of-3 note above).
        if (!chan.channelType) return null;

        if (LIGHT_BIDCOS_TYPES.has(chan.channelType)) {
            // One DIMMER channel = one light. Prefer the channel's own name so
            // sibling dimmers on one device stay distinct.
            const id = 'hm-light:' + (chan.channelAddr || chan.seg);
            const name = chan.channelName || dev.deviceName
                || (dev.deviceType ? dev.deviceType + ' ' + dev.deviceId : dev.deviceId);
            return this._build(dev, chan, id, name);
        }

        if (LIGHT_HMIP_TYPES.has(chan.channelType)) {
            const grp = hmipVirtualGroup(dev, chan, 'DIMMER_VIRTUAL_RECEIVER');
            if (!grp) return null;
            const {leader, groupIndex} = grp;
            // Stable per-output id keyed on the LEADER's channel index (B64) —
            // see the cover recognizer for why an ordinal drops outputs.
            const id = 'hm-light:' + dev.deviceId + ':c' + leader.channelIndex;
            const name = (leader.channelName && leader.channelName !== dev.deviceName)
                ? leader.channelName
                : ((dev.deviceName
                    || (dev.deviceType ? dev.deviceType + ' ' + dev.deviceId : dev.deviceId))
                    + ' ' + (groupIndex + 1));
            const entity = this._build(dev, leader, id, name);
            entity._hmGroup = {recognizerId: this.id, deviceId: dev.deviceId, channelType: chan.channelType, leaderIndex: leader.channelIndex};
            return entity;
        }

        return null;
    },

    reset() { this.state.devices.clear(); },
};

// ── Recognizer 6: Homematic switch (name word-list heuristic, E126) ──────────
// Switch actuators. A Homematic installation exposes tremendous numbers of
// irrelevant switch datapoints (unused actuator channels, virtual triples) —
// promoting them all would bury the discovered-device list. Two gates:
//
//   1. channelType  — SWITCH (BidCoS; one channel = one output) or
//                     SWITCH_VIRTUAL_RECEIVER (HmIP; each output = a
//                     SWITCH_TRANSMITTER channel + 3 virtual receivers, output =
//                     transmitter+1 — hmipVirtualGroup wires the first of each
//                     transmitter-gap run, same convention as blinds/dimmers).
//                     channelType absent ⇒ no promotion (framework rule).
//   2. channel name — users leave irrelevant channels UNNAMED (topic segment
//                     stays the CCU default, model+serial:idx), relevant ones
//                     get real names. Promote only when the name/segment
//                     contains a word from the lists below (case-insensitive
//                     substring). Light words WIN over switch words and
//                     classify the channel as an on/off LIGHT (E122 mode) —
//                     "Licht Terrasse" on a switch actuator is a lamp.
//
// Word lists are deliberately HARDCODED (decision 07/2026) — extend here.
const SWITCH_NAME_WORDS = ['steckdose', 'standby', 'plug', 'socket', 'outlet', 'schalter'];
const LIGHT_NAME_WORDS = ['light', 'licht', 'lamp', 'lampe', 'leuchte', 'beleuchtung', 'bulb', 'spot'];
const SWITCH_BIDCOS_TYPES = new Set(['SWITCH']);
const SWITCH_HMIP_TYPES = new Set(['SWITCH_VIRTUAL_RECEIVER']);

/** 'light' | 'switch' | null for a channel's user-visible naming. */
function switchNameClass(chan) {
    const hay = ((chan.channelName || '') + ' ' + (chan.seg || '')).toLowerCase();
    if (LIGHT_NAME_WORDS.some(w => hay.includes(w))) return 'light';
    if (SWITCH_NAME_WORDS.some(w => hay.includes(w))) return 'switch';
    return null;
}

const hmSwitchRecognizer = {
    id: 'homematic-switch',
    // deviceId → {deviceId, deviceName, deviceType, channels: Map<seg, chan>}
    // chan = {seg, channelType, channelIndex, channelAddr, channelName}
    state: {devices: new Map()},

    match(topic) {
        // hm/status/<seg>/STATE — STATE only. Contacts also match STATE; each
        // recognizer independently gates on its own channelType.
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
            chan = {seg: parsed.seg, channelType: undefined, channelIndex: undefined,
                channelAddr: undefined, channelName: undefined};
            dev.channels.set(parsed.seg, chan);
        }
        if (hm) {
            if (hm.channelType != null) chan.channelType = hm.channelType;
            if (hm.channelIndex != null) chan.channelIndex = hm.channelIndex;
            if (hm.channel != null) chan.channelAddr = hm.channel;
            if (hm.channelName != null) chan.channelName = hm.channelName;
        }
        // Carry the just-updated channel so promote emits THIS channel's
        // switch / its HmIP group (a device can hold several outputs).
        return {dev, chan};
    },

    _build(dev, chan, discoveryId, name, component) {
        const p = hmPrefix;
        const readSeg = chan.seg;
        // Write topics use the segment when non-empty, else the channel address
        // (nameless device) — mirrors the other recognizers.
        const writeSeg = chan.seg !== '' ? chan.seg : (chan.channelAddr || chan.seg);

        // STATE is boolean, read/write. 'true'/'false' payloads: the element's
        // payload matching handles the BidCoS boolean via string comparison,
        // and hm2mqtt coerces the published string back to a boolean.
        const common = {
            name,
            payload_on: 'true',
            payload_off: 'false',
        };

        const config = component === 'light'
            ? {
                ...common,
                // Relay lamp → light in E122's switch-only mode: no brightness
                // ring, the centre power button toggles STATE.
                payload_mode: 'separate',
                state_topic: hmStatus(p, readSeg, 'STATE'),          // → subscribe (state fallback)
                state_command_topic: hmSet(p, writeSeg, 'STATE'),    // → publish-state
                supported_color_modes: ['onoff'],                    // → mode on_off (colorMode map)
                message_property: 'payload.val',
                message_property_state: 'payload.val',
            }
            : {
                ...common,
                state_topic: hmStatus(p, readSeg, 'STATE'),
                command_topic: hmSet(p, writeSeg, 'STATE'),
                // → message-property payload.val via valueTemplateToPath
                value_template: '{{ value_json.val }}',
            };

        // Availability (:0 UNREACH) resolved at READ time (B65) via the
        // device→:0 maintenance index. Switch actuators are mains — UNREACH only.
        const availBase = readSeg !== '' ? readSeg : (chan.channelAddr || readSeg);

        return {
            discovery_id: discoveryId,
            component,
            source: 'homematic',
            sourceLabel: 'hm',
            name,
            config,
            _availResolve: {deviceId: dev.deviceId, availBase, batteryDp: null},
        };
    },

    promote(state) {
        const {dev, chan} = state;
        // channelType absent/unlisted ⇒ cannot classify ⇒ no promotion.
        if (!chan.channelType) return null;

        if (SWITCH_BIDCOS_TYPES.has(chan.channelType)) {
            const component = switchNameClass(chan);
            if (!component) return null;                 // unnamed/unmatched — not promoted
            const id = 'hm-switch:' + (chan.channelAddr || chan.seg);
            const name = chan.channelName || dev.deviceName
                || (dev.deviceType ? dev.deviceType + ' ' + dev.deviceId : dev.deviceId);
            return this._build(dev, chan, id, name, component);
        }

        if (SWITCH_HMIP_TYPES.has(chan.channelType)) {
            const grp = hmipVirtualGroup(dev, chan, 'SWITCH_VIRTUAL_RECEIVER');
            if (!grp) return null;
            const {leader, groupIndex} = grp;
            const component = switchNameClass(leader);
            if (!component) return null;                 // leader unnamed/unmatched
            // Stable per-output id keyed on the LEADER's channel index (B64) —
            // an ordinal shifts under name-sorted retained bursts and drops outputs.
            const id = 'hm-switch:' + dev.deviceId + ':c' + leader.channelIndex;
            const name = (leader.channelName && leader.channelName !== dev.deviceName)
                ? leader.channelName
                : ((dev.deviceName
                    || (dev.deviceType ? dev.deviceType + ' ' + dev.deviceId : dev.deviceId))
                    + ' ' + (groupIndex + 1));
            const entity = this._build(dev, leader, id, name, component);
            entity._hmGroup = {recognizerId: this.id, deviceId: dev.deviceId, channelType: chan.channelType, leaderIndex: leader.channelIndex};
            return entity;
        }

        return null;
    },

    reset() { this.state.devices.clear(); },
};

// ── Recognizer 7: Homematic boolean sensors (E131 motion; E132 hazard classes) ─
// Motion / water / smoke detectors — one recognizer, a channelType→class
// table (the E132 "decide by uniformity" decision: the datapoints ARE uniform
// enough — one boolean state datapoint per channel). Gated on the CCU
// channelType metadata like every recognizer (absent ⇒ no promotion).
//
// Verification status per entry (allowlist gating is safe-by-construction —
// an unverified name can only MISS a device, never false-positive):
//   MOTION_DETECTOR            BidCoS motion (HM-Sec-MDIR) — CONFIRMED (user)
//   MOTIONDETECTOR_TRANSCEIVER HmIP motion (SMI/SMO) — best-knowledge naming,
//                              verify against a real device's hm metadata
//   WATER_DETECTION_TRANSMITTER HmIP water (SWD) — best-knowledge, verify
//   SMOKE_DETECTOR             BidCoS smoke (HM-Sec-SD, STATE bool) — best-
//                              knowledge, verify (HmIP SWSD reports an ALARM
//                              STATUS enum — deliberately NOT wired yet)
//
// The state datapoint candidates are listed per class in preference order;
// the first one actually OBSERVED on the channel is wired. device_class is
// emitted HA-shaped (motion/moisture/smoke) so the elements' shared
// device_class→type valueMap treats z2m and Homematic identically (E132).
const HM_SENSOR_CLASSES = {
    MOTION_DETECTOR:               {deviceClass: 'motion',   dps: ['MOTION']},
    MOTIONDETECTOR_TRANSCEIVER:    {deviceClass: 'motion',   dps: ['MOTION']},
    WATER_DETECTION_TRANSMITTER:   {deviceClass: 'moisture', dps: ['ALARMSTATE', 'WATERLEVEL_DETECTED', 'MOISTURE_DETECTED']},
    SMOKE_DETECTOR:                {deviceClass: 'smoke',    dps: ['STATE']},
};
const HM_SENSOR_DPS = new Set(Object.values(HM_SENSOR_CLASSES).flatMap(c => c.dps));
// E124: battery datapoints on the :0 maintenance channel — OBSERVED, never
// constructed (mains devices must not grow a dead battery slot). Both
// generation names: LOWBAT (BidCoS) and LOW_BAT (HmIP).
const HM_BATTERY_DPS = new Set(['LOWBAT', 'LOW_BAT']);

const hmSensorRecognizer = {
    id: 'homematic-sensor',
    // deviceId → {deviceId, deviceName, deviceType, channels: Map<seg, chan>,
    //             batteryDp: 'LOWBAT'|'LOW_BAT'|undefined}
    // chan = {seg, channelType, channelAddr, channelName, dps:Set}
    state: {devices: new Map()},

    match(topic) {
        // hm/status/<seg>/<DP> — state datapoints of the class table, plus the
        // :0 battery datapoints (observed for the E124 presence check). The
        // whitelist keeps HmIP extras like ILLUMINATION from ever confusing
        // the match.
        if (!topic.startsWith(hmPrefix + '/status/')) return null;
        const parts = topic.split('/');
        if (parts.length !== 4) return null;            // exactly prefix/status/seg/DP
        const datapoint = parts[3];
        if (!HM_SENSOR_DPS.has(datapoint) && !HM_BATTERY_DPS.has(datapoint)) return null;
        return {seg: parts[2], datapoint};
    },

    accumulate(state, parsed, value, payload) {
        const hm = (payload && typeof payload === 'object' && payload.hm && typeof payload.hm === 'object')
            ? payload.hm : null;

        const deviceId = (hm && hm.device) ? String(hm.device)
            : parsed.seg.replace(/:\d+$/, '');

        let dev = state.devices.get(deviceId);
        if (!dev) {
            dev = {deviceId, deviceName: undefined, deviceType: undefined,
                channels: new Map(), batteryDp: undefined};
            state.devices.set(deviceId, dev);
        }
        if (hm) {
            if (hm.deviceName != null) dev.deviceName = hm.deviceName;
            if (hm.deviceType != null) dev.deviceType = hm.deviceType;
        }

        // E124 presence check: remember WHICH battery datapoint this device
        // actually publishes (on its :0 channel) — the promoted entity only
        // carries a battery record when one was seen.
        if (HM_BATTERY_DPS.has(parsed.datapoint) && /:0$/.test(parsed.seg)) {
            dev.batteryDp = parsed.datapoint;
        }

        let chan = dev.channels.get(parsed.seg);
        if (!chan) {
            chan = {seg: parsed.seg, channelType: undefined, channelAddr: undefined,
                channelName: undefined, dps: new Set()};
            dev.channels.set(parsed.seg, chan);
        }
        if (hm) {
            if (hm.channelType != null) chan.channelType = hm.channelType;
            if (hm.channel != null) chan.channelAddr = hm.channel;
            if (hm.channelName != null) chan.channelName = hm.channelName;
        }
        chan.dps.add(parsed.datapoint);
        return dev;
    },

    promote(dev) {
        const channels = [...dev.channels.values()];
        // The sensor channel: a known channelType from the class table with
        // its state datapoint actually observed (constructing blind would wire
        // topics that may not exist on this generation).
        let sensorChan = null;
        let cls = null;
        let stateDp = null;
        for (const c of channels) {
            const entry = c.channelType && HM_SENSOR_CLASSES[c.channelType];
            if (!entry) continue;
            const dp = entry.dps.find(d => c.dps.has(d));
            if (!dp) continue;
            sensorChan = c; cls = entry; stateDp = dp;
            break;
        }
        if (!sensorChan) return null;

        const p = hmPrefix;
        const seg = sensorChan.seg;
        const deviceId = dev.deviceId;
        const name = sensorChan.channelName || dev.deviceName
            || (dev.deviceType ? dev.deviceType + ' ' + deviceId : deviceId);

        const config = {
            name,
            state_topic: hmStatus(p, seg, stateDp),
            value_template: '{{ value_json.val }}',
            device_class: cls.deviceClass,
            // Boolean state — '1'/'0' with the elements' true↔1/false↔0
            // payload aliases, same convention as the contact recognizer.
            payload_on: '1',
            payload_off: '0',
        };

        // Availability (:0 UNREACH) + battery (:0 LOWBAT/LOW_BAT, presence-
        // checked) resolved at READ time (B65) via the device→:0 maintenance
        // index. E124: battery is a dedicated record, never folded into avail.
        const availBase = seg !== '' ? seg : (sensorChan.channelAddr || seg);

        return {
            discovery_id: 'hm-sensor:' + deviceId,
            component: 'binary_sensor',
            source: 'homematic',
            sourceLabel: 'hm',
            name,
            config,
            _availResolve: {deviceId, availBase, batteryDp: dev.batteryDp || null},
        };
    },

    reset() { this.state.devices.clear(); },
};

// ── Recognizer 8: Homematic lock (E144) ───────────────────────────────────────
// BidCoS Keymatic (HM-Sec-Key): channelType KEYMATIC (channel :1). STATE (bool)
// is the lock state + command; OPEN is a SEPARATE momentary "open the door"
// datapoint (releases the latch — distinct from unlock); ERROR is an enum
// (0 NO_ERROR / 1 CLUTCH_FAILURE / 2 MOTOR_ABORTED). Battery + availability come
// from the :0 maintenance index (B65). Gated on channelType (absent ⇒ no
// promotion). Sources: OpenCCU-Base rf_keymatic.xml.
//   ⚠ VERIFY on a real Keymatic: the STATE boolean polarity (below assumes
//     true = unlocked, false = locked). The card's payload-locked/unlocked make
//     it a one-attribute fix if reversed.
//   HmIP-DLD (DOOR_LOCK_TRANSCEIVER; LOCK_STATE / LOCK_TARGET_LEVEL enums) is NOT
//     wired yet — its enum values aren't in OpenCCU-Base's config and need real-
//     device confirmation before mapping (tracked in E144).
const LOCK_CHANNEL_TYPES = new Set(['KEYMATIC']);

const hmLockRecognizer = {
    id: 'homematic-lock',
    // deviceId → {deviceId, deviceName, deviceType, channels: Map<seg, chan>, batteryDp}
    // chan = {seg, channelType, channelAddr, hasError}
    state: {devices: new Map()},

    match(topic) {
        if (!topic.startsWith(hmPrefix + '/status/')) return null;
        const parts = topic.split('/');
        if (parts.length !== 4) return null;            // exactly prefix/status/seg/DP
        // STATE (lock state), ERROR (fault), plus the :0 battery presence check.
        if (parts[3] !== 'STATE' && parts[3] !== 'ERROR' && !HM_BATTERY_DPS.has(parts[3])) return null;
        return {seg: parts[2], datapoint: parts[3]};
    },

    accumulate(state, parsed, value, payload) {
        const hm = (payload && typeof payload === 'object' && payload.hm && typeof payload.hm === 'object')
            ? payload.hm : null;

        const deviceId = (hm && hm.device) ? String(hm.device)
            : parsed.seg.replace(/:\d+$/, '');

        let dev = state.devices.get(deviceId);
        if (!dev) {
            dev = {deviceId, deviceName: undefined, deviceType: undefined,
                channels: new Map(), batteryDp: undefined};
            state.devices.set(deviceId, dev);
        }
        if (hm) {
            if (hm.deviceName != null) dev.deviceName = hm.deviceName;
            if (hm.deviceType != null) dev.deviceType = hm.deviceType;
        }

        // E124 presence check: remember the observed :0 battery datapoint.
        if (HM_BATTERY_DPS.has(parsed.datapoint) && /:0$/.test(parsed.seg)) {
            dev.batteryDp = parsed.datapoint;
        }
        if (parsed.datapoint !== 'STATE' && parsed.datapoint !== 'ERROR') return dev;

        let chan = dev.channels.get(parsed.seg);
        if (!chan) {
            chan = {seg: parsed.seg, channelType: undefined, channelAddr: undefined, hasError: false};
            dev.channels.set(parsed.seg, chan);
        }
        if (hm) {
            if (hm.channelType != null) chan.channelType = hm.channelType;
            if (hm.channel != null) chan.channelAddr = hm.channel;
        }
        if (parsed.datapoint === 'ERROR') chan.hasError = true;
        return dev;
    },

    promote(dev) {
        const channels = [...dev.channels.values()];
        const lock = channels.find(c => c.channelType && LOCK_CHANNEL_TYPES.has(c.channelType));
        if (!lock) return null;

        const p = hmPrefix;
        const seg = lock.seg;
        const writeSeg = seg !== '' ? seg : (lock.channelAddr || seg);
        const deviceId = dev.deviceId;
        const name = dev.deviceName
            || (dev.deviceType ? dev.deviceType + ' ' + deviceId : deviceId);

        const config = {
            name,
            state_topic:    hmStatus(p, seg, 'STATE'),
            command_topic:  hmSet(p, writeSeg, 'STATE'),
            value_template: '{{ value_json.val }}',
            // ⚠ Keymatic STATE polarity — assumed true=unlocked / false=locked.
            state_locked:   'false',
            state_unlocked: 'true',
            payload_lock:   'false',
            payload_unlock: 'true',
            // Keymatic OPEN — separate momentary datapoint (door release).
            open_command_topic: hmSet(p, writeSeg, 'OPEN'),
            payload_open:   'true',
        };
        // E135: the ERROR enum topic (only when observed) → fault badge/text.
        if (lock.hasError) {
            config.error_topic = hmStatus(p, seg, 'ERROR');
            config.message_property_error = 'payload.val';
        }

        // Availability (:0 UNREACH) + battery (:0 LOWBAT) resolved at read time
        // (B65) via the device→:0 maintenance index.
        const availBase = seg !== '' ? seg : (lock.channelAddr || seg);

        return {
            discovery_id: 'hm-lock:' + deviceId,
            component: 'lock',
            source: 'homematic',
            sourceLabel: 'hm',
            name,
            config,
            _availResolve: {deviceId, availBase, batteryDp: dev.batteryDp || null},
        };
    },

    reset() { this.state.devices.clear(); },
};

// ── Recognizer 9: evcc (EV-charging / energy manager) ─────────────────────────
// E109. evcc (evcc.io) publishes a flat, retained MQTT tree with NO Home
// Assistant discovery, so a native recognizer is required. The root prefix is
// user-configurable (default `evcc`) — detect by STRUCTURE, not a literal
// prefix. Everything is flat scalars (message-property `payload`), the LWT is
// `<root>/status` (online/offline), and writes use a `/set` suffix.
//
// Two entity kinds per root: ONE `energy-flow` site entity (grid/pv/home/battery
// power + SoC, wired to material-energy-flow) and ONE `evcc-loadpoint` entity
// per loadpoint (the control surface — mode/limits/currents/phases). Vehicles
// are deferred (live SoC lives on the loadpoint, per the docs).
//
// Topic + sign facts confirmed against docs.evcc.io + evcc-io/evcc core/keys
// (07/2026): site `homePower`/`pvPower`/`grid/power`/`battery/power`/`battery/soc`;
// grid + = import; battery + = DISCHARGE (⚠ inverted vs. our flow element, hence
// invert_battery); a heating loadpoint carries `chargerFeature/heating: true` and
// reuses `vehicleSoc`/`limitSoc` as °C. All assembly lives in evccTopics() so a
// wrong assumption is a one-line fix (there is no local evcc to test against).

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

// ── Framework ─────────────────────────────────────────────────────────────────
const recognizers = [hmClimateRecognizer, wledRecognizer, hmContactRecognizer, hmCoverRecognizer, hmLightRecognizer, hmSwitchRecognizer, hmSensorRecognizer, hmLockRecognizer, evccRecognizer];

/** @type {Map<string, object>} discovery_id → promoted native entity */
const nativeEntities = new Map();

/** @type {Map<string, number>} discovery_id → newest datapoint ts (liveness),
 *  used by the read-time climate staleness filter in getNativeEntities(). */
const nativeEntityTs = new Map();

// ── B65: Homematic :0 maintenance-channel index ──────────────────────────────
// Availability (UNREACH) and battery live on a device's :0 MAINTENANCE channel.
// Its TOPIC segment cannot always be derived by string-transforming an output
// channel's segment: in RedMatic name-mode a custom-named output
// ("Steckdosen Werkstatt") shares NOTHING with the :0 segment
// ("OC8 Hobbyraum:0") except the CCU device id. So we index every device's :0
// segment from the firehose (keyed by hm.device) and resolve availability at
// READ time — once the whole retained burst has been seen (the :0 channel
// arrives in arbitrary order relative to the output channel). Falls back to the
// `:<idx>`→`:0` string transform for address/index-suffixed segments; null when
// neither resolves (⇒ availability is OMITTED, never wired to a dead topic).
const hmMaintSeg = new Map();   // deviceId → :0 maintenance topic segment

function indexMaintenance(topic, payload) {
    if (!payload || !payload.hm || payload.hm.device == null) return;
    if (!topic.startsWith(hmPrefix + '/status/')) return;
    const hm = payload.hm;
    if (hm.channelType !== 'MAINTENANCE' && hm.channelIndex !== 0) return;
    const parts = topic.split('/');
    if (parts.length !== 4) return;
    hmMaintSeg.set(String(hm.device), parts[2]);
}

/** Resolve a device's :0 maintenance topic segment: the observed segment from
 *  the index (authoritative, works for custom-named channels), else the
 *  `:<idx>`→`:0` string transform, else null. */
function resolveMaintSeg(deviceId, availBase) {
    if (deviceId != null) {
        const seg = hmMaintSeg.get(String(deviceId));
        if (seg != null) return seg;
    }
    if (/:\d+$/.test(availBase)) return availBase.replace(/:\d+$/, ':0');
    return null;
}

// B64: an HmIP-grouped entity (cover/light/switch) is emitted keyed on its run's
// leader channelIndex. Because retained bursts arrive out of index order, a
// channel briefly seen as a run-leader can later be superseded when a lower
// consecutive sibling arrives, leaving a STALE entity. At READ time we drop any
// grouped entity whose leader is no longer a genuine run-leader — i.e. a channel
// of the same type exists at leaderIndex-1 in the recognizer's accumulator.
function isStaleHmGroup(entity) {
    const g = entity && entity._hmGroup;
    if (!g) return false;
    const rec = recognizers.find(r => r.id === g.recognizerId);
    const dev = rec && rec.state.devices.get(g.deviceId);
    if (!dev) return false;
    for (const c of dev.channels.values()) {
        if (c.channelType === g.channelType && c.channelIndex === g.leaderIndex - 1) return true;
    }
    return false;
}

/** Build a native entity's availability + battery config from its stored
 *  `_availResolve` inputs, at READ time. Idempotent. */
function applyHmAvailability(entity) {
    const r = entity && entity._availResolve;
    if (!r) return entity;
    const p = hmPrefix;
    const availSeg = resolveMaintSeg(r.deviceId, r.availBase);
    if (availSeg == null) {
        delete entity.config.availability_normalized;
        delete entity.config.battery_low_normalized;
        return entity;
    }
    entity.config.availability_normalized = {
        entries: [{topic: hmStatus(p, availSeg, 'UNREACH'), property: 'payload.val'}],
        mode: 'all',
        payloadAvailable: false,
        payloadUnavailable: true,
    };
    if (r.batteryDp) {
        entity.config.battery_low_normalized = {
            topic: hmStatus(p, availSeg, r.batteryDp),
            property: 'payload.val',
            payloadLow: true,
        };
    } else {
        delete entity.config.battery_low_normalized;
    }
    return entity;
}

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
    // B65: index every device's :0 MAINTENANCE topic segment (keyed by
    // hm.device) so availability/battery can resolve the :0 channel at read
    // time even when output channels are custom-named (RedMatic name-mode).
    try { indexMaintenance(topic, parsePayload(payloadOrBuf)); } catch { /* ignore */ }

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
        if (entity && entity.discovery_id) {
            nativeEntities.set(entity.discovery_id, entity);
            // Stamp the device's newest ts for the read-time staleness filter.
            if (channelState && typeof channelState.lastTs === 'number') {
                nativeEntityTs.set(entity.discovery_id, channelState.lastTs);
            }
        }
    }
}

/** All promoted native entities, same shape as discovery.js entities. Climate
 *  entities older than the configured grace window are filtered out here (the
 *  ghost-topic filter); event-driven types are always kept. */
function getNativeEntities() {
    // B64: drop stale HmIP-group entities (superseded run-leaders). B65: resolve
    // :0 availability/battery now — the whole retained burst (incl. the :0
    // MAINTENANCE channel) has been seen by read time.
    const now = hmClimateStaleMs ? Date.now() : 0;
    return [...nativeEntities.values()]
        .filter(e => !isStaleHmGroup(e))
        .filter(e => {
            if (!hmClimateStaleMs || e.component !== 'climate') return true;
            const ts = nativeEntityTs.get(e.discovery_id);
            return !ts || (now - ts) <= hmClimateStaleMs;
        })
        .map(applyHmAvailability);
}

/** One promoted native entity by discovery_id, or null. */
function getNativeEntity(id) {
    const e = nativeEntities.get(id);
    if (!e || isStaleHmGroup(e)) return null;   // B64: skip superseded run-leaders
    return applyHmAvailability(e);               // B65: resolve :0 availability at read time
}

/** Clear promoted entities AND every recognizer's accumulator. */
function clearNativeEntities() {
    nativeEntities.clear();
    nativeEntityTs.clear();
    hmMaintSeg.clear();
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
    setHomematicClimateStaleMs,
    setHomematicClimateStale,
    // exported for tests / reuse
    extractValue,
    parsePayload,
    buildHmModes,
    recognizers,
};

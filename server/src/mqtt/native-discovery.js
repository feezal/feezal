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

// Staleness filter for CLIMATE ONLY. A thermostat publishes ACTUAL_TEMPERATURE
// every few minutes, so a live device's newest datapoint timestamp is always
// recent; a device whose newest `ts` is older than this is treated as a stale
// "ghost" (old RETAINED topics left behind by a replaced device that shared the
// name) and skipped. 7 days is far below any real ghost (months/years old) yet
// far above any live thermostat's reporting gap. NOT applied to contact/cover/
// light — those are event-driven and can be legitimately quiet. 0 disables it.
let hmClimateStaleMs = 7 * 24 * 60 * 60 * 1000;
function setHomematicClimateStaleMs(ms) { hmClimateStaleMs = Number(ms) || 0; }

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
                iface: undefined, channels: new Map(), lastTs: 0};
            state.devices.set(deviceId, dev);
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
        // Staleness filter: skip a "ghost" device (stale retained topics left by a
        // replaced device that shared the name). A live thermostat's newest ts is
        // always recent; only genuinely dead devices exceed hmClimateStaleMs.
        if (hmClimateStaleMs > 0 && dev.lastTs && (Date.now() - dev.lastTs) > hmClimateStaleMs) {
            return null;
        }
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

// ── Recognizer 4: Homematic cover ─────────────────────────────────────────────
// Blind / shutter actuators. Two dialects, gated on the CCU channelType metadata
// (LEVEL alone is not evidence — dimmers and TRV valves report LEVEL too), so a
// channel with absent/unlisted channelType is NOT promoted:
//
//   BidCoS  BLIND                  — one physical output = ONE BLIND channel;
//                                    each such channel → one cover entity.
//   HmIP    BLIND_VIRTUAL_RECEIVER — a blind/shutter actuator exposes its outputs
//                                    as virtual-receiver channels grouped in
//                                    consecutive TRIPLES (per the user's HmIP
//                                    virtual-receiver convention: 1 output = 3
//                                    channels). We sort the device's
//                                    BLIND_VIRTUAL_RECEIVER channels ascending by
//                                    channelIndex, chunk them into 3s, and wire
//                                    the cover to the FIRST (lowest-index) channel
//                                    of each triple. A 12-channel device → 4
//                                    covers. The discovery_id is STABLE per group
//                                    (…:g0/:g1/…) so the retained-message burst
//                                    can't leave stale duplicates as channels
//                                    arrive out of order.
//
// Position is Homematic LEVEL (0.0–1.0): the entity ships position_min 0 /
// position_max 1 so the client element scales it to 0–100 % (max=1, no server
// scaling). STOP is a write-only datapoint, so it is not part of the match; it is
// simply constructed as the stop_command_topic.
const COVER_BIDCOS_TYPES = new Set(['BLIND']);            // single channel, any index
const COVER_HMIP_TYPES = new Set(['BLIND_VIRTUAL_RECEIVER']); // grouped in 3s

// Shared HmIP virtual-receiver grouping (used by cover BLIND_VIRTUAL_RECEIVER and
// light DIMMER_VIRTUAL_RECEIVER). HmIP actuators expose each physical output as a
// consecutive TRIPLE of virtual-receiver channels (1 output = 3 channels). Given
// the just-updated channel, returns the triple's leader (its lowest-channelIndex
// member) + the group index, computed against the FULL current sorted set of that
// channelType so the retained-message burst converges to a stable per-group id.
function hmipVirtualGroup(dev, chan, channelType) {
    const vr = [...dev.channels.values()]
        .filter(c => c.channelType === channelType)
        .sort((a, b) => (a.channelIndex ?? 0) - (b.channelIndex ?? 0));
    const pos = vr.indexOf(chan);
    if (pos < 0) return null;
    const groupIndex = Math.floor(pos / 3);
    return {leader: vr[groupIndex * 3], groupIndex};
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

        // Availability from the device's :0 maintenance UNREACH datapoint. Covers
        // carry no LOWBAT entry (per the user) — UNREACH only.
        const availBase = readSeg !== '' ? readSeg : (chan.channelAddr || readSeg);
        const availSeg = availBase.replace(/:\d+$/, ':0');
        config.availability_normalized = {
            entries: [{topic: hmStatus(p, availSeg, 'UNREACH'), property: 'payload.val'}],
            mode: 'all',
            payloadAvailable: false,
            payloadUnavailable: true,
        };

        return {
            discovery_id: discoveryId,
            component: 'cover',
            source: 'homematic',
            sourceLabel: 'hm',
            name,
            config,
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
            // Stable per-group id (…:g0/:g1/…) keyed on the device + group index,
            // so re-emitting the leader as later channels arrive overwrites in place.
            const id = 'hm-cover:' + dev.deviceId + ':g' + groupIndex;
            // Prefer a distinct leader channel name; else deviceName + group number.
            const name = (leader.channelName && leader.channelName !== dev.deviceName)
                ? leader.channelName
                : ((dev.deviceName
                    || (dev.deviceType ? dev.deviceType + ' ' + dev.deviceId : dev.deviceId))
                    + ' ' + (groupIndex + 1));
            return this._build(dev, leader, id, name);
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
//   HmIP    DIMMER_VIRTUAL_RECEIVER — a dimmer actuator exposes its outputs as
//                                     virtual-receiver channels grouped in
//                                     consecutive TRIPLES (1 output = 3 channels,
//                                     the same HmIP convention as the blind
//                                     actuator). We reuse hmipVirtualGroup() to
//                                     sort ascending by channelIndex, chunk into
//                                     3s, and wire the light to the FIRST
//                                     (lowest-index) channel of each triple. A
//                                     6-channel device → 2 lights. The
//                                     discovery_id is STABLE per group (…:g0/:g1)
//                                     so the retained burst can't leave stale
//                                     duplicates as channels arrive out of order.
//
// Homematic dimmers have NO on/off datapoint — on/off is derived from the level
// (on-off-source=brightness). Brightness is Homematic LEVEL (0.0–1.0): the entity
// ships brightness_min 0 / brightness_scale 1 so the client element treats max=1
// (feezal's internal 0–100 % scales to 0…1, no server scaling).
const LIGHT_BIDCOS_TYPES = new Set(['DIMMER']);                    // single channel, any index
const LIGHT_HMIP_TYPES = new Set(['DIMMER_VIRTUAL_RECEIVER']);     // grouped in 3s

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

        // Availability from the device's :0 maintenance UNREACH datapoint. Dimmers
        // carry no LOWBAT entry (mains-powered) — UNREACH only, mirrors the cover.
        const availBase = readSeg !== '' ? readSeg : (chan.channelAddr || readSeg);
        const availSeg = availBase.replace(/:\d+$/, ':0');
        config.availability_normalized = {
            entries: [{topic: hmStatus(p, availSeg, 'UNREACH'), property: 'payload.val'}],
            mode: 'all',
            payloadAvailable: false,
            payloadUnavailable: true,
        };

        return {
            discovery_id: discoveryId,
            component: 'light',
            source: 'homematic',
            sourceLabel: 'hm',
            name,
            config,
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
            // Stable per-group id (…:g0/:g1/…) keyed on the device + group index,
            // so re-emitting the leader as later channels arrive overwrites in place.
            const id = 'hm-light:' + dev.deviceId + ':g' + groupIndex;
            const name = (leader.channelName && leader.channelName !== dev.deviceName)
                ? leader.channelName
                : ((dev.deviceName
                    || (dev.deviceType ? dev.deviceType + ' ' + dev.deviceId : dev.deviceId))
                    + ' ' + (groupIndex + 1));
            return this._build(dev, leader, id, name);
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
//                     SWITCH_VIRTUAL_RECEIVER (HmIP; outputs exposed as
//                     consecutive TRIPLES — reuse hmipVirtualGroup, same
//                     *_VIRTUAL_RECEIVER convention as blinds/dimmers).
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

        // Availability from the device's :0 maintenance UNREACH datapoint.
        // Switch actuators are mains-powered — UNREACH only, mirrors cover/light.
        const availBase = readSeg !== '' ? readSeg : (chan.channelAddr || readSeg);
        const availSeg = availBase.replace(/:\d+$/, ':0');
        config.availability_normalized = {
            entries: [{topic: hmStatus(p, availSeg, 'UNREACH'), property: 'payload.val'}],
            mode: 'all',
            payloadAvailable: false,
            payloadUnavailable: true,
        };

        return {
            discovery_id: discoveryId,
            component,
            source: 'homematic',
            sourceLabel: 'hm',
            name,
            config,
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
            // Stable per-group id (…:g0/:g1/…) so the retained burst overwrites
            // in place as channels arrive out of order.
            const id = 'hm-switch:' + dev.deviceId + ':g' + groupIndex;
            const name = (leader.channelName && leader.channelName !== dev.deviceName)
                ? leader.channelName
                : ((dev.deviceName
                    || (dev.deviceType ? dev.deviceType + ' ' + dev.deviceId : dev.deviceId))
                    + ' ' + (groupIndex + 1));
            return this._build(dev, leader, id, name, component);
        }

        return null;
    },

    reset() { this.state.devices.clear(); },
};

// ── Framework ─────────────────────────────────────────────────────────────────
const recognizers = [hmClimateRecognizer, wledRecognizer, hmContactRecognizer, hmCoverRecognizer, hmLightRecognizer, hmSwitchRecognizer];

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
    setHomematicClimateStaleMs,
    // exported for tests / reuse
    extractValue,
    parsePayload,
    buildHmModes,
    recognizers,
};

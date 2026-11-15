'use strict';

/**
 * CCU-Jack native recognizer (E145) — Homematic devices through ccu-jack's
 * MQTT server (github.com/mdzio/ccu-jack; topics and payloads read from its
 * wiki page "MQTT-Server" and mqtt/evtreceiver.go, version 2.13.0):
 *
 *   [<bridge prefix>/]device/status/<serial>/<channel>/<DATAPOINT>   retained
 *   [<bridge prefix>/]device/set/<serial>/<channel>/<DATAPOINT>      writes
 *
 * Payloads are VEAP objects `{"v": …, "ts": <ms>, "s": <state>}`; a write
 * takes a bare JSON value (`true`, `21.5`, `1`) as well as `{"v": …}`. A
 * bridged ccu-jack (MQTT.Bridge with a RemotePrefix) puts any prefix in front
 * of `device/`; the root is taken from the topic.
 *
 * ccu-jack publishes VALUES ONLY — no channel type, device type or names
 * (those exist only in its REST/VEAP tree, which feezal does not read: MQTT
 * only). The Homematic recognizers (recognizers/homematic.js) gate on the
 * channel type of RedMatic's `hm` block, so this recognizer infers the channel
 * type from the datapoint SIGNATURE of each channel where that signature is
 * unambiguous (verified against OpenCCU-Base), synthesizes the `hm` block, and
 * feeds its OWN instances of the Homematic climate / sensor / lock recognizers
 * — the same promotion logic, no parallel copy. Their output is translated
 * back: `<hm prefix>/status/<serial>:<ch>/<DP>` → `<root>/status/<serial>/<ch>/<DP>`
 * (and `set`), the value path `payload.val` → `payload.v`.
 *
 * Recognized (signature → channel type):
 *   SET_POINT_TEMPERATURE + SET_POINT_MODE → HEATING_CLIMATECONTROL_TRANSCEIVER (HmIP)
 *   SET_TEMPERATURE + CONTROL_MODE         → CLIMATECONTROL_RT_TRANSCEIVER (BidCoS)
 *   MOTION + BRIGHTNESS                    → MOTION_DETECTOR (BidCoS, rf_sec_mdir.xml)
 *   MOTION + ILLUMINATION | MOTION_DETECTION_ACTIVE → MOTIONDETECTOR_TRANSCEIVER (HmIP)
 *   STATE + STATE_UNCERTAIN                → KEYMATIC (rf_keymatic.xml)
 *   channel 0                              → MAINTENANCE (UNREACH, LOWBAT / LOW_BAT)
 * NOT recognized, because the values alone are ambiguous: contacts (STATE as
 * on a switch), switches (STATE; RedMatic's switch path also needs a channel
 * name, which ccu-jack does not publish), dimmers and covers (LEVEL on both,
 * and on HmIP valves), HmIP actuators (transmitter and virtual-receiver
 * channels publish the same datapoints). Those stay hand-wired.
 *
 * HmIP thermostat modes: RedMatic writes Off/Manu through a putParamset topic
 * ccu-jack does not have, so the modes are rebuilt from single datapoints —
 * Auto/Manu = CONTROL_MODE 0/1, Off = SET_POINT_TEMPERATURE 4.5, Boost =
 * BOOST_MODE true/false.
 *
 * Availability and battery come from channel 0 by address (`<serial>/0/UNREACH`,
 * `LOWBAT`/`LOW_BAT` when observed) — no name-mode correlation needed.
 *
 * Home Assistant discovery: ccu-jack announces NONE (no discovery code in its
 * source). The entities are climate / binary_sensor / lock — components
 * discovery can announce — so they claim their topics by the default rule
 * (discovery-merge.js): should another tool announce the same ccu-jack topics,
 * the announced copy is left out and its room taken over.
 */

const hm = require('./homematic');

const TOPIC = /^((?:.+\/)?device)\/status\/([^/]+)\/(\d+)\/([A-Za-z0-9_]+)$/;
const USED_IDS = ['homematic-climate', 'homematic-sensor', 'homematic-lock'];

/** Channel type from a channel's observed datapoints, or undefined. */
function inferChannelType(index, dps) {
    if (index === 0) return 'MAINTENANCE';
    if (dps.has('SET_POINT_TEMPERATURE') && dps.has('SET_POINT_MODE')) return 'HEATING_CLIMATECONTROL_TRANSCEIVER';
    if (dps.has('SET_TEMPERATURE') && dps.has('CONTROL_MODE')) return 'CLIMATECONTROL_RT_TRANSCEIVER';
    if (dps.has('MOTION') && dps.has('BRIGHTNESS')) return 'MOTION_DETECTOR';
    if (dps.has('MOTION') && (dps.has('ILLUMINATION') || dps.has('MOTION_DETECTION_ACTIVE'))) return 'MOTIONDETECTOR_TRANSCEIVER';
    if (dps.has('STATE') && dps.has('STATE_UNCERTAIN')) return 'KEYMATIC';
    return undefined;
}

/** Own instances of the Homematic recognizers (shared logic, separate state). */
function instances() {
    return hm.hmRecognizers.filter(r => USED_IDS.includes(r.id))
        .map(r => Object.assign(Object.create(r), {state: {devices: new Map()}}));
}

/** Rewrite one string of a promoted config from the hm shape to ccu-jack's. */
function translateString(s, roots) {
    const prefix = hm.getHomematicPrefix();
    if (s.startsWith(prefix + '/')) {
        const m = /^(status|set)\/([^/]+):(\d+)\/(.+)$/.exec(s.slice(prefix.length + 1));
        if (m) {
            const root = roots.get(m[2]) || 'device';
            return `${root}/${m[1]}/${m[2]}/${m[3]}/${m[4]}`;
        }
    }
    if (s === 'payload.val') return 'payload.v';
    return s.replace(/value_json\.val\b/g, 'value_json.v');
}

function translate(v, roots) {
    if (typeof v === 'string') return translateString(v, roots);
    if (Array.isArray(v)) return v.map(x => translate(x, roots));
    if (v && typeof v === 'object') {
        const out = {};
        for (const [k, x] of Object.entries(v)) out[k] = translate(x, roots);
        return out;
    }
    return v;
}

/** HmIP modes from single datapoints — ccu-jack has no putParamset topic. */
function hmipModes(root, serial, ch) {
    const set = dp => `${root}/set/${serial}/${ch}/${dp}`;
    return [
        {value: 0, label: 'Auto', publish: set('CONTROL_MODE'), payload: '0'},
        {value: 1, label: 'Manu', publish: set('CONTROL_MODE'), payload: '1'},
        {value: 1, label: 'Off', 'match-setpoint-max': 4.5, publish: set('SET_POINT_TEMPERATURE'), payload: '4.5'},
        {value: 3, label: 'Boost', momentary: true, publish: set('BOOST_MODE'), payload: 'true',
            off: {publish: set('BOOST_MODE'), payload: 'false'}},
    ];
}

const ccuJackRecognizer = {
    id: 'ccu-jack',
    // serial → {root, lastTs, channels: Map<index, {type, dps: Map<DP, {v, ts}>}>}; recs = own hm instances
    state: {devices: new Map(), roots: new Map(), recs: instances()},

    match(topic) {
        const m = TOPIC.exec(topic);
        if (!m) return null;
        return {root: m[1], serial: m[2], channel: Number(m[3]), datapoint: m[4]};
    },

    _feed(serial, index, dp, v, ts, type, out) {
        const prefix = hm.getHomematicPrefix();
        const seg = `${serial}:${index}`;
        const topic = `${prefix}/status/${seg}/${dp}`;
        const payload = {val: v, ts, hm: {device: serial, channel: seg, channelIndex: index,
            ...(type ? {channelType: type} : {})}};
        for (const rec of this.state.recs) {
            let parsed;
            try { parsed = rec.match(topic); } catch { parsed = null; }
            if (!parsed) continue;
            const cs = rec.accumulate(rec.state, parsed, v, payload);
            if (!cs) continue;
            const ent = rec.promote(cs);
            for (const e of Array.isArray(ent) ? ent : [ent]) if (e && e.discovery_id) out.set(e.discovery_id, e);
        }
    },

    accumulate(state, parsed, value, payload) {
        // VEAP: the value is `v`; a bare JSON value is taken as it is.
        const isVeap = payload && typeof payload === 'object' && 'v' in payload;
        const v = isVeap ? payload.v : value;
        const ts = isVeap && typeof payload.ts === 'number' ? payload.ts : undefined;

        state.roots.set(parsed.serial, parsed.root);
        let dev = state.devices.get(parsed.serial);
        if (!dev) { dev = {root: parsed.root, lastTs: 0, channels: new Map()}; state.devices.set(parsed.serial, dev); }
        dev.root = parsed.root;
        if (ts && ts > dev.lastTs) dev.lastTs = ts;
        let chan = dev.channels.get(parsed.channel);
        if (!chan) { chan = {type: undefined, dps: new Map()}; dev.channels.set(parsed.channel, chan); }
        chan.dps.set(parsed.datapoint, {v, ts});

        const out = new Map();
        const type = inferChannelType(parsed.channel, new Set(chan.dps.keys()));
        if (type && type !== chan.type) {
            // The signature just completed: replay the channel's datapoints with the type.
            chan.type = type;
            for (const [dp, rec] of chan.dps) this._feed(parsed.serial, parsed.channel, dp, rec.v, rec.ts, type, out);
        } else {
            this._feed(parsed.serial, parsed.channel, parsed.datapoint, v, ts, chan.type, out);
        }
        return {serial: parsed.serial, entities: [...out.values()], lastTs: dev.lastTs || undefined};
    },

    promote(cs) {
        return cs.entities.map(e => this._entity(cs.serial, e)).filter(Boolean);
    },

    /** One hm-shaped entity → the ccu-jack entity. */
    _entity(serial, e) {
        const dev = this.state.devices.get(serial);
        const root = dev ? dev.root : 'device';
        const avail = e._availResolve;
        const config = translate(e.config, this.state.roots);
        // HmIP thermostat: modes without putParamset (see the header).
        if (e.component === 'climate' && Array.isArray(e.config.modes)
            && e.config.modes.some(m => typeof m.publish === 'string' && /\/paramset\//.test(m.publish))) {
            const m = /\/status\/([^/]+)\/(\d+)\//.exec(config.temperature_state_topic || '');
            if (m) config.modes = hmipModes(root, m[1], m[2]);
        }
        // Availability + battery by address: channel 0 of the device.
        if (avail) {
            config.availability_normalized = {
                entries: [{topic: `${root}/status/${serial}/0/UNREACH`, property: 'payload.v'}],
                mode: 'all', payloadAvailable: false, payloadUnavailable: true,
            };
            if (avail.batteryDp) {
                config.battery_low_normalized = {topic: `${root}/status/${serial}/0/${avail.batteryDp}`,
                    property: 'payload.v', payloadLow: true};
            }
        }
        const out = {...e, discovery_id: 'ccu-jack:' + e.discovery_id, source: 'ccu-jack', sourceLabel: 'CCU-Jack', config};
        delete out._availResolve;   // resolved here; the RedMatic read-time path must not touch it
        delete out._hmGroup;
        return out;
    },

    reset() {
        this.state.devices.clear();
        this.state.roots.clear();
        for (const r of this.state.recs) r.reset();
    },
};

module.exports = {ccuJackRecognizer, inferChannelType};

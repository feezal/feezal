/**
 * Unit tests for mqtt/native-discovery.js — the E108 native self-discovery
 * recognizers (Homematic climate + WLED). Both native-discovery.js and
 * discovery.js keep process-global state, so each test clears first.
 *
 * The Homematic recognizer was rebuilt to consume the rich CCU metadata carried
 * in each MQTT-Smarthome JSON-Extended payload's `hm` object (device, deviceName,
 * channelType, datapointMin/Max, …) rather than guessing the channel from
 * datapoint signatures. These tests therefore feed REAL-shaped payloads with the
 * `hm` metadata, plus a metadata-less path exercising the datapoint fallback.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const nat = require('../src/mqtt/native-discovery.js');
const disc = require('../src/mqtt/discovery.js');

// MQTT-Smarthome "JSON Extended" payload buffer, optionally with the `hm`
// CCU-metadata object (as hm2mqtt / RedMatic emit it). `ts` defaults to "now" so
// climate entities pass the staleness filter; pass an old ts to exercise it.
const je = (val, hm, ts = Date.now()) => Buffer.from(JSON.stringify(hm ? {val, ts, lc: ts, hm} : {val, ts, lc: ts}));

// Metadata-less JSON-Extended (no `hm`) — the fallback signature path.
const jePlain = val => Buffer.from(JSON.stringify({val, ts: Date.now(), lc: 1}));

const byId = (list, id) => list.find(e => e.discovery_id === id) || null;

beforeEach(() => {
    nat.clearNativeEntities();
    disc.clearEntities();
});

describe('Homematic climate recognizer — HmIP wall thermostat (WTH-2)', () => {
    it('promotes one device-level entity from CCU metadata; groups sibling channels; no valve', () => {
        const dev = '000A9D89B67B42';
        const hmSetpoint = {
            device: dev, deviceName: 'Thermostat Hobbyraum', deviceType: 'HmIP-WTH-2',
            channel: dev + ':1', channelName: 'Thermostat Hobbyraum:1',
            channelType: 'HEATING_CLIMATECONTROL_TRANSCEIVER', channelIndex: 1, iface: 'HmIP-RF',
            datapoint: 'SET_POINT_TEMPERATURE', datapointMin: 4.5, datapointMax: 30.5,
        };

        // Setpoint alone (no mode datapoint message) — mode topic is CONSTRUCTED,
        // so this already completes: control channel known via channelType +
        // setpoint observed ⇒ generation HmIP.
        nat.handleNativeMessage('hm/status/Thermostat Hobbyraum:1/SET_POINT_TEMPERATURE', je(21, hmSetpoint));

        // An unrelated datapoint on ANOTHER channel of the SAME device — must not
        // spawn a second entity, must not become the control channel.
        nat.handleNativeMessage('hm/status/Thermostat Hobbyraum:0/HUMIDITY', je(48, {
            device: dev, deviceName: 'Thermostat Hobbyraum', deviceType: 'HmIP-WTH-2',
            channel: dev + ':0', channelName: 'Thermostat Hobbyraum:0',
            channelType: 'MAINTENANCE', channelIndex: 0, iface: 'HmIP-RF', datapoint: 'HUMIDITY',
        }));

        const climates = nat.getNativeEntities().filter(e => e.component === 'climate');
        expect(climates).toHaveLength(1);

        const e = nat.getNativeEntity('hm-climate:000A9D89B67B42');
        expect(e).toBeTruthy();
        expect(e.discovery_id).toBe('hm-climate:000A9D89B67B42');
        expect(e.name).toBe('Thermostat Hobbyraum');
        expect(e.component).toBe('climate');
        expect(e.source).toBe('homematic');
        expect(e.sourceLabel).toBe('hm');

        const c = e.config;
        expect(c.name).toBe('Thermostat Hobbyraum');
        expect(c.schema).toBe('separate');
        expect(c.temperature_state_topic).toBe('hm/status/Thermostat Hobbyraum:1/SET_POINT_TEMPERATURE');
        expect(c.temperature_command_topic).toBe('hm/set/Thermostat Hobbyraum:1/SET_POINT_TEMPERATURE');
        expect(c.current_temperature_topic).toBe('hm/status/Thermostat Hobbyraum:1/ACTUAL_TEMPERATURE');
        expect(c.mode_state_topic).toBe('hm/status/Thermostat Hobbyraum:1/SET_POINT_MODE');
        expect(c.mode_command_topic).toBe('hm/set/Thermostat Hobbyraum:1/CONTROL_MODE');   // HmIP mode WRITE
        expect(c.message_property).toBe('payload.val');
        // Per-topic message-property twins are each stamped to payload.val too —
        // the per-read paths don't fall back to the element-level one (E108 fix).
        expect(c.message_property_setpoint).toBe('payload.val');
        expect(c.message_property_actual).toBe('payload.val');
        expect(c.message_property_mode).toBe('payload.val');
        expect(c.message_property_valve).toBe('payload.val');
        expect(c.message_property_boost_remaining).toBe('payload.val');
        expect(c.min_temp).toBe(4.5);
        expect(c.max_temp).toBe(30.5);
        expect(c.temp_step).toBe(0.5);
        expect(c.temperature_unit).toBe('C');
        expect(c.valve_min).toBe(0);
        expect(c.valve_max).toBe(100);
        // Wall thermostat → no valve datapoint observed → no action_topic.
        expect(c.action_topic).toBeUndefined();

        // HmIP modes (putParamset VALUES) built for the :1 channel.
        expect(c.modes).toEqual([
            {value: 0, label: 'Auto', publish: 'hm/set/Thermostat Hobbyraum:1/CONTROL_MODE', payload: '0'},
            {value: 1, label: 'Manu', publish: 'hm/paramset/Thermostat Hobbyraum:1/VALUES', payload: {CONTROL_MODE: 1, SET_POINT_TEMPERATURE: '$setpoint'}},
            {value: 1, label: 'Off', 'match-setpoint-max': 4.5, publish: 'hm/paramset/Thermostat Hobbyraum:1/VALUES', payload: {CONTROL_MODE: 1, SET_POINT_TEMPERATURE: 4.5}},
            {value: 3, label: 'Boost', momentary: true, publish: 'hm/set/Thermostat Hobbyraum:1/BOOST_MODE', payload: 'true', off: {publish: 'hm/set/Thermostat Hobbyraum:1/BOOST_MODE', payload: 'false'}},
        ]);

        // Availability from the :0 maintenance UNREACH datapoint (inside config).
        expect(c.availability_normalized).toEqual({
            entries: [{topic: 'hm/status/Thermostat Hobbyraum:0/UNREACH', property: 'payload.val'}],
            mode: 'all',
            payloadAvailable: false,
            payloadUnavailable: true,
        });
    });
});

describe('Homematic climate recognizer — staleness filter (ghost devices)', () => {
    it('skips a device whose newest datapoint is older than the stale window', () => {
        const dev = 'KEQ1035974';
        const hm = {
            device: dev, deviceName: 'Thermostat Hobbyraum', deviceType: 'HM-TC-IT-WM-W-EU',
            channel: dev + ':2', channelName: 'Thermostat Hobbyraum:2',
            channelType: 'THERMALCONTROL_TRANSMIT', channelIndex: 2, iface: 'BidCos-RF',
        };
        const old = Date.now() - 30 * 24 * 60 * 60 * 1000;   // 30 days ago (window is 7d)
        nat.handleNativeMessage('hm/status/Thermostat Hobbyraum:2/SET_TEMPERATURE',
            je(12, {...hm, datapoint: 'SET_TEMPERATURE'}, old));
        nat.handleNativeMessage('hm/status/Thermostat Hobbyraum:2/CONTROL_MODE',
            je(1, {...hm, datapoint: 'CONTROL_MODE'}, old));

        // Stale → filtered out entirely.
        expect(nat.getNativeEntity('hm-climate:KEQ1035974')).toBe(null);

        // A subsequent FRESH message on the same device revives it.
        nat.handleNativeMessage('hm/status/Thermostat Hobbyraum:2/ACTUAL_TEMPERATURE',
            je(19.7, {...hm, datapoint: 'ACTUAL_TEMPERATURE'}));   // fresh ts (now)
        expect(nat.getNativeEntity('hm-climate:KEQ1035974')).toBeTruthy();
    });
});

describe('Homematic climate recognizer — HmIP eTRV (valve)', () => {
    it('wires action_topic + valve_max 1 when a LEVEL datapoint is observed', () => {
        const dev = '0011AABBCCDDEE';
        const base = {
            device: dev, deviceName: 'Heizung Bad', deviceType: 'HmIP-eTRV-2',
            channel: dev + ':1', channelName: 'Heizung Bad:1',
            channelType: 'HEATING_CLIMATECONTROL_TRANSCEIVER', channelIndex: 1, iface: 'HmIP-RF',
        };
        nat.handleNativeMessage('hm/status/Heizung Bad:1/SET_POINT_TEMPERATURE',
            je(22, {...base, datapoint: 'SET_POINT_TEMPERATURE', datapointMin: 5, datapointMax: 30}));
        nat.handleNativeMessage('hm/status/Heizung Bad:1/LEVEL',
            je(0.35, {...base, datapoint: 'LEVEL', datapointMin: 0, datapointMax: 1}));

        const e = nat.getNativeEntity('hm-climate:0011AABBCCDDEE');
        expect(e).toBeTruthy();
        const c = e.config;
        expect(c.temperature_state_topic).toBe('hm/status/Heizung Bad:1/SET_POINT_TEMPERATURE');
        expect(c.mode_state_topic).toBe('hm/status/Heizung Bad:1/SET_POINT_MODE');
        expect(c.action_topic).toBe('hm/status/Heizung Bad:1/LEVEL');
        expect(c.valve_max).toBe(1);                       // HmIP LEVEL 0–1
        // Setpoint metadata min/max flow through.
        expect(c.min_temp).toBe(5);
        expect(c.max_temp).toBe(30);
    });
});

describe('Homematic climate recognizer — BidCoS classic (CLIMATECONTROL_RT_TRANSCEIVER)', () => {
    it('promotes generation bidcos with SET_TEMPERATURE topics + VALVE_STATE valve', () => {
        const dev = 'LEQ0123456';
        const base = {
            device: dev, deviceName: 'Wohnzimmer', deviceType: 'HM-CC-RT-DN',
            channel: dev + ':4', channelName: 'Wohnzimmer:4',
            channelType: 'CLIMATECONTROL_RT_TRANSCEIVER', channelIndex: 4, iface: 'BidCos-RF',
        };
        nat.handleNativeMessage('hm/status/Wohnzimmer:4/SET_TEMPERATURE',
            je(21, {...base, datapoint: 'SET_TEMPERATURE', datapointMin: 4.5, datapointMax: 30.5}));
        nat.handleNativeMessage('hm/status/Wohnzimmer:4/VALVE_STATE',
            je(42, {...base, datapoint: 'VALVE_STATE', datapointMin: 0, datapointMax: 99}));

        const e = nat.getNativeEntity('hm-climate:LEQ0123456');
        expect(e).toBeTruthy();
        expect(e.name).toBe('Wohnzimmer');
        const c = e.config;
        expect(c.temperature_state_topic).toBe('hm/status/Wohnzimmer:4/SET_TEMPERATURE');
        expect(c.temperature_command_topic).toBe('hm/set/Wohnzimmer:4/SET_TEMPERATURE');
        expect(c.mode_state_topic).toBe('hm/status/Wohnzimmer:4/CONTROL_MODE');
        expect(c.action_topic).toBe('hm/status/Wohnzimmer:4/VALVE_STATE');
        expect(c.valve_max).toBe(100);                     // BidCoS VALVE_STATE

        // BidCoS modes (per-mode action datapoints).
        expect(c.modes).toEqual([
            {value: 0, label: 'Auto', publish: 'hm/set/Wohnzimmer:4/AUTO_MODE', payload: 'true'},
            {value: 1, label: 'Manu', publish: 'hm/set/Wohnzimmer:4/MANU_MODE', payload: '$setpoint'},
            {value: 1, label: 'Off', 'match-setpoint-max': 4.5, publish: 'hm/set/Wohnzimmer:4/MANU_MODE', payload: '4.5'},
            {value: 3, label: 'Boost', momentary: true, publish: 'hm/set/Wohnzimmer:4/BOOST_MODE', payload: 'true', off: 'restore'},
        ]);
    });
});

describe('Homematic climate recognizer — virtual heating group', () => {
    it('treats a VirtualDevices HmIP-HEATING group as an ordinary HmIP device', () => {
        const dev = 'INT0000011';
        nat.handleNativeMessage('hm/status/Fussbodenheizung EG:1/SET_POINT_TEMPERATURE', je(22, {
            device: dev, deviceName: 'Fussbodenheizung EG', deviceType: 'HmIP-HEATING',
            channel: dev + ':1', channelName: 'Fussbodenheizung EG:1',
            channelType: 'HEATING_CLIMATECONTROL_TRANSCEIVER', channelIndex: 1, iface: 'VirtualDevices',
            datapoint: 'SET_POINT_TEMPERATURE', datapointMin: 4.5, datapointMax: 30.5,
        }));
        const e = nat.getNativeEntity('hm-climate:INT0000011');
        expect(e).toBeTruthy();
        expect(e.name).toBe('Fussbodenheizung EG');
        expect(e.config.mode_state_topic).toBe('hm/status/Fussbodenheizung EG:1/SET_POINT_MODE');
        expect(e.config.temperature_command_topic).toBe('hm/set/Fussbodenheizung EG:1/SET_POINT_TEMPERATURE');
    });
});

describe('Homematic climate recognizer — nameless device', () => {
    it('groups by hm.device, labels via deviceType+address, writes via channel address', () => {
        const dev = '000A9D89B67B99';
        // No deviceName / channelName → topic segment is empty.
        nat.handleNativeMessage('hm/status//SET_POINT_TEMPERATURE', je(20, {
            device: dev, deviceType: 'HmIP-eTRV-C',
            channel: dev + ':1', channelType: 'HEATING_CLIMATECONTROL_TRANSCEIVER',
            channelIndex: 1, iface: 'HmIP-RF',
            datapoint: 'SET_POINT_TEMPERATURE', datapointMin: 4.5, datapointMax: 30.5,
        }));

        const e = nat.getNativeEntity('hm-climate:000A9D89B67B99');
        expect(e).toBeTruthy();
        expect(e.name).toBe('HmIP-eTRV-C 000A9D89B67B99');   // deviceType + device id
        const c = e.config;
        // Read topics use the (empty) segment.
        expect(c.temperature_state_topic).toBe('hm/status//SET_POINT_TEMPERATURE');
        expect(c.mode_state_topic).toBe('hm/status//SET_POINT_MODE');
        // Write topics fall back to the channel address.
        expect(c.temperature_command_topic).toBe('hm/set/000A9D89B67B99:1/SET_POINT_TEMPERATURE');
        expect(c.modes[0].publish).toBe('hm/set/000A9D89B67B99:1/CONTROL_MODE');
    });
});

describe('Homematic climate recognizer — metadata-less fallback', () => {
    it('still promotes via the datapoint signature when hm metadata is absent', () => {
        // No `hm` object → group by topic segment (:<n> stripped), pick control
        // channel via complete datapoint signature.
        nat.handleNativeMessage('hm/status/Flur:2/SET_TEMPERATURE', jePlain(21));
        expect(nat.getNativeEntity('hm-climate:Flur')).toBe(null);   // incomplete
        nat.handleNativeMessage('hm/status/Flur:2/CONTROL_MODE', jePlain(0));

        const e = nat.getNativeEntity('hm-climate:Flur');
        expect(e).toBeTruthy();
        expect(e.name).toBe('Flur');                         // no metadata → device id label
        const c = e.config;
        expect(c.temperature_state_topic).toBe('hm/status/Flur:2/SET_TEMPERATURE');
        expect(c.mode_state_topic).toBe('hm/status/Flur:2/CONTROL_MODE');
        expect(c.min_temp).toBe(4.5);                        // fallback range
        expect(c.max_temp).toBe(30.5);
        expect(c.action_topic).toBeUndefined();              // no valve seen
    });

    it('tolerates a non-JSON payload and still promotes on the topic signature', () => {
        expect(() => {
            nat.handleNativeMessage('hm/status/Bad/SET_TEMPERATURE', Buffer.from('not json'));
            nat.handleNativeMessage('hm/status/Bad/CONTROL_MODE', Buffer.from('21.5'));
        }).not.toThrow();
        expect(nat.getNativeEntity('hm-climate:Bad')).toBeTruthy();
    });
});

describe('Homematic climate recognizer — non-matches', () => {
    it('ignores non-thermostat datapoints, multi-level segments and set topics', () => {
        nat.handleNativeMessage('hm/status/Lamp/STATE', je(true));            // not a whitelisted DP
        nat.handleNativeMessage('hm/status/dev/1/SET_TEMPERATURE', je(21));   // segment not single level
        nat.handleNativeMessage('hm/set/Wohnzimmer/SET_TEMPERATURE', je(21)); // set, not status
        expect(nat.getNativeEntities().filter(e => e.component === 'climate')).toHaveLength(0);
    });

    it('a non-control channel datapoint alone (no control type, no setpoint) does NOT promote', () => {
        // A HUMIDITY reading on a MAINTENANCE-style channel: whitelisted datapoint,
        // but channelType is not a control type and no setpoint is present.
        nat.handleNativeMessage('hm/status/Sensor Bad:0/HUMIDITY', je(55, {
            device: 'DEVSENS01', deviceName: 'Sensor Bad', deviceType: 'HmIP-STH',
            channel: 'DEVSENS01:0', channelName: 'Sensor Bad:0',
            channelType: 'WEATHER', channelIndex: 0, iface: 'HmIP-RF', datapoint: 'HUMIDITY',
        }));
        nat.handleNativeMessage('hm/status/Sensor Bad:0/ACTUAL_TEMPERATURE', je(19, {
            device: 'DEVSENS01', deviceName: 'Sensor Bad', deviceType: 'HmIP-STH',
            channel: 'DEVSENS01:0', channelName: 'Sensor Bad:0',
            channelType: 'WEATHER', channelIndex: 0, iface: 'HmIP-RF', datapoint: 'ACTUAL_TEMPERATURE',
        }));
        expect(nat.getNativeEntity('hm-climate:DEVSENS01')).toBe(null);
        expect(nat.getNativeEntities().filter(e => e.component === 'climate')).toHaveLength(0);
    });
});

describe('Homematic contact recognizer', () => {
    it('promotes a SHUTTER_CONTACT to one binary_sensor with boolean payloads + :0 UNREACH/LOWBAT availability', () => {
        const dev = 'MEQ0100001';
        nat.handleNativeMessage('hm/status/Fenster Kueche:1/STATE', je(false, {
            device: dev, deviceName: 'Fenster Kueche', deviceType: 'HmIP-SWDO',
            channel: dev + ':1', channelName: 'Fenster Kueche:1',
            channelType: 'SHUTTER_CONTACT', channelIndex: 1, iface: 'HmIP-RF', datapoint: 'STATE',
        }));

        const sensors = nat.getNativeEntities().filter(e => e.component === 'binary_sensor');
        expect(sensors).toHaveLength(1);

        const e = nat.getNativeEntity('hm-contact:MEQ0100001');
        expect(e).toBeTruthy();
        expect(e.component).toBe('binary_sensor');
        expect(e.source).toBe('homematic');
        expect(e.sourceLabel).toBe('hm');
        expect(e.name).toBe('Fenster Kueche');

        const c = e.config;
        expect(c.name).toBe('Fenster Kueche');
        expect(c.state_topic).toBe('hm/status/Fenster Kueche:1/STATE');
        expect(c.value_template).toBe('{{ value_json.val }}');
        expect(c.device_class).toBe('window');
        expect(c.payload_on).toBe('1');    // BidCoS bool true / HmIP numeric 1 (open)
        expect(c.payload_off).toBe('0');   // BidCoS bool false / HmIP numeric 0 (closed)
        expect(c.payload_tilted).toBeUndefined();   // no tilt for a shutter contact

        // TWO :0 maintenance entries — UNREACH + LOWBAT (inside config).
        expect(c.availability_normalized).toEqual({
            entries: [
                {topic: 'hm/status/Fenster Kueche:0/UNREACH', property: 'payload.val'},
                {topic: 'hm/status/Fenster Kueche:0/LOWBAT', property: 'payload.val'},
            ],
            mode: 'all',
            payloadAvailable: false,
            payloadUnavailable: true,
        });
    });

    it('promotes a ROTARY_HANDLE_TRANSCEIVER with tristate 0/1/2 payloads', () => {
        const dev = 'MEQ0200002';
        nat.handleNativeMessage('hm/status/Fenstergriff Bad:1/STATE', je(1, {
            device: dev, deviceName: 'Fenstergriff Bad', deviceType: 'HmIP-SRH',
            channel: dev + ':1', channelName: 'Fenstergriff Bad:1',
            channelType: 'ROTARY_HANDLE_TRANSCEIVER', channelIndex: 1, iface: 'HmIP-RF', datapoint: 'STATE',
        }));

        const e = nat.getNativeEntity('hm-contact:MEQ0200002');
        expect(e).toBeTruthy();
        const c = e.config;
        expect(c.state_topic).toBe('hm/status/Fenstergriff Bad:1/STATE');
        expect(c.device_class).toBe('window');
        expect(c.payload_off).toBe('0');
        expect(c.payload_tilted).toBe('1');
        expect(c.payload_on).toBe('2');
        expect(c.availability_normalized.entries).toEqual([
            {topic: 'hm/status/Fenstergriff Bad:0/UNREACH', property: 'payload.val'},
            {topic: 'hm/status/Fenstergriff Bad:0/LOWBAT', property: 'payload.val'},
        ]);
    });

    it('does NOT promote a STATE whose channelType is not a contact type (e.g. a switch)', () => {
        nat.handleNativeMessage('hm/status/Steckdose:3/STATE', je(true, {
            device: 'MEQ0300003', deviceName: 'Steckdose', deviceType: 'HmIP-PS',
            channel: 'MEQ0300003:3', channelName: 'Steckdose:3',
            channelType: 'SWITCH_VIRTUAL_RECEIVER', channelIndex: 3, iface: 'HmIP-RF', datapoint: 'STATE',
        }));
        expect(nat.getNativeEntity('hm-contact:MEQ0300003')).toBe(null);
        expect(nat.getNativeEntities().filter(e => e.component === 'binary_sensor')).toHaveLength(0);
    });

    it('does NOT promote a STATE with no hm metadata (channelType unknown ⇒ cannot classify)', () => {
        nat.handleNativeMessage('hm/status/Something:1/STATE', jePlain(true));
        expect(nat.getNativeEntities().filter(e => e.component === 'binary_sensor')).toHaveLength(0);
    });
});

describe('Homematic cover recognizer', () => {
    it('BidCoS BLIND (any channel index) → one cover, LEVEL position topics, max 1, :0 UNREACH', () => {
        const dev = 'MEQ0500005';
        nat.handleNativeMessage('hm/status/Rolladen Wohnzimmer:1/LEVEL', je(0.6, {
            device: dev, deviceName: 'Rolladen Wohnzimmer', deviceType: 'HM-LC-Bl1-FM',
            channel: dev + ':1', channelName: 'Rolladen Wohnzimmer:1',
            channelType: 'BLIND', channelIndex: 1, iface: 'BidCos-RF', datapoint: 'LEVEL',
        }));

        const covers = nat.getNativeEntities().filter(e => e.component === 'cover');
        expect(covers).toHaveLength(1);

        const e = nat.getNativeEntity('hm-cover:' + dev + ':1');
        expect(e).toBeTruthy();
        expect(e.component).toBe('cover');
        expect(e.source).toBe('homematic');
        expect(e.sourceLabel).toBe('hm');
        expect(e.name).toBe('Rolladen Wohnzimmer:1');

        const c = e.config;
        expect(c.payload_mode).toBe('separate');
        expect(c.position_state_topic).toBe('hm/status/Rolladen Wohnzimmer:1/LEVEL');
        expect(c.position_command_topic).toBe('hm/set/Rolladen Wohnzimmer:1/LEVEL');
        expect(c.stop_command_topic).toBe('hm/set/Rolladen Wohnzimmer:1/STOP');
        // E120: Up/Down buttons — full open/close via the LEVEL set topic.
        expect(c.open_command_topic).toBe('hm/set/Rolladen Wohnzimmer:1/LEVEL');
        expect(c.close_command_topic).toBe('hm/set/Rolladen Wohnzimmer:1/LEVEL');
        expect(c.payload_open).toBe('1');
        expect(c.payload_close).toBe('0');
        expect(c.position_min).toBe(0);
        expect(c.position_max).toBe(1);                    // LEVEL 0.0–1.0
        expect(c.message_property).toBe('payload.val');
        expect(c.message_property_position).toBe('payload.val');
        // :0 maintenance UNREACH only (no LOWBAT for covers).
        expect(c.availability_normalized).toEqual({
            entries: [{topic: 'hm/status/Rolladen Wohnzimmer:0/UNREACH', property: 'payload.val'}],
            mode: 'all',
            payloadAvailable: false,
            payloadUnavailable: true,
        });
    });

    it('HmIP BLIND_VIRTUAL_RECEIVER: a 12-channel device → exactly 4 covers (first-of-3 leaders)', () => {
        const dev = '0022HMIPBLIND';
        const seg = i => 'Jalousieaktor:' + i;
        // Feed all 12 virtual-receiver channels (channelIndex 1..12). Two of them
        // fed twice / out of order to exercise the stable per-group id.
        const order = [3, 1, 2, 6, 5, 4, 7, 8, 9, 12, 11, 10, 1, 12];
        for (const i of order) {
            nat.handleNativeMessage('hm/status/' + seg(i) + '/LEVEL', je(0.5, {
                device: dev, deviceName: 'Jalousieaktor', deviceType: 'HmIP-BROLL',
                channel: dev + ':' + i, channelName: seg(i),
                channelType: 'BLIND_VIRTUAL_RECEIVER', channelIndex: i, iface: 'HmIP-RF', datapoint: 'LEVEL',
            }));
        }

        const covers = nat.getNativeEntities().filter(e => e.component === 'cover');
        expect(covers).toHaveLength(4);

        // Group ids g0..g3, leaders at channelIndex 1,4,7,10 (first of each triple).
        const leaders = {g0: 1, g1: 4, g2: 7, g3: 10};
        for (const [g, idx] of Object.entries(leaders)) {
            const e = nat.getNativeEntity('hm-cover:' + dev + ':' + g);
            expect(e, g).toBeTruthy();
            expect(e.config.position_state_topic).toBe('hm/status/' + seg(idx) + '/LEVEL');
            expect(e.config.position_command_topic).toBe('hm/set/' + seg(idx) + '/LEVEL');
            expect(e.config.stop_command_topic).toBe('hm/set/' + seg(idx) + '/STOP');
            expect(e.config.position_max).toBe(1);
        }
    });

    it('HmIP device with exactly 3 BLIND_VIRTUAL_RECEIVER channels → one cover', () => {
        const dev = '0033HMIPONE';
        for (const i of [1, 2, 3]) {
            nat.handleNativeMessage('hm/status/Rollo Bad:' + i + '/LEVEL', je(0.2, {
                device: dev, deviceName: 'Rollo Bad', deviceType: 'HmIP-BROLL',
                channel: dev + ':' + i, channelName: 'Rollo Bad:' + i,
                channelType: 'BLIND_VIRTUAL_RECEIVER', channelIndex: i, iface: 'HmIP-RF', datapoint: 'LEVEL',
            }));
        }
        const covers = nat.getNativeEntities().filter(e => e.component === 'cover');
        expect(covers).toHaveLength(1);
        const e = nat.getNativeEntity('hm-cover:' + dev + ':g0');
        expect(e).toBeTruthy();
        expect(e.config.position_state_topic).toBe('hm/status/Rollo Bad:1/LEVEL');   // leader = index 1
    });

    it('does NOT promote a LEVEL whose channelType is not a cover type (e.g. a TRV valve or dimmer)', () => {
        // eTRV valve LEVEL — HEATING channel, not a blind.
        nat.handleNativeMessage('hm/status/Heizung:1/LEVEL', je(0.35, {
            device: 'DEVTRV01', deviceName: 'Heizung', deviceType: 'HmIP-eTRV-2',
            channel: 'DEVTRV01:1', channelName: 'Heizung:1',
            channelType: 'HEATING_CLIMATECONTROL_TRANSCEIVER', channelIndex: 1, iface: 'HmIP-RF', datapoint: 'LEVEL',
        }));
        // Dimmer LEVEL — DIMMER channel.
        nat.handleNativeMessage('hm/status/Lampe:1/LEVEL', je(0.8, {
            device: 'DEVDIM01', deviceName: 'Lampe', deviceType: 'HmIP-BDT',
            channel: 'DEVDIM01:1', channelName: 'Lampe:1',
            channelType: 'DIMMER_VIRTUAL_RECEIVER', channelIndex: 1, iface: 'HmIP-RF', datapoint: 'LEVEL',
        }));
        expect(nat.getNativeEntities().filter(e => e.component === 'cover')).toHaveLength(0);
    });

    it('does NOT promote a LEVEL with no hm metadata (channelType unknown ⇒ cannot classify)', () => {
        nat.handleNativeMessage('hm/status/Something:1/LEVEL', jePlain(0.5));
        expect(nat.getNativeEntities().filter(e => e.component === 'cover')).toHaveLength(0);
    });
});

describe('Homematic light recognizer', () => {
    it('BidCoS DIMMER (non-:1 channel index) → one light, LEVEL brightness topics, scale 1, on-off-source brightness, :0 UNREACH', () => {
        const dev = 'MEQ0600006';
        // DIMMER channel is :3 here — the recognizer keys off channelType, not
        // the channel number (which varies per device generation).
        nat.handleNativeMessage('hm/status/Deckenlampe:3/LEVEL', je(0.4, {
            device: dev, deviceName: 'Deckenlampe', deviceType: 'HM-LC-Dim1T-FM',
            channel: dev + ':3', channelName: 'Deckenlampe:3',
            channelType: 'DIMMER', channelIndex: 3, iface: 'BidCos-RF', datapoint: 'LEVEL',
        }));

        const lights = nat.getNativeEntities().filter(e => e.component === 'light');
        expect(lights).toHaveLength(1);

        const e = nat.getNativeEntity('hm-light:' + dev + ':3');
        expect(e).toBeTruthy();
        expect(e.component).toBe('light');
        expect(e.source).toBe('homematic');
        expect(e.sourceLabel).toBe('hm');
        expect(e.name).toBe('Deckenlampe:3');

        const c = e.config;
        expect(c.payload_mode).toBe('separate');
        expect(c.brightness_state_topic).toBe('hm/status/Deckenlampe:3/LEVEL');
        expect(c.brightness_command_topic).toBe('hm/set/Deckenlampe:3/LEVEL');
        expect(c.brightness_min).toBe(0);
        expect(c.brightness_scale).toBe(1);                // LEVEL 0.0–1.0 → max 1
        expect(c.on_off_source).toBe('brightness');        // dimmer has no on/off datapoint
        expect(c.payload_off).toBe('0');
        expect(c.payload_on).toBe('1.005');                // OLD_LEVEL restore convention
        expect(c.supported_color_modes).toEqual(['brightness']);
        expect(c.message_property).toBe('payload.val');
        expect(c.message_property_brightness).toBe('payload.val');
        expect(c.message_property_state).toBe('payload.val');
        // :0 maintenance UNREACH only (no LOWBAT for mains-powered dimmers).
        expect(c.availability_normalized).toEqual({
            entries: [{topic: 'hm/status/Deckenlampe:0/UNREACH', property: 'payload.val'}],
            mode: 'all',
            payloadAvailable: false,
            payloadUnavailable: true,
        });
    });

    it('E127: observed WORKING / LEVEL_NOTWORKING topics are wired into the config — never guessed', () => {
        const dev = 'MEQ0600007';
        const meta = dp => ({
            device: dev, deviceName: 'Flurlicht', deviceType: 'HM-LC-Dim1T-FM',
            channel: dev + ':1', channelName: 'Flurlicht:1',
            channelType: 'DIMMER', channelIndex: 1, iface: 'BidCos-RF', datapoint: dp,
        });

        // LEVEL alone → no settling keys in the config.
        nat.handleNativeMessage('hm/status/Flurlicht:1/LEVEL', je(0.4, meta('LEVEL')));
        let c = nat.getNativeEntity('hm-light:' + dev + ':1').config;
        expect(c.working_topic).toBeUndefined();
        expect(c.settled_topic).toBeUndefined();

        // WORKING observed on the broker → wired.
        nat.handleNativeMessage('hm/status/Flurlicht:1/WORKING', je(true, meta('WORKING')));
        c = nat.getNativeEntity('hm-light:' + dev + ':1').config;
        expect(c.working_topic).toBe('hm/status/Flurlicht:1/WORKING');
        expect(c.message_property_working).toBe('payload.val');
        expect(c.settled_topic).toBeUndefined();

        // RedMatic's LEVEL_NOTWORKING observed → settled topic wired too.
        nat.handleNativeMessage('hm/status/Flurlicht:1/LEVEL_NOTWORKING', je(0.4, meta('LEVEL_NOTWORKING')));
        c = nat.getNativeEntity('hm-light:' + dev + ':1').config;
        expect(c.settled_topic).toBe('hm/status/Flurlicht:1/LEVEL_NOTWORKING');
        expect(c.message_property_settled).toBe('payload.val');

        // Still exactly one light — the observations update the entity in place.
        expect(nat.getNativeEntities().filter(e => e.component === 'light')).toHaveLength(1);
    });

    it('HmIP DIMMER_VIRTUAL_RECEIVER: a 6-channel device → exactly 2 lights (first-of-3 leaders)', () => {
        const dev = '0044HMIPDIM';
        const seg = i => 'Dimmaktor:' + i;
        // Feed all 6 virtual-receiver channels out of order (+ a repeat) to
        // exercise the stable per-group id.
        const order = [3, 1, 2, 6, 5, 4, 1, 6];
        for (const i of order) {
            nat.handleNativeMessage('hm/status/' + seg(i) + '/LEVEL', je(0.5, {
                device: dev, deviceName: 'Dimmaktor', deviceType: 'HmIP-BDT',
                channel: dev + ':' + i, channelName: seg(i),
                channelType: 'DIMMER_VIRTUAL_RECEIVER', channelIndex: i, iface: 'HmIP-RF', datapoint: 'LEVEL',
            }));
        }

        const lights = nat.getNativeEntities().filter(e => e.component === 'light');
        expect(lights).toHaveLength(2);

        // Leaders at sorted positions 0 and 3 → channelIndex 1 and 4.
        const leaders = {g0: 1, g1: 4};
        for (const [g, idx] of Object.entries(leaders)) {
            const e = nat.getNativeEntity('hm-light:' + dev + ':' + g);
            expect(e, g).toBeTruthy();
            expect(e.config.brightness_state_topic).toBe('hm/status/' + seg(idx) + '/LEVEL');
            expect(e.config.brightness_command_topic).toBe('hm/set/' + seg(idx) + '/LEVEL');
            expect(e.config.brightness_scale).toBe(1);
            expect(e.config.on_off_source).toBe('brightness');
        }
    });

    it('does NOT promote a LEVEL whose channelType is not a light type (e.g. a blind or TRV valve)', () => {
        nat.handleNativeMessage('hm/status/Rollo:1/LEVEL', je(0.6, {
            device: 'DEVBLIND9', deviceName: 'Rollo', deviceType: 'HmIP-BROLL',
            channel: 'DEVBLIND9:1', channelName: 'Rollo:1',
            channelType: 'BLIND_VIRTUAL_RECEIVER', channelIndex: 1, iface: 'HmIP-RF', datapoint: 'LEVEL',
        }));
        expect(nat.getNativeEntities().filter(e => e.component === 'light')).toHaveLength(0);
    });

    it('does NOT promote a LEVEL with no hm metadata (channelType unknown ⇒ cannot classify)', () => {
        nat.handleNativeMessage('hm/status/Something:1/LEVEL', jePlain(0.5));
        expect(nat.getNativeEntities().filter(e => e.component === 'light')).toHaveLength(0);
    });
});

describe('WLED recognizer', () => {
    it('promotes on wled/<id>/v with device_topic + availability_normalized', () => {
        nat.handleNativeMessage('wled/desk/v', Buffer.from('{"state":{"on":true}}'));
        const e = nat.getNativeEntity('wled:desk');
        expect(e).toBeTruthy();
        expect(e.component).toBe('wled');
        expect(e.source).toBe('wled');
        expect(e.config).toEqual({
            name: 'desk',
            device_topic: 'wled/desk',
            availability_topic: 'wled/desk/status',
            // availability_normalized lives INSIDE config (HA convention).
            availability_normalized: {
                entries: [{topic: 'wled/desk/status'}],
                mode: 'all',
                payloadAvailable: 'online',
                payloadUnavailable: 'offline',
            },
        });
    });

    it('the retained LWT (wled/<id>/status) alone is evidence enough', () => {
        nat.handleNativeMessage('wled/lamp/status', Buffer.from('online'));
        expect(nat.getNativeEntity('wled:lamp')).toBeTruthy();
    });

    it('ignores wled subtopics that are neither /v nor /status, and multi-level ids', () => {
        nat.handleNativeMessage('wled/lamp/g', Buffer.from('128'));      // brightness, not /v or /status
        nat.handleNativeMessage('wled/room/lamp/v', Buffer.from('{}'));  // multi-level id
        expect(nat.getNativeEntities().filter(e => e.component === 'wled')).toHaveLength(0);
    });
});

describe('clearNativeEntities resets accumulators + promoted state', () => {
    it('forgets a partially-accumulated device after clear', () => {
        nat.handleNativeMessage('hm/status/Room:2/SET_TEMPERATURE', jePlain(21));
        nat.clearNativeEntities();
        // After clear, CONTROL_MODE alone must NOT complete the signature.
        nat.handleNativeMessage('hm/status/Room:2/CONTROL_MODE', jePlain(1));
        expect(nat.getNativeEntity('hm-climate:Room')).toBe(null);
    });

    it('clears promoted WLED entities', () => {
        nat.handleNativeMessage('wled/desk/status', Buffer.from('online'));
        expect(nat.getNativeEntities()).toHaveLength(1);
        nat.clearNativeEntities();
        expect(nat.getNativeEntities()).toHaveLength(0);
    });
});

describe('extractValue still works', () => {
    it('extracts .val from JSON-Extended and passes raw strings through', () => {
        expect(nat.extractValue?.(je(21.5))).toBe(21.5);
        expect(nat.extractValue?.(Buffer.from('online'))).toBe('online');
    });
});

describe('end-to-end via discovery.handleMessage', () => {
    it('native entities surface through discovery.getDiscoveredEntities()', () => {
        // Homematic (with CCU metadata) + a normal HA entity + WLED, via handleMessage.
        const dev = 'LEQ0000001';
        const base = {
            device: dev, deviceName: 'Bad', deviceType: 'HM-CC-RT-DN',
            channel: dev + ':4', channelName: 'Bad:4',
            channelType: 'CLIMATECONTROL_RT_TRANSCEIVER', channelIndex: 4, iface: 'BidCos-RF',
        };
        disc.handleMessage('hm/status/Bad:4/SET_TEMPERATURE',
            je(21, {...base, datapoint: 'SET_TEMPERATURE', datapointMin: 4.5, datapointMax: 30.5}));
        disc.handleMessage('wled/strip/v', Buffer.from('{"state":{"on":false}}'));
        disc.handleMessage('homeassistant/switch/lamp/config', Buffer.from(JSON.stringify({name: 'Lamp', stat_t: 'x/lamp'})));

        const all = disc.getDiscoveredEntities();
        expect(byId(all, 'hm-climate:LEQ0000001')).toBeTruthy();
        expect(byId(all, 'wled:strip')).toBeTruthy();
        expect(byId(all, 'switch/lamp')).toBeTruthy();

        expect(disc.getDiscoveredEntity('hm-climate:LEQ0000001').component).toBe('climate');
        expect(disc.getDiscoveredEntity('wled:strip').component).toBe('wled');
    });

    it('a malformed native payload never breaks HA discovery in the same handleMessage', () => {
        disc.handleMessage('homeassistant/switch/ha1/config', Buffer.from(JSON.stringify({name: 'HA1', stat_t: 'x/1'})));
        disc.handleMessage('hm/status/X/SET_TEMPERATURE', Buffer.from(' '));
        expect(disc.getDiscoveredEntity('switch/ha1')).toBeTruthy();
    });

    it('discovery.clearEntities() also clears native entities', () => {
        disc.handleMessage('wled/strip/status', Buffer.from('online'));
        expect(disc.getDiscoveredEntity('wled:strip')).toBeTruthy();
        disc.clearEntities();
        expect(disc.getDiscoveredEntity('wled:strip')).toBe(null);
        expect(disc.getDiscoveredEntities()).toHaveLength(0);
    });
});

// ── Recognizer 6: Homematic switch — name word-list heuristic (E126) ─────────

describe('homematic switch recognizer (E126)', () => {
    const msg = (seg, hm) => nat.handleNativeMessage(`hm/status/${seg}/STATE`, je(true, hm));
    const meta = (dev, extra) => ({
        device: dev, deviceName: extra.deviceName, deviceType: 'HmIP-BSM',
        channel: extra.channel, channelName: extra.channelName,
        channelType: extra.channelType ?? 'SWITCH', channelIndex: extra.channelIndex,
        iface: 'BidCos-RF', datapoint: 'STATE',
    });

    it('a switch-word channel name promotes a switch with STATE r/w and true/false payloads', () => {
        const dev = 'SW0001';
        msg('Steckdose Terrasse:3', meta(dev, {deviceName: 'Steckdose Terrasse', channel: dev + ':3', channelName: 'Steckdose Terrasse:3'}));

        const e = nat.getNativeEntity('hm-switch:' + dev + ':3');
        expect(e).toBeTruthy();
        expect(e.component).toBe('switch');
        const c = e.config;
        expect(c.state_topic).toBe('hm/status/Steckdose Terrasse:3/STATE');
        expect(c.command_topic).toBe('hm/set/Steckdose Terrasse:3/STATE');
        expect(c.payload_on).toBe('true');
        expect(c.payload_off).toBe('false');
        expect(c.value_template).toBe('{{ value_json.val }}');
        expect(c.availability_normalized.entries).toEqual([
            {topic: 'hm/status/Steckdose Terrasse:0/UNREACH', property: 'payload.val'},
        ]);
    });

    it('a light-word channel name promotes an on/off LIGHT instead (E122 mode)', () => {
        const dev = 'SW0002';
        msg('Licht Terrasse:3', meta(dev, {deviceName: 'Licht Terrasse', channel: dev + ':3', channelName: 'Licht Terrasse:3'}));

        const e = nat.getNativeEntity('hm-switch:' + dev + ':3');
        expect(e).toBeTruthy();
        expect(e.component).toBe('light');
        const c = e.config;
        expect(c.payload_mode).toBe('separate');
        expect(c.state_topic).toBe('hm/status/Licht Terrasse:3/STATE');
        expect(c.state_command_topic).toBe('hm/set/Licht Terrasse:3/STATE');
        expect(c.supported_color_modes).toEqual(['onoff']);   // → mode on_off client-side
        expect(c.message_property_state).toBe('payload.val');
    });

    it('light words win over switch words when both match', () => {
        const dev = 'SW0003';
        msg('Steckdose Lampe Ecke:3', meta(dev, {deviceName: 'X', channel: dev + ':3', channelName: 'Steckdose Lampe Ecke:3'}));
        expect(nat.getNativeEntity('hm-switch:' + dev + ':3').component).toBe('light');
    });

    it('an unnamed channel (CCU default segment) is NOT promoted', () => {
        const dev = '000855699C49CB';
        msg('HmIP-BSM ' + dev + ':9', meta(dev, {channel: dev + ':9', channelName: 'HmIP-BSM ' + dev + ':9'}));
        expect(nat.getNativeEntities().filter(e => e.discovery_id.startsWith('hm-switch:'))
            .filter(e => e.discovery_id.includes(dev))).toHaveLength(0);
    });

    it('a matching name with absent channelType is NOT promoted (metadata rule)', () => {
        nat.handleNativeMessage('hm/status/Steckdose Keller:3/STATE', je(true));
        expect(nat.getNativeEntities().some(e => e.discovery_id === 'hm-switch:Steckdose Keller')).toBe(false);
    });

    it('HmIP SWITCH_VIRTUAL_RECEIVER triple → ONE entity on the leader channel', () => {
        const dev = 'HMIPSW01';
        for (const idx of [4, 5, 6]) {
            msg(`Standby TV:${idx}`, {
                device: dev, deviceName: 'Standby TV', deviceType: 'HmIP-PS',
                channel: `${dev}:${idx}`, channelName: `Standby TV:${idx}`,
                channelType: 'SWITCH_VIRTUAL_RECEIVER', channelIndex: idx,
                iface: 'HmIP-RF', datapoint: 'STATE',
            });
        }
        const entities = nat.getNativeEntities().filter(e => e.discovery_id.startsWith('hm-switch:' + dev));
        expect(entities).toHaveLength(1);
        expect(entities[0].discovery_id).toBe('hm-switch:' + dev + ':g0');
        expect(entities[0].component).toBe('switch');
        expect(entities[0].config.state_topic).toBe('hm/status/Standby TV:4/STATE');
    });
});

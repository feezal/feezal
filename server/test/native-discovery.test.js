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
// CCU-metadata object (as hm2mqtt / RedMatic emit it).
const je = (val, hm) => Buffer.from(JSON.stringify(hm ? {val, ts: 1, lc: 1, hm} : {val, ts: 1, lc: 1}));

// Metadata-less JSON-Extended (no `hm`) — the fallback signature path.
const jePlain = val => Buffer.from(JSON.stringify({val, ts: 1, lc: 1}));

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
        expect(c.message_property).toBe('payload.val');
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

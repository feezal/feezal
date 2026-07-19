/**
 * Unit tests for mqtt/native-discovery.js — the E108 native self-discovery
 * recognizers (Homematic climate + WLED). Both native-discovery.js and
 * discovery.js keep process-global state, so each test clears first.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const nat = require('../src/mqtt/native-discovery.js');
const disc = require('../src/mqtt/discovery.js');

// MQTT-Smarthome "JSON Extended" payload buffer.
const je = val => Buffer.from(JSON.stringify({val, ts: 1, lc: 1}));

const byId = (list, id) => list.find(e => e.discovery_id === id) || null;

beforeEach(() => {
    nat.clearNativeEntities();
    disc.clearEntities();
});

describe('Homematic climate recognizer — BidCoS', () => {
    it('promotes only once the SET_TEMPERATURE + CONTROL_MODE signature is complete', () => {
        // Partial: setpoint alone → no promotion.
        nat.handleNativeMessage('hm/status/Wohnzimmer/SET_TEMPERATURE', je(21));
        expect(nat.getNativeEntity('hm-climate:Wohnzimmer')).toBe(null);

        // Actual temp arrives — still incomplete (no mode datapoint).
        nat.handleNativeMessage('hm/status/Wohnzimmer/ACTUAL_TEMPERATURE', je(20.5));
        expect(nat.getNativeEntity('hm-climate:Wohnzimmer')).toBe(null);

        // CONTROL_MODE completes the BidCoS signature → promote.
        nat.handleNativeMessage('hm/status/Wohnzimmer/CONTROL_MODE', je(1));
        nat.handleNativeMessage('hm/status/Wohnzimmer/VALVE_STATE', je(42));

        const e = nat.getNativeEntity('hm-climate:Wohnzimmer');
        expect(e).toBeTruthy();
        expect(e.component).toBe('climate');
        expect(e.source).toBe('homematic');

        const c = e.config;
        expect(c.schema).toBe('separate');
        expect(c.temperature_state_topic).toBe('hm/status/Wohnzimmer/SET_TEMPERATURE');
        expect(c.temperature_command_topic).toBe('hm/set/Wohnzimmer/SET_TEMPERATURE');
        expect(c.current_temperature_topic).toBe('hm/status/Wohnzimmer/ACTUAL_TEMPERATURE');
        expect(c.mode_state_topic).toBe('hm/status/Wohnzimmer/CONTROL_MODE');
        expect(c.action_topic).toBe('hm/status/Wohnzimmer/VALVE_STATE');   // TRV: valve wired
        expect(c.message_property).toBe('val');
        expect(c.valve_min).toBe(0);
        expect(c.valve_max).toBe(100);                                     // BidCoS VALVE_STATE 0–100
        expect(c.min_temp).toBe(4.5);
        expect(c.max_temp).toBe(30.5);
        expect(c.temp_step).toBe(0.5);
        expect(c.temperature_unit).toBe('C');

        // Modes ported from climate-profiles.js buildBidcos().
        expect(c.modes).toEqual([
            {value: 0, label: 'Auto', publish: 'hm/set/Wohnzimmer/AUTO_MODE', payload: 'true'},
            {value: 1, label: 'Manu', publish: 'hm/set/Wohnzimmer/MANU_MODE', payload: '$setpoint'},
            {value: 1, label: 'Off', 'match-setpoint-max': 4.5, publish: 'hm/set/Wohnzimmer/MANU_MODE', payload: '4.5'},
            {value: 3, label: 'Boost', momentary: true, publish: 'hm/set/Wohnzimmer/BOOST_MODE', payload: 'true', off: 'restore'},
        ]);

        // Availability out of MVP scope for HM.
        expect(e.availability_normalized).toBeUndefined();
    });

    it('a wall thermostat (no valve datapoint) has no action_topic', () => {
        nat.handleNativeMessage('hm/status/Flur/SET_TEMPERATURE', je(21));
        nat.handleNativeMessage('hm/status/Flur/CONTROL_MODE', je(0));
        const c = nat.getNativeEntity('hm-climate:Flur').config;
        expect(c.action_topic).toBeUndefined();
        expect(c.valve_max).toBe(100);
    });
});

describe('Homematic climate recognizer — HmIP', () => {
    it('promotes on SET_POINT_TEMPERATURE + SET_POINT_MODE with LEVEL valve (valve-max 1)', () => {
        nat.handleNativeMessage('hm/status/eTRV/SET_POINT_TEMPERATURE', je(22));
        expect(nat.getNativeEntity('hm-climate:eTRV')).toBe(null);           // incomplete

        nat.handleNativeMessage('hm/status/eTRV/SET_POINT_MODE', je(1));
        nat.handleNativeMessage('hm/status/eTRV/LEVEL', je(0.35));

        const c = nat.getNativeEntity('hm-climate:eTRV').config;
        expect(c.temperature_state_topic).toBe('hm/status/eTRV/SET_POINT_TEMPERATURE');
        expect(c.temperature_command_topic).toBe('hm/set/eTRV/SET_POINT_TEMPERATURE');
        expect(c.mode_state_topic).toBe('hm/status/eTRV/SET_POINT_MODE');
        expect(c.action_topic).toBe('hm/status/eTRV/LEVEL');
        expect(c.valve_max).toBe(1);                                         // HmIP LEVEL 0–1

        // Modes ported from climate-profiles.js buildHmip() (putParamset VALUES).
        expect(c.modes).toEqual([
            {value: 0, label: 'Auto', publish: 'hm/set/eTRV/CONTROL_MODE', payload: '0'},
            {value: 1, label: 'Manu', publish: 'hm/paramset/eTRV/VALUES', payload: {CONTROL_MODE: 1, SET_POINT_TEMPERATURE: '$setpoint'}},
            {value: 1, label: 'Off', 'match-setpoint-max': 4.5, publish: 'hm/paramset/eTRV/VALUES', payload: {CONTROL_MODE: 1, SET_POINT_TEMPERATURE: 4.5}},
            {value: 3, label: 'Boost', momentary: true, publish: 'hm/set/eTRV/BOOST_MODE', payload: 'true', off: {publish: 'hm/set/eTRV/BOOST_MODE', payload: 'false'}},
        ]);
    });
});

describe('Homematic climate recognizer — device grouping (B-E108)', () => {
    it('groups all channels of one device into ONE device-level entity, choosing the lowest qualifying channel', () => {
        // Real hm2mqtt channel names: "<device>:<channel>", device name has spaces.
        // Three channels each complete an HmIP signature; :1 also carries a valve.
        nat.handleNativeMessage('hm/status/Thermostat Hobbyraum:1/SET_POINT_TEMPERATURE', je(21));
        nat.handleNativeMessage('hm/status/Thermostat Hobbyraum:1/SET_POINT_MODE', je(1));
        nat.handleNativeMessage('hm/status/Thermostat Hobbyraum:1/LEVEL', je(0.4));
        nat.handleNativeMessage('hm/status/Thermostat Hobbyraum:2/SET_POINT_TEMPERATURE', je(21));
        nat.handleNativeMessage('hm/status/Thermostat Hobbyraum:2/SET_POINT_MODE', je(1));
        nat.handleNativeMessage('hm/status/Thermostat Hobbyraum:4/SET_POINT_TEMPERATURE', je(21));
        nat.handleNativeMessage('hm/status/Thermostat Hobbyraum:4/SET_POINT_MODE', je(1));

        // Exactly one climate entity for the whole device.
        const climates = nat.getNativeEntities().filter(e => e.component === 'climate');
        expect(climates).toHaveLength(1);

        const e = nat.getNativeEntity('hm-climate:Thermostat Hobbyraum');
        expect(e).toBeTruthy();
        expect(e.name).toBe('Thermostat Hobbyraum');
        expect(e.sourceLabel).toBe('hm');
        expect(e.source).toBe('homematic');

        // Config topics reference the CHOSEN (lowest qualifying) channel :1.
        const c = e.config;
        expect(c.name).toBe('Thermostat Hobbyraum');
        expect(c.temperature_state_topic).toBe('hm/status/Thermostat Hobbyraum:1/SET_POINT_TEMPERATURE');
        expect(c.temperature_command_topic).toBe('hm/set/Thermostat Hobbyraum:1/SET_POINT_TEMPERATURE');
        expect(c.mode_state_topic).toBe('hm/status/Thermostat Hobbyraum:1/SET_POINT_MODE');
        expect(c.action_topic).toBe('hm/status/Thermostat Hobbyraum:1/LEVEL');   // :1 is the TRV
    });

    it('chooses :4 when it is the only channel with a complete signature', () => {
        // :1 is partial (setpoint only), :4 completes the signature.
        nat.handleNativeMessage('hm/status/Bad OG:1/SET_POINT_TEMPERATURE', je(21));
        nat.handleNativeMessage('hm/status/Bad OG:4/SET_POINT_TEMPERATURE', je(21));
        nat.handleNativeMessage('hm/status/Bad OG:4/SET_POINT_MODE', je(1));

        const climates = nat.getNativeEntities().filter(e => e.component === 'climate');
        expect(climates).toHaveLength(1);

        const e = nat.getNativeEntity('hm-climate:Bad OG');
        expect(e).toBeTruthy();
        expect(e.name).toBe('Bad OG');
        expect(e.config.temperature_state_topic).toBe('hm/status/Bad OG:4/SET_POINT_TEMPERATURE');
        expect(e.config.mode_state_topic).toBe('hm/status/Bad OG:4/SET_POINT_MODE');
    });
});

describe('Homematic climate recognizer — non-matches', () => {
    it('ignores non-thermostat datapoints and multi-level channel names', () => {
        nat.handleNativeMessage('hm/status/Lamp/STATE', je(true));           // not a whitelisted DP
        nat.handleNativeMessage('hm/status/dev/1/SET_TEMPERATURE', je(21));  // channelName not single level
        nat.handleNativeMessage('hm/set/Wohnzimmer/SET_TEMPERATURE', je(21)); // set, not status
        expect(nat.getNativeEntities().filter(e => e.component === 'climate')).toHaveLength(0);
    });

    it('a channel with only unrelated whitelisted datapoints does not promote', () => {
        nat.handleNativeMessage('hm/status/Sensor/HUMIDITY', je(55));
        nat.handleNativeMessage('hm/status/Sensor/ACTUAL_TEMPERATURE', je(19));
        expect(nat.getNativeEntity('hm-climate:Sensor')).toBe(null);
    });

    it('tolerates a non-JSON payload without throwing', () => {
        expect(() => {
            nat.handleNativeMessage('hm/status/Bad/SET_TEMPERATURE', Buffer.from('not json'));
            nat.handleNativeMessage('hm/status/Bad/CONTROL_MODE', Buffer.from('21.5'));
        }).not.toThrow();
        // Signature is topic-based, so it still promotes.
        expect(nat.getNativeEntity('hm-climate:Bad')).toBeTruthy();
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
        });
        expect(e.availability_normalized).toEqual({
            entries: [{topic: 'wled/desk/status'}],
            mode: 'all',
            payloadAvailable: 'online',
            payloadUnavailable: 'offline',
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
    it('forgets a partially-accumulated channel after clear', () => {
        nat.handleNativeMessage('hm/status/Room/SET_TEMPERATURE', je(21));
        nat.clearNativeEntities();
        // After clear, CONTROL_MODE alone must NOT complete the signature
        // (the earlier SET_TEMPERATURE was forgotten).
        nat.handleNativeMessage('hm/status/Room/CONTROL_MODE', je(1));
        expect(nat.getNativeEntity('hm-climate:Room')).toBe(null);
    });

    it('clears promoted WLED entities', () => {
        nat.handleNativeMessage('wled/desk/status', Buffer.from('online'));
        expect(nat.getNativeEntities()).toHaveLength(1);
        nat.clearNativeEntities();
        expect(nat.getNativeEntities()).toHaveLength(0);
    });
});

describe('end-to-end via discovery.handleMessage', () => {
    it('native entities surface through discovery.getDiscoveredEntities()', () => {
        // Homematic BidCoS + a normal HA entity + WLED, all via the real handleMessage.
        disc.handleMessage('hm/status/Bad/SET_TEMPERATURE', je(21));
        disc.handleMessage('hm/status/Bad/CONTROL_MODE', je(1));
        disc.handleMessage('wled/strip/v', Buffer.from('{"state":{"on":false}}'));
        disc.handleMessage('homeassistant/switch/lamp/config', Buffer.from(JSON.stringify({name: 'Lamp', stat_t: 'x/lamp'})));

        const all = disc.getDiscoveredEntities();
        expect(byId(all, 'hm-climate:Bad')).toBeTruthy();
        expect(byId(all, 'wled:strip')).toBeTruthy();
        expect(byId(all, 'switch/lamp')).toBeTruthy();

        // Lookup by id resolves native ids too.
        expect(disc.getDiscoveredEntity('hm-climate:Bad').component).toBe('climate');
        expect(disc.getDiscoveredEntity('wled:strip').component).toBe('wled');
    });

    it('a malformed native payload never breaks HA discovery in the same handleMessage', () => {
        disc.handleMessage('homeassistant/switch/ha1/config', Buffer.from(JSON.stringify({name: 'HA1', stat_t: 'x/1'})));
        // Odd payloads on native topics — must not throw or lose the HA entity.
        disc.handleMessage('hm/status/X/SET_TEMPERATURE', Buffer.from(' '));
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

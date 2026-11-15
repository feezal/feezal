/**
 * E145 — Homematic through ccu-jack's MQTT server: address topics
 * (`device/status/<serial>/<channel>/<DP>`), VEAP payloads `{"v","ts","s"}`,
 * no metadata. The channel type is inferred from unambiguous datapoint
 * signatures, the Homematic recognizers' own logic promotes, and the result is
 * translated to ccu-jack's topics and `payload.v`. Serials are invented.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const nat = require('../src/mqtt/native-discovery.js');
const {inferChannelType} = require('../src/mqtt/recognizers/ccujack.js');
const {mergeDiscovery} = require('../src/mqtt/discovery-merge.js');

const veap = v => Buffer.from(JSON.stringify({v, ts: Date.now(), s: 0}));
const send = (topic, v) => nat.handleNativeMessage(topic, veap(v));
const jack = () => nat.getNativeEntities().filter(e => e.source === 'ccu-jack');
const byId = id => nat.getNativeEntities().find(e => e.discovery_id === id) || null;

beforeEach(() => nat.clearNativeEntities());

describe('E145 — channel type from the datapoint signature', () => {
    it('infers only unambiguous signatures', () => {
        const t = (i, ...dps) => inferChannelType(i, new Set(dps));
        expect(t(1, 'SET_POINT_TEMPERATURE', 'SET_POINT_MODE', 'ACTUAL_TEMPERATURE')).toBe('HEATING_CLIMATECONTROL_TRANSCEIVER');
        expect(t(4, 'SET_TEMPERATURE', 'CONTROL_MODE')).toBe('CLIMATECONTROL_RT_TRANSCEIVER');
        expect(t(1, 'MOTION', 'BRIGHTNESS')).toBe('MOTION_DETECTOR');
        expect(t(3, 'MOTION', 'ILLUMINATION')).toBe('MOTIONDETECTOR_TRANSCEIVER');
        expect(t(1, 'STATE', 'STATE_UNCERTAIN')).toBe('KEYMATIC');
        expect(t(0, 'UNREACH')).toBe('MAINTENANCE');
        // ambiguous: a contact or a switch; a blind, a dimmer or a valve
        expect(t(1, 'STATE')).toBeUndefined();
        expect(t(1, 'LEVEL', 'WORKING', 'DIRECTION')).toBeUndefined();
        expect(t(1, 'MOTION')).toBeUndefined();
    });
});

describe('E145 — ccu-jack entities', () => {
    it('an HmIP thermostat: ccu-jack topics, payload.v, modes without putParamset, availability + battery from channel 0', () => {
        send('device/status/000A1B2C3D4E5F/0/LOW_BAT', false);
        send('device/status/000A1B2C3D4E5F/0/UNREACH', false);
        send('device/status/000A1B2C3D4E5F/1/ACTUAL_TEMPERATURE', 20.4);
        send('device/status/000A1B2C3D4E5F/1/SET_POINT_TEMPERATURE', 21);
        expect(jack()).toHaveLength(0);                 // signature not complete yet
        send('device/status/000A1B2C3D4E5F/1/SET_POINT_MODE', 0);

        const e = byId('ccu-jack:hm-climate:000A1B2C3D4E5F');
        expect(e).toBeTruthy();
        expect(e.component).toBe('climate');
        expect(e.sourceLabel).toBe('CCU-Jack');
        const c = e.config;
        expect(c.temperature_state_topic).toBe('device/status/000A1B2C3D4E5F/1/SET_POINT_TEMPERATURE');
        expect(c.temperature_command_topic).toBe('device/set/000A1B2C3D4E5F/1/SET_POINT_TEMPERATURE');
        expect(c.current_temperature_topic).toBe('device/status/000A1B2C3D4E5F/1/ACTUAL_TEMPERATURE');
        expect(c.mode_command_topic).toBe('device/set/000A1B2C3D4E5F/1/CONTROL_MODE');
        expect(c.message_property).toBe('payload.v');
        expect(c.message_property_setpoint).toBe('payload.v');
        expect(JSON.stringify(c)).not.toMatch(/payload\.val|paramset|^hm\//);
        expect(c.modes.map(m => [m.label, m.publish, m.payload])).toEqual([
            ['Auto', 'device/set/000A1B2C3D4E5F/1/CONTROL_MODE', '0'],
            ['Manu', 'device/set/000A1B2C3D4E5F/1/CONTROL_MODE', '1'],
            ['Off', 'device/set/000A1B2C3D4E5F/1/SET_POINT_TEMPERATURE', '4.5'],
            ['Boost', 'device/set/000A1B2C3D4E5F/1/BOOST_MODE', 'true'],
        ]);
        expect(c.availability_normalized).toEqual({
            entries: [{topic: 'device/status/000A1B2C3D4E5F/0/UNREACH', property: 'payload.v'}],
            mode: 'all', payloadAvailable: false, payloadUnavailable: true,
        });
        expect(c.battery_low_normalized).toEqual({topic: 'device/status/000A1B2C3D4E5F/0/LOW_BAT', property: 'payload.v', payloadLow: true});
        expect(e._availResolve).toBeUndefined();
    });

    it('a BidCoS thermostat behind a bridge prefix keeps the prefix and its own modes', () => {
        send('charly/device/status/QEQ0000042/4/SET_TEMPERATURE', 20.5);
        send('charly/device/status/QEQ0000042/4/CONTROL_MODE', 1);
        const c = byId('ccu-jack:hm-climate:QEQ0000042').config;
        expect(c.temperature_command_topic).toBe('charly/device/set/QEQ0000042/4/SET_TEMPERATURE');
        expect(c.modes.find(m => m.label === 'Auto').publish).toBe('charly/device/set/QEQ0000042/4/AUTO_MODE');
        expect(c.availability_normalized.entries[0].topic).toBe('charly/device/status/QEQ0000042/0/UNREACH');
    });

    it('motion sensors (BidCoS and HmIP) and a Keymatic', () => {
        send('device/status/MEQ0000001/1/MOTION', false);
        send('device/status/MEQ0000001/1/BRIGHTNESS', 80);
        send('device/status/0011223344AABB/3/ILLUMINATION', 12.5);
        send('device/status/0011223344AABB/3/MOTION', true);
        send('device/status/KEQ0000007/1/STATE', false);
        send('device/status/KEQ0000007/1/STATE_UNCERTAIN', false);

        const bidcos = byId('ccu-jack:hm-sensor:MEQ0000001').config;
        expect(bidcos.state_topic).toBe('device/status/MEQ0000001/1/MOTION');
        expect(bidcos.value_template).toBe('{{ value_json.v }}');
        expect(bidcos.device_class).toBe('motion');
        expect(byId('ccu-jack:hm-sensor:0011223344AABB').config.state_topic).toBe('device/status/0011223344AABB/3/MOTION');
        const lock = byId('ccu-jack:hm-lock:KEQ0000007');
        expect(lock.component).toBe('lock');
        expect(lock.config.command_topic).toBe('device/set/KEQ0000007/1/STATE');
        expect(lock.config.open_command_topic).toBe('device/set/KEQ0000007/1/OPEN');
    });

    it('offers nothing for ambiguous channels and nothing for RedMatic-shaped or foreign topics', () => {
        send('device/status/SEQ0000001/1/STATE', true);           // contact or switch?
        send('device/status/DEQ0000001/1/LEVEL', 0.5);            // blind, dimmer or valve?
        send('device/status/DEQ0000001/1/WORKING', false);
        send('sysvar/status/1234', 5);
        send('virtdev/status/JACK000001/1/STATE', true);
        expect(jack()).toHaveLength(0);
    });

    it('obeys the E192 rule: an announced copy on the same ccu-jack topics is left out', () => {
        send('device/status/MEQ0000001/1/MOTION', false);
        send('device/status/MEQ0000001/1/BRIGHTNESS', 80);
        const native = byId('ccu-jack:hm-sensor:MEQ0000001');
        const announced = {discovery_id: 'binary_sensor/x/motion', component: 'binary_sensor', name: 'x',
            config: {state_topic: 'device/status/MEQ0000001/1/MOTION', value_template: '{{ value_json.v }}'}};
        const {omitted} = mergeDiscovery([announced], [native], {announceable: new Set(['binary_sensor'])});
        expect([...omitted.keys()]).toEqual(['binary_sensor/x/motion']);
    });

    it('leaves the RedMatic recognizers alone', () => {
        send('device/status/000A1B2C3D4E5F/1/SET_POINT_TEMPERATURE', 21);
        send('device/status/000A1B2C3D4E5F/1/SET_POINT_MODE', 0);
        expect(nat.getNativeEntities().filter(e => e.source === 'homematic')).toHaveLength(0);
    });
});

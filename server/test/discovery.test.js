/**
 * Unit tests for mqtt/discovery.js — the Home-Assistant / zigbee2mqtt
 * auto-discovery registry. The module keeps a process-global entity map, so
 * every test clears it first (clearEntities) to stay independent.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const disc = require('../src/mqtt/discovery.js');

const buf = obj => Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj));

beforeEach(() => disc.clearEntities());

describe('handleMessage — component discovery', () => {
    it('registers a supported component and derives id/name from the topic', () => {
        disc.handleMessage('homeassistant/switch/lamp/config', buf({name: 'Lamp', stat_t: 'x/lamp', cmd_t: 'x/lamp/set'}));
        const e = disc.getDiscoveredEntity('switch/lamp');
        expect(e).toBeTruthy();
        expect(e.component).toBe('switch');
        expect(e.name).toBe('Lamp');
        // stat_t / cmd_t abbreviations are expanded
        expect(e.config.state_topic).toBe('x/lamp');
        expect(e.config.command_topic).toBe('x/lamp/set');
    });

    it('resolves the ~ base-topic shorthand and drops the ~ key', () => {
        disc.handleMessage('homeassistant/switch/s2/config', buf({'~': 'base/s2', name: 'S2', stat_t: '~/state', cmd_t: '~/set'}));
        const e = disc.getDiscoveredEntity('switch/s2');
        expect(e.config.state_topic).toBe('base/s2/state');
        expect(e.config.command_topic).toBe('base/s2/set');
        expect(e.config['~']).toBeUndefined();
    });

    it('supports the <component>/<node_id>/<object_id> three-part form', () => {
        disc.handleMessage('homeassistant/sensor/node1/temp/config', buf({name: 'Temp', stat_t: 'z/t'}));
        const e = disc.getDiscoveredEntity('sensor/node1/temp');
        expect(e).toBeTruthy();
        expect(e.node_id).toBe('node1');
        expect(e.object_id).toBe('temp');
    });

    it('falls back to object_id when the payload has no name', () => {
        disc.handleMessage('homeassistant/switch/anon/config', buf({stat_t: 'z/a'}));
        expect(disc.getDiscoveredEntity('switch/anon').name).toBe('anon');
    });

    it('ignores unsupported components', () => {
        disc.handleMessage('homeassistant/camera/cam1/config', buf({name: 'Cam'}));
        expect(disc.getDiscoveredEntity('camera/cam1')).toBe(null);
        expect(disc.getDiscoveredEntities()).toHaveLength(0);
    });

    it('ignores non-config topics and invalid JSON', () => {
        disc.handleMessage('homeassistant/switch/lamp/state', buf({name: 'x'}));   // not /config
        disc.handleMessage('homeassistant/switch/broken/config', buf('{not json'));
        expect(disc.getDiscoveredEntities()).toHaveLength(0);
    });

    it('respects a custom discovery prefix', () => {
        disc.handleMessage('homeassistant/switch/x/config', buf({name: 'X'}), 'z2m');   // wrong prefix
        expect(disc.getDiscoveredEntities()).toHaveLength(0);
        disc.handleMessage('z2m/switch/x/config', buf({name: 'X'}), 'z2m');
        expect(disc.getDiscoveredEntity('switch/x')).toBeTruthy();
    });

    it('an empty payload clears (deletes) a previously registered entity', () => {
        disc.handleMessage('homeassistant/switch/lamp/config', buf({name: 'Lamp'}));
        expect(disc.getDiscoveredEntity('switch/lamp')).toBeTruthy();
        disc.handleMessage('homeassistant/switch/lamp/config', buf(''));
        expect(disc.getDiscoveredEntity('switch/lamp')).toBe(null);
    });
});

describe('handleMessage — device discovery (cmps)', () => {
    it('expands a single device payload into multiple component entities', () => {
        disc.handleMessage('homeassistant/device/dev1/config', buf({
            dev: {identifiers: ['dev1'], name: 'Combo'},
            cmps: {
                sw:   {p: 'switch', name: 'Relay', stat_t: 'd/relay'},
                temp: {p: 'sensor', name: 'Temp',  stat_t: 'd/temp'},
                cam:  {p: 'camera', name: 'Ignored'},
            },
        }));
        expect(disc.getDiscoveredEntity('switch/dev1/sw')).toBeTruthy();
        expect(disc.getDiscoveredEntity('sensor/dev1/temp')).toBeTruthy();
        expect(disc.getDiscoveredEntity('camera/dev1/cam')).toBe(null);   // unsupported
    });

    it('an empty device payload removes all of that node\'s entities', () => {
        disc.handleMessage('homeassistant/device/dev1/config', buf({
            cmps: {sw: {p: 'switch', name: 'R', stat_t: 'd/r'}},
        }));
        expect(disc.getDiscoveredEntity('switch/dev1/sw')).toBeTruthy();
        disc.handleMessage('homeassistant/device/dev1/config', buf(''));
        expect(disc.getDiscoveredEntity('switch/dev1/sw')).toBe(null);
    });
});

describe('getDeviceGroups', () => {
    it('groups entities by device identifier and hints "plant" for a moisture sensor', () => {
        disc.handleMessage('homeassistant/sensor/moist/config', buf({
            name: 'Moisture', dev_cla: 'moisture',
            device: {identifiers: ['plant1'], name: 'Ficus'}, stat_t: 'p/moist',
        }));
        disc.handleMessage('homeassistant/sensor/temp/config', buf({
            name: 'Temperature',
            device: {identifiers: ['plant1'], name: 'Ficus'}, stat_t: 'p/temp',
        }));
        const groups = disc.getDeviceGroups();
        expect(groups).toHaveLength(1);
        expect(groups[0].deviceId).toBe('plant1');
        expect(groups[0].deviceName).toBe('Ficus');
        expect(groups[0].entities).toHaveLength(2);
        expect(groups[0].elementHint).toBe('plant');
    });

    it('excludes entities without device info', () => {
        disc.handleMessage('homeassistant/switch/loner/config', buf({name: 'Loner', stat_t: 'x'}));
        expect(disc.getDeviceGroups()).toHaveLength(0);
    });
});

describe('N31 — canonical availability normalization', () => {
    it('scalar availability_topic + payloads normalize to one entry', () => {
        disc.handleMessage('homeassistant/switch/av1/config', buf({
            name: 'A', stat_t: 'x/a',
            avty_t: 'tele/a/LWT', pl_avail: 'Online', pl_not_avail: 'Offline'
        }));
        const n = disc.getDiscoveredEntity('switch/av1').config.availability_normalized;
        expect(n).toEqual({
            entries: [{topic: 'tele/a/LWT'}],
            mode: 'all',
            payloadAvailable: 'Online',
            payloadUnavailable: 'Offline'
        });
    });

    it('availability array (zigbee2mqtt form) with value_templates and mode', () => {
        disc.handleMessage('homeassistant/light/av2/config', buf({
            name: 'B', stat_t: 'z2m/b',
            availability: [
                {topic: 'z2m/bridge/state', value_template: '{{ value_json.state }}'},
                {topic: 'z2m/b/availability', value_template: '{{ value_json.state }}'}
            ],
            availability_mode: 'all'
        }));
        const n = disc.getDiscoveredEntity('light/av2').config.availability_normalized;
        expect(n.entries).toEqual([
            {topic: 'z2m/bridge/state', property: 'payload.state'},
            {topic: 'z2m/b/availability', property: 'payload.state'}
        ]);
        expect(n.mode).toBe('all');
    });

    it('abbreviated avty array + ~ base resolution + per-entry abbreviations', () => {
        disc.handleMessage('homeassistant/switch/av3/config', buf({
            '~': 'base/c', name: 'C', stat_t: '~/state',
            avty: [{t: '~/LWT', pl_avail: 'up', pl_not_avail: 'down'}],
            avty_mode: 'any'
        }));
        const n = disc.getDiscoveredEntity('switch/av3').config.availability_normalized;
        expect(n).toEqual({
            entries: [{topic: 'base/c/LWT'}],
            mode: 'any',
            payloadAvailable: 'up',
            payloadUnavailable: 'down'
        });
    });

    it('no availability info → no availability_normalized key', () => {
        disc.handleMessage('homeassistant/switch/av4/config', buf({name: 'D', stat_t: 'x/d'}));
        expect(disc.getDiscoveredEntity('switch/av4').config.availability_normalized).toBeUndefined();
    });
});

// ── E124/E132: canonical low-battery record from z2m battery siblings ───────

describe('E124 — battery_low_normalized (z2m sibling lookup, read-time)', () => {
    const DEV = {identifiers: ['0x00158d0001aabbcc'], name: 'Water sensor cellar'};

    it('prefers the binary_sensor battery sibling (boolean, bracket-form template)', () => {
        disc.handleMessage('homeassistant/binary_sensor/ws1/water/config', buf({
            name: 'Leak', state_topic: 'zigbee2mqtt/ws1', device_class: 'moisture',
            payload_on: true, payload_off: false,
            value_template: '{{ value_json.water_leak }}', device: DEV,
        }));
        disc.handleMessage('homeassistant/binary_sensor/ws1/battlow/config', buf({
            name: 'Battery low', state_topic: 'zigbee2mqtt/ws1', device_class: 'battery',
            payload_on: true, payload_off: false, entity_category: 'diagnostic',
            value_template: '{{ value_json["battery_low"] }}', device: DEV,
        }));
        disc.handleMessage('homeassistant/sensor/ws1/batt/config', buf({
            name: 'Battery', state_topic: 'zigbee2mqtt/ws1', device_class: 'battery',
            value_template: '{{ value_json.battery }}', device: DEV,
        }));

        const leak = disc.getDiscoveredEntities().find(e => e.config.device_class === 'moisture');
        expect(leak.config.battery_low_normalized).toEqual({
            topic: 'zigbee2mqtt/ws1',
            property: 'payload.battery_low',   // bracket-form template parsed
            payloadLow: true,
        });
        // The battery entities themselves are never decorated.
        const batt = disc.getDiscoveredEntities().find(e => e.component === 'binary_sensor' && e.config.device_class === 'battery');
        expect(batt.config.battery_low_normalized).toBeUndefined();
    });

    it('falls back to the percentage sensor sibling WITHOUT payloadLow (element threshold decides)', () => {
        disc.handleMessage('homeassistant/binary_sensor/oc1/occ/config', buf({
            name: 'Occupancy', state_topic: 'zigbee2mqtt/oc1', device_class: 'occupancy',
            value_template: '{{ value_json.occupancy }}', device: {identifiers: ['0xdead'], name: 'PIR'},
        }));
        disc.handleMessage('homeassistant/sensor/oc1/batt/config', buf({
            name: 'Battery', state_topic: 'zigbee2mqtt/oc1', device_class: 'battery',
            value_template: '{{ value_json.battery }}', device: {identifiers: ['0xdead'], name: 'PIR'},
        }));

        const occ = disc.getDiscoveredEntity('binary_sensor/oc1/occ');
        expect(occ.config.battery_low_normalized).toEqual({
            topic: 'zigbee2mqtt/oc1',
            property: 'payload.battery',
        });
    });

    it('no battery sibling → no record; devices without identifiers are skipped', () => {
        disc.handleMessage('homeassistant/binary_sensor/solo/x/config', buf({
            name: 'Contact', state_topic: 'z/solo', device_class: 'door',
            device: {identifiers: ['0xsolo']},
        }));
        expect(disc.getDiscoveredEntity('binary_sensor/solo/x').config.battery_low_normalized).toBeUndefined();

        disc.handleMessage('homeassistant/binary_sensor/nodev/x/config', buf({
            name: 'NoDev', state_topic: 'z/nodev', device_class: 'motion',
        }));
        expect(disc.getDiscoveredEntity('binary_sensor/nodev/x').config.battery_low_normalized).toBeUndefined();
    });

    it('availability templates accept the bracket form too (shared parser)', () => {
        disc.handleMessage('homeassistant/binary_sensor/av1/x/config', buf({
            name: 'X', state_topic: 'z/av1', device_class: 'motion',
            availability: [{topic: 'z/av1/avail', value_template: '{{ value_json["state"] }}'}],
        }));
        const e = disc.getDiscoveredEntity('binary_sensor/av1/x');
        expect(e.config.availability_normalized.entries).toEqual([
            {topic: 'z/av1/avail', property: 'payload.state'},
        ]);
    });
});

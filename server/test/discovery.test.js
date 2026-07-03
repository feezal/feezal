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

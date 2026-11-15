/**
 * E193 — a dashboard stamped from zigbee2mqtt's own device list wires the same
 * topics and properties as one stamped from its Home Assistant discovery.
 *
 * The server promotes the native entities (server/src/mqtt/recognizers/
 * zigbee2mqtt.js); the elements consume them through the same discovery maps
 * as the discovery copies. This test replays the pair of the server's fixtures
 * (a device list, and the discovery zigbee2mqtt 2.14.3 itself generates for
 * it), lets the server pair every announced entity with the native one that
 * replaces it, stamps BOTH onto the real element and compares the attributes.
 *
 * The native stamp may say MORE (that is the point of reading the exposes: the
 * property of a thermostat's setpoint, a cover's movement). It must never say
 * something else — except where the discovery copy is known to be wrong for
 * feezal, listed in BETTER below with the reason.
 */
import {describe, it, expect, beforeAll} from 'vitest';
import {createRequire} from 'module';

import {stampDiscovery, resolveElementTag, discoveryLabel} from '../src/feezal-discovery-stamp.js';

const require = createRequire(import.meta.url);
const discovery = require('../../server/src/mqtt/discovery.js');
const {mergeDiscovery} = require('../../server/src/mqtt/discovery-merge.js');
const F = '../../server/test/fixtures/zigbee2mqtt/';
const devices = require(F + 'bridge-devices.json');
const groups = require(F + 'bridge-groups.json');
const announced = require(F + 'discovery.json');

const buf = v => Buffer.from(JSON.stringify(v));
const attrs = el => Object.fromEntries([...el.attributes].map(a => [a.name, a.value]));

/** element per component, the way the Generate wizard resolves it (glass first) */
const FAMILIES = ['glass', 'material', 'panel'];
const tagFor = e => {
    for (const family of FAMILIES) {
        const tag = resolveElementTag(e.component, family, e.config.device_class);
        if (tag) return tag;
    }
    return null;
};

let pairs;      // [{copy, native, tag}]

beforeAll(async () => {
    globalThis.feezal ??= {isEditor: true, connection: {sub() {}, unsub() {}, pub() {}}};
    await Promise.all([
        'glass-light', 'glass-switch', 'glass-cover', 'glass-climate', 'glass-lock', 'glass-fan', 'glass-contact',
        'glass-motion', 'glass-sensor', 'glass-value', 'glass-button', 'material-select', 'panel-knob', 'material-input',
    ].map(n => import(`../packages/@feezal/feezal-element-${n}/feezal-element-${n}.js`)));

    discovery.clearEntities();
    for (const m of announced) discovery.handleMessage(m.topic, buf(m.payload));
    const copies = discovery.getDiscoveredEntities();
    discovery.clearEntities();
    discovery.handleMessage('zigbee2mqtt/bridge/groups', buf(groups));
    discovery.handleMessage('zigbee2mqtt/bridge/devices', buf(devices));
    const natives = discovery.getDiscoveredEntities();
    discovery.clearEntities();

    const {omitted} = mergeDiscovery(copies, natives, {});
    const byId = new Map(natives.map(e => [e.discovery_id, e]));
    pairs = [];
    for (const copy of copies) {
        let native = byId.get(omitted.get(copy.discovery_id));
        if (!native) continue;
        // scenes share one command topic: the pair is the one with the same payload
        if (copy.component === 'scene') {
            native = natives.find(n => n.component === 'scene' && n.config.command_topic === copy.config.command_topic
                && n.config.payload_on === copy.config.payload_on);
        }
        // a value the thermostat card shows is covered by the climate entity; nothing to compare
        if (native.component !== copy.component) continue;
        pairs.push({copy, native, tag: tagFor(copy)});
    }
});

const stamp = (tag, entity) => {
    const el = document.createElement(tag);
    expect(stampDiscovery(el, entity), `${tag} takes ${entity.discovery_id}`).toBe(true);
    return attrs(el);
};

// Where the native stamp differs from the discovery copy's ON PURPOSE.
const BETTER = {
    // the copy's label is the bare expose name ("Detection period") or, for a
    // main entity, derived from the topic; the native one names device + function
    label: () => true,
    'discovery-id': () => true,
    // zigbee2mqtt's discovery picks an `mdi:` icon for some settings and
    // counters from a table of its own; the device list has no icon, so the
    // card keeps its default one
    icon: (a, b) => b.icon === undefined,
    // the copy's `action_topic` carries the running state as a WORD (idle /
    // heat) behind a template; stamped as the valve it reads no number. The
    // native entity stamps a valve only where the thermostat reports a percentage
    'subscribe-valve': (a, b) => b['subscribe-valve'] === undefined,
};

describe('E193 — stamped from the device list = stamped from the discovery', () => {
    it('pairs every component the device list has a function for', () => {
        const count = {};
        for (const p of pairs) count[p.copy.component] = (count[p.copy.component] || 0) + 1;
        expect(count).toEqual({
            light: 12, switch: 32, cover: 2, climate: 1, fan: 1, lock: 3,
            binary_sensor: 14, sensor: 137, number: 29, select: 36, button: 1, scene: 3,
        });
        expect(pairs.filter(p => !p.tag).map(p => p.copy.component)).toEqual([]);
    });

    for (const component of ['light', 'switch', 'cover', 'climate', 'fan', 'lock', 'binary_sensor', 'sensor', 'number', 'select', 'button', 'scene']) {
        it(`${component}: every attribute the discovery copy stamps, the native entity stamps the same`, () => {
            const mine = pairs.filter(p => p.copy.component === component);
            expect(mine.length).toBeGreaterThan(0);
            const differences = [];
            for (const {copy, native, tag} of mine) {
                // the same card for both
                expect(tagFor(native), native.discovery_id).toBe(tag);
                const a = stamp(tag, copy);
                const b = stamp(tag, native);
                for (const [name, value] of Object.entries(a)) {
                    if (BETTER[name]?.(a, b)) continue;
                    if (b[name] !== value) differences.push(`${copy.discovery_id} ${name}: discovery ${JSON.stringify(value)} — native ${JSON.stringify(b[name])}`);
                }
            }
            expect(differences).toEqual([]);
        });
    }

    it('says more where the discovery only has a template feezal cannot read', () => {
        const of = id => pairs.find(p => p.copy.discovery_id === id);
        const climate = of('climate/0x00124b000000010b/climate');
        const c = stamp(climate.tag, climate.native);
        expect(c['message-property-setpoint']).toBe('payload.current_heating_setpoint');
        expect(c['message-property-actual']).toBe('payload.local_temperature');
        expect(c['message-property-mode']).toBe('payload.system_mode');
        expect(stamp(climate.tag, climate.copy)['message-property-setpoint']).toBeUndefined();

        const cover = of('cover/0x00124b0000000109/cover');
        const v = stamp(cover.tag, cover.native);
        expect(v['subscribe-direction']).toBe('zigbee2mqtt/Window shutter');
        expect(v['message-property-direction']).toBe('payload.moving');

        // a fan's numbered speeds: the copy maps them through a template table
        const fan = of('fan/0x00124b0000000123/fan');
        expect(stamp(fan.tag, fan.copy)['message-property-speed']).toBeUndefined();
        expect(stamp(fan.tag, fan.native)).toMatchObject({'message-property-speed': 'payload.fan_mode', 'speed-range-max': '9'});

        // a boolean setting: the copy's template is an if/else feezal does not map
        const sw = of('switch/0x00124b0000000106/switch_trigger_indicator');
        expect(stamp(sw.tag, sw.copy)['message-property']).toBeUndefined();
        expect(stamp(sw.tag, sw.native)['message-property']).toBe('payload.trigger_indicator');
    });

    it('a door lock stamped from the device list is a working lock card (E144)', () => {
        const lock = pairs.find(p => p.copy.discovery_id === 'lock/0x00124b0000000124/lock');
        expect(lock.tag).toBe('feezal-element-glass-lock');
        const a = stamp(lock.tag, lock.native);
        expect(a).toMatchObject({
            subscribe: 'zigbee2mqtt/Front door lock', 'message-property': 'payload.state',
            'payload-locked': 'LOCK', 'payload-unlocked': 'UNLOCK',
            publish: 'zigbee2mqtt/Front door lock/set', 'payload-lock': 'LOCK', 'payload-unlock': 'UNLOCK',
            'subscribe-battery-low': 'zigbee2mqtt/Front door lock', 'message-property-battery-low': 'payload.battery_low',
            'payload-battery-low': 'true',
            'subscribe-availability': JSON.stringify([{topic: 'zigbee2mqtt/bridge/state', property: 'payload.state'}]),
            label: 'Front Door Lock',
        });
        // no Open button: a zigbee lock has no latch release
        expect(a['payload-open']).toBeUndefined();
        // the copy says less: no battery (zigbee2mqtt's discovery does not link it to the lock)
        expect(stamp(lock.tag, lock.copy)['subscribe-battery-low']).toBeUndefined();
    });

    it('labels every row with its device and function, under the Zigbee2MQTT source', () => {
        const native = id => pairs.find(p => p.native.discovery_id === id).native;
        expect(discoveryLabel(native('z2m:zigbee2mqtt:0x00124b0000000101:temperature'))).toBe('Zigbee2MQTT: Climate sensor temperature');
        expect(discoveryLabel(native('z2m:zigbee2mqtt:0x00124b0000000101:humidity'))).toBe('Zigbee2MQTT: Climate sensor humidity');
        expect(discoveryLabel(native('z2m:zigbee2mqtt:0x00124b000000010e:light'))).toBe('Zigbee2MQTT: Gledopto RGBCTT light I');
    });
});

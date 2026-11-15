/**
 * A40 — the registry reads Home Assistant discovery with mqtt-ha-entities'
 * DiscoveryStore instead of feezal's own parser.
 *
 * What must NOT change: the `discovery_id`s (saved dashboards hold them) and
 * the entity shape the front-end reads. What changes on purpose — each was a
 * defect of the old parser, confirmed against it before it was removed — has a
 * test here.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';
import {readFileSync, readdirSync} from 'fs';
import {fileURLToPath} from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const disc = require('../src/mqtt/discovery.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const corpusDir = path.join(here, 'fixtures', 'ha-discovery');
const buf = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v));
const ids = () => disc.getDiscoveredEntities().filter(e => !e.source).map(e => e.discovery_id).sort();
const feed = messages => { for (const m of messages) disc.handleMessage(m.topic, buf(m.payload)); };

beforeEach(() => disc.clearEntities());

describe('A40 — the same ids as feezal 5.7.2 for the corpus', () => {
    const before = JSON.parse(readFileSync(path.join(corpusDir, 'ids-5.7.2.json'), 'utf8'));
    const files = readdirSync(corpusDir).filter(f => f.endsWith('.json') && !f.startsWith('ids-')).sort();

    it('the corpus is the one the ids were recorded for', () => {
        expect([...files, 'hm2mqtt-pair.json'].sort()).toEqual(Object.keys(before).sort());
        expect(Object.values(before).flat().length).toBe(811);
    });

    for (const file of files) {
        it(file, () => {
            feed(JSON.parse(readFileSync(path.join(corpusDir, file), 'utf8')));
            expect(ids()).toEqual(before[file]);
        });
    }

    it('hm2mqtt-pair.json (the device-based form, 22 configs)', () => {
        feed(require('./fixtures/hm2mqtt-pair.json').discovery);
        expect(ids()).toEqual(before['hm2mqtt-pair.json']);
    });

    it('keeps the entity shape the front-end reads', () => {
        feed(JSON.parse(readFileSync(path.join(corpusDir, 'zigbee2mqtt.json'), 'utf8')));
        const e = disc.getDiscoveredEntity('binary_sensor/0x00124b0000000003/replace_filter');
        expect(Object.keys(e).sort()).toEqual(['component', 'config', 'discovery_id', 'name', 'node_id', 'object_id', 'unique_id']);
        expect(e).toMatchObject({component: 'binary_sensor', node_id: '0x00124b0000000003', object_id: 'replace_filter'});
        expect(e.config.device.identifiers).toEqual(['zigbee2mqtt_0x00124b0000000003']);
        expect(e.config.availability_normalized).toEqual({
            entries: [
                {topic: 'zigbee2mqtt/bridge/state', property: 'payload.state'},
                {topic: 'zigbee2mqtt/starkvind/availability', property: 'payload.state'},
            ],
            mode: 'all',
        });
    });
});

describe('A40 — a config topic announces what its LAST payload says', () => {
    const device = (cmps) => buf({dev: {ids: ['d1'], name: 'D1'}, cmps});

    it('a device config published again with fewer components drops the others', () => {
        // the old parser only ever added: `sensor/d1/b` stayed until the broker reconnected
        disc.handleMessage('homeassistant/device/d1/config', device({a: {p: 'switch', stat_t: 'x/a'}, b: {p: 'sensor', stat_t: 'x/b'}}));
        expect(ids()).toEqual(['sensor/d1/b', 'switch/d1/a']);
        disc.handleMessage('homeassistant/device/d1/config', device({a: {p: 'switch', stat_t: 'x/a'}}));
        expect(ids()).toEqual(['switch/d1/a']);
    });

    it('a component reduced to its platform is removed (how Home Assistant is told to drop one)', () => {
        disc.handleMessage('homeassistant/device/d1/config', device({a: {p: 'switch', stat_t: 'x/a'}, b: {p: 'sensor', stat_t: 'x/b'}}));
        disc.handleMessage('homeassistant/device/d1/config', device({a: {p: 'switch', stat_t: 'x/a'}, b: {p: 'sensor'}}));
        expect(ids()).toEqual(['switch/d1/a']);
    });

    it('clearing a device config leaves the per-entity configs of the same node alone', () => {
        // the old parser removed every id containing `/<node_id>/`
        disc.handleMessage('homeassistant/sensor/n1/temp/config', buf({name: 'T', stat_t: 'y/t'}));
        disc.handleMessage('homeassistant/device/n1/config', device({a: {p: 'switch', stat_t: 'x/a'}}));
        expect(ids()).toEqual(['sensor/n1/temp', 'switch/n1/a']);
        disc.handleMessage('homeassistant/device/n1/config', '');
        expect(ids()).toEqual(['sensor/n1/temp']);
    });

    it('…and clearing a per-entity config leaves the device config of that node alone', () => {
        disc.handleMessage('homeassistant/sensor/n1/temp/config', buf({name: 'T', stat_t: 'y/t'}));
        disc.handleMessage('homeassistant/device/n1/config', device({a: {p: 'switch', stat_t: 'x/a'}}));
        disc.handleMessage('homeassistant/sensor/n1/temp/config', '');
        expect(ids()).toEqual(['switch/n1/a']);
    });

    it('a payload that is not a JSON object leaves what the topic announced', () => {
        disc.handleMessage('homeassistant/sensor/w/config', buf({stat_t: 's'}));
        disc.handleMessage('homeassistant/sensor/w/config', '[1,2]');
        disc.handleMessage('homeassistant/sensor/w/config', '{not json');
        expect(disc.getDiscoveredEntity('sensor/w').config.state_topic).toBe('s');
    });
});

describe('A40 — read as Home Assistant reads it', () => {
    it('a component of a device config resolves its own `~`', () => {
        // AWTRIX announces every component with a `~` of its own; the old parser
        // knew only a `~` at the root and left "~/state/device" in the topics
        disc.handleMessage('homeassistant/device/aa01/config', buf({
            dev: {ids: ['aa01'], name: 'Clock'},
            cmps: {mat: {'~': 'awtrix', p: 'light', stat_t: '~/state/device', cmd_t: '~/cmd/display', avty: [{t: '~/online'}]}},
        }));
        const cfg = disc.getDiscoveredEntity('light/aa01/mat').config;
        expect(cfg.state_topic).toBe('awtrix/state/device');
        expect(cfg.command_topic).toBe('awtrix/cmd/display');
        expect(cfg.availability_normalized.entries).toEqual([{topic: 'awtrix/online'}]);
    });

    it('`~` is a base topic only at the start or end of a topic — a template keeps its `~`', () => {
        // Jinja's concatenation operator; the old parser replaced every `~` in every string
        disc.handleMessage('homeassistant/sensor/j/config', buf({
            '~': 'base', stat_t: '~/s', json_attr_t: 'attrs/~', val_tpl: "{{ value_json.a ~ ' ' ~ value_json.b }}",
        }));
        const cfg = disc.getDiscoveredEntity('sensor/j').config;
        expect(cfg.state_topic).toBe('base/s');
        expect(cfg.json_attributes_topic).toBe('attrs/base');
        expect(cfg.value_template).toBe("{{ value_json.a ~ ' ' ~ value_json.b }}");
    });

    it('knows the whole abbreviation table — `en`, `stat_cla`, `tilt_status_t`, the device and origin blocks', () => {
        // `en: false` is how mqtt-interfaces-core's adapters mark an entity as
        // disabled by default; unexpanded, the Generate wizard's housekeeping
        // filter (enabled_by_default === false) never saw it
        disc.handleMessage('homeassistant/device/hm_x/config', buf({
            dev: {ids: ['hm_x'], name: 'Blind', mf: 'eQ-3', mdl: 'M', sn: 'S1', sa: 'Hall'},
            o: {name: 'hm2mqtt', sw: '3.10.1', url: 'https://example.invalid'},
            cmps: {
                rssi: {p: 'sensor', stat_t: 'hm/status/x/RSSI', stat_cla: 'measurement', en: false},
                blind: {p: 'cover', pos_t: 'hm/status/x/LEVEL', tilt_status_t: 'hm/status/x/LEVEL_2', tilt_status_tpl: '{{ value_json.val }}'},
            },
        }));
        const rssi = disc.getDiscoveredEntity('sensor/hm_x/rssi').config;
        expect(rssi.enabled_by_default).toBe(false);
        expect(rssi.state_class).toBe('measurement');
        expect(rssi.device).toEqual({identifiers: ['hm_x'], name: 'Blind', manufacturer: 'eQ-3', model: 'M', serial_number: 'S1', suggested_area: 'Hall'});
        expect(rssi.origin).toEqual({name: 'hm2mqtt', sw_version: '3.10.1', support_url: 'https://example.invalid'});
        const blind = disc.getDiscoveredEntity('cover/hm_x/blind').config;
        expect(blind.tilt_status_topic).toBe('hm/status/x/LEVEL_2');
        expect(blind.tilt_status_template).toBe('{{ value_json.val }}');
    });

    it('a device config carries only what its components share, not the whole payload', () => {
        disc.handleMessage('homeassistant/device/d2/config', buf({
            dev: {ids: ['d2']}, avty_t: 'd2/online', qos: 1,
            cmps: {a: {p: 'switch', stat_t: 'x/a'}, b: {p: 'sensor', stat_t: 'x/b'}},
        }));
        const cfg = disc.getDiscoveredEntity('switch/d2/a').config;
        expect(cfg.availability_normalized.entries).toEqual([{topic: 'd2/online'}]);
        expect(cfg.qos).toBe(1);
        expect(cfg.components).toBeUndefined();      // the old parser copied every sibling into every entity
    });

    it('reads a device config whose topic has a node id', () => {
        // homeassistant/device/<node_id>/<object_id>/config — the old parser ignored it
        disc.handleMessage('homeassistant/device/node/obj/config', buf({dev: {ids: ['x']}, cmps: {a: {p: 'switch', stat_t: 'x/a'}}}));
        expect(ids()).toEqual(['switch/node/obj/a']);
        expect(disc.getDiscoveredEntity('switch/node/obj/a')).toMatchObject({node_id: 'node/obj', object_id: 'a'});
    });

    it('a `~` at the root of a device config still reaches the components (feezal\'s own leniency)', () => {
        disc.handleMessage('homeassistant/device/d3/config', buf({
            '~': 'esp', dev: {ids: ['d3']},
            cmps: {relay: {p: 'switch', stat_t: '~/relay'}, own: {'~': 'other', p: 'sensor', stat_t: '~/v'}, gone: {p: 'sensor'}},
        }));
        expect(ids()).toEqual(['sensor/d3/own', 'switch/d3/relay']);
        expect(disc.getDiscoveredEntity('switch/d3/relay').config.state_topic).toBe('esp/relay');
        expect(disc.getDiscoveredEntity('sensor/d3/own').config.state_topic).toBe('other/v');
    });

    it('keeps one registry per discovery prefix and forgets all of them on clear', () => {
        disc.handleMessage('custom/switch/a/config', buf({stat_t: 'a'}), 'custom');
        disc.handleMessage('homeassistant/switch/b/config', buf({stat_t: 'b'}));
        disc.handleMessage('custom/switch/c/config', buf({stat_t: 'c'}));      // not under the default prefix
        expect(ids()).toEqual(['switch/a', 'switch/b']);
        disc.clearEntities();
        expect(ids()).toEqual([]);
    });
});

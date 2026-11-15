/**
 * E192 — every device is offered once.
 *
 * A source may be in both discovery registries: hm2mqtt 3 announces every
 * Homematic device with Home Assistant discovery, and the homematic recognizer
 * reads the very same topics. The list must offer each function once (the
 * native entity wins), the native entity must carry the room and the device
 * block of the announced copy, and nothing may be left out that no recognizer
 * covers — in particular not the single functions a media adapter announces
 * next to the recognizer's media entity.
 *
 * The first block replays a recorded pair generated from hm2mqtt's own code
 * (fixtures/hm2mqtt-pair.json, see hm2mqtt-pair.generate.mjs): the device
 * configs it announces and the status messages of the same devices.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const discovery = require('../src/mqtt/discovery.js');
const {mergeDiscovery, topicUses, claimsOf} = require('../src/mqtt/discovery-merge.js');
const pair = require('./fixtures/hm2mqtt-pair.json');

const buf = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v));
const isHousekeeping = e => Boolean(e.config.entity_category) || e.config.enabled_by_default === false || e.config.en === false;

function replayPair() {
    const now = Date.now();
    for (const m of pair.discovery) discovery.handleMessage(m.topic, buf(m.payload));
    for (const m of pair.status) discovery.handleMessage(m.topic, buf({val: m.val, ts: now, lc: now, hm: m.hm}));
}

beforeEach(() => discovery.clearEntities());

describe('E192 — hm2mqtt 3: native topics and the announced device configs', () => {
    beforeEach(replayPair);

    it('the pair really doubles: both registries hold the same functions', () => {
        // The premise of the rule — if hm2mqtt stops announcing, or the recognizer
        // stops promoting, this file tests nothing.
        const all = discovery.getDiscoveredEntities();
        expect(all.filter(e => e.source === 'homematic')).toHaveLength(19);
        expect(all.filter(e => !e.source).length).toBeGreaterThan(400);
        // the dimmer is announced as a light on the topics the native light reads
        const copy = discovery.getDiscoveredEntity('light/hm2mqtt_hm_TEQ0000001/1_LEVEL');
        const native = discovery.getDiscoveredEntity('hm-light:TEQ0000001:1');
        expect(copy.config.brightness_state_topic).toBe(native.config.brightness_state_topic);
        expect(copy.config.brightness_command_topic).toBe(native.config.brightness_command_topic);
    });

    it('offers every native function once: no announced entity is left on a topic a native entity covers', () => {
        const all = discovery.getDiscoveredEntities();
        const natives = all.filter(e => e.source === 'homematic');
        const announced = all.filter(e => !e.source);
        const covered = new Map();
        for (const n of natives) for (const u of topicUses(n.config)) covered.set(u.topic, n.discovery_id);

        const doubles = announced
            .filter(e => topicUses(e.config).some(u => covered.has(u.topic)))
            .map(e => e.discovery_id);
        expect(doubles).toEqual([]);

        // exactly the copies of the native entities are gone, each id once
        const ids = all.map(e => e.discovery_id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const gone of [
            'light/hm2mqtt_hm_TEQ0000001/1_LEVEL',          // BidCoS dimmer
            'cover/hm2mqtt_hm_TEQ0000002/1_LEVEL',          // BidCoS blind
            'climate/hm2mqtt_hm_TEQ0000003/4_CLIMATE',      // BidCoS radiator thermostat
            'sensor/hm2mqtt_hm_TEQ0000003/4_VALVE_STATE',   // … its valve, which the climate entity reads
            'climate/hm2mqtt_hm_TEQ0000004/2_CLIMATE',      // BidCoS wall thermostat
            'binary_sensor/hm2mqtt_hm_TEQ0000005/1_STATE',  // window contact
            'switch/hm2mqtt_hm_TEQ0000006/1_STATE',         // plug
            'lock/hm2mqtt_hm_TEQ0000008/1_STATE',           // lock
            'binary_sensor/hm2mqtt_hm_TEQ0000009/1_STATE',  // smoke detector
            'binary_sensor/hm2mqtt_hm_TEQ0000011/1_MOTION', // motion detector
            'climate/hm2mqtt_hm_0000AAAA000002/1_CLIMATE',  // HmIP wall thermostat
            'light/hm2mqtt_hm_0000AAAA000004/4_LEVEL',      // HmIP dimmer: state on :3, command on :4
            'cover/hm2mqtt_hm_0000AAAA000007/4_LEVEL',      // HmIP blind
            'switch/hm2mqtt_hm_0000AAAA000008/3_STATE',     // HmIP plug
            'climate/hm2mqtt_hm_INT0000001/1_CLIMATE',      // heating group
            'binary_sensor/hm2mqtt_hm_INT0000001/3_STATE',  // … and its window state
        ]) {
            expect(ids, gone).not.toContain(gone);
        }
    });

    it('keeps every announced function no recognizer covers', () => {
        const offered = discovery.getDiscoveredEntities()
            .filter(e => !e.source && !isHousekeeping(e))
            .map(e => e.discovery_id)
            .sort();
        expect(offered).toEqual([
            // the HmIP switch actuator is not named like a plug or a lamp, so the
            // recognizer does not promote it — the announced switch is its only offer
            'switch/hm2mqtt_hm_0000AAAA000005/4_STATE',
            // energy meters
            'sensor/hm2mqtt_hm_0000AAAA000005/7_CURRENT',
            'sensor/hm2mqtt_hm_0000AAAA000005/7_ENERGY_COUNTER',
            'sensor/hm2mqtt_hm_0000AAAA000005/7_POWER',
            'sensor/hm2mqtt_hm_0000AAAA000005/7_VOLTAGE',
            'sensor/hm2mqtt_hm_0000AAAA000008/6_CURRENT',
            'sensor/hm2mqtt_hm_0000AAAA000008/6_ENERGY_COUNTER',
            'sensor/hm2mqtt_hm_0000AAAA000008/6_POWER',
            'sensor/hm2mqtt_hm_0000AAAA000008/6_VOLTAGE',
            'sensor/hm2mqtt_hm_TEQ0000007/2_CURRENT',
            'sensor/hm2mqtt_hm_TEQ0000007/2_ENERGY_COUNTER',
            'sensor/hm2mqtt_hm_TEQ0000007/2_POWER',
            'sensor/hm2mqtt_hm_TEQ0000007/2_VOLTAGE',
            // the weather station
            'binary_sensor/hm2mqtt_hm_TEQ0000010/1_RAINING',
            'sensor/hm2mqtt_hm_TEQ0000010/1_BRIGHTNESS',
            'sensor/hm2mqtt_hm_TEQ0000010/1_HUMIDITY',
            'sensor/hm2mqtt_hm_TEQ0000010/1_RAIN_COUNTER',
            'sensor/hm2mqtt_hm_TEQ0000010/1_SUNSHINEDURATION',
            'sensor/hm2mqtt_hm_TEQ0000010/1_TEMPERATURE',
            'sensor/hm2mqtt_hm_TEQ0000010/1_WIND_DIRECTION',
            'sensor/hm2mqtt_hm_TEQ0000010/1_WIND_SPEED',
            // values next to a function the recognizer reads, on topics it does not read
            'sensor/hm2mqtt_hm_0000AAAA000004/0_ACTUAL_TEMPERATURE',
            'sensor/hm2mqtt_hm_0000AAAA000005/0_ACTUAL_TEMPERATURE',
            'sensor/hm2mqtt_hm_0000AAAA000006/1_VALVE_STATE',
            'sensor/hm2mqtt_hm_0000AAAA000007/0_ACTUAL_TEMPERATURE',
            'sensor/hm2mqtt_hm_0000AAAA000008/0_ACTUAL_TEMPERATURE',
            'sensor/hm2mqtt_hm_INT0000001/1_VALVE_STATE',
            'sensor/hm2mqtt_hm_TEQ0000004/1_TEMPERATURE',
            'sensor/hm2mqtt_hm_TEQ0000011/1_BRIGHTNESS',
        ].sort());
    });

    it('every native entity takes over the room and the device block of its announced copy', () => {
        const natives = discovery.getDiscoveredEntities().filter(e => e.source === 'homematic');
        const rooms = Object.fromEntries(natives.map(e => [e.discovery_id, e.config.device?.suggested_area]));
        expect(rooms).toEqual({
            'hm-light:TEQ0000001:1': 'Living Room',
            'hm-cover:TEQ0000002:1': 'Living Room',
            'hm-climate:TEQ0000003': 'Bedroom',
            'hm-climate:TEQ0000004': 'Bedroom',
            'hm-contact:TEQ0000005': 'Kitchen',
            'hm-switch:TEQ0000006:1': 'Kitchen',
            'hm-switch:TEQ0000007:1': 'Office',
            'hm-lock:TEQ0000008': 'Hallway',
            'hm-sensor:TEQ0000009': 'Hallway',
            'hm-sensor:TEQ0000011': 'Hallway',
            'hm-contact:0000AAAA000001': 'Bathroom',
            'hm-climate:0000AAAA000002': 'Office',
            'hm-contact:0000AAAA000003': 'Office',
            'hm-light:0000AAAA000004:c4': 'Dining Room',
            'hm-climate:0000AAAA000006': 'Office',
            'hm-cover:0000AAAA000007:c4': 'Dining Room',
            'hm-switch:0000AAAA000008:c3': 'Bathroom',
            'hm-climate:INT0000001': 'Office',
            'hm-contact:INT0000001': 'Office',
        });

        const dimmer = natives.find(e => e.discovery_id === 'hm-light:TEQ0000001:1');
        expect(dimmer.config.device).toMatchObject({
            identifiers: ['hm2mqtt_hm_TEQ0000001'],
            name: 'Living Room Dimmer',
            manufacturer: 'eQ-3',
            model: 'HM-LC-Dim1TPBU-FM',
            via_device: 'hm2mqtt_hm',
        });
        // what the recognizer knows better stays the recognizer's
        expect(dimmer.config.brightness_state_topic).toBe('hm/status/Living Room Dimmer:1/LEVEL');
        expect(dimmer.sourceLabel).toBe('hm');
    });

    it('the device groups carry the native entities and their room (the App generator joins on them)', () => {
        const groups = new Map(discovery.getDeviceGroups().map(g => [g.deviceId, g]));
        const blind = groups.get('hm2mqtt_hm_0000AAAA000007');
        expect(blind.area).toBe('Dining Room');
        expect(blind.entities.map(e => e.discovery_id)).toContain('hm-cover:0000AAAA000007:c4');
        expect(blind.entities.map(e => e.discovery_id)).not.toContain('cover/hm2mqtt_hm_0000AAAA000007/4_LEVEL');

        // the wizard's join: entity → device.identifiers[0] → group.area
        for (const e of discovery.getDiscoveredEntities().filter(x => x.source === 'homematic')) {
            const group = groups.get(e.config.device.identifiers[0]);
            expect(group?.area, e.discovery_id).toBe(e.config.device.suggested_area);
        }
    });

    it('a single lookup agrees with the list, and an id a saved dashboard holds still resolves', () => {
        expect(discovery.getDiscoveredEntity('hm-climate:TEQ0000003').config.device.suggested_area).toBe('Bedroom');
        // left out of the list, but not forgotten
        const copy = discovery.getDiscoveredEntity('climate/hm2mqtt_hm_TEQ0000003/4_CLIMATE');
        expect(copy?.component).toBe('climate');
        expect(discovery.getDiscoveredEntity('nope')).toBeNull();
    });

    it('when the announcement is withdrawn the native entity stays and the room goes', () => {
        discovery.handleMessage('homeassistant/device/hm2mqtt_hm_TEQ0000003/config', '');
        const e = discovery.getDiscoveredEntity('hm-climate:TEQ0000003');
        expect(e).toBeTruthy();
        expect(e.config.device).toBeUndefined();
    });
});

describe('E192 — nothing is left out because of where it comes from', () => {
    // wiim2mqtt announces single functions of the speaker (volume as a number,
    // mute as a switch, …) on the topics the recognizer's media entity reads.
    const announce = () => discovery.handleMessage('homeassistant/device/wiim2mqtt_wiim/config', buf({
        dev: {ids: ['wiim2mqtt_wiim'], name: 'Kitchen Speaker', mf: 'Linkplay', mdl: 'WiiM Mini', sa: 'Kitchen'},
        o: {name: 'wiim2mqtt', sw: '1.1.1'},
        avty: [{t: 'wiim/connected', val_tpl: "{{ 'online' if (value | int(0)) >= 2 else 'offline' }}"}],
        cmps: {
            volume: {p: 'number', uniq_id: 'wiim2mqtt_wiim_volume', name: 'Volume', stat_t: 'wiim/status/volume',
                val_tpl: '{{ value_json.val }}', cmd_t: 'wiim/set/volume', min: 0, max: 100, step: 1},
            mute: {p: 'switch', uniq_id: 'wiim2mqtt_wiim_mute', name: 'Mute', stat_t: 'wiim/status/mute',
                val_tpl: '{{ value_json.val }}', cmd_t: 'wiim/set/mute', pl_on: 'true', pl_off: 'false'},
            source: {p: 'select', uniq_id: 'wiim2mqtt_wiim_source', name: 'Source', stat_t: 'wiim/status/source',
                val_tpl: '{{ value_json.val }}', cmd_t: 'wiim/set/source', options: ['wifi', 'bluetooth']},
        },
    }));

    it('the single functions a media adapter announces stay on offer next to the media entity', () => {
        announce();
        discovery.handleMessage('wiim/status/play_state', buf({val: 'playing', ts: 1, lc: 1}));

        const ids = discovery.getDiscoveredEntities().map(e => e.discovery_id);
        expect(ids).toEqual(expect.arrayContaining([
            'wiim:wiim', 'number/wiim2mqtt_wiim/volume', 'switch/wiim2mqtt_wiim/mute', 'select/wiim2mqtt_wiim/source',
        ]));
    });

    it('…and the media entity gets the room of the announced device all the same', () => {
        announce();
        discovery.handleMessage('wiim/status/play_state', buf({val: 'playing', ts: 1, lc: 1}));

        const media = discovery.getDiscoveredEntity('wiim:wiim');
        expect(media.config.device).toMatchObject({identifiers: ['wiim2mqtt_wiim'], name: 'Kitchen Speaker', suggested_area: 'Kitchen'});
        const group = discovery.getDeviceGroups().find(g => g.deviceId === 'wiim2mqtt_wiim');
        expect(group.area).toBe('Kitchen');
        expect(group.entities.map(e => e.discovery_id)).toContain('wiim:wiim');
    });
});

describe('E192 — the rule (mergeDiscovery)', () => {
    const announceable = new Set(['light', 'switch', 'sensor', 'binary_sensor', 'cover']);
    const ha = (id, component, config) => ({discovery_id: id, component, name: id, config});
    const device = (id, extra = {}) => ({identifiers: [id], name: id, ...extra});

    it('matches by the state topic or by the command topic, never by the availability topic', () => {
        const natives = [{discovery_id: 'n:1', component: 'switch', source: 'x',
            config: {state_topic: 'a/status/1', command_topic: 'a/set/1', availability_topic: 'a/connected'}}];
        const {entities, omitted} = mergeDiscovery([
            ha('switch/byState', 'switch', {state_topic: 'a/status/1', command_topic: 'other/set'}),
            ha('switch/byCommand', 'switch', {state_topic: 'other/status', command_topic: 'a/set/1'}),
            ha('sensor/sameBridge', 'sensor', {state_topic: 'a/status/2', availability_topic: 'a/connected'}),
        ], natives, {announceable});

        expect([...omitted]).toEqual([['switch/byState', 'n:1'], ['switch/byCommand', 'n:1']]);
        expect(entities.map(e => e.discovery_id)).toEqual(['sensor/sameBridge', 'n:1']);
    });

    it('a native entity of a component discovery cannot announce claims nothing', () => {
        const natives = [{discovery_id: 'n:media', component: 'media', source: 'x',
            config: {volume_topic: 'a/status/volume', volume_command_topic: 'a/set/volume'}}];
        const {omitted} = mergeDiscovery(
            [ha('number/volume', 'number', {state_topic: 'a/status/volume', command_topic: 'a/set/volume'})],
            natives, {announceable});
        expect(omitted.size).toBe(0);
        expect(claimsOf(natives[0], announceable)).toEqual([]);
    });

    it('one state topic for many functions: a claim by topic + property covers only the entity that reads that property', () => {
        // the shape of a zigbee2mqtt device: every attribute in one JSON state topic
        const natives = [{discovery_id: 'z:temp', component: 'sensor', source: 'z',
            config: {state_topic: 'z2m/sensor', value_template: '{{ value_json.temperature }}'},
            claims: [{topic: 'z2m/sensor', property: 'payload.temperature'}]}];
        const {entities, omitted} = mergeDiscovery([
            ha('sensor/temp', 'sensor', {state_topic: 'z2m/sensor', value_template: '{{ value_json.temperature }}'}),
            ha('sensor/tempBracket', 'sensor', {state_topic: 'z2m/sensor',
                value_template: '{% if "temperature" in value_json %}{{ value_json["temperature"] }}{% endif %}'}),
            ha('sensor/humidity', 'sensor', {state_topic: 'z2m/sensor', value_template: '{{ value_json.humidity }}'}),
            ha('sensor/computed', 'sensor', {state_topic: 'z2m/sensor', value_template: '{{ value_json.temperature | round(1) + 1 }}'}),
        ], natives, {announceable});

        expect([...omitted.keys()]).toEqual(['sensor/temp', 'sensor/tempBracket']);
        expect(entities.map(e => e.discovery_id)).toEqual(['sensor/humidity', 'sensor/computed', 'z:temp']);
    });

    it('a claim by topic + component covers the entity that reads the whole payload, and only that component', () => {
        const natives = [{discovery_id: 'z:lamp', component: 'light', source: 'z',
            config: {state_topic: 'z2m/lamp', command_topic: 'z2m/lamp/set', schema: 'json'},
            claims: [{topic: 'z2m/lamp', component: 'light'}]}];
        const {omitted} = mergeDiscovery([
            ha('light/lamp', 'light', {schema: 'json', state_topic: 'z2m/lamp', command_topic: 'z2m/lamp/set'}),
            ha('sensor/linkquality', 'sensor', {state_topic: 'z2m/lamp', value_template: '{{ value_json.linkquality }}'}),
            ha('select/effect', 'select', {state_topic: 'z2m/lamp', command_topic: 'z2m/lamp/set',
                value_template: '{{ value_json.effect }}'}),
        ], natives, {announceable});
        expect([...omitted.keys()]).toEqual(['light/lamp']);
    });

    it('explicit claims replace the default: an empty list claims nothing, a composite may claim', () => {
        const none = {discovery_id: 'n:1', component: 'switch', source: 'x', config: {state_topic: 't'}, claims: []};
        const composite = {discovery_id: 'n:2', component: 'media', source: 'x', config: {}, claims: [{topic: 't'}]};
        const list = [ha('switch/t', 'switch', {state_topic: 't'})];
        expect(mergeDiscovery(list, [none], {announceable}).omitted.size).toBe(0);
        expect(mergeDiscovery(list, [composite], {announceable}).omitted.get('switch/t')).toBe('n:2');
    });

    it('reads the property of each topic from the template that belongs to it', () => {
        expect(topicUses({
            state_topic: 's', value_template: '{{ value_json.state }}',
            brightness_state_topic: 'b', brightness_value_template: '{{ value_json.brightness }}',
            current_temperature_topic: 'c', current_temperature_template: '{{ value_json.local_temperature }}',
            temperature_state_topic: 'ts', temperature_state_template: "{{ value_json['occupied_heating_setpoint'] }}",
            preset_mode_state_topic: 'p', preset_mode_value_template: '{{ value_json.preset }}',
            position_topic: 'pos', position_template: '{{ (value_json.val | float(0)) * 100 }}',
            command_topic: 'cmd', command_template: '{{ value_json.x }}',
            topic: 'img',
            availability_topic: 'avail', json_attributes_topic: 'attrs',
            name: 'not a topic', device: {identifiers: ['d']},
        })).toEqual([
            {topic: 's', property: 'payload.state'},
            {topic: 'b', property: 'payload.brightness'},
            {topic: 'c', property: 'payload.local_temperature'},
            {topic: 'ts', property: 'payload.occupied_heating_setpoint'},
            {topic: 'p', property: 'payload.preset'},
            {topic: 'pos', property: undefined},
            {topic: 'cmd', property: undefined},
            {topic: 'img', property: undefined},
        ]);
    });

    it('takes the device block over without changing its inputs, and the native keys win', () => {
        const native = {discovery_id: 'n:1', component: 'switch', source: 'x',
            config: {state_topic: 't', device: {name: 'Mine'}}};
        const copy = ha('switch/t', 'switch', {state_topic: 't', device: device('dev1', {suggested_area: 'Hall', model: 'M'})});
        const {entities} = mergeDiscovery([copy], [native], {announceable});

        expect(entities).toHaveLength(1);
        expect(entities[0].config.device).toEqual({identifiers: ['dev1'], name: 'Mine', suggested_area: 'Hall', model: 'M'});
        expect(native.config.device).toEqual({name: 'Mine'});
        expect(copy.config.device.name).toBe('dev1');
    });

    it('takes no device block when the shared topics belong to two announced devices', () => {
        const native = {discovery_id: 'n:1', component: 'light', source: 'x',
            config: {state_topic: 't1', command_topic: 't2'}};
        const {entities} = mergeDiscovery([
            ha('light/a', 'light', {state_topic: 't1', device: device('devA', {suggested_area: 'A'})}),
            ha('light/b', 'light', {command_topic: 't2', device: device('devB', {suggested_area: 'B'})}),
        ], [native], {announceable});
        expect(entities).toEqual([native]);
    });

    it('is the plain concatenation when one side is empty', () => {
        const a = [ha('switch/t', 'switch', {state_topic: 't'})];
        const n = [{discovery_id: 'n:1', component: 'switch', source: 'x', config: {state_topic: 't'}}];
        expect(mergeDiscovery(a, [], {announceable}).entities).toEqual(a);
        expect(mergeDiscovery([], n, {announceable}).entities).toEqual(n);
    });
});

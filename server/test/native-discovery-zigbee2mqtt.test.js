/**
 * E193 — zigbee2mqtt's own device list (`<base>/bridge/devices`, `…/groups`,
 * `…/info`) as a discovery source: the devices appear without Home Assistant
 * discovery, and with it every function is offered once.
 *
 * The fixture is a pair (fixtures/zigbee2mqtt/README.md): a device list of 36
 * devices and 10 groups, and the discovery zigbee2mqtt 2.14.3's own code
 * publishes for exactly these — generated, not written by hand.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const discovery = require('../src/mqtt/discovery.js');
const {mergeDiscovery} = require('../src/mqtt/discovery-merge.js');
const devices = require('./fixtures/zigbee2mqtt/bridge-devices.json');
const groups = require('./fixtures/zigbee2mqtt/bridge-groups.json');
const announced = require('./fixtures/zigbee2mqtt/discovery.json');

const buf = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v));
const all = () => discovery.getDiscoveredEntities();
const natives = () => all().filter(e => e.source === 'zigbee2mqtt');
const get = suffix => all().find(e => e.source === 'zigbee2mqtt' && e.discovery_id.endsWith(suffix)) || null;
const bridge = (base = 'zigbee2mqtt') => {
    discovery.handleMessage(`${base}/bridge/groups`, buf(groups));
    discovery.handleMessage(`${base}/bridge/devices`, buf(devices));
};
const announce = (list = announced) => { for (const m of list) discovery.handleMessage(m.topic, buf(m.payload)); };
const strip = e => { const {device, availability_normalized, description, name, ...rest} = e.config; return rest; };

beforeEach(() => discovery.clearEntities());

describe('E193 — the devices appear without Home Assistant discovery', () => {
    beforeEach(() => bridge());

    it('promotes every function of the 36 devices and the 4 groups with members', () => {
        const count = {};
        for (const e of natives()) count[e.component] = (count[e.component] || 0) + 1;
        expect(count).toEqual({
            light: 12, switch: 32, cover: 2, climate: 1, fan: 1, lock: 3,
            binary_sensor: 14, sensor: 135, number: 29, select: 36, button: 1, scene: 3,
        });
        // the coordinator is no device, an empty group nothing to switch
        expect(natives().some(e => e.discovery_id.includes('0x00124b0000000100'))).toBe(false);
        expect(natives().some(e => e.discovery_id.includes(':group:1:'))).toBe(false);
        for (const e of natives()) expect(e.sourceLabel).toBe('Zigbee2MQTT');
    });

    it('a colour light is the JSON light the light cards know, with its ranges', () => {
        const e = get('0x00124b000000010e:light');
        expect(e.name).toBe('Gledopto RGBCTT light I');
        expect(strip(e)).toEqual({
            schema: 'json', brightness: true, brightness_scale: 254,
            supported_color_modes: ['xy', 'color_temp'], min_mireds: 158, max_mireds: 495,
            effect: true, effect_list: ['blink', 'breathe', 'okay', 'channel_change', 'finish_effect', 'stop_effect', 'colorloop', 'stop_colorloop'],
            state_topic: 'zigbee2mqtt/Gledopto RGBCTT light I',
            command_topic: 'zigbee2mqtt/Gledopto RGBCTT light I/set',
        });
    });

    it('several outputs of one device: a light per endpoint topic, a switch per property', () => {
        expect(strip(get('0x00124b000000011a:light_l1'))).toMatchObject({
            state_topic: 'zigbee2mqtt/Moes dimmer double/l1', command_topic: 'zigbee2mqtt/Moes dimmer double/l1/set',
            supported_color_modes: ['brightness'],
        });
        expect(strip(get('0x00124b0000000108:switch_l1'))).toEqual({
            state_topic: 'zigbee2mqtt/Aqara Dual relay module T2', value_template: '{{ value_json.state_l1 }}',
            command_topic: 'zigbee2mqtt/Aqara Dual relay module T2/l1/set', payload_on: 'ON', payload_off: 'OFF',
        });
        expect(get('0x00124b0000000108:switch_l2')).toBeTruthy();
    });

    it('a cover carries its position and its movement — no template to interpret', () => {
        expect(strip(get('0x00124b0000000109:cover'))).toEqual({
            state_topic: 'zigbee2mqtt/Window shutter', command_topic: 'zigbee2mqtt/Window shutter/set',
            state_open: 'OPEN', state_closed: 'CLOSE', state_stopped: 'STOP',
            position_topic: 'zigbee2mqtt/Window shutter', position_template: '{{ value_json.position }}',
            set_position_topic: 'zigbee2mqtt/Window shutter/set', set_position_template: '{ "position": {{ position }} }',
            // `moving` says UP / DOWN / STOP: the direction indicator of the cover card
            direction_topic: 'zigbee2mqtt/Window shutter', message_property_direction: 'payload.moving',
        });
    });

    it('a thermostat names the property of each value, so the climate card reads the state object', () => {
        expect(strip(get('0x00124b000000010b:climate'))).toEqual({
            temperature_state_topic: 'zigbee2mqtt/Moes thermo',
            temperature_state_template: '{{ value_json.current_heating_setpoint }}',
            message_property_setpoint: 'payload.current_heating_setpoint',
            temperature_command_topic: 'zigbee2mqtt/Moes thermo/set/current_heating_setpoint',
            temperature_unit: 'C', min_temp: '5', max_temp: '45', temp_step: 1,
            current_temperature_topic: 'zigbee2mqtt/Moes thermo',
            current_temperature_template: '{{ value_json.local_temperature }}',
            message_property_actual: 'payload.local_temperature',
            mode_state_topic: 'zigbee2mqtt/Moes thermo', mode_state_template: '{{ value_json.system_mode }}',
            message_property_mode: 'payload.system_mode',
            mode_command_topic: 'zigbee2mqtt/Moes thermo/set/system_mode', modes: ['off', 'heat'],
        });
    });

    it('a lock and a fan', () => {
        expect(strip(get('0x00124b000000010b:lock'))).toEqual({
            state_topic: 'zigbee2mqtt/Moes thermo', command_topic: 'zigbee2mqtt/Moes thermo/set',
            value_template: '{{ value_json.child_lock }}', state_locked: 'LOCK', state_unlocked: 'UNLOCK',
            payload_lock: 'LOCK', payload_unlock: 'UNLOCK',
        });
        expect(strip(get('0x00124b0000000123:fan'))).toEqual({
            state_topic: 'zigbee2mqtt/Air purifier', state_value_template: '{{ value_json.fan_state }}',
            command_topic: 'zigbee2mqtt/Air purifier/set/fan_state',
            preset_mode_state_topic: 'zigbee2mqtt/Air purifier', preset_mode_value_template: '{{ value_json.fan_mode }}',
            preset_mode_command_topic: 'zigbee2mqtt/Air purifier/set/fan_mode', preset_modes: ['auto'],
            // the numbered speeds 1 … 9, read as they are — the discovery needs a template table for it
            percentage_state_topic: 'zigbee2mqtt/Air purifier', percentage_value_template: '{{ value_json.fan_mode }}',
            percentage_command_topic: 'zigbee2mqtt/Air purifier/set/fan_mode', speed_range_min: 1, speed_range_max: 9,
        });
    });

    it('a door lock (E144): the lock, its battery, and its settings as settings', () => {
        // Yale YRD426NRSC as zigbee2mqtt's own device definition describes it
        const e = get('0x00124b0000000124:lock');
        expect(e).toMatchObject({component: 'lock', name: 'Front door lock'});
        expect(strip(e)).toEqual({
            state_topic: 'zigbee2mqtt/Front door lock', value_template: '{{ value_json.state }}',
            state_locked: 'LOCK', state_unlocked: 'UNLOCK',
            // zigbee2mqtt reads the plain words LOCK / UNLOCK on …/set as the state
            command_topic: 'zigbee2mqtt/Front door lock/set', payload_lock: 'LOCK', payload_unlock: 'UNLOCK',
            // a lock runs on batteries: the low-battery flag of the device
            battery_low_normalized: {topic: 'zigbee2mqtt/Front door lock', property: 'payload.battery_low', payloadLow: true},
        });
        // no OPEN action on a zigbee lock
        expect(e.config.payload_open).toBeUndefined();
        // the relock time and the sound volume are settings: the Generate wizard offers the lock, not these
        expect(get('0x00124b0000000124:auto_relock_time').config.entity_category).toBe('config');
        expect(get('0x00124b0000000124:sound_volume').config.entity_category).toBe('config');
        const offered = natives().filter(x => x.discovery_id.includes('0x00124b0000000124')
            && !x.config.entity_category && x.config.enabled_by_default !== false).map(x => x.discovery_id.split(':').pop()).sort();
        expect(offered).toEqual(['action_source_name', 'action_user', 'lock']);
        // who operated the lock is a value; the pin codes (a composite) and the `action` event are not offered
        expect(get('0x00124b0000000124:pin_code')).toBeNull();
        expect(get('0x00124b0000000124:action')).toBeNull();
    });

    it('the generic exposes: read-only becomes a sensor, settable a switch / number / select, a lone command a button', () => {
        expect(get('0x00124b0000000102:contact')).toMatchObject({component: 'binary_sensor', name: 'Contact sensor contact'});
        expect(strip(get('0x00124b0000000102:contact'))).toMatchObject({
            state_topic: 'zigbee2mqtt/Contact sensor', value_template: '{{ value_json.contact }}',
            payload_on: false, payload_off: true, device_class: 'door',
        });
        expect(strip(get('0x00124b0000000101:temperature'))).toEqual({
            state_topic: 'zigbee2mqtt/Climate sensor', value_template: '{{ value_json.temperature }}',
            unit_of_measurement: '°C', device_class: 'temperature',
        });
        expect(get('0x00124b0000000106:trigger_indicator').component).toBe('switch');
        expect(strip(get('0x00124b0000000106:trigger_indicator'))).toEqual({
            state_topic: 'zigbee2mqtt/Occupancy sensor P1', value_template: '{{ value_json.trigger_indicator }}',
            entity_category: 'config', command_topic: 'zigbee2mqtt/Occupancy sensor P1/set/trigger_indicator',
            payload_on: 'true', payload_off: 'false',
        });
        expect(get('0x00124b0000000103:detection_period').component).toBe('number');
        expect(strip(get('0x00124b0000000103:detection_period'))).toEqual({
            state_topic: 'zigbee2mqtt/Light sensor', value_template: '{{ value_json.detection_period }}',
            command_topic: 'zigbee2mqtt/Light sensor/set/detection_period', min: 1, max: 59, unit_of_measurement: 's',
            // what can be set on a generic expose is a setting of the device
            entity_category: 'config',
        });
        expect(get('0x00124b0000000106:motion_sensitivity')).toMatchObject({component: 'select'});
        expect(strip(get('0x00124b0000000106:motion_sensitivity')).options).toEqual(['low', 'medium', 'high']);
        expect(get('0x00124b0000000123:identify')).toMatchObject({component: 'button'});
        expect(strip(get('0x00124b0000000123:identify'))).toMatchObject({payload_press: 'identify', command_topic: 'zigbee2mqtt/Air purifier/set/identify'});
        // `action` (a button's clicks) is not offered; a composite has no single function
        expect(natives().some(e => /:action$/.test(e.discovery_id))).toBe(false);
        expect(get('0x00124b000000010b:program')).toBeNull();
    });

    it('housekeeping keeps its category, so the Generate wizard leaves it out and the picker still has it', () => {
        expect(get('0x00124b0000000101:linkquality').config).toMatchObject({entity_category: 'diagnostic', enabled_by_default: false});
        expect(get('0x00124b0000000101:battery').config).toMatchObject({entity_category: 'diagnostic', device_class: 'battery'});
        expect(get('0x00124b0000000101:temperature').config.entity_category).toBeUndefined();
    });

    it('two exposes of one property are one value (illuminance and illuminance_lux)', () => {
        const hits = natives().filter(e => e.discovery_id.startsWith('z2m:zigbee2mqtt:0x00124b0000000105:illuminance'));
        expect(hits).toHaveLength(1);
        expect(hits[0].config.device_class).toBe('illuminance');
    });

    it('groups: what the members share; scenes of a group and of a device endpoint', () => {
        expect(strip(get('group:7:light'))).toMatchObject({
            state_topic: 'zigbee2mqtt/Lights', command_topic: 'zigbee2mqtt/Lights/set', schema: 'json',
            supported_color_modes: ['xy', 'color_temp'], min_mireds: 158, max_mireds: 370,
        });
        expect(get('group:8:switch')).toMatchObject({component: 'switch', name: 'Switches'});
        expect(get('group:9:cover')).toMatchObject({component: 'cover'});
        expect(get('group:10:lock')).toMatchObject({component: 'lock'});
        expect(strip(get('group:10:scene_0'))).toEqual({command_topic: 'zigbee2mqtt/Thermostats/set', payload_on: '{ "scene_recall": 0 }'});
        expect(natives().filter(e => e.component === 'scene' && e.discovery_id.includes('0x00124b0000000107'))).toHaveLength(2);
    });

    it('every entity carries its device, the bridge as availability, and the battery where the device has one', () => {
        const contact = get('0x00124b0000000102:contact');
        expect(contact.config.device).toEqual({
            identifiers: ['zigbee2mqtt_0x00124b0000000102'], name: 'Contact sensor',
            manufacturer: 'Aqara', model: 'Door and window sensor', model_id: 'MCCGQ11LM',
        });
        expect(contact.config.availability_normalized).toEqual({entries: [{topic: 'zigbee2mqtt/bridge/state', property: 'payload.state'}], mode: 'all'});
        expect(contact.config.battery_low_normalized).toEqual({topic: 'zigbee2mqtt/Contact sensor', property: 'payload.battery'});
        // a device that reports battery_low gets the boolean
        expect(get('0x00124b000000010d:water_leak').config.battery_low_normalized)
            .toEqual({topic: 'zigbee2mqtt/Leak sensor', property: 'payload.battery_low', payloadLow: true});
        // a mains device none
        expect(get('0x00124b0000000113:state')?.config.battery_low_normalized).toBeUndefined();
        const groups = discovery.getDeviceGroups();
        expect(groups.find(g => g.deviceId === 'zigbee2mqtt_0x00124b0000000102').entities.length).toBeGreaterThan(1);
    });
});

describe('E193 — the instance is recognised by its device list, not by a setting', () => {
    it('takes any base topic, also one with levels, and several instances side by side', () => {
        bridge('home/zigbee');
        bridge('z2m-attic');
        expect(natives().filter(e => e.discovery_id.startsWith('z2m:home/zigbee:'))).toHaveLength(269);
        expect(natives().filter(e => e.discovery_id.startsWith('z2m:z2m-attic:'))).toHaveLength(269);
        expect(get('home/zigbee:0x00124b0000000107:switch').config.command_topic).toBe('home/zigbee/Aqara switch T1/set');
    });

    it('the three retained topics may come in any order', () => {
        discovery.handleMessage('zigbee2mqtt/bridge/info', buf({version: '2.14.3', config: {availability: {enabled: true}}}));
        discovery.handleMessage('zigbee2mqtt/bridge/devices', buf(devices));
        discovery.handleMessage('zigbee2mqtt/bridge/groups', buf(groups));
        expect(natives()).toHaveLength(269);
        expect(get('0x00124b0000000107:switch').config.availability_normalized.entries).toHaveLength(2);
    });

    it('is not taken in by another bridge/devices, nor by an info topic alone', () => {
        // alexa-remote-mqtt's roster lives on <prefix>/status/bridge/devices
        discovery.handleMessage('alexa/status/bridge/devices', buf([{name: 'Echo', topic: 'echo', serial: 'X'}]));
        discovery.handleMessage('other/bridge/info', buf({version: '1', config: {}}));
        discovery.handleMessage('other/bridge/devices', buf('offline'));
        discovery.handleMessage('other/bridge/devices', buf([]));
        expect(natives()).toEqual([]);
    });

    it('with availability on, a device is available when the bridge AND the device are', () => {
        bridge();
        discovery.handleMessage('zigbee2mqtt/bridge/info', buf({version: '2.14.3', config: {
            availability: {enabled: true},
            devices: {'0x00124b0000000102': {friendly_name: 'Contact sensor', availability: false}},
        }}));
        expect(get('0x00124b0000000107:switch').config.availability_normalized).toEqual({
            entries: [
                {topic: 'zigbee2mqtt/bridge/state', property: 'payload.state'},
                {topic: 'zigbee2mqtt/Aqara switch T1/availability', property: 'payload.state'},
            ],
            mode: 'all',
        });
        // switched off for one device
        expect(get('0x00124b0000000102:contact').config.availability_normalized.entries).toHaveLength(1);
    });

    it('a zigbee2mqtt 1.x bridge with the legacy availability payload says plain online / offline', () => {
        bridge();
        discovery.handleMessage('zigbee2mqtt/bridge/info', buf({version: '1.42.0', config: {advanced: {legacy_availability_payload: true}}}));
        expect(get('0x00124b0000000107:switch').config.availability_normalized.entries).toEqual([{topic: 'zigbee2mqtt/bridge/state'}]);
    });

    it('the list is the roster: a device that left or was renamed is gone, a cleared list clears the instance', () => {
        bridge();
        const without = devices.filter(d => d.ieee_address !== '0x00124b0000000102')
            .map(d => (d.ieee_address === '0x00124b0000000107' ? {...d, friendly_name: 'Hall switch'} : d));
        discovery.handleMessage('zigbee2mqtt/bridge/devices', buf(without));
        expect(get('0x00124b0000000102:contact')).toBeNull();
        // the id is the address, so a rename keeps it — only the topics follow
        expect(get('0x00124b0000000107:switch').config.state_topic).toBe('zigbee2mqtt/Hall switch');
        discovery.handleMessage('zigbee2mqtt/bridge/devices', '');
        expect(natives()).toEqual([]);
    });

    it('leaves out what cannot be used: disabled, unsupported, not interviewed', () => {
        const d = devices.find(x => x.ieee_address === '0x00124b0000000107');
        const list = [
            {...d, ieee_address: '0x0000000000000a01', friendly_name: 'a', disabled: true},
            {...d, ieee_address: '0x0000000000000a02', friendly_name: 'b', supported: false},
            {...d, ieee_address: '0x0000000000000a03', friendly_name: 'c', interview_completed: false},
            {...d, ieee_address: '0x0000000000000a04', friendly_name: 'd', definition: null},
            {...d, ieee_address: '0x0000000000000a05', friendly_name: 'e'},
        ];
        discovery.handleMessage('zigbee2mqtt/bridge/devices', buf(list));
        expect([...new Set(natives().map(e => e.discovery_id.split(':')[2]))]).toEqual(['0x0000000000000a05']);
    });
});

describe('E193 — with the discovery on, every function is offered once', () => {
    it('zigbee2mqtt 2.14.3: of 274 announced entities feezal offers, two are left — composites the device list has no single function for', () => {
        announce();
        const before = all().filter(e => !e.source);
        expect(before).toHaveLength(274);
        bridge();
        expect(all().filter(e => !e.source).map(e => e.discovery_id)).toEqual([
            'sensor/0x00124b000000010b/program',        // a thermostat's weekly program
            'sensor/0x00124b0000000124/pin_code',       // a door lock's pin code record
        ]);
        expect(natives()).toHaveLength(269);
    });

    it('by topic + property: an announced entity is left out only for the native entity of the same function', () => {
        announce();
        const ha = all();
        discovery.clearEntities();
        bridge();
        const {omitted} = mergeDiscovery(ha, natives(), {});
        const pair = id => omitted.get(id);
        // one state topic, many functions — each finds its own
        expect(pair('sensor/0x00124b0000000101/temperature')).toBe('z2m:zigbee2mqtt:0x00124b0000000101:temperature');
        expect(pair('sensor/0x00124b0000000101/humidity')).toBe('z2m:zigbee2mqtt:0x00124b0000000101:humidity');
        expect(pair('sensor/0x00124b0000000101/battery')).toBe('z2m:zigbee2mqtt:0x00124b0000000101:battery');
        expect(pair('switch/0x00124b0000000108/switch_l1')).toBe('z2m:zigbee2mqtt:0x00124b0000000108:switch_l1');
        expect(pair('switch/0x00124b0000000108/switch_l2')).toBe('z2m:zigbee2mqtt:0x00124b0000000108:switch_l2');
        // a template that computes has no property: matched by its command topic
        expect(pair('switch/0x00124b0000000106/switch_trigger_indicator')).toBe('z2m:zigbee2mqtt:0x00124b0000000106:trigger_indicator');
        // whole-payload entities: by component
        expect(pair('light/0x00124b000000010e/light')).toBe('z2m:zigbee2mqtt:0x00124b000000010e:light');
        expect(pair('cover/0x00124b0000000109/cover')).toBe('z2m:zigbee2mqtt:0x00124b0000000109:cover');
        expect(pair('climate/0x00124b000000010b/climate')).toBe('z2m:zigbee2mqtt:0x00124b000000010b:climate');
        expect(pair('fan/0x00124b0000000123/fan')).toBe('z2m:zigbee2mqtt:0x00124b0000000123:fan');
        expect(pair('lock/0x00124b000000010b/lock')).toBe('z2m:zigbee2mqtt:0x00124b000000010b:lock');
        // the temperature the thermostat card shows is not offered a second time
        expect(pair('sensor/0x00124b000000010b/local_temperature')).toBe('z2m:zigbee2mqtt:0x00124b000000010b:climate');
        // a light does not swallow the other entities on its topic
        expect(pair('sensor/0x00124b000000010e/linkquality')).toBe('z2m:zigbee2mqtt:0x00124b000000010e:linkquality');
    });

    it('a room the discovery copy suggests reaches the native entities of that device', () => {
        // zigbee2mqtt has no rooms; `suggested_area` is a per-device override of its discovery
        announce(announced.map(m => (m.topic.includes('/0x00124b0000000102/')
            ? {...m, payload: {...m.payload, device: {...m.payload.device, suggested_area: 'Hallway'}}} : m)));
        bridge();
        const contact = get('0x00124b0000000102:contact');
        expect(contact.config.device.suggested_area).toBe('Hallway');
        expect(contact.config.device.model).toBe('Door and window sensor');      // the native block stays
        expect(discovery.getDeviceGroups().find(g => g.deviceId === 'zigbee2mqtt_0x00124b0000000102').area).toBe('Hallway');
        expect(get('0x00124b0000000101:temperature').config.device.suggested_area).toBeUndefined();
    });

    it('an id a saved dashboard holds keeps resolving, the discovery copy and the native one', () => {
        announce();
        bridge();
        expect(discovery.getDiscoveredEntity('light/0x00124b000000010e/light')?.config.schema).toBe('json');
        expect(discovery.getDiscoveredEntity('z2m:zigbee2mqtt:0x00124b000000010e:light')?.config.schema).toBe('json');
    });

    it('the battery of the discovery copy and of the native entity are the same record', () => {
        announce();
        const copy = discovery.getDiscoveredEntity('binary_sensor/0x00124b0000000102/contact').config.battery_low_normalized;
        bridge();
        expect(get('0x00124b0000000102:contact').config.battery_low_normalized).toEqual(copy);
    });
});

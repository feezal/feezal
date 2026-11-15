// Generates the Home Assistant discovery zigbee2mqtt publishes for the devices and groups of a
// bridge/devices + bridge/groups pair, with zigbee2mqtt's own extension (dist/extension/homeassistant.js)
// driven by stand-ins for the Zigbee and MQTT layers.
// Usage: ZIGBEE2MQTT_DATA=<dir with configuration.yaml> node gen-z2m-discovery.cjs <bridge-devices.json> <bridge-groups.json> <out.json>
const fs = require('fs');
const path = require('path');
const [, , devicesFile, groupsFile, outFile] = process.argv;
const z2mDir = path.dirname(require.resolve('zigbee2mqtt/package.json'));
const HomeAssistant = require(path.join(z2mDir, 'dist/extension/homeassistant.js'));
const HA = HomeAssistant.default ?? HomeAssistant.HomeAssistant ?? HomeAssistant;
const version = require(path.join(z2mDir, 'package.json')).version;
// the extension logs through zigbee2mqtt's logger, which is not set up here
const logger = require(path.join(z2mDir, 'dist/util/logger.js')).default;
for (const level of ['debug', 'info', 'warning', 'error']) logger[level] = () => {};

const devices = JSON.parse(fs.readFileSync(devicesFile, 'utf8'));
const groups = JSON.parse(fs.readFileSync(groupsFile, 'utf8'));

// zigbee2mqtt tells endpoints from groups by their class name
class Endpoint { constructor(o) { Object.assign(this, o); } }
class Group { constructor(o) { Object.assign(this, o); } }

const coordinator = devices.find((d) => d.type === 'Coordinator')?.ieee_address ?? '0x00124b0000000000';
const byIeee = new Map();
for (const d of devices) {
    if (d.type === 'Coordinator' || !d.definition) continue;
    const endpoints = Object.entries(d.endpoints || {}).map(([id, ep]) => new Endpoint({
        ID: Number(id),
        deviceIeeeAddress: d.ieee_address,
        meta: {scenes: Object.fromEntries((ep.scenes || []).map((s) => [`${s.id}_0`, {name: s.name}]))},
        getDevice: () => entity.zh,
    }));
    const entity = {
        ID: d.ieee_address,
        ieeeAddr: d.ieee_address,
        name: d.friendly_name,
        options: {ID: d.ieee_address, friendly_name: d.friendly_name, ...(d.disabled ? {disabled: true} : {})},
        definition: {...d.definition, ...(d.definition.supports_ota ? {ota: true} : {})},
        interviewed: d.interview_completed !== false,
        isSupported: d.supported !== false,
        isDevice: () => true,
        isGroup: () => false,
        exposes: () => d.definition.exposes,
        endpoint: (name) => endpoints.find((e) => String(e.ID) === String(name)) ?? endpoints[0],
        zh: {
            ieeeAddr: d.ieee_address, type: d.type, endpoints,
            softwareBuildID: d.software_build_id ?? undefined, hardwareVersion: undefined,
            modelID: d.model_id, manufacturerName: d.manufacturer, powerSource: d.power_source,
        },
    };
    byIeee.set(d.ieee_address, entity);
}
const groupEntities = groups.map((g) => {
    const members = g.members.map((m) => byIeee.get(m.ieee_address)?.zh.endpoints.find((e) => e.ID === m.endpoint)).filter(Boolean);
    // a group's scenes are kept on its members' endpoints, keyed <scene>_<group>
    for (const s of g.scenes || []) for (const m of members) m.meta.scenes[`${s.id}_${g.id}`] = {name: s.name};
    const devicesOf = () => members.map((m) => byIeee.get(m.deviceIeeeAddress));
    return {
        ID: g.id, name: g.friendly_name, options: {ID: g.id, friendly_name: g.friendly_name},
        isDevice: () => false, isGroup: () => true,
        membersDevices: devicesOf,
        membersDefinitions: () => devicesOf().map((d) => d.definition),
        zh: new Group({groupID: g.id, members, meta: {}}),
    };
});

const published = [];
const mqtt = {publish: async (topic, payload, options = {}) => { published.push({topic: `${options.baseTopic ?? 'zigbee2mqtt'}/${topic}`, payload}); }};
const zigbee = {
    getCoordinatorVersion: async () => ({type: 'zStack3x0', meta: {revision: 20240710}}),
    resolveEntity: (key) => {
        if (key && typeof key === 'object') return [...byIeee.values()].find((e) => e.zh === key);
        return byIeee.get(key) ?? [...byIeee.values()].find((e) => e.name === key) ?? groupEntities.find((g) => g.ID === key || g.name === key);
    },
    firstCoordinatorEndpoint: () => ({deviceIeeeAddress: coordinator}),
};
const noop = new Proxy({}, {get: () => () => {}});

(async () => {
    const ha = new HA(zigbee, mqtt, noop, async () => {}, noop, async () => {}, async () => {}, async () => {});
    ha.zigbee2MQTTVersion = version;
    ha.discoveryOrigin = {name: 'Zigbee2MQTT', sw: version, url: 'https://www.zigbee2mqtt.io'};
    ha.bridge = ha.getBridgeEntity(await zigbee.getCoordinatorVersion());
    ha.bridgeIdentifier = ha.getDevicePayload(ha.bridge).identifiers[0];
    const failed = [];
    for (const entity of [...byIeee.values(), ...groupEntities]) {
        try { await ha.discover(entity); } catch (e) { failed.push(`${entity.name}: ${e.stack.split("\n").slice(0,4).join(" | ")}`); }
    }
    const out = published.filter((m) => m.payload !== '').map((m) => ({topic: m.topic, payload: JSON.parse(m.payload)}));
    fs.writeFileSync(outFile, '[\n' + out.map((m) => '  ' + JSON.stringify(m)).join(',\n') + '\n]\n');
    console.log('zigbee2mqtt', version, 'entities', byIeee.size, 'groups', groupEntities.length, 'configs', out.length, 'failed', failed);
})().catch((e) => { console.error(e); process.exit(1); });

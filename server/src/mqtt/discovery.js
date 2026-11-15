'use strict';

/**
 * MQTT Auto-Discovery registry (N12).
 *
 * Keeps the entities announced with the Home Assistant / zigbee2mqtt discovery
 * convention (retained config topics under `homeassistant/`) in the shape the
 * front-end reads: {discovery_id, component, node_id, object_id, name,
 * unique_id, config} with Home Assistant's long key names in `config`.
 *
 * READING the convention is mqtt-ha-entities' job (A40): its DiscoveryStore
 * knows both forms (a config per entity, and the device-based form with
 * `cmps`), Home Assistant's abbreviation tables, the `~` base topic, and that a
 * topic's new payload REPLACES what the topic announced before (an empty one
 * removes it). feezal keeps what is its own, on top of the store's entities:
 * which components it offers (SUPPORTED_COMPONENTS), the `discovery_id` saved
 * dashboards hold, `availability_normalized`, the battery correlation, and the
 * one list with the native recognizers (discovery-merge.js).
 *
 * Call handleMessage() from the MQTT bridge's message handler for every
 * incoming message. REST consumers call getDiscoveredEntities() /
 * getDiscoveredEntity(id).
 */

// mqtt-ha-entities is an ES module; Node loads it with require() in every
// version its `engines` allows (^20.19 || ^22.12 || >=24) — no dynamic import,
// so the registry is ready for the first retained message.
const {DiscoveryStore, parseDiscoveryTopic} = require('mqtt-ha-entities');
const native = require('./native-discovery.js');
const {mergeDiscovery} = require('./discovery-merge.js');
const {templateToProperty} = require('./template-property.js');

const DEFAULT_PREFIX = 'homeassistant';

const SUPPORTED_COMPONENTS = new Set([
    'light', 'climate', 'cover', 'switch', 'fan', 'humidifier',
    'lock', 'vacuum', 'sensor', 'binary_sensor', 'select',
    // E149: command-only + read-only component types that already have a
    // matching feezal element declaring `discovery: {component, map}`.
    'button', 'scene', 'number', 'text', 'alarm_control_panel', 'camera', 'image',
    // E150: water_heater is climate-shaped (identical HA topic key names), so it
    // reuses the climate element + map via an aliasComponents link.
    'water_heater',
]);

// ── Entity registry ────────────────────────────────────────────────────────
/** @type {Map<string, DiscoveryStore>} discovery prefix → what is announced under it */
const stores = new Map();

/**
 * discovery_id → normalised entity, derived from the stores. Rebuilt on the
 * first read after a config message (a retained burst is thousands of
 * messages and no read), so the objects are stable between two changes.
 * @type {Map<string, object>}
 */
let entities = new Map();
let stale = false;

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * B89: HA allows the device `identifiers` as a scalar OR a list — ESPHome sends
 * a bare string (`ids:"2cf…"`). Normalise to an array so consumers that key on
 * `device.identifiers[0]` (device grouping, the Generate wizard, battery-low
 * correlation) don't index into a string.
 */
function normalizeDevice(config) {
    const dev = config?.device;
    if (dev && typeof dev === 'object' && typeof dev.identifiers === 'string') {
        dev.identifiers = [dev.identifiers];
    }
    return config;
}

// ── N31: canonical availability ────────────────────────────────────────────
// HA discovery carries availability in three wire forms: the legacy scalar
// `availability_topic` (+ payload_available/payload_not_available), the
// modern `availability` ARRAY of {topic, payload_*, value_template} entries
// (what zigbee2mqtt publishes: bridge state + device availability), and
// `availability_mode` (all | any | latest). Normalise them into one
// canonical descriptor on the config so consumers never re-parse the wire
// forms: config.availability_normalized =
//   {entries: [{topic, property?}], mode, payloadAvailable?, payloadUnavailable?}
// value_templates of the simple "{{ value_json.X }}" form map to a feezal
// message-property path ("payload.X"); payload overrides are taken from the
// scalar form or the first array entry (feezal applies them globally).
// Simple "{{ value_json.X }}" templates → feezal message-property path
// ("payload.X") — templateToProperty, in template-property.js.

function normalizeAvailability(config) {
    const entries = [];
    let payloadAvailable;
    let payloadUnavailable;

    // The store hands out `availability` as a list of entries with long key
    // names and `~` resolved (a single object too).
    if (Array.isArray(config.availability)) {
        for (const e of config.availability) {
            if (!e || typeof e.topic !== 'string' || !e.topic) continue;
            const entry = {topic: e.topic};
            const property = templateToProperty(e.value_template);
            if (property) entry.property = property;
            entries.push(entry);
            if (payloadAvailable === undefined && e.payload_available !== undefined) payloadAvailable = e.payload_available;
            if (payloadUnavailable === undefined && e.payload_not_available !== undefined) payloadUnavailable = e.payload_not_available;
        }
    } else if (typeof config.availability_topic === 'string' && config.availability_topic) {
        entries.push({topic: config.availability_topic});
    }

    if (entries.length === 0) return;

    if (payloadAvailable === undefined) payloadAvailable = config.payload_available;
    if (payloadUnavailable === undefined) payloadUnavailable = config.payload_not_available;

    config.availability_normalized = {
        entries,
        mode: ['all', 'any', 'latest'].includes(config.availability_mode) ? config.availability_mode : 'all',
        ...(payloadAvailable !== undefined ? {payloadAvailable} : {}),
        ...(payloadUnavailable !== undefined ? {payloadUnavailable} : {}),
    };
}

/** Build a stable discovery ID from component + optional node_id + object_id. */
function makeId(component, nodeId, objectId) {
    return nodeId ? `${component}/${nodeId}/${objectId}` : `${component}/${objectId}`;
}

/**
 * A store entity → the entity the front-end reads, or null when feezal does
 * not offer its component.
 *
 * `discovery_id` is what saved dashboards hold and must not change:
 *   <component>/<object_id>             homeassistant/<component>/<object_id>/config
 *   <component>/<node_id>/<object_id>   homeassistant/<component>/<node_id>/<object_id>/config
 *   <platform>/<object_id>/<key>        homeassistant/device/<object_id>/config, component <key>
 * (the device form's topic object id sits where the node id sits, as it always
 * did here; with a node id of its own it is <platform>/<node_id>/<object_id>/<key>).
 */
function toFeezalEntity(e, prefix) {
    if (!SUPPORTED_COMPONENTS.has(e.component)) return null;

    let nodeId = e.nodeId ?? null;
    if (e.id !== e.topic) {
        // a component of a device-based config: the node is the topic's own id
        const t = parseDiscoveryTopic(prefix, e.topic);
        nodeId = t.nodeId === undefined ? t.objectId : `${t.nodeId}/${t.objectId}`;
    }
    const objectId = e.objectId;
    const id = makeId(e.component, nodeId, objectId);

    // The store's config is its own; feezal adds to a copy.
    const config = {...e.config};
    if (config.device && typeof config.device === 'object') config.device = {...config.device};
    normalizeDevice(config);
    normalizeAvailability(config);

    return {
        discovery_id: id,
        component: e.component,
        node_id:   nodeId,
        object_id: objectId,
        name:      config.name || objectId,
        unique_id: config.unique_id || id,
        config,
    };
}

/**
 * feezal's own leniency for the device-based form: a `~` at the ROOT of the
 * payload also applies to the components that set none. Home Assistant hands
 * the base topic down to nobody (each component has to carry its own `~`), so
 * a publisher that relies on this is wrong there — but feezal has always read
 * it that way, and reading it costs nothing. Returns the payload to hand to
 * the store: the parsed object with the base handed down, or the payload as it
 * came when there is nothing to do (the store then parses and judges it).
 */
function withDeviceBase(payloadBuf) {
    const text = payloadBuf == null ? '' : payloadBuf.toString();
    if (!text.includes('"~"')) return payloadBuf;
    const raw = JSON.parse(text);       // not JSON: throws, like the store would
    const components = raw && typeof raw === 'object' ? (raw.cmps ?? raw.components) : null;
    if (typeof raw?.['~'] !== 'string' || !components || typeof components !== 'object') return raw;
    for (const comp of Object.values(components)) {
        if (!comp || typeof comp !== 'object' || Array.isArray(comp) || '~' in comp) continue;
        // a component reduced to its platform is a removal — it must stay that
        if (Object.keys(comp).every(k => k === 'p' || k === 'platform')) continue;
        comp['~'] = raw['~'];
    }
    return raw;
}

/** The registry, rebuilt from the stores when a config message came since the last read. */
function registry() {
    if (!stale) return entities;
    entities = new Map();
    for (const [prefix, store] of stores) {
        for (const e of store.entities.values()) {
            const entity = toFeezalEntity(e, prefix);
            if (entity) entities.set(entity.discovery_id, entity);
        }
    }
    stale = false;
    return entities;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Process one MQTT message. Call this from the bridge message handler.
 *
 * @param {string} topic
 * @param {Buffer|string} payloadBuf
 * @param {string} [prefix='homeassistant']  Discovery topic prefix.
 */
function handleMessage(topic, payloadBuf, prefix) {
    const p = prefix || DEFAULT_PREFIX;
    if (topic.startsWith(p + '/') && topic.endsWith('/config')) {
        let store = stores.get(p);
        if (!store) stores.set(p, store = new DiscoveryStore({prefix: p}));
        try {
            // A payload that is not a JSON object throws and leaves what the
            // topic announced before in place.
            const payload = topic.startsWith(p + '/device/') ? withDeviceBase(payloadBuf) : payloadBuf;
            if (store.handle(topic, payload ?? '') !== undefined) stale = true;
        } catch { /* ignore */ }
    }

    // E108: native recognizers run for EVERY message — they read a source's own
    // topics, not the HA config topics. Isolated so a bad native parse can never
    // break the HA discovery path above. A source that does both (hm2mqtt 3) is
    // in both registries; merged() below offers it once (E192).
    try { native.handleNativeMessage(topic, payloadBuf); } catch { /* ignore */ }
}

/**
 * E124/E132 — canonical low-battery record for HA/z2m entities, computed at
 * READ time (a battery sibling may be discovered after the state entity, so
 * normalize-time stamping would race the retained burst). z2m announces the
 * battery as SEPARATE sibling entities of the same device (shared
 * device.identifiers): `binary_sensor`/`device_class: battery` (boolean —
 * HA semantics: on = low) preferred, `sensor`/`device_class: battery`
 * (percentage) as the fallback — many modern devices expose ONLY the
 * percentage, so the fallback carries no payloadLow and the element compares
 * against its battery-low-threshold. Native (Homematic) entities carry the
 * record straight from their recognizer — untouched here.
 */
function decorateBatteryLow(entity) {
    if (!entity || entity.source) return entity;                       // native → recognizer-provided
    if (entity.config?.battery_low_normalized) return entity;
    if (entity.config?.device_class === 'battery') return entity;      // the battery entity itself
    if (!['binary_sensor', 'climate'].includes(entity.component)) return entity;
    const devId = entity.config?.device?.identifiers?.[0];
    if (!devId) return entity;

    let bool = null;
    let pct = null;
    for (const e of registry().values()) {
        if (e === entity) continue;
        if (e.config?.device?.identifiers?.[0] !== devId) continue;
        if (e.config?.device_class !== 'battery') continue;
        if (e.component === 'binary_sensor' && !bool) bool = e;
        if (e.component === 'sensor' && !pct) pct = e;
    }
    const src = bool || pct;
    if (!src || !src.config.state_topic) return entity;

    const record = {topic: src.config.state_topic};
    const property = templateToProperty(src.config.value_template);
    if (property) record.property = property;
    if (bool) record.payloadLow = src.config.payload_on ?? true;       // percentage source: element threshold
    entity.config.battery_low_normalized = record;
    return entity;
}

/**
 * E192 — both registries as ONE list in which every device is offered once:
 * an announced entity whose state or command topic a native entity already
 * covers is left out, and the native entity takes over the announced device
 * block (the room). The rule itself is discovery-merge.js; everything that
 * lists devices (the REST routes, the device groups, the AI tools) reads
 * through here, so they all see the same list.
 */
function merged() {
    return mergeDiscovery(
        [...registry().values()].map(decorateBatteryLow),
        native.getNativeEntities(),
        {announceable: SUPPORTED_COMPONENTS},
    );
}

/** Return all currently known entities as an array (HA + native recognizers, every device once). */
function getDiscoveredEntities() {
    return merged().entities;
}

/**
 * Return a single entity by discovery_id, or null if not found. An announced
 * entity that the list leaves out (E192) still resolves — a dashboard saved
 * before may hold its id; a native entity comes back as the list shows it,
 * with the device block it took over.
 */
function getDiscoveredEntity(id) {
    const e = registry().get(id);
    if (e) return decorateBatteryLow(e);
    const n = native.getNativeEntity(id);
    if (!n) return null;
    return merged().entities.find(x => x.discovery_id === id) ?? n;
}

/** Clear all entities (call on broker disconnect / reconnect to different broker). */
function clearEntities() {
    stores.clear();
    entities = new Map();
    stale = false;
    native.clearNativeEntities();
}

/**
 * Group all known entities by device (device.identifiers[0]).
 * Entities without device info are excluded. The groups are built from the
 * same list getDiscoveredEntities() returns (E192): a native entity that took
 * over an announced device block is in that device's group, with its room.
 * Each group carries an `elementHint` ("plant" when a moisture sensor is present).
 */
function getDeviceGroups() {
    const groups = new Map();

    for (const entity of merged().entities) {
        const devId = entity.config?.device?.identifiers?.[0];
        if (!devId) continue;

        if (!groups.has(devId)) {
            groups.set(devId, {
                deviceId:   devId,
                deviceName: entity.config.device.name || devId,
                device:     entity.config.device,
                // E161: capture the device area (`sa`/suggested_area, on the
                // device object or top-level config) so U58's app-generator can
                // group devices into per-area views. Not consumed by elements.
                area:       entity.config.device.suggested_area || entity.config.suggested_area || null,
                entities:   [],
                elementHint: null,
            });
        }
        const group = groups.get(devId);
        if (!group.area) group.area = entity.config.device?.suggested_area || entity.config.suggested_area || null;
        group.entities.push(entity);
    }

    // Compute elementHint per group
    for (const group of groups.values()) {
        const hasMoisture = group.entities.some(
            e => e.component === 'sensor' && e.config?.device_class === 'moisture'
        );
        if (hasMoisture) group.elementHint = 'plant';
    }

    return [...groups.values()];
}

module.exports = { handleMessage, getDiscoveredEntities, getDiscoveredEntity, clearEntities, getDeviceGroups, setHomematicClimateStale: native.setHomematicClimateStale };

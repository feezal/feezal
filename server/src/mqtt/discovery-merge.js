'use strict';

/**
 * One list from two discovery sources: every device is offered once (E192).
 *
 * feezal learns about devices in two ways — entities announced with Home
 * Assistant discovery, and entities the native recognizers synthesize from a
 * source's own topics (recognizers/*.js). A source may do both: hm2mqtt 3
 * announces every Homematic device with Home Assistant discovery by default,
 * and its topics are exactly the ones the homematic recognizer reads. Without a
 * rule the same dimmer is in the list twice.
 *
 * THE RULE. An announced entity is left out when a native entity already reads
 * or writes one of its state or command topics. The native entity is the better
 * one in feezal (no templates to interpret, the mode tables, the `:0`
 * correlation, the output grouping), so it wins. Matching is by topic, not by
 * a table of adapters: any bridge that publishes the same topics is covered,
 * and an announced entity whose function no recognizer reads — an energy
 * meter, a weather sensor — stays.
 *
 * WHAT A NATIVE ENTITY CLAIMS. By default every `*_topic` of its config, as a
 * whole topic — but only when its component is one Home Assistant discovery
 * can announce itself (`light`, `climate`, `cover`, …). A composite that has no
 * counterpart there (`media`, `remote`, `audio`, …) claims nothing: the
 * switches, numbers and selects a media adapter announces are single functions
 * of that composite, and a dashboard may want just one of them. Nothing is left
 * out because of where it comes from.
 *
 * A recognizer whose source puts SEVERAL functions on ONE topic (a JSON state
 * topic with a property per function) declares its claims itself, as
 * `entity.claims = [{topic, property?, component?}]`:
 *   - `property`  — a feezal message-property path ("payload.temperature"): the
 *                   claim covers an announced entity only when that entity
 *                   reads this property of the topic (its `value_template` is
 *                   the simple `{{ value_json.X }}` form);
 *   - `component` — the claim covers only announced entities of this component
 *                   (for an entity that reads the whole JSON payload and so has
 *                   no single property, e.g. a JSON-schema light).
 * An explicit `claims` replaces the default, also for a composite; `claims: []`
 * claims nothing.
 *
 * WHAT IS TAKEN OVER. The announced copy knows two things the native entity
 * does not: the room (`device.suggested_area`) and the device block
 * (identifiers, manufacturer, model, `via_device`). A native entity that shares
 * a topic with the announced entities of exactly one device gets that device
 * block as `config.device` (its own keys win) — whether or not anything was
 * left out, so a composite gets its room too. From there the room reaches the
 * device groups and the App generator.
 *
 * This module only compares the two lists in the entity shape both paths
 * produce ({discovery_id, component, config with Home Assistant's long key
 * names}); it does not parse discovery payloads and does not know any source.
 */

const {templateToProperty} = require('./template-property.js');

// Topics that say whether a device is there, not what it does — never a match.
const NOT_A_FUNCTION = new Set(['availability_topic', 'json_attributes_topic']);

const isTopicKey = key => (key === 'topic' || key.endsWith('_topic')) && !NOT_A_FUNCTION.has(key);

/** The template that belongs to a state topic key, per Home Assistant's naming. */
function templateFor(config, key) {
    if (key === 'state_topic') return config.value_template ?? config.state_value_template;
    if (/command_topic$/.test(key) || key === 'set_position_topic') return undefined;   // written, not read
    const base = key === 'topic' ? '' : key.slice(0, -'_topic'.length);
    const stem = base.replace(/_state$/, '');
    return config[`${base}_template`] ?? config[`${stem}_value_template`] ?? config[`${stem}_template`];
}

/**
 * The state and command topics an entity reads or writes:
 * [{topic, property}] — `property` is the feezal path of the value inside a
 * JSON payload when the entity's template names one, otherwise undefined (the
 * whole payload, or a template that computes).
 */
function topicUses(config) {
    const uses = [];
    if (!config || typeof config !== 'object') return uses;
    for (const [key, value] of Object.entries(config)) {
        if (typeof value !== 'string' || !value || !isTopicKey(key)) continue;
        uses.push({topic: value, property: templateToProperty(templateFor(config, key))});
    }
    return uses;
}

/** The claims of a native entity (see the header). */
function claimsOf(entity, announceable) {
    if (Array.isArray(entity.claims)) {
        return entity.claims.filter(c => c && typeof c.topic === 'string' && c.topic);
    }
    if (!announceable || !announceable.has(entity.component)) return [];
    return topicUses(entity.config).map(u => ({topic: u.topic}));
}

function covers(claim, entity, use) {
    if (claim.component && claim.component !== entity.component) return false;
    if (claim.property && claim.property !== use.property) return false;
    return true;
}

const deviceKey = device => {
    const ids = device && device.identifiers;
    return Array.isArray(ids) ? ids[0] : ids;
};

/**
 * Merge the announced entities with the native ones.
 *
 * @param {object[]} announced  entities from Home Assistant discovery
 * @param {object[]} natives    entities from the native recognizers
 * @param {{announceable?: Set<string>}} [options]  the components Home Assistant
 *        discovery can announce (a native entity of another component claims
 *        nothing by default)
 * @returns {{entities: object[], omitted: Map<string, string>}} the one list
 *          (announced entities that stay, then the native ones, enriched —
 *          copies, the inputs are not changed) and, for every announced entity
 *          left out, the discovery_id of the native entity that covers it.
 */
function mergeDiscovery(announced, natives, {announceable} = {}) {
    if (!natives.length || !announced.length) {
        return {entities: [...announced, ...natives], omitted: new Map()};
    }

    /** topic → [{claim, native}] */
    const claimed = new Map();
    /** topic → Set<native> — every topic a native entity uses, claimed or not */
    const used = new Map();
    for (const native of natives) {
        for (const claim of claimsOf(native, announceable)) {
            if (!claimed.has(claim.topic)) claimed.set(claim.topic, []);
            claimed.get(claim.topic).push({claim, native});
        }
        const topics = new Set(topicUses(native.config).map(u => u.topic));
        if (Array.isArray(native.claims)) for (const c of native.claims) if (c && c.topic) topics.add(c.topic);
        for (const topic of topics) {
            if (!used.has(topic)) used.set(topic, new Set());
            used.get(topic).add(native);
        }
    }

    const omitted = new Map();
    /** native → Map<deviceKey, device block> of the announced entities it shares a topic with */
    const devicesOf = new Map();
    const kept = [];

    for (const entity of announced) {
        const uses = topicUses(entity.config);
        let coveredBy = null;
        const device = entity.config && entity.config.device;
        const key = deviceKey(device);
        for (const use of uses) {
            if (!coveredBy) {
                const hit = (claimed.get(use.topic) || []).find(c => covers(c.claim, entity, use));
                if (hit) coveredBy = hit.native;
            }
            if (key === undefined || key === null) continue;
            for (const native of used.get(use.topic) || []) {
                if (!devicesOf.has(native)) devicesOf.set(native, new Map());
                if (!devicesOf.get(native).has(key)) devicesOf.get(native).set(key, device);
            }
        }
        if (coveredBy) omitted.set(entity.discovery_id, coveredBy.discovery_id);
        else kept.push(entity);
    }

    const enriched = natives.map(native => {
        const devices = devicesOf.get(native);
        // Topics of two announced devices: no telling which one this is.
        if (!devices || devices.size !== 1) return native;
        const [device] = devices.values();
        return {
            ...native,
            config: {...native.config, device: {...device, ...(native.config && native.config.device)}},
        };
    });

    return {entities: [...kept, ...enriched], omitted};
}

module.exports = {mergeDiscovery, topicUses, claimsOf};

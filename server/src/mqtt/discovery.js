'use strict';

/**
 * MQTT Auto-Discovery registry (N12).
 *
 * Parses retained config-topic messages that follow the widely-adopted
 * Home Assistant / zigbee2mqtt discovery convention and maintains an
 * in-memory entity registry.
 *
 * Call handleMessage() from the MQTT bridge's message handler for every
 * incoming message. The registry updates itself whenever a retained config
 * topic arrives or is cleared (empty payload = delete).
 *
 * REST consumers call getDiscoveredEntities() / getDiscoveredEntity(id).
 */

// ── Abbreviation expansion table ──────────────────────────────────────────
// Maps the short keys used in discovery payloads to their full equivalents.
const ABBREVS = {
    // Common
    '~':             '~',
    name:            'name',
    uniq_id:         'unique_id',
    stat_t:          'state_topic',
    cmd_t:           'command_topic',
    stat_val_tpl:    'state_value_template',
    cmd_tpl:         'command_template',
    avty_t:          'availability_topic',
    avty_mode:       'availability_mode',
    pl_avail:        'payload_available',
    pl_not_avail:    'payload_not_available',
    qos:             'qos',
    ret:             'retain',
    ic:              'icon',
    dev_cla:         'device_class',
    pl_on:           'payload_on',
    pl_off:          'payload_off',
    stat_on:         'state_on',
    stat_off:        'state_off',
    optimistic:      'optimistic',
    dev:             'device',
    val_tpl:         'value_template',
    unit_of_meas:    'unit_of_measurement',
    ent_cat:         'entity_category',
    // Light
    bri_cmd_t:       'brightness_command_topic',
    bri_stat_t:      'brightness_state_topic',
    bri_scl:         'brightness_scale',
    bri_val_tpl:     'brightness_value_template',
    clr_temp_cmd_t:  'color_temp_command_topic',
    clr_temp_stat_t: 'color_temp_state_topic',
    clr_temp_val_tpl:'color_temp_value_template',
    max_mirs:        'max_mireds',
    min_mirs:        'min_mireds',
    rgb_cmd_t:       'rgb_command_topic',
    rgb_stat_t:      'rgb_state_topic',
    xy_cmd_t:        'xy_command_topic',
    xy_stat_t:       'xy_state_topic',
    hs_cmd_t:        'hs_command_topic',
    hs_stat_t:       'hs_state_topic',
    sup_clr_modes:   'supported_color_modes',
    whit_val_cmd_t:  'white_value_command_topic',
    whit_val_stat_t: 'white_value_state_topic',
    schema:          'schema',
    bri:             'brightness',
    color_mode:      'color_mode',
    // Climate
    curr_temp_t:     'current_temperature_topic',
    curr_temp_tpl:   'current_temperature_template',
    fan_mode_cmd_t:  'fan_mode_command_topic',
    fan_mode_stat_t: 'fan_mode_state_topic',
    fan_modes:       'fan_modes',
    hold_cmd_t:      'hold_command_topic',
    hold_stat_t:     'hold_state_topic',
    hold_modes:      'hold_modes',
    mode_cmd_t:      'mode_command_topic',
    mode_stat_t:     'mode_state_topic',
    mode_stat_tpl:   'mode_state_template',
    modes:           'modes',
    max_temp:        'max_temp',
    min_temp:        'min_temp',
    temp_step:       'temp_step',
    temp_cmd_t:      'temperature_command_topic',
    temp_stat_t:     'temperature_state_topic',
    temp_stat_tpl:   'temperature_state_template',
    temp_unit:       'temperature_unit',
    act_t:           'action_topic',
    act_tpl:         'action_template',
    swing_mode_cmd_t:'swing_mode_command_topic',
    swing_mode_stat_t:'swing_mode_state_topic',
    swing_modes:     'swing_modes',
    preset_mode_cmd_t:  'preset_mode_command_topic',
    preset_mode_stat_t: 'preset_mode_state_topic',
    preset_modes:    'preset_modes',
    // Cover
    pos_t:           'position_topic',
    set_pos_t:       'set_position_topic',
    tilt_cmd_t:      'tilt_command_topic',
    tilt_stat_t:     'tilt_status_topic',
    tilt_min:        'tilt_min',
    tilt_max:        'tilt_max',
    tilt_clsd_val:   'tilt_closed_value',
    tilt_opnd_val:   'tilt_opened_value',
    pl_open:         'payload_open',
    pl_cls:          'payload_close',
    pl_stop:         'payload_stop',
    pos_open:        'position_open',
    pos_clsd:        'position_closed',
    // Fan
    pct_cmd_t:       'percentage_command_topic',
    pct_stat_t:      'percentage_state_topic',
    pr_mode_cmd_t:   'preset_mode_command_topic',
    pr_mode_stat_t:  'preset_mode_state_topic',
    pr_modes:        'preset_modes',
    spd_rng_min:     'speed_range_min',
    spd_rng_max:     'speed_range_max',
    // Lock
    pl_lock:         'payload_lock',
    pl_unlk:         'payload_unlock',
    stat_locked:     'state_locked',
    stat_unlocked:   'state_unlocked',
    stat_jammed:     'state_jammed',
    // Select
    ops:             'options',
    // Sensor / binary_sensor
    expire_after:    'expire_after',
    force_update:    'force_update',
    // Device info
    ids:             'identifiers',
    cns:             'connections',
    mf:              'manufacturer',
    mdl:             'model',
    sw:              'sw_version',
    hw:              'hw_version',
    sa:              'suggested_area',
    // Device discovery
    cmps:            'components',
    // Shorthand used inside cmps entries
    p:               'platform',
};

const SUPPORTED_COMPONENTS = new Set([
    'light', 'climate', 'cover', 'switch', 'fan', 'humidifier',
    'lock', 'vacuum', 'sensor', 'binary_sensor', 'select',
]);

// ── Entity registry ────────────────────────────────────────────────────────
/** @type {Map<string, object>} discovery_id → normalised entity */
const entities = new Map();

// ── Helpers ────────────────────────────────────────────────────────────────

/** Expand abbreviated keys to full key names. */
function expandAbbrevs(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        out[ABBREVS[k] ?? k] = v;
    }
    return out;
}

/** Replace all `~` occurrences in string values with the base topic. */
function resolveBase(obj, base) {
    if (!base) return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (k === '~') continue;
        out[k] = typeof v === 'string' ? v.replaceAll('~', base) : v;
    }
    return out;
}

/** Expand abbreviations and resolve the `~` base topic shorthand. */
function normalizePayload(raw) {
    const expanded = expandAbbrevs(raw);
    const base = expanded['~'] || '';
    return resolveBase(expanded, base);
}

/** Build a stable discovery ID from component + optional node_id + object_id. */
function makeId(component, nodeId, objectId) {
    return nodeId ? `${component}/${nodeId}/${objectId}` : `${component}/${objectId}`;
}

// ── Component discovery ────────────────────────────────────────────────────

function handleComponentDiscovery(component, nodeId, objectId, payloadBuf) {
    if (!SUPPORTED_COMPONENTS.has(component)) return;
    const id = makeId(component, nodeId, objectId);
    const payloadStr = payloadBuf ? payloadBuf.toString() : '';

    // Empty payload = delete entity (standard "clear discovery" convention)
    if (!payloadStr) {
        entities.delete(id);
        return;
    }

    let raw;
    try { raw = JSON.parse(payloadStr); } catch { return; }

    const config = normalizePayload(raw);
    entities.set(id, {
        discovery_id: id,
        component,
        node_id:    nodeId,
        object_id:  objectId,
        name:       config.name || objectId,
        unique_id:  config.unique_id || id,
        config,
    });
}

// ── Device discovery ───────────────────────────────────────────────────────
// homeassistant/device/<node_id>/config — one payload, many components via "cmps"

function handleDeviceDiscovery(nodeId, payloadBuf) {
    const payloadStr = payloadBuf ? payloadBuf.toString() : '';

    if (!payloadStr) {
        // Remove all entities registered under this node_id
        for (const [id] of entities) {
            if (id.includes(`/${nodeId}/`)) entities.delete(id);
        }
        return;
    }

    let raw;
    try { raw = JSON.parse(payloadStr); } catch { return; }

    const expanded = expandAbbrevs(raw);
    const base = expanded['~'] || '';
    const components = expanded.components || {};

    for (const [objectId, compRaw] of Object.entries(components)) {
        if (!compRaw || typeof compRaw !== 'object') continue;
        const compExpanded = expandAbbrevs(compRaw);
        const component = compExpanded.platform || compExpanded.p || '';
        if (!SUPPORTED_COMPONENTS.has(component)) continue;

        // Merge device-level keys with component-level keys; component wins on conflict
        const merged = { ...expanded, ...compExpanded };
        const config = resolveBase(expandAbbrevs(merged), base);

        const id = makeId(component, nodeId, objectId);
        entities.set(id, {
            discovery_id: id,
            component,
            node_id:   nodeId,
            object_id: objectId,
            name:      config.name || objectId,
            unique_id: config.unique_id || id,
            config,
        });
    }
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
    const p = prefix || 'homeassistant';
    if (!topic.startsWith(p + '/') || !topic.endsWith('/config')) return;

    const inner = topic.slice(p.length + 1, -'/config'.length); // strip prefix/ and /config
    const parts = inner.split('/');

    if (parts[0] === 'device' && parts.length === 2) {
        handleDeviceDiscovery(parts[1], payloadBuf);
    } else if (parts.length === 2) {
        // <component>/<object_id>
        handleComponentDiscovery(parts[0], null, parts[1], payloadBuf);
    } else if (parts.length === 3) {
        // <component>/<node_id>/<object_id>
        handleComponentDiscovery(parts[0], parts[1], parts[2], payloadBuf);
    }
}

/** Return all currently known entities as an array. */
function getDiscoveredEntities() {
    return [...entities.values()];
}

/** Return a single entity by discovery_id, or null if not found. */
function getDiscoveredEntity(id) {
    return entities.get(id) ?? null;
}

/** Clear all entities (call on broker disconnect / reconnect to different broker). */
function clearEntities() {
    entities.clear();
}

module.exports = { handleMessage, getDiscoveredEntities, getDiscoveredEntity, clearEntities };

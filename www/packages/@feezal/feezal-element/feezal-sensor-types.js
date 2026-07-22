/**
 * E132 — the generalized boolean-sensor vocabulary, defined ONCE for the
 * three family cards (material-motion / glass-occupancy / metro-occupancy —
 * palette name "Sensor" since E132; the tag renames wait for the alias
 * mechanism). Water alarms, smoke alarms and motion sensors all behave the
 * same way: one boolean state, an icon that flips, a text per state,
 * battery-driven hardware — this module carries the per-type defaults, the
 * shared HA `device_class` map and the E124 battery-low attribute trio, the
 * `publishLocalAttribute` way (name/help written once, E117 precedent).
 */

// type → per-state defaults. `alarm: true` classes render their ACTIVE state
// in the error colour — an active fire alarm is not a neutral state chip.
export const SENSOR_TYPES = {
    motion:       {icon: 'directions_walk',       iconClear: 'directions_walk', textActive: 'Motion',    textClear: 'Clear',    alarm: false},
    presence:     {icon: 'person',                iconClear: 'person_outline',  textActive: 'Occupied',  textClear: 'Clear',    alarm: false},
    radar:        {icon: 'radar',                 iconClear: 'radar',           textActive: 'Presence',  textClear: 'Clear',    alarm: false},
    zone:         {icon: 'meeting_room',          iconClear: 'meeting_room',    textActive: 'Occupied',  textClear: 'Vacant',   alarm: false},
    'water-leak': {icon: 'water_damage',          iconClear: 'water_drop',      textActive: 'Leak!',     textClear: 'Dry',      alarm: true},
    smoke:        {icon: 'local_fire_department', iconClear: 'detector_smoke',  textActive: 'Smoke!',    textClear: 'Clear',    alarm: true},
    gas:          {icon: 'warning',               iconClear: 'gas_meter',       textActive: 'Gas!',      textClear: 'Clear',    alarm: true},
    co:           {icon: 'co2',                   iconClear: 'co2',             textActive: 'CO!',       textClear: 'Clear',    alarm: true},
    vibration:    {icon: 'vibration',             iconClear: 'check_circle',    textActive: 'Triggered', textClear: 'OK',       alarm: false},
    tamper:       {icon: 'lock_open',             iconClear: 'check_circle',    textActive: 'Tamper!',   textClear: 'OK',       alarm: true},
    generic:      {icon: 'sensors',               iconClear: 'sensors_off',     textActive: 'Active',    textClear: 'Inactive', alarm: false},
};

export const SENSOR_TYPE_OPTIONS = Object.keys(SENSOR_TYPES);

/** Resolve a type entry (unknown → generic). */
export function sensorType(type) {
    return SENSOR_TYPES[type] || SENSOR_TYPES.generic;
}

// HA/z2m `device_class` → feezal `type` — one map for all three cards AND
// consistent with what the Homematic sensor recognizer emits (E131 keeps its
// output HA-shaped: motion / moisture / smoke).
export const SENSOR_DEVICE_CLASS_MAP = {
    motion: 'motion',
    occupancy: 'presence',
    presence: 'presence',
    moisture: 'water-leak',
    smoke: 'smoke',
    gas: 'gas',
    carbon_monoxide: 'co',
    vibration: 'vibration',
    tamper: 'tamper',
    _default: 'generic',
};

// ── E124: the shared low-battery attribute trio (+ threshold) ───────────────
// Battery devices signal a weak battery as a WARNING icon, not a blackout —
// the sensor keeps reporting its state. Auto-stamped by discovery from the
// canonical `battery_low_normalized` record (both ecosystems).
export const batteryLowAttributes = [
    {name: 'subscribe-battery-low', type: 'mqttTopic', section: 'Battery',
        help: 'E124: optional low-battery topic. Boolean payloads compare against payload-battery-low; a numeric payload (battery percentage) compares against battery-low-threshold. Shows a warning icon — the state keeps updating. Stamped by auto-discovery (zigbee2mqtt battery sibling / Homematic :0 LOWBAT·LOW_BAT).'},
    {name: 'message-property-battery-low', type: 'string', default: 'payload', section: 'Battery', advanced: true,
        help: 'Dot-notation path within the battery message. Blank = fall back to element-level message-property.'},
    {name: 'payload-battery-low', type: 'string', default: 'true', section: 'Battery',
        help: 'Payload meaning the battery is low (boolean payloads; true/1 coercion included).'},
    {name: 'battery-low-threshold', type: 'number', default: 15, section: 'Battery',
        help: 'When the subscribed value is a battery PERCENTAGE (0–100), values at or below this show the low-battery icon.'},
];

/**
 * Interpret a battery-low payload value: numbers above 1 are treated as a
 * battery percentage (≤ threshold ⇒ low); everything else matches the
 * payload-battery-low compare value with the usual true/1 coercion.
 */
export function batteryLowFromValue(v, payloadLow = 'true', threshold = 15) {
    const asNum = typeof v === 'number' ? v
        : (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : null);
    if (asNum !== null && asNum > 1) return asNum <= Number(threshold ?? 15);
    return v === true || v === 1 || String(v) === '1'
        || String(v).toLowerCase() === 'true'
        || String(v) === String(payloadLow);
}

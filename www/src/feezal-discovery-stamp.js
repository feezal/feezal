// Shared discovery-stamping primitives (U58).
//
// These are the headless building blocks behind both the ⚡ per-element
// discovery picker (feezal-sidebar-inspector-attributes.js) and the bulk
// **Generate** wizard (feezal-generate-dialog.js). Keeping them here — pure,
// selection-free, inspector-free — means the two callers apply *identical*
// wiring, and each piece is unit-testable in isolation.

// Extract the leaf key of a HA/z2m `value_template` such as
// "{{ value_json.temperature }}" → "temperature". E124: z2m also emits the
// bracket form ({{ value_json["x"] }}). Returns '' for complex/unsupported
// templates. Shared by the `valueTemplateToPath` discovery transform and the
// discovery-picker attribute-suffix label (U56) — one parser, not two.
export function valueTemplateLeaf(raw) {
    const m = /\{\{\s*value_json(?:\.(\w+)|\[\s*["'](\w+)["']\s*\])\s*\}\}/.exec(String(raw ?? ''));
    return m ? (m[1] || m[2]) : '';
}

// U56: derive the per-attribute discriminator for a z2m/HA discovery entity,
// first hit wins (returns '' for single-attribute entities → label unchanged):
//   1. value_template leaf ({{ value_json.temperature }} → "temperature")
//   2. object_id / unique_id suffix with the device prefix stripped
//   3. device_class (coarse but better than nothing)
//   4. entity name when it differs from the device/topic label
export function discoveryAttributeSuffix(entity, base) {
    const cfg = entity.config || {};

    // 1. value_template leaf — reuse the shared parser (dot + bracket forms).
    const leaf = valueTemplateLeaf(cfg.value_template);
    if (leaf) return leaf;

    // 2. object_id / unique_id suffix — HA suffixes the attribute onto the
    //    device id (sensor_1_temperature). Strip the longest device prefix we
    //    can see (the topic's last segment, or the shorter of the two ids).
    const id = cfg.object_id || cfg.unique_id || '';
    if (id) {
        const topic = cfg.state_topic || '';
        const topicLeaf = topic ? topic.split('/').filter(Boolean).pop() || '' : '';
        const prefixes = [topicLeaf, cfg.object_id, cfg.unique_id]
            .filter(p => p && p !== id && id.startsWith(p + '_'));
        if (prefixes.length) {
            // pick the longest matching prefix so the shortest leaf survives.
            const prefix = prefixes.sort((a, b) => b.length - a.length)[0];
            const suffix = id.slice(prefix.length + 1);
            if (suffix) return suffix;
        }
    }

    // 3. device_class.
    if (cfg.device_class) return String(cfg.device_class);

    // 4. entity name when it adds information over the device/topic label — but a
    //    name equal to the component type ("switch", "light") is just the
    //    platform, not a distinguishing attribute, so it is not appended.
    const name = entity.name || cfg.name || '';
    if (name && name !== base && name !== entity.component && !String(base).includes(name)) return name;

    return '';
}

// A friendly, distinguishable label for a discovery entity — native recognizers
// (hm/WLED, sourceLabel) read as "<source>: <name>"; everything else falls back
// to the status topic plus the U56 per-attribute suffix so a multi-attribute z2m
// device shows one distinguishable row per attribute. Shared by the ⚡ picker and
// the Generate wizard so both label devices identically.
export function discoveryLabel(entity) {
    if (entity.sourceLabel) {
        return entity.name ? entity.sourceLabel + ': ' + entity.name : entity.sourceLabel;
    }
    const cfg = entity.config || {};
    const topic = cfg.state_topic || cfg.position_topic || cfg.percentage_state_topic ||
        cfg.current_temperature_topic || cfg.command_topic || '';
    const base = topic || entity.name || entity.discovery_id;
    const attr = discoveryAttributeSuffix(entity, base);
    return attr ? base + ' ' + attr : base;
}

// Apply a discovery entity's config onto `el` using the element class's
// feezal().discovery.map descriptor. Pure: no selection, no inspector, no
// undo — the caller owns feezal.app.change()/redraw. `el` may be a freshly
// created, not-yet-selected element. Returns true when a discovery map was
// found and applied, false otherwise.
//
// Extracted verbatim from the former `_applyDiscovery` body so the picker and
// the bulk generator wire devices byte-for-byte the same way.
export function stampDiscovery(el, entity) {
    const tagName = el.name ? 'feezal-view' : el.localName;
    const cls = window.customElements.get(tagName);
    const discoveryMap = cls?.feezal?.discovery?.map;
    if (!discoveryMap) return false;

    const cfg = entity.config || {};
    for (const [configKey, spec] of Object.entries(discoveryMap)) {
        const raw = cfg[configKey];
        if (raw === undefined || raw === null) continue;
        const attrName = typeof spec === 'string' ? spec : spec.attr;
        if (!attrName) continue;
        // onlyWhen guard — skip this mapping unless every guard key matches.
        if (typeof spec === 'object' && spec.onlyWhen &&
            !Object.entries(spec.onlyWhen).every(([k, v]) => cfg[k] === v)) {
            continue;
        }
        let value = raw;
        if (typeof spec === 'object') {
            if (spec.unit === 'mired→kelvin') {
                value = Math.round(1_000_000 / Number(raw));
            } else if (spec.valueMap) {
                value = spec.valueMap[raw] ?? spec.valueMap['_default'] ?? raw;
            } else if (spec.transform === 'first') {
                value = Array.isArray(raw) ? raw[0] : raw;
            } else if (spec.transform === 'join') {
                value = Array.isArray(raw) ? raw.join(',') : raw;
            } else if (spec.transform === 'jsonStringify') {
                value = JSON.stringify(raw);
            } else if (spec.transform === 'colorMode') {
                // supported_color_modes array → a single feezal centre control.
                // color_temp maps to brightness_ct: CT-capable lamps are
                // effectively always dimmable, and plain color_temp would
                // hide the brightness control.
                const modeMap = {
                    color_temp: 'brightness_ct', xy: 'hs', hs: 'hs',
                    rgb: 'rgb', rgbw: 'rgb', rgbww: 'rgb', white: 'brightness',
                    // E126/E122: an onoff-only capability IS the switch-only
                    // mode — a relay lamp must not be offered a brightness
                    // ring it cannot honour.
                    brightness: 'brightness', onoff: 'on_off',
                };
                const list = Array.isArray(raw) ? raw : [raw];
                value = list.map(m => modeMap[m]).find(Boolean) || 'brightness';
            } else if (spec.transform === 'valueTemplateToPath') {
                // Convert a HA value_template like "{{ value_json.state }}" to
                // a feezal message-property path like "payload.state".
                // E124: z2m also emits the bracket form ({{ value_json["x"] }}).
                const leaf = valueTemplateLeaf(raw);
                if (!leaf) continue; // complex/unsupported template — leave attribute at default
                value = 'payload.' + leaf;
            }
        }
        el.setAttribute(attrName, String(value));
        // alsoSet — apply companion attributes (e.g. switch colour-temp unit to
        // mired when mired discovery values are mapped).
        if (typeof spec === 'object' && spec.alsoSet) {
            for (const [k, v] of Object.entries(spec.alsoSet)) {
                el.setAttribute(k, String(v));
            }
        }
    }

    // N31: canonical availability applies to EVERY element automatically —
    // individual discovery maps no longer need availability_topic lines.
    const avail = cfg.availability_normalized;
    if (avail?.entries?.length) {
        el.setAttribute('subscribe-availability',
            avail.entries.length === 1 && !avail.entries[0].property
                ? avail.entries[0].topic
                : JSON.stringify(avail.entries));
        if (avail.mode && avail.mode !== 'all') el.setAttribute('availability-mode', avail.mode);
        if (avail.payloadAvailable !== undefined) el.setAttribute('payload-available', String(avail.payloadAvailable));
        if (avail.payloadUnavailable !== undefined) el.setAttribute('payload-unavailable', String(avail.payloadUnavailable));
    }

    // E124/E132: canonical low-battery record — auto-stamped like availability,
    // but ONLY for elements that declare the attribute.
    const batt = cfg.battery_low_normalized;
    const declaresBattery = cls.feezal.attributes?.some(a => a?.name === 'subscribe-battery-low');
    if (batt?.topic && declaresBattery) {
        el.setAttribute('subscribe-battery-low', batt.topic);
        if (batt.property) el.setAttribute('message-property-battery-low', batt.property);
        if (batt.payloadLow !== undefined) el.setAttribute('payload-battery-low', String(batt.payloadLow));
    }

    // Store the discovery-id for future re-sync (N12) and Generate dupe-guard.
    if (entity.discovery_id) el.setAttribute('discovery-id', entity.discovery_id);
    return true;
}

// component → ordered list of candidate feezal element *functions* (the tail
// of `feezal-element-<family>-<function>`). The first candidate registered in
// the chosen family wins; families that ship none of them yield null (a parity
// gap the caller reports as skip-and-explain). This is the minimal slice of
// E113 — the resolver's internals can grow without changing its callers.
const FUNCTION_CANDIDATES = {
    light: ['light'],
    switch: ['switch'],
    climate: ['climate'],
    cover: ['cover'],
    fan: ['fan'],
    lock: ['lock'],
    wled: ['wled'],
    camera: ['camera'],
    vacuum: ['vacuum'],
    humidifier: ['humidifier'],
    alarm_control_panel: ['alarm'],
    number: ['number', 'value'],
    select: ['select'],
    sensor: ['sensor', 'value', 'gauge'],
};

// binary_sensor is device_class-routed: a motion/occupancy sensor wants the
// motion card, an opening sensor the contact card, everything else a generic
// sensor readout. Fallbacks follow the primary so a family missing the exact
// function still lands on the nearest available card.
const BINARY_BY_CLASS = {
    motion: 'motion', occupancy: 'motion', presence: 'motion', moving: 'motion', vibration: 'motion',
    door: 'contact', window: 'contact', garage_door: 'contact', opening: 'contact', lock: 'contact',
    smoke: 'sensor', gas: 'sensor', moisture: 'sensor', co: 'sensor', problem: 'sensor',
    safety: 'sensor', tamper: 'sensor', battery: 'sensor',
};

// The discovery components the Generate wizard knows how to turn into an
// element (regardless of family). Used to filter the device list down to
// generatable entities, so raw/unknown MQTT discovery rows are not offered.
export function knownComponents() {
    return [...Object.keys(FUNCTION_CANDIDATES), 'binary_sensor'];
}

const defaultIsRegistered = tag => !!window.customElements?.get(tag);

// Resolve the concrete element tag for a discovered entity in a chosen style
// family, or null when the family has no element for this function (parity
// gap). `isRegistered(tag)` is injectable for testing.
export function resolveElementTag(component, family, deviceClass, isRegistered = defaultIsRegistered) {
    let candidates;
    if (component === 'binary_sensor') {
        candidates = [BINARY_BY_CLASS[deviceClass] || 'contact', 'contact', 'motion', 'sensor'];
    } else {
        candidates = FUNCTION_CANDIDATES[component] || [];
    }
    const seen = new Set();
    for (const fn of candidates) {
        if (seen.has(fn)) continue;
        seen.add(fn);
        const tag = `feezal-element-${family}-${fn}`;
        if (isRegistered(tag)) return tag;
    }
    return null;
}

// Deterministic uniform-cell packing: `count` cells of `cellW`×`cellH` laid
// left-to-right, wrapping into rows that fit `viewWidth`. Returns view-local
// {left, top} pixel positions. Devices-mode only (flat auto-grid).
export function layoutGrid(count, {cellW = 100, cellH = 100, viewWidth = 1200, gapX = 16, gapY = 16, padX = 16, padY = 16} = {}) {
    const w = cellW || 100;
    const h = cellH || 100;
    const usable = Math.max(w, viewWidth - padX * 2);
    const cols = Math.max(1, Math.floor((usable + gapX) / (w + gapX)));
    const out = [];
    for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        out.push({left: padX + col * (w + gapX), top: padY + row * (h + gapY)});
    }
    return out;
}

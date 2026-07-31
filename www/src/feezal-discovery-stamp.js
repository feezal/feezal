// Shared discovery-stamping primitives (U58).
//
// These are the headless building blocks behind both the ⚡ per-element
// discovery picker (feezal-sidebar-inspector-attributes.js) and the bulk
// **Generate** wizard (feezal-generate-dialog.js). Keeping them here — pure,
// selection-free, inspector-free — means the two callers apply *identical*
// wiring, and each piece is unit-testable in isolation.

// U62/E135: `friendlyName` now lives in @feezal/feezal-element so element
// packages (the device-health inspector) derive labels identically. Re-exported
// here so every existing importer of this module is unchanged.
import {friendlyName} from '@feezal/feezal-element/feezal-friendly-name.js';
// U67: localize the generated room labels via A27 Phase 1's locale machinery.
import {localizedDefault} from '@feezal/feezal-element/feezal-locale.js';
export {friendlyName};

// E161: MDI (`mdi:*`) → Material Symbols alias table for the `mdiIcon` transform.
import {MDI_TO_SYMBOLS} from './mdi-to-symbols.js';

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
    // E161: prefer the device's friendly name ("Lichterkette Ida") over the raw
    // MQTT topic, so a discovered device reads "Lichterkette Ida relay" rather
    // than "esphome/…/relay/state". Requires B89's nested-`device` expansion so
    // `dev.name` is actually available on ESPHome configs. The U56 per-attribute
    // suffix still disambiguates one device's many entities.
    const deviceName = cfg.device?.name;
    if (deviceName) {
        const nice = friendlyName(deviceName);
        const attr = discoveryAttributeSuffix(entity, deviceName);
        return attr ? nice + ' ' + attr : nice;
    }
    const topic = cfg.state_topic || cfg.position_topic || cfg.percentage_state_topic ||
        cfg.current_temperature_topic || cfg.command_topic || '';
    const base = topic || entity.name || entity.discovery_id;
    const attr = discoveryAttributeSuffix(entity, base);
    return attr ? base + ' ' + attr : base;
}

/**
 * B86 — separator between the discovery id and the row index inside an
 * <sl-option> value.
 *
 * It must satisfy three constraints at once:
 *  - Survive HTML parsing. The previous separator was a NUL, written as a
 *    unicode escape; a tagged template cooks that into a real NUL, Lit builds
 *    its template by parsing an HTML string, and per spec a NUL in
 *    attribute-value state becomes U+FFFD. The separator was destroyed before
 *    any value was ever assigned, so every pick silently stamped nothing.
 *  - Never occur in the id half, which is percent-encoded. encodeURIComponent
 *    leaves only alphanumerics and -_.!~*'() unescaped, so "|" cannot appear.
 *  - Not be a space: Shoelace treats that as a multi-value delimiter.
 *
 * Interpolated into the template rather than written literally, so no future
 * separator can be mangled by the parser either.
 */
export const DISCOVERY_ROW_SEP = '|';

// Apply a discovery entity's config onto `el` using the element class's
// feezal().discovery.map descriptor. Pure: no selection, no inspector, no
// undo — the caller owns feezal.app.change()/redraw. `el` may be a freshly
// created, not-yet-selected element. Returns true when a discovery map was
// found and applied, false otherwise.
//
// Extracted verbatim from the former `_applyDiscovery` body so the picker and
// the bulk generator wire devices byte-for-byte the same way.
export function stampDiscovery(el, entity, variant = null) {
    const tagName = el.name ? 'feezal-view' : el.localName;
    const cls = window.customElements.get(tagName);
    // E156: pick the map that matches the entity's component (and the chosen
    // axis variant, when the picker offered several rows for one entity).
    const discoveryMap = discoveryMapFor(cls, entity, variant);
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
            } else if (spec.transform === 'mdiIcon') {
                // E161: the discovered `icon` is a Material *Design Icons* name
                // (mdi:lightbulb); feezal renders Material *Symbols*. Map via the
                // alias table. A name we have no alias for is SKIPPED so the E160
                // device_class icon (or the element default) stands rather than a
                // blank glyph — never passed through verbatim.
                const sym = MDI_TO_SYMBOLS[String(raw).replace(/^mdi:/, '').trim()];
                if (!sym) continue;
                value = sym;
            }
        }
        // U62: any value routed to `label` is normalized into a friendly human
        // label (one place, all sources — native hm/WLED, HA, z2m). A `name`
        // that is just the platform ("switch", "light") carries no information;
        // skip it so the topic fallback below supplies a real label.
        if (attrName === 'label') {
            if (String(value) === entity.component) continue;
            value = friendlyName(value);
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

    // U62: z2m fallback — when no usable `name` produced a label (missing, or
    // just the platform), derive one from the base topic's last segment
    // (`zigbee2mqtt/licht_hobbyraum` → "Licht Hobbyraum") and normalize it.
    const declaresLabel = cls.feezal.attributes?.some(a => a?.name === 'label');
    if (declaresLabel && !el.getAttribute('label')) {
        const topic = cfg.state_topic || cfg.position_topic || cfg.percentage_state_topic ||
            cfg.current_temperature_topic || cfg.command_topic || '';
        const leaf = topic ? topic.split('/').filter(Boolean).pop() || '' : '';
        const label = friendlyName(leaf);
        if (label) el.setAttribute('label', label);
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

    // E135: canonical fault + sabotage records — auto-stamped like battery, but
    // ONLY for elements that declare the attributes (presence-checked emission).
    const declares = name => cls.feezal.attributes?.some(a => a?.name === name);
    const err = cfg.error_normalized;
    if (err?.topic && declares('subscribe-error')) {
        el.setAttribute('subscribe-error', err.topic);
        if (err.property) el.setAttribute('message-property-error', err.property);
        if (err.deviceType) el.setAttribute('error-device-type', err.deviceType);
    }
    const sab = cfg.sabotage_normalized;
    if (sab?.topic && declares('subscribe-sabotage')) {
        el.setAttribute('subscribe-sabotage', sab.topic);
        if (sab.property) el.setAttribute('message-property-sabotage', sab.property);
        if (sab.encoding) el.setAttribute('sabotage-encoding', sab.encoding);
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
    // E149: `knob` is the concrete number editor (panel family); `value` is the
    // read-only fallback when a family has no editable number element.
    number: ['number', 'knob', 'value'],
    select: ['select'],
    // E149: command-only presses (scene reuses the button element/map) and a
    // free-text field. camera / alarm_control_panel already resolve above.
    button: ['button'],
    scene: ['button'],
    text: ['input'],
    image: ['image'],
    // E150: water_heater is climate-shaped — reuse the climate card (its map
    // + aliasComponents link consume the identically-named HA topic keys).
    water_heater: ['climate'],
    // A HA `sensor` is a numeric/text READ-OUT → the `value` card (then `gauge`).
    // NOT the `-sensor` element: per E138 `-sensor` is the boolean/alarm card,
    // which only `binary_sensor` resolves to (see the binary_sensor branch).
    // Routing a numeric sensor to `-sensor` produced a boolean card that can't
    // display a value (e.g. a power-meter channel).
    sensor: ['value', 'gauge'],
    // E109: evcc native entities. The site entity binds to the generic
    // energy-flow diagram (material family only); each loadpoint to the
    // loadpoint control card (glass/metro/circle).
    'energy-flow': ['energy-flow'],
    'evcc-loadpoint': ['loadpoint'],
};

// binary_sensor is device_class-routed: a motion/occupancy sensor wants the
// motion card, an *opening* class the contact card, everything else a generic
// sensor readout. B59: an UNMAPPED or missing device_class defaults to `sensor`,
// NOT `contact` — assuming open/close for e.g. a mis-classified numeric/power
// reading turned it into an open-close card. `contact` is only chosen for a
// genuine opening class, never as the fallback.
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

// E150: the discovery components an element consumes — its primary
// `discovery.component` plus any `discovery.aliasComponents` (e.g. a climate
// card also accepts `water_heater`, which is climate-shaped). The ⚡ per-element
// picker and the auto-config banner match entities against this set.
// E156 — an element may accept entities of MORE THAN ONE component, each wired
// through its own map. Three levels, in increasing specificity:
//
//   discovery: {component: 'switch', map}                 the common case
//   discovery: {component, aliasComponents: [...], map}   E150 profile aliases
//                                                         (same map for all)
//   discovery: {component, map, accepts: [{component, map, when?, label?}]}
//
// An `accepts` variant is what lets a *-switch drive a `light` (different wiring
// than a `switch`) and a *-slider drive one AXIS of a light. `when(config)`
// gates a variant on the entity actually supporting it — that is how the
// slider's "settable only" guardrail is expressed, and how a light with no
// brightness never shows up as a brightness slider. `label` is the U56-style
// suffix that distinguishes the resulting picker rows.

/** Every component an element's discovery descriptor can consume, in order. */
export function acceptedComponents(cls) {
    const d = cls?.feezal?.discovery;
    if (!d) return [];
    return [...new Set([
        d.component,
        ...(d.aliasComponents || []),
        ...(d.accepts || []).map(a => a?.component),
    ].filter(Boolean))];
}

export function elementAcceptsComponent(cls, component) {
    return Boolean(component) && acceptedComponents(cls).includes(component);
}

/**
 * The `accepts` variants that apply to a given entity — component match plus
 * the variant's own `when(config)` guard. Empty when the base map handles it.
 */
export function discoveryVariantsFor(cls, entity) {
    const d = cls?.feezal?.discovery;
    if (!d || !entity) return [];
    const cfg = entity.config || {};
    return (d.accepts || []).filter(a =>
        a?.component === entity.component && (typeof a.when !== 'function' || a.when(cfg)));
}

/** The map to stamp a given entity with — an explicit variant wins. */
export function discoveryMapFor(cls, entity, variant) {
    if (variant?.map) return variant.map;
    const d = cls?.feezal?.discovery;
    if (!d) return null;
    // A matching `accepts` variant wins — that is what wires a light through
    // the switch's light keys instead of its switch keys. Otherwise the base
    // map, exactly as before.
    //
    // Deliberately NOT "any component other than the declared one uses a
    // variant": elements are ALSO routed cross-component by the resolver, and
    // are expected to handle that with their single map — E149 lands a `scene`
    // on the button element, whose one map covers both `payload_press` and
    // `payload_on`. Withholding the base map there broke it.
    const matched = discoveryVariantsFor(cls, entity)[0];
    if (matched) return matched.map;
    return d.map || null;
}

/**
 * Expand the entity list into the rows an element's picker should offer.
 *
 * One entity yields one row normally — but a `light` offered to a slider
 * yields one row PER settable axis (brightness, colour temp), the same
 * one-entity-→-several-rows shape U56 introduced for multi-attribute sensors.
 * Rows carry the variant so the stamp uses the matching map.
 */
export function discoveryCandidates(cls, entities = []) {
    const out = [];
    for (const entity of entities) {
        if (!elementAcceptsComponent(cls, entity.component)) continue;
        const variants = discoveryVariantsFor(cls, entity);
        const base = cls?.feezal?.discovery;
        const isBaseComponent = entity.component === base?.component ||
            (base?.aliasComponents || []).includes(entity.component);
        if (isBaseComponent && !variants.length) {
            out.push({entity, variant: null, label: discoveryLabel(entity)});
            continue;
        }
        for (const variant of variants) {
            out.push({
                entity,
                variant,
                label: variant.label ? `${discoveryLabel(entity)} ${variant.label}` : discoveryLabel(entity),
            });
        }
    }
    return out;
}

const defaultIsRegistered = tag => !!window.customElements?.get(tag);

// Resolve the concrete element tag for a discovered entity in a chosen style
// family, or null when the family has no element for this function (parity
// gap). `isRegistered(tag)` is injectable for testing.
export function resolveElementTag(component, family, deviceClass, isRegistered = defaultIsRegistered) {
    let candidates;
    if (component === 'binary_sensor') {
        // B59: default to `sensor` for an unmapped/missing class; `contact` is a
        // last resort (never the default), so a non-opening binary reading is
        // never turned into an open/close card.
        candidates = [BINARY_BY_CLASS[deviceClass] || 'sensor', 'sensor', 'motion', 'contact'];
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

// ─────────────────────────────────────────────────────────────────────────────
// U58 Phase ② — App mode: room detection + bucket grouping (pure, testable)
// ─────────────────────────────────────────────────────────────────────────────

// Multilingual room-word lexicon. Detection tokenizes the searched strings on
// non-letter boundaries and matches tokens exactly — plus prefix-matching for
// words ≥5 chars, so German compounds ("Schlafzimmerfenster") still hit.
// `label` is the English source / final fallback; `labelI18n` (U67) localizes
// the drawer entry the wizard proposes (A27 Phase 1 languages), resolved
// against the site locale in detectRoom. Labels stay editable in review.
export const ROOM_LEXICON = [
    {label: 'Living room', icon: 'chair',        labelI18n: {de: 'Wohnzimmer', es: 'Salón', fr: 'Salon', it: 'Soggiorno', pl: 'Salon', pt: 'Sala de estar', tr: 'Oturma odası'},
        words: ['living', 'livingroom', 'wohnzimmer', 'lounge', 'salon', 'soggiorno', 'sala', 'wohnen']},
    {label: 'Kitchen',     icon: 'kitchen',      labelI18n: {de: 'Küche', es: 'Cocina', fr: 'Cuisine', it: 'Cucina', pl: 'Kuchnia', pt: 'Cozinha', tr: 'Mutfak'},
        words: ['kitchen', 'küche', 'kueche', 'cocina', 'cuisine', 'cucina', 'kuchnia', 'mutfak']},
    {label: 'Bedroom',     icon: 'bed',          labelI18n: {de: 'Schlafzimmer', es: 'Dormitorio', fr: 'Chambre', it: 'Camera da letto', pl: 'Sypialnia', pt: 'Quarto', tr: 'Yatak odası'},
        words: ['bedroom', 'schlafzimmer', 'schlafen', 'dormitorio', 'chambre', 'camera', 'sypialnia', 'quarto']},
    {label: 'Bathroom',    icon: 'bathtub',      labelI18n: {de: 'Badezimmer', es: 'Baño', fr: 'Salle de bain', it: 'Bagno', pl: 'Łazienka', pt: 'Banheiro', tr: 'Banyo'},
        words: ['bathroom', 'bad', 'badezimmer', 'baño', 'bano', 'salle', 'bagno', 'łazienka', 'lazienka', 'banheiro', 'banyo', 'wc', 'toilette', 'toilet']},
    {label: 'Office',      icon: 'desk',         labelI18n: {de: 'Büro', es: 'Oficina', fr: 'Bureau', it: 'Ufficio', pl: 'Biuro', pt: 'Escritório', tr: 'Ofis'},
        words: ['office', 'büro', 'buero', 'arbeitszimmer', 'oficina', 'bureau', 'ufficio', 'biuro', 'escritório', 'escritorio', 'ofis', 'study']},
    {label: 'Hallway',     icon: 'meeting_room', labelI18n: {de: 'Flur', es: 'Pasillo', fr: 'Couloir', it: 'Corridoio', pl: 'Korytarz', pt: 'Corredor', tr: 'Koridor'},
        words: ['hallway', 'hall', 'flur', 'diele', 'korridor', 'corridor', 'pasillo', 'couloir', 'corridoio', 'entrada', 'entrance', 'eingang', 'treppenhaus', 'treppe']},
    {label: 'Kids room',   icon: 'child_care',   labelI18n: {de: 'Kinderzimmer', es: 'Habitación infantil', fr: "Chambre d'enfant", it: 'Cameretta', pl: 'Pokój dziecięcy', pt: 'Quarto das crianças', tr: 'Çocuk odası'},
        words: ['kinderzimmer', 'kids', 'nursery', 'children']},
    {label: 'Dining room', icon: 'restaurant',   labelI18n: {de: 'Esszimmer', es: 'Comedor', fr: 'Salle à manger', it: 'Sala da pranzo', pl: 'Jadalnia', pt: 'Sala de jantar', tr: 'Yemek odası'},
        words: ['dining', 'esszimmer', 'comedor', 'jadalnia']},
    {label: 'Garage',      icon: 'garage',       labelI18n: {de: 'Garage', es: 'Garaje', fr: 'Garage', it: 'Garage', pl: 'Garaż', pt: 'Garagem', tr: 'Garaj'},
        words: ['garage', 'garaje', 'garagem', 'garaż', 'garaz', 'carport']},
    {label: 'Garden',      icon: 'yard',         labelI18n: {de: 'Garten', es: 'Jardín', fr: 'Jardin', it: 'Giardino', pl: 'Ogród', pt: 'Jardim', tr: 'Bahçe'},
        words: ['garden', 'garten', 'jardín', 'jardin', 'giardino', 'ogród', 'ogrod', 'bahçe', 'bahce', 'outdoor', 'aussen', 'außen']},
    {label: 'Terrace',     icon: 'deck',         labelI18n: {de: 'Terrasse', es: 'Terraza', fr: 'Terrasse', it: 'Terrazza', pl: 'Taras', pt: 'Terraço', tr: 'Teras'},
        words: ['terrace', 'terrasse', 'balkon', 'balcony', 'balcón', 'balcon', 'terraza', 'patio', 'taras']},
    {label: 'Basement',    icon: 'foundation',   labelI18n: {de: 'Keller', es: 'Sótano', fr: 'Cave', it: 'Cantina', pl: 'Piwnica', pt: 'Porão', tr: 'Bodrum'},
        words: ['basement', 'keller', 'sótano', 'sotano', 'cave', 'cantina', 'piwnica', 'porão', 'porao', 'hobbyraum', 'hwr']},
    {label: 'Attic',       icon: 'roofing',      labelI18n: {de: 'Dachboden', es: 'Ático', fr: 'Grenier', it: 'Soffitta', pl: 'Strych', pt: 'Sótão', tr: 'Çatı katı'},
        words: ['attic', 'dachboden', 'dachgeschoss', 'ático', 'atico', 'grenier', 'strych', 'sótão', 'sotao']},
    {label: 'Laundry',     icon: 'local_laundry_service', labelI18n: {de: 'Waschküche', es: 'Lavadero', fr: 'Buanderie', it: 'Lavanderia', pl: 'Pralnia', pt: 'Lavandaria', tr: 'Çamaşır odası'},
        words: ['laundry', 'waschküche', 'waschkueche', 'waschraum', 'lavadero', 'buanderie', 'lavanderia', 'pralnia']},
    {label: 'Guest room',  icon: 'night_shelter', labelI18n: {de: 'Gästezimmer', es: 'Habitación de invitados', fr: "Chambre d'amis", it: 'Camera degli ospiti', pl: 'Pokój gościnny', pt: 'Quarto de hóspedes', tr: 'Misafir odası'},
        words: ['guest', 'gästezimmer', 'gaestezimmer', 'gast']},
    // A guest toilet is its OWN room, not generic Bathroom: its specific words
    // (e.g. folded `gaestetoilette`, 14 chars) out-rank Bathroom's `toilette` (8)
    // under the longest-match rule. Umlaut + ASCII spellings both fold to the
    // same string, so `gästetoilette` and `gaestetoilette` are covered alike.
    {label: 'Guest toilet', icon: 'wc',           labelI18n: {de: 'Gäste-WC', es: 'Aseo de invitados', fr: 'WC invités', it: 'Bagno degli ospiti', pl: 'Toaleta dla gości', pt: 'Lavabo de hóspedes', tr: 'Misafir tuvaleti'},
        words: ['gästetoilette', 'gaestetoilette', 'gäste-wc', 'gaestewc', 'gästewc', 'gästeklo', 'gaesteklo']},
];

/** The localized drawer label for a lexicon room, resolved against the site
 * locale (U67, reusing A27 Phase 1). Falls back to the English `label`. */
const roomLabel = room => localizedDefault({default: room.label, defaultI18n: room.labelI18n});

/** The bucket every unmatched device lands in (still editable in review). */
export const UNKNOWN_ROOM = 'Unassigned';

// Function-axis taxonomy — built OVER the classification that already exists
// (FUNCTION_CANDIDATES / BINARY_BY_CLASS below, MOTION/ALARM types from
// feezal-sensor-types), never a parallel opinion. `order` is the E138
// taxonomy order the drawer follows — "Lights, Covers, Climate…" reads as a
// dashboard, alphabetical reads as a list.
const FN_TAXONOMY = {
    lights:   {label: 'Lights',             icon: 'lightbulb',        order: 0},
    switches: {label: 'Switches & sockets', icon: 'toggle_on',        order: 1},
    covers:   {label: 'Covers & blinds',    icon: 'blinds',           order: 2},
    climate:  {label: 'Climate',            icon: 'thermostat',       order: 3},
    contact:  {label: 'Windows & doors',    icon: 'sensor_door',      order: 4},
    motion:   {label: 'Motion & presence',  icon: 'motion_photos_on', order: 5},
    alarms:   {label: 'Alarms',             icon: 'warning',          order: 6},
    sensors:  {label: 'Sensors',            icon: 'sensors',          order: 7},
    locks:    {label: 'Locks',              icon: 'lock',             order: 8},
    media:    {label: 'Media',              icon: 'play_circle',      order: 9},
    energy:   {label: 'Energy',             icon: 'bolt',             order: 10},
    other:    {label: 'Other',              icon: 'category',         order: 11},
};

const FN_BY_COMPONENT = {
    light: 'lights', wled: 'lights',
    switch: 'switches',
    cover: 'covers',
    climate: 'climate', water_heater: 'climate', humidifier: 'climate',
    lock: 'locks',
    media_player: 'media',
    'energy-flow': 'energy', 'evcc-loadpoint': 'energy',
    sensor: 'sensors',
};

// binary_sensor device_class → taxonomy key. Contact classes mirror
// BINARY_BY_CLASS; motion/alarm follow E132/E138's split (feezal-sensor-types:
// MOTION_SENSOR_TYPES / ALARM_SENSOR_TYPES). Unmapped defaults to sensors
// (B59's rule: never contact).
const FN_BINARY_BY_CLASS = {
    door: 'contact', window: 'contact', garage_door: 'contact', opening: 'contact', lock: 'contact',
    motion: 'motion', occupancy: 'motion', presence: 'motion', moving: 'motion',
    smoke: 'alarms', gas: 'alarms', moisture: 'alarms', co: 'alarms',
    vibration: 'alarms', tamper: 'alarms', safety: 'alarms', problem: 'alarms',
};

const tokenize = s => String(s || '').toLowerCase().split(/[^a-zäöüáéíóúàèìòùâêîôûãõçłńśźżığş]+/).filter(Boolean);

/**
 * Canonical fold for matching (U76): lowercase, German umlaut → digraph
 * (ä→ae ö→oe ü→ue ß→ss), strip remaining diacritics AND all separators, so
 * `Gäste-WC` / `gaestewc` and `Küche` / `kueche` collapse to one string. One
 * lexicon spelling then covers both the umlaut and the ASCII form. Shared by
 * the room matcher below and the U77 zone clusterer.
 */
export function foldToken(s) {
    const map = {ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', æ: 'ae', ø: 'o', å: 'a'};
    return String(s || '').toLowerCase()
        .replace(/[äöüßæøå]/g, c => map[c])
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

// U76: the lexicon words, pre-folded once (detectRoom runs per entity).
const ROOM_LEXICON_FOLDED = ROOM_LEXICON.map(room => ({
    room, words: [...new Set(room.words.map(foldToken).filter(Boolean))],
}));

// U76: stems that are legitimate whole words but dangerous as substrings —
// matched only as a whole token or prefix, never mid-word. `camera` (Italian
// "room") is also a webcam device word, so an `ipcamera` must not read Bedroom.
const AMBIGUOUS_STEMS = new Set(['camera']);

/**
 * Room detection for one entity. Resolution: a joined device-group area
 * (`entity.__area`, from /api/discovery/device-groups) or the entity's own
 * `device.suggested_area` is TRUSTED and wins verbatim; otherwise the lexicon
 * is matched (U76: canonical fold + prefix + bounded substring) over the label,
 * entity name and state topic (a GUESS). Returns {label, icon, source:
 * 'area'|'guess'} or null (→ UNKNOWN_ROOM bucket).
 */
export function detectRoom(entity) {
    const cfg = entity?.config || {};
    const area = entity?.__area || cfg.device?.suggested_area;
    if (area) return {label: String(area), icon: 'meeting_room', source: 'area'};
    const tokens = tokenize([discoveryLabel(entity), entity?.name, cfg.state_topic].join(' ')).map(foldToken);
    // U76: prefer the LONGEST (most specific) matching stem, so a short generic
    // word in an early lexicon entry can't beat a specific word in a later one.
    let best = null, bestLen = 0;
    for (const {room, words} of ROOM_LEXICON_FOLDED) {
        for (const w of words) {
            const hit = tokens.some(t =>
                t === w                                          // whole token
                || (w.length >= 5 && t.startsWith(w))            // prefix (Schlafzimmerfenster)
                || (w.length >= 6 && !AMBIGUOUS_STEMS.has(w) && t.includes(w)));  // compound (…toilette)
            if (hit && w.length > bestLen) { best = room; bestLen = w.length; }
        }
    }
    // U67: the drawer label follows the site locale; the view slug (derived from
    // this label) then follows too — stable per locale.
    if (best) return {label: roomLabel(best), icon: best.icon, source: 'guess'};
    return null;
}

/** Function-axis bucket for one entity: {label, icon, order}. */
export function functionBucket(entity) {
    let key;
    if (entity?.component === 'binary_sensor') {
        key = FN_BINARY_BY_CLASS[entity.config?.device_class] || 'sensors';
    } else {
        key = FN_BY_COMPONENT[entity?.component] || 'other';
    }
    return FN_TAXONOMY[key];
}

/**
 * View names reach the URL (#/<view>) — slugify the human label for the view
 * `name`, keep the label for the drawer entry. ASCII-folded with German
 * transliteration (Büro → buero), lowercased, hyphenated. STABLE: the same
 * label always yields the same slug, so re-runs merge instead of duplicating.
 */
export function slugifyViewName(label) {
    const map = {ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', æ: 'ae', ø: 'o', å: 'a'};
    let s = String(label || '').toLowerCase()
        .replace(/[äöüßæøå]/g, c => map[c])
        .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip remaining diacritics
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s || 'view';
}

// ── U77: data-driven zone clustering ────────────────────────────────────────
// The lexicon only knows dictionary room words. People also label devices with
// custom zones a lexicon can never hold — a nickname, a person's/pet's name, a
// floor or wing. Those recur across many devices (Homematic AND zigbee both
// concatenate the human label), so a name token shared by ≥ N devices is very
// likely a zone. This runs ONLY over what detectRoom left Unassigned, and only
// suggests — the review lets the user rename/merge/dismiss.

const MIN_ZONE_DEVICES = 2;   // a token must recur on at least this many devices

// Every folded lexicon word — a token that IS a room word is handled by the
// lexicon, never re-clustered.
const ROOM_WORDS_FOLDED = new Set(ROOM_LEXICON_FOLDED.flatMap(r => r.words));

// Device / function / measurement / brand / global-prefix nouns (folded) —
// these recur on many devices for reasons that are NOT a zone, so they must
// never seed a cluster. Multilingual, deliberately broad; the review is the
// safety net for anything that slips through.
const DEVICE_STOPWORDS = new Set([
    // light
    'light', 'lights', 'lamp', 'lampe', 'lampen', 'licht', 'leuchte', 'birne', 'bulb', 'spot', 'strip', 'led',
    // switch / socket
    'switch', 'schalter', 'steckdose', 'socket', 'plug', 'outlet', 'relais', 'relay', 'actor', 'aktor', 'actuator',
    // sensor / measurement
    'sensor', 'sensors', 'melder', 'temperatur', 'temperature', 'temp', 'humidity', 'feuchte', 'feuchtigkeit',
    'luftfeuchte', 'brightness', 'helligkeit', 'lux', 'illuminance', 'power', 'leistung', 'energy', 'energie',
    'current', 'voltage', 'battery', 'batterie', 'akku', 'pressure', 'luftdruck', 'consumption', 'meter',
    // cover / blind
    'cover', 'rollo', 'rolladen', 'rollladen', 'jalousie', 'jalousette', 'blind', 'blinds', 'shutter', 'markise', 'raffstore',
    // climate
    'climate', 'thermostat', 'heizung', 'heizkoerper', 'heating', 'hvac', 'klima', 'radiator', 'ventil', 'valve',
    // contact / opening
    'contact', 'kontakt', 'fenster', 'window', 'tuer', 'door', 'tor', 'gate', 'reed',
    // motion / presence
    'motion', 'bewegung', 'bewegungsmelder', 'presence', 'praesenz', 'pir', 'occupancy',
    // controls
    'button', 'taster', 'knopf', 'dimmer', 'remote', 'fernbedienung', 'scene', 'szene',
    // generic
    'device', 'geraet', 'geraete', 'channel', 'kanal', 'node', 'entity', 'status', 'state', 'zustand',
    'set', 'cmd', 'command', 'config', 'smart', 'home', 'haus', 'house', 'flat', 'wohnung', 'my',
    // colours / modes
    'rgb', 'rgbw', 'rgbww', 'white', 'warm', 'cold', 'color', 'colour',
    // brand / platform
    'zigbee', 'zigbee2mqtt', 'deconz', 'conbee', 'zwave', 'hmip', 'homematic', 'ccu', 'redmatic', 'mqtt',
    'tasmota', 'shelly', 'esphome', 'tuya', 'sonoff', 'ikea', 'tradfri', 'hue', 'philips', 'osram', 'aqara',
    'xiaomi', 'wled', 'fibaro', 'lidl', 'ledvance',
]);

/** Is a folded token a plausible zone label (not a number, room word, device
 * word, or too short)? */
function isZoneCandidate(t) {
    return !!t && t.length >= 3 && !/^\d+$/.test(t)
        && !ROOM_WORDS_FOLDED.has(t) && !DEVICE_STOPWORDS.has(t);
}

/**
 * Cluster the Unassigned leftovers by recurring name tokens (U77). Returns a
 * Map<entity, {label, icon}> for the entities that landed in a zone; entities
 * absent from the map stay Unassigned. Each entity joins its most-frequent
 * qualifying token (ties → the longer token). Client-side only.
 */
export function clusterZones(entities) {
    const out = new Map();
    const list = entities || [];
    if (list.length < MIN_ZONE_DEVICES) return out;

    // Per entity: folded-token → first original spelling (for a pretty label).
    const perEntity = list.map(e => {
        const orig = tokenize([discoveryLabel(e), e?.name].join(' '));
        const folds = new Map();
        for (const o of orig) {
            const f = foldToken(o);
            if (isZoneCandidate(f) && !folds.has(f)) folds.set(f, o);
        }
        return {e, folds};
    });

    // Document frequency: how many distinct devices carry each token.
    const df = new Map();
    for (const {folds} of perEntity) for (const f of folds.keys()) df.set(f, (df.get(f) || 0) + 1);
    const qualifying = new Set([...df].filter(([, n]) => n >= MIN_ZONE_DEVICES).map(([f]) => f));
    if (!qualifying.size) return out;

    for (const {e, folds} of perEntity) {
        let best = null, bestN = 0;
        for (const [f, orig] of folds) {
            if (!qualifying.has(f)) continue;
            const n = df.get(f);
            if (n > bestN || (n === bestN && best && orig.length > best.length)) { best = orig; bestN = n; }
        }
        if (best) out.set(e, {label: titleCaseToken(best), icon: 'label'});
    }
    return out;
}

/** Titlecase a single name token for a zone label ('ida' → 'Ida'). */
function titleCaseToken(s) {
    const t = String(s || '');
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/**
 * Group entities into App-mode buckets on one axis ('room' | 'function').
 * Returns [{label, icon, order, guessed, detected, entities}] — rooms
 * locale-sorted with UNKNOWN_ROOM pinned last, functions in taxonomy order. A
 * room bucket is `guessed` unless at least one entity carried a TRUSTED area;
 * a `detected` bucket is a U77 frequency cluster.
 */
export function groupForApp(entities, axis) {
    const buckets = new Map();
    const add = (b, entity) => {
        if (!buckets.has(b.label)) {
            buckets.set(b.label, {label: b.label, icon: b.icon, order: b.order ?? null,
                guessed: axis !== 'function', detected: false, area: false, entities: []});
        }
        const bucket = buckets.get(b.label);
        bucket.entities.push(entity);
        // A TRUSTED area (HA suggested_area / device-group area): shown verbatim,
        // not a guess. Track it so the review can badge it "area".
        if (b.source === 'area') { bucket.guessed = false; bucket.area = true; }
        if (b.source === 'cluster') bucket.detected = true;
    };

    if (axis === 'function') {
        for (const entity of entities || []) add({...functionBucket(entity), source: 'taxonomy'}, entity);
    } else {
        // Precedence: trusted area > lexicon room > U77 cluster > Unassigned.
        const unresolved = [];
        for (const entity of entities || []) {
            const r = detectRoom(entity);
            if (r) add(r, entity); else unresolved.push(entity);
        }
        const clusters = clusterZones(unresolved);
        for (const entity of unresolved) {
            const c = clusters.get(entity);
            add(c ? {...c, source: 'cluster'} : {label: UNKNOWN_ROOM, icon: 'inventory_2', source: 'none'}, entity);
        }
    }

    const arr = [...buckets.values()];
    if (axis === 'function') {
        return arr.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.label.localeCompare(b.label));
    }
    return arr.sort((a, b) =>
        (a.label === UNKNOWN_ROOM) - (b.label === UNKNOWN_ROOM) || a.label.localeCompare(b.label, undefined, {sensitivity: 'base'}));
}

/** The folded lexicon words for a room LABEL (matched against the English label
 * or the localized drawer label), or [] for a custom / area / cluster room. Lets
 * an edited room list (U78) keep a lexicon room's synonyms after a rename. */
export function lexiconWordsForLabel(label) {
    for (const {room, words} of ROOM_LEXICON_FOLDED) {
        if (room.label === label || roomLabel(room) === label) return [...words];
    }
    return [];
}

/**
 * Assign one entity to a room from an explicit, user-edited room list (U78).
 * Each room is `{label, icon, words?}`: a trusted `suggested_area` that names one
 * of the rooms wins; otherwise the entity name is matched (U76 fold + prefix +
 * bounded substring) against each room's `words` ∪ its own folded label, longest
 * stem winning. Returns the matched room object, or null (→ Unassigned).
 */
export function assignRoom(entity, rooms) {
    if (!rooms || !rooms.length) return null;
    const cfg = entity?.config || {};
    const area = entity?.__area || cfg.device?.suggested_area;
    if (area) {
        const fa = foldToken(area);
        const hit = rooms.find(r => foldToken(r.label) === fa);
        if (hit) return hit;
    }
    const tokens = tokenize([discoveryLabel(entity), entity?.name, cfg.state_topic].join(' ')).map(foldToken);
    let best = null, bestLen = 0;
    for (const r of rooms) {
        const words = new Set([...(r.words || []), foldToken(r.label)].filter(Boolean));
        for (const w of words) {
            const hit = tokens.some(t =>
                t === w || (w.length >= 5 && t.startsWith(w))
                || (w.length >= 6 && !AMBIGUOUS_STEMS.has(w) && t.includes(w)));
            if (hit && w.length > bestLen) { best = r; bestLen = w.length; }
        }
    }
    return best;
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

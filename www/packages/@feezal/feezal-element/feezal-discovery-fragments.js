/**
 * E156/E157/E158/B81 — cross-component discovery fragments.
 *
 * Discovery used to match an element only to entities whose component EQUALS
 * the element's own. That is too strict: a device of one component is often
 * controllable by an element of another. These fragments express those
 * crossings ONCE, so the elements that share a crossing do not each carry (and
 * drift on) their own copy. Consumers today:
 *
 *   switchAcceptsLight          8 *-switch, 4 *-checkbox, material-chip
 *   sliderDiscovery             3 *-slider
 *   settableAxes                panel-knob (+ the sliders, via sliderDiscovery)
 *   readonlyNumericDiscovery    material-tank, material-progress
 *
 * The mechanism is `discovery.accepts` — see `elementAcceptsComponent` /
 * `discoveryCandidates` in `www/src/feezal-discovery-stamp.js`. A variant may
 * carry a `when(config)` guard (does this entity actually support this?) and a
 * `label` suffix (which row is which, U56-style).
 */

/**
 * A `light` offered to an on/off control: drive the lamp as plain on/off.
 *
 * **Map order is load-bearing.** The stamp applies keys in insertion order and
 * later writes win, and the DSL's `onlyWhen` can only test equality — there is
 * no "unless". So the generic `payload_on`/`payload_off` are applied FIRST and
 * the Homematic-style override LAST, where its `alsoSet` can overwrite them.
 * Reordering this map silently changes which payloads a dimmer gets.
 *
 * E157: parameterised on the *read* attribute, because not every on/off control
 * calls it `subscribe` — the legacy `paper-checkbox` reads from `topic`. Only
 * that one key varies; everything else (including the whole Homematic branch)
 * stays shared, so the two spellings cannot drift apart.
 */
export function makeSwitchAcceptsLight({subscribe = 'subscribe'} = {}) {
    return {
        component: 'light',
        map: {
            // ── generic on/off light (zigbee2mqtt, HA) ────────────────────────
            name: 'label',
            payload_on:  'payload-on',
            payload_off: 'payload-off',
            state_topic: subscribe,
            state_command_topic: 'publish',
            command_topic: 'publish',
            value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},

            // ── Homematic-style dimmer: on/off IS the LEVEL value (E77/E126) ──
            // The light card toggles on with the 1.005 OLD_LEVEL sentinel to restore
            // the previous brightness; a switch has no "previous brightness" to
            // restore and no way to represent 1.005, so it drives full-on/off with
            // 1 / 0. These come last so `alsoSet` overwrites the payload_on
            // (= '1.005') the generic rows above already wrote.
            brightness_state_topic: {attr: subscribe, onlyWhen: {on_off_source: 'brightness'}},
            message_property_brightness: {attr: 'message-property', onlyWhen: {on_off_source: 'brightness'}},
            brightness_command_topic: {
                attr: 'publish',
                onlyWhen: {on_off_source: 'brightness'},
                alsoSet: {'payload-on': '1', 'payload-off': '0'},
            },
        },
    };
}

/** The default spelling — every on/off control except `paper-checkbox`. */
export const switchAcceptsLight = makeSwitchAcceptsLight();

// A settable axis needs a COMMAND topic. This is the guardrail the item calls
// out: a slider must never be offered a read-only value, so every variant below
// gates on the write path existing. A `sensor` has no command topic at all and
// therefore never reaches a slider; a light with no brightness never shows up
// as a brightness row.
const settable = key => cfg => Boolean(cfg[key]);

// B81 — a JSON-SCHEMA light (zigbee2mqtt, HA `schema: json`) has no per-axis
// command topic at all: it has ONE `command_topic` that takes an object, and
// brightness/colour temp are KEYS inside it. `settable('brightness_command_topic')`
// is therefore false for every z2m lamp, which is why none of them ever showed
// up in a slider's picker. These probes recognise the other dialect.
const isJsonLight = cfg => cfg.schema === 'json' && Boolean(cfg.command_topic);
// z2m advertises `brightness: true`; HA-native lights advertise capability
// through supported_color_modes, where every mode EXCEPT `onoff` implies a
// settable brightness. An onoff-only lamp stays excluded — it is a switch
// match, not a slider one (the same guardrail as the separate-mode path).
const jsonBrightness = cfg => isJsonLight(cfg) && (Boolean(cfg.brightness) ||
    (cfg.supported_color_modes || []).some(m => m && m !== 'onoff'));
const jsonColorTemp = cfg => isJsonLight(cfg) && (Boolean(cfg.color_temp) ||
    (cfg.supported_color_modes || []).includes('color_temp'));

/**
 * The settable numeric AXES of a light — brightness and colour temp, in both
 * dialects: separate-mode (one topic per axis — Homematic) and JSON-schema
 * (one command topic taking `{brightness: N}` — zigbee2mqtt, HA `schema: json`).
 *
 * Split out from `sliderDiscovery` (E157) because a slider is not the only
 * continuous control: `panel-knob` is the same thing with a different gesture.
 * It reuses these axes but keeps its own richer `number` map, so the two share
 * the light wiring without the knob losing its `unit`/`step` mapping.
 */
export const lightSettableAxes = [
    {
        component: 'light',
        label: 'brightness',
        when: settable('brightness_command_topic'),
        map: {
            name: 'label',
            brightness_state_topic:   'subscribe',
            brightness_command_topic: 'publish',
            brightness_min:           {attr: 'min'},
            // HA/z2m call the top of the range brightness_scale (254 on
            // zigbee, 1 on Homematic LEVEL). Absent → the control's own
            // 0–100 default stands.
            brightness_scale:         {attr: 'max'},
            message_property_brightness: 'message-property',
        },
    },
    {
        component: 'light',
        label: 'color temp',
        when: settable('color_temp_command_topic'),
        map: {
            name: 'label',
            color_temp_state_topic:   'subscribe',
            color_temp_command_topic: 'publish',
            // Mireds are the wire unit here: the control publishes the raw
            // value, so the range is taken as-is rather than converted to
            // kelvin the way a light card's colour-temp control does.
            min_mireds: {attr: 'min'},
            max_mireds: {attr: 'max'},
        },
    },
    // ── B81: the same two axes on a JSON-schema light ───────────────────────
    // `publish-json-key` switches the control from publishing `128` to
    // publishing `{"brightness": 128}` on the single command topic. The read
    // side needs no new machinery — the state topic carries the whole object,
    // so `message-property` just points into it.
    //
    // **Map order is load-bearing here too.** `command_topic` carries the
    // range DEFAULTS in its `alsoSet` (the JSON schema's brightness range is
    // 0–255, and mireds 153–500 — the control's own 0–100 default would be
    // meaningless), and the discovered `brightness_scale` / mired keys come
    // AFTER so a device that states its range overrides the default.
    {
        component: 'light',
        label: 'brightness',
        when: jsonBrightness,
        map: {
            name: 'label',
            command_topic: {attr: 'publish', alsoSet: {
                'publish-json-key': 'brightness',
                'message-property': 'payload.brightness',
                min: '0', max: '255',
            }},
            state_topic: 'subscribe',
            brightness_scale: {attr: 'max'},   // z2m: 254 — must beat the 255 default
        },
    },
    {
        component: 'light',
        label: 'color temp',
        when: jsonColorTemp,
        map: {
            name: 'label',
            command_topic: {attr: 'publish', alsoSet: {
                'publish-json-key': 'color_temp',
                'message-property': 'payload.color_temp',
                min: '153', max: '500',
            }},
            state_topic: 'subscribe',
            min_mireds: {attr: 'min'},
            max_mireds: {attr: 'max'},
        },
    },
];

/**
 * E158 — a thermostat's settable target temperature.
 *
 * Homematic TRVs and HA `climate` entities use the same key names here, so one
 * variant covers both. `water_heater` is climate-shaped (E150) and reuses the
 * identically-named keys, so it rides along rather than being a parity gap.
 */
const setpointMap = {
    name: 'label',
    temperature_state_topic:   'subscribe',
    temperature_command_topic: 'publish',
    min_temp:  {attr: 'min'},
    max_temp:  {attr: 'max'},
    temp_step: {attr: 'step'},
    message_property_setpoint: 'message-property',
};

export const climateSetpointAxes = [
    {component: 'climate', label: 'setpoint', when: settable('temperature_command_topic'), map: setpointMap},
    {component: 'water_heater', label: 'setpoint', when: settable('temperature_command_topic'), map: setpointMap},
];

/**
 * E158 — a blind's settable position, in both dialects.
 *
 * Both publish a PLAIN NUMBER, so neither needs `publish-json-key`: Homematic's
 * `position_command_topic` takes a LEVEL, and HA's `set_position_topic` is a
 * dedicated topic whose default template is the bare position (z2m spells it
 * `…/set/position`).
 *
 * An open/close-only blind has neither key and yields no row — the inherited
 * settable-only guardrail, and the reason this is two variants rather than one
 * map with optional keys.
 */
export const coverPositionAxes = [
    {
        // Separate mode — Homematic reports LEVEL 0…1, so the range comes from
        // position_min/position_max rather than being assumed 0–100.
        component: 'cover',
        label: 'position',
        when: settable('position_command_topic'),
        map: {
            name: 'label',
            position_state_topic:   'subscribe',
            position_command_topic: 'publish',
            position_min: {attr: 'min'},
            position_max: {attr: 'max'},
            message_property_position: 'message-property',
        },
    },
    {
        // HA / zigbee2mqtt — a dedicated set-position topic. HA's defaults are
        // already 0–100, which is the control's own default, so no alsoSet.
        component: 'cover',
        label: 'position',
        when: settable('set_position_topic'),
        map: {
            name: 'label',
            position_topic:     'subscribe',
            set_position_topic: 'publish',
            position_closed: {attr: 'min'},
            position_open:   {attr: 'max'},
            position_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
        },
    },
];

/**
 * Every settable numeric axis a continuous control can drive, regardless of
 * which component exposes it. `sliderDiscovery` adds the `number` entity on
 * top; `panel-knob` takes this list and keeps its own `number` map.
 */
export const settableAxes = [
    ...lightSettableAxes,
    ...climateSetpointAxes,
    ...coverPositionAxes,
];

/**
 * Everything a *-slider can drive. There is no "slider" entity type, so the
 * descriptor has no base `component` — every match arrives through `accepts`,
 * and one light yields up to TWO rows (brightness, colour temp).
 */
export const sliderDiscovery = {
    accepts: [
        ...settableAxes,
        {
            component: 'number',
            when: settable('command_topic'),
            map: {
                name: 'label',
                state_topic:   'subscribe',
                command_topic: 'publish',
                min:  {attr: 'min'},
                max:  {attr: 'max'},
                step: {attr: 'step'},
                value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
            },
        },
    ],
};

// E157 — the mirror image of `settable`. A read-only display needs a STATE
// topic and must never be handed a command topic, so each variant below gates
// on the read path existing and no variant maps a `*_command_topic` at all.
const readable = key => cfg => Boolean(cfg[key]);

/**
 * Everything a read-only numeric display (`material-tank`, `material-progress`)
 * can show. The exact inverse of the slider's guardrail: these elements have a
 * `subscribe` and no `publish`, so they accept a plain `sensor` and the READ
 * side of a `number` or a light's brightness — and are never wired to a topic
 * that would let them command the device.
 *
 * No base `component` (same shape as `sliderDiscovery`): every match arrives
 * through `accepts`.
 */
export const readonlyNumericDiscovery = {
    accepts: [
        {
            component: 'sensor',
            when: readable('state_topic'),
            map: {
                name: 'label',
                state_topic:         'subscribe',
                unit_of_measurement: 'unit',
                value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
            },
        },
        {
            component: 'number',
            when: readable('state_topic'),
            map: {
                name: 'label',
                state_topic:         'subscribe',
                min:                 {attr: 'min'},
                max:                 {attr: 'max'},
                unit_of_measurement: 'unit',
                value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
            },
        },
        {
            component: 'light',
            label: 'brightness',
            when: readable('brightness_state_topic'),
            map: {
                name: 'label',
                brightness_state_topic: 'subscribe',
                brightness_scale:       {attr: 'max'},
                message_property_brightness: 'message-property',
            },
        },
    ],
};

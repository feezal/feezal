/**
 * E156 — cross-component discovery fragments.
 *
 * Discovery used to match an element only to entities whose component EQUALS
 * the element's own. That is too strict: a device of one component is often
 * controllable by an element of another. These fragments express the two
 * crossings the item asked for, ONCE, so the ~10 switch elements and the three
 * slider elements do not each carry (and drift on) their own copy.
 *
 * The mechanism is `discovery.accepts` — see `elementAcceptsComponent` /
 * `discoveryCandidates` in `www/src/feezal-discovery-stamp.js`. A variant may
 * carry a `when(config)` guard (does this entity actually support this?) and a
 * `label` suffix (which row is which, U56-style).
 */

/**
 * A `light` offered to a *-switch: drive the lamp as plain on/off.
 *
 * **Map order is load-bearing.** The stamp applies keys in insertion order and
 * later writes win, and the DSL's `onlyWhen` can only test equality — there is
 * no "unless". So the generic `payload_on`/`payload_off` are applied FIRST and
 * the Homematic-style override LAST, where its `alsoSet` can overwrite them.
 * Reordering this map silently changes which payloads a dimmer gets.
 */
export const switchAcceptsLight = {
    component: 'light',
    map: {
        // ── generic on/off light (zigbee2mqtt, HA) ────────────────────────
        name: 'label',
        payload_on:  'payload-on',
        payload_off: 'payload-off',
        state_topic: 'subscribe',
        state_command_topic: 'publish',
        command_topic: 'publish',
        value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},

        // ── Homematic-style dimmer: on/off IS the LEVEL value (E77/E126) ──
        // The light card toggles on with the 1.005 OLD_LEVEL sentinel to restore
        // the previous brightness; a switch has no "previous brightness" to
        // restore and no way to represent 1.005, so it drives full-on/off with
        // 1 / 0. These come last so `alsoSet` overwrites the payload_on
        // (= '1.005') the generic rows above already wrote.
        brightness_state_topic: {attr: 'subscribe', onlyWhen: {on_off_source: 'brightness'}},
        message_property_brightness: {attr: 'message-property', onlyWhen: {on_off_source: 'brightness'}},
        brightness_command_topic: {
            attr: 'publish',
            onlyWhen: {on_off_source: 'brightness'},
            alsoSet: {'payload-on': '1', 'payload-off': '0'},
        },
    },
};

// A settable axis needs a COMMAND topic. This is the guardrail the item calls
// out: a slider must never be offered a read-only value, so every variant below
// gates on the write path existing. A `sensor` has no command topic at all and
// therefore never reaches a slider; a light with no brightness never shows up
// as a brightness row.
const settable = key => cfg => Boolean(cfg[key]);

/**
 * Everything a *-slider can drive. There is no "slider" entity type, so the
 * descriptor has no base `component` — every match arrives through `accepts`,
 * and one light yields up to TWO rows (brightness, colour temp).
 */
export const sliderDiscovery = {
    accepts: [
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
                // zigbee, 1 on Homematic LEVEL). Absent → the slider's own
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
                // Mireds are the wire unit here: the slider publishes the raw
                // value, so the range is taken as-is rather than converted to
                // kelvin the way a light card's colour-temp control does.
                min_mireds: {attr: 'min'},
                max_mireds: {attr: 'max'},
            },
        },
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

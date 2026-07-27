/**
 * E160 — device_class → Material Symbols icon for NUMERIC sensor cards.
 *
 * The numeric sibling of feezal-sensor-types.js (E132/E138, which does the
 * same for BOOLEAN sensors). Discovered `sensor` entities carry a portable
 * `device_class` (z2m, ESPHome and Homematic all populate it) — the value /
 * gauge / icon-value cards map it to a fitting icon so a humidity reading is
 * not stamped with a thermometer.
 *
 * Applied declaratively from each card's discovery map via the stamp DSL's
 * `valueMap` + `_default`:
 *
 *     device_class: {attr: 'icon', valueMap: NUMERIC_SENSOR_ICONS}
 *
 * Every name here is a Material Symbols name verified against the installed
 * codepoint set — an unknown name renders blank, so DO NOT add one without
 * checking. `ic` from the payload is deliberately ignored: it carries Material
 * *Design Icons* names (`mdi:blur`), a different vocabulary feezal does not
 * render.
 *
 * `_default: 'sensors'` — a neutral glyph that is never actively wrong; an
 * entity with no `device_class` is left untouched (the DSL only stamps on a
 * value match, and there is no key for `undefined`).
 */
export const NUMERIC_SENSOR_ICONS = {
    temperature:                        'thermostat',
    humidity:                           'water_drop',
    moisture:                           'water_drop',
    pressure:                           'compress',
    atmospheric_pressure:               'compress',
    carbon_dioxide:                     'co2',
    carbon_monoxide:                    'co2',
    volatile_organic_compounds:         'air',
    volatile_organic_compounds_parts:   'air',
    aqi:                                'air',
    pm1:                                'blur_on',
    pm25:                               'blur_on',
    pm10:                               'blur_on',
    illuminance:                        'light_mode',
    power:                              'bolt',
    power_factor:                       'bolt',
    energy:                             'electric_bolt',
    voltage:                            'bolt',
    current:                            'bolt',
    frequency:                          'graphic_eq',
    battery:                            'battery_full',
    signal_strength:                    'signal_cellular_alt',
    gas:                                'gas_meter',
    water:                             'water_drop',
    sound_pressure:                     'volume_up',
    wind_speed:                         'wind_power',
    speed:                              'speed',
    distance:                           'straighten',
    duration:                           'timer',
    ph:                                 'science',
    precipitation:                      'grain',
    precipitation_intensity:            'grain',
    _default:                           'sensors',
};

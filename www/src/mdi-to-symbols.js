/**
 * E161 — Material *Design Icons* (`mdi:*`) → Material *Symbols* alias table.
 *
 * HA / ESPHome / zigbee2mqtt discovery configs carry an `icon` (`ic` abbreviated)
 * that is almost always an MDI name like `mdi:lightbulb`. feezal renders Material
 * *Symbols* — a DIFFERENT vocabulary — so an MDI name passed through verbatim
 * renders blank (E160 hit the same wall for `device_class`). This table maps the
 * common MDI names ESPHome/z2m emit to the nearest Symbol feezal ships.
 *
 * Keys are the MDI name WITHOUT the `mdi:` prefix (the `mdiIcon` transform in
 * feezal-discovery-stamp.js strips it). A miss is deliberately left UNMAPPED so
 * the stamp skips it and the E160 `device_class` icon (or the element default)
 * stands — never a blank glyph.
 *
 * Every VALUE here is a Material Symbols name verified against the installed set
 * (`www/src/material-design-icons.js`); the mdi-to-symbols unit test fails if any
 * value is not in that list. DO NOT add a value without checking it renders.
 */
export const MDI_TO_SYMBOLS = {
    // lighting
    'lightbulb':            'lightbulb',
    'lightbulb-outline':    'lightbulb',
    'lightbulb-on':         'lightbulb',
    'ceiling-light':        'lightbulb',
    'led-strip':            'lightbulb',
    'lamp':                 'lightbulb',

    // power / electrical
    'power':                'power_settings_new',
    'power-plug':           'power',
    'power-socket':         'power',
    'power-socket-eu':      'power',
    'flash':                'bolt',
    'flash-outline':        'bolt',
    'lightning-bolt':       'bolt',
    'lightning-bolt-outline': 'bolt',
    'current-ac':           'bolt',
    'current-dc':           'bolt',
    'sine-wave':            'graphic_eq',
    'transmission-tower':   'electric_bolt',
    'solar-power':          'solar_power',
    'solar-panel':          'solar_power',
    'battery':              'battery_full',
    'battery-charging':     'battery_charging_full',
    'ev-station':           'ev_station',

    // climate / environment
    'thermometer':          'thermostat',
    'thermometer-lines':    'thermostat',
    'thermostat':           'thermostat',
    'water':                'water_drop',
    'water-percent':        'water_drop',
    'water-outline':        'water_drop',
    'cup-water':            'water_drop',
    'gauge':                'speed',
    'speedometer':          'speed',
    'speedometer-slow':     'speed',
    'blur':                 'blur_on',
    'weather-windy':        'wind_power',
    'weather-sunny':        'sunny',
    'weather-night':        'bedtime',
    'weather-cloudy':       'wb_cloudy',
    'white-balance-sunny':  'sunny',
    'brightness-5':         'light_mode',
    'brightness-percent':   'light_mode',
    'air-filter':           'air',
    'molecule-co2':         'co2',
    'gas-cylinder':         'gas_meter',
    'meter-gas':            'gas_meter',
    'propane-tank':         'propane_tank',
    'fire':                 'local_fire_department',
    'smoke-detector':       'sensors',
    'molecule':             'science',
    'flask':                'science',

    // sensors / openings / motion
    'motion-sensor':        'sensors',
    'radar':                'sensors',
    'door':                 'sensor_door',
    'door-open':            'sensor_door',
    'door-closed':          'sensor_door',
    'garage':              'garage',
    'window-closed':        'sensor_window',
    'window-open':          'sensor_window',
    'window-closed-variant':'sensor_window',
    'lock':                 'lock',
    'lock-open':            'lock_open',
    'leak':                 'water_damage',

    // controls / misc
    'toggle-switch':        'toggle_on',
    'toggle-switch-outline':'toggle_on',
    'light-switch':         'toggle_on',
    'fan':                  'mode_fan_off',
    'home':                 'home',
    'home-outline':         'home',
    'clock':                'schedule',
    'clock-outline':        'schedule',
    'calendar':             'calendar_month',
    'timer':                'timer',
    'timer-outline':        'timer',
    'percent':              'percent',
    'car':                  'directions_car',
    'run':                  'directions_run',
    'walk':                 'directions_walk',
    'ruler':                'straighten',
    'volume-high':          'volume_up',
    'counter':              'tag',
};

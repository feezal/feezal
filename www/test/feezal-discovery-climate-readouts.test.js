/**
 * B85 — a thermostat's read-only numerics offered to value/gauge cards.
 *
 * `*-value` / `*-gauge` declare `component: 'sensor'`, but a Homematic/HmIP
 * thermostat is a `climate` entity whose actual temperature, humidity and
 * valve position are KEYS INSIDE it. A sensor-only picker could never see
 * them, which is what the report was.
 *
 * The mirror-image guardrail from E157 applies and is asserted structurally:
 * a read-out must never be wired to a command topic, or a value card could
 * drive the boiler.
 */
import {describe, it, expect, beforeAll} from 'vitest';
import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

import {
    acceptedComponents, discoveryCandidates, discoveryVariantsFor, stampDiscovery,
} from '../src/feezal-discovery-stamp.js';
import {readonlyClimateAxes} from '@feezal/feezal-element/feezal-discovery-fragments.js';

const packagesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', '@feezal');

class ValueFixture extends HTMLElement {
    static feezal = {
        attributes: [{name: 'label'}, {name: 'subscribe'}, {name: 'unit'},
            {name: 'message-property'}, {name: 'min'}, {name: 'max'}],
        discovery: {
            component: 'sensor',
            accepts: readonlyClimateAxes,
            map: {
                state_topic:         {attr: 'subscribe'},
                unit_of_measurement: {attr: 'unit'},
                value_template:      {attr: 'message-property', transform: 'valueTemplateToPath'},
                name:                'label',
            },
        },
    };
}

beforeAll(() => {
    if (!customElements.get('feezal-test-b85-value')) {
        customElements.define('feezal-test-b85-value', ValueFixture);
    }
});

const cls = () => customElements.get('feezal-test-b85-value');
const entity = (component, config, id = 'dev-1') => ({component, config, discovery_id: id, name: config.name});
const attrs = el => Object.fromEntries([...el.attributes].map(a => [a.name, a.value]));
const stampRow = row => {
    const el = document.createElement('feezal-test-b85-value');
    stampDiscovery(el, row.entity, row.variant);
    return el;
};

// A Homematic TRV as the recognizer emits it, humidity included (B85 §2).
const TRV = entity('climate', {
    name: 'Thermostat Bad',
    temperature_state_topic:   'hm/status/HEIZ:4/SET_TEMPERATURE',
    temperature_command_topic: 'hm/set/HEIZ:4/SET_TEMPERATURE',
    current_temperature_topic: 'hm/status/HEIZ:4/ACTUAL_TEMPERATURE',
    humidity_state_topic:      'hm/status/HEIZ:1/HUMIDITY',
    action_topic:              'hm/status/HEIZ:4/LEVEL',
    message_property_actual:   'payload.val',
    message_property_humidity: 'payload.val',
    message_property_valve:    'payload.val',
    temperature_unit: 'C',
    valve_min: 0, valve_max: 1,
    min_temp: 4.5, max_temp: 30.5,
});

describe('a thermostat offered to a value card (B85)', () => {
    it('accepts climate alongside sensor', () => {
        expect(acceptedComponents(cls()).sort())
            .toEqual(['climate', 'sensor', 'water_heater']);
    });

    it('yields one row per readable datapoint, labelled', () => {
        const rows = discoveryCandidates(cls(), [TRV]);
        expect(rows.map(r => r.label)).toEqual([
            expect.stringContaining('temperature'),
            expect.stringContaining('humidity'),
            expect.stringContaining('valve'),
        ]);
    });

    it('wires the actual temperature, not the setpoint', () => {
        const [temp] = discoveryCandidates(cls(), [TRV]);
        expect(attrs(stampRow(temp))).toMatchObject({
            subscribe: 'hm/status/HEIZ:4/ACTUAL_TEMPERATURE',
            'message-property': 'payload.val',
            unit: '°C',
        });
        // the setpoint is settable — a read-out must not land on it
        expect(stampRow(temp).getAttribute('subscribe')).not.toContain('SET_TEMPERATURE');
    });

    it('wires humidity with a percent unit', () => {
        const hum = discoveryCandidates(cls(), [TRV])[1];
        expect(attrs(stampRow(hum))).toMatchObject({
            subscribe: 'hm/status/HEIZ:1/HUMIDITY',
            'message-property': 'payload.val',
            unit: '%',
        });
    });

    it('wires the valve with the device range (HmIP LEVEL is 0…1)', () => {
        const valve = discoveryCandidates(cls(), [TRV])[2];
        expect(attrs(stampRow(valve))).toMatchObject({
            subscribe: 'hm/status/HEIZ:4/LEVEL',
            min: '0', max: '1', unit: '%',
        });
    });

    it('offers only what the device actually reports', () => {
        // a wall thermostat with no valve, and an eTRV with no humidity
        const noValve = entity('climate', {
            name: 'Wandthermostat',
            current_temperature_topic: 'hm/status/WTH:1/ACTUAL_TEMPERATURE',
            humidity_state_topic: 'hm/status/WTH:1/HUMIDITY',
            temperature_command_topic: 'hm/set/WTH:1/SET_POINT_TEMPERATURE',
        });
        expect(discoveryCandidates(cls(), [noValve]).map(r => r.label)).toEqual([
            expect.stringContaining('temperature'),
            expect.stringContaining('humidity'),
        ]);

        const noHum = entity('climate', {
            name: 'eTRV',
            current_temperature_topic: 'hm/status/TRV:4/ACTUAL_TEMPERATURE',
            action_topic: 'hm/status/TRV:4/LEVEL',
        });
        expect(discoveryCandidates(cls(), [noHum]).map(r => r.label)).toEqual([
            expect.stringContaining('temperature'),
            expect.stringContaining('valve'),
        ]);
    });

    it('offers nothing for a climate entity that reports no readable numeric', () => {
        const setpointOnly = entity('climate', {
            name: 'Nur Sollwert',
            temperature_state_topic: 'x/set', temperature_command_topic: 'x/cmd',
        });
        expect(discoveryCandidates(cls(), [setpointOnly])).toEqual([]);
        expect(discoveryVariantsFor(cls(), setpointOnly)).toEqual([]);
    });

    it('a plain sensor still uses the element\'s own map', () => {
        const el = document.createElement('feezal-test-b85-value');
        stampDiscovery(el, entity('sensor', {
            name: 'Temperatur', state_topic: 'stat/t', unit_of_measurement: '°C',
        }), null);
        expect(attrs(el)).toMatchObject({subscribe: 'stat/t', unit: '°C'});
    });
});

describe('the read-out guardrail (B85)', () => {
    it('no climate axis maps a command topic', () => {
        for (const variant of readonlyClimateAxes) {
            const keys = Object.keys(variant.map);
            expect(keys.some(k => k.includes('command_topic')), variant.label).toBe(false);
        }
    });

    it('every axis is gated on its read topic', () => {
        for (const variant of readonlyClimateAxes) {
            expect(typeof variant.when, variant.label).toBe('function');
        }
    });
});

describe('every value/gauge card with a picker offers the climate axes', () => {
    // The fixture above proves the fragment; this proves the elements use it.
    const cases = [
        'feezal-element-circle-value', 'feezal-element-glass-value',
        'feezal-element-metro-value', 'feezal-element-eink-value',
        'feezal-element-panel-value', 'feezal-element-tui-value',
        'feezal-element-circle-gauge', 'feezal-element-glass-gauge',
        'feezal-element-metro-gauge', 'feezal-element-panel-gauge',
    ];

    it.each(cases)('%s', pkg => {
        const src = readFileSync(join(packagesDir, pkg, `${pkg}.js`), 'utf8');
        // E160: the import may carry additional named exports (NUMERIC_SENSOR_ICONS)
        // — assert the symbol is imported from the fragments module, not an exact line.
        expect(src).toMatch(/import \{[^}]*\breadonlyClimateAxes\b[^}]*\} from '@feezal\/feezal-element\/feezal-discovery-fragments\.js'/);
        expect(src).toContain('accepts: readonlyClimateAxes');
    });
});

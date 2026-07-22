/**
 * E132 — the generalized boolean-sensor family (palette "Sensor"; tags still
 * material-motion / glass-occupancy / metro-occupancy pending the alias
 * mechanism): shared type table + per-type defaults, alarm classes in error
 * colour, the shared hazard-aware device_class map, and the E124 low-battery
 * warning (badge, never a blackout).
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '@feezal/feezal-element-material-motion';
import '@feezal/feezal-element-glass-occupancy';
import '@feezal/feezal-element-metro-occupancy';
import '@feezal/feezal-element-glass-sensor';
import '@feezal/feezal-element-metro-sensor';
import {SENSOR_TYPES, SENSOR_DEVICE_CLASS_MAP, batteryLowFromValue} from '@feezal/feezal-element/feezal-sensor-types.js';
import {setupFeezal, mount} from './helpers.js';

let feezal;
beforeEach(() => { feezal = setupFeezal(); });

const CARDS = ['feezal-element-material-motion', 'feezal-element-glass-occupancy', 'feezal-element-metro-occupancy'];

describe('E132 — shared vocabulary', () => {
    it('all three cards offer the full type list and the shared device_class map', () => {
        for (const tag of CARDS) {
            const f = customElements.get(tag).feezal;
            const typeSpec = f.attributes.find(a => a?.name === 'type');
            expect(typeSpec.options, tag).toEqual(Object.keys(SENSOR_TYPES));
            expect(f.discovery.map.device_class.valueMap, tag).toBe(SENSOR_DEVICE_CLASS_MAP);
            // E124: the battery trio is part of the contract.
            for (const n of ['subscribe-battery-low', 'message-property-battery-low', 'payload-battery-low', 'battery-low-threshold']) {
                expect(f.attributes.some(a => a?.name === n), `${tag} ${n}`).toBe(true);
            }
        }
        expect(SENSOR_DEVICE_CLASS_MAP.moisture).toBe('water-leak');
        expect(SENSOR_DEVICE_CLASS_MAP._default).toBe('generic');
    });

    it('palette names: boolean cards say Sensor, the numeric cards say Number', () => {
        for (const tag of CARDS) {
            expect(customElements.get(tag).feezal.palette.name, tag).toBe('Sensor');
        }
        expect(customElements.get('feezal-element-glass-sensor').feezal.palette.name).toBe('Number');
        expect(customElements.get('feezal-element-metro-sensor').feezal.palette.name).toBe('Number');
    });

    it('batteryLowFromValue: booleans, payload compare, percentage threshold', () => {
        expect(batteryLowFromValue(true)).toBe(true);
        expect(batteryLowFromValue('true')).toBe(true);
        expect(batteryLowFromValue(false)).toBe(false);
        expect(batteryLowFromValue('LOW', 'LOW')).toBe(true);
        expect(batteryLowFromValue(10, 'true', 15)).toBe(true);    // 10 % ≤ 15
        expect(batteryLowFromValue('80', 'true', 15)).toBe(false); // 80 % is fine
    });
});

describe('E132 — glass sensor card', () => {
    it('water-leak type: per-type texts/icons, alarm flag, error-coloured active state', async () => {
        const el = await mount('feezal-element-glass-occupancy', {
            subscribe: 'stat/leak', type: 'water-leak',
        });
        expect(el.hasAttribute('data-alarm')).toBe(true);
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('Dry');
        expect(el.shadowRoot.querySelector('feezal-icon').getAttribute('name')).toBe('water_drop');

        feezal.connection.deliver('stat/leak', 'ON');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('Leak!');
        expect(el.shadowRoot.querySelector('feezal-icon').getAttribute('name')).toBe('water_damage');
        expect(el.shadowRoot.querySelector('.card').classList.contains('active')).toBe(true);
    });

    it('motion type stays non-alarm; explicit texts still win', async () => {
        const el = await mount('feezal-element-glass-occupancy', {
            subscribe: 'stat/m', type: 'motion', 'text-clear': 'Ruhe',
        });
        expect(el.hasAttribute('data-alarm')).toBe(false);
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('Ruhe');
    });

    it('E124: battery badge appears on a low value and never blocks the state', async () => {
        const el = await mount('feezal-element-glass-occupancy', {
            subscribe: 'stat/m', 'subscribe-battery-low': 'stat/batt',
        });
        expect(el.shadowRoot.querySelector('.batt')).toBeNull();
        feezal.connection.deliver('stat/batt', '12');   // 12 % ≤ default threshold 15
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.batt')).not.toBeNull();
        feezal.connection.deliver('stat/m', 'ON');      // state keeps updating
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.card').classList.contains('active')).toBe(true);
        feezal.connection.deliver('stat/batt', '80');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.batt')).toBeNull();
    });
});

describe('E132 — metro sensor tile', () => {
    it('smoke type: alarm attribute + per-type defaults; battery badge top-left', async () => {
        const el = await mount('feezal-element-metro-occupancy', {
            subscribe: 'stat/smoke', type: 'smoke', 'subscribe-battery-low': 'stat/batt',
        });
        await el.updateComplete;
        expect(el.hasAttribute('data-alarm')).toBe(true);
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('Clear');

        feezal.connection.deliver('stat/smoke', 'ON');
        feezal.connection.deliver('stat/batt', true);
        await el.updateComplete;
        expect(el.hasAttribute('data-active')).toBe(true);
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('Smoke!');
        expect(el.shadowRoot.querySelector('.batt')).not.toBeNull();
    });
});

describe('E132 — material sensor card', () => {
    it('legacy motion types keep the SVG visual', async () => {
        const el = await mount('feezal-element-material-motion', {subscribe: 'stat/m', type: 'motion'});
        expect(el.shadowRoot.querySelector('svg.motion')).not.toBeNull();
        expect(el.shadowRoot.querySelector('.hazard')).toBeNull();
    });

    it('hazard types render the icon + state text (E134 disc precursor), alarm colours on trigger', async () => {
        const el = await mount('feezal-element-material-motion', {subscribe: 'stat/leak', type: 'water-leak'});
        expect(el.shadowRoot.querySelector('svg.motion')).toBeNull();
        const hazard = el.shadowRoot.querySelector('.hazard');
        expect(hazard).not.toBeNull();
        expect(hazard.querySelector('.htext').textContent).toBe('Dry');

        feezal.connection.deliver('stat/leak', 'ON');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.hazard').classList.contains('active')).toBe(true);
        expect(el.shadowRoot.querySelector('.hazard').classList.contains('alarm')).toBe(true);
        expect(el.shadowRoot.querySelector('.htext').textContent).toBe('Leak!');
    });

    it('E124: battery badge on the material card', async () => {
        const el = await mount('feezal-element-material-motion', {
            subscribe: 'stat/m', 'subscribe-battery-low': 'stat/batt',
        });
        feezal.connection.deliver('stat/batt', 'true');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.batt')).not.toBeNull();
    });
});

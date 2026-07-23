/**
 * E132/E138 — the boolean-sensor family after the taxonomy split:
 * `*-motion` (motion/occupancy/presence/radar/zone — MOTION slice) and
 * `*-sensor` (alarm-character: leak/smoke/gas/CO/… — ALARM slice), plus the
 * numeric `*-value` cards. Shared per-type defaults, alarm classes in error
 * colour, slice-restricted device_class maps, and the E124 low-battery
 * warning (badge, never a blackout).
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '@feezal/feezal-element-circle-motion';
import '@feezal/feezal-element-circle-sensor';
import '@feezal/feezal-element-glass-motion';
import '@feezal/feezal-element-glass-sensor';
import '@feezal/feezal-element-metro-motion';
import '@feezal/feezal-element-metro-sensor';
import '@feezal/feezal-element-glass-value';
import '@feezal/feezal-element-metro-value';
import {MOTION_SENSOR_TYPES, ALARM_SENSOR_TYPES, sensorDeviceClassMapFor}
    from '@feezal/feezal-controller-sensor';
import {SENSOR_DEVICE_CLASS_MAP, batteryLowFromValue} from '@feezal/feezal-element/feezal-sensor-types.js';
import {setupFeezal, mount} from './helpers.js';

let feezal;
beforeEach(() => { feezal = setupFeezal(); });

const MOTION_CARDS = ['feezal-element-circle-motion', 'feezal-element-glass-motion', 'feezal-element-metro-motion'];
const ALARM_CARDS  = ['feezal-element-circle-sensor', 'feezal-element-glass-sensor', 'feezal-element-metro-sensor'];

describe('E138 — sliced vocabulary per card', () => {
    it('motion cards offer the motion slice; alarm cards the alarm slice; battery everywhere', () => {
        for (const [cards, types, slice] of [[MOTION_CARDS, MOTION_SENSOR_TYPES, 'motion'], [ALARM_CARDS, ALARM_SENSOR_TYPES, 'alarm']]) {
            for (const tag of cards) {
                const f = customElements.get(tag).feezal;
                const typeSpec = f.attributes.find(a => a?.name === 'type');
                expect(typeSpec.options, tag).toEqual(types);
                expect(f.discovery.map.device_class.valueMap, tag).toEqual(sensorDeviceClassMapFor(slice));
                // E124: the battery quartet is part of the contract.
                for (const n of ['subscribe-battery-low', 'message-property-battery-low', 'payload-battery-low', 'battery-low-threshold']) {
                    expect(f.attributes.some(a => a?.name === n), `${tag} ${n}`).toBe(true);
                }
            }
        }
        expect(SENSOR_DEVICE_CLASS_MAP.moisture).toBe('water-leak');
        expect(SENSOR_DEVICE_CLASS_MAP._default).toBe('generic');
    });

    it('palette names: Motion / Sensor / Value per the E138 taxonomy', () => {
        for (const tag of MOTION_CARDS) {
            expect(customElements.get(tag).feezal.palette.name, tag).toBe('Motion');
        }
        for (const tag of ALARM_CARDS) {
            expect(customElements.get(tag).feezal.palette.name, tag).toBe('Sensor');
        }
        expect(customElements.get('feezal-element-glass-value').feezal.palette.name).toBe('Value');
        expect(customElements.get('feezal-element-metro-value').feezal.palette.name).toBe('Value');
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

describe('E138 — glass cards', () => {
    it('glass-sensor (alarm) water-leak type: per-type texts/icons, alarm flag, error-coloured active state', async () => {
        const el = await mount('feezal-element-glass-sensor', {
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

    it('glass-motion: motion type is non-alarm; explicit texts still win', async () => {
        const el = await mount('feezal-element-glass-motion', {
            subscribe: 'stat/m', type: 'motion', 'text-clear': 'Ruhe',
        });
        expect(el.hasAttribute('data-alarm')).toBe(false);
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('Ruhe');
    });

    it('E124: battery badge appears on a low value and never blocks the state (glass-motion)', async () => {
        const el = await mount('feezal-element-glass-motion', {
            subscribe: 'stat/m', 'subscribe-battery-low': 'stat/batt',
        });
        expect(el.shadowRoot.querySelector('.feezal-batt-badge')).toBeNull();
        feezal.connection.deliver('stat/batt', '12');   // 12 % ≤ default threshold 15
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.feezal-batt-badge')).not.toBeNull();
        feezal.connection.deliver('stat/m', 'ON');      // state keeps updating
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.card').classList.contains('active')).toBe(true);
        feezal.connection.deliver('stat/batt', '80');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.feezal-batt-badge')).toBeNull();
    });
});

describe('E138 — metro-sensor (alarm) tile', () => {
    it('smoke type: alarm attribute + per-type defaults; battery badge top-left', async () => {
        const el = await mount('feezal-element-metro-sensor', {
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
        expect(el.shadowRoot.querySelector('.feezal-batt-badge')).not.toBeNull();
    });
});

describe('E138 — material cards', () => {
    it('E139: material-motion keeps its SVG art inside a state disc, tinting on motion', async () => {
        const el = await mount('feezal-element-circle-motion', {subscribe: 'stat/m', type: 'motion'});
        // The detailed per-type art is preserved...
        expect(el.shadowRoot.querySelector('svg.motion')).not.toBeNull();
        // ...but now sits inside the Circle disc with a state word.
        const disc = el.shadowRoot.querySelector('.disc');
        expect(disc).not.toBeNull();
        expect(disc.querySelector('svg.motion')).not.toBeNull();
        expect(disc.querySelector('.htext').textContent).toBe('Clear');
        expect(disc.classList.contains('active')).toBe(false);

        feezal.connection.deliver('stat/m', 'ON');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.disc').classList.contains('active')).toBe(true);
        expect(el.shadowRoot.querySelector('.htext').textContent).toBe('Motion');
    });

    it('material-sensor renders the E134 circle state disc, alarm colours on trigger', async () => {
        const el = await mount('feezal-element-circle-sensor', {subscribe: 'stat/leak', type: 'water-leak'});
        expect(el.shadowRoot.querySelector('svg.motion')).toBeNull();
        const hazard = el.shadowRoot.querySelector('.disc');
        expect(hazard).not.toBeNull();
        expect(hazard.querySelector('.htext').textContent).toBe('Dry');

        feezal.connection.deliver('stat/leak', 'ON');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.disc').classList.contains('active')).toBe(true);
        expect(el.shadowRoot.querySelector('.disc').classList.contains('alarm')).toBe(true);
        expect(el.shadowRoot.querySelector('.htext').textContent).toBe('Leak!');
    });

    it('E124: battery badge on material-motion', async () => {
        const el = await mount('feezal-element-circle-motion', {
            subscribe: 'stat/m', 'subscribe-battery-low': 'stat/batt',
        });
        feezal.connection.deliver('stat/batt', 'true');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.feezal-batt-badge')).not.toBeNull();
    });
});

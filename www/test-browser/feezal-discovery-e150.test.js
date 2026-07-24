/**
 * E150 — water_heater rides the climate card. A HA water_heater entity must
 * stamp onto circle-climate through the shared climateDiscoveryMap, and the
 * aliasComponents link must make the ⚡ picker / banner accept it.
 */
import {describe, it, expect, beforeEach} from 'vitest';

import '../packages/@feezal/feezal-element-circle-climate/feezal-element-circle-climate.js';
import {stampDiscovery, resolveElementTag, elementAcceptsComponent} from '../src/feezal-discovery-stamp.js';
import {setupFeezal} from './helpers.js';

beforeEach(() => setupFeezal());

describe('E150 — water_heater stamps onto the climate card', () => {
    it('wires the climate-shaped topics + string-array modes', () => {
        const el = document.createElement('feezal-element-circle-climate');
        stampDiscovery(el, {component: 'water_heater', config: {
            name: 'Boiler',
            temperature_command_topic: 'wh/set_temp',
            temperature_state_topic: 'wh/target',
            current_temperature_topic: 'wh/temp',
            mode_command_topic: 'wh/set_mode',
            mode_state_topic: 'wh/mode',
            modes: ['off', 'eco', 'performance', 'high_demand'],
            min_temp: 40, max_temp: 65,
        }});
        expect(el.getAttribute('publish-setpoint')).toBe('wh/set_temp');
        expect(el.getAttribute('subscribe-setpoint')).toBe('wh/target');
        expect(el.getAttribute('subscribe-actual')).toBe('wh/temp');
        expect(el.getAttribute('publish-mode')).toBe('wh/set_mode');
        expect(el.getAttribute('subscribe-mode')).toBe('wh/mode');
        expect(el.getAttribute('min')).toBe('40');
        expect(el.getAttribute('max')).toBe('65');
        expect(el.getAttribute('label')).toBe('Boiler');
        expect(JSON.parse(el.getAttribute('modes'))).toEqual(['off', 'eco', 'performance', 'high_demand']);
    });
});

describe('E150 — aliasComponents matching', () => {
    const climateCls = () => window.customElements.get('feezal-element-circle-climate');
    it('a climate card accepts both climate and water_heater entities', () => {
        expect(elementAcceptsComponent(climateCls(), 'climate')).toBe(true);
        expect(elementAcceptsComponent(climateCls(), 'water_heater')).toBe(true);
    });
    it('but not an unrelated component', () => {
        expect(elementAcceptsComponent(climateCls(), 'cover')).toBe(false);
        expect(elementAcceptsComponent(climateCls(), '')).toBe(false);
    });
    it('the Generate wizard resolves water_heater to the climate element', () => {
        const isReg = t => t === 'feezal-element-circle-climate';
        expect(resolveElementTag('water_heater', 'circle', undefined, isReg)).toBe('feezal-element-circle-climate');
    });
});

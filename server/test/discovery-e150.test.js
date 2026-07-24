/**
 * E150 — profile-shaped discovery components. `water_heater` is climate-shaped
 * (identical HA topic key names), so the server registers it and the climate
 * element's discovery map + aliasComponents link consume it unchanged.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const disc = require('../src/mqtt/discovery.js');

const buf = obj => Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj));

beforeEach(() => disc.clearEntities());

describe('E150 — water_heater component', () => {
    it('registers a water_heater with the climate-shaped topic keys expanded', () => {
        disc.handleMessage('homeassistant/water_heater/boiler/config', buf({
            name: 'Boiler',
            temp_cmd_t: 'wh/boiler/set_temp',
            temp_stat_t: 'wh/boiler/target',
            curr_temp_t: 'wh/boiler/temp',
            mode_cmd_t: 'wh/boiler/set_mode',
            mode_stat_t: 'wh/boiler/mode',
            modes: ['off', 'eco', 'performance', 'high_demand'],
            min_temp: 40, max_temp: 65,
        }));
        const e = disc.getDiscoveredEntity('water_heater/boiler');
        expect(e).toBeTruthy();
        expect(e.component).toBe('water_heater');
        // same key names as climate → the shared climateDiscoveryMap consumes them
        expect(e.config.temperature_command_topic).toBe('wh/boiler/set_temp');
        expect(e.config.temperature_state_topic).toBe('wh/boiler/target');
        expect(e.config.current_temperature_topic).toBe('wh/boiler/temp');
        expect(e.config.mode_command_topic).toBe('wh/boiler/set_mode');
        expect(e.config.mode_state_topic).toBe('wh/boiler/mode');
        expect(e.config.modes).toEqual(['off', 'eco', 'performance', 'high_demand']);
        expect(e.config.min_temp).toBe(40);
        expect(e.config.max_temp).toBe(65);
    });

    it('lawn_mower is still unsupported (deferred — needs per-action command topics)', () => {
        disc.handleMessage('homeassistant/lawn_mower/mower/config',
            buf({name: 'Mower', activity_state_topic: 'lm/mower/activity'}));
        expect(disc.getDiscoveredEntity('lawn_mower/mower')).toBe(null);
    });
});

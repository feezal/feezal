/**
 * E102 (partial) — material-climate valve-min/valve-max scaling. HmIP reports
 * the valve as LEVEL 0…1, BidCoS as VALVE_STATE 0–100; both must show 0–100 %.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-material-climate/feezal-element-material-climate.js';
import {setupFeezal, mount} from './helpers.js';

let feezal;
beforeEach(() => { feezal = setupFeezal(); });

describe('material-climate valve scaling (E102)', () => {
    it('defaults 0–100 pass through unchanged (BidCoS VALVE_STATE)', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t', 'subscribe-valve': 'stat/valve',
        });
        feezal.connection.deliver('stat/valve', '73');
        await el.updateComplete;
        expect(el._valve).toBe(73);
    });

    it('scales HmIP LEVEL 0…1 to 0–100 % when valve-max=1', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t',
            'subscribe-valve': 'stat/level', 'valve-max': '1',
        });
        feezal.connection.deliver('stat/level', '0.5');
        await el.updateComplete;
        expect(el._valve).toBe(50);
        feezal.connection.deliver('stat/level', '1');
        await el.updateComplete;
        expect(el._valve).toBe(100);
    });

    it('clamps out-of-range values and survives a zero span', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t',
            'subscribe-valve': 'stat/v', 'valve-min': '0', 'valve-max': '1',
        });
        feezal.connection.deliver('stat/v', '2');       // > max
        await el.updateComplete;
        expect(el._valve).toBe(100);

        el.valveMax = 0;                                // degenerate span → passthrough+clamp
        feezal.connection.deliver('stat/v', '42');
        await el.updateComplete;
        expect(el._valve).toBe(42);
    });

    it('scales the valve read from a JSON payload too', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'json', subscribe: 'stat/t', 'valve-max': '1',
            'json-map': JSON.stringify({valve: 'level'}),
        });
        feezal.connection.deliver('stat/t', {level: 0.25});
        await el.updateComplete;
        expect(el._valve).toBe(25);
    });
});

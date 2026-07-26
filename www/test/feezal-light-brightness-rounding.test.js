/**
 * B79 — brightness percentages must not carry IEEE-754 noise.
 *
 * Scaling a device range is a division: a Homematic dimmer (`LEVEL` 0…1, so
 * `brightness-max: 1`) reporting 0.55 gives `0.55 / 1 * 100` =
 * 55.00000000000001. A view that interpolates `brt` straight into its markup
 * then renders "55.00000000000001 %" — which is what was reported for the
 * glass-light popup pill.
 *
 * The fix rounds the *noise* away (6 decimals) rather than quantising to whole
 * percent, because `brt` also feeds `pctToRaw()` on the toggle-on restore path;
 * so a genuinely fractional percentage from a sub-integer device range
 * (B17/B26) has to survive. Both properties are pinned here.
 */
import {describe, it, expect, beforeEach} from 'vitest';

import {LightController} from '@feezal/feezal-controller-light';

/** Minimal host: the controller only needs attributes + requestUpdate. */
function makeHost(attrs = {}) {
    const el = document.createElement('div');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.requestUpdate = () => {};
    el.addController = () => {};
    el.addSubscription = () => {};
    el.getProperty = (msg, path) => (path === 'payload' ? msg.payload : undefined);
    return el;
}

const controllerFor = attrs => new LightController(makeHost(attrs));

beforeEach(() => { window.feezal = {isEditor: false, connection: {pub() {}}}; });

describe('rawToPct — Homematic LEVEL 0…1', () => {
    const hm = () => controllerFor({'brightness-min': '0', 'brightness-max': '1'});

    it('scales the values that used to produce float noise to whole percent', () => {
        const c = hm();
        // Each of these is inexact in IEEE-754 before rounding:
        //   0.55 -> 55.00000000000001, 0.07 -> 7.000000000000001,
        //   0.29 -> 28.999999999999996
        expect(c.rawToPct(0.55)).toBe(55);
        expect(c.rawToPct(0.07)).toBe(7);
        expect(c.rawToPct(0.29)).toBe(29);
    });

    it('leaves no percentage with a long fractional tail', () => {
        const c = hm();
        for (let i = 0; i <= 100; i++) {
            const pct = c.rawToPct(i / 100);
            expect(String(pct).replace(/^\d+\.?/, '').length,
                `LEVEL ${i / 100} rendered as ${pct}`).toBeLessThanOrEqual(6);
        }
    });

    it('still clamps outside the device range', () => {
        const c = hm();
        expect(c.rawToPct(-1)).toBe(0);
        expect(c.rawToPct(5)).toBe(100);
    });
});

describe('rawToPct — genuinely fractional percentages survive', () => {
    it('keeps sub-integer precision instead of quantising to whole percent', () => {
        // A 0…0.5 device range: 0.2751 really is 55.02 %, not 55 %.
        const c = controllerFor({'brightness-min': '0', 'brightness-max': '0.5'});
        expect(c.rawToPct(0.2751)).toBeCloseTo(55.02, 6);
        expect(c.rawToPct(0.2751)).not.toBe(55);
    });

    it('a 0…255 range maps its steps without noise', () => {
        const c = controllerFor({'brightness-min': '0', 'brightness-max': '255'});
        expect(c.rawToPct(255)).toBe(100);
        expect(c.rawToPct(0)).toBe(0);
        // 128/255 is irrational in binary — the value is kept, the tail is not.
        expect(String(c.rawToPct(128))).not.toMatch(/\d{10}/);
    });

    it('a degenerate range is 0, not NaN', () => {
        const c = controllerFor({'brightness-min': '5', 'brightness-max': '5'});
        expect(c.rawToPct(5)).toBe(0);
    });
});

describe('the round trip back to the device is unharmed', () => {
    it('percent → raw → percent returns the same percent', () => {
        const c = controllerFor({'brightness-min': '0', 'brightness-max': '1'});
        for (const pct of [0, 7, 29, 55, 83, 100]) {
            expect(c.rawToPct(pct / 100)).toBe(pct);
        }
    });
});

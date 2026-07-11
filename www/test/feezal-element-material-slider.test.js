import {describe, it, expect} from 'vitest';

import {deriveStep} from '../packages/@feezal/feezal-element-material-slider/feezal-element-material-slider.js';

// B17: an unset step must be derived from the range — (max − min) / 100 — so
// sub-integer ranges (Homematic LEVEL 0–1) don't collapse to two positions.
// (Pure-function test — md-slider itself can't instantiate under happy-dom,
// same pattern as material-light's pctToRaw test.)
describe('deriveStep (B17)', () => {
    it('defaults to 1 for the default 0–100 range', () => {
        expect(deriveStep(undefined, 0, 100)).toBe(1);
    });

    it('derives a sub-integer step for a Homematic 0–1 range', () => {
        expect(deriveStep(undefined, 0, 1)).toBe(0.01);
    });

    it('derives from a non-zero minimum', () => {
        expect(deriveStep(undefined, 0.2, 1)).toBeCloseTo(0.008, 10);
    });

    it('produces clean decimals without float noise', () => {
        expect(String(deriveStep(undefined, 0, 1))).toBe('0.01');
        expect(String(deriveStep(undefined, 0, 3))).toBe('0.03');
    });

    it('an explicit step wins over the derived default', () => {
        expect(deriveStep(0.5, 0, 1)).toBe(0.5);
        expect(deriveStep('0.5', 0, 1)).toBe(0.5);
        expect(deriveStep(2, 0, 100)).toBe(2);
    });

    it('treats empty/zero/invalid step as unset', () => {
        expect(deriveStep('', 0, 1)).toBe(0.01);
        expect(deriveStep(0, 0, 1)).toBe(0.01);
        expect(deriveStep(Number.NaN, 0, 1)).toBe(0.01);
    });

    it('falls back to 1 for a degenerate range (min >= max)', () => {
        expect(deriveStep(undefined, 5, 5)).toBe(1);
        expect(deriveStep(undefined, 10, 0)).toBe(1);
    });
});

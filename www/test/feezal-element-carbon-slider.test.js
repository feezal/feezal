import {describe, it, expect} from 'vitest';

import {deriveStep} from '../packages/@feezal/feezal-element-carbon-slider/derive-step.js';

// B17 (same rule as material-slider): an unset step must be derived from the
// range — (max − min) / 100. Pure-function test against the util module —
// importing the element would pull in @carbon/web-components, whose
// extensionless lodash-es imports only resolve under Vite.
describe('carbon deriveStep (B17)', () => {
    it('defaults to 1 for the default 0–100 range', () => {
        expect(deriveStep(undefined, 0, 100)).toBe(1);
    });

    it('derives a sub-integer step for a Homematic 0–1 range', () => {
        expect(deriveStep(undefined, 0, 1)).toBe(0.01);
    });

    it('an explicit step wins over the derived default', () => {
        expect(deriveStep(0.5, 0, 1)).toBe(0.5);
        expect(deriveStep('0.5', 0, 1)).toBe(0.5);
    });

    it('falls back to 1 for degenerate ranges', () => {
        expect(deriveStep(undefined, 100, 100)).toBe(1);
        expect(deriveStep(undefined, 100, 0)).toBe(1);
    });
});

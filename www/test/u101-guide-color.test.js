/**
 * U101 — the snap-guide colour setting, and alpha in the editor's colour
 * pickers.
 *
 * The arithmetic worth pinning is the split: the selection colour reaches its
 * consumers as an `r,g,b` triplet because each composes its OWN alpha on top
 * (rubber band 0.12, its border 0.8, the selection outline 0.9). Once the
 * setting itself can carry alpha the two must multiply, so the alpha travels
 * separately — and a half-typed value must never blank the selection ring.
 */
import {describe, it, expect} from 'vitest';
import {hexToRgbAlpha} from '../src/feezal-color-util.js';

describe('hexToRgbAlpha — the triplet/alpha split the selection ring needs', () => {
    it('splits a 6-digit hex into a triplet at full alpha', () => {
        expect(hexToRgbAlpha('#0284c7')).toEqual({rgb: '2,132,199', alpha: 1});
    });

    it('reads the alpha byte of an 8-digit hex', () => {
        expect(hexToRgbAlpha('#0284c780')).toEqual({rgb: '2,132,199', alpha: 128 / 255});
        expect(hexToRgbAlpha('#00000000').alpha).toBe(0);
        expect(hexToRgbAlpha('#ffffffff').alpha).toBe(1);
    });

    it('expands 3- and 4-digit shorthand', () => {
        expect(hexToRgbAlpha('#f00')).toEqual({rgb: '255,0,0', alpha: 1});
        expect(hexToRgbAlpha('#f008').alpha).toBe(136 / 255);
    });

    it('is case-insensitive and tolerates surrounding space', () => {
        expect(hexToRgbAlpha('  #0284C7  ')).toEqual({rgb: '2,132,199', alpha: 1});
    });

    it('falls back rather than blanking on a value mid-typing', () => {
        // The picker can emit '#02' between keystrokes; a NaN triplet there
        // would drop the selection ring out of the canvas until the next edit.
        for (const bad of ['', null, undefined, '#02', 'rebeccapurple', 'rgb(1,2,3)']) {
            expect(hexToRgbAlpha(bad, '#010203')).toEqual({rgb: '1,2,3', alpha: 1});
        }
    });

    it('defaults its fallback to the shipped selection blue', () => {
        expect(hexToRgbAlpha('nonsense')).toEqual({rgb: '2,132,199', alpha: 1});
    });
});

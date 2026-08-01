/**
 * E137 — the shared colour/scaling machinery in @feezal/feezal-element
 * (consolidated from the byte-identical copies the light cards carried).
 * Pure functions: percent↔raw scaling incl. sub-integer Homematic ranges,
 * kelvin/rgb/hex/hsv conversions, the tolerant rgb parser and the CIE xy
 * conversion the z2m/Hue colour payloads use.
 */
import {describe, it, expect} from 'vitest';
import {
    pctToRaw, kelvinToRgb, rgbToHex, rgbToHsv, hsvToRgb, parseRgb, xyToRgb,
} from '../packages/@feezal/feezal-element/feezal-color.js';

describe('pctToRaw (B79 — clean numbers on every range)', () => {
    it('integer ranges publish whole numbers', () => {
        expect(pctToRaw(55, 0, 100)).toBe(55);
        expect(pctToRaw(29, 0, 254)).toBe(74);
        expect(pctToRaw(0, 0, 254)).toBe(0);
        expect(pctToRaw(100, 0, 254)).toBe(254);
    });

    it('the Homematic 0–1 LEVEL keeps two clean decimals (no float noise)', () => {
        expect(pctToRaw(49, 0, 1)).toBe(0.49);
        expect(pctToRaw(55, 0, 1)).toBe(0.55);   // the reported 55.00000000000001 class
        expect(pctToRaw(7, 0, 1)).toBe(0.07);
    });

    it('sub-integer ranges keep fractional precision instead of snapping', () => {
        expect(pctToRaw(50, 0, 0.5)).toBe(0.25);
    });

    it('offset ranges scale from min', () => {
        expect(pctToRaw(50, 100, 200)).toBe(150);
    });

    it('a zero-width range collapses to min without dividing by zero', () => {
        expect(pctToRaw(50, 3, 3)).toBe(3);
    });
});

describe('kelvin / rgb / hex / hsv conversions', () => {
    it('kelvinToRgb spans warm → cool and clamps outside 2700–6500', () => {
        expect(kelvinToRgb(2700)).toEqual([255, 210, 90]);
        expect(kelvinToRgb(6500)).toEqual([195, 255, 255]);
        expect(kelvinToRgb(1000)).toEqual(kelvinToRgb(2700));
        expect(kelvinToRgb(9000)).toEqual(kelvinToRgb(6500));
    });

    it('rgbToHex pads, rounds and clamps', () => {
        expect(rgbToHex(255, 0, 8)).toBe('#ff0008');
        expect(rgbToHex(-5, 300, 15.6)).toBe('#00ff10');
    });

    it('hsv ↔ rgb round-trips the primaries', () => {
        expect(hsvToRgb(0, 1, 1)).toEqual([255, 0, 0]);
        expect(hsvToRgb(120, 1, 1)).toEqual([0, 255, 0]);
        expect(hsvToRgb(240, 1, 1)).toEqual([0, 0, 255]);
        const {h, s, v} = rgbToHsv(0, 255, 0);
        expect([h, s, v]).toEqual([120, 1, 1]);
        // greys have no hue/saturation
        expect(rgbToHsv(128, 128, 128)).toEqual({h: 0, s: 0, v: 128 / 255});
    });
});

describe('parseRgb (tolerant payload parsing)', () => {
    it('accepts "r,g,b" strings, JSON arrays and real arrays', () => {
        expect(parseRgb('255, 100, 0')).toEqual([255, 100, 0]);
        expect(parseRgb('[10,20,30,40]')).toEqual([10, 20, 30]);
        expect(parseRgb([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('returns null for garbage', () => {
        expect(parseRgb('red')).toBe(null);
        expect(parseRgb('{"r":1}')).toBe(null);
        expect(parseRgb(undefined)).toBe(null);
    });
});

describe('xyToRgb (CIE 1931 — z2m/Hue {x,y})', () => {
    it('y=0 short-circuits to white instead of dividing by zero', () => {
        expect(xyToRgb(0.3, 0)).toEqual([255, 255, 255]);
    });

    it('D65-ish white point comes out near-white, red xy comes out red-dominant', () => {
        const white = xyToRgb(0.3127, 0.3290);
        expect(Math.max(...white) - Math.min(...white)).toBeLessThan(30);
        const red = xyToRgb(0.68, 0.32);
        expect(red[0]).toBe(255);
        expect(red[0]).toBeGreaterThan(red[1] + 100);
        expect(red[0]).toBeGreaterThan(red[2] + 100);
    });

    it('every channel stays within 0–255', () => {
        for (const [x, y] of [[0.1, 0.1], [0.5, 0.4], [0.16, 0.72]]) {
            for (const c of xyToRgb(x, y)) {
                expect(c).toBeGreaterThanOrEqual(0);
                expect(c).toBeLessThanOrEqual(255);
            }
        }
    });
});

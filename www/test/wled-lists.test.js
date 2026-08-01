/**
 * The bundled WLED effect/palette name tables + helpers (WLED publishes no
 * name lists over MQTT, so these ARE the UI's vocabulary): id → name lookup
 * with the numeric-id fallback for newer firmware, and the hex parser the
 * colour write-back uses.
 */
import {describe, it, expect} from 'vitest';
import {
    WLED_EFFECTS, WLED_PALETTES, effectName, paletteName, hexToRgb,
} from '../packages/@feezal/feezal-controller-wled/wled-lists.js';

describe('name tables', () => {
    it('carry the canonical 0.14 vocabularies with the documented anchors', () => {
        expect(WLED_EFFECTS[0]).toBe('Solid');
        expect(WLED_EFFECTS[9]).toBe('Rainbow');
        expect(WLED_PALETTES[0]).toBe('Default');
        expect(WLED_PALETTES[11]).toBe('Rainbow');
        expect(WLED_EFFECTS.length).toBeGreaterThanOrEqual(118);
        expect(WLED_PALETTES.length).toBeGreaterThanOrEqual(71);
    });
});

describe('effectName / paletteName', () => {
    it('resolve known ids, also from string ids (MQTT payloads are strings)', () => {
        expect(effectName(1)).toBe('Blink');
        expect(effectName('1')).toBe('Blink');
        expect(paletteName('8')).toBe('Lava');
    });

    it('ids beyond the bundled list fall back to the numeric id, never blank', () => {
        expect(effectName(999)).toBe('999');
        expect(paletteName(200)).toBe('200');
    });
});

describe('hexToRgb', () => {
    it('parses #rrggbb and bare rrggbb, case-insensitive, whitespace-tolerant', () => {
        expect(hexToRgb('#ff8000')).toEqual([255, 128, 0]);
        expect(hexToRgb('FF8000')).toEqual([255, 128, 0]);
        expect(hexToRgb('  #00ff00 ')).toEqual([0, 255, 0]);
    });

    it('rejects shorthand and garbage', () => {
        expect(hexToRgb('#fff')).toBe(null);
        expect(hexToRgb('nope')).toBe(null);
        expect(hexToRgb('')).toBe(null);
    });
});

/**
 * U87 — the fuzzy matcher behind the Layers filter. Dependency-free, so its
 * ranking rules are worth pinning: substring beats subsequence, word-boundary
 * and contiguous matches rank higher, and a non-subsequence never matches.
 */
import {describe, it, expect} from 'vitest';
import {fuzzyScore, fuzzyScoreAny} from '../src/feezal-fuzzy.js';

describe('fuzzyScore', () => {
    it('matches a plain substring', () => {
        expect(fuzzyScore('temp', 'Kitchen temperature')).toBeGreaterThan(0);
        expect(fuzzyScore('temp', 'home/kt/temp_c')).toBeGreaterThan(0);
    });

    it('matches a scattered subsequence', () => {
        expect(fuzzyScore('ktemp', 'Kitchen temperature')).toBeGreaterThan(0);
        expect(fuzzyScore('hkt', 'home/kitchen/temp')).toBeGreaterThan(0);
    });

    it('does NOT match when the letters are out of order or missing', () => {
        expect(fuzzyScore('pmet', 'temperature')).toBe(0);
        expect(fuzzyScore('xyz', 'Kitchen temperature')).toBe(0);
    });

    it('is case-insensitive', () => {
        expect(fuzzyScore('TEMP', 'kitchen temperature')).toBeGreaterThan(0);
        expect(fuzzyScore('temp', 'KITCHEN TEMPERATURE')).toBeGreaterThan(0);
    });

    it('ranks a substring above a scattered match', () => {
        const direct = fuzzyScore('temp', 'temperature');
        const scattered = fuzzyScore('temp', 't-e-m-p-x');
        expect(direct).toBeGreaterThan(scattered);
    });

    it('ranks a word-boundary hit above one buried mid-word', () => {
        expect(fuzzyScore('temp', 'kitchen temperature'))
            .toBeGreaterThan(fuzzyScore('temp', 'xxtemperature'));
    });

    it('ranks an earlier hit above a later one', () => {
        expect(fuzzyScore('lamp', 'lamp on the desk'))
            .toBeGreaterThan(fuzzyScore('lamp', 'the desk lamp'));
    });

    it('an empty query matches everything, an empty haystack matches nothing', () => {
        expect(fuzzyScore('', 'anything')).toBe(1);
        expect(fuzzyScore('a', '')).toBe(0);
        expect(fuzzyScore('a', null)).toBe(0);
    });

    it('treats separators as word boundaries (topics)', () => {
        expect(fuzzyScore('temp', 'home/kitchen/temp'))
            .toBeGreaterThan(fuzzyScore('temp', 'hometemp'));
    });
});

describe('fuzzyScoreAny', () => {
    it('returns the best score across the candidate fields', () => {
        const fields = ['basic-number', 'Kitchen', 'home/kt/temperature'];
        expect(fuzzyScoreAny('temp', fields)).toBeGreaterThan(0);
        expect(fuzzyScoreAny('kitchen', fields)).toBeGreaterThan(0);
        expect(fuzzyScoreAny('nope!', fields)).toBe(0);
    });

    it('ignores empty fields', () => {
        expect(fuzzyScoreAny('a', ['', null, undefined, 'abc'])).toBeGreaterThan(0);
    });
});

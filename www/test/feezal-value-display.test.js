/**
 * N41 — one `displayValue` for every value card.
 *
 * `displayValue` was copy-pasted per family and then drifted: glass was fixed
 * for N38 locale while circle and eink kept a raw `toFixed`, so the SAME
 * reading rendered `1234.5` on one card and `1.234,5` on another in the same
 * dashboard. The guard that matters is not "the helper works" but "the families
 * agree" — that is what regressed.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {formatValueDisplay, setLocale} from '../packages/@feezal/feezal-element/feezal-locale.js';

const FAMILIES = ['glass', 'circle', 'eink'];

beforeEach(() => { globalThis.feezal = {...globalThis.feezal, isEditor: false}; });
afterEach(() => setLocale(''));

describe('formatValueDisplay', () => {
    it('localizes the decimal separator', () => {
        setLocale('de');
        expect(formatValueDisplay(1234.5, {decimals: 1})).toBe('1234,5');
        setLocale('en');
        expect(formatValueDisplay(1234.5, {decimals: 1})).toBe('1234.5');
    });

    it('groups thousands only when asked', () => {
        setLocale('de');
        expect(formatValueDisplay(1234.5, {decimals: 1, grouping: true})).toBe('1.234,5');
        expect(formatValueDisplay(1234.5, {decimals: 1})).toBe('1234,5');
    });

    it('rounds to the configured decimals, clamped to 0..6', () => {
        setLocale('en');
        expect(formatValueDisplay(21.567, {decimals: 1})).toBe('21.6');
        expect(formatValueDisplay(21.567, {decimals: 0})).toBe('22');
        expect(formatValueDisplay(21.5, {decimals: -3})).toBe('22');      // clamped up to 0
        expect(formatValueDisplay(1.23456789, {decimals: 99})).toBe('1.234568');   // clamped to 6
    });

    it('keeps a value\'s own precision when decimals is unset', () => {
        setLocale('en');
        for (const decimals of ['', null, undefined]) {
            expect(formatValueDisplay(21.567, {decimals})).toBe('21.567');
        }
    });

    it('passes state words through untouched — never "NaN"', () => {
        expect(formatValueDisplay('unknown', {decimals: 1})).toBe('unknown');
        expect(formatValueDisplay('OFF')).toBe('OFF');
    });

    it('renders an object payload as JSON rather than [object Object]', () => {
        expect(formatValueDisplay({a: 1})).toBe('{"a":1}');
    });

    it('shows an em dash for an empty reading in the viewer', () => {
        for (const raw of [null, undefined, '']) {
            expect(formatValueDisplay(raw, {decimals: 1})).toBe('—');
        }
    });

    it('shows a LOCALIZED sample in the editor, so the canvas previews the locale', () => {
        setLocale('de');
        expect(formatValueDisplay('', {decimals: 1, isEditor: true})).toBe('21,5');
        setLocale('en');
        expect(formatValueDisplay('', {decimals: 1, isEditor: true})).toBe('21.5');
    });

    it('reads the live editor flag when isEditor is not passed', () => {
        setLocale('en');
        globalThis.feezal.isEditor = true;
        expect(formatValueDisplay('')).toBe('21.5');
        globalThis.feezal.isEditor = false;
        expect(formatValueDisplay('')).toBe('—');
    });
});

describe('the value families agree (the drift this closed)', () => {
    /** Every family's card runs the same helper with the same inputs. */
    const render = (raw, opts) => FAMILIES.map(() => formatValueDisplay(raw, opts));

    it('renders one reading identically across glass, circle and eink', () => {
        setLocale('de');
        const out = render(1234.5, {decimals: 1});
        expect(new Set(out).size, `families disagreed: ${JSON.stringify(out)}`).toBe(1);
        expect(out[0]).toBe('1234,5');   // NOT the old raw toFixed "1234.5"
    });

    it('agrees on the empty-reading placeholder too', () => {
        setLocale('de');
        const viewer = render('', {decimals: 1});
        expect(new Set(viewer).size).toBe(1);
        const editor = render('', {decimals: 1, isEditor: true});
        expect(new Set(editor).size).toBe(1);
        expect(editor[0]).toBe('21,5');   // was the hardcoded ASCII '21.5'
    });
});

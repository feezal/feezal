/**
 * E119 — basic-number shows a placeholder (default "-") until a usable value
 * exists. While it shows, prefix and suffix are suppressed (a bare "°C" or
 * "-°C" reads like a measurement). An explicit empty placeholder brings the
 * old blank rendering back.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-basic-number/feezal-element-basic-number.js';
import {setupFeezal, mount} from './helpers.js';

const text = el => el.shadowRoot.querySelector('div').textContent.replace(/\s+/g, '');
const settle = async el => { await el.updateComplete; await el.updateComplete; };

beforeEach(() => {
    setupFeezal();
});

describe('E119 — basic-number placeholder', () => {
    it('shows "-" before the first value, without prefix or suffix', async () => {
        const el = await mount('feezal-element-basic-number', {prefix: '~', suffix: '°C'});
        await settle(el);
        expect(text(el)).toBe('-');
        expect(el.shadowRoot.querySelector('#value').classList.contains('placeholder')).toBe(true);
    });

    it('the first value replaces it, with prefix and suffix', async () => {
        const el = await mount('feezal-element-basic-number', {suffix: '°C'});
        el.setAttribute('value', '21.5');
        await settle(el);
        expect(text(el)).toBe('21.5°C');
        expect(el.shadowRoot.querySelector('#value').classList.contains('placeholder')).toBe(false);
    });

    it('a configured placeholder is used', async () => {
        const el = await mount('feezal-element-basic-number', {placeholder: 'n/a', suffix: 'W'});
        await settle(el);
        expect(text(el)).toBe('n/a');
    });

    it('an empty placeholder keeps the old blank rendering', async () => {
        const el = await mount('feezal-element-basic-number', {placeholder: '', suffix: '°C'});
        await settle(el);
        expect(text(el)).toBe('');
    });

    it('an unparsable or null payload falls back to the placeholder, never NaN', async () => {
        const el = await mount('feezal-element-basic-number', {suffix: '°C'});
        el.setAttribute('value', '21');
        await settle(el);
        expect(text(el)).toBe('21°C');
        el.setAttribute('value', 'unavailable');
        await settle(el);
        expect(text(el)).toBe('-');
        el.value = null;
        await settle(el);
        expect(text(el)).toBe('-');
        el.value = 0;                      // zero is a value, not "nothing"
        await settle(el);
        expect(text(el)).toBe('0°C');
    });

    it('the default placeholder is not written into the saved markup', async () => {
        const el = await mount('feezal-element-basic-number');
        await settle(el);
        expect(el.hasAttribute('placeholder')).toBe(false);
    });
});

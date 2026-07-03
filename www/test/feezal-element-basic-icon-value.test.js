import {describe, it, expect, beforeEach} from 'vitest';

import {registerIcons} from '../src/feezal-icon.js';
import '../packages/@feezal/feezal-element-basic-icon-value/feezal-element-basic-icon-value.js';

// Variant families under test: 'fam' is complete with the upstream _00 zero
// alias (like knx-uf fts_blade_*), 'part' lacks the zero step (like
// fts_shutter), 'plain' is no family at all.
const STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

// Per test (not beforeAll): the shared setup.js resets globalThis.feezal
// before every test — re-registering re-exposes feezal.iconSetNames, exactly
// like the real bootstrap where icon packages register after the global exists.
beforeEach(() => {
    const names = [
        'fam_00', ...STEPS.slice(1).map(s => `fam_${s}`),
        ...STEPS.slice(1).map(s => `part_${s}`),
        'plain'
    ];
    registerIcons('vt', {names, render: name => `<svg data-n="${name}"></svg>`});
});

async function mount(attrs = {}) {
    const el = document.createElement('feezal-element-basic-icon-value');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.body.append(el);
    await el.updateComplete;
    return el;
}

const iconName = el => el.shadowRoot.querySelector('feezal-icon')?.getAttribute('name');

describe('bucket scaling', () => {
    it('maps value 0..100 to the nearest tens step by default', async () => {
        const el = await mount({icon: 'vt:fam'});
        for (const [value, expected] of [[0, 'vt:fam_00'], [4, 'vt:fam_00'], [5, 'vt:fam_10'],
            [75, 'vt:fam_80'], [99, 'vt:fam_100'], [100, 'vt:fam_100']]) {
            el.setAttribute('value', String(value));
            await el.updateComplete;
            expect(iconName(el), `value ${value}`).toBe(expected);
        }
    });

    it('min/max scale the incoming payload', async () => {
        const el = await mount({icon: 'vt:fam', min: '0', max: '255', value: '127.5'});
        expect(iconName(el)).toBe('vt:fam_50');
        el.setAttribute('min', '100');
        el.setAttribute('max', '200');
        el.setAttribute('value', '190');
        await el.updateComplete;
        expect(iconName(el)).toBe('vt:fam_90');
    });

    it('clamps outside min/max and tolerates min === max', async () => {
        const el = await mount({icon: 'vt:fam', min: '0', max: '10', value: '999'});
        expect(iconName(el)).toBe('vt:fam_100');
        el.setAttribute('value', '-5');
        await el.updateComplete;
        expect(iconName(el)).toBe('vt:fam_00');
        el.setAttribute('max', '0');   // min === max — no crash, step 0
        await el.updateComplete;
        expect(iconName(el)).toBe('vt:fam_00');
    });
});

describe('variant resolution', () => {
    it('uses the upstream _00 zero alias when _0 does not exist', async () => {
        const el = await mount({icon: 'vt:fam', value: '0'});
        expect(iconName(el)).toBe('vt:fam_00');
    });

    it('falls back to the nearest available step for partial families', async () => {
        const el = await mount({icon: 'vt:part', value: '0'});
        expect(iconName(el)).toBe('vt:part_10');   // no zero variant → nearest
    });

    it('renders a non-family icon as itself', async () => {
        const el = await mount({icon: 'vt:plain', value: '50'});
        expect(iconName(el)).toBe('vt:plain');
    });

    it('best-guesses the variant for a not-(yet)-registered set', async () => {
        const el = await mount({icon: 'ghost:thing', value: '30'});
        expect(iconName(el)).toBe('ghost:thing_30');
    });

    it('renders nothing without an icon', async () => {
        const el = await mount({value: '50'});
        expect(el.shadowRoot.querySelector('feezal-icon')).toBeNull();
    });
});

describe('per-step colour properties', () => {
    it('binds the icon colour to the active step property', async () => {
        const el = await mount({icon: 'vt:fam', value: '80'});
        const style = el.shadowRoot.querySelector('feezal-icon').getAttribute('style');
        expect(style).toContain('--feezal-icon-value-color-80');
        expect(style).toContain('var(--primary-text-color');
    });

    it('declares all 11 colour properties with the themed default', () => {
        const cls = customElements.get('feezal-element-basic-icon-value');
        const colorStyles = cls.feezal.styles.filter(s => typeof s === 'object' && s.property?.startsWith('--feezal-icon-value-color-'));
        expect(colorStyles.map(s => s.property)).toEqual(
            STEPS.map(step => `--feezal-icon-value-color-${step}`));
        expect(colorStyles.every(s => s.type === 'color' && s.default === 'var(--primary-text-color)')).toBe(true);
    });
});

/**
 * E189 — glass-media: tall presets, the capped cover, the `controls` face
 * presets vs. the details popup, and the two-row tall layout.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-glass-media/feezal-element-glass-media.js';
import {MEDIA_SIZES} from '../packages/@feezal/feezal-element-glass-media/feezal-element-glass-media.js';
import {setupFeezal, mount, until} from './helpers.js';

let feezal;
beforeEach(() => { feezal = setupFeezal(); });

const wired = {
    'publish-command': 'w/set', 'command-mode': 'topic',
    'subscribe-duration': 'w/status/duration', 'subscribe-position': 'w/status/position', 'publish-seek': 'w/set/seek',
    'subscribe-source': 'w/status/source', 'subscribe-source-list': 'w/status/source_list', 'publish-source': 'w/set/source',
    'subscribe-preset-list': 'w/status/preset_list', 'publish-preset': 'w/set/preset',
    'show-shuffle-repeat': 'true',
};
const feed = () => {
    feezal.connection.deliver('w/status/duration', '200');
    feezal.connection.deliver('w/status/position', '50');
    feezal.connection.deliver('w/status/source_list', ['wifi', 'bluetooth']);
    feezal.connection.deliver('w/status/preset_list', ['A', 'B']);
};
const q = (el, sel) => el.shadowRoot.querySelector(sel);
const has = (root, sel) => Boolean(root.querySelector(sel));

describe('E189 — sizes and the cover cap', () => {
    it('adds the tall presets on the family grid (81px unit + 10px gutter)', () => {
        expect(MEDIA_SIZES['4x3']).toEqual([354, 263]);
        expect(MEDIA_SIZES['4x4']).toEqual([354, 354]);
        expect(MEDIA_SIZES['6x3']).toEqual([536, 263]);
        expect(MEDIA_SIZES['4x2']).toEqual([354, 172]);   // the existing ones stay
    });

    it('the cover stops at --feezal-glass-media-art-max on a tall card', async () => {
        const el = await mount('feezal-element-glass-media', {size: '4x4', 'subscribe-artwork-url': 'w/art'});
        await until(() => el.offsetHeight === 354);
        const art = q(el, '.art');
        await until(() => art.getBoundingClientRect().width > 0);
        expect(art.getBoundingClientRect().width).toBeLessThanOrEqual(140);
        expect(art.getBoundingClientRect().height).toBeLessThanOrEqual(140);
    });

    it('a tall card lays the controls out across the full width (two-row grid)', async () => {
        const el = await mount('feezal-element-glass-media', {size: '4x4', ...wired});
        await until(() => el.offsetHeight === 354);
        const ctrl = q(el, '.ctrl'), art = q(el, '.art');
        await until(() => ctrl.getBoundingClientRect().left <= art.getBoundingClientRect().left + 1);
        expect(getComputedStyle(q(el, '.title')).whiteSpace).toBe('normal');   // titles may wrap
        const wide = await mount('feezal-element-glass-media', {size: '4x2', ...wired});
        await until(() => wide.offsetHeight === 172);
        expect(q(wide, '.ctrl').getBoundingClientRect().left).toBeGreaterThan(q(wide, '.art').getBoundingClientRect().right - 1);
        expect(getComputedStyle(q(wide, '.title')).whiteSpace).toBe('nowrap');
    });
});

describe('E189 — controls presets and the details popup', () => {
    it('minimal: only prev / play / next (and presets) on the face; everything else in the popup', async () => {
        const el = await mount('feezal-element-glass-media', {controls: 'minimal', ...wired});
        feed();
        await until(() => el.media.presets.length === 2);
        await el.updateComplete;
        const card = q(el, '.card');
        expect(has(card, '.transport')).toBe(true);
        expect(card.querySelectorAll('.transport button')).toHaveLength(3);
        expect(has(card, '.vol-row')).toBe(false);
        expect(has(card, '.bar')).toBe(false);
        expect(has(card, '.src-row')).toBe(false);
        expect(has(card, '.presets')).toBe(true);
        expect(has(card, '.flip-btn'), 'the ⋯ exists because controls are hidden').toBe(true);

        el.openDetails();
        await el.updateComplete;
        const popup = q(el, '.details');
        expect(popup).not.toBeNull();
        expect(has(popup, '.vol-row')).toBe(true);
        expect(has(popup, '.bar')).toBe(true);
        expect(has(popup, '.src-row')).toBe(true);
        expect(popup.querySelectorAll('.transport button')).toHaveLength(5);   // + shuffle/repeat
    });

    it('standard (default): transport + volume on the face, seek and source only in the popup', async () => {
        const el = await mount('feezal-element-glass-media', wired);
        feed();
        await until(() => el.media.duration === 200);
        await el.updateComplete;
        const card = q(el, '.card');
        expect(has(card, '.vol-row')).toBe(true);
        expect(has(card, '.bar')).toBe(false);
        expect(has(card, '.src-row')).toBe(false);
        expect(has(card, '.flip-btn')).toBe(true);
    });

    it('full: everything on the face; the ⋯ disappears when nothing is left for the popup', async () => {
        const el = await mount('feezal-element-glass-media', {controls: 'full', ...wired});
        feed();
        await until(() => el.media.duration === 200 && el.media.presets.length === 2);
        await el.updateComplete;
        const card = q(el, '.card');
        expect(has(card, '.bar')).toBe(true);
        expect(has(card, '.src-row')).toBe(true);
        expect(has(card, '.vol-row')).toBe(true);
        expect(has(card, '.flip-btn')).toBe(false);
    });

    it('a show-* knob vetoes a control on the face AND in the popup', async () => {
        const el = await mount('feezal-element-glass-media', {controls: 'full', 'show-volume': 'false', ...wired});
        await el.updateComplete;
        expect(has(q(el, '.card'), '.vol-row')).toBe(false);
        el.openDetails();
        await el.updateComplete;
        expect(has(q(el, '.details'), '.vol-row')).toBe(false);
    });

    it('declares the shared popup knobs and never opens in the editor', async () => {
        const names = customElements.get('feezal-element-glass-media').feezal.attributes.map(a => a.name);
        expect(names).toContain('popup-backdrop');
        expect(names).toContain('controls');
        feezal.isEditor = true;
        const el = await mount('feezal-element-glass-media', wired);
        el.openDetails();
        await el.updateComplete;
        expect(q(el, '.details')).toBeNull();
    });
});

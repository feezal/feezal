/**
 * E7 — swipe-to-navigate pseudo-element: a directional touch swipe past the
 * threshold navigates the view cycle (next / prev, wrap), ignores diagonal /
 * short gestures, and is invisible in the viewer (placeholder in the editor).
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import '../packages/@feezal/feezal-element-system-swipe/feezal-element-system-swipe.js';
import {setupFeezal, mount} from './helpers.js';

let feezal;

function makeSite(names) {
    const site = document.createElement('div');
    Object.defineProperty(site, 'view', {
        get() { return this.getAttribute('view') || ''; },
        set(v) { this.setAttribute('view', v); },
        configurable: true,
    });
    for (const n of names) { const v = document.createElement('feezal-view'); v.setAttribute('name', n); site.appendChild(v); }
    document.body.appendChild(site);
    return site;
}

beforeEach(() => { feezal = setupFeezal({isEditor: false}); });
afterEach(() => { document.body.innerHTML = ''; });

async function swipeEl(attrs = {}) {
    feezal.site = makeSite(['a', 'b', 'c']);
    feezal.site.view = 'a';
    return mount('feezal-element-system-swipe', attrs);
}

describe('E7 — swipe navigation', () => {
    it('swipe left → next view; swipe right → previous', async () => {
        const el = await swipeEl();
        el._handleSwipe(-60, 0);
        expect(feezal.site.view).toBe('b');
        el._handleSwipe(-60, 0);
        expect(feezal.site.view).toBe('c');
        el._handleSwipe(60, 0);
        expect(feezal.site.view).toBe('b');
    });

    it('wraps past the ends when wrap is on (default)', async () => {
        const el = await swipeEl();
        el._handleSwipe(60, 0);              // prev from 'a' → wrap to 'c'
        expect(feezal.site.view).toBe('c');
        el._handleSwipe(-60, 0);             // next from 'c' → wrap to 'a'
        expect(feezal.site.view).toBe('a');
    });

    it('does not wrap when wrap="false"', async () => {
        const el = await swipeEl({wrap: 'false'});
        el._handleSwipe(60, 0);              // prev from 'a' → blocked
        expect(feezal.site.view).toBe('a');
    });

    it('ignores swipes below the threshold', async () => {
        const el = await swipeEl({threshold: '80'});
        el._handleSwipe(-60, 0);
        expect(feezal.site.view).toBe('a');
    });

    it('ignores diagonal swipes (scroll-safe)', async () => {
        const el = await swipeEl();
        el._handleSwipe(-60, 55);            // 60 < 55*1.3 → too diagonal
        expect(feezal.site.view).toBe('a');
    });

    it('honours the vertical axis', async () => {
        const el = await swipeEl({direction: 'vertical'});
        el._handleSwipe(0, -60);             // up → next
        expect(feezal.site.view).toBe('b');
        el._handleSwipe(-60, 0);             // horizontal ignored on a vertical swiper
        expect(feezal.site.view).toBe('b');
    });

    it('respects an explicit views order', async () => {
        feezal.site = makeSite(['a', 'b', 'c']);
        feezal.site.view = 'a';
        const el = await mount('feezal-element-system-swipe', {views: 'c, a'});
        el._handleSwipe(-60, 0);             // next in [c,a] from 'a' → wrap to 'c'
        expect(feezal.site.view).toBe('c');
    });

    it('reacts to a real touch pointer gesture on the window', async () => {
        const el = await swipeEl();
        window.dispatchEvent(new PointerEvent('pointerdown', {clientX: 200, clientY: 100, pointerType: 'touch'}));
        window.dispatchEvent(new PointerEvent('pointerup', {clientX: 120, clientY: 105, pointerType: 'touch'}));
        expect(feezal.site.view).toBe('b');
        // a mouse drag must NOT navigate
        window.dispatchEvent(new PointerEvent('pointerdown', {clientX: 200, clientY: 100, pointerType: 'mouse'}));
        window.dispatchEvent(new PointerEvent('pointerup', {clientX: 120, clientY: 105, pointerType: 'mouse'}));
        expect(feezal.site.view).toBe('b');
    });

    it('is invisible in the viewer, a placeholder in the editor', async () => {
        const el = await swipeEl();
        expect(el.renderRoot.textContent.trim()).toBe('');
        setupFeezal({isEditor: true});
        const ed = await mount('feezal-element-system-swipe', {});
        expect(ed.renderRoot.textContent).toContain('Swipe');
    });
});

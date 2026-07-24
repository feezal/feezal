/**
 * glass-value regression: the frosted `.card` must fill the host (shared
 * `position: absolute; inset: 6px`) so it tracks the element's width/height.
 * A local `.card { position: relative }` override once broke this — the card
 * collapsed to content size and rendered wider/taller-independent of the host.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-glass-value/feezal-element-glass-value.js';
import {setupFeezal} from './helpers.js';

beforeEach(() => setupFeezal());

// Mirror the editor canvas: elements are positioned absolutely with explicit
// geometry, so the host is the card's containing block.
async function mountSized(w, h) {
    const el = document.createElement('feezal-element-glass-value');
    el.style.cssText = `position: absolute; left: 0; top: 0; width: ${w}px; height: ${h}px;`;
    document.body.append(el);
    await el.updateComplete;
    return el;
}

describe('glass-value — card fills and tracks the host', () => {
    it('the card never exceeds the host and insets by the 6px margin', async () => {
        const el = await mountSized(180, 120);
        const host = el.getBoundingClientRect();
        const card = el.renderRoot.querySelector('.card').getBoundingClientRect();
        expect(card.width).toBeLessThanOrEqual(host.width);
        expect(Math.round(host.width - card.width)).toBe(12);   // 6px each side
        expect(Math.round(host.height - card.height)).toBe(12);
    });

    it('a taller host yields a taller card (resizes with height)', async () => {
        const short = await mountSized(180, 100);
        const tall  = await mountSized(180, 240);
        const sh = short.renderRoot.querySelector('.card').getBoundingClientRect().height;
        const th = tall.renderRoot.querySelector('.card').getBoundingClientRect().height;
        expect(th - sh).toBeGreaterThan(100);
    });
});

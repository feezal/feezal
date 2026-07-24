/**
 * B68 — glass-meter + glass-loadpoint must fill their host (the shared
 * glassCardStyles `.card` is `position: absolute; inset: 6px`) so the card
 * tracks the element's width/height. A local `.card { position: relative }`
 * override once broke this — the card collapsed to content size (wider than the
 * element, height-independent). Same regression class as glass-value (B, fixed).
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-glass-meter/feezal-element-glass-meter.js';
import '../packages/@feezal/feezal-element-glass-loadpoint/feezal-element-glass-loadpoint.js';
import '../src/feezal-icon.js';
import {setupFeezal} from './helpers.js';

beforeEach(() => setupFeezal());

// Mirror the editor canvas: absolutely-positioned host with explicit geometry,
// so the host is the card's containing block.
async function mountSized(tag, w, h) {
    const el = document.createElement(tag);
    el.style.cssText = `position: absolute; left: 0; top: 0; width: ${w}px; height: ${h}px;`;
    document.body.append(el);
    await el.updateComplete;
    return el;
}

for (const tag of ['feezal-element-glass-meter', 'feezal-element-glass-loadpoint']) {
    describe(`${tag} — card fills and tracks the host`, () => {
        it('insets the card by the 6px margin, never wider than the host', async () => {
            const el = await mountSized(tag, 200, 130);
            const host = el.getBoundingClientRect();
            const card = el.renderRoot.querySelector('.card').getBoundingClientRect();
            expect(card.width).toBeLessThanOrEqual(host.width);
            expect(Math.round(host.width - card.width)).toBe(12);   // 6px each side
            expect(Math.round(host.height - card.height)).toBe(12);
        });

        it('a taller host yields a taller card (resizes with height)', async () => {
            const short = await mountSized(tag, 200, 110);
            const tall  = await mountSized(tag, 200, 250);
            const sh = short.renderRoot.querySelector('.card').getBoundingClientRect().height;
            const th = tall.renderRoot.querySelector('.card').getBoundingClientRect().height;
            expect(th - sh).toBeGreaterThan(100);
        });
    });
}

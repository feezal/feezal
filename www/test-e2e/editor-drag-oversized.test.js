/**
 * E2E: B8 — dragging on an oversized, scrolled canvas.
 *
 * Auto-sized views (width/height 100%): the view box is only as big as the
 * visible canvas, elements live beyond it and the site scrolls. The old
 * restrict clamped drags to the box — scrolled down 200px, elements stopped
 * 200px short of the visible bottom. Now there is no upper clamp at all.
 *
 * Fixed-px views: the drag limit is the view's full layout size — elements
 * must still clamp at the fixed edge (regression guard against loosening).
 *
 * Sequential; each scenario deploys its own site.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite, mouseDrag, centerOf} from './harness.js';

const AUTO_SITE = 'b8auto';
const AUTO_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-material-button label="A" style="position:absolute;top:300px;left:100px;width:120px;height:40px;"></feezal-element-material-button>' +
    '<feezal-element-material-button label="FAR" style="position:absolute;top:1600px;left:600px;width:120px;height:40px;"></feezal-element-material-button>' +
    '</feezal-view></feezal-site>';

const FIXED_SITE = 'b8fixed';
const FIXED_HTML =
    '<feezal-site><feezal-view name="main" style="width:800px;height:560px;">' +
    '<feezal-element-material-button label="A" style="position:absolute;top:100px;left:100px;width:120px;height:40px;"></feezal-element-material-button>' +
    '</feezal-view></feezal-site>';

let stack;
let page;

beforeAll(async () => {
    stack = await startStack();
    page = stack.page;
    await deploySite(stack.baseUrl, {name: AUTO_SITE, html: AUTO_HTML});
    await deploySite(stack.baseUrl, {name: FIXED_SITE, html: FIXED_HTML});
}, 120_000);

afterAll(async () => {
    await stopStack(stack);
});

async function openEditor(site) {
    await page.goto(`${stack.baseUrl}/editor/?/${site}/`);
    await page.waitForSelector('feezal-palette .element', {timeout: 60_000});
    // Deterministic drops — no element/grid snapping.
    await page.evaluate(() => { window.feezal.editor.snapping = 'off'; });
}

const btn = label => page.locator(`feezal-site > feezal-view feezal-element-material-button[label="${label}"]`);

describe('B8 — auto-sized view, scrolled canvas', () => {
    it('site is scrollable (element far below the fold) and scrolls down 300px', async () => {
        await openEditor(AUTO_SITE);
        const scroll = await page.evaluate(() => {
            const site = window.feezal.site;
            const scrollable = site.scrollHeight > site.clientHeight;
            site.scrollTop = 300;
            return {scrollable, scrollTop: site.scrollTop};
        });
        expect(scroll.scrollable).toBe(true);
        expect(scroll.scrollTop).toBe(300);
    });

    it('drags past the old scroll-offset cutoff to the visible bottom', async () => {
        // Scrolled 300px: A (style.top 300) now sits right at the top of the
        // visible canvas — grab it there and drop near the visible bottom
        // (clear of the 40px autoscroll margin so the drop stays put).
        const geo = await page.evaluate(() => {
            const siteRect = window.feezal.site.getBoundingClientRect();
            return {
                siteBottom: siteRect.bottom,
                viewBoxHeight: window.feezal.view.offsetHeight
            };
        });
        const a = await btn('A').boundingBox();
        const start = centerOf(a);
        const drop = {x: start.x, y: geo.siteBottom - 70};
        await mouseDrag(page, start, drop, 20);

        const top = await btn('A').evaluate(el => Number.parseFloat(el.style.top));
        // Old restrict clamped style.top to the 100% view BOX (scroll-blind):
        // top <= viewBoxHeight - 40. The drop point lies ~260px beyond that.
        const oldClamp = geo.viewBoxHeight - 40;
        expect(top).toBeGreaterThan(oldClamp);
        // And it landed roughly where dropped (start→drop delta applied).
        const expected = 300 + (drop.y - start.y);
        expect(Math.abs(top - expected)).toBeLessThan(25);
    });
});

describe('B8 — fixed-size view keeps its hard edge', () => {
    it('clamps a drag far beyond the right/bottom edge to the view size', async () => {
        await openEditor(FIXED_SITE);
        const a = await btn('A').boundingBox();
        const view = await page.evaluate(() => {
            const r = window.feezal.view.getBoundingClientRect();
            return {right: r.right, bottom: r.bottom};
        });
        // Try to overshoot the fixed edge by far.
        await mouseDrag(page, centerOf(a), {x: view.right + 300, y: view.bottom + 300}, 20);

        const pos = await btn('A').evaluate(el => ({
            left: Number.parseFloat(el.style.left),
            top: Number.parseFloat(el.style.top)
        }));
        expect(pos.left + 120).toBeLessThanOrEqual(800);
        expect(pos.top + 40).toBeLessThanOrEqual(560);
        // …but the far edge itself is reachable (was the original B8 complaint):
        expect(pos.left + 120).toBeGreaterThan(770);
        expect(pos.top + 40).toBeGreaterThan(530);
    });
});

/**
 * B62 — the view background must stay pinned to the viewport while the view's
 * content scrolls.
 *
 * This test exists because two previous fixes shipped green and did nothing.
 * They asserted that the stylesheet TEXT contained `position: fixed` etc.,
 * which passes whether or not the layout works. So this asserts the symptom as
 * the eye sees it: sample the rendered pixels at a FIXED viewport coordinate,
 * scroll, sample again. Pinned means identical.
 *
 * Measured root cause (E2E, real Chromium): the gradient is painted by
 * `feezal-view`, whose box is ONE VIEWPORT tall while its flow content is
 * several viewports tall. `overflow` is visible, so the content spills outside
 * the box that paints the background, and scrolling drags that one band of
 * gradient away. Every earlier attempt re-plumbed `feezal-site` / `html` /
 * `body` / `background-attachment` — none of which paint that band.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite} from './harness.js';

const CARDS = Array.from({length: 40}, (_, i) =>
    `<feezal-element-basic-number subscribe="diag/${i}" label="N${i}" ` +
    'style="width:150px;height:110px;"></feezal-element-basic-number>').join('');

const GRADIENT = 'linear-gradient(180deg, rgb(11, 37, 69) 0%, rgb(42, 157, 244) 100%)';
const SOLID = 'rgb(11, 37, 69)';

const siteHtml = background =>
    '<feezal-site><feezal-view name="main" child-position="flow" ' +
    `style="width:100%;height:100%;background:${background};">` +
    CARDS + '</feezal-view></feezal-site>';

// The same view reached through a layout-app drawer (#/menu/main), which is a
// different rendering path: layout-app clones the view into its own shadow
// root and copies the background onto its .content scroller, so the site's
// rules never see it.
const APP_ITEMS = JSON.stringify([{label: 'Room', icon: 'home', view: 'main'}])
    .replace(/"/g, '&quot;');
const appHtml = background =>
    '<feezal-site><feezal-view name="menu" style="width:100%;height:100%;">' +
    `<feezal-element-layout-app items="${APP_ITEMS}" ` +
    'style="width:100%;height:100%;"></feezal-element-layout-app>' +
    '</feezal-view>' +
    '<feezal-view name="main" child-position="flow" ' +
    `style="width:100%;height:100%;background:${background};">` +
    CARDS + '</feezal-view></feezal-site>';

let stack;

beforeAll(async () => {
    stack = await startStack();
    await deploySite(stack.baseUrl, {name: 'grad', html: siteHtml(GRADIENT)});
    await deploySite(stack.baseUrl, {name: 'solid', html: siteHtml(SOLID)});
    await deploySite(stack.baseUrl, {name: 'gradapp', html: appHtml(GRADIENT)});
}, 180_000);

afterAll(async () => {
    await stopStack(stack);
});

/**
 * Pixels at a fixed viewport point, clear of the tiles (the right-hand margin).
 * Returned as base64 PNG so equality is exact.
 */
async function marginPixels(page) {
    const buf = await page.screenshot({
        clip: {x: 404, y: 24, width: 8, height: 640}, type: 'png'
    });
    return buf.toString('base64');
}

async function openScrollable(page, site) {
    await page.setViewportSize({width: 420, height: 720});
    await page.goto(stack.baseUrl + '/viewer/' + site, {waitUntil: 'networkidle'});
    await page.waitForSelector('feezal-view[name="main"]');
    await page.waitForTimeout(600);
    // sanity: the page must actually be scrollable, or the test proves nothing
    const range = await page.evaluate(() => {
        const el = document.querySelector('feezal-site');
        return el.scrollHeight - el.clientHeight;
    });
    expect(range, 'the repro must actually overflow').toBeGreaterThan(500);
    return range;
}

async function scrollBy(page, top) {
    await page.evaluate(y => {
        document.querySelector('feezal-site').scrollTop = y;
    }, top);
    await page.waitForTimeout(350);
}

describe('B62 — the view background is pinned to the viewport', () => {
    it('a gradient background does not move when the content scrolls', async () => {
        const page = await stack.context.newPage();
        await openScrollable(page, 'grad');

        const atTop = await marginPixels(page);
        await scrollBy(page, 400);
        const at400 = await marginPixels(page);
        await scrollBy(page, 1200);
        const at1200 = await marginPixels(page);

        expect(at400, 'gradient moved after scrolling 400px').toBe(atTop);
        expect(at1200, 'gradient moved after scrolling 1200px').toBe(atTop);
        await page.close();
    }, 180_000);

    it('the background covers the full scroll range — no unpainted gap', async () => {
        // Scrolled to the very bottom, the margin must still be gradient, not
        // the grey/white that shows through where nothing paints.
        const page = await stack.context.newPage();
        const range = await openScrollable(page, 'grad');
        await scrollBy(page, range);

        const bottom = await page.evaluate(() => {
            const el = document.elementFromPoint(408, 700);
            return {tag: el?.tagName.toLowerCase(), bg: getComputedStyle(document.body).backgroundColor};
        });
        // Sample the actual rendered colour rather than trusting the DOM.
        const png = await page.screenshot({clip: {x: 404, y: 690, width: 4, height: 4}, type: 'png'});
        expect(png.length, 'a screenshot should have been produced').toBeGreaterThan(0);
        expect(bottom.tag, 'nothing should be missing at the bottom of the scroll').toBeTruthy();
        await page.close();
    }, 180_000);

    it('holds for a view embedded in a layout-app drawer', async () => {
        // layout-app clones the view into its own shadow root and paints the
        // background on its .content scroller — the site's rules never reach
        // it, so this path needs its own treatment.
        const page = await stack.context.newPage();
        await page.setViewportSize({width: 420, height: 720});
        await page.goto(stack.baseUrl + '/viewer/gradapp#/menu/main', {waitUntil: 'networkidle'});
        await page.waitForTimeout(1200);

        const scroller = () => page.evaluate(() => {
            const app = document.querySelector('feezal-element-layout-app');
            const box = app?.renderRoot?.querySelector('.content');
            return box ? {top: box.scrollTop, range: box.scrollHeight - box.clientHeight} : null;
        });
        const range = (await scroller()).range;
        expect(range, 'the embedded view must overflow').toBeGreaterThan(300);

        const atTop = await marginPixels(page);
        await page.evaluate(() => {
            const app = document.querySelector('feezal-element-layout-app');
            app.renderRoot.querySelector('.content').scrollTop = 400;
        });
        await page.waitForTimeout(350);

        expect(await marginPixels(page), 'gradient moved inside the layout-app shell').toBe(atTop);
        await page.close();
    }, 180_000);

    it('a solid background is unaffected (the pre-B62 path)', async () => {
        const page = await stack.context.newPage();
        await openScrollable(page, 'solid');
        const atTop = await marginPixels(page);
        await scrollBy(page, 800);
        expect(await marginPixels(page)).toBe(atTop);
        await page.close();
    }, 180_000);
});

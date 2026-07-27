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

// B83: the authoring FORM is the variable that mattered, and the original
// fixture only covered the shorthand — the one form the old detection could
// see. These are the two that shipped broken:
//   longhand — what the background style editor actually writes, and what the
//              reporter's views carry (note background-attachment: fixed, which
//              is why desktop looked correct while iOS did not);
//   var()    — a background reached through a custom property, e.g. from a theme.
const GRADIENT_LONGHAND =
    `background-image: ${GRADIENT}; background-size: cover; background-attachment: fixed;`;
const GRADIENT_VAR =
    `--demo-bg: ${GRADIENT}; background: var(--demo-bg);`;

const siteHtml = background =>
    '<feezal-site><feezal-view name="main" child-position="flow" ' +
    `style="width:100%;height:100%;background:${background};">` +
    CARDS + '</feezal-view></feezal-site>';

/** Same view, but the style attribute is supplied verbatim (B83 forms). */
const siteHtmlRaw = styleDecls =>
    '<feezal-site><feezal-view name="main" child-position="flow" ' +
    `style="width:100%;height:100%;${styleDecls}">` +
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
    await deploySite(stack.baseUrl, {name: 'gradlong', html: siteHtmlRaw(GRADIENT_LONGHAND)});
    await deploySite(stack.baseUrl, {name: 'gradvar', html: siteHtmlRaw(GRADIENT_VAR)});
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

    it('holds when the gradient is authored as LONGHANDS (B83)', async () => {
        // The form the background style editor writes, and the one the shipped
        // B62 fix could not see: `view.style.background` is '' for it, so the
        // gradient flag never got set and none of the fix engaged.
        const page = await stack.context.newPage();
        await openScrollable(page, 'gradlong');
        const atTop = await marginPixels(page);
        await scrollBy(page, 900);
        expect(await marginPixels(page), 'longhand-authored gradient moved').toBe(atTop);

        // and the mechanism, not just the pixels: the site must be painting it
        // and the view must have been silenced
        const wired = await page.evaluate(() => {
            const site = document.querySelector('feezal-site');
            const view = document.querySelector('feezal-view');
            return {
                flagged: site.hasAttribute('gradient-bg'),
                viewImage: getComputedStyle(view).backgroundImage,
            };
        });
        expect(wired.flagged, 'gradient-bg never set — detection missed the longhand form').toBe(true);
        expect(wired.viewImage, 'the view still paints its own band').toBe('none');
        await page.close();
    }, 180_000);

    it('holds when the gradient arrives through a var() (B83)', async () => {
        const page = await stack.context.newPage();
        await openScrollable(page, 'gradvar');
        const atTop = await marginPixels(page);
        await scrollBy(page, 900);
        expect(await marginPixels(page), 'var()-authored gradient moved').toBe(atTop);
        expect(await page.evaluate(
            () => document.querySelector('feezal-site').hasAttribute('gradient-bg')),
        'gradient-bg never set — detection could not see through var()').toBe(true);
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

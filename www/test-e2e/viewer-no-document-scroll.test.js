/**
 * E2E: B120 — the viewer document must never scroll.
 *
 * Reported on an installed iOS PWA: a view SHORTER than the screen could be
 * scrolled down, revealing a grey and a white bar below the content, and the
 * layout-app top bar scrolled away with it. Both are one cause seen from two
 * sides — the DOCUMENT was scrollable, so it carried the whole app with it and
 * exposed layers nothing had painted.
 *
 * The real thing needs an iOS device (`height: 100%` only exceeds the visual
 * viewport under standalone display + viewport-fit=cover). What IS checkable
 * everywhere is the invariant the fix establishes and the one it must not
 * break: the document never scrolls, and a tall view still scrolls INSIDE
 * feezal-site.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite} from './harness.js';

const el = (label, top) =>
    `<feezal-element-basic-number label="${label}" ` +
    `style="position:absolute;left:20px;top:${top}px;width:120px;height:40px;"></feezal-element-basic-number>`;

// A view SHORTER than any viewport we test with — the reported case.
const SHORT = 'shortview';
const SHORT_HTML =
    '<feezal-site><feezal-view name="main" style="width:320px;height:200px;">' +
    el('a', 20) + '</feezal-view></feezal-site>';

// …and one comfortably taller, which must still scroll.
const TALL = 'tallview';
const TALL_HTML =
    '<feezal-site><feezal-view name="main" style="width:320px;height:3000px;">' +
    el('a', 20) + el('b', 2800) + '</feezal-view></feezal-site>';

let stack, page;

beforeAll(async () => {
    stack = await startStack();
    page = stack.page;
    await deploySite(stack.baseUrl, {name: SHORT, html: SHORT_HTML});
    await deploySite(stack.baseUrl, {name: TALL, html: TALL_HTML});
}, 90_000);

afterAll(async () => { await stopStack(stack); });

async function openViewer(site, viewport) {
    await page.setViewportSize(viewport);
    await page.goto(`${stack.baseUrl}/viewer/${site}/`);
    await page.waitForSelector('feezal-element-basic-number', {timeout: 60_000});
    await page.waitForTimeout(150);
}

const documentScroll = () => page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    innerHeight: window.innerHeight,
    bodyScrollHeight: document.body.scrollHeight,
}));

describe('B120 — a short view leaves nothing to scroll', () => {
    // Both orientations, since the report named phone-shaped viewports.
    for (const [name, viewport] of [
        ['portrait', {width: 390, height: 844}],
        ['landscape', {width: 844, height: 390}],
    ]) {
        it(`document is exactly the viewport in ${name}`, async () => {
            await openViewer(SHORT, viewport);
            const m = await documentScroll();
            expect(m.scrollHeight).toBeLessThanOrEqual(m.innerHeight);
            expect(m.bodyScrollHeight).toBeLessThanOrEqual(m.innerHeight);
        });
    }

    /**
     * The iOS metrics themselves cannot be reproduced here — on this platform
     * `height: 100%` already equals the visual viewport, so nothing overflows
     * and a broken shell looks identical to a fixed one. What CAN be
     * reproduced is the condition those metrics create: a document taller than
     * the visible area. The fix's job is to make that harmless, and that is
     * what this asserts. (Verified: with the pre-fix shell CSS this fails.)
     */
    it('stays put under a scroll GESTURE, even when the document is taller than the screen', async () => {
        await openViewer(SHORT, {width: 390, height: 844});
        // A gesture, not scrollTo(): `overflow: hidden` deliberately still
        // permits programmatic scrolling, so scrollTo() would move the page
        // even with the fix in place and prove nothing. What the report
        // describes — and what the fix stops — is the page moving under the
        // user's finger.
        await page.evaluate(() => {
            document.body.style.minHeight = (window.innerHeight + 400) + 'px';
        });
        await page.mouse.move(195, 400);
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(120);
        const moved = await page.evaluate(() => {
            const y = window.scrollY;
            document.body.style.minHeight = '';
            return y;
        });
        expect(moved).toBe(0);
    });

    it('declares the visible height, not the initial containing block', async () => {
        // 100dvh / -webkit-fill-available are what differ on iOS standalone;
        // desktop resolves them the same as 100%, so the declaration itself is
        // the only observable part here.
        await openViewer(SHORT, {width: 390, height: 844});
        const declared = await page.evaluate(() =>
            [...document.styleSheets]
                .flatMap(sheet => { try { return [...sheet.cssRules]; } catch { return []; } })
                .filter(rule => rule.selectorText === 'html, body')
                .map(rule => rule.style.cssText).join(' '));
        expect(declared).toContain('overflow: hidden');
        expect(declared).toContain('overscroll-behavior: none');
        expect(declared).toMatch(/100dvh|fill-available/);
    });

    it('keeps the app filling the screen, so nothing unpainted shows below', async () => {
        await openViewer(SHORT, {width: 390, height: 844});
        const app = await page.evaluate(() => {
            const r = document.querySelector('feezal-app-viewer').getBoundingClientRect();
            return {height: Math.round(r.height), inner: window.innerHeight};
        });
        // The grey/white bars were the gap between the app and the document.
        expect(app.height).toBeGreaterThanOrEqual(app.inner - 1);
    });
});

describe('B120 — a tall view still scrolls, inside the site', () => {
    it('scrolls feezal-site rather than the document', async () => {
        await openViewer(TALL, {width: 390, height: 844});
        const before = await documentScroll();
        expect(before.scrollHeight).toBeLessThanOrEqual(before.innerHeight);

        const scrolled = await page.evaluate(() => {
            const site = document.querySelector('feezal-site');
            site.scrollTop = 400;
            return {siteTop: site.scrollTop, windowY: window.scrollY};
        });
        expect(scrolled.siteTop).toBeGreaterThan(0);   // the content moved…
        expect(scrolled.windowY).toBe(0);              // …and the page did not
    });

    it('can reach the far end of the content', async () => {
        await openViewer(TALL, {width: 390, height: 844});
        const reached = await page.evaluate(() => {
            const site = document.querySelector('feezal-site');
            site.scrollTop = site.scrollHeight;
            const far = document.querySelector('[label="b"]').getBoundingClientRect();
            return {top: far.top, inner: window.innerHeight};
        });
        // The last element is on screen once scrolled to the bottom.
        expect(reached.top).toBeLessThan(reached.inner);
    });
});

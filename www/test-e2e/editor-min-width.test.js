/**
 * E2E: U100 — the editor has a width floor instead of a degraded narrow layout.
 *
 * Below roughly 1484px the layout broke (the sidebar tab items misbehaving), so
 * the editor now declares that width as its minimum and lets the WINDOW scroll
 * horizontally instead. The floor alone was not enough: #container is absolutely
 * positioned at width:100%, and with an unpositioned host its containing block
 * was the viewport — so the right sidebar kept hugging the viewport edge and
 * scrolling right revealed empty space past it.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite} from './harness.js';

const SITE = 'minwidth';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-basic-number label="a" style="position:absolute;left:20px;top:20px;' +
    'width:100px;height:50px;"></feezal-element-basic-number>' +
    '</feezal-view></feezal-site>';

/** The declared floor. Kept here so a change to it fails loudly, not silently. */
const FLOOR = 1484;
const NARROW = 1100;

let stack, page;

beforeAll(async () => {
    stack = await startStack();
    page = stack.page;
    await deploySite(stack.baseUrl, {name: SITE, html: SITE_HTML});
    await page.setViewportSize({width: NARROW, height: 800});
    await page.goto(`${stack.baseUrl}/editor/?/${SITE}/`);
    await page.waitForSelector('feezal-palette .element', {timeout: 60_000});
}, 90_000);

afterAll(async () => { await stopStack(stack); });

const metrics = () => page.evaluate(() => {
    const app = document.querySelector('feezal-app-editor');
    const root = app.shadowRoot;
    const rect = el => {
        const r = el.getBoundingClientRect();
        return {left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width)};
    };
    const sidebar = root.querySelector('#sidebar-panels');
    return {
        editor: rect(app),
        container: rect(root.querySelector('#container')),
        sidebar: sidebar && getComputedStyle(sidebar).display !== 'none' ? rect(sidebar) : null,
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollX: window.scrollX,
    };
});

describe('U100 — width floor', () => {
    it('keeps its layout width below the floor and lets the window scroll', async () => {
        const m = await metrics();
        expect(m.viewportWidth).toBeLessThan(FLOOR);      // the premise
        expect(m.editor.width).toBe(FLOOR);               // …and the editor refuses to shrink
        expect(m.scrollWidth).toBeGreaterThanOrEqual(FLOOR);
        expect(m.scrollWidth).toBeGreaterThan(m.clientWidth);   // a real horizontal scrollbar
    });

    it('lays the body chrome out against the EDITOR width, not the viewport', async () => {
        // The regression this guards: #container resolved its width:100% against
        // the viewport, so it was NARROW.width wide while the editor was FLOOR.
        const m = await metrics();
        expect(m.container.width).toBe(m.editor.width);
        expect(m.container.right).toBe(m.editor.right);
    });

    it('puts the right sidebar flush at the editor edge, with nothing past it', async () => {
        const m = await metrics();
        expect(m.sidebar).not.toBeNull();
        expect(m.sidebar.right).toBe(m.editor.right);
    });

    it('scrolls the sidebar into view instead of pinning it to the viewport', async () => {
        const before = await metrics();
        await page.evaluate(() => window.scrollTo(9999, 0));
        const after = await metrics();

        expect(after.scrollX).toBeGreaterThan(0);
        // Pinned-to-viewport would mean the sidebar never moves on screen.
        expect(after.sidebar.left).toBe(before.sidebar.left - after.scrollX);
        // Scrolled fully right, the editor's right edge IS the viewport's — no
        // empty space beyond the sidebar.
        expect(after.editor.right).toBe(after.viewportWidth);
        expect(after.sidebar.right).toBe(after.viewportWidth);
        await page.evaluate(() => window.scrollTo(0, 0));
    });

    it('is inert at widths above the floor', async () => {
        await page.setViewportSize({width: 1600, height: 900});
        const m = await metrics();
        expect(m.editor.width).toBe(m.viewportWidth);       // fills, does not overflow
        expect(m.scrollWidth).toBe(m.clientWidth);          // no horizontal scrollbar
        expect(m.sidebar.right).toBe(m.editor.right);
        await page.setViewportSize({width: NARROW, height: 800});
    });
});

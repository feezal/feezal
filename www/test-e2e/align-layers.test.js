/**
 * U83 + U87 + U88 in the real editor: the align/distribute context submenu
 * moving real elements with one undo step, the Layers panel mirroring the
 * canvas both ways, and the MQTT panel showing a selected element's wiring.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite} from './harness.js';

const SITE = 'alignlayers';
const at = (label, left, top, w = 100, h = 50) =>
    `<feezal-element-basic-number label="${label}" ` +
    `style="position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;"></feezal-element-basic-number>`;

const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    at('a', 10, 20) + at('b', 200, 90) + at('c', 400, 200) +
    '</feezal-view></feezal-site>';

let stack, page;

beforeAll(async () => {
    stack = await startStack();
    page = stack.page;
    await deploySite(stack.baseUrl, {name: SITE, html: SITE_HTML});
    await page.goto(`${stack.baseUrl}/editor/?/${SITE}/`);
    await page.waitForSelector('feezal-palette .element', {timeout: 60_000});
}, 60_000);

afterAll(async () => { await stopStack(stack); });

const el = label => page.locator(`feezal-site > feezal-view feezal-element-basic-number[label="${label}"]`);
const leftOf = label => el(label).evaluate(e => Math.round(e.offsetLeft));
const topOf = label => el(label).evaluate(e => Math.round(e.offsetTop));
const inspector = () => page.locator('feezal-app-editor feezal-sidebar-inspector');

/** Select elements by label through the real inspector API. */
const select = labels => page.evaluate(ls => {
    const view = window.feezal.view;
    const els = ls.map(l => view.querySelector(`[label="${l}"]`));
    window.feezal.app.shadowRoot.querySelector('feezal-sidebar-inspector').selectElement(els);
}, labels);

/** Open the canvas context menu on an element and pick an align entry. */
async function alignVia(label, entry) {
    await el(label).click({button: 'right'});
    const menu = inspector().locator('.ctx-item', {hasText: 'Align & distribute'});
    await menu.hover();
    await inspector().locator('.align-sub .ctx-item', {hasText: entry}).first().click();
}

describe('U83 — align & distribute', () => {
    it('aligns a multi-selection to the selection bounds in one undo step', async () => {
        await select(['a', 'b', 'c']);
        await alignVia('b', 'Align left');

        await expect.poll(() => leftOf('b')).toBe(10);
        await expect.poll(() => leftOf('c')).toBe(10);
        expect(await leftOf('a')).toBe(10);         // already there

        // ONE snapshot for the whole operation: a single undo restores all
        await page.evaluate(() => document.querySelector('feezal-site')?.focus());
        await page.keyboard.press('Control+z');
        await expect.poll(() => leftOf('b')).toBe(200);
        expect(await leftOf('c')).toBe(400);
    });

    it('distributes three elements to equal gaps', async () => {
        await select(['a', 'b', 'c']);
        await alignVia('b', 'Distribute horizontally');
        // a: 10..110, c: 400..500 → span 490, sizes 300, gap 95 → b at 205
        await expect.poll(() => leftOf('b')).toBe(205);
        expect(await leftOf('a')).toBe(10);
        expect(await leftOf('c')).toBe(400);
    });

    it('match size takes the first selected element as the reference', async () => {
        await page.evaluate(() => {
            const v = window.feezal.view;
            v.querySelector('[label="b"]').style.width = '60px';
        });
        await select(['a', 'b']);
        await alignVia('a', 'Match width');
        await expect.poll(() => el('b').evaluate(e => Math.round(e.offsetWidth))).toBe(100);
    });

    it('the submenu is not offered for a single element', async () => {
        await select(['a']);
        await el('a').click({button: 'right'});
        expect(await inspector().locator('.ctx-item', {hasText: 'Align & distribute'}).count()).toBe(0);
        await page.keyboard.press('Escape');
    });
});

describe('U87 — layers panel', () => {
    const layers = () => inspector().locator('feezal-sidebar-layers');
    const openLayers = async () => {
        await inspector().locator('sl-tab[panel="layers"]').click();
        await expect.poll(() => layers().locator('li').count()).toBeGreaterThan(0);
    };

    it('lists the view elements top-most first', async () => {
        await openLayers();
        const labels = await layers().locator('li .label').allTextContents();
        expect(labels.map(t => t.trim())).toEqual(['c', 'b', 'a']);
    });

    it('clicking a row selects that element on the canvas', async () => {
        await openLayers();
        await layers().locator('li', {hasText: 'a'}).first().click();
        await expect.poll(() => el('a').evaluate(e => e.classList.contains('feezal-selected'))).toBe(true);
    });

    it('the canvas selection is mirrored back into the list', async () => {
        await select(['b']);
        await openLayers();
        const selectedLabels = await layers().locator('li.selected .label').allTextContents();
        expect(selectedLabels.map(t => t.trim())).toEqual(['b']);
    });

    it('the lock toggle locks the element and survives a re-render', async () => {
        await openLayers();
        await layers().locator('li', {hasText: 'a'}).first().locator('.lock').click();
        await expect.poll(() => el('a').evaluate(e => e.hasAttribute('locked'))).toBe(true);
        await layers().locator('li', {hasText: 'a'}).first().locator('.lock').click();
        await expect.poll(() => el('a').evaluate(e => e.hasAttribute('locked'))).toBe(false);
    });

    it('tracks an element added to the view', async () => {
        await openLayers();
        const before = await layers().locator('li').count();
        await page.evaluate(() => {
            const e = document.createElement('feezal-element-basic-number');
            e.setAttribute('label', 'added');
            e.style.cssText = 'position:absolute;left:600px;top:20px;width:80px;height:40px;';
            window.feezal.view.append(e);
            window.feezal.editor.initElem(e, true);
        });
        await expect.poll(() => layers().locator('li').count()).toBe(before + 1);
        const labels = await layers().locator('li .label').allTextContents();
        expect(labels[0].trim()).toBe('added');     // newest is top-most
    });
});

describe('U88 — MQTT panel', () => {
    it('appears for a single element and lists what it subscribes to', async () => {
        await page.evaluate(() => {
            window.feezal.view.querySelector('[label="a"]').setAttribute('subscribe', 'debug/topic');
        });
        await select(['a']);
        const tab = inspector().locator('sl-tab[panel="debug"]');
        await expect.poll(() => tab.count()).toBe(1);
        await tab.click();
        const panel = inspector().locator('feezal-sidebar-debug');
        await expect.poll(() => panel.locator('h4').first().textContent()).toContain('Subscribes');
    });

    it('is hidden for a multi-selection', async () => {
        await select(['a', 'b']);
        await expect.poll(() => inspector().locator('sl-tab[panel="debug"]').count()).toBe(0);
    });
});

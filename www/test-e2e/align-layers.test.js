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

describe('U87 — layers panel (own sidebar tab)', () => {
    const layers = () => page.locator('feezal-app-editor feezal-sidebar-layers');
    const openLayers = async () => {
        await page.locator('feezal-app-editor .icon-btn[title^="Layers"]').click();
        await expect.poll(() => layers().locator('li').count()).toBeGreaterThan(0);
    };
    const filter = async text => {
        const input = layers().locator('.search input');
        await input.fill(text);
    };

    it('has its own sidebar tab, next to the inspector', async () => {
        await openLayers();
        await expect.poll(() => layers().isVisible()).toBe(true);
        // the inspector panel is hidden while Layers is showing
        await expect.poll(() => inspector().isVisible()).toBe(false);
    });

    it('lists the view as a node with its elements in canvas (DOM) order', async () => {
        await openLayers();
        const views = await layers().locator('.view-row .view-name').allTextContents();
        expect(views.map(t => t.trim())).toEqual(['main']);
        const labels = await layers().locator('li .label').allTextContents();
        expect(labels.map(t => t.trim())).toEqual(['a', 'b', 'c']);
    });

    it('clicking a row selects that element on the canvas', async () => {
        await openLayers();
        await layers().locator('li', {hasText: 'a'}).first().click();
        await expect.poll(() => el('a').evaluate(e => e.classList.contains('feezal-selected'))).toBe(true);
    });

    it('selecting from the tree KEEPS the sidebar on Layers', async () => {
        await openLayers();
        await layers().locator('li', {hasText: 'b'}).first().click();
        await expect.poll(() => el('b').evaluate(e => e.classList.contains('feezal-selected'))).toBe(true);
        // the panel must not swap out from under the user mid-task
        await expect.poll(() => page.evaluate(() =>
            document.querySelector('feezal-app-editor').sidebar)).toBe('layers');
        await expect.poll(() => layers().isVisible()).toBe(true);
    });

    it('selecting on the CANVAS does not move the sidebar either', async () => {
        // Selection is how you point at things, not a request to go somewhere:
        // whichever panel the user is in stays put. Only ADDING an element
        // (palette / asset drop) jumps to the Inspector.
        await openLayers();
        await el('c').click();
        await expect.poll(() => page.evaluate(() =>
            document.querySelector('feezal-app-editor').sidebar)).toBe('layers');
    });

    it('the canvas selection is mirrored back into the list', async () => {
        await select(['b']);
        await openLayers();
        await expect.poll(async () =>
            (await layers().locator('li.selected .label').allTextContents()).map(t => t.trim())
        ).toEqual(['b']);
    });

    it('the fuzzy filter narrows by label and by topic', async () => {
        await openLayers();
        // give one element a distinctive label + topic (all three share the
        // basic-number TYPE, so a one-letter query legitimately matches all)
        await page.evaluate(() => {
            const e = window.feezal.view.querySelector('[label="b"]');
            e.setAttribute('label', 'Kitchen lamp');
            e.setAttribute('subscribe', 'home/kitchen/lamp');
        });

        await filter('lamp');
        await expect.poll(async () =>
            (await layers().locator('li .label').allTextContents()).map(t => t.trim())
        ).toEqual(['Kitchen lamp']);

        await filter('home/kitchen');            // topic match
        await expect.poll(() => layers().locator('li').count()).toBe(1);

        await filter('zzzz');                    // no match at all
        await expect.poll(() => layers().locator('li').count()).toBe(0);

        await filter('');
        await expect.poll(() => layers().locator('li').count()).toBe(3);

        // restore the shared fixture — later tests address this element by label
        await page.evaluate(() => {
            const e = window.feezal.view.querySelector('[label="Kitchen lamp"]');
            e.setAttribute('label', 'b');
            e.removeAttribute('subscribe');
        });
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
        // The tree runs in DOM order, so an appended element lands LAST —
        // it is still the top-most one on the canvas (U33: paint order is DOM
        // order), the list just no longer reads back-to-front.
        expect(labels.at(-1).trim()).toBe('added');
    });
});

describe('U88 — MQTT panel', () => {
    // the Layers block above left its own sidebar tab active
    const openInspector = () => page.locator('feezal-app-editor .icon-btn[title="Inspector"]').click();

    it('appears for a single element and lists what it subscribes to', async () => {
        await openInspector();
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

    /**
     * U95 — selecting the VIEW keeps both tabs: a view runs the conditions
     * engine and can carry a subscribe-theme topic, so it has wiring of its
     * own to show. (Before U95 the tabs vanished here; the fall-back rule is
     * still exercised by the multi-selection case below, which is the shape
     * that would otherwise leave sl-tab-group pointing at a missing panel.)
     */
    it('stays on the MQTT tab when the selection becomes a view', async () => {
        await openInspector();
        await select(['a']);
        await inspector().locator('sl-tab[panel="debug"]').click();
        await expect.poll(() => inspector().locator('feezal-sidebar-debug').isVisible()).toBe(true);

        await page.evaluate(() => {
            window.feezal.app.shadowRoot.querySelector('feezal-sidebar-inspector').selectElement();
        });
        await expect.poll(() => inspector().locator('sl-tab[panel="debug"]').count()).toBe(1);
        await expect.poll(() => inspector().locator('sl-tab[panel="conditions"]').count()).toBe(1);
        await expect.poll(() => page.evaluate(() =>
            window.feezal.app.shadowRoot.querySelector('feezal-sidebar-inspector')._activeTab
        )).toBe('debug');
        // and it reports on the VIEW, not the element that was selected before
        await expect.poll(() => inspector().locator('feezal-sidebar-debug .note, feezal-sidebar-debug .topic')
            .first().textContent()).toContain('view');
    });

    it('falls back to Attributes from the MQTT tab on a multi-selection too', async () => {
        await openInspector();
        await select(['a']);
        await inspector().locator('sl-tab[panel="debug"]').click();
        await expect.poll(() => inspector().locator('feezal-sidebar-debug').isVisible()).toBe(true);

        await select(['a', 'b']);
        await expect.poll(() =>
            inspector().locator('feezal-sidebar-inspector-attributes').isVisible()).toBe(true);
    });
});

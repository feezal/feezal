/**
 * E2E: selection + clipboard + context menu (A17 candidate) — real editor:
 * rubber-band multi-select, Ctrl+click toggling, copy/paste with the +25px
 * offset, Ctrl+D duplicate, Delete, and context-menu lock/unlock (locked
 * elements can't be dragged).
 *
 * Sequential; shares one editor page.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite, mouseDrag, centerOf} from './harness.js';

const SITE = 'sel';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-material-button label="A" style="position:absolute;top:100px;left:100px;width:120px;height:40px;"></feezal-element-material-button>' +
    '<feezal-element-material-button label="B" style="position:absolute;top:100px;left:320px;width:120px;height:40px;"></feezal-element-material-button>' +
    '</feezal-view></feezal-site>';

let stack;
let page;

beforeAll(async () => {
    stack = await startStack();
    page = stack.page;
    await deploySite(stack.baseUrl, {name: SITE, html: SITE_HTML});
    await page.goto(`${stack.baseUrl}/editor/?/${SITE}/`);
    await page.waitForSelector('feezal-palette .element', {timeout: 60_000});
}, 60_000);

afterAll(async () => {
    await stopStack(stack);
});

const buttons = () => page.locator('feezal-site > feezal-view feezal-element-material-button');
const btn = label => page.locator(`feezal-site > feezal-view feezal-element-material-button[label="${label}"]`);
const selectedCount = () => page.locator('feezal-site .feezal-selected').count();

describe('selection', () => {
    it('rubber-band drag on empty canvas selects the covered elements', async () => {
        const a = await btn('A').boundingBox();
        const b = await btn('B').boundingBox();
        // drag a rectangle over both, starting on empty canvas below them
        await mouseDrag(page,
            {x: a.x - 40, y: a.y + 120},
            {x: b.x + b.width + 40, y: a.y - 30},
            16);

        await expect.poll(selectedCount).toBe(2);
    });

    it('Ctrl+click toggles single elements in and out of the selection', async () => {
        await btn('A').click();                       // plain click: only A
        await expect.poll(selectedCount).toBe(1);

        await btn('B').click({modifiers: ['Control']});
        await expect.poll(selectedCount).toBe(2);

        await btn('B').click({modifiers: ['Control']});
        await expect.poll(selectedCount).toBe(1);
        expect(await btn('A').evaluate(el => el.classList.contains('feezal-selected'))).toBe(true);
    });

    it('clicking empty canvas selects the view itself', async () => {
        const view = await page.locator('feezal-site > feezal-view').first().boundingBox();
        await page.mouse.click(view.x + view.width - 30, view.y + view.height - 30);
        await expect.poll(() => page.locator('feezal-sidebar-inspector')
            .evaluate(insp => insp.viewSelected)).toBe(true);
    });
});

describe('clipboard', () => {
    it('copy + paste clones the element with a +25px offset', async () => {
        await btn('A').click();
        await page.keyboard.press('Control+c');
        await page.keyboard.press('Control+v');

        await expect.poll(() => buttons().count()).toBe(3);
        const positions = await buttons().evaluateAll(els =>
            els.map(el => ({left: Number.parseFloat(el.style.left), top: Number.parseFloat(el.style.top)})));
        expect(positions).toContainEqual({left: 125, top: 125});
    });

    it('Ctrl+D duplicates the selection', async () => {
        await btn('B').click();
        await page.keyboard.press('Control+d');
        await expect.poll(() => buttons().count()).toBe(4);
    });

    it('Delete removes the selected elements', async () => {
        // the duplicate is selected after Ctrl+D
        await page.keyboard.press('Delete');
        await expect.poll(() => buttons().count()).toBe(3);

        // multi-delete: select the paste clone + B, delete both
        await buttons().nth(2).click();
        await btn('B').click({modifiers: ['Control']});
        await page.keyboard.press('Delete');
        await expect.poll(() => buttons().count()).toBe(1);
    });
});

describe('context menu lock', () => {
    it('lock via context menu sets [locked] and blocks dragging', async () => {
        await btn('A').click({button: 'right'});
        const lockItem = page.locator('feezal-sidebar-inspector .ctx-menu .ctx-item', {hasText: 'Lock'});
        await lockItem.click();

        await expect.poll(() => btn('A').evaluate(el => el.hasAttribute('locked'))).toBe(true);

        const before = await btn('A').evaluate(el => el.style.left);
        const box = await btn('A').boundingBox();
        await mouseDrag(page, centerOf(box), {x: box.x + 150, y: box.y + 80});
        expect(await btn('A').evaluate(el => el.style.left)).toBe(before);
    });

    it('unlock re-enables dragging', async () => {
        await btn('A').click({button: 'right'});
        await page.locator('feezal-sidebar-inspector .ctx-menu .ctx-item', {hasText: 'Unlock'}).click();
        await expect.poll(() => btn('A').evaluate(el => el.hasAttribute('locked'))).toBe(false);

        const before = await btn('A').evaluate(el => Number.parseFloat(el.style.left));
        const box = await btn('A').boundingBox();
        await mouseDrag(page, centerOf(box), {x: box.x + 120, y: box.y + 60});
        await expect.poll(() => btn('A').evaluate(el => Number.parseFloat(el.style.left)))
            .toBeGreaterThan(before);
    });
});

describe('resize grip affordance (U42)', () => {
    it('a selected element shows the corner grip on hover; unselected does not', async () => {
        // Earlier tests in this sequential file cloned/deleted buttons — pick
        // whatever element is first on the canvas rather than a label.
        const el = page.locator('feezal-view[name="main"] feezal-element-material-button').first();
        await el.click();
        await el.hover();
        const grip = await el.evaluate(e => getComputedStyle(e, '::before').backgroundImage);
        expect(grip).toContain('linear-gradient');

        // Deselect (click empty canvas) → hovering shows no grip anymore.
        await page.locator('feezal-view[name="main"]').click({position: {x: 600, y: 500}});
        await el.hover();
        const after = await el.evaluate(e => getComputedStyle(e, '::before').backgroundImage);
        expect(after).toBe('none');
    });
});

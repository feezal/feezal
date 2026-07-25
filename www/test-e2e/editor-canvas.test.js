/**
 * E2E editor canvas operations — the parts of the editor that only exist as
 * real pointer/keyboard work against a real layout, and so are unreachable
 * from the unit and component suites:
 *
 *   - dropping an element from the palette onto the canvas (creation + the
 *     B20 snap-on-drop)
 *   - resizing by handle, including snapped resize
 *   - the snapping modes and their live modifier overrides during a drag
 *   - locking an element out of drag/resize
 *   - the toolbar clipboard buttons (a different path than the shortcuts,
 *     which editor-selection.test.js already covers)
 *   - moving an element to another view via the context menu
 *   - the grid settings actually changing the canvas
 *
 * Complements editor-flows (inspector, move/nudge/undo, source mode, views),
 * editor-selection (rubber band, Ctrl+click, keyboard clipboard) and stacking
 * (z-order) rather than repeating them.
 *
 * Tests are sequential and share one editor page; order matters.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite, mouseDrag, centerOf} from './harness.js';

const SITE = 'canvas';
const SITE_HTML =
    '<feezal-site>' +
    '<feezal-view name="main" style="width:1000px;height:700px;">' +
    '<feezal-element-basic-number style="position:absolute;top:120px;left:120px;width:120px;height:60px;"></feezal-element-basic-number>' +
    '</feezal-view>' +
    '<feezal-view name="second" style="width:1000px;height:700px;"></feezal-view>' +
    '</feezal-site>';

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

const canvasEls = sel => page.locator(`feezal-site > feezal-view[name="main"] ${sel}`);
const numberEl = () => canvasEls('feezal-element-basic-number').first();
const geom = loc => loc.evaluate(el => ({
    left: Number.parseFloat(el.style.left),
    top: Number.parseFloat(el.style.top),
    width: Number.parseFloat(el.style.width),
    height: Number.parseFloat(el.style.height),
}));
const setSnapping = mode => page.locator('feezal-app-editor')
    .evaluate((app, m) => { app.snapping = m; }, mode);

describe('palette → canvas', () => {
    it('dropping a palette element creates it where it was dropped', async () => {
        const before = await canvasEls('feezal-element-basic-icon').count();

        const tile = page.locator('feezal-palette .element[data-el="feezal-element-basic-icon"]')
            .first();
        await tile.scrollIntoViewIfNeeded();
        const from = centerOf(await tile.boundingBox());
        const view = await page.locator('feezal-site > feezal-view[name="main"]').boundingBox();
        const target = {x: view.x + 420, y: view.y + 330};
        await mouseDrag(page, from, target, 20);

        const icon = canvasEls('feezal-element-basic-icon').first();
        await icon.waitFor({timeout: 15_000});
        expect(await canvasEls('feezal-element-basic-icon').count()).toBe(before + 1);

        // Landed in the neighbourhood of the drop, not at the origin.
        const g = await geom(icon);
        expect(g.left).toBeGreaterThan(300);
        expect(g.top).toBeGreaterThan(220);
    });

    it('a freshly dropped element is already snapped — no re-drag needed (B20)', async () => {
        await setSnapping('grid');
        const gridSize = await page.locator('feezal-app-editor').evaluate(app => app.gridSize);
        const view = await page.locator('feezal-site > feezal-view[name="main"]').boundingBox();

        // Two drops a few px apart, well inside one grid step. Snapping means
        // they collapse onto the SAME position. (Asserting `left % gridSize`
        // would be wrong: interact.js snaps the pointer, so the element keeps
        // whatever grab offset the drag started with.)
        const drop = async x => {
            const tile = page.locator('feezal-palette .element[data-el="feezal-element-basic-icon"]').first();
            await tile.scrollIntoViewIfNeeded();
            const before = await canvasEls('feezal-element-basic-icon').count();
            await mouseDrag(page, centerOf(await tile.boundingBox()),
                {x: view.x + x, y: view.y + 437}, 20);
            await expect.poll(() => canvasEls('feezal-element-basic-icon').count(), {timeout: 15_000})
                .toBe(before + 1);
            return geom(canvasEls('feezal-element-basic-icon').last());
        };

        const a = await drop(600);
        const b = await drop(600 + Math.floor(gridSize / 3));
        expect(b.left).toBe(a.left);
    });
});

describe('resize', () => {
    it('dragging the corner handle resizes the element', async () => {
        await setSnapping('off');
        await numberEl().click();
        const before = await geom(numberEl());
        const box = await numberEl().boundingBox();

        // interact.js resize edges live on the element's bottom-right corner.
        const corner = {x: box.x + box.width - 2, y: box.y + box.height - 2};
        await mouseDrag(page, corner, {x: corner.x + 70, y: corner.y + 50}, 15);

        const after = await geom(numberEl());
        expect(after.width).toBeGreaterThan(before.width);
        expect(after.height).toBeGreaterThan(before.height);
    });

    // NOTE: no snapped-resize test here. Resize snapping runs through
    // interact.js snapSize, whose snap RANGE decides whether a given corner
    // position is pulled to a grid line — and that threshold could not be
    // pinned down without asserting a guess about interact.js internals.
    // Drag snapping IS covered below, where the behaviour is observable;
    // resizing itself is covered by the test above.
});

describe('snapping modes', () => {
    it('grid snapping collapses nearby drops onto the same position', async () => {
        const gridSize = await page.locator('feezal-app-editor').evaluate(app => app.gridSize);
        await setSnapping('grid');

        const dragBy = async dx => {
            const box = await numberEl().boundingBox();
            await mouseDrag(page, centerOf(box),
                {x: box.x + box.width / 2 + dx, y: box.y + box.height / 2}, 15);
            return (await geom(numberEl())).left;
        };

        const a = await dragBy(gridSize * 2);
        const b = await dragBy(Math.floor(gridSize / 4));   // a sub-step nudge
        expect(b).toBe(a);                                  // snapped back
    });

    it('snapping off leaves the element exactly where it was dropped', async () => {
        await setSnapping('off');
        const before = await geom(numberEl());
        const box = await numberEl().boundingBox();
        await mouseDrag(page, centerOf(box), {x: box.x + box.width / 2 + 37, y: box.y + box.height / 2 + 23}, 15);

        const after = await geom(numberEl());
        expect(after.left).toBeCloseTo(before.left + 37, 0);
        expect(after.top).toBeCloseTo(before.top + 23, 0);
    });

    it('holding Ctrl during a drag turns configured snapping off', async () => {
        await setSnapping('grid');
        const gridSize = await page.locator('feezal-app-editor').evaluate(app => app.gridSize);
        const before = await geom(numberEl());
        const box = await numberEl().boundingBox();

        await page.keyboard.down('Control');
        await mouseDrag(page, centerOf(box), {x: box.x + box.width / 2 + 33, y: box.y + box.height / 2 + 17}, 15);
        await page.keyboard.up('Control');

        const after = await geom(numberEl());
        // Ctrl → 'off': an off-grid landing that grid snapping would have eaten.
        expect((after.left - before.left) % gridSize === 0 && (after.top - before.top) % gridSize === 0)
            .toBe(false);
    });
});

describe('locking', () => {
    it('a locked element cannot be dragged, and unlocking restores it', async () => {
        await setSnapping('off');
        await numberEl().click();
        await page.locator('feezal-sidebar-inspector').evaluate(insp => insp._ctxAction('lock'));
        await expect.poll(() => numberEl().evaluate(el => el.hasAttribute('locked'))).toBe(true);

        const before = await geom(numberEl());
        const box = await numberEl().boundingBox();
        await mouseDrag(page, centerOf(box), {x: box.x + 90, y: box.y + 60}, 12);
        expect(await geom(numberEl())).toEqual(before);          // did not move

        await numberEl().click();
        await page.locator('feezal-sidebar-inspector').evaluate(insp => insp._ctxAction('lock'));
        await expect.poll(() => numberEl().evaluate(el => el.hasAttribute('locked'))).toBe(false);

        const box2 = await numberEl().boundingBox();
        await mouseDrag(page, centerOf(box2), {x: box2.x + 90, y: box2.y + 60}, 12);
        expect((await geom(numberEl())).left).not.toBe(before.left);
    });
});

describe('toolbar', () => {
    // Only Delete: Copy/Cut/Paste delegate to document.execCommand(), which
    // needs a trusted clipboard gesture and is not reachable headless. The
    // real copy/cut/paste events are covered by editor-selection.test.js.
    it('the delete button removes the selection', async () => {
        await numberEl().click();
        const before = await canvasEls('feezal-element-basic-number').count();
        await page.locator('button[title^="Delete"]').click();
        await expect.poll(() => canvasEls('feezal-element-basic-number').count(), {timeout: 10_000})
            .toBe(before - 1);
    });
});

describe('keyboard shortcuts dialog', () => {
    it('opens from the toolbar and closes on Escape', async () => {
        const open = () => page.locator('feezal-sidebar-inspector')
            .evaluate(insp => insp._shortcutsOpen);
        await page.locator('button[title^="Keyboard shortcuts"]').click();
        // B43: the overlay lives in the inspector panel, and opening it reveals
        // that panel first — so the ? button works from any sidebar tab.
        await expect.poll(open, {timeout: 10_000}).toBe(true);
        expect(await page.locator('feezal-app-editor').evaluate(app => app.sidebar)).toBe('inspector');

        await page.keyboard.press('Escape');
        await expect.poll(open).toBe(false);
    });
});

describe('grid settings', () => {
    it('toggling the grid on and off shows and hides it', async () => {
        const gridVisible = () => page.locator('feezal-app-editor').evaluate(app => app.gridVisible);
        await page.locator('feezal-app-editor').evaluate(app => { app.gridVisible = true; });
        await expect.poll(gridVisible).toBe(true);
        await expect.poll(() => page.locator('#grid').count()).toBeGreaterThan(0);

        await page.locator('feezal-app-editor').evaluate(app => { app.gridVisible = false; });
        await expect.poll(gridVisible).toBe(false);
    });
});

describe('copy to another view', () => {
    it('the context-menu entry copies the element into the second view', async () => {
        await setSnapping('off');
        // Seed via the palette — the same path a user takes, and it leaves the
        // editor's bookkeeping consistent (a programmatic append does not).
        const tile = page.locator('feezal-palette .element[data-el="feezal-element-basic-icon"]').first();
        await tile.scrollIntoViewIfNeeded();
        const view = await page.locator('feezal-site > feezal-view[name="main"]').boundingBox();
        const before = await canvasEls('feezal-element-basic-icon').count();
        await mouseDrag(page, centerOf(await tile.boundingBox()),
            {x: view.x + 300, y: view.y + 200}, 20);
        await expect.poll(() => canvasEls('feezal-element-basic-icon').count(), {timeout: 15_000})
            .toBe(before + 1);

        const icon = canvasEls('feezal-element-basic-icon').last();
        await icon.click();
        await page.locator('feezal-sidebar-inspector').evaluate(insp => insp._ctxCopyToView('second', false));

        // The copy lands in the other view, and the original stays put.
        await expect.poll(() => page.locator(
            'feezal-site > feezal-view[name="second"] feezal-element-basic-icon').count(),
        {timeout: 10_000}).toBeGreaterThan(0);
        expect(await canvasEls('feezal-element-basic-icon').count()).toBe(before + 1);
    });
});

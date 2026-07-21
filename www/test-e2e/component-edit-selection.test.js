/**
 * B48 — selection inside component edit mode, incl. RE-ENTRY.
 *
 * The pseudo-view element is destroyed on commit and recreated on the next
 * edit under the same view name; the per-view-name DragSelect instance and
 * the per-node click/contextmenu listeners went stale, so the second edit
 * session had no click selection, no rubber-band and no context menu.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite, mouseDrag} from './harness.js';

const SITE = 'editsel';
const SITE_HTML =
    '<feezal-site>' +
    '<template feezal-component="card" feezal-params="{&quot;label&quot;:{&quot;type&quot;:&quot;string&quot;,&quot;default&quot;:&quot;L&quot;}}">' +
    '<feezal-element-material-button label="${label}" style="left:0px; top:0px; width:160px; height:40px;"></feezal-element-material-button>' +
    '</template>' +
    '<feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-component name="card" style="left:40px;top:40px;"></feezal-component>' +
    '</feezal-view></feezal-site>';

let stack, page;

beforeAll(async () => {
    stack = await startStack();
    page = stack.page;
    await deploySite(stack.baseUrl, {name: SITE, html: SITE_HTML});
    await page.goto(`${stack.baseUrl}/editor/?/${SITE}/`);
    await page.waitForSelector('feezal-palette .element', {timeout: 60_000});
}, 60_000);

afterAll(async () => {
    if (stack.pageErrors.length) console.error('PAGE ERRORS:', stack.pageErrors);
    await stopStack(stack);
});

const instance = () => page.locator('feezal-site feezal-component[name="card"]');
const editBtn = () => page.locator('feezal-view[feezal-component-edit] feezal-element-material-button');

async function enterEditMode() {
    await instance().click();
    await instance().click({button: 'right'});
    await page.locator('feezal-sidebar-inspector .ctx-item', {hasText: 'Edit component'}).click();
    await expect.poll(() => page.locator('#component-edit-banner').count()).toBe(1);
    await page.waitForTimeout(300);   // _viewChanged + DragSelect rAF settle
}

async function selectedTags() {
    return page.evaluate(() => feezal.editor.selectedElems.map(e => e.tagName));
}

async function probeSelection(label) {
    // Click selection.
    await editBtn().click();
    expect(await selectedTags(), `${label}: click`).toEqual(['FEEZAL-ELEMENT-MATERIAL-BUTTON']);

    // Context menu on the element.
    await editBtn().click({button: 'right'});
    await expect.poll(() => page.locator('feezal-sidebar-inspector .ctx-item').count(),
        {message: `${label}: context menu`}).toBeGreaterThan(0);
    await page.keyboard.press('Escape');

    // Rubber-band from empty canvas over the element (stay INSIDE the view).
    const view = page.locator('feezal-view[feezal-component-edit]');
    const box = await view.boundingBox();
    await mouseDrag(page, {x: box.x + 300, y: box.y + 200}, {x: box.x + 10, y: box.y + 10}, 16);
    await expect.poll(selectedTags, {message: `${label}: rubber-band`})
        .toEqual(['FEEZAL-ELEMENT-MATERIAL-BUTTON']);
}

describe('component edit mode selection (B48)', () => {
    it('first edit session: click, context menu and rubber-band work', async () => {
        await enterEditMode();
        await probeSelection('first session');
    }, 60_000);

    it('SECOND edit session after Done: everything still works (regression)', async () => {
        await page.locator('#component-edit-banner sl-button[variant="primary"]').click();
        await expect.poll(() => page.locator('#component-edit-banner').count()).toBe(0);

        await enterEditMode();
        // The recreated pseudo-view must be freshly wired: the DragSelect area
        // is the CURRENT node and the selection listeners are attached.
        const state = await page.evaluate(() => {
            const view = feezal.site.querySelector('feezal-view[feezal-component-edit]');
            const ds = feezal.editor.dragselect?.[feezal.editor.view];
            return {wired: Boolean(view?._feezalSelectionWired), areaCurrent: ds?.Area?.HTMLNode === view};
        });
        expect(state).toEqual({wired: true, areaCurrent: true});
        await probeSelection('second session');
    }, 60_000);
});

describe('component edit mode UX (U52)', () => {
    it('double-clicking an instance enters component edit mode', async () => {
        // Leave the current edit session first.
        await page.locator('#component-edit-banner sl-button[variant="primary"]').click();
        await expect.poll(() => page.locator('#component-edit-banner').count()).toBe(0);

        await instance().dblclick();
        await expect.poll(() => page.locator('#component-edit-banner').count()).toBe(1);
        expect(await page.locator('feezal-view[feezal-component-edit="card"]').count()).toBe(1);
    }, 60_000);

    it('the banner mapping dialog edits the param mapping; Done commits it', async () => {
        // Open the mapping table — the ${label} placeholder pre-fills its row.
        await page.locator('#component-edit-banner sl-button', {hasText: 'Attribute mapping'}).click();
        const dlg = page.locator('#componentmappingdialog');
        await expect.poll(() => dlg.evaluate(d => d.open)).toBe(true);
        const labelRowInput = dlg.locator('tr', {hasText: 'label'}).locator('input');
        await expect.poll(() => labelRowInput.inputValue()).toBe('label');

        // Rename the parameter label → title.
        await labelRowInput.fill('title');
        await dlg.locator('sl-button[variant="primary"]').click();
        await expect.poll(() => dlg.evaluate(d => d.open)).toBe(false);

        // The pseudo-view carries the new placeholder; the template is
        // untouched until Done (cancel-safety).
        const editBtnLabel = () => page.locator('feezal-view[feezal-component-edit] feezal-element-material-button')
            .getAttribute('label');
        await expect.poll(editBtnLabel).toBe('${title}');
        expect(await page.evaluate(() =>
            feezal.site.querySelector('template[feezal-component="card"]').getAttribute('feezal-params')))
            .toContain('"label"');

        // Done → template placeholder + params renamed, old param dropped.
        await page.locator('#component-edit-banner sl-button[variant="primary"]').click();
        await expect.poll(() => page.locator('#component-edit-banner').count()).toBe(0);
        const tpl = await page.evaluate(() => {
            const t = feezal.site.querySelector('template[feezal-component="card"]');
            return {params: t.getAttribute('feezal-params'), html: t.innerHTML};
        });
        expect(tpl.html).toContain('label="${title}"');
        expect(tpl.params).toContain('"title"');
        expect(tpl.params).not.toContain('"label"');
        // Instances re-stamped with the default under the new param.
        await expect.poll(() => instance().locator('feezal-element-material-button').getAttribute('label')).toBe('L');
    }, 60_000);
});

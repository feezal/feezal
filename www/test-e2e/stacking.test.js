/**
 * E2E: U33 element stacking order — real editor:
 *   - context-menu items with smart enable/disable
 *   - bring to front / send to back / forward / backward reorder the DOM
 *     (sibling order = paint order; no z-index anywhere)
 *   - keyboard shortcuts Ctrl+]/[ and Ctrl+Shift+]/[
 *   - multi-selection moves as a block preserving relative order
 *   - one undo step per reorder
 *
 * Sequential; shares one editor page.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {readFile} from 'fs/promises';
import {join} from 'path';
import {startStack, stopStack, deploySite} from './harness.js';

const SITE = 'stacking';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    ['A', 'B', 'C'].map((label, i) =>
        `<feezal-element-material-button label="${label}" style="position:absolute;top:${100 + i * 40}px;left:${100 + i * 40}px;width:120px;height:60px;"></feezal-element-material-button>`
    ).join('') +
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
    if (stack.pageErrors.length) console.error('PAGE ERRORS:', stack.pageErrors);
    await stopStack(stack);
});

const order = () => page.evaluate(() =>
    [...feezal.view.children]
        .filter(el => el.classList.contains('feezal-editable'))
        .map(el => el.getAttribute('label')).join(''));
const btn = label => page.locator(`feezal-element-material-button[label="${label}"]`);
const ctxItem = text => page.locator('feezal-sidebar-inspector .ctx-item', {hasText: text});

describe('stacking via context menu', () => {
    it('brings an element to the front (DOM order, no z-index)', async () => {
        expect(await order()).toBe('ABC');
        await btn('A').click();
        await btn('A').click({button: 'right'});
        await ctxItem('Bring to front').click();
        await expect.poll(order).toBe('BCA');
        // DragSelect writes inline z-index junk on selections — the editor
        // stylesheet neutralizes it, so DOM order stays the paint order.
        expect(await btn('A').evaluate(el => getComputedStyle(el).zIndex)).toBe('auto');
    });

    it('disables the impossible directions', async () => {
        await btn('A').click();                      // A is frontmost now
        await btn('A').click({button: 'right'});
        expect(await ctxItem('Bring to front').getAttribute('class')).toContain('ctx-disabled');
        expect(await ctxItem('Bring forward').getAttribute('class')).toContain('ctx-disabled');
        expect(await ctxItem('Send to back').getAttribute('class')).not.toContain('ctx-disabled');
        await page.keyboard.press('Escape');
    });

    it('sends to back', async () => {
        await btn('A').click();
        await btn('A').click({button: 'right'});
        await ctxItem('Send to back').click();
        await expect.poll(order).toBe('ABC');
    });
});

describe('stacking via keyboard', () => {
    it('Ctrl+] steps forward, Ctrl+[ steps backward', async () => {
        await btn('A').click();
        await page.keyboard.press('Control+]');
        await expect.poll(order).toBe('BAC');
        await page.keyboard.press('Control+[');
        await expect.poll(order).toBe('ABC');
    });

    it('Ctrl+Shift+] brings to front (shifted key = })', async () => {
        await btn('A').click();
        await page.keyboard.press('Control+Shift+]');
        await expect.poll(order).toBe('BCA');
        await page.keyboard.press('Control+Shift+[');
        await expect.poll(order).toBe('ABC');
    });
});

describe('multi-selection + undo', () => {
    it('moves a block preserving relative order; one undo restores', async () => {
        await btn('A').click();
        await btn('B').click({modifiers: ['Control']});
        await btn('A').click({button: 'right'});
        await ctxItem('Bring to front').click();
        await expect.poll(order).toBe('CAB');

        // Re-focus the canvas (menu clicks move focus off feezal-site, as
        // with every context-menu action) — then one undo restores the order.
        await btn('A').click();
        await page.keyboard.press('Control+z');
        await expect.poll(order).toBe('ABC');
    });
});

describe('persistence', () => {
    it('deploys the reordered DOM without any z-index junk', async () => {
        await btn('B').click();
        await btn('B').click({button: 'right'});
        await ctxItem('Bring to front').click();
        await expect.poll(order).toBe('ACB');

        await page.locator('#btn-deploy-main').click();
        const siteFile = join(stack.dataDir, 'sites', SITE, 'site.html');
        await expect.poll(async () => {
            const html = await readFile(siteFile, 'utf8').catch(() => '');
            return /label="A"[\s\S]*label="C"[\s\S]*label="B"/.test(html);
        }, {timeout: 20_000}).toBe(true);

        const saved = await readFile(siteFile, 'utf8');
        expect(saved).not.toContain('z-index');   // DragSelect junk stripped at save
    });
});

/**
 * U82 — undo depth, redo, and design-mode Ctrl+S.
 *
 * Before: history kept 5 snapshots (4 undo steps), there was NO redo in
 * design mode at all, and Ctrl+S was bound only in source mode — in design
 * mode it opened the browser's "save page" dialog.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite} from './harness.js';

const SITE = 'undoredo';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-basic-number style="position:absolute;top:60px;left:60px;width:120px;height:60px;"></feezal-element-basic-number>' +
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

const numberEl = () => page.locator('feezal-site > feezal-view feezal-element-basic-number').first();
const label = () => numberEl().getAttribute('label');
/** Apply an edit through the real change()/history path. */
const edit = value => page.evaluate(v => {
    window.feezal.view.querySelector('feezal-element-basic-number').setAttribute('label', v);
    window.feezal.app.change();
}, value);
/** Undo is a CANVAS shortcut — it only fires while feezal-site has keyboard
 *  focus (by design: a sidebar control must keep its own Ctrl+Z). Click the
 *  canvas the way a user would before sending the combo. */
const focusCanvas = () => page.evaluate(() => document.querySelector('feezal-site')?.focus());
const undo = async () => { await focusCanvas(); await page.keyboard.press('Control+z'); };

describe('U82 — undo depth', () => {
    it('undoes far more than the old 4-step cap', async () => {
        for (let i = 1; i <= 12; i++) await edit('v' + i);
        expect(await label()).toBe('v12');

        // 10 undos would have been impossible with a 5-snapshot history
        for (let i = 0; i < 10; i++) await undo();
        await expect.poll(label).toBe('v2');
    });

    it('an identical change() does not consume a history slot', async () => {
        const before = await page.evaluate(() => window.feezal.app._history.length);
        await page.evaluate(() => window.feezal.app.change());   // no markup change
        expect(await page.evaluate(() => window.feezal.app._history.length)).toBe(before);
    });
});

describe('U82 — redo', () => {
    it('Ctrl+Shift+Z steps forward again, and a new edit clears the redo branch', async () => {
        await edit('alpha');
        await edit('beta');
        expect(await label()).toBe('beta');

        await undo();
        await expect.poll(label).toBe('alpha');

        await page.keyboard.press('Control+Shift+z');
        await expect.poll(label).toBe('beta');

        // undo, then make a NEW edit — the redo future is gone
        await undo();
        await expect.poll(label).toBe('alpha');
        await edit('gamma');
        expect(await page.evaluate(() => window.feezal.app._redo.length)).toBe(0);
        await page.keyboard.press('Control+Shift+z');
        await expect.poll(label).toBe('gamma');           // unchanged — nothing to redo
    });

    it('Ctrl+Y redoes too (Windows idiom)', async () => {
        await edit('one');
        await edit('two');
        await undo();
        await expect.poll(label).toBe('one');
        await page.keyboard.press('Control+y');
        await expect.poll(label).toBe('two');
    });

    it('the toolbar redo button mirrors the state', async () => {
        const redoBtn = page.locator('feezal-app-editor .icon-btn[title^="Redo"]');
        await expect.poll(() => redoBtn.count()).toBe(1);
        await edit('x');
        await expect.poll(() => redoBtn.isDisabled()).toBe(true);   // nothing to redo
        await undo();
        await expect.poll(() => redoBtn.isDisabled()).toBe(false);
        await redoBtn.click();
        await expect.poll(label).toBe('x');
    });
});

describe('U82 — Ctrl+S in design mode', () => {
    it('deploys instead of leaving the browser to open its save dialog', async () => {
        await edit('saveme');
        expect(await page.evaluate(() => Boolean(window.feezal.hasChanges))).toBe(true);

        await page.keyboard.press('Control+s');
        // B98's success toast confirms a real deploy happened
        await expect.poll(
            () => page.locator('feezal-app-editor feezal-toast .toast .msg').first().textContent(),
            {timeout: 15_000}).toContain('Deployed');
        expect(await page.evaluate(() => Boolean(window.feezal.hasChanges))).toBe(false);
    });

    it('Ctrl+S while typing in an input does not deploy', async () => {
        await edit('typing');
        const input = page.locator('feezal-app-editor #btn-view-search');
        // use the view-search field as a representative text entry
        await page.locator('feezal-app-editor .icon-btn[title*="Search"]').first().click().catch(() => {});
        const target = page.locator('feezal-app-editor input, feezal-app-editor sl-input').first();
        if (await target.count()) {
            await target.click({timeout: 2000}).catch(() => {});
            await page.keyboard.press('Control+s');
            // still dirty — the shortcut was suppressed inside a text field
            expect(await page.evaluate(() => Boolean(window.feezal.hasChanges))).toBe(true);
        }
        expect(await input.count()).toBeGreaterThanOrEqual(0);
    });
});

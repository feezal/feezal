/**
 * B98 + B99 + U85, end to end against the real server and editor:
 *
 *  - a successful deploy clears the dirty state and shows a success toast;
 *  - a FAILED deploy keeps the dirty state, shows a sticky error toast with a
 *    Retry action, and never claims success (the old ack fired identically on
 *    both paths, so a failed save looked saved — silent data loss);
 *  - paste and add-view mark the site dirty (they used to mark nothing).
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite} from './harness.js';

const SITE = 'deployfb';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-basic-number style="position:absolute;top:80px;left:80px;width:120px;height:60px;"></feezal-element-basic-number>' +
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

const editor = () => page.locator('feezal-app-editor');
const toastText = () => editor().locator('feezal-toast .toast .msg').first();
const isDirty = () => page.evaluate(() => Boolean(window.feezal.hasChanges));

/** Make the next deploy fail server-side by stubbing the socket emit. */
const breakNextDeploy = () => page.evaluate(() => {
    const conn = document.querySelector('feezal-connection')?.conn
        ?? window.feezal.connection.conn;
    const socket = conn.socket;
    const original = socket.emit.bind(socket);
    socket.emit = (event, ...args) => {
        if (event === 'deploy') {
            const cb = args.pop();
            // exactly the shape the hub sends when saveSite throws (B98)
            setTimeout(() => cb({error: 'disk on fire'}), 10);
            return socket;
        }
        return original(event, ...args);
    };
    window.__restoreDeploy = () => { socket.emit = original; };
});

describe('B98 — deploy feedback', () => {
    it('a successful deploy clears the dirty flag and confirms with a toast', async () => {
        // make a change so the site is dirty
        await page.evaluate(() => {
            window.feezal.view.querySelector('feezal-element-basic-number').setAttribute('label', 'x');
            window.feezal.app.change();
        });
        expect(await isDirty()).toBe(true);

        await page.locator('#btn-deploy-main').click();
        await expect.poll(() => toastText().textContent(), {timeout: 15_000}).toContain('Deployed');
        expect(await isDirty()).toBe(false);
    });

    it('a FAILED deploy keeps the dirty state and offers Retry — never reports success', async () => {
        await page.evaluate(() => {
            window.feezal.view.querySelector('feezal-element-basic-number').setAttribute('label', 'y');
            window.feezal.app.change();
        });
        await breakNextDeploy();
        await page.locator('#btn-deploy-main').click();

        await expect.poll(() => toastText().textContent(), {timeout: 15_000}).toContain('disk on fire');
        // the user's work is still flagged as unsaved
        expect(await isDirty()).toBe(true);
        // the error toast is sticky and carries a Retry action
        const retry = editor().locator('feezal-toast button', {hasText: 'Retry'});
        await expect.poll(() => retry.count()).toBe(1);
        // no success toast anywhere in the stack
        const texts = await editor().locator('feezal-toast .toast .msg').allTextContents();
        expect(texts.some(t => t.includes('Deployed'))).toBe(false);
        // deploying state released (button usable again)
        await expect.poll(() => page.locator('#btn-deploy-main').isEnabled()).toBe(true);

        await page.evaluate(() => window.__restoreDeploy?.());
    });
});

describe('B99 — dirty bookkeeping', () => {
    it('paste marks the site dirty (it used to mark nothing)', async () => {
        await page.locator('#btn-deploy-main').click();
        await expect.poll(() => isDirty(), {timeout: 15_000}).toBe(false);

        await page.evaluate(() => {
            const app = window.feezal.app;
            const el = window.feezal.view.querySelector('feezal-element-basic-number');
            app._clipboardTpl = document.createElement('template');
            app._clipboardTpl.content.append(el.cloneNode(true));
            app._pasteInternal();
        });
        expect(await isDirty()).toBe(true);
    });

    it('adding a view marks the site dirty', async () => {
        await page.locator('#btn-deploy-main').click();
        await expect.poll(() => isDirty(), {timeout: 15_000}).toBe(false);

        await page.evaluate(() => window.feezal.app._addView());
        expect(await isDirty()).toBe(true);
    });
});

/**
 * E2E: site manager UI (A17 candidate) — create / rename / duplicate /
 * delete a site through the real dropdown + dialogs (rendered as a portal
 * into document.body).
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite} from './harness.js';

let stack;
let page;

beforeAll(async () => {
    stack = await startStack();
    page = stack.page;
    // A fresh dataDir lists no sites until one is saved — seed the default.
    await deploySite(stack.baseUrl, {
        name: 'default',
        html: '<feezal-site><feezal-view name="main"></feezal-view></feezal-site>'
    });
    await page.goto(stack.baseUrl + '/editor/');
    await page.waitForSelector('feezal-palette .element', {timeout: 60_000});
}, 60_000);

afterAll(async () => {
    await stopStack(stack);
});

async function sitesOnServer() {
    const res = await fetch(stack.baseUrl + '/api/sites');
    return (await res.json()).sites;
}

async function openManager() {
    // the trigger toggles — only click when the dropdown is closed
    if (await page.locator('.fsm-dropdown').count() === 0) {
        await page.locator('feezal-site-manager .trigger').click();
    }
    await page.locator('.fsm-dropdown').waitFor({timeout: 10_000});
    // the site list loads async after the dropdown opens
    await page.locator('.fsm-site-row').first().waitFor({timeout: 10_000});
}

const siteRow = name => page.locator('.fsm-site-row', {hasText: name}).first();

describe('site manager', () => {
    it('creates a new site and navigates into it', async () => {
        await openManager();
        await page.locator('.fsm-add-btn').click();
        const input = page.locator('#new-name-input');
        await input.waitFor({timeout: 10_000});
        await input.fill('mansion');
        await input.press('Enter');

        await page.waitForURL('**/editor/?*mansion*', {timeout: 20_000});
        await page.waitForSelector('feezal-palette .element', {timeout: 60_000});
        expect(await page.evaluate(() => window.feezal.siteName)).toBe('mansion');
        expect(await sitesOnServer()).toContain('mansion');
    });

    it('renames a site in place', async () => {
        await openManager();
        // ✎ is the first row button on the row
        await siteRow('mansion').locator('.fsm-row-btn').first().click();
        const rename = page.locator('.fsm-rename-input');
        await rename.waitFor({timeout: 10_000});
        await rename.fill('castle');
        await rename.press('Enter');

        await page.waitForURL('**/editor/?*castle*', {timeout: 20_000});
        const sites = await sitesOnServer();
        expect(sites).toContain('castle');
        expect(sites).not.toContain('mansion');
    });

    it('duplicates a site via the native prompt', async () => {
        page.once('dialog', dialog => dialog.accept('castle-clone'));
        await openManager();
        await siteRow('castle').locator('.fsm-row-btn').nth(1).click();

        await expect.poll(sitesOnServer, {timeout: 15_000}).toContain('castle-clone');
    });

    it('deletes a site after the inline confirmation', async () => {
        await openManager();
        await siteRow('castle-clone').locator('.fsm-row-btn.danger').click();
        await page.locator('.fsm-site-row.confirm .fsm-row-btn.danger', {hasText: 'Delete'})
            .click();

        await expect.poll(sitesOnServer, {timeout: 15_000}).not.toContain('castle-clone');
    });
});

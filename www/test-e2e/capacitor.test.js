/**
 * E2E: A9 Tier 2a — Capacitor mobile-app project export, driven through the
 * real editor: deploy-menu entry, pre-export dialog (live appId derivation,
 * localhost broker warning), the actual ZIP download, persistence of
 * viewer.app via deploy, and the Site Settings entry point.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {readFile} from 'fs/promises';
import {join} from 'path';
import {startStack, stopStack, deploySite, serverRequire} from './harness.js';

const SITE = 'caphome';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-material-button label="B" style="position:absolute;top:40px;left:40px;width:120px;height:40px;"></feezal-element-material-button>' +
    '</feezal-view></feezal-site>';

let stack;
let page;

beforeAll(async () => {
    stack = await startStack();
    page = stack.page;
    await deploySite(stack.baseUrl, {
        name: SITE,
        html: SITE_HTML,
        // localhost on purpose — the dialog must warn about it
        connection: {backend: 'mqtt', uri: 'ws://localhost:9001'},
    });
    await page.goto(`${stack.baseUrl}/editor/?/${SITE}/`);
    await page.waitForSelector('feezal-palette .element', {timeout: 60_000});
}, 60_000);

afterAll(async () => {
    await stopStack(stack);
});

const dialog = () => page.locator('feezal-capacitor-dialog');

describe('pre-export dialog', () => {
    it('opens from the deploy menu with derived defaults and the localhost warning', async () => {
        await page.locator('#btn-deploy-caret').click();
        await page.locator('.action-menu-item', {hasText: 'Mobile app'}).click();
        await dialog().locator('sl-dialog[open]').waitFor({timeout: 10_000});

        expect(await dialog().evaluate(el => el._appName)).toBe(SITE);
        expect(await dialog().evaluate(el => el._appId)).toBe(`io.feezal.${SITE}`);
        await dialog().locator('.warn', {hasText: 'localhost'}).waitFor({timeout: 5_000});
    });

    it('the app id follows the name until edited', async () => {
        const nameInput = dialog().locator('sl-input[label="App name"] input');
        await nameInput.fill('Mein Zuhause');
        await expect.poll(() => dialog().evaluate(el => el._appId))
            .toBe('io.feezal.meinzuhause');
    });

    it('exports the project ZIP with scaffold + web bundle + README', async () => {
        const downloadPromise = page.waitForEvent('download', {timeout: 60_000});
        await dialog().locator('sl-button[variant="primary"]').click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('mein-zuhause-app.zip');

        const AdmZip = serverRequire('adm-zip');
        const zip = new AdmZip(await download.path());
        const names = zip.getEntries().filter(e => !e.isDirectory).map(e => e.entryName).sort();
        // A25: the web bundle carries the self-hosted fonts under www/fonts/.
        expect(names.filter(n => !n.startsWith('mein-zuhause/www/fonts/'))).toEqual([
            'mein-zuhause/README.md',
            'mein-zuhause/capacitor.config.json',
            'mein-zuhause/package.json',
            'mein-zuhause/resources/icon.png',
            'mein-zuhause/scripts/platform.mjs',
            'mein-zuhause/www/index.html',
        ]);
        expect(names).toContain('mein-zuhause/www/fonts/fonts.css');

        const cfg = JSON.parse(zip.readAsText('mein-zuhause/capacitor.config.json'));
        expect(cfg).toMatchObject({appId: 'io.feezal.meinzuhause', appName: 'Mein Zuhause', webDir: 'www'});

        const readme = zip.readAsText('mein-zuhause/README.md');
        expect(readme).toContain('# Mein Zuhause');
        expect(readme).toContain('npm run android');
        expect(readme).toContain('⚠️');   // localhost broker warning travels into the docs

        // the embedded dashboard is the real thing
        expect(zip.readAsText('mein-zuhause/www/index.html'))
            .toContain('<feezal-element-material-button');
    });

    it('persists viewer.app with the next deploy', async () => {
        await page.locator('#btn-deploy-main').click();
        await expect.poll(async () => {
            const cfg = await readFile(join(stack.dataDir, 'sites', SITE, 'site.json'), 'utf8')
                .catch(() => '{}');
            return JSON.parse(cfg).viewer?.app;
        }, {timeout: 20_000}).toEqual({name: 'Mein Zuhause', id: 'io.feezal.meinzuhause'});
    });
});

describe('Tier 2b capability gating (no opt-in on this server)', () => {
    it('reports all docker capabilities off and hides the build button', async () => {
        const caps = await (await fetch(`${stack.baseUrl}/api/server/capabilities`)).json();
        expect(caps).toMatchObject({dockerBuilds: false, selfUpdate: false, restart: false});

        // dialog is still open from the previous test group or reopen it
        const open = await dialog().locator('sl-dialog[open]').count();
        if (!open) {
            await page.locator('#btn-deploy-caret').click();
            await page.locator('.action-menu-item', {hasText: 'Mobile app'}).click();
            await dialog().locator('sl-dialog[open]').waitFor({timeout: 10_000});
        }
        expect(await dialog().locator('sl-button', {hasText: 'Build APK'}).count()).toBe(0);

        // the build/update endpoints refuse without the flags
        expect((await fetch(`${stack.baseUrl}/api/sites/${SITE}/build-apk`, {method: 'POST'})).status).toBe(403);
        expect((await fetch(`${stack.baseUrl}/api/server/restart`, {method: 'POST'})).status).toBe(403);
    });
});

describe('Site Settings entry point', () => {
    it('shows the persisted values and opens the same dialog', async () => {
        await page.reload();
        await page.waitForSelector('feezal-palette .element', {timeout: 60_000});
        await page.locator('feezal-app-editor button[title="Site Settings"]').click();
        await page.locator('feezal-sidebar-viewer sl-tab[panel="site"]').click();

        const appNameField = page.locator('feezal-sidebar-viewer sl-input[label="App name"] input');
        await expect.poll(() => appNameField.inputValue()).toBe('Mein Zuhause');

        await page.locator('feezal-sidebar-viewer sl-button', {hasText: 'Export project'}).click();
        await dialog().locator('sl-dialog[open]').waitFor({timeout: 10_000});
        expect(await dialog().evaluate(el => el._appId)).toBe('io.feezal.meinzuhause');
    });
});

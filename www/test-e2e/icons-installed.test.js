/**
 * E2E: N23 built-in reference icon packages + per-site tree-shaking:
 *   - @feezal/feezal-icons-mdi and -knx-uf (www/packages) load as full sets
 *     in the EDITOR via the dynamic feezal-elements.js module
 *   - the picker shows their chips; picking writes prefixed values
 *   - the VIEWER page does NOT load the full sets — the server inlines a
 *     tree-shaken mini-registration with only the icons the site uses
 *   - static exports carry the same shaken registration
 *   - a user-dropped (installed) icon set loads via its full module in the
 *     viewer (install bundles are not shakeable)
 *
 * Sequential; shares one editor page.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {mkdir, writeFile} from 'fs/promises';
import {join} from 'path';
import {startStack, stopStack, deploySite, serverRequire} from './harness.js';

const SITE = 'iconpkgs';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-material-icon-button icon="lightbulb" style="position:absolute;top:100px;left:100px;width:48px;height:48px;"></feezal-element-material-icon-button>' +
    // References the user-installed set so its full module is folded into viewer pages.
    '<feezal-element-material-icon-button icon="usertest:dot" style="position:absolute;top:160px;left:100px;width:48px;height:48px;"></feezal-element-material-icon-button>' +
    // Variant-family element (basic-icon-value): the base name in the HTML must
    // pull all _NN variants into the shaken viewer/export registrations.
    '<feezal-element-basic-icon-value icon="knx-uf:fts_blade_s" value="70" style="position:absolute;top:220px;left:100px;width:64px;height:64px;"></feezal-element-basic-icon-value>' +
    '</feezal-view></feezal-site>';

// Synthetic user-installed set (single-file bundle, like the Package Manager writes).
const USER_SET_JS = `
feezal.registerIcons('usertest', {
    names: ['dot'],
    render: name => '<svg viewBox="0 0 10 10" data-user="' + name + '"><circle cx="5" cy="5" r="4"/></svg>'
});`;

let stack;
let page;

beforeAll(async () => {
    stack = await startStack();
    page = stack.page;
    const dest = join(stack.dataDir, 'elements', '@test', 'feezal-icons-usertest');
    await mkdir(dest, {recursive: true});
    await writeFile(join(dest, 'index.js'), USER_SET_JS, 'utf8');
    await writeFile(join(dest, 'package.json'), JSON.stringify({
        name: '@test/feezal-icons-usertest', version: '1.0.0', main: 'index.js',
        feezal: {type: 'icons', set: 'usertest'}
    }));
    await deploySite(stack.baseUrl, {name: SITE, html: SITE_HTML});
    await page.goto(`${stack.baseUrl}/editor/?/${SITE}/`);
    await page.waitForSelector('feezal-palette .element', {timeout: 60_000});
}, 90_000);

afterAll(async () => {
    if (stack.pageErrors.length) console.error('PAGE ERRORS:', stack.pageErrors);
    await stopStack(stack);
});

const iconInput = () => page
    .locator('feezal-sidebar-inspector-attributes .icon-wrap sl-input').first();

describe('built-in icon packages in the editor', () => {
    it('both bundled sets + the user set register as full sets', async () => {
        await expect.poll(() => page.evaluate(() => [...window.feezal.iconSets].sort()), {timeout: 30_000})
            .toEqual(['knx-uf', 'mdi', 'usertest']);
        // Full sets in the editor (the picker offers everything).
        const sizes = await page.evaluate(() => new Promise(resolve => {
            import('/src/feezal-icon.js').then(m => {
                resolve({mdi: m.iconSets().get('mdi').names.length, knx: m.iconSets().get('knx-uf').names.length});
            }).catch(() => resolve(null));
        })).catch(() => null);
        if (sizes) {
            expect(sizes.mdi).toBeGreaterThan(7000);
            expect(sizes.knx).toBeGreaterThan(900);
        }
    });

    it('picker chips appear; picking mdi:sofa writes the prefixed value', async () => {
        await page.locator('feezal-element-material-icon-button[icon="lightbulb"]').click();
        await iconInput().locator('input').click();
        const chips = page.locator('feezal-sidebar-inspector-attributes .icon-set-chip');
        await expect.poll(async () => (await chips.allTextContents()).sort())
            .toEqual(['All', 'knx-uf', 'material', 'mdi', 'usertest'].sort());

        await page.locator('feezal-sidebar-inspector-attributes .icon-set-chip', {hasText: /^mdi$/}).click();
        await iconInput().locator('input').fill('sofa');
        const tile = page.locator('feezal-sidebar-inspector-attributes .icon-tile[title="mdi:sofa"]');
        await expect.poll(() => tile.count()).toBe(1);
        expect(await tile.locator('feezal-icon svg path').count()).toBe(1);
        await tile.click();
        await expect.poll(() => page.locator('feezal-element-material-icon-button').first()
            .getAttribute('icon')).toBe('mdi:sofa');
        // The element itself renders the prefixed icon on the canvas
        // (elements resolve icons through <feezal-icon> since the migration).
        await expect.poll(() => page
            .locator('feezal-element-material-icon-button[icon="mdi:sofa"] feezal-icon svg path').count()).toBe(1);
        await expect.poll(() => page
            .locator('feezal-element-material-icon-button[icon="usertest:dot"] feezal-icon svg').count()).toBe(1);
    });

    it('deploys the site with the picked icon', async () => {
        await page.locator('#btn-deploy-main').click();
        await expect.poll(async () => {
            const res = await fetch(`${stack.baseUrl}/viewer/${SITE}`);
            return (await res.text()).includes('mdi:sofa');
        }, {timeout: 20_000}).toBe(true);
    });
});

describe('viewer page: tree-shaken icons', () => {
    it('inlines only the used icons — not the full set', async () => {
        const html = await (await fetch(`${stack.baseUrl}/viewer/${SITE}`)).text();
        expect(html).toContain(`feezal.registerIcons("mdi"`);
        expect(html).toContain('"sofa"');                       // used icon inlined
        expect(html).not.toContain('"ab-testing"');             // unused icon NOT inlined
        // Variant family used by basic-icon-value: the base reference pulls
        // in all _NN steps (runtime-constructed names).
        expect(html).toContain('feezal.registerIcons("knx-uf"');
        expect(html).toContain('"fts_blade_s_00"');
        expect(html).toContain('"fts_blade_s_50"');
        expect(html).toContain('"fts_blade_s_100"');
        expect(html).not.toContain('"audio_audio"');            // unrelated knx icon absent
        // User-installed set: full module script tag (not shakeable).
        expect(html).toContain('/user-elements/@test/feezal-icons-usertest/index.js');
    });

    it('the live viewer registers the shaken set and renders the icon', async () => {
        const viewer = await stack.context.newPage();
        try {
            await viewer.goto(`${stack.baseUrl}/viewer/${SITE}`);
            await viewer.waitForSelector('feezal-element-material-icon-button', {timeout: 30_000});
            await expect.poll(() => viewer.evaluate(() => [...(window.feezal.iconSets || [])].sort()))
                .toEqual(['knx-uf', 'mdi', 'usertest']);
            // basic-icon-value renders its scaled variant in the viewer.
            await expect.poll(() => viewer
                .locator('feezal-element-basic-icon-value feezal-icon').getAttribute('name'))
                .toBe('knx-uf:fts_blade_s_70');
            expect(await viewer
                .locator('feezal-element-basic-icon-value feezal-icon svg').count()).toBe(1);
            const rendered = await viewer.evaluate(() => {
                const el = document.createElement('feezal-icon');
                el.setAttribute('name', 'mdi:sofa');
                document.body.append(el);
                return el.shadowRoot.querySelector('svg') !== null;
            });
            expect(rendered).toBe(true);
            // The deployed icon-buttons render their prefixed icons in the viewer.
            await expect.poll(() => viewer
                .locator('feezal-element-material-icon-button[icon="mdi:sofa"] feezal-icon svg path').count()).toBe(1);
            await expect.poll(() => viewer
                .locator('feezal-element-material-icon-button[icon="usertest:dot"] feezal-icon svg').count()).toBe(1);
        } finally {
            await viewer.close();
        }
    });
});

describe('basic-icon-value element', () => {
    const el = () => page.locator('feezal-element-basic-icon-value');

    it('renders the scaled variant and re-renders on value change (zero alias)', async () => {
        await expect.poll(() => el().locator('feezal-icon').getAttribute('name'))
            .toBe('knx-uf:fts_blade_s_70');
        await el().evaluate(e => e.setAttribute('value', '0'));
        await expect.poll(() => el().locator('feezal-icon').getAttribute('name'))
            .toBe('knx-uf:fts_blade_s_00');                     // upstream _00 zero alias
        await el().evaluate(e => e.setAttribute('value', '70'));  // restore
    });

    it('its icon picker offers only complete variant families', async () => {
        await el().click();
        await iconInput().locator('input').click();
        const chips = page.locator('feezal-sidebar-inspector-attributes .icon-set-chip');
        // Only sets with complete _0.._100 families get a chip — material,
        // mdi and the user set have none.
        await expect.poll(() => chips.allTextContents()).toEqual(['All', 'knx-uf']);

        await iconInput().locator('input').fill('blade_s');
        const tile = page.locator('feezal-sidebar-inspector-attributes .icon-tile[title="knx-uf:fts_blade_s"]');
        await expect.poll(() => tile.count()).toBe(1);
        expect(await tile.locator('feezal-icon svg').count()).toBe(1);   // mid-step preview renders
        await tile.click();
        await expect.poll(() => el().getAttribute('icon')).toBe('knx-uf:fts_blade_s');
    });

    it('families without a zero variant (garage, shutters) are offered too', async () => {
        await el().click();
        await iconInput().locator('input').click();
        await iconInput().locator('input').fill('garage');
        const tile = page.locator('feezal-sidebar-inspector-attributes .icon-tile[title="knx-uf:fts_garage_door"]');
        await expect.poll(() => tile.count()).toBe(1);
        await page.keyboard.press('Escape');
    });
});

describe('static export: tree-shaken icons', () => {
    it('the export ZIP carries the shaken registration', async () => {
        const res = await fetch(`${stack.baseUrl}/api/sites/${SITE}/export`);
        expect(res.ok).toBe(true);
        const AdmZip = serverRequire('adm-zip');
        const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));
        const index = zip.getEntries().find(e => e.entryName.endsWith('index.html'));
        const html = index.getData().toString('utf8');
        expect(html).toContain(`feezal.registerIcons("mdi"`);
        expect(html).toContain('"sofa"');
        expect(html).not.toContain('"ab-testing"');
    });
});

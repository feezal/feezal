/**
 * E2E: U32 composed elements — real editor + server:
 *   - a deployed site with a <template feezal-component> stamps instances with
 *     substituted params and template-derived size
 *   - param attribute changes re-stamp live
 *   - "Create component…" via context menu + dialog replaces the selection
 *   - deploy persists the instance as an EMPTY tag (stamped content stripped)
 *     while the template definition survives
 *   - "Edit component" opens the pseudo-view with banner; Done commits and
 *     re-stamps all instances
 *   - "Detach" expands an instance into plain elements
 *
 * Sequential; shares one editor page.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {readFile} from 'fs/promises';
import {join} from 'path';
import {startStack, stopStack, deploySite} from './harness.js';

const SITE = 'comp';
// NOTE: attribute values are entity-escaped (&quot;) exactly as the editor's
// outerHTML serialization produces them — the server's prettyhtml formatting
// step does not escape raw double quotes in attribute values.
const SITE_HTML =
    '<feezal-site>' +
    '<template feezal-component="room-card" feezal-params="{&quot;prefix&quot;:{&quot;type&quot;:&quot;mqttTopic&quot;,&quot;default&quot;:&quot;home/livingroom&quot;},&quot;label&quot;:{&quot;type&quot;:&quot;string&quot;,&quot;default&quot;:&quot;Room&quot;}}">' +
    '<feezal-element-material-button label="${label}" subscribe="${prefix}/light/state"' +
    ' style="left:0px; top:0px; width:160px; height:40px;"></feezal-element-material-button>' +
    '</template>' +
    '<feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-component name="room-card" label="Living room" style="left:40px;top:40px;"></feezal-component>' +
    '<feezal-element-material-button label="X" subscribe="a/b/state" style="position:absolute;top:300px;left:100px;width:120px;height:40px;"></feezal-element-material-button>' +
    '<feezal-element-material-button label="Y" style="position:absolute;top:300px;left:320px;width:120px;height:40px;"></feezal-element-material-button>' +
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
    if (stack.pageErrors.length) {
        console.error('PAGE ERRORS:', stack.pageErrors);
    }
    await stopStack(stack);
});

const instance = () => page.locator('feezal-site feezal-component[name="room-card"]');
const btn = label => page.locator(`feezal-site > feezal-view feezal-element-material-button[label="${label}"]`);

describe('stamping', () => {
    it('stamps the instance with substituted params on load', async () => {
        await expect.poll(() => instance().locator('feezal-element-material-button').count()).toBe(1);
        const stamped = instance().locator('feezal-element-material-button');
        expect(await stamped.getAttribute('label')).toBe('Living room');            // instance override
        expect(await stamped.getAttribute('subscribe')).toBe('home/livingroom/light/state'); // default
    });

    it('derives the instance size from the template bounding box', async () => {
        // B46: the template box is a shadow :host DEFAULT, not an inline
        // style — an authored width/height (e.g. 100% from the inspector)
        // beats it and survives stamping/reloads. The rendered size still
        // comes out at the template bounding box.
        expect(await instance().evaluate(el => el.style.width)).toBe('');
        expect(await instance().evaluate(el => el.style.height)).toBe('');
        expect(await instance().evaluate(el => el._sizeStyle.textContent))
            .toBe(':host { width: 160px; height: 40px; }');
        const box = await instance().boundingBox();
        expect(box.width).toBe(160);
        expect(box.height).toBe(40);
    });

    it('an authored inline size beats the template default (B46)', async () => {
        await instance().evaluate(el => { el.style.width = '320px'; });
        const box = await instance().boundingBox();
        expect(box.width).toBe(320);
        expect(box.height).toBe(40);                          // other axis keeps the default
        await instance().evaluate(el => { el.style.width = ''; });   // restore for later tests
    });

    it('re-stamps when a param attribute changes', async () => {
        await instance().evaluate(el => el.setAttribute('prefix', 'home/kitchen'));
        await expect.poll(() => instance().locator('feezal-element-material-button')
            .getAttribute('subscribe')).toBe('home/kitchen/light/state');
    });

    it('appears in the palette Components category', async () => {
        await expect.poll(() => page
            .locator('feezal-palette .element[data-component="room-card"]').count()).toBe(1);
    });
});

describe('create component', () => {
    it('context menu on a multi-selection creates a component via the dialog', async () => {
        await btn('X').click();
        await btn('Y').click({modifiers: ['Control']});
        await btn('X').click({button: 'right'});

        await page.locator('feezal-sidebar-inspector .ctx-item', {hasText: 'Create component…'}).click();

        const dialog = page.locator('#componentdialog');
        await expect.poll(() => dialog.evaluate(d => d.open)).toBe(true);
        // The dialog clears the name input on sl-after-show (end of the show
        // animation) — wait for that before typing, or the fill gets wiped.
        await page.waitForTimeout(600);
        const nameInput = dialog.locator('#componentnameinput input');
        await nameInput.fill('two-buttons');
        await expect.poll(() => nameInput.inputValue()).toBe('two-buttons');
        // Parameterize button X's subscribe attribute as "topic".
        const row = dialog.locator('.component-param-table tr', {hasText: 'subscribe'});
        await row.locator('input').fill('topic');
        await dialog.locator('sl-button[variant="primary"]').click();

        // Selection replaced by an instance; originals gone.
        await expect.poll(() => page
            .locator('feezal-site feezal-component[name="two-buttons"]').count()).toBe(1);
        expect(await page.locator('feezal-site > feezal-view > feezal-element-material-button[label="X"]').count()).toBe(0);

        // Template exists with the parameterized attribute + default.
        const templateInfo = await page.evaluate(() => {
            const t = feezal.site.querySelector('template[feezal-component="two-buttons"]');
            return {
                subscribe: t.content.querySelector('[label="X"]').getAttribute('subscribe'),
                params: JSON.parse(t.getAttribute('feezal-params'))
            };
        });
        expect(templateInfo.subscribe).toBe('${topic}');
        expect(templateInfo.params.topic).toEqual({type: 'mqttTopic', default: 'a/b/state'});

        // The new instance stamps with the default → visually nothing changed.
        const stamped = page.locator('feezal-component[name="two-buttons"] feezal-element-material-button[label="X"]');
        await expect.poll(() => stamped.getAttribute('subscribe')).toBe('a/b/state');
    });
});

describe('deploy persistence', () => {
    it('deploys instances as empty tags; template survives', async () => {
        await page.locator('#btn-deploy-main').click();
        const siteFile = join(stack.dataDir, 'sites', SITE, 'site.html');
        await expect.poll(async () => {
            const html = await readFile(siteFile, 'utf8').catch(() => '');
            return html.includes('two-buttons');
        }, {timeout: 20_000}).toBe(true);

        const savedHtml = await readFile(siteFile, 'utf8');
        expect(savedHtml).toContain('feezal-component="room-card"');
        expect(savedHtml).toContain('feezal-component="two-buttons"');
        // Empty instance tag: no stamped children between open and close tag.
        expect(savedHtml).toMatch(/<feezal-component[^>]*name="room-card"[^>]*>\s*<\/feezal-component>/);
        // No pseudo-view leaked.
        expect(savedHtml).not.toContain('feezal-component-edit');
    });
});

describe('edit component', () => {
    it('opens the pseudo-view with banner; Done commits and re-stamps', async () => {
        await instance().click();
        await instance().click({button: 'right'});
        await page.locator('feezal-sidebar-inspector .ctx-item', {hasText: 'Edit component'}).click();

        // Banner + pseudo-view active, raw placeholder visible on the canvas copy.
        await expect.poll(() => page.locator('#component-edit-banner').count()).toBe(1);
        const editView = page.locator('feezal-view[feezal-component-edit="room-card"]');
        expect(await editView.locator('feezal-element-material-button').getAttribute('label')).toBe('${label}');

        // Change the template copy, then commit.
        await editView.locator('feezal-element-material-button')
            .evaluate(el => el.setAttribute('variant', 'success'));
        await page.locator('#component-edit-banner sl-button[variant="primary"]').click();

        await expect.poll(() => page.locator('#component-edit-banner').count()).toBe(0);
        expect(await page.locator('feezal-view[feezal-component-edit]').count()).toBe(0);
        // All instances re-stamped with the edit, substitution intact.
        const stamped = instance().locator('feezal-element-material-button');
        await expect.poll(() => stamped.getAttribute('variant')).toBe('success');
        expect(await stamped.getAttribute('label')).toBe('Living room');
    });
});

describe('palette context menu (lifecycle without instances)', () => {
    const paletteEntry = name => page.locator(`feezal-palette .element[data-component="${name}"]`);

    it('rename via palette menu rewrites the template and the palette entry', async () => {
        await paletteEntry('two-buttons').click({button: 'right'});
        await page.locator('feezal-palette .component-ctx .item', {hasText: 'Rename…'}).click();

        const dialog = page.locator('#componentrenamedialog');
        await expect.poll(() => dialog.evaluate(d => d.open)).toBe(true);
        // sl-after-show pre-fills the input with the current name — wait for it.
        const input = dialog.locator('#componentrenameinput input');
        await expect.poll(() => input.inputValue()).toBe('two-buttons');
        await input.fill('two-knobs');
        await dialog.locator('sl-button[variant="primary"]').click();

        await expect.poll(() => page.evaluate(() =>
            Boolean(feezal.site.querySelector('template[feezal-component="two-knobs"]')))).toBe(true);
        expect(await page.evaluate(() =>
            Boolean(feezal.site.querySelector('template[feezal-component="two-buttons"]')))).toBe(false);
        // Instances follow the rename and stay stamped.
        await expect.poll(() => page
            .locator('feezal-component[name="two-knobs"] feezal-element-material-button').count()).toBe(2);
        await expect.poll(() => paletteEntry('two-knobs').count()).toBe(1);
    });

    it('delete via palette menu with live instances shows the detach-all dialog', async () => {
        await paletteEntry('two-knobs').click({button: 'right'});
        await page.locator('feezal-palette .component-ctx .item', {hasText: 'Delete…'}).click();

        const dialog = page.locator('#componentdeletedialog');
        await expect.poll(() => dialog.evaluate(d => d.open)).toBe(true);
        await dialog.locator('sl-button[variant="danger"]').click();

        // Instances detached into plain elements, template + palette entry gone.
        await expect.poll(() => page.locator('feezal-component[name="two-knobs"]').count()).toBe(0);
        expect(await page.evaluate(() =>
            Boolean(feezal.site.querySelector('template[feezal-component="two-knobs"]')))).toBe(false);
        await expect.poll(() => paletteEntry('two-knobs').count()).toBe(0);
        expect(await page.locator('feezal-site > feezal-view > feezal-element-material-button[label="X"]').count()).toBe(1);
    });
});

describe('detach', () => {
    it('replaces the instance with its substituted, expanded markup', async () => {
        await instance().click();
        await instance().click({button: 'right'});
        await page.locator('feezal-sidebar-inspector .ctx-item', {hasText: 'Detach'}).click();

        await expect.poll(() => instance().count()).toBe(0);
        const detached = page.locator('feezal-site > feezal-view > feezal-element-material-button[label="Living room"]');
        await expect.poll(() => detached.count()).toBe(1);
        // Position translated by the instance origin (template 0 + instance 40).
        expect(await detached.evaluate(el => el.style.left)).toBe('40px');
        expect(await detached.evaluate(el => el.style.top)).toBe('40px');
    });
});

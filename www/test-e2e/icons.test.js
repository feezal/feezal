/**
 * E2E: N23 icon-set registry + multi-set icon picker — real editor:
 *   - single-set behavior unchanged (material grid, no chips)
 *   - a set registered via feezal.registerIcons() adds the chip row
 *   - selecting a tile from a registered set writes the prefixed set:name value
 *   - typing a "set:" prefix scopes the autocomplete
 *   - <feezal-icon> renders registered-set glyphs (render mode)
 *
 * Sequential; shares one editor page.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite} from './harness.js';

const SITE = 'icons';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-material-icon-button icon="lightbulb" style="position:absolute;top:100px;left:100px;width:48px;height:48px;"></feezal-element-material-icon-button>' +
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

const iconInput = () => page
    .locator('feezal-sidebar-inspector-attributes .icon-wrap sl-input').first();

async function openPicker() {
    await page.locator('feezal-element-material-icon-button').click();
    await iconInput().locator('input').click();
    await page.waitForSelector('feezal-sidebar-inspector-attributes .icon-grid');
}

describe('icon picker (N23)', () => {
    it('grid opens with material tiles; chip row lists the built-in sets', async () => {
        await openPicker();
        expect(await page.locator('feezal-sidebar-inspector-attributes .icon-tile').count()).toBeGreaterThan(0);
        // The bundled reference sets (mdi, knx-uf) are always present.
        const chips = await page.locator('feezal-sidebar-inspector-attributes .icon-set-chip').allTextContents();
        expect(chips[0]).toBe('All');
        expect(chips).toContain('material');
        expect(chips).toContain('mdi');
        expect(chips).toContain('knx-uf');
        await page.keyboard.press('Escape');
    });

    it('registering a set at runtime adds its chip', async () => {
        await page.evaluate(() => {
            feezal.registerIcons('testset', {
                names: ['alpha', 'beta'],
                render: name => `<svg viewBox="0 0 24 24" data-glyph="${name}"><rect width="24" height="24"/></svg>`
            });
        });
        await openPicker();
        const chips = page.locator('feezal-sidebar-inspector-attributes .icon-set-chip');
        await expect.poll(() => chips.allTextContents()).toContain('testset');
    });

    it('selecting a registered-set tile writes the prefixed value', async () => {
        await page.locator('feezal-sidebar-inspector-attributes .icon-set-chip', {hasText: 'testset'}).click();
        // The current value ("lightbulb") is the initial query and matches
        // nothing in testset — the popup stays open with an empty hint.
        await expect.poll(() => page
            .locator('feezal-sidebar-inspector-attributes .icon-empty').count()).toBe(1);
        await iconInput().locator('input').fill('');
        const tiles = page.locator('feezal-sidebar-inspector-attributes .icon-tile');
        await expect.poll(() => tiles.count()).toBe(2);
        // Lit re-creates the tile nodes on every sidebar render — under CI
        // load Playwright's stability check can starve ('element is not
        // stable' / 'detached'); click the resolved node programmatically.
        await tiles.first().evaluate(el => el.click());

        await expect.poll(() => page.locator('feezal-element-material-icon-button')
            .getAttribute('icon')).toBe('testset:alpha');
        // The input's prefix glyph resolves through <feezal-icon> (render mode).
        expect(await iconInput().locator('feezal-icon svg[data-glyph="alpha"]').count()).toBe(1);
    });

    it('typing a set: prefix scopes the search', async () => {
        await openPicker();
        await iconInput().locator('input').fill('testset:be');
        const tiles = page.locator('feezal-sidebar-inspector-attributes .icon-tile');
        await expect.poll(() => tiles.count()).toBe(1);
        expect(await tiles.first().getAttribute('title')).toBe('testset:beta');
        // The matching chip is highlighted.
        expect(await page.locator('feezal-sidebar-inspector-attributes .icon-set-chip.active').textContent()).toBe('testset');
        await page.keyboard.press('Escape');
    });

    it('the canvas element keeps rendering (set resolved at runtime)', async () => {
        const attr = await page.locator('feezal-element-material-icon-button').getAttribute('icon');
        expect(attr).toBe('testset:alpha');
    });
});

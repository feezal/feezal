/**
 * E2E editor flows (A17 automation candidates #2–#6) — real server + real
 * Chromium driving the actual editor UI:
 *
 *   - inspector attribute editing (subscribe topic → live MQTT value)
 *   - element move by mouse, arrow-key nudge, undo
 *   - source mode: syntax error gates deploy, apply reflects on canvas
 *   - view management: add, rename, tab navigation
 *   - copy-on-use: drag a global asset onto the canvas → repointed src,
 *     fresh inspector value (the B15 regression)
 *
 * Tests are sequential and share one editor page; order matters.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {readFile} from 'fs/promises';
import {join} from 'path';
import {startStack, stopStack, deploySite, startBroker, mouseDrag, centerOf} from './harness.js';

const SITE = 'flows';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-basic-number style="position:absolute;top:100px;left:100px;width:120px;height:60px;"></feezal-element-basic-number>' +
    '</feezal-view></feezal-site>';

// 1×1 red PNG
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
);

let stack;
let page;
let broker;

beforeAll(async () => {
    stack = await startStack();
    page = stack.page;
    broker = await startBroker();
    // Let editor elements subscribe to MQTT (gated by default).
    await stack.context.addInitScript(() => {
        localStorage.setItem('preventEditorMqtt', 'false');
    });
    // A real broker behind the site so bridge-relayed messages reach the
    // editor live (the hub-only bus echoes to the sender exclusively).
    const bridgeSubscribed = new Promise(r => broker.broker.once('subscribe', r));
    await deploySite(stack.baseUrl, {
        name: SITE,
        html: SITE_HTML,
        connection: {backend: 'mqtt', uri: broker.uri}
    });
    await bridgeSubscribed;
    await page.goto(`${stack.baseUrl}/editor/?/${SITE}/`);
    await page.waitForSelector('feezal-palette .element', {timeout: 60_000});
}, 60_000);

afterAll(async () => {
    await stopStack(stack);
    await broker.close().catch(() => {});
});

const numberEl = () => page.locator('feezal-site > feezal-view feezal-element-basic-number').first();

describe('inspector attribute editing', () => {
    it('typing a subscribe topic into the inspector applies it to the element', async () => {
        await numberEl().click();
        await expect.poll(() => numberEl().evaluate(el => el.classList.contains('feezal-selected')))
            .toBe(true);

        const input = page
            .locator('feezal-sidebar-inspector-attributes .topic-wrap sl-input')
            .filter({hasText: 'subscribe'}).first();
        await input.click();
        await input.locator('input').fill('flows/num');
        await input.locator('input').press('Enter');

        await expect.poll(() => numberEl().getAttribute('subscribe')).toBe('flows/num');
    });

    it('after deploy + reload, a broker value renders live in the editor', async () => {
        await page.locator('#btn-deploy-main').click();
        await expect.poll(async () => {
            const html = await readFile(join(stack.dataDir, 'sites', SITE, 'site.html'), 'utf8')
                .catch(() => '');
            return html.includes('subscribe="flows/num"');
        }, {timeout: 20_000}).toBe(true);

        await page.reload();
        await page.waitForSelector('feezal-palette .element', {timeout: 60_000});
        // staged assertions so a failure names the broken link in the chain:
        // attribute restored → subscription registered → value rendered
        await expect.poll(() => numberEl().getAttribute('subscribe')).toBe('flows/num');
        await expect.poll(() => page.evaluate(() =>
            window.feezal.connection?.subscriptions?.map(s => s.topic) || []
        ), {timeout: 15_000}).toContain('flows/num');

        // Publish only once the editor is subscribed — the broker→bridge→hub
        // relay then delivers it live to the editor page.
        await broker.publishRetained('flows/num', '77');
        // (piercing locator — the canvas lives inside the editor's shadow DOM)
        await expect.poll(() => numberEl().evaluate(el => el.shadowRoot?.textContent || ''),
            {timeout: 20_000}).toContain('77');
    });
});

describe('move, nudge, undo', () => {
    it('dragging the element by mouse moves it', async () => {
        const before = await numberEl().evaluate(el => Number.parseFloat(el.style.left));
        const box = await numberEl().boundingBox();
        const from = centerOf(box);
        await mouseDrag(page, from, {x: from.x + 80, y: from.y + 40});

        const after = await numberEl().evaluate(el => Number.parseFloat(el.style.left));
        expect(after).toBeGreaterThan(before);
    });

    it('arrow keys nudge the selected element (Shift = 1px, plain = grid size)', async () => {
        await numberEl().click();
        await page.evaluate(() => window.feezal.site.focus());
        const before = await numberEl().evaluate(el => Number.parseFloat(el.style.left));

        await page.keyboard.press('Shift+ArrowRight');
        await expect.poll(() => numberEl().evaluate(el => Number.parseFloat(el.style.left)))
            .toBe(before + 1);

        const gridSize = await page.locator('feezal-app-editor').evaluate(ed => ed.gridSize);
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => numberEl().evaluate(el => Number.parseFloat(el.style.left)))
            .toBe(before + 1 + gridSize);
    });

    it('undo restores the previous position', async () => {
        const before = await numberEl().evaluate(el => Number.parseFloat(el.style.left));
        await page.locator('button[title^="Undo"]').click();

        await expect.poll(() => numberEl().evaluate(el => Number.parseFloat(el.style.left)))
            .not.toBe(before);
    });
});

describe('source mode', () => {
    const setSource = value => page.locator('feezal-app-editor')
        .evaluate((editor, v) => editor._sourceEditor.setValue(v), value);

    it('a syntax error shows the badge and gates the deploy button', async () => {
        await page.locator('.source-mode-btn').click();
        await page.waitForSelector('#source-editor', {timeout: 20_000});
        await expect.poll(() => page.locator('feezal-app-editor')
            .evaluate(editor => Boolean(editor._sourceEditor))).toBe(true);

        await setSource('<feezal-site><feezal-view name="main"><broken');
        await expect.poll(() => page.locator('#btn-deploy-main').isDisabled()).toBe(true);
        await expect.poll(() => page.locator('.source-error-badge').count()).toBeGreaterThan(0);
    });

    it('valid source applies to the canvas on deploy', async () => {
        await setSource(
            '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
            '<feezal-element-material-badge style="position:absolute;top:20px;left:20px;"></feezal-element-material-badge>' +
            '</feezal-view></feezal-site>'
        );
        await expect.poll(() => page.locator('#btn-deploy-main').isDisabled()).toBe(false);

        await page.locator('#btn-deploy-main').click();   // applies source + deploys
        await page.locator('feezal-site > feezal-view feezal-element-material-badge')
            .waitFor({timeout: 20_000});
        await expect.poll(async () => {
            const html = await readFile(join(stack.dataDir, 'sites', SITE, 'site.html'), 'utf8')
                .catch(() => '');
            return html.includes('feezal-element-material-badge');
        }, {timeout: 20_000}).toBe(true);
    });
});

describe('view management', () => {
    it('adds a view via the tab bar button', async () => {
        await page.locator('button[title="Add view"], .icon-btn:has-text("note_add")').first().click();
        await page.locator('.ftab.view[data-view="view1"]').waitFor({timeout: 10_000});
        expect(await page.locator('feezal-site > feezal-view[name="view1"]').count()).toBe(1);
    });

    it('renames a view via double-click', async () => {
        await page.locator('.ftab.view[data-view="view1"]').dblclick();
        const input = page.locator('#viewnameinput');
        await input.waitFor({timeout: 10_000});
        await input.locator('input').fill('garden');
        await input.locator('input').press('Enter');

        await page.locator('.ftab.view[data-view="garden"]').waitFor({timeout: 10_000});
        expect(await page.locator('feezal-site > feezal-view[name="garden"]').count()).toBe(1);
    });

    it('navigates between views via the tab bar', async () => {
        await page.locator('.ftab.view[data-view="main"]').click();
        await expect.poll(() => page.locator('feezal-site > feezal-view[name="main"]')
            .evaluate(v => getComputedStyle(v).display)).not.toBe('none');
        expect(await page.locator('feezal-site > feezal-view[name="garden"]')
            .evaluate(v => getComputedStyle(v).display)).toBe('none');
    });
});

describe('copy-on-use of a global asset (B15)', () => {
    it('drag from the assets sidebar repoints src and refreshes the inspector', async () => {
        // Seed a global image via the assets API, then reload so the sidebar
        // (which lists assets at boot) sees it.
        const res = await fetch(
            `${stack.baseUrl}/api/assets/${SITE}?category=global&path=logo.png`,
            {method: 'POST', headers: {'Content-Type': 'image/png'}, body: PNG}
        );
        expect(res.status).toBeLessThan(300);
        await page.reload();
        await page.waitForSelector('feezal-palette .element', {timeout: 60_000});

        // Assets sidebar → Global pool.
        await page.locator('feezal-app-editor button[title="Assets"]').click();
        await page.locator('feezal-sidebar-assets .cat-btn:has-text("Global")').click();
        const tile = page.locator('feezal-sidebar-assets .tile[data-file="logo.png"]');
        await tile.waitFor({timeout: 10_000});

        // Drag the tile onto the canvas.
        const from = centerOf(await tile.boundingBox());
        const view = await page.locator('feezal-site > feezal-view[data-view], feezal-site > feezal-view')
            .first().boundingBox();
        await mouseDrag(page, from, {x: view.x + view.width / 2, y: view.y + view.height / 2}, 20);

        // The dropped image ends up with a site-local (copy-on-use) src …
        const img = page.locator('feezal-site > feezal-view feezal-element-basic-image').first();
        await img.waitFor({timeout: 10_000});
        await expect.poll(() => img.getAttribute('src'), {timeout: 15_000})
            .toBe(`/assets/${SITE}/logo.png`);

        // … the file exists in the site pool …
        const copied = await readFile(join(stack.dataDir, 'sites', SITE, 'assets', 'logo.png'));
        expect(copied.equals(PNG)).toBe(true);

        // … and the inspector shows the fresh value, not the stale global path (B15).
        await expect.poll(() => page.locator('feezal-sidebar-inspector-attributes')
            .evaluate(insp => insp.items?.find(i => i.attrName === 'src')?.value), {timeout: 15_000})
            .toBe(`/assets/${SITE}/logo.png`);
    });
});

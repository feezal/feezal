/**
 * E2E: A9 Tier 1 — the PWA toggle in Site Settings, driven for real:
 * enable via the checkbox → deploy → the served viewer gains manifest +
 * a registered service worker; icon upload through the crop dialog; the
 * asset-manager "Set as PWA icon" entry point; PWA entries in the export.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite, serverRequire} from './harness.js';

const SITE = 'pwae2e';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-material-button label="B" style="position:absolute;top:50px;left:50px;width:120px;height:40px;"></feezal-element-material-button>' +
    '</feezal-view></feezal-site>';

// 64×64 red PNG (canvas-generated once, hardcoded base64)
const PNG64 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAeElEQVR42u3PMQ0AAAgEsW9y1sBJ' +
    'AhI6dnZ4TQ4gQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAA' +
    'AQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQL+BhZxWAIV9wS9zQAAAABJRU5E' +
    'rkJggg==', 'base64'
);

function crc32(buf) {
    let crc = 0xffffffff;
    for (const byte of buf) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
}

/**
 * A ~350kB VALID PNG: the 64px image with a large ancillary tEXt chunk
 * injected after IHDR (decoders ignore it). Regression guard for the 413
 * from the default 100kb json parser — real photo icons are this size.
 */
function bigPng() {
    const payload = Buffer.concat([Buffer.from('comment\0'), Buffer.alloc(350 * 1024, 65)]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length);
    const typeAndData = Buffer.concat([Buffer.from('tEXt'), payload]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData));
    const ihdrEnd = 8 + 25;   // signature + IHDR chunk
    return Buffer.concat([PNG64.slice(0, ihdrEnd), len, typeAndData, crc, PNG64.slice(ihdrEnd)]);
}

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
    await stopStack(stack);
});

async function openSiteSettingsTab() {
    await page.locator('feezal-app-editor button[title="Site Settings"]').click();
    await page.locator('feezal-sidebar-viewer sl-tab[panel="site"]').click();
}

describe('PWA toggle', () => {
    it('is off by default — manifest and sw 404', async () => {
        expect((await fetch(`${stack.baseUrl}/viewer/${SITE}/manifest.webmanifest`)).status).toBe(404);
        expect((await fetch(`${stack.baseUrl}/viewer/${SITE}/sw.js`)).status).toBe(404);
    });

    it('enabling via Site Settings + deploy activates manifest and service worker', async () => {
        await openSiteSettingsTab();
        // #pwa-switch: the Site tab holds several sl-switches (via-server,
        // playlist, PWA) — target the PWA one specifically.
        await page.locator('feezal-sidebar-viewer #pwa-switch').click();
        await page.locator('#btn-deploy-main').click();

        await expect.poll(async () =>
            (await fetch(`${stack.baseUrl}/viewer/${SITE}/manifest.webmanifest`)).status,
        {timeout: 20_000}).toBe(200);

        const manifest = await (await fetch(`${stack.baseUrl}/viewer/${SITE}/manifest.webmanifest`)).json();
        expect(manifest).toMatchObject({
            name: SITE,
            display: 'standalone',
            start_url: `/viewer/${SITE}`,
        });
        expect(manifest.icons.length).toBeGreaterThan(0);
    });

    it('the served viewer registers the service worker', async () => {
        const viewer = await stack.context.newPage();
        await viewer.goto(`${stack.baseUrl}/viewer/${SITE}`);

        const manifestHref = await viewer.locator('link[rel="manifest"]').getAttribute('href');
        expect(manifestHref).toBe(`/viewer/${SITE}/manifest.webmanifest`);

        const swActive = await viewer.evaluate(() =>
            navigator.serviceWorker.ready.then(reg => Boolean(reg.active)));
        expect(swActive).toBe(true);
        await viewer.close();
    });
});

describe('custom icon', () => {
    it('uploading through the crop dialog stores a custom set with maskable variants', async () => {
        await openSiteSettingsTab();
        // realistic file size — regression for the 413 from the 100kb parser
        await page.locator('feezal-sidebar-viewer #pwa-icon-file')
            .setInputFiles({name: 'logo.png', mimeType: 'image/png', buffer: bigPng()});

        // both sidebars host a dialog instance — scope to the settings one
        const dialog = page.locator('feezal-sidebar-viewer feezal-pwa-icon-dialog');
        await dialog.locator('.crop').waitFor({timeout: 15_000});
        await dialog.locator('sl-button[variant="primary"]').click();

        await expect.poll(async () => {
            const res = await fetch(`${stack.baseUrl}/api/sites/${SITE}/pwa-icons`);
            return (await res.json()).custom;
        }, {timeout: 15_000}).toBe(true);

        const manifest = await (await fetch(`${stack.baseUrl}/viewer/${SITE}/manifest.webmanifest`)).json();
        expect(manifest.icons.some(icon => icon.purpose === 'maskable')).toBe(true);
    });

    it('"Set as PWA icon" in the asset manager reuses the same dialog', async () => {
        // seed an asset, reload so the sidebar lists it
        const up = await fetch(`${stack.baseUrl}/api/assets/${SITE}?category=site&path=icon-src.png`,
            {method: 'POST', headers: {'Content-Type': 'image/png'}, body: PNG64});
        expect(up.status).toBeLessThan(300);
        await page.reload();
        await page.waitForSelector('feezal-palette .element', {timeout: 60_000});

        await page.locator('feezal-app-editor button[title="Assets"]').click();
        const tile = page.locator('feezal-sidebar-assets .tile[data-file="icon-src.png"]');
        await tile.waitFor({timeout: 10_000});
        await tile.click({button: 'right'});
        await page.locator('feezal-sidebar-assets .ctx-item', {hasText: 'Set as PWA icon'}).click();

        await page.locator('feezal-sidebar-assets feezal-pwa-icon-dialog .crop').waitFor({timeout: 15_000});
        await page.locator('feezal-sidebar-assets feezal-pwa-icon-dialog sl-button[variant="primary"]').click();

        // saving keeps/enables the toggle and refreshes the stored source
        await expect.poll(() => page.locator('feezal-sidebar-viewer')
            .evaluate(el => el.pwa), {timeout: 15_000}).toBe(true);
        const status = await (await fetch(`${stack.baseUrl}/api/sites/${SITE}/pwa-icons?include=source`)).json();
        expect(status.custom).toBe(true);
        expect(status.source?.name).toBe('source.png');
    });
});

describe('export', () => {
    it('the ZIP gains manifest, sw and icons', async () => {
        const res = await fetch(`${stack.baseUrl}/api/sites/${SITE}/export`);
        expect(res.status).toBe(200);
        const AdmZip = serverRequire('adm-zip');
        const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));
        const names = zip.getEntries().map(e => e.entryName);

        expect(names).toContain(`${SITE}/manifest.webmanifest`);
        expect(names).toContain(`${SITE}/sw.js`);
        expect(names).toContain(`${SITE}/icons/icon-192.png`);
        expect(names).toContain(`${SITE}/icons/maskable-512.png`);

        const html = zip.readAsText(`${SITE}/index.html`);
        expect(html).toContain('<link rel="manifest" href="manifest.webmanifest">');
        expect(html).toContain("location.protocol.startsWith('http')");
    });
});

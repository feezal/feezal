/**
 * A9 — editor-side PWA icon pipeline: real canvas conversions (sizes,
 * maskable safe-zone padding + background fill, SVG sources) and the crop
 * dialog's DOM (crop rectangle, always-visible safe-zone circle, previews).
 */
import {describe, it, expect, beforeEach, vi} from 'vitest';
import {generatePwaIcons, loadIconSource, blobToBase64, themeBackgroundColor, SAFE_ZONE}
    from '../src/feezal-pwa-icons.js';
import '../src/feezal-pwa-icon-dialog.js';
import {setupFeezal} from './helpers.js';

/** A red source image with a green top-left quadrant, as a File. */
async function makeSourceFile(size = 400) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(0, 0, size / 2, size / 2);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    return new File([blob], 'source.png', {type: 'image/png'});
}

async function pixelAt(blob, x, y) {
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    return [...ctx.getImageData(x, y, 1, 1).data];
}

beforeEach(() => {
    setupFeezal();
});

describe('generatePwaIcons()', () => {
    it('produces the full set at the right sizes', async () => {
        const img = await loadIconSource(await makeSourceFile());
        const icons = await generatePwaIcons(img, {x: 0, y: 0, size: 400}, '#0000ff');

        expect(Object.keys(icons).sort()).toEqual([
            'apple-touch-icon.png', 'icon-192.png', 'icon-512.png',
            'maskable-192.png', 'maskable-512.png'
        ]);
        expect((await createImageBitmap(icons['icon-192.png'])).width).toBe(192);
        expect((await createImageBitmap(icons['icon-512.png'])).width).toBe(512);
        expect((await createImageBitmap(icons['apple-touch-icon.png'])).width).toBe(180);
        expect((await createImageBitmap(icons['maskable-512.png'])).width).toBe(512);
    });

    it('crops correctly — a quadrant crop yields a uniform icon', async () => {
        const img = await loadIconSource(await makeSourceFile(400));
        const icons = await generatePwaIcons(img, {x: 0, y: 0, size: 200}, '#0000ff');
        // green quadrant only
        expect(await pixelAt(icons['icon-192.png'], 96, 96)).toEqual([0, 255, 0, 255]);
        expect(await pixelAt(icons['icon-192.png'], 5, 186)).toEqual([0, 255, 0, 255]);
    });

    it('maskable variants pad the content into the safe zone on the background colour', async () => {
        const img = await loadIconSource(await makeSourceFile(400));
        const icons = await generatePwaIcons(img, {x: 200, y: 200, size: 200}, '#0000ff');   // red area

        const m = icons['maskable-192.png'];
        // corners = background (outside the 80% safe zone)
        expect(await pixelAt(m, 2, 2)).toEqual([0, 0, 255, 255]);
        expect(await pixelAt(m, 189, 189)).toEqual([0, 0, 255, 255]);
        // centre = content
        expect(await pixelAt(m, 96, 96)).toEqual([255, 0, 0, 255]);
        // content edge sits at ~10% inset
        const inset = Math.round(192 * (1 - SAFE_ZONE) / 2);
        expect(await pixelAt(m, inset + 2, 96)).toEqual([255, 0, 0, 255]);
        expect(await pixelAt(m, inset - 3, 96)).toEqual([0, 0, 255, 255]);

        // the plain icon keeps full bleed — no padding
        expect(await pixelAt(icons['icon-192.png'], 2, 2)).toEqual([255, 0, 0, 255]);
    });

    it('accepts SVG sources', async () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">' +
            '<rect width="100" height="100" fill="#ff00ff"/></svg>';
        const img = await loadIconSource(new File([svg], 'icon.svg', {type: 'image/svg+xml'}));
        const icons = await generatePwaIcons(img, {x: 0, y: 0, size: 100}, '#000000');
        expect(await pixelAt(icons['icon-192.png'], 96, 96)).toEqual([255, 0, 255, 255]);
    });

    it('blobToBase64 round-trips', async () => {
        const b64 = await blobToBase64(new Blob(['hello']));
        expect(atob(b64)).toBe('hello');
    });

    it('themeBackgroundColor picks up --primary-background-color', () => {
        const site = document.createElement('div');
        site.style.setProperty('--primary-background-color', '#224466');
        document.body.append(site);
        window.feezal.site = site;
        expect(themeBackgroundColor()).toBe('#224466');
    });
});

describe('crop dialog', () => {
    it('shows the crop rectangle with the always-visible safe-zone circle', async () => {
        const dialog = document.createElement('feezal-pwa-icon-dialog');
        document.body.append(dialog);
        await dialog.open({site: 'x', source: await makeSourceFile(300)});
        await vi.waitFor(() => {
            const crop = dialog.shadowRoot.querySelector('.crop');
            expect(crop).not.toBeNull();
            expect(dialog.shadowRoot.querySelector('.crop .safe')).not.toBeNull();
            // initial crop: centred max square
            expect(Number.parseFloat(crop.style.width)).toBeGreaterThan(0);
        });
        // previews for both purposes exist
        expect(dialog.shadowRoot.querySelector('.pv.plain canvas')).not.toBeNull();
        expect(dialog.shadowRoot.querySelector('.pv.masked canvas')).not.toBeNull();
    });

    it('warns about small sources', async () => {
        const dialog = document.createElement('feezal-pwa-icon-dialog');
        document.body.append(dialog);
        await dialog.open({site: 'x', source: await makeSourceFile(128)});
        await vi.waitFor(() => {
            expect(dialog.shadowRoot.querySelector('.warning')?.textContent)
                .toContain('smaller than 512');
        });
    });

    it('restores a stored crop + colour for regeneration', async () => {
        const dialog = document.createElement('feezal-pwa-icon-dialog');
        document.body.append(dialog);
        await dialog.open({
            site: 'x',
            source: await makeSourceFile(400),
            meta: {crop: {x: 40, y: 40, size: 200}, backgroundColor: '#abcdef'},
        });
        await vi.waitFor(() => {
            expect(dialog._color).toBe('#abcdef');
            expect(dialog._naturalCrop().size).toBeGreaterThan(150);   // ≈200 after px rounding
        });
    });
});

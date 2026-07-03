import {describe, it, expect, vi, afterEach} from 'vitest';

import {SAFE_ZONE, blobToBase64, uploadPwaIcons, themeBackgroundColor} from '../src/feezal-pwa-icons.js';

// The canvas rendering itself (generatePwaIcons) needs a real 2D context and
// is exercised by the E2E layer — these tests cover the encode/upload/theme
// helpers around it.

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('SAFE_ZONE', () => {
    it('keeps maskable content inside the 80% safe zone', () => {
        expect(SAFE_ZONE).toBe(0.8);
    });
});

describe('blobToBase64()', () => {
    it('encodes blob content as base64 without the data-URL prefix', async () => {
        const b64 = await blobToBase64(new Blob(['hello'], {type: 'image/png'}));
        expect(b64).toBe(btoa('hello'));
    });
});

describe('uploadPwaIcons()', () => {
    function stubFetch(response = {ok: true}) {
        const fetch = vi.fn().mockResolvedValue(response);
        vi.stubGlobal('fetch', fetch);
        return fetch;
    }

    const blobs = {'icon-192.png': new Blob(['a']), 'icon-512.png': new Blob(['b'])};
    const meta = {crop: {x: 0, y: 0, size: 10}, backgroundColor: '#123456'};

    it('PUTs the base64-encoded icon set and meta to the site API', async () => {
        const fetch = stubFetch();
        await uploadPwaIcons('my site', blobs, null, meta);

        const [url, init] = fetch.mock.calls[0];
        expect(url).toBe('/api/sites/my%20site/pwa-icons');
        expect(init.method).toBe('PUT');
        const body = JSON.parse(init.body);
        expect(body.icons).toEqual({'icon-192.png': btoa('a'), 'icon-512.png': btoa('b')});
        expect(body.meta).toEqual(meta);
        expect(body.source).toBeUndefined();
    });

    it('includes the source file, defaulting the name for raw blobs', async () => {
        const fetch = stubFetch();
        await uploadPwaIcons('demo', blobs, new Blob(['src']), meta);
        const body = JSON.parse(fetch.mock.calls[0][1].body);
        expect(body.source).toEqual({name: 'source.png', data: btoa('src')});
    });

    it('throws the server error message on failure', async () => {
        stubFetch({ok: false, status: 400, json: async () => ({error: 'invalid crop'})});
        await expect(uploadPwaIcons('demo', blobs, null, meta)).rejects.toThrow('invalid crop');
    });

    it('falls back to the status code when the error body is not JSON', async () => {
        stubFetch({ok: false, status: 500, json: async () => { throw new Error('not json'); }});
        await expect(uploadPwaIcons('demo', blobs, null, meta)).rejects.toThrow('upload failed (500)');
    });
});

describe('themeBackgroundColor()', () => {
    it('resolves the theme variable to a hex color', () => {
        vi.stubGlobal('getComputedStyle', vi.fn(() => ({color: 'rgb(2, 132, 199)'})));
        expect(themeBackgroundColor()).toBe('#0284c7');
    });

    it('parses rgba() colors too', () => {
        vi.stubGlobal('getComputedStyle', vi.fn(() => ({color: 'rgba(27, 27, 27, 0.5)'})));
        expect(themeBackgroundColor()).toBe('#1b1b1b');
    });

    it('falls back to the default when the color cannot be parsed', () => {
        vi.stubGlobal('getComputedStyle', vi.fn(() => ({color: 'var(--unresolved)'})));
        expect(themeBackgroundColor()).toBe('#1b1b1b');
    });

    it('probes inside feezal.site when available and cleans up after itself', () => {
        vi.stubGlobal('getComputedStyle', vi.fn(() => ({color: 'rgb(0, 0, 0)'})));
        const site = document.createElement('div');
        feezal.site = site;
        expect(themeBackgroundColor()).toBe('#000000');
        expect(site.children).toHaveLength(0);
        expect(document.body.children).toHaveLength(0);
    });
});

/**
 * A9 Tier 1 — PWA support: manifest/service-worker builders, tag injection,
 * the per-site viewer routes (gated by viewer.pwa) and the pwa-icons API.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm, mkdir, writeFile, access} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';
import request from 'supertest';

const require = createRequire(import.meta.url);
const pwa = require('../src/build/pwa.js');
const FilesystemStorage = require('../src/storage/filesystem.js');
const createApiRouter = require('../src/routes/api.js');
const express = require('express');

const logger = {debug() {}, info() {}, warn() {}, error() {}};

let dataDir;
let wwwDir;
let storage;
let app;

beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'feezal-pwa-data-'));
    wwwDir = await mkdtemp(join(tmpdir(), 'feezal-pwa-www-'));

    // default icons fixture
    await mkdir(join(wwwDir, 'favicon'), {recursive: true});
    for (const f of ['web-app-manifest-192x192.png', 'web-app-manifest-512x512.png', 'apple-touch-icon.png']) {
        await writeFile(join(wwwDir, 'favicon', f), 'DEFAULT:' + f);
    }

    storage = new FilesystemStorage(dataDir);
    app = express();
    // mirror server/src/app.js parser ordering: the pwa-icons path gets the
    // large-limit parser FIRST — the default 100kb parser would 413 real
    // image uploads before the route is ever reached
    app.use('/api/sites/:name/pwa-icons', express.json({limit: '25mb'}));
    app.use(express.json());
    pwa.registerPwaRoutes(app, {storage, wwwDir});
    app.use('/api', createApiRouter(storage, wwwDir, logger));

    // two sites: one opted in, one not
    await storage.saveSite('pwasite', {html: '<feezal-site></feezal-site>', config: {viewer: {pwa: true}}});
    await storage.saveSite('plain', {html: '<feezal-site></feezal-site>', config: {viewer: {}}});
});

afterAll(async () => {
    await rm(dataDir, {recursive: true, force: true});
    await rm(wwwDir, {recursive: true, force: true});
});

describe('buildManifest()', () => {
    const icons = [
        {name: 'icon-192.png', file: '/x/icon-192.png'},
        {name: 'icon-512.png', file: '/x/icon-512.png'},
        {name: 'apple-touch-icon.png', file: '/x/apple-touch-icon.png'},
        {name: 'maskable-192.png', file: '/x/maskable-192.png'},
    ];

    it('keeps "any" and "maskable" purposes as separate entries', () => {
        const m = pwa.buildManifest({siteName: 's', startUrl: '/v/s', scope: '/v/s', iconBase: 'icons/', icons, meta: null});
        expect(m.display).toBe('standalone');
        // apple-touch-icon is head-link only, not a manifest icon
        expect(m.icons).toEqual([
            {src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
            {src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
            {src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable'},
        ]);
        expect(m.icons.some(i => i.purpose.includes(' '))).toBe(false);
    });

    it('uses the stored maskable background colour', () => {
        const m = pwa.buildManifest({siteName: 's', startUrl: '.', scope: '.', iconBase: 'icons/', icons: [], meta: {backgroundColor: '#123456'}});
        expect(m.background_color).toBe('#123456');
        expect(m.theme_color).toBe('#123456');
    });
});

describe('buildServiceWorker() / injectPwaTags()', () => {
    it('bakes the cache name and shell into the worker', () => {
        const sw = pwa.buildServiceWorker({cacheName: 'feezal-pwa-x', shell: ['./', 'icons/icon-192.png']});
        expect(sw).toContain('"feezal-pwa-x"');
        expect(sw).toContain('"icons/icon-192.png"');
        expect(sw).toContain("addEventListener('fetch'");
    });

    it('injects manifest link, theme colour and registration', () => {
        const out = pwa.injectPwaTags('<html><head></head><body></body></html>', {
            manifestUrl: 'manifest.webmanifest',
            appleTouchIconUrl: 'icons/apple-touch-icon.png',
            themeColor: '#111111',
            swUrl: 'sw.js',
        });
        expect(out).toContain('<link rel="manifest" href="manifest.webmanifest">');
        expect(out).toContain('<meta name="theme-color" content="#111111">');
        expect(out).toContain('<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">');
        expect(out).toContain("navigator.serviceWorker.register('sw.js')");
        expect(out).not.toContain('location.protocol');
    });

    it('guards the registration for file:// exports when asked', () => {
        const out = pwa.injectPwaTags('<html><head></head><body></body></html>', {
            manifestUrl: 'm', swUrl: 's', httpGuard: true,
        });
        expect(out).toContain("location.protocol.startsWith('http') &&");
    });
});

describe('viewer routes', () => {
    it('manifest 404s unless the site opts in', async () => {
        expect((await request(app).get('/viewer/plain/manifest.webmanifest')).status).toBe(404);
        expect((await request(app).get('/viewer/nosuchsite/sw.js')).status).toBe(404);
    });

    it('serves a per-site manifest with default icons', async () => {
        const res = await request(app).get('/viewer/pwasite/manifest.webmanifest');
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('pwasite');
        expect(res.body.start_url).toBe('/viewer/pwasite');
        expect(res.body.icons.map(i => i.src)).toEqual([
            '/viewer/pwasite/icons/icon-192.png',
            '/viewer/pwasite/icons/icon-512.png',
        ]);
        // defaults are not maskable-safe → only "any" purpose entries
        expect(res.body.icons.every(i => i.purpose === 'any')).toBe(true);
    });

    it('serves the service worker with the shell baked in', async () => {
        const res = await request(app).get('/viewer/pwasite/sw.js');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('javascript');
        expect(res.text).toContain('"/viewer/pwasite"');
        expect(res.text).toContain('"/viewer-bundle.js"');
    });

    it('serves default icons and prefers a custom set once present', async () => {
        const before = await request(app).get('/viewer/pwasite/icons/icon-192.png');
        expect(before.status).toBe(200);
        expect(before.body.toString()).toBe('DEFAULT:web-app-manifest-192x192.png');

        await mkdir(join(dataDir, 'sites', 'pwasite', 'pwa'), {recursive: true});
        await writeFile(join(dataDir, 'sites', 'pwasite', 'pwa', 'icon-192.png'), 'CUSTOM-192');
        const after = await request(app).get('/viewer/pwasite/icons/icon-192.png');
        expect(after.body.toString()).toBe('CUSTOM-192');

        // custom set present → maskable entries appear in the manifest
        await writeFile(join(dataDir, 'sites', 'pwasite', 'pwa', 'maskable-192.png'), 'CUSTOM-M192');
        const manifest = await request(app).get('/viewer/pwasite/manifest.webmanifest');
        expect(manifest.body.icons.some(i => i.purpose === 'maskable')).toBe(true);

        await rm(join(dataDir, 'sites', 'pwasite', 'pwa'), {recursive: true, force: true});
    });

    it('rejects unknown icon names and unsafe site names', async () => {
        expect((await request(app).get('/viewer/pwasite/icons/evil.js')).status).toBe(404);
        expect((await request(app).get('/viewer/..%2F..%2Fetc/icons/icon-192.png')).status).toBe(404);
    });
});

describe('pwa-icons API', () => {
    const b64 = s => Buffer.from(s).toString('base64');

    it('stores a generated set + source + meta and reports it', async () => {
        const put = await request(app).put('/api/sites/pwasite/pwa-icons').send({
            icons: {
                'icon-192.png': b64('I192'),
                'icon-512.png': b64('I512'),
                'apple-touch-icon.png': b64('APPLE'),
                'maskable-192.png': b64('M192'),
                'maskable-512.png': b64('M512'),
            },
            source: {name: 'logo.svg', data: b64('<svg/>')},
            meta: {crop: {x: 1, y: 2, size: 3}, backgroundColor: '#abcdef'},
        });
        expect(put.status).toBe(201);
        await access(join(dataDir, 'sites', 'pwasite', 'pwa', 'icon-512.png'));
        await access(join(dataDir, 'sites', 'pwasite', 'pwa', 'source.svg'));

        const status = await request(app).get('/api/sites/pwasite/pwa-icons');
        expect(status.body.custom).toBe(true);
        expect(status.body.meta).toMatchObject({backgroundColor: '#abcdef', source: 'source.svg'});

        const withSource = await request(app).get('/api/sites/pwasite/pwa-icons?include=source');
        expect(withSource.body.source).toEqual({name: 'source.svg', data: b64('<svg/>')});

        // manifest picks up the stored background colour
        const manifest = await request(app).get('/viewer/pwasite/manifest.webmanifest');
        expect(manifest.body.background_color).toBe('#abcdef');
    });

    it('accepts realistic image sizes (regression: 413 from the default 100kb parser)', async () => {
        // a real 512px photo icon set easily exceeds the default json limit
        const big = Buffer.alloc(400 * 1024, 7).toString('base64');
        const res = await request(app).put('/api/sites/pwasite/pwa-icons').send({
            icons: {'icon-192.png': big, 'icon-512.png': big},
            source: {name: 'photo.jpg', data: big},
            meta: {backgroundColor: '#101010'},
        });
        expect(res.status).toBe(201);
        await access(join(dataDir, 'sites', 'pwasite', 'pwa', 'icon-512.png'));
    });

    it('rejects unknown icon names and bad source extensions', async () => {
        const badName = await request(app).put('/api/sites/pwasite/pwa-icons')
            .send({icons: {'evil.sh': b64('x')}});
        expect(badName.status).toBe(400);

        const badExt = await request(app).put('/api/sites/pwasite/pwa-icons')
            .send({icons: {'icon-192.png': b64('x')}, source: {name: 'x.exe', data: b64('x')}});
        expect(badExt.status).toBe(400);
    });

    it('DELETE resets to the default icons', async () => {
        const del = await request(app).delete('/api/sites/pwasite/pwa-icons');
        expect(del.status).toBe(204);
        const status = await request(app).get('/api/sites/pwasite/pwa-icons');
        expect(status.body.custom).toBe(false);
        const icon = await request(app).get('/viewer/pwasite/icons/icon-192.png');
        expect(icon.body.toString()).toBe('DEFAULT:web-app-manifest-192x192.png');
    });
});

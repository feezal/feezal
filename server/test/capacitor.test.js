/**
 * A9 Tier 2a — Capacitor project export: appId derivation, scaffold content,
 * README generation and the export-capacitor route.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm, mkdir, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';
import request from 'supertest';

const require = createRequire(import.meta.url);
const capacitor = require('../src/build/capacitor.js');
const FilesystemStorage = require('../src/storage/filesystem.js');
const createApiRouter = require('../src/routes/api.js');
const express = require('express');
const AdmZip = require('adm-zip');

const logger = {debug() {}, info() {}, warn() {}, error() {}};

describe('deriveAppId()', () => {
    it('slugs site names into valid reverse-DNS ids', () => {
        expect(capacitor.deriveAppId('My Dashboard')).toBe('io.feezal.mydashboard');
        expect(capacitor.deriveAppId('Wohnzimmer-Übersicht')).toBe('io.feezal.wohnzimmeruebersicht');
        expect(capacitor.deriveAppId('straße 3')).toBe('io.feezal.strasse3');
    });

    it('never starts a segment with a digit and never goes empty', () => {
        expect(capacitor.deriveAppId('42things')).toBe('io.feezal.app42things');
        expect(capacitor.deriveAppId('!!!')).toBe('io.feezal.app');
    });
});

describe('isLocalhostUri()', () => {
    it('flags loopback hosts only', () => {
        expect(capacitor.isLocalhostUri('ws://localhost:9001')).toBe(true);
        expect(capacitor.isLocalhostUri('ws://127.0.0.1/mqtt')).toBe(true);
        expect(capacitor.isLocalhostUri('wss://broker.example:8884')).toBe(false);
        expect(capacitor.isLocalhostUri('ws://localhost.example.com')).toBe(false);
        expect(capacitor.isLocalhostUri(undefined)).toBe(false);
    });
});

describe('scaffold builders', () => {
    it('package.json pins capacitor and ships the convenience scripts', () => {
        const pkg = JSON.parse(capacitor.buildPackageJson({appName: 'My Home'}));
        expect(pkg.name).toBe('my-home');
        expect(pkg.scripts.android).toContain('platform.mjs android');
        expect(pkg.scripts.ios).toContain('platform.mjs ios');
        expect(pkg.scripts.assets).toContain('capacitor-assets');
        for (const dep of ['@capacitor/cli', '@capacitor/android', '@capacitor/ios', '@capacitor/assets']) {
            expect(pkg.devDependencies[dep]).toBeDefined();
        }
        expect(pkg.dependencies['@capacitor/core']).toMatch(/^\^7/);
    });

    it('capacitor.config.json carries appId/appName/webDir and allows cleartext ws://', () => {
        const cfg = JSON.parse(capacitor.buildCapacitorConfig({appId: 'io.feezal.x', appName: 'X'}));
        expect(cfg).toEqual({
            appId: 'io.feezal.x',
            appName: 'X',
            webDir: 'www',
            server: {cleartext: true},
        });
    });

    it('README documents the three-command flow and the free-Apple-ID caveat', () => {
        const readme = capacitor.buildReadme({
            appName: 'Wohnzimmer', appId: 'io.feezal.wohnzimmer',
            connectionUri: 'ws://broker.lan:9001', hasIcon: true,
        });
        expect(readme).toContain('# Wohnzimmer');
        expect(readme).toContain('npm install');
        expect(readme).toContain('npm run android');
        expect(readme).toContain('npm run assets');
        expect(readme).toContain('USB debugging');
        expect(readme).toContain('7 days');
        expect(readme).toContain('ws://broker.lan:9001');
        expect(readme).not.toContain('⚠️');
    });

    it('README warns loudly about localhost brokers', () => {
        const readme = capacitor.buildReadme({
            appName: 'X', appId: 'io.feezal.x',
            connectionUri: 'ws://localhost:9001', hasIcon: false,
        });
        expect(readme).toContain('⚠️');
        expect(readme).toContain('localhost');
        // no icon → the assets step becomes optional advice
        expect(readme).toContain('*(optional)*');
    });
});

describe('export-capacitor route', () => {
    let dataDir;
    let wwwDir;
    let app;

    beforeAll(async () => {
        dataDir = await mkdtemp(join(tmpdir(), 'feezal-cap-data-'));
        wwwDir = await mkdtemp(join(tmpdir(), 'feezal-cap-www-'));
        await mkdir(join(wwwDir, 'src'), {recursive: true});
        await mkdir(join(wwwDir, 'favicon'), {recursive: true});
        await writeFile(join(wwwDir, 'favicon', 'web-app-manifest-512x512.png'), 'DEFAULT-512');

        // fake vite (same fixture pattern as export.test.js)
        const viteDir = join(wwwDir, 'node_modules', 'vite', 'dist', 'node');
        await mkdir(viteDir, {recursive: true});
        await writeFile(join(wwwDir, 'node_modules', 'vite', 'package.json'),
            JSON.stringify({name: 'vite', version: '0.0.0-test', type: 'module'}));
        await writeFile(join(viteDir, 'index.js'),
            'export async function build() { return {output: [{type: "chunk", isEntry: true, code: "//BUNDLE"}]}; }');

        const storage = new FilesystemStorage(dataDir);
        await storage.saveSite('mysite', {
            html: '<feezal-site><feezal-view name="a"></feezal-view></feezal-site>',
            config: {
                viewer: {pwa: true, app: {name: 'Stored Name', id: 'io.feezal.storedid'}},
                connection: {backend: 'mqtt', uri: 'ws://broker.lan:9001'},
            },
        });
        await storage.saveSite('tcp', {
            html: '<feezal-site></feezal-site>',
            config: {connection: {backend: 'mqtt', uri: 'mqtt://broker.lan:1883'}},
        });

        app = express();
        app.use(express.json());
        app.use('/api', createApiRouter(storage, wwwDir, logger));
    });

    afterAll(async () => {
        await rm(dataDir, {recursive: true, force: true});
        await rm(wwwDir, {recursive: true, force: true});
    });

    it('exports the full project scaffold with the web bundle under www/', async () => {
        const res = await request(app).get('/api/sites/mysite/export-capacitor').buffer().parse(
            (r, cb) => { const chunks = []; r.on('data', c => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks))); });
        expect(res.status).toBe(200);
        expect(res.headers['content-disposition']).toContain('stored-name-app.zip');

        const zip = new AdmZip(res.body);
        const names = zip.getEntries().filter(e => !e.isDirectory).map(e => e.entryName).sort();
        expect(names).toEqual([
            'stored-name/README.md',
            'stored-name/capacitor.config.json',
            'stored-name/package.json',
            'stored-name/resources/icon.png',
            'stored-name/scripts/platform.mjs',
            'stored-name/www/index.html',
        ]);

        // persisted viewer.app values are the defaults
        const cfg = JSON.parse(zip.readAsText('stored-name/capacitor.config.json'));
        expect(cfg.appId).toBe('io.feezal.storedid');
        expect(cfg.appName).toBe('Stored Name');

        // the WebView app carries no service worker even though pwa is on
        const html = zip.readAsText('stored-name/www/index.html');
        expect(html).not.toContain('serviceWorker');
        expect(html).not.toContain('manifest.webmanifest');

        // default icon fallback (no custom pwa set for this site)
        expect(zip.readAsText('stored-name/resources/icon.png')).toBe('DEFAULT-512');
    });

    it('query parameters override the stored app name/id', async () => {
        const res = await request(app)
            .get('/api/sites/mysite/export-capacitor?appName=Other&appId=org.example.other')
            .buffer().parse((r, cb) => { const chunks = []; r.on('data', c => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks))); });
        const zip = new AdmZip(res.body);
        const cfg = JSON.parse(zip.readAsText('other/capacitor.config.json'));
        expect(cfg).toMatchObject({appId: 'org.example.other', appName: 'Other'});
        expect(zip.readAsText('other/README.md')).toContain('# Other');
    });

    it('prefers the custom PWA icon as the resources source', async () => {
        await mkdir(join(dataDir, 'sites', 'mysite', 'pwa'), {recursive: true});
        await writeFile(join(dataDir, 'sites', 'mysite', 'pwa', 'icon-512.png'), 'CUSTOM-512');
        const res = await request(app).get('/api/sites/mysite/export-capacitor')
            .buffer().parse((r, cb) => { const chunks = []; r.on('data', c => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks))); });
        const zip = new AdmZip(res.body);
        expect(zip.readAsText('stored-name/resources/icon.png')).toBe('CUSTOM-512');
    });

    it('rejects malformed appIds and mqtt:// connections', async () => {
        const bad = await request(app).get('/api/sites/mysite/export-capacitor?appId=1nvalid');
        expect(bad.status).toBe(400);

        const tcp = await request(app).get('/api/sites/tcp/export-capacitor');
        expect(tcp.status).toBe(422);
        expect(tcp.body.error).toContain('ws://');
    });
});

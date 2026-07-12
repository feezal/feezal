/**
 * N27 — the live viewer loads user-installed element/theme packages: the
 * viewer route injects <script type="module" src="/user-elements/…"> tags
 * for exactly the installed packages the site uses, and the /user-elements
 * static route serves the bundles.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm, mkdir, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';
import request from 'supertest';

const require = createRequire(import.meta.url);
const createApp = require('../src/app.js');
const FilesystemStorage = require('../src/storage/filesystem.js');

const logger = {debug() {}, info() {}, warn() {}, error() {}};

let dataDir, wwwDir, app, io;

async function installFakePkg(rel, json, code = '/* bundle */') {
    const dir = join(dataDir, 'elements', ...rel.split('/'));
    await mkdir(dir, {recursive: true});
    await writeFile(join(dir, 'package.json'), JSON.stringify(json));
    await writeFile(join(dir, 'index.js'), code);
}

beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'feezal-n27-data-'));
    wwwDir = await mkdtemp(join(tmpdir(), 'feezal-n27-www-'));

    await installFakePkg('@feezal/feezal-element-acme-widget',
        {name: '@feezal/feezal-element-acme-widget', main: 'index.js', feezal: {type: 'element'}},
        '/* acme-widget-bundle */');
    await installFakePkg('@feezal/feezal-element-acme-unused',
        {name: '@feezal/feezal-element-acme-unused', main: 'index.js', feezal: {type: 'element'}});
    await installFakePkg('@feezal/feezal-elements-metro',
        {name: '@feezal/feezal-elements-metro', main: 'index.js',
            feezal: {type: 'elements', elements: ['feezal-element-metro-tile', 'feezal-element-metro-appbar']}});
    await installFakePkg('@feezal/feezal-theme-lcars',
        {name: '@feezal/feezal-theme-lcars', main: 'index.js', feezal: {type: 'theme'}});

    const storage = new FilesystemStorage(dataDir);
    storage._logger = logger;
    await storage.saveSite('n27site', {
        html: '<feezal-site publish="site/pub"><feezal-view name="main">'
            + '<feezal-element-acme-widget></feezal-element-acme-widget>'
            + '<feezal-element-metro-tile></feezal-element-metro-tile>'
            + '</feezal-view></feezal-site>',
        config: {viewer: {theme: 'feezal-theme-lcars'}},
    });

    ({app, io} = await createApp({wwwDir, storage, logger}));
});

afterAll(async () => {
    io.close();
    await rm(dataDir, {recursive: true, force: true});
    await rm(wwwDir, {recursive: true, force: true});
});

describe('viewer page (N27)', () => {
    it('injects module scripts for used installed packages, the family bundle once, and the active theme', async () => {
        const res = await request(app).get('/viewer/n27site');
        expect(res.status).toBe(200);
        expect(res.text).toContain('<script type="module" src="/user-elements/@feezal/feezal-element-acme-widget/index.js">');
        expect(res.text).toContain('<script type="module" src="/user-elements/@feezal/feezal-elements-metro/index.js">');
        expect(res.text).toContain('<script type="module" src="/user-elements/@feezal/feezal-theme-lcars/index.js">');
        // a single script per package, and nothing for unused packages
        expect(res.text.match(/feezal-elements-metro\/index\.js/g)).toHaveLength(1);
        expect(res.text).not.toContain('feezal-element-acme-unused');
    });

    it('serves the referenced bundle from /user-elements/', async () => {
        const res = await request(app).get('/user-elements/@feezal/feezal-element-acme-widget/index.js');
        expect(res.status).toBe(200);
        expect(res.text).toBe('/* acme-widget-bundle */');
    });
});

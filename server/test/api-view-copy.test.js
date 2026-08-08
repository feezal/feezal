/**
 * U109 — POST /api/sites/:name/views: insert a copied <feezal-view> into
 * another site's SAVED markup. Name deduped against the target (-copy
 * numbering); response reports component definitions the target lacks and
 * foreign site-asset references (v1 copies markup only, the editor warns).
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {mkdtemp, rm} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';
import {createRequire} from 'module';
import request from 'supertest';

const require = createRequire(import.meta.url);
const FilesystemStorage = require('../src/storage/filesystem.js');
const createApiRouter  = require('../src/routes/api.js');
const express          = require('express');

let dataDir;
let app;
let storage;

const VIEW = '<feezal-view name="garden" style="width:100%">' +
    '<feezal-element-basic-number style="top:10px"></feezal-element-basic-number>' +
    '</feezal-view>';

beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'feezal-viewcopy-'));
    storage = new FilesystemStorage(dataDir);
    const a = express();
    a.use(express.json());
    const logger = {debug() {}, info() {}, warn() {}, error() {}};
    a.use('/api', createApiRouter(storage, '/dev/null', logger));
    app = a;

    await storage.saveSite('target', {
        html: '<feezal-site><feezal-view name="main"></feezal-view></feezal-site>',
        config: {},
    });
});

afterAll(async () => {
    await rm(dataDir, {recursive: true, force: true});
});

describe('POST /api/sites/:name/views (U109)', () => {
    it('rejects anything that is not a feezal-view fragment', async () => {
        for (const html of [undefined, '', '<div>x</div>', '<feezal-element-basic-number>']) {
            const res = await request(app).post('/api/sites/target/views').send({html});
            expect(res.status).toBe(400);
        }
    });

    it('inserts the view before </feezal-site>, keeping a free name', async () => {
        const res = await request(app).post('/api/sites/target/views').send({html: VIEW});
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('garden');
        expect(res.body.missingComponents).toEqual([]);
        expect(res.body.assetRefs).toEqual([]);

        const site = await storage.getSite('target');
        expect(site.html).toContain('name="garden"');
        expect(site.html.trim().endsWith('</feezal-site>')).toBe(true);
        // inserted INSIDE the site, after the existing view
        expect(site.html.indexOf('name="garden"')).toBeGreaterThan(site.html.indexOf('name="main"'));
    });

    it('dedupes a colliding name with -copy numbering', async () => {
        const first = await request(app).post('/api/sites/target/views').send({html: VIEW});
        expect(first.body.name).toBe('garden-copy');
        const second = await request(app).post('/api/sites/target/views').send({html: VIEW});
        expect(second.body.name).toBe('garden-copy1');

        const site = await storage.getSite('target');
        expect([...site.html.matchAll(/name="(garden[^"]*)"/g)].map(m => m[1]).sort())
            .toEqual(['garden', 'garden-copy', 'garden-copy1']);
        // the element content travelled each time
        expect(site.html.match(/feezal-element-basic-number/g).length).toBeGreaterThanOrEqual(3);
    });

    it('reports component definitions the target lacks — and stays silent for present ones', async () => {
        await storage.saveSite('withdef', {
            html: '<feezal-site><template feezal-component="gaugecard"></template></feezal-site>',
            config: {},
        });
        const view = '<feezal-view name="v"><feezal-component name="gaugecard"></feezal-component>' +
            '<feezal-component name="unknowncard"></feezal-component></feezal-view>';
        const res = await request(app).post('/api/sites/withdef/views').send({html: view});
        expect(res.status).toBe(200);
        expect(res.body.missingComponents).toEqual(['unknowncard']);
    });

    it('reports foreign site-asset references; global assets are fine', async () => {
        const view = '<feezal-view name="a" style="background:url(/assets/othersite/bg.png)">' +
            '<img src="/assets/global/logo.png"><img src="/assets/target/ok.png"></feezal-view>';
        const res = await request(app).post('/api/sites/target/views').send({html: view});
        expect(res.status).toBe(200);
        expect(res.body.assetRefs).toEqual(['/assets/othersite/bg.png']);
    });
});

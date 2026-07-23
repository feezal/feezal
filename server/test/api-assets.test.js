/**
 * Integration tests for the /api/assets/* endpoints (upload, list, rename,
 * mkdir, delete, transfer). The transfer+unique path is the copy-on-use of a
 * global asset (A14/B15) exercised end-to-end through the router.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm, readFile} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';
import request from 'supertest';

const require = createRequire(import.meta.url);
const FilesystemStorage = require('../src/storage/filesystem.js');
const createApiRouter = require('../src/routes/api.js');
const {configureBodyParsers} = require('../src/app.js');
const express = require('express');

const silent = {debug() {}, info() {}, warn() {}, error() {}};

let dataDir, app, storage;
beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'feezal-api-assets-'));
    storage = new FilesystemStorage(dataDir);
    storage._logger = silent;
    app = express();
    // Use the production body-parser ordering (incl. the raw-asset upload
    // carve-out) so uploads behave exactly as they do in the real server.
    configureBodyParsers(app);
    app.use('/api', createApiRouter(storage, '/dev/null', silent));
});
afterEach(async () => { await rm(dataDir, {recursive: true, force: true}); });

const upload = (site, path, category, body) =>
    request(app).post(`/api/assets/${site}?path=${encodeURIComponent(path)}&category=${category}`)
        .set('Content-Type', 'application/octet-stream').send(body);

describe('upload + list', () => {
    it('uploads a site asset and lists it', async () => {
        const res = await upload('s', 'a.png', 'site', Buffer.from('AAA'));
        expect(res.status).toBe(201);
        expect(res.body).toEqual({path: 'a.png', category: 'site'});

        const list = await request(app).get('/api/assets/s');
        expect(list.status).toBe(200);
        expect(list.body.site.map(f => f.path)).toEqual(['a.png']);
    });

    it('accepts a multi-MB upload (server limit is well above the nginx 1 MB default)', async () => {
        // 8 MB — over nginx's 1 MB default (the usual 413 culprit) and the
        // ~20 MB the docs promise, but under the server's own 50 MB cap.
        const big = Buffer.alloc(8 * 1024 * 1024, 7);
        const res = await upload('s', 'big.bin', 'site', big);
        expect(res.status).toBe(201);
        const list = await request(app).get('/api/assets/s');
        expect(list.body.site.map(f => f.path)).toContain('big.bin');
    });

    it('rejects an upload without a path query param', async () => {
        const res = await request(app).post('/api/assets/s')
            .set('Content-Type', 'application/octet-stream').send(Buffer.from('x'));
        expect(res.status).toBe(400);
    });

    it('rejects a traversal path with 400', async () => {
        const res = await upload('s', '../evil.png', 'site', Buffer.from('x'));
        expect(res.status).toBe(400);
    });

    it('stores a JSON asset sent as application/json byte-exact (Lottie regression)', async () => {
        // A Lottie animation is uploaded with Content-Type: application/json.
        // The global JSON parser must NOT objectify it — the raw bytes have to
        // reach express.raw and disk. Previously this failed with "data ...
        // received an instance of Object" (only JSON uploads broke; images/PDFs
        // carry a non-JSON content-type and were unaffected).
        const lottie = JSON.stringify({v: '5.7.4', fr: 30, layers: [{ty: 4, nm: 'shape'}]});
        const res = await request(app)
            .post('/api/assets/s?path=Success.json&category=site')
            .set('Content-Type', 'application/json')
            .send(lottie);
        expect(res.status).toBe(201);
        // Stored byte-exact (not re-serialised / objectified).
        const stored = await readFile(join(storage._assetBase('site', 's'), 'Success.json'), 'utf8');
        expect(stored).toBe(lottie);
        const list = await request(app).get('/api/assets/s');
        expect(list.body.site.map(f => f.path)).toContain('Success.json');
    });
});

describe('rename + mkdir + delete', () => {
    it('renames an asset', async () => {
        await upload('s', 'a.png', 'site', Buffer.from('x'));
        const res = await request(app).patch('/api/assets/s').send({category: 'site', oldPath: 'a.png', newPath: 'b.png'});
        expect(res.status).toBe(200);
        const list = await request(app).get('/api/assets/s');
        expect(list.body.site.map(f => f.path)).toEqual(['b.png']);
    });

    it('rejects rename without both paths', async () => {
        const res = await request(app).patch('/api/assets/s').send({category: 'site', oldPath: 'a.png'});
        expect(res.status).toBe(400);
    });

    it('creates a folder', async () => {
        const res = await request(app).post('/api/assets/s/mkdir').send({category: 'site', path: 'icons'});
        expect(res.status).toBe(201);
        const list = await request(app).get('/api/assets/s');
        expect(list.body.siteDirs).toContain('icons');
    });

    it('deletes an asset', async () => {
        await upload('s', 'a.png', 'site', Buffer.from('x'));
        const del = await request(app).delete('/api/assets/s?path=a.png&category=site');
        expect(del.status).toBe(204);
        const list = await request(app).get('/api/assets/s');
        expect(list.body.site).toEqual([]);
    });
});

describe('transfer (copy-on-use, unique)', () => {
    it('copies a global asset into the site and dedups identical re-drags (B15)', async () => {
        await upload('s', 'logo.png', 'global', Buffer.from('LOGO'));

        const first = await request(app).post('/api/assets/s/transfer')
            .send({srcCategory: 'global', srcPath: 'logo.png', destCategory: 'site', destPath: 'logo.png', copy: true, unique: true});
        expect(first.status).toBe(200);
        expect(first.body.path).toBe('logo.png');

        // Re-drag of the byte-identical file → same path, no duplicate.
        const second = await request(app).post('/api/assets/s/transfer')
            .send({srcCategory: 'global', srcPath: 'logo.png', destCategory: 'site', destPath: 'logo.png', copy: true, unique: true});
        expect(second.body.path).toBe('logo.png');

        const list = await request(app).get('/api/assets/s');
        expect(list.body.site.map(f => f.path)).toEqual(['logo.png']);
    });

    it('validates required fields and category values', async () => {
        const missing = await request(app).post('/api/assets/s/transfer').send({srcCategory: 'global'});
        expect(missing.status).toBe(400);

        const badCat = await request(app).post('/api/assets/s/transfer')
            .send({srcCategory: 'nope', srcPath: 'a', destCategory: 'site', destPath: 'a'});
        expect(badCat.status).toBe(400);
    });

    it('a move rewrites asset references in the site markup', async () => {
        await storage.saveSite('s', {html: '<img src="/assets/global/pic.png">', config: {}});
        await upload('s', 'pic.png', 'global', Buffer.from('PIC'));

        const res = await request(app).post('/api/assets/s/transfer')
            .send({srcCategory: 'global', srcPath: 'pic.png', destCategory: 'site', destPath: 'pic.png', copy: false});
        expect(res.status).toBe(200);

        const {html} = await storage.getSite('s');
        expect(html).toContain('/assets/s/pic.png');
        expect(html).not.toContain('/assets/global/pic.png');
    });
});

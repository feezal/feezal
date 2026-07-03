/**
 * Integration tests for the git-backed version-history endpoints and the TLS
 * certificate endpoints. History content assertions are git-gated; the
 * validation paths and the cert file storage run everywhere.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';
import request from 'supertest';

const require = createRequire(import.meta.url);
const FilesystemStorage = require('../src/storage/filesystem.js');
const createApiRouter = require('../src/routes/api.js');
const git = require('../src/build/git.js');
const express = require('express');

const hasGit = await git.isGitAvailable();
const silent = {debug() {}, info() {}, warn() {}, error() {}};

let dataDir, app, storage;
beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'feezal-api-hist-'));
    storage = new FilesystemStorage(dataDir);
    storage._logger = silent;
    app = express();
    app.use(express.json());
    app.use('/api', createApiRouter(storage, '/dev/null', silent));
});
afterEach(async () => { await rm(dataDir, {recursive: true, force: true}); });

describe('history — validation (no git required)', () => {
    it('rejects a malformed sha on restore', async () => {
        const res = await request(app).post('/api/sites/s/history/ZZZ/restore').send({});
        expect(res.status).toBe(400);
    });

    it('rejects a malformed sha / path on the file endpoint', async () => {
        expect((await request(app).get('/api/sites/s/history/ZZZ/file?path=site.html')).status).toBe(400);
        expect((await request(app).get('/api/sites/s/history/abcdef1/file?path=../etc')).status).toBe(400);
    });
});

describe.skipIf(!hasGit)('history — with git', () => {
    it('lists commits and reads a file at a commit', async () => {
        await storage.saveSite('s', {html: '<v1/>', config: {}});
        await storage.saveSite('s', {html: '<v2/>', config: {}});

        const hist = await request(app).get('/api/sites/s/history');
        expect(hist.status).toBe(200);
        expect(hist.body.supported).toBe(true);
        expect(hist.body.history.length).toBeGreaterThanOrEqual(2);

        const oldest = hist.body.history[hist.body.history.length - 1].sha;
        const file = await request(app).get(`/api/sites/s/history/${oldest}/file?path=site.html`);
        expect(file.status).toBe(200);
        expect(file.text).toBe('<v1/>');
    });

    it('restores a past version (non-destructive)', async () => {
        await storage.saveSite('s', {html: '<v1/>', config: {}});
        await storage.saveSite('s', {html: '<v2/>', config: {}});
        const hist = await request(app).get('/api/sites/s/history');
        const oldest = hist.body.history[hist.body.history.length - 1].sha;

        const res = await request(app).post(`/api/sites/s/history/${oldest}/restore`).send({label: 'v1'});
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        const after = await storage.getSite('s');
        expect(after.html).toBe('<v1/>');
    });
});

describe('certs', () => {
    const PEM = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';

    it('stores, reports presence of, and deletes a cert', async () => {
        const post = await request(app).post('/api/sites/s/certs').send({type: 'ca', pem: PEM});
        expect(post.status).toBe(201);

        const list = await request(app).get('/api/sites/s/certs');
        expect(list.status).toBe(200);
        expect(list.body.ca).toBe(true);
        expect(list.body.cert).toBe(false);

        const del = await request(app).delete('/api/sites/s/certs/ca');
        expect(del.status).toBe(204);
        expect((await request(app).get('/api/sites/s/certs')).body.ca).toBe(false);
    });

    it('validates the cert type and PEM shape', async () => {
        expect((await request(app).post('/api/sites/s/certs').send({type: 'bogus', pem: PEM})).status).toBe(400);
        expect((await request(app).post('/api/sites/s/certs').send({type: 'ca', pem: 'not pem'})).status).toBe(400);
    });

    it('404s when deleting a cert that is not present', async () => {
        expect((await request(app).delete('/api/sites/s/certs/key')).status).toBe(404);
    });
});

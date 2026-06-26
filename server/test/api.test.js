/**
 * Integration tests for the REST API.
 *
 * Spins up the Express app in-process (no network MQTT, no element scanning)
 * and exercises the /api/sites/* endpoints via supertest.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';
import request from 'supertest';

const require = createRequire(import.meta.url);
const FilesystemStorage = require('../src/storage/filesystem.js');
const createApiRouter  = require('../src/routes/api.js');
const express          = require('express');

// Stand up a minimal Express app with just the API router (no auth, no socket.io)
function buildTestApp(storage) {
    const app = express();
    app.use(express.json());
    const logger = {debug() {}, info() {}, warn() {}, error() {}};
    app.use('/api', createApiRouter(storage, '/dev/null', logger));
    return app;
}

let dataDir;
let app;

beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'feezal-api-test-'));
    const storage = new FilesystemStorage(dataDir);
    app = buildTestApp(storage);
});

afterAll(async () => {
    await rm(dataDir, {recursive: true, force: true});
});

describe('GET /api/sites', () => {
    it('returns 200 with an empty sites list on fresh data dir', async () => {
        const res = await request(app).get('/api/sites');
        expect(res.status).toBe(200);
        expect(res.body.sites).toEqual([]);
    });
});

describe('POST /api/sites', () => {
    it('returns 400 when name is missing', async () => {
        const res = await request(app).post('/api/sites').send({});
        expect(res.status).toBe(400);
    });

    it('creates a site and returns 201', async () => {
        const res = await request(app).post('/api/sites').send({name: 'testsite'});
        expect(res.status).toBe(201);
        expect(res.body.name).toBe('testsite');
    });

    it('new site appears in GET /api/sites', async () => {
        await request(app).post('/api/sites').send({name: 'visible'});
        const res = await request(app).get('/api/sites');
        expect(res.body.sites).toContain('visible');
    });
});

describe('PATCH /api/sites/:name (rename)', () => {
    it('returns 400 when newName is missing', async () => {
        await request(app).post('/api/sites').send({name: 'torem'});
        const res = await request(app).patch('/api/sites/torem').send({});
        expect(res.status).toBe(400);
    });

    it('renames a site', async () => {
        await request(app).post('/api/sites').send({name: 'before'});
        const res = await request(app).patch('/api/sites/before').send({newName: 'after'});
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('after');
    });
});

describe('POST /api/sites/:name/clone', () => {
    it('returns 400 when newName is missing', async () => {
        await request(app).post('/api/sites').send({name: 'src'});
        const res = await request(app).post('/api/sites/src/clone').send({});
        expect(res.status).toBe(400);
    });

    it('clones a site', async () => {
        await request(app).post('/api/sites').send({name: 'original2'});
        const res = await request(app).post('/api/sites/original2/clone').send({newName: 'copy2'});
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('copy2');
    });
});

describe('DELETE /api/sites/:name', () => {
    it('returns 204 and removes the site', async () => {
        await request(app).post('/api/sites').send({name: 'todelete'});
        const del = await request(app).delete('/api/sites/todelete');
        expect(del.status).toBe(204);
        const list = await request(app).get('/api/sites');
        expect(list.body.sites).not.toContain('todelete');
    });
});

describe('GET /api/topics/completions', () => {
    it('returns an empty completions array when no hub is wired', async () => {
        const res = await request(app).get('/api/topics/completions?prefix=home/');
        expect(res.status).toBe(200);
        expect(res.body.completions).toEqual([]);
    });
});

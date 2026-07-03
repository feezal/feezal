/**
 * Integration tests for the /api/themes endpoints: slug derivation, CSS-prop
 * sanitisation, listing and deletion.
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
const express = require('express');

const silent = {debug() {}, info() {}, warn() {}, error() {}};

let dataDir, app;
beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'feezal-api-themes-'));
    const storage = new FilesystemStorage(dataDir);
    storage._logger = silent;
    app = express();
    app.use(express.json());
    app.use('/api', createApiRouter(storage, '/dev/null', silent));
});
afterEach(async () => { await rm(dataDir, {recursive: true, force: true}); });

describe('POST /api/themes', () => {
    it('derives a safe slug and writes sanitised CSS', async () => {
        const res = await request(app).post('/api/themes').send({
            name: 'Neon Blue!',
            overrides: {'--primary-color': '#00aaff', '--bg': 'red; evil"\'\\'},
        });
        expect(res.status).toBe(201);
        expect(res.body.slug).toBe('feezal-theme-neon-blue');
        expect(res.body.label).toBe('Neon Blue!');

        const css = await readFile(join(dataDir, 'themes', 'feezal-theme-neon-blue.css'), 'utf8');
        expect(css).toContain('feezal-site.feezal-theme-neon-blue {');
        expect(css).toContain('--primary-color: #00aaff;');
        // dangerous chars stripped from the value
        expect(css).toContain('--bg: red evil;');
        expect(css).not.toMatch(/evil["'\\]/);
    });

    it('drops override keys that are not CSS custom properties', async () => {
        await request(app).post('/api/themes').send({
            name: 'filtered', overrides: {'--ok': '1', 'color': 'red', 'bad key': 'x'},
        });
        const css = await readFile(join(dataDir, 'themes', 'feezal-theme-filtered.css'), 'utf8');
        expect(css).toContain('--ok: 1;');
        expect(css).not.toContain('color: red');
        expect(css).not.toContain('bad key');
    });

    it('400s on a missing name or overrides', async () => {
        expect((await request(app).post('/api/themes').send({overrides: {}})).status).toBe(400);
        expect((await request(app).post('/api/themes').send({name: 'x'})).status).toBe(400);
    });

    it('400s when the name reduces to an empty slug', async () => {
        const res = await request(app).post('/api/themes').send({name: '!!!', overrides: {'--x': '1'}});
        expect(res.status).toBe(400);
    });
});

describe('GET /api/themes', () => {
    it('lists created themes with a humanised label', async () => {
        await request(app).post('/api/themes').send({name: 'Dark Mint', overrides: {'--x': '1'}});
        const res = await request(app).get('/api/themes');
        expect(res.status).toBe(200);
        expect(res.body.themes).toContainEqual({slug: 'feezal-theme-dark-mint', label: 'dark mint'});
    });
});

describe('DELETE /api/themes/:slug', () => {
    it('deletes an existing theme', async () => {
        await request(app).post('/api/themes').send({name: 'Temp', overrides: {'--x': '1'}});
        const del = await request(app).delete('/api/themes/feezal-theme-temp');
        expect(del.status).toBe(204);
        const res = await request(app).get('/api/themes');
        expect(res.body.themes).toEqual([]);
    });

    it('404s on an unknown theme and 400s on an invalid slug', async () => {
        expect((await request(app).delete('/api/themes/feezal-theme-ghost')).status).toBe(404);
        expect((await request(app).delete('/api/themes/not-a-theme')).status).toBe(400);
    });
});

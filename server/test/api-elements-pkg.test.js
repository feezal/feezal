/**
 * /api route glue that had no coverage: the package-manager endpoints
 * (list + update badges, registry search, install/update/remove incl. their
 * guard rails), the APK-build job endpoints' error paths, the A13
 * restart/update capability gates (403 without the env flags) and the
 * history file route's path validation.
 *
 * The pkgManager / apkBuild modules are CJS singletons — the router holds the
 * same exports object `require` returns here, so patching a method on it (and
 * restoring afterwards) stubs the route's collaborator without any loader
 * magic. Registry calls are stubbed via global fetch.
 */
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';
import request from 'supertest';

const require = createRequire(import.meta.url);
const FilesystemStorage = require('../src/storage/filesystem.js');
const createApiRouter = require('../src/routes/api.js');
const pkgManager = require('../src/build/install.js');
const apkBuild = require('../src/build/apk.js');
const express = require('express');

const silent = {debug() {}, info() {}, warn() {}, error() {}};

const makeApp = (storage, logger = silent) => {
    const app = express();
    app.use(express.json());
    app.use('/api', createApiRouter(storage, '/dev/null', logger, {emitElementsChanged: () => { app.elementsChanged = (app.elementsChanged || 0) + 1; }}));
    return app;
};

let dataDir, app;
const patched = [];
const patch = (obj, key, fn) => {
    patched.push([obj, key, obj[key]]);
    obj[key] = fn;
};

beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'feezal-api-pkg-'));
    const storage = new FilesystemStorage(dataDir);
    storage._logger = silent;
    app = makeApp(storage);
});
afterEach(async () => {
    while (patched.length) {
        const [obj, key, orig] = patched.pop();
        obj[key] = orig;
    }
    vi.unstubAllGlobals();
    await rm(dataDir, {recursive: true, force: true});
});

// A storage stub with no dataDir — the 503 guard on every mutating endpoint.
const noDataDirApp = () => makeApp({dataDir: null, getSite: () => null});

describe('GET /api/elements (installed packages)', () => {
    it('lists installed packages; checkUpdates=1 tags the registry latest', async () => {
        patch(pkgManager, 'listInstalled', async () => [{name: '@feezal/feezal-element-x-y', version: '1.0.0'}]);
        vi.stubGlobal('fetch', async url => {
            expect(String(url)).toContain('registry.npmjs.org');
            return {ok: true, json: async () => ({version: '1.2.0'})};
        });
        const plain = await request(app).get('/api/elements');
        expect(plain.status).toBe(200);
        expect(plain.body.packages[0].latest).toBeUndefined();

        const checked = await request(app).get('/api/elements?checkUpdates=1');
        expect(checked.body.packages[0].latest).toBe('1.2.0');
    });

    it('a registry hiccup never fails the list (best-effort badges)', async () => {
        patch(pkgManager, 'listInstalled', async () => [{name: '@feezal/feezal-element-x-y', version: '1.0.0'}]);
        vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
        const res = await request(app).get('/api/elements?checkUpdates=1');
        expect(res.status).toBe(200);
        expect(res.body.packages[0].latest).toBeUndefined();
    });

    it('surfaces a listing failure as 500', async () => {
        patch(pkgManager, 'listInstalled', async () => { throw new Error('boom'); });
        const res = await request(app).get('/api/elements');
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('boom');
    });
});

describe('GET /api/elements/search (registry search)', () => {
    it('maps, filters disallowed names and de-dups across keyword queries', async () => {
        vi.stubGlobal('fetch', async () => ({
            ok: true,
            json: async () => ({objects: [
                {package: {name: 'feezal-element-acme-gauge', version: '2.0.0', description: 'd',
                    author: {name: 'Acme'}, links: {npm: 'x'}}},
                {package: {name: 'left-pad', version: '1.0.0'}},   // not a feezal package → dropped
            ]}),
        }));
        const res = await request(app).get('/api/elements/search?text=gauge');
        expect(res.status).toBe(200);
        // 4 keyword queries all return the same object — de-dup leaves one
        expect(res.body.results).toHaveLength(1);
        expect(res.body.results[0]).toMatchObject({
            name: 'feezal-element-acme-gauge', version: '2.0.0', author: 'Acme', type: 'element',
        });
    });

    it('a scoped type= narrows to one keyword query', async () => {
        const urls = [];
        vi.stubGlobal('fetch', async url => { urls.push(String(url)); return {ok: true, json: async () => ({objects: []})}; });
        await request(app).get('/api/elements/search?type=theme');
        expect(urls).toHaveLength(1);
        expect(decodeURIComponent(urls[0])).toContain('feezal-theme');
    });
});

describe('POST /api/elements — install / update / remove guard rails', () => {
    it('rejects non-feezal package names with 400 (all three endpoints)', async () => {
        for (const ep of ['/api/elements', '/api/elements/update', '/api/elements/remove']) {
            const res = await request(app).post(ep).send({package: 'left-pad'});
            expect(res.status, ep).toBe(400);
        }
    });

    it('answers 503 on every mutating endpoint without a dataDir', async () => {
        const bare = noDataDirApp();
        for (const ep of ['/api/elements', '/api/elements/update', '/api/elements/remove']) {
            const res = await request(bare).post(ep).send({package: 'feezal-element-x-y'});
            expect(res.status, ep).toBe(503);
        }
    });

    it('install + update run the installer and signal the elements change', async () => {
        patch(pkgManager, 'installPackage', async ({pkg, version}) => ({ok: true, pkg, version}));
        const res = await request(app).post('/api/elements').send({package: 'feezal-element-x-y', version: '1.2.3'});
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ok: true, pkg: 'feezal-element-x-y', version: '1.2.3'});
        const upd = await request(app).post('/api/elements/update').send({package: 'feezal-element-x-y', version: '2.0.0'});
        expect(upd.body.version).toBe('2.0.0');
        expect(app.elementsChanged).toBe(2);
    });

    // B101: the raw npm output carries absolute server paths, tmpdir names and
    // registry URLs — it belongs in the server log, not in an HTTP body.
    it('an installer failure returns the message only; npm output goes to the log', async () => {
        patch(pkgManager, 'installPackage', async () => {
            const err = new Error('npm died');
            err.stdout = '/home/secret/tmp/staging-xyz out';
            err.stderr = 'npm ERR! /home/secret/path';
            throw err;
        });
        const logged = [];
        const logging = makeApp(new FilesystemStorage(dataDir), {...silent, error: m => logged.push(m)});
        const res = await request(logging).post('/api/elements').send({package: 'feezal-element-x-y'});
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ok: false, error: 'npm died'});
        expect(JSON.stringify(res.body)).not.toContain('/home/secret');
        expect(logged.join('\n')).toContain('/home/secret');
    });

    it('remove runs and signals the change', async () => {
        const removed = [];
        patch(pkgManager, 'removePackage', async (dir, pkg) => removed.push(pkg));
        const res = await request(app).post('/api/elements/remove').send({package: 'feezal-element-x-y'});
        expect(res.status).toBe(200);
        expect(removed).toEqual(['feezal-element-x-y']);
    });
});

describe('APK build job endpoints — error paths', () => {
    it('unknown job ids 404 on events, result and cancel', async () => {
        patch(apkBuild, 'getJob', () => null);
        patch(apkBuild, 'cancel', async () => false);
        expect((await request(app).get('/api/build-apk/nope/events')).status).toBe(404);
        expect((await request(app).get('/api/build-apk/nope/result')).status).toBe(404);
        expect((await request(app).delete('/api/build-apk/nope')).status).toBe(404);
    });

    it('result answers 409 while running and 410 for a failed build', async () => {
        patch(apkBuild, 'getJob', () => ({status: 'running'}));
        expect((await request(app).get('/api/build-apk/j/result')).status).toBe(409);
        patch(apkBuild, 'getJob', () => ({status: 'error', error: 'gradle exploded', apk: null}));
        const res = await request(app).get('/api/build-apk/j/result');
        expect(res.status).toBe(410);
        expect(res.body.error).toBe('gradle exploded');
    });

    it('a successful job downloads the APK with the android content type', async () => {
        patch(apkBuild, 'getJob', () => ({status: 'success', apk: Buffer.from('apk!'), fileName: 'app.apk'}));
        const res = await request(app).get('/api/build-apk/j/result');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/vnd.android.package-archive');
        expect(res.headers['content-disposition']).toContain('app.apk');
    });
});

describe('A13 server restart/update — capability gates', () => {
    it('both answer 403 when the docker capabilities are off (default env)', async () => {
        expect((await request(app).post('/api/server/restart')).status).toBe(403);
        expect((await request(app).post('/api/server/update')).status).toBe(403);
    });
});

describe('site history file route — path validation', () => {
    it('rejects traversal-shaped paths with 400', async () => {
        const res = await request(app).get('/api/sites/s/history/abc/file?path=../../etc/passwd');
        expect(res.status).toBe(400);
        expect((await request(app).get('/api/sites/s/history/abc/file')).status).toBe(400);
    });
});

/**
 * B97 — site-name validation + asset-route traversal.
 *
 * The public `/assets/:site/*` route used to sendFile a pre-joined absolute
 * path (path.join normalizes `..` away BEFORE send's own traversal check),
 * and `isValidSiteName` guarded only 3 of ~20 API site routes with four
 * drifted copies of the rule. These pin: the shared validator's semantics,
 * the router.param guard on every `:name`/`:site` API route, and that
 * encoded traversal against the asset route can no longer escape the site's
 * assets directory.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm, mkdir, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';
import request from 'supertest';

const require = createRequire(import.meta.url);
const createApp = require('../src/app.js');
const createApiRouter = require('../src/routes/api.js');
const FilesystemStorage = require('../src/storage/filesystem.js');
const {isValidSiteName} = require('../src/util/site-name.js');
const express = require('express');

const logger = {debug() {}, info() {}, warn() {}, error() {}};

describe('isValidSiteName (the single shared rule)', () => {
    it('accepts safe single segments', () => {
        for (const ok of ['default', 'My Site', 'a', 'x'.repeat(128), 'site-1.2']) {
            expect(isValidSiteName(ok), ok).toBe(true);
        }
    });
    it('rejects traversal shapes, separators, hidden names and non-strings', () => {
        for (const bad of ['..', '.', '.hidden', 'a/b', 'a\\b', '../x', '', 'x'.repeat(129), null, undefined, 42]) {
            expect(isValidSiteName(bad), String(bad)).toBe(false);
        }
    });
});

describe('API router param guard', () => {
    let dataDir, app;
    beforeAll(async () => {
        dataDir = await mkdtemp(join(tmpdir(), 'feezal-b97-api-'));
        const storage = new FilesystemStorage(dataDir);
        storage._logger = logger;
        app = express();
        app.use(express.json());
        app.use('/api', createApiRouter(storage, '/dev/null', logger));
    });
    afterAll(async () => { await rm(dataDir, {recursive: true, force: true}); });

    // NOTE: `%2e%2e` cannot be exercised through supertest — WHATWG-URL
    // clients (superagent, browsers) collapse encoded dot-segments CLIENT-side
    // before the request leaves, so the guard's `..` case is reachable only by
    // raw-socket clients. It is pinned at the validator-unit level above; the
    // router-level assertions here use invalid shapes that survive URL
    // normalization (leading dot, encoded slash, overlong).
    it('400s invalid names on every route class that reaches the fs', async () => {
        for (const path of [
            '/api/sites/.hidden/history',        // git repo dir
            '/api/sites/.hidden/certs',          // PEM dir
            '/api/sites/.hidden/export',         // export
            '/api/assets/.hidden',               // asset list
            '/api/sites/.hidden/pwa-icons',
            '/api/sites/a%2fb/history',          // encoded slash decodes into the param
            `/api/sites/${'x'.repeat(129)}/history`,
        ]) {
            const res = await request(app).get(path);
            expect(res.status, path).toBe(400);
            expect(res.body.error).toBe('invalid site name');
        }
        expect((await request(app).delete('/api/sites/.hidden')).status).toBe(400);
        expect((await request(app).patch('/api/sites/a%2fb').send({})).status).toBe(400);
    });
});

describe('public /assets/:site/* route', () => {
    let dataDir, wwwDir, app, io, secretPath;
    beforeAll(async () => {
        dataDir = await mkdtemp(join(tmpdir(), 'feezal-b97-app-'));
        wwwDir = await mkdtemp(join(tmpdir(), 'feezal-b97-www-'));
        // a site with one legit asset…
        await mkdir(join(dataDir, 'sites', 'sec', 'assets', 'sub'), {recursive: true});
        await writeFile(join(dataDir, 'sites', 'sec', 'assets', 'pic.txt'), 'legit');
        await writeFile(join(dataDir, 'sites', 'sec', 'assets', 'sub', 'nested.txt'), 'nested');
        // …and secrets OUTSIDE the assets dir that traversal must never reach
        await writeFile(join(dataDir, 'sites', 'sec', 'views.html'), 'SECRET-SITE-HTML');
        secretPath = join(dataDir, 'secret.txt');
        await writeFile(secretPath, 'SECRET-DATA');

        const storage = new FilesystemStorage(dataDir);
        storage._logger = logger;
        ({app, io} = await createApp({wwwDir, storage, logger}));
    });
    afterAll(async () => {
        io.close();
        await rm(dataDir, {recursive: true, force: true});
        await rm(wwwDir, {recursive: true, force: true});
    });

    it('serves real assets, incl. nested paths', async () => {
        const res = await request(app).get('/assets/sec/pic.txt');
        expect(res.status).toBe(200);
        expect(res.text).toBe('legit');
        expect((await request(app).get('/assets/sec/sub/nested.txt')).text).toBe('nested');
    });

    it('encoded traversal in the wildcard cannot escape the assets root', async () => {
        for (const path of [
            '/assets/sec/..%2fviews.html',                 // → sites/sec/views.html
            '/assets/sec/..%2f..%2f..%2fsecret.txt',       // → dataDir/secret.txt
            '/assets/sec/%2e%2e%2f%2e%2e%2f%2e%2e%2fsecret.txt',
            '/assets/sec/sub%2f..%2f..%2fviews.html',
        ]) {
            const res = await request(app).get(path);
            expect(res.status, path).toBe(404);
            expect(res.text).not.toContain('SECRET');
        }
    });

    it('a traversal-shaped site name never resolves', async () => {
        const res = await request(app).get('/assets/.hidden/x');
        expect(res.status).toBe(404);
        expect(res.text).not.toContain('SECRET');
    });

    /**
     * The attack as an attacker actually sends it: supertest/superagent (and
     * browsers) normalize `%2e%2e` and `..` client-side, so the exploit is only
     * expressible over a raw socket. This drives the real HTTP server with a
     * hand-written request line.
     */
    it('raw-socket traversal (no client-side URL normalization) is refused', async () => {
        const http = require('http');
        const net = require('net');
        const server = http.createServer(app);
        await new Promise(r => server.listen(0, '127.0.0.1', r));
        const {port} = server.address();

        const raw = target => new Promise((resolve, reject) => {
            const sock = net.connect(port, '127.0.0.1', () => {
                sock.write(`GET ${target} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`);
            });
            let buf = '';
            sock.on('data', d => { buf += d; });
            sock.on('end', () => resolve(buf));
            sock.on('error', reject);
        });

        try {
            for (const target of [
                '/assets/sec/../views.html',                    // literal .. in the wildcard
                '/assets/sec/../../../secret.txt',
                '/assets/sec/%2e%2e/views.html',
                '/assets/../sites/sec/views.html',              // .. as the SITE segment
                '/api/sites/../history',
            ]) {
                const res = await raw(target);
                expect(res, target).not.toContain('SECRET');
                expect(res.split('\r\n')[0], target).toMatch(/ (400|404) /);
            }
            // the legit path still works over the same raw transport
            expect(await raw('/assets/sec/pic.txt')).toContain('legit');
        } finally {
            await new Promise(r => server.close(r));
        }
    });
});

/**
 * A9 Tier 2b + A13 — docker module, APK build job manager and the API
 * routes, tested against a mocked engine client; plus a gated integration
 * test that exercises the real primitives (putArchive/getArchive/logs)
 * against the local Docker daemon when one is available.
 */
import {describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm, mkdir, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';
import {PassThrough} from 'stream';
import request from 'supertest';

const require = createRequire(import.meta.url);
const docker = require('../src/docker.js');
const apkBuild = require('../src/build/apk.js');
const FilesystemStorage = require('../src/storage/filesystem.js');
const createApiRouter = require('../src/routes/api.js');
const express = require('express');
const {TarArchive} = require('archiver');

const logger = {debug() {}, info() {}, warn() {}, error() {}};

const ENV_KEYS = ['FEEZAL_DOCKER_BUILDS', 'FEEZAL_DOCKER_SELFUPDATE', 'FEEZAL_ALLOW_RESTART', 'DOCKER_HOST'];
const envBackup = {};

beforeEach(() => {
    for (const k of ENV_KEYS) { envBackup[k] = process.env[k]; delete process.env[k]; }
    docker._clearDetectCache();
    apkBuild._reset();
});

afterEach(() => {
    for (const k of ENV_KEYS) {
        if (envBackup[k] === undefined) delete process.env[k];
        else process.env[k] = envBackup[k];
    }
    docker._setClient(null);
    docker._clearDetectCache();
});

/** Minimal mock engine client. */
function mockClient({arch = 'x86_64', containers = {}} = {}) {
    const created = [];
    const client = {
        created,
        info: vi.fn(async () => ({Architecture: arch, ServerVersion: 'mock-1.0'})),
        createVolume: vi.fn(async () => ({})),
        pull: vi.fn((image, cb) => cb(null, new PassThrough())),
        modem: {
            followProgress: (stream, done, onEvent) => {
                onEvent({status: 'Pulling', id: 'layer'});
                done(null);
            },
            demuxStream: (src, out) => src.pipe(out),
        },
        getContainer: vi.fn(name => containers[name]),
        createContainer: vi.fn(async spec => {
            const container = makeMockContainer(spec);
            created.push(container);
            return container;
        }),
    };
    return client;
}

function makeMockContainer(spec, {exitCode = 0, apk = Buffer.from('FAKE-APK')} = {}) {
    const logStream = new PassThrough();
    return {
        spec,
        logStream,
        modem: {demuxStream: (src, out) => src.pipe(out)},
        putArchive: vi.fn(async () => {}),
        attach: vi.fn(async () => logStream),
        start: vi.fn(async () => {
            logStream.write('BUILD LINE 1\nBUILD LINE 2\n');
            logStream.end();
        }),
        wait: vi.fn(async () => ({StatusCode: exitCode})),
        getArchive: vi.fn(async () => {
            const tar = new TarArchive();
            const out = new PassThrough();
            tar.pipe(out);
            tar.append(apk, {name: 'app-debug.apk'});
            tar.finalize();
            return out;
        }),
        remove: vi.fn(async () => {}),
        kill: vi.fn(async () => {}),
        restart: vi.fn(async () => {}),
        inspect: vi.fn(async () => ({Name: '/feezal'})),
    };
}

describe('docker.capabilities()', () => {
    it('everything off without opt-in flags', async () => {
        process.env.DOCKER_HOST = 'tcp://mock:2375';
        docker._setClient(mockClient());
        const caps = await docker.capabilities();
        expect(caps).toMatchObject({dockerBuilds: false, selfUpdate: false, restart: false});
        expect(caps.engine).toMatchObject({arch: 'x86_64'});
    });

    it('dockerBuilds requires the flag AND an x86_64 engine', async () => {
        process.env.DOCKER_HOST = 'tcp://mock:2375';
        process.env.FEEZAL_DOCKER_BUILDS = '1';
        docker._setClient(mockClient());
        expect((await docker.capabilities()).dockerBuilds).toBe(true);

        docker._clearDetectCache();
        docker._setClient(mockClient({arch: 'aarch64'}));
        expect((await docker.capabilities()).dockerBuilds).toBe(false);   // Pi-class host
    });

    it('selfUpdate additionally requires running inside a container', async () => {
        process.env.DOCKER_HOST = 'tcp://mock:2375';
        process.env.FEEZAL_DOCKER_SELFUPDATE = '1';
        docker._setClient(mockClient());
        // the test process does not run in a container (/.dockerenv absent)
        expect((await docker.capabilities()).selfUpdate).toBe(docker.inContainer());
    });

    it('bare-metal restart via FEEZAL_ALLOW_RESTART', async () => {
        process.env.FEEZAL_ALLOW_RESTART = '1';
        expect((await docker.capabilities()).restart).toBe(true);
    });
});

describe('docker.updateSelf()', () => {
    it('launches a one-shot watchtower sibling against the own container name', async () => {
        const self = makeMockContainer({});
        const client = mockClient({containers: {[require('os').hostname()]: self}});
        docker._setClient(client);

        const lines = [];
        const name = await docker.updateSelf(line => lines.push(line));

        expect(name).toBe('feezal');
        const spec = client.created[0].spec;
        expect(spec.Image).toBe(docker.WATCHTOWER_IMAGE);
        expect(spec.Cmd).toEqual(['--run-once', '--cleanup', 'feezal']);
        expect(spec.HostConfig.Binds).toEqual(['/var/run/docker.sock:/var/run/docker.sock']);
        expect(spec.HostConfig.AutoRemove).toBe(true);
        expect(client.created[0].start).toHaveBeenCalled();
        expect(lines.some(l => l.includes('watchtower started'))).toBe(true);
    });
});

describe('APK build job', () => {
    let dataDir;
    let wwwDir;
    let site;

    beforeAll(async () => {
        dataDir = await mkdtemp(join(tmpdir(), 'feezal-apk-data-'));
        wwwDir = await mkdtemp(join(tmpdir(), 'feezal-apk-www-'));
        await mkdir(join(wwwDir, 'src'), {recursive: true});
        const viteDir = join(wwwDir, 'node_modules', 'vite', 'dist', 'node');
        await mkdir(viteDir, {recursive: true});
        await writeFile(join(wwwDir, 'node_modules', 'vite', 'package.json'),
            JSON.stringify({name: 'vite', version: '0.0.0-test', type: 'module'}));
        await writeFile(join(viteDir, 'index.js'),
            'export async function build() { return {output: [{type: "chunk", isEntry: true, code: "//B"}]}; }');
        site = {html: '<feezal-site></feezal-site>', config: {viewer: {}}};
    });

    afterAll(async () => {
        await rm(dataDir, {recursive: true, force: true});
        await rm(wwwDir, {recursive: true, force: true});
    });

    const waitDone = job => new Promise(resolve => job.emitter.once('done', resolve));

    it('runs the full pipeline: volumes, pull, upload, log stream, APK extraction', async () => {
        const client = mockClient();
        docker._setClient(client);

        const job = await apkBuild.startBuild({wwwDir, siteName: 'mysite', site, logger, storage: null});
        const done = await waitDone(job);

        expect(done.status).toBe('success');
        expect(job.apk.toString()).toBe('FAKE-APK');
        expect(job.fileName).toBe('mysite-debug.apk');
        expect(job.log.some(l => l.includes('BUILD LINE 1'))).toBe(true);
        expect(client.createVolume).toHaveBeenCalledTimes(2);

        const container = client.created[0];
        expect(container.spec.HostConfig.Binds).toEqual([
            'feezal-gradle-cache:/root/.gradle',
            'feezal-npm-cache:/root/.npm',
        ]);
        expect(container.putArchive).toHaveBeenCalled();
        expect(container.remove).toHaveBeenCalled();
    });

    it('reports a failed build with the exit code', async () => {
        const client = mockClient();
        client.createContainer = vi.fn(async spec => {
            const container = makeMockContainer(spec, {exitCode: 7});
            client.created.push(container);
            return container;
        });
        docker._setClient(client);

        const job = await apkBuild.startBuild({wwwDir, siteName: 'mysite', site, logger, storage: null});
        const done = await waitDone(job);
        expect(done.status).toBe('error');
        expect(done.error).toContain('exit code 7');
    });

    it('enforces the single-build lock and supports cancel', async () => {
        const client = mockClient();
        // a container that never finishes on its own
        client.createContainer = vi.fn(async spec => {
            const container = makeMockContainer(spec);
            container.start = vi.fn(async () => {});
            container.wait = vi.fn(() => new Promise(() => {}));
            client.created.push(container);
            return container;
        });
        docker._setClient(client);

        const job = await apkBuild.startBuild({wwwDir, siteName: 'mysite', site, logger, storage: null});
        // give the async pipeline a tick to create the container
        await vi.waitFor(() => expect(client.created.length).toBe(1));

        await expect(apkBuild.startBuild({wwwDir, siteName: 'mysite', site, logger, storage: null}))
            .rejects.toThrow('already running');

        expect(await apkBuild.cancel(job.id)).toBe(true);
        expect(job.status).toBe('cancelled');
        expect(client.created[0].kill).toHaveBeenCalled();
    });
});

describe('API routes', () => {
    let app;
    let dataDir;
    let wwwDir;

    beforeAll(async () => {
        dataDir = await mkdtemp(join(tmpdir(), 'feezal-capapi-data-'));
        wwwDir = await mkdtemp(join(tmpdir(), 'feezal-capapi-www-'));
        await mkdir(join(wwwDir, 'src'), {recursive: true});
        const viteDir = join(wwwDir, 'node_modules', 'vite', 'dist', 'node');
        await mkdir(viteDir, {recursive: true});
        await writeFile(join(wwwDir, 'node_modules', 'vite', 'package.json'),
            JSON.stringify({name: 'vite', version: '0.0.0-test', type: 'module'}));
        await writeFile(join(viteDir, 'index.js'),
            'export async function build() { return {output: [{type: "chunk", isEntry: true, code: "//B"}]}; }');

        const storage = new FilesystemStorage(dataDir);
        await storage.saveSite('mysite', {html: '<feezal-site></feezal-site>', config: {viewer: {}}});
        app = express();
        app.use(express.json());
        app.use('/api', createApiRouter(storage, wwwDir, logger));
    });

    afterAll(async () => {
        await rm(dataDir, {recursive: true, force: true});
        await rm(wwwDir, {recursive: true, force: true});
    });

    it('capabilities reflect the environment', async () => {
        const off = await request(app).get('/api/server/capabilities');
        expect(off.body).toMatchObject({dockerBuilds: false, selfUpdate: false, restart: false});

        process.env.DOCKER_HOST = 'tcp://mock:2375';
        process.env.FEEZAL_DOCKER_BUILDS = '1';
        docker._setClient(mockClient());
        docker._clearDetectCache();
        const on = await request(app).get('/api/server/capabilities');
        expect(on.body.dockerBuilds).toBe(true);
    });

    it('build/restart/update are 403 without opt-in', async () => {
        expect((await request(app).post('/api/sites/mysite/build-apk')).status).toBe(403);
        expect((await request(app).post('/api/server/restart')).status).toBe(403);
        expect((await request(app).post('/api/server/update')).status).toBe(403);
    });

    it('runs a build job end-to-end through the routes', async () => {
        process.env.DOCKER_HOST = 'tcp://mock:2375';
        process.env.FEEZAL_DOCKER_BUILDS = '1';
        docker._setClient(mockClient());
        docker._clearDetectCache();

        const start = await request(app).post('/api/sites/mysite/build-apk?appName=Casa');
        expect(start.status).toBe(202);
        const {jobId} = start.body;

        // second start while running/finished-same-job → busy or fresh; wait for done first
        await vi.waitFor(async () => {
            const events = await request(app).get(`/api/build-apk/${jobId}/events`);
            expect(events.text).toContain('event: done');
            expect(events.text).toContain('"status":"success"');
        });

        const result = await request(app).get(`/api/build-apk/${jobId}/result`).buffer().parse(
            (r, cb) => { const chunks = []; r.on('data', c => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks))); });
        expect(result.status).toBe(200);
        expect(result.headers['content-disposition']).toContain('casa-debug.apk');
        expect(result.body.toString()).toBe('FAKE-APK');

        expect((await request(app).get('/api/build-apk/nope/events')).status).toBe(404);
    });
});

// ── Real-engine integration (runs only when a Docker daemon is reachable) ──
const realDockerAvailable = await (async () => {
    if (process.env.FEEZAL_TEST_DOCKER === '0') return false;
    try {
        const Docker = require('dockerode');
        await new Docker().ping();
        return true;
    } catch {
        return false;
    }
})();

describe.runIf(realDockerAvailable)('real Docker engine primitives', () => {
    const IMAGE = 'alpine:3.20';

    it('putArchive → run → logs → getArchive round-trip', async () => {
        docker._setClient(null);   // real client
        const client = docker.getClient();

        await docker.pullImage(IMAGE);
        const container = await client.createContainer({
            Image: IMAGE,
            Cmd: ['sh', '-c', 'cat /work/input.txt | tr a-z A-Z > /work/output.txt && echo TRANSFORMED'],
        });
        try {
            // project in — no bind mounts
            const {TarArchive: Tar} = require('archiver');
            const tarBuffer = await new Promise((resolve, reject) => {
                const chunks = [];
                const tar = new Tar();
                tar.on('error', reject);
                tar.on('data', c => chunks.push(c));
                tar.on('end', () => resolve(Buffer.concat(chunks)));
                tar.append('hello sibling', {name: 'work/input.txt'});
                tar.finalize();
            });
            await container.putArchive(tarBuffer, {path: '/'});

            const logs = await container.attach({stream: true, stdout: true, stderr: true});
            const out = [];
            const sink = new PassThrough();
            container.modem.demuxStream(logs, sink, sink);
            sink.on('data', c => out.push(c.toString()));

            await container.start();
            const result = await container.wait();
            expect(result.StatusCode).toBe(0);
            expect(out.join('')).toContain('TRANSFORMED');

            // artifact out — again no bind mounts
            const archive = await container.getArchive({path: '/work/output.txt'});
            const tarStream = require('tar-stream');
            const content = await new Promise((resolve, reject) => {
                const extract = tarStream.extract();
                let data = null;
                extract.on('entry', (header, stream, next) => {
                    const chunks = [];
                    stream.on('data', c => chunks.push(c));
                    stream.on('end', () => { data = Buffer.concat(chunks); next(); });
                });
                extract.on('finish', () => resolve(data));
                extract.on('error', reject);
                archive.pipe(extract);
            });
            expect(content.toString()).toBe('HELLO SIBLING');
        } finally {
            await container.remove({force: true}).catch(() => {});
        }
    }, 120_000);
});

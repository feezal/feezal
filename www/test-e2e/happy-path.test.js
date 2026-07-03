/**
 * E2E happy path (A17 phase 4) — the whole stack, no mocks:
 *
 *   feezal server (child process, temp dataDir)
 *   aedes MQTT broker (in-memory, TCP)
 *   headless Chromium (playwright-core) driving the real editor + viewer
 *
 * Flow: load the editor → drag an element from the palette onto the canvas →
 * deploy via the UI → assert persistence → reload → open the viewer →
 * retained + live MQTT messages render → export the ZIP.
 *
 * Tests are sequential and share the server/browser; order matters.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm, readFile} from 'fs/promises';
import {tmpdir} from 'os';
import {join, resolve, dirname} from 'path';
import {fileURLToPath} from 'url';
import {spawn} from 'child_process';
import net from 'net';
import {chromium} from 'playwright-core';
import {io as socketClient} from 'socket.io-client';
import mqtt from 'mqtt';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const serverDir = join(repoRoot, 'server');
const wwwDir = join(repoRoot, 'www');

// Server-side deps, resolved through the server workspace's node_modules.
const serverRequire = createRequire(join(serverDir, 'noop.js'));
const {Aedes} = serverRequire('aedes');
const AdmZip = serverRequire('adm-zip');

function freePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.listen(0, '127.0.0.1', () => {
            const {port} = srv.address();
            srv.close(() => resolve(port));
        });
        srv.on('error', reject);
    });
}

async function waitForHttp(url, timeoutMs = 60_000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        try {
            const res = await fetch(url);
            if (res.status < 500) return;
        } catch { /* not up yet */ }
        if (Date.now() > deadline) throw new Error('server did not come up: ' + url);
        await new Promise(r => setTimeout(r, 250));
    }
}

let dataDir;
let broker;
let brokerServer;
let brokerPort;
let serverProc;
let serverPort;
let baseUrl;
let browser;
let page;
let pageErrors;

beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'feezal-e2e-'));

    // In-memory MQTT broker.
    broker = await Aedes.createBroker();
    brokerServer = net.createServer(broker.handle);
    await new Promise(r => brokerServer.listen(0, '127.0.0.1', r));
    brokerPort = brokerServer.address().port;

    // The real server, as users run it.
    serverPort = await freePort();
    serverProc = spawn(process.execPath, [
        join(serverDir, 'bin', 'feezal.js'),
        '--port', String(serverPort),
        '--data', dataDir,
        '--www-dir', wwwDir
    ], {stdio: ['ignore', 'pipe', 'pipe']});
    serverProc.stderr.on('data', d => process.stderr.write('[server] ' + d));
    baseUrl = `http://127.0.0.1:${serverPort}`;
    await waitForHttp(baseUrl + '/editor/');

    browser = await chromium.launch({headless: true});
    page = await browser.newPage({viewport: {width: 1600, height: 900}});
    pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
});

afterAll(async () => {
    await browser?.close();
    serverProc?.kill('SIGKILL');
    await new Promise(r => broker.close(r));
    await new Promise(r => brokerServer.close(r));
    await rm(dataDir, {recursive: true, force: true});
});

/** Wait until the editor SPA is fully up (palette populated). */
async function editorReady() {
    await page.waitForSelector('feezal-palette .element', {timeout: 60_000});
}

/** Uncaught page errors since the last check — any entry is a regression. */
function unexpectedErrors() {
    const errors = [...pageErrors];
    pageErrors.length = 0;
    return errors;
}

describe('editor', () => {
    it('loads without uncaught errors and shows the element palette', async () => {
        await page.goto(baseUrl + '/editor/');
        await editorReady();

        const paletteCount = await page.locator('feezal-palette .element').count();
        expect(paletteCount).toBeGreaterThan(10);
        expect(unexpectedErrors()).toEqual([]);
    });

    it('drags a button from the palette onto the canvas', async () => {
        const item = page.locator('feezal-palette .element[data-el="feezal-element-material-button"]');
        await item.scrollIntoViewIfNeeded();
        const src = await item.boundingBox();
        const view = await page.locator('feezal-site > feezal-view').first().boundingBox();

        const from = {x: src.x + src.width / 2, y: src.y + src.height / 2};
        const to = {x: view.x + view.width / 2, y: view.y + view.height / 2};

        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        for (let i = 1; i <= 12; i++) {
            await page.mouse.move(
                from.x + ((to.x - from.x) * i) / 12,
                from.y + ((to.y - from.y) * i) / 12
            );
        }
        await page.mouse.up();

        const dropped = page.locator('feezal-site > feezal-view feezal-element-material-button');
        await dropped.waitFor({timeout: 10_000});
        // interact.js positioned it where the pointer let go
        const left = await dropped.evaluate(el => Number.parseFloat(el.style.left));
        expect(left).toBeGreaterThan(0);
    });

    it('deploys via the UI and persists the site on disk', async () => {
        await page.locator('#btn-deploy-main').click();

        const siteFile = join(dataDir, 'sites', 'default', 'site.html');
        const deadline = Date.now() + 30_000;
        let html = '';
        for (;;) {
            html = await readFile(siteFile, 'utf8').catch(() => '');
            if (html.includes('feezal-element-material-button') || Date.now() > deadline) break;
            await new Promise(r => setTimeout(r, 250));
        }
        expect(html).toContain('<feezal-element-material-button');
    });

    it('restores the deployed element after a reload', async () => {
        await page.reload();
        await editorReady();
        await page.locator('feezal-site > feezal-view feezal-element-material-button')
            .waitFor({timeout: 20_000});
        expect(unexpectedErrors()).toEqual([]);
    });
});

describe('viewer + MQTT', () => {
    const SITE_HTML =
        '<feezal-site><feezal-view name="main">' +
        '<feezal-element-basic-number subscribe="e2e/temp" style="top:10px;left:10px;"></feezal-element-basic-number>' +
        '</feezal-view></feezal-site>';

    beforeAll(async () => {
        // Retained state that exists BEFORE the server bridge subscribes —
        // the broker replays it with the retain flag set, the hub caches it,
        // and a later viewer subscription gets it replayed.
        await new Promise((res, rej) => broker.publish(
            {topic: 'e2e/temp', payload: '23.5', retain: true, qos: 0, cmd: 'publish'},
            err => err ? rej(err) : res()
        ));

        // Deploy a site wired to the broker through the server's own socket
        // API (mqtt:// URI → the viewer runs through the Socket.IO bridge).
        const sock = socketClient(baseUrl, {transports: ['websocket']});
        await new Promise((res, rej) => { sock.once('connect', res); sock.once('connect_error', rej); });
        const bridgeSubscribed = new Promise(r => broker.once('subscribe', r));
        await new Promise(res => sock.emit('deploy', {
            site: {name: 'livesite'},
            html: SITE_HTML,
            viewer: {},
            connection: {backend: 'mqtt', uri: `mqtt://127.0.0.1:${brokerPort}`}
        }, res));
        sock.close();
        await bridgeSubscribed;

        // Wait until the retained replay has actually reached the server
        // (visible through the topic-autocomplete trie) before opening the viewer.
        const deadline = Date.now() + 15_000;
        for (;;) {
            const res = await fetch(baseUrl + '/api/topics/completions?prefix=e2e/');
            const {completions} = await res.json().catch(() => ({completions: []}));
            if (completions?.length || Date.now() > deadline) break;
            await new Promise(r => setTimeout(r, 200));
        }
    });

    it('renders a retained MQTT value on load', async () => {
        await page.goto(baseUrl + '/viewer/livesite');
        await page.waitForFunction(() => {
            const el = document.querySelector('feezal-element-basic-number');
            return el?.shadowRoot?.textContent.includes('23.5');
        }, {timeout: 30_000});
    });

    it('updates live when a new value is published', async () => {
        const client = mqtt.connect(`mqtt://127.0.0.1:${brokerPort}`);
        await new Promise(r => client.once('connect', r));
        client.publish('e2e/temp', '42');
        await page.waitForFunction(() => {
            const el = document.querySelector('feezal-element-basic-number');
            return el?.shadowRoot?.textContent.includes('42');
        }, {timeout: 30_000});
        await new Promise(r => client.end(true, r));
    });
});

describe('export', () => {
    it('exports the site as a <sitename>/-wrapped self-contained ZIP', async () => {
        const res = await fetch(baseUrl + '/api/sites/default/export');
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('application/zip');

        const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));
        const names = zip.getEntries().filter(e => !e.isDirectory).map(e => e.entryName);
        expect(names).toContain('default/index.html');

        const html = zip.readAsText('default/index.html');
        expect(html).toContain('<feezal-element-material-button');
        // JS is inlined — a file:// export must not reference external scripts
        expect(html).not.toContain('src="/viewer-bundle.js"');
    });
});

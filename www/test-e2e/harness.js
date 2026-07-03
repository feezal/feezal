/**
 * Shared E2E stack: the real feezal server as a child process on a temp
 * dataDir, optionally an in-memory aedes MQTT broker, and headless Chromium.
 */
import {createRequire} from 'module';
import {mkdtemp, rm, mkdir, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import {join, resolve, dirname} from 'path';
import {fileURLToPath} from 'url';
import {spawn} from 'child_process';
import {randomUUID} from 'crypto';
import net from 'net';
import {chromium} from 'playwright-core';
import {io as socketClient} from 'socket.io-client';

// FEEZAL_COVERAGE: collect Chromium V8 JS coverage for every page and dump the
// raw entries to coverage-e2e/raw/ on stopStack(). Requires a build made with
// the same env var (inline sourcemaps). scripts/e2e-coverage-report.mjs turns
// the dumps into lcov for Codecov.
// The dumps live OUTSIDE coverage-e2e/ — monocart empties its outputDir on
// generate and would delete them before a re-run.
const collectCoverage = Boolean(process.env.FEEZAL_COVERAGE);
const coverageRawDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'coverage-e2e-raw');

async function trackPageCoverage(stack, page) {
    // resetOnNavigation:false — tests reload pages (replay tests); keep counting.
    await page.coverage.startJSCoverage({resetOnNavigation: false});
    stack._coveragePages.add(page);
    const originalClose = page.close.bind(page);
    page.close = async (...args) => {
        await harvestPageCoverage(stack, page);
        return originalClose(...args);
    };
}

async function harvestPageCoverage(stack, page) {
    if (!stack._coveragePages.has(page)) return;
    stack._coveragePages.delete(page);
    try {
        stack._coverageEntries.push(...await page.coverage.stopJSCoverage());
    } catch { /* page already gone — its coverage is lost, not fatal */ }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, '..', '..');
export const serverDir = join(repoRoot, 'server');
export const wwwDir = join(repoRoot, 'www');

// Server-side deps, resolved through the server workspace's node_modules.
export const serverRequire = createRequire(join(serverDir, 'noop.js'));

export function freePort() {
    return new Promise((res, rej) => {
        const srv = net.createServer();
        srv.listen(0, '127.0.0.1', () => {
            const {port} = srv.address();
            srv.close(() => res(port));
        });
        srv.on('error', rej);
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

/** Start dataDir + server + browser. Returns a stack handle for stopStack(). */
export async function startStack() {
    const stack = {};
    stack.dataDir = await mkdtemp(join(tmpdir(), 'feezal-e2e-'));

    stack.serverPort = await freePort();
    stack.baseUrl = `http://127.0.0.1:${stack.serverPort}`;
    stack.serverProc = spawn(process.execPath, [
        join(serverDir, 'bin', 'feezal.js'),
        '--port', String(stack.serverPort),
        '--data', stack.dataDir,
        '--www-dir', wwwDir
    ], {stdio: ['ignore', 'pipe', 'pipe']});
    stack.serverProc.stderr.on('data', d => process.stderr.write('[server] ' + d));
    await waitForHttp(stack.baseUrl + '/editor/');

    stack.browser = await chromium.launch({headless: true});
    stack.context = await stack.browser.newContext({viewport: {width: 1600, height: 900}});

    if (collectCoverage) {
        stack._coveragePages = new Set();
        stack._coverageEntries = [];
        // Wrap newPage so every page a test opens is tracked from creation
        // (scripts only run after the test navigates, so this is race-free).
        const originalNewPage = stack.context.newPage.bind(stack.context);
        stack.context.newPage = async (...args) => {
            const page = await originalNewPage(...args);
            await trackPageCoverage(stack, page);
            return page;
        };
    }

    stack.page = await stack.context.newPage();
    stack.pageErrors = [];
    stack.page.on('pageerror', err => stack.pageErrors.push(err.message));
    return stack;
}

export async function stopStack(stack) {
    if (collectCoverage && stack._coveragePages) {
        for (const page of [...stack._coveragePages]) {
            await harvestPageCoverage(stack, page);
        }
        if (stack._coverageEntries.length > 0) {
            await mkdir(coverageRawDir, {recursive: true});
            await writeFile(
                join(coverageRawDir, `e2e-${randomUUID()}.json`),
                JSON.stringify(stack._coverageEntries)
            );
        }
    }
    await stack.browser?.close();
    stack.serverProc?.kill('SIGKILL');
    await rm(stack.dataDir, {recursive: true, force: true});
}

/** Deploy a site through the server's own Socket.IO API. */
export async function deploySite(baseUrl, {name, html, viewer = {}, connection = undefined}) {
    const sock = socketClient(baseUrl, {transports: ['websocket']});
    await new Promise((res, rej) => { sock.once('connect', res); sock.once('connect_error', rej); });
    await new Promise(res => sock.emit('deploy', {site: {name}, html, viewer, connection}, res));
    sock.close();
}

/** Send a message onto the server's message bus (hub `send`). */
export async function hubSend(baseUrl, message) {
    const sock = socketClient(baseUrl, {transports: ['websocket']});
    await new Promise((res, rej) => { sock.once('connect', res); sock.once('connect_error', rej); });
    sock.emit('send', message);
    await new Promise(r => setTimeout(r, 100));   // let the server process it
    sock.close();
}

/** Subscribe a fresh socket and return the first replayed/broadcast message. */
export async function hubExpectMessage(baseUrl, topic, timeoutMs = 5000) {
    const sock = socketClient(baseUrl, {transports: ['websocket']});
    try {
        await new Promise((res, rej) => { sock.once('connect', res); sock.once('connect_error', rej); });
        return await new Promise((res, rej) => {
            const timer = setTimeout(() => rej(new Error(`no message on ${topic} within ${timeoutMs}ms`)), timeoutMs);
            sock.on('input', message => {
                if (message.topic === topic) { clearTimeout(timer); res(message); }
            });
            sock.emit('subscribe', [topic]);
        });
    } finally {
        sock.close();
    }
}

/** Start an in-memory aedes broker; returns {broker, server, port, uri, close}. */
export async function startBroker(port = 0) {
    const {Aedes} = serverRequire('aedes');
    const broker = await Aedes.createBroker();
    const server = net.createServer(broker.handle);
    await new Promise(r => server.listen(port, '127.0.0.1', r));
    const actualPort = server.address().port;
    return {
        broker,
        server,
        port: actualPort,
        uri: `mqtt://127.0.0.1:${actualPort}`,
        publishRetained: (topic, payload) => new Promise((res, rej) => broker.publish(
            {topic, payload, retain: true, qos: 0, cmd: 'publish'},
            err => err ? rej(err) : res()
        )),
        close: async () => {
            await new Promise(r => broker.close(r));
            await new Promise(r => server.close(r));
        }
    };
}

/**
 * Expose an aedes broker over MQTT-WebSocket (what browsers speak directly).
 * Returns {port, uri, close}.
 */
export async function attachWsListener(broker) {
    const http = await import('node:http');
    const {WebSocketServer, createWebSocketStream} = serverRequire('ws');
    const httpServer = http.createServer();
    const wss = new WebSocketServer({server: httpServer});
    wss.on('connection', ws => broker.handle(createWebSocketStream(ws)));
    await new Promise(r => httpServer.listen(0, '127.0.0.1', r));
    const port = httpServer.address().port;
    return {
        port,
        uri: `ws://127.0.0.1:${port}`,
        close: () => new Promise(r => {
            wss.close(() => httpServer.close(r));
        })
    };
}

/** Drag with the Playwright mouse in small steps (interact.js needs real moves). */
export async function mouseDrag(page, from, to, steps = 12) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
        await page.mouse.move(
            from.x + ((to.x - from.x) * i) / steps,
            from.y + ((to.y - from.y) * i) / steps
        );
    }
    await page.mouse.up();
}

export function centerOf(box) {
    return {x: box.x + box.width / 2, y: box.y + box.height / 2};
}

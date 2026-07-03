/**
 * E2E: direct ws:// MQTT — no server bridge involved (A17 candidate).
 *
 * The broker gets a WebSocket listener; the site's connection URI is ws://,
 * so the viewer page speaks MQTT-over-WebSocket straight to the broker
 * (feezal-connection-mqtt / mqtt.js in the browser). Also covers the static
 * export: the ZIP is extracted and opened from file:// — the offline bundle
 * must connect and update the same way.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {mkdir} from 'fs/promises';
import {join} from 'path';
import {pathToFileURL} from 'url';
import {startStack, stopStack, deploySite, startBroker, attachWsListener, serverRequire} from './harness.js';

const SITE_HTML =
    '<feezal-site><feezal-view name="main">' +
    '<feezal-element-basic-number subscribe="ws/val" style="top:10px;left:10px;"></feezal-element-basic-number>' +
    '<feezal-element-material-switch publish="ws/cmd" payload-on="ON" payload-off="OFF" style="top:60px;left:10px;"></feezal-element-material-switch>' +
    // absolute copy-on-use style reference — the A16 export must rewrite it
    '<feezal-element-basic-image src="/assets/direct/logo.png" style="top:120px;left:10px;width:60px;height:60px;"></feezal-element-basic-image>' +
    '</feezal-view></feezal-site>';

// 1×1 red PNG
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
);

let stack;
let broker;
let wsListener;
let mqttClient;

beforeAll(async () => {
    stack = await startStack();
    broker = await startBroker();
    wsListener = await attachWsListener(broker.broker);
    await broker.publishRetained('ws/val', '23.5');

    await deploySite(stack.baseUrl, {
        name: 'direct',
        html: SITE_HTML,
        connection: {backend: 'mqtt', uri: wsListener.uri}
    });

    // a real site asset for the export bundle
    const upload = await fetch(
        stack.baseUrl + '/api/assets/direct?category=site&path=logo.png',
        {method: 'POST', headers: {'Content-Type': 'image/png'}, body: PNG}
    );
    if (upload.status >= 300) throw new Error('asset upload failed: ' + upload.status);

    const mqtt = serverRequire('mqtt');
    mqttClient = mqtt.connect(broker.uri);
    await new Promise(r => mqttClient.once('connect', r));
}, 60_000);

afterAll(async () => {
    await stopStack(stack);
    await new Promise(r => mqttClient.end(true, r));
    await wsListener.close().catch(() => {});
    await broker.close().catch(() => {});
});

function numberShows(page, text) {
    return page.waitForFunction(t => {
        const el = document.querySelector('feezal-element-basic-number');
        return el?.shadowRoot?.textContent.includes(t);
    }, text, {timeout: 30_000});
}

describe('viewer with a direct ws:// connection (no bridge)', () => {
    it('renders the retained value straight from the broker', async () => {
        await stack.page.goto(stack.baseUrl + '/viewer/direct');
        await numberShows(stack.page, '23.5');
    });

    it('updates live', async () => {
        mqttClient.publish('ws/val', '42');
        await numberShows(stack.page, '42');
    });

    it('publishes interactions straight to the broker', async () => {
        const received = new Promise(resolve => {
            mqttClient.subscribe('ws/cmd', () => {});
            mqttClient.on('message', (topic, payload) => {
                if (topic === 'ws/cmd') resolve(payload.toString());
            });
        });

        const sw = stack.page.locator('feezal-element-material-switch md-switch');
        await sw.click();

        expect(await received).toBe('ON');
    });
});

describe('static export opened from file://', () => {
    it('the exported bundle connects over ws:// and renders offline, assets included (A16)', async () => {
        const res = await fetch(stack.baseUrl + '/api/sites/direct/export');
        expect(res.status).toBe(200);

        const AdmZip = serverRequire('adm-zip');
        const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));

        // A16 layout: index.html + a single assets/ tree, no global/ folder
        const names = zip.getEntries().filter(e => !e.isDirectory).map(e => e.entryName).sort();
        expect(names).toEqual(['direct/assets/logo.png', 'direct/index.html']);
        expect(zip.readAsText('direct/index.html')).toContain('src="assets/logo.png"');

        const exportDir = join(stack.dataDir, 'export');
        await mkdir(exportDir, {recursive: true});
        zip.extractAllTo(exportDir, true);

        await broker.publishRetained('ws/val', '55');

        const page = await stack.context.newPage();
        await page.goto(pathToFileURL(join(exportDir, 'direct', 'index.html')).href);
        await numberShows(page, '55');

        // the rewritten relative asset reference resolves from file://
        await page.waitForFunction(() => {
            const img = document.querySelector('feezal-element-basic-image')
                ?.shadowRoot?.querySelector('img');
            return img && img.complete && img.naturalWidth > 0;
        }, {timeout: 15_000});

        // live update still flows into the file:// page
        mqttClient.publish('ws/val', '66');
        await numberShows(page, '66');
        await page.close();
    });
});

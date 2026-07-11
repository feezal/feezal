/**
 * E2E reproduction: metro-light state subscription in the real viewer —
 * retained state must render (reported broken: publish works, state not
 * shown). Covers separate mode and json (zigbee2mqtt) mode.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite, startBroker, attachWsListener} from './harness.js';

const SITE = 'metrolight';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-metro-light id="ml-sep" subscribe-state="ml/sep/state" publish-state="ml/sep/set" ' +
        'subscribe-brightness="ml/sep/bri" publish-brightness="ml/sep/bri/set" brightness-max="255" ' +
        'style="position:absolute;top:20px;left:20px;width:150px;height:150px;"></feezal-element-metro-light>' +
    '<feezal-element-metro-light id="ml-json" payload-mode="json" subscribe="ml/lamp" publish="ml/lamp/set" ' +
        'brightness-max="254" mode="brightness_ct" ' +
        'style="position:absolute;top:20px;left:220px;width:150px;height:150px;"></feezal-element-metro-light>' +
    '</feezal-view></feezal-site>';

const WS_SITE = 'metrolightws';
const WS_SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-metro-light id="ml-ws" subscribe-state="mlws/state" publish-state="mlws/set" ' +
        'subscribe-brightness="mlws/bri" brightness-max="255" ' +
        'style="position:absolute;top:20px;left:20px;width:150px;height:150px;"></feezal-element-metro-light>' +
    '</feezal-view></feezal-site>';

let stack;
let broker;
let wsListener;

beforeAll(async () => {
    stack = await startStack();
    broker = await startBroker();
    wsListener = await attachWsListener(broker.broker);
    // Direct ws:// site — the browser speaks MQTT-over-WebSocket itself, no
    // bridge involved (feezal-connection-mqtt path).
    await broker.publishRetained('mlws/state', 'on');
    await broker.publishRetained('mlws/bri', '64');
    await deploySite(stack.baseUrl, {name: WS_SITE, html: WS_SITE_HTML, connection: {backend: 'mqtt', uri: wsListener.uri}});
    // Retained state that exists BEFORE the server bridge subscribes.
    await broker.publishRetained('ml/sep/state', 'on');
    await broker.publishRetained('ml/sep/bri', '128');
    await broker.publishRetained('ml/lamp', JSON.stringify({state: 'ON', brightness: 127}));

    // mqtt:// URI → the viewer runs through the Socket.IO bridge. Like
    // happy-path: wait for the bridge's broker-side subscription AND the
    // retained replay reaching the hub before any viewer opens — otherwise
    // an early viewer subscription races the hub cache (test-infra race,
    // not element behaviour).
    const bridgeSubscribed = new Promise(r => broker.broker.once('subscribe', r));
    await deploySite(stack.baseUrl, {name: SITE, html: SITE_HTML, connection: {backend: 'mqtt', uri: broker.uri}});
    await bridgeSubscribed;
    const deadline = Date.now() + 15_000;
    for (;;) {
        const res = await fetch(stack.baseUrl + '/api/topics/completions?prefix=ml/');
        const {completions} = await res.json().catch(() => ({completions: []}));
        if (completions?.length || Date.now() > deadline) break;
        await new Promise(r => setTimeout(r, 200));
    }
}, 60_000);

afterAll(async () => {
    if (stack.pageErrors.length) console.error('PAGE ERRORS:', stack.pageErrors);
    await broker.close();
    await stopStack(stack);
});

describe('metro-light in the real viewer', () => {
    it('retained + live state renders in separate and json mode', async () => {
        const mqtt = (await import('mqtt')).default ?? (await import('mqtt'));
        const pub = mqtt.connect(broker.uri);
        await new Promise(resolve => pub.once('connect', resolve));

        const viewer = await stack.context.newPage();
        const consoleLines = [];
        viewer.on('console', msg => consoleLines.push(msg.text()));
        try {
            await viewer.goto(`${stack.baseUrl}/viewer/${SITE}`);
            await viewer.waitForSelector('#ml-sep', {timeout: 30_000});

            const state = id => viewer.evaluate(sel =>
                document.querySelector(sel)?.shadowRoot?.querySelector('.state')?.textContent, `#${id}`);

            const debug = () => viewer.evaluate(() => {
                const el = document.querySelector('#ml-sep');
                return {
                    subCount: el._subscriptions?.length,
                    topics: window.feezal.connection.subscriptions?.map(s => s.topic),
                    connected: window.feezal.connection.connected,
                    on: el._on,
                    state: el.shadowRoot?.querySelector('.state')?.textContent,
                };
            });
            try {
                await expect.poll(() => state('ml-sep'), {timeout: 10_000}).toBe('on 50%');
            } catch (error) {
                console.error('DEBUG on failure:', await debug());
                console.error('CONSOLE:', consoleLines.filter(l =>
                    l.includes('subscribe') || l.includes('feezal-msg') || l.includes('connect')).join('\n'));
                throw error;
            }
            await expect.poll(() => state('ml-json'), {timeout: 10_000}).toBe('on 50%');

            // Live update after load.
            await new Promise(r => pub.publish('ml/sep/state', 'off', r));
            await expect.poll(() => state('ml-sep'), {timeout: 10_000}).toBe('off');
            await new Promise(r => pub.publish('ml/lamp', JSON.stringify({state: 'OFF'}), r));
            await expect.poll(() => state('ml-json'), {timeout: 10_000}).toBe('off');

            await new Promise(resolve => pub.end(true, resolve));
        } finally {
            await viewer.close();
        }
    });

    it('direct ws:// backend: retained + live state renders (no bridge)', async () => {
        const viewer = await stack.context.newPage();
        try {
            await viewer.goto(`${stack.baseUrl}/viewer/${WS_SITE}`);
            await viewer.waitForSelector('#ml-ws', {timeout: 30_000});
            const state = () => viewer.evaluate(() =>
                document.querySelector('#ml-ws')?.shadowRoot?.querySelector('.state')?.textContent);
            // retained: on + 64/255 ≈ 25 %
            await expect.poll(state, {timeout: 10_000}).toBe('on 25%');

            const mqtt = (await import('mqtt')).default ?? (await import('mqtt'));
            const pub = mqtt.connect(broker.uri);
            await new Promise(resolve => pub.once('connect', resolve));
            await new Promise(r => pub.publish('mlws/state', 'off', r));
            await expect.poll(state, {timeout: 10_000}).toBe('off');
            await new Promise(resolve => pub.end(true, resolve));
        } finally {
            await viewer.close();
        }
    });

    it('editor canvas: the tile shows live state too (N14)', async () => {
        const page = stack.page;
        await page.goto(`${stack.baseUrl}/editor/?/${SITE}/`);
        await page.waitForSelector('feezal-palette .element', {timeout: 60_000});
        // Re-assert the state (the previous test left a live 'off' as the
        // last message) — arrives as a live message through the bridge.
        await broker.publishRetained('ml/sep/state', 'on');
        // Retained bridge state reaches the canvas element.
        await expect.poll(() => page.evaluate(() =>
            document.querySelector('#ml-sep')?.shadowRoot?.querySelector('.state')?.textContent
        ), {timeout: 15_000}).toMatch(/^on/);
    });
});

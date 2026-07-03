/**
 * E2E: material-checkbox element — real viewer over MQTT:
 *   - clicking publishes the configured on/off payloads
 *   - the label toggles the checkbox too
 *   - a subscribe payload drives the checked state
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite, startBroker} from './harness.js';

const SITE = 'matcheckbox';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-material-checkbox subscribe="cb/state" publish="cb/set" payload-on="yes" payload-off="no" label="Enable" style="position:absolute;top:20px;left:20px;width:140px;height:40px;"></feezal-element-material-checkbox>' +
    '</feezal-view></feezal-site>';

let stack;
let broker;
let viewer;
let mqttClient;
const received = [];

beforeAll(async () => {
    stack = await startStack();
    broker = await startBroker();
    await deploySite(stack.baseUrl, {name: SITE, html: SITE_HTML, connection: {backend: 'mqtt', uri: broker.uri}});

    const mqtt = (await import('mqtt')).default ?? (await import('mqtt'));
    mqttClient = mqtt.connect(broker.uri);
    await new Promise(resolve => mqttClient.once('connect', resolve));
    await new Promise(resolve => mqttClient.subscribe('cb/#', resolve));
    mqttClient.on('message', (topic, payload) => received.push([topic, payload.toString()]));

    viewer = await stack.context.newPage();
    await viewer.goto(`${stack.baseUrl}/viewer/${SITE}`);
    await viewer.waitForSelector('feezal-element-material-checkbox', {timeout: 30_000});
}, 120_000);

afterAll(async () => {
    if (stack.pageErrors.length) console.error('PAGE ERRORS:', stack.pageErrors);
    await new Promise(resolve => mqttClient.end(true, resolve));
    await viewer.close();
    await broker.close();
    await stopStack(stack);
});

const isChecked = () => viewer.locator('md-checkbox').evaluate(el => el.checked);

describe('material-checkbox', () => {
    it('publishes the on payload when checked and the off payload when unchecked', async () => {
        await viewer.locator('md-checkbox').click();
        await expect.poll(() => received, {timeout: 10_000}).toContainEqual(['cb/set', 'yes']);

        await viewer.locator('md-checkbox').click();
        await expect.poll(() => received, {timeout: 10_000}).toContainEqual(['cb/set', 'no']);
    });

    it('toggles via the label', async () => {
        const before = received.length;
        await viewer.locator('feezal-element-material-checkbox label').click();
        await expect.poll(() => received.length, {timeout: 10_000}).toBeGreaterThan(before);
        expect(received.at(-1)[0]).toBe('cb/set');
    });

    it('follows the subscribed state topic', async () => {
        await new Promise(resolve => mqttClient.publish('cb/state', 'yes', resolve));
        await expect.poll(isChecked, {timeout: 10_000}).toBe(true);

        await new Promise(resolve => mqttClient.publish('cb/state', 'no', resolve));
        await expect.poll(isChecked, {timeout: 10_000}).toBe(false);
    });
});

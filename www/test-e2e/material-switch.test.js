/**
 * E2E: material-switch element — real viewer over MQTT:
 *   - toggling publishes the configured on/off payloads
 *   - a subscribe payload drives the selected state
 *   - the label is rendered
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite, startBroker} from './harness.js';

const SITE = 'matswitch';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-material-switch subscribe="sw/state" publish="sw/set" payload-on="on" payload-off="off" label="Lamp" style="position:absolute;top:20px;left:20px;width:80px;height:32px;"></feezal-element-material-switch>' +
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
    await new Promise(resolve => mqttClient.subscribe('sw/#', resolve));
    mqttClient.on('message', (topic, payload) => received.push([topic, payload.toString()]));

    viewer = await stack.context.newPage();
    await viewer.goto(`${stack.baseUrl}/viewer/${SITE}`);
    await viewer.waitForSelector('feezal-element-material-switch', {timeout: 30_000});
}, 120_000);

afterAll(async () => {
    if (stack.pageErrors.length) console.error('PAGE ERRORS:', stack.pageErrors);
    await new Promise(resolve => mqttClient.end(true, resolve));
    await viewer.close();
    await broker.close();
    await stopStack(stack);
});

const isSelected = () => viewer.locator('md-switch').evaluate(el => el.selected);

describe('material-switch', () => {
    it('renders the label', async () => {
        await expect.poll(() => viewer.locator('feezal-element-material-switch .label').textContent(), {timeout: 10_000})
            .toBe('Lamp');
    });

    it('publishes the on payload when switched on and the off payload when switched off', async () => {
        await viewer.locator('md-switch').click();
        await expect.poll(() => received, {timeout: 10_000}).toContainEqual(['sw/set', 'on']);
        expect(await isSelected()).toBe(true);

        await viewer.locator('md-switch').click();
        await expect.poll(() => received, {timeout: 10_000}).toContainEqual(['sw/set', 'off']);
        expect(await isSelected()).toBe(false);
    });

    it('follows the subscribed state topic', async () => {
        await new Promise(resolve => mqttClient.publish('sw/state', 'on', resolve));
        await expect.poll(isSelected, {timeout: 10_000}).toBe(true);

        await new Promise(resolve => mqttClient.publish('sw/state', 'off', resolve));
        await expect.poll(isSelected, {timeout: 10_000}).toBe(false);
    });
});

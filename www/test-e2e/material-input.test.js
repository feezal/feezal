/**
 * E2E: material-input element — real viewer over MQTT:
 *   - publishes the typed text on Enter and on blur
 *   - publish-on-input publishes every keystroke
 *   - a subscribe payload fills the field
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite, startBroker} from './harness.js';

const SITE = 'matinput';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-material-input id="plain" label="Name" subscribe="in/state" publish="in/set" style="position:absolute;top:20px;left:20px;width:220px;height:56px;"></feezal-element-material-input>' +
    '<feezal-element-material-input id="live" publish="in/live" publish-on-input style="position:absolute;top:100px;left:20px;width:220px;height:56px;"></feezal-element-material-input>' +
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
    await new Promise(resolve => mqttClient.subscribe('in/#', resolve));
    mqttClient.on('message', (topic, payload) => received.push([topic, payload.toString()]));

    viewer = await stack.context.newPage();
    await viewer.goto(`${stack.baseUrl}/viewer/${SITE}`);
    await viewer.waitForSelector('feezal-element-material-input', {timeout: 30_000});
}, 120_000);

afterAll(async () => {
    if (stack.pageErrors.length) console.error('PAGE ERRORS:', stack.pageErrors);
    await new Promise(resolve => mqttClient.end(true, resolve));
    await viewer.close();
    await broker.close();
    await stopStack(stack);
});

const innerInput = id => viewer.locator(`#${id} md-outlined-text-field input`);

describe('material-input', () => {
    it('publishes the typed value on Enter', async () => {
        await innerInput('plain').fill('hello world');
        await innerInput('plain').press('Enter');
        await expect.poll(() => received, {timeout: 10_000}).toContainEqual(['in/set', 'hello world']);
    });

    it('publishes on blur', async () => {
        await innerInput('plain').fill('blurred');
        await innerInput('plain').blur();
        await expect.poll(() => received, {timeout: 10_000}).toContainEqual(['in/set', 'blurred']);
    });

    it('publishes every keystroke with publish-on-input', async () => {
        await innerInput('live').pressSequentially('ab');
        await expect.poll(() => received, {timeout: 10_000}).toContainEqual(['in/live', 'a']);
        await expect.poll(() => received, {timeout: 10_000}).toContainEqual(['in/live', 'ab']);
    });

    it('follows the subscribed state topic', async () => {
        await new Promise(resolve => mqttClient.publish('in/state', 'from broker', resolve));
        await expect.poll(() => viewer.locator('#plain md-outlined-text-field').evaluate(el => el.value), {timeout: 10_000})
            .toBe('from broker');
    });
});

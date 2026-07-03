/**
 * E2E: material-select element — real viewer over MQTT:
 *   - renders one option per entry of a comma-separated options list
 *   - picking an option from the dropdown publishes its value
 *   - a subscribe payload drives the selected value
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite, startBroker} from './harness.js';

const SITE = 'matselect';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-material-select label="Mode" subscribe="se/state" publish="se/set" options="red,green,blue" style="position:absolute;top:20px;left:20px;width:220px;height:56px;"></feezal-element-material-select>' +
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
    await new Promise(resolve => mqttClient.subscribe('se/#', resolve));
    mqttClient.on('message', (topic, payload) => received.push([topic, payload.toString()]));

    viewer = await stack.context.newPage();
    await viewer.goto(`${stack.baseUrl}/viewer/${SITE}`);
    await viewer.waitForSelector('feezal-element-material-select', {timeout: 30_000});
}, 120_000);

afterAll(async () => {
    if (stack.pageErrors.length) console.error('PAGE ERRORS:', stack.pageErrors);
    await new Promise(resolve => mqttClient.end(true, resolve));
    await viewer.close();
    await broker.close();
    await stopStack(stack);
});

const selectValue = () => viewer.locator('md-outlined-select').evaluate(el => el.value);

describe('material-select', () => {
    it('renders one option per comma-separated entry', async () => {
        await expect.poll(() => viewer.locator('md-select-option').count(), {timeout: 10_000}).toBe(3);
    });

    it('publishes the picked option', async () => {
        await viewer.locator('md-outlined-select').click();
        await viewer.locator('md-select-option[value="green"]').click();
        await expect.poll(() => received, {timeout: 10_000}).toContainEqual(['se/set', 'green']);
        await expect.poll(selectValue).toBe('green');
    });

    it('follows the subscribed state topic', async () => {
        await new Promise(resolve => mqttClient.publish('se/state', 'blue', resolve));
        await expect.poll(selectValue, {timeout: 10_000}).toBe('blue');
    });
});

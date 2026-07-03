/**
 * E2E: material-radio element — real viewer over MQTT:
 *   - renders one md-radio per JSON option with its label
 *   - selecting an option publishes its value
 *   - a subscribe payload drives the checked option
 *
 * The options attribute is JSON — its quotes must be &quot; entities in the
 * seed HTML (the deploy formatter does not escape raw quotes).
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite, startBroker} from './harness.js';

const SITE = 'matradio';
const OPTIONS = '[{&quot;value&quot;:&quot;heat&quot;,&quot;label&quot;:&quot;Heat&quot;},{&quot;value&quot;:&quot;cool&quot;,&quot;label&quot;:&quot;Cool&quot;},{&quot;value&quot;:&quot;off&quot;,&quot;label&quot;:&quot;Off&quot;}]';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    `<feezal-element-material-radio subscribe="rd/state" publish="rd/set" options="${OPTIONS}" style="position:absolute;top:20px;left:20px;width:160px;height:120px;"></feezal-element-material-radio>` +
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
    await new Promise(resolve => mqttClient.subscribe('rd/#', resolve));
    mqttClient.on('message', (topic, payload) => received.push([topic, payload.toString()]));

    viewer = await stack.context.newPage();
    await viewer.goto(`${stack.baseUrl}/viewer/${SITE}`);
    await viewer.waitForSelector('feezal-element-material-radio', {timeout: 30_000});
}, 120_000);

afterAll(async () => {
    if (stack.pageErrors.length) console.error('PAGE ERRORS:', stack.pageErrors);
    await new Promise(resolve => mqttClient.end(true, resolve));
    await viewer.close();
    await broker.close();
    await stopStack(stack);
});

const isChecked = value => viewer.locator(`md-radio[value="${value}"]`).evaluate(el => el.checked);

describe('material-radio', () => {
    it('renders one radio per option with its label', async () => {
        await expect.poll(() => viewer.locator('md-radio').count(), {timeout: 10_000}).toBe(3);
        const labels = await viewer.locator('feezal-element-material-radio .option').allTextContents();
        expect(labels.map(l => l.trim())).toEqual(['Heat', 'Cool', 'Off']);
    });

    it('publishes the value of the selected option', async () => {
        await viewer.locator('md-radio[value="cool"]').click();
        await expect.poll(() => received, {timeout: 10_000}).toContainEqual(['rd/set', 'cool']);
        expect(await isChecked('cool')).toBe(true);
    });

    it('follows the subscribed state topic', async () => {
        await new Promise(resolve => mqttClient.publish('rd/state', 'heat', resolve));
        await expect.poll(() => isChecked('heat'), {timeout: 10_000}).toBe(true);
        expect(await isChecked('cool')).toBe(false);
    });
});

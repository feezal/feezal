/**
 * E2E: material-slider element — real viewer over MQTT:
 *   - clicking a track position publishes the corresponding value
 *   - a subscribe payload drives the slider position
 *   - min/max/step reach the inner md-slider
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite, startBroker} from './harness.js';

const SITE = 'matslider';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-material-slider subscribe="sl/state" publish="sl/set" min="0" max="100" step="1" style="position:absolute;top:20px;left:20px;width:300px;height:48px;"></feezal-element-material-slider>' +
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
    await new Promise(resolve => mqttClient.subscribe('sl/#', resolve));
    mqttClient.on('message', (topic, payload) => received.push([topic, payload.toString()]));

    viewer = await stack.context.newPage();
    await viewer.goto(`${stack.baseUrl}/viewer/${SITE}`);
    await viewer.waitForSelector('feezal-element-material-slider', {timeout: 30_000});
}, 120_000);

afterAll(async () => {
    if (stack.pageErrors.length) console.error('PAGE ERRORS:', stack.pageErrors);
    await new Promise(resolve => mqttClient.end(true, resolve));
    await viewer.close();
    await broker.close();
    await stopStack(stack);
});

const sliderValue = () => viewer.locator('md-slider').evaluate(el => el.value);

describe('material-slider', () => {
    it('passes min/max/step to the inner md-slider', async () => {
        await expect.poll(() => viewer.locator('md-slider').evaluate(el => [el.min, el.max, el.step]), {timeout: 10_000})
            .toEqual([0, 100, 1]);
    });

    it('publishes the value picked on the track', async () => {
        // Click ~the middle of the track — the committed value must arrive
        // on the publish topic and be roughly proportional to the position.
        const box = await viewer.locator('md-slider').boundingBox();
        await viewer.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await expect.poll(() => received.filter(([topic]) => topic === 'sl/set'), {timeout: 10_000})
            .not.toHaveLength(0);
        const value = Number(received.find(([topic]) => topic === 'sl/set')[1]);
        expect(value).toBeGreaterThan(35);
        expect(value).toBeLessThan(65);
    });

    it('follows the subscribed state topic', async () => {
        await new Promise(resolve => mqttClient.publish('sl/state', '80', resolve));
        await expect.poll(sliderValue, {timeout: 10_000}).toBe(80);

        await new Promise(resolve => mqttClient.publish('sl/state', 'not a number', resolve));
        await new Promise(r => setTimeout(r, 300));
        expect(await sliderValue()).toBe(80);
    });
});

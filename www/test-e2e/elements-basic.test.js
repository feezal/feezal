/**
 * E2E: basic element behaviours in the real viewer —
 *   - basic-number: subscribe payload → formatted display (digits,
 *     decimal separator, prefix/suffix)
 *   - basic-template: light-DOM <template> literal rendered with the
 *     received message (${msg.topic}/${msg.payload})
 *   - material-button: click publishes the configured payload; the
 *     variant attribute picks the md-* button flavour
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite, startBroker} from './harness.js';

const SITE = 'elementsbasic';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-basic-number subscribe="el/num" digits="1" decimal-separator="," prefix="~" suffix=" °C" style="position:absolute;top:20px;left:20px;width:140px;height:24px;"></feezal-element-basic-number>' +
    '<feezal-element-basic-template subscribe="el/tpl" style="position:absolute;top:60px;left:20px;width:260px;height:40px;">' +
    '<template>got ${msg.payload} on ${msg.topic}</template>' +
    '</feezal-element-basic-template>' +
    '<feezal-element-material-button label="press me" publish="el/cmd" payload="go" style="position:absolute;top:120px;left:20px;width:160px;height:48px;"></feezal-element-material-button>' +
    '<feezal-element-material-button label="quiet" variant="outlined" style="position:absolute;top:190px;left:20px;width:160px;height:48px;"></feezal-element-material-button>' +
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
    await new Promise(resolve => mqttClient.subscribe('el/#', resolve));
    mqttClient.on('message', (topic, payload) => received.push([topic, payload.toString()]));

    viewer = await stack.context.newPage();
    await viewer.goto(`${stack.baseUrl}/viewer/${SITE}`);
    await viewer.waitForSelector('feezal-element-basic-number', {timeout: 30_000});
}, 120_000);

afterAll(async () => {
    if (stack.pageErrors.length) console.error('PAGE ERRORS:', stack.pageErrors);
    await new Promise(resolve => mqttClient.end(true, resolve));
    await viewer.close();
    await broker.close();
    await stopStack(stack);
});

describe('basic-number', () => {
    it('formats the received payload with digits, separator, prefix and suffix', async () => {
        await new Promise(resolve => mqttClient.publish('el/num', '21.34', resolve));
        const number = viewer.locator('feezal-element-basic-number');
        await expect.poll(() => number.locator('#value').textContent(), {timeout: 10_000}).toBe('21,3');
        expect(await number.locator('#prefix').textContent()).toBe('~');
        expect(await number.locator('#suffix').textContent()).toBe(' °C');
    });

    it('re-formats when another value arrives', async () => {
        await new Promise(resolve => mqttClient.publish('el/num', '7', resolve));
        await expect.poll(() => viewer.locator('feezal-element-basic-number #value').textContent(), {timeout: 10_000})
            .toBe('7,0');
    });
});

describe('basic-template', () => {
    it('renders the template literal with the received message', async () => {
        await new Promise(resolve => mqttClient.publish('el/tpl', 'hello', resolve));
        await expect.poll(() => viewer.locator('feezal-element-basic-template #content').textContent(), {timeout: 10_000})
            .toBe('got hello on el/tpl');
    });

    it('follows subsequent messages', async () => {
        await new Promise(resolve => mqttClient.publish('el/tpl', 'again', resolve));
        await expect.poll(() => viewer.locator('feezal-element-basic-template #content').textContent(), {timeout: 10_000})
            .toBe('got again on el/tpl');
    });
});

describe('material-button', () => {
    it('publishes the configured payload on click', async () => {
        await viewer.locator('feezal-element-material-button[publish="el/cmd"]').click();
        await expect.poll(() => received, {timeout: 10_000}).toContainEqual(['el/cmd', 'go']);
    });

    it('does not publish without a topic', async () => {
        const before = received.length;
        await viewer.locator('feezal-element-material-button[variant="outlined"]').click();
        await new Promise(r => setTimeout(r, 500));
        expect(received.length).toBe(before);
    });

    it('renders the variant-specific Material button', async () => {
        await expect.poll(() => viewer.locator('feezal-element-material-button[publish="el/cmd"] md-filled-button').count()).toBe(1);
        await expect.poll(() => viewer.locator('feezal-element-material-button[variant="outlined"] md-outlined-button').count()).toBe(1);
        expect(await viewer.locator('feezal-element-material-button[publish="el/cmd"] md-filled-button').textContent()).toContain('press me');
    });
});

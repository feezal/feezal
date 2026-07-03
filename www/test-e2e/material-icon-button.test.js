/**
 * E2E: material-icon-button element ("Material - Icon") — real viewer over MQTT:
 *   - action mode: click publishes the configured payload
 *   - renders the configured icon through <feezal-icon>
 *   - toggle mode: click publishes on/off alternately, subscribe drives the
 *     selected state
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite, startBroker} from './harness.js';

const SITE = 'maticonbutton';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-material-icon-button id="action" icon="home" publish="ib/cmd" payload="ping" style="position:absolute;top:20px;left:20px;width:48px;height:48px;"></feezal-element-material-icon-button>' +
    '<feezal-element-material-icon-button id="toggle" toggle icon="lightbulb" icon-off="lightbulb_outline" subscribe="ib/state" publish="ib/set" payload-on="ON" payload-off="OFF" style="position:absolute;top:90px;left:20px;width:48px;height:48px;"></feezal-element-material-icon-button>' +
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
    await new Promise(resolve => mqttClient.subscribe('ib/#', resolve));
    mqttClient.on('message', (topic, payload) => received.push([topic, payload.toString()]));

    viewer = await stack.context.newPage();
    await viewer.goto(`${stack.baseUrl}/viewer/${SITE}`);
    await viewer.waitForSelector('feezal-element-material-icon-button', {timeout: 30_000});
}, 120_000);

afterAll(async () => {
    if (stack.pageErrors.length) console.error('PAGE ERRORS:', stack.pageErrors);
    await new Promise(resolve => mqttClient.end(true, resolve));
    await viewer.close();
    await broker.close();
    await stopStack(stack);
});

const isSelected = () => viewer.locator('#toggle md-icon-button').evaluate(el => el.selected);

describe('material-icon-button', () => {
    it('renders the configured icon', async () => {
        await expect.poll(() => viewer.locator('#action feezal-icon').getAttribute('name'), {timeout: 10_000})
            .toBe('home');
    });

    it('publishes the payload on click (action mode)', async () => {
        await viewer.locator('#action md-icon-button').click();
        await expect.poll(() => received, {timeout: 10_000}).toContainEqual(['ib/cmd', 'ping']);
    });

    it('publishes on/off alternately in toggle mode', async () => {
        await viewer.locator('#toggle md-icon-button').click();
        await expect.poll(() => received, {timeout: 10_000}).toContainEqual(['ib/set', 'ON']);

        await viewer.locator('#toggle md-icon-button').click();
        await expect.poll(() => received, {timeout: 10_000}).toContainEqual(['ib/set', 'OFF']);
    });

    it('follows the subscribed state topic in toggle mode', async () => {
        await new Promise(resolve => mqttClient.publish('ib/state', 'ON', resolve));
        await expect.poll(isSelected, {timeout: 10_000}).toBe(true);

        await new Promise(resolve => mqttClient.publish('ib/state', 'OFF', resolve));
        await expect.poll(isSelected, {timeout: 10_000}).toBe(false);
    });
});

/**
 * E2E: basic-icon element — real viewer + editor:
 *   - renders the configured icon; a subscribe payload switches it
 *   - CLICK-THROUGH in the viewer: an icon placed on top of a button does
 *     not block it (the publish reaches the broker)
 *   - in the editor the icon stays selectable despite click-through
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite, startBroker} from './harness.js';

const SITE = 'basicicon';
// Icon deliberately AFTER (= painted above) the fully overlapping button.
// Configured icon is set-prefixed and statically in the HTML, so the viewer's
// tree-shaken registration contains it; the payload switches to a bare
// Material name (always renderable). Payload icons from prefixed sets must
// appear statically somewhere — the documented dynamic-name caveat
// (icons-spec §4a).
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-material-button label="press" publish="bi/cmd" payload="go" style="position:absolute;top:100px;left:100px;width:160px;height:60px;"></feezal-element-material-button>' +
    '<feezal-element-basic-icon icon="mdi:sofa" subscribe="bi/icon" style="position:absolute;top:106px;left:110px;width:48px;height:48px;"></feezal-element-basic-icon>' +
    '</feezal-view></feezal-site>';

let stack;
let broker;

beforeAll(async () => {
    stack = await startStack();
    broker = await startBroker();
    await deploySite(stack.baseUrl, {name: SITE, html: SITE_HTML, connection: {backend: 'mqtt', uri: broker.uri}});
}, 60_000);

afterAll(async () => {
    if (stack.pageErrors.length) console.error('PAGE ERRORS:', stack.pageErrors);
    await broker.close();
    await stopStack(stack);
});

describe('viewer', () => {
    it('renders, is click-through, and follows payload icon switches', async () => {
        const received = [];
        const mqtt = (await import('mqtt')).default ?? (await import('mqtt'));
        const sub = mqtt.connect(broker.uri);
        await new Promise(resolve => sub.once('connect', resolve));
        await new Promise(resolve => sub.subscribe('bi/#', resolve));
        sub.on('message', (topic, payload) => received.push([topic, payload.toString()]));

        const viewer = await stack.context.newPage();
        try {
            await viewer.goto(`${stack.baseUrl}/viewer/${SITE}`);
            const icon = viewer.locator('feezal-element-basic-icon');
            await viewer.waitForSelector('feezal-element-basic-icon', {timeout: 30_000});

            // Renders the configured set-prefixed icon (shaken registration).
            await expect.poll(() => icon.locator('feezal-icon').getAttribute('name')).toBe('mdi:sofa');
            await expect.poll(() => icon.locator('feezal-icon svg path').count()).toBe(1);

            // CLICK-THROUGH: click the icon's centre — the button beneath fires.
            const box = await icon.boundingBox();
            await viewer.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            await expect.poll(() => received).toContainEqual(['bi/cmd', 'go']);

            // Payload switches the icon (bare Material name — ligature glyph).
            await new Promise(resolve => sub.publish('bi/icon', 'lightbulb', resolve));
            await expect.poll(() => icon.locator('feezal-icon').getAttribute('name'), {timeout: 10_000})
                .toBe('lightbulb');
            expect(await icon.locator('feezal-icon .glyph').textContent()).toBe('lightbulb');
        } finally {
            await new Promise(resolve => sub.end(true, resolve));
            await viewer.close();
        }
    });
});

describe('editor', () => {
    it('the icon is selectable on the canvas despite click-through', async () => {
        const page = stack.page;
        await page.goto(`${stack.baseUrl}/editor/?/${SITE}/`);
        await page.waitForSelector('feezal-palette .element', {timeout: 60_000});
        await page.locator('feezal-element-basic-icon').click();
        await expect.poll(() => page.evaluate(() =>
            document.querySelector('feezal-element-basic-icon').classList.contains('feezal-selected'))).toBe(true);
    });
});

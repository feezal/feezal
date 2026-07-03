/**
 * E2E: retained-state replay into EDITOR elements at load (B16 follow-up).
 *
 * Regression guard for two stacked bugs:
 *  - the hub evicted retained topics from its replay cache on live updates
 *    (B16, [MQTT-3.3.1-9])
 *  - the feezal socket backend dispatched 'connected' as bubbles+composed
 *    from inside the wrapper's shadow root, so wrapper listeners saw it
 *    TWICE → getSite/loadViews ran twice, elements were built twice, and the
 *    replay raced the second generation (state missing ~50/50 per load).
 *
 * The editor is loaded (and reloaded) with a retained value already on the
 * broker — elements must reflect it every time, and the site must be loaded
 * exactly once per page load.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite, startBroker} from './harness.js';

const SITE = 'replayed';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-basic-icon-value icon="knx-uf:fts_garage_door" subscribe="replay/pos" style="position:absolute;top:60px;left:60px;width:64px;height:64px;"></feezal-element-basic-icon-value>' +
    '<feezal-element-basic-number subscribe="replay/pos" style="position:absolute;top:60px;left:200px;width:64px;height:20px;"></feezal-element-basic-number>' +
    '</feezal-view></feezal-site>';

let stack;
let broker;
let page;

beforeAll(async () => {
    stack = await startStack();
    page = stack.page;
    broker = await startBroker();
    await broker.publishRetained('replay/pos', '70');
    await deploySite(stack.baseUrl, {name: SITE, html: SITE_HTML, connection: {backend: 'mqtt', uri: broker.uri}});
    // Allow live MQTT manipulation of editor elements (setting is opt-out).
    await page.addInitScript(() => localStorage.setItem('preventEditorMqtt', 'false'));
}, 60_000);

afterAll(async () => {
    if (stack.pageErrors.length) console.error('PAGE ERRORS:', stack.pageErrors);
    await broker.close();
    await stopStack(stack);
});

const state = () => page.evaluate(() => ({
    icon: document.querySelector('feezal-element-basic-icon-value')
        ?.shadowRoot.querySelector('feezal-icon')?.getAttribute('name'),
    number: document.querySelector('feezal-element-basic-number')
        ?.shadowRoot.querySelector('#value')?.textContent,
    // One generation of elements → exactly one base subscription per element.
    baseSubs: feezal.connection.subscriptions.filter(s => s.topic === 'replay/pos').length
}));

describe('retained replay at editor load', () => {
    it('elements reflect the retained value on every load (3 loads)', async () => {
        for (let load = 1; load <= 3; load++) {
            await page.goto(`${stack.baseUrl}/editor/?/${SITE}/`);
            await page.waitForSelector('feezal-palette .element', {timeout: 60_000});
            await expect.poll(state, {timeout: 10_000}).toMatchObject({
                icon: 'knx-uf:fts_garage_door_70',
                number: '70',
                baseSubs: 2
            });
        }
    });

    it('live updates still reach the elements afterwards', async () => {
        await broker.publishRetained('replay/pos', '30');
        await expect.poll(state, {timeout: 10_000}).toMatchObject({
            icon: 'knx-uf:fts_garage_door_30',
            number: '30'
        });
    });
});

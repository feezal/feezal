/**
 * E2E broker drop / reconnect (A17 automation candidate #7).
 *
 * The viewer is connected through the server's Socket.IO bridge (mqtt:// URI).
 * The broker dies mid-session and comes back on the same port with a new
 * retained value — the bridge auto-reconnects (5s period), re-subscribes to
 * '#', receives the retained replay and relays it to the still-open viewer.
 */
import {describe, it, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite, startBroker} from './harness.js';

const SITE_HTML =
    '<feezal-site><feezal-view name="main">' +
    '<feezal-element-basic-number subscribe="reconnect/val" style="top:10px;left:10px;"></feezal-element-basic-number>' +
    '</feezal-view></feezal-site>';

let stack;
let broker;

beforeAll(async () => {
    stack = await startStack();
    broker = await startBroker();
    await broker.publishRetained('reconnect/val', '23.5');

    const bridgeSubscribed = new Promise(r => broker.broker.once('subscribe', r));
    await deploySite(stack.baseUrl, {
        name: 'reconnectsite',
        html: SITE_HTML,
        connection: {backend: 'mqtt', uri: broker.uri}
    });
    await bridgeSubscribed;
}, 60_000);

afterAll(async () => {
    await stopStack(stack);
    await broker.close().catch(() => {});
});

function valueShown(page, text) {
    return page.waitForFunction(t => {
        const el = document.querySelector('feezal-element-basic-number');
        return el?.shadowRoot?.textContent.includes(t);
    }, text, {timeout: 30_000});
}

describe('viewer survives a broker restart', () => {
    it('renders the initial retained value', async () => {
        await stack.page.goto(stack.baseUrl + '/viewer/reconnectsite');
        await valueShown(stack.page, '23.5');
    });

    it('receives a retained value published after the broker restarts', async () => {
        const port = broker.port;
        await broker.close();

        // Same port, fresh broker, new retained state.
        broker = await startBroker(port);
        await broker.publishRetained('reconnect/val', '55');

        // Bridge reconnects (5s retry), re-subscribes, gets the retained
        // replay, relays it to the still-open viewer page.
        await valueShown(stack.page, '55');
    });
});

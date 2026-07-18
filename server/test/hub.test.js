/**
 * Integration tests for socket/hub.js — a real Socket.IO server with real
 * socket.io-client connections and a temp-dir FilesystemStorage.
 *
 * The final block wires up the whole editor message path: an aedes MQTT
 * broker, the bridge (connected via `deploy`) and the hub relay, asserting
 * that a broker publish reaches a subscribed Socket.IO client.
 */
import {describe, it, expect, vi, beforeAll, afterAll} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';

const require = createRequire(import.meta.url);
const {createServer} = require('http');
const {Server} = require('socket.io');
const {io: ioc} = require('socket.io-client');
const createHub = require('../src/socket/hub.js');
const FilesystemStorage = require('../src/storage/filesystem.js');
const bridge = require('../src/mqtt/bridge.js');
const {Aedes} = require('aedes');
const net = require('net');
const mqtt = require('mqtt');

const logger = {debug() {}, info() {}, warn() {}, error() {}};

let dataDir;
let httpServer;
let io;
let hub;
let url;
const clients = [];

function connectClient() {
    const client = ioc(url, {transports: ['websocket'], forceNew: true});
    clients.push(client);
    return new Promise((resolve, reject) => {
        client.once('connect', () => resolve(client));
        client.once('connect_error', reject);
    });
}

const emitAck = (client, event, ...args) =>
    new Promise(resolve => client.emit(event, ...args, resolve));

const nextEvent = (client, event) =>
    new Promise(resolve => client.once(event, resolve));

/** Collect all `event` payloads arriving within `ms`. */
function collect(client, event, ms = 300) {
    const seen = [];
    const handler = msg => seen.push(msg);
    client.on(event, handler);
    return new Promise(resolve => setTimeout(() => {
        client.off(event, handler);
        resolve(seen);
    }, ms));
}

beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'feezal-hub-test-'));
    const storage = new FilesystemStorage(dataDir);
    httpServer = createServer();
    io = new Server(httpServer);
    hub = createHub(io, {storage, logger});
    await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
    url = 'http://127.0.0.1:' + httpServer.address().port;
});

afterAll(async () => {
    clients.forEach(c => c.close());
    io.close();
    await new Promise(resolve => httpServer.close(resolve));
    await rm(dataDir, {recursive: true, force: true});
});

describe('getSite / deploy', () => {
    it('returns a default scaffold for an unknown site', async () => {
        const client = await connectClient();
        const res = await emitAck(client, 'getSite', 'does-not-exist');
        // FilesystemStorage seeds unknown sites with a one-view scaffold
        // carrying the default topics (subscribe feezal/<site>/set,
        // publish feezal/<site>).
        expect(res.views).toContain('<feezal-site subscribe="feezal/does-not-exist/set" publish="feezal/does-not-exist">');
        expect(res.views).toContain('<feezal-view name="view1"');
        // Never-saved site seeds the default theme (see storage.getSite).
        expect(res.viewer).toEqual({theme: 'feezal-theme-midnight-blue'});
    });

    it('deploy saves the site and getSite returns the formatted html + config', async () => {
        const client = await connectClient();
        await emitAck(client, 'deploy', {
            site: {name: 'hubsite'},
            html: '<feezal-site><feezal-view name="home"><feezal-element-material-switch topic="a/b"></feezal-element-material-switch></feezal-view></feezal-site>',
            viewer: {theme: 'feezal-theme-dark-mint'},
            connection: {backend: 'feezal'}
        });

        const res = await emitAck(client, 'getSite', 'hubsite');
        expect(res.views).toContain('<feezal-element-material-switch topic="a/b">');
        expect(res.views).toContain('<feezal-view name="home">');
        expect(res.viewer).toEqual({
            viewer: {theme: 'feezal-theme-dark-mint'},
            connection: {backend: 'feezal'}
        });
    });

    it('deploy defaults the site name and notifies all clients to reload', async () => {
        const deployer = await connectClient();
        const bystander = await connectClient();
        const reloaded = nextEvent(bystander, 'reload');
        await emitAck(deployer, 'deploy', {html: '<feezal-site></feezal-site>'});
        await reloaded;   // resolves only if 'reload' was broadcast

        const res = await emitAck(deployer, 'getSite', 'default');
        expect(res.views).toContain('<feezal-site>');
    });

    it('N32: the reload broadcast carries the deployed site name', async () => {
        const deployer = await connectClient();
        const bystander = await connectClient();
        const reloaded = nextEvent(bystander, 'reload');
        await emitAck(deployer, 'deploy', {site: {name: 'n32site'}, html: '<feezal-site></feezal-site>'});
        expect(await reloaded).toMatchObject({site: 'n32site'});
    });

    it('N32: auto-reload="off" on the site suppresses the reload broadcast', async () => {
        const deployer = await connectClient();
        const bystander = await connectClient();
        const seen = collect(bystander, 'reload', 300);
        await emitAck(deployer, 'deploy', {
            site: {name: 'n32off'},
            html: '<feezal-site auto-reload="off"></feezal-site>'
        });
        expect(await seen).toEqual([]);
    });

    it('N32: deploy publishes the site control reload topic, non-retained', async () => {
        const spy = vi.spyOn(bridge, 'publish').mockImplementation(() => {});
        try {
            const deployer = await connectClient();
            await emitAck(deployer, 'deploy', {
                site: {name: 'n32mqtt'},
                html: '<feezal-site subscribe="home/site"></feezal-site>'
            });
            expect(spy).toHaveBeenCalledWith({topic: 'home/site/reload', payload: '1'});

            // auto-reload="off" also suppresses the MQTT publish
            spy.mockClear();
            await emitAck(deployer, 'deploy', {
                site: {name: 'n32mqtt'},
                html: '<feezal-site subscribe="home/site" auto-reload="off"></feezal-site>'
            });
            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });
});

describe('send / subscribe message bus', () => {
    it('echoes a sent message back to the sender', async () => {
        const client = await connectClient();
        const input = nextEvent(client, 'input');
        client.emit('send', {topic: 'echo/x', payload: 'hi', retain: false});
        expect(await input).toMatchObject({topic: 'echo/x', payload: 'hi'});
    });

    it('replays cached retained messages on subscribe', async () => {
        const sender = await connectClient();
        sender.emit('send', {topic: 'cache/state', payload: 'on', retain: true});

        const late = await connectClient();
        const input = nextEvent(late, 'input');
        late.emit('subscribe', ['cache/#']);
        expect(await input).toMatchObject({
            topic: 'cache/state', payload: 'on', cached: true
        });
    });

    it('cache replay parses JSON string payloads like the bridge relay does', async () => {
        // A bridge-mode viewer sends its presence status as a raw JSON string;
        // the broker path delivers it parsed. The cache replay must serve the
        // same TYPE — the Clients panel requires payload.connectedSince on an
        // object and silently dropped string replays.
        const sender = await connectClient();
        sender.emit('send', {topic: 'cachejson/clients/v1/status',
            payload: '{"view":"main","connectedSince":"2026-07-12T00:00:00Z"}', retain: true});

        const late = await connectClient();
        const input = nextEvent(late, 'input');
        late.emit('subscribe', ['cachejson/clients/+/status']);
        expect(await input).toMatchObject({
            topic: 'cachejson/clients/v1/status',
            payload: {view: 'main', connectedSince: '2026-07-12T00:00:00Z'},
            cached: true
        });
    });

    // Known-retained model: the broker strips RETAIN on live deliveries
    // [MQTT-3.3.1-9], so retained state topics receive their updates with
    // retain=0. A topic seen retained once stays cached; later messages
    // refresh the cached payload; only an empty payload evicts.

    it('a later retain=0 update refreshes the cache instead of evicting (live delivery of a retained publish)', async () => {
        const sender = await connectClient();
        sender.emit('send', {topic: 'fresh/state', payload: 'old', retain: true});
        sender.emit('send', {topic: 'fresh/state', payload: 'new', retain: false});

        const late = await connectClient();
        const seenPromise = collect(late, 'input');
        late.emit('subscribe', ['fresh/#']);
        const seen = await seenPromise;
        expect(seen).toHaveLength(1);
        expect(seen[0]).toMatchObject({topic: 'fresh/state', payload: 'new', cached: true});
    });

    it('an empty payload evicts (retained-clear, also as its retain=0 live delivery)', async () => {
        const sender = await connectClient();
        sender.emit('send', {topic: 'clear/keep', payload: '1', retain: true});
        sender.emit('send', {topic: 'clear/gone', payload: '2', retain: true});
        sender.emit('send', {topic: 'clear/gone', payload: '', retain: false});
        sender.emit('send', {topic: 'clear/gone2', payload: '2', retain: true});
        sender.emit('send', {topic: 'clear/gone2', payload: '', retain: true});

        const late = await connectClient();
        const seenPromise = collect(late, 'input');
        late.emit('subscribe', ['clear/#']);
        const topics = (await seenPromise).map(m => m.topic);
        expect(topics).toContain('clear/keep');
        expect(topics).not.toContain('clear/gone');
        expect(topics).not.toContain('clear/gone2');
    });

    it('topics never seen retained (commands) are never cached', async () => {
        const sender = await connectClient();
        sender.emit('send', {topic: 'cmd/reload', payload: 'go', retain: false});

        const late = await connectClient();
        const seenPromise = collect(late, 'input');
        late.emit('subscribe', ['cmd/#']);
        expect(await seenPromise).toEqual([]);
    });

    // B19: a malformed send (undefined topic) used to reach mqtt.js and crash
    // the whole server process (packet.topic.toString() TypeError).
    it('ignores malformed send/subscribe payloads instead of crashing (B19)', async () => {
        const client = await connectClient();
        client.emit('send', {payload: 'no topic here', retain: false});
        client.emit('send', {topic: '', payload: 'empty topic'});
        client.emit('send', {topic: 42, payload: 'numeric topic'});
        client.emit('send', null);
        client.emit('subscribe', 'not-an-array');
        client.emit('subscribe', [null, 42, '']);
        client.emit('unsubscribe', {nope: true});

        // Server is still alive and processes a valid send afterwards.
        const input = nextEvent(client, 'input');
        client.emit('send', {topic: 'alive/ok', payload: 'still here', retain: false});
        expect(await input).toMatchObject({topic: 'alive/ok', payload: 'still here'});
    });

    // N24: a bridge-backend viewer registers its retained status topic via
    // the 'presence' event; the hub clears it on disconnect — the socket
    // equivalent of a direct-MQTT viewer's broker LWT.
    it('clears a registered presence topic on disconnect (N24)', async () => {
        const viewer = await connectClient();
        viewer.emit('presence', {topic: 'psite/clients/panel-1/status'});
        viewer.emit('send', {topic: 'psite/clients/panel-1/status', payload: '{"view":"home"}', retain: true});

        // The status is cached and replayed like any retained message.
        const watcher = await connectClient();
        const seenStatus = collect(watcher, 'input');
        watcher.emit('subscribe', ['psite/clients/#']);
        expect((await seenStatus).map(m => m.topic)).toContain('psite/clients/panel-1/status');

        // Viewer goes away → watcher receives the retained-clear…
        const seenClear = collect(watcher, 'input', 400);
        viewer.close();
        const clear = (await seenClear).find(m => m.topic === 'psite/clients/panel-1/status');
        expect(clear).toMatchObject({payload: '', retain: true});

        // …and the cache is evicted: a late subscriber gets no stale status.
        const late = await connectClient();
        const seenLate = collect(late, 'input');
        late.emit('subscribe', ['psite/clients/#']);
        expect(await seenLate).toEqual([]);
    });

    it('a disconnect without presence registration clears nothing (N24)', async () => {
        const viewer = await connectClient();
        viewer.emit('presence', {topic: 42});          // malformed → ignored
        const echoed = nextEvent(viewer, 'input');     // send is processed once it echoes
        viewer.emit('send', {topic: 'psite2/clients/x/status', payload: '{"view":"a"}', retain: true});
        await echoed;
        viewer.close();
        await new Promise(resolve => setTimeout(resolve, 200));

        const late = await connectClient();
        const seen = collect(late, 'input');
        late.emit('subscribe', ['psite2/clients/#']);
        // Status survives — nothing registered, so nothing was cleared.
        expect((await seen).map(m => m.topic)).toContain('psite2/clients/x/status');
    });

    it('broadcast() reaches only sockets with a matching subscription', async () => {
        const subscribed = await connectClient();
        const unrelated = await connectClient();
        subscribed.emit('subscribe', ['bc/+/temp']);

        // Give the subscribe event time to register before broadcasting.
        await vi.waitFor(async () => {
            const seen = collect(subscribed, 'input', 100);
            hub.broadcast({topic: 'bc/kitchen/temp', payload: 21});
            expect((await seen).map(m => m.topic)).toContain('bc/kitchen/temp');
        });

        const seenUnrelated = collect(unrelated, 'input', 200);
        hub.broadcast({topic: 'bc/kitchen/temp', payload: 22});
        expect(await seenUnrelated).toEqual([]);
    });

    it('topicSeen feeds the autocomplete trie', async () => {
        const client = await connectClient();
        client.emit('topicSeen', 'hubseen/kitchen/temp');
        await vi.waitFor(() => {
            expect(bridge.getTopicCompletions('hubseen/')).toEqual(['hubseen/kitchen/']);
        });
    });
});

describe('full chain: broker → bridge → hub → editor socket', () => {
    let broker;
    let brokerServer;
    let pubClient;
    let uri;

    beforeAll(async () => {
        broker = await Aedes.createBroker();
        brokerServer = net.createServer(broker.handle);
        await new Promise(resolve => brokerServer.listen(0, '127.0.0.1', resolve));
        uri = 'mqtt://127.0.0.1:' + brokerServer.address().port;

        // Deploy with a direct-MQTT connection config — the hub connects the bridge.
        const editor = await connectClient();
        const subscribed = new Promise(resolve => broker.once('subscribe', resolve));
        await emitAck(editor, 'deploy', {
            site: {name: 'chained'},
            html: '<feezal-site></feezal-site>',
            connection: {backend: 'mqtt', uri}
        });
        await subscribed;

        pubClient = mqtt.connect(uri);
        await new Promise(resolve => pubClient.once('connect', resolve));
    }, 15000);

    afterAll(async () => {
        bridge.disconnect();
        await new Promise(resolve => pubClient.end(true, resolve));
        await new Promise(resolve => broker.close(resolve));
        await new Promise(resolve => brokerServer.close(resolve));
    });

    it('relays a broker publish to a subscribed editor client', async () => {
        const editor = await connectClient();
        editor.emit('subscribe', ['chain/#']);

        // Retry the publish until the round trip completes (subscribe is async).
        await vi.waitFor(async () => {
            const seen = collect(editor, 'input', 150);
            pubClient.publish('chain/livingroom/temp', '42');
            const messages = await seen;
            expect(messages.map(m => m.topic)).toContain('chain/livingroom/temp');
            expect(messages.find(m => m.topic === 'chain/livingroom/temp').payload).toBe('42');
        }, {timeout: 5000});
    });

    it('editor publishes reach the broker through the bridge', async () => {
        const editor = await connectClient();
        const received = [];
        await new Promise(resolve => pubClient.subscribe('chainout/#', resolve));
        pubClient.on('message', (topic, payload) => received.push([topic, payload.toString()]));

        editor.emit('send', {topic: 'chainout/light/set', payload: 'on', retain: false});

        await vi.waitFor(() => {
            expect(received).toContainEqual(['chainout/light/set', 'on']);
        });
    });

    it('an always-retained topic still replays after live updates (the broker strips RETAIN on live deliveries)', async () => {
        // The user-reported bug. Real-world sequence: the broker's retained
        // store predates the feezal server start. On (re)connect the bridge's
        // subscription replays it with retain=1 → cached. Every later update
        // — even though the device publishes retain=true — is forwarded to
        // the established subscription with retain=0 [MQTT-3.3.1-9]; the old
        // cache logic evicted the topic on that first update.
        await new Promise(resolve => pubClient.publish('always/state', 'v1', {retain: true}, resolve));

        // Reconnect the bridge ⇢ mirrors a feezal server start with existing
        // retained state: the fresh subscription replays the store retain=1.
        bridge.disconnect();
        const resubscribed = new Promise(resolve => broker.once('subscribe', resolve));
        const editor = await connectClient();
        await emitAck(editor, 'deploy', {
            site: {name: 'chained-retain'},
            html: '<feezal-site></feezal-site>',
            connection: {backend: 'mqtt', uri}
        });
        await resubscribed;

        // Wait until the retained replay populated the hub cache.
        await vi.waitFor(async () => {
            const probe = await connectClient();
            const seen = collect(probe, 'input', 150);
            probe.emit('subscribe', ['always/#']);
            expect((await seen).map(m => m.topic)).toContain('always/state');
            probe.close();
        }, {timeout: 5000});

        // Live retained UPDATE — the broker strips the flag on delivery.
        const witness = await connectClient();
        witness.emit('subscribe', ['always/#']);
        await vi.waitFor(async () => {
            const seen = collect(witness, 'input', 150);
            pubClient.publish('always/state', 'v2', {retain: true});
            const update = (await seen).find(m => m.topic === 'always/state' && !m.cached);
            expect(update.payload).toBe('v2');
            expect(update.retain).toBe(false);   // the trap: flag stripped live
        }, {timeout: 5000});

        // A frontend connecting NOW must still get a replay — with the fresh value.
        const late = await connectClient();
        const replayed = collect(late, 'input', 400);
        late.emit('subscribe', ['always/#']);
        const replay = (await replayed).filter(m => m.topic === 'always/state');
        // Up to two deliveries: the hub cache replay plus the broker's
        // refreshRetained() replay — every copy must carry the fresh value.
        expect(replay.length).toBeGreaterThanOrEqual(1);
        for (const m of replay) expect(m.payload).toBe('v2');
    });

    it('a topic first retained AFTER the bridge connected still replays to a late subscriber (N24 editor reload)', async () => {
        // The user-reported bug: a viewer publishes its retained presence
        // status while the server is already running. The bridge's standing
        // '#' subscription only ever sees it live (retain=0, the broker
        // strips the flag), so the hub's known-retained cache never learns
        // the topic — a reloaded editor subscribing <site>/clients/+/status
        // got nothing although the broker held the status retained.
        // refreshRetained() re-subscribes the filter so the broker replays it.
        await new Promise(resolve => pubClient.publish(
            'late/clients/viewer-ab12/status',
            JSON.stringify({connectedSince: '2026-07-11T00:00:00Z', view: 'Home'}),
            {retain: true},
            resolve
        ));

        const late = await connectClient();
        await vi.waitFor(async () => {
            const seen = collect(late, 'input', 250);
            late.emit('subscribe', ['late/clients/+/status']);
            const replay = (await seen).find(m => m.topic === 'late/clients/viewer-ab12/status');
            expect(replay).toBeTruthy();
            expect(replay.retain).toBe(true);
            expect(replay.payload).toMatchObject({view: 'Home'});
        }, {timeout: 5000});

        // The broker replay also populated the hub cache — the next late
        // subscriber is served even without the broker round trip.
        const cached = await connectClient();
        const replayed = collect(cached, 'input', 400);
        cached.emit('subscribe', ['late/clients/+/status']);
        const fromCache = (await replayed).filter(m => m.topic === 'late/clients/viewer-ab12/status');
        expect(fromCache.length).toBeGreaterThanOrEqual(1);
        expect(fromCache[0].payload).toMatchObject({view: 'Home'});
    });
});

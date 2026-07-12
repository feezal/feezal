/**
 * Tests for mqtt/bridge.js — topic trie unit tests plus integration against a
 * real in-memory MQTT broker (aedes over TCP) instead of mocks: retained
 * replay, JSON payload parsing, the relay callback and broker publishing.
 *
 * The trie/payload store is module-level state; the unit block runs before
 * the integration block because connect() clears the trie.
 */
import {describe, it, expect, vi, beforeAll, afterAll} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const bridge = require('../src/mqtt/bridge.js');
const {Aedes} = require('aedes');
const net = require('net');
const mqtt = require('mqtt');

const logger = {debug() {}, info() {}, warn() {}, error() {}};

describe('topic trie (unit)', () => {
    it('stores seen topics and lists them flat', () => {
        bridge.insertTopic('unit/a/b');
        bridge.insertTopic('unit/a');
        const topics = bridge.getAllTopics();
        expect(topics).toContain('unit/a/b');
        expect(topics).toContain('unit/a');
    });

    it('ignores empty topics and wildcards', () => {
        bridge.insertTopic('');
        bridge.insertTopic(null);
        bridge.insertTopic('unit/bad/#');
        bridge.insertTopic('unit/+/bad');
        const topics = bridge.getAllTopics();
        expect(topics.filter(t => t.includes('bad'))).toEqual([]);
    });

    it('completes the next segment, marking intermediates with a trailing slash', () => {
        bridge.insertTopic('comp/kitchen/temp');
        bridge.insertTopic('comp/kitchen/humidity');
        bridge.insertTopic('comp/hall');
        expect(bridge.getTopicCompletions('comp/')).toEqual(['comp/kitchen/', 'comp/hall']);
        expect(bridge.getTopicCompletions('comp/kitchen/')).toEqual(
            ['comp/kitchen/temp', 'comp/kitchen/humidity']
        );
    });

    it('filters by the partial last segment', () => {
        bridge.insertTopic('comp/kitchen/temp');
        bridge.insertTopic('comp/hall');
        expect(bridge.getTopicCompletions('comp/ki')).toEqual(['comp/kitchen/']);
    });

    it('returns [] for an unknown parent path', () => {
        expect(bridge.getTopicCompletions('nosuch/parent/')).toEqual([]);
    });

    it('caps completions at 20', () => {
        for (let i = 0; i < 25; i++) bridge.insertTopic(`cap/t${String(i).padStart(2, '0')}`);
        expect(bridge.getTopicCompletions('cap/')).toHaveLength(20);
    });

    it('recordPayload/getLastPayload round-trip, null when unseen', () => {
        bridge.recordPayload('unit/pay', {v: 1}, '{"v":1}', true);
        expect(bridge.getLastPayload('unit/pay')).toMatchObject({
            payload: {v: 1}, raw: '{"v":1}', retain: true
        });
        expect(bridge.getLastPayload('unit/never')).toBeNull();
    });
});

describe('guardEmptyWsFrames (unit)', () => {
    function fakeSocket() {
        const sent = [];
        return {sent, send(data, options, callback) { sent.push({data, options}); if (typeof options === 'function') options(); else if (callback) callback(); }};
    }

    it('drops zero-length sends but still invokes the callback', () => {
        const s = bridge.guardEmptyWsFrames(fakeSocket());
        let called = 0;
        s.send(Buffer.alloc(0), () => called++);
        s.send('', undefined, () => called++);
        s.send(undefined, () => called++);
        expect(s.sent).toEqual([]);
        expect(called).toBe(3);
    });

    it('passes non-empty sends through unchanged', () => {
        const s = bridge.guardEmptyWsFrames(fakeSocket());
        let called = 0;
        s.send(Buffer.from([0x31, 0x05]), {binary: true}, () => called++);
        s.send('x', () => called++);
        expect(s.sent).toHaveLength(2);
        expect(s.sent[0].data).toEqual(Buffer.from([0x31, 0x05]));
        expect(s.sent[0].options).toEqual({binary: true});
        expect(called).toBe(2);
    });
});

describe('buildConnectOptions (unit)', () => {
    it('installs the empty-frame-guarded websocket factory', async () => {
        const options = await bridge.buildConnectOptions({});
        expect(typeof options.createWebsocket).toBe('function');
    });
});

describe('against a real broker (aedes)', () => {
    let broker;
    let server;
    let uri;
    let pubClient;

    beforeAll(async () => {
        broker = await Aedes.createBroker();
        server = net.createServer(broker.handle);
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        uri = 'mqtt://127.0.0.1:' + server.address().port;

        // A retained message that exists BEFORE the bridge subscribes — the
        // broker replays it with the retain flag set.
        await new Promise((resolve, reject) => broker.publish(
            {topic: 'int/retained/greeting', payload: 'hello', retain: true, qos: 0, cmd: 'publish'},
            err => err ? reject(err) : resolve()
        ));

        const subscribed = new Promise(resolve => broker.once('subscribe', resolve));
        bridge.connect({backend: 'mqtt', uri}, logger, null);
        await subscribed;

        pubClient = mqtt.connect(uri);
        await new Promise(resolve => pubClient.once('connect', resolve));
    }, 15000);

    afterAll(async () => {
        bridge.setRelayCallback(null);
        bridge.disconnect();
        await new Promise(resolve => pubClient.end(true, resolve));
        await new Promise(resolve => broker.close(resolve));
        await new Promise(resolve => server.close(resolve));
    });

    it('receives the retained message with the retain flag', async () => {
        await vi.waitFor(() => {
            expect(bridge.getLastPayload('int/retained/greeting')).toMatchObject({
                payload: 'hello', raw: 'hello', retain: true
            });
        });
        expect(bridge.getAllTopics()).toContain('int/retained/greeting');
    });

    it('records live messages in the trie and payload store', async () => {
        pubClient.publish('int/kitchen/temp', '21.5');
        await vi.waitFor(() => {
            expect(bridge.getLastPayload('int/kitchen/temp')).toMatchObject({
                payload: '21.5', raw: '21.5'
            });
        });
        expect(bridge.getTopicCompletions('int/kitchen/')).toContain('int/kitchen/temp');
    });

    it('auto-parses JSON payloads, keeping the raw string', async () => {
        pubClient.publish('int/json', '{"brightness": 128}');
        await vi.waitFor(() => {
            expect(bridge.getLastPayload('int/json')).toMatchObject({
                payload: {brightness: 128}, raw: '{"brightness": 128}'
            });
        });

        pubClient.publish('int/badjson', '{oops');
        await vi.waitFor(() => {
            expect(bridge.getLastPayload('int/badjson')).toMatchObject({payload: '{oops'});
        });
    });

    it('forwards incoming messages to the relay callback (hub wiring)', async () => {
        const relay = vi.fn();
        bridge.setRelayCallback(relay);
        pubClient.publish('int/relay/me', '7');
        await vi.waitFor(() => {
            expect(relay).toHaveBeenCalledWith(
                expect.objectContaining({topic: 'int/relay/me', payload: '7'})
            );
        });
        bridge.setRelayCallback(null);
    });

    it('getStatus reports the live connection for the editor indicator', async () => {
        await vi.waitFor(() => {
            expect(bridge.getStatus()).toMatchObject({connected: true, uri, lastError: null});
        });
    });

    it('reconnect() forces a fresh connection for an UNCHANGED uri/certDir (cert upload)', async () => {
        // connect() with identical parameters is a no-op by design…
        bridge.connect({backend: 'mqtt', uri}, logger, null);
        expect(bridge.getStatus().connected).toBe(true);
        // …reconnect() must tear down and re-establish (re-reading TLS files).
        const reconnected = new Promise(resolve => broker.once('clientReady', resolve));
        bridge.reconnect({backend: 'mqtt', uri}, logger, null);
        await reconnected;
        await vi.waitFor(() => {
            expect(bridge.getStatus()).toMatchObject({connected: true, uri});
        });
    });

    it('publish() sends strings verbatim and JSON-encodes objects', async () => {
        const received = [];
        await new Promise(resolve => pubClient.subscribe('out/#', resolve));
        pubClient.on('message', (topic, payload) => received.push([topic, payload.toString()]));

        bridge.publish({topic: 'out/string', payload: 'plain'});
        bridge.publish({topic: 'out/object', payload: {a: 1}});
        bridge.publish({topic: 'out/null', payload: null});

        await vi.waitFor(() => expect(received).toHaveLength(3));
        expect(received).toContainEqual(['out/string', 'plain']);
        expect(received).toContainEqual(['out/object', '{"a":1}']);
        expect(received).toContainEqual(['out/null', '']);
    });

    // N24: viewer presence — the bridge must forward the retain flag so a
    // status lands in the broker's retained store and an empty retained
    // publish clears it again.
    it('publish() forwards retain: a retained status is replayed to late subscribers, an empty retained publish clears it', async () => {
        bridge.publish({topic: 'pres/clients/p1/status', payload: '{"view":"home"}', retain: true});

        // A client subscribing AFTER the publish only sees it if it was retained.
        const late = mqtt.connect(uri);
        await new Promise(resolve => late.once('connect', resolve));
        const received = [];
        late.on('message', (topic, payload, packet) => received.push([topic, payload.toString(), packet.retain]));
        await new Promise(resolve => late.subscribe('pres/#', resolve));
        await vi.waitFor(() => {
            expect(received).toContainEqual(['pres/clients/p1/status', '{"view":"home"}', true]);
        });

        // Retained-clear: empty payload + retain → removed from the store.
        bridge.publish({topic: 'pres/clients/p1/status', payload: '', retain: true});
        await vi.waitFor(async () => {
            const probe = mqtt.connect(uri);
            await new Promise(resolve => probe.once('connect', resolve));
            const seen = [];
            probe.on('message', (topic, payload) => seen.push([topic, payload.toString()]));
            await new Promise(resolve => probe.subscribe('pres/#', resolve));
            await new Promise(resolve => setTimeout(resolve, 150));
            await new Promise(resolve => probe.end(false, resolve));
            expect(seen).toEqual([]);
        }, {timeout: 5000});

        await new Promise(resolve => late.end(false, resolve));
    }, 15000);

    it('publish() without retain does not retain (commands stay ephemeral)', async () => {
        bridge.publish({topic: 'pres/clients/p1/reload', payload: '1'});

        const late = mqtt.connect(uri);
        await new Promise(resolve => late.once('connect', resolve));
        const seen = [];
        late.on('message', (topic, payload) => seen.push([topic, payload.toString()]));
        await new Promise(resolve => late.subscribe('pres/clients/p1/reload', resolve));
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(seen).toEqual([]);
        await new Promise(resolve => late.end(false, resolve));
    });

    // B19: an undefined/empty topic used to reach mqtt.js and crash the
    // process (TypeError in _removeTopicAliasAndRecoverTopicName).
    it('publish() skips messages without a valid topic instead of throwing (B19)', () => {
        expect(() => bridge.publish({payload: 'no topic'})).not.toThrow();
        expect(() => bridge.publish({topic: '', payload: 'empty'})).not.toThrow();
        expect(() => bridge.publish({topic: 42, payload: 'numeric'})).not.toThrow();
        expect(() => bridge.publish(undefined)).not.toThrow();
    });

    it('reconnecting to the same broker keeps the trie', () => {
        bridge.insertTopic('int/keep/me');
        bridge.connect({backend: 'mqtt', uri}, logger, null);   // same uri → no-op
        expect(bridge.getAllTopics()).toContain('int/keep/me');
    });

    it('ignores configs without an mqtt backend', () => {
        bridge.insertTopic('int/still/here');
        bridge.connect({backend: 'feezal', uri: 'mqtt://example:1883'}, logger, null);
        bridge.connect(null, logger, null);
        // no disconnect/clear happened
        expect(bridge.getAllTopics()).toContain('int/still/here');
    });
});

describe('buildConnectOptions (N8 TLS material / N9 protocol version)', () => {
    const {mkdtemp, rm, writeFile} = require('fs/promises');
    const {tmpdir} = require('os');
    const {join} = require('path');

    it('defaults: protocolVersion 4 (3.1.1), no credentials, bridge client id', async () => {
        const opts = await bridge.buildConnectOptions({uri: 'mqtt://b'}, null);
        expect(opts.protocolVersion).toBe(4);
        expect(opts.username).toBeUndefined();
        expect(opts.password).toBeUndefined();
        expect(opts.ca).toBeUndefined();
        expect(opts.clientId).toMatch(/^feezal-bridge-/);
    });

    it('passes protocolVersion 5 and credentials from the config', async () => {
        const opts = await bridge.buildConnectOptions(
            {protocolVersion: 5, username: 'u', password: 'p'}, null);
        expect(opts.protocolVersion).toBe(5);
        expect(opts.username).toBe('u');
        expect(opts.password).toBe('p');
    });

    it('coerces a string "5" and falls back to 4 for anything else', async () => {
        expect((await bridge.buildConnectOptions({protocolVersion: '5'}, null)).protocolVersion).toBe(5);
        expect((await bridge.buildConnectOptions({protocolVersion: 3}, null)).protocolVersion).toBe(4);
    });

    it('loads CA, client cert and key from the cert dir (mTLS); CA is additive to the system store', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'feezal-bridge-certs-'));
        try {
            await writeFile(join(dir, 'ca.pem'), 'CA-PEM');
            await writeFile(join(dir, 'client.crt'), 'CLIENT-CRT');
            await writeFile(join(dir, 'client.key'), 'CLIENT-KEY');
            const opts = await bridge.buildConnectOptions({}, dir);
            // The uploaded CA extends the system trust store instead of
            // replacing it (a private CA must not untrust public brokers).
            const {rootCertificates} = await import('tls');
            expect(Array.isArray(opts.ca)).toBe(true);
            expect(opts.ca.length).toBe(rootCertificates.length + 1);
            expect(opts.ca.at(-1)).toBe('CA-PEM');
            expect(opts.cert.toString()).toBe('CLIENT-CRT');
            expect(opts.key.toString()).toBe('CLIENT-KEY');
        } finally {
            await rm(dir, {recursive: true, force: true});
        }
    });

    it('missing cert files are skipped individually (CA-only setups)', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'feezal-bridge-certs-'));
        try {
            await writeFile(join(dir, 'ca.pem'), 'CA-ONLY');
            const opts = await bridge.buildConnectOptions({}, dir);
            expect(opts.ca.at(-1)).toBe('CA-ONLY');
            expect(opts.cert).toBeUndefined();
            expect(opts.key).toBeUndefined();
        } finally {
            await rm(dir, {recursive: true, force: true});
        }
    });
});

describe('status while the broker is unreachable', () => {
    it('records the connection error for the editor indicator', async () => {
        // Nothing listens on this port — ECONNREFUSED where the OS refuses
        // fast, otherwise the 10s connack timeout produces the error.
        bridge.connect({backend: 'mqtt', uri: 'mqtt://127.0.0.1:1'}, logger);
        await vi.waitFor(() => {
            expect(bridge.getStatus().lastError).toBeTruthy();
        }, {timeout: 15000, interval: 200});
        const status = bridge.getStatus();
        expect(status.connected).toBe(false);
        expect(status.uri).toBe('mqtt://127.0.0.1:1');
        expect(status.lastError.message).toMatch(/ECONNREFUSED|timeout|connect/i);
        bridge.disconnect();
        expect(bridge.getStatus()).toMatchObject({connected: false, uri: null});
    }, 20000);
});

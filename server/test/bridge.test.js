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

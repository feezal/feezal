import {describe, it, expect} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const tools  = require('../src/ai/tools.js');
const bridge = require('../src/mqtt/bridge.js');

describe('ai/tools — topic query grammar', () => {
    it('parses one keyword', () => {
        expect(tools.parseTopicQuery('kitchen')).toEqual({kw1: 'kitchen', kw2: null, negate: false});
    });
    it('keeps a multi-word keyword1 as one fuzzy phrase (no delimiter)', () => {
        expect(tools.parseTopicQuery('keller licht')).toEqual({kw1: 'keller licht', kw2: null, negate: false});
    });
    it('a comma introduces the segment filter (kw1 may be multi-word)', () => {
        expect(tools.parseTopicQuery('keller licht, set')).toEqual({kw1: 'keller licht', kw2: 'set', negate: false});
    });
    it('a comma + NOT negates the segment filter', () => {
        expect(tools.parseTopicQuery('keller licht, NOT set')).toEqual({kw1: 'keller licht', kw2: 'set', negate: true});
    });
    it('a standalone NOT (no comma) also delimits and negates', () => {
        expect(tools.parseTopicQuery('kitchen NOT set')).toEqual({kw1: 'kitchen', kw2: 'set', negate: true});
    });
    it('returns null for empty input', () => {
        expect(tools.parseTopicQuery('   ')).toBe(null);
    });
});

describe('ai/tools — matchTopics multi-word (order/separator independent)', () => {
    const topics = [
        'zigbee2mqtt/keller_licht/set',
        'zigbee2mqtt/keller_licht',
        'wohnzimmer/licht/keller',        // reversed word order
        'haus/keller-licht',              // hyphen
        'haus/kellerlicht',               // concatenated
        'kueche/licht',                   // only "licht"
        'keller/steckdose',               // only "keller"
    ];
    it('"keller licht" matches every separator/order combination', () => {
        const r = tools.matchTopics(topics, 'keller licht');
        expect(r).toEqual(expect.arrayContaining([
            'zigbee2mqtt/keller_licht/set',
            'zigbee2mqtt/keller_licht',
            'wohnzimmer/licht/keller',
            'haus/keller-licht',
            'haus/kellerlicht',
        ]));
        expect(r).not.toContain('kueche/licht');     // missing "keller"
        expect(r).not.toContain('keller/steckdose');  // missing "licht"
    });
    it('"keller licht, set" narrows to the command topic (exact segment)', () => {
        const r = tools.matchTopics(topics, 'keller licht, set');
        expect(r).toContain('zigbee2mqtt/keller_licht/set');
        expect(r).not.toContain('zigbee2mqtt/keller_licht');
    });
    it('"keller licht, NOT set" excludes the command topic', () => {
        const r = tools.matchTopics(topics, 'keller licht, NOT set');
        expect(r).toContain('zigbee2mqtt/keller_licht');
        expect(r).not.toContain('zigbee2mqtt/keller_licht/set');
    });
});

describe('ai/tools — matchElements (only real tags)', () => {
    const catalogue = [
        {tag: 'feezal-element-material-switch', name: 'Switch', category: 'material', attributes: ['subscribe', 'publish', 'payload-on', 'payload-off']},
        {tag: 'feezal-element-paper-switch',    name: 'Switch', category: 'paper',    attributes: ['subscribe', 'publish']},
        {tag: 'feezal-element-material-light',  name: 'Light',  category: 'material', attributes: ['subscribe', 'publish']},
        {tag: 'feezal-element-basic-gauge',     name: 'Gauge',  category: 'basic',    attributes: ['subscribe']},
    ];
    it('"switch" returns the real switch tags (never the invented feezal-element-switch)', () => {
        const r = tools.matchElements(catalogue, 'switch').map(e => e.tag);
        expect(r).toContain('feezal-element-material-switch');
        expect(r).toContain('feezal-element-paper-switch');
        expect(r).not.toContain('feezal-element-switch');
    });
    it('"light" returns the light element with its attributes', () => {
        const r = tools.matchElements(catalogue, 'light');
        expect(r[0].tag).toBe('feezal-element-material-light');
        expect(r[0].attributes).toContain('publish');
    });
});

describe('ai/tools — hasSegment (full topic parts only)', () => {
    it('matches a full segment', () => {
        expect(tools.hasSegment('zigbee2mqtt/lamp/set', 'set')).toBe(true);
    });
    it('is case-insensitive', () => {
        expect(tools.hasSegment('zigbee2mqtt/lamp/SET', 'set')).toBe(true);
    });
    it('does NOT match a partial segment', () => {
        expect(tools.hasSegment('zigbee2mqtt/lamp/reset', 'set')).toBe(false);
        expect(tools.hasSegment('zigbee2mqtt/settings/x', 'set')).toBe(false);
    });
});

describe('ai/tools — fuzzyScore', () => {
    it('scores a contiguous substring above a scattered subsequence', () => {
        const sub = tools.fuzzyScore('lamp', 'livinglampstate');   // substring
        const seq = tools.fuzzyScore('lst', 'livinglampstate');    // subsequence
        expect(sub).toBeGreaterThan(0);
        expect(seq).toBeGreaterThan(0);
        expect(sub).toBeGreaterThan(seq);
    });
    it('returns -1 when not even a subsequence', () => {
        expect(tools.fuzzyScore('xyz', 'livinglamp')).toBe(-1);
    });
});

describe('ai/tools — matchTopics (the worked examples)', () => {
    const topics = [
        'zigbee2mqtt/livingroom_lamp',
        'zigbee2mqtt/livingroom_lamp/set',
        'zigbee2mqtt/livingroom_lamp/availability',
        'zigbee2mqtt/kitchen_lamp/set',
        'shellies/livingroom/relay/0',
        'shellies/livingroom/relay/0/command',
    ];

    it('"livingroom set" (space = one fuzzy phrase) still surfaces the command topic', () => {
        const r = tools.matchTopics(topics, 'livingroom set');
        expect(r).toContain('zigbee2mqtt/livingroom_lamp/set');
        expect(r).not.toContain('zigbee2mqtt/livingroom_lamp');
        expect(r).not.toContain('zigbee2mqtt/kitchen_lamp/set');   // kw1 fuzzy excludes kitchen
    });

    it('"livingroom NOT set" → state topics, set excluded', () => {
        const r = tools.matchTopics(topics, 'livingroom NOT set');
        expect(r).toContain('zigbee2mqtt/livingroom_lamp');
        expect(r).toContain('zigbee2mqtt/livingroom_lamp/availability');
        expect(r).not.toContain('zigbee2mqtt/livingroom_lamp/set');
    });

    it('kw1 is fuzzy across the slash-stripped topic', () => {
        // "livlamp" is a subsequence of "zigbee2mqtt/livingroom_lamp" once slashes are ignored
        const r = tools.matchTopics(topics, 'livlamp');
        expect(r).toContain('zigbee2mqtt/livingroom_lamp');
    });
});

describe('ai/tools — matchDiscovery (fuzzy by name)', () => {
    const entities = [
        {discovery_id: 'light/kitchen', name: 'Kitchen Light', component: 'light',
         config: {state_topic: 'zk/kitchen', command_topic: 'zk/kitchen/set', device: {name: 'Kitchen Hub'}}},
        {discovery_id: 'sensor/temp', name: 'Living Room Temperature', component: 'sensor',
         config: {state_topic: 'zk/temp'}},
    ];
    it('finds an entity by fuzzy name and returns resolved topics', () => {
        const r = tools.matchDiscovery(entities, 'kitchen light');
        expect(r[0].name).toBe('Kitchen Light');
        expect(r[0].command_topic).toBe('zk/kitchen/set');
        expect(r[0].component).toBe('light');
    });
    it('returns [] when nothing matches', () => {
        expect(tools.matchDiscovery(entities, 'zzzzz')).toEqual([]);
    });
});

describe('bridge — getAllTopics / last payload (U26)', () => {
    it('flattens the trie including a topic that is also a prefix', () => {
        bridge.insertTopic('a/b/c');
        bridge.insertTopic('a/b');          // 'a/b' is both a real topic and a prefix of 'a/b/c'
        const all = bridge.getAllTopics();
        expect(all).toContain('a/b');
        expect(all).toContain('a/b/c');
    });
    it('records and returns the last payload', () => {
        bridge.recordPayload('a/b', {state: 'ON'}, '{"state":"ON"}', true);
        const rec = bridge.getLastPayload('a/b');
        expect(rec.payload).toEqual({state: 'ON'});
        expect(rec.retained).toBe(undefined);   // stored as .retain
        expect(rec.retain).toBe(true);
        expect(bridge.getLastPayload('nope')).toBe(null);
    });
});

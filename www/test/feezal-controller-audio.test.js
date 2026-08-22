/**
 * E188 — @feezal/feezal-controller-audio: capability-driven item discovery
 * over the status base, per-item ranges from /min /max sidecars, the list
 * dialects, clamped publishes and the editor guard.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {
    AudioController, audioAttributes, AUDIO_CONSUMED_ATTRIBUTES, audioDiscoveryMap, audioList, AUDIO_ITEMS,
} from '../packages/@feezal/feezal-controller-audio/feezal-controller-audio.js';

let published;
beforeEach(() => {
    published = [];
    window.feezal = {isEditor: false, connection: {pub: (topic, payload) => published.push({topic, payload})}};
});

function host(attrs = {}) {
    const el = document.createElement('div');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.subs = [];
    el.addSubscription = (topic, cb) => el.subs.push({topic, cb});
    el._unsubscribe = () => { el.subs = []; };
    el.getProperty = (msg, path) => path.split('.').reduce((o, k) => o?.[k], msg);
    el.requestUpdate = () => {};
    // deliver like the connection would: every wildcard handler sees the message
    el.deliver = (topic, payload) => el.subs.forEach(s => s.cb({topic, payload}));
    return el;
}

describe('the contract', () => {
    it('declares the audio attributes once and maps the recognizer keys onto them', () => {
        const names = audioAttributes.map(a => a.name);
        expect(names).toEqual(['subscribe', 'message-property', 'publish', 'label', 'items', 'show-flags', 'show-levels', 'show-mode']);
        expect(AUDIO_CONSUMED_ATTRIBUTES).toEqual(names);
        for (const [, target] of Object.entries(audioDiscoveryMap)) {
            expect(names).toContain(typeof target === 'string' ? target : target.attr);
        }
        expect(AUDIO_ITEMS.find(i => i.key === 'eq').list).toBe('eq_list');
    });

    it('audioList accepts arrays, JSON text and comma strings', () => {
        expect(audioList(['A', ' B'])).toEqual(['A', 'B']);
        expect(audioList('["Cinema","Music"]')).toEqual(['Cinema', 'Music']);
        expect(audioList('Standard, Game')).toEqual(['Standard', 'Game']);
        expect(audioList('')).toEqual([]);
    });
});

describe('capability-driven discovery', () => {
    it('renders only the items the device reports, in catalogue order, with its own ranges', () => {
        const el = host({subscribe: 'soundbar/status/', 'message-property': 'payload.val', publish: 'soundbar/set'});
        const a = new AudioController(el);
        a.wire();
        expect(el.subs.map(s => s.topic)).toEqual(['soundbar/status/+', 'soundbar/status/+/+']);

        el.deliver('soundbar/status/treble', {val: 2});
        el.deliver('soundbar/status/eq', {val: 'Cinema'});
        el.deliver('soundbar/status/eq_list', {val: ['Standard', 'Cinema', 'Music']});
        el.deliver('soundbar/status/woofer', {val: -3});
        el.deliver('soundbar/status/woofer/min', {val: -15});
        el.deliver('soundbar/status/woofer/max', {val: 6});
        el.deliver('soundbar/status/night_mode', {val: true});
        el.deliver('soundbar/status/volume', {val: 12});          // not an audio item
        el.deliver('soundbar/status/rear_level/min', {val: -6});  // a range without a value → nothing to render
        el.deliver('other/status/bass', {val: 1});               // not under the base

        expect(a.items.map(i => i.key)).toEqual(['eq', 'treble', 'woofer', 'night_mode']);
        const woofer = a.items.find(i => i.key === 'woofer');
        expect([woofer.min, woofer.max, woofer.value]).toEqual([-15, 6, -3]);
        const treble = a.items.find(i => i.key === 'treble');
        expect([treble.min, treble.max]).toEqual([-6, 6]);        // catalogue default
        const eq = a.items.find(i => i.key === 'eq');
        expect(eq.options).toEqual(['Standard', 'Cinema', 'Music']);
        expect(eq.value).toBe('Cinema');
        expect(a.mode).toBe('Cinema');
        expect(a.items.find(i => i.key === 'night_mode').value).toBe(true);
    });

    it('the items whitelist orders and filters; the show-* toggles drop kinds', () => {
        const el = host({subscribe: 'sb/status', items: 'night_mode, bass, nope', 'show-flags': 'false'});
        const a = new AudioController(el);
        a.wire();
        el.deliver('sb/status/bass', 1);
        el.deliver('sb/status/treble', 1);
        el.deliver('sb/status/night_mode', 'true');
        expect(a.items.map(i => i.key)).toEqual(['bass']);
        el.setAttribute('show-flags', 'true');
        expect(a.items.map(i => i.key)).toEqual(['night_mode', 'bass']);
    });

    it('does not subscribe without a base; rewires when the base changes', () => {
        const el = host({});
        const a = new AudioController(el);
        a.wire();
        expect(el.subs).toEqual([]);
        el.setAttribute('subscribe', 'x/status');
        a.rewireIfChanged();
        expect(el.subs.map(s => s.topic)).toEqual(['x/status/+', 'x/status/+/+']);
    });
});

describe('publishing', () => {
    it('set() clamps levels to the device range, publishes flags as true/false and the mode as text', () => {
        const el = host({subscribe: 'sb/status', publish: 'sb/set/'});
        const a = new AudioController(el);
        a.wire();
        el.deliver('sb/status/woofer/max', 3);
        a.set('woofer', 9);
        a.set('bass', '-2');
        a.set('night_mode', true);
        a.toggle('night_mode');
        a.set('eq', 'Music');
        a.set('eq', '');            // empty mode → nothing
        a.set('nope', 1);           // unknown item → nothing
        expect(published).toEqual([
            {topic: 'sb/set/woofer', payload: '3'},
            {topic: 'sb/set/bass', payload: '-2'},
            {topic: 'sb/set/night_mode', payload: 'true'},
            {topic: 'sb/set/night_mode', payload: 'false'},
            {topic: 'sb/set/eq', payload: 'Music'},
        ]);
        expect(a.values.get('woofer')).toBe(3);
        expect(a.values.get('eq')).toBe('Music');
    });

    it('publishes nothing without a command base or in the editor', () => {
        new AudioController(host({subscribe: 'sb/status'})).set('bass', 1);
        window.feezal.isEditor = true;
        new AudioController(host({subscribe: 'sb/status', publish: 'sb/set'})).set('bass', 1);
        expect(published).toEqual([]);
    });
});

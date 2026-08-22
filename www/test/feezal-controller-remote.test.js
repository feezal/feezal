/**
 * E187 — @feezal/feezal-controller-remote: the lgtv2mqtt key contract
 * (uppercased key names on …/button, app ids on …/launch, outputs, raw
 * paths), the buttons-list parsing, state reflection and the editor guard.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {
    RemoteController, remoteAttributes, REMOTE_CONSUMED_ATTRIBUTES, parseRemoteButtons,
    DEFAULT_REMOTE_BUTTONS, REMOTE_KINDS, PAD_KEYS,
} from '../packages/@feezal/feezal-controller-remote/feezal-controller-remote.js';

let published;

beforeEach(() => {
    published = [];
    window.feezal = {isEditor: false, connection: {pub: (topic, payload) => published.push({topic, payload})}};
});

/** A minimal host: attributes + the subscription sink the controller wires into. */
function host(attrs = {}) {
    const el = document.createElement('div');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.subs = new Map();
    el.addSubscription = (topic, cb) => el.subs.set(topic, cb);
    el._unsubscribe = () => el.subs.clear();
    el.getProperty = (msg, path) => path.split('.').reduce((o, k) => o?.[k], msg);
    el.requestUpdate = () => {};
    return el;
}

describe('the contract', () => {
    it('declares the remote attributes once, kebab-case, and derives the consumed set', () => {
        const names = remoteAttributes.map(a => a.name);
        for (const n of ['publish', 'layout', 'buttons', 'show-buttons', 'subscribe-volume', 'subscribe-mute',
            'subscribe-output', 'subscribe-app', 'show-volume']) expect(names, n).toContain(n);
        for (const a of remoteAttributes) expect(a.name).toMatch(/^[a-z][a-z0-9-]*$/);
        expect(REMOTE_CONSUMED_ATTRIBUTES).toEqual(names);
        expect(REMOTE_KINDS).toEqual(['button', 'app', 'output', 'raw']);
    });

    it('ships neutral default rows (well-known webOS app ids, glyphs — no bundled logos)', () => {
        expect(DEFAULT_REMOTE_BUTTONS.length).toBeGreaterThan(3);
        for (const row of DEFAULT_REMOTE_BUTTONS) {
            expect(row.kind).toBe('app');
            expect(row.image ?? '').toBe('');
            expect(row.payload).toBeTruthy();
        }
        expect(DEFAULT_REMOTE_BUTTONS.map(r => r.payload)).toContain('netflix');
    });

    it('the pad keys are the lgtv2mqtt button names', () => {
        expect(PAD_KEYS.dpad.ok).toBe('ENTER');
        expect(PAD_KEYS.volume).toEqual({up: 'VOLUMEUP', down: 'VOLUMEDOWN', mute: 'MUTE'});
        expect(PAD_KEYS.channel).toEqual({up: 'CHANNELUP', down: 'CHANNELDOWN'});
        expect(PAD_KEYS.digits).toHaveLength(10);
        expect(PAD_KEYS.colours).toEqual(['RED', 'GREEN', 'YELLOW', 'BLUE']);
    });
});

describe('parseRemoteButtons()', () => {
    it('normalises rows and falls back to the defaults on empty / invalid JSON', () => {
        expect(parseRemoteButtons('')).toBe(DEFAULT_REMOTE_BUTTONS);
        expect(parseRemoteButtons(null)).toBe(DEFAULT_REMOTE_BUTTONS);
        expect(parseRemoteButtons('{oops')).toBe(DEFAULT_REMOTE_BUTTONS);
        expect(parseRemoteButtons('[{"kind":"app","label":"N","payload":"netflix"},{"kind":"weird","payload":"HOME"},5]'))
            .toEqual([
                {kind: 'app', label: 'N', icon: '', image: '', payload: 'netflix', topic: ''},
                {kind: 'button', label: '', icon: '', image: '', payload: 'HOME', topic: ''},
            ]);
        expect(parseRemoteButtons('[]')).toEqual([]);   // an explicit empty list stays empty
    });
});

describe('publishing (lgtv2mqtt set tree)', () => {
    it('press() uppercases the key onto …/button; launch / output / raw use their segments', () => {
        const r = new RemoteController(host({publish: 'lgtv/set'}));
        r.press('home');
        r.press('  5 ');
        r.launch('netflix');
        r.setOutput('external_arc');
        r.raw('/toast/', 'hello');
        r.setVolume(42.4);
        r.toggleMute();
        expect(published).toEqual([
            {topic: 'lgtv/set/button', payload: 'HOME'},
            {topic: 'lgtv/set/button', payload: '5'},
            {topic: 'lgtv/set/launch', payload: 'netflix'},
            {topic: 'lgtv/set/output', payload: 'external_arc'},
            {topic: 'lgtv/set/toast', payload: 'hello'},
            {topic: 'lgtv/set/volume', payload: '42'},
            {topic: 'lgtv/set/mute', payload: 'true'},
        ]);
        expect(r.output).toBe('external_arc');
        expect(r.volume).toBe(42);
        expect(r.muted).toBe(true);
    });

    it('run(row) dispatches on kind', () => {
        const r = new RemoteController(host({publish: 'tv/set'}));
        r.run({kind: 'button', payload: 'back'});
        r.run({kind: 'app', payload: 'youtube.leanback.v4'});
        r.run({kind: 'output', payload: 'tv_speaker'});
        r.run({kind: 'raw', topic: 'youtube', payload: 'dQw4w9WgXcQ'});
        expect(published.map(p => p.topic)).toEqual(['tv/set/button', 'tv/set/launch', 'tv/set/output', 'tv/set/youtube']);
        expect(published[0].payload).toBe('BACK');
    });

    it('publishes nothing without a base topic, an empty key, or in the editor', () => {
        new RemoteController(host({})).press('HOME');
        const r = new RemoteController(host({publish: 'lgtv/set'}));
        r.press('');
        window.feezal.isEditor = true;
        r.press('HOME');
        r.launch('netflix');
        expect(published).toEqual([]);
    });
});

describe('state reflection', () => {
    it('reads volume / mute / output / app through their message paths and highlights the matching rows', () => {
        const el = host({
            'subscribe-volume': 'lgtv/status/volume', 'message-property-volume': 'payload.val',
            'subscribe-mute': 'lgtv/status/mute',
            'subscribe-output': 'lgtv/status/output',
            'subscribe-app': 'lgtv/status/foregroundApp',
            buttons: JSON.stringify([{kind: 'app', payload: 'netflix'}, {kind: 'output', payload: 'tv_speaker'}]),
        });
        const r = new RemoteController(el);
        r.wire();
        el.subs.get('lgtv/status/volume')({payload: {val: 130}});
        el.subs.get('lgtv/status/mute')({payload: 'true'});
        el.subs.get('lgtv/status/output')({payload: 'tv_speaker'});
        // lgtv2mqtt publishes foregroundApp as {appId, windowId, processId}.
        el.subs.get('lgtv/status/foregroundApp')({payload: {appId: 'netflix', windowId: '', processId: '1'}});

        expect(r.volume).toBe(100);   // clamped
        expect(r.muted).toBe(true);
        expect(r.output).toBe('tv_speaker');
        expect(r.app).toBe('netflix');
        const [app, out] = r.buttons;
        expect(r.isActive(app)).toBe(true);
        expect(r.isActive(out)).toBe(true);
        expect(r.isActive({kind: 'button', payload: 'HOME'})).toBe(false);
    });

    it('layout / show-buttons / show-volume read the attributes with their defaults', () => {
        const r = new RemoteController(host({}));
        expect(r.layout).toBe('compact');
        expect(r.showButtons).toBe(false);
        expect(r.showVolume).toBe(true);
        const l = new RemoteController(host({layout: 'large', 'show-volume': 'false'}));
        expect(l.large).toBe(true);
        expect(l.showButtons).toBe(true);
        expect(l.showVolume).toBe(false);
        expect(new RemoteController(host({'show-buttons': 'true'})).showButtons).toBe(true);
    });

    it('rewireIfChanged re-subscribes when a status topic changes', () => {
        const el = host({'subscribe-volume': 'a/volume'});
        const r = new RemoteController(el);
        r.wire();
        expect([...el.subs.keys()]).toEqual(['a/volume']);
        el.setAttribute('subscribe-volume', 'b/volume');
        r.rewireIfChanged();
        expect([...el.subs.keys()]).toEqual(['b/volume']);
    });
});

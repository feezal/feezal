/**
 * E182 — the media controller's pure logic: the album/provider dedupe rule,
 * payload dialects, the two command shapes and repeat cycling.
 */
import {describe, it, expect} from 'vitest';
import {
    albumProviderLines, mediaTruthy, mediaStr, REPEAT_CYCLE,
    mediaAttributes, mediaDiscoveryMap, MEDIA_CONSUMED_ATTRIBUTES,
} from '../packages/@feezal/feezal-controller-media/feezal-controller-media.js';

describe('albumProviderLines() — the E182 dedupe rule', () => {
    it('shows both when they differ', () => {
        expect(albumProviderLines('Abbey Road', 'Spotify'))
            .toEqual({album: 'Abbey Road', provider: 'Spotify'});
    });

    it('drops the provider when it duplicates the album (the requested rule)', () => {
        expect(albumProviderLines('TuneIn', 'TuneIn'))
            .toEqual({album: 'TuneIn', provider: null});
    });

    it('dedupes case-insensitively and ignores surrounding whitespace', () => {
        expect(albumProviderLines('  spotify ', 'Spotify'))
            .toEqual({album: 'spotify', provider: null});
    });

    it('keeps the surviving line when only one is present', () => {
        expect(albumProviderLines('', 'TuneIn')).toEqual({album: null, provider: 'TuneIn'});
        expect(albumProviderLines('Album', null)).toEqual({album: 'Album', provider: null});
    });

    it('honours the per-field show toggles (a hidden album never suppresses the provider)', () => {
        expect(albumProviderLines('TuneIn', 'TuneIn', {showAlbum: false}))
            .toEqual({album: null, provider: 'TuneIn'});
        expect(albumProviderLines('Abbey Road', 'Spotify', {showProvider: false}))
            .toEqual({album: 'Abbey Road', provider: null});
    });
});

describe('payload coercion', () => {
    it('mediaTruthy accepts the dialects bridges actually send', () => {
        for (const v of [true, 1, 'true', 'TRUE', '1', 'on', 'ON', 'yes', 'playing']) {
            expect(mediaTruthy(v), String(v)).toBe(true);
        }
        for (const v of [false, 0, 'false', 'off', 'OFF', '', null, undefined, 'paused']) {
            expect(mediaTruthy(v), String(v)).toBe(false);
        }
    });

    it('mediaStr normalises empty values to null', () => {
        expect(mediaStr('  Song  ')).toBe('Song');
        expect(mediaStr('')).toBe(null);
        expect(mediaStr('   ')).toBe(null);
        expect(mediaStr(null)).toBe(null);
        expect(mediaStr(undefined)).toBe(null);
    });
});

describe('the shared contract', () => {
    it('declares the E182 additions (mute, provider, command/repeat modes)', () => {
        const names = mediaAttributes.map(a => a.name);
        for (const n of ['subscribe-mute', 'message-property-mute', 'publish-mute',
            'payload-mute-on', 'payload-mute-off', 'subscribe-provider',
            'message-property-provider', 'command-mode', 'repeat-mode',
            'payload-repeat-on', 'payload-repeat-off', 'time-unit', 'label']) {
            expect(names, n).toContain(n);
        }
        expect(MEDIA_CONSUMED_ATTRIBUTES).toEqual(names);
    });

    it('keeps the pre-existing contract intact (no silent breaking rename)', () => {
        const names = mediaAttributes.map(a => a.name);
        for (const n of ['subscribe', 'message-property', 'publish-command', 'payload-play',
            'payload-pause', 'payload-next', 'payload-previous', 'subscribe-title',
            'subscribe-artist', 'subscribe-album', 'subscribe-artwork-url', 'artwork-url',
            'subscribe-position', 'subscribe-duration', 'publish-seek', 'subscribe-volume',
            'publish-volume', 'subscribe-shuffle', 'publish-shuffle', 'subscribe-repeat',
            'publish-repeat']) {
            expect(names, n).toContain(n);
        }
    });

    it('every attribute name is kebab-case', () => {
        for (const a of mediaAttributes) expect(a.name).toMatch(/^[a-z][a-z0-9-]*$/);
    });

    it('the discovery map targets declared attributes only', () => {
        const names = new Set(mediaAttributes.map(a => a.name));
        for (const [key, target] of Object.entries(mediaDiscoveryMap)) {
            const attr = typeof target === 'string' ? target : target.attr;
            expect(names.has(attr), `${key} → ${attr}`).toBe(true);
        }
    });

    it('repeat cycles off → all → one', () => {
        expect(REPEAT_CYCLE).toEqual(['off', 'all', 'one']);
    });
});


// ---------------------------------------------------------------------------
// E186 — the shared source / preset capability (WiiM source_list, soundbar
// input_list, TV sound output) and the list-payload dialects.

import {mediaList, MediaController} from '../packages/@feezal/feezal-controller-media/feezal-controller-media.js';

describe('mediaList() — list payload dialects (E186)', () => {
    it('accepts a parsed array, a JSON-array string and a comma-separated string', () => {
        expect(mediaList(['wifi', 'airplay'])).toEqual([{label: 'wifi', value: 'wifi'}, {label: 'airplay', value: 'airplay'}]);
        expect(mediaList('["wifi","bluetooth"]')).toEqual([{label: 'wifi', value: 'wifi'}, {label: 'bluetooth', value: 'bluetooth'}]);
        expect(mediaList('HDMI, Optical ,Bluetooth')).toEqual([
            {label: 'HDMI', value: 'HDMI'}, {label: 'Optical', value: 'Optical'}, {label: 'Bluetooth', value: 'Bluetooth'}]);
    });

    it('normalises object entries to {label, value} and drops empties', () => {
        expect(mediaList([{name: 'Radio SWR3', number: 1}, {name: '', number: 2}, null, 'x']))
            .toEqual([{label: 'Radio SWR3', value: 1}, {label: 'x', value: 'x'}]);
        expect(mediaList('')).toEqual([]);
        expect(mediaList(undefined)).toEqual([]);
        expect(mediaList({not: 'a list'})).toEqual([]);
    });
});

describe('the source / preset contract (E186)', () => {
    it('declares the shared source/preset attributes and maps the recognizer keys onto them', () => {
        const names = mediaAttributes.map(a => a.name);
        for (const n of ['subscribe-source', 'message-property-source', 'subscribe-source-list',
            'message-property-source-list', 'publish-source', 'subscribe-preset-list',
            'message-property-preset-list', 'subscribe-preset-max', 'message-property-preset-max', 'publish-preset']) {
            expect(names, n).toContain(n);
        }
        expect(mediaDiscoveryMap.source_topic).toBe('subscribe-source');
        expect(mediaDiscoveryMap.source_list_topic).toBe('subscribe-source-list');
        expect(mediaDiscoveryMap.source_command_topic).toBe('publish-source');
        expect(mediaDiscoveryMap.preset_command_topic).toBe('publish-preset');
        expect(mediaDiscoveryMap.source_list_value_template).toEqual({attr: 'message-property-source-list', transform: 'valueTemplateToPath'});
        // The keys a WiiM pick needs that were missing from the map before.
        expect(mediaDiscoveryMap.position_topic).toBe('subscribe-position');
        expect(mediaDiscoveryMap.duration_topic).toBe('subscribe-duration');
        expect(mediaDiscoveryMap.seek_command_topic).toBe('publish-seek');
        expect(mediaDiscoveryMap.payload_stop).toBe('payload-stop');
    });

    /** A minimal host: attributes + the subscription sink the controller wires into. */
    function host(attrs) {
        const el = document.createElement('div');
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        el.subs = new Map();
        el.addSubscription = (topic, cb) => el.subs.set(topic, cb);
        el._unsubscribe = () => el.subs.clear();
        el.getProperty = (msg, path) => path.split('.').reduce((o, k) => o?.[k], msg);
        el.requestUpdate = () => {};
        return el;
    }

    it('reads source, list, presets and preset-max through their message paths', () => {
        const el = host({
            'subscribe-source': 'w/status/source', 'message-property-source': 'payload.val',
            'subscribe-source-list': 'w/status/source_list', 'message-property-source-list': 'payload.val',
            'subscribe-preset-max': 'w/status/preset_max', 'message-property-preset-max': 'payload.val',
        });
        const m = new MediaController(el);
        m.wire();
        expect(m.hasSource).toBe(true);
        el.subs.get('w/status/source_list')({payload: {val: ['wifi', 'spotify']}});
        el.subs.get('w/status/source')({payload: {val: 'line_in'}});
        el.subs.get('w/status/preset_max')({payload: {val: 3}});
        // the active source is offered even when the list does not carry it
        expect(m.sourceOptions.map(o => o.value)).toEqual(['line_in', 'wifi', 'spotify']);
        expect(m.presets).toEqual([{label: '1', value: 1}, {label: '2', value: 2}, {label: '3', value: 3}]);
    });

    it('setSource publishes the name, playPreset the 1-based number; both are editor-guarded', () => {
        const published = [];
        window.feezal = {isEditor: false, connection: {pub: (t, p) => published.push([t, p])}};
        const m = new MediaController(host({'publish-source': 'w/set/source', 'publish-preset': 'w/set/preset'}));
        m.setSource('bluetooth');
        m.playPreset(2);
        m.playPreset('nope');
        expect(m.source).toBe('bluetooth');
        expect(published).toEqual([['w/set/source', 'bluetooth'], ['w/set/preset', '2']]);

        window.feezal.isEditor = true;
        m.setSource('wifi');
        expect(published).toHaveLength(2);
        expect(new MediaController(host({})).hasSource).toBe(false);
    });
});

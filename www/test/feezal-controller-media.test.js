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

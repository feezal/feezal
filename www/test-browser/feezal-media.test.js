/**
 * E182 — the media family over @feezal/feezal-controller-media: subscription
 * dedupe on a combined JSON topic, the new mute control, the album/provider
 * dedupe rule, and the two command shapes (payload vs topic mode).
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-circle-media/feezal-element-circle-media.js';
import '../packages/@feezal/feezal-element-glass-media/feezal-element-glass-media.js';
import {setupFeezal, mount, until} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

const MEDIA_JSON = {
    state: 'PLAYING', title: 'Blackbird', artist: 'The Beatles',
    album: 'White Album', provider: 'Amazon Music', imageUrl: 'https://art/x.jpg',
};

/** The echo2mqtt wiring: one combined topic, one path per field. */
const echoAttrs = (device = 'Bad') => ({
    subscribe: `echo/status/${device}/media`,
    'message-property': 'payload.state',
    'subscribe-title': `echo/status/${device}/media`,
    'message-property-title': 'payload.title',
    'subscribe-artist': `echo/status/${device}/media`,
    'message-property-artist': 'payload.artist',
    'subscribe-album': `echo/status/${device}/media`,
    'message-property-album': 'payload.album',
    'subscribe-provider': `echo/status/${device}/media`,
    'message-property-provider': 'payload.provider',
    'subscribe-artwork-url': `echo/status/${device}/media`,
    'message-property-artwork-url': 'payload.imageUrl',
    'publish-command': `echo/set/${device}`,
    'command-mode': 'topic',
});

const text = (el, sel) => el.shadowRoot.querySelector(sel)?.textContent?.trim() ?? null;

describe('media wiring (E182)', () => {
    it('opens exactly ONE subscription for a combined JSON topic and fills every field', async () => {
        const el = await mount('feezal-element-circle-media', echoAttrs());
        expect(feezal.connection.subCount()).toBe(1);

        feezal.connection.deliver('echo/status/Bad/media', MEDIA_JSON);
        await until(() => el.media.title === 'Blackbird');
        expect(el.media.artist).toBe('The Beatles');
        expect(el.media.album).toBe('White Album');
        expect(el.media.provider).toBe('Amazon Music');
        expect(el.media.isPlaying).toBe(true);
    });

    it('renders album AND provider when they differ', async () => {
        const el = await mount('feezal-element-circle-media', echoAttrs());
        feezal.connection.deliver('echo/status/Bad/media', MEDIA_JSON);
        await until(() => text(el, '.album'));
        await el.updateComplete;
        expect(text(el, '.album')).toBe('White Album');
        expect(text(el, '.provider')).toBe('Amazon Music');
    });

    it('renders only ONE line when album and provider are the same (the requested rule)', async () => {
        const el = await mount('feezal-element-circle-media', echoAttrs());
        feezal.connection.deliver('echo/status/Bad/media', {...MEDIA_JSON, album: 'TuneIn', provider: 'TuneIn'});
        await until(() => text(el, '.album') === 'TuneIn');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.provider')).toBeNull();
    });

    it('separate per-field topics still work (the classic wiring)', async () => {
        const el = await mount('feezal-element-circle-media', {
            subscribe: 'player/state',
            'subscribe-title': 'player/title',
            'subscribe-volume': 'player/volume',
        });
        expect(feezal.connection.subCount()).toBe(3);
        feezal.connection.deliver('player/title', 'Yesterday');
        feezal.connection.deliver('player/volume', '42');
        await until(() => el.media.title === 'Yesterday');
        expect(el.media.volume).toBe(42);
    });
});

describe('transport command shapes (E182)', () => {
    it('topic mode appends the action as the last segment (echo2mqtt)', async () => {
        const el = await mount('feezal-element-circle-media', echoAttrs());
        el.media.next();
        el.media.previous();
        expect(feezal.connection.published.map(p => p.topic))
            .toEqual(['echo/set/Bad/next', 'echo/set/Bad/previous']);
    });

    it('payload mode (default) publishes the payload to the one command topic', async () => {
        const el = await mount('feezal-element-circle-media', {'publish-command': 'player/cmd'});
        el.media.next();
        expect(feezal.connection.published[0]).toEqual({topic: 'player/cmd', payload: 'next'});
    });

    it('play/pause follows the live state', async () => {
        const el = await mount('feezal-element-circle-media', echoAttrs());
        feezal.connection.deliver('echo/status/Bad/media', MEDIA_JSON);          // PLAYING
        await until(() => el.media.isPlaying);
        el.media.togglePlay();
        expect(feezal.connection.published.at(-1).topic).toBe('echo/set/Bad/pause');

        feezal.connection.deliver('echo/status/Bad/media', {...MEDIA_JSON, state: 'PAUSED'});
        await until(() => !el.media.isPlaying);
        el.media.togglePlay();
        expect(feezal.connection.published.at(-1).topic).toBe('echo/set/Bad/play');
    });
});

describe('mute (E182)', () => {
    it('reads the ON/OFF dialect and renders the muted icon', async () => {
        const el = await mount('feezal-element-circle-media', {
            'subscribe-mute': 'echo/status/Bad/isMuted',
            'publish-mute': 'echo/set/Bad/isMuted',
            'payload-mute-on': 'ON', 'payload-mute-off': 'OFF',
        });
        feezal.connection.deliver('echo/status/Bad/isMuted', 'ON');
        await until(() => el.media.muted === true);
        await el.updateComplete;
        expect(text(el, '.tgl.mute .mi')).toBe('volume_off');
    });

    it('the button toggles and publishes the configured payloads', async () => {
        const el = await mount('feezal-element-circle-media', {
            'subscribe-mute': 'echo/status/Bad/isMuted',
            'publish-mute': 'echo/set/Bad/isMuted',
            'payload-mute-on': 'ON', 'payload-mute-off': 'OFF',
        });
        el.shadowRoot.querySelector('.tgl.mute').click();
        expect(feezal.connection.published.at(-1)).toEqual({topic: 'echo/set/Bad/isMuted', payload: 'ON'});
        await el.updateComplete;
        el.shadowRoot.querySelector('.tgl.mute').click();
        expect(feezal.connection.published.at(-1)).toEqual({topic: 'echo/set/Bad/isMuted', payload: 'OFF'});
    });

    it('show-mute off falls back to the plain volume icon', async () => {
        const el = await mount('feezal-element-circle-media', {'show-mute': 'false'});
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.tgl.mute')).toBeNull();
        expect(el.shadowRoot.querySelector('.vol-row .mi')).toBeTruthy();
    });
});

describe('repeat modes (E182)', () => {
    it('cycle mode walks off → all → one and publishes the words', async () => {
        const el = await mount('feezal-element-circle-media', {'publish-repeat': 'player/repeat'});
        el.media.cycleRepeat();
        el.media.cycleRepeat();
        el.media.cycleRepeat();
        expect(feezal.connection.published.map(p => p.payload)).toEqual(['all', 'one', 'off']);
    });

    it('toggle mode flips off ↔ all with the on/off payloads (echo2mqtt)', async () => {
        const el = await mount('feezal-element-circle-media', {
            'publish-repeat': 'echo/set/Bad/repeat', 'repeat-mode': 'toggle',
            'payload-repeat-on': 'on', 'payload-repeat-off': 'off',
        });
        el.media.cycleRepeat();
        expect(feezal.connection.published.at(-1).payload).toBe('on');
        el.media.cycleRepeat();
        expect(feezal.connection.published.at(-1).payload).toBe('off');
    });
});

describe('editor + discovery contract (E182)', () => {
    it('never publishes from the editor canvas', async () => {
        feezal.isEditor = true;
        const el = await mount('feezal-element-circle-media', echoAttrs());
        el.media.next();
        el.media.toggleMute();
        el.media.setVolume(50);
        expect(feezal.connection.published).toHaveLength(0);
    });

    it('declares the media discovery component so the Echo recognizer can stamp it', () => {
        const cls = customElements.get('feezal-element-circle-media');
        expect(cls.feezal.discovery.component).toBe('media');
        expect(cls.feezal.discovery.map.provider_topic).toBe('subscribe-provider');
        expect(cls.feezal.discovery.map.mute_command_topic).toBe('publish-mute');
    });

    it('millisecond bridges are handled by time-unit', async () => {
        const el = await mount('feezal-element-circle-media', {
            'subscribe-position': 'p/pos', 'subscribe-duration': 'p/dur', 'time-unit': 'ms',
        });
        feezal.connection.deliver('p/pos', '65000');
        feezal.connection.deliver('p/dur', '180000');
        await until(() => el.media.position === 65);
        expect(el.media.duration).toBe(180);
    });
});

// ─── E183: glass-media ───────────────────────────────────────────────────────

describe('glass-media (E183)', () => {
    it('shares the media contract, so the family switch and discovery treat it like its siblings', () => {
        const glass = customElements.get('feezal-element-glass-media').feezal;
        const circle = customElements.get('feezal-element-circle-media').feezal;
        const names = d => new Set(d.attributes.filter(a => typeof a === 'object').map(a => a.name));
        const g = names(glass), c = names(circle);
        // Every contract attribute of the circle card exists on the glass card.
        for (const n of ['subscribe', 'publish-command', 'command-mode', 'subscribe-mute',
            'publish-mute', 'subscribe-provider', 'repeat-mode', 'label']) {
            expect(g.has(n), n).toBe(true);
            expect(c.has(n), n).toBe(true);
        }
        expect(glass.discovery.component).toBe('media');
        expect(glass.palette.category).toBe('Glass');
    });

    it('wires the echo2mqtt shape and renders the metadata over the art', async () => {
        const el = await mount('feezal-element-glass-media', echoAttrs());
        expect(feezal.connection.subCount()).toBe(1);
        feezal.connection.deliver('echo/status/Bad/media', MEDIA_JSON);
        await until(() => el.media.title === 'Blackbird');
        await el.updateComplete;
        expect(text(el, '.title')).toBe('Blackbird');
        expect(el.shadowRoot.querySelector('.art').style.backgroundImage).toContain('https://art/x.jpg');
    });

    it('applies the album/provider dedupe rule like the circle card', async () => {
        const el = await mount('feezal-element-glass-media', echoAttrs());
        feezal.connection.deliver('echo/status/Bad/media', {...MEDIA_JSON, album: 'TuneIn', provider: 'TuneIn'});
        await until(() => el.media.album === 'TuneIn');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.provider')).toBeNull();
        expect([...el.shadowRoot.querySelectorAll('.sub')].map(n => n.textContent.trim()))
            .toContain('TuneIn');
    });

    it('transport + mute publish through the controller', async () => {
        const el = await mount('feezal-element-glass-media', {
            ...echoAttrs(),
            'publish-mute': 'echo/set/Bad/isMuted', 'payload-mute-on': 'ON',
        });
        el.shadowRoot.querySelector('.play').click();
        expect(feezal.connection.published.at(-1).topic).toBe('echo/set/Bad/play');
        el.shadowRoot.querySelector('.tgl.mute').click();
        expect(feezal.connection.published.at(-1)).toEqual({topic: 'echo/set/Bad/isMuted', payload: 'ON'});
    });

    it('falls back to the album placeholder without artwork, and degrade reflects', async () => {
        const el = await mount('feezal-element-glass-media', {degrade: ''});
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.placeholder')).toBeTruthy();
        expect(el.shadowRoot.querySelector('.art')).toBeNull();
        expect(el.hasAttribute('degrade')).toBe(true);
    });

    it('the size preset writes square-ish geometry (media needs more height than a tile)', async () => {
        const el = await mount('feezal-element-glass-media', {});
        el.size = '4x2';
        await el.updateComplete;
        expect(el.style.width).toBe('354px');
        expect(el.style.height).toBe('172px');
    });
});

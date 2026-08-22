/**
 * E182 — the media family over @feezal/feezal-controller-media: subscription
 * dedupe on a combined JSON topic, the new mute control, the album/provider
 * dedupe rule, and the two command shapes (payload vs topic mode).
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-circle-media/feezal-element-circle-media.js';
import '../packages/@feezal/feezal-element-glass-media/feezal-element-glass-media.js';
import '../packages/@feezal/feezal-element-metro-media/feezal-element-metro-media.js';
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

    it('shows a SQUARE cover slot on the left, placeholder when there is no art', async () => {
        const el = await mount('feezal-element-glass-media', {degrade: ''});
        await el.updateComplete;
        // The cover slot always exists (square, left) - without art it carries
        // the album glyph rather than a background image.
        const art = el.shadowRoot.querySelector('.art');
        expect(art).toBeTruthy();
        expect(art.classList.contains('placeholder')).toBe(true);
        expect(art.style.backgroundImage).toBe('');
        expect(getComputedStyle(art).aspectRatio.replace(/\s/g, '')).toBe('1/1');
        expect(el.hasAttribute('degrade')).toBe(true);
    });

    it('show-artwork off drops the cover slot entirely', async () => {
        const el = await mount('feezal-element-glass-media', {'show-artwork': 'false'});
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.art')).toBeNull();
    });

    it('defaults to a card twice as wide as it is tall', () => {
        const ds = customElements.get('feezal-element-glass-media').feezal.defaultStyle;
        expect(ds.width).toBe('354px');
        expect(ds.height).toBe('172px');
    });

    it('the size presets follow the family grid (81px unit + 10px gutter)', async () => {
        const el = await mount('feezal-element-glass-media', {});
        el.size = '4x2';
        await el.updateComplete;
        expect([el.style.width, el.style.height]).toEqual(['354px', '172px']);
        el.size = '6x2';                       // extra wide: 6*81 + 5*10
        await el.updateComplete;
        expect([el.style.width, el.style.height]).toEqual(['536px', '172px']);
        el.size = '2x2';
        await el.updateComplete;
        expect([el.style.width, el.style.height]).toEqual(['172px', '172px']);
    });
});

// ─── circle-media: the Circle-family look + progress gating ──────────────────

describe('circle-media look (E184)', () => {
    it('renders the family DISC with the album art inside it', async () => {
        const el = await mount('feezal-element-circle-media', echoAttrs());
        feezal.connection.deliver('echo/status/Bad/media', MEDIA_JSON);
        await until(() => el.media.artworkUrl);
        await el.updateComplete;
        const disc = el.shadowRoot.querySelector('.disc-wrap .disc');
        expect(disc).toBeTruthy();
        expect(getComputedStyle(disc).borderRadius).toBe('50%');
        expect(disc.querySelector('img').getAttribute('src')).toBe('https://art/x.jpg');
    });

    it('play/pause sits ON the disc (the card main action) and is not duplicated in the transport row', async () => {
        const el = await mount('feezal-element-circle-media', echoAttrs());
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.disc-play')).toBeTruthy();
        expect(el.shadowRoot.querySelector('.transport .play')).toBeNull();
        el.shadowRoot.querySelector('.disc-play').click();
        expect(feezal.connection.published.at(-1).topic).toBe('echo/set/Bad/play');
    });

    it('NO progress ring while no position/duration topic is configured (the requested rule)', async () => {
        const el = await mount('feezal-element-circle-media', echoAttrs());
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.ring-fill')).toBeNull();
        expect(el.shadowRoot.querySelector('.times')).toBeNull();
        // …and the old linear seek bar is gone for good.
        expect(el.shadowRoot.querySelector('.bar')).toBeNull();
    });

    it('the ring appears as soon as a progress topic IS configured', async () => {
        const el = await mount('feezal-element-circle-media', {
            ...echoAttrs(), 'subscribe-position': 'p/pos', 'subscribe-duration': 'p/dur',
        });
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.ring-track')).toBeTruthy();
        feezal.connection.deliver('p/dur', '200');
        feezal.connection.deliver('p/pos', '50');
        await until(() => el.media.position === 50);
        await el.updateComplete;
        // A quarter played → a quarter of the circumference is stroked.
        const dash = el.shadowRoot.querySelector('.ring-fill').getAttribute('stroke-dasharray');
        const [drawn, total] = dash.split(' ').map(Number);
        expect(drawn / total).toBeCloseTo(0.25, 2);
        expect(el.shadowRoot.querySelector('.times').textContent).toContain('0:50');
    });

    it('show-seek off hides the ring even when topics are configured', async () => {
        const el = await mount('feezal-element-circle-media', {
            'subscribe-position': 'p/pos', 'subscribe-duration': 'p/dur', 'show-seek': 'false',
        });
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.ring-track')).toBeNull();
    });
});

// ─── metro-media: autodiscovery on its own thinner contract ──────────────────

describe('metro-media discovery (E182 follow-up)', () => {
    it('declares the media discovery component, mapped onto ITS attribute names', () => {
        const d = customElements.get('feezal-element-metro-media').feezal.discovery;
        expect(d.component).toBe('media');
        // The tile calls the title topic `subscribe` and the previous-track
        // payload `payload-prev` — the map bridges those names.
        expect(d.map.title_topic.attr ?? d.map.title_topic).toBe('subscribe');
        expect(d.map.state_topic).toBe('subscribe-state');
        expect(d.map.command_topic).toBe('publish');
        expect(d.map.payload_previous).toBe('payload-prev');
        expect(d.map.volume_command_topic).toBe('publish-volume');
    });

    it('every discovery target is a declared attribute of the tile', () => {
        const feez = customElements.get('feezal-element-metro-media').feezal;
        const names = new Set(feez.attributes.filter(a => typeof a === 'object').map(a => a.name));
        for (const [key, target] of Object.entries(feez.discovery.map)) {
            const attr = typeof target === 'string' ? target : target.attr;
            expect(names.has(attr), `${key} → ${attr}`).toBe(true);
        }
    });

    it('publishes transport in topic mode (echo2mqtt), payload mode otherwise', async () => {
        const el = await mount('feezal-element-metro-media', {
            publish: 'echo/set/Bad', 'command-mode': 'topic',
            'payload-play': 'play', 'payload-pause': 'pause', 'payload-next': 'next',
        });
        el._transport('next');
        expect(feezal.connection.published.at(-1).topic).toBe('echo/set/Bad/next');
        el._playPause();                                   // not playing → play
        expect(feezal.connection.published.at(-1).topic).toBe('echo/set/Bad/play');
        el._playing = true;
        el._playPause();                                   // playing → pause
        expect(feezal.connection.published.at(-1).topic).toBe('echo/set/Bad/pause');
    });

    it('keeps the classic single-topic toggle when no separate payloads are set', async () => {
        const el = await mount('feezal-element-metro-media', {publish: 'player/cmd'});
        el._playPause();
        expect(feezal.connection.published.at(-1)).toEqual({topic: 'player/cmd', payload: 'play_pause'});
    });

    it('matches the playing state case-insensitively (Echo says PLAYING)', async () => {
        const el = await mount('feezal-element-metro-media', {
            'subscribe-state': 'echo/status/Bad/audioPlayerState', 'payload-playing': 'playing',
        });
        feezal.connection.deliver('echo/status/Bad/audioPlayerState', 'PLAYING');
        await until(() => el._playing === true);
        expect(el._playing).toBe(true);
    });
});

// ─── No attribute junk on the canvas (the B119 trigger) ──────────────────────
// Lit reflects constructor defaults on first update. With the whole ~40-knob
// media contract declared as reflected properties, every media card stamped
// payload-play="play", message-property-title="payload", … onto itself — junk
// in every saved dashboard AND an attribute-mutation storm that the editor's
// passive chrome observes (B119: one panel's throwing render took the context
// menu down with it). The contract is attribute-driven, so the properties must
// sync FROM attributes without reflecting back.

describe.each([
    'feezal-element-circle-media',
    'feezal-element-glass-media',
])('%s stamps no attribute junk', tag => {
    // The show-* display toggles and the base class's own message-property
    // stay reflected (pre-existing, and the boolean defaults rely on
    // attribute presence). What must NEVER be stamped is the ~40-knob media
    // CONTRACT: topics, payloads and message paths.
    const CONTRACT_JUNK = /^(payload-|message-property-|subscribe|publish|command-mode|repeat-mode|time-unit|artwork-url|label)/;

    it('stamps none of the contract attributes when mounted bare', async () => {
        const el = await mount(tag, {});
        await el.updateComplete;
        await new Promise(r => requestAnimationFrame(r));
        const stamped = [...el.attributes].map(a => a.name).filter(n => CONTRACT_JUNK.test(n));
        expect(stamped).toEqual([]);
    });

    it('keeps exactly the authored contract attributes when configured', async () => {
        const el = await mount(tag, {subscribe: 'p/state', 'publish-command': 'p/cmd'});
        await el.updateComplete;
        await new Promise(r => requestAnimationFrame(r));
        const stamped = [...el.attributes].map(a => a.name).filter(n => CONTRACT_JUNK.test(n)).sort();
        expect(stamped).toEqual(['publish-command', 'subscribe']);
    });

    it('still behaves with the fragment defaults although nothing is stamped', async () => {
        const el = await mount(tag, {'publish-command': 'p/cmd'});
        el.media.next();                       // payload-next defaults to "next"
        expect(feezal.connection.published.at(-1)).toEqual({topic: 'p/cmd', payload: 'next'});
        el.media.cycleRepeat();                // repeat-mode defaults to "cycle"
        expect(el.media.repeat).toBe('all');
    });

    it('a live attribute edit still re-wires (attribute → property sync intact)', async () => {
        const el = await mount(tag, {subscribe: 'a/state'});
        expect(feezal.connection.subCount()).toBe(1);
        el.setAttribute('subscribe-title', 'a/title');
        await el.updateComplete;
        feezal.connection.deliver('a/title', 'Rewired');
        await until(() => el.media.title === 'Rewired');
    });
});

// ─── metro-media album art ───────────────────────────────────────────────────

describe('metro-media album art', () => {
    it('renders the cover from the artwork topic, square and left of the text', async () => {
        const el = await mount('feezal-element-metro-media', {
            'subscribe-artwork-url': 'echo/status/Bad/media',
            'message-property-artwork-url': 'payload.imageUrl',
        });
        feezal.connection.deliver('echo/status/Bad/media', MEDIA_JSON);
        await until(() => el._artwork === 'https://art/x.jpg');
        await el.updateComplete;
        const art = el.shadowRoot.querySelector('.art');
        expect(art).toBeTruthy();
        expect(art.style.backgroundImage).toContain('https://art/x.jpg');
        // Side-by-side layout: square cover, metadata beside it.
        expect(getComputedStyle(art).aspectRatio.replace(/\s/g, '')).toBe('1/1');
        expect(el.shadowRoot.querySelector('.meta .track')).toBeTruthy();
    });

    it('falls back to the static artwork-url, and show-artwork off hides it', async () => {
        const el = await mount('feezal-element-metro-media', {'artwork-url': 'https://static/cover.png'});
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.art').style.backgroundImage).toContain('static/cover.png');

        const off = await mount('feezal-element-metro-media', {
            'artwork-url': 'https://static/cover.png', 'show-artwork': 'false',
        });
        await off.updateComplete;
        expect(off.shadowRoot.querySelector('.art')).toBeNull();
    });

    it('discovery stamps the artwork topic onto the tile', () => {
        const map = customElements.get('feezal-element-metro-media').feezal.discovery.map;
        expect(map.artwork_topic).toBe('subscribe-artwork-url');
    });
});

// ─── E185: slider behaviour on the real elements ─────────────────────────────

const drag = async (el, values, {commit = true} = {}) => {
    const slider = el.shadowRoot.querySelector('input[type="range"]');
    slider.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    for (const v of values) {
        slider.value = String(v);
        slider.dispatchEvent(new Event('input', {bubbles: true}));
    }
    if (commit) slider.dispatchEvent(new Event('change', {bubbles: true}));
    await el.updateComplete;
    return slider;
};

describe.each([
    'feezal-element-circle-media',
    'feezal-element-glass-media',
    'feezal-element-metro-media',
])('%s volume slider (E185)', tag => {
    const conf = t => (t === 'feezal-element-metro-media'
        ? {'publish-volume': 'echo/set/Bad/volume', 'subscribe-volume': 'echo/status/Bad/volume'}
        : {'publish-volume': 'echo/set/Bad/volume', 'subscribe-volume': 'echo/status/Bad/volume'});

    it('a fast drag does NOT publish one message per input event', async () => {
        const el = await mount(tag, conf(tag));
        await drag(el, [17, 16, 15, 14, 13, 12, 11]);
        const vols = feezal.connection.published.filter(p => p.topic.endsWith('/volume'));
        // The reported bug published all seven; now it is the throttled
        // leading value plus the committed final one.
        expect(vols.length).toBeLessThanOrEqual(3);
        expect(vols.at(-1).payload).toBe('11');           // never loses the end value
    });

    it('ignores the device echo while the knob is held, and follows it again afterwards', async () => {
        const el = await mount(tag, {...conf(tag), 'volume-settle': '0'});
        const slider = el.shadowRoot.querySelector('input[type="range"]');
        slider.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
        slider.value = '11';
        slider.dispatchEvent(new Event('input', {bubbles: true}));

        // A stale, out-of-order echo lands mid-drag (the reported …13, 11, 12).
        feezal.connection.deliver('echo/status/Bad/volume', '12');
        await el.updateComplete;
        const held = tag === 'feezal-element-metro-media' ? el._volume : el.media.volume;
        expect(held).toBe(11);                            // the knob stayed put

        slider.dispatchEvent(new Event('change', {bubbles: true}));   // release
        feezal.connection.deliver('echo/status/Bad/volume', '30');    // the device's own value
        await el.updateComplete;
        const after = tag === 'feezal-element-metro-media' ? el._volume : el.media.volume;
        expect(after).toBe(30);
    });

    it('volume-live off publishes only on release, but the knob still follows the finger', async () => {
        const el = await mount(tag, {...conf(tag), 'volume-live': 'false'});
        const slider = el.shadowRoot.querySelector('input[type="range"]');
        slider.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
        for (const v of [40, 41, 42]) {
            slider.value = String(v);
            slider.dispatchEvent(new Event('input', {bubbles: true}));
        }
        await el.updateComplete;
        expect(feezal.connection.published.filter(p => p.topic.endsWith('/volume'))).toHaveLength(0);
        const live = tag === 'feezal-element-metro-media' ? el._volume : el.media.volume;
        expect(live).toBe(42);                            // local value moved anyway

        slider.dispatchEvent(new Event('change', {bubbles: true}));
        const vols = feezal.connection.published.filter(p => p.topic.endsWith('/volume'));
        expect(vols).toHaveLength(1);
        expect(vols[0].payload).toBe('42');
    });
});

describe('metro-media cover layout (matches glass)', () => {
    it('puts a SQUARE cover left of the metadata when artwork exists', async () => {
        const el = await mount('feezal-element-metro-media', {'artwork-url': 'https://static/cover.png'});
        await el.updateComplete;
        const art = el.shadowRoot.querySelector('.art');
        const meta = el.shadowRoot.querySelector('.meta');
        expect(art).toBeTruthy();
        expect(meta).toBeTruthy();
        expect(getComputedStyle(art).aspectRatio.replace(/\s/g, '')).toBe('1/1');
        // art comes first in the row, the text beside it
        expect(art.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(getComputedStyle(el.shadowRoot.querySelector('.center')).flexDirection).toBe('row');
    });

    it('keeps the classic centred stack when there is no cover', async () => {
        const el = await mount('feezal-element-metro-media', {});
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.art')).toBeNull();
        expect(getComputedStyle(el.shadowRoot.querySelector('.center')).flexDirection).toBe('column');
    });
});


// E186 — the shared source select + preset row (glass + circle).
describe('source select and presets (E186)', () => {
    const wiimAttrs = {
        'subscribe-source': 'wiim/status/source', 'message-property-source': 'payload.val',
        'subscribe-source-list': 'wiim/status/source_list', 'message-property-source-list': 'payload.val',
        'publish-source': 'wiim/set/source',
        'subscribe-preset-list': 'wiim/status/preset_list', 'message-property-preset-list': 'payload.val',
        'publish-preset': 'wiim/set/preset',
    };

    for (const tag of ['feezal-element-glass-media', 'feezal-element-circle-media']) {
        it(`${tag}: renders the select from the list, the active source, and publishes a pick`, async () => {
            const el = await mount(tag, wiimAttrs);
            feezal.connection.deliver('wiim/status/source_list', {val: ['wifi', 'airplay', 'bluetooth']});
            feezal.connection.deliver('wiim/status/source', {val: 'airplay'});
            await until(() => el.shadowRoot.querySelector('.src-row select option[value="bluetooth"]'));
            await el.updateComplete;
            const select = el.shadowRoot.querySelector('.src-row select');
            expect([...select.options].map(o => o.value)).toEqual(['wifi', 'airplay', 'bluetooth']);
            expect(select.value).toBe('airplay');

            select.value = 'bluetooth';
            select.dispatchEvent(new Event('change', {bubbles: true}));
            expect(feezal.connection.published.at(-1)).toMatchObject({topic: 'wiim/set/source', payload: 'bluetooth'});
        });

        it(`${tag}: preset chips publish the 1-based number; nothing renders without source/preset topics`, async () => {
            const el = await mount(tag, wiimAttrs);
            feezal.connection.deliver('wiim/status/preset_list', {val: [{name: 'SWR3', number: 1}, {name: 'Jazz', number: 2}]});
            await until(() => el.shadowRoot.querySelectorAll('.presets button').length === 2);
            el.shadowRoot.querySelectorAll('.presets button')[1].click();
            expect(feezal.connection.published.at(-1)).toMatchObject({topic: 'wiim/set/preset', payload: '2'});

            const bare = await mount(tag, {});
            expect(bare.shadowRoot.querySelector('.src-row')).toBeNull();
            expect(bare.shadowRoot.querySelector('.presets')).toBeNull();
        });
    }
});

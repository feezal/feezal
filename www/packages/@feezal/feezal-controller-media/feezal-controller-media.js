/* global feezal */
/**
 * @feezal/feezal-controller-media (E182, per the E137 architecture)
 *
 * The media-player MQTT contract as a Lit Reactive Controller. The family
 * element is a VIEW: it reads the controller's resolved state (title,
 * artist, album, provider, artwork, position, duration, volume, mute,
 * shuffle, repeat) and renders its own chrome; the controller owns the
 * subscription wiring (deduped per topic — a bridge that publishes ONE
 * combined JSON opens exactly one subscription), value coercion, the
 * album/provider dedupe rule, and every transport publish.
 *
 * Two command shapes, because bridges differ:
 *   payload mode (default) — one command topic, one payload per action
 *                            (`publish-command` + `payload-play`, …).
 *   topic mode             — one command BASE topic, the action name as the
 *                            last segment (`echo/set/<device>` + `/play`,
 *                            `/pause`, `/next`, `/previous`) — the shape
 *                            echo2mqtt and several other bridges use.
 *
 * Repeat is tri-state in feezal (off/all/one) but boolean on many bridges:
 * `repeat-mode: cycle | toggle` switches between cycling all three and
 * flipping off ↔ all with on/off payloads.
 */
import {feezalBoolean} from '@feezal/feezal-element';

/** Default message path for every per-field topic (the fragment default). */
const DEFAULT_PATH = 'payload';

/** Cycle order for the repeat control. off → all → one → off … */
export const REPEAT_CYCLE = ['off', 'all', 'one'];

/** Loose truthiness over the payload dialects bridges use. */
export function mediaTruthy(v) {
    if (v === true || v === 1) return true;
    const s = String(v ?? '').trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'on' || s === 'yes' || s === 'playing';
}

/** '' / null / undefined → null, everything else → a trimmed string. */
export function mediaStr(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
}

/**
 * E182 — album/provider dedupe. When both carry the same text (trimmed,
 * case-insensitive) only ONE is shown: the ALBUM wins as the more specific
 * label and the duplicated provider is dropped. Returns the two strings to
 * render (either may be null), honouring the per-field show toggles.
 */
export function albumProviderLines(album, provider, {showAlbum = true, showProvider = true} = {}) {
    const a = showAlbum ? mediaStr(album) : null;
    const p = showProvider ? mediaStr(provider) : null;
    if (a && p && a.toLowerCase() === p.toLowerCase()) return {album: a, provider: null};
    return {album: a, provider: p};
}

/** Shared attribute descriptors — spread into every family's `feezal.attributes`. */
export const mediaAttributes = [
    // ── Playback state (primary) ───────────────────────────────────────────
    {name: 'subscribe', type: 'mqttTopic',
        help: 'Primary topic carrying the playback state (play / pause / stop / idle). Drives the play/pause toggle.'},
    {name: 'message-property', type: 'string', default: 'payload',
        help: 'Dot-notation path to the value within the MQTT message. Default "payload" reads msg.payload directly. Each metadata topic below has its own path field.'},
    {name: 'label', type: 'string', default: '',
        help: 'Optional player / device name shown above the track (e.g. the Echo device). Empty hides the line.'},
    // ── Transport command topic + payloads ─────────────────────────────────
    {name: 'publish-command', type: 'mqttTopic',
        help: 'Topic that transport buttons (play/pause/stop/next/previous/forward/rewind) publish to. With command mode "topic" this is the BASE topic and the action name is appended as the last segment.'},
    {name: 'command-mode', type: 'select', options: ['payload', 'topic'], default: 'payload',
        help: 'How transport commands are sent. payload = one topic, the action payload below (default). topic = the action name is appended to the command topic (e.g. echo/set/Kitchen + /play), which is what bridges with one topic per command expect.'},
    {name: 'payload-play',     type: 'string', default: 'play',     help: 'Payload published to play (command mode "topic": the topic segment). Default: play'},
    {name: 'payload-pause',    type: 'string', default: 'pause',    help: 'Payload published to pause. Default: pause'},
    {name: 'payload-stop',     type: 'string', default: 'stop',     help: 'Payload published to stop. Default: stop'},
    {name: 'payload-next',     type: 'string', default: 'next',     help: 'Payload published for skip-next. Default: next'},
    {name: 'payload-previous', type: 'string', default: 'previous', help: 'Payload published for skip-previous. Default: previous'},
    {name: 'payload-forward',  type: 'string', default: 'forward',  help: 'Payload published for fast-forward. Default: forward'},
    {name: 'payload-rewind',   type: 'string', default: 'rewind',   help: 'Payload published for fast-rewind. Default: rewind'},
    // ── Metadata topics ────────────────────────────────────────────────────
    {name: 'subscribe-title', type: 'mqttTopic', help: 'Topic for the current track title.'},
    {name: 'message-property-title', type: 'string', default: 'payload',
        help: 'Dot-notation path within the title message. Default: payload'},
    {name: 'subscribe-artist', type: 'mqttTopic', help: 'Topic for the current artist.'},
    {name: 'message-property-artist', type: 'string', default: 'payload',
        help: 'Dot-notation path within the artist message. Default: payload'},
    {name: 'subscribe-album', type: 'mqttTopic', help: 'Topic for the current album.'},
    {name: 'message-property-album', type: 'string', default: 'payload',
        help: 'Dot-notation path within the album message. Default: payload'},
    {name: 'subscribe-provider', type: 'mqttTopic',
        help: 'Topic for the playback source / provider (e.g. Spotify, TuneIn, Amazon Music). Shown as its own line; when it is identical to the album only one of the two is displayed.'},
    {name: 'message-property-provider', type: 'string', default: 'payload',
        help: 'Dot-notation path within the provider message. Default: payload'},
    // ── Artwork ────────────────────────────────────────────────────────────
    {name: 'subscribe-artwork-url', type: 'mqttTopic', help: 'Topic carrying the album-art image URL.'},
    {name: 'message-property-artwork-url', type: 'string', default: 'payload',
        help: 'Dot-notation path within the artwork-url message. Default: payload'},
    {name: 'artwork-url', type: 'string', default: '',
        help: 'Static album-art image URL. Used when no artwork-url topic message has arrived. Falls back to an album icon.'},
    // ── Progress / seek ────────────────────────────────────────────────────
    {name: 'subscribe-position', type: 'mqttTopic', help: 'Topic for the current playback position, in seconds.'},
    {name: 'message-property-position', type: 'string', default: 'payload',
        help: 'Dot-notation path within the position message. Default: payload'},
    {name: 'subscribe-duration', type: 'mqttTopic', help: 'Topic for the track duration, in seconds.'},
    {name: 'message-property-duration', type: 'string', default: 'payload',
        help: 'Dot-notation path within the duration message. Default: payload'},
    {name: 'time-unit', type: 'select', options: ['s', 'ms'], default: 's',
        help: 'Unit of the position / duration values. Bridges that report milliseconds (e.g. an Echo progress payload) need "ms".'},
    {name: 'publish-seek', type: 'mqttTopic', help: 'Topic that the target position (seconds) is published to when the seek bar is released.'},
    // ── Volume ─────────────────────────────────────────────────────────────
    {name: 'subscribe-volume', type: 'mqttTopic', help: 'Topic for the current volume (0–100).'},
    {name: 'message-property-volume', type: 'string', default: 'payload',
        help: 'Dot-notation path within the volume message. Default: payload'},
    {name: 'publish-volume', type: 'mqttTopic', help: 'Topic that a new volume (0–100) is published to.'},
    // ── Mute (E182) ────────────────────────────────────────────────────────
    {name: 'subscribe-mute', type: 'mqttTopic', help: 'Topic for the mute state (on/off, true/false, 1/0).'},
    {name: 'message-property-mute', type: 'string', default: 'payload',
        help: 'Dot-notation path within the mute message. Default: payload'},
    {name: 'publish-mute', type: 'mqttTopic', help: 'Topic that the toggled mute state is published to.'},
    {name: 'payload-mute-on',  type: 'string', default: 'true',  help: 'Payload published to mute. Default: true'},
    {name: 'payload-mute-off', type: 'string', default: 'false', help: 'Payload published to unmute. Default: false'},
    // ── Shuffle ────────────────────────────────────────────────────────────
    {name: 'subscribe-shuffle', type: 'mqttTopic', help: 'Topic for the shuffle state (on/off, true/false, 1/0).'},
    {name: 'message-property-shuffle', type: 'string', default: 'payload',
        help: 'Dot-notation path within the shuffle message. Default: payload'},
    {name: 'publish-shuffle', type: 'mqttTopic', help: 'Topic that the toggled shuffle state is published to.'},
    {name: 'payload-shuffle-on',  type: 'string', default: 'true',  help: 'Payload published to enable shuffle. Default: true'},
    {name: 'payload-shuffle-off', type: 'string', default: 'false', help: 'Payload published to disable shuffle. Default: false'},
    // ── Repeat ─────────────────────────────────────────────────────────────
    {name: 'subscribe-repeat', type: 'mqttTopic', help: 'Topic for the repeat state (off / all / one, or on/off).'},
    {name: 'message-property-repeat', type: 'string', default: 'payload',
        help: 'Dot-notation path within the repeat message. Default: payload'},
    {name: 'publish-repeat', type: 'mqttTopic', help: 'Topic that the cycled repeat state is published to.'},
    {name: 'repeat-mode', type: 'select', options: ['cycle', 'toggle'], default: 'cycle',
        help: 'cycle = three states off → all → one (published as those words). toggle = two states for bridges that only know repeat on/off; the payloads below are used.'},
    {name: 'payload-repeat-on',  type: 'string', default: 'on',  help: 'Repeat mode "toggle": payload published to enable repeat. Default: on'},
    {name: 'payload-repeat-off', type: 'string', default: 'off', help: 'Repeat mode "toggle": payload published to disable repeat. Default: off'},
];

/** Attribute names this controller consumes (parity-set derivation, E114). */
export const MEDIA_CONSUMED_ATTRIBUTES = mediaAttributes.map(a => a.name);

/**
 * Shared discovery.map fragment. Keys are the recognizer's config keys
 * (see server/src/mqtt/recognizers/echo.js) — HA has no `media_player`
 * MQTT component, so this contract is feezal-native.
 */
export const mediaDiscoveryMap = {
    name:                  'label',
    state_topic:           {attr: 'subscribe'},
    state_value_template:  {attr: 'message-property', transform: 'valueTemplateToPath'},
    command_topic:         'publish-command',
    command_mode:          'command-mode',
    title_topic:           'subscribe-title',
    artist_topic:          'subscribe-artist',
    album_topic:           'subscribe-album',
    provider_topic:        'subscribe-provider',
    artwork_topic:         'subscribe-artwork-url',
    volume_topic:          'subscribe-volume',
    volume_command_topic:  'publish-volume',
    mute_topic:            'subscribe-mute',
    mute_command_topic:    'publish-mute',
    payload_mute_on:       'payload-mute-on',
    payload_mute_off:      'payload-mute-off',
    shuffle_topic:         'subscribe-shuffle',
    shuffle_command_topic: 'publish-shuffle',
    payload_shuffle_on:    'payload-shuffle-on',
    payload_shuffle_off:   'payload-shuffle-off',
    repeat_topic:          'subscribe-repeat',
    repeat_command_topic:  'publish-repeat',
    repeat_mode:           'repeat-mode',
    payload_repeat_on:     'payload-repeat-on',
    payload_repeat_off:    'payload-repeat-off',
    payload_play:          'payload-play',
    payload_pause:         'payload-pause',
    payload_next:          'payload-next',
    payload_previous:      'payload-previous',
    // Per-field message paths (a bridge publishing ONE combined JSON stamps
    // the same topic everywhere and distinguishes the fields by path).
    title_value_template:    {attr: 'message-property-title',    transform: 'valueTemplateToPath'},
    artist_value_template:   {attr: 'message-property-artist',   transform: 'valueTemplateToPath'},
    album_value_template:    {attr: 'message-property-album',    transform: 'valueTemplateToPath'},
    provider_value_template: {attr: 'message-property-provider', transform: 'valueTemplateToPath'},
    artwork_value_template:  {attr: 'message-property-artwork-url', transform: 'valueTemplateToPath'},
};

export class MediaController {
    /** @param {import('lit').ReactiveControllerHost & HTMLElement} host */
    constructor(host) {
        this.host = host;
        host.addController?.(this);
        this._reset();
    }

    _reset() {
        this.state    = null;    // null | 'play' | 'pause' | 'stop' | 'idle' | …
        this.title    = null;
        this.artist   = null;
        this.album    = null;
        this.provider = null;
        this.artwork  = null;
        this.position = null;    // seconds
        this.duration = null;    // seconds
        this.volume   = null;    // 0–100
        this.muted    = false;
        this.shuffle  = false;
        this.repeat   = 'off';   // 'off' | 'all' | 'one'
    }

    /** Host attribute reader — attributes are the saved-markup source of truth. */
    _attr(name, fallback = '') {
        const v = this.host.getAttribute(name);
        return v === null || v === '' ? fallback : v;
    }

    get _msgProp() { return this._attr('message-property', 'payload'); }

    /** Effective artwork: a live topic value wins over the static attribute. */
    get artworkUrl() { return this.artwork || this._attr('artwork-url') || ''; }

    /** Derived play state — covers play/playing and the configured play payload. */
    get isPlaying() {
        const s = String(this.state ?? '').toLowerCase();
        if (!s) return false;
        return s === 'play' || s === 'playing' ||
            s === String(this._attr('payload-play', 'play')).toLowerCase();
    }

    /** The two metadata lines after the E182 dedupe rule. */
    lines({showAlbum = true, showProvider = true} = {}) {
        return albumProviderLines(this.album, this.provider, {showAlbum, showProvider});
    }

    /** Signature of everything that decides the subscription set (rewire trigger). */
    signature() {
        return ['subscribe', 'subscribe-title', 'subscribe-artist', 'subscribe-album',
            'subscribe-provider', 'subscribe-artwork-url', 'subscribe-position',
            'subscribe-duration', 'subscribe-volume', 'subscribe-mute',
            'subscribe-shuffle', 'subscribe-repeat', 'message-property']
            .map(a => this._attr(a)).join('|');
    }

    hostConnected() { this.wire(); }

    /**
     * Wire every configured topic. Subscriptions are DEDUPED by topic: a
     * bridge publishing one combined JSON (state + title + artist + …) opens
     * exactly ONE subscription whose handler runs every field's extractor.
     */
    wire() {
        this.__sig = this.signature();
        const byTopic = new Map();
        const on = (attrName, handler) => {
            const topic = this._attr(attrName);
            if (!topic) return;
            if (!byTopic.has(topic)) byTopic.set(topic, []);
            byTopic.get(topic).push(handler);
        };
        // Per-field message paths default to the fragment's own default
        // ('payload'), NOT to the element-level message-property. That is the
        // behaviour that shipped: every per-field attribute used to carry a
        // reflected 'payload' default, so the element-level path never
        // cascaded into the fields. Falling back to _msgProp here would
        // silently redirect every unset field at whatever path the STATE
        // topic uses (e.g. payload.state) and break configured dashboards.
        const path = attr => this._attr(attr, DEFAULT_PATH);
        const num = (v, {min = 0, max = Infinity} = {}) => {
            const n = Number(v);
            return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null;
        };
        const toSeconds = v => {
            const n = num(v);
            if (n === null) return null;
            return this._attr('time-unit', 's') === 'ms' ? n / 1000 : n;
        };

        on('subscribe', msg => {
            const v = this.host.getProperty(msg, this._msgProp);
            this.state = v === null || v === undefined ? null : String(v).toLowerCase();
        });
        on('subscribe-title',  msg => { this.title  = mediaStr(this.host.getProperty(msg, path('message-property-title'))); });
        on('subscribe-artist', msg => { this.artist = mediaStr(this.host.getProperty(msg, path('message-property-artist'))); });
        on('subscribe-album',  msg => { this.album  = mediaStr(this.host.getProperty(msg, path('message-property-album'))); });
        on('subscribe-provider', msg => { this.provider = mediaStr(this.host.getProperty(msg, path('message-property-provider'))); });
        on('subscribe-artwork-url', msg => { this.artwork = mediaStr(this.host.getProperty(msg, path('message-property-artwork-url'))); });
        on('subscribe-position', msg => {
            const v = toSeconds(this.host.getProperty(msg, path('message-property-position')));
            if (v !== null) this.position = v;
        });
        on('subscribe-duration', msg => {
            const v = toSeconds(this.host.getProperty(msg, path('message-property-duration')));
            if (v !== null) this.duration = v;
        });
        on('subscribe-volume', msg => {
            const v = num(this.host.getProperty(msg, path('message-property-volume')), {max: 100});
            if (v !== null) this.volume = v;
        });
        on('subscribe-mute', msg => {
            this.muted = mediaTruthy(this.host.getProperty(msg, path('message-property-mute')));
        });
        on('subscribe-shuffle', msg => {
            this.shuffle = mediaTruthy(this.host.getProperty(msg, path('message-property-shuffle')));
        });
        on('subscribe-repeat', msg => {
            const v = String(this.host.getProperty(msg, path('message-property-repeat')) ?? '').toLowerCase();
            this.repeat = REPEAT_CYCLE.includes(v) ? v : (mediaTruthy(v) ? 'all' : 'off');
        });

        for (const [topic, handlers] of byTopic) {
            this.host.addSubscription(topic, msg => {
                for (const h of handlers) h(msg);
                this.host.requestUpdate();
            });
        }
    }

    /** Call from the host's updated() to re-wire after live config edits. */
    rewireIfChanged() {
        if (this.__sig !== undefined && this.signature() !== this.__sig) {
            this._reset();
            this.host._unsubscribe();
            this.wire();
        }
    }

    // ── publishing (every path guarded against editor mode) ─────────────────

    _pub(topic, payload) {
        if (feezal.isEditor || !topic) return;
        feezal.connection?.pub?.(topic, payload);
    }

    /**
     * A transport action. In `payload` mode the configured payload goes to the
     * command topic; in `topic` mode the payload becomes the last topic
     * segment (echo2mqtt-style one-topic-per-command bridges).
     */
    command(action) {
        const payload = this._attr('payload-' + action, action);
        const base = this._attr('publish-command');
        if (!base) return;
        if (this._attr('command-mode', 'payload') === 'topic') {
            this._pub(`${base}/${payload}`, payload);
        } else {
            this._pub(base, payload);
        }
    }

    togglePlay() { this.command(this.isPlaying ? 'pause' : 'play'); }
    stop()       { this.command('stop'); }
    next()       { this.command('next'); }
    previous()   { this.command('previous'); }
    forward()    { this.command('forward'); }
    rewind()     { this.command('rewind'); }

    setVolume(v) {
        const n = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
        this.volume = n;
        this._pub(this._attr('publish-volume'), String(n));
    }

    toggleMute() {
        const next = !this.muted;
        this.muted = next;
        this._pub(this._attr('publish-mute'),
            next ? this._attr('payload-mute-on', 'true') : this._attr('payload-mute-off', 'false'));
    }

    toggleShuffle() {
        const next = !this.shuffle;
        this.shuffle = next;
        this._pub(this._attr('publish-shuffle'),
            next ? this._attr('payload-shuffle-on', 'true') : this._attr('payload-shuffle-off', 'false'));
    }

    /** cycle mode: off → all → one → off. toggle mode: off ↔ all with on/off payloads. */
    cycleRepeat() {
        const toggle = this._attr('repeat-mode', 'cycle') === 'toggle';
        if (toggle) {
            const next = this.repeat === 'off' ? 'all' : 'off';
            this.repeat = next;
            this._pub(this._attr('publish-repeat'),
                next === 'all' ? this._attr('payload-repeat-on', 'on') : this._attr('payload-repeat-off', 'off'));
            return;
        }
        const next = REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(this.repeat) + 1) % REPEAT_CYCLE.length];
        this.repeat = next;
        this._pub(this._attr('publish-repeat'), next);
    }

    seek(seconds) {
        const n = Math.max(0, Math.round(Number(seconds) || 0));
        this.position = n;
        this._pub(this._attr('publish-seek'), String(n));
    }
}

export {feezalBoolean};

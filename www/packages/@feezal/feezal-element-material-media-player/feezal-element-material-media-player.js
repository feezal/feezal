/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

// ─── Helpers ────────────────────────────────────────────────────────────────
// Format seconds → "m:ss" (or "h:mm:ss" for long tracks). Returns "0:00" for
// null / NaN so the progress row always renders a sensible value.
function fmtTime(sec) {
    if (sec === null || sec === undefined || isNaN(+sec) || +sec < 0) return '0:00';
    const total = Math.floor(+sec);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const ss = String(s).padStart(2, '0');
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
    return `${m}:${ss}`;
}

// Cycle order for the repeat toggle. off → all → one → off …
const REPEAT_CYCLE = ['off', 'all', 'one'];

// ─── Element ──────────────────────────────────────────────────────────────────
class FeezalElementMaterialMediaPlayer extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Media', category: 'Device', color: '#1565c0', icon: 'music_note'},
            description: 'Compact media / music control card — album art, track metadata, a seek bar, transport controls (previous, rewind, play/pause, forward, next, stop, shuffle, repeat) and an optional volume slider. Playback state (play/pause/stop/idle) drives the play/pause toggle.',
            // NOTE (future follow-up): this element uses the STANDARD flat-attribute
            // inspector. A dedicated N6 custom inspector (Topics + Config tabs,
            // capability-gated sections) would be a nice improvement given the
            // number of topic attributes — deferred for now.
            attributes: [
                // ── Playback state (primary) ───────────────────────────────────
                {name: 'subscribe', type: 'mqttTopic',
                    help: 'Primary topic carrying the playback state (play / pause / stop / idle). Drives the play/pause toggle.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" reads msg.payload directly. Also used as the fallback for every per-topic message-property.'},
                // ── Transport command topic + payloads ─────────────────────────
                {name: 'publish-command', type: 'mqttTopic',
                    help: 'Topic that transport buttons (play/pause/stop/next/previous/forward/rewind) publish to.'},
                {name: 'payload-play',     type: 'string', default: 'play',     help: 'Payload published to play. Default: play'},
                {name: 'payload-pause',    type: 'string', default: 'pause',    help: 'Payload published to pause. Default: pause'},
                {name: 'payload-stop',     type: 'string', default: 'stop',     help: 'Payload published to stop. Default: stop'},
                {name: 'payload-next',     type: 'string', default: 'next',     help: 'Payload published for skip-next. Default: next'},
                {name: 'payload-previous', type: 'string', default: 'previous', help: 'Payload published for skip-previous. Default: previous'},
                {name: 'payload-forward',  type: 'string', default: 'forward',  help: 'Payload published for fast-forward. Default: forward'},
                {name: 'payload-rewind',   type: 'string', default: 'rewind',   help: 'Payload published for fast-rewind. Default: rewind'},
                // ── Metadata topics ────────────────────────────────────────────
                {name: 'subscribe-title', type: 'mqttTopic', help: 'Topic for the current track title.'},
                {name: 'message-property-title', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the title message. Default: payload'},
                {name: 'subscribe-artist', type: 'mqttTopic', help: 'Topic for the current artist.'},
                {name: 'message-property-artist', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the artist message. Default: payload'},
                {name: 'subscribe-album', type: 'mqttTopic', help: 'Topic for the current album.'},
                {name: 'message-property-album', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the album message. Default: payload'},
                // ── Artwork ────────────────────────────────────────────────────
                {name: 'subscribe-artwork-url', type: 'mqttTopic', help: 'Topic carrying the album-art image URL.'},
                {name: 'message-property-artwork-url', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the artwork-url message. Default: payload'},
                {name: 'artwork-url', type: 'string', default: '',
                    help: 'Static album-art image URL. Used when no artwork-url topic message has arrived. Falls back to an album icon.'},
                // ── Progress / seek ────────────────────────────────────────────
                {name: 'subscribe-position', type: 'mqttTopic', help: 'Topic for the current playback position, in seconds.'},
                {name: 'message-property-position', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the position message. Default: payload'},
                {name: 'subscribe-duration', type: 'mqttTopic', help: 'Topic for the track duration, in seconds.'},
                {name: 'message-property-duration', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the duration message. Default: payload'},
                {name: 'publish-seek', type: 'mqttTopic', help: 'Topic that the target position (seconds) is published to when the seek bar is released.'},
                // ── Volume ─────────────────────────────────────────────────────
                {name: 'subscribe-volume', type: 'mqttTopic', help: 'Topic for the current volume (0–100).'},
                {name: 'message-property-volume', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the volume message. Default: payload'},
                {name: 'publish-volume', type: 'mqttTopic', help: 'Topic that a new volume (0–100) is published to.'},
                // ── Shuffle ────────────────────────────────────────────────────
                {name: 'subscribe-shuffle', type: 'mqttTopic', help: 'Topic for the shuffle state (on/off, true/false, 1/0).'},
                {name: 'message-property-shuffle', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the shuffle message. Default: payload'},
                {name: 'publish-shuffle', type: 'mqttTopic', help: 'Topic that the toggled shuffle state (true/false) is published to.'},
                // ── Repeat ─────────────────────────────────────────────────────
                {name: 'subscribe-repeat', type: 'mqttTopic', help: 'Topic for the repeat state (off / all / one).'},
                {name: 'message-property-repeat', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the repeat message. Default: payload'},
                {name: 'publish-repeat', type: 'mqttTopic', help: 'Topic that the cycled repeat state (off/all/one) is published to.'},
                // ── Display toggles ────────────────────────────────────────────
                {name: 'show-artwork',        type: 'boolean', default: true, help: 'Show the album-art column.'},
                {name: 'show-album',          type: 'boolean', default: true, help: 'Show the album name (tertiary line).'},
                {name: 'show-seek',           type: 'boolean', default: true, help: 'Show the progress / seek bar with elapsed / total time.'},
                {name: 'show-shuffle-repeat', type: 'boolean', default: true, help: 'Show the shuffle and repeat controls.'},
                {name: 'show-volume',         type: 'boolean', default: true, help: 'Show the volume slider row.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-media-color', type: 'color',
                    default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))',
                    help: 'Accent colour — progress fill, active shuffle/repeat, volume track.'},
                {property: '--feezal-media-text-color', type: 'color',
                    default: 'var(--primary-text-color, var(--feezal-color, #212121))',
                    help: 'Track title and transport icon colour.'},
                {property: '--feezal-media-muted-color', type: 'color',
                    default: 'var(--secondary-text-color, #9e9e9e)',
                    help: 'Artist / album / time text and inactive control colour.'},
                {property: '--feezal-media-surface-color', type: 'color',
                    default: 'var(--secondary-background-color, var(--feezal-bg, #fff))',
                    help: 'Album-art placeholder and progress-track background.'},
            ],
            restrict:     {minWidth: 220, minHeight: 120},
            defaultStyle: {width: '320px', height: '180px'},
        };
    }

    static properties = {
        // subscribe + messageProperty are inherited from FeezalElement.
        publishCommand:   {type: String, reflect: true, attribute: 'publish-command'},
        payloadPlay:      {type: String, reflect: true, attribute: 'payload-play'},
        payloadPause:     {type: String, reflect: true, attribute: 'payload-pause'},
        payloadStop:      {type: String, reflect: true, attribute: 'payload-stop'},
        payloadNext:      {type: String, reflect: true, attribute: 'payload-next'},
        payloadPrevious:  {type: String, reflect: true, attribute: 'payload-previous'},
        payloadForward:   {type: String, reflect: true, attribute: 'payload-forward'},
        payloadRewind:    {type: String, reflect: true, attribute: 'payload-rewind'},
        subscribeTitle:      {type: String, reflect: true, attribute: 'subscribe-title'},
        msgPropTitle:        {type: String, reflect: true, attribute: 'message-property-title'},
        subscribeArtist:     {type: String, reflect: true, attribute: 'subscribe-artist'},
        msgPropArtist:       {type: String, reflect: true, attribute: 'message-property-artist'},
        subscribeAlbum:      {type: String, reflect: true, attribute: 'subscribe-album'},
        msgPropAlbum:        {type: String, reflect: true, attribute: 'message-property-album'},
        subscribeArtworkUrl: {type: String, reflect: true, attribute: 'subscribe-artwork-url'},
        msgPropArtworkUrl:   {type: String, reflect: true, attribute: 'message-property-artwork-url'},
        artworkUrl:          {type: String, reflect: true, attribute: 'artwork-url'},
        subscribePosition:   {type: String, reflect: true, attribute: 'subscribe-position'},
        msgPropPosition:     {type: String, reflect: true, attribute: 'message-property-position'},
        subscribeDuration:   {type: String, reflect: true, attribute: 'subscribe-duration'},
        msgPropDuration:     {type: String, reflect: true, attribute: 'message-property-duration'},
        publishSeek:         {type: String, reflect: true, attribute: 'publish-seek'},
        subscribeVolume:     {type: String, reflect: true, attribute: 'subscribe-volume'},
        msgPropVolume:       {type: String, reflect: true, attribute: 'message-property-volume'},
        publishVolume:       {type: String, reflect: true, attribute: 'publish-volume'},
        subscribeShuffle:    {type: String, reflect: true, attribute: 'subscribe-shuffle'},
        msgPropShuffle:      {type: String, reflect: true, attribute: 'message-property-shuffle'},
        publishShuffle:      {type: String, reflect: true, attribute: 'publish-shuffle'},
        subscribeRepeat:     {type: String, reflect: true, attribute: 'subscribe-repeat'},
        msgPropRepeat:       {type: String, reflect: true, attribute: 'message-property-repeat'},
        publishRepeat:       {type: String, reflect: true, attribute: 'publish-repeat'},
        showArtwork:       {type: Boolean, reflect: true, attribute: 'show-artwork'},
        showAlbum:         {type: Boolean, reflect: true, attribute: 'show-album'},
        showSeek:          {type: Boolean, reflect: true, attribute: 'show-seek'},
        showShuffleRepeat: {type: Boolean, reflect: true, attribute: 'show-shuffle-repeat'},
        showVolume:        {type: Boolean, reflect: true, attribute: 'show-volume'},
        // Internal state — never as class fields (Lit 3 rule)
        _state:     {state: true},   // null | 'play' | 'pause' | 'stop' | 'idle'
        _title:     {state: true},   // null | string
        _artist:    {state: true},   // null | string
        _album:     {state: true},   // null | string
        _artwork:   {state: true},   // null | string (URL from topic)
        _position:  {state: true},   // null | number (seconds)
        _duration:  {state: true},   // null | number (seconds)
        _volume:    {state: true},   // null | number (0–100)
        _shuffle:   {state: true},   // boolean
        _repeat:    {state: true},   // 'off' | 'all' | 'one'
        _seekPos:   {state: true},   // null | number — live position during seek drag
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            padding: 10px;
            gap: 8px;
            overflow: hidden;

            /* ── Theme-aware colour tokens ──────────────────────────────────── */
            --feezal-media-color:         var(--primary-color,        var(--sl-color-primary-600, #0284c7));
            --feezal-media-text-color:    var(--primary-text-color,   var(--feezal-color, #212121));
            --feezal-media-muted-color:   var(--secondary-text-color, #9e9e9e);
            --feezal-media-surface-color: var(--secondary-background-color, var(--feezal-bg, #fff));

            color: var(--feezal-media-text-color);
            font-size: 13px;
        }

        /* Material Icons glyphs — feezal loads the 'Material Icons' font but NOT
           'Material Symbols', so md-icon would render as text. */
        .mi {
            font-family: 'Material Icons';
            font-style: normal;
            font-weight: normal;
            line-height: 1;
            -webkit-font-smoothing: antialiased;
            display: inline-block;
        }

        .top {
            display: flex;
            gap: 10px;
            min-height: 0;
            flex: 1;
        }
        .art {
            flex: 0 0 auto;
            width: 64px; height: 64px;
            border-radius: 6px;
            background: var(--feezal-media-surface-color);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
        .art img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .art .mi { font-size: 34px; color: var(--feezal-media-muted-color); }

        .meta {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 2px;
        }
        .title {
            font-size: 15px;
            font-weight: 700;
            color: var(--feezal-media-text-color);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .artist, .album {
            font-size: 12px;
            color: var(--feezal-media-muted-color);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .album { font-size: 11px; opacity: 0.85; }

        /* ── Progress / seek ──────────────────────────────────────────────── */
        .seek-row { display: flex; flex-direction: column; gap: 2px; }
        .bar {
            position: relative;
            height: 6px;
            border-radius: 3px;
            background: color-mix(in srgb, var(--feezal-media-muted-color) 35%, transparent);
            cursor: pointer;
            touch-action: none;
        }
        .bar-fill {
            position: absolute;
            top: 0; left: 0; bottom: 0;
            border-radius: 3px;
            background: var(--feezal-media-color);
        }
        .bar-knob {
            position: absolute;
            top: 50%;
            width: 12px; height: 12px;
            margin-left: -6px;
            border-radius: 50%;
            background: var(--feezal-media-color);
            transform: translateY(-50%);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        }
        .times {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: var(--feezal-media-muted-color);
            font-variant-numeric: tabular-nums;
        }

        /* ── Transport controls ───────────────────────────────────────────── */
        .transport {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 2px;
        }
        .transport button {
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            background: transparent;
            color: var(--feezal-media-text-color);
            cursor: pointer;
            padding: 4px;
            border-radius: 50%;
            line-height: 0;
        }
        .transport button:hover { background: color-mix(in srgb, var(--feezal-media-muted-color) 20%, transparent); }
        .transport button .mi { font-size: 22px; }
        .transport button.play .mi { font-size: 34px; color: var(--feezal-media-color); }
        .transport button.tgl .mi { font-size: 20px; color: var(--feezal-media-muted-color); }
        .transport button.tgl.active .mi { color: var(--feezal-media-color); }

        /* ── Volume ───────────────────────────────────────────────────────── */
        .vol-row {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .vol-row .mi { font-size: 18px; color: var(--feezal-media-muted-color); }
        input[type="range"] {
            flex: 1;
            accent-color: var(--feezal-media-color);
            cursor: pointer;
            margin: 0;
        }
    `];

    constructor() {
        super();
        this.publishCommand  = '';
        this.payloadPlay     = 'play';
        this.payloadPause    = 'pause';
        this.payloadStop     = 'stop';
        this.payloadNext     = 'next';
        this.payloadPrevious = 'previous';
        this.payloadForward  = 'forward';
        this.payloadRewind   = 'rewind';
        this.subscribeTitle      = '';
        this.msgPropTitle        = '';
        this.subscribeArtist     = '';
        this.msgPropArtist       = '';
        this.subscribeAlbum      = '';
        this.msgPropAlbum        = '';
        this.subscribeArtworkUrl = '';
        this.msgPropArtworkUrl   = '';
        this.artworkUrl          = '';
        this.subscribePosition   = '';
        this.msgPropPosition     = '';
        this.subscribeDuration   = '';
        this.msgPropDuration     = '';
        this.publishSeek         = '';
        this.subscribeVolume     = '';
        this.msgPropVolume       = '';
        this.publishVolume       = '';
        this.subscribeShuffle    = '';
        this.msgPropShuffle      = '';
        this.publishShuffle      = '';
        this.subscribeRepeat     = '';
        this.msgPropRepeat       = '';
        this.publishRepeat       = '';
        this.showArtwork       = true;
        this.showAlbum         = true;
        this.showSeek          = true;
        this.showShuffleRepeat = true;
        this.showVolume        = true;
        this._state    = null;
        this._title    = null;
        this._artist   = null;
        this._album    = null;
        this._artwork  = null;
        this._position = null;
        this._duration = null;
        this._volume   = null;
        this._shuffle  = false;
        this._repeat   = 'off';
        this._seekPos  = null;
    }

    // The media player manages all subscriptions itself.
    _subscribe() { /* intentionally empty — see connectedCallback */ }

    connectedCallback() {
        super.connectedCallback();
        const sub = (topic, cb) => { if (topic) this.addSubscription(topic, cb); };

        // Primary: playback state (subscribe + message-property inherited)
        sub(this.subscribe, msg => {
            const v = this.getProperty(msg, this.messageProperty);
            this._state = v === null || v === undefined ? null : String(v).toLowerCase();
        });

        sub(this.subscribeTitle, msg => {
            this._title = this._str(this.getProperty(msg, this.msgPropTitle || this.messageProperty));
        });
        sub(this.subscribeArtist, msg => {
            this._artist = this._str(this.getProperty(msg, this.msgPropArtist || this.messageProperty));
        });
        sub(this.subscribeAlbum, msg => {
            this._album = this._str(this.getProperty(msg, this.msgPropAlbum || this.messageProperty));
        });
        sub(this.subscribeArtworkUrl, msg => {
            this._artwork = this._str(this.getProperty(msg, this.msgPropArtworkUrl || this.messageProperty));
        });
        sub(this.subscribePosition, msg => {
            const v = Number(this.getProperty(msg, this.msgPropPosition || this.messageProperty));
            if (!isNaN(v)) this._position = Math.max(0, v);
        });
        sub(this.subscribeDuration, msg => {
            const v = Number(this.getProperty(msg, this.msgPropDuration || this.messageProperty));
            if (!isNaN(v)) this._duration = Math.max(0, v);
        });
        sub(this.subscribeVolume, msg => {
            const v = Number(this.getProperty(msg, this.msgPropVolume || this.messageProperty));
            if (!isNaN(v)) this._volume = Math.max(0, Math.min(100, v));
        });
        sub(this.subscribeShuffle, msg => {
            this._shuffle = this._truthy(this.getProperty(msg, this.msgPropShuffle || this.messageProperty));
        });
        sub(this.subscribeRepeat, msg => {
            const v = String(this.getProperty(msg, this.msgPropRepeat || this.messageProperty)).toLowerCase();
            this._repeat = REPEAT_CYCLE.includes(v) ? v : (this._truthy(v) ? 'all' : 'off');
        });
    }

    // ─── Value coercion helpers ────────────────────────────────────────────────
    _str(v) {
        if (v === null || v === undefined) return null;
        const s = String(v);
        return s === '' ? null : s;
    }

    _truthy(v) {
        return v === true || v === 1 || v === 'true' || v === '1' || v === 'on' ||
            String(v).toLowerCase() === 'true' || String(v).toLowerCase() === 'on';
    }

    // ─── Derived play state ────────────────────────────────────────────────────
    get _isPlaying() {
        return this._state === this.payloadPlay?.toLowerCase() || this._state === 'play' || this._state === 'playing';
    }

    // ─── Publish helpers (all guarded against editor mode) ──────────────────────
    _command(payload) {
        if (feezal.isEditor) return;
        if (this.publishCommand) feezal.connection.pub(this.publishCommand, payload);
    }

    _togglePlay()  { this._command(this._isPlaying ? this.payloadPause : this.payloadPlay); }
    _stop()        { this._command(this.payloadStop); }
    _next()        { this._command(this.payloadNext); }
    _previous()    { this._command(this.payloadPrevious); }
    _forward()     { this._command(this.payloadForward); }
    _rewind()      { this._command(this.payloadRewind); }

    _toggleShuffle() {
        if (feezal.isEditor) return;
        this._shuffle = !this._shuffle;
        if (this.publishShuffle) feezal.connection.pub(this.publishShuffle, String(this._shuffle));
    }

    _cycleRepeat() {
        if (feezal.isEditor) return;
        const idx = REPEAT_CYCLE.indexOf(this._repeat);
        this._repeat = REPEAT_CYCLE[(idx + 1) % REPEAT_CYCLE.length];
        if (this.publishRepeat) feezal.connection.pub(this.publishRepeat, this._repeat);
    }

    _onVolume(e) {
        const v = Number(e.target.value);
        this._volume = v;
        if (feezal.isEditor) return;
        if (this.publishVolume) feezal.connection.pub(this.publishVolume, String(v));
    }

    // ─── Seek interaction ──────────────────────────────────────────────────────
    _seekFromEvent(e, barEl) {
        const rect = barEl.getBoundingClientRect();
        const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const dur = this._duration ?? 0;
        return frac * dur;
    }

    _onSeekPointerDown(e) {
        if (feezal.isEditor) return;
        if (!this._duration) return;   // nothing to seek within
        const barEl = e.currentTarget;
        barEl.setPointerCapture(e.pointerId);

        const move = ev => { this._seekPos = this._seekFromEvent(ev, barEl); };
        const up = () => {
            barEl.removeEventListener('pointermove', move);
            barEl.removeEventListener('pointerup', up);
            if (this._seekPos !== null) {
                const target = Math.round(this._seekPos);
                this._position = target;
                if (this.publishSeek) feezal.connection.pub(this.publishSeek, String(target));
                this._seekPos = null;
            }
        };

        barEl.addEventListener('pointermove', move);
        barEl.addEventListener('pointerup', up);
        move(e);   // immediate feedback
    }

    // ─── Render ────────────────────────────────────────────────────────────────
    render() {
        // Placeholder DATA when nothing has arrived yet (editor + unconfigured).
        const title    = this._title  ?? (feezal.isEditor ? 'Song Title' : null);
        const artist   = this._artist ?? (feezal.isEditor ? 'Artist' : null);
        const album    = this._album  ?? null;
        const artwork  = this._artwork || this.artworkUrl || null;

        const duration = this._duration ?? (feezal.isEditor ? 200 : null);
        const rawPos   = this._seekPos ?? this._position ??
            (feezal.isEditor && duration ? duration * 0.4 : null);
        const position = rawPos ?? 0;
        const pct      = duration ? Math.max(0, Math.min(100, (position / duration) * 100)) : 0;

        const volume   = this._volume ?? (feezal.isEditor ? 60 : 0);

        return html`
            <div class="top">
                ${this.showArtwork ? html`
                    <div class="art">
                        ${artwork
                            ? html`<img src="${artwork}" alt="album art"
                                   @error="${e => { e.target.style.display = 'none'; }}">`
                            : html`<span class="mi">album</span>`}
                    </div>
                ` : ''}
                <div class="meta">
                    <div class="title" title="${title ?? ''}">${title ?? ''}</div>
                    <div class="artist" title="${artist ?? ''}">${artist ?? ''}</div>
                    ${this.showAlbum && album
                        ? html`<div class="album" title="${album}">${album}</div>` : ''}
                </div>
            </div>

            ${this.showSeek ? html`
                <div class="seek-row">
                    <div class="bar" @pointerdown="${this._onSeekPointerDown}">
                        <div class="bar-fill" style="width:${pct}%"></div>
                        <div class="bar-knob" style="left:${pct}%"></div>
                    </div>
                    <div class="times">
                        <span>${fmtTime(position)}</span>
                        <span>${fmtTime(duration)}</span>
                    </div>
                </div>
            ` : ''}

            <div class="transport">
                <button title="Previous" @click="${this._previous}"><span class="mi">skip_previous</span></button>
                <button title="Rewind" @click="${this._rewind}"><span class="mi">fast_rewind</span></button>
                <button class="play" title="Play/Pause" @click="${this._togglePlay}">
                    <span class="mi">${this._isPlaying ? 'pause' : 'play_arrow'}</span>
                </button>
                <button title="Forward" @click="${this._forward}"><span class="mi">fast_forward</span></button>
                <button title="Next" @click="${this._next}"><span class="mi">skip_next</span></button>
                <button title="Stop" @click="${this._stop}"><span class="mi">stop</span></button>
                ${this.showShuffleRepeat ? html`
                    <button class="tgl ${this._shuffle ? 'active' : ''}" title="Shuffle"
                        @click="${this._toggleShuffle}"><span class="mi">shuffle</span></button>
                    <button class="tgl ${this._repeat !== 'off' ? 'active' : ''}" title="Repeat: ${this._repeat}"
                        @click="${this._cycleRepeat}">
                        <span class="mi">${this._repeat === 'one' ? 'repeat_one' : 'repeat'}</span>
                    </button>
                ` : ''}
            </div>

            ${this.showVolume ? html`
                <div class="vol-row">
                    <span class="mi">volume_up</span>
                    <input type="range" min="0" max="100" step="1"
                        .value="${String(volume)}"
                        @input="${this._onVolume}">
                </div>
            ` : ''}
        `;
    }
}

customElements.define('feezal-element-material-media-player', FeezalElementMaterialMediaPlayer);
export {FeezalElementMaterialMediaPlayer};

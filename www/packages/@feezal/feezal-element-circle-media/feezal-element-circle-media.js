/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';
import {MediaController, mediaAttributes, mediaDiscoveryMap} from '@feezal/feezal-controller-media';
import {availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';

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

// kebab attribute name → camelCase property name.
const camel = n => n.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// E182: the media contract is declared ONCE by the controller, so the ~40
// topic/payload attributes become reflected properties programmatically —
// hand-listing them drifts the moment the fragment grows. `subscribe` and
// `message-property` are inherited from FeezalElement and must NOT be
// redeclared here.
const CONTROLLER_PROPS = Object.fromEntries(
    mediaAttributes
        .filter(a => a.name !== 'subscribe' && a.name !== 'message-property')
        .map(a => [camel(a.name), {type: String, reflect: true, attribute: a.name}]));

// ─── Element ──────────────────────────────────────────────────────────────────
class FeezalElementCircleMedia extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Media', category: 'Circle', color: '#1565c0', icon: 'music_note'},
            description: 'Compact media / music control card — album art, track metadata, a seek bar, transport controls (previous, rewind, play/pause, forward, next, stop, shuffle, repeat), mute and an optional volume slider. Playback state (play/pause/stop/idle) drives the play/pause toggle.',
            // NOTE (future follow-up): this element uses the STANDARD flat-attribute
            // inspector. A dedicated N6 custom inspector (Topics + Config tabs,
            // capability-gated sections) would be a nice improvement given the
            // number of topic attributes — deferred for now.
            discovery: {component: 'media', map: mediaDiscoveryMap},
            attributes: [
                // E182: the whole media MQTT contract — one declaration, every family.
                ...mediaAttributes,
                ...availabilityAttributes(),
                // ── Display toggles ────────────────────────────────────────────
                {name: 'show-artwork',        type: 'boolean', default: true, help: 'Show the album-art column.'},
                {name: 'show-album',          type: 'boolean', default: true, help: 'Show the album name (tertiary line).'},
                {name: 'show-provider',       type: 'boolean', default: true, help: 'Show the playback source / provider. When it is identical to the album, only one of the two lines is rendered.'},
                {name: 'show-seek',           type: 'boolean', default: true, help: 'Show the progress / seek bar with elapsed / total time.'},
                {name: 'show-shuffle-repeat', type: 'boolean', default: true, help: 'Show the shuffle and repeat controls.'},
                {name: 'show-volume',         type: 'boolean', default: true, help: 'Show the volume slider row.'},
                {name: 'show-mute',           type: 'boolean', default: true, help: 'Show the mute button in the volume row.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-media-color', type: 'color',
                    default: 'var(--primary-color)',
                    help: 'Accent colour — progress fill, active shuffle/repeat, volume track.'},
                {property: '--feezal-media-text-color', type: 'color',
                    default: 'var(--primary-text-color)',
                    help: 'Track title and transport icon colour.'},
                {property: '--feezal-media-muted-color', type: 'color',
                    default: 'var(--secondary-text-color)',
                    help: 'Artist / album / time text and inactive control colour.'},
                {property: '--feezal-media-surface-color', type: 'color',
                    default: 'var(--secondary-background-color)',
                    help: 'Album-art placeholder and progress-track background.'},
            ],
            restrict:     {minWidth: 220, minHeight: 120},
            defaultStyle: {width: '320px', height: '180px'},
        };
    }

    static properties = {
        // subscribe + messageProperty are inherited from FeezalElement.
        ...CONTROLLER_PROPS,
        showArtwork:       {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-artwork'},
        showAlbum:         {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-album'},
        showProvider:      {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-provider'},
        showSeek:          {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-seek'},
        showShuffleRepeat: {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-shuffle-repeat'},
        showVolume:        {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-volume'},
        showMute:          {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-mute'},
        // Internal UI state — never as class fields (Lit 3 rule)
        _seekPos:   {state: true},   // null | number — live position during a seek drag
        _tick:      {state: true},   // bumped by the controller-driven re-render
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
            --feezal-media-color:         var(--primary-color);
            --feezal-media-text-color:    var(--primary-text-color);
            --feezal-media-muted-color:   var(--secondary-text-color);
            --feezal-media-surface-color: var(--secondary-background-color);

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
    `
    , css`
        /* E182: player name (label), provider line and the mute button. */
        .player {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--feezal-media-muted-color);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .provider { opacity: 0.85; }
        .vol-row .tgl.mute {
            display: flex; align-items: center; justify-content: center;
            border: none; background: transparent; cursor: pointer;
            padding: 2px; border-radius: 50%; line-height: 0;
            color: var(--feezal-media-muted-color);
        }
        .vol-row .tgl.mute.active { color: var(--feezal-media-color); }
    `];

    constructor() {
        super();
        // Attribute defaults come from the shared fragment, so a new knob in
        // the controller cannot be forgotten here.
        for (const a of mediaAttributes) {
            if (a.name === 'subscribe' || a.name === 'message-property') continue;
            this[camel(a.name)] = a.default !== undefined ? String(a.default) : '';
        }
        this.showArtwork       = true;
        this.showAlbum         = true;
        this.showProvider      = true;
        this.showSeek          = true;
        this.showShuffleRepeat = true;
        this.showVolume        = true;
        this.showMute          = true;
        this._seekPos = null;
        this._tick = 0;
        // E182: the behaviour layer — wiring, state, transport publishing.
        this.media = new MediaController(this);
    }

    // The controller owns every subscription (deduped per topic).
    _subscribe() { /* intentionally empty — MediaController.wire() */ }

    updated(changed) {
        super.updated?.(changed);
        this.media.rewireIfChanged();
    }

    // ─── Seek drag ─────────────────────────────────────────────────────────────
    _seekFromEvent(e, barEl) {
        const rect = barEl.getBoundingClientRect();
        if (!rect.width || !this.media.duration) return null;
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        return ratio * this.media.duration;
    }

    _onSeekPointerDown(e) {
        if (feezal.isEditor || !this.media.duration) return;
        const barEl = e.currentTarget;
        barEl.setPointerCapture?.(e.pointerId);
        this._seekPos = this._seekFromEvent(e, barEl);
        const move = ev => { this._seekPos = this._seekFromEvent(ev, barEl); };
        const up = () => {
            barEl.removeEventListener('pointermove', move);
            barEl.removeEventListener('pointerup', up);
            barEl.removeEventListener('pointercancel', up);
            if (this._seekPos !== null) {
                this.media.seek(Math.round(this._seekPos));
                this._seekPos = null;
            }
        };
        barEl.addEventListener('pointermove', move);
        barEl.addEventListener('pointerup', up);
        barEl.addEventListener('pointercancel', up);
    }

    _onVolume(e) { this.media.setVolume(e.target.value); }

    render() {
        const m = this.media;
        // Placeholder DATA when nothing has arrived yet (editor + unconfigured).
        const title    = m.title  ?? (feezal.isEditor ? 'Song Title' : null);
        const artist   = m.artist ?? (feezal.isEditor ? 'Artist' : null);
        // E182: album and provider collapse to ONE line when they carry the
        // same text (the album wins as the more specific label).
        const {album, provider} = m.lines({showAlbum: this.showAlbum, showProvider: this.showProvider});
        const artwork  = m.artworkUrl || null;

        const duration = m.duration ?? (feezal.isEditor ? 200 : null);
        const rawPos   = this._seekPos ?? m.position ??
            (feezal.isEditor && duration ? duration * 0.4 : null);
        const position = rawPos ?? 0;
        const pct      = duration ? Math.max(0, Math.min(100, (position / duration) * 100)) : 0;

        const volume   = m.volume ?? (feezal.isEditor ? 60 : 0);

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
                    ${this.label ? html`<div class="player" title="${this.label}">${this.label}</div>` : ''}
                    <div class="title" title="${title ?? ''}">${title ?? ''}</div>
                    <div class="artist" title="${artist ?? ''}">${artist ?? ''}</div>
                    ${album ? html`<div class="album" title="${album}">${album}</div>` : ''}
                    ${provider ? html`<div class="album provider" title="${provider}">${provider}</div>` : ''}
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
                <button title="Previous" @click="${() => m.previous()}"><span class="mi">skip_previous</span></button>
                <button title="Rewind" @click="${() => m.rewind()}"><span class="mi">fast_rewind</span></button>
                <button class="play" title="Play/Pause" @click="${() => m.togglePlay()}">
                    <span class="mi">${m.isPlaying ? 'pause' : 'play_arrow'}</span>
                </button>
                <button title="Forward" @click="${() => m.forward()}"><span class="mi">fast_forward</span></button>
                <button title="Next" @click="${() => m.next()}"><span class="mi">skip_next</span></button>
                <button title="Stop" @click="${() => m.stop()}"><span class="mi">stop</span></button>
                ${this.showShuffleRepeat ? html`
                    <button class="tgl ${m.shuffle ? 'active' : ''}" title="Shuffle"
                        @click="${() => m.toggleShuffle()}"><span class="mi">shuffle</span></button>
                    <button class="tgl ${m.repeat !== 'off' ? 'active' : ''}" title="Repeat: ${m.repeat}"
                        @click="${() => m.cycleRepeat()}">
                        <span class="mi">${m.repeat === 'one' ? 'repeat_one' : 'repeat'}</span>
                    </button>
                ` : ''}
            </div>

            ${this.showVolume ? html`
                <div class="vol-row">
                    ${this.showMute ? html`
                        <button class="tgl mute ${m.muted ? 'active' : ''}" title="${m.muted ? 'Unmute' : 'Mute'}"
                            @click="${() => m.toggleMute()}">
                            <span class="mi">${m.muted ? 'volume_off' : 'volume_up'}</span>
                        </button>
                    ` : html`<span class="mi">volume_up</span>`}
                    <input type="range" min="0" max="100" step="1"
                        .value="${String(volume)}"
                        @input="${this._onVolume}">
                </div>
            ` : ''}
        `;
    }
}

customElements.define('feezal-element-circle-media', FeezalElementCircleMedia);
export {FeezalElementCircleMedia};

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
// Deliberately NOT reflected, and deliberately WITHOUT constructor defaults —
// the same trap the base class documents for the availability block: Lit
// reflects constructor defaults on first update, which would stamp all ~40
// media attributes (payload-play="play", message-property-title="payload", …)
// onto EVERY media element and serialize that junk into every saved dashboard.
// It also fires an attribute-mutation storm on the canvas, which the editor's
// passive chrome observes (see B119). Attribute → property sync is all that is
// needed: the controller reads its config from the attributes with the
// fragment's own fallbacks.
const CONTROLLER_PROPS = Object.fromEntries(
    mediaAttributes
        .filter(a => a.name !== 'subscribe' && a.name !== 'message-property')
        .map(a => [camel(a.name), {type: String, attribute: a.name}]));

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
                {property: '--feezal-media-track-width', default: '7',
                    help: 'Progress-ring width around the album disc — unitless, in % of the circle viewBox (default 7). Same scale as the other Circle cards.'},
            ],
            restrict:     {minWidth: 120, minHeight: 170},
            defaultStyle: {width: '180px', height: '260px'},
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
        /* ── E184: the Circle-family look ────────────────────────────────
           Album art becomes the family DISC with the progress as a ring
           around it (the same 0..100 viewBox + cqi scale every other Circle
           card uses), the metadata sits centred under the disc, and the
           transport row closes the card. The old side-by-side art/meta row
           and the linear seek bar are gone. */
        :host { align-items: center; container-type: inline-size; }
        .disc-wrap {
            position: relative;
            width: 100%; max-width: 100cqi; aspect-ratio: 1; flex: 0 1 auto;
            min-height: 0;
            display: flex; align-items: center; justify-content: center;
        }
        .disc-wrap svg { position: absolute; inset: 0; width: 100%; height: 100%; }
        .ring-track { fill: none; stroke: var(--feezal-media-surface-color);
            stroke-width: var(--feezal-media-track-width, 7); }
        .ring-fill {
            fill: none; stroke: var(--feezal-media-color);
            stroke-width: var(--feezal-media-track-width, 7);
            stroke-linecap: round;
            transform: rotate(-90deg); transform-origin: 50% 50%;
        }
        /* The art disc sits inside the ring — 84% leaves the stroke visible. */
        .disc {
            position: relative;
            width: 84%; aspect-ratio: 1; border-radius: 50%; overflow: hidden;
            background: var(--feezal-media-surface-color);
            display: flex; align-items: center; justify-content: center;
        }
        .disc img { width: 100%; height: 100%; object-fit: cover; }
        .disc .mi { font-size: 26cqi; color: var(--feezal-media-muted-color); }
        /* Play/pause overlays the disc centre — the card's main action. */
        .disc-play {
            position: absolute; inset: 0; margin: auto;
            width: 30%; height: 30%;
            display: flex; align-items: center; justify-content: center;
            border: none; border-radius: 50%; cursor: pointer;
            background: color-mix(in srgb, var(--feezal-media-surface-color) 70%, transparent);
            color: var(--feezal-media-text-color);
            backdrop-filter: blur(2px);
        }
        .disc-play .mi { font-size: 14cqi; color: inherit; }
        .meta.centred { align-items: center; text-align: center; width: 100%; }
        .times.ring { justify-content: center; gap: 6px; }

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
        // No defaults assigned here on purpose — see CONTROLLER_PROPS: assigning
        // them would reflect ~40 attributes onto the element. The controller
        // applies the fragment's defaults when reading each attribute.
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

    /**
     * The progress ring only exists when a position/duration source is
     * actually configured — an unconfigured card shows a plain art disc
     * instead of an eternally empty ring (requested 08/2026). The editor
     * preview still draws it so the knob is discoverable.
     */
    get _hasProgress() {
        return Boolean(this.subscribePosition || this.subscribeDuration || feezal.isEditor);
    }

    // ─── Seek on the ring ──────────────────────────────────────────────────────
    // Angle → fraction of the track, clockwise from 12 o'clock — the gesture
    // model every other Circle card uses (0..100 viewBox centred at 50,50).
    _seekFromEvent(e, ringEl) {
        const rect = ringEl.getBoundingClientRect();
        if (!rect.width || !this.media.duration) return null;
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);
        let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;   // 0 = up, clockwise
        if (deg < 0) deg += 360;
        return (deg / 360) * this.media.duration;
    }

    _onSeekPointerDown(e) {
        if (feezal.isEditor || !this.media.duration || !this.publishSeek) return;
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

    // E185: press → hold device echoes off, drag → throttled publishes,
    // release (change / pointerup) → the final value and the settle tail.
    _onVolumeDown()   { this.media.beginVolumeDrag(); }
    _onVolume(e)      { this.media.setVolume(e.target.value); }
    _onVolumeCommit(e) { this.media.setVolume(e.target.value, {commit: true}); }

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

        // E184: the Circle look — art disc, progress as the ring around it.
        const showRing = this.showSeek && this._hasProgress;
        const R = 46;                                  // ring radius in the 0..100 viewBox
        const CIRC = 2 * Math.PI * R;
        const dash = `${(CIRC * pct) / 100} ${CIRC}`;

        return html`
            ${this.showArtwork ? html`
                <div class="disc-wrap" @pointerdown="${showRing ? this._onSeekPointerDown : null}">
                    ${showRing ? html`
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                            <circle class="ring-track" cx="50" cy="50" r="${R}"></circle>
                            <circle class="ring-fill" cx="50" cy="50" r="${R}" stroke-dasharray="${dash}"></circle>
                        </svg>
                    ` : ''}
                    <div class="disc">
                        ${artwork
                            ? html`<img src="${artwork}" alt="album art"
                                   @error="${e => { e.target.style.display = 'none'; }}">`
                            : html`<span class="mi">album</span>`}
                    </div>
                    <button class="disc-play" title="Play/Pause" @click="${() => m.togglePlay()}">
                        <span class="mi">${m.isPlaying ? 'pause' : 'play_arrow'}</span>
                    </button>
                </div>
            ` : ''}

            <div class="meta centred">
                ${this.label ? html`<div class="player" title="${this.label}">${this.label}</div>` : ''}
                <div class="title" title="${title ?? ''}">${title ?? ''}</div>
                <div class="artist" title="${artist ?? ''}">${artist ?? ''}</div>
                ${album ? html`<div class="album" title="${album}">${album}</div>` : ''}
                ${provider ? html`<div class="album provider" title="${provider}">${provider}</div>` : ''}
            </div>

            ${showRing ? html`
                <div class="times ring">
                    <span>${fmtTime(position)}</span><span>/</span><span>${fmtTime(duration)}</span>
                </div>
            ` : ''}

            <div class="transport">
                <button title="Previous" @click="${() => m.previous()}"><span class="mi">skip_previous</span></button>
                <button title="Rewind" @click="${() => m.rewind()}"><span class="mi">fast_rewind</span></button>
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
                        @pointerdown="${this._onVolumeDown}"
                        @input="${this._onVolume}"
                        @change="${this._onVolumeCommit}"
                        @pointerup="${this._onVolumeCommit}">
                </div>
            ` : ''}
        `;
    }
}

customElements.define('feezal-element-circle-media', FeezalElementCircleMedia);
export {FeezalElementCircleMedia};

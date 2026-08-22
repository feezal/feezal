/* global feezal */
import {feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';
import {MediaController, mediaAttributes, mediaDiscoveryMap} from '@feezal/feezal-controller-media';
import {applySizePreset, glassCardStyles, glassBadgeTray, glassPopupStyles, glassPopupKnobs, FeezalGlassCard} from '@feezal/feezal-glass';
import {availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';

/**
 * feezal-element-glass-media (E183, E189)
 *
 * Frosted-glass now-playing card over @feezal/feezal-controller-media. The
 * controller owns the MQTT contract (deduped subscriptions, transport,
 * volume/mute, shuffle/repeat, the E186 source/preset capability); this is
 * the glass VIEW.
 *
 * E189 layout rules:
 *   - the album cover never scales with the card: it grows to
 *     --feezal-glass-media-art-max (default 140px) and stops — extra height
 *     goes to the metadata and controls, not the cover;
 *   - tall cards (4x3 / 4x4 / 6x3) go two-row: cover + metadata on top,
 *     controls below; long titles wrap to two lines instead of ellipsizing;
 *   - `controls` decides what sits on the FACE (minimal = prev/play/next,
 *     standard = + volume row, full = everything), the `show-*` knobs still
 *     veto a control everywhere, and the ⋯ details popup (E171 machinery)
 *     holds the FULL set — seek, volume + mute, shuffle/repeat, source and
 *     presets — which is the only place they fit on a 4x1 bar.
 */

const MEDIA_SIZES = {
    '4x2': [354, 172], '6x2': [536, 172], '2x2': [172, 172], '4x1': [354, 86],
    // E189: tall presets — family grid 81px unit + 10px gutter: 3 → 263, 4 → 354.
    '4x3': [354, 263], '4x4': [354, 354], '6x3': [536, 263],
};

/** E189: which controls the face shows per `controls` preset. */
const FACE = {
    minimal:  {transport: true, shuffleRepeat: false, seek: false, volume: false, source: false, presets: true},
    standard: {transport: true, shuffleRepeat: true,  seek: false, volume: true,  source: false, presets: true},
    full:     {transport: true, shuffleRepeat: true,  seek: true,  volume: true,  source: true,  presets: true},
};

const fmtTime = sec => {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r < 10 ? '0' : ''}${r}`;
};

const camel = n => n.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// The media contract is declared once by the controller — its ~50 topic and
// payload attributes become properties programmatically so a new knob in the
// fragment cannot be forgotten here (subscribe and message-property are
// inherited from FeezalElement).
// Deliberately NOT reflected, and deliberately WITHOUT constructor defaults —
// the same trap the base class documents for the availability block: Lit
// reflects constructor defaults on first update, which would stamp all the
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

class FeezalElementGlassMedia extends FeezalGlassCard {
    static get feezal() {
        return {
            palette: {name: 'Media', category: 'Glass', color: '#7aa5c9', icon: 'music_note'},
            description: 'Frosted-glass now-playing card — album art, track / artist / album / source, ' +
                'transport controls, mute and volume; the ⋯ popup holds the full control set (seek, volume, ' +
                'shuffle/repeat, source, presets). Album and source collapse to one line when they carry ' +
                'the same text. Autodiscovers Echo, WiiM and LG soundbar bridges and any media-contract bridge.',
            discovery: {component: 'media', map: mediaDiscoveryMap},
            attributes: [
                {name: 'size', type: 'select', options: ['', '4x2', '6x2', '4x3', '4x4', '6x3', '2x2', '4x1'], default: '',
                    help: 'Preset size: 4x2 = wide (the default shape), 6x2 = extra wide, 4x3 / 4x4 / 6x3 = tall (two-row layout: cover + text on top, controls below), 2x2 = square, 4x1 = compact bar. Empty keeps the current/manual size.'},
                {name: 'controls', type: 'select', options: ['minimal', 'standard', 'full'], default: 'standard',
                    help: 'What the card FACE shows: minimal = prev / play / next only; standard = plus the volume row (and shuffle/repeat when enabled); full = everything (seek, source select, presets). Whatever is not on the face is in the ⋯ popup. The show-* toggles still hide a control everywhere.'},
                // E182: the whole media MQTT contract — one declaration, every family.
                ...mediaAttributes,
                ...availabilityAttributes(),
                {name: 'show-artwork',  type: 'boolean', default: true, help: 'Show the square album cover on the left.'},
                {name: 'show-album',    type: 'boolean', default: true, help: 'Show the album name.'},
                {name: 'show-provider', type: 'boolean', default: true, help: 'Show the playback source / provider. When it is identical to the album, only one of the two lines is rendered.'},
                {name: 'show-seek',     type: 'boolean', default: true, help: 'Allow the progress bar with elapsed / total time (face: controls full or a tall card; always in the popup).'},
                {name: 'show-shuffle-repeat', type: 'boolean', default: false, help: 'Allow the shuffle and repeat controls (face: controls standard/full; always in the popup).'},
                {name: 'show-volume',   type: 'boolean', default: true, help: 'Allow the volume slider row (face: controls standard/full; always in the popup).'},
                {name: 'show-mute',     type: 'boolean', default: true, help: 'Show the mute button in the volume row.'},
                {name: 'show-source',   type: 'boolean', default: true, help: 'Allow the source / input select and the preset row (only rendered when a source or preset topic is wired; face: controls full, presets on every face; always in the popup).'},
                {name: 'show-details',  type: 'boolean', default: true, help: 'Show the ⋯ button that opens the details popup with the full control set.'},
                ...glassPopupKnobs,
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-media-art-size', default: '45%',
                    help: 'Maximum width of the square album cover, as a share of the card (default 45%).'},
                {property: '--feezal-glass-media-art-max', default: '140px',
                    help: 'Absolute cap for the album cover edge — the cover stops growing here, the rest of a tall card goes to text and controls.'},
                {property: '--feezal-glass-font-size-title', default: '14px', help: 'Track title font size.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Artist / album / source font size.'},
            ],
            defaultStyle: {width: '354px', height: '172px'},
            restrict: {minWidth: 120, minHeight: 80},
        };
    }

    static properties = {
        ...FeezalGlassCard.properties,
        ...CONTROLLER_PROPS,
        size:          {type: String,  reflect: true},
        controls:      {type: String,  reflect: true},
        showArtwork:   {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-artwork'},
        showAlbum:     {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-album'},
        showProvider:  {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-provider'},
        showSeek:      {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-seek'},
        showShuffleRepeat: {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-shuffle-repeat'},
        showVolume:    {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-volume'},
        showMute:      {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-mute'},
        showSource:    {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-source'},
        showDetails:   {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-details'},
        degrade:       {type: Boolean, reflect: true},
    };

    static styles = [feezalBaseStyles, glassCardStyles, glassPopupStyles, css`
        /* E189: a GRID, so the same markup is the classic now-playing row on a
           wide card and a two-row layout on a tall one. */
        .card {
            padding: 10px; overflow: hidden; gap: 6px 10px;
            display: grid; grid-template: 'art meta' auto 'art ctrl' 1fr / auto minmax(0, 1fr);
            align-items: start; align-content: center; text-align: left;
        }
        :host([degrade]) .card {
            -webkit-backdrop-filter: none; backdrop-filter: none;
            background: var(--feezal-glass-solid, rgba(255,255,255,0.82));
        }
        /* E189: the cover stops at --feezal-glass-media-art-max — it never
           scales with the card height (a tall card used to grow a huge square). */
        .art {
            grid-area: art; align-self: center;
            width: min(var(--feezal-glass-media-art-size, 45%), var(--feezal-glass-media-art-max, 140px), 100cqh - 20px);
            aspect-ratio: 1; max-width: 100%;
            border-radius: calc(var(--feezal-glass-radius, 24px) - 12px);
            background-size: cover; background-position: center;
            background-color: color-mix(in srgb, var(--feezal-glass-muted, rgba(29,29,31,0.55)) 18%, transparent);
        }
        .art.placeholder {
            display: flex; align-items: center; justify-content: center;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
        }
        .art.placeholder .mi { font-size: 32px; }
        .meta { grid-area: meta; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 1px; }
        .ctrl { grid-area: ctrl; min-width: 0; display: flex; flex-direction: column; gap: 2px; align-self: end; }
        .player {
            font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em;
            opacity: 0.75; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .title {
            font-size: var(--feezal-glass-font-size-title, 14px); font-weight: 600; line-height: 1.2;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .sub {
            font-size: var(--feezal-glass-font-size-label, 12px); line-height: 1.25;
            opacity: 0.8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        /* E189: tall card — two rows (cover + text above, controls across the
           full width below), the title may wrap to two lines. */
        @container (min-height: 230px) {
            .card { grid-template: 'art meta' auto 'ctrl ctrl' 1fr / auto minmax(0, 1fr); align-content: start; }
            .ctrl { align-self: start; gap: 4px; }
            .title { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        }
        .mi { font-family: 'Material Icons'; font-style: normal; font-weight: normal; line-height: 1; }
        .transport { display: flex; align-items: center; gap: 2px; margin-top: 4px; }
        .transport button, .details .transport button {
            display: flex; align-items: center; justify-content: center;
            border: none; background: transparent; color: inherit; cursor: pointer;
            padding: 3px; border-radius: 50%; line-height: 0;
        }
        .transport button:hover { background: rgba(128,128,128,0.22); }
        .transport .mi { font-size: 20px; }
        .transport .play .mi { font-size: 28px; }
        .transport .tgl.active { color: var(--feezal-glass-accent, var(--primary-color)); }
        .transport .spacer { flex: 1; }
        .vol-row { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
        .vol-row button { border: none; background: none; cursor: pointer; color: inherit; padding: 0; line-height: 0; }
        .vol-row .mi { font-size: 18px; }
        .vol-row .active { color: var(--feezal-glass-accent, var(--primary-color)); }
        .vol-row input[type="range"] { flex: 1; min-width: 0; accent-color: var(--feezal-glass-accent, var(--primary-color)); }
        .times { display: flex; justify-content: space-between; font-size: 10px; opacity: 0.75;
            font-variant-numeric: tabular-nums; }
        .bar { position: relative; height: 4px; border-radius: 2px; background: rgba(128,128,128,0.35); margin-top: 4px; cursor: pointer; }
        .bar-fill { position: absolute; top: 0; left: 0; bottom: 0; border-radius: 2px;
            background: var(--feezal-glass-accent, var(--primary-color)); }
        /* E186: source select + preset chips */
        .src-row { display: flex; align-items: center; gap: 6px; margin-top: 2px; min-width: 0; }
        .src-row .mi { font-size: 16px; opacity: 0.75; }
        .src-row select {
            flex: 1; min-width: 0; font: inherit; font-size: var(--feezal-glass-font-size-label, 12px);
            color: inherit; background: rgba(128,128,128,0.18); border: none; border-radius: 8px; padding: 2px 6px;
        }
        .presets { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }
        .presets button {
            border: none; cursor: pointer; color: inherit; font: inherit; font-size: 10px; line-height: 1;
            padding: 3px 7px; border-radius: 999px; background: rgba(128,128,128,0.18);
            max-width: 9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .presets button:hover { background: rgba(128,128,128,0.3); }
        /* E189: the details popup — the full control set, stacked. */
        .details { align-items: stretch; gap: 10px; }
        .details .art { width: 120px; margin: 0 auto; }
        .details .meta { text-align: center; align-items: center; }
        .details .transport { justify-content: center; }
        .details .ctrl { display: flex; flex-direction: column; gap: 6px; }
        .details .presets { justify-content: center; }
    `];

    constructor() {
        super();
        // No controller defaults assigned here on purpose — see CONTROLLER_PROPS.
        this.size = '';
        this.controls = 'standard';
        this.showArtwork = true;
        this.showAlbum = true;
        this.showProvider = true;
        this.showSeek = true;
        this.showShuffleRepeat = false;
        this.showVolume = true;
        this.showMute = true;
        this.showSource = true;
        this.showDetails = true;
        this.degrade = false;
        // E182: the behaviour layer — wiring, state, transport publishing.
        this.media = new MediaController(this);
    }

    // The controller owns every subscription (deduped per topic).
    _subscribe() { /* intentionally empty — MediaController.wire() */ }

    connectedCallback() {
        super.connectedCallback();
        // The tall layout queries the card's own height (cqh / @container).
        this.style.containerType = 'size';
    }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('size')) applySizePreset(this, MEDIA_SIZES);
        this.media.rewireIfChanged();
        // Promote the details popup into the top layer (system-pin pattern).
        if (changed.has('_details') && this._details) {
            const popup = this.renderRoot.querySelector('.details');
            if (popup?.showPopover && !popup.matches(':popover-open')) {
                try { popup.showPopover(); } catch { /* fixed+z-index fallback */ }
            }
        }
    }

    /** E189: the face's control set — the `controls` preset, vetoed by the show-* knobs. */
    get _face() {
        const f = FACE[this.controls] || FACE.standard;
        return {
            transport: f.transport,
            shuffleRepeat: f.shuffleRepeat && this.showShuffleRepeat,
            seek: f.seek && this.showSeek,
            volume: f.volume && this.showVolume,
            source: f.source && this.showSource,
            presets: f.presets && this.showSource,
        };
    }

    /** What the popup shows: everything allowed, whether or not it is on the face. */
    get _all() {
        return {
            transport: true,
            shuffleRepeat: this.showShuffleRepeat,
            seek: this.showSeek,
            volume: this.showVolume,
            source: this.showSource,
            presets: this.showSource,
        };
    }

    /** Something lives only in the popup → the ⋯ button has a reason to exist. */
    get _hasHidden() {
        const face = this._face, all = this._all, m = this.media;
        const wired = {
            shuffleRepeat: true, seek: Boolean(m.duration ?? m.position) || Boolean(this.getAttribute('subscribe-duration')),
            volume: true, source: m.hasSource, presets: m.presets.length > 0,
        };
        return Object.keys(wired).some(k => all[k] && wired[k] && !face[k]);
    }

    _seekTo(e) {
        const m = this.media;
        if (!m.duration || !this.getAttribute('publish-seek')) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        m.seek(frac * m.duration);
    }

    _artTpl(art) {
        return art
            ? html`<div class="art" style="background-image:url('${art}')"></div>`
            : html`<div class="art placeholder"><span class="mi">album</span></div>`;
    }

    _metaTpl({title, artist, album, provider}) {
        return html`
            <div class="meta">
                ${this.label ? html`<div class="player" title="${this.label}">${this.label}</div>` : ''}
                <div class="title" title="${title ?? ''}">${title ?? ''}</div>
                ${artist ? html`<div class="sub" title="${artist}">${artist}</div>` : ''}
                ${album ? html`<div class="sub" title="${album}">${album}</div>` : ''}
                ${provider ? html`<div class="sub provider" title="${provider}">${provider}</div>` : ''}
            </div>`;
    }

    /** The control stack — the face and the popup render the same pieces from a different set. */
    _ctrlTpl(set) {
        const m = this.media;
        const duration = m.duration ?? null;
        const pct = duration ? Math.max(0, Math.min(100, ((m.position ?? 0) / duration) * 100)) : 0;
        return html`
            <div class="ctrl">
                ${set.seek && duration ? html`
                    <div class="bar" @click="${this._seekTo}"><div class="bar-fill" style="width:${pct}%"></div></div>
                    <div class="times"><span>${fmtTime(m.position ?? 0)}</span><span>${fmtTime(duration)}</span></div>
                ` : ''}
                ${set.transport && m.hasTransport ? html`
                <div class="transport">
                    <button title="Previous" @click="${() => m.previous()}"><span class="mi">skip_previous</span></button>
                    <button class="play" title="Play/Pause" @click="${() => m.togglePlay()}">
                        <span class="mi">${m.isPlaying ? 'pause_circle' : 'play_circle'}</span>
                    </button>
                    <button title="Next" @click="${() => m.next()}"><span class="mi">skip_next</span></button>
                    ${set.shuffleRepeat ? html`
                        <span class="spacer"></span>
                        <button class="tgl ${m.shuffle ? 'active' : ''}" title="Shuffle"
                            @click="${() => m.toggleShuffle()}"><span class="mi">shuffle</span></button>
                        <button class="tgl ${m.repeat !== 'off' ? 'active' : ''}" title="Repeat: ${m.repeat}"
                            @click="${() => m.cycleRepeat()}">
                            <span class="mi">${m.repeat === 'one' ? 'repeat_one' : 'repeat'}</span>
                        </button>
                    ` : ''}
                </div>
                ` : ''}
                ${set.source && m.hasSource ? html`
                    <div class="src-row">
                        <span class="mi">input</span>
                        <select title="Source" .value="${m.source ?? ''}"
                            @change="${e => m.setSource(e.target.value)}">
                            ${m.source ? '' : html`<option value="" disabled selected>Source…</option>`}
                            ${m.sourceOptions.map(o => html`<option value="${o.value}" ?selected="${String(o.value) === String(m.source)}">${o.label}</option>`)}
                        </select>
                    </div>
                ` : ''}
                ${set.presets && m.presets.length ? html`
                    <div class="presets">
                        ${m.presets.map(p => html`<button title="Preset ${p.value}" @click="${() => m.playPreset(p.value)}">${p.label}</button>`)}
                    </div>
                ` : ''}
                ${set.volume ? html`
                    <div class="vol-row">
                        ${this.showMute ? html`
                            <button class="tgl mute ${m.muted ? 'active' : ''}" title="${m.muted ? 'Unmute' : 'Mute'}"
                                @click="${() => m.toggleMute()}">
                                <span class="mi">${m.muted ? 'volume_off' : 'volume_up'}</span>
                            </button>
                        ` : html`<span class="mi">volume_up</span>`}
                        <input type="range" min="0" max="100" step="1"
                            .value="${String(m.volume ?? (feezal.isEditor ? 60 : 0))}"
                            @pointerdown="${() => m.beginVolumeDrag()}"
                            @input="${e => m.setVolume(e.target.value)}"
                            @change="${e => m.setVolume(e.target.value, {commit: true})}"
                            @pointerup="${e => m.setVolume(e.target.value, {commit: true})}">
                    </div>
                ` : ''}
            </div>`;
    }

    _renderDetails(info, art) {
        return html`
            <div class="details" popover="manual">
                <div class="title">${this.label || info.title || 'Media'}</div>
                ${this.showArtwork ? this._artTpl(art) : ''}
                ${this._metaTpl(info)}
                ${this._ctrlTpl(this._all)}
            </div>`;
    }

    render() {
        const m = this.media;
        const title  = m.title  ?? (feezal.isEditor ? 'Song Title' : null);
        const artist = m.artist ?? (feezal.isEditor ? 'Artist' : null);
        // E182: album and source collapse to ONE line when identical.
        const {album, provider} = m.lines({showAlbum: this.showAlbum, showProvider: this.showProvider});
        const info = {title, artist, album, provider};
        const art = this.showArtwork ? m.artworkUrl : '';
        const details = this.showDetails && (this._hasHidden || feezal.isEditor)
            ? html`<button class="flip-btn" title="Details" @click="${e => { e.stopPropagation(); this.openDetails(); }}">more_horiz</button>`
            : '';

        return html`
            <div class="card">
                ${this.showArtwork ? this._artTpl(art) : ''}
                ${this._metaTpl(info)}
                ${this._ctrlTpl(this._face)}
                ${glassBadgeTray({unavailable: !this._available, details})}
            </div>
            ${this._details ? this._renderDetails(info, art) : ''}`;
    }
}

customElements.define('feezal-element-glass-media', FeezalElementGlassMedia);
export {FeezalElementGlassMedia, MEDIA_SIZES};

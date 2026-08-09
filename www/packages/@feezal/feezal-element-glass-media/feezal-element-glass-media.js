/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';
import {MediaController, mediaAttributes, mediaDiscoveryMap} from '@feezal/feezal-controller-media';
import {applySizePreset, glassCardStyles, glassBadgeTray} from '@feezal/feezal-glass';
import {availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';

/**
 * feezal-element-glass-media (E183)
 *
 * Frosted-glass now-playing card. All behaviour (subscription wiring incl.
 * per-topic dedupe, value coercion, the album/provider dedupe rule, transport
 * publishing, mute, the two command shapes) lives in
 * @feezal/feezal-controller-media — this is the glass VIEW: a small SQUARE
 * album cover on the left with the metadata and transport beside it (the
 * classic now-playing row, which is why the card defaults to twice its
 * height in width). `degrade` swaps the live blur for the solid card as
 * everywhere else in the family.
 *
 * The E180 Home.app interaction model (icon = main action, card = details
 * popup) is not implemented family-wide yet; when it lands, the secondary
 * controls here move into the popup and this card keeps only art, metadata and
 * play/pause.
 */

// Media size presets. 4x2 (wide) is the natural now-playing shape — square
// cover on the left, text and transport beside it — and matches defaultStyle.
const MEDIA_SIZES = {'4x2': [354, 172], '2x2': [172, 172], '4x1': [354, 86]};

const fmtTime = sec => {
    if (sec === null || sec === undefined || isNaN(+sec) || +sec < 0) return '0:00';
    const t = Math.floor(+sec);
    const m = Math.floor(t / 60);
    return `${m}:${String(t % 60).padStart(2, '0')}`;
};

const camel = n => n.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// The media contract is declared once by the controller — its ~40 topic and
// payload attributes become reflected properties programmatically so a new
// knob in the fragment cannot be forgotten here (subscribe and
// message-property are inherited from FeezalElement).
const CONTROLLER_PROPS = Object.fromEntries(
    mediaAttributes
        .filter(a => a.name !== 'subscribe' && a.name !== 'message-property')
        .map(a => [camel(a.name), {type: String, reflect: true, attribute: a.name}]));

class FeezalElementGlassMedia extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Media', category: 'Glass', color: '#7aa5c9', icon: 'music_note'},
            description: 'Frosted-glass now-playing card — album art, track / artist / album / source, ' +
                'transport controls, mute and volume. Album and source collapse to one line when they carry ' +
                'the same text. Autodiscovers Echo devices (echo2mqtt) and any bridge speaking the media contract.',
            discovery: {component: 'media', map: mediaDiscoveryMap},
            attributes: [
                {name: 'size', type: 'select', options: ['', '4x2', '2x2', '4x1'], default: '',
                    help: 'Preset size: 4x2 = wide (the default shape — square art beside the text), 2x2 = square, 4x1 = compact bar. Empty keeps the current/manual size.'},
                // E182: the whole media MQTT contract — one declaration, every family.
                ...mediaAttributes,
                ...availabilityAttributes(),
                {name: 'show-artwork',  type: 'boolean', default: true, help: 'Show the square album cover on the left.'},
                {name: 'show-album',    type: 'boolean', default: true, help: 'Show the album name.'},
                {name: 'show-provider', type: 'boolean', default: true, help: 'Show the playback source / provider. When it is identical to the album, only one of the two lines is rendered.'},
                {name: 'show-seek',     type: 'boolean', default: false, help: 'Show the progress bar with elapsed / total time.'},
                {name: 'show-shuffle-repeat', type: 'boolean', default: false, help: 'Show the shuffle and repeat controls.'},
                {name: 'show-volume',   type: 'boolean', default: true, help: 'Show the volume slider row.'},
                {name: 'show-mute',     type: 'boolean', default: true, help: 'Show the mute button in the volume row.'},
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-media-art-size', default: '45%',
                    help: 'Maximum width of the square album cover on the left, as a share of the card (default 45%).'},
                {property: '--feezal-glass-font-size-title', default: '14px', help: 'Track title font size.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Artist / album / source font size.'},
            ],
            defaultStyle: {width: '354px', height: '172px'},
            restrict: {minWidth: 120, minHeight: 96},
        };
    }

    static properties = {
        ...CONTROLLER_PROPS,
        size:          {type: String,  reflect: true},
        showArtwork:   {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-artwork'},
        showAlbum:     {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-album'},
        showProvider:  {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-provider'},
        showSeek:      {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-seek'},
        showShuffleRepeat: {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-shuffle-repeat'},
        showVolume:    {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-volume'},
        showMute:      {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-mute'},
        degrade:       {type: Boolean, reflect: true, converter: feezalBoolean},
    };

    static styles = [feezalBaseStyles, glassCardStyles, css`
        /* Requested layout (08/2026): a SMALL SQUARE album cover on the left,
           the metadata and controls beside it — the classic now-playing row,
           and the reason the default card is twice as wide as it is tall. */
        .card { padding: 10px; overflow: hidden; flex-direction: row; align-items: stretch; gap: 10px; }
        :host([degrade]) .card {
            -webkit-backdrop-filter: none; backdrop-filter: none;
            background: var(--feezal-glass-solid, rgba(255,255,255,0.82));
        }
        .art {
            flex: 0 0 auto; align-self: center;
            height: 100%; aspect-ratio: 1; max-width: var(--feezal-glass-media-art-size, 45%);
            border-radius: calc(var(--feezal-glass-radius, 24px) - 12px);
            background-size: cover; background-position: center;
            background-color: color-mix(in srgb, var(--feezal-glass-muted, rgba(29,29,31,0.55)) 18%, transparent);
        }
        .art.placeholder {
            display: flex; align-items: center; justify-content: center;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
        }
        .art.placeholder .mi { font-size: 32px; }
        .content {
            flex: 1 1 auto; min-width: 0;
            display: flex; flex-direction: column; justify-content: center; gap: 1px;
        }
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
        .mi { font-family: 'Material Icons'; font-style: normal; font-weight: normal; line-height: 1; }
        .transport { display: flex; align-items: center; gap: 2px; margin-top: 4px; }
        .transport button {
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
        .vol-row input[type="range"] { flex: 1; min-width: 0; accent-color: var(--feezal-glass-accent, var(--primary-color)); }
        .times { display: flex; justify-content: space-between; font-size: 10px; opacity: 0.75;
            font-variant-numeric: tabular-nums; }
        .bar { position: relative; height: 4px; border-radius: 2px; background: rgba(128,128,128,0.35); margin-top: 4px; }
        .bar-fill { position: absolute; top: 0; left: 0; bottom: 0; border-radius: 2px;
            background: var(--feezal-glass-accent, var(--primary-color)); }
    `];

    constructor() {
        super();
        for (const a of mediaAttributes) {
            if (a.name === 'subscribe' || a.name === 'message-property') continue;
            this[camel(a.name)] = a.default !== undefined ? String(a.default) : '';
        }
        this.size = '';
        this.showArtwork = true;
        this.showAlbum = true;
        this.showProvider = true;
        this.showSeek = false;
        this.showShuffleRepeat = false;
        this.showVolume = true;
        this.showMute = true;
        this.degrade = false;
        // E182: the behaviour layer — wiring, state, transport publishing.
        this.media = new MediaController(this);
    }

    // The controller owns every subscription (deduped per topic).
    _subscribe() { /* intentionally empty — MediaController.wire() */ }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('size')) applySizePreset(this, MEDIA_SIZES);
        this.media.rewireIfChanged();
    }

    render() {
        const m = this.media;
        const title  = m.title  ?? (feezal.isEditor ? 'Song Title' : null);
        const artist = m.artist ?? (feezal.isEditor ? 'Artist' : null);
        // E182: album and source collapse to ONE line when identical.
        const {album, provider} = m.lines({showAlbum: this.showAlbum, showProvider: this.showProvider});
        const art = this.showArtwork ? m.artworkUrl : '';
        const duration = m.duration ?? null;
        const pct = duration ? Math.max(0, Math.min(100, ((m.position ?? 0) / duration) * 100)) : 0;

        return html`
            <div class="card">
                ${this.showArtwork ? (art
                    ? html`<div class="art" style="background-image:url('${art}')"></div>`
                    : html`<div class="art placeholder"><span class="mi">album</span></div>`) : ''}
                <div class="content">
                    ${this.label ? html`<div class="player" title="${this.label}">${this.label}</div>` : ''}
                    <div class="title" title="${title ?? ''}">${title ?? ''}</div>
                    ${artist ? html`<div class="sub" title="${artist}">${artist}</div>` : ''}
                    ${album ? html`<div class="sub" title="${album}">${album}</div>` : ''}
                    ${provider ? html`<div class="sub provider" title="${provider}">${provider}</div>` : ''}

                    ${this.showSeek && duration ? html`
                        <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
                        <div class="times"><span>${fmtTime(m.position ?? 0)}</span><span>${fmtTime(duration)}</span></div>
                    ` : ''}

                    <div class="transport">
                        <button title="Previous" @click="${() => m.previous()}"><span class="mi">skip_previous</span></button>
                        <button class="play" title="Play/Pause" @click="${() => m.togglePlay()}">
                            <span class="mi">${m.isPlaying ? 'pause_circle' : 'play_circle'}</span>
                        </button>
                        <button title="Next" @click="${() => m.next()}"><span class="mi">skip_next</span></button>
                        ${this.showShuffleRepeat ? html`
                            <span class="spacer"></span>
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
                                    style="border:none;background:none;cursor:pointer;color:inherit;padding:0;line-height:0"
                                    @click="${() => m.toggleMute()}">
                                    <span class="mi" style="font-size:18px">${m.muted ? 'volume_off' : 'volume_up'}</span>
                                </button>
                            ` : html`<span class="mi" style="font-size:18px">volume_up</span>`}
                            <input type="range" min="0" max="100" step="1"
                                .value="${String(m.volume ?? (feezal.isEditor ? 60 : 0))}"
                                @input="${e => m.setVolume(e.target.value)}">
                        </div>
                    ` : ''}
                </div>
                ${glassBadgeTray({unavailable: this.unavailable})}
            </div>`;
    }
}

customElements.define('feezal-element-glass-media', FeezalElementGlassMedia);
export {FeezalElementGlassMedia};

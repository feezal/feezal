/* global feezal */
import {feezalBoolean, html, css} from '@feezal/feezal-element';
import {MetroTileBase} from '@feezal/feezal-metro';

/**
 * feezal-element-metro-media (E55)
 *
 * Media tile: track + artist on the front, front tap = play/pause; the back
 * holds prev/play/next transport buttons and, when configured, a volume
 * slider. Transport commands publish configurable payloads to one topic.
 */
class FeezalElementMetroMedia extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Media', category: 'Metro', color: '#1ba1e2', icon: 'play_circle'},
            description: 'Metro media tile: track/artist front (tap = play/pause), transport + volume on the back. ' +
                'Autodiscovers Echo devices (echo2mqtt) and any bridge speaking the media contract.',
            // E182: the media discovery contract. The tile keeps its own thinner
            // attribute set (no album/provider/artwork surface), so it carries its
            // OWN map instead of the controller fragment — the recognizer config
            // keys are identical, only the targets differ.
            discovery: {
                component: 'media',
                map: {
                    name:                 'label',
                    title_topic:          {attr: 'subscribe'},
                    title_value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
                    artist_topic:          'subscribe-artist',
                    artist_value_template: {attr: 'message-property-artist', transform: 'valueTemplateToPath'},
                    artwork_topic:          'subscribe-artwork-url',
                    artwork_value_template: {attr: 'message-property-artwork-url', transform: 'valueTemplateToPath'},
                    state_topic:           'subscribe-state',
                    state_value_template:  {attr: 'message-property-state', transform: 'valueTemplateToPath'},
                    command_topic:         'publish',
                    command_mode:          'command-mode',
                    payload_play:          'payload-play',
                    payload_pause:         'payload-pause',
                    payload_next:          'payload-next',
                    payload_previous:      'payload-prev',
                    volume_topic:          'subscribe-volume',
                    volume_command_topic:  'publish-volume',
                },
            },
            attributes: [
                ...MetroTileBase.tileAttributes,
                {name: 'subscribe', type: 'mqttTopic', help: 'Track title topic.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path within title messages. Default: payload'},
                {name: 'subscribe-artist', type: 'mqttTopic', help: 'Artist topic.'},
                {name: 'message-property-artist', type: 'string', default: 'payload',
                    help: 'Dot-notation path within artist messages. Default: payload'},
                {name: 'subscribe-artwork-url', type: 'mqttTopic', help: 'Topic carrying the album-art image URL. The cover fills the tile behind the track text (Metro live-tile style).'},
                {name: 'message-property-artwork-url', type: 'string', default: 'payload',
                    help: 'Dot-notation path within artwork messages. Default: payload'},
                {name: 'artwork-url', type: 'string', default: '',
                    help: 'Static album-art image URL, used until an artwork message arrives.'},
                {name: 'show-artwork', type: 'boolean', default: true,
                    help: 'Show the album art as the tile background (the text sits on a scrim over it).'},
                {name: 'subscribe-state', type: 'mqttTopic', help: 'Playback state topic (payload-playing marks the playing state).'},
                {name: 'message-property-state', type: 'string', default: 'payload',
                    help: 'Dot-notation path within state messages. Default: payload'},
                {name: 'payload-playing', type: 'string', default: 'playing', help: 'State payload meaning "playing".'},
                {name: 'publish', type: 'mqttTopic', help: 'Transport command topic. With command mode "topic" this is the BASE topic and the action name is appended as the last segment.'},
                {name: 'command-mode', type: 'select', options: ['payload', 'topic'], default: 'payload',
                    help: 'How transport commands are sent. payload = one topic, the action payload below (default). topic = the action name is appended to the command topic (e.g. echo/set/Kitchen + /play), which is what bridges with one topic per command expect.'},
                {name: 'payload-play-pause', type: 'string', default: 'play_pause', help: 'Payload for play/pause (front tap + back ⏯). Ignored when separate play/pause payloads are set.'},
                {name: 'payload-play', type: 'string', default: '', help: 'Optional separate play payload. Set (together with payload-pause) for bridges that have no combined toggle — the tile then sends play or pause depending on the current state.'},
                {name: 'payload-pause', type: 'string', default: '', help: 'Optional separate pause payload. See payload-play.'},
                {name: 'payload-next', type: 'string', default: 'next', help: 'Payload for next track.'},
                {name: 'payload-prev', type: 'string', default: 'previous', help: 'Payload for previous track.'},
                {name: 'subscribe-volume', type: 'mqttTopic', help: 'Volume state topic (0–100).'},
                {name: 'message-property-volume', type: 'string', default: 'payload',
                    help: 'Dot-notation path within volume messages. Default: payload'},
                {name: 'publish-volume', type: 'mqttTopic', help: 'Volume command topic (enables the back slider).'},
            ],
            styles: MetroTileBase.tileStyles,
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '310px', height: '150px'},
        };
    }

    static properties = {
        subArtist:     {type: String, reflect: true, attribute: 'subscribe-artist'},
        msgPropArtist: {type: String, reflect: true, attribute: 'message-property-artist'},
        subArtwork:    {type: String, reflect: true, attribute: 'subscribe-artwork-url'},
        msgPropArtwork: {type: String, reflect: true, attribute: 'message-property-artwork-url'},
        artworkUrl:    {type: String, reflect: true, attribute: 'artwork-url'},
        showArtwork:   {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-artwork'},
        subState:      {type: String, reflect: true, attribute: 'subscribe-state'},
        msgPropState:  {type: String, reflect: true, attribute: 'message-property-state'},
        payloadPlaying: {type: String, reflect: true, attribute: 'payload-playing'},
        publish:        {type: String, reflect: true},
        commandMode:      {type: String, reflect: true, attribute: 'command-mode'},
        payloadPlayPause: {type: String, reflect: true, attribute: 'payload-play-pause'},
        payloadPlay:      {type: String, reflect: true, attribute: 'payload-play'},
        payloadPause:     {type: String, reflect: true, attribute: 'payload-pause'},
        payloadNext:      {type: String, reflect: true, attribute: 'payload-next'},
        payloadPrev:      {type: String, reflect: true, attribute: 'payload-prev'},
        subVolume:     {type: String, reflect: true, attribute: 'subscribe-volume'},
        msgPropVolume: {type: String, reflect: true, attribute: 'message-property-volume'},
        pubVolume:     {type: String, reflect: true, attribute: 'publish-volume'},
        _title:  {state: true},
        _artwork: {state: true},
        _artist: {state: true},
        _playing: {state: true},
        _volume:  {state: true},
    };

    static styles = [MetroTileBase.styles, css`
        /* Album art as the live-tile background — the Metro way: full-bleed
           cover with a scrim so the accent-coloured text stays readable.
           The art renders inside the .center box, which stops 18px above the
           tile bottom to leave the label strip free — the negative bottom
           inset stretches the cover back over the whole face. Its siblings
           are static, which would paint UNDER a positioned box, so they are
           lifted onto their own layer. */
        .art {
            position: absolute; inset: 0 0 -18px 0; z-index: 0;
            background-size: cover; background-position: center;
        }
        .art::after {
            content: ''; position: absolute; inset: 0;
            background: linear-gradient(transparent 30%, rgba(0, 0, 0, 0.55));
        }
        .center > :not(.art) { position: relative; z-index: 1; }
        .track { font-size: 16px; font-weight: 600; max-width: 92%; text-align: center;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .artist { font-size: var(--_metro-unit-size); opacity: 0.85; max-width: 92%;   /* E129 */
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .transport { display: flex; justify-content: center; gap: 8px; }
        .transport .mbtn { flex: 1 1 0; font-size: 18px; padding: 4px 12px; }   /* E136: full-width segments */
    `];

    constructor() {
        super();
        this.subArtist = '';
        this.msgPropArtist = '';
        this.subArtwork = '';
        this.msgPropArtwork = '';
        this.artworkUrl = '';
        this.showArtwork = true;
        this._artwork = '';
        this.subState = '';
        this.msgPropState = '';
        this.payloadPlaying = 'playing';
        this.publish = '';
        this.commandMode = 'payload';
        this.payloadPlayPause = 'play_pause';
        this.payloadPlay = '';
        this.payloadPause = '';
        this.payloadNext = 'next';
        this.payloadPrev = 'previous';
        this.subVolume = '';
        this.msgPropVolume = '';
        this.pubVolume = '';
        this._title = '';
        this._artist = '';
        this._playing = false;
        this._volume = null;
    }

    connectedCallback() {
        super.connectedCallback();
        const sub = (topic, cb) => { if (topic) this.addSubscription(topic, cb); };
        sub(this.subscribe, msg => {
            const v = this.getProperty(msg, this.messageProperty);
            this._title = v === null || v === undefined ? '' : String(v);
        });
        sub(this.subArtist, msg => {
            const v = this.getProperty(msg, this.msgPropArtist || this.messageProperty);
            this._artist = v === null || v === undefined ? '' : String(v);
        });
        sub(this.subArtwork, msg => {
            const v = this.getProperty(msg, this.msgPropArtwork || this.messageProperty);
            this._artwork = v === null || v === undefined ? '' : String(v);
        });
        sub(this.subState, msg => {
            const v = this.getProperty(msg, this.msgPropState || this.messageProperty);
            // Case-insensitive: bridges differ (PLAYING / playing / Playing).
            this._playing = String(v ?? '').toLowerCase() === String(this.payloadPlaying ?? '').toLowerCase();
        });
        sub(this.subVolume, msg => {
            const v = Number(this.getProperty(msg, this.msgPropVolume || this.messageProperty));
            if (!isNaN(v)) this._volume = v;
        });
    }

    /**
     * Publish one transport action. In `payload` mode the payload goes to the
     * command topic; in `topic` mode it becomes the last topic segment — the
     * shape one-topic-per-command bridges (echo2mqtt) expect.
     */
    _transport(payload) {
        if (feezal.isEditor || !this.publish || !payload) return;
        if (this.commandMode === 'topic') {
            feezal.connection.pub(`${this.publish}/${payload}`, payload);
        } else {
            feezal.connection.pub(this.publish, payload);
        }
    }

    /** Front tap / ⏯: the combined toggle payload, or the separate play/pause
     * pair when the bridge has no toggle (then the current state decides). */
    _playPause() {
        if (this.payloadPlay || this.payloadPause) {
            this._transport(this._playing ? (this.payloadPause || this.payloadPlay)
                : (this.payloadPlay || this.payloadPause));
            return;
        }
        this._transport(this.payloadPlayPause);
    }

    _setVolume(v) {
        if (feezal.isEditor) return;
        this._volume = Number(v);
        if (this.pubVolume) feezal.connection.pub(this.pubVolume, String(v));
    }

    baseAction() {
        this._playPause();
    }

    /** Effective cover: a live topic value wins over the static attribute. */
    get _cover() {
        return this.showArtwork ? (this._artwork || this.artworkUrl || '') : '';
    }

    renderFront() {
        const art = this._cover;
        return html`
            ${art ? html`<div class="art" style="background-image:url('${art}')"></div>` : ''}
            <feezal-icon name="${this._playing ? 'pause_circle' : 'play_circle'}"></feezal-icon>
            <div class="track">${this._title || (feezal.isEditor && !this.subscribe ? 'Track title' : '')}</div>
            ${this._artist ? html`<div class="artist">${this._artist}</div>` : ''}`;
    }

    renderBack() {
        return html`
            <div class="transport">
                <button class="mbtn" title="Previous" @click="${() => this._transport(this.payloadPrev)}">⏮</button>
                <button class="mbtn" title="Play/pause" @click="${() => this._playPause()}">${this._playing ? '⏸' : '⏵'}</button>
                <button class="mbtn" title="Next" @click="${() => this._transport(this.payloadNext)}">⏭</button>
            </div>
            ${this.pubVolume || this.subVolume ? html`
                <div class="rowline">
                    <feezal-icon name="volume_up"></feezal-icon>
                    <input type="range" min="0" max="100" step="1"
                        .value="${String(this._volume ?? 50)}"
                        @change="${e => this._setVolume(e.target.value)}">
                </div>` : ''}`;
    }
}

customElements.define('feezal-element-metro-media', FeezalElementMetroMedia);
export {FeezalElementMetroMedia};

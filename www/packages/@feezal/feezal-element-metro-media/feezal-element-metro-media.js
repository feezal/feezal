/* global feezal */
import {html, css} from '@feezal/feezal-element';
import {MetroTileBase} from '@feezal/feezal-element-metro-tile';

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
            description: 'Metro media tile: track/artist front (tap = play/pause), transport + volume on the back.',
            attributes: [
                ...MetroTileBase.tileAttributes,
                {name: 'subscribe', type: 'mqttTopic', help: 'Track title topic.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path within title messages. Default: payload'},
                {name: 'subscribe-artist', type: 'mqttTopic', help: 'Artist topic.'},
                {name: 'message-property-artist', type: 'string', default: 'payload',
                    help: 'Dot-notation path within artist messages. Default: payload'},
                {name: 'subscribe-state', type: 'mqttTopic', help: 'Playback state topic (payload-playing marks the playing state).'},
                {name: 'message-property-state', type: 'string', default: 'payload',
                    help: 'Dot-notation path within state messages. Default: payload'},
                {name: 'payload-playing', type: 'string', default: 'playing', help: 'State payload meaning "playing".'},
                {name: 'publish', type: 'mqttTopic', help: 'Transport command topic.'},
                {name: 'payload-play-pause', type: 'string', default: 'play_pause', help: 'Payload for play/pause (front tap + back ⏯).'},
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
        subState:      {type: String, reflect: true, attribute: 'subscribe-state'},
        msgPropState:  {type: String, reflect: true, attribute: 'message-property-state'},
        payloadPlaying: {type: String, reflect: true, attribute: 'payload-playing'},
        publish:        {type: String, reflect: true},
        payloadPlayPause: {type: String, reflect: true, attribute: 'payload-play-pause'},
        payloadNext:      {type: String, reflect: true, attribute: 'payload-next'},
        payloadPrev:      {type: String, reflect: true, attribute: 'payload-prev'},
        subVolume:     {type: String, reflect: true, attribute: 'subscribe-volume'},
        msgPropVolume: {type: String, reflect: true, attribute: 'message-property-volume'},
        pubVolume:     {type: String, reflect: true, attribute: 'publish-volume'},
        _title:  {state: true},
        _artist: {state: true},
        _playing: {state: true},
        _volume:  {state: true},
    };

    static styles = [MetroTileBase.styles, css`
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
        this.subState = '';
        this.msgPropState = '';
        this.payloadPlaying = 'playing';
        this.publish = '';
        this.payloadPlayPause = 'play_pause';
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
        sub(this.subState, msg => {
            const v = this.getProperty(msg, this.msgPropState || this.messageProperty);
            this._playing = String(v) === this.payloadPlaying;
        });
        sub(this.subVolume, msg => {
            const v = Number(this.getProperty(msg, this.msgPropVolume || this.messageProperty));
            if (!isNaN(v)) this._volume = v;
        });
    }

    _transport(payload) {
        if (feezal.isEditor) return;
        if (this.publish) feezal.connection.pub(this.publish, payload);
    }

    _setVolume(v) {
        if (feezal.isEditor) return;
        this._volume = Number(v);
        if (this.pubVolume) feezal.connection.pub(this.pubVolume, String(v));
    }

    baseAction() {
        this._transport(this.payloadPlayPause);
    }

    renderFront() {
        return html`
            <feezal-icon name="${this._playing ? 'pause_circle' : 'play_circle'}"></feezal-icon>
            <div class="track">${this._title || (feezal.isEditor && !this.subscribe ? 'Track title' : '')}</div>
            ${this._artist ? html`<div class="artist">${this._artist}</div>` : ''}`;
    }

    renderBack() {
        return html`
            <div class="transport">
                <button class="mbtn" title="Previous" @click="${() => this._transport(this.payloadPrev)}">⏮</button>
                <button class="mbtn" title="Play/pause" @click="${() => this._transport(this.payloadPlayPause)}">${this._playing ? '⏸' : '⏵'}</button>
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

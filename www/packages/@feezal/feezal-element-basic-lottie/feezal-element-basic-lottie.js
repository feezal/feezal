/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {loadLottie} from '@feezal/feezal-lottie';

/**
 * feezal-element-basic-lottie (E89) — plays a Lottie vector animation, with
 * playback driven by MQTT.
 *
 * The lottie-web library is lazy-loaded through the shared `@feezal/feezal-lottie`
 * loader: the ~250 kB dependency is a dynamic Rollup chunk fetched only when a
 * viewer actually has an animation to show (a `src`, or a `map`-driven src
 * swap). The editor renders a static film-strip placeholder and NEVER loads the
 * library.
 *
 * MQTT drives playback two ways, checked in this order:
 *   1. `map` — value → clip descriptor. A matched payload seeks/plays a frame
 *      segment (optionally overriding loop/speed) or swaps `src` entirely.
 *   2. transport payloads — `payload-play` / `payload-pause` / `payload-stop`.
 * Unmatched payloads are ignored.
 *
 * A `src` change (attribute or map-driven) destroys and re-creates the lottie
 * instance; a ResizeObserver keeps the animation scaled to the element box; the
 * instance is destroyed on disconnect (popup / view-switch safety). A broken or
 * missing `src` shows a subtle placeholder and never throws.
 */
class FeezalElementBasicLottie extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Lottie', category: 'Basic', color: '#4a6080', icon: 'animation'},
            description: 'Plays a Lottie vector animation (weather glyphs, alert/attention states, ' +
                '"working" spinners, playful status characters). Playback is MQTT-driven: transport ' +
                'commands (play/pause/stop) and a value→segment map that seeks clips or swaps the ' +
                'animation. The lottie-web library is lazy-loaded only when a dashboard uses the element.',
            attributes: [
                {name: 'src', type: 'string',
                    help: 'Animation JSON URL (upload via the Asset Manager, e.g. assets/weather.json).'},
                {name: 'subscribe', type: 'mqttTopic',
                    help: 'Topic whose payload drives playback (map clips and transport commands).'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'payload-play', type: 'string', default: 'play',
                    help: 'Payload value that plays/resumes the animation (checked after the map).'},
                {name: 'payload-pause', type: 'string', default: 'pause',
                    help: 'Payload value that pauses the animation (checked after the map).'},
                {name: 'payload-stop', type: 'string', default: 'stop',
                    help: 'Payload value that stops the animation and returns it to the first frame (checked after the map).'},
                {name: 'map', type: 'json', default: '{}',
                    help: 'Value → clip descriptor, checked BEFORE the transport payloads; unmatched values are ignored. ' +
                        'Example: {"sunny":{"segment":[0,60]}, "rain":{"segment":[61,120],"loop":true}, "storm":{"src":"storm.json"}}. ' +
                        'A matched payload seeks/plays that frame segment (optionally overriding "loop"/"speed"), or swaps "src" entirely.'},
                {name: 'autoplay', type: 'boolean', default: true,
                    help: 'Start playing as soon as the animation loads.'},
                {name: 'loop', type: 'boolean', default: true,
                    help: 'Loop the animation continuously (a map clip may override this per value).'},
                {name: 'speed', type: 'number', default: '1', step: 0.1,
                    help: 'Playback speed multiplier (1 = normal; a map clip may override this per value).'}
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-lottie-background', type: 'color', default: 'transparent',
                    help: 'Background colour behind the animation (default transparent).'}
            ],
            restrict: {minWidth: 24, minHeight: 24},
            defaultStyle: {width: '120px', height: '120px'}
        };
    }

    static properties = {
        src:          {type: String,  reflect: true},
        payloadPlay:  {type: String,  reflect: true, attribute: 'payload-play'},
        payloadPause: {type: String,  reflect: true, attribute: 'payload-pause'},
        payloadStop:  {type: String,  reflect: true, attribute: 'payload-stop'},
        map:          {type: String,  attribute: 'map'},
        autoplay:     {type: Boolean, reflect: true},
        loop:         {type: Boolean, reflect: true},
        speed:        {type: Number,  reflect: true},
        _broken:      {state: true}
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: block;
            box-sizing: border-box;
            position: relative;
            background: var(--feezal-lottie-background, transparent);
        }
        .stage, .stage svg { width: 100%; height: 100%; display: block; }
        .stage[hidden] { display: none; }
        /* Subtle placeholder — broken/missing src (viewer) and the editor chip. */
        .placeholder {
            position: absolute; inset: 0;
            display: flex; align-items: center; justify-content: center; gap: 6px;
            box-sizing: border-box; padding: 4px;
            font-size: 12px; color: var(--secondary-text-color, #888);
            border: 1px dashed var(--divider-color, #bbb); border-radius: 6px;
            background: color-mix(in srgb, var(--secondary-text-color, #888) 6%, transparent);
            user-select: none;
        }
        .placeholder .glyph {
            flex: none; width: 20px; height: 14px; border-radius: 2px;
            border: 1px solid currentColor;
            background:
                repeating-linear-gradient(to right, currentColor 0 2px, transparent 2px 5px) top/100% 3px no-repeat,
                repeating-linear-gradient(to right, currentColor 0 2px, transparent 2px 5px) bottom/100% 3px no-repeat;
            opacity: 0.7;
        }
    `];

    constructor() {
        super();
        this.src = '';
        this.payloadPlay = 'play';
        this.payloadPause = 'pause';
        this.payloadStop = 'stop';
        this.map = '{}';
        this.autoplay = true;
        this.loop = true;
        this.speed = 1;
        this._broken = false;
        // Non-reactive runtime state.
        this._anim = null;        // current lottie AnimationItem
        this._activeSrc = null;   // src currently loaded into _anim
        this._mapSrc = null;      // src override from a map clip (null = use this.src)
        this._pendingClip = null; // clip to apply once the (re)load finishes
        this._loadToken = 0;      // guards against races between overlapping reloads
        this._msgSub = false;
        this._resizeObserver = null;
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    connectedCallback() {
        super.connectedCallback();
        // Editor mode is a static placeholder: never subscribe, never load lib.
        if (feezal.isEditor) {
            return;
        }
        if (this.subscribe && !this._msgSub) {
            this._msgSub = true;
            this.addSubscription(this.subscribe, msg => this._onMessage(msg));
        }
        if (typeof ResizeObserver !== 'undefined' && !this._resizeObserver) {
            this._resizeObserver = new ResizeObserver(() => {
                try {
                    this._anim?.resize();
                } catch { /* ignore */ }
            });
            this._resizeObserver.observe(this);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();   // releases MQTT subscriptions
        this._msgSub = false;
        this._destroyAnim();
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
    }

    updated(changed) {
        super.updated(changed);
        if (feezal.isEditor) {
            return;
        }
        if (changed.has('src') && this._effectiveSrc() !== this._activeSrc) {
            this._reload();
        }
        if (changed.has('loop')) {
            try {
                this._anim?.setLoop(this.loop);
            } catch { /* ignore */ }
        }
        if (changed.has('speed')) {
            try {
                this._anim?.setSpeed(Number(this.speed) || 1);
            } catch { /* ignore */ }
        }
    }

    // ── MQTT handling ────────────────────────────────────────────────────────

    _parsedMap() {
        try {
            const obj = JSON.parse(this.map || '{}');
            return obj && typeof obj === 'object' ? obj : {};
        } catch {
            return {};
        }
    }

    _onMessage(msg) {
        const value = this.getProperty(msg, this.messageProperty);
        if (value === undefined || value === null) {
            return;
        }
        const key = String(value);

        // 1. map — checked BEFORE the transport payloads.
        const clip = this._parsedMap()[key];
        if (clip && typeof clip === 'object') {
            this._handleClip(clip);
            return;
        }

        // 2. transport payloads.
        if (key === this.payloadPlay) {
            this._anim?.play();
        } else if (key === this.payloadPause) {
            this._anim?.pause();
        } else if (key === this.payloadStop) {
            this._anim?.stop();
        }
        // 3. unmatched → ignored.
    }

    _handleClip(clip) {
        if (clip.src) {
            // Swap src entirely — destroys + recreates, then applies the clip.
            if (clip.src !== this._activeSrc) {
                this._mapSrc = clip.src;
                this._pendingClip = clip;
                this._reload();
                return;
            }
            // Same src already loaded — just apply the segment/overrides.
        }
        this._applyClip(clip);
    }

    _applyClip(clip) {
        if (!this._anim) {
            this._pendingClip = clip;   // apply once the animation is ready
            return;
        }
        try {
            if (typeof clip.loop === 'boolean') {
                this._anim.setLoop(clip.loop);
            }
            if (typeof clip.speed === 'number') {
                this._anim.setSpeed(clip.speed);
            }
            if (Array.isArray(clip.segment) && clip.segment.length === 2) {
                this._anim.playSegments([Number(clip.segment[0]), Number(clip.segment[1])], true);
            } else if (!clip.src) {
                // A src-only swap already autoplays; a bare clip just plays.
                this._anim.play();
            }
        } catch { /* a malformed clip must never throw */ }
    }

    // ── Animation instance ───────────────────────────────────────────────────

    _effectiveSrc() {
        return this._mapSrc || this.src || '';
    }

    _destroyAnim() {
        if (this._anim) {
            try {
                this._anim.destroy();
            } catch { /* ignore */ }
            this._anim = null;
        }
        this._activeSrc = null;
    }

    async _reload() {
        if (feezal.isEditor) {
            return;
        }
        this._destroyAnim();
        this._broken = false;
        const src = this._effectiveSrc();
        if (!src) {
            return;
        }
        const token = ++this._loadToken;

        let lottie;
        try {
            lottie = await loadLottie();
        } catch {
            this._broken = true;
            return;
        }
        // Superseded by a newer reload, or the element was detached mid-load.
        if (token !== this._loadToken || !this.isConnected) {
            return;
        }
        const container = this.renderRoot?.querySelector('.stage');
        if (!container) {
            return;
        }
        const path = (feezal.resolveAsset ? feezal.resolveAsset(src) : src);
        try {
            const anim = lottie.loadAnimation({
                container,
                renderer: 'svg',
                loop: this.loop,
                autoplay: this.autoplay,
                path
            });
            this._anim = anim;
            this._activeSrc = src;
            try {
                anim.setSpeed(Number(this.speed) || 1);
            } catch { /* ignore */ }
            // A broken/missing asset resolves to a placeholder, never a throw.
            anim.addEventListener('data_failed', () => {
                this._broken = true;
                this._destroyAnim();
                this.requestUpdate();
            });
            anim.addEventListener('DOMLoaded', () => {
                this._broken = false;
                this.requestUpdate();
            });
            if (this._pendingClip) {
                const clip = this._pendingClip;
                this._pendingClip = null;
                this._applyClip(clip);
            }
        } catch {
            this._broken = true;
        }
        this.requestUpdate();
    }

    render() {
        if (feezal.isEditor) {
            return html`<div class="placeholder"><span class="glyph"></span> Lottie</div>`;
        }
        const showPlaceholder = this._broken || !this._effectiveSrc();
        return html`
            <div class="stage" ?hidden=${showPlaceholder}></div>
            ${showPlaceholder
                ? html`<div class="placeholder"><span class="glyph"></span> Lottie</div>`
                : ''}
        `;
    }
}

window.customElements.define('feezal-element-basic-lottie', FeezalElementBasicLottie);

export {FeezalElementBasicLottie};

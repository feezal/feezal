/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

// ── Element ───────────────────────────────────────────────────────────────────
class FeezalElementMaterialCamera extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Camera', category: 'Device', color: '#1565c0', icon: 'videocam'},
            description: 'Camera feed element — embeds an MJPEG stream, HLS video, or periodically-refreshed image. Subscribe to an MQTT topic to switch the source URL dynamically.',
            discovery: {
                component: 'camera',
                map: {
                    topic: {attr: 'src'},
                    name:  'label',
                },
            },
            attributes: [
                {name: 'src',            type: 'string',    default: '',       help: 'Camera feed URL (MJPEG stream, HLS playlist, or image URL).'},
                {name: 'subscribe',      type: 'mqttTopic',                    help: 'MQTT topic that publishes the image or stream URL. Overrides `src` when a message is received. Also serves as the base topic for dynamic attribute overrides via `<subscribe>/#`.'},
                {name: 'type',           type: 'select',    options: ['mjpeg', 'hls', 'image'], default: 'mjpeg',
                    help: 'Feed type. mjpeg = continuous multipart stream via <img>; hls = HLS video via <video>; image = static image with optional auto-refresh.'},
                {name: 'refresh',        type: 'number',    default: 0,        help: 'Auto-refresh interval in seconds for image type (0 = disabled).'},
                {name: 'show-controls',  type: 'boolean',   default: false,    help: 'Show native video controls (HLS type only).'},
                {name: 'label',          type: 'string',    default: '',       help: 'Optional overlay label shown at the bottom of the feed.'},
                {name: 'muted',          type: 'boolean',   default: true,     help: 'Mute video audio (HLS type).'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'border-radius',
                {property: '--feezal-camera-bg-color',    type: 'color', default: 'var(--secondary-background-color, #111)', help: 'Background colour shown when no feed is loaded.'},
                {property: '--feezal-camera-label-color', type: 'color', default: 'var(--primary-text-color)', help: 'Overlay label text colour.'},
            ],
            restrict:     {minWidth: 120, minHeight: 80},
            defaultStyle: {width: '320px', height: '180px'},
        };
    }

    static properties = {
        src:            {type: String,  reflect: true},
        type:           {type: String,  reflect: true},
        refresh:        {type: Number,  reflect: true},
        showControls:   {type: Boolean, reflect: true, attribute: 'show-controls'},
        label:          {type: String,  reflect: true},
        muted:          {type: Boolean, reflect: true},
        _activeSrc: {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-sizing: border-box;
            position: relative;
            background: var(--feezal-camera-bg-color, var(--secondary-background-color, #111));
            --feezal-camera-bg-color:    var(--secondary-background-color, #111);
            --feezal-camera-label-color: var(--primary-text-color, #fff);
        }
        img.feed, video.feed {
            width: 100%; flex: 1; min-height: 0; object-fit: contain; display: block;
        }
        .placeholder {
            flex: 1; display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 6px; opacity: 0.4;
        }
        .placeholder svg { width: 40px; height: 40px; }
        .placeholder span { font-size: 11px; color: var(--feezal-camera-label-color); }
        .overlay-label {
            position: absolute; bottom: 4px; left: 6px; right: 6px;
            font-size: 11px; color: var(--feezal-camera-label-color);
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
            pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
    `];

    constructor() {
        super();
        this.src          = '';
        this.type         = 'mjpeg';
        this.refresh      = 0;
        this.showControls = false;
        this.label        = '';
        this.muted        = true;
        this._activeSrc   = '';
        // non-reactive
        this.__refreshTimer = null;
        this.__cacheBuster  = 0;
    }

    connectedCallback() {
        super.connectedCallback();
        this._activeSrc = this.src;

        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                if (v) this._activeSrc = String(v);
            });
        }

        if (this.type === 'image' && this.refresh > 0) {
            this.__refreshTimer = setInterval(() => {
                this.__cacheBuster = Date.now();
                this.requestUpdate();
            }, this.refresh * 1000);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.__refreshTimer) {
            clearInterval(this.__refreshTimer);
            this.__refreshTimer = null;
        }
    }

    _feedSrc() {
        const base = this._activeSrc || this.src;
        if (!base) return '';
        if (this.type === 'image' && this.refresh > 0) {
            const sep = base.includes('?') ? '&' : '?';
            return `${base}${sep}_t=${this.__cacheBuster || Date.now()}`;
        }
        return base;
    }

    _placeholder() {
        return html`
            <div class="placeholder">
                <svg viewBox="0 0 24 24"><path fill="currentColor"
                    d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0
                       1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                <span>${this.label || 'Camera'}</span>
            </div>`;
    }

    render() {
        const src = this._feedSrc();

        if (!src) {
            return html`
                ${this._placeholder()}
                ${this.label ? html`<div class="overlay-label">${this.label}</div>` : ''}`;
        }

        if (this.type === 'hls') {
            return html`
                <video class="feed" .src="${src}" ?controls="${this.showControls}"
                       ?muted="${this.muted}" autoplay playsinline></video>
                ${this.label ? html`<div class="overlay-label">${this.label}</div>` : ''}`;
        }

        // mjpeg and image both use <img>
        return html`
            <img class="feed" src="${src}" alt="${this.label || 'Camera feed'}">
            ${this.label ? html`<div class="overlay-label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-material-camera', FeezalElementMaterialCamera);
export {FeezalElementMaterialCamera};

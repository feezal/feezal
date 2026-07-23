/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';

// ── Element ───────────────────────────────────────────────────────────────────
class FeezalElementCircleCamera extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Camera', category: 'Circle', color: '#1565c0', icon: 'videocam'},
            description: 'Camera feed element — embeds an MJPEG stream, HLS video, low-latency WebRTC (WHEP), or periodically-refreshed image. Subscribe to an MQTT topic to switch the source URL dynamically. Optional click action: open the feed in a near-fullscreen popup or publish a payload. Note: browsers cannot play rtsp:// URLs directly — for RTSP cameras run a gateway like go2rtc or MediaMTX next to them and use its webrtc (WHEP), HLS or MJPEG output here.',
            links: [
                {label: 'go2rtc (RTSP → WebRTC/HLS/MJPEG gateway)', url: 'https://github.com/AlexxIT/go2rtc'},
                {label: 'MediaMTX (RTSP → WebRTC/HLS gateway)',     url: 'https://github.com/bluenviron/mediamtx'},
            ],
            discovery: {
                component: 'camera',
                map: {
                    topic: {attr: 'src'},
                    name:  'label',
                },
            },
            attributes: [
                {name: 'src',            type: 'string',    default: '',       help: 'Camera feed URL (MJPEG stream, HLS playlist, image URL, or WHEP endpoint URL for webrtc — e.g. go2rtc `http://host:1984/api/webrtc?src=cam` or MediaMTX `http://host:8889/cam/whep`). rtsp:// URLs cannot be played by browsers — point an RTSP camera through go2rtc/MediaMTX and use the gateway URL instead.'},
                {name: 'subscribe',      type: 'mqttTopic',                    help: 'MQTT topic that publishes the image or stream URL. Overrides `src` when a message is received. Also serves as the base topic for dynamic attribute overrides via `<subscribe>/#`.'},
                {name: 'type',           type: 'select',    options: ['mjpeg', 'hls', 'image', 'webrtc'], default: 'mjpeg',
                    help: 'Feed type. mjpeg = continuous multipart stream via <img>; hls = HLS video via <video>; image = static image with optional auto-refresh; webrtc = low-latency WebRTC video negotiated with a WHEP endpoint (go2rtc, MediaMTX, …).'},
                {name: 'refresh',        type: 'number',    default: 0,        help: 'Auto-refresh interval in seconds for image type (0 = disabled).'},
                {name: 'show-controls',  type: 'boolean',   default: false,    help: 'Show native video controls (hls / webrtc types).'},
                {name: 'label',          type: 'string',    default: '',       help: 'Optional overlay label shown at the bottom of the feed.'},
                {name: 'muted',          type: 'boolean',   default: true,     help: 'Mute video audio (hls / webrtc types).'},
                {name: 'click-action',   type: 'select',    options: ['none', 'popup', 'publish'], default: 'none',
                    help: 'Viewer tap/click behaviour: popup opens the feed near-fullscreen (tap or Esc closes); publish sends `payload` to the `publish` topic. Nothing fires in the editor. Ignored when click-through is on.'},
                {name: 'popup-animation', type: 'boolean',  default: false,
                    help: 'Animate the popup: it grows from the camera element to near-fullscreen on open and shrinks back on close.'},
                {name: 'publish',        type: 'mqttTopic',                    help: 'MQTT topic published on click/tap (click-action: publish).'},
                {name: 'payload',        type: 'string',    default: '1',      help: 'Payload published on click/tap (click-action: publish).'},
                {name: 'click-through',  type: 'boolean',   default: false,
                    help: 'Viewer: let clicks/taps pass through this element to whatever sits beneath it (e.g. a button under the feed). The whole element becomes transparent to pointer events — disables click-action. In the editor the element stays selectable/draggable.'},
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
        muted:          {type: Boolean, reflect: true, converter: feezalBoolean},
        clickAction:    {type: String,  reflect: true, attribute: 'click-action'},
        popupAnimation: {type: Boolean, reflect: true, attribute: 'popup-animation'},
        publish:        {type: String,  reflect: true},
        payload:        {type: String,  reflect: true},
        clickThrough:   {type: Boolean, reflect: true, attribute: 'click-through'},
        _activeSrc: {state: true},
        _popupOpen: {state: true},
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

        /* E82-style click-through — viewer only, gated on the ABSENCE of the
           editor's feezal-editable class so the canvas element stays
           selectable/draggable. */
        :host([click-through]:not(.feezal-editable)) {
            pointer-events: none;
        }
        :host([click-action='popup']:not(.feezal-editable)),
        :host([click-action='publish']:not(.feezal-editable)) {
            cursor: pointer;
        }

        /* Near-fullscreen popup — browser TOP LAYER via the popover API
           (system-pin pattern) so it paints above any sibling stacking
           context; the fixed+z-index rules are the fallback in browsers
           without popover support. Overrides of the [popover] UA defaults
           (margin/border/size) keep it a near-viewport cover. */
        .popup {
            position: fixed; inset: 3vh 3vw; z-index: 99999;
            width: auto; height: auto; margin: 0; border: 0; padding: 0; overflow: hidden;
            border-radius: 8px;
            background: var(--feezal-camera-bg-color, #111);
            display: flex; flex-direction: column;
        }
        .popup::backdrop { background: rgba(0, 0, 0, 0.65); }
        .popup .overlay-label { bottom: 10px; left: 12px; right: 12px; font-size: 13px; }
        .popup .close {
            position: absolute; top: 8px; right: 8px; z-index: 1;
            width: 36px; height: 36px; border-radius: 50%; border: 0; cursor: pointer;
            background: rgba(0, 0, 0, 0.55); color: #fff; font-size: 18px; line-height: 1;
            display: flex; align-items: center; justify-content: center;
        }
        .popup .close:hover { background: rgba(0, 0, 0, 0.8); }
    `];

    constructor() {
        super();
        this.src          = '';
        this.type         = 'mjpeg';
        this.refresh      = 0;
        this.showControls = false;
        this.label        = '';
        this.muted        = true;
        this.clickAction  = 'none';
        this.popupAnimation = false;
        this.publish      = '';
        this.payload      = '1';
        this.clickThrough = false;
        this._activeSrc   = '';
        this._popupOpen   = false;
        // non-reactive
        this.__refreshTimer = null;
        this.__cacheBuster  = 0;
        this.__pc           = null;   // webrtc: RTCPeerConnection
        this.__stream       = null;   // webrtc: MediaStream (shared by inline feed + popup)
        this.__webrtcRetry  = null;   // webrtc: reconnect timer
        this.__popupClosing = false;  // popup-animation: shrink in progress
        this.__popupKeydown = e => {
            if (e.key === 'Escape') this._closePopup();
        };
        this.addEventListener('click', () => this._onHostClick());
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
        this._webrtcClose();
        document.removeEventListener('keydown', this.__popupKeydown);
    }

    // ── WebRTC (WHEP — RFC 9725, as served by go2rtc / MediaMTX / …) ──────────
    // One receive-only RTCPeerConnection per element; its MediaStream is
    // attached to the inline <video> AND the popup <video> via .srcObject, so
    // the popup does not open a second session.

    _webrtcClose() {
        clearTimeout(this.__webrtcRetry);
        this.__webrtcRetry = null;
        if (this.__pc) {
            this.__pc.ontrack = null;
            this.__pc.onconnectionstatechange = null;
            try { this.__pc.close(); } catch { /* already closed */ }
            this.__pc = null;
        }
        if (this.__stream) {
            this.__stream = null;
            this.requestUpdate();
        }
    }

    async _webrtcConnect() {
        this._webrtcClose();
        const url = this._activeSrc || this.src;
        if (!url || this.type !== 'webrtc' || !this.isConnected) return;

        const pc = new RTCPeerConnection();
        this.__pc = pc;
        pc.addTransceiver('video', {direction: 'recvonly'});
        pc.addTransceiver('audio', {direction: 'recvonly'});
        pc.ontrack = ev => {
            if (pc !== this.__pc) return;
            this.__stream = ev.streams[0] || new MediaStream([ev.track]);
            this.requestUpdate();
        };
        pc.onconnectionstatechange = () => {
            if (pc !== this.__pc) return;
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                this._webrtcRetryLater();
            }
        };

        try {
            await pc.setLocalDescription(await pc.createOffer());
            // WHEP is a single POST (no trickle) — wait for ICE gathering so
            // the offer carries the candidates, with a cap for hosts where
            // gathering never reaches 'complete'.
            await this._webrtcIceComplete(pc);
            const res = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/sdp'},
                body: pc.localDescription.sdp,
            });
            if (pc !== this.__pc) return; // superseded while awaiting
            if (!res.ok) throw new Error(`WHEP endpoint answered ${res.status}`);
            const answer = await res.text();
            if (pc !== this.__pc) return;
            await pc.setRemoteDescription({type: 'answer', sdp: answer});
        } catch (error) {
            if (pc !== this.__pc) return;
            console.warn('feezal-element-circle-camera webrtc:', error.message);
            this._webrtcRetryLater();
        }
    }

    _webrtcRetryLater() {
        if (this.__webrtcRetry || !this.isConnected) return;
        this.__webrtcRetry = setTimeout(() => {
            this.__webrtcRetry = null;
            if (this.isConnected && this.type === 'webrtc') this._webrtcConnect();
        }, 5000);
    }

    _webrtcIceComplete(pc, timeout = 2000) {
        if (pc.iceGatheringState === 'complete') return Promise.resolve();
        return new Promise(resolve => {
            const finish = () => {
                clearTimeout(timer);
                pc.removeEventListener('icegatheringstatechange', check);
                resolve();
            };
            const check = () => {
                if (pc.iceGatheringState === 'complete') finish();
            };
            const timer = setTimeout(finish, timeout);
            pc.addEventListener('icegatheringstatechange', check);
        });
    }

    // ── Click actions ─────────────────────────────────────────────────────────

    _onHostClick() {
        if (feezal.isEditor || this.clickThrough) return;
        if (this.clickAction === 'publish') {
            if (this.publish) feezal.connection.pub(this.publish, this.payload);
        } else if (this.clickAction === 'popup' && !this._popupOpen && this._feedSrc()) {
            this._popupOpen = true;
            document.addEventListener('keydown', this.__popupKeydown);
        }
    }

    async _closePopup() {
        if (this.__popupClosing) return;
        document.removeEventListener('keydown', this.__popupKeydown);
        if (this.popupAnimation) {
            const popup = this.renderRoot.querySelector('.popup');
            if (popup?.animate) {
                this.__popupClosing = true;
                try {
                    await this._animatePopup(popup, true).finished;
                } catch { /* interrupted — close anyway */ }
                this.__popupClosing = false;
            }
        }
        this._popupOpen = false;
    }

    /**
     * FLIP-style grow/shrink between the camera element's on-screen rect and
     * the popup's near-fullscreen rect (popup-animation attribute).
     */
    _animatePopup(popup, reverse) {
        const from = this.getBoundingClientRect();  // camera element on the dashboard
        const to   = popup.getBoundingClientRect(); // final popup rect
        const grown = {transform: 'none', opacity: 1};
        const shrunk = {
            transform:
                `translate(${(from.left + from.width / 2) - (to.left + to.width / 2)}px, ` +
                `${(from.top + from.height / 2) - (to.top + to.height / 2)}px) ` +
                `scale(${from.width / to.width}, ${from.height / to.height})`,
            opacity: 0.4,
        };
        return popup.animate(
            reverse ? [grown, shrunk] : [shrunk, grown],
            {duration: 220, easing: reverse ? 'cubic-bezier(0.4, 0, 1, 1)' : 'cubic-bezier(0, 0, 0.2, 1)'}
        );
    }

    _popupClick(e) {
        // Never reach the host handler (it would immediately reopen).
        e.stopPropagation();
        // Tap anywhere closes — except on the video when native controls are
        // shown (play/pause/seek clicks must stay usable).
        if ((this.type === 'hls' || this.type === 'webrtc') && this.showControls && e.target.tagName === 'VIDEO') return;
        this._closePopup();
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

    _feedMarkup(src) {
        // .muted property binding in addition to ?muted — the content attribute
        // only sets the default; on dynamically created videos the property is
        // what actually mutes (autoplay policies require it).
        if (this.type === 'webrtc') {
            return html`
                <video class="feed" .srcObject="${this.__stream ?? null}" ?controls="${this.showControls}"
                       ?muted="${this.muted}" .muted="${this.muted}" autoplay playsinline></video>`;
        }
        if (this.type === 'hls') {
            return html`
                <video class="feed" .src="${src}" ?controls="${this.showControls}"
                       ?muted="${this.muted}" .muted="${this.muted}" autoplay playsinline></video>`;
        }
        // mjpeg and image both use <img>
        return html`<img class="feed" src="${src}" alt="${this.label || 'Camera feed'}">`;
    }

    render() {
        const src = this._feedSrc();
        return html`
            ${src ? this._feedMarkup(src) : this._placeholder()}
            ${this.label ? html`<div class="overlay-label">${this.label}</div>` : ''}
            ${this._popupOpen && src ? this._renderPopup(src) : ''}`;
    }

    // Note: the popup renders a second feed instance — for mjpeg that opens a
    // second stream connection while the popup is open; webrtc attaches the
    // SAME MediaStream to both videos (no second WHEP session).
    _renderPopup(src) {
        return html`
            <div class="popup" popover="manual" @click="${this._popupClick}">
                ${this._feedMarkup(src)}
                <button class="close" title="Close" @click="${e => { e.stopPropagation(); this._closePopup(); }}">✕</button>
                ${this.label ? html`<div class="overlay-label">${this.label}</div>` : ''}
            </div>`;
    }

    updated(changed) {
        super.updated(changed);
        // webrtc: (re)negotiate whenever the source or type changes — covers
        // the initial mount (_activeSrc is set in connectedCallback) and MQTT
        // driven src switches.
        if (changed.has('type') || changed.has('src') || changed.has('_activeSrc')) {
            if (this.type === 'webrtc') {
                this._webrtcConnect();
            } else {
                this._webrtcClose();
            }
        }
        // Promote the popup into the top layer (system-pin pattern). Removing
        // it from the DOM on close dismisses the popover automatically.
        if (changed.has('_popupOpen') && this._popupOpen) {
            const popup = this.renderRoot.querySelector('.popup');
            if (popup?.showPopover && !popup.matches(':popover-open')) {
                try { popup.showPopover(); } catch { /* fixed+z-index fallback */ }
            }
            if (popup && this.popupAnimation && popup.animate) {
                this._animatePopup(popup, false);
            }
        }
    }
}

customElements.define('feezal-element-circle-camera', FeezalElementCircleCamera);
export {FeezalElementCircleCamera};

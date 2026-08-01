/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-basic-camera (E163 — hard-renamed from circle-camera, see
 * docs/BREAKING-CHANGES.md): the camera surface. Streams (MJPEG / HLS /
 * WebRTC-WHEP / refreshing image) plus the pure-MQTT paths — `mqtt-image`
 * renders image payloads arriving as MQTT messages (binary snapshots are
 * relayed as data URLs by the connection layer; raw-base64 payloads are
 * detected too), state chips over the feed, and an optional event list fed by
 * a Frigate-style events topic with per-class snapshot thumbnails.
 *
 * EVERY piece of user-facing chrome is opt-in/optional (E163 refinement):
 * label, chips, event list, fullscreen button, refresh button, the popup's
 * close button, click actions and click-through are all individual knobs.
 */
class FeezalElementBasicCamera extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Camera', category: 'Basic', color: '#4a6080', icon: 'videocam'},
            description: 'Camera element — MJPEG stream, HLS video, low-latency WebRTC (WHEP), refreshed image URL, ' +
                'or images arriving as MQTT payloads (Frigate snapshots, HA MQTT cameras, ESP32-cams). Optional state ' +
                'chips, event list (Frigate events topic), fullscreen popup with its own feed type (live-on-demand), ' +
                'click actions. Browsers cannot play rtsp:// — use a go2rtc/MediaMTX gateway URL for RTSP cameras.',
            links: [
                {label: 'go2rtc (RTSP → WebRTC/HLS/MJPEG gateway)', url: 'https://github.com/AlexxIT/go2rtc'},
                {label: 'MediaMTX (RTSP → WebRTC/HLS gateway)',     url: 'https://github.com/bluenviron/mediamtx'},
                {label: 'Frigate (NVR with MQTT events + snapshots)', url: 'https://frigate.video'},
                {label: 'Scrypted (NVR — copy the camera RTSP rebroadcast URL)', url: 'https://www.scrypted.app'},
            ],
            discovery: {
                component: 'camera',
                map: {
                    // HA MQTT camera: `topic` carries IMAGE PAYLOADS (bytes) —
                    // exactly the mqtt-image path (the old circle-camera wired
                    // it to `src`, which expects a URL, and never worked).
                    topic: {attr: 'subscribe', alsoSet: {type: 'mqtt-image'}},
                    name:  'label',
                    // Native Frigate recognizer keys (E163) — event list +
                    // chips + thumbnails wired in one pick.
                    events_topic: 'events-topic',
                    camera_name:  'events-camera',
                    thumbs_topic: 'event-thumbs',
                    chips: {attr: 'chips', transform: 'jsonStringify'},
                },
            },
            attributes: [
                {name: 'src',            type: 'string',    default: '',       help: 'Camera feed URL (MJPEG stream, HLS playlist, image URL, or WHEP endpoint URL for webrtc — e.g. go2rtc `http://host:1984/api/webrtc?src=cam` or MediaMTX `http://host:8889/cam/whep`). Unused for type mqtt-image. From Scrypted: open the camera and, in its Streams settings (the Rebroadcast plugin), copy the RTSP rebroadcast URL (`rtsp://<scrypted-host>:<port>/<id>`). Browsers cannot play RTSP, so add that URL as a source in a go2rtc or MediaMTX gateway and paste the browser URL it produces (WebRTC-WHEP / HLS / MJPEG) here — set `type` to match.'},
                {name: 'subscribe',      type: 'mqttTopic',                    help: 'type mqtt-image: topic whose PAYLOAD is the image (binary → data URL, or raw base64). Other types: a message overrides the src URL. Also serves as base for dynamic attribute overrides via `<subscribe>/#`.'},
                {name: 'type',           type: 'select',    options: ['mjpeg', 'hls', 'image', 'webrtc', 'mqtt-image'], default: 'mjpeg',
                    help: 'Feed type. mjpeg = multipart stream via <img>; hls = HLS video; image = URL with optional auto-refresh; webrtc = WHEP low-latency video; mqtt-image = the subscribe topic\'s payloads ARE the images.'},
                {name: 'refresh',        type: 'number',    default: 0,        help: 'Auto-refresh interval in seconds for image type (0 = disabled).'},
                {name: 'aspect-ratio',   type: 'string',    default: '',       help: 'CSS aspect ratio for the feed area, e.g. "16/9" or "4/3". Empty = fill the element.'},
                {name: 'object-fit',     type: 'select',    options: ['contain', 'cover', 'fill'], default: 'contain',
                    help: 'How the feed fills its box: contain letterboxes, cover crops, fill stretches.'},
                {name: 'show-controls',  type: 'boolean',   default: false,    help: 'Show native video controls (hls / webrtc types).'},
                {name: 'label',          type: 'string',    default: '',       help: 'Optional overlay label shown at the bottom of the feed.'},
                {name: 'muted',          type: 'boolean',   default: true,     help: 'Mute video audio (hls / webrtc types).'},
                {name: 'pause-when-hidden', type: 'boolean', default: false,
                    help: 'Stop the feed while the camera is off-screen — its view is hidden, it is scrolled out of sight, or the browser tab is in the background — and resume when it shows again. Frees the bandwidth and CPU a live mjpeg / hls / webrtc stream keeps using otherwise. Viewer only; the editor always shows the live feed.'},
                {name: 'chips', type: 'json', default: '[]', section: 'Chips',
                    help: 'State chips over the feed: [{"subscribe":"frigate/cam/person","label":"Person","show":"nonzero"}]. Fields: subscribe, label, message-property (default payload), show = always | nonzero (hidden while 0/off/empty).'},
                {name: 'show-fullscreen-button', type: 'boolean', default: false, section: 'Buttons',
                    help: 'Overlay ⛶ button (top-right) that opens the popup — independent of click-action.'},
                {name: 'show-refresh-button', type: 'boolean', default: false, section: 'Buttons',
                    help: 'Overlay ↻ button that reloads the image now (image type).'},
                {name: 'popup-close-button', type: 'boolean', default: true, section: 'Buttons',
                    help: 'Show the ✕ button in the popup (tap-anywhere and Esc always close).'},
                {name: 'click-action',   type: 'select',    options: ['none', 'popup', 'publish'], default: 'none',
                    help: 'Viewer tap/click behaviour: popup opens the feed near-fullscreen (tap or Esc closes); publish sends `payload` to the `publish` topic. Nothing fires in the editor. Ignored when click-through is on.'},
                {name: 'popup-type',     type: 'select',    options: ['', 'mjpeg', 'hls', 'image', 'webrtc', 'mqtt-image'], default: '', section: 'Popup',
                    help: 'Feed type INSIDE the popup (empty = same as the element). Live-on-demand: keep the element on a cheap refreshing image and set popup-type to a stream.'},
                {name: 'popup-src',      type: 'string',    default: '', section: 'Popup',
                    help: 'Feed URL inside the popup (empty = same as the element). Pair with popup-type.'},
                {name: 'popup-animation', type: 'boolean',  default: false, section: 'Popup',
                    help: 'Animate the popup: it grows from the camera element to near-fullscreen on open and shrinks back on close.'},
                {name: 'publish',        type: 'mqttTopic',                    help: 'MQTT topic published on click/tap (click-action: publish).'},
                {name: 'payload',        type: 'string',    default: '1',      help: 'Payload published on click/tap (click-action: publish).'},
                {name: 'click-through',  type: 'boolean',   default: false,
                    help: 'Viewer: let clicks/taps pass through this element to whatever sits beneath it. Disables click-action. In the editor the element stays selectable/draggable.'},
                {name: 'show-events',    type: 'boolean',   default: false, section: 'Events',
                    help: 'Show the event list under the feed (needs events-topic).'},
                {name: 'events-topic',   type: 'mqttTopic', section: 'Events',
                    help: 'Frigate-style events topic (e.g. frigate/events) publishing JSON {type, after:{camera,label,top_score,zones,start_time}}.'},
                {name: 'events-camera',  type: 'string',    default: '', section: 'Events',
                    help: 'Only list events of this camera name (empty = all cameras on the topic).'},
                {name: 'events-max',     type: 'number',    default: 5, section: 'Events',
                    help: 'How many recent events to keep (ring buffer).'},
                {name: 'event-thumbs',   type: 'mqttTopic', section: 'Events',
                    help: 'Per-class snapshot base topic (e.g. frigate/cam1) — subscribes <base>/+/snapshot for the row thumbnails; tapping a row opens the matching snapshot in the popup.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'border-radius',
                {property: '--feezal-camera-bg-color',    type: 'color', default: 'var(--secondary-background-color)', help: 'Background colour shown when no feed is loaded.'},
                {property: '--feezal-camera-label-color', type: 'color', default: 'var(--primary-text-color)', help: 'Overlay label text colour.'},
                {property: '--feezal-camera-chip-bg',     type: 'color', default: 'var(--primary-background-color)', help: 'State chip background.'},
                {property: '--feezal-camera-chip-color',  type: 'color', default: 'var(--primary-text-color)', help: 'State chip text colour.'},
            ],
            restrict:     {minWidth: 120, minHeight: 80},
            // Sized to a whole 2x2 of the standard card cell (172x128), so a
            // camera dropped into a grid view lands on clean cell boundaries
            // instead of rounding to 2x1 and rendering squat.
            defaultStyle: {width: '344px', height: '256px'},
        };
    }

    static properties = {
        src:            {type: String,  reflect: true},
        type:           {type: String,  reflect: true},
        refresh:        {type: Number,  reflect: true},
        aspectRatio:    {type: String,  reflect: true, attribute: 'aspect-ratio'},
        objectFit:      {type: String,  reflect: true, attribute: 'object-fit'},
        showControls:   {type: Boolean, reflect: true, attribute: 'show-controls'},
        label:          {type: String,  reflect: true},
        muted:          {type: Boolean, reflect: true, converter: feezalBoolean},
        pauseWhenHidden: {type: Boolean, reflect: true, attribute: 'pause-when-hidden'},
        chips:          {type: String,  attribute: 'chips'},
        showFullscreenButton: {type: Boolean, reflect: true, attribute: 'show-fullscreen-button'},
        showRefreshButton:    {type: Boolean, reflect: true, attribute: 'show-refresh-button'},
        popupCloseButton:     {type: Boolean, attribute: 'popup-close-button', converter: feezalBoolean},
        clickAction:    {type: String,  reflect: true, attribute: 'click-action'},
        popupType:      {type: String,  reflect: true, attribute: 'popup-type'},
        popupSrc:       {type: String,  reflect: true, attribute: 'popup-src'},
        popupAnimation: {type: Boolean, reflect: true, attribute: 'popup-animation'},
        publish:        {type: String,  reflect: true},
        payload:        {type: String,  reflect: true},
        clickThrough:   {type: Boolean, reflect: true, attribute: 'click-through'},
        showEvents:     {type: Boolean, reflect: true, attribute: 'show-events'},
        eventsTopic:    {type: String,  reflect: true, attribute: 'events-topic'},
        eventsCamera:   {type: String,  reflect: true, attribute: 'events-camera'},
        eventsMax:      {type: Number,  reflect: true, attribute: 'events-max'},
        eventThumbs:    {type: String,  reflect: true, attribute: 'event-thumbs'},
        _activeSrc: {state: true},
        _mqttImage: {state: true},
        _popupOpen: {state: true},
        _popupStill: {state: true},   // event-row snapshot shown in the popup
        _chipValues: {state: true},
        _events:     {state: true},
        _thumbs:     {state: true},
        _streamPaused: {state: true},   // pause-when-hidden: feed torn down while off-screen
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-sizing: border-box;
            position: relative;
            background: var(--feezal-camera-bg-color, var(--secondary-background-color));
            --feezal-camera-bg-color:    var(--secondary-background-color);
            --feezal-camera-label-color: var(--primary-text-color);
        }
        .stage { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
        img.feed, video.feed {
            width: 100%; flex: 1; min-height: 0; display: block;
            object-fit: var(--_fit, contain);
        }
        :host([aspect-ratio]) .stage img.feed, :host([aspect-ratio]) .stage video.feed {
            flex: none; aspect-ratio: var(--_ar, auto); height: auto; margin: auto 0;
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
        .chips {
            position: absolute; top: 4px; left: 6px; right: 40px;
            display: flex; flex-wrap: wrap; gap: 4px; pointer-events: none;
        }
        .chip {
            font-size: 10px; line-height: 1; padding: 3px 7px; border-radius: 9px;
            background: var(--feezal-camera-chip-bg, var(--primary-background-color));
            color: var(--feezal-camera-chip-color, var(--primary-text-color));
            opacity: 0.92; display: inline-flex; gap: 4px; align-items: center;
        }
        .corner-btns { position: absolute; top: 4px; right: 4px; display: flex; gap: 4px; }
        .corner-btns button {
            width: 26px; height: 26px; border-radius: 6px; border: 0; cursor: pointer;
            background: rgba(0, 0, 0, 0.45); color: #fff; font-size: 14px; line-height: 1;
            display: flex; align-items: center; justify-content: center;
        }
        .corner-btns button:hover { background: rgba(0, 0, 0, 0.7); }

        .events { flex: none; max-height: 45%; overflow-y: auto; font-size: 11px; }
        .ev-row {
            display: flex; align-items: center; gap: 6px; padding: 3px 6px; cursor: pointer;
            color: var(--feezal-camera-label-color);
            border-top: 1px solid rgba(127, 127, 127, 0.25);
        }
        .ev-row:hover { background: rgba(127, 127, 127, 0.15); }
        .ev-row img { width: 34px; height: 24px; object-fit: cover; border-radius: 3px; flex: none; }
        .ev-time { opacity: 0.7; flex: none; font-variant-numeric: tabular-nums; }
        .ev-label { font-weight: 600; flex: none; text-transform: capitalize; }
        .ev-score { opacity: 0.7; flex: none; }
        .ev-zones { opacity: 0.55; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* E82-style click-through — viewer only, gated on the ABSENCE of the
           editor's feezal-editable class so the canvas element stays
           selectable/draggable. */
        :host([click-through]:not(.feezal-editable)) { pointer-events: none; }
        :host([click-action='popup']:not(.feezal-editable)),
        :host([click-action='publish']:not(.feezal-editable)) { cursor: pointer; }

        /* Near-fullscreen popup — browser TOP LAYER via the popover API
           (system-pin pattern); the fixed+z-index rules are the fallback in
           browsers without popover support. */
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
        this.aspectRatio  = '';
        this.objectFit    = 'contain';
        this.showControls = false;
        this.label        = '';
        this.muted        = true;
        this.pauseWhenHidden = false;
        this.chips        = '[]';
        this.showFullscreenButton = false;
        this.showRefreshButton    = false;
        this.popupCloseButton     = true;
        this.clickAction  = 'none';
        this.popupType    = '';
        this.popupSrc     = '';
        this.popupAnimation = false;
        this.publish      = '';
        this.payload      = '1';
        this.clickThrough = false;
        this.showEvents   = false;
        this.eventsTopic  = '';
        this.eventsCamera = '';
        this.eventsMax    = 5;
        this.eventThumbs  = '';
        this._activeSrc   = '';
        this._mqttImage   = '';
        this._popupOpen   = false;
        this._popupStill  = '';
        this._chipValues  = {};
        this._events      = [];
        this._thumbs      = {};
        this._streamPaused = false;
        // non-reactive
        this.__refreshTimer = null;
        this.__cacheBuster  = 0;
        this.__pc           = null;   // webrtc: RTCPeerConnection
        this.__stream       = null;   // webrtc: MediaStream (shared by inline feed + popup)
        this.__webrtcRetry  = null;   // webrtc: reconnect timer
        this.__popupClosing = false;  // popup-animation: shrink in progress
        this.__io           = null;   // pause-when-hidden: IntersectionObserver
        this.__intersecting = true;   // last observed on-screen state
        this.__onDocVisibility = () => this._recomputeVisibility();
        this.__popupKeydown = e => {
            if (e.key === 'Escape') this._closePopup();
        };
        this.addEventListener('click', () => this._onHostClick());
    }

    // Manual subscriptions (several topics); suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    connectedCallback() {
        super.connectedCallback();
        this._activeSrc = this.src;
        this._wireSubscriptions();
        this._startRefreshTimer();
        this._startVisibilityWatch();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopRefreshTimer();
        this._stopVisibilityWatch();
        this._webrtcClose();
        document.removeEventListener('keydown', this.__popupKeydown);
    }

    _startRefreshTimer() {
        this._stopRefreshTimer();
        if (this.type === 'image' && this.refresh > 0 && !this._streamPaused) {
            this.__refreshTimer = setInterval(() => {
                this.__cacheBuster = Date.now();
                this.requestUpdate();
            }, this.refresh * 1000);
        }
    }

    _stopRefreshTimer() {
        if (this.__refreshTimer) {
            clearInterval(this.__refreshTimer);
            this.__refreshTimer = null;
        }
    }

    // ── pause-when-hidden ──────────────────────────────────────────────────────
    // Watch on-screen state (IntersectionObserver) plus tab visibility and tear
    // the live feed down while off-screen. Viewer-only: the editor always shows
    // the feed so the element stays designable on the canvas.

    _startVisibilityWatch() {
        if (this.__io || feezal.isEditor || !this.pauseWhenHidden) return;
        if (typeof IntersectionObserver === 'undefined') return;
        this.__intersecting = true;
        this.__io = new IntersectionObserver(entries => {
            this.__intersecting = entries[entries.length - 1].isIntersecting;
            this._recomputeVisibility();
        });
        this.__io.observe(this);
        document.addEventListener('visibilitychange', this.__onDocVisibility);
        this._recomputeVisibility();
    }

    _stopVisibilityWatch() {
        if (this.__io) {
            this.__io.disconnect();
            this.__io = null;
        }
        document.removeEventListener('visibilitychange', this.__onDocVisibility);
    }

    _recomputeVisibility() {
        const paused = this.__intersecting === false || document.hidden;
        if (paused === this._streamPaused) return;
        this._streamPaused = paused;
        // The reactive change re-renders (feed src goes empty → mjpeg/hls/image
        // stop) and updated() (re)negotiates webrtc; only the timer is manual.
        if (paused) this._stopRefreshTimer();
        else this._startRefreshTimer();
    }

    /** Live topic/config edits rewire (glass-switch pattern). */
    _wireSignature() {
        return [this.subscribe, this.type, this.chips, this.eventsTopic, this.eventThumbs].join('|');
    }

    _wireSubscriptions() {
        this.__wireSig = this._wireSignature();

        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                if (v == null || v === '') return;
                if (this.type === 'mqtt-image') {
                    this._mqttImage = this._asImageSrc(String(v));
                } else {
                    this._activeSrc = String(v);
                }
            });
        }

        // state chips — one subscription per declared chip
        let chips = [];
        try { chips = JSON.parse(this.chips || '[]'); } catch { /* bad json → none */ }
        this.__chips = Array.isArray(chips) ? chips.filter(c => c && c.subscribe) : [];
        for (const chip of this.__chips) {
            this.addSubscription(chip.subscribe, msg => {
                const v = this.getProperty(msg, chip['message-property'] || 'payload');
                this._chipValues = {...this._chipValues, [chip.subscribe]: v};
            });
        }

        // event list — Frigate-style JSON stream, camera-filtered ring buffer
        if (this.eventsTopic) {
            this.addSubscription(this.eventsTopic, msg => {
                let ev = this.getProperty(msg, 'payload');
                if (typeof ev === 'string') {
                    try { ev = JSON.parse(ev); } catch { return; }
                }
                const a = ev?.after || ev;
                if (!a || !a.label) return;
                if (this.eventsCamera && a.camera !== this.eventsCamera) return;
                if (ev?.type === 'end') return;   // list arrivals, not departures
                const entry = {
                    id: a.id || `${a.camera}-${a.start_time}`,
                    camera: a.camera || '',
                    labelName: String(a.label),
                    score: a.top_score ?? a.score ?? null,
                    zones: [...new Set([...(a.entered_zones || []), ...(a.zones || [])])],
                    ts: a.start_time ? a.start_time * 1000 : Date.now(),
                };
                const rest = this._events.filter(e => e.id !== entry.id);
                this._events = [entry, ...rest].slice(0, Math.max(1, this.eventsMax || 5));
            });
        }

        // per-class snapshot thumbnails: <base>/+/snapshot
        if (this.eventThumbs) {
            this.addSubscription(`${this.eventThumbs}/+/snapshot`, msg => {
                const parts = String(msg.topic || '').split('/');
                const cls = parts[parts.length - 2];
                const v = this.getProperty(msg, 'payload');
                if (cls && typeof v === 'string' && v) {
                    this._thumbs = {...this._thumbs, [cls]: this._asImageSrc(v)};
                }
            });
        }
    }

    /** Payload → usable <img> src: data URLs pass through (the connection
     * layer converts binary payloads), raw base64 gets a jpeg prefix, URLs
     * pass through untouched. */
    _asImageSrc(v) {
        if (v.startsWith('data:') || /^https?:\/\//.test(v) || v.startsWith('/')) return v;
        if (v.length > 64 && /^[A-Za-z0-9+/=\s]+$/.test(v)) return 'data:image/jpeg;base64,' + v.replace(/\s+/g, '');
        return v;
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
                // Accept application/sdp (WHEP) so the gateway answers with an
                // sdp content-type rather than json/text — a cross-origin json
                // answer is what Chrome ORB-blocks (ERR_BLOCKED_BY_ORB).
                headers: {'Content-Type': 'application/sdp', 'Accept': 'application/sdp'},
                body: pc.localDescription.sdp,
            });
            if (pc !== this.__pc) return; // superseded while awaiting
            if (!res.ok) throw new Error(`WHEP endpoint answered ${res.status}`);
            const answer = await res.text();
            if (pc !== this.__pc) return;
            await pc.setRemoteDescription({type: 'answer', sdp: answer});
        } catch (error) {
            if (pc !== this.__pc) return;
            console.warn('feezal-element-basic-camera webrtc:', error.message);
            this._webrtcRetryLater();
        }
    }

    _webrtcRetryLater() {
        if (this.__webrtcRetry || !this.isConnected) return;
        this.__webrtcRetry = setTimeout(() => {
            this.__webrtcRetry = null;
            if (this.isConnected && this.type === 'webrtc' && !this._streamPaused) this._webrtcConnect();
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
        } else if (this.clickAction === 'popup') {
            this._openPopup();
        }
    }

    _openPopup(still = '') {
        if (this._popupOpen) return;
        this._popupStill = still;
        if (!still && !this._popupFeedSrc()) return;
        this._popupOpen = true;
        document.addEventListener('keydown', this.__popupKeydown);
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
        this._popupStill = '';
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
        const t = this._popupEffType();
        // Tap anywhere closes — except on the video when native controls are
        // shown (play/pause/seek clicks must stay usable).
        if ((t === 'hls' || t === 'webrtc') && this.showControls && e.target.tagName === 'VIDEO') return;
        this._closePopup();
    }

    // ── Sources ───────────────────────────────────────────────────────────────

    _feedSrc() {
        // pause-when-hidden: empty src drops the <img>/<video> so mjpeg / hls /
        // image feeds close their connection while off-screen (webrtc is torn
        // down separately in updated()).
        if (this._streamPaused) return '';
        if (this.type === 'mqtt-image') return this._mqttImage;
        const base = this._activeSrc || this.src;
        if (!base) return '';
        if (this.type === 'image' && this.refresh > 0) {
            const sep = base.includes('?') ? '&' : '?';
            return `${base}${sep}_t=${this.__cacheBuster || Date.now()}`;
        }
        return base;
    }

    /** Popup feed: its own type/src when set (live-on-demand), else the element's. */
    _popupEffType() { return this.popupType || this.type; }

    _popupFeedSrc() {
        if (this._popupStill) return this._popupStill;
        if (this.popupSrc) return this.popupSrc;
        if (this.popupType && this.popupType !== this.type) {
            // a different type without its own src reuses the base URL
            return this.popupType === 'mqtt-image' ? this._mqttImage : (this._activeSrc || this.src);
        }
        return this._feedSrc();
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

    _feedMarkup(src, type) {
        // .muted property binding in addition to ?muted — the content attribute
        // only sets the default; on dynamically created videos the property is
        // what actually mutes (autoplay policies require it).
        if (type === 'webrtc') {
            return html`
                <video class="feed" .srcObject="${this.__stream ?? null}" ?controls="${this.showControls}"
                       ?muted="${this.muted}" .muted="${this.muted}" autoplay playsinline></video>`;
        }
        if (type === 'hls') {
            return html`
                <video class="feed" .src="${src}" ?controls="${this.showControls}"
                       ?muted="${this.muted}" .muted="${this.muted}" autoplay playsinline></video>`;
        }
        // mjpeg, image and mqtt-image all use <img>
        return html`<img class="feed" src="${src}" alt="${this.label || 'Camera feed'}">`;
    }

    // ── Chips + events chrome (all optional) ─────────────────────────────────

    _chipVisible(chip) {
        const v = this._chipValues[chip.subscribe];
        if ((chip.show || 'always') === 'always') return true;
        const s = String(v ?? '').toLowerCase();
        return !(v == null || s === '' || s === '0' || s === 'off' || s === 'false' || s === 'no');
    }

    _renderChips() {
        const chips = (this.__chips || []).filter(c => this._chipVisible(c));
        if (!chips.length) return '';
        return html`
            <div class="chips">
                ${chips.map(c => {
                    const v = this._chipValues[c.subscribe];
                    const num = v != null && String(v) !== '' && !isNaN(Number(v)) ? Number(v) : null;
                    return html`<span class="chip">${c.label || c.subscribe}${num != null && (c.show || 'always') !== 'always' && num !== 1 ? html` ${num}` : ''}</span>`;
                })}
            </div>`;
    }

    _renderCornerButtons() {
        if (feezal.isEditor) return '';
        const buttons = [];
        if (this.showRefreshButton && this.type === 'image') {
            buttons.push(html`<button class="btn-refresh" title="Refresh"
                @click="${e => { e.stopPropagation(); this.__cacheBuster = Date.now(); this.requestUpdate(); }}">↻</button>`);
        }
        if (this.showFullscreenButton) {
            buttons.push(html`<button class="btn-fullscreen" title="Fullscreen"
                @click="${e => { e.stopPropagation(); this._openPopup(); }}">⛶</button>`);
        }
        return buttons.length ? html`<div class="corner-btns">${buttons}</div>` : '';
    }

    _renderEvents() {
        if (!this.showEvents || !this._events.length) return '';
        const fmt = ts => {
            const d = new Date(ts);
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        };
        return html`
            <div class="events">
                ${this._events.map(ev => html`
                    <div class="ev-row" @click="${e => { e.stopPropagation(); this._eventClick(ev); }}">
                        ${this._thumbs[ev.labelName] ? html`<img src="${this._thumbs[ev.labelName]}" alt="">` : ''}
                        <span class="ev-time">${fmt(ev.ts)}</span>
                        <span class="ev-label">${ev.labelName}</span>
                        ${ev.score != null ? html`<span class="ev-score">${Math.round(ev.score * 100)}%</span>` : ''}
                        <span class="ev-zones">${ev.zones.join(', ')}</span>
                    </div>`)}
            </div>`;
    }

    _eventClick(ev) {
        if (feezal.isEditor) return;
        const still = this._thumbs[ev.labelName] || '';
        if (still || this._popupFeedSrc()) this._openPopup(still);
    }

    render() {
        const src = this._feedSrc();
        return html`
            <div class="stage" style="--_fit: ${this.objectFit || 'contain'}; --_ar: ${this.aspectRatio || 'auto'}">
                ${src ? this._feedMarkup(src, this.type) : this._placeholder()}
                ${this._renderChips()}
                ${this._renderCornerButtons()}
                ${this.label ? html`<div class="overlay-label">${this.label}</div>` : ''}
            </div>
            ${this._renderEvents()}
            ${this._popupOpen ? this._renderPopup() : ''}`;
    }

    // Note: the popup renders a second feed instance — for mjpeg that opens a
    // second stream connection while the popup is open; webrtc attaches the
    // SAME MediaStream to both videos (no second WHEP session).
    _renderPopup() {
        const still = this._popupStill;
        const type = still ? 'image' : this._popupEffType();
        const src = this._popupFeedSrc();
        return html`
            <div class="popup" popover="manual" @click="${this._popupClick}">
                ${this._feedMarkup(src, type)}
                ${this.popupCloseButton ? html`
                    <button class="close" title="Close" @click="${e => { e.stopPropagation(); this._closePopup(); }}">✕</button>` : ''}
                ${this.label ? html`<div class="overlay-label">${this.label}</div>` : ''}
            </div>`;
    }

    updated(changed) {
        super.updated(changed);
        if (this.isConnected && this.__wireSig !== undefined && this._wireSignature() !== this.__wireSig) {
            this._unsubscribe();
            this._wireSubscriptions();
        }
        // pause-when-hidden toggled live (editor preview / dynamic override):
        // (dis)connect the observer and, when turned off, resume immediately.
        if (changed.has('pauseWhenHidden')) {
            if (this.pauseWhenHidden) {
                this._startVisibilityWatch();
            } else {
                this._stopVisibilityWatch();
                if (this._streamPaused) { this._streamPaused = false; this._startRefreshTimer(); }
            }
        }
        // webrtc: (re)negotiate whenever the source or type changes — covers
        // the initial mount (_activeSrc is set in connectedCallback) and MQTT
        // driven src switches — and tear down / restore on the pause toggle.
        if (changed.has('type') || changed.has('src') || changed.has('_activeSrc') || changed.has('_streamPaused')) {
            if (this.type === 'webrtc' && !this._streamPaused) {
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

customElements.define('feezal-element-basic-camera', FeezalElementBasicCamera);
export {FeezalElementBasicCamera};

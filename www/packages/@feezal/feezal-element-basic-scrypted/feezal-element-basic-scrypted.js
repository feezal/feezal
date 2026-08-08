/* global feezal */
import {FeezalElement, html, css} from '@feezal/feezal-element';

// Query params this element owns on the NVR card URL. Anything else the user
// pasted (imageClick, videoClick, scrollable, ...) is passed through untouched.
const MANAGED_PARAMS = ['live', 'destination', 'speaker', 'microphone'];

// Fragment paths of the three NVR card views. The single-camera view carries
// its id as a path segment, the multi-camera views as an `ids` query param.
const VIEW_PATHS = {live: '/iframe', grid: '/iframegrid', events: '/iframeevents'};

/**
 * Compose the iframe URL from a pasted Scrypted NVR card webpage URL plus the
 * element's knobs. Pure so the rewrite rules are testable without a DOM.
 *
 * The pasted URL looks like
 *   https://host/api/scrypted/<token>/endpoint/@scrypted/nvr/public/#/iframe/62
 * with optional query params after the fragment path. Rules:
 *   - `view` rewrites the fragment between the single view (`/iframe/<id>`),
 *     the grid (`/iframegrid?ids=...`) and the event reel (`/iframeevents`);
 *     empty keeps the pasted shape.
 *   - `cameraIds` overrides the id(s) parsed from the URL; empty keeps them.
 *   - live/destination/speaker/microphone are (re)written as params; params
 *     this element does not manage survive as pasted.
 *   - A URL without a recognizable `#/iframe...` fragment is returned as-is:
 *     never break something the user pasted deliberately.
 */
export function composeScryptedUrl(src, opts = {}) {
    if (!src) return '';
    const {view = '', cameraIds = '', live = true, destination = '', speaker = false, microphone = false} = opts;

    const hashIndex = src.indexOf('#');
    if (hashIndex === -1) return src;
    const base = src.slice(0, hashIndex);
    const fragment = src.slice(hashIndex + 1);

    const qIndex = fragment.indexOf('?');
    const path = (qIndex === -1 ? fragment : fragment.slice(0, qIndex)).replace(/\/$/, '');
    const query = qIndex === -1 ? '' : fragment.slice(qIndex + 1);

    const match = path.match(/^\/iframe(grid|events)?(?:\/([^/?]+))?$/);
    if (!match) return src;
    const pastedKind = match[1] === 'grid' ? 'grid' : (match[1] === 'events' ? 'events' : 'live');

    const params = new URLSearchParams(query);
    const ids = (cameraIds || match[2] || params.get('ids') || '')
        .split(/[\s,]+/).filter(Boolean);
    params.delete('ids');
    for (const p of MANAGED_PARAMS) params.delete(p);

    const kind = view || pastedKind;
    // The single view needs an id in the path — without one the pasted shape
    // is the only thing that can possibly work.
    if (kind === 'live' && ids.length === 0) return src;

    let newPath = VIEW_PATHS[kind];
    if (kind === 'live') newPath += '/' + ids[0];
    else if (ids.length) params.set('ids', ids.join(','));

    if (live) params.set('live', 'true');
    if (destination) params.set('destination', destination);
    if (speaker) params.set('speaker', 'on');
    if (microphone) params.set('microphone', 'on');

    const q = params.toString();
    // URLSearchParams percent-encodes the commas in ids; Scrypted's router
    // reads them literally, so put them back.
    return base + '#' + newPath + (q ? '?' + q.replace(/%2C/gi, ',') : '');
}

class FeezalElementBasicScrypted extends FeezalElement {
    static styles = [FeezalElement.styles, css`
        :host {
            position: relative;
        }
        iframe {
            border: var(--feezal-basic-scrypted-border);
            border-radius: var(--feezal-basic-scrypted-radius);
            padding: 0;
            margin: 0;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            display: block;
            background: transparent;
        }
        .hint {
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 8px;
            font-size: 12px;
            color: var(--secondary-text-color);
        }
    `];

    static get feezal() {
        return {
            palette: {category: 'Basic', name: 'Scrypted', color: '#4a6080'},
            description: 'Embeds a Scrypted NVR camera view: live stream (with optional two-way audio), ' +
                'camera grid, or event reel. Paste the NVR card webpage URL from the camera\'s ' +
                'Home Assistant settings in Scrypted. Requires the Scrypted NVR plugin; for cameras ' +
                'without NVR use the camera element with an RTSP gateway instead.',
            links: [
                {label: 'Scrypted', url: 'https://www.scrypted.app'},
                {label: 'NVR card URL format (views and parameters)', url: 'https://docs.scrypted.app/home-assistant-legacy-cards.html'},
            ],
            // E169: entities come from the server's Scrypted recognizer (it
            // watches Scrypted's own homeassistant/* configs). The NVR card
            // URL cannot travel over MQTT — the editor composes `src` from the
            // once-entered card URL (applyScryptedNvrSrc), so the map only
            // carries the device id.
            discovery: {
                component: 'scrypted-camera',
                map: {
                    camera_id: 'camera-ids',
                },
            },
            attributes: [
                {name: 'src', type: 'string', default: '',
                    help: 'The Scrypted NVR card webpage URL — in Scrypted open the camera, Settings → Home Assistant, ' +
                        'and copy the card URL (it looks like https://host/api/scrypted/<token>/endpoint/@scrypted/nvr/public/#/iframe/<id>). ' +
                        'The embedded token grants access to the camera and is stored with the dashboard — treat the site file accordingly. ' +
                        'Scrypted tokens expire (90 days by default); a feed that turns black usually means: copy a fresh URL. ' +
                        'An https dashboard cannot embed an http Scrypted — serve Scrypted over https or the browser blocks the frame.'},
                {name: 'view', type: 'select', options: ['', 'live', 'grid', 'events'], default: '',
                    help: 'Which NVR view to show: live = single camera stream, grid = multi-camera grid, ' +
                        'events = scrollable reel of detected events. Empty keeps the view of the pasted URL. ' +
                        'grid and events take the cameras from camera-ids (or the pasted URL).'},
                {name: 'camera-ids', type: 'string', default: '',
                    help: 'Scrypted device id(s), comma-separated — overrides the id(s) in the pasted URL. ' +
                        'live uses the first id; grid and events show all. Empty = ids from the URL.'},
                {name: 'live', type: 'boolean', default: true,
                    help: 'Start playing on load. Off = the view waits for a tap.'},
                {name: 'destination', type: 'select', options: ['', 'low-resolution', 'local', 'remote'], default: '',
                    help: 'Stream quality: low-resolution saves bandwidth (good for grids), local = full quality on the LAN, ' +
                        'remote = the stream Scrypted picks for remote viewers. Empty = Scrypted\'s default.'},
                {name: 'speaker', type: 'boolean', default: false,
                    help: 'Play the camera\'s audio.'},
                {name: 'microphone', type: 'boolean', default: false,
                    help: 'Enable two-way audio (talk-back). The browser will ask for microphone permission.'},
                {name: 'pause-when-hidden', type: 'boolean', default: false,
                    help: 'Unload the NVR view while the element is off-screen — its view is hidden, it is scrolled ' +
                        'out of sight, or the browser tab is in the background — and restore it when it shows again. ' +
                        'Frees the bandwidth and CPU a live stream keeps using otherwise. Viewer only; the editor ' +
                        'always shows the view.'},
                {name: 'subscribe', type: 'mqttTopic',
                    help: 'Optional: a message on this topic replaces the src URL (dynamic camera switching).'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Property of the subscribe message that carries the URL (default payload).'},
            ],
            baseAttribute: 'src',
            styles: [
                'top', 'left', 'width', 'height',
                '--feezal-basic-scrypted-border',
                '--feezal-basic-scrypted-radius',
            ],
            defaultStyle: {width: '320px', height: '180px'},
            restrict: {minWidth: 40, minHeight: 30},
        };
    }

    static properties = {
        src:             {type: String,  reflect: true},
        view:            {type: String,  reflect: true},
        cameraIds:       {type: String,  reflect: true, attribute: 'camera-ids'},
        live:            {type: Boolean, reflect: true},
        destination:     {type: String,  reflect: true},
        speaker:         {type: Boolean, reflect: true},
        microphone:      {type: Boolean, reflect: true},
        pauseWhenHidden: {type: Boolean, reflect: true, attribute: 'pause-when-hidden'},
        _streamPaused:   {state: true},
    };

    constructor() {
        super();
        this.src             = '';
        this.view            = '';
        this.cameraIds       = '';
        this.live            = true;
        this.destination     = '';
        this.speaker         = false;
        this.microphone      = false;
        this.pauseWhenHidden = false;
        this._streamPaused   = false;
        this.__io            = null;
        this.__intersecting  = true;
        this.__onDocVisibility = () => this._recomputeVisibility();
    }

    connectedCallback() {
        super.connectedCallback();
        this._startVisibilityWatch();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopVisibilityWatch();
    }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('pauseWhenHidden')) {
            if (this.pauseWhenHidden) {
                this._startVisibilityWatch();
            } else {
                this._stopVisibilityWatch();
                this._streamPaused = false;
            }
        }
    }

    // pause-when-hidden — the basic-camera semantics: on-screen state
    // (IntersectionObserver) plus tab visibility tear the iframe down while
    // off-screen. Viewer only; the editor always shows the view so the
    // element stays designable on the canvas.

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
        if (!this.__io) return;
        this._streamPaused = this.__intersecting === false || document.hidden;
    }

    render() {
        const url = composeScryptedUrl(this.src, {
            view: this.view,
            cameraIds: this.cameraIds,
            live: this.live,
            destination: this.destination,
            speaker: this.speaker,
            microphone: this.microphone,
        });
        if (!url) {
            // Unconfigured: guide in the editor, stay blank in the viewer.
            return feezal.isEditor
                ? html`<div class="hint">Scrypted NVR — paste the camera's NVR card webpage URL into src</div>`
                : html``;
        }
        if (this._streamPaused) return html``;
        const allow = 'autoplay; fullscreen' + (this.microphone ? '; microphone' : '');
        return html`<iframe src="${url}" allow="${allow}" allowfullscreen></iframe>`;
    }
}

customElements.define('feezal-element-basic-scrypted', FeezalElementBasicScrypted);
export {FeezalElementBasicScrypted};

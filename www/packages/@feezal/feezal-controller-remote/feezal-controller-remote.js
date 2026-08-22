/* global feezal */
/**
 * @feezal/feezal-controller-remote (E187, per the E137 architecture)
 *
 * The TV-remote behaviour as a Lit Reactive Controller, shared by
 * glass/metro/circle-remote so the three cannot drift. Speaks the
 * lgtv2mqtt contract (github.com/hobbyquaker/lgtv2mqtt, prefix = `--name`,
 * default `lgtv`):
 *
 *   <prefix>/set/button     key NAME, uppercased (HOME, BACK, UP, ENTER, 0-9, …)
 *   <prefix>/set/launch     an app id (netflix, youtube.leanback.v4, com.webos.app.hdmi1 …)
 *   <prefix>/set/output     sound output (tv_speaker, external_arc, bt_soundbar …)
 *   <prefix>/set/volume     0-100          <prefix>/set/mute  true/false
 *   <prefix>/set/toast      on-screen text
 *   <prefix>/set/<anything> forwarded to the TV as an ssap path (catch-all)
 *   <prefix>/status/{volume,mute,output,foregroundApp}
 *
 * The element's `publish` attribute is the SET BASE (`lgtv/set`); every
 * action appends its segment — the same shape the media controller's topic
 * mode uses. Any other bridge with a one-topic-per-action set tree works the
 * same way.
 *
 * The built-in pad (D-pad, navigation keys, volume/channel rockers, and in
 * the large layout the number and colour keys) is the fixed part every
 * remote has. Everything beyond it — app shortcuts, inputs, sound outputs,
 * arbitrary ssap paths — is the `buttons` LIST (U104 list editor): one row per
 * button, `kind` decides the topic segment. That is the "configurable button
 * set" without a bespoke schema per button type. App ids are per-TV and the
 * bridge publishes no app list, so the defaults are the well-known ids and
 * the user corrects them; app LOGOS are trademarks feezal must not bundle —
 * rows ship with neutral glyphs and an `image` field for the user's own
 * asset.
 *
 * `foregroundApp` highlights the matching app row; `output` / `volume` /
 * `mute` reflect the TV so the remote is not write-only.
 */
import {css, html} from '@feezal/feezal-element';

/** Button row kinds → the set-topic segment they publish to. */
export const REMOTE_KINDS = ['button', 'app', 'output', 'raw'];

export const REMOTE_LAYOUTS = ['compact', 'large'];

/**
 * The default extra rows: well-known webOS app ids. Per-TV ids may differ
 * (the bridge publishes no app list) — the user edits the list. Neutral
 * glyphs only; the `image` field takes the user's own logo asset.
 */
export const DEFAULT_REMOTE_BUTTONS = [
    {kind: 'app', label: 'Netflix',  icon: 'movie',          payload: 'netflix'},
    {kind: 'app', label: 'YouTube',  icon: 'smart_display',  payload: 'youtube.leanback.v4'},
    {kind: 'app', label: 'Prime',    icon: 'local_movies',   payload: 'amazon'},
    {kind: 'app', label: 'Disney+',  icon: 'auto_awesome',   payload: 'com.disney.disneyplus-prod'},
    {kind: 'app', label: 'waipu',    icon: 'live_tv',        payload: 'de.exaring.waipu'},
    {kind: 'app', label: 'HDMI 1',   icon: 'input',          payload: 'com.webos.app.hdmi1'},
];

/** The fixed pad keys, by group — names are the lgtv2mqtt button names. */
export const PAD_KEYS = {
    nav:     ['BACK', 'HOME', 'EXIT'],
    dpad:    {up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', ok: 'ENTER'},
    volume:  {up: 'VOLUMEUP', down: 'VOLUMEDOWN', mute: 'MUTE'},
    channel: {up: 'CHANNELUP', down: 'CHANNELDOWN'},
    // large layout only
    digits:  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    colours: ['RED', 'GREEN', 'YELLOW', 'BLUE'],
    extra:   ['MENU', 'CC', 'DASH'],
};

/** Shared attribute descriptors — spread into every family's `feezal.attributes`. */
export const remoteAttributes = [
    {name: 'publish', type: 'mqttTopic',
        help: 'Set BASE topic of the bridge, e.g. lgtv/set — every key appends its segment (…/button, …/launch, …/output, …/volume, …/mute).'},
    {name: 'layout', type: 'select', options: REMOTE_LAYOUTS, default: 'compact',
        help: 'compact = D-pad, back/home/exit, volume + channel rockers. large adds the number keys, colour keys and the app / input / output rows from the buttons list.'},
    {name: 'buttons', type: 'objectList', default: JSON.stringify(DEFAULT_REMOTE_BUTTONS), itemFields: [
        {key: 'kind', type: 'select', options: REMOTE_KINDS},
        {key: 'label', placeholder: 'label'},
        {key: 'icon', placeholder: 'icon (e.g. movie, mdi:netflix)'},
        {key: 'image', placeholder: 'image asset path (your own logo)'},
        {key: 'payload', placeholder: 'app id / key / output / payload'},
        {key: 'topic', placeholder: 'raw: segment under the set base'},
    ],
        help: 'Extra buttons (shown in the large layout, and in compact when show-buttons is on). kind: button → …/button with the key NAME; app → …/launch with the app id (per-TV — the bridge publishes no list; edit the defaults); output → …/output with the sound output; raw → …/<topic> with the payload. App logos are trademarks feezal does not ship — put your own image asset in "image".'},
    {name: 'show-buttons', type: 'boolean', default: false,
        help: 'Also show the buttons list rows in the compact layout.'},
    {name: 'subscribe-volume', type: 'mqttTopic', help: 'Status topic for the TV volume (0-100), e.g. lgtv/status/volume.'},
    {name: 'message-property-volume', type: 'string', default: 'payload',
        help: 'Dot-notation path to the volume within the message (a {"val":…} bridge → payload.val). Default: payload'},
    {name: 'subscribe-mute', type: 'mqttTopic', help: 'Status topic for the mute state, e.g. lgtv/status/mute.'},
    {name: 'message-property-mute', type: 'string', default: 'payload',
        help: 'Dot-notation path to the mute state within the message. Default: payload'},
    {name: 'subscribe-output', type: 'mqttTopic', help: 'Status topic for the sound output, e.g. lgtv/status/output — highlights the matching output row.'},
    {name: 'message-property-output', type: 'string', default: 'payload',
        help: 'Dot-notation path to the output within the message. Default: payload'},
    {name: 'subscribe-app', type: 'mqttTopic', help: 'Status topic for the foreground app, e.g. lgtv/status/foregroundApp — highlights the matching app row.'},
    {name: 'message-property-app', type: 'string', default: 'payload',
        help: 'Dot-notation path to the app id within the message (lgtv2mqtt: payload.appId when the bridge publishes the object). Default: payload'},
    {name: 'show-volume', type: 'boolean', default: true, help: 'Show the volume slider row (needs publish; reflects subscribe-volume).'},
];

/** Attribute names this controller consumes (parity-set derivation, E114). */
export const REMOTE_CONSUMED_ATTRIBUTES = remoteAttributes.map(a => a.name);

/**
 * B130 — shared discovery.map fragment. Keys are the recognizer's config keys
 * (server/src/mqtt/recognizers/lgtv.js): the set BASE plus the four status
 * topics. Availability is stamped by the generic machinery.
 */
export const remoteDiscoveryMap = {
    name:               'label',
    command_base_topic: 'publish',
    volume_topic:       'subscribe-volume',
    mute_topic:         'subscribe-mute',
    output_topic:       'subscribe-output',
    app_topic:          'subscribe-app',
};

/**
 * E190 — landscape detection with hysteresis (the layout-app rail pattern):
 * a card goes landscape above ASPECT_WIDE and back to portrait only below
 * ASPECT_TALL, so a drag-resize hovering on the boundary never flickers.
 * Measured on the ELEMENT, not the viewport.
 */
export const ASPECT_WIDE = 1.35;
export const ASPECT_TALL = 1.15;
export function nextLandscape(landscape, width, height) {
    if (!width || !height) return landscape;
    const ratio = width / height;
    if (landscape) return ratio >= ASPECT_TALL;
    return ratio >= ASPECT_WIDE;
}

/** Loose truthiness over the payload dialects bridges use. */
function truthy(v) {
    if (v === true || v === 1) return true;
    const s = String(v ?? '').trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'on' || s === 'yes';
}

/** Parse the buttons list attribute (JSON array); invalid/empty → the defaults. */
export function parseRemoteButtons(raw) {
    if (raw === null || raw === undefined || String(raw).trim() === '') return DEFAULT_REMOTE_BUTTONS;
    try {
        const list = JSON.parse(raw);
        if (!Array.isArray(list)) return DEFAULT_REMOTE_BUTTONS;
        return list
            .filter(r => r && typeof r === 'object')
            .map(r => ({
                kind: REMOTE_KINDS.includes(r.kind) ? r.kind : 'button',
                label: String(r.label ?? ''),
                icon: String(r.icon ?? ''),
                image: String(r.image ?? ''),
                payload: String(r.payload ?? ''),
                topic: String(r.topic ?? ''),
            }));
    } catch {
        return DEFAULT_REMOTE_BUTTONS;
    }
}

export class RemoteController {
    /** @param {import('lit').ReactiveControllerHost & HTMLElement} host */
    constructor(host) {
        this.host = host;
        host.addController?.(this);
        this._reset();
    }

    _reset() {
        this.volume = null;   // 0-100
        this.muted = false;
        this.output = null;   // sound output id
        this.app = null;      // foreground app id
        this.landscape = false;   // E190: wider than tall → groups side by side
    }

    _attr(name, fallback = '') {
        const v = this.host.getAttribute(name);
        return v === null || v === '' ? fallback : v;
    }

    get layout() { return this._attr('layout', 'compact') === 'large' ? 'large' : 'compact'; }
    get large() { return this.layout === 'large'; }
    get buttons() { return parseRemoteButtons(this.host.getAttribute('buttons')); }
    get showVolume() { return this._attr('show-volume', 'true') !== 'false'; }
    /** The list rows render in large, or in compact with show-buttons on. */
    get showButtons() { return this.large || this._attr('show-buttons', 'false') === 'true'; }

    /** Is this list row the TV's current state (app / output)? */
    isActive(row) {
        if (row.kind === 'app') return Boolean(this.app) && String(this.app) === String(row.payload);
        if (row.kind === 'output') return Boolean(this.output) && String(this.output) === String(row.payload);
        return false;
    }

    signature() {
        return ['subscribe-volume', 'subscribe-mute', 'subscribe-output', 'subscribe-app']
            .map(a => this._attr(a)).join('|');
    }

    hostConnected() {
        this.wire();
        this._observeAspect();
    }

    hostDisconnected() {
        this._ro?.disconnect();
        this._ro = null;
    }

    /** E190: watch the element's own box; flip the arrangement with hysteresis. */
    _observeAspect() {
        if (typeof ResizeObserver === 'undefined' || this._ro) return;
        this._ro = new ResizeObserver(entries => {
            const box = entries[0]?.contentRect;
            this.setAspect(box?.width, box?.height);
        });
        this._ro.observe(this.host);
    }

    /** E190: apply a measured size (also the test seam). */
    setAspect(width, height) {
        const next = nextLandscape(this.landscape, width, height);
        if (next !== this.landscape) {
            this.landscape = next;
            this.host.requestUpdate?.();
        }
    }

    wire() {
        this.__sig = this.signature();
        const byTopic = new Map();
        const on = (attrName, handler) => {
            const topic = this._attr(attrName);
            if (!topic) return;
            if (!byTopic.has(topic)) byTopic.set(topic, []);
            byTopic.get(topic).push(handler);
        };
        const path = attr => this._attr(attr, 'payload');
        const str = v => (v === null || v === undefined || String(v).trim() === '') ? null : String(v).trim();

        on('subscribe-volume', msg => {
            const n = Number(this.host.getProperty(msg, path('message-property-volume')));
            if (Number.isFinite(n)) this.volume = Math.max(0, Math.min(100, n));
        });
        on('subscribe-mute', msg => { this.muted = truthy(this.host.getProperty(msg, path('message-property-mute'))); });
        on('subscribe-output', msg => { this.output = str(this.host.getProperty(msg, path('message-property-output'))); });
        on('subscribe-app', msg => {
            const v = this.host.getProperty(msg, path('message-property-app'));
            // lgtv2mqtt's foregroundApp carries {appId, windowId, processId} —
            // accept the object shape without forcing the path onto the user.
            this.app = str(v && typeof v === 'object' ? v.appId : v);
        });

        for (const [topic, handlers] of byTopic) {
            this.host.addSubscription(topic, msg => {
                for (const h of handlers) h(msg);
                this.host.requestUpdate();
            });
        }
    }

    rewireIfChanged() {
        if (this.__sig !== undefined && this.signature() !== this.__sig) {
            this._reset();
            this.host._unsubscribe();
            this.wire();
        }
    }

    // ── publishing (every path guarded against editor mode) ─────────────────

    _pub(segment, payload) {
        const base = this._attr('publish');
        if (feezal.isEditor || !base || !segment) return;
        feezal.connection?.pub?.(`${base}/${segment}`, payload);
    }

    /** A remote key — the name is uppercased the way the bridge expects. */
    press(key) {
        const k = String(key ?? '').trim();
        if (!k) return;
        this._pub('button', k.toUpperCase());
    }

    launch(appId) { if (appId) this._pub('launch', String(appId)); }
    setOutput(output) { if (output) { this.output = String(output); this._pub('output', String(output)); this.host.requestUpdate?.(); } }
    raw(segment, payload) { this._pub(String(segment ?? '').replace(/^\/+|\/+$/g, ''), String(payload ?? '')); }

    setVolume(v) {
        const n = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
        this.volume = n;
        this._pub('volume', String(n));
        this.host.requestUpdate?.();
    }

    toggleMute() {
        this.muted = !this.muted;
        this._pub('mute', this.muted ? 'true' : 'false');
        this.host.requestUpdate?.();
    }

    /** Run a buttons-list row. */
    run(row) {
        switch (row.kind) {
            case 'app':    return this.launch(row.payload);
            case 'output': return this.setOutput(row.payload);
            case 'raw':    return this.raw(row.topic, row.payload);
            default:       return this.press(row.payload);
        }
    }
}

// ── shared pad markup ────────────────────────────────────────────────────────
// The families differ in chrome (frost / flat tile / disc), not in the pad:
// one template, family-styled through the class names below.

/** Structural styles every family composes; colours/sizes come from the family. */
export const remotePadStyles = css`
    .pad { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .row { display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap; }
    .key {
        display: inline-flex; align-items: center; justify-content: center; gap: 4px;
        border: none; cursor: pointer; color: inherit; font: inherit; line-height: 1;
        min-width: 36px; height: 32px; padding: 0 8px; border-radius: 8px;
        background: var(--_remote-key-bg, rgba(128,128,128,0.18));
        user-select: none; -webkit-tap-highlight-color: transparent;
    }
    .key:hover { background: var(--_remote-key-hover-bg, rgba(128,128,128,0.3)); }
    .key:active { transform: scale(0.95); }
    .key.active { background: var(--_remote-key-active-bg, var(--primary-color)); color: var(--_remote-key-active-color, #fff); }
    .key .mi { font-family: 'Material Icons'; font-style: normal; font-size: 18px; line-height: 1; }
    .key img { height: 18px; width: auto; max-width: 48px; object-fit: contain; }
    .dpad {
        display: grid; grid-template: 'tl up tr' 'left ok right' 'bl down br' / 1fr 1fr 1fr;
        gap: 4px; width: var(--_remote-dpad-size, 132px); aspect-ratio: 1; margin: 0 auto;
    }
    .dpad .key { height: auto; min-width: 0; padding: 0; border-radius: 10px; }
    .dpad .up { grid-area: up; } .dpad .down { grid-area: down; }
    .dpad .left { grid-area: left; } .dpad .right { grid-area: right; }
    .dpad .ok { grid-area: ok; border-radius: 50%; font-weight: 700; font-size: 12px; }
    .rockers { display: flex; justify-content: center; gap: 14px; }
    .rocker { display: flex; flex-direction: column; align-items: center; gap: 3px; }
    .rocker .cap { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.7; }
    .digits { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; max-width: 150px; margin: 0 auto; }
    .digits .key:last-child { grid-column: 2; }
    .colours .key { min-width: 28px; height: 14px; padding: 0; border-radius: 7px; }
    .colours .RED { background: #e53935; } .colours .GREEN { background: #43a047; }
    .colours .YELLOW { background: #fdd835; } .colours .BLUE { background: #1e88e5; }
    .vol-row { display: flex; align-items: center; gap: 6px; }
    .vol-row input[type="range"] { flex: 1; min-width: 0; accent-color: var(--_remote-key-active-bg, var(--primary-color)); }
    .apps .key { height: 36px; }
    /* E190 — portrait: the groups stack (the columns are transparent).
       Landscape (wider than tall, with hysteresis): the same groups sit side
       by side — D-pad left, rockers + number pad centre, shortcuts + volume
       right — so the D-pad stays thumb-reachable instead of the remote
       becoming a thin strip. A re-flow, never new groups. */
    .col { display: contents; }
    .pad.landscape { flex-direction: row; align-items: flex-start; justify-content: space-evenly; gap: 12px; }
    .pad.landscape .col { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 0 1 auto; }
    .pad.landscape .col:empty { display: none; }
    .pad.landscape .col.right { flex: 1 1 0; max-width: 40%; }
    .pad.landscape .apps { justify-content: flex-start; }
`;

/**
 * The pad template. `r` is the RemoteController; `layout` override lets the
 * metro tile force compact on a small tile.
 */
export function remotePad(r, {layout = r.layout, showVolume = r.showVolume, showButtons = r.showButtons} = {}) {
    const large = layout === 'large';
    const key = (name, content, cls = '') => html`
        <button class="key ${cls} ${name}" title="${name}" @click="${() => r.press(name)}">${content}</button>`;
    const mi = n => html`<span class="mi">${n}</span>`;
    const D = PAD_KEYS.dpad, V = PAD_KEYS.volume, C = PAD_KEYS.channel;
    return html`
        <div class="pad ${layout} ${r.landscape ? 'landscape' : ''}">
            <div class="col left">
            <div class="row nav">
                ${key(PAD_KEYS.nav[0], mi('arrow_back'))}
                ${key(PAD_KEYS.nav[1], mi('home'))}
                ${key(PAD_KEYS.nav[2], mi('close'))}
                ${large ? key('MENU', mi('menu')) : ''}
            </div>
            <div class="dpad">
                ${key(D.up, mi('keyboard_arrow_up'), 'up')}
                ${key(D.left, mi('keyboard_arrow_left'), 'left')}
                ${key(D.ok, 'OK', 'ok')}
                ${key(D.right, mi('keyboard_arrow_right'), 'right')}
                ${key(D.down, mi('keyboard_arrow_down'), 'down')}
            </div>
            </div>
            <div class="col mid">
            <div class="rockers">
                <div class="rocker"><span class="cap">Vol</span>
                    ${key(V.up, mi('add'))}
                    ${key(V.mute, mi(r.muted ? 'volume_off' : 'volume_mute'), r.muted ? 'active' : '')}
                    ${key(V.down, mi('remove'))}
                </div>
                <div class="rocker"><span class="cap">Ch</span>
                    ${key(C.up, mi('keyboard_arrow_up'))}
                    ${key(C.down, mi('keyboard_arrow_down'))}
                </div>
            </div>
            ${large ? html`
                <div class="digits">${PAD_KEYS.digits.map(d => key(d, d))}</div>
                <div class="row colours">${PAD_KEYS.colours.map(c => key(c, ''))}</div>
            ` : ''}
            </div>
            <div class="col right">
            ${showButtons && r.buttons.length ? html`
                <div class="row apps">
                    ${r.buttons.map(b => html`
                        <button class="key ${r.isActive(b) ? 'active' : ''}" title="${b.label || b.payload}"
                            @click="${() => r.run(b)}">
                            ${b.image ? html`<img src="${b.image}" alt="">`
                                : b.icon ? html`<feezal-icon name="${b.icon}"></feezal-icon>` : ''}
                            ${b.label ? html`<span>${b.label}</span>` : ''}
                        </button>`)}
                </div>
            ` : ''}
            ${showVolume ? html`
                <div class="vol-row">
                    <button class="key ${r.muted ? 'active' : ''}" title="${r.muted ? 'Unmute' : 'Mute'}" @click="${() => r.toggleMute()}">
                        ${mi(r.muted ? 'volume_off' : 'volume_up')}
                    </button>
                    <input type="range" min="0" max="100" step="1"
                        .value="${String(r.volume ?? (feezal.isEditor ? 30 : 0))}"
                        @change="${e => r.setVolume(e.target.value)}">
                    <span class="cap">${r.volume ?? ''}</span>
                </div>
            ` : ''}
            </div>
        </div>`;
}

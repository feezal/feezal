/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {svg, LitElement} from 'lit';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/icon/icon.js';
import '@material/web/slider/slider.js';

// ─── SVG frame geometry ───────────────────────────────────────────────────────
const FX = 4, FY = 4, FW = 52, FH = 62; // window frame origin / size in SVG space

// ─── Element ──────────────────────────────────────────────────────────────────
class FeezalElementMaterialShutter extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Shutter', category: 'Device', color: '#37474f', icon: 'blinds'},
            description: 'Window shutter / blind control card. Visualises position as a sliding shutter panel, provides up/stop/down commands, direct position setting, and optional venetian-blind tilt control.',
            // ── N6 custom inspector ───────────────────────────────────────────
            inspector: 'feezal-element-material-shutter-inspector',
            // ── N12 Auto-Discovery descriptor ─────────────────────────────────
            // zigbee2mqtt covers (and HA cover entities) use a consolidated JSON
            // base-topic for state and a /set topic for commands. The element
            // defaults payload-mode to 'json' so auto-configured covers work
            // out of the box; hand-wired separate-topic setups switch to
            // 'separate' in the inspector.
            discovery: {
                component: 'cover',
                map: {
                    // JSON wiring — base topic + /set command topic
                    state_topic:        {attr: 'subscribe'},
                    command_topic:      {attr: 'publish'},
                    // command payloads
                    payload_open:       {attr: 'payload-up'},
                    payload_close:      {attr: 'payload-down'},
                    payload_stop:       {attr: 'payload-stop'},
                    // tilt / slat angle support
                    tilt_status_topic:  {attr: 'slat-angle'},
                    tilt_command_topic: {attr: 'publish-slat-angle'},
                    // availability
                    availability_topic: {attr: 'subscribe-availability'},
                    // device name → label
                    name: 'label',
                },
            },
            attributes: [
                // ── Wiring mode ───────────────────────────────────────────────
                {name: 'payload-mode', type: 'select', options: ['json', 'separate'], default: 'json',
                    help: 'json = single topic carrying a JSON object (default, matches zigbee2mqtt); separate = one topic per property.'},
                {name: 'subscribe', type: 'mqttTopic', help: 'json mode: base topic carrying the cover state (position, tilt, …).'},
                {name: 'publish',   type: 'mqttTopic', help: 'json mode: command/set topic (accepts {position:50} or {state:"OPEN"}).'},
                {name: 'json-map',  type: 'string', default: '', help: 'json mode: optional JSON string overriding the default key map.'},
                // ── Separate-mode per-property topics ─────────────────────────
                {name: 'subscribe-position', type: 'mqttTopic', help: 'separate mode: current position (0=closed, 100=open).'},
                {name: 'publish-position',   type: 'mqttTopic', help: 'separate mode: target position topic.'},
                {name: 'publish-command',    type: 'mqttTopic', help: 'separate mode: up/stop/down command topic.'},
                // ── Command payloads ──────────────────────────────────────────
                {name: 'payload-up',   type: 'string', default: 'UP',   help: 'Payload sent by the Up button.'},
                {name: 'payload-stop', type: 'string', default: 'STOP', help: 'Payload sent by the Stop button.'},
                {name: 'payload-down', type: 'string', default: 'DOWN', help: 'Payload sent by the Down button.'},
                // ── Tilt / slat angle ─────────────────────────────────────────
                {name: 'slat-angle',         type: 'mqttTopic', help: 'Subscribe: venetian-blind tilt/slat angle (0–100). Slat lines rotate in the SVG.'},
                {name: 'publish-slat-angle', type: 'mqttTopic', help: 'Publish: topic to publish new slat angle to (0–100).'},
                // ── Display ───────────────────────────────────────────────────
                {name: 'invert',        type: 'boolean', default: false, help: 'Invert position scale: 0=open, 100=closed.'},
                {name: 'show-position', type: 'boolean', default: true,  help: 'Show the numeric position label below the window.'},
                {name: 'slat-count',    type: 'number',  default: 6,     help: 'Number of horizontal slat lines rendered in the SVG shutter panel.'},
                {name: 'label',         type: 'string',  default: '',    help: 'Optional card title shown at the bottom.'},
                // ── Availability ──────────────────────────────────────────────
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Optional availability topic. A badge appears when unavailable; controls stay enabled.'},
                {name: 'payload-available',      type: 'string', default: 'online',  help: 'Payload meaning the device is online.'},
                {name: 'payload-unavailable',    type: 'string', default: 'offline', help: 'Payload meaning the device is offline.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                // Theme-aware colour tokens. Leave blank to inherit from theme.
                {property: '--feezal-shutter-frame-color', type: 'color', default: 'var(--primary-text-color)',
                    help: 'Window frame, dividers, and slat line colour.'},
                {property: '--feezal-shutter-panel-color', type: 'color', default: 'var(--secondary-background-color)',
                    help: 'Shutter panel fill colour.'},
                {property: '--feezal-shutter-text-color',  type: 'color', default: 'var(--primary-text-color)',
                    help: 'Position label and button icon colour.'},
                {property: '--feezal-shutter-error-color', type: 'color', default: 'var(--error-color)',
                    help: 'Colour of the unavailability badge.'},
            ],
            restrict:     {minWidth: 80, minHeight: 100},
            defaultStyle: {width: '120px', height: '160px'},
        };
    }

    static properties = {
        payloadMode:           {type: String,  reflect: true, attribute: 'payload-mode'},
        subscribe:             {type: String,  reflect: true},
        publish:               {type: String,  reflect: true},
        jsonMap:               {type: String,  reflect: true, attribute: 'json-map'},
        subscribePosition:     {type: String,  reflect: true, attribute: 'subscribe-position'},
        publishPosition:       {type: String,  reflect: true, attribute: 'publish-position'},
        publishCommand:        {type: String,  reflect: true, attribute: 'publish-command'},
        payloadUp:             {type: String,  reflect: true, attribute: 'payload-up'},
        payloadStop:           {type: String,  reflect: true, attribute: 'payload-stop'},
        payloadDown:           {type: String,  reflect: true, attribute: 'payload-down'},
        slatAngle:             {type: String,  reflect: true, attribute: 'slat-angle'},
        publishSlatAngle:      {type: String,  reflect: true, attribute: 'publish-slat-angle'},
        invert:                {type: Boolean, reflect: true},
        showPosition:          {type: Boolean, reflect: true, attribute: 'show-position'},
        slatCount:             {type: Number,  reflect: true, attribute: 'slat-count'},
        label:                 {type: String,  reflect: true},
        subscribeAvailability: {type: String,  reflect: true, attribute: 'subscribe-availability'},
        payloadAvailable:      {type: String,  reflect: true, attribute: 'payload-available'},
        payloadUnavailable:    {type: String,  reflect: true, attribute: 'payload-unavailable'},
        discoveryId:           {type: String,  reflect: true, attribute: 'discovery-id'},
        // Internal state — never as class fields (Lit 3 rule)
        _position:    {state: true},   // 0–100, null = unknown
        _tilt:        {state: true},   // 0–100 slat tilt, null = not configured
        _available:   {state: true},   // device availability
        _dragPos:     {state: true},   // live position during SVG drag
        _showSlider:  {state: true},   // toggle inline position slider
        _showTilt:    {state: true},   // toggle inline tilt slider
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 6px;
            box-sizing: border-box;
            overflow: hidden;
            gap: 4px;
            position: relative;

            /* ── Theme-aware colour tokens ───────────────────────────────────
               Four overridable colours, each defaulting to a feezal/HA theme
               variable (with a literal fallback). Override per-element via the
               Style inspector or a theme rule.                              */
            --feezal-shutter-frame-color: var(--primary-text-color,        var(--feezal-color, #333));
            --feezal-shutter-panel-color: var(--secondary-background-color, var(--feezal-bg-sub, #ddd));
            --feezal-shutter-text-color:  var(--primary-text-color,        var(--feezal-color, #333));
            --feezal-shutter-error-color: var(--error-color, #b00020);

            /* MD3 bridge — icon buttons follow the shutter theme */
            --md-sys-color-on-surface:         var(--feezal-shutter-text-color);
            --md-sys-color-on-surface-variant: var(--feezal-shutter-text-color);
            --md-icon-button-icon-color:        var(--feezal-shutter-text-color);
            --md-icon-button-hover-icon-color:  var(--feezal-shutter-text-color);
            --md-sys-color-primary:             var(--feezal-shutter-frame-color);
            --md-slider-active-track-color:     var(--feezal-shutter-frame-color);
            --md-slider-handle-color:           var(--feezal-shutter-frame-color);
            --md-slider-inactive-track-color:   var(--feezal-shutter-panel-color);
        }
        .unavail {
            position: absolute;
            top: 4px; right: 4px;
            width: 18px; height: 18px;
            color: var(--feezal-shutter-error-color);
            opacity: 0.8; pointer-events: none; z-index: 2;
        }
        .unavail svg { width: 100%; height: 100%; display: block; }
        .window-wrap {
            width: 100%;
            flex: 1;
            min-height: 0;
        }
        svg.window {
            width: 100%; height: 100%;
            overflow: visible;
            touch-action: none;
            user-select: none;
            display: block;
        }
        .btn-row {
            display: flex;
            align-items: center;
            gap: 0;
        }
        /* tighten up MD icon buttons for a compact card */
        md-icon-button { --md-icon-button-state-layer-size: 32px; }
        .editor-btns {
            display: flex; gap: 8px; align-items: center;
            font-size: 16px; opacity: 0.55;
            color: var(--feezal-shutter-text-color);
        }
        .pos-wrap {
            display: flex; align-items: center; gap: 4px; width: 100%;
            justify-content: center;
        }
        .pos-label {
            font-size: 12px; min-width: 32px; text-align: center;
            color: var(--feezal-shutter-text-color);
            cursor: pointer;
        }
        md-slider { flex: 1; max-width: 80px; }
        .tilt-wrap {
            display: flex; align-items: center; gap: 4px; width: 100%;
        }
        .tilt-label {
            font-size: 10px; opacity: 0.6; min-width: 28px;
            color: var(--feezal-shutter-text-color);
        }
        .label {
            font-size: 11px; opacity: 0.65; text-align: center;
            color: var(--feezal-shutter-text-color);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;
        }
    `];

    constructor() {
        super();
        this.payloadMode           = 'json';
        this.subscribe             = '';
        this.publish               = '';
        this.jsonMap               = '';
        this.subscribePosition     = '';
        this.publishPosition       = '';
        this.publishCommand        = '';
        this.payloadUp             = 'UP';
        this.payloadStop           = 'STOP';
        this.payloadDown           = 'DOWN';
        this.slatAngle             = '';
        this.publishSlatAngle      = '';
        this.invert                = false;
        this.showPosition          = true;
        this.slatCount             = 6;
        this.label                 = '';
        this.subscribeAvailability = '';
        this.payloadAvailable      = 'online';
        this.payloadUnavailable    = 'offline';
        this.discoveryId           = '';
        this._position             = null;
        this._tilt                 = null;
        this._available            = true;
        this._dragPos              = null;
        this._showSlider           = false;
        this._showTilt             = false;
    }

    // The shutter manages all subscriptions itself; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    connectedCallback() {
        super.connectedCallback();
        if (feezal.isEditor) return;

        // Availability — always, independent of payload mode.
        if (this.subscribeAvailability) {
            this.addSubscription(this.subscribeAvailability, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                const s = String(v).toLowerCase();
                this._available = v === this.payloadAvailable ||
                    (s !== String(this.payloadUnavailable).toLowerCase() &&
                     s !== 'offline' && s !== 'false' && s !== '0' && s !== 'unavailable');
            });
        }

        if (this.payloadMode === 'json') {
            if (this.subscribe) {
                this.addSubscription(this.subscribe, msg => {
                    let obj = this.getProperty(msg, this.messageProperty);
                    if (typeof obj === 'string') {
                        try { obj = JSON.parse(obj); } catch { return; }
                    }
                    if (obj && typeof obj === 'object') this._applyJsonState(obj);
                });
            }
            return;
        }

        // ── Separate (per-topic) mode ──────────────────────────────────────
        if (this.subscribePosition) {
            this.addSubscription(this.subscribePosition, msg => {
                const v = Number(this.getProperty(msg, this.messageProperty));
                if (!isNaN(v)) this._position = Math.max(0, Math.min(100, v));
            });
        }
        if (this.slatAngle) {
            this.addSubscription(this.slatAngle, msg => {
                const v = Number(this.getProperty(msg, this.messageProperty));
                if (!isNaN(v)) this._tilt = Math.max(0, Math.min(100, v));
            });
        }
    }

    // ─── JSON payload mode ────────────────────────────────────────────────────
    get _jsonMap() {
        const defaults = {state: 'state', position: 'position', tilt: 'tilt'};
        if (this.jsonMap) {
            try { return {...defaults, ...JSON.parse(this.jsonMap)}; } catch { /* fall through */ }
        }
        return defaults;
    }

    _applyJsonState(obj) {
        const map = this._jsonMap;
        const get = key => this.getProperty(obj, key);
        const pos = Number(get(map.position));
        if (!isNaN(pos)) this._position = Math.max(0, Math.min(100, pos));
        const tilt = Number(get(map.tilt));
        if (!isNaN(tilt)) this._tilt = Math.max(0, Math.min(100, tilt));
    }

    // Unified publish: json mode → single JSON object on `publish`;
    // separate mode → raw value on `topic`.
    _pub(topic, value, jsonObj) {
        if (this.payloadMode === 'json') {
            if (this.publish) feezal.connection.pub(this.publish, JSON.stringify(jsonObj));
        } else if (topic) {
            feezal.connection.pub(topic, String(value));
        }
    }

    // ─── Controls ─────────────────────────────────────────────────────────────
    _cmdUp()   { this._pub(this.publishCommand, this.payloadUp,   {[this._jsonMap.state]: 'OPEN'}); }
    _cmdStop() { this._pub(this.publishCommand, this.payloadStop, {[this._jsonMap.state]: 'STOP'}); }
    _cmdDown() { this._pub(this.publishCommand, this.payloadDown, {[this._jsonMap.state]: 'CLOSE'}); }

    _setPosition(pos) {
        const clamped = Math.max(0, Math.min(100, Math.round(Number(pos))));
        this._position  = clamped;
        this._showSlider = false;
        this._pub(this.publishPosition, clamped, {[this._jsonMap.position]: clamped});
    }

    _setTilt(tilt) {
        const clamped = Math.max(0, Math.min(100, Math.round(Number(tilt))));
        this._tilt = clamped;
        this._pub(this.publishSlatAngle, clamped, {[this._jsonMap.tilt]: clamped});
    }

    // ─── SVG drag — dragging the shutter panel sets a new position ────────────
    _onSvgPointerDown(e) {
        if (feezal.isEditor) return;
        const svgEl = e.currentTarget;
        svgEl.setPointerCapture(e.pointerId);
        const startY    = e.clientY;
        const startPos  = this._position ?? 50;
        const rect      = svgEl.getBoundingClientRect();
        const heightPx  = rect.height || 1;

        const onMove = ev => {
            const dy    = ev.clientY - startY;
            // dragging up (dy<0) → open more (position increases)
            // dragging down (dy>0) → close more (position decreases)
            const delta = (-dy / heightPx) * 100;
            this._dragPos = Math.max(0, Math.min(100, Math.round(startPos + delta)));
        };
        const onUp = () => {
            svgEl.removeEventListener('pointermove', onMove);
            svgEl.removeEventListener('pointerup', onUp);
            if (this._dragPos !== null) {
                const final = this._dragPos;
                this._dragPos = null;
                this._setPosition(final);
            }
        };
        svgEl.addEventListener('pointermove', onMove);
        svgEl.addEventListener('pointerup', onUp);
    }

    // ─── SVG rendering ────────────────────────────────────────────────────────
    _renderWindow() {
        const displayPos   = this._dragPos ?? this._position ?? (feezal.isEditor ? 55 : 0);
        const effectivePos = this.invert ? (100 - displayPos) : displayPos;
        // shutterH: 0 = fully open (position 100), FH = fully closed (position 0)
        const shutterH   = Math.max(0, Math.round(FH * (1 - effectivePos / 100)));
        const slatCount  = Math.max(1, this.slatCount || 6);
        const tiltDeg    = ((this._tilt ?? 0) / 100) * 70; // 0–70° visual tilt
        const slats      = [];

        if (shutterH > 0) {
            const spacing = shutterH / slatCount;
            for (let i = 0; i < slatCount; i++) {
                const cy = FY + spacing * (i + 0.5);
                if (cy > FY + shutterH + 0.5) break;
                const dy = Math.tan(tiltDeg * Math.PI / 180) * (FW / 2);
                slats.push(svg`<line
                    x1="${FX}" y1="${(cy - dy).toFixed(2)}"
                    x2="${FX + FW}" y2="${(cy + dy).toFixed(2)}"
                    stroke="var(--feezal-shutter-frame-color)"
                    stroke-opacity="0.35" stroke-width="0.9"/>`);
            }
        }

        return svg`
            <!-- Glass panes — subtle fill behind the shutter -->
            <rect x="${FX}" y="${FY}" width="${FW}" height="${FH}"
                fill="var(--feezal-shutter-frame-color)" fill-opacity="0.06" stroke="none"/>
            <!-- Window cross-bars (drawn under shutter panel) -->
            <line x1="${FX}" y1="${FY + FH * 0.45}" x2="${FX + FW}" y2="${FY + FH * 0.45}"
                stroke="var(--feezal-shutter-frame-color)" stroke-width="1.5" stroke-opacity="0.25"/>
            <line x1="${FX + FW * 0.37}" y1="${FY}" x2="${FX + FW * 0.37}" y2="${FY + FH}"
                stroke="var(--feezal-shutter-frame-color)" stroke-width="1" stroke-opacity="0.2"/>
            <line x1="${FX + FW * 0.63}" y1="${FY}" x2="${FX + FW * 0.63}" y2="${FY + FH}"
                stroke="var(--feezal-shutter-frame-color)" stroke-width="1" stroke-opacity="0.2"/>
            <!-- Shutter panel -->
            ${shutterH > 0 ? svg`
                <rect x="${FX}" y="${FY}" width="${FW}" height="${shutterH}"
                    fill="var(--feezal-shutter-panel-color)" rx="1"/>` : svg``}
            <!-- Slat lines -->
            ${slats}
            <!-- Window frame — drawn on top so it always shows clearly -->
            <rect x="${FX}" y="${FY}" width="${FW}" height="${FH}"
                fill="none" stroke="var(--feezal-shutter-frame-color)" stroke-width="2.5" rx="1.5"/>
        `;
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    render() {
        const showUnavail  = !feezal.isEditor && this.subscribeAvailability && !this._available;
        const displayPos   = this._dragPos ?? this._position;
        const hasTilt      = !feezal.isEditor && (this.slatAngle || this.publishSlatAngle);

        return html`
            ${showUnavail ? html`
                <div class="unavail" title="Device unavailable">
                    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M24 8.98C20.93 5.9 16.69 4 12 4c-1.69 0-3.32.25-4.86.71l2.5 2.5c.77-.14 1.55-.21 2.36-.21 3.42 0 6.7 1.21 9.32 3.42L24 8.98zM2.81 2.81L1.39 4.22l2.05 2.05C2.2 6.92 1.05 7.86 0 8.98l1.68 1.43c.93-.78 1.94-1.45 3.01-2L6.4 9.83c-1.2.55-2.31 1.3-3.28 2.21L4.81 13.46C5.96 12.38 7.4 11.62 9 11.27l2.16 2.16c-1.3.18-2.5.74-3.46 1.59L12 19.51l1.94-1.94 5.84 5.84 1.41-1.41L2.81 2.81zM12 16.5l-1.41-1.41L12 13.68c.5 0 .96.06 1.42.13l1.71 1.71c-.99-.65-2.18-1.02-3.13-1.02z"/>
                    </svg>
                </div>
            ` : ''}

            <div class="window-wrap">
                <svg class="window" viewBox="0 0 60 70"
                    style="cursor:${feezal.isEditor ? 'default' : 'grab'}"
                    @pointerdown="${this._onSvgPointerDown}">
                    ${this._renderWindow()}
                </svg>
            </div>

            <div class="btn-row">
                ${feezal.isEditor ? html`
                    <div class="editor-btns">
                        <span>&#9650;</span><span>&#9632;</span><span>&#9660;</span>
                    </div>
                ` : html`
                    <md-icon-button @click="${this._cmdUp}">
                        <md-icon>keyboard_arrow_up</md-icon>
                    </md-icon-button>
                    <md-icon-button @click="${this._cmdStop}">
                        <md-icon>stop</md-icon>
                    </md-icon-button>
                    <md-icon-button @click="${this._cmdDown}">
                        <md-icon>keyboard_arrow_down</md-icon>
                    </md-icon-button>
                `}
            </div>

            ${this.showPosition ? html`
                <div class="pos-wrap">
                    <span class="pos-label"
                        @click="${() => { if (!feezal.isEditor) this._showSlider = !this._showSlider; }}">
                        ${displayPos !== null ? `${Math.round(displayPos)}\u00a0%` : '\u2014'}
                    </span>
                    ${this._showSlider && !feezal.isEditor ? html`
                        <md-slider min="0" max="100" value="${displayPos ?? 50}"
                            @change="${e => this._setPosition(e.target.value)}">
                        </md-slider>
                    ` : ''}
                </div>
            ` : ''}

            ${hasTilt ? html`
                <div class="tilt-wrap">
                    <span class="tilt-label">Tilt</span>
                    <md-slider min="0" max="100" value="${this._tilt ?? 0}"
                        @change="${e => this._setTilt(e.target.value)}">
                    </md-slider>
                </div>
            ` : ''}

            ${this.label ? html`<div class="label">${this.label}</div>` : ''}
        `;
    }
}

customElements.define('feezal-element-material-shutter', FeezalElementMaterialShutter);
export {FeezalElementMaterialShutter};

// ─── N6 Custom Inspector ──────────────────────────────────────────────────────
// Two-tab inspector (Topics + Config). Replaces the flat attribute form.
// Topics tab: an always-on Position/Command section + capability-gated Tilt
// and Availability sections (separate mode) or a State & Control section
// with a Tilt capability toggle (json mode).
// Config tab: Payload mode, command payloads, display options, availability.

const SHUTTER_SECTIONS = [
    // Separate-mode capability-gated sections
    {id: 'tilt', title: 'Tilt / Slat angle', topics: [
        {attr: 'slat-angle',          label: 'Subscribe (angle 0\u2013100)'},
        {attr: 'publish-slat-angle',  label: 'Publish (angle 0\u2013100)'},
    ]},
    {id: 'availability', title: 'Availability', topics: [
        {attr: 'subscribe-availability', label: 'Subscribe'},
    ]},
];

const JSON_CAPABILITIES = [
    // In json mode there are no per-property topic fields; tilt is read
    // from the JSON object when the `tilt` key is present. We still let
    // the user wire a separate tilt publish topic if needed.
    {id: 'tilt', title: 'Tilt / Slat angle', topics: [
        {attr: 'publish-slat-angle', label: 'Publish separate tilt topic (optional)', placeholder: 'mqtt/cover/slat/set'},
    ]},
    {id: 'availability', title: 'Availability', topics: [
        {attr: 'subscribe-availability', label: 'Subscribe'},
    ]},
];

class FeezalElementMaterialShutterInspector extends LitElement {
    static properties = {
        element: {attribute: false},
        _tab:    {state: true},
        _open:   {state: true},
    };

    static styles = css`
        :host { display: block; font-size: 12px; color: var(--feezal-color, #333); }
        sl-tab-panel::part(base) { padding: 8px 2px; }
        .section { border: 1px solid var(--feezal-border, #e0e0e0); border-radius: 6px; margin-bottom: 8px; }
        .sec-head {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 8px; font-weight: 600;
            background: var(--feezal-bg-sub, #f5f5f5);
            border-radius: 6px 6px 0 0;
        }
        .sec-head.collapsed { border-radius: 6px; }
        .sec-title { flex: 1; }
        .sec-body { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
        .field { display: flex; flex-direction: column; gap: 2px; }
        .field > label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; }
        sl-input, sl-select { width: 100%; }
        /* Match the standard inspector Shoelace theming (dark-mode compat) */
        sl-input::part(form-control-label), sl-select::part(form-control-label) {
            color: var(--sl-input-label-color, inherit); font-size: 12px;
        }
        sl-input::part(base), sl-select::part(combobox) {
            background: var(--feezal-bg, #fff);
            border-color: var(--feezal-border, #ccc);
            color: var(--feezal-color, #333);
        }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        sl-switch { color: var(--feezal-color, inherit); }
        .row { display: flex; gap: 6px; }
        .row > .field { flex: 1; }
        .hint { font-size: 10px; opacity: 0.55; padding: 0 2px 4px; }
    `;

    constructor() {
        super();
        this.element = null;
        this._tab    = 'topics';
        this._open   = {};
    }

    willUpdate(changed) {
        if (changed.has('element')) this._open = {};
    }

    // ── Attribute access ──────────────────────────────────────────────────────
    _val(name)  { return this.element?.getAttribute(name) ?? ''; }
    _bool(name, defaultVal = false) {
        if (!this.element) return defaultVal;
        if (!this.element.hasAttribute(name)) return defaultVal;
        return true;
    }

    _emit(name, value, rerender = false) {
        this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
            bubbles: true, composed: true, detail: {name, value},
        }));
        if (rerender) this.requestUpdate();
    }

    _onInput(name, e)  { this._emit(name, e.target.value); }
    _onSelect(name, e) { this._emit(name, e.target.value, true); }

    _sectionEnabled(sec) {
        if (this._open[sec.id]) return true;
        return sec.topics.some(t => this._val(t.attr) !== '');
    }

    _toggleSection(sec, e) {
        const on = e.target.checked;
        if (on) {
            this._open = {...this._open, [sec.id]: true};
        } else {
            sec.topics.forEach(t => this._emit(t.attr, ''));
            this._open = {...this._open, [sec.id]: false};
        }
        this.requestUpdate();
    }

    // ── Render ────────────────────────────────────────────────────────────────
    render() {
        if (!this.element) return html``;
        return html`
            <sl-tab-group @sl-tab-show="${e => { this._tab = e.detail.name; }}">
                <sl-tab slot="nav" panel="topics" ?active="${this._tab === 'topics'}">Topics</sl-tab>
                <sl-tab slot="nav" panel="config"  ?active="${this._tab === 'config'}">Config</sl-tab>
                <sl-tab-panel name="topics">${this._renderTopics()}</sl-tab-panel>
                <sl-tab-panel name="config">${this._renderConfig()}</sl-tab-panel>
            </sl-tab-group>
        `;
    }

    _topicInput(t) {
        return html`
            <div class="field">
                <label>${t.label}</label>
                <sl-input size="small" autocomplete="off"
                    placeholder="${t.placeholder ?? 'mqtt/topic'}"
                    value="${this._val(t.attr)}"
                    @sl-change="${e => this._onInput(t.attr, e)}"></sl-input>
            </div>`;
    }

    _renderTopics() {
        const isJson = (this._val('payload-mode') || 'json') === 'json';
        if (isJson) {
            return html`
                <div class="hint">JSON mode — one topic carries the whole state object.</div>
                <div class="section">
                    <div class="sec-head">State &amp; Control</div>
                    <div class="sec-body">
                        ${this._topicInput({attr: 'subscribe', label: 'Subscribe (state)'})}
                        ${this._topicInput({attr: 'publish',   label: 'Publish (\u2026/set)'})}
                    </div>
                </div>
                ${JSON_CAPABILITIES.map(sec => {
                    const enabled = this._sectionEnabled(sec);
                    return html`
                        <div class="section">
                            <div class="sec-head ${enabled ? '' : 'collapsed'}">
                                <span class="sec-title">${sec.title}</span>
                                <sl-switch size="small" ?checked="${enabled}"
                                    @sl-change="${e => this._toggleSection(sec, e)}"></sl-switch>
                            </div>
                            ${enabled ? html`<div class="sec-body">${sec.topics.map(t => this._topicInput(t))}</div>` : ''}
                        </div>`;
                })}`;
        }

        // ── Separate mode ──────────────────────────────────────────────────
        return html`
            <div class="section">
                <div class="sec-head">Position</div>
                <div class="sec-body">
                    ${this._topicInput({attr: 'subscribe-position', label: 'Subscribe'})}
                    ${this._topicInput({attr: 'publish-position',   label: 'Publish'})}
                </div>
            </div>
            <div class="section">
                <div class="sec-head">Command</div>
                <div class="sec-body">
                    ${this._topicInput({attr: 'publish-command', label: 'Up / Stop / Down'})}
                </div>
            </div>
            ${SHUTTER_SECTIONS.map(sec => {
                const enabled = this._sectionEnabled(sec);
                return html`
                    <div class="section">
                        <div class="sec-head ${enabled ? '' : 'collapsed'}">
                            <span class="sec-title">${sec.title}</span>
                            <sl-switch size="small" ?checked="${enabled}"
                                @sl-change="${e => this._toggleSection(sec, e)}"></sl-switch>
                        </div>
                        ${enabled ? html`<div class="sec-body">${sec.topics.map(t => this._topicInput(t))}</div>` : ''}
                    </div>`;
            })}`;
    }

    _renderConfig() {
        const payloadMode = this._val('payload-mode') || 'json';
        return html`
            <div class="section">
                <div class="sec-head">Payload mode</div>
                <div class="sec-body">
                    <div class="field">
                        <sl-select size="small" value="${payloadMode}"
                            @sl-change="${e => this._onSelect('payload-mode', e)}">
                            <sl-option value="json">json (single topic, default)</sl-option>
                            <sl-option value="separate">separate (one topic per property)</sl-option>
                        </sl-select>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Commands</div>
                <div class="sec-body">
                    <div class="field">
                        <label>Up</label>
                        <sl-input size="small" autocomplete="off"
                            value="${this._val('payload-up') || 'UP'}"
                            @sl-change="${e => this._onInput('payload-up', e)}"></sl-input>
                    </div>
                    <div class="field">
                        <label>Stop</label>
                        <sl-input size="small" autocomplete="off"
                            value="${this._val('payload-stop') || 'STOP'}"
                            @sl-change="${e => this._onInput('payload-stop', e)}"></sl-input>
                    </div>
                    <div class="field">
                        <label>Down</label>
                        <sl-input size="small" autocomplete="off"
                            value="${this._val('payload-down') || 'DOWN'}"
                            @sl-change="${e => this._onInput('payload-down', e)}"></sl-input>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Display</div>
                <div class="sec-body">
                    <div class="field">
                        <label>Slat count</label>
                        <sl-input type="number" size="small" autocomplete="off"
                            value="${this._val('slat-count') || '6'}"
                            @sl-change="${e => this._onInput('slat-count', e)}"></sl-input>
                    </div>
                    <sl-switch ?checked="${this._bool('invert', false)}"
                        @sl-change="${e => this._emit('invert', e.target.checked)}">
                        Invert (0\u00a0=\u00a0open)
                    </sl-switch>
                    <sl-switch ?checked="${this._bool('show-position', true)}"
                        @sl-change="${e => this._emit('show-position', e.target.checked)}">
                        Show position label
                    </sl-switch>
                    <div class="field">
                        <label>Label</label>
                        <sl-input size="small" autocomplete="off"
                            value="${this._val('label')}"
                            @sl-change="${e => this._onInput('label', e)}"></sl-input>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Availability</div>
                <div class="sec-body">
                    <div class="field">
                        <label>Subscribe</label>
                        <sl-input size="small" autocomplete="off" placeholder="\u2026/availability"
                            value="${this._val('subscribe-availability')}"
                            @sl-change="${e => this._onInput('subscribe-availability', e)}"></sl-input>
                    </div>
                    <div class="row">
                        <div class="field">
                            <label>Available</label>
                            <sl-input size="small" autocomplete="off"
                                value="${this._val('payload-available') || 'online'}"
                                @sl-change="${e => this._onInput('payload-available', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Unavailable</label>
                            <sl-input size="small" autocomplete="off"
                                value="${this._val('payload-unavailable') || 'offline'}"
                                @sl-change="${e => this._onInput('payload-unavailable', e)}"></sl-input>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('feezal-element-material-shutter-inspector', FeezalElementMaterialShutterInspector);
export {FeezalElementMaterialShutterInspector};

/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
// E137: the cover behavior lives in the shared controller — this element is a
// VIEW (window SVG, drag-to-position, up/stop/down buttons, sliders).
import {CoverController, coverAttributes, coverDiscoveryMap} from '@feezal/feezal-controller-cover';
import '@feezal/feezal-element/feezal-topic-input.js';
import {svg, LitElement} from 'lit';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/slider/slider.js';

// ─── SVG frame geometry ───────────────────────────────────────────────────────
const FX = 4, FY = 4, FW = 52, FH = 62; // window frame origin / size in SVG space

// ─── Element ──────────────────────────────────────────────────────────────────
class FeezalElementMaterialCover extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Cover', category: 'Circle', color: '#1565c0', icon: 'blinds'},
            description: 'Window cover / blind control card. Visualises position as a sliding panel, provides up/stop/down commands, direct position setting, and optional venetian-blind tilt control.',
            // ── N6 custom inspector ───────────────────────────────────────────
            inspector: 'feezal-element-material-cover-inspector',
            // ── N12 Auto-Discovery descriptor ─────────────────────────────────
            // zigbee2mqtt covers (and HA cover entities) use a consolidated JSON
            // base-topic for state and a /set topic for commands. The element
            // defaults payload-mode to 'json' so auto-configured covers work
            // out of the box; hand-wired separate-topic setups switch to
            // 'separate' in the inspector.
            // E137: the discovery map is the controller package's fragment.
            discovery: {component: 'cover', map: coverDiscoveryMap},
            attributes: [
                // E137: the shared cover contract (both payload modes, B26
                // min/max scaling, dedicated per-direction command topics,
                // slat/tilt angle) — declared ONCE by the controller package.
                ...coverAttributes,
                // ── Display ───────────────────────────────────────────────────
                {name: 'invert',        type: 'boolean', default: false, help: 'Invert position scale: 0=open, 100=closed.'},
                {name: 'show-position', type: 'boolean', default: true,  help: 'Show the numeric position label below the window.'},
                {name: 'slat-count',    type: 'number',  default: 6,     help: 'Number of horizontal slat lines rendered in the SVG cover panel.'},
                {name: 'label',         type: 'string',  default: '',    help: 'Optional card title shown at the bottom.'},
                // ── Availability ──────────────────────────────────────────────
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Optional availability topic. A badge appears when unavailable; controls stay enabled.'},
                {name: 'message-property-availability', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the availability message. Blank = fall back to element-level message-property.'},
                {name: 'payload-available',      type: 'string', default: 'online',  help: 'Payload meaning the device is online.'},
                {name: 'payload-unavailable',    type: 'string', default: 'offline', help: 'Payload meaning the device is offline.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                // Theme-aware colour tokens. Leave blank to inherit from theme.
                {property: '--feezal-cover-frame-color', type: 'color', default: 'var(--primary-color)',
                    help: 'Accent: window frame, dividers, slat lines, position slider and the fully-closed panel (E123 — the theme accent, same role the primary colour plays on other Material cards).'},
                {property: '--feezal-cover-panel-color', type: 'color', default: 'var(--secondary-background-color)',
                    help: 'Cover panel fill colour.'},
                {property: '--feezal-cover-text-color',  type: 'color', default: 'var(--primary-text-color)',
                    help: 'Position label and button icon colour.'},
                {property: '--feezal-cover-error-color', type: 'color', default: 'var(--error-color)',
                    help: 'Colour of the unavailability badge.'},
            ],
            restrict:     {minWidth: 80, minHeight: 100},
            // E123: size parity with material-light (180×220) so a row of
            // mixed Material cards lines up. Existing covers keep their saved
            // inline size — this only affects newly inserted elements.
            defaultStyle: {width: '180px', height: '220px'},
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
        publishUp:             {type: String,  reflect: true, attribute: 'publish-up'},
        publishStop:           {type: String,  reflect: true, attribute: 'publish-stop'},
        publishDown:           {type: String,  reflect: true, attribute: 'publish-down'},
        min:                   {type: Number,  reflect: true},
        max:                   {type: Number,  reflect: true},
        slatMin:               {type: Number,  reflect: true, attribute: 'slat-min'},
        slatMax:               {type: Number,  reflect: true, attribute: 'slat-max'},
        payloadUp:             {type: String,  reflect: true, attribute: 'payload-up'},
        payloadStop:           {type: String,  reflect: true, attribute: 'payload-stop'},
        payloadDown:           {type: String,  reflect: true, attribute: 'payload-down'},
        slatAngle:             {type: String,  reflect: true, attribute: 'slat-angle'},
        publishSlatAngle:      {type: String,  reflect: true, attribute: 'publish-slat-angle'},
        invert:                {type: Boolean, reflect: true},
        showPosition:          {type: Boolean, reflect: true, attribute: 'show-position'},
        slatCount:             {type: Number,  reflect: true, attribute: 'slat-count'},
        label:                 {type: String,  reflect: true},
        // N31: availability inherited from FeezalElement.
        discoveryId:           {type: String,  reflect: true, attribute: 'discovery-id'},
        msgPropPosition:       {type: String,  reflect: true, attribute: 'message-property-position'},
        msgPropTilt:           {type: String,  reflect: true, attribute: 'message-property-tilt'},
        // Internal state — never as class fields (Lit 3 rule).
        // E137: position/tilt live on the CoverController (plain fields +
        // host.requestUpdate) — only the view-local bits stay here.
        _dragPos:     {state: true},   // live position during SVG drag
        _showSlider:  {state: true},   // toggle inline position slider
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
            /* E123: the frame is the card's ACCENT — primary colour, like the
               active track/knob on the other Material cards. */
            --feezal-cover-frame-color: var(--primary-color, #0284c7);
            --feezal-cover-panel-color: var(--secondary-background-color, var(--feezal-bg-sub, #ddd));
            --feezal-cover-text-color:  var(--primary-text-color,        var(--feezal-color, #333));
            --feezal-cover-error-color: var(--error-color, #b00020);

            /* MD3 bridge — icon buttons follow the cover theme */
            --md-sys-color-on-surface:         var(--feezal-cover-text-color);
            --md-sys-color-on-surface-variant: var(--feezal-cover-text-color);
            --md-icon-button-icon-color:        var(--feezal-cover-text-color);
            --md-icon-button-hover-icon-color:  var(--feezal-cover-text-color);
            --md-sys-color-primary:             var(--feezal-cover-frame-color);
            --md-slider-active-track-color:     var(--feezal-cover-frame-color);
            --md-slider-handle-color:           var(--feezal-cover-frame-color);
            --md-slider-inactive-track-color:   var(--feezal-cover-panel-color);
        }
        .unavail {
            position: absolute;
            top: 4px; right: 4px;
            width: 18px; height: 18px;
            color: var(--feezal-cover-error-color);
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
        /* Icon glyphs — use the loaded 'Material Icons' font. <md-icon> defaults to
           'Material Symbols Outlined', which feezal does not load, so ligature names
           would render as literal text. */
        md-icon-button .mi {
            font-family: 'Material Icons';
            font-style: normal;
            font-weight: normal;
            font-size: 24px;
            line-height: 1;
            color: var(--feezal-cover-text-color);
        }
        .editor-btns {
            display: flex; gap: 8px; align-items: center;
            font-size: 16px; opacity: 0.55;
            color: var(--feezal-cover-text-color);
        }
        .pos-wrap {
            display: flex; align-items: center; gap: 4px; width: 100%;
            justify-content: center;
        }
        .pos-label {
            font-size: 12px; min-width: 32px; text-align: center;
            color: var(--feezal-cover-text-color);
            cursor: pointer;
        }
        md-slider { flex: 1; max-width: 80px; }
        .tilt-wrap {
            display: flex; align-items: center; gap: 4px; width: 100%;
        }
        .tilt-label {
            font-size: 10px; opacity: 0.6; min-width: 28px;
            color: var(--feezal-cover-text-color);
        }
        .label {
            font-size: 11px; opacity: 0.65; text-align: center;
            color: var(--feezal-cover-text-color);
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
        this.publishUp             = '';
        this.publishStop           = '';
        this.publishDown           = '';
        this.min                   = 0;
        this.max                   = 100;
        this.slatMin               = 0;
        this.slatMax               = 100;
        this.payloadUp             = 'OPEN';
        this.payloadStop           = 'STOP';
        this.payloadDown           = 'CLOSE';
        this.slatAngle             = '';
        this.publishSlatAngle      = '';
        this.invert                = false;
        this.showPosition          = true;
        this.slatCount             = 6;
        this.label                 = '';
        this.discoveryId           = '';
        this.msgPropPosition       = '';
        this.msgPropTilt           = '';
        this._dragPos              = null;
        this._showSlider           = false;
        // E137: the behavior layer — wires/parses/publishes; this view renders.
        this.cover = new CoverController(this);
    }

    // The cover controller manages all subscriptions; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    // E137: the CoverController wires everything in hostConnected.

    updated(changed) {
        super.updated(changed);
        // Live-canvas topic edits re-wire through the controller.
        this.cover.rewireIfChanged();
    }

    // View-side commit: close the inline slider, then delegate to the controller.
    _commitPosition(pos) {
        this._showSlider = false;
        this.cover.setPosition(pos);
    }

    // ─── SVG drag — dragging the cover panel sets a new position ─────────────
    _onSvgPointerDown(e) {
        if (feezal.isEditor) return;
        const svgEl = e.currentTarget;
        svgEl.setPointerCapture(e.pointerId);
        const startY   = e.clientY;
        const startPos = this.cover.position ?? 50;
        const rect     = svgEl.getBoundingClientRect();
        const heightPx = rect.height || 1;

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
                this._commitPosition(final);
            }
        };
        svgEl.addEventListener('pointermove', onMove);
        svgEl.addEventListener('pointerup', onUp);
    }

    // ─── SVG rendering ────────────────────────────────────────────────────────
    _renderWindow() {
        const displayPos   = this._dragPos ?? this.cover.position ?? 0;
        const effectivePos = this.invert ? (100 - displayPos) : displayPos;
        // coverH: 0 = fully open (position 100), FH = fully closed (position 0)
        const coverH    = Math.max(0, Math.round(FH * (1 - effectivePos / 100)));
        const slatCount = Math.max(1, this.slatCount || 6);
        const tiltDeg   = ((this.cover.tilt ?? 0) / 100) * 70; // 0–70° visual tilt
        const slats     = [];

        if (coverH > 0) {
            // E123: on the accent-filled fully-closed panel the accent slat
            // lines would disappear — use the neutral panel colour instead.
            const slatStroke = effectivePos <= 0
                ? 'var(--feezal-cover-panel-color)'
                : 'var(--feezal-cover-frame-color)';
            const spacing = coverH / slatCount;
            for (let i = 0; i < slatCount; i++) {
                const cy = FY + spacing * (i + 0.5);
                if (cy > FY + coverH + 0.5) break;
                const dy = Math.tan(tiltDeg * Math.PI / 180) * (FW / 2);
                slats.push(svg`<line
                    x1="${FX}" y1="${(cy - dy).toFixed(2)}"
                    x2="${FX + FW}" y2="${(cy + dy).toFixed(2)}"
                    stroke="${slatStroke}"
                    stroke-opacity="0.35" stroke-width="0.9"/>`);
            }
        }

        return svg`
            <!-- Glass panes — subtle fill behind the cover -->
            <rect x="${FX}" y="${FY}" width="${FW}" height="${FH}"
                fill="var(--feezal-cover-frame-color)" fill-opacity="0.06" stroke="none"/>
            <!-- Window cross-bars (drawn under cover panel) -->
            <line x1="${FX}" y1="${FY + FH * 0.45}" x2="${FX + FW}" y2="${FY + FH * 0.45}"
                stroke="var(--feezal-cover-frame-color)" stroke-width="1.5" stroke-opacity="0.25"/>
            <line x1="${FX + FW * 0.37}" y1="${FY}" x2="${FX + FW * 0.37}" y2="${FY + FH}"
                stroke="var(--feezal-cover-frame-color)" stroke-width="1" stroke-opacity="0.2"/>
            <line x1="${FX + FW * 0.63}" y1="${FY}" x2="${FX + FW * 0.63}" y2="${FY + FH}"
                stroke="var(--feezal-cover-frame-color)" stroke-width="1" stroke-opacity="0.2"/>
            <!-- Cover panel. E123: a FULLY closed cover fills with the accent
                 (frame) colour so "closed" is visible at a glance; while
                 moving/partially closed it stays the neutral panel colour. -->
            ${coverH > 0 ? svg`
                <rect x="${FX}" y="${FY}" width="${FW}" height="${coverH}"
                    fill="${effectivePos <= 0 ? 'var(--feezal-cover-frame-color)' : 'var(--feezal-cover-panel-color)'}"
                    fill-opacity="${effectivePos <= 0 ? 0.75 : 1}" rx="1"/>` : svg``}
            <!-- Slat lines -->
            ${slats}
            <!-- Window frame — drawn on top so it always shows clearly -->
            <rect x="${FX}" y="${FY}" width="${FW}" height="${FH}"
                fill="none" stroke="var(--feezal-cover-frame-color)" stroke-width="2.5" rx="1.5"/>
        `;
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    render() {
        const showUnavail = this.subscribeAvailability && !this._available;
        const displayPos  = this._dragPos ?? this.cover.position;
        const hasTilt     = !!(this.slatAngle || this.publishSlatAngle);

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
                <md-icon-button @click="${() => this.cover.up()}">
                    <span class="mi">keyboard_arrow_up</span>
                </md-icon-button>
                <md-icon-button @click="${() => this.cover.stop()}">
                    <span class="mi">stop</span>
                </md-icon-button>
                <md-icon-button @click="${() => this.cover.down()}">
                    <span class="mi">keyboard_arrow_down</span>
                </md-icon-button>
            </div>

            ${this.showPosition ? html`
                <div class="pos-wrap">
                    <span class="pos-label"
                        @click="${() => { if (!feezal.isEditor) this._showSlider = !this._showSlider; }}">
                        ${displayPos !== null ? `${Math.round(displayPos)}\u00a0%` : '\u2014'}
                    </span>
                    ${this._showSlider && !feezal.isEditor ? html`
                        <md-slider min="0" max="100" value="${displayPos ?? 50}"
                            @change="${e => this._commitPosition(e.target.value)}">
                        </md-slider>
                    ` : ''}
                </div>
            ` : ''}

            ${hasTilt ? html`
                <div class="tilt-wrap">
                    <span class="tilt-label">Tilt</span>
                    <md-slider min="0" max="100" value="${this.cover.tilt ?? 0}"
                        @change="${e => this.cover.setTilt(e.target.value)}">
                    </md-slider>
                </div>
            ` : ''}

            ${this.label ? html`<div class="label">${this.label}</div>` : ''}
        `;
    }
}

customElements.define('feezal-element-material-cover', FeezalElementMaterialCover);
export {FeezalElementMaterialCover};

// ─── N6 Custom Inspector ──────────────────────────────────────────────────────
// Two-tab inspector (Topics + Config). Replaces the flat attribute form.
// Topics tab: an always-on Position/Command section + capability-gated Tilt
// and Availability sections (separate mode) or a State & Control section
// with a Tilt capability toggle (json mode).
// Config tab: Payload mode, command payloads, display options, availability.

const COVER_SECTIONS = [
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

class FeezalElementMaterialCoverInspector extends LitElement {
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
                <feezal-topic-input size="small"
                    placeholder="${t.placeholder ?? 'mqtt/topic'}"
                    value="${this._val(t.attr)}"
                    @sl-change="${e => this._onInput(t.attr, e)}"></feezal-topic-input>
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
                        ${this._topicInput({attr: 'subscribe', label: 'Subscribe (state topic)'})}
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
                    ${this._topicInput({attr: 'publish-up',   label: 'Up (dedicated topic, optional)'})}
                    ${this._topicInput({attr: 'publish-stop', label: 'Stop (dedicated topic, optional)'})}
                    ${this._topicInput({attr: 'publish-down', label: 'Down (dedicated topic, optional)'})}
                </div>
            </div>
            ${COVER_SECTIONS.map(sec => {
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
                            value="${this._val('payload-up') || 'OPEN'}"
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
                            value="${this._val('payload-down') || 'CLOSE'}"
                            @sl-change="${e => this._onInput('payload-down', e)}"></sl-input>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Value ranges</div>
                <div class="sec-body">
                    <div class="hint">Device value scale — incoming values are scaled to 0–100&nbsp;%, published targets scaled back (Homematic: min 0, max 1).</div>
                    <div class="row">
                        <div class="field">
                            <label>Position min</label>
                            <sl-input size="small" type="number" autocomplete="off" placeholder="0"
                                value="${this._val('min')}"
                                @sl-change="${e => this._onInput('min', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Position max</label>
                            <sl-input size="small" type="number" autocomplete="off" placeholder="100"
                                value="${this._val('max')}"
                                @sl-change="${e => this._onInput('max', e)}"></sl-input>
                        </div>
                    </div>
                    <div class="row">
                        <div class="field">
                            <label>Slat angle min</label>
                            <sl-input size="small" type="number" autocomplete="off" placeholder="0"
                                value="${this._val('slat-min')}"
                                @sl-change="${e => this._onInput('slat-min', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Slat angle max</label>
                            <sl-input size="small" type="number" autocomplete="off" placeholder="100"
                                value="${this._val('slat-max')}"
                                @sl-change="${e => this._onInput('slat-max', e)}"></sl-input>
                        </div>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Display</div>
                <div class="sec-body">
                    <div class="row">
                        <div class="field">
                            <label>Slat count</label>
                            <sl-input size="small" type="number" autocomplete="off"
                                value="${this._val('slat-count') || '6'}"
                                @sl-change="${e => this._onInput('slat-count', e)}"></sl-input>
                        </div>
                    </div>
                    <div class="field">
                        <sl-switch size="small"
                            ?checked="${this._bool('invert', false)}"
                            @sl-change="${e => this._emit('invert', e.target.checked || null, true)}">
                            Invert (0 = open)
                        </sl-switch>
                    </div>
                    <div class="field">
                        <sl-switch size="small"
                            ?checked="${this._bool('show-position', true)}"
                            @sl-change="${e => this._emit('show-position', e.target.checked || null, true)}">
                            Show position %
                        </sl-switch>
                    </div>
                    <div class="field">
                        <label>Label</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="Kitchen blinds"
                            value="${this._val('label')}"
                            @sl-change="${e => this._onInput('label', e)}"></sl-input>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Availability</div>
                <div class="sec-body">
                    ${this._topicInput({attr: 'subscribe-availability', label: 'Availability topic'})}
                    <div class="row">
                        <div class="field">
                            <label>Online payload</label>
                            <sl-input size="small" autocomplete="off"
                                value="${this._val('payload-available') || 'online'}"
                                @sl-change="${e => this._onInput('payload-available', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Offline payload</label>
                            <sl-input size="small" autocomplete="off"
                                value="${this._val('payload-unavailable') || 'offline'}"
                                @sl-change="${e => this._onInput('payload-unavailable', e)}"></sl-input>
                        </div>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Message property</div>
                <div class="sec-body">
                    <div class="hint">Dot-notation path to extract a value from each message (e.g. <code>payload</code>, <code>data.value</code>). Blank = read top-level payload.</div>
                    <div class="field">
                        <label>Global (all topics)</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="payload"
                            value="${this._val('message-property')}"
                            @sl-change="${e => this._onInput('message-property', e)}"></sl-input>
                    </div>
                    <div class="field">
                        <label>Position topic</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="payload"
                            value="${this._val('message-property-position')}"
                            @sl-change="${e => this._onInput('message-property-position', e)}"></sl-input>
                    </div>
                    <div class="field">
                        <label>Tilt / slat topic</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="payload"
                            value="${this._val('message-property-tilt')}"
                            @sl-change="${e => this._onInput('message-property-tilt', e)}"></sl-input>
                    </div>
                    <div class="field">
                        <label>Availability topic</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="payload"
                            value="${this._val('message-property-availability')}"
                            @sl-change="${e => this._onInput('message-property-availability', e)}"></sl-input>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('feezal-element-material-cover-inspector', FeezalElementMaterialCoverInspector);
export {FeezalElementMaterialCoverInspector};

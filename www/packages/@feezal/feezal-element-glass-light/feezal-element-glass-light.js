/* global feezal */
import {feezalBaseStyles, html, css} from '@feezal/feezal-element';
// E137: the light behavior lives in the shared controller — this element
// is a VIEW (Glass chrome: frost tile, long-press details popup: brightness
// pill, CT slider, hue/saturation wheel).
import {LightController, lightAttributes, lightDiscoveryMap, pctToRaw, hsvToRgb, rgbToHsv} from '@feezal/feezal-controller-light';
import '@feezal/feezal-element/feezal-topic-input.js';
import {LitElement} from 'lit';
import {applySizePreset, glassCardStyles, glassPopupStyles, FeezalGlassCard} from '@feezal/feezal-glass';

/**
 * feezal-element-glass-light (E58)
 *
 * Frosted-glass light card — the Apple-Home-style tile: tap toggles,
 * long-press (or the tune button) opens the Apple-Home-style details popup:
 * big vertical brightness slider, colour-temperature slider, round
 * hue/saturation wheel — sections appear per capability.
 *
 * E137: the MQTT contract (both payload modes, E77 brightness-derived
 * on/off, E127 ramp settling, brightness scaling, CT kelvin|mired,
 * RGB / hue-saturation, effects/white channels, HA discovery) is the
 * shared @feezal/feezal-controller-light — identical to material-light.
 * The `mode` attribute picks the popup detail sliders:
 * brightness / brightness_ct / color_temp / rgb / hs.
 *
 * Family conventions (frost vars, degrade, squircle): see glass-button.
 */

// E137: pctToRaw lives in @feezal/feezal-element/feezal-color.js now —
// re-exported here for back-compat with prior importers (tests).
export {pctToRaw};

const LONG_PRESS_MS = 450;

class FeezalElementGlassLight extends FeezalGlassCard {
    static get feezal() {
        return {
            palette: {name: 'Light', category: 'Glass', color: '#7aa5c9', icon: 'lightbulb'},
            description: 'Frosted-glass light tile — tap toggles; long-press (or the ⋯ button) opens the details popup: ' +
                'vertical brightness slider, colour-temperature slider and hue/saturation wheel (per capability). ' +
                'Same wiring contract as the material light card.',
            inspector: 'feezal-element-glass-light-inspector',
            // E137: the discovery map is the controller package's fragment.
            discovery: {component: 'light', map: lightDiscoveryMap},
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x2', '2x1'], default: '',
                    help: 'Preset size: 2x2 = square (150×150), 2x1 = wide (150×75). Empty keeps the current/manual size.'},
                // E137: the shared light contract (both payload modes, E77
                // on/off-from-brightness, E127 settling, CT/RGB/HS/effects/
                // white channels) — declared ONCE by the controller package.
                ...lightAttributes,
                // Availability
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability — a badge appears when unavailable, the tile stays usable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path for the availability topic. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
                {name: 'label', type: 'string', help: 'Card label.'},
                {name: 'label-on',  type: 'string', default: 'On',  help: 'Displayed state text while the light is on (localise, e.g. "Ein"); the brightness suffix "• x %" keeps appending. Display only — NOT the MQTT payload (payload-on) and NOT the card title (label).'},
                {name: 'label-off', type: 'string', default: 'Off', help: 'Displayed state text while the light is off (localise, e.g. "Aus"). Display only — NOT the MQTT payload (payload-off) and NOT the card title (label).'},
                {name: 'icon',  type: 'string', default: 'lightbulb', help: 'Icon name.'},
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-accent', type: 'color', default: '#ff9f0a', help: 'Icon/state colour while on.'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-icon-size', default: '28px', help: 'Icon font size.'},
                {property: '--feezal-glass-font-size-state', default: '15px', help: 'State line font size.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Label font size.'},
                {property: '--feezal-glass-font-size-unit', default: '12px', help: 'Flip/detail button icon size.'},
            ],
            defaultStyle: {width: '172px', height: '128px'},
            restrict: {minWidth: 90, minHeight: 70},
        };
    }

    static properties = {
        size:                {type: String, reflect: true},
        payloadMode:         {type: String, reflect: true, attribute: 'payload-mode'},
        publish:             {type: String, reflect: true},
        jsonMap:             {type: String, reflect: true, attribute: 'json-map'},
        onOffSource:         {type: String, reflect: true, attribute: 'on-off-source'},
        subscribeState:      {type: String, reflect: true, attribute: 'subscribe-state'},
        msgPropState:        {type: String, reflect: true, attribute: 'message-property-state'},
        publishState:        {type: String, reflect: true, attribute: 'publish-state'},
        payloadOn:           {type: String, reflect: true, attribute: 'payload-on'},
        payloadOff:          {type: String, reflect: true, attribute: 'payload-off'},
        subscribeBrightness: {type: String, reflect: true, attribute: 'subscribe-brightness'},
        msgPropBrightness:   {type: String, reflect: true, attribute: 'message-property-brightness'},
        // E127: ramp settling
        subscribeWorking:    {type: String, reflect: true, attribute: 'subscribe-working'},
        msgPropWorking:      {type: String, reflect: true, attribute: 'message-property-working'},
        subscribeSettled:    {type: String, reflect: true, attribute: 'subscribe-settled'},
        msgPropSettled:      {type: String, reflect: true, attribute: 'message-property-settled'},
        settleTimeout:       {type: Number, reflect: true, attribute: 'settle-timeout'},
        reportDelayMs:       {type: Number, reflect: true, attribute: 'report-delay-ms'},
        publishBrightness:   {type: String, reflect: true, attribute: 'publish-brightness'},
        brightnessMin:       {type: Number, reflect: true, attribute: 'brightness-min'},
        brightnessMax:       {type: Number, reflect: true, attribute: 'brightness-max'},
        mode:                {type: String, reflect: true},
        subscribeColorTemp:  {type: String, reflect: true, attribute: 'subscribe-color-temp'},
        msgPropColorTemp:    {type: String, reflect: true, attribute: 'message-property-color-temp'},
        publishColorTemp:    {type: String, reflect: true, attribute: 'publish-color-temp'},
        colorTempUnit:       {type: String, reflect: true, attribute: 'color-temp-unit'},
        colorTempMin:        {type: Number, reflect: true, attribute: 'color-temp-min'},
        colorTempMax:        {type: Number, reflect: true, attribute: 'color-temp-max'},
        subscribeRgb:        {type: String, reflect: true, attribute: 'subscribe-rgb'},
        msgPropRgb:          {type: String, reflect: true, attribute: 'message-property-rgb'},
        publishRgb:          {type: String, reflect: true, attribute: 'publish-rgb'},
        subscribeHs:         {type: String, reflect: true, attribute: 'subscribe-hs'},
        msgPropHs:           {type: String, reflect: true, attribute: 'message-property-hs'},
        publishHs:           {type: String, reflect: true, attribute: 'publish-hs'},
        subscribeEffect:     {type: String, reflect: true, attribute: 'subscribe-effect'},
        publishEffect:       {type: String, reflect: true, attribute: 'publish-effect'},
        effects:             {type: String, reflect: true},
        msgPropEffect:       {type: String, reflect: true, attribute: 'message-property-effect'},
        subscribeWhite:      {type: String, reflect: true, attribute: 'subscribe-white'},
        publishWhite:        {type: String, reflect: true, attribute: 'publish-white'},
        msgPropWhite:        {type: String, reflect: true, attribute: 'message-property-white'},
        subscribeWarmWhite:  {type: String, reflect: true, attribute: 'subscribe-warm-white'},
        publishWarmWhite:    {type: String, reflect: true, attribute: 'publish-warm-white'},
        msgPropWarmWhite:    {type: String, reflect: true, attribute: 'message-property-warm-white'},
        subscribeColdWhite:  {type: String, reflect: true, attribute: 'subscribe-cold-white'},
        publishColdWhite:    {type: String, reflect: true, attribute: 'publish-cold-white'},
        msgPropColdWhite:    {type: String, reflect: true, attribute: 'message-property-cold-white'},
        // N31: availability inherited from FeezalElement.
        label:               {type: String, reflect: true},
        labelOn:             {type: String, reflect: true, attribute: 'label-on'},
        labelOff:            {type: String, reflect: true, attribute: 'label-off'},
        icon:                {type: String, reflect: true},
        degrade:             {type: Boolean, reflect: true},
        discoveryId:         {type: String, reflect: true, attribute: 'discovery-id'},
        // E137: light state lives on the LightController (plain fields +
        // host.requestUpdate) — only the drag preview stays element-local.
        _dragBrt:   {state: true},   // live % while the brightness pill drags (null = not dragging)
    };

    static styles = [feezalBaseStyles, glassCardStyles, glassPopupStyles, css`
        .card {
            cursor: pointer;
            gap: 2px;
            transition: transform 0.15s ease, background 0.2s ease;
            touch-action: manipulation;
        }
        .card:active { transform: scale(0.97); }
        .card.on { background: var(--feezal-glass-on-tint, rgba(255,255,255,0.62)); }
        feezal-icon {
            font-size: var(--feezal-glass-icon-size, 28px); line-height: 1;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            transition: color 0.2s ease;
        }
        .card.on feezal-icon { color: var(--feezal-glass-accent, #ff9f0a); }
        .state { font-size: var(--feezal-glass-font-size-state, 15px); font-weight: 700; }
        .label {
            font-size: var(--feezal-glass-font-size-label, 12px); font-weight: 600; line-height: 1.2;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .unavail {
            position: absolute; bottom: 8px; right: 10px;
            font-size: 12px; color: var(--error-color, #d32f2f); opacity: 0.85;
        }
        /* E105: much wider than tall → horizontal layout (Apple-Home wide
           tile): icon left, state/label stacked right of it. flip-btn and
           unavail stay absolutely positioned in their corners. */
        @container (min-aspect-ratio: 2/1) {
            .card {
                display: grid;
                grid-template: 'icon state' auto 'icon label' auto / auto 1fr;
                align-content: center;
                align-items: center;
                column-gap: 10px;
                text-align: left;
            }
            .card > feezal-icon { grid-area: icon; }
            .card .state { grid-area: state; align-self: end; }
            .card .label { grid-area: label; align-self: start; }
        }
        /* Big vertical brightness slider — the Apple pill: filled from the
           bottom, drag anywhere on it. */
        .vslider {
            position: relative; width: 72px; height: 170px; flex: 0 0 auto;
            border-radius: 20px; overflow: hidden; cursor: grab;
            background: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 12%, transparent);
            touch-action: none; user-select: none;
        }
        .vslider .fill {
            position: absolute; left: 0; right: 0; bottom: 0;
            background: var(--feezal-glass-on-tint, rgba(255,255,255,0.95));
        }
        .vslider .pct {
            position: absolute; left: 0; right: 0; bottom: 10px; text-align: center;
            font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums;
            pointer-events: none;
        }
        .vslider feezal-icon {
            position: absolute; left: 0; right: 0; top: 12px; text-align: center;
            font-size: 22px; pointer-events: none;
        }
        /* Horizontal colour-temperature slider */
        input[type="range"].ct {
            -webkit-appearance: none; appearance: none;
            width: 100%; height: 24px; border-radius: 12px; cursor: pointer;
            background: linear-gradient(to right, #ff8c00, #fff8ee 50%, #aac4ff);
        }
        input[type="range"].ct::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none;
            width: 22px; height: 22px; border-radius: 50%;
            background: #fff; border: 1px solid rgba(0,0,0,0.25);
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        input[type="range"].ct::-moz-range-thumb {
            width: 22px; height: 22px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.25);
            background: #fff;
        }
        /* Round hue/saturation picker — hue by angle, saturation by radius. */
        .wheel {
            position: relative; width: 130px; height: 130px; flex: 0 0 auto;
            border-radius: 50%; cursor: crosshair; touch-action: none;
            background:
                radial-gradient(circle, #fff 0%, rgba(255,255,255,0) 72%),
                conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
            box-shadow: inset 0 0 6px rgba(0,0,0,0.2);
        }
        .wheel .knob {
            position: absolute; width: 18px; height: 18px; border-radius: 50%;
            border: 2px solid #fff; box-shadow: 0 0 4px rgba(0,0,0,0.5);
            transform: translate(-50%, -50%); pointer-events: none;
        }
    `];

    constructor() {
        super();
        this.size = '';
        this.payloadMode = 'separate';
        this.publish = '';
        this.jsonMap = '';
        this.onOffSource = 'topic';
        this.subscribeState = '';
        this.msgPropState = '';
        this.publishState = '';
        this.payloadOn = 'on';
        this.payloadOff = 'off';
        this.subscribeBrightness = '';
        this.msgPropBrightness = '';
        // E127: ramp settling
        this.subscribeWorking = '';
        this.msgPropWorking = 'payload.val';
        this.subscribeSettled = '';
        this.msgPropSettled = 'payload.val';
        this.settleTimeout = 5;
        this.reportDelayMs = 100;
        this.publishBrightness = '';
        this.brightnessMin = 0;
        this.brightnessMax = 100;
        this.mode = 'brightness';
        this.subscribeColorTemp = '';
        this.msgPropColorTemp = '';
        this.publishColorTemp = '';
        this.colorTempUnit = 'kelvin';
        this.colorTempMin = 2700;
        this.colorTempMax = 6500;
        this.subscribeRgb = '';
        this.msgPropRgb = '';
        this.publishRgb = '';
        this.subscribeHs = '';
        this.msgPropHs = '';
        this.publishHs = '';
        this.subscribeEffect = '';
        this.publishEffect = '';
        this.effects = '';
        this.msgPropEffect = '';
        this.subscribeWhite = '';
        this.publishWhite = '';
        this.msgPropWhite = '';
        this.subscribeWarmWhite = '';
        this.publishWarmWhite = '';
        this.msgPropWarmWhite = '';
        this.subscribeColdWhite = '';
        this.publishColdWhite = '';
        this.msgPropColdWhite = '';
        this.label = '';
        this.labelOn = 'On';
        this.labelOff = 'Off';
        this.icon = 'lightbulb';
        this.degrade = false;
        this.discoveryId = '';
        this._dragBrt = null;
        this._pressTimer = null;
        this._longPressed = false;
        // E137: the behavior layer — wires/parses/publishes; this view renders.
        this.light = new LightController(this);
    }

    // The light fully manages its own subscriptions (via the controller);
    // suppress the generic base subscription path.
    _subscribe() { /* intentionally empty */ }

    // E137: the LightController wires everything in hostConnected and
    // disposes the settling machinery in hostDisconnected.

    updated(changed) {
        super.updated(changed);
        // Live-canvas topic edits re-wire through the controller.
        this.light.rewireIfChanged();
        // The size grid writes the element's inline geometry (editor keeps
        // full manual control afterwards).
        if (changed.has('size')) applySizePreset(this);
        // Promote the details popup into the top layer (system-pin pattern).
        // Removing it from the DOM on close dismisses the popover.
        if (changed.has('_details') && this._details) {
            const popup = this.renderRoot.querySelector('.details');
            if (popup?.showPopover && !popup.matches(':popover-open')) {
                try { popup.showPopover(); } catch { /* fixed+z-index fallback */ }
            }
            this._positionDetails();
        }
    }

    // ── view state ────────────────────────────────────────────────────────────

    /** Brightness % to display — drag preview wins over the controller state. */
    get _dispBrt() {
        return this._dragBrt !== null ? this._dragBrt : (this.light.brt ?? null);
    }

    /** Current [hue, sat%] for the colour wheel, from the controller's hs/rgb. */
    _hueSat() {
        if (this.mode === 'hs' && this.light.hs) return this.light.hs;
        if (this.light.rgb) {
            const {h, s} = rgbToHsv(...this.light.rgb);
            return [h, s * 100];
        }
        return this.light.hs ?? [0, 100];
    }

    // ── interaction: tap toggles, long-press (or ⋯) opens the details popup ──

    _onPointerDown() {
        if (feezal.isEditor) return;
        this._longPressed = false;
        clearTimeout(this._pressTimer);
        this._pressTimer = setTimeout(() => {
            this._longPressed = true;
            this.openDetails();
        }, LONG_PRESS_MS);
    }

    _onPointerUp() {
        clearTimeout(this._pressTimer);
        if (this._suppressTap) {
            this._suppressTap = false;
            return;
        }
        if (!this._longPressed && !this._details && !feezal.isEditor) {
            this.light.toggle();
        }
    }

    _onPointerLeave() {
        clearTimeout(this._pressTimer);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearTimeout(this._pressTimer);
        // E127: the controller disposes the settling machinery in
        // hostDisconnected.
    }

    // ── details popup controls ────────────────────────────────────────────────

    /** Vertical brightness pill: pointer position → %; publish on release. */
    _vsliderDown(e) {
        if (feezal.isEditor) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        this.__vsliderDragging = true;
        this._vsliderApply(e);
    }

    _vsliderMove(e) {
        if (this.__vsliderDragging) this._vsliderApply(e);
    }

    _vsliderUp(e) {
        if (!this.__vsliderDragging) return;
        this.__vsliderDragging = false;
        this._vsliderApply(e);
        const final = this._dragBrt ?? 0;
        this._dragBrt = null;
        // E137: clamp/scale/publish + settling + E77 on/off derivation
        // all live behind the controller command.
        this.light.setBrightnessPct(final);
    }

    _vsliderApply(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = Math.round((1 - (e.clientY - rect.top) / rect.height) * 100);
        this._dragBrt = Math.max(0, Math.min(100, pct));
    }

    /** Colour-temperature slider: live preview while dragging (@input),
     * kelvin publish on release (@change). */
    _onCtInput(e) {
        this.light.colorTemp = Math.round(Number(e.target.value));
        this.requestUpdate();
    }

    _onCtChange(e) {
        if (feezal.isEditor) return;
        this.light.setColorTempK(Math.round(Number(e.target.value)));
    }

    /** Round hue/saturation wheel: angle → hue (0 = top, clockwise),
     * radius → saturation; publish on release. */
    _wheelDown(e) {
        if (feezal.isEditor) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        this.__wheelDragging = true;
        this._wheelApply(e, false);
    }

    _wheelMove(e) {
        if (this.__wheelDragging) this._wheelApply(e, false);
    }

    _wheelUp(e) {
        if (!this.__wheelDragging) return;
        this.__wheelDragging = false;
        this._wheelApply(e, true);
    }

    _wheelApply(e, publish) {
        const rect = e.currentTarget.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const hue = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
        const sat = Math.min(1, Math.sqrt(dx * dx + dy * dy) / (rect.width / 2));
        if (publish) {
            // E137: mode-aware RGB/HS scaling + publish live behind the command.
            this.light.pickColor(hue, sat);
            return;
        }
        // Live preview on the controller state; the wire publish is on release.
        if (this.mode === 'rgb') this.light.rgb = hsvToRgb(hue, sat, 1);
        else this.light.hs = [Math.round(hue), Math.round(sat * 100)];
        this.requestUpdate();
    }

    /** Knob position (CSS %) for the current hue/sat. */
    _wheelKnobPos() {
        const [hue, sat] = this._hueSat();
        const r = (sat / 100) * 50;
        const rad = hue * Math.PI / 180;
        return {x: 50 + r * Math.sin(rad), y: 50 - r * Math.cos(rad)};
    }

    _stateText() {
        if (!this.light.on) return this.labelOff || 'Off';
        const on = this.labelOn || 'On';
        // E127 dual-topic mode: the % text follows the live topic during ramps;
        // an active pill drag previews its value.
        const brt = this._dragBrt ?? this.light.brtLive ?? this.light.brt;
        return brt !== null && brt !== undefined ? `${on} • ${Math.round(brt)} %` : on;
    }

    /** Capabilities decide which popup sections exist — NOT the mode alone:
     * brightness is always offered when the lamp is dimmable (Apple Home
     * behaviour); CT and colour additionally show for their topics or, in
     * json mode, when the mode declares them. */
    _capabilities() {
        const mode = this.mode || 'brightness';
        const json = this.payloadMode === 'json';
        // E122: on_off declares a switch-only lamp — no popup sections at
        // all, regardless of which topics happen to be configured.
        if (mode === 'on_off') return {brightness: false, ct: false, color: false};
        return {
            brightness: Boolean(this.subscribeBrightness || this.publishBrightness || json),
            ct: Boolean(this.subscribeColorTemp || this.publishColorTemp ||
                (json && (mode === 'brightness_ct' || mode === 'color_temp'))),
            color: Boolean(this.subscribeRgb || this.publishRgb || this.subscribeHs || this.publishHs ||
                (json && (mode === 'rgb' || mode === 'hs'))),
        };
    }


    _renderDetails() {
        const caps = this._capabilities();
        const knob = this._wheelKnobPos();
        return html`
            <div class="details" popover="manual">
                <div class="title">${this.label || 'Light'}</div>
                ${caps.brightness ? html`
                    <div class="vslider"
                        @pointerdown="${this._vsliderDown}"
                        @pointermove="${this._vsliderMove}"
                        @pointerup="${this._vsliderUp}">
                        <div class="fill" style="height:${this._dispBrt ?? 0}%"></div>
                        <feezal-icon name="${this.icon || 'lightbulb'}"></feezal-icon>
                        <div class="pct">${this._dispBrt ?? 0} %</div>
                    </div>` : ''}
                ${caps.ct ? html`
                    <input type="range" class="ct" title="Colour temperature"
                        min="${this.colorTempMin || 2700}" max="${this.colorTempMax || 6500}" step="1"
                        .value="${String(this.light.colorTemp ?? this.colorTempMin ?? 2700)}"
                        @input="${this._onCtInput}"
                        @change="${this._onCtChange}">` : ''}
                ${caps.color ? html`
                    <div class="wheel"
                        @pointerdown="${this._wheelDown}"
                        @pointermove="${this._wheelMove}"
                        @pointerup="${this._wheelUp}">
                        <div class="knob" style="left:${knob.x}%; top:${knob.y}%"></div>
                    </div>` : ''}
            </div>`;
    }

    render() {
        const caps = this._capabilities();
        const hasDetail = caps.brightness || caps.ct || caps.color;

        return html`
            <div class="card ${this.light.on ? 'on' : ''}" role="button" tabindex="0"
                @pointerdown="${this._onPointerDown}"
                @pointerup="${this._onPointerUp}"
                @pointerleave="${this._onPointerLeave}"
                @keydown="${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!feezal.isEditor) this.light.toggle(); } }}">
                ${hasDetail ? html`
                    <button class="flip-btn" title="Details"
                        @pointerdown="${e => e.stopPropagation()}"
                        @pointerup="${e => e.stopPropagation()}"
                        @click="${e => { e.stopPropagation(); this.openDetails(); }}">tune</button>` : ''}
                ${!this._available ? html`<span class="unavail" title="Device unavailable">⚠</span>` : ''}
                <feezal-icon name="${this.icon || 'lightbulb'}"></feezal-icon>
                <span class="state">${this._stateText()}</span>
                <span class="label">${this.label || (feezal.isEditor ? 'Light' : '')}</span>
            </div>
            ${this._details ? this._renderDetails() : ''}
        `;
    }
}

customElements.define('feezal-element-glass-light', FeezalElementGlassLight);

// ── N6 custom inspector ──────────────────────────────────────────────────────
// Two-tab Topics/Config inspector following the material device-card pattern
// (material-cover/-light): capability-gated sections on the Topics tab,
// payload/behaviour settings on Config. Uses <sl-*> without importing
// Shoelace (editor-only).

class FeezalElementGlassLightInspector extends LitElement {
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
            display: flex; align-items: center; gap: 8px; padding: 6px 8px; font-weight: 600;
            background: var(--feezal-bg-sub, #f5f5f5); border-radius: 6px 6px 0 0;
        }
        .sec-head.collapsed { border-radius: 6px; }
        .sec-title { flex: 1; }
        .sec-body { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
        .field { display: flex; flex-direction: column; gap: 2px; }
        .field > label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; }
        sl-input, sl-select { width: 100%; }
        sl-input::part(form-control-label), sl-select::part(form-control-label) { color: var(--sl-input-label-color, inherit); font-size: 12px; }
        sl-input::part(base), sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        sl-switch { color: var(--feezal-color, inherit); }
        .row { display: flex; gap: 6px; }
        .row > .field { flex: 1; }
        .hint { font-size: 10px; opacity: 0.55; padding: 0 2px 4px; }
    `;

    constructor() {
        super();
        this.element = null;
        this._tab = 'topics';
        this._open = {};
    }

    willUpdate(changed) {
        if (changed.has('element')) this._open = {};
    }

    _val(name) { return this.element?.getAttribute(name) ?? ''; }
    _emit(name, value, rerender = false) {
        this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
            bubbles: true, composed: true, detail: {name, value},
        }));
        if (rerender) this.requestUpdate();
    }

    _topicInput(attr, label, placeholder = 'mqtt/topic') {
        return html`
            <div class="field">
                <label>${label}</label>
                <feezal-topic-input size="small" placeholder="${placeholder}"
                    value="${this._val(attr)}"
                    @sl-change="${e => this._emit(attr, e.target.value)}"></feezal-topic-input>
            </div>`;
    }

    _textInput(attr, label, placeholder = '') {
        return html`
            <div class="field">
                <label>${label}</label>
                <sl-input size="small" autocomplete="off" placeholder="${placeholder}"
                    value="${this._val(attr)}"
                    @sl-change="${e => this._emit(attr, e.target.value)}"></sl-input>
            </div>`;
    }

    _availabilityEnabled() {
        return this._open.availability || this._val('subscribe-availability') !== '';
    }

    _toggleAvailability(e) {
        if (e.target.checked) {
            this._open = {...this._open, availability: true};
        } else {
            this._emit('subscribe-availability', '');
            this._open = {...this._open, availability: false};
        }
        this.requestUpdate();
    }

    render() {
        if (!this.element) return html``;
        return html`
            <sl-tab-group @sl-tab-show="${e => { this._tab = e.detail.name; }}">
                <sl-tab slot="nav" panel="topics" ?active="${this._tab === 'topics'}">Topics</sl-tab>
                <sl-tab slot="nav" panel="config" ?active="${this._tab === 'config'}">Config</sl-tab>
                <sl-tab-panel name="topics">${this._renderTopics()}</sl-tab-panel>
                <sl-tab-panel name="config">${this._renderConfig()}</sl-tab-panel>
            </sl-tab-group>
        `;
    }

    _renderTopics() {
        const isJson = (this._val('payload-mode') || 'separate') === 'json';
        const availability = this._availabilityEnabled();
        const availabilitySection = html`
            <div class="section">
                <div class="sec-head ${availability ? '' : 'collapsed'}">
                    <span class="sec-title">Availability</span>
                    <sl-switch size="small" ?checked="${availability}"
                        @sl-change="${this._toggleAvailability}"></sl-switch>
                </div>
                ${availability ? html`<div class="sec-body">
                    ${this._topicInput('subscribe-availability', 'Subscribe')}
                </div>` : ''}
            </div>`;

        if (isJson) {
            return html`
                <div class="hint">JSON mode — one topic carries the whole state object ({state, brightness}).</div>
                <div class="section">
                    <div class="sec-head">State &amp; Control</div>
                    <div class="sec-body">
                        ${this._topicInput('subscribe', 'Subscribe (state topic)')}
                        ${this._topicInput('publish', 'Publish (…/set)')}
                    </div>
                </div>
                ${availabilitySection}`;
        }

        const brightnessSource = (this._val('on-off-source') || 'topic') === 'brightness';
        return html`
            ${brightnessSource ? '' : html`
                <div class="section">
                    <div class="sec-head">On / Off</div>
                    <div class="sec-body">
                        ${this._topicInput('subscribe-state', 'Subscribe (falls back to subscribe)')}
                        ${this._topicInput('publish-state', 'Publish')}
                    </div>
                </div>`}
            <div class="section">
                <div class="sec-head">Brightness</div>
                <div class="sec-body">
                    ${this._topicInput('subscribe-brightness', 'Subscribe')}
                    ${this._topicInput('publish-brightness', 'Publish')}
                </div>
            </div>
            <div class="section">
                <div class="sec-head">Settling (Homematic ramps)</div>
                <div class="sec-body">
                    ${this._topicInput('subscribe-working', 'WORKING ↓')}
                    ${this._topicInput('subscribe-settled', 'Settled ↓ (LEVEL_NOTWORKING)')}
                </div>
            </div>
            <div class="section">
                <div class="sec-head">Color Temperature</div>
                <div class="sec-body">
                    ${this._topicInput('subscribe-color-temp', 'Subscribe')}
                    ${this._topicInput('publish-color-temp', 'Publish')}
                </div>
            </div>
            <div class="section">
                <div class="sec-head">Color — RGB / HS</div>
                <div class="sec-body">
                    ${this._topicInput('subscribe-rgb', 'Subscribe RGB')}
                    ${this._topicInput('publish-rgb', 'Publish RGB')}
                    ${this._topicInput('subscribe-hs', 'Subscribe HS')}
                    ${this._topicInput('publish-hs', 'Publish HS')}
                </div>
            </div>
            ${availabilitySection}`;
    }

    _renderConfig() {
        return html`
            <div class="section">
                <div class="sec-head">Wiring</div>
                <div class="sec-body">
                    <div class="field">
                        <label>Mode (popup sections in json mode)</label>
                        <sl-select size="small" value="${this._val('mode') || 'brightness'}"
                            @sl-change="${e => this._emit('mode', e.target.value, true)}">
                            <sl-option value="brightness">Brightness</sl-option>
                            <sl-option value="brightness_ct">Brightness + Color temp</sl-option>
                            <sl-option value="color_temp">Color temperature</sl-option>
                            <sl-option value="rgb">RGB</sl-option>
                            <sl-option value="hs">Hue / Saturation</sl-option>
                        </sl-select>
                    </div>
                    <div class="field">
                        <label>Payload mode</label>
                        <sl-select size="small" value="${this._val('payload-mode') || 'separate'}"
                            @sl-change="${e => this._emit('payload-mode', e.target.value, true)}">
                            <sl-option value="separate">separate (one topic per property)</sl-option>
                            <sl-option value="json">json (single topic)</sl-option>
                        </sl-select>
                    </div>
                    <div class="field">
                        <label>On/off source</label>
                        <sl-select size="small" value="${this._val('on-off-source') || 'topic'}"
                            @sl-change="${e => this._emit('on-off-source', e.target.value, true)}">
                            <sl-option value="topic">topic (dedicated state topic)</sl-option>
                            <sl-option value="brightness">brightness (derive from level — Homematic)</sl-option>
                        </sl-select>
                    </div>
                    ${(this._val('payload-mode') || 'separate') === 'json'
                        ? this._textInput('json-map', 'JSON key map (optional)', '{"state":"state","brightness":"brightness"}')
                        : ''}
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Payloads &amp; range</div>
                <div class="sec-body">
                    <div class="row">
                        ${this._textInput('payload-on', 'On', 'on')}
                        ${this._textInput('payload-off', 'Off', 'off')}
                    </div>
                    <div class="row">
                        ${this._textInput('brightness-min', 'Brightness min', '0')}
                        ${this._textInput('brightness-max', 'Brightness max', '100')}
                    </div>
                    <div class="row">
                        ${this._textInput('settle-timeout', 'Settle timeout (s)', '5')}
                        ${this._textInput('report-delay-ms', 'Report delay (ms)', '100')}
                    </div>
                    <div class="field">
                        <label>Color temp unit (topics)</label>
                        <sl-select size="small" value="${this._val('color-temp-unit') || 'kelvin'}"
                            @sl-change="${e => this._emit('color-temp-unit', e.target.value)}">
                            <sl-option value="kelvin">kelvin</sl-option>
                            <sl-option value="mired">mired</sl-option>
                        </sl-select>
                    </div>
                    <div class="row">
                        ${this._textInput('color-temp-min', 'Color temp min (K)', '2700')}
                        ${this._textInput('color-temp-max', 'Color temp max (K)', '6500')}
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Display</div>
                <div class="sec-body">
                    <div class="field">
                        <label>Size</label>
                        <sl-select size="small" value="${this._val('size') || ''}"
                            @sl-change="${e => this._emit('size', e.target.value)}">
                            <sl-option value="">Auto (manual size)</sl-option>
                            <sl-option value="2x2">2x2</sl-option>
                            <sl-option value="2x1">2x1</sl-option>
                        </sl-select>
                    </div>
                    ${this._textInput('label', 'Label', 'Ceiling light')}
                    ${this._textInput('label-on', 'State text on', 'On')}
                    ${this._textInput('label-off', 'State text off', 'Off')}
                    ${this._textInput('icon', 'Icon', 'lightbulb')}
                    <div class="field">
                        <sl-switch size="small" ?checked="${this.element.hasAttribute('degrade')}"
                            @sl-change="${e => this._emit('degrade', e.target.checked || null)}">
                            Degrade (no live blur — weak GPUs)
                        </sl-switch>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Availability payloads</div>
                <div class="sec-body">
                    <div class="row">
                        ${this._textInput('payload-available', 'Online', 'online')}
                        ${this._textInput('payload-unavailable', 'Offline', 'offline')}
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Message property</div>
                <div class="sec-body">
                    <div class="hint">Dot-notation path per topic; blank falls back to the global one.</div>
                    ${this._textInput('message-property', 'Global (all topics)', 'payload')}
                    ${this._textInput('message-property-state', 'On/off topic', 'payload')}
                    ${this._textInput('message-property-brightness', 'Brightness topic', 'payload')}
                    ${this._textInput('message-property-availability', 'Availability topic', 'payload')}
                </div>
            </div>
        `;
    }
}

customElements.define('feezal-element-glass-light-inspector', FeezalElementGlassLightInspector);

export {FeezalElementGlassLight};

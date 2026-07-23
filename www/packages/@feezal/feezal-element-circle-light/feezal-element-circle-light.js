/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
// E137: the light behavior lives in the shared controller — this element
// is a VIEW (Circle chrome: brightness ring + centre + control rows).
import {LightController, lightAttributes, lightDiscoveryMap, pctToRaw, rgbToHsv} from '@feezal/feezal-controller-light';
import '@feezal/feezal-element/feezal-topic-input.js';
import {svg, LitElement} from 'lit';
import '@material/web/slider/slider.js';

// ─── Arc geometry (0° = top, clockwise, matches feezal-element-material-gauge convention) ───
const CX = 50;
const CY = 50;
const TRACK_R = 40;   // brightness ring centre-line radius
const RING_W  = 7;    // ring stroke width
const CENTER_R = 26;  // centre-circle radius (toggle / colour zone)
const POWER_R  = 10;  // inner power-toggle zone radius (within centre)
const ARC_START = 225;
const ARC_SWEEP = 270;

function polarXY(deg, r) {
    const rad = (deg - 90) * Math.PI / 180;
    return [+(CX + r * Math.cos(rad)).toFixed(3), +(CY + r * Math.sin(rad)).toFixed(3)];
}

function arcPath(fromDeg, toDeg, r) {
    const [ax, ay] = polarXY(fromDeg, r);
    const [bx, by] = polarXY(toDeg, r);
    const sweep = ((toDeg - fromDeg) + 360) % 360;
    return `M${ax},${ay} A${r},${r} 0 ${sweep > 180 ? 1 : 0},1 ${bx},${by}`;
}

function pctToAngle(pct) {
    return (ARC_START + (Math.max(0, Math.min(100, pct)) / 100) * ARC_SWEEP) % 360;
}

function angleToPct(deg) {
    const arcEnd = (ARC_START + ARC_SWEEP) % 360; // 135
    let n;
    if (deg >= ARC_START) n = deg - ARC_START;
    else if (deg <= arcEnd) n = deg + (360 - ARC_START);
    else n = deg < 180 ? ARC_SWEEP : 0; // gap zone — clamp to nearest end
    return Math.max(0, Math.min(100, Math.round(n / ARC_SWEEP * 100)));
}

// E137: pctToRaw lives in @feezal/feezal-element/feezal-color.js now —
// re-exported here for back-compat with prior importers (tests).
export {pctToRaw};

// E137: colour machinery lives in @feezal/feezal-element/feezal-color.js.

// ─── Element ──────────────────────────────────────────────────────────────────
class FeezalElementCircleLight extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Light', category: 'Circle', color: '#1565c0', icon: 'lightbulb'},
            description: 'Smart light card — brightness ring, colour temperature, RGB/HS colour wheel, white channel, and effect selector.',
            // ── N6 custom inspector (E35) ──────────────────────────────────
            inspector: 'feezal-element-circle-light-inspector',
            // ── N12 Auto-Discovery descriptor (E35 extended) ───────────────
            // zigbee2mqtt / HA discovery always emits the JSON schema, so an
            // auto-configured light defaults to payload-mode: json with a single
            // subscribe (base topic) / publish (…/set) pair. Capability ranges
            // (brightness scale, mired→kelvin temp range, effect list) and the
            // active colour control are mapped from the config too.
            // E137: the discovery map is the controller package's fragment.
            discovery: {component: 'light', map: lightDiscoveryMap},
            attributes: [
                // E137: the shared light contract (both payload modes, E77
                // on/off-from-brightness, E127 settling, CT/RGB/HS/effects/
                // white channels) — declared ONCE by the controller package.
                ...lightAttributes,
                // Availability
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability. When unavailable a small badge is shown; the control stays usable.'},
                {name: 'payload-available',      type: 'string', default: 'online',  help: 'Payload meaning the device is available.'},
                {name: 'payload-unavailable',    type: 'string', default: 'offline', help: 'Payload meaning the device is unavailable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path for availability topic. Defaults to message-property.'},
                // Label
                {name: 'label', type: 'string', default: '', help: 'Optional label shown below the circle.'},
                {name: 'label-off', type: 'string', default: 'off', help: 'Displayed centre text while the light is off (localise, e.g. "aus"). Display only — NOT the MQTT payload (payload-off) and NOT the card label.'}
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                // Theme-aware colour tokens — editable in the Style inspector.
                // The `default` is shown as the field placeholder so the active
                // mapping is visible; leave a field blank to inherit it.
                // on-color  → filled brightness arc, drag knob, centre tint/outline while ON
                // off-color → unfilled ring groove + centre outline while OFF
                {property: '--feezal-light-on-color',      type: 'color', default: 'var(--primary-text-color)'},
                {property: '--feezal-light-off-color',     type: 'color', default: 'var(--secondary-text-color)'},
                {property: '--feezal-light-surface-color', type: 'color', default: 'var(--primary-background-color)'},
                {property: '--feezal-light-text-color',    type: 'color', default: 'var(--primary-text-color)'},
                {property: '--feezal-light-error-color',   type: 'color', default: 'var(--error-color)'},
                // B29 — ring geometry, unitless % of the slider viewBox; the same
                // numbers on material-climate give an identical-looking slider.
                {property: '--feezal-light-track-width', default: '7',
                    help: 'Brightness-ring track width — unitless, in % of the circle viewBox (default 7). Same scale as --feezal-climate-track-width.'},
                {property: '--feezal-light-knob-size', default: '10',
                    help: 'Drag-knob diameter — unitless, in % of the circle viewBox (default 10). Same scale as --feezal-climate-knob-size.'}
            ],
            restrict: {minWidth: 120, minHeight: 140},
            defaultStyle: {width: '180px', height: '220px'}
        };
    }

    static properties = {
        payloadMode:        {type: String, reflect: true, attribute: 'payload-mode'},
        publish:            {type: String, reflect: true, attribute: 'publish'},
        jsonMap:            {type: String, reflect: true, attribute: 'json-map'},
        onOffSource:        {type: String, reflect: true, attribute: 'on-off-source'},
        subscribeState:     {type: String, reflect: true, attribute: 'subscribe-state'},
        msgPropState:       {type: String, reflect: true, attribute: 'message-property-state'},
        publishState:       {type: String, reflect: true, attribute: 'publish-state'},
        payloadOn:          {type: String, reflect: true, attribute: 'payload-on'},
        payloadOff:         {type: String, reflect: true, attribute: 'payload-off'},
        subscribeBrightness:{type: String, reflect: true, attribute: 'subscribe-brightness'},
        publishBrightness:  {type: String, reflect: true, attribute: 'publish-brightness'},
        brightnessMin:      {type: Number, reflect: true, attribute: 'brightness-min'},
        brightnessMax:      {type: Number, reflect: true, attribute: 'brightness-max'},
        subscribeColorTemp: {type: String, reflect: true, attribute: 'subscribe-color-temp'},
        publishColorTemp:   {type: String, reflect: true, attribute: 'publish-color-temp'},
        colorTempUnit:      {type: String, reflect: true, attribute: 'color-temp-unit'},
        colorTempMin:       {type: Number, reflect: true, attribute: 'color-temp-min'},
        colorTempMax:       {type: Number, reflect: true, attribute: 'color-temp-max'},
        subscribeRgb:       {type: String, reflect: true, attribute: 'subscribe-rgb'},
        publishRgb:         {type: String, reflect: true, attribute: 'publish-rgb'},
        subscribeHs:        {type: String, reflect: true, attribute: 'subscribe-hs'},
        publishHs:          {type: String, reflect: true, attribute: 'publish-hs'},
        mode:               {type: String, reflect: true},
        subscribeEffect:    {type: String, reflect: true, attribute: 'subscribe-effect'},
        publishEffect:      {type: String, reflect: true, attribute: 'publish-effect'},
        effects:            {type: String, reflect: true},
        subscribeWhite:     {type: String, reflect: true, attribute: 'subscribe-white'},
        publishWhite:       {type: String, reflect: true, attribute: 'publish-white'},
        subscribeWarmWhite: {type: String, reflect: true, attribute: 'subscribe-warm-white'},
        publishWarmWhite:   {type: String, reflect: true, attribute: 'publish-warm-white'},
        subscribeColdWhite: {type: String, reflect: true, attribute: 'subscribe-cold-white'},
        publishColdWhite:   {type: String, reflect: true, attribute: 'publish-cold-white'},
        // N31: availability inherited from FeezalElement.
        discoveryId:        {type: String, reflect: true, attribute: 'discovery-id'},
        msgPropBrightness:  {type: String, reflect: true, attribute: 'message-property-brightness'},
        // E127: ramp settling
        subscribeWorking:   {type: String, reflect: true, attribute: 'subscribe-working'},
        msgPropWorking:     {type: String, reflect: true, attribute: 'message-property-working'},
        subscribeSettled:   {type: String, reflect: true, attribute: 'subscribe-settled'},
        msgPropSettled:     {type: String, reflect: true, attribute: 'message-property-settled'},
        settleTimeout:      {type: Number, reflect: true, attribute: 'settle-timeout'},
        reportDelayMs:      {type: Number, reflect: true, attribute: 'report-delay-ms'},
        msgPropColorTemp:   {type: String, reflect: true, attribute: 'message-property-color-temp'},
        msgPropRgb:         {type: String, reflect: true, attribute: 'message-property-rgb'},
        msgPropHs:          {type: String, reflect: true, attribute: 'message-property-hs'},
        msgPropEffect:      {type: String, reflect: true, attribute: 'message-property-effect'},
        msgPropWhite:       {type: String, reflect: true, attribute: 'message-property-white'},
        msgPropWarmWhite:   {type: String, reflect: true, attribute: 'message-property-warm-white'},
        msgPropColdWhite:   {type: String, reflect: true, attribute: 'message-property-cold-white'},
        label:              {type: String, reflect: true},
        labelOff:           {type: String, reflect: true, attribute: 'label-off'},
        // E137: light state lives on the LightController (plain fields +
        // host.requestUpdate) — only the drag preview stays element-local.
        _dragBrt:   {state: true},   // live brightness during ring drag (null = not dragging)
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

            /* ── Theme-aware colour tokens (state-aware) ────────────────────
               Five overridable colours, each defaulting to a feezal/HA theme
               variable (with a literal fallback). Override per-element via the
               Style inspector or a theme rule.
                 on-color  → filled brightness arc + drag knob + centre
                             tint/outline while the lamp is ON
                 off-color → unfilled ring groove + centre outline while OFF
               In colour-temperature / RGB / HS modes the ring and centre show
               the live light colour, which overrides on-color. The CT gradient
               and hue wheel stay fixed — they represent the real light output. */
            --feezal-light-on-color:      var(--primary-text-color, var(--primary-color, var(--sl-color-primary-600, #0284c7)));
            --feezal-light-off-color:     var(--secondary-text-color, var(--divider-color, var(--feezal-border, #e0e0e0)));
            --feezal-light-surface-color: var(--primary-background-color, var(--feezal-bg, #fff));
            --feezal-light-text-color:    var(--primary-text-color, var(--feezal-color, #333));
            --feezal-light-error-color:   var(--error-color, #b00020);

            --md-sys-color-primary:    var(--feezal-light-on-color);
            --md-sys-color-surface:    var(--feezal-light-surface-color);
            --md-sys-color-on-surface: var(--feezal-light-text-color);
            /* Outlined-select field + dropdown menu theming (effect selector).
               The menu surface, outline, label and selected-item colours all
               read from the same theme tokens so the popup respects the theme. */
            --md-sys-color-on-surface-variant:        var(--feezal-light-text-color);
            --md-sys-color-outline:                   var(--feezal-light-off-color);
            --md-sys-color-outline-variant:           var(--feezal-light-off-color);
            --md-sys-color-surface-container:         var(--feezal-light-surface-color);
            --md-sys-color-surface-container-high:    var(--feezal-light-surface-color);
            --md-sys-color-surface-container-highest: var(--feezal-light-surface-color);
            --md-sys-color-secondary-container:       var(--feezal-light-on-color);
            --md-sys-color-on-secondary-container:    var(--feezal-light-surface-color);
        }
        .unavail {
            position: absolute;
            top: 4px;
            right: 4px;
            width: 18px;
            height: 18px;
            color: var(--feezal-light-error-color);
            opacity: 0.8;
            pointer-events: none;
            z-index: 2;
        }
        .unavail svg { width: 100%; height: 100%; display: block; }
        .ring-wrap { width: 100%; flex-shrink: 0; }
        svg {
            width: 100%;
            display: block;
            aspect-ratio: 1;
            overflow: visible;
            touch-action: none;
            user-select: none;
            /* B47: iOS Safari — no text-selection callout / magnifier on a
               long-press mid-drag. */
            -webkit-user-select: none;
            -webkit-touch-callout: none;
        }
        .controls { width: 100%; display: flex; flex-direction: column; gap: 4px; }
        .ctrl-label {
            font-size: 10px; opacity: 0.55;
            color: var(--feezal-light-text-color);
            margin-bottom: -2px;
        }
        .ct-track {
            position: relative; height: 22px; border-radius: 11px;
            background: linear-gradient(to right, #ff8c00, #fff8ee 50%, #aac4ff);
            cursor: pointer; touch-action: none;
        }
        .ct-thumb {
            position: absolute; top: 50%;
            transform: translate(-50%, -50%);
            width: 18px; height: 18px; border-radius: 50%;
            border: 2px solid rgba(0,0,0,0.2);
            background: var(--feezal-light-surface-color); pointer-events: none;
            box-shadow: 0 1px 4px rgba(0,0,0,0.25);
        }
        md-slider { width: 100%; }
        select.effect-select {
            width: 100%; box-sizing: border-box;
            background: var(--feezal-light-surface-color); color: var(--feezal-light-text-color);
            border: 1px solid var(--feezal-light-off-color); border-radius: 6px;
            padding: 3px 6px; font-size: 11px; line-height: 1.4;
            cursor: pointer; outline: none; appearance: auto;
        }
        select.effect-select:hover { border-color: var(--feezal-light-text-color); }
        .label {
            font-size: 11px; opacity: 0.65; text-align: center;
            color: var(--feezal-light-text-color);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;
        }
    `];

    constructor() {
        super();
        this.payloadMode         = 'separate';
        this.publish             = '';
        this.jsonMap             = '';
        this.onOffSource         = 'topic';
        this.subscribeState      = '';
        this.msgPropState        = '';
        this.publishState        = '';
        this.payloadOn           = 'on';
        this.payloadOff          = 'off';
        this.subscribeBrightness = '';
        this.publishBrightness   = '';
        this.brightnessMin       = 0;
        this.brightnessMax       = 100;
        this.subscribeColorTemp  = '';
        this.publishColorTemp    = '';
        this.colorTempUnit       = 'kelvin';
        this.colorTempMin        = 2700;
        this.colorTempMax        = 6500;
        this.subscribeRgb        = '';
        this.publishRgb          = '';
        this.subscribeHs         = '';
        this.publishHs           = '';
        this.mode                = 'brightness';
        this.subscribeEffect     = '';
        this.publishEffect       = '';
        this.effects             = '';
        this.subscribeWhite      = '';
        this.publishWhite        = '';
        this.subscribeWarmWhite  = '';
        this.publishWarmWhite    = '';
        this.subscribeColdWhite  = '';
        this.publishColdWhite    = '';
        this.discoveryId         = '';
        this.msgPropBrightness   = '';
        // E127: ramp settling
        this.subscribeWorking    = '';
        this.msgPropWorking      = 'payload.val';
        this.subscribeSettled    = '';
        this.msgPropSettled      = 'payload.val';
        this.settleTimeout       = 5;
        this.reportDelayMs       = 100;
        this.msgPropColorTemp    = '';
        this.msgPropRgb          = '';
        this.msgPropHs           = '';
        this.msgPropEffect       = '';
        this.msgPropWhite        = '';
        this.msgPropWarmWhite    = '';
        this.msgPropColdWhite    = '';
        this.label               = '';
        this.labelOff            = 'off';
        this._dragBrt   = null;
        // Non-reactive drag flags
        this.__ctDragging = false;
        // E137: the behavior layer — wires/parses/publishes; this view renders.
        this.light = new LightController(this);
    }

    // The light fully manages its own subscriptions below; suppress the generic
    // base subscription path (which would otherwise fire for the json-mode
    // `subscribe` topic and try to set attributes by topic suffix).
    _subscribe() { /* intentionally empty — see connectedCallback */ }

    // E137: the LightController wires everything in hostConnected and
    // disposes the settling machinery in hostDisconnected.

    updated(changed) {
        super.updated(changed);
        // Live-canvas topic edits re-wire through the controller.
        this.light.rewireIfChanged();
    }

    // ─── SVG pointer handling ─────────────────────────────────────────────────
    _onSvgPointerDown(e) {
        if (feezal.isEditor) return;
        // B47: claim the gesture before the browser does — without this, iOS
        // Safari (and standalone/PWA viewers) starts a page scroll mid-drag.
        e.preventDefault();
        const {sx, sy} = this._toSvgCoords(e);
        const dx = sx - CX, dy = sy - CY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // E122: on_off mode — the whole enlarged disc toggles; there is no
        // ring, so no drag can ever start.
        if ((this.mode || 'brightness') === 'on_off') {
            if (dist <= TRACK_R + RING_W / 2) this.light.toggle();
            return;
        }

        if (dist <= CENTER_R) {
            this._handleCenterTap(dx, dy, dist);
        } else if ((this.light.on || this.light.dragFromOffAllowed()) && dist <= TRACK_R + RING_W) {
            this._startBrtDrag(e, sx, sy);
        }
    }

    _handleCenterTap(dx, dy, dist) {
        const mode = this.mode || 'brightness';
        const isColorMode = mode === 'rgb' || mode === 'hs';
        if (!this.light.on || !isColorMode || dist <= POWER_R) {
            // Power zone, simple modes, or light is off → toggle
            this.light.toggle();
        } else {
            // Outer wheel zone in rgb/hs mode while on → colour pick
            this._pickColor(dx, dy, dist);
        }
    }

    _pickColor(dx, dy, dist) {
        // Angle measured clockwise from top (matches the colour wheel segments drawn with polarXY)
        const hue = ((Math.atan2(dy, dx) * 180 / Math.PI) + 90 + 360) % 360;
        const sat = Math.min(1, dist / CENTER_R);
        this.light.pickColor(hue, sat);
    }

    _startBrtDrag(e, sx, sy) {
        this._dragBrt = this.light.brt ?? 0;

        // B47: own the gesture like the CT track does — capture the pointer
        // on the SVG so a circular drag that leaves the element keeps
        // delivering here, and swallow touchmove for the drag's duration:
        // iOS Safari (and the standalone/PWA viewer) otherwise rubber-band
        // scrolls the page mid-drag despite touch-action: none.
        const svg = e.currentTarget;
        try { svg.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
        const onTouchMove = ev => ev.preventDefault();
        document.addEventListener('touchmove', onTouchMove, {passive: false});

        const onMove = ev => {
            const {sx: x, sy: y} = this._toSvgCoords(ev);
            const deg = ((Math.atan2(y - CY, x - CX) * 180 / Math.PI) + 90 + 360) % 360;
            this._dragBrt = angleToPct(deg);
        };
        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.removeEventListener('touchmove', onTouchMove);
            const final = this._dragBrt;
            this._dragBrt = null;
            // E137: clamp/scale/publish + settling + E77 on/off derivation
            // all live behind the controller command.
            this.light.setBrightnessPct(final);
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        // Immediately update to click position
        const deg = ((Math.atan2(sy - CY, sx - CX) * 180 / Math.PI) + 90 + 360) % 360;
        this._dragBrt = angleToPct(deg);
    }

    _toSvgCoords(e) {
        const el = this.shadowRoot.querySelector('svg');
        if (!el) return {sx: 0, sy: 0};
        const r = el.getBoundingClientRect();
        return {sx: ((e.clientX - r.left) / r.width) * 100, sy: ((e.clientY - r.top) / r.height) * 100};
    }

    // ─── Colour temperature track ─────────────────────────────────────────────
    _onCtDown(e) {
        if (feezal.isEditor) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        this.__ctDragging = true;
        this._applyCt(e, false);
    }

    _onCtMove(e) {
        if (!this.__ctDragging) return;
        this._applyCt(e, false);
    }

    _onCtUp(e) {
        if (!this.__ctDragging) return;
        this.__ctDragging = false;
        this._applyCt(e, true);
    }

    _applyCt(e, publish) {
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const min = this.colorTempMin || 2700;
        const max = this.colorTempMax || 6500;
        const ct = Math.round(min + ratio * (max - min));
        if (publish) this.light.setColorTempK(ct);
        else { this.light.colorTemp = ct; this.requestUpdate(); }
    }

    // ─── White sliders ────────────────────────────────────────────────────────
    _onWhite(e, channel) {
        this.light.setWhite(channel, Number(e.target.value));
    }

    // ─── Effect selector ──────────────────────────────────────────────────────
    _onEffect(e) {
        this.light.setEffect(e.target.value);
    }

    // ─── Computed values ──────────────────────────────────────────────────────
    get _dispBrt() {
        return this._dragBrt !== null ? this._dragBrt : (this.light.brt ?? 0);
    }

    // ─── SVG content ─────────────────────────────────────────────────────────
    _svgContent() {
        const isOn   = this.light.on ?? true;
        const brt    = this._dispBrt ?? 60;
        const accent = this.light.accentColor() ?? 'var(--feezal-light-on-color)';
        const trackC = 'var(--feezal-light-off-color)';
        const mode   = this.mode || 'brightness';

        // E122: on_off mode — no ring, just a large centre power button
        // filling the ring's footprint (relay lamps / plugs have no level).
        if (mode === 'on_off') {
            const R = TRACK_R + RING_W / 2;
            return svg`
                <circle cx="${CX}" cy="${CY}" r="${R}"
                    fill="var(--feezal-light-surface-color)"
                    stroke="${isOn ? accent : trackC}" stroke-width="1.5"
                    pointer-events="none"/>
                ${isOn ? svg`
                    <circle cx="${CX}" cy="${CY}" r="${R - 1.5}"
                        fill="${accent}" opacity="0.14" pointer-events="none"/>
                ` : ''}
                <text x="${CX}" y="${CY - (isOn ? 0 : 4)}" text-anchor="middle"
                    dominant-baseline="middle" font-size="22"
                    fill="${isOn ? accent : trackC}" pointer-events="none">⏻</text>
                ${!isOn ? svg`
                    <text x="${CX}" y="${CY + 16}" text-anchor="middle"
                        dominant-baseline="middle" font-size="9"
                        opacity="0.55" fill="var(--feezal-light-off-color)"
                        pointer-events="none">${this.labelOff || 'off'}</text>
                ` : ''}`;
        }

        const arcEndAngle = (ARC_START + ARC_SWEEP) % 360; // 135°
        const fillAngle   = pctToAngle(brt);
        const trackD      = arcPath(ARC_START, arcEndAngle, TRACK_R);
        const fillD       = brt > 0.5 ? arcPath(ARC_START, fillAngle, TRACK_R) : null;
        const [hx, hy]    = polarXY(brt > 0.5 ? fillAngle : ARC_START, TRACK_R);

        return svg`
            <!-- Background track arc (B29: width configurable, unitless % of viewBox) -->
            <path d="${trackD}" fill="none" stroke="${trackC}"
                stroke-width="${RING_W}" stroke-linecap="round" pointer-events="none"
                style="stroke-width: calc(var(--feezal-light-track-width, ${RING_W}) * 1px)"/>

            <!-- Brightness fill arc -->
            ${isOn && fillD ? svg`
                <path d="${fillD}" fill="none" stroke="${accent}"
                    stroke-width="${RING_W}" stroke-linecap="round" pointer-events="none"
                    style="stroke-width: calc(var(--feezal-light-track-width, ${RING_W}) * 1px)"/>
            ` : ''}

            <!-- Centre disc -->
            <circle cx="${CX}" cy="${CY}" r="${CENTER_R}"
                fill="var(--feezal-light-surface-color)"
                stroke="${isOn ? accent : trackC}" stroke-width="1.5"
                pointer-events="none"/>

            <!-- On-state tint (visible in brightness mode; CT/colour modes draw over it) -->
            ${isOn ? svg`
                <circle cx="${CX}" cy="${CY}" r="${CENTER_R - 1.5}"
                    fill="${accent}" opacity="0.14" pointer-events="none"/>
            ` : ''}

            <!-- Centre content -->
            ${isOn
                ? this._svgCenter(mode, this._dragBrt !== null ? brt : (this.light.brtLive ?? brt), accent)
                : svg`<text x="${CX}" y="${CY}" text-anchor="middle"
                        dominant-baseline="middle" font-size="9"
                        opacity="0.55" fill="var(--feezal-light-off-color)"
                        pointer-events="none">${this.labelOff || 'off'}</text>`}

            <!-- Drag handle on ring (shown when on; B29: diameter configurable) -->
            ${isOn ? svg`
                <circle cx="${hx}" cy="${hy}" r="5"
                    fill="${accent}" stroke="var(--feezal-light-surface-color)" stroke-width="2"
                    pointer-events="none"
                    style="r: calc(var(--feezal-light-knob-size, 10) * 0.5px)"/>
            ` : ''}`;
    }

    _svgCenter(mode, brt, accent) {
        switch (mode) {
            case 'brightness':
            case 'brightness_ct':
                return svg`
                    <text x="${CX}" y="${CY}" text-anchor="middle"
                        dominant-baseline="middle" font-size="13" font-weight="500"
                        fill="var(--feezal-light-text-color)" pointer-events="none">
                        ${brt !== null ? `${Math.round(brt)}%` : '—'}
                    </text>`;

            case 'color_temp': {
                const k = this.light.colorTemp ?? null;
                return svg`
                    <defs>
                        <linearGradient id="feezal-ct-grad" gradientUnits="userSpaceOnUse"
                            x1="${CX - CENTER_R}" y1="${CY}" x2="${CX + CENTER_R}" y2="${CY}">
                            <stop offset="0%"   stop-color="#ff8c00"/>
                            <stop offset="50%"  stop-color="#fff8ee"/>
                            <stop offset="100%" stop-color="#aac4ff"/>
                        </linearGradient>
                        <clipPath id="feezal-ct-clip">
                            <circle cx="${CX}" cy="${CY}" r="${CENTER_R - 1.5}"/>
                        </clipPath>
                    </defs>
                    <circle cx="${CX}" cy="${CY}" r="${CENTER_R - 1.5}"
                        fill="url(#feezal-ct-grad)" clip-path="url(#feezal-ct-clip)"
                        pointer-events="none"/>
                    ${k ? svg`
                        <text x="${CX}" y="${CY}" text-anchor="middle"
                            dominant-baseline="middle" font-size="8.5"
                            fill="rgba(0,0,0,0.5)" pointer-events="none">${k}K</text>
                    ` : ''}`;
            }

            case 'rgb':
            case 'hs': {
                // Hue colour wheel: 36 pie segments (hue = segment angle in polarXY convention)
                const segs = [];
                const N = 36;
                for (let i = 0; i < N; i++) {
                    const a1 = i * (360 / N), a2 = (i + 1) * (360 / N);
                    const [x1, y1] = polarXY(a1, CENTER_R - 1.5);
                    const [x2, y2] = polarXY(a2, CENTER_R - 1.5);
                    segs.push(svg`<path
                        d="M${CX},${CY} L${x1},${y1} A${CENTER_R - 1.5},${CENTER_R - 1.5} 0 0,1 ${x2},${y2} Z"
                        fill="hsl(${a1},100%,50%)" stroke="none" pointer-events="none"/>`);
                }

                // Selected colour indicator dot (computed from current _rgb or _hs)
                let dotX = null, dotY = null;
                if (mode === 'rgb' && this.light.rgb) {
                    const {h, s} = rgbToHsv(...this.light.rgb);
                    // h matches polarXY angle (both: 0=top=red, clockwise)
                    const [px, py] = polarXY(h, s * (CENTER_R - 5));
                    dotX = px; dotY = py;
                } else if (mode === 'hs' && this.light.hs) {
                    const [px, py] = polarXY(this.light.hs[0], (this.light.hs[1] / 100) * (CENTER_R - 5));
                    dotX = px; dotY = py;
                }

                return svg`
                    <defs>
                        <clipPath id="feezal-wheel-clip">
                            <circle cx="${CX}" cy="${CY}" r="${CENTER_R - 1.5}"/>
                        </clipPath>
                        <radialGradient id="feezal-sat-grad" cx="50%" cy="50%" r="50%">
                            <stop offset="0%"  stop-color="white" stop-opacity="0.88"/>
                            <stop offset="70%" stop-color="white" stop-opacity="0"/>
                        </radialGradient>
                    </defs>
                    <!-- Hue segments -->
                    <g clip-path="url(#feezal-wheel-clip)" pointer-events="none">${segs}</g>
                    <!-- Saturation overlay (white-to-transparent radial gradient) -->
                    <circle cx="${CX}" cy="${CY}" r="${CENTER_R - 1.5}"
                        fill="url(#feezal-sat-grad)" clip-path="url(#feezal-wheel-clip)"
                        pointer-events="none"/>
                    <!-- Inner power-toggle zone -->
                    <circle cx="${CX}" cy="${CY}" r="${POWER_R}"
                        fill="rgba(0,0,0,0.3)" pointer-events="none"/>
                    <text x="${CX}" y="${CY + 0.5}" text-anchor="middle"
                        dominant-baseline="middle" font-size="11"
                        fill="white" pointer-events="none">⏻</text>
                    <!-- Selected colour dot -->
                    ${dotX !== null ? svg`
                        <circle cx="${dotX}" cy="${dotY}" r="3"
                            fill="white" stroke="rgba(0,0,0,0.4)" stroke-width="1"
                            pointer-events="none"/>
                    ` : ''}`;
            }

            default:
                return svg``;
        }
    }

    // ─── Controls below ring ──────────────────────────────────────────────────
    _renderControls() {
        const mode = this.mode || 'brightness';
        const parts = [];

        if (mode === 'color_temp' || mode === 'brightness_ct') {
            const min = this.colorTempMin || 2700;
            const max = this.colorTempMax || 6500;
            const ct  = this.light.colorTemp ?? min;
            const pct = Math.max(0, Math.min(100, ((ct - min) / (max - min)) * 100));
            parts.push(html`
                <div class="ctrl-label">Color temperature</div>
                <div class="ct-track"
                    @pointerdown="${this._onCtDown}"
                    @pointermove="${this._onCtMove}"
                    @pointerup="${this._onCtUp}">
                    <div class="ct-thumb" style="left:${pct.toFixed(1)}%"></div>
                </div>`);
        }

        if (this.subscribeWhite || this.publishWhite) {
            parts.push(html`
                <div class="ctrl-label">White</div>
                <md-slider min="0" max="100" value="${this.light.white ?? 0}"
                    @change="${e => this._onWhite(e, 'white')}"></md-slider>`);
        }
        if (this.subscribeWarmWhite || this.publishWarmWhite) {
            parts.push(html`
                <div class="ctrl-label">Warm white</div>
                <md-slider min="0" max="100" value="${this.light.warmWhite ?? 0}"
                    @change="${e => this._onWhite(e, 'warmWhite')}"></md-slider>`);
        }
        if (this.subscribeColdWhite || this.publishColdWhite) {
            parts.push(html`
                <div class="ctrl-label">Cold white</div>
                <md-slider min="0" max="100" value="${this.light.coldWhite ?? 0}"
                    @change="${e => this._onWhite(e, 'coldWhite')}"></md-slider>`);
        }
        if (this.effects) {
            const list = this.effects.split(',').map(s => s.trim()).filter(Boolean);
            if (list.length > 0) {
                parts.push(html`
                    <select class="effect-select" .value="${this.light.effect}" @change="${this._onEffect}">
                        <option value="" ?selected="${!this.light.effect}">— Effect —</option>
                        ${list.map(ef => html`<option value="${ef}" ?selected="${this.light.effect === ef}">${ef}</option>`)}
                    </select>`);
            }
        }

        return parts.length > 0 ? html`<div class="controls">${parts}</div>` : '';
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    render() {
        const showUnavail = this.subscribeAvailability && !this._available;
        return html`
            ${showUnavail ? html`
                <div class="unavail" title="Device unavailable">
                    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M24 8.98C20.93 5.9 16.69 4 12 4c-1.69 0-3.32.25-4.86.71l2.5 2.5c.77-.14 1.55-.21 2.36-.21 3.42 0 6.7 1.21 9.32 3.42L24 8.98zM2.81 2.81L1.39 4.22l2.05 2.05C2.2 6.92 1.05 7.86 0 8.98l1.68 1.43c.93-.78 1.94-1.45 3.01-2L6.4 9.83c-1.2.55-2.31 1.3-3.28 2.21L4.81 13.46C5.96 12.38 7.4 11.62 9 11.27l2.16 2.16c-1.3.18-2.5.74-3.46 1.59L12 19.51l1.94-1.94 5.84 5.84 1.41-1.41L2.81 2.81zM12 16.5l-1.41-1.41L12 13.68c.5 0 .96.06 1.42.13l1.71 1.71c-.99-.65-2.18-1.02-3.13-1.02z"/>
                    </svg>
                </div>
            ` : ''}
            <div class="ring-wrap">
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
                    style="cursor:${feezal.isEditor ? 'default' : 'pointer'}"
                    @pointerdown="${this._onSvgPointerDown}">
                    ${this._svgContent()}
                </svg>
            </div>
            ${this._renderControls()}
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-circle-light', FeezalElementCircleLight);
export {FeezalElementCircleLight};

// ─── N6 custom inspector (E35) ──────────────────────────────────────────────
// Replaces the flat 30+ attribute form with a focused two-tab editor. Renders
// only in the editor sidebar (Shoelace components are globally registered
// there); in the viewer this class is defined but never instantiated.
const LIGHT_SECTIONS = [
    {id: 'brightness', title: 'Brightness', topics: [
        {attr: 'subscribe-brightness', label: 'Subscribe'},
        {attr: 'publish-brightness',   label: 'Publish'},
    ]},
    {id: 'color_temp', title: 'Color Temperature', topics: [
        {attr: 'subscribe-color-temp', label: 'Subscribe'},
        {attr: 'publish-color-temp',   label: 'Publish'},
    ]},
    {id: 'color', title: 'Color — RGB / HS', topics: [
        {attr: 'subscribe-rgb', label: 'Subscribe RGB'},
        {attr: 'publish-rgb',   label: 'Publish RGB'},
        {attr: 'subscribe-hs',  label: 'Subscribe HS'},
        {attr: 'publish-hs',    label: 'Publish HS'},
    ]},
    {id: 'white', title: 'White / RGBW / RGBWW', topics: [
        {attr: 'subscribe-white', label: 'White ↓'},
        {attr: 'publish-white',   label: 'White ↑'},
        {attr: 'subscribe-warm-white', label: 'Warm ↓'},
        {attr: 'publish-warm-white',   label: 'Warm ↑'},
        {attr: 'subscribe-cold-white', label: 'Cold ↓'},
        {attr: 'publish-cold-white',   label: 'Cold ↑'},
    ]},
    {id: 'effects', title: 'Effects', topics: [
        {attr: 'subscribe-effect', label: 'Subscribe state'},
        {attr: 'publish-effect',   label: 'Publish command'},
        {attr: 'effects', label: 'Available effects', placeholder: 'colorloop, rainbow, sparkle, …'},
    ]},
    // E127: ramp settling — Homematic WORKING / RedMatic LEVEL_NOTWORKING.
    {id: 'settling', title: 'Settling (Homematic ramps)', topics: [
        {attr: 'subscribe-working', label: 'WORKING ↓', placeholder: 'hm/status/<dimmer>/WORKING'},
        {attr: 'subscribe-settled', label: 'Settled ↓', placeholder: 'hm/status/<dimmer>/LEVEL_NOTWORKING'},
    ]},
];

// Optional, additive capabilities offered in json mode (no per-property topics
// to derive enablement from, so they are toggled explicitly). Toggling one off
// clears its backing config; toggling on reveals the inline editor.
const JSON_CAPABILITIES = [
    {id: 'effects', title: 'Effects', topics: [
        {attr: 'effects', label: 'Available (comma-separated)', placeholder: 'colorloop, rainbow, …'},
    ]},
];

class FeezalElementCircleLightInspector extends LitElement {
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
        /* Match the standard attribute/style inspector Shoelace theming
           (input/select background, border and label colours for dark mode). */
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

    // ── attribute access ──────────────────────────────────────────────────
    _val(name) { return this.element?.getAttribute(name) ?? ''; }

    _emit(name, value, rerender = false) {
        this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
            bubbles: true, composed: true, detail: {name, value},
        }));
        if (rerender) this.requestUpdate();
    }

    _onInput(name, e) { this._emit(name, e.target.value); }
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
            // Clear all topic attributes for this section
            sec.topics.forEach(t => this._emit(t.attr, ''));
            this._open = {...this._open, [sec.id]: false};
        }
        this.requestUpdate();
    }

    // ── render ────────────────────────────────────────────────────────────
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

    _topicInput(t) {
        return html`
            <div class="field">
                <label>${t.label}</label>
                <feezal-topic-input size="small" placeholder="${t.placeholder ?? 'mqtt/topic'}" value="${this._val(t.attr)}"
                    @sl-change="${e => this._onInput(t.attr, e)}"></feezal-topic-input>
            </div>`;
    }

    _renderTopics() {
        // E122: on_off — a switch-only lamp has exactly the state topics;
        // don't offer brightness/CT/colour/effect/white capability sections.
        if ((this._val('mode') || 'brightness') === 'on_off') {
            const isJson = this._val('payload-mode') === 'json';
            return html`
                <div class="hint">On/Off mode — the lamp is a pure switch.</div>
                <div class="section">
                    <div class="sec-head">State</div>
                    <div class="sec-body">
                        ${isJson ? html`
                            ${this._topicInput({attr: 'subscribe', label: 'Subscribe (state)'})}
                            ${this._topicInput({attr: 'publish',   label: 'Publish (…/set)'})}
                        ` : html`
                            ${this._topicInput({attr: 'subscribe-state', label: 'Subscribe'})}
                            ${this._topicInput({attr: 'publish-state',   label: 'Publish'})}
                        `}
                    </div>
                </div>`;
        }

        // json mode → single State & Control section + optional capabilities
        if (this._val('payload-mode') === 'json') {
            return html`
                <div class="hint">JSON mode — one topic carries the whole state object.</div>
                <div class="section">
                    <div class="sec-head">State &amp; Control</div>
                    <div class="sec-body">
                        ${this._topicInput({attr: 'subscribe', label: 'Subscribe (state)'})}
                        ${this._topicInput({attr: 'publish',   label: 'Publish (…/set)'})}
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

        // separate mode → always-on State section + capability-gated sections
        // E77: with on-off-source=brightness the state topics are unused —
        // on/off derives from (and publishes to) the Brightness topics.
        const brightnessSource = (this._val('on-off-source') || 'topic') === 'brightness';
        return html`
            <div class="section">
                <div class="sec-head">State</div>
                <div class="sec-body">
                    ${brightnessSource ? html`
                        <div class="hint">On/off derives from the <b>Brightness</b> topic
                            (On/off source: brightness) — state topics are unused.</div>
                    ` : html`
                        ${this._topicInput({attr: 'subscribe-state', label: 'Subscribe'})}
                        ${this._topicInput({attr: 'publish-state',   label: 'Publish'})}
                    `}
                </div>
            </div>
            ${LIGHT_SECTIONS.map(sec => {
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
        const isJson = this._val('payload-mode') === 'json';
        const currentMode = this._val('mode') || 'brightness';
        const ctEnabled = isJson ||
            currentMode === 'color_temp' || currentMode === 'brightness_ct' ||
            this._sectionEnabled(LIGHT_SECTIONS.find(s => s.id === 'color_temp'));
        const brEnabled = isJson ||
            this._sectionEnabled(LIGHT_SECTIONS.find(s => s.id === 'brightness'));

        return html`
            <div class="section">
                <div class="sec-head">Mode</div>
                <div class="sec-body">
                    <div class="field">
                        <label>Active control</label>
                        <sl-select size="small" value="${this._val('mode') || 'brightness'}"
                            @sl-change="${e => this._onSelect('mode', e)}">
                            <sl-option value="on_off">On/Off only (switch)</sl-option>
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
                            @sl-change="${e => this._onSelect('payload-mode', e)}">
                            <sl-option value="separate">separate (one topic per property)</sl-option>
                            <sl-option value="json">json (single topic)</sl-option>
                        </sl-select>
                    </div>
                </div>
            </div>

            ${(() => {
                // E77: brightness-derived on/off (Homematic dimmers — no
                // dedicated on/off datapoint, off is LEVEL = 0).
                const brightnessSource = (this._val('on-off-source') || 'topic') === 'brightness';
                return html`
            <div class="section">
                <div class="sec-head">State payloads</div>
                <div class="sec-body">
                    ${isJson ? '' : html`
                        <div class="field">
                            <label>On/off source</label>
                            <sl-select size="small" value="${this._val('on-off-source') || 'topic'}"
                                @sl-change="${e => this._onSelect('on-off-source', e)}">
                                <sl-option value="topic">topic (dedicated on/off state topic)</sl-option>
                                <sl-option value="brightness">brightness (derive on/off from the level)</sl-option>
                            </sl-select>
                        </div>`}
                    <div class="row">
                        <div class="field">
                            <label>On</label>
                            <sl-input size="small" autocomplete="off"
                                value="${brightnessSource ? this._val('payload-on') : (this._val('payload-on') || 'on')}"
                                placeholder="${brightnessSource ? '1' : ''}"
                                @sl-change="${e => this._onInput('payload-on', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Off</label>
                            <sl-input size="small" autocomplete="off"
                                value="${brightnessSource ? this._val('payload-off') : (this._val('payload-off') || 'off')}"
                                placeholder="${brightnessSource ? '0' : ''}"
                                @sl-change="${e => this._onInput('payload-off', e)}"></sl-input>
                        </div>
                    </div>
                    ${brightnessSource ? html`
                        <div class="hint">Compared against / published to the <b>Brightness</b> topic.
                            Empty Off falls back to the brightness minimum; non-numeric On restores the
                            last brightness. Homematic: set On to <b>1.005</b> to restore the last
                            brightness device-side (OLD_LEVEL).</div>` : ''}
                </div>
            </div>`;
            })()}

            ${brEnabled ? html`
                <div class="section">
                    <div class="sec-head">Brightness scale</div>
                    <div class="sec-body row">
                        <div class="field">
                            <label>Min</label>
                            <sl-input type="number" size="small" autocomplete="off" value="${this._val('brightness-min') || '0'}"
                                @sl-change="${e => this._onInput('brightness-min', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Max</label>
                            <sl-input type="number" size="small" autocomplete="off" value="${this._val('brightness-max') || '100'}"
                                @sl-change="${e => this._onInput('brightness-max', e)}"></sl-input>
                        </div>
                    </div>
                </div>` : ''}

            ${!isJson && this._sectionEnabled(LIGHT_SECTIONS.find(s => s.id === 'settling')) ? html`
                <div class="section">
                    <div class="sec-head">Settling (E127)</div>
                    <div class="sec-body row">
                        <div class="field">
                            <label>Timeout (s)</label>
                            <sl-input type="number" size="small" autocomplete="off" value="${this._val('settle-timeout') || '5'}"
                                @sl-change="${e => this._onInput('settle-timeout', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Report delay (ms)</label>
                            <sl-input type="number" size="small" autocomplete="off" value="${this._val('report-delay-ms') || '100'}"
                                @sl-change="${e => this._onInput('report-delay-ms', e)}"></sl-input>
                        </div>
                    </div>
                </div>` : ''}

            ${ctEnabled ? html`
                <div class="section">
                    <div class="sec-head">Color Temperature</div>
                    <div class="sec-body">
                        <div class="field">
                            <label>Unit</label>
                            <sl-select size="small" value="${this._val('color-temp-unit') || 'kelvin'}"
                                @sl-change="${e => this._onSelect('color-temp-unit', e)}">
                                <sl-option value="kelvin">kelvin</sl-option>
                                <sl-option value="mired">mired</sl-option>
                            </sl-select>
                        </div>
                        <div class="row">
                            <div class="field">
                                <label>Min (K)</label>
                                <sl-input type="number" size="small" autocomplete="off" value="${this._val('color-temp-min') || '2700'}"
                                    @sl-change="${e => this._onInput('color-temp-min', e)}"></sl-input>
                            </div>
                            <div class="field">
                                <label>Max (K)</label>
                                <sl-input type="number" size="small" autocomplete="off" value="${this._val('color-temp-max') || '6500'}"
                                    @sl-change="${e => this._onInput('color-temp-max', e)}"></sl-input>
                            </div>
                        </div>
                    </div>
                </div>` : ''}

            <div class="section">
                <div class="sec-head">Availability</div>
                <div class="sec-body">
                    <div class="field">
                        <label>Subscribe</label>
                        <feezal-topic-input size="small" placeholder="…/availability" value="${this._val('subscribe-availability')}"
                            @sl-change="${e => this._onInput('subscribe-availability', e)}"></feezal-topic-input>
                    </div>
                    <div class="row">
                        <div class="field">
                            <label>Available</label>
                            <sl-input size="small" autocomplete="off" value="${this._val('payload-available') || 'online'}"
                                @sl-change="${e => this._onInput('payload-available', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Unavailable</label>
                            <sl-input size="small" autocomplete="off" value="${this._val('payload-unavailable') || 'offline'}"
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
                    ${!isJson ? html`
                        <div class="field">
                            <label>State topic</label>
                            <sl-input size="small" autocomplete="off" placeholder="payload"
                                value="${this._val('message-property-state')}"
                                @sl-change="${e => this._onInput('message-property-state', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Brightness topic</label>
                            <sl-input size="small" autocomplete="off" placeholder="payload"
                                value="${this._val('message-property-brightness')}"
                                @sl-change="${e => this._onInput('message-property-brightness', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Color temp topic</label>
                            <sl-input size="small" autocomplete="off" placeholder="payload"
                                value="${this._val('message-property-color-temp')}"
                                @sl-change="${e => this._onInput('message-property-color-temp', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>RGB topic</label>
                            <sl-input size="small" autocomplete="off" placeholder="payload"
                                value="${this._val('message-property-rgb')}"
                                @sl-change="${e => this._onInput('message-property-rgb', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Hue/sat topic</label>
                            <sl-input size="small" autocomplete="off" placeholder="payload"
                                value="${this._val('message-property-hs')}"
                                @sl-change="${e => this._onInput('message-property-hs', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Effect topic</label>
                            <sl-input size="small" autocomplete="off" placeholder="payload"
                                value="${this._val('message-property-effect')}"
                                @sl-change="${e => this._onInput('message-property-effect', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>White topic</label>
                            <sl-input size="small" autocomplete="off" placeholder="payload"
                                value="${this._val('message-property-white')}"
                                @sl-change="${e => this._onInput('message-property-white', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Warm white topic</label>
                            <sl-input size="small" autocomplete="off" placeholder="payload"
                                value="${this._val('message-property-warm-white')}"
                                @sl-change="${e => this._onInput('message-property-warm-white', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Cold white topic</label>
                            <sl-input size="small" autocomplete="off" placeholder="payload"
                                value="${this._val('message-property-cold-white')}"
                                @sl-change="${e => this._onInput('message-property-cold-white', e)}"></sl-input>
                        </div>
                    ` : ''}
                    <div class="field">
                        <label>Availability topic</label>
                        <sl-input size="small" autocomplete="off" placeholder="payload"
                            value="${this._val('message-property-availability')}"
                            @sl-change="${e => this._onInput('message-property-availability', e)}"></sl-input>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Display</div>
                <div class="sec-body">
                    <div class="field">
                        <label>Label</label>
                        <sl-input size="small" autocomplete="off" value="${this._val('label')}"
                            @sl-change="${e => this._onInput('label', e)}"></sl-input>
                    </div>
                    <div class="field">
                        <label>State text off</label>
                        <sl-input size="small" autocomplete="off" placeholder="off"
                            value="${this._val('label-off')}"
                            @sl-change="${e => this._onInput('label-off', e)}"></sl-input>
                    </div>
                </div>
            </div>`;
    }
}

customElements.define('feezal-element-circle-light-inspector', FeezalElementCircleLightInspector);
export {FeezalElementCircleLightInspector};

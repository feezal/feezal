/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
// E137: the thermostat behavior lives in the shared controller — this element
// is a VIEW (Circle chrome: the arc setpoint slider + chips/valve/humidity).
import {ClimateController, climateAttributes, climateDiscoveryMap} from '@feezal/feezal-controller-climate';
import '@feezal/feezal-element/feezal-topic-input.js';
import {svg, LitElement} from 'lit';
import '@material/web/icon/icon.js';
import '@material/web/chips/filter-chip.js';

// ─── Arc geometry ─────────────────────────────────────────────────────────────
// Convention: 0° = 12 o'clock, clockwise (same as feezal-element-material-light).
// B29: radius/track/knob are proportionally IDENTICAL to material-light's ring
// (radius 80 % of the viewBox half-size, track 7 % / knob 10 % of the viewBox
// width) so both cards side by side show perfectly aligned circle-sliders.
// This viewBox is 200 (light: 100) — constants here are the light values × 2.
const ARC_CX    = 100;
const ARC_CY    = 100;
const ARC_R     = 80;    // outer arc centre-line radius (= light TRACK_R 40 × 2)
const ARC_W     = 14;    // track stroke width (= light RING_W 7 × 2)
const VALVE_R   = 62;    // inner valve-arc centre-line radius
const VALVE_W   = 4;
const ARC_START = 225;   // degrees — 7:30 position
const ARC_SPAN  = 270;   // total arc span in degrees

function tPolarXY(deg, r = ARC_R) {
    const rad = (deg - 90) * Math.PI / 180;
    return [+(ARC_CX + r * Math.cos(rad)).toFixed(2), +(ARC_CY + r * Math.sin(rad)).toFixed(2)];
}

// SVG arc path: clockwise from fromDeg, spanning spanDeg degrees.
function tArcPath(fromDeg, spanDeg, r = ARC_R) {
    if (Math.abs(spanDeg) < 0.05) return '';
    const [ax, ay] = tPolarXY(fromDeg, r);
    const [bx, by] = tPolarXY((fromDeg + spanDeg) % 360, r);
    return `M${ax},${ay} A${r},${r} 0 ${spanDeg > 180 ? 1 : 0},1 ${bx},${by}`;
}

// Temperature → span in degrees from ARC_START.
function tTempToSpan(temp, min, max) {
    return Math.max(0, Math.min(ARC_SPAN, ((temp - min) / (max - min)) * ARC_SPAN));
}

// SVG angle → temperature, snapped to step.
function tAngleToTemp(deg, min, max, step) {
    const arcEnd = (ARC_START + ARC_SPAN) % 360; // 135
    let offset;
    if (deg >= ARC_START) {
        offset = deg - ARC_START;
    } else if (deg <= arcEnd) {
        offset = deg + (360 - ARC_START);
    } else {
        // gap zone (135°–225°) — clamp to nearest end
        offset = deg < 180 ? ARC_SPAN : 0;
    }
    const frac = Math.max(0, Math.min(1, offset / ARC_SPAN));
    const raw  = min + frac * (max - min);
    return +( Math.round(raw / step) * step ).toFixed(2);
}

// Format temperature: strip trailing .00 → "22°C", keep .5 → "22.5°C".
function fmtTemp(val, unit) {
    if (val === null || val === undefined || isNaN(+val)) return '\u2014';
    const n = +val;
    return (Number.isInteger(n) ? n.toString() : n.toFixed(1)) + '\u00a0' + (unit || '°C');
}

// ─── Element ──────────────────────────────────────────────────────────────────
class FeezalElementMaterialClimate extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Climate', category: 'Circle', color: '#1565c0', icon: 'thermostat'},
            description: 'Smart thermostat card — circular arc setpoint slider, actual temperature, optional mode chips, valve indicator, and humidity display.',
            // ── N6 custom inspector ───────────────────────────────────────────
            inspector: 'feezal-element-material-climate-inspector',
            // ── N12 Auto-Discovery descriptor ─────────────────────────────────
            // E137: the discovery map is the controller package's fragment.
            discovery: {component: 'climate', map: climateDiscoveryMap},
            attributes: [
                // E137: the shared climate contract (both payload modes,
                // setpoint/mode/valve/boost + the E124 battery quartet) —
                // declared ONCE by the controller package. The N6 custom
                // inspector renders its own structure on top.
                ...climateAttributes,
                // ── Material-only extras: humidity ────────────────────────────
                {name: 'subscribe-humidity', type: 'mqttTopic', help: 'Optional: relative humidity percentage (0–100).'},
                {name: 'message-property-humidity', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the humidity message. Blank = fall back to element-level message-property.'},
                // ── Display ───────────────────────────────────────────────────
                {name: 'label', type: 'string', default: '', help: 'Optional card title shown at the bottom.'},
                // ── Availability ──────────────────────────────────────────────
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Optional availability topic. A badge appears when unavailable; controls stay enabled.'},
                {name: 'message-property-availability', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the availability message. Blank = fall back to element-level message-property.'},
                {name: 'payload-available',      type: 'string', default: 'online',  help: 'Payload meaning the device is online.'},
                {name: 'payload-unavailable',    type: 'string', default: 'offline', help: 'Payload meaning the device is offline.'},
                // ── Discovery linkage ─────────────────────────────────────────
                {name: 'discovery-id', type: 'string', default: '', help: 'Linked auto-discovery entity id (set automatically by N12).'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                // Theme-aware colour tokens. Leave blank to inherit from theme.
                {property: '--feezal-climate-heat-color', type: 'color',
                    default: 'var(--accent-color, #ff7043)',
                    help: 'Arc fill, handle and mode-chip active colour when heating.'},
                {property: '--feezal-climate-cool-color', type: 'color',
                    default: 'var(--info-color, #29b6f6)',
                    help: 'Arc fill colour when cooling.'},
                {property: '--feezal-climate-idle-color', type: 'color',
                    default: 'var(--secondary-text-color, #aaa)',
                    help: 'Background track and off/idle arc colour.'},
                {property: '--feezal-climate-text-color', type: 'color',
                    default: 'var(--primary-text-color, #212121)',
                    help: 'Temperature text, chip text, and icon colour.'},
                {property: '--feezal-climate-error-color', type: 'color',
                    default: 'var(--error-color, #b00020)',
                    help: 'Unavailability badge colour.'},
                // B29 — arc geometry, unitless % of the slider viewBox; the same
                // numbers on material-light give an identical-looking slider.
                {property: '--feezal-climate-track-width', default: '7',
                    help: 'Setpoint-arc track width — unitless, in % of the circle viewBox (default 7). Same scale as --feezal-light-track-width.'},
                {property: '--feezal-climate-knob-size', default: '10',
                    help: 'Drag-knob diameter — unitless, in % of the circle viewBox (default 10). Same scale as --feezal-light-knob-size.'},
            ],
            restrict:     {minWidth: 160, minHeight: 200},
            defaultStyle: {width: '180px', height: '220px'},
        };
    }

    static properties = {
        payloadMode:           {type: String,  reflect: true, attribute: 'payload-mode'},
        subscribe:             {type: String,  reflect: true},
        publish:               {type: String,  reflect: true},
        jsonMap:               {type: String,  reflect: true, attribute: 'json-map'},
        subscribeSetpoint:     {type: String,  reflect: true, attribute: 'subscribe-setpoint'},
        publishSetpoint:       {type: String,  reflect: true, attribute: 'publish-setpoint'},
        subscribeActual:       {type: String,  reflect: true, attribute: 'subscribe-actual'},
        subscribeMode:         {type: String,  reflect: true, attribute: 'subscribe-mode'},
        publishMode:           {type: String,  reflect: true, attribute: 'publish-mode'},
        subscribeValve:        {type: String,  reflect: true, attribute: 'subscribe-valve'},
        valveMin:              {type: Number,  reflect: true, attribute: 'valve-min'},
        valveMax:              {type: Number,  reflect: true, attribute: 'valve-max'},
        boostDuration:           {type: Number, reflect: true, attribute: 'boost-duration'},
        subscribeBoostRemaining: {type: String, reflect: true, attribute: 'subscribe-boost-remaining'},
        msgPropBoostRemaining:   {type: String, reflect: true, attribute: 'message-property-boost-remaining'},
        boostRemainingUnit:      {type: String, reflect: true, attribute: 'boost-remaining-unit'},
        subscribeBoostState:     {type: String, reflect: true, attribute: 'subscribe-boost-state'},
        msgPropBoostState:       {type: String, reflect: true, attribute: 'message-property-boost-state'},
        // E124 — dedicated low-battery warning
        subscribeBatteryLow: {type: String, reflect: true, attribute: 'subscribe-battery-low'},
        msgPropBatteryLow:   {type: String, reflect: true, attribute: 'message-property-battery-low'},
        payloadBatteryLow:   {type: String, reflect: true, attribute: 'payload-battery-low'},
        batteryLowThreshold: {type: Number, reflect: true, attribute: 'battery-low-threshold'},
        subscribeHumidity:     {type: String,  reflect: true, attribute: 'subscribe-humidity'},
        // N31: availability inherited from FeezalElement.
        min:                   {type: Number,  reflect: true},
        max:                   {type: Number,  reflect: true},
        step:                  {type: Number,  reflect: true},
        unit:                  {type: String,  reflect: true},
        modes:                 {type: String,  reflect: true},
        label:                 {type: String,  reflect: true},
        discoveryId:           {type: String,  reflect: true, attribute: 'discovery-id'},
        msgPropSetpoint:       {type: String,  reflect: true, attribute: 'message-property-setpoint'},
        msgPropActual:         {type: String,  reflect: true, attribute: 'message-property-actual'},
        msgPropMode:           {type: String,  reflect: true, attribute: 'message-property-mode'},
        msgPropValve:          {type: String,  reflect: true, attribute: 'message-property-valve'},
        msgPropHumidity:       {type: String,  reflect: true, attribute: 'message-property-humidity'},
        // E137: climate state lives on the ClimateController (plain fields +
        // host.requestUpdate) — only the drag preview stays element-local.
        _dragSpan:   {state: true},   // null | number — live arc span during drag
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 8px;
            box-sizing: border-box;
            overflow: hidden;
            gap: 4px;
            position: relative;

            /* ── Theme-aware colour tokens ────────────────────────────────────
               Override per-element via the Style inspector or a theme rule.  */
            --feezal-climate-heat-color:  var(--accent-color,         var(--feezal-accent,  #ff7043));
            --feezal-climate-cool-color:  var(--info-color,           var(--feezal-info,    #29b6f6));
            --feezal-climate-idle-color:  var(--secondary-text-color, var(--feezal-color2,  #aaa));
            --feezal-climate-text-color:  var(--primary-text-color,   var(--feezal-color,   #212121));
            --feezal-climate-error-color: var(--error-color, #b00020);

            /* MD3 bridge — filter-chips follow the thermostat theme */
            --md-sys-color-on-surface-variant: var(--feezal-climate-idle-color);
            --md-filter-chip-outline-color:    var(--feezal-climate-idle-color);
            --md-filter-chip-label-text-color: var(--feezal-climate-text-color);
            --md-filter-chip-selected-container-color:   var(--feezal-climate-heat-color);
            --md-filter-chip-selected-label-text-color:  #fff;
            --md-sys-color-primary: var(--feezal-climate-heat-color);
        }
        .unavail {
            position: absolute;
            top: 6px; right: 6px;
            width: 18px; height: 18px;
            color: var(--feezal-climate-error-color);
            opacity: 0.8; pointer-events: none; z-index: 2;
        }
        .unavail svg { width: 100%; height: 100%; display: block; }
        /* B37: width-driven, top-anchored — the exact material-light ring
           pattern (.ring-wrap / aspect-ratio:1). Same-size cards side by side
           get identical circle position AND size; rows below (chips, valve,
           humidity, label) stack under the arc and clip on too-short cards,
           exactly like the light card's controls do. */
        .arc-wrap {
            width: 100%;
            flex-shrink: 0;
        }
        svg.arc {
            width: 100%;
            aspect-ratio: 1;
            overflow: visible;
            touch-action: none;
            user-select: none;
            display: block;
            cursor: crosshair;
        }
        .mode-row {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            justify-content: center;
            width: 100%;
        }
        md-filter-chip {
            --md-filter-chip-container-height: 24px;
            --md-filter-chip-label-text-size: 11px;
        }
        .valve-row {
            width: 90%;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .valve-label {
            font-size: 10px;
            opacity: 0.6;
            white-space: nowrap;
            color: var(--feezal-climate-text-color);
        }
        .valve-bar {
            flex: 1;
            height: 4px;
            background: var(--feezal-climate-idle-color);
            border-radius: 2px;
            overflow: hidden;
        }
        .valve-fill {
            height: 100%;
            border-radius: 2px;
            background: var(--feezal-climate-heat-color);
            transition: width 0.4s;
        }
        .hum-row {
            font-size: 11px;
            opacity: 0.65;
            color: var(--feezal-climate-text-color);
        }
        .label {
            font-size: 11px;
            opacity: 0.65;
            text-align: center;
            color: var(--feezal-climate-text-color);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 100%;
        }
    `];

    constructor() {
        super();
        this.payloadMode           = 'separate';
        this.subscribe             = '';
        this.publish               = '';
        this.jsonMap               = '';
        this.subscribeSetpoint     = '';
        this.publishSetpoint       = '';
        this.subscribeActual       = '';
        this.subscribeMode         = '';
        this.publishMode           = '';
        this.subscribeValve        = '';
        this.valveMin              = 0;
        this.valveMax              = 100;
        this.boostDuration           = 5;
        this.subscribeBoostRemaining = '';
        this.msgPropBoostRemaining   = '';
        this.boostRemainingUnit      = 'minutes';
        this.subscribeBoostState     = '';
        this.msgPropBoostState       = '';
        this.subscribeBatteryLow     = '';
        this.msgPropBatteryLow       = '';
        this.payloadBatteryLow       = 'true';
        this.batteryLowThreshold     = 15;
        this.subscribeHumidity     = '';
        this.min                   = 5;
        this.max                   = 30;
        this.step                  = 0.5;
        this.unit                  = '°C';
        this.modes                 = '';
        this.label                 = '';
        this.discoveryId           = '';
        this.msgPropSetpoint       = '';
        this.msgPropActual         = '';
        this.msgPropMode           = '';
        this.msgPropValve          = '';
        this.msgPropHumidity       = '';
        this._dragSpan             = null;
        // E137: the behavior layer — wires/parses/publishes; this view renders.
        // Material quirk as a flag: humidity display.
        this.climate = new ClimateController(this, {humidity: true});
    }

    // The thermostat manages all subscriptions itself.
    _subscribe() { /* intentionally empty */ }

    // E137: the ClimateController wires everything in hostConnected and
    // clears the boost interval in hostDisconnected.

    updated(changed) {
        super.updated(changed);
        // Live-canvas topic edits re-wire through the controller.
        this.climate.rewireIfChanged();
    }

    /** Arc release → controller (clamp + snap + publish); drops the preview. */
    _setSetpoint(temp) {
        this._dragSpan = null;
        this.climate.setSetpoint(temp);
    }

    // ─── Arc interaction ──────────────────────────────────────────────────────
    _onArcPointerDown(e) {
        if (feezal.isEditor) return;
        const svgEl = e.currentTarget;
        svgEl.setPointerCapture(e.pointerId);

        const move = ev => {
            const pt = new DOMPoint(ev.clientX, ev.clientY);
            const sp = pt.matrixTransform(svgEl.getScreenCTM().inverse());
            const dx = sp.x - ARC_CX, dy = sp.y - ARC_CY;
            // SVG angle: 0° = right; convert to 0° = top, clockwise
            let deg = Math.atan2(dy, dx) * 180 / Math.PI + 90;
            if (deg < 0) deg += 360;
            const temp  = tAngleToTemp(deg, this.min, this.max, this.step);
            const clamped = Math.min(this.max, Math.max(this.min, temp));
            this._dragSpan = tTempToSpan(clamped, this.min, this.max);
        };

        const up = () => {
            svgEl.removeEventListener('pointermove', move);
            svgEl.removeEventListener('pointerup', up);
            if (this._dragSpan !== null) {
                const frac = this._dragSpan / ARC_SPAN;
                this._setSetpoint(this.min + frac * (this.max - this.min));
            }
        };

        svgEl.addEventListener('pointermove', move);
        svgEl.addEventListener('pointerup', up);
        move(e); // immediate feedback on mousedown
    }

    // ─── Arc fill color based on mode ─────────────────────────────────────────
    get _arcFillColor() {
        const mode = this.climate.mode;
        if (!mode || mode === 'heat' || mode === 'emergency_heat') return 'var(--feezal-climate-heat-color)';
        if (mode === 'cool') return 'var(--feezal-climate-cool-color)';
        if (mode === 'off') return 'var(--feezal-climate-idle-color)';
        return 'var(--feezal-climate-heat-color)'; // auto, fan_only, etc.
    }

    // ─── SVG rendering ────────────────────────────────────────────────────────
    _renderArc() {
        const editorSetpoint = (this.min + this.max) / 2 + this.step * 3; // e.g. 17.5 + 1.5 = 19
        const setpoint  = this.climate.setpoint ?? null;
        const actual    = this.climate.actual;
        const fillColor = this._arcFillColor;
        // B53: off-by-setpoint sentinel active (and not mid-drag) → park the
        // arc and show the mode label instead of the 4.5° target.
        const offEntry  = this._dragSpan === null ? this.climate.offSentinelEntry() : null;

        // Current arc span (drag preview or committed)
        const spanDeg   = this._dragSpan ??
            (offEntry ? 0 : (setpoint !== null ? tTempToSpan(setpoint, this.min, this.max) : 0));

        // Actual temperature indicator on the track (if present and different from setpoint)
        const actualSpan = actual !== null ? tTempToSpan(actual, this.min, this.max) : null;

        // Background full arc
        const bgPath   = tArcPath(ARC_START, ARC_SPAN);

        // Filled setpoint arc
        const fillPath = spanDeg > 0 ? tArcPath(ARC_START, spanDeg) : null;

        // Handle position
        const handleAngle = (ARC_START + spanDeg) % 360;
        const [hx, hy]    = tPolarXY(handleAngle);

        // Actual temperature tick mark on the track
        let actualTick = null;
        if (actualSpan !== null) {
            const tickAngle = (ARC_START + actualSpan) % 360;
            const [tx, ty] = tPolarXY(tickAngle, ARC_R);
            const [tx2, ty2] = tPolarXY(tickAngle, ARC_R - ARC_W - 2);
            actualTick = svg`<line x1="${tx}" y1="${ty}" x2="${tx2}" y2="${ty2}"
                stroke="var(--feezal-climate-text-color)" stroke-width="2"
                stroke-opacity="0.5" stroke-linecap="round"/>`;
        }

        // Valve inner arc
        let valveArc = null;
        if (this.climate.valve !== null) {
            const vSpan    = (this.climate.valve / 100) * ARC_SPAN;
            const valvePath = tArcPath(ARC_START, vSpan, VALVE_R);
            valveArc = svg`
                <path d="${tArcPath(ARC_START, ARC_SPAN, VALVE_R)}" fill="none"
                    stroke="var(--feezal-climate-idle-color)" stroke-opacity="0.3"
                    stroke-width="${VALVE_W}" stroke-linecap="round"/>
                ${vSpan > 0 ? svg`<path d="${valvePath}" fill="none"
                    stroke="${fillColor}" stroke-opacity="0.5"
                    stroke-width="${VALVE_W}" stroke-linecap="round"/>` : svg``}`;
        }

        // Centre text \u2014 B53: while the off sentinel is active the setpoint line
        // shows the mode label ("Off") instead of the 4.5\u00b0 target.
        const spLine     = offEntry ? (offEntry.label ?? offEntry.value)
            : (setpoint !== null ? '\u2192\u00a0' + fmtTemp(setpoint, this.unit) : '');
        const dispActual = actual !== null ? fmtTemp(actual, this.unit) : '\u2014';

        return svg`
            <!-- Background track (B29: width configurable, unitless % of viewBox; ×2 = this viewBox scale) -->
            <path d="${bgPath}" fill="none"
                stroke="var(--feezal-climate-idle-color)" stroke-opacity="0.25"
                stroke-width="${ARC_W}" stroke-linecap="round"
                style="stroke-width: calc(var(--feezal-climate-track-width, 7) * 2px)"/>

            <!-- Valve inner arc -->
            ${valveArc ?? svg``}

            <!-- Setpoint fill arc -->
            ${fillPath ? svg`
                <path d="${fillPath}" fill="none"
                    stroke="${fillColor}"
                    stroke-width="${ARC_W}" stroke-linecap="round"
                    style="stroke-width: calc(var(--feezal-climate-track-width, 7) * 2px)"/>
            ` : svg``}

            <!-- Actual temperature tick on track -->
            ${actualTick ?? svg``}

            <!-- Drag handle (B29: diameter configurable, matches light's knob) -->
            <circle cx="${hx}" cy="${hy}" r="10"
                fill="${fillColor}" stroke="var(--feezal-climate-text-color)"
                stroke-opacity="0.3" stroke-width="1.5"
                style="cursor:grab; r: calc(var(--feezal-climate-knob-size, 10) * 1px)"/>

            <!-- Actual temperature — large, centred -->
            <text x="${ARC_CX}" y="${ARC_CY + 8}"
                text-anchor="middle" dominant-baseline="middle"
                font-size="22" font-weight="600"
                fill="var(--feezal-climate-text-color)"
                style="font-family:inherit">${dispActual}</text>

            <!-- Setpoint label below actual (B53: mode label while Off) -->
            ${spLine ? svg`
                <text x="${ARC_CX}" y="${ARC_CY + 30}"
                    text-anchor="middle" dominant-baseline="middle"
                    font-size="11" fill="var(--feezal-climate-text-color)"
                    fill-opacity="0.6" style="font-family:inherit">
                    ${spLine}
                </text>
            ` : svg``}
        `;
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    render() {
        const showUnavail = this.subscribeAvailability && !this._available;
        const modeList    = this.climate.parsedModes();
        const showModes   = modeList.length > 0;
        const showValve   = this.climate.valve !== null;
        const showHum     = this.climate.humidity !== null;
        const activeMode  = this.climate.activeModeEntry(modeList);   // E102: match-setpoint-max-aware active chip

        return html`
            ${showUnavail ? html`
                <div class="unavail" title="Device unavailable">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 8.98C20.93 5.9 16.69 4 12 4c-1.69 0-3.32.25-4.86.71l2.5 2.5c.77-.14 1.55-.21 2.36-.21 3.42 0 6.7 1.21 9.32 3.42L24 8.98zM2.81 2.81L1.39 4.22l2.05 2.05C2.2 6.92 1.05 7.86 0 8.98l1.68 1.43c.93-.78 1.94-1.45 3.01-2L6.4 9.83c-1.2.55-2.31 1.3-3.28 2.21L4.81 13.46C5.96 12.38 7.4 11.62 9 11.27l2.16 2.16c-1.3.18-2.5.74-3.46 1.59L12 19.51l1.94-1.94 5.84 5.84 1.41-1.41L2.81 2.81zM12 16.5l-1.41-1.41L12 13.68c.5 0 .96.06 1.42.13l1.71 1.71c-.99-.65-2.18-1.02-3.13-1.02z"/>
                    </svg>
                </div>
            ` : ''}

            <div class="arc-wrap">
                <svg class="arc" viewBox="0 0 200 200"
                    @pointerdown="${this._onArcPointerDown}">
                    ${this._renderArc()}
                </svg>
            </div>

            ${showModes ? html`
                <div class="mode-row">
                    ${modeList.map(m => {
                        // B54: device-reported BOOST_MODE wins over the mode read-back.
                        const boostActive = this.climate.momentaryEntryActive(m);
                        const badge = boostActive ? this.climate.boostBadge() : '';
                        return html`
                            <md-filter-chip
                                label="${(m.label ?? m.value)}${badge ? ' ' + badge : ''}"
                                ?selected="${m.momentary ? boostActive : m === activeMode}"
                                @click="${() => this.climate.setMode(m)}">
                            </md-filter-chip>`;
                    })}
                </div>
            ` : ''}

            ${showValve ? html`
                <div class="valve-row">
                    <span class="valve-label">Valve</span>
                    <div class="valve-bar">
                        <div class="valve-fill" style="width:${this.climate.valve}%"></div>
                    </div>
                    <span class="valve-label">${Math.round(this.climate.valve)}&nbsp;%</span>
                </div>
            ` : ''}

            ${showHum ? html`
                <div class="hum-row">&#x1F4A7;&nbsp;${Math.round(this.climate.humidity)}&nbsp;%</div>
            ` : ''}

            ${this.label ? html`<div class="label">${this.label}</div>` : ''}
        `;
    }
}

customElements.define('feezal-element-material-climate', FeezalElementMaterialClimate);
export {FeezalElementMaterialClimate};

// ─── N6 Custom Inspector ──────────────────────────────────────────────────────
// Two-tab inspector (Topics + Config).
// Topics tab: json mode → State & Control + Availability toggle.
//             separate mode → Setpoint/Actual (always-on) + capability-gated
//             Mode, Valve, Humidity, Availability sections.
// Config tab: Payload mode, temperature range/step/unit, modes JSON builder, label.

const CLIMATE_SECTIONS = [
    // Separate-mode capability-gated sections
    {id: 'mode', title: 'Mode', topics: [
        {attr: 'subscribe-mode', label: 'Subscribe (current mode)'},
        {attr: 'publish-mode',   label: 'Publish (set mode)'},
    ]},
    {id: 'valve', title: 'Valve / Position', topics: [
        {attr: 'subscribe-valve', label: 'Subscribe (0\u2013100\u00a0%)'},
    ]},
    {id: 'humidity', title: 'Humidity', topics: [
        {attr: 'subscribe-humidity', label: 'Subscribe (0\u2013100\u00a0%)'},
    ]},
    {id: 'availability', title: 'Availability', topics: [
        {attr: 'subscribe-availability', label: 'Subscribe'},
    ]},
];

const JSON_CAPABILITIES = [
    // In JSON mode, mode/valve/humidity are read from the main subscribe topic.
    // The only dedicated section is Availability (always a separate topic).
    {id: 'availability', title: 'Availability', topics: [
        {attr: 'subscribe-availability', label: 'Subscribe'},
    ]},
];

class FeezalElementMaterialClimateInspector extends LitElement {
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
        /* Match the standard inspector Shoelace theming */
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
        /* min-width:0 lets the number inputs shrink to an equal 1/3 share on a
           narrow sidebar instead of keeping their intrinsic (wider) width. */
        .row > .field { flex: 1 1 0; min-width: 0; }
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

    _val(name)  { return this.element?.getAttribute(name) ?? ''; }
    _bool(name, defaultVal = false) {
        if (!this.element) return defaultVal;
        return this.element.hasAttribute(name) ? true : defaultVal;
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

    _renderTopics() {
        const isJson = (this._val('payload-mode') || 'separate') === 'json';
        if (isJson) {
            return html`
                <div class="hint">JSON mode — one topic carries the whole climate state object.</div>
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

        // ── Separate mode ──────────────────────────────────────────────────────
        return html`
            <div class="section">
                <div class="sec-head">Setpoint</div>
                <div class="sec-body">
                    ${this._topicInput({attr: 'subscribe-setpoint', label: 'Subscribe (current setpoint)'})}
                    ${this._topicInput({attr: 'publish-setpoint',   label: 'Publish (set new setpoint)'})}
                </div>
            </div>
            <div class="section">
                <div class="sec-head">Actual temperature</div>
                <div class="sec-body">
                    ${this._topicInput({attr: 'subscribe-actual', label: 'Subscribe'})}
                </div>
            </div>
            ${CLIMATE_SECTIONS.map(sec => {
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
        const payloadMode = this._val('payload-mode') || 'separate';
        return html`
            <div class="section">
                <div class="sec-head">Payload mode</div>
                <div class="sec-body">
                    <sl-select size="small" value="${payloadMode}"
                        @sl-change="${e => this._onSelect('payload-mode', e)}">
                        <sl-option value="separate">separate (one topic per property, default)</sl-option>
                        <sl-option value="json">json (single topic, auto-discovery)</sl-option>
                    </sl-select>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Temperature range</div>
                <div class="sec-body">
                    <div class="row">
                        <div class="field">
                            <label>Min</label>
                            <sl-input size="small" type="number" autocomplete="off"
                                value="${this._val('min') || '5'}"
                                @sl-change="${e => this._onInput('min', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Max</label>
                            <sl-input size="small" type="number" autocomplete="off"
                                value="${this._val('max') || '30'}"
                                @sl-change="${e => this._onInput('max', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Step</label>
                            <sl-input size="small" type="number" autocomplete="off"
                                value="${this._val('step') || '0.5'}"
                                @sl-change="${e => this._onInput('step', e)}"></sl-input>
                        </div>
                    </div>
                    <div class="field">
                        <label>Unit</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="°C"
                            value="${this._val('unit') || '°C'}"
                            @sl-change="${e => this._onInput('unit', e)}"></sl-input>
                    </div>
                    <!-- E102: valve device range → scaled to 0–100 %. HmIP LEVEL is 0…1 (set Max=1). -->
                    <div class="row">
                        <div class="field">
                            <label>Valve min</label>
                            <sl-input size="small" type="number" autocomplete="off"
                                value="${this._val('valve-min') || '0'}"
                                @sl-change="${e => this._onInput('valve-min', e)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Valve max</label>
                            <sl-input size="small" type="number" autocomplete="off"
                                value="${this._val('valve-max') || '100'}"
                                @sl-change="${e => this._onInput('valve-max', e)}"></sl-input>
                        </div>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Mode chips</div>
                <div class="sec-body">
                    <div class="hint">JSON array of mode objects. When non-empty, a chip row is shown below the arc. Example: [{"value":"heat","label":"Heat"},{"value":"cool","label":"Cool"},{"value":"off","label":"Off"}]</div>
                    <div class="field">
                        <sl-input size="small" autocomplete="off"
                            placeholder='[{"value":"heat","label":"Heat"},{"value":"off","label":"Off"}]'
                            value="${this._val('modes')}"
                            @sl-change="${e => this._onInput('modes', e)}"></sl-input>
                    </div>
                </div>
            </div>

            ${payloadMode === 'json' ? html`
                <div class="section">
                    <div class="sec-head">JSON key map</div>
                    <div class="sec-body">
                        <div class="hint">Override default JSON keys. Defaults: {"setpoint":"current_heating_setpoint","actual":"local_temperature","mode":"system_mode","valve":"position","humidity":"humidity"}</div>
                        <div class="field">
                            <sl-input size="small" autocomplete="off"
                                placeholder='{"setpoint":"target_temp","actual":"temperature"}'
                                value="${this._val('json-map')}"
                                @sl-change="${e => this._onInput('json-map', e)}"></sl-input>
                        </div>
                    </div>
                </div>
            ` : ''}

            <div class="section">
                <div class="sec-head">Display</div>
                <div class="sec-body">
                    <div class="field">
                        <label>Label</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="Kitchen"
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
                        <label>Setpoint topic</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="payload"
                            value="${this._val('message-property-setpoint')}"
                            @sl-change="${e => this._onInput('message-property-setpoint', e)}"></sl-input>
                    </div>
                    <div class="field">
                        <label>Actual temperature topic</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="payload"
                            value="${this._val('message-property-actual')}"
                            @sl-change="${e => this._onInput('message-property-actual', e)}"></sl-input>
                    </div>
                    <div class="field">
                        <label>Mode topic</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="payload"
                            value="${this._val('message-property-mode')}"
                            @sl-change="${e => this._onInput('message-property-mode', e)}"></sl-input>
                    </div>
                    <div class="field">
                        <label>Valve topic</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="payload"
                            value="${this._val('message-property-valve')}"
                            @sl-change="${e => this._onInput('message-property-valve', e)}"></sl-input>
                    </div>
                    <div class="field">
                        <label>Humidity topic</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="payload"
                            value="${this._val('message-property-humidity')}"
                            @sl-change="${e => this._onInput('message-property-humidity', e)}"></sl-input>
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

customElements.define('feezal-element-material-climate-inspector', FeezalElementMaterialClimateInspector);
export {FeezalElementMaterialClimateInspector};

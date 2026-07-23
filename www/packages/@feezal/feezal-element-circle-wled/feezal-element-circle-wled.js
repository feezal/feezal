/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalAvailabilityStyles, availabilityBadge, feezalBoolean, html, css} from '@feezal/feezal-element';
import {svg} from 'lit';
// E137: the WLED behavior lives in the shared controller — this element is
// a VIEW (Circle chrome: brightness ring + pickers). The effect/palette name
// tables are bundled once in the controller package.
import {WledController, wledAttributes, wledDiscoveryMap, WLED_EFFECTS, WLED_PALETTES} from '@feezal/feezal-controller-wled';

/**
 * feezal-element-circle-wled (E103 MVP, B29/B37 ring parity, E104 effect
 * speed/intensity + presets)
 *
 * WLED device card — single-segment / whole-strip control over WLED's MQTT
 * API. The MQTT contract is identical across the material/glass/metro WLED
 * elements (keep in sync):
 *
 *  - `topic` = the device base topic set in WLED's Sync → MQTT settings.
 *  - Subscribes `<topic>/g` (brightness 0–255, plain number, 0 = off) and
 *    `<topic>/c` (current colour "#RRGGBB"). `<topic>/v` (XML state) is
 *    deliberately NOT subscribed.
 *  - Commands go to `<topic>/api` as /json/state JSON:
 *    on/off {"on":bool}, brightness {"bri":0-255},
 *    colour {"seg":[{"col":[[r,g,b]]}]}, effect {"seg":[{"fx":<id>}]},
 *    palette {"seg":[{"pal":<id>}]}, effect speed {"seg":[{"sx":0-255}]},
 *    effect intensity {"seg":[{"ix":0-255}]}, preset recall {"ps":<id>}.
 *    The optional `transition` attribute (seconds) is appended to every
 *    command as WLED 0.1 s units.
 *  - Effect speed/intensity are write-mostly: WLED does not push sx/ix on
 *    the compact `<topic>/g` telemetry topic. `subscribe-speed` /
 *    `subscribe-intensity` are optional read-back topics (e.g. a bridge
 *    that echoes /json/state); when unset the sliders default to 128.
 *  - Presets: WLED recalls a preset by publishing {"ps":<id>} to
 *    <topic>/api. Preset NAMES are not MQTT-discoverable — the optional
 *    `presets` attribute carries a user-supplied [{id, name}, …] list
 *    rendered as a picker; with no list a numeric "preset #" input is
 *    shown instead. Both write-only (WLED does not report the active
 *    preset over MQTT).
 *  - Availability: WLED publishes retained online/offline on
 *    `<topic>/status`. When `subscribe-availability` is empty the element
 *    auto-derives that topic (property set — an explicit user value always
 *    wins); the base-class N31 machinery does the subscribing.
 *  - Effect/palette names are not discoverable over MQTT — the canonical
 *    WLED 0.14 lists are bundled (wled-lists.js); ids beyond the lists
 *    display numerically.
 */

// ─── Ring geometry — DUPLICATED from feezal-element-circle-light (private
// to that package). KEEP IN SYNC with material-light's constants: identical
// CX/CY/TRACK_R/RING_W/ARC_START/ARC_SWEEP is what makes the material-wled,
// material-light and material-climate circular sliders align perfectly
// (same centre, radius, track, knob) when placed at the same element size
// (B29/B37 parity). ─────────────────────────────────────────────────────────
const CX = 50;
const CY = 50;
const TRACK_R = 40;   // brightness ring centre-line radius
const RING_W  = 7;    // ring stroke width
const CENTER_R = 26;  // centre-circle radius (tap-to-toggle zone)
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

class FeezalElementCircleWled extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'WLED', category: 'Circle', color: '#1565c0', icon: 'wb_iridescent'},
            description: 'WLED strip control (single segment / whole strip): on/off, brightness (circular ring), colour, ' +
                'effect/palette with speed & intensity, and optional preset recall over WLED\'s MQTT API ' +
                '(<topic>/g, <topic>/c in, <topic>/api JSON out).',
            links: [
                {label: 'WLED MQTT docs', url: 'https://kno.wled.ge/interfaces/mqtt/'},
            ],
            // E108: native WLED self-discovery. The server synthesises a
            // `component:'wled'` entity (device_topic + availability) from native
            // WLED topics; the ⚡ picker / Auto-configure banner stamps it here.
            // Availability is applied automatically by _applyDiscovery from the
            // entity's availability_normalized record (no map entry needed).
            // E137: the discovery map is the controller package's fragment.
            discovery: {component: 'wled', map: wledDiscoveryMap},
            attributes: [
                // E137: the shared WLED contract (topic/transition/speed/
                // intensity read-backs/presets) — declared ONCE.
                ...wledAttributes,
                {name: 'label', type: 'string', help: 'Label shown below the controls.'},
                {name: 'icon', type: 'string', default: 'wb_iridescent', help: 'Material icon name shown on the power button.'},
                {name: 'show-effect', type: 'boolean', default: true,
                    help: 'Show the effect picker and its speed/intensity sliders.'},
                {name: 'show-palette', type: 'boolean', default: true,
                    help: 'Show the palette picker.'},
                {name: 'show-presets', type: 'boolean', default: false,
                    help: 'Show a preset selector that recalls a WLED preset via {"ps":<id>} on <topic>/api.'},
                {name: 'subscribe-availability', type: 'mqttTopic',
                    help: 'Availability topic (retained online/offline). Empty = auto-derived <topic>/status; set to override.'},
                {name: 'availability-mode', type: 'select', options: ['all', 'any'], default: 'all',
                    help: 'With multiple availability topics: all = every topic must report available; any = at least one.'},
                {name: 'payload-available', type: 'string', default: 'online', help: 'Payload meaning the device is available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning the device is unavailable.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-wled-on-color', type: 'color',
                    default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))',
                    help: 'Accent while the strip is on (overridden by the live strip colour when known).'},
                {property: '--feezal-wled-off-color', type: 'color',
                    default: 'var(--secondary-text-color, #9e9e9e)',
                    help: 'Outline/control colour while off.'},
                {property: '--feezal-wled-surface-color', type: 'color',
                    default: 'var(--primary-background-color, var(--feezal-bg, #fff))',
                    help: 'Control surface colour.'},
                {property: '--feezal-wled-text-color', type: 'color',
                    default: 'var(--primary-text-color, var(--feezal-color, #333))',
                    help: 'Text colour.'},
                // B29/B37 — ring geometry, unitless % of the slider viewBox; the
                // same numbers on material-light/material-climate give an
                // identical-looking slider (see the KEEP IN SYNC note above).
                {property: '--feezal-wled-track-width', default: '7',
                    help: 'Brightness-ring track width — unitless, in % of the circle viewBox (default 7). Same scale as --feezal-light-track-width.'},
                {property: '--feezal-wled-knob-size', default: '10',
                    help: 'Drag-knob diameter — unitless, in % of the circle viewBox (default 10). Same scale as --feezal-light-knob-size.'},
            ],
            restrict: {minWidth: 110, minHeight: 130},
            defaultStyle: {width: '180px', height: '320px'},
        };
    }

    static properties = {
        topic:      {type: String, reflect: true},
        transition: {type: String, reflect: true},
        label:      {type: String, reflect: true},
        icon:       {type: String, reflect: true},
        showEffect:         {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-effect'},
        showPalette:        {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-palette'},
        subscribeSpeed:     {type: String, reflect: true, attribute: 'subscribe-speed'},
        msgPropSpeed:       {type: String, reflect: true, attribute: 'message-property-speed'},
        subscribeIntensity: {type: String, reflect: true, attribute: 'subscribe-intensity'},
        msgPropIntensity:   {type: String, reflect: true, attribute: 'message-property-intensity'},
        showPresets:        {type: Boolean, reflect: true, attribute: 'show-presets'},
        presets:            {type: String, reflect: true},
        // E137: WLED state lives on the WledController (plain fields +
        // host.requestUpdate) — only the drag preview stays element-local.
        _dragPct:   {state: true},   // live brightness % during ring drag (null = not dragging)
    };

    static styles = [feezalBaseStyles, feezalAvailabilityStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            padding: 10px 8px 8px;
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
            --feezal-wled-on-color:      var(--primary-color, var(--sl-color-primary-600, #0284c7));
            --feezal-wled-off-color:     var(--secondary-text-color, #9e9e9e);
            --feezal-wled-surface-color: var(--primary-background-color, var(--feezal-bg, #fff));
            --feezal-wled-text-color:    var(--primary-text-color, var(--feezal-color, #333));
        }
        .ring-wrap { width: 100%; flex-shrink: 0; }
        svg {
            width: 100%;
            display: block;
            aspect-ratio: 1;
            overflow: visible;
            touch-action: none;
            user-select: none;
        }
        .row { width: 100%; display: flex; align-items: center; gap: 6px; }
        .row.center { justify-content: center; }
        input[type='color'].col {
            width: 28px; height: 28px; padding: 0; border: 1px solid var(--feezal-wled-off-color);
            border-radius: 6px; background: none; cursor: pointer; flex: 0 0 auto;
        }
        select {
            flex: 1; width: 100%; min-width: 0; box-sizing: border-box;
            background: var(--feezal-wled-surface-color); color: var(--feezal-wled-text-color);
            border: 1px solid var(--feezal-wled-off-color); border-radius: 6px;
            padding: 3px 6px; font-size: 11px; line-height: 1.4; cursor: pointer; outline: none;
            /* B38: without this, Chromium's UA dark form-control theme can
               paint the closed control independently of our colours; light
               dark tells it both schemes are supported so it defers to the
               explicit background/color above and to the <option> rule
               below for the open list. */
            color-scheme: light dark;
        }
        select:hover { border-color: var(--feezal-wled-text-color); }
        /* B38: the surface/text tokens are solid (not translucent), so they
           double as the open option-list colours — Chromium honours
           background/color on <option>; Firefox/Safari fall back to their
           own UA styling (no regression vs. before). */
        select option {
            background: var(--feezal-wled-surface-color);
            color: var(--feezal-wled-text-color);
        }
        .slider-row { flex-direction: column; align-items: stretch; gap: 1px; }
        .mini-label {
            font-size: 10px; opacity: 0.6; color: var(--feezal-wled-text-color);
        }
        input[type='range'] {
            width: 100%; accent-color: var(--wled-accent, var(--feezal-wled-on-color));
        }
        input[type='number'].preset-num {
            flex: 1; width: 100%; min-width: 0; box-sizing: border-box;
            background: var(--feezal-wled-surface-color); color: var(--feezal-wled-text-color);
            border: 1px solid var(--feezal-wled-off-color); border-radius: 6px;
            padding: 3px 6px; font-size: 11px; outline: none;
        }
        .label {
            font-size: 11px; opacity: 0.65; text-align: center;
            color: var(--feezal-wled-text-color);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;
        }
    `];

    constructor() {
        super();
        this.topic      = '';
        this.transition = '';
        this.label      = '';
        this.icon       = 'wb_iridescent';
        this.showEffect         = true;
        this.showPalette        = true;
        this.subscribeSpeed     = '';
        this.msgPropSpeed       = '';
        this.subscribeIntensity = '';
        this.msgPropIntensity   = '';
        this.showPresets        = false;
        this.presets            = '';
        this._dragPct   = null;
        // E137: the behavior layer — wires/parses/publishes; this view renders.
        this.wled = new WledController(this);
    }

    // No `subscribe` attribute — the base primary-subscription path is a
    // no-op; the WLED topics are wired manually below.

    connectedCallback() {
        // E137: derive <topic>/status BEFORE the N31 base subscribes.
        this.wled.deriveAvailability();
        super.connectedCallback();
    }

    willUpdate(changed) {
        super.willUpdate?.(changed);
        if (changed.has('topic') || changed.has('subscribeAvailability')) {
            this.wled.deriveAvailability();
        }
    }

    updated(changed) {
        super.updated(changed);
        // Live-canvas topic edits re-wire through the controller.
        this.wled.rewireIfChanged();
    }

    // ── E137: commands + computed values delegate to the controller ─────────

    toggle()             { this.wled.toggle(); }
    setBrightnessPct(p)  { this.wled.setBrightnessPct(p); }
    setColor(hex)        { this.wled.setColor(hex); }
    _onColorInput(hex)   { this.wled.colorInput(hex); }
    setEffect(id)        { this.wled.setEffect(id); }
    setPalette(id)       { this.wled.setPalette(id); }
    setSpeedPct(p)       { this.wled.setSpeedPct(p); }
    setIntensityPct(p)   { this.wled.setIntensityPct(p); }
    setPreset(id)        { this.wled.setPreset(id); }

    get _pct()          { return this.wled.pct; }
    get _speedPct()     { return this.wled.speedPct; }
    get _intensityPct() { return this.wled.intensityPct; }
    get _presetsList()  { return this.wled.presetsList; }

    // ─── SVG pointer handling (B29/B37 — same convention as material-light) ───
    _onSvgPointerDown(e) {
        if (feezal.isEditor) return;
        const {sx, sy} = this._toSvgCoords(e);
        const dx = sx - CX, dy = sy - CY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= CENTER_R) {
            this.toggle();
        } else if (dist <= TRACK_R + RING_W) {
            this._startBrtDrag(sx, sy);
        }
    }

    _startBrtDrag(sx, sy) {
        this._dragPct = this._pct ?? 0;

        const onMove = ev => {
            const {sx: x, sy: y} = this._toSvgCoords(ev);
            const deg = ((Math.atan2(y - CY, x - CX) * 180 / Math.PI) + 90 + 360) % 360;
            this._dragPct = angleToPct(deg);
        };
        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            const final = this._dragPct;
            this._dragPct = null;
            this.setBrightnessPct(final);
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        // Immediately update to the initial pointerdown position.
        const deg = ((Math.atan2(sy - CY, sx - CX) * 180 / Math.PI) + 90 + 360) % 360;
        this._dragPct = angleToPct(deg);
    }

    _toSvgCoords(e) {
        const el = this.shadowRoot.querySelector('svg');
        if (!el) return {sx: 0, sy: 0};
        const r = el.getBoundingClientRect();
        return {sx: ((e.clientX - r.left) / r.width) * 100, sy: ((e.clientY - r.top) / r.height) * 100};
    }

    _svgContent() {
        const isOn = this.wled.on;
        const pct  = this._dragPct !== null ? this._dragPct : (this._pct ?? (feezal.isEditor ? 50 : 0));
        const accent = this.wled.on && this.wled.color ? this.wled.color : 'var(--feezal-wled-on-color)';
        const trackC = 'var(--feezal-wled-off-color)';

        const arcEndAngle = (ARC_START + ARC_SWEEP) % 360; // 135°
        const fillAngle   = pctToAngle(pct);
        const trackD      = arcPath(ARC_START, arcEndAngle, TRACK_R);
        const fillD       = pct > 0.5 ? arcPath(ARC_START, fillAngle, TRACK_R) : null;
        const [hx, hy]    = polarXY(pct > 0.5 ? fillAngle : ARC_START, TRACK_R);

        return svg`
            <!-- Background track arc (B29/B37: width configurable, unitless % of viewBox) -->
            <path d="${trackD}" fill="none" stroke="${trackC}"
                stroke-width="${RING_W}" stroke-linecap="round" pointer-events="none"
                style="stroke-width: calc(var(--feezal-wled-track-width, ${RING_W}) * 1px)"/>

            <!-- Brightness fill arc -->
            ${isOn && fillD ? svg`
                <path d="${fillD}" fill="none" stroke="${accent}"
                    stroke-width="${RING_W}" stroke-linecap="round" pointer-events="none"
                    style="stroke-width: calc(var(--feezal-wled-track-width, ${RING_W}) * 1px)"/>
            ` : ''}

            <!-- Centre disc — tap toggles on/off -->
            <circle cx="${CX}" cy="${CY}" r="${CENTER_R}"
                fill="var(--feezal-wled-surface-color)"
                stroke="${isOn ? accent : trackC}" stroke-width="1.5"
                pointer-events="none"/>

            ${isOn ? svg`
                <circle cx="${CX}" cy="${CY}" r="${CENTER_R - 1.5}"
                    fill="${accent}" opacity="0.14" pointer-events="none"/>
            ` : ''}

            <text x="${CX}" y="${CY}" text-anchor="middle"
                dominant-baseline="middle" font-size="13" font-weight="500"
                fill="var(--feezal-wled-text-color)" pointer-events="none">
                ${isOn ? `${Math.round(pct)}%` : 'off'}
            </text>

            <!-- Drag handle on ring (shown when on; B29/B37: diameter configurable) -->
            ${isOn ? svg`
                <circle cx="${hx}" cy="${hy}" r="5"
                    fill="${accent}" stroke="var(--feezal-wled-surface-color)" stroke-width="2"
                    pointer-events="none"
                    style="r: calc(var(--feezal-wled-knob-size, 10) * 0.5px)"/>
            ` : ''}`;
    }

    _renderPresets() {
        if (!this.showPresets) return '';
        const list = this._presetsList;
        if (list.length > 0) {
            return html`
                <div class="row">
                    <select class="preset" title="Preset"
                        @change="${e => { if (e.target.value !== '') this.setPreset(e.target.value); }}">
                        <option value="" selected>— Preset —</option>
                        ${list.map(p => html`<option value="${p.id}">${p.name ?? p.id}</option>`)}
                    </select>
                </div>`;
        }
        return html`
            <div class="row">
                <input type="number" class="preset-num" min="0" step="1" placeholder="Preset #" title="Preset #"
                    @change="${e => { if (e.target.value !== '') this.setPreset(e.target.value); }}">
            </div>`;
    }

    render() {
        const fxBeyond = this.wled.fx !== null && this.wled.fx >= WLED_EFFECTS.length;
        const palBeyond = this.wled.pal !== null && this.wled.pal >= WLED_PALETTES.length;
        return html`
            ${availabilityBadge(this._available)}
            <div class="ring-wrap">
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
                    style="cursor:${feezal.isEditor ? 'default' : 'pointer'}"
                    @pointerdown="${this._onSvgPointerDown}">
                    ${this._svgContent()}
                </svg>
            </div>
            <div class="row center">
                <input type="color" class="col" title="Colour"
                    .value="${this.wled.color ?? '#ffffff'}"
                    @input="${e => this._onColorInput(e.target.value)}"
                    @change="${e => this.setColor(e.target.value)}">
            </div>
            ${this.showEffect ? html`
                <div class="row">
                    <select class="fx" title="Effect"
                        @change="${e => { if (e.target.value !== '') this.setEffect(e.target.value); }}">
                        <option value="" ?selected="${this.wled.fx === null}">— Effect —</option>
                        ${WLED_EFFECTS.map((name, i) => html`
                            <option value="${i}" ?selected="${this.wled.fx === i}">${name}</option>`)}
                        ${fxBeyond ? html`<option value="${this.wled.fx}" selected>${this.wled.fx}</option>` : ''}
                    </select>
                </div>
                <div class="row slider-row">
                    <span class="mini-label">Speed</span>
                    <input type="range" class="speed" min="0" max="100" step="1" title="Effect speed"
                        .value="${String(this._speedPct)}"
                        @change="${e => this.setSpeedPct(e.target.value)}">
                </div>
                <div class="row slider-row">
                    <span class="mini-label">Intensity</span>
                    <input type="range" class="intensity" min="0" max="100" step="1" title="Effect intensity"
                        .value="${String(this._intensityPct)}"
                        @change="${e => this.setIntensityPct(e.target.value)}">
                </div>
            ` : ''}
            ${this.showPalette ? html`
                <div class="row">
                    <select class="pal" title="Palette"
                        @change="${e => { if (e.target.value !== '') this.setPalette(e.target.value); }}">
                        <option value="" ?selected="${this.wled.pal === null}">— Palette —</option>
                        ${WLED_PALETTES.map((name, i) => html`
                            <option value="${i}" ?selected="${this.wled.pal === i}">${name}</option>`)}
                        ${palBeyond ? html`<option value="${this.wled.pal}" selected>${this.wled.pal}</option>` : ''}
                    </select>
                </div>
            ` : ''}
            ${this._renderPresets()}
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-circle-wled', FeezalElementCircleWled);
export {FeezalElementCircleWled};

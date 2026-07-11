/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {svg} from 'lit';
import '@material/web/chips/filter-chip.js';

// ─── Arc geometry ─────────────────────────────────────────────────────────────
// Convention: 0° = 12 o'clock, clockwise (same as feezal-element-material-climate).
// Reused verbatim from the climate reference (tPolarXY / tArcPath / angle↔value).
const ARC_CX    = 100;
const ARC_CY    = 100;
const ARC_R     = 82;    // outer arc centre-line radius
const ARC_W     = 10;    // track stroke width
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

// Value → span in degrees from ARC_START.
function tValueToSpan(val, min, max) {
    return Math.max(0, Math.min(ARC_SPAN, ((val - min) / (max - min)) * ARC_SPAN));
}

// SVG angle → value, snapped to 1.
function tAngleToValue(deg, min, max) {
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
    return Math.round(raw);
}

// Format humidity: strip decimals → "45%".
function fmtHum(val, unit) {
    if (val === null || val === undefined || isNaN(+val)) return '—';
    return Math.round(+val) + ' ' + (unit || '%');
}

// ─── Element ──────────────────────────────────────────────────────────────────
class FeezalElementMaterialHumidifier extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Humidifier', category: 'Device', color: '#1565c0', icon: 'water_drop'},
            description: 'Humidifier / dehumidifier control card — circular arc target-humidity slider, current humidity read-out, on/off toggle (tap centre), and optional mode chips.',
            // ── Follow-up: a custom N6 two-tab inspector (Topics + Config) should
            //    replace this flat attribute form once the attribute list grows.
            //    For now the standard flat inspector is used intentionally.
            discovery: {
                component: 'humidifier',
                map: {
                    // On/off state + command
                    state_topic:                  {attr: 'subscribe'},
                    command_topic:                {attr: 'publish-state'},
                    payload_on:                   {attr: 'payload-on'},
                    payload_off:                  {attr: 'payload-off'},
                    // Current humidity
                    current_humidity_topic:       {attr: 'subscribe-current-humidity'},
                    // Target humidity
                    target_humidity_state_topic:   {attr: 'subscribe-target-humidity'},
                    target_humidity_command_topic: {attr: 'publish-target-humidity'},
                    // Mode
                    mode_state_topic:             {attr: 'subscribe-mode'},
                    mode_command_topic:           {attr: 'publish-mode'},
                    // Range
                    min_humidity:                 {attr: 'min'},
                    max_humidity:                 {attr: 'max'},
                    // Value template → dot-notation path
                    value_template:               {attr: 'message-property', transform: 'valueTemplateToPath'},
                    // Label
                    name: 'label',
                },
            },
            attributes: [
                // ── On/off state ───────────────────────────────────────────────
                {name: 'subscribe',        type: 'mqttTopic', help: 'Primary on/off state topic. Reflects whether the device is running.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within primary (on/off) messages. Default "payload" reads msg.payload directly.'},
                {name: 'publish-state',    type: 'mqttTopic', help: 'Topic to publish the on/off command to (tap the centre to toggle).'},
                {name: 'payload-on',       type: 'string', default: 'ON',  help: 'Payload meaning the device is on. Default: ON'},
                {name: 'payload-off',      type: 'string', default: 'OFF', help: 'Payload meaning the device is off. Default: OFF'},
                // ── Current humidity ───────────────────────────────────────────
                {name: 'subscribe-current-humidity', type: 'mqttTopic', help: 'Topic for the measured current humidity (0–100 %).'},
                {name: 'message-property-current-humidity', type: 'string', default: 'payload',
                    help: 'Dot-notation path within current-humidity messages. Default: payload'},
                // ── Target humidity ────────────────────────────────────────────
                {name: 'subscribe-target-humidity', type: 'mqttTopic', help: 'Topic publishing the current target humidity setpoint.'},
                {name: 'message-property-target-humidity', type: 'string', default: 'payload',
                    help: 'Dot-notation path within target-humidity messages. Default: payload'},
                {name: 'publish-target-humidity',   type: 'mqttTopic', help: 'Topic to publish a new target humidity to (drag the arc handle).'},
                // ── Mode ───────────────────────────────────────────────────────
                {name: 'subscribe-mode', type: 'mqttTopic', help: 'Topic publishing the current operating mode.'},
                {name: 'message-property-mode', type: 'string', default: 'payload',
                    help: 'Dot-notation path within mode messages. Default: payload'},
                {name: 'publish-mode',   type: 'mqttTopic', help: 'Topic to publish the selected mode to.'},
                {name: 'modes', type: 'objectList', itemFields: [{key: 'value'}, {key: 'label'}], default: '',
                    help: 'JSON array of mode objects: [{"value":"normal","label":"Normal"},{"value":"eco","label":"Eco"}]. When non-empty, a chip row is shown.'},
                // ── Type / range / display ─────────────────────────────────────
                {name: 'type', type: 'select', options: ['humidifier', 'dehumidifier'], default: 'humidifier',
                    help: 'humidifier = blue accent arc; dehumidifier = amber accent arc.'},
                {name: 'min',  type: 'number', default: 0,   help: 'Minimum target humidity (arc start).'},
                {name: 'max',  type: 'number', default: 100, help: 'Maximum target humidity (arc end).'},
                {name: 'unit', type: 'string', default: '%', help: 'Unit label shown next to the humidity number.'},
                {name: 'label', type: 'string', default: '', help: 'Optional card title shown below the arc.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-humidifier-humid-color', type: 'color',
                    default: 'var(--info-color, #29b6f6)',
                    help: 'Arc, handle and chip accent colour in humidifier mode.'},
                {property: '--feezal-humidifier-dry-color', type: 'color',
                    default: 'var(--warning-color, #ff9800)',
                    help: 'Arc, handle and chip accent colour in dehumidifier mode.'},
                {property: '--feezal-humidifier-idle-color', type: 'color',
                    default: 'var(--secondary-text-color, #aaa)',
                    help: 'Background track and off/idle colour.'},
                {property: '--feezal-humidifier-text-color', type: 'color',
                    default: 'var(--primary-text-color, #212121)',
                    help: 'Humidity text, chip text, and label colour.'},
            ],
            restrict:     {minWidth: 150, minHeight: 180},
            defaultStyle: {width: '200px', height: '240px'},
        };
    }

    static properties = {
        // subscribe and messageProperty are inherited from FeezalElement.
        publishState:            {type: String, reflect: true, attribute: 'publish-state'},
        payloadOn:               {type: String, reflect: true, attribute: 'payload-on'},
        payloadOff:              {type: String, reflect: true, attribute: 'payload-off'},
        subscribeCurrentHumidity: {type: String, reflect: true, attribute: 'subscribe-current-humidity'},
        msgPropCurrentHumidity:  {type: String, reflect: true, attribute: 'message-property-current-humidity'},
        subscribeTargetHumidity: {type: String, reflect: true, attribute: 'subscribe-target-humidity'},
        msgPropTargetHumidity:   {type: String, reflect: true, attribute: 'message-property-target-humidity'},
        publishTargetHumidity:   {type: String, reflect: true, attribute: 'publish-target-humidity'},
        subscribeMode:           {type: String, reflect: true, attribute: 'subscribe-mode'},
        msgPropMode:             {type: String, reflect: true, attribute: 'message-property-mode'},
        publishMode:             {type: String, reflect: true, attribute: 'publish-mode'},
        modes:                   {type: String, reflect: true},
        type:                    {type: String, reflect: true},
        min:                     {type: Number, reflect: true},
        max:                     {type: Number, reflect: true},
        unit:                    {type: String, reflect: true},
        label:                   {type: String, reflect: true},
        // Internal state — never as class fields (Lit 3 rule)
        _on:       {state: true},   // boolean
        _current:  {state: true},   // null | number (0–100)
        _target:   {state: true},   // null | number
        _mode:     {state: true},   // null | string
        _dragSpan: {state: true},   // null | number — live arc span during drag
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

            /* ── Theme-aware colour tokens ──────────────────────────────────── */
            --feezal-humidifier-humid-color: var(--info-color,           var(--feezal-info,   #29b6f6));
            --feezal-humidifier-dry-color:   var(--warning-color,        var(--feezal-warn,   #ff9800));
            --feezal-humidifier-idle-color:  var(--secondary-text-color, var(--feezal-color2, #aaa));
            --feezal-humidifier-text-color:  var(--primary-text-color,   var(--feezal-color,  #212121));

            /* MD3 bridge — filter-chips follow the accent theme (set per-type in render) */
            --md-sys-color-on-surface-variant: var(--feezal-humidifier-idle-color);
            --md-filter-chip-outline-color:    var(--feezal-humidifier-idle-color);
            --md-filter-chip-label-text-color: var(--feezal-humidifier-text-color);
            --md-filter-chip-selected-label-text-color: #fff;
        }
        .arc-wrap {
            width: 100%;
            flex: 1;
            min-height: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        svg.arc {
            width: 100%;
            height: 100%;
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
        .label {
            font-size: 11px;
            opacity: 0.65;
            text-align: center;
            color: var(--feezal-humidifier-text-color);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 100%;
        }
        .mi {
            font-family: 'Material Icons';
            font-style: normal;
            font-weight: normal;
            line-height: 1;
        }
    `];

    constructor() {
        super();
        this.publishState             = '';
        this.payloadOn                = 'ON';
        this.payloadOff               = 'OFF';
        this.subscribeCurrentHumidity = '';
        this.msgPropCurrentHumidity   = '';
        this.subscribeTargetHumidity  = '';
        this.msgPropTargetHumidity    = '';
        this.publishTargetHumidity    = '';
        this.subscribeMode            = '';
        this.msgPropMode              = '';
        this.publishMode              = '';
        this.modes                    = '';
        this.type                     = 'humidifier';
        this.min                      = 0;
        this.max                      = 100;
        this.unit                     = '%';
        this.label                    = '';
        this._on                      = false;
        this._current                 = null;
        this._target                  = null;
        this._mode                    = null;
        this._dragSpan                = null;
    }

    // The humidifier manages all subscriptions itself.
    _subscribe() { /* intentionally empty — managed manually in connectedCallback */ }

    connectedCallback() {
        super.connectedCallback();

        // Primary on/off state (subscribe + message-property are inherited).
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                this._on = v === this.payloadOn || v === true || v === 1 || v === '1' || v === 'true';
            });
        }
        if (this.subscribeCurrentHumidity) {
            this.addSubscription(this.subscribeCurrentHumidity, msg => {
                const v = Number(this.getProperty(msg, this.msgPropCurrentHumidity || this.messageProperty));
                if (!isNaN(v)) this._current = Math.max(0, Math.min(100, v));
            });
        }
        if (this.subscribeTargetHumidity) {
            this.addSubscription(this.subscribeTargetHumidity, msg => {
                const v = Number(this.getProperty(msg, this.msgPropTargetHumidity || this.messageProperty));
                if (!isNaN(v)) this._target = v;
            });
        }
        if (this.subscribeMode) {
            this.addSubscription(this.subscribeMode, msg => {
                this._mode = String(this.getProperty(msg, this.msgPropMode || this.messageProperty));
            });
        }
    }

    // ─── Publish helpers ──────────────────────────────────────────────────────
    _toggleOnOff() {
        if (feezal.isEditor) return;
        this._on = !this._on;
        if (this.publishState) {
            feezal.connection.pub(this.publishState, this._on ? this.payloadOn : this.payloadOff);
        }
    }

    _setTarget(val) {
        const clamped = Math.round(Math.min(this.max, Math.max(this.min, val)));
        this._target   = clamped;
        this._dragSpan = null;
        if (feezal.isEditor) return;
        if (this.publishTargetHumidity) {
            feezal.connection.pub(this.publishTargetHumidity, String(clamped));
        }
    }

    _setMode(value) {
        if (feezal.isEditor) return;
        this._mode = value;
        if (this.publishMode) {
            feezal.connection.pub(this.publishMode, value);
        }
    }

    // ─── Accent colour by type ────────────────────────────────────────────────
    get _accentColor() {
        return this.type === 'dehumidifier'
            ? 'var(--feezal-humidifier-dry-color)'
            : 'var(--feezal-humidifier-humid-color)';
    }

    // ─── Arc interaction ──────────────────────────────────────────────────────
    _onArcPointerDown(e) {
        if (feezal.isEditor) return;
        // Ignore taps that land on the centre hit-zone (that toggles on/off).
        if (e.target.classList && e.target.classList.contains('center-hit')) return;
        const svgEl = e.currentTarget;
        svgEl.setPointerCapture(e.pointerId);

        const move = ev => {
            const pt = new DOMPoint(ev.clientX, ev.clientY);
            const sp = pt.matrixTransform(svgEl.getScreenCTM().inverse());
            const dx = sp.x - ARC_CX, dy = sp.y - ARC_CY;
            // SVG angle: 0° = right; convert to 0° = top, clockwise
            let deg = Math.atan2(dy, dx) * 180 / Math.PI + 90;
            if (deg < 0) deg += 360;
            const val     = tAngleToValue(deg, this.min, this.max);
            const clamped = Math.min(this.max, Math.max(this.min, val));
            this._dragSpan = tValueToSpan(clamped, this.min, this.max);
        };

        const up = () => {
            svgEl.removeEventListener('pointermove', move);
            svgEl.removeEventListener('pointerup', up);
            if (this._dragSpan !== null) {
                const frac = this._dragSpan / ARC_SPAN;
                this._setTarget(this.min + frac * (this.max - this.min));
            }
        };

        svgEl.addEventListener('pointermove', move);
        svgEl.addEventListener('pointerup', up);
        move(e); // immediate feedback on pointer-down
    }

    // ─── SVG rendering ────────────────────────────────────────────────────────
    _renderArc() {
        const target    = this._target ?? (feezal.isEditor ? 50 : null);
        const current   = this._current ?? (feezal.isEditor ? 45 : null);
        const fillColor = this._accentColor;
        const on        = this._on;

        // Current arc span (drag preview or committed)
        const spanDeg = this._dragSpan ??
            (target !== null ? tValueToSpan(target, this.min, this.max) : 0);

        // Background full arc
        const bgPath   = tArcPath(ARC_START, ARC_SPAN);
        // Filled target arc
        const fillPath = spanDeg > 0 ? tArcPath(ARC_START, spanDeg) : null;

        // Handle position
        const handleAngle = (ARC_START + spanDeg) % 360;
        const [hx, hy]    = tPolarXY(handleAngle);

        // Centre text
        const dispCurrent = current !== null ? fmtHum(current, this.unit) : '—';
        const dispTarget  = target !== null ? Math.round(target) + ' ' + (this.unit || '%') : '';
        const stateColor  = on ? fillColor : 'var(--feezal-humidifier-idle-color)';

        return svg`
            <!-- Background track -->
            <path d="${bgPath}" fill="none"
                stroke="var(--feezal-humidifier-idle-color)" stroke-opacity="0.25"
                stroke-width="${ARC_W}" stroke-linecap="round"/>

            <!-- Target fill arc -->
            ${fillPath ? svg`
                <path d="${fillPath}" fill="none"
                    stroke="${fillColor}" stroke-opacity="${on ? 1 : 0.4}"
                    stroke-width="${ARC_W}" stroke-linecap="round"/>
            ` : svg``}

            <!-- Drag handle -->
            <circle cx="${hx}" cy="${hy}" r="8"
                fill="${fillColor}" fill-opacity="${on ? 1 : 0.5}"
                stroke="var(--feezal-humidifier-text-color)"
                stroke-opacity="0.3" stroke-width="1.5"
                style="cursor:grab"/>

            <!-- Centre on/off hit-zone (tap toggles) -->
            <circle class="center-hit" cx="${ARC_CX}" cy="${ARC_CY}" r="44"
                fill="transparent" style="cursor:pointer"
                @pointerdown="${this._onCenterDown}"/>

            <!-- Current humidity — large, centred -->
            <text x="${ARC_CX}" y="${ARC_CY - 2}"
                text-anchor="middle" dominant-baseline="middle"
                font-size="24" font-weight="600"
                fill="var(--feezal-humidifier-text-color)"
                style="font-family:inherit;pointer-events:none">${dispCurrent}</text>

            <!-- Target label below current -->
            ${dispTarget ? svg`
                <text x="${ARC_CX}" y="${ARC_CY + 22}"
                    text-anchor="middle" dominant-baseline="middle"
                    font-size="11" fill="${stateColor}"
                    style="font-family:inherit;pointer-events:none">
                    → ${dispTarget}
                </text>
            ` : svg``}

            <!-- On/off indicator dot -->
            <circle cx="${ARC_CX}" cy="${ARC_CY + 38}" r="3"
                fill="${stateColor}" style="pointer-events:none"/>
        `;
    }

    _onCenterDown(e) {
        // Stop the arc drag from starting; treat as an on/off tap.
        e.stopPropagation();
        this._toggleOnOff();
    }

    _parsedModes() {
        if (!this.modes) return [];
        let arr;
        try { arr = JSON.parse(this.modes); } catch { return []; }
        if (!Array.isArray(arr)) return [];
        // Support both [{value,label},...] objects and plain string arrays.
        return arr.map(m => typeof m === 'string'
            ? {value: m, label: m.charAt(0).toUpperCase() + m.slice(1).replace(/_/g, ' ')}
            : m);
    }

    render() {
        const modeList  = this._parsedModes();
        const showModes = modeList.length > 0;
        const accent    = this._accentColor;

        return html`
            <div class="arc-wrap" style="--md-filter-chip-selected-container-color:${accent};--md-sys-color-primary:${accent}">
                <svg class="arc" viewBox="0 0 200 200"
                    @pointerdown="${this._onArcPointerDown}">
                    ${this._renderArc()}
                </svg>
            </div>

            ${showModes ? html`
                <div class="mode-row" style="--md-filter-chip-selected-container-color:${accent};--md-sys-color-primary:${accent}">
                    ${modeList.map(m => html`
                        <md-filter-chip
                            label="${m.label ?? m.value}"
                            ?selected="${this._mode === m.value}"
                            @click="${() => this._setMode(m.value)}">
                        </md-filter-chip>
                    `)}
                </div>
            ` : ''}

            ${this.label ? html`<div class="label">${this.label}</div>` : ''}
        `;
    }
}

customElements.define('feezal-element-material-humidifier', FeezalElementMaterialHumidifier);
export {FeezalElementMaterialHumidifier};

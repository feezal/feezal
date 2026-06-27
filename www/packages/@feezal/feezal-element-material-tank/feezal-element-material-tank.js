/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {svg} from 'lit';

// ── Tank geometry ─────────────────────────────────────────────────────────────
// Inner tank area: x=12, y=10, w=36, h=100  (inside a 60×130 viewBox)
const TX = 12, TY = 10, TW = 36, TH = 100;

// Tank outline path for shape 'rect' and 'cylinder'
function tankOutlinePath(shape) {
    if (shape === 'round') {
        // Circle: centred at (30,60), r=28
        return null; // handled separately
    }
    const rx = shape === 'cylinder' ? TW / 2 : 4;
    return {rect: true, rx};
}

// Fluid colour based on level and thresholds
function fluidColor(pct, warnPct, critPct) {
    if (critPct > 0 && pct <= critPct) return 'var(--feezal-tank-crit-color)';
    if (warnPct > 0 && pct <= warnPct) return 'var(--feezal-tank-warn-color)';
    return 'var(--feezal-tank-fluid-color)';
}

// ── Element ───────────────────────────────────────────────────────────────────
class FeezalElementMaterialTank extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Tank', category: 'Material', color: '#4a6080', icon: 'water'},
            description: 'Fluid level / tank visualisation — an SVG fill-level indicator with animated transitions. Configurable shape, colour thresholds and optional wave animation.',
            attributes: [
                {name: 'subscribe',       type: 'mqttTopic', help: 'Topic carrying the current fill level.'},
                {name: 'min',             type: 'number',    default: 0,     help: 'Value representing an empty tank (0 %).'},
                {name: 'max',             type: 'number',    default: 100,   help: 'Value representing a full tank (100 %).'},
                {name: 'unit',            type: 'string',    default: '%',   help: 'Unit label shown with the numeric value.'},
                {name: 'shape',           type: 'select',    options: ['rect', 'cylinder', 'round'], default: 'rect',
                    help: 'Tank outline shape — rectangular, cylindrical (rounded caps), or circular.'},
                {name: 'warn-threshold',  type: 'number',    default: 25,    help: 'Level (%) below which the warn colour applies.'},
                {name: 'crit-threshold',  type: 'number',    default: 10,    help: 'Level (%) below which the critical colour applies.'},
                {name: 'animate-wave',    type: 'boolean',   default: true,  help: 'Animate a gentle wave on the fluid surface.'},
                {name: 'show-value',      type: 'boolean',   default: true,  help: 'Show the numeric value inside the tank.'},
                {name: 'show-percent',    type: 'boolean',   default: false, help: 'Show percentage instead of raw value.'},
                {name: 'decimals',        type: 'number',    default: 0,     help: 'Decimal places for the value label.'},
                {name: 'label',           type: 'string',    default: '',    help: 'Optional label below the tank.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-tank-fluid-color', type: 'color', default: 'var(--info-color, #42a5f5)',       help: 'Fill colour at normal level.'},
                {property: '--feezal-tank-warn-color',  type: 'color', default: 'var(--warning-color, #ff9800)',    help: 'Fill colour when level ≤ warn-threshold.'},
                {property: '--feezal-tank-crit-color',  type: 'color', default: 'var(--error-color, #f44336)',      help: 'Fill colour when level ≤ crit-threshold.'},
                {property: '--feezal-tank-rim-color',   type: 'color', default: 'var(--primary-text-color)',        help: 'Tank outline / rim stroke colour.'},
                {property: '--feezal-tank-text-color',  type: 'color', default: 'var(--primary-text-color)',        help: 'Value label and bottom label text colour.'},
            ],
            restrict:     {minWidth: 50, minHeight: 80},
            defaultStyle: {width: '80px', height: '180px'},
        };
    }

    static properties = {
        subscribe:     {type: String,  reflect: true},
        min:           {type: Number,  reflect: true},
        max:           {type: Number,  reflect: true},
        unit:          {type: String,  reflect: true},
        shape:         {type: String,  reflect: true},
        warnThreshold: {type: Number,  reflect: true, attribute: 'warn-threshold'},
        critThreshold: {type: Number,  reflect: true, attribute: 'crit-threshold'},
        animateWave:   {type: Boolean, reflect: true, attribute: 'animate-wave'},
        showValue:     {type: Boolean, reflect: true, attribute: 'show-value'},
        showPercent:   {type: Boolean, reflect: true, attribute: 'show-percent'},
        decimals:      {type: Number,  reflect: true},
        label:         {type: String,  reflect: true},
        _value:  {state: true},  // raw value or null
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
            --feezal-tank-fluid-color: var(--info-color, var(--feezal-info, #42a5f5));
            --feezal-tank-warn-color:  var(--warning-color, var(--feezal-warning, #ff9800));
            --feezal-tank-crit-color:  var(--error-color, #f44336);
            --feezal-tank-rim-color:   var(--primary-text-color, var(--feezal-color, #333));
            --feezal-tank-text-color:  var(--primary-text-color, var(--feezal-color, #333));
        }
        @keyframes feezalTankWave {
            0%   { d: path("M0,0 Q9,-4 18,0 T36,0 L36,12 L0,12 Z"); }
            50%  { d: path("M0,0 Q9,4  18,0 T36,0 L36,12 L0,12 Z"); }
            100% { d: path("M0,0 Q9,-4 18,0 T36,0 L36,12 L0,12 Z"); }
        }
        .svg-wrap { flex: 1; width: 100%; min-height: 0; }
        svg.tank { width: 100%; height: 100%; display: block; overflow: hidden; }
        .fluid-fill {
            transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .wave {
            animation: feezalTankWave 2s ease-in-out infinite;
        }
        .label {
            font-size: 11px; opacity: 0.65; text-align: center;
            color: var(--feezal-tank-text-color);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;
        }
    `];

    constructor() {
        super();
        this.subscribe     = '';
        this.min           = 0;
        this.max           = 100;
        this.unit          = '%';
        this.shape         = 'rect';
        this.warnThreshold = 25;
        this.critThreshold = 10;
        this.animateWave   = true;
        this.showValue     = true;
        this.showPercent   = false;
        this.decimals      = 0;
        this.label         = '';
        this._value        = null;
    }

    connectedCallback() {
        super.connectedCallback();
        if (feezal.isEditor || !this.subscribe) return;
        this.addSubscription(this.subscribe, msg => {
            const v = Number(this.getProperty(msg, this.messageProperty));
            if (!isNaN(v)) this._value = v;
        });
    }

    _levelPct(rawValue) {
        const v = rawValue ?? this.min;
        return Math.max(0, Math.min(100, ((v - this.min) / (this.max - this.min)) * 100));
    }

    _fmtValue(rawValue, pct) {
        if (rawValue === null) return '\u2014';
        if (this.showPercent) return `${pct.toFixed(0)}\u2009%`;
        const n = Number(rawValue);
        return `${n.toFixed(this.decimals)}\u2009${this.unit}`;
    }

    _tankSvg(pct, color) {
        const isRound  = this.shape === 'round';
        const isCylinder = this.shape === 'cylinder';
        const rx = isCylinder ? TW / 2 : (isRound ? TW / 2 : 4);

        // Fill starts at bottom of tank and rises.
        // We use a CSS transform translateY on the fluid rect to animate height changes.
        const fillHeight  = (pct / 100) * TH;
        const translateY  = `${TH - fillHeight}px`;

        if (isRound) {
            // Circle tank: clip fluid fill to circle using clipPath
            const CR = 28, CCX = 30, CCY = 60;
            const fillY    = CCY + CR - 2 * CR * (pct / 100);
            const rectY    = Math.max(CCY - CR, fillY);
            const rectH    = Math.max(0, (CCY + CR) - rectY);
            return svg`
                <defs>
                    <clipPath id="feezal-tank-round-clip">
                        <circle cx="${CCX}" cy="${CCY}" r="${CR - 1}"/>
                    </clipPath>
                </defs>
                <circle cx="${CCX}" cy="${CCY}" r="${CR}"
                        fill="none" stroke="var(--feezal-tank-rim-color)" stroke-width="2.5"/>
                <g clip-path="url(#feezal-tank-round-clip)">
                    <rect class="fluid-fill" x="${CCX - CR + 1}" width="${(CR - 1) * 2}"
                          y="${CCY + CR}"
                          height="${CR * 2}"
                          fill="${color}" fill-opacity="0.85"
                          style="transform: translateY(-${fillHeight * (CR * 2 / TH)}px)"/>
                </g>
                ${this.showValue ? svg`
                    <text x="${CCX}" y="${CCY + 4}" text-anchor="middle"
                          font-size="11" fill="var(--feezal-tank-text-color)" font-weight="600">
                        ${this._fmtValue(this._value, pct)}
                    </text>
                ` : ''}`;
        }

        return svg`
            <defs>
                <clipPath id="feezal-tank-rect-clip">
                    <rect x="${TX + 1}" y="${TY + 1}" width="${TW - 2}" height="${TH - 2}" rx="${rx - 1}"/>
                </clipPath>
            </defs>
            <!-- tank outline -->
            <rect x="${TX}" y="${TY}" width="${TW}" height="${TH}" rx="${rx}"
                  fill="none" stroke="var(--feezal-tank-rim-color)" stroke-width="2.5"/>
            <!-- fluid fill — translateY slides the rect from below the tank upward -->
            <g clip-path="url(#feezal-tank-rect-clip)">
                <rect class="fluid-fill"
                      x="${TX + 1}" y="${TY + 1}" width="${TW - 2}" height="${TH}"
                      fill="${color}" fill-opacity="0.85"
                      style="transform: translateY(${TH - fillHeight}px); transform-box: fill-box;"/>
                ${this.animateWave && pct > 2 && pct < 100 ? svg`
                    <path class="wave"
                          style="transform: translateY(${TH - fillHeight}px); transform-box: fill-box; fill:${color}; opacity: 0.4;"
                          d="M${TX + 1},0 Q${TX + 1 + TW / 4},-4 ${TX + 1 + TW / 2},0 T${TX + TW - 1},0 L${TX + TW - 1},12 L${TX + 1},12 Z"/>
                ` : ''}
            </g>
            <!-- level tick lines (every 25%) -->
            ${[25, 50, 75].map(p => {
                const lineY = TY + TH - (p / 100) * TH;
                return svg`<line x1="${TX}" y1="${lineY}" x2="${TX + 6}" y2="${lineY}"
                                 stroke="var(--feezal-tank-rim-color)" stroke-width="1" opacity="0.4"/>
                           <line x1="${TX + TW - 6}" y1="${lineY}" x2="${TX + TW}" y2="${lineY}"
                                 stroke="var(--feezal-tank-rim-color)" stroke-width="1" opacity="0.4"/>`;
            })}
            <!-- value label -->
            ${this.showValue ? svg`
                <text x="${TX + TW / 2}" y="${TY + TH / 2 + 4}" text-anchor="middle"
                      font-size="10" fill="var(--feezal-tank-text-color)" font-weight="600">
                    ${this._fmtValue(this._value, pct)}
                </text>
            ` : ''}`;
    }

    render() {
        const displayValue = feezal.isEditor ? (this.min + this.max) / 2 : this._value;
        const pct   = this._levelPct(displayValue);
        const color = fluidColor(pct, this.warnThreshold, this.critThreshold);

        const vbH = this.shape === 'round' ? 120 : 130;

        return html`
            <div class="svg-wrap">
                <svg class="tank" viewBox="0 0 60 ${vbH}" xmlns="http://www.w3.org/2000/svg">
                    ${this._tankSvg(pct, color)}
                </svg>
            </div>
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-material-tank', FeezalElementMaterialTank);
export {FeezalElementMaterialTank};

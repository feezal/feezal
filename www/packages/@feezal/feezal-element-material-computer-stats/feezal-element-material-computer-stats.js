/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {svg} from 'lit';

const RING_DEFAULTS = [
    {slot: 'cpu',      label: 'CPU',     color: '#2196f3'},
    {slot: 'ram',      label: 'RAM',     color: '#4caf50'},
    {slot: 'gpu',      label: 'GPU',     color: '#9c27b0'},
    {slot: 'disk',     label: 'Disk',    color: '#00bcd4'},
    {slot: 'cpu-temp', label: 'CPU °C',  color: '#ff9800'},
    {slot: 'gpu-temp', label: 'GPU °C',  color: '#ff5722'},
    {slot: 'gpu-mem',  label: 'VRAM',    color: '#673ab7'},
    {slot: 'swap',     label: 'Swap',    color: '#607d8b'},
];

function arcPath(cx, cy, r, value) {
    if (value <= 0) return '';
    const v = Math.min(value, 0.9999);
    const startRad = -Math.PI / 2;
    const endRad   = startRad + v * 2 * Math.PI;
    const sx = cx + r * Math.cos(startRad);
    const sy = cy + r * Math.sin(startRad);
    const ex = cx + r * Math.cos(endRad);
    const ey = cy + r * Math.sin(endRad);
    const large = v > 0.5 ? 1 : 0;
    return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`;
}

function ringColor(value, defaultColor, warn, crit) {
    if (value >= crit) return '#f44336';
    if (value >= warn) return '#ff9800';
    return defaultColor;
}

class FeezalElementMaterialComputerStats extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Stats', category: 'Material', color: '#4a6080', icon: 'memory'},
            description: 'Concentric ring gauges for CPU, RAM, GPU and other system metrics.',
            attributes: [
                {name: 'subscribe-cpu',             type: 'mqttTopic', help: 'Topic for CPU usage (0–100%).'},
                {name: 'message-property-cpu',       type: 'string',    help: 'Dot-notation path within CPU messages. Default: payload'},
                {name: 'subscribe-ram',             type: 'mqttTopic', help: 'Topic for RAM usage (0–100%).'},
                {name: 'message-property-ram',       type: 'string',    help: 'Dot-notation path within RAM messages. Default: payload'},
                {name: 'subscribe-gpu',             type: 'mqttTopic', help: 'Topic for GPU usage (0–100%).'},
                {name: 'message-property-gpu',       type: 'string',    help: 'Dot-notation path within GPU messages. Default: payload'},
                {name: 'subscribe-disk',            type: 'mqttTopic', help: 'Topic for disk usage (0–100%).'},
                {name: 'message-property-disk',      type: 'string',    help: 'Dot-notation path within disk messages. Default: payload'},
                {name: 'subscribe-cpu-temp',        type: 'mqttTopic', help: 'Topic for CPU temperature.'},
                {name: 'message-property-cpu-temp',  type: 'string',    help: 'Dot-notation path within CPU temperature messages. Default: payload'},
                {name: 'subscribe-gpu-temp',        type: 'mqttTopic', help: 'Topic for GPU temperature.'},
                {name: 'message-property-gpu-temp',  type: 'string',    help: 'Dot-notation path within GPU temperature messages. Default: payload'},
                {name: 'subscribe-gpu-mem',         type: 'mqttTopic', help: 'Topic for GPU VRAM usage (0–100%).'},
                {name: 'message-property-gpu-mem',   type: 'string',    help: 'Dot-notation path within GPU VRAM messages. Default: payload'},
                {name: 'subscribe-swap',            type: 'mqttTopic', help: 'Topic for swap/page-file usage (0–100%).'},
                {name: 'message-property-swap',      type: 'string',    help: 'Dot-notation path within swap messages. Default: payload'},
                {name: 'warn-threshold',     type: 'number',    help: 'Value (%) at which ring turns amber. Default: 75'},
                {name: 'crit-threshold',     type: 'number',    help: 'Value (%) at which ring turns red. Default: 90'},
                {name: 'show-legend',        type: 'boolean',   help: 'Show a colour legend to the right of the rings.'},
                {name: 'show-labels',        type: 'boolean',   help: 'Show percentage values on active rings.'},
                {name: 'host-label',         type: 'string',    help: 'Text shown in the centre of the rings (e.g. hostname).'},
                {name: 'rings',              type: 'objectList', itemFields: [{key: 'slot'}, {key: 'label'}, {key: 'color', type: 'color'}, {key: 'max', type: 'number'}], help: 'Custom ring definitions — one row per ring (slot, label, colour, max). Overrides the defaults. Stored as a JSON array.'},
            ],
            styles: ['top', 'left', 'width', 'height'],
            defaultStyle: {width: '220px', height: '220px'},
        };
    }

    static properties = {
        subscribeCpu:     {type: String,  reflect: true, attribute: 'subscribe-cpu'},
        subscribeRam:     {type: String,  reflect: true, attribute: 'subscribe-ram'},
        subscribeGpu:     {type: String,  reflect: true, attribute: 'subscribe-gpu'},
        subscribeDisk:    {type: String,  reflect: true, attribute: 'subscribe-disk'},
        subscribeCpuTemp: {type: String,  reflect: true, attribute: 'subscribe-cpu-temp'},
        subscribeGpuTemp: {type: String,  reflect: true, attribute: 'subscribe-gpu-temp'},
        subscribeGpuMem:  {type: String,  reflect: true, attribute: 'subscribe-gpu-mem'},
        subscribeSwap:    {type: String,  reflect: true, attribute: 'subscribe-swap'},
        msgPropCpu:       {type: String,  reflect: true, attribute: 'message-property-cpu'},
        msgPropRam:       {type: String,  reflect: true, attribute: 'message-property-ram'},
        msgPropGpu:       {type: String,  reflect: true, attribute: 'message-property-gpu'},
        msgPropDisk:      {type: String,  reflect: true, attribute: 'message-property-disk'},
        msgPropCpuTemp:   {type: String,  reflect: true, attribute: 'message-property-cpu-temp'},
        msgPropGpuTemp:   {type: String,  reflect: true, attribute: 'message-property-gpu-temp'},
        msgPropGpuMem:    {type: String,  reflect: true, attribute: 'message-property-gpu-mem'},
        msgPropSwap:      {type: String,  reflect: true, attribute: 'message-property-swap'},
        warnThreshold:    {type: Number,  reflect: true, attribute: 'warn-threshold'},
        critThreshold:    {type: Number,  reflect: true, attribute: 'crit-threshold'},
        showLegend:       {type: Boolean, reflect: true, attribute: 'show-legend'},
        showLabels:       {type: Boolean, reflect: true, attribute: 'show-labels'},
        hostLabel:        {type: String,  reflect: true, attribute: 'host-label'},
        rings:            {type: String,  reflect: true},
        _values:          {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            padding: 4px;
        }
        .container {
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
            height: 100%;
        }
        .ring-wrap {
            flex: 1;
            min-width: 0;
            aspect-ratio: 1;
        }
        svg {
            width: 100%;
            height: 100%;
        }
        .centre-label {
            font-size: 9px;
            fill: var(--secondary-text-color, #666);
            text-anchor: middle;
            dominant-baseline: middle;
        }
        .legend {
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-size: 11px;
            color: var(--secondary-text-color, #666);
            flex-shrink: 0;
        }
        .legend-row {
            display: flex;
            align-items: center;
            gap: 5px;
            white-space: nowrap;
        }
        .legend-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
        }
        .legend-val {
            font-weight: 500;
            color: var(--primary-text-color, #333);
        }
    `];

    constructor() {
        super();
        this.subscribeCpu     = '';
        this.subscribeRam     = '';
        this.subscribeGpu     = '';
        this.subscribeDisk    = '';
        this.subscribeCpuTemp = '';
        this.subscribeGpuTemp = '';
        this.subscribeGpuMem  = '';
        this.subscribeSwap    = '';
        this.msgPropCpu       = '';
        this.msgPropRam       = '';
        this.msgPropGpu       = '';
        this.msgPropDisk      = '';
        this.msgPropCpuTemp   = '';
        this.msgPropGpuTemp   = '';
        this.msgPropGpuMem    = '';
        this.msgPropSwap      = '';
        this.warnThreshold    = 75;
        this.critThreshold    = 90;
        this.showLegend       = false;
        this.showLabels       = false;
        this.hostLabel        = '';
        this.rings            = '';
        this._values          = {};
    }

    get _ringDefs() {
        if (this.rings) {
            try { return JSON.parse(this.rings); } catch { /* ignore */ }
        }
        return RING_DEFAULTS;
    }

    _topicFor(slot) {
        const map = {
            'cpu':      this.subscribeCpu,
            'ram':      this.subscribeRam,
            'gpu':      this.subscribeGpu,
            'disk':     this.subscribeDisk,
            'cpu-temp': this.subscribeCpuTemp,
            'gpu-temp': this.subscribeGpuTemp,
            'gpu-mem':  this.subscribeGpuMem,
            'swap':     this.subscribeSwap,
        };
        return map[slot] || '';
    }

    _msgPropFor(slot) {
        return ({
            'cpu':      this.msgPropCpu,
            'ram':      this.msgPropRam,
            'gpu':      this.msgPropGpu,
            'disk':     this.msgPropDisk,
            'cpu-temp': this.msgPropCpuTemp,
            'gpu-temp': this.msgPropGpuTemp,
            'gpu-mem':  this.msgPropGpuMem,
            'swap':     this.msgPropSwap,
        })[slot] || this.messageProperty;
    }

    connectedCallback() {
        super.connectedCallback();
        for (const def of this._ringDefs) {
            const topic = def.topic || this._topicFor(def.slot);
            if (!topic) continue;
            ((slot, max) => {
                this.addSubscription(topic, msg => {
                    const raw = parseFloat(this.getProperty(msg, this._msgPropFor(slot)));
                    if (isNaN(raw)) return;
                    const pct = max && max !== 100 ? (raw / max) * 100 : raw;
                    this._values = {...this._values, [slot]: pct};
                });
            })(def.slot, def.max);
        }
    }

    _renderRings() {
        const defs = this._ringDefs;
        const cx = 50, cy = 50;
        const gap = 3;
        const strokeW = 6;
        const maxR = 46;
        const minR = maxR - (defs.length - 1) * (strokeW + gap);
        const warn = this.warnThreshold ?? 75;
        const crit = this.critThreshold ?? 90;

        return svg`
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                ${defs.map((def, i) => {
                    const r = maxR - i * (strokeW + gap);
                    if (r < 5) return svg``;
                    const pct = this._values[def.slot] ?? 0;
                    const frac = Math.max(0, Math.min(100, pct)) / 100;
                    const color = ringColor(pct, def.color, warn, crit);
                    const d = arcPath(cx, cy, r, frac);
                    // full-circle background
                    const bg = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r}`;
                    return svg`
                        <path d="${bg}" fill="none" stroke="#e0e0e0" stroke-width="${strokeW}" stroke-linecap="round" opacity="0.4"/>
                        ${d ? svg`<path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round"/>` : ''}
                        ${this.showLabels && pct > 0 ? svg`
                            <text x="${cx}" y="${cy + r + strokeW + 1}" text-anchor="middle"
                                font-size="5" fill="${color}">${Math.round(pct)}%</text>` : ''}`;
                })}
                ${this.hostLabel ? svg`
                    <text x="${cx}" y="${cy}" class="centre-label">${this.hostLabel}</text>` : ''}
            </svg>`;
    }

    render() {
        return html`
            <div class="container">
                <div class="ring-wrap">${this._renderRings()}</div>
                ${this.showLegend ? html`
                    <div class="legend">
                        ${this._ringDefs.map(def => {
                            const pct = this._values[def.slot];
                            const color = pct != null ? ringColor(pct, def.color, this.warnThreshold ?? 75, this.critThreshold ?? 90) : def.color;
                            return html`
                                <div class="legend-row">
                                    <div class="legend-dot" style="background:${color}"></div>
                                    <span>${def.label}</span>
                                    ${pct != null ? html`<span class="legend-val">${Math.round(pct)}%</span>` : ''}
                                </div>`;
                        })}
                    </div>` : ''}
            </div>`;
    }
}

customElements.define('feezal-element-material-computer-stats', FeezalElementMaterialComputerStats);
export {FeezalElementMaterialComputerStats};

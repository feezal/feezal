/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {svg} from 'lit';

function fmt(w) {
    if (w == null) return '–';
    const a = Math.abs(w);
    if (a >= 1000) return `${(a / 1000).toFixed(1)} kW`;
    return `${Math.round(a)} W`;
}

const SOLAR_COLOR   = '#fdd835';
const GRID_IMP_COLOR = '#ef5350';
const GRID_EXP_COLOR = '#26a69a';
const BATT_COLOR    = '#66bb6a';
const LOAD_COLOR    = '#90a4ae';

class FeezalElementMaterialEnergyFlow extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Energy Flow', category: 'Material', color: '#4a6080', icon: 'electric_bolt'},
            description: 'Animated energy-flow diagram: Solar → House ← Grid, House ↔ Battery.',
            attributes: [
                {name: 'subscribe-solar',       type: 'mqttTopic', help: 'Topic for solar generation (W, always positive).'},
                {name: 'subscribe-grid',        type: 'mqttTopic', help: 'Topic for grid power (W, positive = import, negative = export).'},
                {name: 'subscribe-load',        type: 'mqttTopic', help: 'Topic for house consumption (W, always positive).'},
                {name: 'subscribe-battery',     type: 'mqttTopic', help: 'Topic for battery power (W, positive = charging, negative = discharging).'},
                {name: 'subscribe-battery-soc', type: 'mqttTopic', help: 'Topic for battery state of charge (0–100 %).'},
                {name: 'show-battery',          type: 'boolean',   help: 'Show the battery node.'},
                {name: 'pv-label',              type: 'string',    help: 'Label under the solar node. Default: Solar'},
                {name: 'grid-label',            type: 'string',    help: 'Label under the grid node. Default: Grid'},
                {name: 'load-label',            type: 'string',    help: 'Label under the house node. Default: House'},
                {name: 'battery-label',         type: 'string',    help: 'Label under the battery node. Default: Battery'},
                {name: 'unit',                  type: 'string',    help: 'Power unit label. Default: W'},
                {name: 'animate',               type: 'boolean',   help: 'Enable animated flow lines. Default: true'},
            ],
            styles: ['top', 'left', 'width', 'height'],
            defaultStyle: {width: '320px', height: '260px'},
        };
    }

    static properties = {
        subscribeSolar:      {type: String,  reflect: true, attribute: 'subscribe-solar'},
        subscribeGrid:       {type: String,  reflect: true, attribute: 'subscribe-grid'},
        subscribeLoad:       {type: String,  reflect: true, attribute: 'subscribe-load'},
        subscribeBattery:    {type: String,  reflect: true, attribute: 'subscribe-battery'},
        subscribeBatterySoc: {type: String,  reflect: true, attribute: 'subscribe-battery-soc'},
        showBattery:         {type: Boolean, reflect: true, attribute: 'show-battery'},
        pvLabel:             {type: String,  reflect: true, attribute: 'pv-label'},
        gridLabel:           {type: String,  reflect: true, attribute: 'grid-label'},
        loadLabel:           {type: String,  reflect: true, attribute: 'load-label'},
        batteryLabel:        {type: String,  reflect: true, attribute: 'battery-label'},
        unit:                {type: String,  reflect: true},
        animate:             {type: Boolean, reflect: true},
        _solar:   {state: true},
        _grid:    {state: true},
        _load:    {state: true},
        _battery: {state: true},
        _soc:     {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: block;
            box-sizing: border-box;
        }
        svg {
            width: 100%;
            height: 100%;
        }
        @keyframes flow-fwd {
            from { stroke-dashoffset: 24; }
            to   { stroke-dashoffset:  0; }
        }
        @keyframes flow-rev {
            from { stroke-dashoffset:  0; }
            to   { stroke-dashoffset: 24; }
        }
        .flow-fwd {
            animation: flow-fwd 1s linear infinite;
        }
        .flow-rev {
            animation: flow-rev 1s linear infinite;
        }
    `];

    constructor() {
        super();
        this.subscribeSolar      = '';
        this.subscribeGrid       = '';
        this.subscribeLoad       = '';
        this.subscribeBattery    = '';
        this.subscribeBatterySoc = '';
        this.showBattery         = false;
        this.pvLabel             = 'Solar';
        this.gridLabel           = 'Grid';
        this.loadLabel           = 'House';
        this.batteryLabel        = 'Battery';
        this.unit                = 'W';
        this.animate             = true;
        this._solar              = null;
        this._grid               = null;
        this._load               = null;
        this._battery            = null;
        this._soc                = null;
    }

    connectedCallback() {
        super.connectedCallback();
        if (feezal.isEditor) return;
        const sub = (topic, cb) => { if (topic) this.addSubscription(topic, cb); };
        sub(this.subscribeSolar,      msg => { this._solar   = parseFloat(this.getProperty(msg, this.messageProperty)); });
        sub(this.subscribeGrid,       msg => { this._grid    = parseFloat(this.getProperty(msg, this.messageProperty)); });
        sub(this.subscribeLoad,       msg => { this._load    = parseFloat(this.getProperty(msg, this.messageProperty)); });
        sub(this.subscribeBattery,    msg => { this._battery = parseFloat(this.getProperty(msg, this.messageProperty)); });
        sub(this.subscribeBatterySoc, msg => { this._soc     = parseFloat(this.getProperty(msg, this.messageProperty)); });
    }

    _flowLine(x1, y1, x2, y2, color, power, anim) {
        // Power > 0 → flow from (x1,y1) to (x2,y2); < 0 → reverse
        const active = power != null && Math.abs(power) > 1;
        const cls = active && anim ? (power > 0 ? 'flow-fwd' : 'flow-rev') : '';
        return svg`
            <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                stroke="#e0e0e0" stroke-width="3" stroke-linecap="round"/>
            <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                stroke="${active ? color : '#e0e0e0'}"
                stroke-width="3" stroke-linecap="round"
                stroke-dasharray="8 4"
                class="${cls}"
                opacity="${active ? 1 : 0}"/>`;
    }

    _node(cx, cy, r, icon, label, value, color, isEditor) {
        return svg`
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="0.15"/>
            <circle cx="${cx}" cy="${cy}" r="${r - 4}" fill="${color}" opacity="0.25"/>
            <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="14"
                font-family="Material Symbols Outlined, Material Icons, sans-serif"
                fill="${color}">${icon}</text>
            <text x="${cx}" y="${cy + r + 13}" text-anchor="middle" font-size="9"
                fill="var(--secondary-text-color, #666)">${label}</text>
            ${!isEditor && value != null ? svg`
                <text x="${cx}" y="${cy + r + 24}" text-anchor="middle" font-size="8"
                    font-weight="500" fill="${color}">${fmt(value)}</text>` : ''}`;
    }

    render() {
        const isEdit = feezal.isEditor;
        const hasBatt = this.showBattery;
        const anim = this.animate !== false;

        // Layout: viewBox 0 0 300 240
        // Solar: (150, 42)
        // House: (150, 150)
        // Grid:  (hasBatt ? 50 : 50, 150)
        // Batt:  (250, 150)
        const cx = 150, cy = 150;
        const solarX = 150, solarY = 42;
        const gridX  = hasBatt ? 50 : 60;
        const battX  = 250;
        const nr = 28;

        const solarFlow = isEdit ? 3200 : this._solar;
        const gridFlow  = isEdit ? -500 : this._grid;
        const loadFlow  = isEdit ? 1200 : this._load;
        const battFlow  = isEdit ? 800  : this._battery;
        const soc       = isEdit ? 72   : this._soc;

        const gridColor = (gridFlow ?? 0) >= 0 ? GRID_IMP_COLOR : GRID_EXP_COLOR;

        return html`
            <svg viewBox="0 0 300 240" xmlns="http://www.w3.org/2000/svg">
                <!-- Flow lines first (behind nodes) -->
                ${this._flowLine(solarX, solarY + nr + 2, cx, cy - nr - 2, SOLAR_COLOR, solarFlow, anim)}
                ${this._flowLine(gridX + nr + 2, cy, cx - nr - 2, cy, gridColor, gridFlow, anim)}
                ${hasBatt ? this._flowLine(cx + nr + 2, cy, battX - nr - 2, cy, BATT_COLOR, battFlow, anim) : ''}

                <!-- Nodes -->
                ${this._node(solarX, solarY, nr, 'wb_sunny', this.pvLabel || 'Solar', solarFlow, SOLAR_COLOR, isEdit)}
                ${this._node(cx, cy, nr + 4, 'home', this.loadLabel || 'House', loadFlow, LOAD_COLOR, isEdit)}
                ${this._node(gridX, cy, nr, 'electrical_services', this.gridLabel || 'Grid', this._grid, gridColor, isEdit)}
                ${hasBatt ? this._node(battX, cy, nr, 'battery_charging_full', this.batteryLabel || 'Battery', battFlow, BATT_COLOR, isEdit) : ''}

                <!-- SOC on battery -->
                ${hasBatt && !isEdit && soc != null ? svg`
                    <text x="${battX}" y="${cy + nr + 34}" text-anchor="middle" font-size="8"
                        fill="${BATT_COLOR}" opacity="0.8">${Math.round(soc)}%</text>` : ''}
            </svg>`;
    }
}

customElements.define('feezal-element-material-energy-flow', FeezalElementMaterialEnergyFlow);
export {FeezalElementMaterialEnergyFlow};

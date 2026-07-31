/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {EvccLoadpointController, evccLoadpointAttributes, evccLoadpointDiscoveryMap, EVCC_MODES} from '@feezal/feezal-controller-evcc-loadpoint';
import {applySizePreset, glassCardStyles} from '@feezal/feezal-glass';

const fmtPower = w => {
    if (w == null) return '–';
    const a = Math.abs(w);
    return a >= 1000 ? `${(a / 1000).toFixed(1)} kW` : `${Math.round(a)} W`;
};
const fmtEnergy = wh => {
    if (wh == null) return '';
    return wh >= 1000 ? `${(wh / 1000).toFixed(1)} kWh` : `${Math.round(wh)} Wh`;
};

/**
 * feezal-element-glass-loadpoint (E109)
 *
 * Frosted-glass evcc loadpoint control card — a view over the shared
 * EvccLoadpointController. Charge mode (Off / Solar / Min+Solar / Fast), charge
 * power, vehicle SoC + limit, session energy, connected/charging state. A
 * heating loadpoint (`heating`) shows a reduced, °C-labelled view.
 */
class FeezalElementGlassLoadpoint extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Loadpoint', category: 'Glass', color: '#7aa5c9', icon: 'ev_station'},
            description: 'Frosted-glass evcc loadpoint card: charge mode, power, vehicle SoC + limit, session. ' +
                'Heat-pump loadpoints get a reduced °C view. Auto-wired by evcc discovery. Same controller as the metro/circle loadpoint cards.',
            discovery: {component: 'evcc-loadpoint', map: evccLoadpointDiscoveryMap},
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x2', '2x1'], default: '',
                    help: 'Preset size: 2x2 = square, 2x1 = wide. Empty keeps the current/manual size.'},
                ...evccLoadpointAttributes,
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Availability topic (evcc `<root>/status`).'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-accent', type: 'color', default: '#30d158', help: 'Charging / active-mode accent.'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-icon-size', default: '24px', help: 'Icon font size.'},
            ],
            defaultStyle: {width: '200px', height: '190px'},
            restrict: {minWidth: 150, minHeight: 150},
        };
    }

    static properties = {
        size:              {type: String, reflect: true},
        heating:           {type: Boolean, reflect: true},
        label:             {type: String, reflect: true},
        subscribeMode:         {type: String, reflect: true, attribute: 'subscribe-mode'},
        subscribeChargePower:  {type: String, reflect: true, attribute: 'subscribe-charge-power'},
        subscribeSessionEnergy:{type: String, reflect: true, attribute: 'subscribe-session-energy'},
        subscribeConnected:    {type: String, reflect: true, attribute: 'subscribe-connected'},
        subscribeCharging:     {type: String, reflect: true, attribute: 'subscribe-charging'},
        subscribeEnabled:      {type: String, reflect: true, attribute: 'subscribe-enabled'},
        subscribeVehicleTitle: {type: String, reflect: true, attribute: 'subscribe-vehicle-title'},
        subscribeVehicleSoc:   {type: String, reflect: true, attribute: 'subscribe-vehicle-soc'},
        subscribeVehicleRange: {type: String, reflect: true, attribute: 'subscribe-vehicle-range'},
        subscribeLimitSoc:     {type: String, reflect: true, attribute: 'subscribe-limit-soc'},
        subscribeMinCurrent:   {type: String, reflect: true, attribute: 'subscribe-min-current'},
        subscribeMaxCurrent:   {type: String, reflect: true, attribute: 'subscribe-max-current'},
        subscribePhases:       {type: String, reflect: true, attribute: 'subscribe-phases'},
        publishMode:           {type: String, reflect: true, attribute: 'publish-mode'},
        publishLimitSoc:       {type: String, reflect: true, attribute: 'publish-limit-soc'},
        publishMinCurrent:     {type: String, reflect: true, attribute: 'publish-min-current'},
        publishMaxCurrent:     {type: String, reflect: true, attribute: 'publish-max-current'},
        publishPhases:         {type: String, reflect: true, attribute: 'publish-phases'},
        discoveryId:       {type: String, reflect: true, attribute: 'discovery-id'},
        degrade:           {type: Boolean, reflect: true},
    };

    static styles = [feezalBaseStyles, glassCardStyles, css`
        /* B68: no position:relative — the shared .card is position:absolute; inset
           (fills the host + anchors the badge); overriding collapses it to content size. */
        .card { gap: 4px; justify-content: flex-start; padding: 10px 12px; text-align: left; align-items: stretch; }
        .head { display: flex; align-items: center; gap: 6px; }
        feezal-icon { font-size: var(--feezal-glass-icon-size, 24px); line-height: 1; color: var(--feezal-glass-accent, #30d158); }
        .title { font-weight: 700; font-size: 14px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .status { font-size: 10px; font-weight: 600; opacity: 0.6; }
        .status.on { color: var(--feezal-glass-accent, #30d158); opacity: 1; }
        .power { font-size: 26px; font-weight: 700; line-height: 1.05; font-variant-numeric: tabular-nums; }
        .socbar { position: relative; height: 8px; border-radius: 4px; background: var(--feezal-glass-muted, rgba(29,29,31,0.18)); overflow: hidden; margin-top: 2px; }
        .socbar .fill { position: absolute; inset: 0 auto 0 0; background: var(--feezal-glass-accent, #30d158); border-radius: 4px; }
        .socbar .limit { position: absolute; top: -2px; bottom: -2px; width: 2px; background: var(--primary-text-color); opacity: 0.6; }
        .socline, .session { font-size: 11px; opacity: 0.7; }
        .modes { display: flex; gap: 3px; margin-top: auto; }
        .modes button {
            flex: 1; padding: 4px 0; font-size: 10px; font-weight: 600; cursor: pointer;
            border: 1px solid var(--feezal-glass-muted, rgba(29,29,31,0.25)); border-radius: 5px;
            background: transparent; color: inherit; min-width: 0;
        }
        .modes button.active { background: var(--feezal-glass-accent, #30d158); border-color: var(--feezal-glass-accent, #30d158); color: #fff; }
        .unavail { position: absolute; top: 6px; right: 8px; font-size: 14px; color: var(--error-color); opacity: 0.85; }
    `];

    constructor() {
        super();
        this.size = '';
        this.heating = false;
        this.label = '';
        for (const a of ['subscribeMode', 'subscribeChargePower', 'subscribeSessionEnergy', 'subscribeConnected',
            'subscribeCharging', 'subscribeEnabled', 'subscribeVehicleTitle', 'subscribeVehicleSoc', 'subscribeVehicleRange',
            'subscribeLimitSoc', 'subscribeMinCurrent', 'subscribeMaxCurrent', 'subscribePhases',
            'publishMode', 'publishLimitSoc', 'publishMinCurrent', 'publishMaxCurrent', 'publishPhases', 'discoveryId']) this[a] = '';
        this.degrade = false;
        this.loadpoint = new EvccLoadpointController(this);
    }

    _subscribe() { /* device card manages its own subscriptions */ }

    updated(changed) {
        super.updated(changed);
        this.loadpoint.rewireIfChanged();
        if (changed.has('size')) applySizePreset(this);
    }

    _renderEv(c) {
        return html`
            <div class="power">${fmtPower(c.chargePower ?? (feezal.isEditor ? 3600 : null))}</div>
            ${c.vehicleSoc != null ? html`
                <div class="socbar">
                    <div class="fill" style="width:${Math.max(0, Math.min(100, c.vehicleSoc))}%"></div>
                    ${c.limitSoc != null ? html`<div class="limit" style="left:${Math.max(0, Math.min(100, c.limitSoc))}%"></div>` : ''}
                </div>
                <div class="socline">${Math.round(c.vehicleSoc)}%${c.limitSoc != null ? ` → ${Math.round(c.limitSoc)}%` : ''}${c.vehicleTitle ? ` · ${c.vehicleTitle}` : ''}</div>` : ''}
            ${c.sessionEnergy != null ? html`<div class="session">${fmtEnergy(c.sessionEnergy)} this session</div>` : ''}`;
    }

    _renderHeating(c) {
        return html`
            <div class="power">${c.vehicleSoc != null ? `${Math.round(c.vehicleSoc)} °C` : (feezal.isEditor ? '52 °C' : '–')}</div>
            ${c.limitSoc != null ? html`<div class="socline">target ${Math.round(c.limitSoc)} °C</div>` : ''}
            ${c.chargePower != null ? html`<div class="session">${fmtPower(c.chargePower)}</div>` : ''}`;
    }

    render() {
        const c = this.loadpoint;
        const heating = c.heating;
        return html`
            <div class="card ${c.charging ? 'charging' : ''}">
                ${this.subscribeAvailability && !this._available ? html`<span class="unavail" title="Device unavailable">⚠</span>` : ''}
                <div class="head">
                    <feezal-icon name="${heating ? 'mode_heat' : 'ev_station'}"></feezal-icon>
                    <span class="title">${this.label || c.vehicleTitle || (feezal.isEditor ? 'Loadpoint' : '')}</span>
                    <span class="status ${c.charging ? 'on' : ''}">${c.statusText}</span>
                </div>
                ${heating ? this._renderHeating(c) : this._renderEv(c)}
                <div class="modes">
                    ${EVCC_MODES.map(m => html`
                        <button class="${c.mode === m.value ? 'active' : ''}" @click="${() => c.setMode(m.value)}">${m.label}</button>`)}
                </div>
            </div>
        `;
    }
}

customElements.define('feezal-element-glass-loadpoint', FeezalElementGlassLoadpoint);
export {FeezalElementGlassLoadpoint};

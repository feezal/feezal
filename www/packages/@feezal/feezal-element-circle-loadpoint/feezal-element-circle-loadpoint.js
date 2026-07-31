/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {EvccLoadpointController, evccLoadpointAttributes, evccLoadpointDiscoveryMap, EVCC_MODES} from '@feezal/feezal-controller-evcc-loadpoint';

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
 * feezal-element-circle-loadpoint (E109)
 *
 * Circle-family evcc loadpoint control card — a view over the shared
 * EvccLoadpointController. Charge mode (Off / Solar / Min+Solar / Fast), charge
 * power, vehicle SoC + limit, session energy, connected/charging state. A
 * heating loadpoint (`heating`) shows a reduced, °C-labelled view. Same
 * controller as the glass/metro loadpoint cards; only the chrome differs.
 */
class FeezalElementCircleLoadpoint extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Loadpoint', category: 'Circle', color: '#1565c0', icon: 'ev_station'},
            description: 'Circle evcc loadpoint card: charge mode, power, vehicle SoC + limit, session. ' +
                'Heat-pump loadpoints get a reduced °C view. Auto-wired by evcc discovery. Same controller as the glass/metro loadpoint cards.',
            discovery: {component: 'evcc-loadpoint', map: evccLoadpointDiscoveryMap},
            attributes: [
                ...evccLoadpointAttributes,
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Availability topic (evcc `<root>/status`).'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-loadpoint-accent', type: 'color', default: 'var(--accent-color)', help: 'Charging / active-mode accent.'},
                {property: '--feezal-loadpoint-text-color', type: 'color', default: 'var(--primary-text-color)', help: 'Text colour.'},
            ],
            defaultStyle: {width: '200px', height: '210px'},
            restrict: {minWidth: 150, minHeight: 160},
        };
    }

    static properties = {
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
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            padding: 10px 12px;
            gap: 4px;
            overflow: hidden;
            position: relative;
            container-type: inline-size;
            --feezal-loadpoint-accent: var(--accent-color);
            --feezal-loadpoint-text-color: var(--primary-text-color);
            color: var(--feezal-loadpoint-text-color);
        }
        .head { display: flex; align-items: center; gap: 6px; }
        feezal-icon { font-size: 24px; line-height: 1; color: var(--feezal-loadpoint-accent, #30d158); }
        .title { font-weight: 700; font-size: 14px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .status { font-size: 10px; font-weight: 600; opacity: 0.6; }
        .status.on { color: var(--feezal-loadpoint-accent, #30d158); opacity: 1; }
        .power { font-size: 26px; font-weight: 700; line-height: 1.05; font-variant-numeric: tabular-nums; }
        .socbar { position: relative; height: 8px; border-radius: 4px; background: color-mix(in srgb, currentColor 18%, transparent); overflow: hidden; margin-top: 2px; }
        .socbar .fill { position: absolute; inset: 0 auto 0 0; background: var(--feezal-loadpoint-accent, #30d158); border-radius: 4px; }
        .socbar .limit { position: absolute; top: -2px; bottom: -2px; width: 2px; background: var(--primary-text-color); opacity: 0.6; }
        .socline, .session { font-size: 11px; opacity: 0.7; }
        .modes { display: flex; gap: 3px; margin-top: auto; }
        .modes button {
            flex: 1; padding: 4px 0; font-size: 10px; font-weight: 600; cursor: pointer;
            border: 1px solid color-mix(in srgb, currentColor 25%, transparent); border-radius: 5px;
            background: transparent; color: inherit; min-width: 0;
        }
        .modes button.active { background: var(--feezal-loadpoint-accent, #30d158); border-color: var(--feezal-loadpoint-accent, #30d158); color: #fff; }
        .unavail { position: absolute; top: 6px; right: 8px; font-size: 14px; color: var(--error-color); opacity: 0.85; }
    `];

    constructor() {
        super();
        this.heating = false;
        this.label = '';
        for (const a of ['subscribeMode', 'subscribeChargePower', 'subscribeSessionEnergy', 'subscribeConnected',
            'subscribeCharging', 'subscribeEnabled', 'subscribeVehicleTitle', 'subscribeVehicleSoc', 'subscribeVehicleRange',
            'subscribeLimitSoc', 'subscribeMinCurrent', 'subscribeMaxCurrent', 'subscribePhases',
            'publishMode', 'publishLimitSoc', 'publishMinCurrent', 'publishMaxCurrent', 'publishPhases', 'discoveryId']) this[a] = '';
        this.loadpoint = new EvccLoadpointController(this);
    }

    _subscribe() { /* device card manages its own subscriptions */ }

    updated(changed) {
        super.updated(changed);
        this.loadpoint.rewireIfChanged();
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
        `;
    }
}

customElements.define('feezal-element-circle-loadpoint', FeezalElementCircleLoadpoint);
export {FeezalElementCircleLoadpoint};

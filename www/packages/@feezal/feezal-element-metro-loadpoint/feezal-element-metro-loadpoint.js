/* global feezal */
import {html, css} from '@feezal/feezal-element';
import {MetroTileBase} from '@feezal/feezal-element-metro-tile';
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
 * feezal-element-metro-loadpoint (E109)
 *
 * Metro live-tile view over the shared EvccLoadpointController. The front
 * carries the primary control — charge mode (Off / Solar / Min+Solar / Fast)
 * flat segments — plus the status line, big charge-power value and vehicle
 * SoC / limit line. A heating loadpoint (`heating`) shows a reduced, °C view
 * (vehicle SoC → current temperature, limit SoC → target). The back holds the
 * detail: session energy, vehicle title + range, min/max current and phases.
 * Same controller (and MQTT contract) as the glass / circle loadpoint cards.
 */
class FeezalElementMetroLoadpoint extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Loadpoint', category: 'Metro', color: '#1ba1e2', icon: 'ev_station'},
            description: 'Metro evcc loadpoint tile: charge-mode segments + power + vehicle SoC/limit on the front, ' +
                'session / vehicle / current detail on the back. Heat-pump loadpoints get a reduced °C view. ' +
                'Auto-wired by evcc discovery. Same controller as the glass/circle loadpoint cards.',
            // E137: the discovery map is the controller package's fragment.
            discovery: {component: 'evcc-loadpoint', map: evccLoadpointDiscoveryMap},
            attributes: [
                ...MetroTileBase.tileAttributes,
                // E137: the shared evcc loadpoint contract — declared ONCE by the
                // controller. `label` is dropped: MetroTileBase already owns it.
                ...evccLoadpointAttributes.filter(a => a.name !== 'label'),
                {name: 'subscribe-availability', type: 'mqttTopic', section: 'Availability', help: 'Availability topic (evcc `<root>/status`) — a ! badge appears while unavailable.'},
                {name: 'payload-available',   type: 'string', default: 'online',  section: 'Availability', help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', section: 'Availability', help: 'Payload meaning unavailable.'},
            ],
            styles: MetroTileBase.tileStyles,
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
        };
    }

    static properties = {
        heating:                {type: Boolean, reflect: true},
        subscribeMode:          {type: String, reflect: true, attribute: 'subscribe-mode'},
        subscribeChargePower:   {type: String, reflect: true, attribute: 'subscribe-charge-power'},
        subscribeSessionEnergy: {type: String, reflect: true, attribute: 'subscribe-session-energy'},
        subscribeConnected:     {type: String, reflect: true, attribute: 'subscribe-connected'},
        subscribeCharging:      {type: String, reflect: true, attribute: 'subscribe-charging'},
        subscribeEnabled:       {type: String, reflect: true, attribute: 'subscribe-enabled'},
        subscribeVehicleTitle:  {type: String, reflect: true, attribute: 'subscribe-vehicle-title'},
        subscribeVehicleSoc:    {type: String, reflect: true, attribute: 'subscribe-vehicle-soc'},
        subscribeVehicleRange:  {type: String, reflect: true, attribute: 'subscribe-vehicle-range'},
        subscribeLimitSoc:      {type: String, reflect: true, attribute: 'subscribe-limit-soc'},
        subscribeMinCurrent:    {type: String, reflect: true, attribute: 'subscribe-min-current'},
        subscribeMaxCurrent:    {type: String, reflect: true, attribute: 'subscribe-max-current'},
        subscribePhases:        {type: String, reflect: true, attribute: 'subscribe-phases'},
        publishMode:            {type: String, reflect: true, attribute: 'publish-mode'},
        publishLimitSoc:        {type: String, reflect: true, attribute: 'publish-limit-soc'},
        publishMinCurrent:      {type: String, reflect: true, attribute: 'publish-min-current'},
        publishMaxCurrent:      {type: String, reflect: true, attribute: 'publish-max-current'},
        publishPhases:          {type: String, reflect: true, attribute: 'publish-phases'},
        discoveryId:            {type: String, reflect: true, attribute: 'discovery-id'},
    };

    static styles = [MetroTileBase.styles, css`
        .center { gap: 4px; padding: 0 8px; }
        .status { font-size: var(--_metro-unit-size); font-weight: 600; opacity: 0.85; text-transform: lowercase; }
        .power { font-size: min(var(--_metro-value-size), 30cqh); font-weight: 300; line-height: 1; font-variant-numeric: tabular-nums; }
        .socline { font-size: var(--_metro-unit-size); opacity: 0.85; max-width: 96%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .modes { display: flex; gap: 3px; width: 100%; margin-top: 4px; }
        .modes .mbtn { flex: 1; min-width: 0; min-height: 28px; padding: 4px 2px; font-size: calc(var(--_metro-unit-size) * 0.85); }
        .detail { display: flex; flex-direction: column; gap: 4px; }
        .detail .row { display: flex; justify-content: space-between; gap: 10px; }
        .detail .k { opacity: 0.7; }
        .placeholder { text-align: center; opacity: 0.7; }
    `];

    constructor() {
        super();
        this.heating = false;
        for (const a of ['subscribeMode', 'subscribeChargePower', 'subscribeSessionEnergy', 'subscribeConnected',
            'subscribeCharging', 'subscribeEnabled', 'subscribeVehicleTitle', 'subscribeVehicleSoc', 'subscribeVehicleRange',
            'subscribeLimitSoc', 'subscribeMinCurrent', 'subscribeMaxCurrent', 'subscribePhases',
            'publishMode', 'publishLimitSoc', 'publishMinCurrent', 'publishMaxCurrent', 'publishPhases', 'discoveryId']) this[a] = '';
        // E137: the behavior layer — wires/parses/publishes; this view renders.
        this.loadpoint = new EvccLoadpointController(this);
    }

    updated(changed) {
        super.updated(changed);
        this.loadpoint.rewireIfChanged();
    }

    renderBadge() {
        return this._available ? '' : '!';
    }

    renderFront() {
        const c = this.loadpoint;
        const heating = c.heating;
        const bigValue = heating
            ? (c.vehicleSoc != null ? `${Math.round(c.vehicleSoc)} °C` : (feezal.isEditor ? '52 °C' : '–'))
            : fmtPower(c.chargePower ?? (feezal.isEditor ? 3600 : null));
        let socLine = '';
        if (heating) {
            if (c.limitSoc != null) socLine = `target ${Math.round(c.limitSoc)} °C`;
        } else if (c.vehicleSoc != null) {
            socLine = `${Math.round(c.vehicleSoc)}%${c.limitSoc != null ? ` → ${Math.round(c.limitSoc)}%` : ''}`;
        }
        return html`
            <div class="status">${c.statusText}</div>
            <div class="power">${bigValue}</div>
            ${socLine ? html`<div class="socline">${socLine}</div>` : ''}
            <div class="modes">
                ${EVCC_MODES.map(m => html`
                    <button class="mbtn ${c.mode === m.value ? 'active' : ''}"
                        @click="${() => c.setMode(m.value)}">${m.label}</button>`)}
            </div>`;
    }

    renderBack() {
        const c = this.loadpoint;
        const heating = c.heating;
        const rows = [];
        if (c.sessionEnergy != null) {
            rows.push(html`<div class="row"><span class="k">session</span><span>${fmtEnergy(c.sessionEnergy)}</span></div>`);
        }
        if (!heating && c.vehicleTitle) {
            rows.push(html`<div class="row"><span class="k">vehicle</span><span>${c.vehicleTitle}</span></div>`);
        }
        if (!heating && c.vehicleRange != null) {
            rows.push(html`<div class="row"><span class="k">range</span><span>${Math.round(c.vehicleRange)} km</span></div>`);
        }
        if (c.minCurrent != null || c.maxCurrent != null) {
            const lo = c.minCurrent != null ? `${c.minCurrent}` : '–';
            const hi = c.maxCurrent != null ? `${c.maxCurrent}` : '–';
            rows.push(html`<div class="row"><span class="k">current</span><span>${lo}–${hi} A</span></div>`);
        }
        if (c.phases != null) {
            rows.push(html`<div class="row"><span class="k">phases</span><span>${c.phases}</span></div>`);
        }
        return html`
            <div class="detail">
                ${rows.length ? rows : html`<div class="placeholder">details</div>`}
            </div>`;
    }
}

customElements.define('feezal-element-metro-loadpoint', FeezalElementMetroLoadpoint);
export {FeezalElementMetroLoadpoint};

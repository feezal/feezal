/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';
import {decodeHmFault, hmipFlagText, HM_HEALTH_DATAPOINTS, HMIP_FAULT_FLAGS} from '@feezal/feezal-element/feezal-hm-fault.js';

/**
 * feezal-element-basic-device-health (E135)
 *
 * The wall-panel "is everything okay?" board. Aggregates Homematic maintenance
 * signals — faults (`FAULT_REPORTING`/`ERROR`, incl. HmIP `ERROR_*` flags),
 * sabotage (`SABOTAGE`/`SABOTAGE_STICKY`, and classic `ERROR == 7`), low battery
 * (`LOWBAT`/`LOW_BAT`) and unreachable (`UNREACH`) — via WILDCARD subscriptions
 * (`<prefix>/status/+/<DP>`), so it runs **discovery-less** with the device name
 * taken from the topic segment. Sabotage is alarm-grade (error colour); faults
 * are the warning tier; battery/unreach are muted.
 */

// Severity → sort weight + colour var (higher = worse, shown first).
const SEV = {sabotage: 3, fault: 2, battery: 1, unreach: 0};

class FeezalElementBasicDeviceHealth extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Device Health', category: 'Basic', color: '#4a6080', icon: 'health_and_safety'},
            description: 'Homematic device-health board: faults, sabotage, low battery and unreachable devices in one list. ' +
                'Discovery-less — subscribes to the maintenance datapoints by wildcard.',
            attributes: [
                {name: 'prefix', type: 'string', default: 'hm', help: 'Homematic MQTT bridge prefix (hm2mqtt / RedMatic).'},
                {name: 'title', type: 'string', default: 'Device Health', help: 'Board heading.'},
                {name: 'message-property', type: 'string', default: 'payload.val', help: 'Path to the value within the JSON-Extended payload. Default payload.val (mqtt-smarthome).'},
                {name: 'show-battery', type: 'boolean', default: true, help: 'Include low-battery warnings.'},
                {name: 'show-unreach', type: 'boolean', default: true, help: 'Include unreachable devices.'},
                {name: 'show-ok', type: 'boolean', default: true, help: 'Show an "all OK" state when nothing is wrong (else the board is empty).'},
            ],
            styles: ['top', 'left', 'width', 'height',
                {property: '--feezal-health-sabotage-color', type: 'color', default: 'var(--error-color, #d32f2f)', help: 'Sabotage (alarm) colour.'},
                {property: '--feezal-health-fault-color', type: 'color', default: 'var(--warning-color, #f0a30a)', help: 'Fault (warning) colour.'},
                {property: '--feezal-health-muted-color', type: 'color', default: 'var(--secondary-text-color, #666)', help: 'Battery / unreachable colour.'},
            ],
            defaultStyle: {width: '260px', height: '200px'},
        };
    }

    static properties = {
        prefix:      {type: String, reflect: true},
        title:       {type: String, reflect: true},
        showBattery: {type: Boolean, reflect: true, attribute: 'show-battery', converter: feezalBoolean},
        showUnreach: {type: Boolean, reflect: true, attribute: 'show-unreach', converter: feezalBoolean},
        showOk:      {type: Boolean, reflect: true, attribute: 'show-ok', converter: feezalBoolean},
        _issues:     {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host { display: block; box-sizing: border-box; }
        .board {
            width: 100%; height: 100%; box-sizing: border-box; padding: 10px 12px;
            background: var(--secondary-background-color, #f5f5f5); border-radius: 8px;
            display: flex; flex-direction: column; gap: 6px; overflow: hidden;
            color: var(--primary-text-color, #222);
        }
        .head { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 14px; }
        .head .material-icons { font-size: 18px; }
        .list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; }
        .row { display: flex; align-items: center; gap: 6px; font-size: 12px; line-height: 1.3; }
        .row .material-icons { font-size: 15px; }
        .row .dev { font-weight: 600; }
        .row .issue { opacity: 0.85; }
        .row.sabotage { color: var(--feezal-health-sabotage-color, #d32f2f); font-weight: 700; }
        .row.fault    { color: var(--feezal-health-fault-color, #f0a30a); }
        .row.battery, .row.unreach { color: var(--feezal-health-muted-color, #666); }
        .ok { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #2e7d32; opacity: 0.9; }
        .ok .material-icons { font-size: 18px; }
    `];

    constructor() {
        super();
        this.prefix = 'hm';
        this.title = 'Device Health';
        // mqtt-smarthome / RedMatic publish JSON-Extended {val,ts}; read .val.
        this.messageProperty = 'payload.val';
        this.showBattery = true;
        this.showUnreach = true;
        this.showOk = true;
        this._issues = new Map();   // deviceKey → {device, type, text, severity}
    }

    _subscribe() { /* wildcard board manages its own subscriptions */ }

    connectedCallback() {
        super.connectedCallback();
        if (feezal.isEditor) return;
        const p = (this.prefix || 'hm').replace(/\/+$/, '');
        const dps = [
            ...HM_HEALTH_DATAPOINTS.fault,
            ...HM_HEALTH_DATAPOINTS.sabotage,
            ...HM_HEALTH_DATAPOINTS.battery,
            ...HM_HEALTH_DATAPOINTS.unreach,
            ...HM_HEALTH_DATAPOINTS.hmipFlags,
        ];
        for (const dp of dps) {
            this.addSubscription(`${p}/status/+/${dp}`, msg => this._ingest(msg, dp));
        }
    }

    /** Device display name from the topic segment (drops a trailing channel :N). */
    _deviceName(topic) {
        const parts = topic.split('/');
        const seg = parts[parts.length - 2] || '';   // …/status/<seg>/<DP>
        return seg.replace(/:\d+$/, '');
    }

    _ingest(msg, dp) {
        const value = this.getProperty(msg, this.messageProperty || 'payload.val');
        const device = this._deviceName(msg.topic);
        if (!device) return;
        const key = `${device}|${dp}`;
        const issue = this._classify(dp, value, device);
        if (issue) this._issues.set(key, issue);
        else this._issues.delete(key);
        this._issues = new Map(this._issues);   // trigger update
    }

    _classify(dp, value, device) {
        const truthy = value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
        const num = Number(value);
        // Sabotage (alarm) — HmIP bool, or classic ERROR == 7.
        if ((dp === 'SABOTAGE' || dp === 'SABOTAGE_STICKY') && truthy) return {device, type: 'sabotage', text: 'Sabotage', severity: SEV.sabotage};
        if (dp === 'ERROR' && num === 7) return {device, type: 'sabotage', text: 'Sabotage', severity: SEV.sabotage};
        // HmIP named fault flags — the flag name is the message.
        if (dp in HMIP_FAULT_FLAGS && truthy) return {device, type: 'fault', text: hmipFlagText(dp), severity: SEV.fault};
        // Classic fault enums — FAULT_REPORTING is TRV-only (decode via its table).
        if (dp === 'FAULT_REPORTING') { const t = decodeHmFault('HM-CC-RT-DN', value); return t ? {device, type: 'fault', text: t, severity: SEV.fault} : null; }
        if (dp === 'ERROR') { return num && num !== 0 ? {device, type: 'fault', text: `Fault ${num}`, severity: SEV.fault} : null; }
        // Battery / unreachable.
        if ((dp === 'LOWBAT' || dp === 'LOW_BAT')) return this.showBattery && truthy ? {device, type: 'battery', text: 'Battery low', severity: SEV.battery} : null;
        if (dp === 'UNREACH') return this.showUnreach && truthy ? {device, type: 'unreach', text: 'Unreachable', severity: SEV.unreach} : null;
        return null;
    }

    _icon(type) {
        return {sabotage: 'gpp_bad', fault: 'warning', battery: 'battery_alert', unreach: 'wifi_off'}[type] || 'error';
    }

    render() {
        const issues = [...this._issues.values()].sort((a, b) => b.severity - a.severity || a.device.localeCompare(b.device));
        const sample = feezal.isEditor
            ? [{device: 'Haustür', type: 'sabotage', text: 'Sabotage', severity: 3},
                {device: 'Heizung Bad', type: 'fault', text: 'Communication error', severity: 2},
                {device: 'Fenster Küche', type: 'battery', text: 'Battery low', severity: 1}]
            : issues;
        return html`
            <div class="board">
                <div class="head"><span class="material-icons">health_and_safety</span> ${this.title || 'Device Health'}</div>
                ${sample.length ? html`
                    <div class="list">
                        ${sample.map(i => html`
                            <div class="row ${i.type}">
                                <span class="material-icons">${this._icon(i.type)}</span>
                                <span class="dev">${i.device}</span><span class="issue">· ${i.text}</span>
                            </div>`)}
                    </div>`
                    : this.showOk ? html`<div class="ok"><span class="material-icons">check_circle</span> All devices OK</div>` : ''}
            </div>
        `;
    }
}

customElements.define('feezal-element-basic-device-health', FeezalElementBasicDeviceHealth);
export {FeezalElementBasicDeviceHealth};

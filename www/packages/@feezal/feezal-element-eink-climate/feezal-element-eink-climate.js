/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {EinkBase, einkCardStyles} from '@feezal/feezal-eink';
// E137: the thermostat behavior lives in the shared controller — this element
// is a VIEW (eink chrome: big actual, setpoint line, +/- tap targets).
import {ClimateController, climateAttributes, climateDiscoveryMap} from '@feezal/feezal-controller-climate';

/**
 * feezal-element-eink-climate (E57)
 *
 * E-ink thermostat card: oversized actual temperature, "→ setpoint • mode"
 * line, giant +/− tap targets (full-height halves at the card edges), mode
 * words as flat inverted-when-active blocks. Full shared climate contract
 * (both payload modes, E102 mode machinery, B53 off sentinel, boost badge,
 * E124 battery) via ClimateController.
 */

class FeezalElementEinkClimate extends EinkBase {
    static get feezal() {
        return {
            palette: {name: 'Climate', category: 'Eink', color: '#222222', icon: 'thermostat'},
            description: 'E-ink thermostat card — oversized actual, setpoint steppers, mode row, 1-bit.',
            // E137: the discovery map is the controller package's fragment.
            discovery: {component: 'climate', map: climateDiscoveryMap},
            attributes: [
                // E137: the shared climate contract — declared ONCE.
                ...climateAttributes,
                {name: 'label', type: 'string', help: 'Label line (rendered uppercase).'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability — a ! badge appears while unavailable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-eink-font-size-value', default: '34px', help: 'Actual temperature font size.'},
                {property: '--feezal-eink-font-size-label', default: '13px', help: 'Label/mode font size.'},
                {property: '--feezal-eink-rule', default: '3px', help: 'Rule/border thickness (≥2px).'},
            ],
            defaultStyle: {width: '200px', height: '150px'},
            restrict: {minWidth: 120, minHeight: 90},
        };
    }

    static properties = {
        payloadMode:       {type: String, reflect: true, attribute: 'payload-mode'},
        publish:           {type: String, reflect: true},
        jsonMap:           {type: String, reflect: true, attribute: 'json-map'},
        subscribeSetpoint: {type: String, reflect: true, attribute: 'subscribe-setpoint'},
        msgPropSetpoint:   {type: String, reflect: true, attribute: 'message-property-setpoint'},
        publishSetpoint:   {type: String, reflect: true, attribute: 'publish-setpoint'},
        subscribeActual:   {type: String, reflect: true, attribute: 'subscribe-actual'},
        msgPropActual:     {type: String, reflect: true, attribute: 'message-property-actual'},
        subscribeMode:     {type: String, reflect: true, attribute: 'subscribe-mode'},
        msgPropMode:       {type: String, reflect: true, attribute: 'message-property-mode'},
        publishMode:       {type: String, reflect: true, attribute: 'publish-mode'},
        subscribeValve:    {type: String, reflect: true, attribute: 'subscribe-valve'},
        msgPropValve:      {type: String, reflect: true, attribute: 'message-property-valve'},
        valveMin:          {type: Number, reflect: true, attribute: 'valve-min'},
        valveMax:          {type: Number, reflect: true, attribute: 'valve-max'},
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
        min:  {type: Number, reflect: true},
        max:  {type: Number, reflect: true},
        step: {type: Number, reflect: true},
        unit: {type: String, reflect: true},
        modes: {type: String, reflect: true},
        label: {type: String, reflect: true},
        discoveryId: {type: String, reflect: true, attribute: 'discovery-id'},
    };

    static styles = [feezalBaseStyles, einkCardStyles, css`
        .card { gap: 3px; }
        .row { display: flex; align-items: center; gap: 8px; }
        .actual { flex: 1; text-align: center; }
        .stepbtn {
            flex: 0 0 auto; min-width: 40px; min-height: 44px;
            border: var(--feezal-eink-rule, 3px) solid currentColor; background: none;
            color: inherit; font: inherit; font-size: 26px; line-height: 1; cursor: pointer;
            border-radius: var(--feezal-eink-radius, 0px);
        }
        .sp {
            font-size: var(--feezal-eink-font-size-label, 13px); text-align: center;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .modes { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
        .modes button {
            border: var(--feezal-eink-rule, 3px) solid var(--_fg); background: var(--_bg);
            color: var(--_fg); font: inherit;
            font-size: var(--feezal-eink-font-size-label, 13px);
            text-transform: uppercase; padding: 3px 8px; cursor: pointer;
            border-radius: var(--feezal-eink-radius, 0px);
        }
        .modes button.active { background: var(--_fg); color: var(--_bg); }
        .valve { font-size: var(--feezal-eink-font-size-label, 13px); text-align: center; }
    `];

    constructor() {
        super();
        this.payloadMode = 'separate';
        this.publish = '';
        this.jsonMap = '';
        this.subscribeSetpoint = '';
        this.msgPropSetpoint = '';
        this.publishSetpoint = '';
        this.subscribeActual = '';
        this.msgPropActual = '';
        this.subscribeMode = '';
        this.msgPropMode = '';
        this.publishMode = '';
        this.subscribeValve = '';
        this.msgPropValve = '';
        this.valveMin = 0;
        this.valveMax = 100;
        this.boostDuration = 5;
        this.subscribeBoostRemaining = '';
        this.msgPropBoostRemaining = '';
        this.boostRemainingUnit = 'minutes';
        this.subscribeBoostState = '';
        this.msgPropBoostState = '';
        this.subscribeBatteryLow = '';
        this.msgPropBatteryLow = '';
        this.payloadBatteryLow = 'true';
        this.batteryLowThreshold = 15;
        this.min = 5;
        this.max = 30;
        this.step = 0.5;
        this.unit = '°C';
        this.modes = '';
        this.label = '';
        this.discoveryId = '';
        // E137: the behavior layer — wires/parses/publishes; this view renders.
        this.climate = new ClimateController(this);
    }

    // Device cards manage subscriptions via the controller.
    _subscribe() { /* intentionally empty */ }

    updated(changed) {
        super.updated(changed);
        this.climate.rewireIfChanged();
    }

    _stepSetpoint(direction) {
        if (feezal.isEditor) return;
        const step = Number(this.step) || 0.5;
        const current = this.climate.setpoint ?? (this.min + this.max) / 2;
        this.climate.setSetpoint(current + direction * step);
    }

    _fmt(v) {
        return v === null || v === undefined ? '—' : `${v}${this.unit}`;
    }

    /** E57 redraw dedup: everything visibly rendered, values as shown. */
    renderSignature() {
        const c = this.climate;
        const active = c.activeModeEntry();
        return [this._fmt(c.actual), this._fmt(c.setpoint), c.mode,
            active ? active.label : '', c.valve === null ? '' : Math.round(c.valve),
            c.boostBadge(), c.batteryLow, this._available].join('|');
    }

    render() {
        const c = this.climate;
        const actual = c.actual ?? (feezal.isEditor && !this.subscribeActual && !this.subscribe ? 21.5 : null);
        const modes = c.parsedModes();
        const active = c.activeModeEntry(modes);
        // B53: off sentinel → mode label instead of the 4.5° target.
        const offEntry = c.offSentinelEntry();
        return html`
            <div class="card">
                ${!this._available ? html`<span class="badge-tr" title="Device unavailable">!</span>` : ''}
                ${c.batteryLow ? html`<feezal-icon class="badge-tl" name="battery_alert" title="Battery low"></feezal-icon>` : ''}
                <div class="row">
                    <button class="stepbtn" @click="${() => this._stepSetpoint(-1)}">−</button>
                    <span class="value actual">${this._fmt(actual)}</span>
                    <button class="stepbtn" @click="${() => this._stepSetpoint(1)}">+</button>
                </div>
                <div class="sp">${offEntry
                    ? offEntry.label
                    : html`→ ${this._fmt(c.setpoint)}${active ? ` • ${active.label}` : ''}`}</div>
                ${modes.length > 0 ? html`
                    <div class="modes">
                        ${modes.map(m => {
                            const boostActive = c.momentaryEntryActive(m);
                            const badge = boostActive ? c.boostBadge() : '';
                            return html`<button class="${boostActive || m === active ? 'active' : ''}"
                                @click="${() => c.setMode(m)}">${m.label ?? m.value}${badge ? ` ${badge}` : ''}</button>`;
                        })}
                    </div>` : ''}
                ${c.valve !== null ? html`<div class="rule valve">VALVE ${Math.round(c.valve)} %</div>` : ''}
                ${this.label ? html`<span class="label">${this.label}</span>` : ''}
            </div>
        `;
    }
}

customElements.define('feezal-element-eink-climate', FeezalElementEinkClimate);
export {FeezalElementEinkClimate};

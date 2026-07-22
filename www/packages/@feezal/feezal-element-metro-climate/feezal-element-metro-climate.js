/* global feezal */
import {html, css} from '@feezal/feezal-element';
import {MetroTileBase} from '@feezal/feezal-element-metro-tile';
// E137: the thermostat behavior lives in the shared controller — this element
// is a VIEW (Metro tile chrome: temperature front, stepper + chips back).
import {ClimateController, climateAttributes, climateDiscoveryMap} from '@feezal/feezal-controller-climate';

/**
 * feezal-element-metro-climate (E55)
 *
 * Thermostat tile: front shows the current temperature (+ small setpoint);
 * the back holds a setpoint stepper and, when configured, mode chips.
 *
 * E137: metro consumes the shared climate contract with family flags —
 * {json: false} (no json payload mode → the json-only attributes are
 * omitted) and {actualFromSubscribe: true} (`subscribe` is the current
 * temperature topic, the metro convention; `subscribe-actual` also works).
 */

// E137: metro attributes the shared fragment must not carry (json mode is
// unsupported; `subscribe`/`message-property` keep their metro meaning).
const METRO_OMIT = ['payload-mode', 'subscribe', 'publish', 'json-map', 'message-property'];

// U39 inspector grouping — presentation metadata merged onto the shared
// contract by attribute name (the contract itself stays single-source).
const METRO_UI = {
    'subscribe-setpoint':          {section: 'Connection'},
    'message-property-setpoint':   {section: 'Connection', advanced: true},
    'publish-setpoint':            {section: 'Connection', help: 'Setpoint command topic (enables the back stepper).'},
    'subscribe-actual':            {section: 'Connection', advanced: true, help: 'Optional dedicated actual-temperature topic (metro reads `subscribe` by default).'},
    'message-property-actual':     {section: 'Connection', advanced: true},
    'subscribe-mode':              {section: 'Connection'},
    'message-property-mode':       {section: 'Connection', advanced: true},
    'publish-mode':                {section: 'Connection', help: 'Mode command topic (enables the back mode chips).'},
    'subscribe-valve':             {section: 'Valve'},
    'message-property-valve':      {section: 'Valve', advanced: true},
    'valve-min':                   {section: 'Valve'},
    'valve-max':                   {section: 'Valve'},
    step: {section: 'Setpoint'},
    min:  {section: 'Setpoint'},
    max:  {section: 'Setpoint'},
    unit: {section: 'Setpoint'},
    modes: {section: 'Display', type: 'objectList', itemFields: [{key: '', placeholder: 'heat'}], default: '[]'},
    'boost-duration':                  {section: 'Display'},
    'subscribe-boost-remaining':       {section: 'Display'},
    'message-property-boost-remaining': {section: 'Display', advanced: true},
    'boost-remaining-unit':            {section: 'Display'},
    'subscribe-boost-state':           {section: 'Display'},
    'message-property-boost-state':    {section: 'Display', advanced: true},
    'subscribe-battery-low':           {section: 'Battery'},
    'message-property-battery-low':    {section: 'Battery', advanced: true},
    'payload-battery-low':             {section: 'Battery'},
    'battery-low-threshold':           {section: 'Battery'},
};

class FeezalElementMetroClimate extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Climate', category: 'Metro', color: '#1ba1e2', icon: 'thermostat'},
            description: 'Metro thermostat tile: current temperature on the front, setpoint stepper + mode chips on the back.',
            attributes: [
                ...MetroTileBase.tileAttributes,
                {name: 'subscribe', type: 'mqttTopic', section: 'Connection', help: 'Current temperature topic.'},
                {name: 'message-property', type: 'string', default: 'payload', section: 'Connection', advanced: true,
                    help: 'Dot-notation path within current-temperature messages. Default: payload'},
                // E137: the shared climate contract (setpoint/mode/valve/boost +
                // the E124 battery quartet) — declared ONCE by the controller
                // package; METRO_UI merges the inspector grouping per name.
                ...climateAttributes.filter(a => !METRO_OMIT.includes(a.name)).map(a => ({...a, ...METRO_UI[a.name]})),
            ],
            styles: MetroTileBase.tileStyles,
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
            // E137: the discovery map is the controller package's fragment.
            discovery: {component: 'climate', map: climateDiscoveryMap},
        };
    }

    static properties = {
        subSetpoint:     {type: String, reflect: true, attribute: 'subscribe-setpoint'},
        msgPropSetpoint: {type: String, reflect: true, attribute: 'message-property-setpoint'},
        pubSetpoint:     {type: String, reflect: true, attribute: 'publish-setpoint'},
        subActual:       {type: String, reflect: true, attribute: 'subscribe-actual'},
        msgPropActual:   {type: String, reflect: true, attribute: 'message-property-actual'},
        step: {type: Number, reflect: true},
        min:  {type: Number, reflect: true},
        max:  {type: Number, reflect: true},
        unit: {type: String, reflect: true},
        subMode:     {type: String, reflect: true, attribute: 'subscribe-mode'},
        msgPropMode: {type: String, reflect: true, attribute: 'message-property-mode'},
        pubMode:     {type: String, reflect: true, attribute: 'publish-mode'},
        modes:       {type: String, reflect: true},
        subValve:     {type: String, reflect: true, attribute: 'subscribe-valve'},
        msgPropValve: {type: String, reflect: true, attribute: 'message-property-valve'},
        valveMin:     {type: Number, reflect: true, attribute: 'valve-min'},
        valveMax:     {type: Number, reflect: true, attribute: 'valve-max'},
        boostDuration:        {type: Number, reflect: true, attribute: 'boost-duration'},
        subBoostRemaining:    {type: String, reflect: true, attribute: 'subscribe-boost-remaining'},
        msgPropBoostRemaining: {type: String, reflect: true, attribute: 'message-property-boost-remaining'},
        boostRemainingUnit:   {type: String, reflect: true, attribute: 'boost-remaining-unit'},
        subBoostState:        {type: String, reflect: true, attribute: 'subscribe-boost-state'},
        msgPropBoostState:    {type: String, reflect: true, attribute: 'message-property-boost-state'},
        // E124 — dedicated low-battery warning
        subscribeBatteryLow: {type: String, reflect: true, attribute: 'subscribe-battery-low'},
        msgPropBatteryLow:   {type: String, reflect: true, attribute: 'message-property-battery-low'},
        payloadBatteryLow:   {type: String, reflect: true, attribute: 'payload-battery-low'},
        batteryLowThreshold: {type: Number, reflect: true, attribute: 'battery-low-threshold'},
        // E137: climate state lives on the ClimateController (plain fields +
        // host.requestUpdate) — no reactive state properties needed.
    };

    static styles = [MetroTileBase.styles, css`
        .current { font-size: min(var(--_metro-value-size), 30cqh); font-weight: 300; line-height: 1; }   /* E129 */
        .setpoint { font-size: var(--_metro-unit-size); opacity: 0.85; }   /* E129 */
        /* E136: WP7-volume-style stepper — giant flat +/− halves with the
           setpoint in the E129 display type between them, edge to edge. */
        .stepper { display: flex; align-items: stretch; justify-content: center; gap: 8px; width: 100%; }
        .stepper .mbtn { flex: 1 1 0; min-height: 48px; font-size: 24px; font-weight: 300; line-height: 1; }
        .stepper .val {
            font-size: min(var(--_metro-value-size), 22cqh);
            font-weight: 300; min-width: 4ch; text-align: center; align-self: center;
        }
        /* E136: mode chips become full-width flat segments sharing the row. */
        .chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; width: 100%; }
        .chips .mbtn { flex: 1 1 auto; min-height: 36px; padding: 4px 10px; font-size: var(--_metro-unit-size); }
        /* E102 WP2: mm:ss boost countdown badge on the active momentary chip. */
        .chips .mbtn .boost-badge {
            display: inline-block; margin-left: 4px;
            font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums;
        }
        /* E102: flat Metro valve readout on the flip-face (bar + %). */
        .valve { display: flex; align-items: center; gap: 6px; font-size: 11px; }
        .valve-track {
            flex: 1; height: 4px;
            background: color-mix(in srgb, var(--feezal-metro-text, #fff) 30%, transparent);
        }
        .valve-fill { height: 100%; background: var(--feezal-metro-text, #fff); }
        .valve-pct { min-width: 3.5ch; text-align: right; font-variant-numeric: tabular-nums; }
        /* E124: low-battery warning, top-left (the ! badge owns top-right). */
        .batt {
            position: absolute; top: 4px; left: 6px;
            font-size: 15px; color: var(--feezal-metro-text, #fff); opacity: 0.9;
        }
    `];

    constructor() {
        super();
        this.subSetpoint = '';
        this.msgPropSetpoint = '';
        this.pubSetpoint = '';
        this.subActual = '';
        this.msgPropActual = '';
        this.step = 0.5;
        this.min = 5;
        this.max = 30;
        this.unit = '°C';
        this.subMode = '';
        this.msgPropMode = '';
        this.pubMode = '';
        this.modes = '[]';
        this.subValve = '';
        this.msgPropValve = '';
        this.valveMin = 0;
        this.valveMax = 100;
        this.boostDuration = 5;
        this.subBoostRemaining = '';
        this.msgPropBoostRemaining = '';
        this.boostRemainingUnit = 'minutes';
        this.subBoostState = '';
        this.msgPropBoostState = '';
        this.subscribeBatteryLow = '';
        this.msgPropBatteryLow = '';
        this.payloadBatteryLow = 'true';
        this.batteryLowThreshold = 15;
        // E137: the behavior layer — wires/parses/publishes; this view renders.
        // Metro quirks as flags: no json payload mode; the actual temperature
        // is read from `subscribe` (and additionally `subscribe-actual`).
        this.climate = new ClimateController(this, {json: false, actualFromSubscribe: true});
    }

    // E137: the ClimateController wires everything in hostConnected and
    // clears the boost interval in hostDisconnected.

    updated(changed) {
        super.updated(changed);
        // Live-canvas topic edits re-wire through the controller.
        this.climate.rewireIfChanged();
    }

    _stepSetpoint(direction) {
        if (feezal.isEditor) return;
        const step = Number(this.step) || 0.5;
        const current = this.climate.setpoint ?? (this.min + this.max) / 2;
        this.climate.setSetpoint(current + direction * step);
    }

    renderFront() {
        const current = this.climate.actual ?? (feezal.isEditor && !this.subscribe ? 21.5 : null);
        // B53: off sentinel active → mode label ("Off") instead of the 4.5° target.
        const offEntry = this.climate.offSentinelEntry();
        return html`
            ${this.climate.batteryLow ? html`<feezal-icon class="batt" name="battery_alert" title="Battery low"></feezal-icon>` : ''}
            <div class="current">${current === null ? '—' : `${current}${this.unit}`}</div>
            ${offEntry ? html`<div class="setpoint">${offEntry.label}</div>`
                : (this.climate.setpoint !== null ? html`<div class="setpoint">→ ${this.climate.setpoint}${this.unit}</div>` : '')}`;
    }

    renderBack() {
        const modes = this.climate.parsedModes();
        const hasModes = modes.length > 0;
        const active = this.climate.activeModeEntry(modes);   // E102: match-setpoint-max-aware active chip
        // B53: off sentinel → mode label in the stepper readout; stepping still
        // publishes a new setpoint and thereby re-enters Manu (hm semantics).
        const offEntry = (active && active['match-setpoint-max'] !== null
            && active['match-setpoint-max'] !== undefined) ? active : null;
        return html`
            <div class="stepper">
                <button class="mbtn" @click="${() => this._stepSetpoint(-1)}">−</button>
                <span class="val">${offEntry ? offEntry.label
                    : (this.climate.setpoint === null ? '—' : `${this.climate.setpoint}${this.unit}`)}</span>
                <button class="mbtn" @click="${() => this._stepSetpoint(1)}">+</button>
            </div>
            ${hasModes ? html`
                <div class="chips">
                    ${modes.map(m => {
                        // B54: device-reported BOOST_MODE wins over the mode read-back.
                        const boostActive = this.climate.momentaryEntryActive(m);
                        const badge = boostActive ? this.climate.boostBadge() : '';
                        return html`
                            <button class="mbtn ${boostActive || m === active ? 'active' : ''}"
                                @click="${() => this.climate.setMode(m)}">${m.label ?? m.value}${badge ? html`<span class="boost-badge">${badge}</span>` : ''}</button>`;
                    })}
                </div>` : ''}
            ${this.climate.valve !== null ? html`
                <div class="valve">
                    <span>Valve</span>
                    <div class="valve-track"><div class="valve-fill" style="width:${this.climate.valve}%"></div></div>
                    <span class="valve-pct">${Math.round(this.climate.valve)}&nbsp;%</span>
                </div>` : ''}`;
    }
}

customElements.define('feezal-element-metro-climate', FeezalElementMetroClimate);
export {FeezalElementMetroClimate};

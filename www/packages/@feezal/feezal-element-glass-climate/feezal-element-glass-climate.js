/* global feezal */
import {feezalBaseStyles, html, css} from '@feezal/feezal-element';
// E137: the thermostat behavior lives in the shared controller — this element
// is a VIEW (glass chrome: frost card + Apple-Home details popup).
import {ClimateController, climateAttributes, climateDiscoveryMap} from '@feezal/feezal-controller-climate';
import {applySizePreset, glassCardStyles, glassPopupStyles, FeezalGlassCard} from '@feezal/feezal-glass';

/**
 * feezal-element-glass-climate (E58, renamed from glass-thermostat)
 *
 * Frosted-glass thermostat card: actual + set temperature and the heating
 * mode on the front; tap (or ⋯) opens the Apple-Home-style details popup —
 * a big vertical setpoint pill (drag like the glass-light brightness pill,
 * snapped to `step`, publish on release) with the mode buttons beneath it.
 *
 * MQTT capability contract mirrors feezal-element-material-climate for the
 * setpoint + actual + mode subset — SAME attribute names, both payload
 * modes (json = zigbee2mqtt TRVs with the same default key map, separate =
 * per-property topics), min/max/step/unit, the same `modes` format and HA
 * discovery descriptor. Valve/humidity extras stay material-climate's.
 *
 * Family conventions (frost vars, degrade, squircle): see glass-button.
 */

// U39 inspector structure — presentation metadata merged onto the shared
// E137 contract by attribute name (the contract itself stays single-source).
const JSON_ONLY = {visibleWhen: {attr: 'payload-mode', equals: 'json'}};
const SEP_ONLY  = {visibleWhen: {attr: 'payload-mode', equals: 'separate'}};
const GLASS_UI = {
    'payload-mode': {section: 'Connection'},
    subscribe:          {section: 'Connection', ...JSON_ONLY},
    publish:            {section: 'Connection', ...JSON_ONLY},
    'json-map':         {section: 'Connection', advanced: true, ...JSON_ONLY},
    'message-property': {section: 'Connection', advanced: true, ...JSON_ONLY},
    'subscribe-setpoint':        {section: 'Connection', ...SEP_ONLY},
    'message-property-setpoint': {section: 'Connection', advanced: true, ...SEP_ONLY},
    'publish-setpoint':          {section: 'Connection', ...SEP_ONLY},
    'subscribe-actual':          {section: 'Connection', ...SEP_ONLY},
    'message-property-actual':   {section: 'Connection', advanced: true, ...SEP_ONLY},
    'subscribe-mode':            {section: 'Connection', ...SEP_ONLY},
    'message-property-mode':     {section: 'Connection', advanced: true, ...SEP_ONLY},
    'publish-mode':              {section: 'Connection', ...SEP_ONLY},
    min: {section: 'Setpoint'}, max: {section: 'Setpoint'},
    step: {section: 'Setpoint'}, unit: {section: 'Setpoint'},
    'subscribe-valve':        {section: 'Valve'},
    'message-property-valve': {section: 'Valve', advanced: true},
    'valve-min': {section: 'Valve'}, 'valve-max': {section: 'Valve'},
    modes: {section: 'Display'},
    'boost-duration':                   {section: 'Display'},
    'subscribe-boost-remaining':        {section: 'Display'},
    'message-property-boost-remaining': {section: 'Display', advanced: true},
    'boost-remaining-unit':             {section: 'Display'},
    'subscribe-boost-state':            {section: 'Display'},
    'message-property-boost-state':     {section: 'Display', advanced: true},
    'subscribe-battery-low':        {section: 'Availability'},
    'message-property-battery-low': {section: 'Availability', advanced: true},
    'payload-battery-low':          {section: 'Availability'},
    'battery-low-threshold':        {section: 'Availability'},
};

const MODE_ICONS = {
    off: 'power_settings_new',
    heat: 'local_fire_department',
    cool: 'ac_unit',
    auto: 'auto_mode',
    dry: 'water_drop',
    fan_only: 'mode_fan',
};

class FeezalElementGlassClimate extends FeezalGlassCard {
    static get feezal() {
        return {
            palette: {name: 'Climate', category: 'Glass', color: '#7aa5c9', icon: 'thermostat'},
            description: 'Frosted-glass thermostat card — actual/set temperature and mode; tap opens the ' +
                'details popup with a vertical setpoint slider and mode buttons. Same wiring contract as ' +
                'the material thermostat card (setpoint/actual/mode subset).',
            // E137: the discovery map is the controller package's fragment.
            discovery: {component: 'climate', map: climateDiscoveryMap},
            // U39: section/visibleWhen/advanced structure the ~25-attribute
            // inspector — only the relevant payload-mode's topics show, and the
            // message-property-* twins tuck behind each section's Advanced group.
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x2', '2x1'], default: '', section: 'Layout',
                    help: 'Preset size: 2x2 = square (150×150), 2x1 = wide (150×75). Empty keeps the current/manual size.'},
                // E137: the shared climate contract (both payload modes,
                // setpoint/mode/valve/boost + the E124 battery quartet) —
                // declared ONCE by the controller package; GLASS_UI merges the
                // U39 inspector structure per name.
                ...climateAttributes.map(a => ({...a, ...GLASS_UI[a.name]})),
                {name: 'label', type: 'string', section: 'Display', help: 'Card label.'},
                {name: 'icon',  type: 'string', default: 'thermostat', section: 'Display', help: 'Icon name.'},
                {name: 'degrade', type: 'boolean', default: false, section: 'Display', advanced: true,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
                // ── Availability (collapsed by default) ──
                {name: 'subscribe-availability', type: 'mqttTopic', section: 'Availability', help: 'Optional availability topic — badge when unavailable, controls stay enabled.'},
                {name: 'payload-available',   type: 'string', default: 'online',  section: 'Availability', help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', section: 'Availability', help: 'Payload meaning unavailable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', section: 'Availability', advanced: true, help: 'Property path within availability messages. Defaults to message-property.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-accent', type: 'color', default: '#ff9f0a', help: 'Setpoint/heating accent colour.'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-icon-size', default: '28px', help: 'Icon font size.'},
                {property: '--feezal-glass-font-size-value', default: '26px', help: 'Actual temperature font size.'},
                {property: '--feezal-glass-font-size-state', default: '15px', help: 'State line font size.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Label font size.'},
                {property: '--feezal-glass-font-size-unit', default: '12px', help: 'Flip/detail button icon size.'},
            ],
            defaultStyle: {width: '172px', height: '128px'},
            restrict: {minWidth: 90, minHeight: 70},
        };
    }

    static properties = {
        size:             {type: String, reflect: true},
        payloadMode:      {type: String, reflect: true, attribute: 'payload-mode'},
        publish:          {type: String, reflect: true},
        jsonMap:          {type: String, reflect: true, attribute: 'json-map'},
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
        icon:  {type: String, reflect: true},
        // N31: availability inherited from FeezalElement.
        degrade:     {type: Boolean, reflect: true},
        discoveryId: {type: String,  reflect: true, attribute: 'discovery-id'},
        // E137: climate state lives on the ClimateController (plain fields +
        // host.requestUpdate) — only the drag preview stays element-local.
        _dragSp:    {state: true},   // live setpoint while dragging the pill
    };

    static styles = [feezalBaseStyles, glassCardStyles, glassPopupStyles, css`
        .card {
            cursor: pointer;
            gap: 2px;
            transition: transform 0.15s ease, background 0.2s ease;
            touch-action: manipulation;
        }
        .card:active { transform: scale(0.97); }
        .head { display: flex; align-items: baseline; gap: 6px; }
        feezal-icon { font-size: var(--feezal-glass-icon-size, 28px); line-height: 1; color: var(--feezal-glass-accent, #ff9f0a); }
        .actual { font-size: var(--feezal-glass-font-size-value, 26px); font-weight: 700; font-variant-numeric: tabular-nums; }
        .state {
            font-size: var(--feezal-glass-font-size-state, 15px); font-weight: 600;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
        }
        .state b { color: var(--feezal-glass-accent, #ff9f0a); }
        .label {
            font-size: var(--feezal-glass-font-size-label, 12px); font-weight: 600; line-height: 1.2;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .unavail {
            position: absolute; bottom: 8px; right: 10px;
            font-size: 12px; color: var(--error-color, #d32f2f); opacity: 0.85;
        }
        /* E124: low-battery warning, bottom-left (⚠ unavail owns bottom-right). */
        .batt {
            position: absolute; bottom: 8px; left: 10px;
            font-size: 14px; color: var(--warning-color, #ff9800); opacity: 0.9;
        }
        /* E105: much wider than tall → horizontal layout (Apple-Home wide
           tile): icon left, actual/state/label stacked right of it.
           display:contents dissolves .head so the icon and the actual
           temperature become grid items; flip-btn and unavail stay
           absolutely positioned in their corners. */
        @container (min-aspect-ratio: 2/1) {
            .card {
                display: grid;
                grid-template: 'icon actual' auto 'icon state' auto 'icon label' auto / auto 1fr;
                align-content: center;
                align-items: center;
                column-gap: 10px;
                text-align: left;
            }
            .head { display: contents; }
            .head feezal-icon { grid-area: icon; }
            .card .actual { grid-area: actual; }
            .card .state { grid-area: state; }
            .card .label { grid-area: label; }
        }

        /* ── details popup (glass-light pattern) ── */
        .vslider {
            position: relative; width: 72px; height: 170px; flex: 0 0 auto;
            border-radius: 20px; overflow: hidden; cursor: grab;
            background: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 12%, transparent);
            touch-action: none; user-select: none;
        }
        .vslider .fill {
            position: absolute; left: 0; right: 0; bottom: 0;
            background: color-mix(in srgb, var(--feezal-glass-accent, #ff9f0a) 55%, #fff);
        }
        .vslider .sp {
            position: absolute; left: 0; right: 0; bottom: 10px; text-align: center;
            font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums;
            pointer-events: none;
        }
        .vslider .cur {
            position: absolute; left: 0; right: 0; top: 12px; text-align: center;
            font-size: 11px; font-weight: 600; opacity: 0.65; pointer-events: none;
        }
        /* E102: subtle valve-opening mark on the setpoint pill (a thin line at
           the valve % height) — the glass analogue of material-climate's inner
           valve arc. */
        .vslider .valve-mark {
            position: absolute; left: 0; right: 0; height: 2px;
            background: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 45%, transparent);
            pointer-events: none;
        }
        .valve-line {
            font-size: 12px; font-weight: 600; text-align: center;
            font-variant-numeric: tabular-nums;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
        }
        .modes { display: flex; gap: 8px; align-self: stretch; justify-content: center; flex-wrap: wrap; }
        .modes button {
            border: none; cursor: pointer; padding: 8px 10px; border-radius: 12px;
            background: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 8%, transparent);
            color: var(--feezal-glass-color, #1d1d1f);
            font-family: 'Material Icons'; font-size: 18px; line-height: 1;
        }
        .modes button.text { font-family: inherit; font-size: 12px; font-weight: 600; }
        .modes button.active { background: var(--feezal-glass-accent, #ff9f0a); color: #fff; }
        /* E102 WP2: mm:ss boost countdown badge on the active momentary button. */
        .modes button .boost-badge {
            display: block; margin-top: 2px;
            font-family: inherit; font-size: 10px; font-weight: 700; line-height: 1;
            font-variant-numeric: tabular-nums;
        }
    `];

    constructor() {
        super();
        this.size = '';
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
        this.icon = 'thermostat';
        this.degrade = false;
        this.discoveryId = '';
        this._dragSp = null;
        // E137: the behavior layer — wires/parses/publishes; this view renders.
        this.climate = new ClimateController(this);
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    updated(changed) {
        super.updated(changed);
        // E137: live-canvas topic edits re-wire through the controller.
        this.climate.rewireIfChanged();
        // The size grid writes the element's inline geometry (editor keeps
        // full manual control afterwards).
        if (changed.has('size')) applySizePreset(this);
        // Promote the details popup into the top layer.
        if (changed.has('_details') && this._details) {
            const popup = this.renderRoot.querySelector('.details');
            if (popup?.showPopover && !popup.matches(':popover-open')) {
                try { popup.showPopover(); } catch { /* fixed+z-index fallback */ }
            }
            this._positionDetails();
        }
    }

    // E137: the ClimateController wires everything in hostConnected and
    // clears the boost interval in hostDisconnected.

    /** Setpoint pill release → controller (clamp + snap + publish). */
    setSetpoint(temp) {
        return this.climate.setSetpoint(temp);
    }

    // ── details popup ─────────────────────────────────────────────────────────

    _onCardClick() {
        if (this._suppressTap) {
            this._suppressTap = false;
            return;
        }
        this.openDetails();
    }

    /** Setpoint pill: pointer position → temperature (snapped); publish on release. */
    _spDown(e) {
        if (feezal.isEditor) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        this.__spDragging = true;
        this._spApply(e);
    }

    _spMove(e) {
        if (this.__spDragging) this._spApply(e);
    }

    _spUp(e) {
        if (!this.__spDragging) return;
        this.__spDragging = false;
        this._spApply(e);
        const temp = this._dragSp;
        this._dragSp = null;
        if (temp !== null) this.setSetpoint(temp);
    }

    _spApply(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const t = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
        const step = Number(this.step) || 0.5;
        const temp = this.min + t * (this.max - this.min);
        this._dragSp = +(Math.round(temp / step) * step).toFixed(2);
    }

    _fmt(v) {
        return v === null || v === undefined ? '—' : `${v}${this.unit}`;
    }


    _renderDetails() {
        const sp = this._dragSp ?? this.climate.setpoint ?? (this.min + this.max) / 2;
        const fill = Math.max(0, Math.min(100, ((sp - this.min) / ((this.max - this.min) || 1)) * 100));
        const modes = this.climate.parsedModes();
        const active = this.climate.activeModeEntry(modes);   // E102: match-setpoint-max-aware active button
        // B53: off sentinel (and not mid-drag) → mode label instead of 4.5° in the pill.
        const offEntry = (this._dragSp === null && active
            && active['match-setpoint-max'] !== null && active['match-setpoint-max'] !== undefined) ? active : null;
        const valve = this.climate.valve;
        return html`
            <div class="details" popover="manual">
                <div class="title">${this.label || 'Climate'}</div>
                <div class="vslider"
                    @pointerdown="${this._spDown}"
                    @pointermove="${this._spMove}"
                    @pointerup="${this._spUp}">
                    <div class="fill" style="height:${fill}%"></div>
                    ${valve !== null ? html`<div class="valve-mark" style="bottom:${valve}%"></div>` : ''}
                    <div class="cur">${this._fmt(this.climate.actual)}</div>
                    <div class="sp">${offEntry ? offEntry.label : this._fmt(sp)}</div>
                </div>
                ${valve !== null ? html`<div class="valve-line">Valve ${Math.round(valve)}&nbsp;%</div>` : ''}
                ${modes.length > 0 ? html`
                    <div class="modes">
                        ${modes.map(m => {
                            // B54: device-reported BOOST_MODE wins over the mode read-back.
                            const boostActive = this.climate.momentaryEntryActive(m);
                            const badge = boostActive ? this.climate.boostBadge() : '';
                            return html`
                                <button class="${MODE_ICONS[m.value] ? '' : 'text'} ${boostActive || m === active ? 'active' : ''}"
                                    title="${m.label}"
                                    @click="${() => this.climate.setMode(m)}">${MODE_ICONS[m.value] || m.label}${badge ? html`<span class="boost-badge">${badge}</span>` : ''}</button>`;
                        })}
                    </div>` : ''}
            </div>`;
    }

    render() {
        const actual = this.climate.actual ?? (feezal.isEditor && !this.subscribeActual && !this.subscribe ? 21.5 : null);
        // B57: resolve the mode read-back to its entry and render the LABEL —
        // Homematic modes are numeric ("• 1" is meaningless) — guarding WITHOUT
        // truthiness (Auto is mode 0). Unknown read-backs still show raw.
        // B53: while the off sentinel is active, suppress the "→ 4.5°" target.
        const mode = this.climate.mode;
        const activeEntry = this.climate.activeModeEntry();
        const offEntry = (activeEntry && activeEntry['match-setpoint-max'] !== null
            && activeEntry['match-setpoint-max'] !== undefined) ? activeEntry : null;
        const hasMode = mode !== '' && mode !== null && mode !== undefined;
        const modeText = activeEntry ? activeEntry.label : (hasMode ? String(mode) : '');
        return html`
            <div class="card" role="button" tabindex="0"
                @click="${this._onCardClick}"
                @keydown="${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._onCardClick(); } }}">
                <button class="flip-btn" title="Details"
                    @click="${e => { e.stopPropagation(); this.openDetails(); }}">tune</button>
                ${!this._available ? html`<span class="unavail" title="Device unavailable">⚠</span>` : ''}
                ${this.climate.batteryLow ? html`<feezal-icon class="batt" name="battery_alert" title="Battery low"></feezal-icon>` : ''}
                <div class="head">
                    <feezal-icon name="${this.icon || 'thermostat'}"></feezal-icon>
                    <span class="actual">${this._fmt(actual)}</span>
                </div>
                ${offEntry
                    ? html`<span class="state"><b>${offEntry.label}</b></span>`
                    : html`<span class="state">→ <b>${this._fmt(this.climate.setpoint)}</b>${modeText ? ` • ${modeText}` : ''}</span>`}
                <span class="label">${this.label || (feezal.isEditor ? 'Climate' : '')}</span>
            </div>
            ${this._details ? this._renderDetails() : ''}
        `;
    }
}

customElements.define('feezal-element-glass-climate', FeezalElementGlassClimate);
export {FeezalElementGlassClimate};

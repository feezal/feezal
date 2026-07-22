/* global feezal */
import {feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {EinkBase, einkCardStyles} from '@feezal/feezal-eink';

/**
 * feezal-element-eink-fan (E57)
 *
 * E-ink fan card: state word toggle (the whole card inverts while on),
 * current speed as an oversized numeral (or the active preset word), and
 * flat bordered buttons for the speed steps / preset modes. Same MQTT
 * wiring contract as feezal-element-glass-fan (subscribe / publish /
 * payload-on / payload-off, speed topics with speed-range-min/max
 * scaling, preset topics + preset-modes, HA `fan` discovery) — but
 * NO spinning icon and no animation of any kind (e-paper).
 *
 * Family conventions (E57): black-on-white via --_fg/--_bg, thick rules,
 * no animation/transition/hover, redraw-deduped via renderSignature().
 */

/** Percentage steps rendered as flat buttons when speed topics are wired. */
const SPEED_STEPS = [25, 50, 75, 100];

class FeezalElementEinkFan extends EinkBase {
    static get feezal() {
        return {
            palette: {name: 'Fan', category: 'Eink', color: '#222222', icon: 'mode_fan'},
            description: 'E-ink fan card — inverted while on, oversized speed numeral or preset word, ' +
                'flat speed-step/preset buttons. Same wiring contract as the glass fan card ' +
                '(speed-range scaling, presets, HA fan discovery). 1-bit, no animation, redraw-deduped.',
            discovery: {
                component: 'fan',
                map: {
                    state_topic:                {attr: 'subscribe'},
                    command_topic:              {attr: 'publish'},
                    payload_on:                 {attr: 'payload-on'},
                    payload_off:                {attr: 'payload-off'},
                    // HA uses either value_template (generic) or state_value_template (fan-specific)
                    value_template:             {attr: 'message-property', transform: 'valueTemplateToPath'},
                    state_value_template:       {attr: 'message-property', transform: 'valueTemplateToPath'},
                    percentage_state_topic:     {attr: 'subscribe-speed'},
                    percentage_command_topic:   {attr: 'publish-speed'},
                    percentage_value_template:  {attr: 'message-property-speed',  transform: 'valueTemplateToPath'},
                    speed_range_min:            {attr: 'speed-range-min'},
                    speed_range_max:            {attr: 'speed-range-max'},
                    preset_modes:               {attr: 'preset-modes', transform: 'jsonStringify'},
                    preset_mode_state_topic:    {attr: 'subscribe-preset'},
                    preset_mode_command_topic:  {attr: 'publish-preset'},
                    preset_mode_value_template: {attr: 'message-property-preset', transform: 'valueTemplateToPath'},
                    // N31: availability is mapped automatically from the canonical discovery record.
                    name:                       'label',
                },
            },
            attributes: [
                {name: 'subscribe',              type: 'mqttTopic', help: 'Topic receiving the fan on/off state.'},
                {name: 'message-property',       type: 'string',    default: 'payload', help: 'Property path within state messages (dot-notation). Blank = top-level payload.'},
                {name: 'publish',                type: 'mqttTopic', help: 'Topic to publish on/off commands.'},
                {name: 'payload-on',             type: 'string',    default: 'ON',  help: 'Payload for "on".'},
                {name: 'payload-off',            type: 'string',    default: 'OFF', help: 'Payload for "off".'},
                {name: 'subscribe-speed',        type: 'mqttTopic', help: 'Topic receiving current speed percentage (0–100).'},
                {name: 'message-property-speed', type: 'string',    default: 'payload', help: 'Property path within speed messages. Defaults to message-property.'},
                {name: 'publish-speed',          type: 'mqttTopic', help: 'Topic to publish target speed percentage.'},
                {name: 'subscribe-preset',       type: 'mqttTopic', help: 'Topic receiving current preset mode name.'},
                {name: 'message-property-preset', type: 'string',   default: 'payload', help: 'Property path within preset messages. Defaults to message-property.'},
                {name: 'publish-preset',         type: 'mqttTopic', help: 'Topic to publish selected preset mode name.'},
                {name: 'preset-modes',           type: 'objectList', itemFields: [{key: '', placeholder: 'preset name'}], default: '[]',
                    help: 'JSON array of preset mode names, e.g. ["low","medium","high"]. When set, preset buttons replace the speed-step buttons.'},
                {name: 'label',                  type: 'string',    default: '', help: 'Label line (rendered uppercase).'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability — a ! badge appears while unavailable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',      type: 'string',    default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable',    type: 'string',    default: 'offline', help: 'Payload meaning unavailable.'},
                {name: 'speed-range-min', type: 'number', default: 1,   help: 'Raw speed minimum (from discovery speed_range_min). Buttons/numeral show 0–100%; raw values are scaled to this range.'},
                {name: 'speed-range-max', type: 'number', default: 100, help: 'Raw speed maximum (from discovery speed_range_max). e.g. 9 for IKEA STARKVIND.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-eink-font-size-value', default: '34px', help: 'Speed numeral font size.'},
                {property: '--feezal-eink-font-size-label', default: '13px', help: 'Label/button font size.'},
                {property: '--feezal-eink-rule', default: '3px', help: 'Rule/border thickness (≥2px).'},
            ],
            defaultStyle: {width: '200px', height: '150px'},
            restrict: {minWidth: 120, minHeight: 90},
        };
    }

    static properties = {
        publish:         {type: String, reflect: true},
        payloadOn:       {type: String, reflect: true, attribute: 'payload-on'},
        payloadOff:      {type: String, reflect: true, attribute: 'payload-off'},
        subscribeSpeed:  {type: String, reflect: true, attribute: 'subscribe-speed'},
        msgPropSpeed:    {type: String, reflect: true, attribute: 'message-property-speed'},
        publishSpeed:    {type: String, reflect: true, attribute: 'publish-speed'},
        speedRangeMin:   {type: Number, reflect: true, attribute: 'speed-range-min'},
        speedRangeMax:   {type: Number, reflect: true, attribute: 'speed-range-max'},
        subscribePreset: {type: String, reflect: true, attribute: 'subscribe-preset'},
        msgPropPreset:   {type: String, reflect: true, attribute: 'message-property-preset'},
        publishPreset:   {type: String, reflect: true, attribute: 'publish-preset'},
        presetModes:     {type: String, reflect: true, attribute: 'preset-modes'},
        label:           {type: String, reflect: true},
        // N31: availability inherited from FeezalElement.
        discoveryId:     {type: String, reflect: true, attribute: 'discovery-id'},
    };

    static styles = [feezalBaseStyles, einkCardStyles, css`
        .card { gap: 4px; }
        /* Flat toggle: state word as a full-width bordered button. currentColor
           keeps it legible on both the normal and the inverted (on) card. */
        .power {
            min-height: 40px; width: 100%;
            border: var(--feezal-eink-rule, 3px) solid currentColor; background: none;
            color: inherit; font: inherit;
            font-size: var(--feezal-eink-font-size-label, 13px);
            text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer;
            border-radius: var(--feezal-eink-radius, 0px);
        }
        .value { text-align: center; }
        .steps { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
        .steps button {
            flex: 1 1 auto; min-height: 40px; min-width: 40px;
            border: var(--feezal-eink-rule, 3px) solid currentColor; background: none;
            color: inherit; font: inherit;
            font-size: var(--feezal-eink-font-size-label, 13px);
            text-transform: uppercase; padding: 3px 8px; cursor: pointer;
            border-radius: var(--feezal-eink-radius, 0px);
        }
        /* Active step — the 1-bit inverted-block treatment, on both card states. */
        .card .steps button.active { background: var(--_fg); color: var(--_bg); }
        .card.inv .steps button.active { background: var(--_bg); color: var(--_fg); }
    `];

    constructor() {
        super();
        this.publish = '';
        this.payloadOn = 'ON';
        this.payloadOff = 'OFF';
        this.subscribeSpeed = '';
        this.msgPropSpeed = '';
        this.publishSpeed = '';
        this.speedRangeMin = 1;
        this.speedRangeMax = 100;
        this.subscribePreset = '';
        this.msgPropPreset = '';
        this.publishPreset = '';
        this.presetModes = '[]';
        this.label = '';
        this.discoveryId = '';
        // Plain fields, not reactive — MQTT pokes go through requestUpdate()
        // and the E57 renderSignature() dedup (see EinkBase.shouldUpdate).
        this._on = false;
        this._speed = null;   // 0–100 or null
        this._preset = null;
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    connectedCallback() {
        super.connectedCallback();
        this._wireSubscriptions();
    }

    /** Topic attributes changed at runtime (inspector edits on the live
     * canvas) → updated() rewires instead of keeping the stale topics. */
    _wireSignature() {
        return [this.subscribe, this.subscribeSpeed, this.subscribePreset].join('|');
    }

    updated(changed) {
        super.updated(changed);
        if (this.isConnected && this.__wireSig !== undefined && this._wireSignature() !== this.__wireSig) {
            this._unsubscribe();
            this._wireSubscriptions();
        }
    }

    _wireSubscriptions() {
        this.__wireSig = this._wireSignature();

        // N31: availability subscription handled by the FeezalElement base.

        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                let v = this.getProperty(msg, this.messageProperty);
                if (typeof v === 'string') {
                    try { const p = JSON.parse(v); if (p && 'state' in p) v = p.state; } catch { /* raw */ }
                } else if (v && typeof v === 'object' && 'state' in v) { v = v.state; }
                this._on = String(v).toUpperCase() === this.payloadOn.toUpperCase() ||
                    v === true || v === 1 || v === '1';
                this.requestUpdate();
            });
        }

        if (this.subscribeSpeed) {
            this.addSubscription(this.subscribeSpeed, msg => {
                const raw = Number(this.getProperty(msg, this.msgPropSpeed || this.messageProperty));
                if (!isNaN(raw)) {
                    const lo = this.speedRangeMin ?? 1;
                    const hi = this.speedRangeMax ?? 100;
                    // Normalise raw device units to 0–100 % for display
                    this._speed = (hi === lo) ? 0 : Math.max(0, Math.min(100, ((raw - lo) / (hi - lo)) * 100));
                }
                this.requestUpdate();
            });
        }

        if (this.subscribePreset) {
            this.addSubscription(this.subscribePreset, msg => {
                this._preset = String(this.getProperty(msg, this.msgPropPreset || this.messageProperty));
                this.requestUpdate();
            });
        }
    }

    // ── publishing ────────────────────────────────────────────────────────────

    toggle() {
        if (feezal.isEditor) return;
        this._on = !this._on;
        if (this.publish) {
            feezal.connection.pub(this.publish, this._on ? this.payloadOn : this.payloadOff);
        }
        this.requestUpdate();
    }

    _setSpeed(pct) {
        if (feezal.isEditor) return;
        const clamped = Math.max(0, Math.min(100, Math.round(Number(pct))));
        this._speed = clamped;
        if (this.publishSpeed) {
            const lo = this.speedRangeMin ?? 1;
            const hi = this.speedRangeMax ?? 100;
            // De-normalise percentage back to raw device units
            const raw = (lo === hi) ? lo : Math.round(lo + (clamped / 100) * (hi - lo));
            feezal.connection.pub(this.publishSpeed, String(raw));
        }
        this.requestUpdate();
    }

    _setPreset(mode) {
        if (feezal.isEditor) return;
        this._preset = mode;
        if (this.publishPreset) {
            feezal.connection.pub(this.publishPreset, mode);
        }
        this.requestUpdate();
    }

    // ── display helpers ──────────────────────────────────────────────────────

    _presets() {
        try {
            const arr = JSON.parse(this.presetModes);
            return Array.isArray(arr) ? arr : [];
        } catch {
            return [];
        }
    }

    _hasSpeed() {
        return Boolean(this.subscribeSpeed || this.publishSpeed);
    }

    /** Nearest SPEED_STEPS entry to the current % (button highlight). */
    _activeStep() {
        if (this._speed === null || this._speed <= 0) return null;
        let best = SPEED_STEPS[0];
        for (const s of SPEED_STEPS) {
            if (Math.abs(this._speed - s) < Math.abs(this._speed - best)) best = s;
        }
        return best;
    }

    /** The oversized line: preset word > speed numeral > state word. */
    _display() {
        const presets = this._presets();
        if (presets.length > 0 && this._preset !== null && presets.includes(this._preset)) {
            return {text: String(this._preset).toUpperCase(), unit: ''};
        }
        if (this._speed !== null && this._hasSpeed()) {
            return {text: String(Math.round(this._speed)), unit: '%'};
        }
        if (feezal.isEditor && !this.subscribe && !this.subscribeSpeed) {
            return {text: '50', unit: '%'};
        }
        return {text: this._on ? 'ON' : 'OFF', unit: ''};
    }

    /** E57 redraw dedup: everything visibly rendered, values as shown. */
    renderSignature() {
        const d = this._display();
        return [this._on, d.text + d.unit, this._activeStep() ?? '', this._preset ?? '',
            this._available].join('|');
    }

    render() {
        const presets = this._presets();
        const d = this._display();
        const activeStep = this._activeStep();
        return html`
            <div class="card ${this._on ? 'inv' : ''}">
                ${!this._available ? html`<span class="badge-tr" title="Device unavailable">!</span>` : ''}
                <button class="power" @click="${this.toggle}">${this._on ? 'ON' : 'OFF'}</button>
                <span class="value">${d.text}${d.unit ? html`<span class="unit">${d.unit}</span>` : ''}</span>
                ${presets.length > 0 ? html`
                    <div class="steps">
                        ${presets.map(p => html`
                            <button class="${this._preset === p ? 'active' : ''}"
                                @click="${() => this._setPreset(p)}">${p}</button>`)}
                    </div>` : this._hasSpeed() ? html`
                    <div class="steps">
                        ${SPEED_STEPS.map(s => html`
                            <button class="${activeStep === s ? 'active' : ''}"
                                @click="${() => this._setSpeed(s)}">${s}</button>`)}
                    </div>` : ''}
                ${this.label || feezal.isEditor ? html`<span class="label">${this.label || 'Fan'}</span>` : ''}
            </div>
        `;
    }
}

customElements.define('feezal-element-eink-fan', FeezalElementEinkFan);
export {FeezalElementEinkFan};

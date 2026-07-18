/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

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

const MODE_ICONS = {
    off: 'power_settings_new',
    heat: 'local_fire_department',
    cool: 'ac_unit',
    auto: 'auto_mode',
    dry: 'water_drop',
    fan_only: 'mode_fan',
};

class FeezalElementGlassClimate extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Climate', category: 'Glass', color: '#7aa5c9', icon: 'thermostat'},
            description: 'Frosted-glass thermostat card — actual/set temperature and mode; tap opens the ' +
                'details popup with a vertical setpoint slider and mode buttons. Same wiring contract as ' +
                'the material thermostat card (setpoint/actual/mode subset).',
            discovery: {
                component: 'climate',
                map: {
                    schema: {attr: 'payload-mode', valueMap: {json: 'json', _default: 'separate'}},
                    temperature_state_topic:   {attr: 'subscribe'},
                    temperature_command_topic: {attr: 'publish'},
                    current_temperature_topic: {attr: 'subscribe-actual'},
                    mode_state_topic:          {attr: 'subscribe-mode'},
                    mode_command_topic:        {attr: 'publish-mode'},
                    min_temp:         {attr: 'min'},
                    max_temp:         {attr: 'max'},
                    temp_step:        {attr: 'step'},
                    temperature_unit: {attr: 'unit', valueMap: {C: '°C', F: '°F', _default: '°C'}},
                    modes: {attr: 'modes', transform: 'jsonStringify'},
                    // N31: availability is mapped automatically from the canonical discovery record.
                    name: 'label',
                },
            },
            attributes: [
                {name: 'payload-mode', type: 'select', options: ['separate', 'json'], default: 'separate',
                    help: 'separate = one topic per property; json = single topic carrying the full climate JSON object (zigbee2mqtt TRVs).'},
                {name: 'subscribe', type: 'mqttTopic', help: 'json mode: base topic carrying the climate state JSON object.'},
                {name: 'publish',   type: 'mqttTopic', help: 'json mode: command/set topic (e.g. zigbee2mqtt/TRV/set).'},
                {name: 'json-map',  type: 'string', default: '',
                    help: 'json mode: optional JSON map overriding default keys. E.g. {"setpoint":"target_temp","actual":"temperature"}.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'json mode: dot-notation path to the state JSON object within the MQTT message. Default: payload'},
                {name: 'subscribe-setpoint', type: 'mqttTopic', help: 'separate: topic publishing the current setpoint.'},
                {name: 'message-property-setpoint', type: 'string', default: 'payload', help: 'Property path within setpoint messages. Defaults to message-property.'},
                {name: 'publish-setpoint', type: 'mqttTopic', help: 'separate: topic to publish a new setpoint to.'},
                {name: 'subscribe-actual', type: 'mqttTopic', help: 'Topic for the actual measured temperature.'},
                {name: 'message-property-actual', type: 'string', default: 'payload', help: 'Property path within actual-temperature messages. Defaults to message-property.'},
                {name: 'subscribe-mode', type: 'mqttTopic', help: 'separate: topic publishing the current operating mode.'},
                {name: 'message-property-mode', type: 'string', default: 'payload', help: 'Property path within mode messages. Defaults to message-property.'},
                {name: 'publish-mode', type: 'mqttTopic', help: 'separate: topic to publish the selected mode to.'},
                {name: 'min',  type: 'number', default: 5,    help: 'Minimum setpoint value.'},
                {name: 'max',  type: 'number', default: 30,   help: 'Maximum setpoint value.'},
                {name: 'step', type: 'number', default: 0.5,  help: 'Setpoint snap increment.'},
                {name: 'unit', type: 'string', default: '°C', help: 'Temperature unit label.'},
                {name: 'modes', type: 'string', default: '',
                    help: 'Mode buttons in the popup — JSON array of strings (["off","heat","auto"]) or {value,label} objects. Empty = no mode row.'},
                {name: 'label', type: 'string', help: 'Card label.'},
                {name: 'icon',  type: 'string', default: 'thermostat', help: 'Icon name.'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Optional availability topic — badge when unavailable, controls stay enabled.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-accent', type: 'color', default: '#ff9f0a', help: 'Setpoint/heating accent colour.'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
            ],
            defaultStyle: {width: '150px', height: '110px'},
            restrict: {minWidth: 90, minHeight: 70},
        };
    }

    static properties = {
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
        _setpoint:  {state: true},
        _actual:    {state: true},
        _mode:      {state: true},
        _dragSp:    {state: true},   // live setpoint while dragging the pill
        _details:   {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host { display: block; box-sizing: border-box; container-type: size; overflow: visible; }
        .card {
            position: absolute; inset: 0; box-sizing: border-box; cursor: pointer;
            display: flex; flex-direction: column; justify-content: space-between;
            padding: 11cqmin; gap: 2px;
            border-radius: var(--feezal-glass-radius, 24px);
            background: var(--feezal-glass-tint, rgba(255,255,255,0.55));
            -webkit-backdrop-filter: blur(var(--feezal-glass-blur, 20px));
            backdrop-filter: blur(var(--feezal-glass-blur, 20px));
            border: 1px solid var(--feezal-glass-border, rgba(255,255,255,0.55));
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            color: var(--feezal-glass-color, #1d1d1f);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            transition: transform 0.15s ease, background 0.2s ease;
            user-select: none; touch-action: manipulation;
        }
        @supports (corner-shape: squircle) { .card { corner-shape: squircle; } }
        .card:active { transform: scale(0.97); }
        :host([degrade]) .card {
            -webkit-backdrop-filter: none; backdrop-filter: none;
            background: var(--feezal-glass-solid, rgba(245,245,247,0.94));
        }
        .head { display: flex; align-items: baseline; gap: 6cqmin; }
        feezal-icon { font-size: 16cqmin; line-height: 1; color: var(--feezal-glass-accent, #ff9f0a); }
        .actual { font-size: 18cqmin; font-weight: 700; font-variant-numeric: tabular-nums; }
        .state {
            font-size: 11cqmin; font-weight: 600;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
        }
        .state b { color: var(--feezal-glass-accent, #ff9f0a); }
        .label {
            font-size: 11cqmin; font-weight: 600; line-height: 1.2;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .flip-btn {
            position: absolute; top: 6cqmin; right: 8cqmin;
            border: none; background: none; cursor: pointer; padding: 2px;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            font-family: 'Material Icons'; font-size: 12cqmin; line-height: 1;
        }
        .unavail {
            position: absolute; bottom: 8cqmin; right: 10cqmin;
            font-size: 12px; color: var(--error-color, #d32f2f); opacity: 0.85;
        }

        /* ── details popup (glass-light pattern) ── */
        .details {
            /* Anchored above (or below) the card by _positionDetails(). */
            position: fixed; left: 0; top: 0; margin: 0; z-index: 99999;
            width: 200px; height: fit-content; max-height: 90vh;
            box-sizing: border-box; padding: 16px;
            display: flex; flex-direction: column; align-items: center; gap: 16px;
            border: 1px solid var(--feezal-glass-border, rgba(255,255,255,0.55));
            border-radius: var(--feezal-glass-radius, 24px);
            background: var(--feezal-glass-tint, rgba(255,255,255,0.7));
            -webkit-backdrop-filter: blur(var(--feezal-glass-blur, 20px));
            backdrop-filter: blur(var(--feezal-glass-blur, 20px));
            box-shadow: 0 16px 48px rgba(0,0,0,0.3);
            color: var(--feezal-glass-color, #1d1d1f);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: visible;
        }
        :host([degrade]) .details {
            -webkit-backdrop-filter: none; backdrop-filter: none;
            background: var(--feezal-glass-solid, rgba(245,245,247,0.97));
        }
        .details::backdrop { background: rgba(0, 0, 0, 0.35); }
        .details .title {
            font-size: 13px; font-weight: 700; align-self: stretch; text-align: center;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
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
        .modes { display: flex; gap: 8px; align-self: stretch; justify-content: center; flex-wrap: wrap; }
        .modes button {
            border: none; cursor: pointer; padding: 8px 10px; border-radius: 12px;
            background: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 8%, transparent);
            color: var(--feezal-glass-color, #1d1d1f);
            font-family: 'Material Icons'; font-size: 18px; line-height: 1;
        }
        .modes button.text { font-family: inherit; font-size: 12px; font-weight: 600; }
        .modes button.active { background: var(--feezal-glass-accent, #ff9f0a); color: #fff; }
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
        this.min = 5;
        this.max = 30;
        this.step = 0.5;
        this.unit = '°C';
        this.modes = '';
        this.label = '';
        this.icon = 'thermostat';
        this.degrade = false;
        this.discoveryId = '';
        this._setpoint = null;
        this._actual = null;
        this._mode = '';
        this._dragSp = null;
        this._details = false;
        this._suppressTap = false;
        this.__outsideDown = e => {
            const path = e.composedPath();
            if (path.includes(this.renderRoot?.querySelector('.details'))) return;
            this._closeDetails();
            if (path.includes(this)) this._suppressTap = true;
        };
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('pointerdown', this.__outsideDown);
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    /** json key map — material-climate defaults (zigbee2mqtt TRV shape). */
    get _jsonMap() {
        const defaults = {
            setpoint: 'current_heating_setpoint',
            actual:   'local_temperature',
            mode:     'system_mode',
        };
        if (this.jsonMap) {
            try { return {...defaults, ...JSON.parse(this.jsonMap)}; } catch { /* defaults */ }
        }
        return defaults;
    }

    _wireSignature() {
        return [this.payloadMode, this.subscribe, this.subscribeSetpoint, this.subscribeActual,
            this.subscribeMode].join('|');
    }

    updated(changed) {
        super.updated(changed);
        // Topic attributes changed on the live canvas → rewire (glass pattern).
        if (this.isConnected && this.__wireSig !== undefined && this._wireSignature() !== this.__wireSig) {
            this._unsubscribe();
            this._wireSubscriptions();
        }
        // Promote the details popup into the top layer.
        if (changed.has('_details') && this._details) {
            const popup = this.renderRoot.querySelector('.details');
            if (popup?.showPopover && !popup.matches(':popover-open')) {
                try { popup.showPopover(); } catch { /* fixed+z-index fallback */ }
            }
            this._positionDetails();
        }
    }

    connectedCallback() {
        super.connectedCallback();
        this._wireSubscriptions();
    }

    _wireSubscriptions() {
        this.__wireSig = this._wireSignature();

        if (this.payloadMode === 'json') {
            if (this.subscribe) {
                this.addSubscription(this.subscribe, msg => {
                    let obj = this.getProperty(msg, this.messageProperty);
                    if (typeof obj === 'string') {
                        try { obj = JSON.parse(obj); } catch { obj = null; }
                    }
                    if ((obj === null || typeof obj !== 'object') && msg.payload && typeof msg.payload === 'object') {
                        obj = msg.payload;
                    }
                    if (!obj || typeof obj !== 'object') return;
                    const map = this._jsonMap;
                    const sp = Number(this.getProperty(obj, map.setpoint));
                    if (!isNaN(sp)) this._setpoint = sp;
                    const ac = Number(this.getProperty(obj, map.actual));
                    if (!isNaN(ac)) this._actual = ac;
                    const mode = this.getProperty(obj, map.mode);
                    if (mode !== null && mode !== undefined) this._mode = String(mode);
                });
            }
        } else {
            const sub = (topic, cb) => { if (topic) this.addSubscription(topic, cb); };
            sub(this.subscribeSetpoint, msg => {
                const v = Number(this.getProperty(msg, this.msgPropSetpoint || this.messageProperty));
                if (!isNaN(v)) this._setpoint = v;
            });
            sub(this.subscribeMode, msg => {
                const v = this.getProperty(msg, this.msgPropMode || this.messageProperty);
                if (v !== null && v !== undefined) this._mode = String(v);
            });
        }

        // The actual temperature often comes from a separate sensor topic in
        // BOTH payload modes.
        if (this.subscribeActual) {
            this.addSubscription(this.subscribeActual, msg => {
                const v = Number(this.getProperty(msg, this.msgPropActual || this.messageProperty));
                if (!isNaN(v)) this._actual = v;
            });
        }
    }

    // ── publishing (material-climate semantics) ───────────────────────────────

    _pub(topic, value, jsonObj) {
        if (feezal.isEditor) return;
        if (this.payloadMode === 'json') {
            if (this.publish) feezal.connection.pub(this.publish, JSON.stringify(jsonObj));
        } else if (topic) {
            feezal.connection.pub(topic, String(value));
        }
    }

    setSetpoint(temp) {
        const step = Number(this.step) || 0.5;
        const clamped = +(Math.min(this.max, Math.max(this.min, Math.round(temp / step) * step))).toFixed(2);
        this._setpoint = clamped;
        this._pub(this.publishSetpoint, clamped, {[this._jsonMap.setpoint]: clamped});
    }

    setMode(value) {
        if (feezal.isEditor) return;
        this._mode = value;
        this._pub(this.publishMode, value, {[this._jsonMap.mode]: value});
    }

    /** Modes attribute → [{value, label}] (material-climate coercion). */
    _parsedModes() {
        try {
            const raw = JSON.parse(this.modes || '[]');
            return (Array.isArray(raw) ? raw : []).map(m =>
                typeof m === 'string' ? {value: m, label: m} : {value: m.value, label: m.label || m.value})
                .filter(m => m.value);
        } catch {
            return [];
        }
    }

    // ── details popup ─────────────────────────────────────────────────────────

    openDetails() {
        if (feezal.isEditor || this._details) return;
        this._details = true;
        setTimeout(() => {
            if (this._details) document.addEventListener('pointerdown', this.__outsideDown);
        });
    }

    _closeDetails() {
        this._details = false;
        document.removeEventListener('pointerdown', this.__outsideDown);
    }

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


    /** Place the details popup above the card (below when there is no room),
     * horizontally centred on it, clamped so nothing goes off-screen. */
    _positionDetails() {
        const popup = this.renderRoot.querySelector('.details');
        if (!popup) return;
        const host = this.getBoundingClientRect();
        const pw = popup.offsetWidth;
        const ph = popup.offsetHeight;
        const margin = 8;
        const gap = 12;
        let left = host.left + host.width / 2 - pw / 2;
        left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin));
        let top = host.top - ph - gap;                       // preferred: above
        if (top < margin) top = host.bottom + gap;           // no room -> below
        top = Math.max(margin, Math.min(top, window.innerHeight - ph - margin));
        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
    }

    _renderDetails() {
        const sp = this._dragSp ?? this._setpoint ?? (this.min + this.max) / 2;
        const fill = Math.max(0, Math.min(100, ((sp - this.min) / ((this.max - this.min) || 1)) * 100));
        const modes = this._parsedModes();
        return html`
            <div class="details" popover="manual">
                <div class="title">${this.label || 'Climate'}</div>
                <div class="vslider"
                    @pointerdown="${this._spDown}"
                    @pointermove="${this._spMove}"
                    @pointerup="${this._spUp}">
                    <div class="fill" style="height:${fill}%"></div>
                    <div class="cur">${this._fmt(this._actual)}</div>
                    <div class="sp">${this._fmt(sp)}</div>
                </div>
                ${modes.length > 0 ? html`
                    <div class="modes">
                        ${modes.map(m => html`
                            <button class="${MODE_ICONS[m.value] ? '' : 'text'} ${this._mode === m.value ? 'active' : ''}"
                                title="${m.label}"
                                @click="${() => this.setMode(m.value)}">${MODE_ICONS[m.value] || m.label}</button>`)}
                    </div>` : ''}
            </div>`;
    }

    render() {
        const actual = this._actual ?? (feezal.isEditor && !this.subscribeActual && !this.subscribe ? 21.5 : null);
        return html`
            <div class="card" role="button" tabindex="0"
                @click="${this._onCardClick}"
                @keydown="${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._onCardClick(); } }}">
                <button class="flip-btn" title="Details"
                    @click="${e => { e.stopPropagation(); this.openDetails(); }}">tune</button>
                ${!this._available ? html`<span class="unavail" title="Device unavailable">⚠</span>` : ''}
                <div class="head">
                    <feezal-icon name="${this.icon || 'thermostat'}"></feezal-icon>
                    <span class="actual">${this._fmt(actual)}</span>
                </div>
                <span class="state">→ <b>${this._fmt(this._setpoint)}</b>${this._mode ? ` • ${this._mode}` : ''}</span>
                <span class="label">${this.label || (feezal.isEditor ? 'Climate' : '')}</span>
            </div>
            ${this._details ? this._renderDetails() : ''}
        `;
    }
}

customElements.define('feezal-element-glass-climate', FeezalElementGlassClimate);
export {FeezalElementGlassClimate};

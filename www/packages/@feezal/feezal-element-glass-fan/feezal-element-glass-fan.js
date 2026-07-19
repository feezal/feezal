/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalAvailabilityStyles, availabilityBadge, html, css} from '@feezal/feezal-element';
import {applySizePreset, glassCardStyles, glassPopupStyles} from '@feezal/feezal-glass';

/**
 * feezal-element-glass-fan (E100)
 *
 * Frosted-glass fan card — the Glass family's fan control. Same MQTT
 * contract as feezal-element-material-fan (subscribe / publish /
 * payload-on / payload-off, speed topics with speed-range-min/max
 * scaling, preset topics + preset-modes, HA `fan` discovery) restyled
 * as a glass tile: the fan icon spins while on (speed-dependent period,
 * disabled under prefers-reduced-motion), tap toggles, long-press or
 * the tune button opens the Apple-Home-style details popup with a
 * vertical speed pill and preset chips.
 *
 * Family conventions (frost vars, degrade, squircle): see glass-button.
 */

// Speed % → rotation duration: faster = shorter period (material-fan's map).
export function speedDuration(pct) {
    if (pct <= 0)   return '4s';
    if (pct <= 25)  return '3s';
    if (pct <= 60)  return '1.5s';
    return '0.7s';
}

const LONG_PRESS_MS = 450;

class FeezalElementGlassFan extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Fan', category: 'Glass', color: '#7aa5c9', icon: 'mode_fan'},
            description: 'Frosted-glass fan card — the icon spins while on, tap toggles; long-press (or the ⋯ button) ' +
                'opens the details popup: vertical speed slider and preset chips. Same wiring contract as the ' +
                'material fan card (speed-range scaling, presets, HA fan discovery).',
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
                {name: 'size', type: 'select', options: ['', '2x2', '2x1'], default: '',
                    help: 'Preset size: 2x2 = square (150×150), 2x1 = wide (150×75). Empty keeps the current/manual size.'},
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
                    help: 'JSON array of preset mode names, e.g. ["low","medium","high"].'},
                {name: 'label',                  type: 'string',    default: '', help: 'Optional card label.'},
                {name: 'icon',                   type: 'string',    default: 'mode_fan', help: 'Icon name.'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Availability topic.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',      type: 'string',    default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable',    type: 'string',    default: 'offline', help: 'Payload meaning unavailable.'},
                {name: 'speed-range-min', type: 'number', default: 1,   help: 'Raw speed minimum (from discovery speed_range_min). Slider shows 0–100%; raw values are scaled to this range.'},
                {name: 'speed-range-max', type: 'number', default: 100, help: 'Raw speed maximum (from discovery speed_range_max). e.g. 9 for IKEA STARKVIND.'},
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-accent', type: 'color', default: '#64d2ff', help: 'Icon/state colour while on.'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-icon-size', default: '28px', help: 'Icon font size.'},
                {property: '--feezal-glass-font-size-state', default: '15px', help: 'State line font size.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Label font size.'},
                {property: '--feezal-glass-font-size-unit', default: '12px', help: 'Flip/detail button icon size.'},
            ],
            defaultStyle: {width: '150px', height: '110px'},
            restrict: {minWidth: 90, minHeight: 70},
        };
    }

    static properties = {
        size:            {type: String,  reflect: true},
        publish:         {type: String,  reflect: true},
        payloadOn:       {type: String,  reflect: true, attribute: 'payload-on'},
        payloadOff:      {type: String,  reflect: true, attribute: 'payload-off'},
        subscribeSpeed:  {type: String,  reflect: true, attribute: 'subscribe-speed'},
        msgPropSpeed:    {type: String,  reflect: true, attribute: 'message-property-speed'},
        publishSpeed:    {type: String,  reflect: true, attribute: 'publish-speed'},
        speedRangeMin:   {type: Number,  reflect: true, attribute: 'speed-range-min'},
        speedRangeMax:   {type: Number,  reflect: true, attribute: 'speed-range-max'},
        subscribePreset: {type: String,  reflect: true, attribute: 'subscribe-preset'},
        msgPropPreset:   {type: String,  reflect: true, attribute: 'message-property-preset'},
        publishPreset:   {type: String,  reflect: true, attribute: 'publish-preset'},
        presetModes:     {type: String,  reflect: true, attribute: 'preset-modes'},
        label:           {type: String,  reflect: true},
        icon:            {type: String,  reflect: true},
        // N31: availability inherited from FeezalElement.
        degrade:         {type: Boolean, reflect: true},
        discoveryId:     {type: String,  reflect: true, attribute: 'discovery-id'},
        _on:      {state: true},
        _speed:   {state: true},   // 0–100 or null
        _preset:  {state: true},
        _details: {state: true},   // details popup open
    };

    static styles = [feezalBaseStyles, feezalAvailabilityStyles, glassCardStyles, glassPopupStyles, css`
        .card {
            cursor: pointer;
            gap: 2px;
            transition: transform 0.15s ease, background 0.2s ease;
            touch-action: manipulation;
        }
        .card:active { transform: scale(0.97); }
        .card.on { background: var(--feezal-glass-on-tint, rgba(255,255,255,0.62)); }
        feezal-icon {
            font-size: var(--feezal-glass-icon-size, 28px); line-height: 1; display: inline-block; width: fit-content;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            transition: color 0.2s ease;
        }
        .card.on feezal-icon {
            color: var(--feezal-glass-accent, #64d2ff);
            animation: feezalGlassFanSpin var(--feezal-glass-fan-dur, 1.5s) linear infinite;
        }
        @keyframes feezalGlassFanSpin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
            .card.on feezal-icon { animation: none; }
        }
        .state { font-size: var(--feezal-glass-font-size-state, 15px); font-weight: 700; }
        .label {
            font-size: var(--feezal-glass-font-size-label, 12px); font-weight: 600; line-height: 1.2;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        /* Shared N31 badge, moved to the family's bottom-right corner (the
           tune button owns the top-right). */
        .feezal-unavail-badge { top: auto; bottom: 8px; right: 10px; }
        /* ── details popup (glass-light pattern) — browser top layer ── */
        /* Vertical speed pill (glass-cover pattern) — fill = speed %. */
        .vslider {
            position: relative; width: 72px; height: 170px; flex: 0 0 auto;
            border-radius: 20px; overflow: hidden; cursor: grab;
            background: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 12%, transparent);
            touch-action: none; user-select: none;
        }
        .vslider .fill {
            position: absolute; left: 0; right: 0; bottom: 0;
            background: var(--feezal-glass-on-tint, rgba(255,255,255,0.95));
        }
        .vslider .pct {
            position: absolute; left: 0; right: 0; bottom: 10px; text-align: center;
            font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums;
            pointer-events: none;
        }
        .vslider feezal-icon {
            position: absolute; left: 0; right: 0; top: 12px; text-align: center;
            font-size: 22px; width: auto; pointer-events: none; animation: none;
        }
        /* Preset chips */
        .presets { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; align-self: stretch; }
        .presets button {
            padding: 6px 12px; border: none; border-radius: 12px; cursor: pointer;
            background: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 8%, transparent);
            color: var(--feezal-glass-color, #1d1d1f);
            font-family: inherit; font-size: 12px; font-weight: 600; line-height: 1.2;
        }
        .presets button.active {
            background: var(--feezal-glass-accent, #64d2ff);
            color: #fff;
        }

        /* E105: wide-flat cards switch to a horizontal layout — icon left,
           state/label stacked right of it (family-wide 2:1 breakpoint). */
        @container (min-aspect-ratio: 2/1) {
            .card {
                display: grid;
                grid-template: 'icon state' auto 'icon label' auto / auto 1fr;
                align-content: center;
                align-items: center;
                column-gap: 10px;
                text-align: left;
            }
            .card > feezal-icon { grid-area: icon; }
            .card .state { grid-area: state; align-self: end; }
            .card .label { grid-area: label; align-self: start; }
        }
    `];

    constructor() {
        super();
        this.size = '';
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
        this.icon = 'mode_fan';
        this.degrade = false;
        this.discoveryId = '';
        this._on = false;
        this._speed = null;
        this._preset = null;
        this._details = false;
        this._pressTimer = null;
        this._longPressed = false;
        this._suppressTap = false;
        // Outside tap closes the details popup; a tap landing back on the
        // card must not also toggle the fan.
        this.__outsideDown = e => {
            const path = e.composedPath();
            if (path.includes(this.renderRoot?.querySelector('.details'))) return;
            this._closeDetails();
            if (path.includes(this)) this._suppressTap = true;
        };
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    connectedCallback() {
        super.connectedCallback();
        this._wireSubscriptions();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearTimeout(this._pressTimer);
        document.removeEventListener('pointerdown', this.__outsideDown);
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
        // The size grid writes the element's inline geometry (editor keeps
        // full manual control afterwards).
        if (changed.has('size')) applySizePreset(this);
        // Promote the details popup into the top layer (glass-light pattern).
        if (changed.has('_details') && this._details) {
            const popup = this.renderRoot.querySelector('.details');
            if (popup?.showPopover && !popup.matches(':popover-open')) {
                try { popup.showPopover(); } catch { /* fixed+z-index fallback */ }
            }
            this._positionDetails();
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
            });
        }

        if (this.subscribeSpeed) {
            this.addSubscription(this.subscribeSpeed, msg => {
                const raw = Number(this.getProperty(msg, this.msgPropSpeed || this.messageProperty));
                if (!isNaN(raw)) {
                    const lo = this.speedRangeMin ?? 1;
                    const hi = this.speedRangeMax ?? 100;
                    // Normalise raw device units to 0–100 % for the pill
                    this._speed = (hi === lo) ? 0 : Math.max(0, Math.min(100, ((raw - lo) / (hi - lo)) * 100));
                }
            });
        }

        if (this.subscribePreset) {
            this.addSubscription(this.subscribePreset, msg => {
                this._preset = String(this.getProperty(msg, this.msgPropPreset || this.messageProperty));
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
    }

    _setPreset(mode) {
        if (feezal.isEditor) return;
        this._preset = mode;
        if (this.publishPreset) {
            feezal.connection.pub(this.publishPreset, mode);
        }
    }

    // ── interaction: tap toggles, long-press (or ⋯) opens the details popup ──

    _onPointerDown() {
        if (feezal.isEditor) return;
        this._longPressed = false;
        clearTimeout(this._pressTimer);
        this._pressTimer = setTimeout(() => {
            this._longPressed = true;
            this.openDetails();
        }, LONG_PRESS_MS);
    }

    _onPointerUp() {
        clearTimeout(this._pressTimer);
        if (this._suppressTap) {
            this._suppressTap = false;
            return;
        }
        if (!this._longPressed && !this._details) {
            this.toggle();
        }
    }

    _onPointerLeave() {
        clearTimeout(this._pressTimer);
    }

    openDetails() {
        if (feezal.isEditor || this._details) return;
        this._details = true;
        // Deferred: don't catch the very tap that opened the popup.
        setTimeout(() => {
            if (this._details) document.addEventListener('pointerdown', this.__outsideDown);
        });
    }

    _closeDetails() {
        this._details = false;
        document.removeEventListener('pointerdown', this.__outsideDown);
    }

    // ── details popup controls ────────────────────────────────────────────────

    /** Vertical speed pill: pointer position → %; publish on release. */
    _vsliderDown(e) {
        if (feezal.isEditor) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        this.__vsliderDragging = true;
        this._vsliderApply(e);
    }

    _vsliderMove(e) {
        if (this.__vsliderDragging) this._vsliderApply(e);
    }

    _vsliderUp(e) {
        if (!this.__vsliderDragging) return;
        this.__vsliderDragging = false;
        this._vsliderApply(e);
        this._setSpeed(this._speed ?? 0);
    }

    _vsliderApply(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = Math.round((1 - (e.clientY - rect.top) / rect.height) * 100);
        this._speed = Math.max(0, Math.min(100, pct));
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

    _presets() {
        try {
            const arr = JSON.parse(this.presetModes);
            return Array.isArray(arr) ? arr : [];
        } catch {
            return [];
        }
    }

    _stateText() {
        if (!this._on) return 'Off';
        return this._speed !== null ? `On • ${Math.round(this._speed)} %` : 'On';
    }

    _hasSpeed() {
        return Boolean(this.subscribeSpeed || this.publishSpeed);
    }

    _renderDetails() {
        const presets = this._presets();
        const pct = Math.round(this._speed ?? 0);
        return html`
            <div class="details" popover="manual">
                <div class="title">${this.label || 'Fan'}</div>
                ${this._hasSpeed() ? html`
                    <div class="vslider"
                        @pointerdown="${this._vsliderDown}"
                        @pointermove="${this._vsliderMove}"
                        @pointerup="${this._vsliderUp}">
                        <div class="fill" style="height:${pct}%"></div>
                        <feezal-icon name="${this.icon || 'mode_fan'}"></feezal-icon>
                        <div class="pct">${pct} %</div>
                    </div>` : ''}
                ${presets.length > 0 ? html`
                    <div class="presets">
                        ${presets.map(p => html`
                            <button class="${this._preset === p ? 'active' : ''}"
                                @click="${() => this._setPreset(p)}">${p}</button>`)}
                    </div>` : ''}
            </div>`;
    }

    render() {
        const hasDetail = this._hasSpeed() || this._presets().length > 0;
        const dur = speedDuration(this._speed ?? 50);
        return html`
            <div class="card ${this._on ? 'on' : ''}" role="button" tabindex="0"
                @pointerdown="${this._onPointerDown}"
                @pointerup="${this._onPointerUp}"
                @pointerleave="${this._onPointerLeave}"
                @keydown="${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(); } }}">
                ${hasDetail ? html`
                    <button class="flip-btn" title="Details"
                        @pointerdown="${e => e.stopPropagation()}"
                        @pointerup="${e => e.stopPropagation()}"
                        @click="${e => { e.stopPropagation(); this.openDetails(); }}">tune</button>` : ''}
                ${availabilityBadge(this._available)}
                <feezal-icon name="${this.icon || 'mode_fan'}" style="--feezal-glass-fan-dur: ${dur}"></feezal-icon>
                <span class="state">${this._stateText()}</span>
                <span class="label">${this.label || (feezal.isEditor ? 'Fan' : '')}</span>
            </div>
            ${this._details ? this._renderDetails() : ''}
        `;
    }
}

customElements.define('feezal-element-glass-fan', FeezalElementGlassFan);
export {FeezalElementGlassFan};

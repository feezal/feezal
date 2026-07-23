/* global feezal */
import {feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';
// E137: the WLED behavior lives in the shared controller — this element is
// a VIEW (glass chrome: frost tile + details popup). The effect/palette
// name tables are bundled once in the controller package.
import {WledController, wledAttributes, wledDiscoveryMap, WLED_EFFECTS, WLED_PALETTES} from '@feezal/feezal-controller-wled';
import {applySizePreset, glassCardStyles, glassPopupStyles, FeezalGlassCard} from '@feezal/feezal-glass';

/**
 * feezal-element-glass-wled (E103 MVP)
 *
 * Frosted-glass WLED tile — tap toggles; long-press (or the tune button)
 * opens the details popup: vertical brightness pill, colour swatch, effect
 * and palette pickers.
 *
 * MQTT contract identical to feezal-element-circle-wled (keep in sync):
 * subscribes `<topic>/g` (brightness 0–255, 0 = off) and `<topic>/c`
 * ("#RRGGBB"); `<topic>/v` is ignored. Commands go to `<topic>/api` as
 * /json/state JSON ({"on":bool}, {"bri":n}, {"seg":[{"col":[[r,g,b]]}]},
 * {"seg":[{"fx":id}]}, {"seg":[{"pal":id}]}), optional `transition`
 * (seconds → WLED 0.1 s units). Availability auto-derives `<topic>/status`
 * when subscribe-availability is empty (user override wins); the N31 base
 * machinery subscribes. Effect/palette names come from the bundled WLED
 * 0.14 lists; ids beyond the lists display numerically.
 *
 * Family conventions (frost vars, degrade, squircle): see glass-button.
 */

const LONG_PRESS_MS = 450;

class FeezalElementGlassWled extends FeezalGlassCard {
    static get feezal() {
        return {
            palette: {name: 'WLED', category: 'Glass', color: '#7aa5c9', icon: 'wb_iridescent'},
            description: 'Frosted-glass WLED tile — tap toggles; long-press (or the ⋯ button) opens the details popup: ' +
                'brightness pill, colour swatch, effect and palette pickers. Same MQTT contract as the material WLED card.',
            links: [
                {label: 'WLED MQTT docs', url: 'https://kno.wled.ge/interfaces/mqtt/'},
            ],
            // E108: native WLED self-discovery. The server synthesises a
            // `component:'wled'` entity (device_topic + availability) from native
            // WLED topics; the ⚡ picker / Auto-configure banner stamps it here.
            // Availability is applied automatically by _applyDiscovery from the
            // entity's availability_normalized record (no map entry needed).
            // E137: the discovery map is the controller package's fragment.
            discovery: {component: 'wled', map: wledDiscoveryMap},
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x2', '2x1'], default: '',
                    help: 'Preset size: 2x2 = square (150×150), 2x1 = wide (150×75). Empty keeps the current/manual size.'},
                // E137: the shared WLED contract (topic/transition/speed/
                // intensity read-backs/presets) — declared ONCE.
                ...wledAttributes,
                {name: 'label', type: 'string', help: 'Card label.'},
                {name: 'label-on',  type: 'string', default: 'On',  help: 'Displayed state text while on (localise). Display only.'},
                {name: 'label-off', type: 'string', default: 'Off', help: 'Displayed state text while off (localise). Display only.'},
                {name: 'icon', type: 'string', default: 'wb_iridescent', help: 'Icon name.'},
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
                {name: 'show-effect', type: 'boolean', default: true,
                    help: 'Show the effect picker and its speed/intensity sliders in the details popup.'},
                {name: 'show-palette', type: 'boolean', default: true,
                    help: 'Show the palette picker in the details popup.'},
                {name: 'show-presets', type: 'boolean', default: false,
                    help: 'Show a preset selector in the details popup that recalls a WLED preset via {"ps":<id>} on <topic>/api.'},
                {name: 'subscribe-availability', type: 'mqttTopic',
                    help: 'Availability topic (retained online/offline). Empty = auto-derived <topic>/status; set to override.'},
                {name: 'availability-mode', type: 'select', options: ['all', 'any'], default: 'all',
                    help: 'With multiple availability topics: all = every topic must report available; any = at least one.'},
                {name: 'payload-available', type: 'string', default: 'online', help: 'Payload meaning the device is available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning the device is unavailable.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-accent', type: 'color', default: '#ff9f0a',
                    help: 'Icon/state colour while on (overridden by the live strip colour when known).'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-icon-size', default: '28px', help: 'Icon font size.'},
                {property: '--feezal-glass-font-size-state', default: '15px', help: 'State line font size.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Label font size.'},
                {property: '--feezal-glass-font-size-unit', default: '12px', help: 'Flip/detail button icon size.'},
            ],
            defaultStyle: {width: '172px', height: '128px'},
            restrict: {minWidth: 90, minHeight: 70},
        };
    }

    static properties = {
        size:       {type: String, reflect: true},
        topic:      {type: String, reflect: true},
        transition: {type: String, reflect: true},
        label:      {type: String, reflect: true},
        labelOn:    {type: String, reflect: true, attribute: 'label-on'},
        labelOff:   {type: String, reflect: true, attribute: 'label-off'},
        icon:       {type: String, reflect: true},
        degrade:    {type: Boolean, reflect: true},
        showEffect:         {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-effect'},
        showPalette:        {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-palette'},
        subscribeSpeed:     {type: String, reflect: true, attribute: 'subscribe-speed'},
        msgPropSpeed:       {type: String, reflect: true, attribute: 'message-property-speed'},
        subscribeIntensity: {type: String, reflect: true, attribute: 'subscribe-intensity'},
        msgPropIntensity:   {type: String, reflect: true, attribute: 'message-property-intensity'},
        showPresets:        {type: Boolean, reflect: true, attribute: 'show-presets'},
        presets:            {type: String, reflect: true},
        // E137: WLED state lives on the WledController (plain fields +
        // host.requestUpdate).
    };

    static styles = [feezalBaseStyles, glassCardStyles, glassPopupStyles, css`
        .card {
            cursor: pointer;
            gap: 2px;
            transition: transform 0.15s ease, background 0.2s ease;
            touch-action: manipulation;
        }
        .card:active { transform: scale(0.97); }
        .card.on { background: var(--feezal-glass-on-tint, rgba(255,255,255,0.62)); }
        feezal-icon {
            font-size: var(--feezal-glass-icon-size, 28px); line-height: 1;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            transition: color 0.2s ease;
        }
        .card.on feezal-icon { color: var(--wled-accent, var(--feezal-glass-accent, #ff9f0a)); }
        .state { font-size: var(--feezal-glass-font-size-state, 15px); font-weight: 700; }
        .label {
            font-size: var(--feezal-glass-font-size-label, 12px); font-weight: 600; line-height: 1.2;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .unavail {
            position: absolute; bottom: 8px; right: 10px;
            font-size: 12px; color: var(--error-color, #d32f2f); opacity: 0.85;
        }
        /* E105: much wider than tall → horizontal layout (Apple-Home wide
           tile): icon left, state/label stacked right of it. flip-btn and
           unavail stay absolutely positioned in their corners. */
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
        /* ── details popup — browser TOP LAYER via the popover API
           (glass-light pattern); fixed+z-index is the fallback. E106:
           glass-wled uses a tighter 14px gap than the other popup cards
           (glassPopupStyles' fragment default is 16px) — override locally,
           cascades after the fragment so it wins. */
        .details { gap: 14px; }
        /* Big vertical brightness pill — filled from the bottom, drag anywhere. */
        .vslider {
            position: relative; width: 72px; height: 150px; flex: 0 0 auto;
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
            font-size: 22px; pointer-events: none;
        }
        .swatch-row {
            display: flex; align-items: center; gap: 8px; align-self: stretch;
            font-size: 12px; font-weight: 600;
        }
        input[type='color'].col {
            width: 34px; height: 34px; padding: 0; border-radius: 50%;
            border: 1px solid rgba(0,0,0,0.2); background: none; cursor: pointer; flex: 0 0 auto;
        }
        select {
            align-self: stretch; box-sizing: border-box; min-width: 0;
            background: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 8%, transparent);
            color: var(--feezal-glass-color, #1d1d1f);
            border: 1px solid var(--feezal-glass-border, rgba(0,0,0,0.15));
            border-radius: 10px; padding: 5px 8px; font: inherit; font-size: 12px;
            cursor: pointer; outline: none;
            /* B38: the closed control follows the glass palette above, but
               Chromium's open option list does NOT composite over the
               blurred card — it needs a SOLID background. A fixed dark
               solid + light text is deliberately independent of the
               card's own (possibly light) theme colours, so the popup
               list stays readable regardless of which theme is active. */
            color-scheme: dark;
        }
        select option {
            background: #1d1d1f;
            color: #fff;
        }
        .slider-row { align-self: stretch; display: flex; flex-direction: column; gap: 2px; }
        .mini-label { font-size: 11px; font-weight: 600; opacity: 0.7; }
        input[type='range'] {
            width: 100%; accent-color: var(--wled-accent, var(--feezal-glass-accent, #ff9f0a));
        }
        input[type='number'].preset-num {
            align-self: stretch; box-sizing: border-box;
            background: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 8%, transparent);
            color: var(--feezal-glass-color, #1d1d1f);
            border: 1px solid var(--feezal-glass-border, rgba(0,0,0,0.15));
            border-radius: 10px; padding: 5px 8px; font: inherit; font-size: 12px; outline: none;
        }
    `];

    constructor() {
        super();
        this.size       = '';
        this.topic      = '';
        this.transition = '';
        this.label      = '';
        this.labelOn    = 'On';
        this.labelOff   = 'Off';
        this.icon       = 'wb_iridescent';
        this.degrade    = false;
        this.showEffect         = true;
        this.showPalette        = true;
        this.subscribeSpeed     = '';
        this.msgPropSpeed       = '';
        this.subscribeIntensity = '';
        this.msgPropIntensity   = '';
        this.showPresets        = false;
        this.presets            = '';
        this._pressTimer  = null;
        this._longPressed = false;
        // E137: the behavior layer — wires/parses/publishes; this view renders.
        this.wled = new WledController(this);
    }

    connectedCallback() {
        // E137: derive <topic>/status BEFORE the N31 base subscribes.
        this.wled.deriveAvailability();
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearTimeout(this._pressTimer);
    }

    willUpdate(changed) {
        super.willUpdate?.(changed);
        if (changed.has('topic') || changed.has('subscribeAvailability')) {
            this.wled.deriveAvailability();
        }
    }

    updated(changed) {
        super.updated(changed);
        // E137: live-canvas topic edits re-wire through the controller.
        this.wled.rewireIfChanged();
        // The size grid writes the element's inline geometry (editor keeps
        // full manual control afterwards).
        if (changed.has('size')) applySizePreset(this);
        // Promote the details popup into the top layer (popover pattern).
        if (changed.has('_details') && this._details) {
            const popup = this.renderRoot.querySelector('.details');
            if (popup?.showPopover && !popup.matches(':popover-open')) {
                try { popup.showPopover(); } catch { /* fixed+z-index fallback */ }
            }
            this._positionDetails();
        }
    }

    // ── E137: commands + computed values delegate to the controller ─────────

    toggle()             { this.wled.toggle(); }
    setBrightnessPct(p)  { this.wled.setBrightnessPct(p); }
    setColor(hex)        { this.wled.setColor(hex); }
    _onColorInput(hex)   { this.wled.colorInput(hex); }
    setEffect(id)        { this.wled.setEffect(id); }
    setPalette(id)       { this.wled.setPalette(id); }
    setSpeedPct(p)       { this.wled.setSpeedPct(p); }
    setIntensityPct(p)   { this.wled.setIntensityPct(p); }
    setPreset(id)        { this.wled.setPreset(id); }

    get _pct()          { return this.wled.pct; }
    get _speedPct()     { return this.wled.speedPct; }
    get _intensityPct() { return this.wled.intensityPct; }
    get _presetsList()  { return this.wled.presetsList; }

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

    /** Vertical brightness pill: pointer position → %; publish on release. */
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
        this.setBrightnessPct(this.wled.pct ?? 0);
    }

    _vsliderApply(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = Math.round((1 - (e.clientY - rect.top) / rect.height) * 100);
        // Live drag preview writes the controller field; release publishes.
        this.wled.bri = Math.round((Math.max(0, Math.min(100, pct)) / 100) * 255);
        this.requestUpdate();
    }

    _stateText() {
        if (!this.wled.on) return this.labelOff || 'Off';
        const on = this.labelOn || 'On';
        return this._pct !== null ? `${on} • ${this._pct} %` : on;
    }

    _renderPresets() {
        if (!this.showPresets) return '';
        const list = this._presetsList;
        if (list.length > 0) {
            return html`
                <select class="preset" title="Preset"
                    @change="${e => { if (e.target.value !== '') this.setPreset(e.target.value); }}">
                    <option value="" selected>— Preset —</option>
                    ${list.map(p => html`<option value="${p.id}">${p.name ?? p.id}</option>`)}
                </select>`;
        }
        return html`
            <input type="number" class="preset-num" min="0" step="1" placeholder="Preset #" title="Preset #"
                @change="${e => { if (e.target.value !== '') this.setPreset(e.target.value); }}">`;
    }

    _renderDetails() {
        const fxBeyond = this.wled.fx !== null && this.wled.fx >= WLED_EFFECTS.length;
        const palBeyond = this.wled.pal !== null && this.wled.pal >= WLED_PALETTES.length;
        return html`
            <div class="details" popover="manual">
                <div class="title">${this.label || 'WLED'}</div>
                <div class="vslider"
                    @pointerdown="${this._vsliderDown}"
                    @pointermove="${this._vsliderMove}"
                    @pointerup="${this._vsliderUp}">
                    <div class="fill" style="height:${this._pct ?? 0}%"></div>
                    <feezal-icon name="${this.icon || 'wb_iridescent'}"></feezal-icon>
                    <div class="pct">${this._pct ?? 0} %</div>
                </div>
                <div class="swatch-row">
                    <input type="color" class="col" title="Colour"
                        .value="${this.wled.color ?? '#ffffff'}"
                        @input="${e => this._onColorInput(e.target.value)}"
                        @change="${e => this.setColor(e.target.value)}">
                    <span>Colour</span>
                </div>
                ${this.showEffect ? html`
                    <select class="fx" title="Effect"
                        @change="${e => { if (e.target.value !== '') this.setEffect(e.target.value); }}">
                        <option value="" ?selected="${this.wled.fx === null}">— Effect —</option>
                        ${WLED_EFFECTS.map((name, i) => html`
                            <option value="${i}" ?selected="${this.wled.fx === i}">${name}</option>`)}
                        ${fxBeyond ? html`<option value="${this.wled.fx}" selected>${this.wled.fx}</option>` : ''}
                    </select>
                    <div class="slider-row">
                        <span class="mini-label">Speed</span>
                        <input type="range" class="speed" min="0" max="100" step="1" title="Effect speed"
                            .value="${String(this._speedPct)}"
                            @change="${e => this.setSpeedPct(e.target.value)}">
                    </div>
                    <div class="slider-row">
                        <span class="mini-label">Intensity</span>
                        <input type="range" class="intensity" min="0" max="100" step="1" title="Effect intensity"
                            .value="${String(this._intensityPct)}"
                            @change="${e => this.setIntensityPct(e.target.value)}">
                    </div>
                ` : ''}
                ${this.showPalette ? html`
                    <select class="pal" title="Palette"
                        @change="${e => { if (e.target.value !== '') this.setPalette(e.target.value); }}">
                        <option value="" ?selected="${this.wled.pal === null}">— Palette —</option>
                        ${WLED_PALETTES.map((name, i) => html`
                            <option value="${i}" ?selected="${this.wled.pal === i}">${name}</option>`)}
                        ${palBeyond ? html`<option value="${this.wled.pal}" selected>${this.wled.pal}</option>` : ''}
                    </select>
                ` : ''}
                ${this._renderPresets()}
            </div>`;
    }

    render() {
        const accent = this.wled.on && this.wled.color ? this.wled.color : '';
        return html`
            <div class="card ${this.wled.on ? 'on' : ''}" role="button" tabindex="0"
                style="${accent ? `--wled-accent:${accent}` : ''}"
                @pointerdown="${this._onPointerDown}"
                @pointerup="${this._onPointerUp}"
                @pointerleave="${this._onPointerLeave}"
                @keydown="${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(); } }}">
                <button class="flip-btn" title="Details"
                    @pointerdown="${e => e.stopPropagation()}"
                    @pointerup="${e => e.stopPropagation()}"
                    @click="${e => { e.stopPropagation(); this.openDetails(); }}">tune</button>
                ${!this._available ? html`<span class="unavail" title="Device unavailable">⚠</span>` : ''}
                <feezal-icon name="${this.icon || 'wb_iridescent'}"></feezal-icon>
                <span class="state">${this._stateText()}</span>
                <span class="label">${this.label || (feezal.isEditor ? 'WLED' : '')}</span>
            </div>
            ${this._details ? this._renderDetails() : ''}
        `;
    }
}

customElements.define('feezal-element-glass-wled', FeezalElementGlassWled);
export {FeezalElementGlassWled};

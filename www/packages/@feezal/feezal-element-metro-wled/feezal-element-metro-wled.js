/* global feezal */
import {feezalBoolean, html, css} from '@feezal/feezal-element';
import {MetroTileBase} from '@feezal/feezal-element-metro-tile';
// E137: the WLED behavior lives in the shared controller — this element is
// a VIEW (Metro tile chrome: front state, back controls). The effect/palette
// name tables are bundled once in the controller package.
import {WledController, wledAttributes, wledDiscoveryMap, WLED_EFFECTS, WLED_PALETTES, effectName} from '@feezal/feezal-controller-wled';

/**
 * feezal-element-metro-wled (E103 MVP)
 *
 * Metro WLED tile — flat live tile: the front shows the state (on/off,
 * brightness %, current effect name) and a tap toggles; the back (3D flip
 * via ⋯) holds the brightness slider, colour swatch and effect / palette
 * pickers.
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
 */
class FeezalElementMetroWled extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'WLED', category: 'Metro', color: '#1ba1e2', icon: 'wb_iridescent'},
            description: 'Metro WLED tile: tap toggles; the front shows brightness and effect, ' +
                'the back holds brightness, colour, effect and palette controls. Same MQTT contract as the material WLED card.',
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
                ...MetroTileBase.tileAttributes,
                // E137: the shared WLED contract (topic/transition/speed/
                // intensity read-backs/presets) — declared ONCE.
                ...wledAttributes,
                {name: 'show-effect', type: 'boolean', default: true,
                    help: 'Show the effect picker and its speed/intensity sliders on the back face.'},
                {name: 'show-palette', type: 'boolean', default: true,
                    help: 'Show the palette picker on the back face.'},
                {name: 'show-presets', type: 'boolean', default: false,
                    help: 'Show a preset selector on the back face that recalls a WLED preset via {"ps":<id>} on <topic>/api.'},
                {name: 'subscribe-availability', type: 'mqttTopic',
                    help: 'Availability topic (retained online/offline). Empty = auto-derived <topic>/status; set to override.'},
                {name: 'availability-mode', type: 'select', options: ['all', 'any'], default: 'all',
                    help: 'With multiple availability topics: all = every topic must report available; any = at least one.'},
                {name: 'payload-available', type: 'string', default: 'online', help: 'Payload meaning the device is available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning the device is unavailable.'},
            ],
            styles: [
                ...MetroTileBase.tileStyles,
                {property: '--feezal-metro-off-color', type: 'color', default: '#333333', help: 'Tile colour in the OFF state.'},
            ],
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
        };
    }

    static properties = {
        topic:      {type: String, reflect: true},
        transition: {type: String, reflect: true},
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

    static styles = [MetroTileBase.styles, css`
        :host { --feezal-metro-off-color: #333; }
        .face { transition: background 0.15s; }
        :host(:not([data-on])) .face { background: var(--feezal-metro-off-color); }
        .state { font-size: var(--_metro-unit-size); text-transform: lowercase; opacity: 0.85; }   /* E129 */
        .fxname {
            font-size: 11px; opacity: 0.7;
            max-width: 90%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .unavail {
            position: absolute; top: 4px; left: 6px; font-size: 13px;
            color: var(--feezal-metro-text); opacity: 0.9;
        }
        .onoff { display: flex; justify-content: center; gap: 8px; }
        select {
            width: 100%; min-width: 0; box-sizing: border-box;
            background: transparent; color: var(--feezal-metro-text);
            border: 2px solid var(--feezal-metro-text);
            font: inherit; font-size: 12px; padding: 2px 4px; cursor: pointer; outline: none;
            /* B38: was "select option { color: #000 }" with no background —
               black text on whatever the UA's (possibly dark) default
               option background is turns unreadable. color-scheme plus a
               solid option background/colour below fixes both cases. */
            color-scheme: light dark;
        }
        /* B38: --feezal-metro-off-color is an explicit solid dark tone
           authored to pair with --feezal-metro-text (default white) —
           reuse it for the open option list so it stays readable
           regardless of the tile's current on/off accent colour. */
        select option {
            background: var(--feezal-metro-off-color, #333333);
            color: var(--feezal-metro-text);
        }
        input[type='color'].col {
            width: 26px; height: 26px; padding: 0; border: 2px solid var(--feezal-metro-text);
            border-radius: 0; background: none; cursor: pointer; flex: 0 0 auto;
        }
        .slider-row { display: flex; flex-direction: column; gap: 1px; align-self: stretch; }
        .mini-label { font-size: 10px; opacity: 0.75; color: var(--feezal-metro-text); }
        input[type='range'] { width: 100%; accent-color: var(--feezal-metro-text); }
        input[type='number'].preset-num {
            width: 100%; box-sizing: border-box;
            background: transparent; color: var(--feezal-metro-text);
            border: 2px solid var(--feezal-metro-text);
            font: inherit; font-size: 12px; padding: 2px 4px; outline: none;
        }
    `];

    constructor() {
        super();
        this.topic      = '';
        this.transition = '';
        this.showEffect         = true;
        this.showPalette        = true;
        this.subscribeSpeed     = '';
        this.msgPropSpeed       = '';
        this.subscribeIntensity = '';
        this.msgPropIntensity   = '';
        this.showPresets        = false;
        this.presets            = '';
        // E137: the behavior layer — wires/parses/publishes; this view renders.
        this.wled = new WledController(this);
    }

    connectedCallback() {
        // E137: derive <topic>/status BEFORE the N31 base subscribes.
        this.wled.deriveAvailability();
        super.connectedCallback();
    }

    willUpdate(changed) {
        super.willUpdate?.(changed);
        if (changed.has('topic') || changed.has('subscribeAvailability')) {
            this.wled.deriveAvailability();
        }
    }

    updated(changed) {
        super.updated(changed);
        this.toggleAttribute('data-on', this.wled.on);
        // E137: live-canvas topic edits re-wire through the controller.
        this.wled.rewireIfChanged();
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

    // ── Faces ─────────────────────────────────────────────────────────────────

    baseAction() {
        this.toggle();
    }

    renderFront() {
        const pct = this._pct !== null && this.wled.on ? ` ${this._pct}%` : '';
        return html`
            ${this._available ? '' : html`<span class="unavail" title="Device unavailable">⚠</span>`}
            ${this.icon ? html`<feezal-icon name="${this.icon || 'wb_iridescent'}"></feezal-icon>` : ''}
            <div class="state">${this.wled.on ? `on${pct}` : 'off'}</div>
            ${this.wled.on && this.wled.fx !== null ? html`<div class="fxname">${effectName(this.wled.fx)}</div>` : ''}`;
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

    renderBack() {
        const fxBeyond = this.wled.fx !== null && this.wled.fx >= WLED_EFFECTS.length;
        const palBeyond = this.wled.pal !== null && this.wled.pal >= WLED_PALETTES.length;
        return html`
            <div class="onoff">
                <button class="mbtn ${this.wled.on ? 'active' : ''}" @click="${() => { if (!this.wled.on) this.toggle(); }}">ON</button>
                <button class="mbtn ${this.wled.on ? '' : 'active'}" @click="${() => { if (this.wled.on) this.toggle(); }}">OFF</button>
            </div>
            <div class="rowline">
                <input type="color" class="col" title="Colour"
                    .value="${this.wled.color ?? '#ffffff'}"
                    @input="${e => this._onColorInput(e.target.value)}"
                    @change="${e => this.setColor(e.target.value)}">
                <input type="range" min="0" max="100" step="1" title="Brightness"
                    .value="${String(this._pct ?? 0)}"
                    @change="${e => this.setBrightnessPct(e.target.value)}">
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
            ${this._renderPresets()}`;
    }
}

customElements.define('feezal-element-metro-wled', FeezalElementMetroWled);
export {FeezalElementMetroWled};

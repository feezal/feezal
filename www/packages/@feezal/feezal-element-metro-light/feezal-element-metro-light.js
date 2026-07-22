/* global feezal */
import {html, css} from '@feezal/feezal-element';
import '@feezal/feezal-element/feezal-topic-input.js';
import {LitElement} from 'lit';
import {MetroTileBase} from '@feezal/feezal-element-metro-tile';
// E137: the light behavior lives in the shared controller — this element
// is a VIEW (Metro tile chrome: flip faces, back-face sliders, state icons).
import {LightController, lightAttributes, lightDiscoveryMap, pctToRaw, rgbToHsv} from '@feezal/feezal-controller-light';

/**
 * feezal-element-metro-light (E55)
 *
 * Light tile: tap toggles on/off (whole tile, Metro-style); the back holds
 * the detail controls per `mode` — brightness / brightness+ct / colour
 * temperature / RGB / hue-saturation sliders.
 *
 * E137: the MQTT contract (both payload modes, E77 brightness-derived
 * on/off incl. OLD_LEVEL, E127 ramp settling, CT kelvin/mired, RGB/HS,
 * effects and white channels) is the shared LightController's — declared
 * once, identical to material-light. The tile back renders no effect/white
 * chrome (tile scope), but the attributes are part of the shared contract.
 */

// E137: pctToRaw lives in @feezal/feezal-element/feezal-color.js now —
// re-exported here for back-compat with prior importers (tests).
export {pctToRaw};

class FeezalElementMetroLight extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Light', category: 'Metro', color: '#1ba1e2', icon: 'lightbulb'},
            description: 'Metro light tile: tap toggles; the back holds the mode\'s detail sliders (brightness / colour temperature / RGB / hue-saturation). Wiring contract identical to material-light incl. json payload mode and brightness-derived on/off (HmIP/Homematic dimmers).',
            inspector: 'feezal-element-metro-light-inspector',
            // E137: the discovery map is the controller package's fragment —
            // zigbee2mqtt / HA discovery emits the JSON schema → payload-mode
            // json with base topic + …/set, capability ranges + active mode.
            // NOTE: metro-light has no availability attributes (tile scope),
            // so availability keys are stamped but harmlessly ignored.
            discovery: {component: 'light', map: lightDiscoveryMap},
            attributes: [
                ...MetroTileBase.tileAttributes,
                // E137: the shared light contract (both payload modes, E77
                // on/off-from-brightness, E127 settling, CT/RGB/HS/effects/
                // white channels) — declared ONCE by the controller package.
                ...lightAttributes,
                // State icons (tile chrome)
                {name: 'icon-on',  type: 'icon', help: 'Icon shown while ON (empty = the base icon).'},
                {name: 'icon-off', type: 'icon', help: 'Icon shown while OFF (empty = the base icon).'},
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
        payloadMode:   {type: String, reflect: true, attribute: 'payload-mode'},
        publish:       {type: String, reflect: true},
        jsonMap:       {type: String, reflect: true, attribute: 'json-map'},
        onOffSource:   {type: String, reflect: true, attribute: 'on-off-source'},
        subscribeState: {type: String, reflect: true, attribute: 'subscribe-state'},
        msgPropState:   {type: String, reflect: true, attribute: 'message-property-state'},
        publishState:   {type: String, reflect: true, attribute: 'publish-state'},
        payloadOn:      {type: String, reflect: true, attribute: 'payload-on'},
        payloadOff:     {type: String, reflect: true, attribute: 'payload-off'},
        subscribeBrightness: {type: String, reflect: true, attribute: 'subscribe-brightness'},
        // E127: ramp settling
        subscribeWorking:    {type: String, reflect: true, attribute: 'subscribe-working'},
        msgPropWorking:      {type: String, reflect: true, attribute: 'message-property-working'},
        subscribeSettled:    {type: String, reflect: true, attribute: 'subscribe-settled'},
        msgPropSettled:      {type: String, reflect: true, attribute: 'message-property-settled'},
        settleTimeout:       {type: Number, reflect: true, attribute: 'settle-timeout'},
        reportDelayMs:       {type: Number, reflect: true, attribute: 'report-delay-ms'},
        msgPropBrightness:   {type: String, reflect: true, attribute: 'message-property-brightness'},
        publishBrightness:   {type: String, reflect: true, attribute: 'publish-brightness'},
        brightnessMin: {type: Number, reflect: true, attribute: 'brightness-min'},
        brightnessMax: {type: Number, reflect: true, attribute: 'brightness-max'},
        subscribeColorTemp: {type: String, reflect: true, attribute: 'subscribe-color-temp'},
        msgPropColorTemp:   {type: String, reflect: true, attribute: 'message-property-color-temp'},
        publishColorTemp:   {type: String, reflect: true, attribute: 'publish-color-temp'},
        colorTempUnit: {type: String, reflect: true, attribute: 'color-temp-unit'},
        colorTempMin:  {type: Number, reflect: true, attribute: 'color-temp-min'},
        colorTempMax:  {type: Number, reflect: true, attribute: 'color-temp-max'},
        subscribeRgb: {type: String, reflect: true, attribute: 'subscribe-rgb'},
        msgPropRgb:   {type: String, reflect: true, attribute: 'message-property-rgb'},
        publishRgb:   {type: String, reflect: true, attribute: 'publish-rgb'},
        subscribeHs:  {type: String, reflect: true, attribute: 'subscribe-hs'},
        msgPropHs:    {type: String, reflect: true, attribute: 'message-property-hs'},
        publishHs:    {type: String, reflect: true, attribute: 'publish-hs'},
        mode:         {type: String, reflect: true},
        // E137: contract completeness — effects + white channels (no tile
        // chrome renders them, but attribute edits must trigger updated()).
        subscribeEffect:    {type: String, reflect: true, attribute: 'subscribe-effect'},
        publishEffect:      {type: String, reflect: true, attribute: 'publish-effect'},
        effects:            {type: String, reflect: true},
        msgPropEffect:      {type: String, reflect: true, attribute: 'message-property-effect'},
        subscribeWhite:     {type: String, reflect: true, attribute: 'subscribe-white'},
        publishWhite:       {type: String, reflect: true, attribute: 'publish-white'},
        msgPropWhite:       {type: String, reflect: true, attribute: 'message-property-white'},
        subscribeWarmWhite: {type: String, reflect: true, attribute: 'subscribe-warm-white'},
        publishWarmWhite:   {type: String, reflect: true, attribute: 'publish-warm-white'},
        msgPropWarmWhite:   {type: String, reflect: true, attribute: 'message-property-warm-white'},
        subscribeColdWhite: {type: String, reflect: true, attribute: 'subscribe-cold-white'},
        publishColdWhite:   {type: String, reflect: true, attribute: 'publish-cold-white'},
        msgPropColdWhite:   {type: String, reflect: true, attribute: 'message-property-cold-white'},
        iconOn:       {type: String, reflect: true, attribute: 'icon-on'},
        iconOff:      {type: String, reflect: true, attribute: 'icon-off'},
        discoveryId:  {type: String, reflect: true, attribute: 'discovery-id'},
        // E137: light state lives on the LightController (plain fields +
        // host.requestUpdate) — no reactive state properties needed.
    };

    static styles = [MetroTileBase.styles, css`
        :host { --feezal-metro-off-color: #333; }
        .face { transition: background 0.15s; }
        :host(:not([data-on])) .face { background: var(--feezal-metro-off-color); }
        .state { font-size: var(--_metro-unit-size); text-transform: lowercase; opacity: 0.85; }   /* E129 */
        .onoff { display: flex; justify-content: center; gap: 8px; }
        input[type='range'].hue {
            background: linear-gradient(to right,
                #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
            height: 8px;
        }
        input[type='range'].ct {
            background: linear-gradient(to right, #ff8c00, #fff8ee 50%, #aac4ff);
            height: 8px;
        }
    `];

    constructor() {
        super();
        this.payloadMode = 'separate';
        this.publish = '';
        this.jsonMap = '';
        this.onOffSource = 'topic';
        this.subscribeState = '';
        this.msgPropState = '';
        this.publishState = '';
        this.payloadOn = 'on';
        this.payloadOff = 'off';
        this.subscribeBrightness = '';
        // E127: ramp settling
        this.subscribeWorking = '';
        this.msgPropWorking = 'payload.val';
        this.subscribeSettled = '';
        this.msgPropSettled = 'payload.val';
        this.settleTimeout = 5;
        this.reportDelayMs = 100;
        this.msgPropBrightness = '';
        this.publishBrightness = '';
        this.brightnessMin = 0;
        this.brightnessMax = 100;
        this.subscribeColorTemp = '';
        this.msgPropColorTemp = '';
        this.publishColorTemp = '';
        this.colorTempUnit = 'kelvin';
        this.colorTempMin = 2700;
        this.colorTempMax = 6500;
        this.subscribeRgb = '';
        this.msgPropRgb = '';
        this.publishRgb = '';
        this.subscribeHs = '';
        this.msgPropHs = '';
        this.publishHs = '';
        this.mode = 'brightness';
        this.subscribeEffect = '';
        this.publishEffect = '';
        this.effects = '';
        this.msgPropEffect = '';
        this.subscribeWhite = '';
        this.publishWhite = '';
        this.msgPropWhite = '';
        this.subscribeWarmWhite = '';
        this.publishWarmWhite = '';
        this.msgPropWarmWhite = '';
        this.subscribeColdWhite = '';
        this.publishColdWhite = '';
        this.msgPropColdWhite = '';
        this.iconOn = '';
        this.iconOff = '';
        this.discoveryId = '';
        // E137: the behavior layer — wires/parses/publishes; this view renders.
        this.light = new LightController(this);
    }

    // Fully self-managed subscriptions (via the LightController) — suppress
    // the generic base path, which would treat the json base topic as a
    // control channel.
    _subscribe() { /* intentionally empty — the LightController wires everything */ }

    // E137: the LightController wires everything in hostConnected and
    // disposes the settling machinery in hostDisconnected.

    updated(changed) {
        super.updated(changed);
        // Tile chrome: the OFF colour keys off the data-on host attribute.
        this.toggleAttribute('data-on', Boolean(this.light.on));
        // Live-canvas topic edits re-wire through the controller.
        this.light.rewireIfChanged();
    }

    // ── Front tap / back-face ON-OFF buttons ─────────────────────────────────

    baseAction() {
        if (feezal.isEditor) return;   // also reachable from the back-face buttons
        // E137: E77 brightness-derived toggling (OLD_LEVEL restore) included.
        this.light.toggle();
    }

    // ── Back-face slider handlers ─────────────────────────────────────────────

    _onBrt(e) {
        if (feezal.isEditor) return;
        // E137: clamp/scale/publish + settling + E77 on/off derivation all
        // live behind the controller command.
        this.light.setBrightnessPct(Number(e.target.value));
    }

    _onCt(e) {
        if (feezal.isEditor) return;
        this.light.setColorTempK(Number(e.target.value));
    }

    _onHueSat(hue, sat) {
        if (feezal.isEditor) return;
        // sat arrives 0–100 from the slider; the controller command takes 0–1
        // and publishes RGB or HS per the active mode.
        this.light.pickColor(hue, sat / 100);
    }

    /** Current [hue, sat%] for the colour sliders, from the controller state. */
    _hueSat() {
        if (this.mode === 'hs' && this.light.hs) return this.light.hs;
        if (this.light.rgb) {
            const {h, s} = rgbToHsv(...this.light.rgb);
            return [h, s * 100];
        }
        return this.light.hs ?? [0, 100];
    }

    // ── Faces ─────────────────────────────────────────────────────────────────

    renderFront() {
        const on = this.light.on;
        // E127 dual-topic mode: the % readout follows the live topic during ramps.
        const brtDisp = this.light.brtLive ?? this.light.brt;
        const pct = brtDisp !== null && on ? ` ${Math.round(brtDisp)}%` : '';
        const icon = (on ? this.iconOn : this.iconOff) || this.icon;
        return html`
            ${icon ? html`<feezal-icon name="${icon}"></feezal-icon>` : ''}
            <div class="state">${on ? `on${pct}` : 'off'}</div>`;
    }

    renderBack() {
        const mode = this.mode || 'brightness';
        const showBrt = mode === 'brightness' || mode === 'brightness_ct';
        const showCt = mode === 'brightness_ct' || mode === 'color_temp';
        const showColor = mode === 'rgb' || mode === 'hs';
        const [hue, sat] = this._hueSat();
        return html`
            <div class="onoff">
                <button class="mbtn ${this.light.on ? 'active' : ''}" @click="${() => { if (!this.light.on) this.baseAction(); }}">ON</button>
                <button class="mbtn ${this.light.on ? '' : 'active'}" @click="${() => { if (this.light.on) this.baseAction(); }}">OFF</button>
            </div>
            ${showBrt ? html`
                <div class="rowline">
                    <feezal-icon name="brightness_6"></feezal-icon>
                    <input type="range" min="0" max="100" step="1"
                        .value="${String(this.light.brt ?? 0)}" @change="${this._onBrt}">
                </div>` : ''}
            ${showCt ? html`
                <div class="rowline">
                    <feezal-icon name="thermostat"></feezal-icon>
                    <input type="range" class="ct" min="${this.colorTempMin || 2700}" max="${this.colorTempMax || 6500}" step="1"
                        .value="${String(this.light.colorTemp ?? this.colorTempMin ?? 2700)}" @change="${this._onCt}">
                </div>` : ''}
            ${showColor ? html`
                <div class="rowline">
                    <feezal-icon name="palette"></feezal-icon>
                    <input type="range" class="hue" min="0" max="360" step="1"
                        .value="${String(hue)}" @change="${e => this._onHueSat(Number(e.target.value), sat)}">
                </div>
                <div class="rowline">
                    <feezal-icon name="opacity"></feezal-icon>
                    <input type="range" min="0" max="100" step="1"
                        .value="${String(sat)}" @change="${e => this._onHueSat(hue, Number(e.target.value))}">
                </div>` : ''}`;
    }
}

customElements.define('feezal-element-metro-light', FeezalElementMetroLight);
export {FeezalElementMetroLight};

// ─── N6 custom inspector ─────────────────────────────────────────────────────
// Mirrors material-light's inspector: Topics tab (json mode = single State &
// Control section; separate mode = State + capability-gated sections, with
// the E77 hint when on/off derives from brightness) and a Config tab (mode,
// payload mode, on/off source, payloads, scales, tile settings).
const METRO_LIGHT_SECTIONS = [
    {id: 'brightness', title: 'Brightness', topics: [
        {attr: 'subscribe-brightness', label: 'Subscribe'},
        {attr: 'publish-brightness',   label: 'Publish'},
    ]},
    // E127: ramp settling — Homematic WORKING / RedMatic LEVEL_NOTWORKING.
    {id: 'settling', title: 'Settling (Homematic ramps)', topics: [
        {attr: 'subscribe-working', label: 'WORKING ↓', placeholder: 'hm/status/<dimmer>/WORKING'},
        {attr: 'subscribe-settled', label: 'Settled ↓', placeholder: 'hm/status/<dimmer>/LEVEL_NOTWORKING'},
    ]},
    {id: 'color_temp', title: 'Color Temperature', topics: [
        {attr: 'subscribe-color-temp', label: 'Subscribe'},
        {attr: 'publish-color-temp',   label: 'Publish'},
    ]},
    {id: 'color', title: 'Color — RGB / HS', topics: [
        {attr: 'subscribe-rgb', label: 'Subscribe RGB'},
        {attr: 'publish-rgb',   label: 'Publish RGB'},
        {attr: 'subscribe-hs',  label: 'Subscribe HS'},
        {attr: 'publish-hs',    label: 'Publish HS'},
    ]},
];

class FeezalElementMetroLightInspector extends LitElement {
    static properties = {
        element: {attribute: false},
        _tab:    {state: true},
        _open:   {state: true},
    };

    static styles = css`
        :host { display: block; font-size: 12px; color: var(--feezal-color, #333); }
        sl-tab-panel::part(base) { padding: 8px 2px; }
        .section { border: 1px solid var(--feezal-border, #e0e0e0); border-radius: 6px; margin-bottom: 8px; }
        .sec-head {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 8px; font-weight: 600;
            background: var(--feezal-bg-sub, #f5f5f5);
            border-radius: 6px 6px 0 0;
        }
        .sec-head.collapsed { border-radius: 6px; }
        .sec-title { flex: 1; }
        .sec-body { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
        .field { display: flex; flex-direction: column; gap: 2px; }
        .field > label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; }
        sl-input, sl-select { width: 100%; }
        sl-input::part(form-control-label), sl-select::part(form-control-label) { color: var(--sl-input-label-color, inherit); font-size: 12px; }
        sl-input::part(base), sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        sl-switch { color: var(--feezal-color, inherit); }
        .row { display: flex; gap: 6px; }
        .row > .field { flex: 1; min-width: 0; }
        .hint { font-size: 10px; opacity: 0.55; padding: 0 2px 4px; }
    `;

    constructor() {
        super();
        this.element = null;
        this._tab = 'topics';
        this._open = {};
    }

    willUpdate(changed) {
        if (changed.has('element')) this._open = {};
    }

    _val(name) { return this.element?.getAttribute(name) ?? ''; }

    _emit(name, value, rerender = false) {
        this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
            bubbles: true, composed: true, detail: {name, value},
        }));
        if (rerender) this.requestUpdate();
    }

    _sectionEnabled(sec) {
        if (this._open[sec.id]) return true;
        return sec.topics.some(t => this._val(t.attr) !== '');
    }

    _toggleSection(sec, e) {
        const on = e.target.checked;
        if (on) {
            this._open = {...this._open, [sec.id]: true};
        } else {
            sec.topics.forEach(t => this._emit(t.attr, ''));
            this._open = {...this._open, [sec.id]: false};
        }
        this.requestUpdate();
    }

    _topicInput(t) {
        return html`
            <div class="field">
                <label>${t.label}</label>
                <feezal-topic-input size="small" placeholder="mqtt/topic" value="${this._val(t.attr)}"
                    @sl-change="${e => this._emit(t.attr, e.target.value)}"></feezal-topic-input>
            </div>`;
    }

    _numInput(attr, label, placeholder) {
        return html`
            <div class="field">
                <label>${label}</label>
                <sl-input size="small" type="number" autocomplete="off" placeholder="${placeholder ?? ''}"
                    value="${this._val(attr)}" @sl-change="${e => this._emit(attr, e.target.value)}"></sl-input>
            </div>`;
    }

    render() {
        if (!this.element) return html``;
        return html`
            <sl-tab-group @sl-tab-show="${e => { this._tab = e.detail.name; }}">
                <sl-tab slot="nav" panel="topics" ?active="${this._tab === 'topics'}">Topics</sl-tab>
                <sl-tab slot="nav" panel="config" ?active="${this._tab === 'config'}">Config</sl-tab>
                <sl-tab-panel name="topics">${this._renderTopics()}</sl-tab-panel>
                <sl-tab-panel name="config">${this._renderConfig()}</sl-tab-panel>
            </sl-tab-group>`;
    }

    _renderTopics() {
        // json mode → single State & Control section (material-light pattern)
        if (this._val('payload-mode') === 'json') {
            return html`
                <div class="hint">JSON mode — one topic carries the whole state object.</div>
                <div class="section">
                    <div class="sec-head">State &amp; Control</div>
                    <div class="sec-body">
                        ${this._topicInput({attr: 'subscribe', label: 'Subscribe (state)'})}
                        ${this._topicInput({attr: 'publish',   label: 'Publish (…/set)'})}
                    </div>
                </div>`;
        }

        // separate mode → State + capability-gated sections. E77: with
        // on-off-source=brightness the state topics are unused.
        const brightnessSource = (this._val('on-off-source') || 'topic') === 'brightness';
        return html`
            <div class="section">
                <div class="sec-head">State</div>
                <div class="sec-body">
                    ${brightnessSource ? html`
                        <div class="hint">On/off derives from the <b>Brightness</b> topic
                            (On/off source: brightness) — state topics are unused.</div>
                    ` : html`
                        ${this._topicInput({attr: 'subscribe-state', label: 'Subscribe'})}
                        ${this._topicInput({attr: 'publish-state',   label: 'Publish'})}
                    `}
                </div>
            </div>
            ${METRO_LIGHT_SECTIONS.map(sec => {
                const enabled = this._sectionEnabled(sec);
                return html`
                    <div class="section">
                        <div class="sec-head ${enabled ? '' : 'collapsed'}">
                            <span class="sec-title">${sec.title}</span>
                            <sl-switch size="small" ?checked="${enabled}"
                                @sl-change="${e => this._toggleSection(sec, e)}"></sl-switch>
                        </div>
                        ${enabled ? html`<div class="sec-body">${sec.topics.map(t => this._topicInput(t))}</div>` : ''}
                    </div>`;
            })}`;
    }

    _renderConfig() {
        const isJson = this._val('payload-mode') === 'json';
        const ctEnabled = isJson || this._sectionEnabled(METRO_LIGHT_SECTIONS[2]);
        const brEnabled = isJson || this._sectionEnabled(METRO_LIGHT_SECTIONS[0]);
        return html`
            <div class="section">
                <div class="sec-head">Mode</div>
                <div class="sec-body">
                    <div class="field">
                        <label>Active control</label>
                        <sl-select size="small" value="${this._val('mode') || 'brightness'}"
                            @sl-change="${e => this._emit('mode', e.target.value, true)}">
                            <sl-option value="brightness">Brightness</sl-option>
                            <sl-option value="brightness_ct">Brightness + Color temp</sl-option>
                            <sl-option value="color_temp">Color temperature</sl-option>
                            <sl-option value="rgb">RGB</sl-option>
                            <sl-option value="hs">Hue / Saturation</sl-option>
                        </sl-select>
                    </div>
                    <div class="field">
                        <label>Payload mode</label>
                        <sl-select size="small" value="${this._val('payload-mode') || 'separate'}"
                            @sl-change="${e => this._emit('payload-mode', e.target.value, true)}">
                            <sl-option value="separate">separate (one topic per property)</sl-option>
                            <sl-option value="json">json (single topic)</sl-option>
                        </sl-select>
                    </div>
                    ${isJson ? '' : html`
                        <div class="field">
                            <label>On/off source</label>
                            <sl-select size="small" value="${this._val('on-off-source') || 'topic'}"
                                @sl-change="${e => this._emit('on-off-source', e.target.value, true)}">
                                <sl-option value="topic">topic (dedicated state topic)</sl-option>
                                <sl-option value="brightness">brightness (HmIP/Homematic dimmers)</sl-option>
                            </sl-select>
                        </div>`}
                </div>
            </div>
            <div class="section">
                <div class="sec-head">State payloads</div>
                <div class="sec-body">
                    <div class="row">
                        <div class="field"><label>ON</label>
                            <sl-input size="small" autocomplete="off" placeholder="on" value="${this._val('payload-on')}"
                                @sl-change="${e => this._emit('payload-on', e.target.value)}"></sl-input></div>
                        <div class="field"><label>OFF</label>
                            <sl-input size="small" autocomplete="off" placeholder="off" value="${this._val('payload-off')}"
                                @sl-change="${e => this._emit('payload-off', e.target.value)}"></sl-input></div>
                    </div>
                    <div class="field"><label>message-property</label>
                        <sl-input size="small" autocomplete="off" placeholder="payload" value="${this._val('message-property')}"
                            @sl-change="${e => this._emit('message-property', e.target.value)}"></sl-input></div>
                </div>
            </div>
            ${brEnabled ? html`
                <div class="section">
                    <div class="sec-head">Brightness scale</div>
                    <div class="sec-body">
                        <div class="row">
                            ${this._numInput('brightness-min', 'Min', '0')}
                            ${this._numInput('brightness-max', 'Max (255 = z2m, 1 = HmIP)', '100')}
                        </div>
                        <div class="row">
                            ${this._numInput('settle-timeout', 'Settle timeout (s)', '5')}
                            ${this._numInput('report-delay-ms', 'Report delay (ms)', '100')}
                        </div>
                    </div>
                </div>` : ''}
            ${ctEnabled ? html`
                <div class="section">
                    <div class="sec-head">Color temperature</div>
                    <div class="sec-body">
                        <div class="field">
                            <label>Topic unit</label>
                            <sl-select size="small" value="${this._val('color-temp-unit') || 'kelvin'}"
                                @sl-change="${e => this._emit('color-temp-unit', e.target.value)}">
                                <sl-option value="kelvin">kelvin</sl-option>
                                <sl-option value="mired">mired</sl-option>
                            </sl-select>
                        </div>
                        <div class="row">
                            ${this._numInput('color-temp-min', 'Min (K)', '2700')}
                            ${this._numInput('color-temp-max', 'Max (K)', '6500')}
                        </div>
                    </div>
                </div>` : ''}
            <div class="section">
                <div class="sec-head">Tile</div>
                <div class="sec-body">
                    <div class="field"><label>Label</label>
                        <sl-input size="small" autocomplete="off" value="${this._val('label')}"
                            @sl-change="${e => this._emit('label', e.target.value)}"></sl-input></div>
                    <div class="field"><label>Icon</label>
                        <feezal-icon-input .value="${this._val('icon')}"
                            @feezal-change="${e => { e.stopPropagation(); this._emit('icon', e.detail.value); }}"></feezal-icon-input></div>
                    <div class="row">
                        <div class="field"><label>Icon ON</label>
                            <feezal-icon-input .value="${this._val('icon-on')}"
                                @feezal-change="${e => { e.stopPropagation(); this._emit('icon-on', e.detail.value); }}"></feezal-icon-input></div>
                        <div class="field"><label>Icon OFF</label>
                            <feezal-icon-input .value="${this._val('icon-off')}"
                                @feezal-change="${e => { e.stopPropagation(); this._emit('icon-off', e.detail.value); }}"></feezal-icon-input></div>
                    </div>
                    <div class="field"><label>Size</label>
                        <sl-select size="small" value="${this._val('size')}"
                            @sl-change="${e => this._emit('size', e.target.value, true)}">
                            <sl-option value="">manual</sl-option>
                            <sl-option value="1x1">1x1</sl-option>
                            <sl-option value="2x2">2x2</sl-option>
                            <sl-option value="4x2">4x2</sl-option>
                            <sl-option value="4x4">4x4</sl-option>
                        </sl-select></div>
                </div>
            </div>`;
    }
}

customElements.define('feezal-element-metro-light-inspector', FeezalElementMetroLightInspector);
export {FeezalElementMetroLightInspector};

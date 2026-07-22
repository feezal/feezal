/* global feezal */
import {feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {EinkBase, einkCardStyles} from '@feezal/feezal-eink';
// E137: the light behavior lives in the shared controller — this element
// is a VIEW (eink chrome: state word, oversized brightness %, −/+ steppers).
import {LightController, lightAttributes, lightDiscoveryMap} from '@feezal/feezal-controller-light';

/**
 * feezal-element-eink-light (E57)
 *
 * E-ink light card: state word (card inverts while on), brightness percent as
 * an oversized numeral, flat bordered − / + buttons stepping brightness by
 * 10 %. Tap anywhere else on the card toggles.
 *
 * E137: the full shared light contract (both payload modes, E77
 * brightness-derived on/off incl. the Homematic 1.005 OLD_LEVEL restore,
 * brightness-min/max range scaling, per-topic message-property twins, E127
 * ramp settling) lives in LightController — this view only renders and
 * forwards gestures (`toggle`, `setBrightnessPct`).
 *
 * 1-bit scope decision: there is NO color UI on e-paper. Every color `mode`
 * value (hs / rgb / brightness_ct / color_temp) degrades to plain
 * 'brightness' behaviour IN THIS VIEW — a discovered color lamp still dims
 * and toggles. The controller tracks colour temperature / RGB / HS / effect /
 * white state anyway (the shared attribute fragment declares the topics, so
 * discovery stamps identically to the other light families), the view simply
 * never renders or publishes it. `mode: on_off` (E122) is honoured — a
 * switch-only lamp renders the state word oversized without stepper buttons.
 *
 * Family conventions (1-bit palette, redraw dedup): see @feezal/feezal-eink.
 */

const BRIGHTNESS_STEP = 10;   // % per −/+ tap

class FeezalElementEinkLight extends EinkBase {
    static get feezal() {
        return {
            palette: {name: 'Light', category: 'Eink', color: '#222222', icon: 'lightbulb'},
            description: 'E-ink light card — state word (inverted while on), oversized brightness %, ' +
                'flat − / + steppers (10 % per tap), tap toggles. Shared light wiring contract; ' +
                'color modes degrade to brightness (1-bit).',
            // E137: the discovery map is the controller package's fragment.
            discovery: {component: 'light', map: lightDiscoveryMap},
            attributes: [
                // E137: the shared light contract (both payload modes, E77
                // on/off-from-brightness, E127 settling, CT/RGB/HS/effects/
                // white channels) — declared ONCE by the controller package.
                // Color/effect/white topics are wired by the controller but
                // never rendered on 1-bit e-ink (see doc comment).
                ...lightAttributes,
                // ── Availability (N31) ──
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability — a ! badge appears while unavailable, the card stays usable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
                {name: 'label', type: 'string', help: 'Label line (rendered uppercase).'},
                {name: 'label-on',  type: 'string', default: 'On',  help: 'Displayed state word while the light is on (localise, e.g. "Ein"). Display only — NOT the MQTT payload (payload-on) and NOT the card title (label).'},
                {name: 'label-off', type: 'string', default: 'Off', help: 'Displayed state word while the light is off (localise, e.g. "Aus"). Display only — NOT the MQTT payload (payload-off) and NOT the card title (label).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-eink-font-size-value', default: '34px', help: 'Brightness numeral font size.'},
                {property: '--feezal-eink-font-size-label', default: '13px', help: 'Label/state word font size.'},
                {property: '--feezal-eink-rule', default: '3px', help: 'Rule/border thickness (≥2px).'},
            ],
            defaultStyle: {width: '200px', height: '120px'},
            restrict: {minWidth: 120, minHeight: 80},
        };
    }

    static properties = {
        payloadMode:         {type: String, reflect: true, attribute: 'payload-mode'},
        publish:             {type: String, reflect: true},
        jsonMap:             {type: String, reflect: true, attribute: 'json-map'},
        onOffSource:         {type: String, reflect: true, attribute: 'on-off-source'},
        subscribeState:      {type: String, reflect: true, attribute: 'subscribe-state'},
        msgPropState:        {type: String, reflect: true, attribute: 'message-property-state'},
        publishState:        {type: String, reflect: true, attribute: 'publish-state'},
        payloadOn:           {type: String, reflect: true, attribute: 'payload-on'},
        payloadOff:          {type: String, reflect: true, attribute: 'payload-off'},
        subscribeBrightness: {type: String, reflect: true, attribute: 'subscribe-brightness'},
        msgPropBrightness:   {type: String, reflect: true, attribute: 'message-property-brightness'},
        publishBrightness:   {type: String, reflect: true, attribute: 'publish-brightness'},
        brightnessMin:       {type: Number, reflect: true, attribute: 'brightness-min'},
        brightnessMax:       {type: Number, reflect: true, attribute: 'brightness-max'},
        // E127: ramp settling
        subscribeWorking:    {type: String, reflect: true, attribute: 'subscribe-working'},
        msgPropWorking:      {type: String, reflect: true, attribute: 'message-property-working'},
        subscribeSettled:    {type: String, reflect: true, attribute: 'subscribe-settled'},
        msgPropSettled:      {type: String, reflect: true, attribute: 'message-property-settled'},
        settleTimeout:       {type: Number, reflect: true, attribute: 'settle-timeout'},
        reportDelayMs:       {type: Number, reflect: true, attribute: 'report-delay-ms'},
        mode:                {type: String, reflect: true},
        // Wired by the controller, never rendered on 1-bit e-ink (see doc comment).
        subscribeColorTemp:  {type: String, reflect: true, attribute: 'subscribe-color-temp'},
        msgPropColorTemp:    {type: String, reflect: true, attribute: 'message-property-color-temp'},
        publishColorTemp:    {type: String, reflect: true, attribute: 'publish-color-temp'},
        colorTempUnit:       {type: String, reflect: true, attribute: 'color-temp-unit'},
        colorTempMin:        {type: Number, reflect: true, attribute: 'color-temp-min'},
        colorTempMax:        {type: Number, reflect: true, attribute: 'color-temp-max'},
        subscribeRgb:        {type: String, reflect: true, attribute: 'subscribe-rgb'},
        msgPropRgb:          {type: String, reflect: true, attribute: 'message-property-rgb'},
        publishRgb:          {type: String, reflect: true, attribute: 'publish-rgb'},
        subscribeHs:         {type: String, reflect: true, attribute: 'subscribe-hs'},
        msgPropHs:           {type: String, reflect: true, attribute: 'message-property-hs'},
        publishHs:           {type: String, reflect: true, attribute: 'publish-hs'},
        // N31: availability inherited from FeezalElement.
        label:               {type: String, reflect: true},
        labelOn:             {type: String, reflect: true, attribute: 'label-on'},
        labelOff:            {type: String, reflect: true, attribute: 'label-off'},
        discoveryId:         {type: String, reflect: true, attribute: 'discovery-id'},
    };

    static styles = [feezalBaseStyles, einkCardStyles, css`
        .card { gap: 3px; cursor: pointer; }
        .row { display: flex; align-items: center; gap: 8px; }
        .brt { flex: 1; text-align: center; }
        .stepbtn {
            flex: 0 0 auto; min-width: 40px; min-height: 44px;
            border: var(--feezal-eink-rule, 3px) solid currentColor; background: none;
            color: inherit; font: inherit; font-size: 26px; line-height: 1; cursor: pointer;
            border-radius: var(--feezal-eink-radius, 0px);
        }
        .state {
            font-size: var(--feezal-eink-font-size-label, 13px); font-weight: 700;
            text-transform: uppercase; letter-spacing: 0.06em; text-align: center;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        /* on_off lamps: the state word IS the value. */
        .value.stateword { text-align: center; text-transform: uppercase; }
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
        this.msgPropBrightness = '';
        this.publishBrightness = '';
        this.brightnessMin = 0;
        this.brightnessMax = 100;
        // E127: ramp settling
        this.subscribeWorking = '';
        this.msgPropWorking = 'payload.val';
        this.subscribeSettled = '';
        this.msgPropSettled = 'payload.val';
        this.settleTimeout = 5;
        this.reportDelayMs = 100;
        this.mode = 'brightness';
        // Controller-wired, view-ignored on 1-bit (see doc comment).
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
        this.label = '';
        this.labelOn = 'On';
        this.labelOff = 'Off';
        this.discoveryId = '';
        // E137: the behavior layer — wires/parses/publishes/settles; this view
        // renders. Light state lives on the controller (plain fields +
        // host.requestUpdate); EinkBase's renderSignature() dedup still drops
        // redraws when nothing visible changed.
        this.light = new LightController(this);
    }

    // Device cards manage subscriptions via the controller.
    _subscribe() { /* intentionally empty */ }

    updated(changed) {
        super.updated(changed);
        // Live-canvas topic edits re-wire through the controller.
        this.light.rewireIfChanged();
    }

    _stepBrightness(direction) {
        if (feezal.isEditor) return;
        const current = this._brtShown() ?? 0;
        const clamped = Math.max(0, Math.min(100, Math.round(current + direction * BRIGHTNESS_STEP)));
        // E137: clamp/scale/publish + settling + E77 on/off derivation all
        // live behind the controller command.
        this.light.setBrightnessPct(clamped);
    }

    _onCardClick() {
        if (feezal.isEditor) return;
        this.light.toggle();
    }

    // ── rendering ─────────────────────────────────────────────────────────────

    /** on_off (E122) = switch-only lamp, no stepper row. Every OTHER mode —
     * including all color modes — behaves as plain brightness on 1-bit. */
    _dimmable() {
        if ((this.mode || 'brightness') === 'on_off') return false;
        return Boolean(this.subscribeBrightness || this.publishBrightness ||
            this.payloadMode === 'json' || this.onOffSource === 'brightness');
    }

    _stateWord() {
        return this.light.on ? (this.labelOn || 'On') : (this.labelOff || 'Off');
    }

    /** Displayed brightness % (live topic during E127 ramps) — null hides the numeral. */
    _brtShown() {
        const brt = this.light.brtLive ?? this.light.brt;
        if (brt !== null && brt !== undefined) return Math.round(brt);
        // Editor placeholder when nothing is wired yet.
        if (feezal.isEditor && !this.subscribeBrightness && !this.subscribe) return 72;
        return null;
    }

    /** E57 redraw dedup: everything visibly rendered, values as shown. */
    renderSignature() {
        const brt = this._brtShown();
        return [this._stateWord(), this.light.on, brt === null ? '—' : brt,
            this._dimmable(), this._available].join('|');
    }

    render() {
        const dimmable = this._dimmable();
        const brt = this._brtShown();
        const word = this._stateWord();
        return html`
            <div class="card ${this.light.on ? 'inv' : ''}" role="button" tabindex="0"
                @click="${this._onCardClick}"
                @keydown="${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._onCardClick(); } }}">
                ${!this._available ? html`<span class="badge-tr" title="Device unavailable">!</span>` : ''}
                ${dimmable ? html`
                    <span class="state">${word}</span>
                    <div class="row">
                        <button class="stepbtn" title="Dim −${BRIGHTNESS_STEP} %"
                            @click="${e => { e.stopPropagation(); this._stepBrightness(-1); }}">−</button>
                        <span class="value brt">${brt === null ? '—' : html`${brt}<span class="unit">%</span>`}</span>
                        <button class="stepbtn" title="Dim +${BRIGHTNESS_STEP} %"
                            @click="${e => { e.stopPropagation(); this._stepBrightness(1); }}">+</button>
                    </div>` : html`
                    <span class="value stateword">${word}</span>`}
                ${this.label || feezal.isEditor ? html`<span class="label">${this.label || (feezal.isEditor ? 'Light' : '')}</span>` : ''}
            </div>
        `;
    }
}

customElements.define('feezal-element-eink-light', FeezalElementEinkLight);
export {FeezalElementEinkLight};

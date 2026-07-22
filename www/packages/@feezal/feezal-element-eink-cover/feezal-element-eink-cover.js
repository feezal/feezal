/* global feezal */
import {feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {EinkBase, einkCardStyles} from '@feezal/feezal-eink';
// E137: the cover behavior lives in the shared controller — this element
// is a VIEW (1-bit chrome: position numeral, black-fill bar, ▲ ■ ▼ buttons).
import {CoverController, coverAttributes, coverDiscoveryMap} from '@feezal/feezal-controller-cover';

/**
 * feezal-element-eink-cover (E57)
 *
 * E-ink shutter/cover card: oversized position numeral ("73 %", or the state
 * word when no position has arrived), a thick bordered horizontal position bar
 * (1-bit: fill = black, track = white; tap to set a target position) and three
 * flat bordered ▲ ■ ▼ buttons (≥44px tap targets). 1-bit discipline: no
 * transitions, no colors, no shadows; unavailability shows the ! badge.
 *
 * E137: the full shared cover contract (json/separate payload modes,
 * up/stop/down command payloads, dedicated per-direction publish topics,
 * position subscribe/publish with B26 min/max device-range scaling, per-topic
 * message-property twins, slat/tilt angle, HA/Homematic discovery map) lives
 * in CoverController — this view only renders and forwards gestures
 * (`up()/stop()/down()/setPosition(pct)`). `invert` is display-only and stays
 * in the view.
 *
 * Tilt/slat attributes (slat-angle, publish-slat-angle, slat-min, slat-max,
 * message-property-tilt) arrive with the shared attribute fragment and are
 * WIRED by the controller (tilt is tracked for contract/discovery parity),
 * but there is intentionally NO tilt UI on the e-ink card — no room in the
 * 1-bit layout; use the glass/material card where tilt control matters.
 */

class FeezalElementEinkCover extends EinkBase {
    static get feezal() {
        return {
            palette: {name: 'Cover', category: 'Eink', color: '#222222', icon: 'blinds'},
            description: 'E-ink shutter/cover card — oversized position numeral, bordered position bar, ' +
                '▲ ■ ▼ buttons, 1-bit. Same wiring contract as the glass cover card (tilt attributes ' +
                'declared for parity, no tilt UI).',
            // E137: the discovery map is the controller package's fragment.
            discovery: {component: 'cover', map: coverDiscoveryMap},
            attributes: [
                // E137: the shared cover contract (both payload modes, B26
                // range scaling, per-direction command topics, tilt/slat) —
                // declared ONCE by the controller package. Tilt topics are
                // wired by the controller but never rendered on 1-bit e-ink
                // (see doc comment).
                ...coverAttributes,
                {name: 'invert',        type: 'boolean', default: false, help: 'Invert position scale: 0=open, 100=closed.'},
                {name: 'show-position', type: 'boolean', default: true,  help: 'Show the numeric position % as the oversized value (state word otherwise).'},
                {name: 'label', type: 'string', help: 'Label line (rendered uppercase).'},
                // ── Availability (N31) ──
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability — a ! badge appears while unavailable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-eink-font-size-value', default: '34px', help: 'Position numeral font size.'},
                {property: '--feezal-eink-font-size-label', default: '13px', help: 'Label font size.'},
                {property: '--feezal-eink-rule', default: '3px', help: 'Rule/border thickness (≥2px).'},
            ],
            defaultStyle: {width: '200px', height: '150px'},
            restrict: {minWidth: 120, minHeight: 90},
        };
    }

    static properties = {
        payloadMode:       {type: String,  reflect: true, attribute: 'payload-mode'},
        publish:           {type: String,  reflect: true},
        jsonMap:           {type: String,  reflect: true, attribute: 'json-map'},
        subscribePosition: {type: String,  reflect: true, attribute: 'subscribe-position'},
        msgPropPosition:   {type: String,  reflect: true, attribute: 'message-property-position'},
        publishPosition:   {type: String,  reflect: true, attribute: 'publish-position'},
        publishCommand:    {type: String,  reflect: true, attribute: 'publish-command'},
        publishUp:         {type: String,  reflect: true, attribute: 'publish-up'},
        publishStop:       {type: String,  reflect: true, attribute: 'publish-stop'},
        publishDown:       {type: String,  reflect: true, attribute: 'publish-down'},
        payloadUp:         {type: String,  reflect: true, attribute: 'payload-up'},
        payloadStop:       {type: String,  reflect: true, attribute: 'payload-stop'},
        payloadDown:       {type: String,  reflect: true, attribute: 'payload-down'},
        min:               {type: Number,  reflect: true},
        max:               {type: Number,  reflect: true},
        // Controller-wired, view-ignored on 1-bit (see doc comment).
        slatMin:           {type: Number,  reflect: true, attribute: 'slat-min'},
        slatMax:           {type: Number,  reflect: true, attribute: 'slat-max'},
        slatAngle:         {type: String,  reflect: true, attribute: 'slat-angle'},
        msgPropTilt:       {type: String,  reflect: true, attribute: 'message-property-tilt'},
        publishSlatAngle:  {type: String,  reflect: true, attribute: 'publish-slat-angle'},
        invert:            {type: Boolean, reflect: true},
        showPosition:      {type: Boolean, reflect: true, attribute: 'show-position'},
        label:             {type: String,  reflect: true},
        // N31: availability inherited from FeezalElement.
        discoveryId:       {type: String,  reflect: true, attribute: 'discovery-id'},
    };

    static styles = [feezalBaseStyles, einkCardStyles, css`
        .card { gap: 4px; }
        .value { text-align: center; }
        /* Position bar — 1-bit: bordered track (bg), solid fg fill = open portion. */
        .bar {
            position: relative; height: 18px; flex: 0 0 auto;
            border: var(--feezal-eink-rule, 3px) solid var(--_fg);
            background: var(--_bg); overflow: hidden; cursor: pointer;
            border-radius: var(--feezal-eink-radius, 0px);
        }
        .bar .fill { position: absolute; top: 0; bottom: 0; left: 0; background: var(--_fg); }
        .buttons { display: flex; gap: 6px; }
        .buttons button {
            flex: 1; min-height: 44px;
            border: var(--feezal-eink-rule, 3px) solid var(--_fg); background: var(--_bg);
            color: var(--_fg); font: inherit; font-size: 20px; line-height: 1; cursor: pointer;
            border-radius: var(--feezal-eink-radius, 0px);
        }
        .buttons button:active { background: var(--_fg); color: var(--_bg); }
        .label { text-align: center; }
    `];

    constructor() {
        super();
        this.payloadMode = 'json';
        this.publish = '';
        this.jsonMap = '';
        this.subscribePosition = '';
        this.msgPropPosition = '';
        this.publishPosition = '';
        this.publishCommand = '';
        this.publishUp = '';
        this.publishStop = '';
        this.publishDown = '';
        this.payloadUp = 'OPEN';
        this.payloadStop = 'STOP';
        this.payloadDown = 'CLOSE';
        this.min = 0;
        this.max = 100;
        this.slatMin = 0;
        this.slatMax = 100;
        this.slatAngle = '';
        this.msgPropTilt = '';
        this.publishSlatAngle = '';
        this.invert = false;
        this.showPosition = true;
        this.label = '';
        this.discoveryId = '';
        // E137: the behavior layer — wires/parses/scales/publishes; this view
        // renders. Cover state (position/tilt) lives on the controller (plain
        // fields + host.requestUpdate); EinkBase's renderSignature() dedup
        // still drops redraws when nothing visible changed.
        this.cover = new CoverController(this);
    }

    // Device cards manage subscriptions via the controller.
    _subscribe() { /* intentionally empty */ }

    updated(changed) {
        super.updated(changed);
        // Live-canvas topic edits re-wire through the controller.
        this.cover.rewireIfChanged();
    }

    /** Tap on the position bar → target position (effective %, invert-aware). */
    _barClick(e) {
        if (feezal.isEditor) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
        const eff = Math.max(0, Math.min(100, pct));
        // E137: clamp/scale/publish live behind the controller command.
        this.cover.setPosition(this.invert ? 100 - eff : eff);
    }

    // ── rendering ─────────────────────────────────────────────────────────────

    /** Effective open % (0 = closed), invert-aware; null = unknown. */
    _effPos() {
        const pos = this.cover.position ??
            (feezal.isEditor && !this.subscribe && !this.subscribePosition ? 73 : null);
        if (pos === null) return null;
        const eff = this.invert ? 100 - pos : pos;
        return Math.round(eff);
    }

    /** Oversized line: "73 %", or the state word (no position / show-position off). */
    _valueText() {
        const eff = this._effPos();
        if (eff === null) return '—';
        const word = eff <= 0 ? 'CLOSED' : (eff >= 100 ? 'OPEN' : null);
        if (!this.showPosition) return word ?? `${eff} %`;
        return word && (eff <= 0 || eff >= 100) ? word : `${eff} %`;
    }

    /** E57 redraw dedup: everything visibly rendered, values as shown. */
    renderSignature() {
        const eff = this._effPos();
        return [this._valueText(), eff === null ? '' : eff, this._available, this.label].join('|');
    }

    render() {
        const eff = this._effPos();
        return html`
            <div class="card">
                ${!this._available ? html`<span class="badge-tr" title="Device unavailable">!</span>` : ''}
                <span class="value">${this._valueText()}</span>
                <div class="bar" title="Set position" @click="${this._barClick}">
                    <div class="fill" style="width:${eff ?? 0}%"></div>
                </div>
                <div class="buttons">
                    <button title="Up" @click="${() => this.cover.up()}">▲</button>
                    <button title="Stop" @click="${() => this.cover.stop()}">■</button>
                    <button title="Down" @click="${() => this.cover.down()}">▼</button>
                </div>
                ${this.label ? html`<span class="label">${this.label}</span>` : ''}
            </div>
        `;
    }
}

customElements.define('feezal-element-eink-cover', FeezalElementEinkCover);
export {FeezalElementEinkCover};

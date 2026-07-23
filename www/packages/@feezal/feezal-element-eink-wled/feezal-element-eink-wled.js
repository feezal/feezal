/* global feezal */
import {feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {EinkBase, einkCardStyles} from '@feezal/feezal-eink';
// E137: the WLED behavior lives in the shared controller — this element is
// a VIEW (1-bit chrome; colour/effect/palette stay unrendered by design).
import {WledController, wledAttributes, wledDiscoveryMap} from '@feezal/feezal-controller-wled';

/**
 * feezal-element-eink-wled (E57)
 *
 * E-ink WLED card — 1-bit view of a WLED device: uppercase label, oversized
 * brightness %, flat bordered −/+ brightness steppers, optional preset
 * select/cycle buttons. Tapping the card toggles power; the card inverts
 * (black-on-white → white-on-black) while on.
 *
 * MQTT contract identical to feezal-element-glass-wled / -material-wled
 * (keep in sync): subscribes `<topic>/g` (brightness 0–255, 0 = off);
 * commands go to `<topic>/api` as /json/state JSON ({"on":bool}, {"bri":n},
 * {"ps":id}), optional `transition` (seconds → WLED 0.1 s units).
 * Availability auto-derives `<topic>/status` when subscribe-availability is
 * empty (user override wins); the N31 base machinery subscribes.
 *
 * DELIBERATE OMISSIONS (1-bit display): no colour swatch, no effect or
 * palette pickers, no speed/intensity sliders — `<topic>/c` is not
 * subscribed and no {"seg":[...]} commands are sent. The discovery map only
 * stamps `topic` and `label` (availability is applied automatically from
 * the entity's availability_normalized record), so nothing dangles.
 *
 * E57 redraw discipline: renderSignature() dedups MQTT-driven repaints —
 * a republished identical brightness never touches the panel.
 */

class FeezalElementEinkWled extends EinkBase {
    static get feezal() {
        return {
            palette: {name: 'WLED', category: 'Eink', color: '#222222', icon: 'wb_iridescent'},
            description: 'E-ink WLED card — tap toggles (card inverts while on), oversized brightness %, ' +
                'flat −/+ steppers, optional preset buttons. 1-bit: no colour/effect/palette UI. ' +
                'Same MQTT base-topic contract as the glass/material WLED cards.',
            links: [
                {label: 'WLED MQTT docs', url: 'https://kno.wled.ge/interfaces/mqtt/'},
            ],
            // E108: native WLED self-discovery — map copied verbatim from
            // feezal-element-glass-wled. Availability is applied automatically
            // by _applyDiscovery from the entity's availability_normalized
            // record (no map entry needed).
            // E137: the discovery map is the controller package's fragment.
            discovery: {component: 'wled', map: wledDiscoveryMap},
            attributes: [
                // E137: the shared WLED contract (topic/transition/speed/
                // intensity read-backs/presets) — declared ONCE.
                ...wledAttributes,
                {name: 'label', type: 'string', help: 'Label line (rendered uppercase). "WLED" when empty.'},
                {name: 'show-presets', type: 'boolean', default: false,
                    help: 'Show preset buttons that recall a WLED preset via {"ps":<id>} on <topic>/api.'},
                {name: 'subscribe-availability', type: 'mqttTopic',
                    help: 'Availability topic (retained online/offline) — a ! badge appears while unavailable. Empty = auto-derived <topic>/status; set to override.'},
                {name: 'availability-mode', type: 'select', options: ['all', 'any'], default: 'all',
                    help: 'With multiple availability topics: all = every topic must report available; any = at least one.'},
                {name: 'payload-available', type: 'string', default: 'online', help: 'Payload meaning the device is available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning the device is unavailable.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-eink-font-size-value', default: '34px', help: 'Brightness % font size.'},
                {property: '--feezal-eink-font-size-label', default: '13px', help: 'Label/preset font size.'},
                {property: '--feezal-eink-rule', default: '3px', help: 'Rule/border thickness (≥2px).'},
            ],
            defaultStyle: {width: '200px', height: '130px'},
            restrict: {minWidth: 110, minHeight: 80},
        };
    }

    static properties = {
        topic:       {type: String, reflect: true},
        transition:  {type: String, reflect: true},
        label:       {type: String, reflect: true},
        showPresets: {type: Boolean, reflect: true, attribute: 'show-presets'},
        presets:     {type: String, reflect: true},
        // E137: WLED state lives on the WledController; only the local
        // preset selection stays element-local (write-only over MQTT).
        _ps:  {state: true},   // last recalled preset id (null = none)
    };

    static styles = [feezalBaseStyles, einkCardStyles, css`
        .card { gap: 3px; cursor: pointer; touch-action: manipulation; }
        .row { display: flex; align-items: center; gap: 8px; }
        .pct { flex: 1; text-align: center; }
        .stepbtn {
            flex: 0 0 auto; min-width: 40px; min-height: 44px;
            border: var(--feezal-eink-rule, 3px) solid currentColor; background: none;
            color: inherit; font: inherit; font-size: 26px; line-height: 1; cursor: pointer;
            border-radius: var(--feezal-eink-radius, 0px);
        }
        .presets { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
        .presets button {
            border: var(--feezal-eink-rule, 3px) solid currentColor; background: none;
            color: inherit; font: inherit;
            font-size: var(--feezal-eink-font-size-label, 13px);
            text-transform: uppercase; padding: 3px 8px; cursor: pointer;
            border-radius: var(--feezal-eink-radius, 0px);
        }
        /* Active preset: inverted relative to the CURRENT card face. */
        .card .presets button.active { background: var(--_fg); color: var(--_bg); }
        .card.inv .presets button.active { background: var(--_bg); color: var(--_fg); }
    `];

    constructor() {
        super();
        this.topic       = '';
        this.transition  = '';
        this.label       = '';
        this.showPresets = false;
        this.presets     = '';
        this._ps  = null;
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
        // E137: live-canvas topic edits re-wire through the controller.
        this.wled.rewireIfChanged();
    }

    // ── E137: commands delegate to the controller ───────────────────────────

    toggle()            { this.wled.toggle(); }
    setBrightnessPct(p) { this.wled.setBrightnessPct(p); }

    /** Flat −/+ steppers: ±10 % of the displayed value. */
    _stepBrightness(direction) {
        if (feezal.isEditor) return;
        this.setBrightnessPct((this._pct ?? 0) + direction * 10);
    }

    /** Recall a WLED preset — remembers the id locally (write-only). */
    setPreset(id) {
        if (feezal.isEditor) return;
        const ps = Math.round(Number(id));
        if (!Number.isFinite(ps) || ps < 0) return;
        this._ps = ps;
        this.wled.setPreset(ps);
    }

    /** Numeric fallback (no preset names over MQTT): cycle ids 1–16. */
    _cyclePreset() {
        if (feezal.isEditor) return;
        const next = (this._ps ?? 0) >= 16 ? 1 : (this._ps ?? 0) + 1;
        this.setPreset(next);
    }

    get _pct()         { return this.wled.pct; }
    get _presetsList() { return this.wled.presetsList; }

    /** Displayed % — editor shows a sample value while unwired. */
    get _shownPct() {
        return this._pct ?? (feezal.isEditor ? 65 : null);
    }

    /** E57 redraw dedup: everything visibly rendered, values as shown. */
    renderSignature() {
        return [this.wled.on ? 'on' : 'off', this._shownPct ?? '—',
            this._ps ?? '', this._available].join('|');
    }

    _renderPresets() {
        if (!this.showPresets) return '';
        const list = this._presetsList;
        if (list.length > 0) {
            return html`
                <div class="presets">
                    ${list.map(p => html`<button class="${this._ps === Number(p.id) ? 'active' : ''}"
                        @click="${e => { e.stopPropagation(); this.setPreset(p.id); }}">${p.name ?? p.id}</button>`)}
                </div>`;
        }
        return html`
            <div class="presets">
                <button title="Next preset"
                    @click="${e => { e.stopPropagation(); this._cyclePreset(); }}">PS ${this._ps ?? '–'} ▸</button>
            </div>`;
    }

    render() {
        const pct = this._shownPct;
        return html`
            <div class="card ${this.wled.on ? 'inv' : ''}" role="button" tabindex="0"
                @click="${this.toggle}"
                @keydown="${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(); } }}">
                ${!this._available ? html`<span class="badge-tr" title="Device unavailable">!</span>` : ''}
                <span class="label">${this.label || 'WLED'}</span>
                <div class="row">
                    <button class="stepbtn" title="Dimmer"
                        @click="${e => { e.stopPropagation(); this._stepBrightness(-1); }}">−</button>
                    <span class="value pct">${pct === null ? '—' : html`${pct}<span class="unit">%</span>`}</span>
                    <button class="stepbtn" title="Brighter"
                        @click="${e => { e.stopPropagation(); this._stepBrightness(1); }}">+</button>
                </div>
                ${this._renderPresets()}
            </div>
        `;
    }
}

customElements.define('feezal-element-eink-wled', FeezalElementEinkWled);
export {FeezalElementEinkWled};

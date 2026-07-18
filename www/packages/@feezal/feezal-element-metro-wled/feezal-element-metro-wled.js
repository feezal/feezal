/* global feezal */
import {html, css} from '@feezal/feezal-element';
import {MetroTileBase} from '@feezal/feezal-element-metro-tile';
import {WLED_EFFECTS, WLED_PALETTES, effectName, hexToRgb} from './wled-lists.js';

/**
 * feezal-element-metro-wled (E103 MVP)
 *
 * Metro WLED tile — flat live tile: the front shows the state (on/off,
 * brightness %, current effect name) and a tap toggles; the back (3D flip
 * via ⋯) holds the brightness slider, colour swatch and effect / palette
 * pickers.
 *
 * MQTT contract identical to feezal-element-material-wled (keep in sync):
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
            attributes: [
                ...MetroTileBase.tileAttributes,
                {name: 'topic', type: 'mqttTopic', default: 'wled/device',
                    help: 'WLED device base topic (Sync settings → MQTT). Subscribes <topic>/g (brightness) and <topic>/c (colour); commands are published to <topic>/api as JSON.'},
                {name: 'transition', type: 'number', min: 0, step: 0.1,
                    help: 'Optional crossfade duration in seconds, sent with every command (WLED counts in 0.1 s units). Empty = device default.'},
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
        _on:    {state: true},
        _bri:   {state: true},   // raw 0–255 (null = unknown)
        _color: {state: true},   // '#rrggbb' (null = unknown)
        _fx:    {state: true},   // locally selected effect id
        _pal:   {state: true},   // locally selected palette id
    };

    static styles = [MetroTileBase.styles, css`
        :host { --feezal-metro-off-color: #333; }
        .face { transition: background 0.15s; }
        :host(:not([data-on])) .face { background: var(--feezal-metro-off-color); }
        .state { font-size: 12px; text-transform: lowercase; opacity: 0.85; }
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
        }
        select option { color: #000; }
        input[type='color'].col {
            width: 26px; height: 26px; padding: 0; border: 2px solid var(--feezal-metro-text);
            border-radius: 0; background: none; cursor: pointer; flex: 0 0 auto;
        }
    `];

    constructor() {
        super();
        this.topic      = '';
        this.transition = '';
        this._on    = false;
        this._bri   = null;
        this._color = null;
        this._fx    = null;
        this._pal   = null;
    }

    connectedCallback() {
        this._deriveAvailability();
        super.connectedCallback();
        this._wire();
    }

    /** Auto-derive `<topic>/status` while subscribe-availability is empty or
     * still holds our previous derivation — an explicit user value wins. */
    _deriveAvailability() {
        const derived = this.topic ? `${this.topic}/status` : '';
        const current = this.subscribeAvailability || '';
        if (current === '' || current === this.__derivedAvail) {
            this.__derivedAvail = derived;
            if (current !== derived) this.subscribeAvailability = derived;
        }
    }

    _wireSignature() {
        return this.topic || '';
    }

    _wire() {
        this.__wireSig = this._wireSignature();
        if (!this.topic) return;
        this.addSubscription(`${this.topic}/g`, msg => {
            const v = Number(this.getProperty(msg, this.messageProperty));
            if (Number.isFinite(v)) {
                this._bri = Math.max(0, Math.min(255, Math.round(v)));
                this._on = this._bri > 0;
            }
        });
        this.addSubscription(`${this.topic}/c`, msg => {
            const raw = String(this.getProperty(msg, this.messageProperty) ?? '').trim();
            const m = raw.match(/^#?([0-9a-f]{6})$/i);
            if (m) this._color = '#' + m[1].toLowerCase();
        });
        // <topic>/v (XML state) is deliberately NOT subscribed.
    }

    willUpdate(changed) {
        super.willUpdate?.(changed);
        if (changed.has('topic') || changed.has('subscribeAvailability')) {
            this._deriveAvailability();
        }
    }

    updated(changed) {
        super.updated(changed);
        if (changed.has('_on')) this.toggleAttribute('data-on', this._on);
        // Live rewire when the topic changes at runtime.
        if (this.isConnected && this.__wireSig !== undefined && this._wireSignature() !== this.__wireSig) {
            this._unsubscribe();
            this._wire();
        }
    }

    // ── Commands → <topic>/api ────────────────────────────────────────────────

    _api(obj) {
        if (feezal.isEditor || !this.topic) return;
        const t = Number(this.transition);
        if (this.transition !== '' && this.transition !== null && this.transition !== undefined && Number.isFinite(t)) {
            obj = {...obj, transition: Math.round(t * 10)};
        }
        feezal.connection.pub(`${this.topic}/api`, JSON.stringify(obj));
    }

    toggle() {
        if (feezal.isEditor) return;
        this._on = !this._on;
        this._api({on: this._on});
    }

    setBrightnessPct(pct) {
        if (feezal.isEditor) return;
        const clamped = Math.max(0, Math.min(100, Math.round(Number(pct))));
        this._bri = Math.round((clamped / 100) * 255);
        this._on = this._bri > 0;
        this._api({bri: this._bri});
    }

    setColor(hex) {
        if (feezal.isEditor) return;
        const rgb = hexToRgb(hex);
        if (!rgb) return;
        this._color = hex.toLowerCase();
        this._api({seg: [{col: [rgb]}]});
    }

    setEffect(id) {
        if (feezal.isEditor) return;
        const fx = Math.round(Number(id));
        if (!Number.isFinite(fx) || fx < 0) return;
        this._fx = fx;
        this._api({seg: [{fx}]});
    }

    setPalette(id) {
        if (feezal.isEditor) return;
        const pal = Math.round(Number(id));
        if (!Number.isFinite(pal) || pal < 0) return;
        this._pal = pal;
        this._api({seg: [{pal}]});
    }

    get _pct() {
        return this._bri === null ? null : Math.round((this._bri / 255) * 100);
    }

    // ── Faces ─────────────────────────────────────────────────────────────────

    baseAction() {
        this.toggle();
    }

    renderFront() {
        const pct = this._pct !== null && this._on ? ` ${this._pct}%` : '';
        return html`
            ${this._available ? '' : html`<span class="unavail" title="Device unavailable">⚠</span>`}
            ${this.icon ? html`<feezal-icon name="${this.icon || 'wb_iridescent'}"></feezal-icon>` : ''}
            <div class="state">${this._on ? `on${pct}` : 'off'}</div>
            ${this._on && this._fx !== null ? html`<div class="fxname">${effectName(this._fx)}</div>` : ''}`;
    }

    renderBack() {
        const fxBeyond = this._fx !== null && this._fx >= WLED_EFFECTS.length;
        const palBeyond = this._pal !== null && this._pal >= WLED_PALETTES.length;
        return html`
            <div class="onoff">
                <button class="mbtn ${this._on ? 'active' : ''}" @click="${() => { if (!this._on) this.toggle(); }}">ON</button>
                <button class="mbtn ${this._on ? '' : 'active'}" @click="${() => { if (this._on) this.toggle(); }}">OFF</button>
            </div>
            <div class="rowline">
                <input type="color" class="col" title="Colour"
                    .value="${this._color ?? '#ffffff'}"
                    @change="${e => this.setColor(e.target.value)}">
                <input type="range" min="0" max="100" step="1" title="Brightness"
                    .value="${String(this._pct ?? 0)}"
                    @change="${e => this.setBrightnessPct(e.target.value)}">
            </div>
            <select class="fx" title="Effect"
                @change="${e => { if (e.target.value !== '') this.setEffect(e.target.value); }}">
                <option value="" ?selected="${this._fx === null}">— Effect —</option>
                ${WLED_EFFECTS.map((name, i) => html`
                    <option value="${i}" ?selected="${this._fx === i}">${name}</option>`)}
                ${fxBeyond ? html`<option value="${this._fx}" selected>${this._fx}</option>` : ''}
            </select>
            <select class="pal" title="Palette"
                @change="${e => { if (e.target.value !== '') this.setPalette(e.target.value); }}">
                <option value="" ?selected="${this._pal === null}">— Palette —</option>
                ${WLED_PALETTES.map((name, i) => html`
                    <option value="${i}" ?selected="${this._pal === i}">${name}</option>`)}
                ${palBeyond ? html`<option value="${this._pal}" selected>${this._pal}</option>` : ''}
            </select>`;
    }
}

customElements.define('feezal-element-metro-wled', FeezalElementMetroWled);
export {FeezalElementMetroWled};

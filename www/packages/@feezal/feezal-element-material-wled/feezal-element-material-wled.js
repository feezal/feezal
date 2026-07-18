/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalAvailabilityStyles, availabilityBadge, html, css} from '@feezal/feezal-element';
import {WLED_EFFECTS, WLED_PALETTES, hexToRgb} from './wled-lists.js';

/**
 * feezal-element-material-wled (E103 MVP)
 *
 * WLED device card — single-segment / whole-strip control over WLED's MQTT
 * API. The MQTT contract is identical across the material/glass/metro WLED
 * elements (keep in sync):
 *
 *  - `topic` = the device base topic set in WLED's Sync → MQTT settings.
 *  - Subscribes `<topic>/g` (brightness 0–255, plain number, 0 = off) and
 *    `<topic>/c` (current colour "#RRGGBB"). `<topic>/v` (XML state) is
 *    deliberately NOT subscribed.
 *  - Commands go to `<topic>/api` as /json/state JSON:
 *    on/off {"on":bool}, brightness {"bri":0-255},
 *    colour {"seg":[{"col":[[r,g,b]]}]}, effect {"seg":[{"fx":<id>}]},
 *    palette {"seg":[{"pal":<id>}]}. The optional `transition` attribute
 *    (seconds) is appended to every command as WLED 0.1 s units.
 *  - Availability: WLED publishes retained online/offline on
 *    `<topic>/status`. When `subscribe-availability` is empty the element
 *    auto-derives that topic (property set — an explicit user value always
 *    wins); the base-class N31 machinery does the subscribing.
 *  - Effect/palette names are not discoverable over MQTT — the canonical
 *    WLED 0.14 lists are bundled (wled-lists.js); ids beyond the lists
 *    display numerically.
 */
class FeezalElementMaterialWled extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'WLED', category: 'Material', color: '#1565c0', icon: 'wb_iridescent'},
            description: 'WLED strip control (single segment / whole strip): on/off, brightness, colour, ' +
                'effect and palette over WLED\'s MQTT API (<topic>/g, <topic>/c in, <topic>/api JSON out).',
            links: [
                {label: 'WLED MQTT docs', url: 'https://kno.wled.ge/interfaces/mqtt/'},
            ],
            attributes: [
                {name: 'topic', type: 'mqttTopic', default: 'wled/device',
                    help: 'WLED device base topic (Sync settings → MQTT). Subscribes <topic>/g (brightness) and <topic>/c (colour); commands are published to <topic>/api as JSON.'},
                {name: 'transition', type: 'number', min: 0, step: 0.1,
                    help: 'Optional crossfade duration in seconds, sent with every command (WLED counts in 0.1 s units). Empty = device default.'},
                {name: 'label', type: 'string', help: 'Label shown below the controls.'},
                {name: 'icon', type: 'string', default: 'wb_iridescent', help: 'Material icon name shown on the power button.'},
                {name: 'subscribe-availability', type: 'mqttTopic',
                    help: 'Availability topic (retained online/offline). Empty = auto-derived <topic>/status; set to override.'},
                {name: 'availability-mode', type: 'select', options: ['all', 'any'], default: 'all',
                    help: 'With multiple availability topics: all = every topic must report available; any = at least one.'},
                {name: 'payload-available', type: 'string', default: 'online', help: 'Payload meaning the device is available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning the device is unavailable.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-wled-on-color', type: 'color',
                    default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))',
                    help: 'Accent while the strip is on (overridden by the live strip colour when known).'},
                {property: '--feezal-wled-off-color', type: 'color',
                    default: 'var(--secondary-text-color, #9e9e9e)',
                    help: 'Outline/control colour while off.'},
                {property: '--feezal-wled-surface-color', type: 'color',
                    default: 'var(--primary-background-color, var(--feezal-bg, #fff))',
                    help: 'Control surface colour.'},
                {property: '--feezal-wled-text-color', type: 'color',
                    default: 'var(--primary-text-color, var(--feezal-color, #333))',
                    help: 'Text colour.'},
            ],
            restrict: {minWidth: 110, minHeight: 130},
            defaultStyle: {width: '180px', height: '320px'},
        };
    }

    static properties = {
        topic:      {type: String, reflect: true},
        transition: {type: String, reflect: true},
        label:      {type: String, reflect: true},
        icon:       {type: String, reflect: true},
        _on:    {state: true},
        _bri:   {state: true},   // raw 0–255 (null = unknown)
        _color: {state: true},   // '#rrggbb' (null = unknown)
        _fx:    {state: true},   // locally selected effect id (null = unknown)
        _pal:   {state: true},   // locally selected palette id (null = unknown)
    };

    static styles = [feezalBaseStyles, feezalAvailabilityStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            padding: 10px 8px 8px;
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
            --feezal-wled-on-color:      var(--primary-color, var(--sl-color-primary-600, #0284c7));
            --feezal-wled-off-color:     var(--secondary-text-color, #9e9e9e);
            --feezal-wled-surface-color: var(--primary-background-color, var(--feezal-bg, #fff));
            --feezal-wled-text-color:    var(--primary-text-color, var(--feezal-color, #333));
        }
        button.power {
            width: 64px; height: 64px; border-radius: 50%;
            flex: 0 0 auto; cursor: pointer;
            border: 2px solid var(--feezal-wled-off-color);
            background: var(--feezal-wled-surface-color);
            color: var(--feezal-wled-text-color);
            font: inherit; font-size: 13px; font-weight: 600;
            display: flex; align-items: center; justify-content: center;
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        button.power.on {
            border-color: var(--wled-accent, var(--feezal-wled-on-color));
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--wled-accent, var(--feezal-wled-on-color)) 25%, transparent);
        }
        .row { width: 100%; display: flex; align-items: center; gap: 6px; }
        input[type='range'].bri { flex: 1; accent-color: var(--wled-accent, var(--feezal-wled-on-color)); }
        input[type='color'].col {
            width: 28px; height: 28px; padding: 0; border: 1px solid var(--feezal-wled-off-color);
            border-radius: 6px; background: none; cursor: pointer; flex: 0 0 auto;
        }
        select {
            flex: 1; width: 100%; min-width: 0; box-sizing: border-box;
            background: var(--feezal-wled-surface-color); color: var(--feezal-wled-text-color);
            border: 1px solid var(--feezal-wled-off-color); border-radius: 6px;
            padding: 3px 6px; font-size: 11px; line-height: 1.4; cursor: pointer; outline: none;
        }
        select:hover { border-color: var(--feezal-wled-text-color); }
        .label {
            font-size: 11px; opacity: 0.65; text-align: center;
            color: var(--feezal-wled-text-color);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;
        }
    `];

    constructor() {
        super();
        this.topic      = '';
        this.transition = '';
        this.label      = '';
        this.icon       = 'wb_iridescent';
        this._on    = false;
        this._bri   = null;
        this._color = null;
        this._fx    = null;
        this._pal   = null;
    }

    // No `subscribe` attribute — the base primary-subscription path is a
    // no-op; the WLED topics are wired manually below.

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
        // <topic>/g — brightness 0–255 as a plain number; 0 = off.
        this.addSubscription(`${this.topic}/g`, msg => {
            const v = Number(this.getProperty(msg, this.messageProperty));
            if (Number.isFinite(v)) {
                this._bri = Math.max(0, Math.min(255, Math.round(v)));
                this._on = this._bri > 0;
            }
        });
        // <topic>/c — current colour "#RRGGBB".
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
        // Live rewire when the topic changes at runtime (inspector edits on
        // the live canvas, MQTT setattribute).
        if (this.isConnected && this.__wireSig !== undefined && this._wireSignature() !== this.__wireSig) {
            this._unsubscribe();
            this._wire();
        }
    }

    // ── Commands → <topic>/api (JSON /json/state shape) ──────────────────────

    _api(obj) {
        if (feezal.isEditor || !this.topic) return;
        const t = Number(this.transition);
        if (this.transition !== '' && this.transition !== null && this.transition !== undefined && Number.isFinite(t)) {
            obj = {...obj, transition: Math.round(t * 10)};   // WLED counts 0.1 s units
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

    // ── Render ───────────────────────────────────────────────────────────────

    get _pct() {
        return this._bri === null ? null : Math.round((this._bri / 255) * 100);
    }

    render() {
        const pct = this._pct ?? (feezal.isEditor ? 50 : null);
        const accent = this._on && this._color ? this._color : 'var(--feezal-wled-on-color)';
        const fxBeyond = this._fx !== null && this._fx >= WLED_EFFECTS.length;
        const palBeyond = this._pal !== null && this._pal >= WLED_PALETTES.length;
        return html`
            ${availabilityBadge(this._available)}
            <button class="power ${this._on ? 'on' : ''}" title="Toggle"
                style="--wled-accent:${accent}"
                @click="${this.toggle}">
                ${this._on ? `${pct ?? '—'}%` : 'off'}
            </button>
            <div class="row">
                <input type="color" class="col" title="Colour"
                    .value="${this._color ?? '#ffffff'}"
                    @change="${e => this.setColor(e.target.value)}">
                <input type="range" class="bri" min="0" max="100" step="1" title="Brightness"
                    .value="${String(pct ?? 0)}"
                    @change="${e => this.setBrightnessPct(e.target.value)}">
            </div>
            <div class="row">
                <select class="fx" title="Effect"
                    @change="${e => { if (e.target.value !== '') this.setEffect(e.target.value); }}">
                    <option value="" ?selected="${this._fx === null}">— Effect —</option>
                    ${WLED_EFFECTS.map((name, i) => html`
                        <option value="${i}" ?selected="${this._fx === i}">${name}</option>`)}
                    ${fxBeyond ? html`<option value="${this._fx}" selected>${this._fx}</option>` : ''}
                </select>
            </div>
            <div class="row">
                <select class="pal" title="Palette"
                    @change="${e => { if (e.target.value !== '') this.setPalette(e.target.value); }}">
                    <option value="" ?selected="${this._pal === null}">— Palette —</option>
                    ${WLED_PALETTES.map((name, i) => html`
                        <option value="${i}" ?selected="${this._pal === i}">${name}</option>`)}
                    ${palBeyond ? html`<option value="${this._pal}" selected>${this._pal}</option>` : ''}
                </select>
            </div>
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-material-wled', FeezalElementMaterialWled);
export {FeezalElementMaterialWled};

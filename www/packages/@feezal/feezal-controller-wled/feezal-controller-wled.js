/**
 * @feezal/feezal-controller-wled (E137 — the wled slice, last of v1)
 *
 * The WLED-device MQTT contract as a Lit Reactive Controller — the behavior
 * extracted from the WLED cards (identical across families per E103):
 *
 *  - `topic` = the device base topic (WLED Sync → MQTT settings).
 *  - Subscribes `<topic>/g` (brightness 0–255, 0 = off) and `<topic>/c`
 *    ("#RRGGBB"); `<topic>/v` (XML) deliberately not subscribed.
 *  - Commands to `<topic>/api` as /json/state JSON: {on}, {bri},
 *    {seg:[{col:[[r,g,b]]}]}, {seg:[{fx}]}, {seg:[{pal}]}, {seg:[{sx}]},
 *    {seg:[{ix}]}, {ps}; optional `transition` (s → WLED 0.1 s units)
 *    appended to every command.
 *  - Optional speed/intensity read-back topics (write-mostly otherwise).
 *  - Availability auto-derives `<topic>/status` unless the user set an
 *    explicit topic — the HOST calls `deriveAvailability()` from its
 *    `connectedCallback` (before super, so N31 subscribes the derived
 *    topic) and `willUpdate` (topic edits re-derive).
 *
 * The family element is a VIEW: ring/pill/tile/1-bit chrome + the
 * show-effect/show-palette/show-presets display toggles stay local.
 *
 * E137 packaging: controller + attribute fragment + discovery.map fragment
 * as one unit; `WLED_CONSUMED_ATTRIBUTES` feeds the E114 parity derivation.
 * The bundled WLED effect/palette name tables live here once (previously
 * duplicated per family).
 */

import {WLED_EFFECTS, WLED_PALETTES, effectName, paletteName, hexToRgb} from './wled-lists.js';

export {WLED_EFFECTS, WLED_PALETTES, effectName, paletteName, hexToRgb};

/** Shared attribute descriptors — spread into every family's `feezal.attributes`. */
export const wledAttributes = [
    {name: 'topic', type: 'mqttTopic', default: 'wled/device',
        help: 'WLED device base topic (Sync settings → MQTT). Subscribes <topic>/g (brightness) and <topic>/c (colour); commands are published to <topic>/api as JSON.'},
    {name: 'transition', type: 'number', min: 0, step: 0.1,
        help: 'Optional crossfade duration in seconds, sent with every command (WLED counts in 0.1 s units). Empty = device default.'},
    {name: 'subscribe-speed', type: 'mqttTopic',
        help: 'Optional read-back of the current effect speed (sx, 0–255). WLED does not push sx/ix on <topic>/g — leave empty to default the slider to 128.'},
    {name: 'message-property-speed', type: 'string', default: 'payload',
        help: 'Property path for the speed topic. Defaults to message-property.'},
    {name: 'subscribe-intensity', type: 'mqttTopic',
        help: 'Optional read-back of the current effect intensity (ix, 0–255). Same caveat as subscribe-speed.'},
    {name: 'message-property-intensity', type: 'string', default: 'payload',
        help: 'Property path for the intensity topic. Defaults to message-property.'},
    {name: 'presets', type: 'objectList', itemFields: [{key: 'id', type: 'number'}, {key: 'name'}],
        help: 'Optional list of {id, name} presets shown as a picker. Empty = a numeric "preset #" input is shown instead. Write-only — WLED does not report the active preset over MQTT.'},
];

/** Shared discovery.map fragment (E108 native WLED self-discovery). */
export const wledDiscoveryMap = {
    device_topic: {attr: 'topic'},
    name: 'label',
};

/** Attribute names this controller consumes (parity-set derivation, E114). */
export const WLED_CONSUMED_ATTRIBUTES = wledAttributes.map(a => a.name);

export class WledController {
    /**
     * @param {import('lit').ReactiveControllerHost & HTMLElement} host
     * @param {object} options — family quirks (none needed; flags, not forks).
     */
    constructor(host, options = {}) {
        this.host = host;
        this.options = options;
        host.addController?.(this);
        // ── state (plain fields, E137 decided) ──
        this.on = false;
        this.bri = null;        // raw 0–255 (null = unknown)
        this.color = null;      // '#rrggbb' (null = unknown)
        this.fx = null;         // locally selected effect id
        this.pal = null;        // locally selected palette id
        this.speed = null;      // raw 0–255 (null = unknown → sliders default 128)
        this.intensity = null;  // raw 0–255
        this.__colorDebounce = null;
    }

    _attr(name, fallback = '') {
        const v = this.host.getAttribute(name);
        return v === null ? fallback : v;
    }

    get topic() { return this._attr('topic'); }

    // ── availability derivation (host calls from connectedCallback + willUpdate) ──
    /** Auto-derive `<topic>/status` while subscribe-availability is empty or
     * still holds our previous derivation — an explicit user value wins. */
    deriveAvailability() {
        const derived = this.topic ? `${this.topic}/status` : '';
        const current = this.host.subscribeAvailability || '';
        if (current === '' || current === this.__derivedAvail) {
            this.__derivedAvail = derived;
            if (current !== derived) this.host.subscribeAvailability = derived;
        }
    }

    // ── lifecycle ────────────────────────────────────────────────────────────
    signature() {
        return ['topic', 'subscribe-speed', 'subscribe-intensity'].map(a => this._attr(a)).join('|');
    }

    hostConnected() { this.wire(); }

    hostDisconnected() { clearTimeout(this.__colorDebounce); }

    /** Call from the host's updated() to re-wire on live topic edits. */
    rewireIfChanged() {
        if (this.__sig !== undefined && this.signature() !== this.__sig) {
            this.host._unsubscribe();
            this.wire();
        }
    }

    wire() {
        this.__sig = this.signature();
        const update = () => this.host.requestUpdate();
        const sub = (topic, cb) => { if (topic) this.host.addSubscription(topic, cb); };
        const msgProp = specific => this._attr(specific) || this._attr('message-property') || 'payload';

        if (this.topic) {
            // <topic>/g — brightness 0–255 as a plain number; 0 = off.
            sub(`${this.topic}/g`, msg => {
                const v = Number(this.host.getProperty(msg, msgProp('')));
                if (Number.isFinite(v)) {
                    this.bri = Math.max(0, Math.min(255, Math.round(v)));
                    this.on = this.bri > 0;
                    update();
                }
            });
            // <topic>/c — current colour "#RRGGBB".
            sub(`${this.topic}/c`, msg => {
                const raw = String(this.host.getProperty(msg, msgProp('')) ?? '').trim();
                const m = raw.match(/^#?([0-9a-f]{6})$/i);
                if (m) { this.color = '#' + m[1].toLowerCase(); update(); }
            });
            // <topic>/v (XML state) is deliberately NOT subscribed.
        }
        // Optional speed/intensity read-back — write-mostly, see class doc.
        sub(this._attr('subscribe-speed'), msg => {
            const v = Number(this.host.getProperty(msg, msgProp('message-property-speed')));
            if (Number.isFinite(v)) { this.speed = Math.max(0, Math.min(255, Math.round(v))); update(); }
        });
        sub(this._attr('subscribe-intensity'), msg => {
            const v = Number(this.host.getProperty(msg, msgProp('message-property-intensity')));
            if (Number.isFinite(v)) { this.intensity = Math.max(0, Math.min(255, Math.round(v))); update(); }
        });
    }

    // ── commands → <topic>/api (JSON /json/state shape) ─────────────────────
    api(obj) {
        if (window.feezal?.isEditor || !this.topic) return;
        const transition = this._attr('transition');
        const t = Number(transition);
        if (transition !== '' && Number.isFinite(t)) {
            obj = {...obj, transition: Math.round(t * 10)};   // WLED counts 0.1 s units
        }
        window.feezal.connection.pub(`${this.topic}/api`, JSON.stringify(obj));
    }

    toggle() {
        if (window.feezal?.isEditor) return;
        this.on = !this.on;
        this.api({on: this.on});
        this.host.requestUpdate();
    }

    setBrightnessPct(pct) {
        if (window.feezal?.isEditor) return;
        const clamped = Math.max(0, Math.min(100, Math.round(Number(pct))));
        this.bri = Math.round((clamped / 100) * 255);
        this.on = this.bri > 0;
        this.api({bri: this.bri});
        this.host.requestUpdate();
    }

    setColor(hex) {
        if (window.feezal?.isEditor) return;
        const rgb = hexToRgb(hex);
        if (!rgb) return;
        this.color = hex.toLowerCase();
        this.api({seg: [{col: [rgb]}]});
        this.host.requestUpdate();
    }

    /** Continuous colour-picker input — debounced ~100 ms (broker flooding). */
    colorInput(hex) {
        if (window.feezal?.isEditor) return;
        clearTimeout(this.__colorDebounce);
        this.__colorDebounce = setTimeout(() => this.setColor(hex), 100);
    }

    setEffect(id) {
        if (window.feezal?.isEditor) return;
        const fx = Math.round(Number(id));
        if (!Number.isFinite(fx) || fx < 0) return;
        this.fx = fx;
        this.api({seg: [{fx}]});
        this.host.requestUpdate();
    }

    setPalette(id) {
        if (window.feezal?.isEditor) return;
        const pal = Math.round(Number(id));
        if (!Number.isFinite(pal) || pal < 0) return;
        this.pal = pal;
        this.api({seg: [{pal}]});
        this.host.requestUpdate();
    }

    setSpeedPct(pct) {
        if (window.feezal?.isEditor) return;
        const clamped = Math.max(0, Math.min(100, Math.round(Number(pct))));
        this.speed = Math.round((clamped / 100) * 255);
        this.api({seg: [{sx: this.speed}]});
        this.host.requestUpdate();
    }

    setIntensityPct(pct) {
        if (window.feezal?.isEditor) return;
        const clamped = Math.max(0, Math.min(100, Math.round(Number(pct))));
        this.intensity = Math.round((clamped / 100) * 255);
        this.api({seg: [{ix: this.intensity}]});
        this.host.requestUpdate();
    }

    /** Recall a WLED preset — {"ps":<id>}; write-only (no MQTT read-back). */
    setPreset(id) {
        if (window.feezal?.isEditor) return;
        const ps = Math.round(Number(id));
        if (!Number.isFinite(ps) || ps < 0) return;
        this.api({ps});
    }

    // ── computed values (shared by every view) ──────────────────────────────
    get pct() {
        return this.bri === null ? null : Math.round((this.bri / 255) * 100);
    }

    get speedPct() {
        return Math.round(((this.speed ?? 128) / 255) * 100);
    }

    get intensityPct() {
        return Math.round(((this.intensity ?? 128) / 255) * 100);
    }

    /** The user-supplied {id, name} preset list ([] when unset/invalid). */
    get presetsList() {
        try {
            const raw = this._attr('presets');
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch {
            return [];
        }
    }
}

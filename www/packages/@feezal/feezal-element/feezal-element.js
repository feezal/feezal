/* global feezal */
import {LitElement, html, css} from 'lit';
import {FeezalConditions} from './feezal-conditions.js';

/**
 * Shared base styles — identical to the Polymer dom-module 'feezal-style-element'.
 * Exported so subclasses can compose via:
 *   static styles = [FeezalElementLit.styles, css`...additional...`];
 */
export const feezalBaseStyles = css`
    :host {
        display: inline-block;
        box-sizing: border-box;
        overflow: hidden;
    }
    :host([hidden]) {
        display: none;
    }
    :host(.feezal-editable) {
        outline: 1px dashed rgba(var(--feezal-selection-rgb, 2,132,199), 0.8);
    }
    :host(.feezal-editable) * {
        pointer-events: none;
    }
    :host(.feezal-editable.feezal-selected) {
        outline: 2px dashed rgba(var(--feezal-selection-rgb, 2,132,199), 0.9);
    }
`;

/**
 * FeezalElement — Lit base class for feezal elements.
 *
 * A faithful port of the Polymer-based FeezalPolymerElement to Lit 3.
 * Paper elements keep importing the Polymer FeezalPolymerElement unchanged;
 * only the basic-* elements use this class.
 *
 * Key differences from the Polymer base:
 *   - Subclass CSS goes in static styles = [FeezalElement.styles, css`...`]
 *   - Polymer observers become updated(changed) guards
 *   - this.$.id becomes this.renderRoot.querySelector('#id')
 *   - Lit needs explicit attribute: 'kebab-name' for camelCase properties
 */
export class FeezalElement extends LitElement {
    static styles = feezalBaseStyles;

    static get feezal() {
        return {attributes: [], styles: []};
    }

    static properties = {
        // NOTE: Lit does NOT auto-convert camelCase to kebab-case for attribute
        // names (unlike Polymer).  Each camelCase property needs an explicit
        // attribute option so that saved views (which store kebab-case) are
        // read back correctly.
        subscribe:            {type: String,  reflect: true, attribute: 'subscribe'},
        messageProperty:      {type: String,  reflect: true, attribute: 'message-property'},
        dynamicSubscriptions: {type: Boolean, reflect: true, attribute: 'dynamic-subscriptions'},
        visible:              {type: Boolean, reflect: true},
        // E50: JSON list of condition rows (visibility/class/style/attribute
        // bound to MQTT topics). Never reflected — the attribute is the
        // source of truth; effects only apply in the viewer.
        conditions:           {type: String,  attribute: 'conditions'},
        // ── N31: availability — universal base-class machinery ───────────
        // subscribe-availability accepts a single topic string (back-compat)
        // OR a JSON array of topics / {topic, property} entries (the modern
        // HA discovery form: bridge state + device availability). The base
        // subscribes, tracks per-topic status and combines it per
        // availability-mode into the reactive `_available` flag; rendering
        // (badges, dimming) stays element business. Elements that want the
        // fields in their inspector declare the attributes in their own
        // descriptor — the machinery works regardless.
        // Deliberately NOT reflected: Lit reflects constructor defaults on
        // first update, which would stamp subscribe-availability="" /
        // payload-available="online" / … onto EVERY element and serialize
        // that junk into every saved dashboard (and it broke the U32
        // create-component attribute table). The inspector and discovery
        // write the attributes directly; attribute → property sync is all
        // the machinery needs.
        subscribeAvailability: {type: String, attribute: 'subscribe-availability'},
        availabilityMode:      {type: String, attribute: 'availability-mode'},
        payloadAvailable:      {type: String, attribute: 'payload-available'},
        payloadUnavailable:    {type: String, attribute: 'payload-unavailable'},
        msgPropAvailability:   {type: String, attribute: 'message-property-availability'},
        _available:            {state: true},
    };

    constructor() {
        super();
        this._subscriptions = [];
        this._subscribed = false;
        this.messageProperty = 'payload';
        this.dynamicSubscriptions = false;
        this.visible = false;
        this._conditions = new FeezalConditions(this);
        // N31 availability defaults (payload values = HA defaults)
        this.subscribeAvailability = '';
        this.availabilityMode = 'all';
        this.payloadAvailable = 'online';
        this.payloadUnavailable = 'offline';
        this.msgPropAvailability = '';
        this._available = true;
        this._availabilitySubs = [];
        this._availabilityStatus = {};
    }

    connectedCallback() {
        super.connectedCallback();
        this.classList.add('feezal-element');
        if (this.visible || !this.dynamicSubscriptions) {
            this._subscribe();
            this._conditions.connect();
        }
        // N31: availability is independent of the primary-subscription
        // machinery (elements overriding _subscribe with an empty body still
        // get it) and not editor-gated — it only feeds internal state, never
        // writes serializable attributes in the editor.
        this._subscribeAvailability();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubscribe();
        this._unsubscribeAvailability();
        this._conditions.disconnect();
    }

    updated(changed) {
        if (changed.has('visible') && this.dynamicSubscriptions) {
            if (this.visible) {
                this._subscribe();
                this._conditions.connect();
            } else {
                this._unsubscribe();
                this._conditions.disconnect();
            }
        }

        // E50: conditions added/edited/removed at runtime → restart the
        // engine. connect() is idempotent for an unchanged attribute, so the
        // first update after mount is a no-op.
        if (changed.has('conditions') && (this.visible || !this.dynamicSubscriptions)) {
            this._conditions.connect();
        }

        // N31: availability wiring changed at runtime (inspector edits on the
        // live canvas) → rewire. Signature-guarded so the first update after
        // connect is a no-op.
        if (this.isConnected && this.__availSig !== undefined &&
            this._availabilitySignature() !== this.__availSig) {
            this._unsubscribeAvailability();
            this._subscribeAvailability();
        }
    }

    // ── N31: availability ────────────────────────────────────────────────────

    _availabilitySignature() {
        return [this.subscribeAvailability, this.availabilityMode,
            this.payloadAvailable, this.payloadUnavailable, this.msgPropAvailability].join('|');
    }

    /** Parse subscribe-availability: '' → [], plain topic string → one entry,
     * JSON array of strings / {topic, property} objects → many entries. */
    _availabilityEntries() {
        const raw = (this.subscribeAvailability || '').trim();
        if (!raw) return [];
        if (raw.startsWith('[')) {
            try {
                const arr = JSON.parse(raw);
                return (Array.isArray(arr) ? arr : [])
                    .map(entry => (typeof entry === 'string' ? {topic: entry} : entry))
                    .filter(entry => entry && typeof entry.topic === 'string' && entry.topic);
            } catch {
                return [];
            }
        }
        return [{topic: raw}];
    }

    _subscribeAvailability() {
        this.__availSig = this._availabilitySignature();
        this._availabilityStatus = {};
        const entries = this._availabilityEntries();
        if (entries.length === 0) {
            this._setAvailable(true);
            return;
        }
        entries.forEach((entry, index) => {
            const key = index + ':' + entry.topic;
            this._availabilityStatus[key] = null; // unknown until the first message
            this._availabilitySubs.push(feezal.connection.sub(entry.topic, msg => {
                let v = this.getProperty(msg, entry.property || this.msgPropAvailability || this.messageProperty);
                // Unwrap JSON {"state": "online"} payloads (zigbee2mqtt availability)
                if (typeof v === 'string') {
                    try {
                        const parsed = JSON.parse(v);
                        if (parsed && typeof parsed === 'object' && 'state' in parsed) v = parsed.state;
                    } catch { /* not JSON — use the raw string */ }
                } else if (v && typeof v === 'object' && 'state' in v) {
                    v = v.state;
                }
                const s = String(v).toLowerCase();
                this._availabilityStatus[key] = String(v) === this.payloadAvailable ||
                    (s !== String(this.payloadUnavailable).toLowerCase() &&
                     s !== 'offline' && s !== 'false' && s !== '0' && s !== 'unavailable');
                this._recomputeAvailability();
            }));
        });
        this._recomputeAvailability();
    }

    _unsubscribeAvailability() {
        this._availabilitySubs.forEach(sub => feezal.connection.unsubscribe(sub));
        this._availabilitySubs = [];
    }

    /** Combine per-topic status per availability-mode into `_available`.
     * Topics without a message yet count as available (matches the previous
     * per-element behaviour — an element never starts out badged). */
    _recomputeAvailability() {
        const statuses = Object.values(this._availabilityStatus);
        const known = statuses.filter(v => v !== null);
        this._setAvailable(this.availabilityMode === 'any'
            ? (known.length === 0 || known.some(Boolean))
            : statuses.every(v => v !== false));
    }

    _setAvailable(available) {
        this._available = available;
        // Styling hook for themes/zero-effort elements — viewer only: a
        // reflected attribute in the editor would be serialized into the
        // saved views.html.
        if (!feezal.isEditor) {
            this.toggleAttribute('unavailable', !available);
        }
    }

    // ── Subscription helpers ─────────────────────────────────────────────────

    /** Subscribe to a single topic — convenience wrapper for subclasses. */
    addSubscription(topic, callback) {
        this._subscriptions.push(feezal.connection.sub(topic, callback));
    }

    _subscribe() {
        // The _subscribed guard makes this idempotent: an element that mounts
        // with visible already set (the attribute reflects, so it can arrive
        // from saved view HTML) hits _subscribe from both connectedCallback
        // and the first updated() — without the guard every topic would be
        // subscribed twice and each message processed twice.
        if (!this.subscribe || this._subscribed) {
            return;
        }

        // In the editor, runtime MQTT manipulation of elements is gated by a user
        // setting (Editor settings → "Prevent MQTT element manipulation in editor",
        // default ON) so live broker values never get written onto elements and
        // serialized into the saved view.
        if (feezal.isEditor && feezal.preventEditorMqtt !== false) {
            return;
        }

        this._subscribed = true;

        const base      = this.subscribe;
        const elemClass = window.customElements.get(this.localName);

        // Primary state topic → baseAttribute (exact topic, no wildcard).
        const baseAttribute = elemClass?.feezal?.baseAttribute;
        if (baseAttribute) {
            this._subscriptions.push(feezal.connection.sub(base, msg => {
                const type = (elemClass.properties?.[baseAttribute] || {}).type;
                const val  = this._payloadCast(type, this.getProperty(msg, this.messageProperty));
                if (type === Boolean && !val) {
                    this.removeAttribute(baseAttribute);
                } else {
                    this.setAttribute(baseAttribute, val);
                }
            }));
        }

        // Reserved runtime-control channel — distinct, exact topics so device
        // telemetry sharing the base topic can never reach the element.
        // Consistent with feezal-view / feezal-site addclass / removeclass.
        this._subscribeControl(base);
    }

    /** Subscribe to the reserved <base>/{setattribute,removeattribute,setstyle,removestyle,addclass,removeclass} control topics. */
    _subscribeControl(base) {
        const sub  = (suffix, cb) => this._subscriptions.push(feezal.connection.sub(base + '/' + suffix, cb));
        const val  = msg => this.getProperty(msg, this.messageProperty);
        const list = p => (Array.isArray(p) ? p : String(p).split(/[,\s]+/)).filter(Boolean);

        sub('setattribute', msg => {
            const obj = val(msg);
            if (obj && typeof obj === 'object') {
                for (const [k, v] of Object.entries(obj)) this.setAttribute(k, String(v));
            }
        });
        sub('removeattribute', msg => list(val(msg)).forEach(n => this.removeAttribute(n)));
        sub('setstyle', msg => {
            const obj = val(msg);
            if (obj && typeof obj === 'object') Object.assign(this.style, obj);
        });
        sub('removestyle', msg => list(val(msg)).forEach(n => this.style.removeProperty(n)));
        sub('addclass', msg => this.classList.add(val(msg)));
        sub('removeclass', msg => this.classList.remove(val(msg)));
    }

    _unsubscribe() {
        this._subscribed = false;
        const sub = this._subscriptions.shift();
        if (sub) {
            feezal.connection.unsubscribe(sub);
            this._unsubscribe();
        }
    }

    // ── Utilities (ported 1:1 from the Polymer base) ─────────────────────────

    _payloadCast(type, payload) {
        if (typeof payload === 'string' && type === Boolean) {
            return Number(payload) !== 0 && payload.toLowerCase() !== 'false';
        }
        return payload;
    }

    throttle(func, limit) {
        let lastFunc;
        let lastRan;
        return function () {
            const context = this;
            const args    = arguments;
            if (!lastRan) {
                func.apply(context, args);
                lastRan = Date.now();
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(function () {
                    if ((Date.now() - lastRan) >= limit) {
                        func.apply(context, args);
                        lastRan = Date.now();
                    }
                }, limit - (Date.now() - lastRan));
            }
        };
    }

    split(str) {
        str = String(str);
        if (str.indexOf('\\') === -1) {
            return str.split('.');
        }
        const res = [];
        let pos = 0;
        function chunk(start, end) {
            res.push(str.slice(start, end).replace(/\\\\/g, '\\').replace(/\\\./g, '.'));
            pos = end + 1;
        }
        let esc, j;
        const l = str.length;
        let i;
        for (i = 0; i < l; i++) {
            if (str[i] === '.') {
                esc = false;
                for (j = i - 1; str[j] === '\\'; j--) {
                    esc = !esc;
                }
                if (!esc) {
                    chunk(pos, i);
                }
            }
        }
        chunk(pos, i);
        return res;
    }

    getProperty(obj, prop) {
        const type = typeof obj;
        if (type !== 'object' && type !== 'function') {
            return typeof prop === 'undefined' ? obj : undefined;
        }
        const arr = this.split(String(prop));
        let res = obj;
        for (let i = 0, l = arr.length; i < l; i++) {
            if (res) {
                res = res[arr[i]];
            }
        }
        return res;
    }
}

// ── N31: shared availability badge (optional consistency helper) ─────────────
// Elements MAY compose these into their render/styles instead of hand-rolling
// a badge — the base class itself renders nothing. Themable via the
// --feezal-unavailable-* custom properties.
export const feezalAvailabilityStyles = css`
    .feezal-unavail-badge {
        position: absolute;
        top: var(--feezal-unavailable-top, 4px);
        right: var(--feezal-unavailable-right, 4px);
        font-size: var(--feezal-unavailable-size, 14px);
        line-height: 1;
        color: var(--feezal-unavailable-color, var(--error-color, #b00020));
        opacity: 0.85;
        pointer-events: none;
        z-index: 2;
    }
`;

/** Badge template partial: renders nothing while available. */
export function availabilityBadge(available) {
    return available ? '' : html`<span class="feezal-unavail-badge" title="Device unavailable">⚠</span>`;
}

// Re-export so element files can do a single import.
export {html, css};

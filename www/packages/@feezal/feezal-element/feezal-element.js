/* global feezal */
import {LitElement, html, css} from 'lit';

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
    };

    constructor() {
        super();
        this._subscriptions = [];
        this.messageProperty = 'payload';
        this.dynamicSubscriptions = false;
        this.visible = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this.classList.add('feezal-element');
        if (this.visible || !this.dynamicSubscriptions) {
            this._subscribe();
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubscribe();
    }

    updated(changed) {
        if (changed.has('visible') && this.dynamicSubscriptions) {
            if (this.visible) {
                this._subscribe();
            } else {
                this._unsubscribe();
            }
        }
    }

    // ── Subscription helpers ─────────────────────────────────────────────────

    /** Subscribe to a single topic — convenience wrapper for subclasses. */
    addSubscription(topic, callback) {
        this._subscriptions.push(feezal.connection.sub(topic, callback));
    }

    _subscribe() {
        if (!this.subscribe) {
            return;
        }

        // In the editor, runtime MQTT manipulation of elements is gated by a user
        // setting (Editor settings → "Prevent MQTT element manipulation in editor",
        // default ON) so live broker values never get written onto elements and
        // serialized into the saved view.
        if (feezal.isEditor && feezal.preventEditorMqtt !== false) {
            return;
        }

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

// Re-export so element files can do a single import.
export {html, css};

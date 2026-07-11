/* global window, feezal */

import {PolymerElement, html} from '@polymer/polymer/polymer-element.js';
import {FeezalConditions} from './feezal-conditions.js';

const styleElement = document.createElement('dom-module');

styleElement.innerHTML =
    `<template>
       <style>
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
        :host(.feezal-editable[locked]) {
            outline: 1.5px dashed #f59e0b !important;
        }
        :host(.feezal-editable.feezal-selected[locked]) {
            outline: 2px solid #f59e0b !important;
        }
       </style>
     </template>`;

styleElement.register('feezal-style-element');

class FeezalPolymerElement extends PolymerElement {
    static get properties() {
        return {
            name: {
                type: String,
                value: '',
                reflectToAttribute: true,
            },
            'selected': {
                type: Boolean,
                value: false
            },
            subscribe: {
                type: String,
                value: '',
                reflectToAttribute: true,
            },
            messageProperty: {
                type: String,
                value: 'payload',
                reflectToAttribute: true,
            },
            'dynamicSubscriptions': {
                type: Boolean,
                value: false,
                reflectToAttribute: true
            },
            'visible': {
                type: Boolean,
                value: false,
                observer: '_visibleChanged'
            },
            // E50: JSON list of condition rows — shared engine, see
            // feezal-conditions.js. The attribute is the source of truth.
            conditions: {
                type: String,
                observer: '_conditionsChanged'
            }
        }
    }
    static get feezal() {
        return {
            attributes: [],
            styles: []
        }
    }

    _payloadCast(type, payload) {
        if (typeof payload === 'string') {
            switch (type) {
                case Boolean:
                    return Number(payload) !== 0 && payload.toLowerCase() !== 'false';
                default:
                    return payload;
            }
        } else {
            return payload;
        }
    }

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
        const baseAttribute = elemClass && elemClass.feezal && elemClass.feezal.baseAttribute;
        if (baseAttribute) {
            this._subscriptions.push(feezal.connection.sub(base, msg => {
                const type = (elemClass.properties[baseAttribute] || {}).type;
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

    constructor() {
        super();
        this._subscriptions = [];
        this._conditions = new FeezalConditions(this);
    }

    connectedCallback() {
        super.connectedCallback();
        this.classList.add('feezal-element');
        // Prevent tab-focus on shadow DOM controls while in the editor.
        if (feezal.isEditor && this.shadowRoot) {
            this.shadowRoot.querySelectorAll('*').forEach(el => {
                if (el.hasAttribute('tabindex')) {
                    el.addEventListener('focus', event => {
                        event.preventDefault();
                        if (event.relatedTarget) {
                            event.relatedTarget.focus();
                        } else {
                            event.currentTarget.blur();
                        }
                    });
                    el.setAttribute('tabindex', '-1');
                }
            });
        }
        if (this.visible || !this.dynamicSubscriptions) {
            this._subscribe();
            this._conditions.connect();
        }
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubscribe();
        this._conditions.disconnect();
    }

    _visibleChanged(visible) {
        if (!this.dynamicSubscriptions) {
            return;
        }
        if (visible) {
            this._subscribe();
            this._conditions.connect();
        } else {
            this._unsubscribe();
            this._conditions.disconnect();
        }
    }

    // E50: conditions added/edited/removed at runtime → restart the engine
    // (idempotent for an unchanged attribute value).
    _conditionsChanged() {
        if (this.isConnected && (this.visible || !this.dynamicSubscriptions)) {
            this._conditions.connect();
        }
    }

    // Utils
    throttle(func, limit) {
        let lastFunc;
        let lastRan;
        return function () {
            const context = this;
            const args = arguments;

            if (!lastRan) {
                func.apply(context, args);
                lastRan = Date.now();
            } else {
                clearTimeout(lastFunc);
                this._inThrottle = true;
                lastFunc = setTimeout(function () {
                    if ((Date.now() - lastRan) >= limit) {
                        func.apply(context, args);
                        lastRan = Date.now();
                        this._inThrottle = false;
                    }
                }, limit - (Date.now() - lastRan));
            }
        }
    }

    /**
     * @method split
     * Split str by '.' - supports backslash escaped delimiters
     * @param {string} str
     * @returns {Array.<string>}
     */
    split(str) {
        str = String(str);

        // Use native split if possible
        if (str.indexOf('\\') === -1) {
            return str.split('.');
        }

        var res = []; // The result array
        var pos = 0;  // Starting position of current chunk

        function chunk(start, end) {
            // Slice, unescape and push onto result array.
            res.push(str.slice(start, end).replace(/\\\\/g, '\\').replace(/\\\./g, '.'));
            // Set starting position of next chunk.
            pos = end + 1;
        }

        var esc; // Boolean indicating if a dot is escaped
        var j;
        var i;
        var l = str.length;
        for (i = 0; i < l; i++) {
            if (str[i] === '.') {
                esc = false;
                // Walk over preceding backslashes in reverse direction
                for (j = i - 1; str[j] === '\\'; j--) {
                    esc = !esc;
                }
                // Dot is escaped only if preceded by an odd number of backslashes
                if (!esc) {
                    chunk(pos, i);
                }
            }
        }

        chunk(pos, i);

        return res;
    }

     /**
     * @method getProperty
     * get an objects property. supports nested properties through dot-notation, dots may be escaped by backslash
     * @param {Object} obj
     * @param {string} prop
     * @returns {all} the properties value or undefined
     */
    getProperty(obj, prop) {
        var type = typeof obj;
        if (type !== 'object' && type !== 'function') {
            if (typeof prop === 'undefined') {
                return obj;
            }
            return undefined;
        }
        var arr = this.split(String(prop));
        var res = obj;
        for (let i = 0, l = arr.length; i < l; i++) {
            if (res) {
                res = res[arr[i]];
            }
        }
        return res;
    }
}

window.customElements.define('feezal-element', FeezalPolymerElement);

export {FeezalPolymerElement, html};

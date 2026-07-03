// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal viewer runtime
/* global feezal */

/**
 * feezal-component — U32 composed elements.
 *
 * Generic instance element for reusable parameterized components. The
 * definition is a <template feezal-component="name"> child of <feezal-site>
 * with ${param} placeholders in attribute values / text nodes and a
 * feezal-params JSON attribute declaring each parameter (type/default/label).
 * An instance <feezal-component name="..."> stamps the substituted template
 * content into its light DOM — children are ordinary feezal elements that
 * subscribe to MQTT themselves, so live data works in editor and viewer with
 * zero extra code.
 *
 * Serialized sites persist only the empty instance tag (the editor's _clean()
 * strips stamped content); stamping in connectedCallback repopulates it, and
 * _stamp() always clears first so re-stamping is idempotent.
 */

const PLACEHOLDER_RE = /\$\{([a-z][a-z0-9-]*)\}/g;

// Attribute mutations that must NOT trigger a re-stamp: editor bookkeeping
// (class/style churn during drag, selection classes, lock, focus handling).
const IGNORED_ATTRS = new Set(['class', 'style', 'locked', 'tabindex']);

class FeezalComponent extends HTMLElement {
    // Minimal metadata so the editor's initElem()/inspector machinery works;
    // the attribute inspector special-cases instances and builds the param
    // controls from the template's feezal-params instead of this list.
    static get feezal() {
        return {attributes: [], styles: []};
    }

    constructor() {
        super();
        const shadow = this.attachShadow({mode: 'open'});
        // Stamped children are absolutely positioned relative to the instance
        // box (the instance itself is positioned by the containing view).
        const style = document.createElement('style');
        style.textContent = `
            :host { display: block; position: relative; box-sizing: border-box; overflow: hidden; }
            ::slotted(*) { position: absolute; }
            :host(.feezal-editable) { outline: 1px dashed rgba(var(--feezal-selection-rgb, 2,132,199), 0.8); }
            :host(.feezal-editable) ::slotted(*) { pointer-events: none; }
            .feezal-component-missing {
                display: flex; align-items: center; justify-content: center;
                position: absolute; inset: 0; padding: 4px; box-sizing: border-box;
                font-size: 11px; color: #c62828; text-align: center;
                border: 1px dashed #c62828;
            }`;
        shadow.appendChild(style);
        shadow.appendChild(document.createElement('slot'));
    }

    connectedCallback() {
        this._stamp();
        if (!this._attrObserver) {
            this._attrObserver = new MutationObserver(mutations => {
                if (mutations.some(m => !IGNORED_ATTRS.has(m.attributeName))) {
                    this._stamp();
                }
            });
            this._attrObserver.observe(this, {attributes: true});
        }
    }

    disconnectedCallback() {
        if (this._attrObserver) {
            this._attrObserver.disconnect();
            this._attrObserver = null;
        }
    }

    /** The <template feezal-component> this instance stamps from (or null). */
    get template() {
        const name = this.getAttribute('name');
        if (!name) return null;
        const site = this.closest('feezal-site') ||
            (typeof feezal !== 'undefined' && feezal.site) || null;
        return site ? site.querySelector(`template[feezal-component="${name}"]`) : null;
    }

    /** Declared parameters from the template's feezal-params attribute. */
    get params() {
        const template = this.template;
        if (!template) return {};
        try {
            return JSON.parse(template.getAttribute('feezal-params') || '{}');
        } catch {
            return {};
        }
    }

    /** Effective value for a parameter: instance attribute, else declared default. */
    paramValue(name, params) {
        const attr = this.getAttribute(name);
        if (attr !== null) return attr;
        const spec = (params || this.params)[name];
        return spec && spec.default !== undefined ? String(spec.default) : '';
    }

    /**
     * (Re)stamp the substituted template content into the light DOM.
     * Always clears first — idempotent, so connectedCallback after paste,
     * undo-restore or innerHTML snapshots never duplicates content.
     */
    _stamp() {
        this.innerHTML = '';
        const missing = this.shadowRoot.querySelector('.feezal-component-missing');
        if (missing) missing.remove();

        const template = this.template;
        if (!template) {
            const warn = document.createElement('div');
            warn.className = 'feezal-component-missing';
            warn.textContent = `unknown component: ${this.getAttribute('name') || '?'}`;
            this.shadowRoot.appendChild(warn);
            return;
        }

        const params = this.params;
        const fragment = template.content.cloneNode(true);
        this._substitute(fragment, params);
        this.appendChild(fragment);
        this._updateSize(template);
    }

    /**
     * DOM-level ${param} substitution: walk the fragment and replace
     * placeholders inside attribute values and text nodes. Values are inert
     * by construction — no markup injection via parameter values.
     */
    _substitute(root, params) {
        const replace = text =>
            text.replace(PLACEHOLDER_RE, (match, name) =>
                name in params ? this.paramValue(name, params) : match);

        const walk = node => {
            if (node.nodeType === Node.TEXT_NODE) {
                if (node.nodeValue.includes('${')) node.nodeValue = replace(node.nodeValue);
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
            if (node.attributes) {
                for (const attr of node.attributes) {
                    if (attr.value.includes('${')) attr.value = replace(attr.value);
                }
            }
            // Recurse into nested inert templates (e.g. card-template children)
            // as well as regular child nodes.
            if (node.content) walk(node.content);
            node.childNodes.forEach(walk);
        };
        walk(root);
    }

    /**
     * Fixed-size instances (MVP): the instance box is the template's bounding
     * box, computed from the children's inline px styles (the editor always
     * positions with px inline styles; elements without inline width/height
     * contribute only their origin). Resize handles are suppressed in the
     * editor, so width/height are entirely template-derived.
     */
    _updateSize(template) {
        let right = 0;
        let bottom = 0;
        for (const child of template.content.children) {
            const left = Number.parseFloat(child.style?.left) || 0;
            const top = Number.parseFloat(child.style?.top) || 0;
            const width = Number.parseFloat(child.style?.width) || 0;
            const height = Number.parseFloat(child.style?.height) || 0;
            right = Math.max(right, left + width);
            bottom = Math.max(bottom, top + height);
        }
        if (right > 0) this.style.width = right + 'px';
        if (bottom > 0) this.style.height = bottom + 'px';
    }
}

window.customElements.define('feezal-component', FeezalComponent);

export {FeezalComponent};

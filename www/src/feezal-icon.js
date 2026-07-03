// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal viewer runtime
/* global feezal */

/**
 * feezal-icon — N23 icon-set registry + shared resolver element.
 *
 * Icon-set packages (feezal-icons-*) call feezal.registerIcons() on import:
 *
 *   feezal.registerIcons(setName, {
 *       font?:  {family: 'Font Family Name'},   // ligature webfont (package injects @font-face)
 *       names:  ['lightbulb', ...],             // advertised to the editor's icon picker
 *       render?(name) {}                        // → SVGElement | string (SVG markup)
 *   });
 *
 * Icon attribute values are namespaced HA-style: `mdi:lightbulb`,
 * `knx-uf:sunblind`. A bare name (no colon) is the built-in Material set —
 * unchanged from all previously saved sites.
 *
 * <feezal-icon name="mdi:lightbulb"> resolves the prefix through the registry
 * and renders in its shadow DOM (ligature span or render() output); elements
 * and the editor's icon picker both render through it, so they stay
 * set-agnostic. Class-plus-codepoint webfonts (whose CSS cannot reach shadow
 * DOM) must use render() instead — see docs/icons-spec.md.
 *
 * Sizing: the glyph tracks the host's font-size and color (1em, currentColor).
 */

const SET_NAME_RE = /^[a-z][a-z0-9-]*$/;
const sets = new Map();   // setName → {font?, names, render?}

/** Register (or replace) a named icon set. Called by feezal-icons-* packages on import. */
function registerIcons(setName, definition) {
    _exposeGlobals();   // re-attach if the feezal global was (re)created after module load
    if (!SET_NAME_RE.test(String(setName || ''))) {
        throw new Error(`registerIcons: invalid set name "${setName}" (lowercase letters, digits, hyphens)`);
    }
    const {font, names, render} = definition || {};
    if (!Array.isArray(names)) {
        throw new Error(`registerIcons("${setName}"): "names" must be an array of icon names`);
    }
    if (!font && typeof render !== 'function') {
        throw new Error(`registerIcons("${setName}"): a set needs "font" (ligature webfont) or "render(name)"`);
    }
    sets.set(setName, {font, names: [...names], render});
    document.dispatchEvent(new CustomEvent('feezal-iconsets-changed', {detail: {set: setName}}));
}

/** Registered sets: Map(setName → {font?, names, render?}). Read-only by convention. */
function iconSets() {
    return sets;
}

/**
 * Names of one registered set (read-only), or null if not registered.
 * Exposed on window.feezal for elements that derive icon names — e.g.
 * basic-icon-value resolving _0.._100 variant families.
 */
function iconSetNames(setName) {
    const def = sets.get(setName);
    return def ? def.names : null;
}

/** Split an icon value into {set, name}. set === null means built-in Material. */
function resolveIcon(value) {
    const raw = String(value || '');
    const idx = raw.indexOf(':');
    if (idx === -1) return {set: null, name: raw};
    return {set: raw.slice(0, idx), name: raw.slice(idx + 1)};
}

function _exposeGlobals() {
    if (typeof window === 'undefined') return;
    window.feezal = window.feezal || {};
    if (window.feezal.registerIcons !== registerIcons) {
        window.feezal.registerIcons = registerIcons;
        window.feezal.iconSetNames = iconSetNames;
        // Set names for discovery (mirrors window.feezal.themes).
        Object.defineProperty(window.feezal, 'iconSets', {
            configurable: true,
            get: () => [...sets.keys()]
        });
    }
}

_exposeGlobals();

class FeezalIcon extends HTMLElement {
    static get observedAttributes() {
        return ['name'];
    }

    constructor() {
        super();
        const shadow = this.attachShadow({mode: 'open'});
        const style = document.createElement('style');
        style.textContent = `
            :host { display: inline-flex; align-items: center; justify-content: center; line-height: 1; }
            .glyph {
                font-weight: normal; font-style: normal;
                font-size: inherit; line-height: 1; letter-spacing: normal; text-transform: none;
                display: inline-block; white-space: nowrap; word-wrap: normal; direction: ltr;
                -webkit-font-feature-settings: 'liga'; font-feature-settings: 'liga';
                -webkit-font-smoothing: antialiased;
            }
            .svg-wrap { display: inline-flex; }
            .svg-wrap svg { width: 1em; height: 1em; fill: currentColor; }
            .missing {
                font-size: 0.55em; opacity: 0.6; font-family: Consolas, monospace;
                overflow: hidden; text-overflow: ellipsis; max-width: 100%;
            }`;
        shadow.appendChild(style);
        this._slot = document.createElement('span');
        shadow.appendChild(this._slot);
    }

    connectedCallback() {
        this._render();
        // Re-render when a set registers after this icon connected (packages
        // load asynchronously via the dynamic feezal-elements.js module).
        this._onSetsChanged = () => this._render();
        document.addEventListener('feezal-iconsets-changed', this._onSetsChanged);
    }

    disconnectedCallback() {
        document.removeEventListener('feezal-iconsets-changed', this._onSetsChanged);
        this._onSetsChanged = null;
    }

    attributeChangedCallback() {
        if (this.isConnected) this._render();
    }

    _render() {
        const {set, name} = resolveIcon(this.getAttribute('name'));
        const el = document.createElement('span');

        if (!name) {
            // empty — render nothing
        } else if (set === null) {
            // Built-in Material set — ligature, same as the classic
            // <span class="material-icons"> everywhere else in feezal.
            el.className = 'glyph';
            el.style.fontFamily = "'Material Icons'";
            el.textContent = name;
        } else {
            const def = sets.get(set);
            if (!def) {
                // Set not installed: visible but harmless fallback.
                el.className = 'missing';
                el.textContent = `${set}:${name}`;
                el.title = `icon set "${set}" is not installed`;
            } else if (def.render) {
                el.className = 'svg-wrap';
                const out = def.render(name);
                if (out instanceof Element) {
                    el.appendChild(out);
                } else if (typeof out === 'string') {
                    el.innerHTML = out;
                }
            } else if (def.font) {
                el.className = 'glyph';
                el.style.fontFamily = `'${def.font.family}'`;
                el.textContent = name;
            }
        }

        this._slot.replaceWith(el);
        this._slot = el;
    }
}

window.customElements.define('feezal-icon', FeezalIcon);

export {FeezalIcon, registerIcons, iconSets, iconSetNames, resolveIcon};

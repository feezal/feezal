import {LitElement, html, css} from 'lit';

/**
 * feezal-theme-select (U53)
 *
 * The ONE styled theme picker — shortened names + three colour swatches per
 * option — used by BOTH the themes sidebar (site theme) and the view
 * inspector (per-view `theme` attribute). One component, two mounts, in sync
 * by construction (the E106 shared-building-block lesson applied to editor
 * UI).
 *
 * Mount contracts:
 *  - Sidebar: set `.options` ([{cls, label, user?}]), `.colors`, `value`;
 *    listen for `change` ({value}) and `delete-theme` ({cls}, user themes).
 *  - View inspector (N6 `type:'custom'` hook): the host sets `.element`; the
 *    control reads/writes the element's `theme` attribute and emits
 *    `feezal-attribute-changed` — value null removes the attribute (B50's
 *    "Site theme (default)" empty entry and the × clear both do exactly
 *    that). Options self-derive from `feezal.themes`.
 */

// '@feezal/feezal-theme-blue-night' → 'feezal-theme-blue-night'
export function pkgToClass(pkg) {
    return pkg.split('/').pop();
}

// '@feezal/feezal-theme-blue-night' → 'blue-night'
export function pkgToLabel(pkg) {
    return pkgToClass(pkg).replace(/^feezal-theme-/, '');
}

// 3 neutral swatches shown for the built-in default theme.
export const DEFAULT_SWATCHES = ['#ffffff', '#eeeeee', '#333333'];

// Not-yet-sampled placeholder swatches.
const PLACEHOLDER_SWATCHES = ['#e0e0e0', '#bdbdbd', '#757575'];

/**
 * U53 — sample 3 representative colours (plus optional extra custom
 * properties) per theme class by temporarily applying each class to
 * feezal.site. Extracted from the themes sidebar so both mounts share the
 * same extraction; the sidebar lifts/restores its colour overrides AROUND
 * this call (it owns them).
 */
export function sampleThemeColors(themeClasses, extraVars = []) {
    const site = window.feezal?.site;
    const colors = {};
    const vars = {};
    if (!site) return {colors, vars};
    const saved = site.getAttribute('class') || '';
    const base = saved.split(' ').filter(c => !c.startsWith('feezal-theme-'));

    for (const cls of themeClasses) {
        site.className = [cls, ...base].join(' ').trim();
        const cs = getComputedStyle(site);
        const get = prop => cs.getPropertyValue(prop).trim();
        colors[cls] = [
            get('--primary-background-color'),
            get('--primary-text-color'),
            get('--secondary-text-color') || get('--divider-color'),
        ].filter(v => v && v !== 'initial' && v !== 'inherit');
        const m = {};
        for (const v of extraVars) {
            const val = get(v);
            if (val && val !== 'initial' && val !== 'inherit') m[v] = val;
        }
        vars[cls] = m;
    }

    if (saved) site.setAttribute('class', saved);
    else site.removeAttribute('class');
    return {colors, vars};
}

class FeezalThemeSelect extends LitElement {
    static properties = {
        value:       {type: String},
        label:       {type: String},
        emptyOption: {type: String, attribute: 'empty-option'},
        options:     {attribute: false},   // [{cls, label, user?}]; null → derive from feezal.themes
        colors:      {attribute: false},   // {cls: [c1,c2,c3]}; null → sample lazily on open
        element:     {attribute: false},   // N6 custom-inspector mount (edits `theme`)
        _open:       {state: true},
        _sampled:    {state: true},
    };

    static styles = css`
        :host { display: block; font-size: 12px; color: var(--feezal-color, #333); position: relative; }
        .lbl { font-size: 12px; margin-bottom: 3px; color: var(--sl-input-label-color, inherit); }
        .picker { position: relative; }
        .trigger {
            display: flex; align-items: center; gap: 8px; width: 100%;
            padding: 7px 10px; box-sizing: border-box; cursor: pointer;
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #333);
            border: 1px solid var(--feezal-border, #d0d0d0); border-radius: 8px;
            font: inherit; text-align: left;
        }
        .trigger:focus-visible {
            outline: none;
            border-color: rgba(250,120,0,0.8);
            box-shadow: 0 0 0 3px rgba(250,120,0,0.15);
        }
        .trigger-name { flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .trigger-arrow { color: var(--feezal-color, #aaa); opacity: 0.5; font-size: 10px; flex-shrink: 0; margin-left: 2px; }
        .trigger-clear {
            border: none; background: none; color: var(--feezal-color, #888);
            font-size: 13px; line-height: 1; cursor: pointer; padding: 0 2px; flex-shrink: 0;
            opacity: 0.6;
        }
        .trigger-clear:hover { opacity: 1; }
        .swatches { display: flex; gap: 3px; flex-shrink: 0; }
        .swatch {
            width: 13px; height: 13px; border-radius: 50%; flex-shrink: 0;
            border: 1px solid rgba(0,0,0,0.12);
        }
        .dropdown {
            position: absolute; top: calc(100% + 5px); left: 0; right: 0;
            background: var(--feezal-bg, white); border: 1px solid var(--feezal-border, #d0d0d0); border-radius: 8px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.28); z-index: 200; overflow: hidden auto;
            max-height: 320px;
        }
        .option {
            display: flex; align-items: center; gap: 10px;
            padding: 10px 12px; cursor: pointer; font-size: 13px; color: var(--feezal-color, #333);
            transition: background 0.1s;
        }
        .option + .option { border-top: 1px solid var(--feezal-border, #f0f0f0); }
        .option:hover  { background: var(--feezal-bg-sub, #f7f7f7); }
        .option.active { background: var(--feezal-bg-sub, #fff8f0); }
        .option-name   { flex: 1; }
        .option-user   { flex-shrink: 0; opacity: 0.6; }
        .option-check  { color: rgba(250,120,0,0.9); font-size: 14px; flex-shrink: 0; }
        .option-del {
            border: none; background: none; color: var(--feezal-color, #888);
            font-size: 14px; cursor: pointer; padding: 0 2px; flex-shrink: 0;
        }
        .option-del:hover { color: var(--error-color, #d32f2f); }
    `;

    constructor() {
        super();
        this.value = '';
        this.label = '';
        this.emptyOption = null;
        this.options = null;
        this.colors = null;
        this.element = null;
        this._open = false;
        this._sampled = null;   // lazily-sampled {cls: [...]} when no colors provided
        this.__outside = e => {
            if (!e.composedPath().includes(this)) this._open = false;
        };
    }

    connectedCallback() {
        super.connectedCallback();
        document.addEventListener('pointerdown', this.__outside);
    }

    disconnectedCallback() {
        document.removeEventListener('pointerdown', this.__outside);
        super.disconnectedCallback();
    }

    /** Element mount (N6): derive the current value from the `theme` attribute. */
    willUpdate(changed) {
        if (changed.has('element') && this.element) {
            this.value = this._normalize(this.element.getAttribute('theme') || '');
            if (this.emptyOption === null || this.emptyOption === undefined) {
                this.emptyOption = 'Site theme (default)';   // B50 contract
            }
            if (!this.label) this.label = 'theme';
        }
    }

    /** Accept full class names or bare suffixes ('dark-mint'). */
    _normalize(v) {
        const raw = (v || '').trim();
        if (!raw || raw === 'default') return raw;
        return raw.startsWith('feezal-theme-') ? raw : 'feezal-theme-' + raw;
    }

    _options() {
        if (this.options) return this.options;
        const pkgs = window.feezal?.themes || [];
        return pkgs.map(p => ({cls: pkgToClass(p), label: pkgToLabel(p)}));
    }

    _swatches(cls) {
        if (cls === '') return PLACEHOLDER_SWATCHES;        // empty option — neutral
        if (cls === 'default') return DEFAULT_SWATCHES;
        const palette = (this.colors || this._sampled || {})[cls] || [];
        return palette.length ? palette.slice(0, 3) : PLACEHOLDER_SWATCHES;
    }

    _toggleOpen() {
        if (!this._open && !this.colors && !this._sampled) {
            const {colors} = sampleThemeColors(this._options().map(o => o.cls).filter(c => c && c !== 'default'));
            this._sampled = colors;
        }
        this._open = !this._open;
    }

    _select(cls) {
        this.value = cls;
        this._open = false;
        this.dispatchEvent(new CustomEvent('change', {detail: {value: cls}}));
        if (this.element) {
            // null removes the attribute (the host's custom-inspector pipeline).
            this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
                bubbles: true, composed: true,
                detail: {name: 'theme', value: cls || null},
            }));
        }
    }

    _deleteTheme(cls, e) {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent('delete-theme', {detail: {cls}}));
    }

    render() {
        const opts = this._options();
        const value = this._normalize(this.value);
        const withEmpty = (this.emptyOption !== null && this.emptyOption !== undefined)
            ? [{cls: '', label: this.emptyOption}, ...opts]
            : opts;
        const current = withEmpty.find(o => o.cls === value) || withEmpty[0]
            || {cls: '', label: value || ''};
        return html`
            ${this.label ? html`<div class="lbl">${this.label}</div>` : ''}
            <div class="picker">
                <button class="trigger" @click="${this._toggleOpen}">
                    <div class="swatches">
                        ${this._swatches(current.cls).map(c => html`<div class="swatch" style="background:${c}"></div>`)}
                    </div>
                    <span class="trigger-name">${current.label}</span>
                    ${value && this.emptyOption != null ? html`
                        <button class="trigger-clear" title="Back to ${this.emptyOption}"
                            @click="${e => { e.stopPropagation(); this._select(''); }}">✕</button>` : ''}
                    <span class="trigger-arrow">${this._open ? '▴' : '▾'}</span>
                </button>
                ${this._open ? html`
                    <div class="dropdown">
                        ${withEmpty.map(o => html`
                            <div class="option ${o.cls === value ? 'active' : ''}"
                                @click="${() => this._select(o.cls)}">
                                <div class="swatches">
                                    ${this._swatches(o.cls).map(c => html`<div class="swatch" style="background:${c}"></div>`)}
                                </div>
                                <span class="option-name">${o.label}</span>
                                ${o.user ? html`<span class="option-user">✏</span>` : ''}
                                ${o.cls === value ? html`<span class="option-check">✓</span>` : ''}
                                ${o.user ? html`
                                    <button class="option-del" title="Delete theme"
                                        @click="${e => this._deleteTheme(o.cls, e)}">×</button>` : ''}
                            </div>`)}
                    </div>` : ''}
            </div>`;
    }
}

customElements.define('feezal-theme-select', FeezalThemeSelect);
export {FeezalThemeSelect};

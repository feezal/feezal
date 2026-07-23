import {LitElement, html, css} from 'lit';

/**
 * feezal-theme-select (U53 · U57)
 *
 * The ONE styled theme picker — shortened names + a compound colour swatch
 * per option — used by BOTH the themes sidebar (site theme) and the view
 * inspector (per-view `theme` attribute). One component, two mounts, in sync
 * by construction (the E106 shared-building-block lesson applied to editor
 * UI).
 *
 * U57: the swatch is a two-tone background CHIP (--primary-background-color /
 * --secondary-background-color) carrying three role dots (--primary-color,
 * --primary-text-color, --secondary-text-color), then a --divider-color rule
 * and a --accent-color dot — seven canonical theme roles previewed at once,
 * with text/accent shown against the real surfaces behind them.
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

// U57: the seven canonical roles the compound swatch previews, in draw order.
export const SWATCH_ROLES = ['bg', 'bg2', 'primary', 'text', 'text2', 'divider', 'accent'];

// Neutral swatch record shown for the built-in default theme.
export const DEFAULT_SWATCHES = {
    bg: '#ffffff', bg2: '#f0f0f0', primary: '#0284c7',
    text: '#212121', text2: '#6b6b6b', divider: '#e0e0e0', accent: '#ff9800',
};

// Not-yet-sampled placeholder record (also fills any role a theme omits).
const PLACEHOLDER_SWATCHES = {
    bg: '#f5f5f5', bg2: '#e6e6e6', primary: '#9e9e9e',
    text: '#616161', text2: '#9e9e9e', divider: '#d0d0d0', accent: '#bdbdbd',
};

/** Coerce a legacy `[bg, text, text2]` array (pre-U57 callers/tests) into the
 * role record so old data keeps rendering. Records pass through unchanged. */
export function toSwatchRecord(v) {
    if (!v) return null;
    if (Array.isArray(v)) {
        const [bg = '', text = '', text2 = ''] = v;
        return {bg, text, text2};
    }
    return v;
}

/** Fill missing/empty roles from the placeholder so the chip never has a
 * transparent slot. */
export function fillSwatch(rec) {
    const out = {...PLACEHOLDER_SWATCHES};
    for (const k of SWATCH_ROLES) if (rec && rec[k]) out[k] = rec[k];
    return out;
}

/**
 * U53/U57 — sample the seven swatch roles (plus optional extra custom
 * properties) per theme class by temporarily applying each class to
 * feezal.site. Extracted from the themes sidebar so both mounts share the
 * same extraction; the sidebar lifts/restores its colour overrides AROUND
 * this call (it owns them). Returns `{colors: {cls: {bg, bg2, primary, text,
 * text2, divider, accent}}, vars}`.
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
        const role = (prop, fallback = '') => {
            const val = get(prop);
            return (val && val !== 'initial' && val !== 'inherit') ? val : fallback;
        };
        colors[cls] = {
            bg:      role('--primary-background-color'),
            bg2:     role('--secondary-background-color'),
            primary: role('--primary-color'),
            text:    role('--primary-text-color'),
            text2:   role('--secondary-text-color', role('--divider-color')),
            divider: role('--divider-color'),
            accent:  role('--accent-color'),
        };
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
        colors:      {attribute: false},   // {cls: {bg,bg2,primary,text,text2,divider,accent}}; null → sample lazily on open
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
        /* U57: compound swatch — everything sits INSIDE the two-tone chip:
           three big role dots, a divider rule, then a small accent dot. */
        .swatches { display: inline-flex; align-items: center; flex-shrink: 0; }
        .chip {
            position: relative; width: 54px; height: 16px; flex-shrink: 0;
            display: flex; overflow: hidden;
            border-radius: 4px; border: 1px solid rgba(0,0,0,0.18);
        }
        .chip-half { flex: 1 1 0; height: 100%; }
        .chip-overlay {
            position: absolute; inset: 0;
            display: flex; align-items: center; justify-content: center; gap: 4px;
            padding: 0 4px;
        }
        .chip-dots { display: flex; align-items: center; gap: 3px; }
        .dot {
            width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
            box-shadow: 0 0 0 0.5px rgba(0,0,0,0.3);
        }
        .swatch-divider {
            width: 2px; height: 11px; flex-shrink: 0; border-radius: 1px;
            box-shadow: 0 0 0 0.5px rgba(0,0,0,0.15);
        }
        .dot-accent {
            width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
            box-shadow: 0 0 0 0.5px rgba(0,0,0,0.3);
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
        this._sampled = null;   // lazily-sampled {cls: {roles…}} when no colors provided
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

    /** The filled 7-role swatch record for a theme class. */
    _swatchRecord(cls) {
        if (cls === '') return PLACEHOLDER_SWATCHES;        // empty option — neutral
        if (cls === 'default') return fillSwatch(DEFAULT_SWATCHES);
        return fillSwatch(toSwatchRecord((this.colors || this._sampled || {})[cls]));
    }

    /** U57: the compound swatch — the two-tone chip carries three big role
     * dots, a divider rule and a small accent dot, all inside it. */
    _renderSwatch(cls) {
        const s = this._swatchRecord(cls);
        return html`
            <span class="swatches" part="swatch">
                <span class="chip">
                    <span class="chip-half" style="background:${s.bg}"></span>
                    <span class="chip-half" style="background:${s.bg2}"></span>
                    <span class="chip-overlay">
                        <span class="chip-dots">
                            <span class="dot" style="background:${s.primary}"></span>
                            <span class="dot" style="background:${s.text}"></span>
                            <span class="dot" style="background:${s.text2}"></span>
                        </span>
                        <span class="swatch-divider" style="background:${s.divider}"></span>
                        <span class="dot-accent" style="background:${s.accent}"></span>
                    </span>
                </span>
            </span>`;
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
                    ${this._renderSwatch(current.cls)}
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
                                ${this._renderSwatch(o.cls)}
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

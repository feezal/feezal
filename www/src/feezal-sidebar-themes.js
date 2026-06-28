import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';

// '@feezal/feezal-theme-blue-night' → 'feezal-theme-blue-night'
function pkgToClass(pkg) {
    return pkg.split('/').pop();
}

// '@feezal/feezal-theme-blue-night' → 'blue-night'
function pkgToLabel(pkg) {
    return pkgToClass(pkg).replace(/^feezal-theme-/, '');
}

// 3 neutral swatches shown for the built-in default theme.
const DEFAULT_SWATCHES = ['#ffffff', '#eeeeee', '#333333'];

/** Common CSS property names for autocomplete in the class prop editor. */
const CSS_PROP_NAMES = [
    'align-content', 'align-items', 'align-self', 'animation', 'aspect-ratio',
    'background', 'background-color', 'background-image', 'background-position',
    'background-repeat', 'background-size', 'border', 'border-bottom', 'border-color',
    'border-left', 'border-radius', 'border-right', 'border-style', 'border-top',
    'border-width', 'bottom', 'box-shadow', 'box-sizing', 'color', 'column-gap',
    'display', 'filter', 'flex', 'flex-direction', 'flex-grow', 'flex-shrink',
    'flex-wrap', 'font', 'font-family', 'font-size', 'font-style', 'font-weight',
    'gap', 'grid-column', 'grid-row', 'grid-template-columns', 'grid-template-rows',
    'height', 'justify-content', 'justify-self', 'left', 'letter-spacing',
    'line-height', 'margin', 'margin-bottom', 'margin-left', 'margin-right',
    'margin-top', 'max-height', 'max-width', 'min-height', 'min-width',
    'mix-blend-mode', 'object-fit', 'opacity', 'outline', 'overflow', 'overflow-x',
    'overflow-y', 'padding', 'padding-bottom', 'padding-left', 'padding-right',
    'padding-top', 'pointer-events', 'position', 'right', 'row-gap', 'text-align',
    'text-decoration', 'text-overflow', 'text-transform', 'top', 'transform',
    'transition', 'user-select', 'visibility', 'white-space', 'width',
];

/** CSS properties with a known, finite value set — shown as autocomplete suggestions in value fields. */
const CSS_ENUMS = {
    'display':           ['block', 'flex', 'inline', 'inline-block', 'inline-flex', 'grid', 'inline-grid', 'none', 'contents'],
    'position':          ['static', 'relative', 'absolute', 'fixed', 'sticky'],
    'flex-direction':    ['row', 'column', 'row-reverse', 'column-reverse'],
    'flex-wrap':         ['nowrap', 'wrap', 'wrap-reverse'],
    'align-items':       ['flex-start', 'flex-end', 'center', 'baseline', 'stretch'],
    'align-self':        ['auto', 'flex-start', 'flex-end', 'center', 'baseline', 'stretch'],
    'align-content':     ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'stretch'],
    'justify-content':   ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'],
    'justify-self':      ['auto', 'start', 'end', 'center', 'stretch'],
    'text-align':        ['left', 'right', 'center', 'justify'],
    'overflow':          ['visible', 'hidden', 'scroll', 'auto'],
    'overflow-x':        ['visible', 'hidden', 'scroll', 'auto'],
    'overflow-y':        ['visible', 'hidden', 'scroll', 'auto'],
    'visibility':        ['visible', 'hidden', 'collapse'],
    'pointer-events':    ['auto', 'none', 'all'],
    'box-sizing':        ['content-box', 'border-box'],
    'font-weight':       ['normal', 'bold', 'lighter', 'bolder', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
    'text-transform':    ['none', 'uppercase', 'lowercase', 'capitalize'],
    'text-overflow':     ['clip', 'ellipsis'],
    'white-space':       ['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line'],
    'user-select':       ['auto', 'none', 'text', 'all'],
    'resize':            ['none', 'both', 'horizontal', 'vertical'],
    'object-fit':        ['fill', 'contain', 'cover', 'none', 'scale-down'],
    'mix-blend-mode':    ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'],
    'cursor':            ['auto', 'default', 'pointer', 'crosshair', 'move', 'text', 'wait', 'help', 'not-allowed', 'grab', 'grabbing', 'zoom-in', 'zoom-out', 'none'],
};

/** The 9 standard theme variables exposed as colour overrides. */
const OVERRIDE_VARS = [
    '--primary-background-color',
    '--secondary-background-color',
    '--primary-text-color',
    '--secondary-text-color',
    '--disabled-text-color',
    '--divider-color',
    '--error-color',
    '--primary-color',
    '--accent-color',
];

class FeezalSidebarThemes extends LitElement {
    static properties = {
        currentTheme: {type: String},
        themes:       {type: Array},
        viewSelected: {type: Boolean}, // kept for API compat; no longer gates the UI
        _open:          {state: true},
        _colors:        {state: true},   // { 'feezal-theme-*': [bg, fg, secondary] }
        _overridesOpen: {state: true},
        _overrides:     {state: true},   // { '--var-name': 'value' }
        _themeVars:     {state: true},   // { 'feezal-theme-*': { '--var-name': 'value' } }
        _userThemes:    {state: true},   // [{ slug, label }] from /api/themes
        _saveThemeOpen: {state: true},
        _saveThemeName: {state: true},
        _classesOpen:     {state: true},
        _classes:         {state: true},   // { name: { prop: val } }
        _editingClass:    {state: true},   // name of the class being renamed inline
        _collapsedClasses:{state: true},   // Set of class names that are collapsed
        _addPropFor:      {state: true},   // { cls, val, matches, cursor } — active add-prop input
        _valAutoState:    {state: true},   // { cls, key, input, matches, cursor, top, left, width } | null
    };

    static styles = css`
        :host {
            display: flex; flex-direction: column;
            height: 100%; background: var(--feezal-bg, white); box-sizing: border-box; overflow: hidden;
        }

        .section { padding: 14px 12px; }
        .section-label {
            font-size: 11px; font-weight: 600; color: #888;
            text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px;
        }

        /* Trigger */
        .picker { position: relative; }

        .trigger {
            height: 32px;
            display: flex; align-items: center; gap: 10px;
            width: 100%; box-sizing: border-box;
            border: 1px solid var(--feezal-border, #d0d0d0); border-radius: 6px;
            padding: 8px 10px; background: var(--feezal-bg, white);
            cursor: pointer; font-size: 13px; color: var(--feezal-color, #333);
            transition: border-color 0.15s, box-shadow 0.15s;
        }
        .trigger:hover  { border-color: rgba(250,120,0,0.6); }
        .trigger:focus-visible {
            outline: none;
            border-color: rgba(250,120,0,0.8);
            box-shadow: 0 0 0 3px rgba(250,120,0,0.15);
        }
        .trigger-name { flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .trigger-arrow { color: var(--feezal-color, #aaa); opacity: 0.5; font-size: 10px; flex-shrink: 0; margin-left: 2px; }

        /* Colour swatches */
        .swatches { display: flex; gap: 3px; flex-shrink: 0; }
        .swatch {
            width: 13px; height: 13px; border-radius: 50%; flex-shrink: 0;
            border: 1px solid rgba(0,0,0,0.12);
        }

        /* Dropdown */
        .dropdown {
            position: absolute; top: calc(100% + 5px); left: 0; right: 0;
            background: var(--feezal-bg, white); border: 1px solid var(--feezal-border, #d0d0d0); border-radius: 8px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.28); z-index: 200; overflow: hidden;
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
        .option-check  { color: rgba(250,120,0,0.9); font-size: 14px; flex-shrink: 0; }

        /* ── Colour overrides panel ──────────────────────────────────────── */
        .overrides-section { border-top: 1px solid var(--feezal-border, #e8e8e8); }
        .collapsible-hdr {
            display: flex; align-items: center; gap: 6px; padding: 12px 12px 0;
            cursor: pointer; user-select: none;
        }
        .collapsible-hdr .section-label { margin-bottom: 0; }
        .collapsible-hdr:hover .section-label { color: var(--feezal-color, #666); }
        .overrides-badge {
            font-size: 9px; font-weight: 700; color: white;
            background: rgba(250,120,0,0.85); border-radius: 10px; padding: 1px 5px;
        }
        .collapsible-arrow { margin-left: auto; font-size: 10px; opacity: 0.4; }
        .overrides-body { padding: 10px 12px 12px; }
        .overrides-disabled { opacity: 0.35; pointer-events: none; }
        .or-row { display: flex; align-items: flex-end; gap: 4px; margin-bottom: 4px; }
        .or-row sl-input { flex: 1; min-width: 0; }
        .or-row sl-input::part(base) { background: var(--feezal-bg,#fff); border-color: var(--feezal-border,#ccc); }
        .or-row sl-input::part(input) { background: var(--feezal-bg,#fff); color: var(--sl-input-color,#333); font-size: 11px; }
        .or-row sl-input::part(form-control-label) { color: var(--sl-input-label-color,inherit); font-size: 10px; }
        .or-color {
            width: 26px; height: 26px; flex-shrink: 0; padding: 1px;
            border: 1px solid var(--feezal-border,#ccc); border-radius: 3px;
            cursor: pointer; align-self: flex-end;
        }
        .or-color:disabled { opacity: 0.4; cursor: not-allowed; }
        .or-clear {
            flex-shrink: 0; border: none; background: none; cursor: pointer;
            font-size: 15px; color: var(--feezal-color,#999); padding: 0 2px;
            opacity: 0; transition: opacity 0.1s, color 0.1s;
            align-self: flex-end; height: 26px; line-height: 26px;
        }
        .or-row:hover .or-clear, .or-clear.or-active { opacity: 0.5; }
        .or-clear.or-active:hover { opacity: 1; color: #c00; }

        /* ── User theme dropdown row ────────────────────────────────── */
        .option-del {
            flex-shrink: 0; border: none; background: none; cursor: pointer;
            font-size: 13px; color: var(--feezal-color,#999); padding: 0 2px; line-height: 1;
            opacity: 0; transition: opacity 0.1s, color 0.1s;
        }
        .option:hover .option-del { opacity: 0.5; }
        .option-del:hover { opacity: 1 !important; color: #c00; }
        .option-user { font-size: 9px; opacity: 0.6; flex-shrink: 0; }

        /* ── Save-as-theme panel ─────────────────────────────────── */
        .save-theme-wrap {
            margin-top: 12px; border-top: 1px solid var(--feezal-border,#e8e8e8); padding-top: 10px;
        }
        .save-theme-row { display: flex; gap: 4px; align-items: flex-end; }
        .save-theme-row sl-input { flex: 1; }
        .save-theme-row sl-input::part(base) { background: var(--feezal-bg,#fff); border-color: var(--feezal-border,#ccc); }
        .save-theme-row sl-input::part(input) { background: var(--feezal-bg,#fff); color: var(--sl-input-color,#333); font-size: 12px; }
        .save-theme-btn {
            flex-shrink: 0; border: 1px solid var(--feezal-border,#ccc); background: var(--feezal-bg,#fff);
            color: var(--feezal-color,#333); cursor: pointer; border-radius: 4px;
            font-size: 11px; padding: 3px 8px; height: 28px; white-space: nowrap; align-self: flex-end;
        }
        .save-theme-btn:hover { border-color: rgba(250,120,0,0.6); color: rgba(250,120,0,0.9); }
        .new-class-btn:hover { border-color: rgba(250,120,0,0.6); color: rgba(250,120,0,0.9); }

        /* ── Classes editor panel ────────────────────────────── */
        .classes-section { border-top: 1px solid var(--feezal-border,#e8e8e8); }
        .classes-body { padding: 10px 12px 12px; }
        .class-card { margin-bottom: 8px; border: 1px solid var(--feezal-border,#e0e0e0); border-radius: 5px; background: var(--feezal-bg,#fff); }
        .class-card-hdr { display: flex; align-items: center; gap: 4px; padding: 5px 8px; background: var(--feezal-bg-sub,#f7f7f7); border-bottom: 1px solid var(--feezal-border,#e8e8e8); }
        .class-card-name { flex: 1; font-size: 11px; font-weight: 600; color: var(--feezal-color,#333); font-family: monospace; cursor: pointer; }
        .class-card-name:hover { color: rgba(250,120,0,0.9); }
        .class-name-input {
            flex: 1; min-width: 0; font-size: 11px; font-weight: 600; font-family: monospace;
            border: 1px solid rgba(250,120,0,0.7); border-radius: 3px;
            padding: 1px 4px; background: var(--feezal-bg,#fff); color: var(--feezal-color,#333);
            outline: none; box-shadow: 0 0 0 2px rgba(250,120,0,0.15);
        }
        .class-card-del { border: none; background: none; cursor: pointer; font-size: 13px; color: var(--feezal-color,#999); padding: 0 2px; }
        .class-card-del:hover { color: #c00; }
        .class-props-list { padding: 4px 8px 2px; }
        .prop-row { display: flex; gap: 3px; margin-bottom: 3px; align-items: center; }
        .prop-key, .prop-val { font-size: 11px; padding: 3px 5px; border: 1px solid var(--feezal-border,#ccc); border-radius: 3px; background: var(--feezal-bg,#fff); color: var(--feezal-color,#333); font-family: monospace; box-sizing: border-box; }
        .prop-key { flex: 0 0 130px; }
        .prop-val { flex: 1; min-width: 0; }
        .prop-del { flex-shrink: 0; border: none; background: none; cursor: pointer; font-size: 13px; color: var(--feezal-color,#aaa); padding: 0 2px; }
        .prop-del:hover { color: #c00; }
        .class-card-toggle {
            flex-shrink: 0; border: none; background: none; cursor: pointer;
            font-size: 10px; color: var(--feezal-color,#888); padding: 0 2px; line-height: 1;
        }
        .class-card.collapsed .class-card-hdr { border-bottom: none; }
        .class-props-foot { padding: 2px 8px 6px; }
        .add-prop-input-wrap { position: relative; }
        .class-add-input {
            width: 100%; box-sizing: border-box; font-size: 11px; font-family: monospace;
            border: 1px dashed var(--sl-color-primary-300,#7dd3fc); border-radius: 3px;
            padding: 3px 6px; background: var(--feezal-bg,#fff); color: var(--feezal-color,#333); outline: none;
        }
        .class-add-input:focus { border-style: solid; border-color: rgba(250,120,0,0.6); }
        .class-add-input::placeholder { opacity: 0.5; }
        .class-prop-list {
            position: absolute; top: 100%; left: 0; right: 0; z-index: 9999;
            list-style: none; margin: 2px 0 0; padding: 4px 0;
            background: var(--feezal-bg, #fff); border: 1px solid var(--feezal-border, #ccc);
            border-radius: 4px; box-shadow: 0 4px 14px rgba(0,0,0,.18);
            max-height: 160px; overflow-y: auto; font-size: 11px; font-family: monospace;
        }
        .class-prop-list li {
            padding: 3px 8px; cursor: pointer;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            color: var(--feezal-color, #333);
        }
        .class-prop-list li:hover, .class-prop-list li.apc-cursor {
            background: var(--sl-color-primary-600, #0284c7); color: #fff;
        }
        .class-val-list {
            position: fixed; z-index: 9999;
            list-style: none; margin: 0; padding: 4px 0;
            background: var(--feezal-bg, #fff); border: 1px solid var(--feezal-border, #ccc);
            border-radius: 4px; box-shadow: 0 4px 14px rgba(0,0,0,.18);
            max-height: 160px; overflow-y: auto; font-size: 11px; font-family: monospace;
        }
        .class-val-list li {
            padding: 3px 8px; cursor: pointer;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            color: var(--feezal-color, #333);
        }
        .class-val-list li:hover, .class-val-list li.apc-cursor {
            background: var(--sl-color-primary-600, #0284c7); color: #fff;
        }
        .new-class-wrap { margin-top: 4px; }
        .new-class-btn { font-size: 11px; padding: 4px 10px; border: 1px dashed var(--feezal-border,#ccc); background: none; cursor: pointer; border-radius: 4px; color: var(--feezal-color,#666); }
        .new-class-btn:hover { border-color: rgba(250,120,0,0.6); color: rgba(250,120,0,0.9); }
    `;

    constructor() {
        super();
        this.currentTheme   = 'default';
        this.themes         = [];
        this.viewSelected   = false;
        this._open          = false;
        this._colors        = {};
        this._overridesOpen = false;
        this._overrides     = {};
        this._themeVars     = {};
        this._userThemes    = [];
        this._saveThemeOpen = false;
        this._saveThemeName = '';
        this._classesOpen     = false;
        this._classes         = {};
        this._editingClass    = null;
        this._collapsedClasses = new Set();
        this._addPropFor       = {cls: null, val: '', matches: [], cursor: -1};
        this._valAutoState     = null;
        this._cssVars          = [];
    }

    connectedCallback() {
        super.connectedCallback();
        requestAnimationFrame(() => this._collectCssVars());
        this.themes = feezal.themes || [];
        if (feezal.ready && feezal.site) {
            this._sampleColors();
        }
        this._fetchUserThemes();

        this._onDocPointer = e => {
            if (this._open && !e.composedPath().includes(this)) {
                this._open = false;
            }
        };
        document.addEventListener('pointerdown', this._onDocPointer, true);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('pointerdown', this._onDocPointer, true);
    }

    // ── Color sampling ────────────────────────────────────────────────────────
    // Read the theme's CSS custom properties by temporarily applying each theme
    // class to feezal-site and calling getComputedStyle().  Runs synchronously so
    // the browser never repaints between class-add and class-remove.

    _sampleColors() {
        if (!feezal.site || this.themes.length === 0) return;
        const site    = feezal.site;
        const saved   = site.getAttribute('class') || '';
        const base    = saved.split(' ').filter(c => !c.startsWith('feezal-theme-'));

        // Temporarily lift any active overrides so we read pure theme values.
        const activeOverrides = Object.entries(this._overrides || {});
        for (const [k] of activeOverrides) site.style.removeProperty(k);

        const colorCache = {};
        const varCache   = {};

        for (const pkg of this.themes) {
            const cls = pkgToClass(pkg);
            site.className = [cls, ...base].join(' ').trim();
            const cs  = getComputedStyle(site);
            const get = prop => cs.getPropertyValue(prop).trim();
            const colors = [
                get('--primary-background-color'),
                get('--primary-text-color'),
                get('--secondary-text-color') || get('--divider-color')
            ].filter(v => v && v !== 'initial' && v !== 'inherit' && v !== '');
            colorCache[cls] = colors;

            const vars = {};
            for (const v of OVERRIDE_VARS) {
                const val = get(v);
                if (val && val !== 'initial' && val !== 'inherit') vars[v] = val;
            }
            varCache[cls] = vars;
        }

        // Restore original class attribute
        saved ? site.setAttribute('class', saved) : site.removeAttribute('class');
        // Restore active overrides
        for (const [k, v] of activeOverrides) { if (v) site.style.setProperty(k, v); }

        this._colors    = colorCache;
        this._themeVars = varCache;
    }

    // ── Theme selection ───────────────────────────────────────────────────────

    _selectTheme(cls) {
        this.currentTheme = cls;
        this._open = false;

        if (feezal.ready && feezal.site) {
            const base = feezal.site.className.split(' ').filter(c => !c.startsWith('feezal-theme-'));
            feezal.site.className = (cls === 'default' ? base : [cls, ...base]).join(' ').trim();
            // Re-apply overrides (inline styles persist, but re-confirm any cleared ones).
            for (const [k, v] of Object.entries(this._overrides)) {
                if (v) feezal.site.style.setProperty(k, v);
                else feezal.site.style.removeProperty(k);
            }
        }

        // Ensure user theme CSS is loaded in the editor document.
        this._syncUserThemeLink(cls);

        // Re-sample so override placeholders reflect the new theme's baseline.
        this._sampleColors();

        this.dispatchEvent(new CustomEvent('theme-changed', {
            bubbles: true, composed: true,
            detail: {theme: cls === 'default' ? null : cls}
        }));
    }

    /** Insert/remove a <link> tag for user themes so the editor sees the CSS. */
    _syncUserThemeLink(cls) {
        const id = 'feezal-user-theme-link';
        const existing = document.getElementById(id);
        const isUserTheme = this._userThemes.some(t => t.slug === cls);
        if (isUserTheme) {
            const href = `/themes/${cls}.css`;
            if (existing) {
                existing.href = href;
            } else {
                const link = document.createElement('link');
                link.id = id;
                link.rel = 'stylesheet';
                link.href = href;
                document.head.appendChild(link);
            }
        } else if (existing) {
            existing.remove();
        }
    }

    // Public accessor used by feezal-app-editor._deploy()
    get theme() {
        return this.currentTheme === 'default' ? null : this.currentTheme;
    }

    /** Returns classes (filtered to non-empty props) for deploy serialization. */
    get classes() {
        const result = {};
        for (const [name, props] of Object.entries(this._classes)) {
            const clean = {};
            for (const [k, v] of Object.entries(props)) {
                if (k && v) clean[k] = v;
            }
            if (Object.keys(clean).length) result[name] = clean;
        }
        return result;
    }

    _syncClassesStyle() {
        const cssText = Object.entries(this._classes)
            .map(([name, props]) => {
                const propStr = Object.entries(props)
                    .filter(([k, v]) => k && v && /^[\w-]+$/.test(k))
                    .map(([k, v]) => `${k}:${String(v).replace(/[;"']/g, '')}`)
                    .join(';');
                return propStr ? `.feezal-class-${name}{${propStr}}` : '';
            })
            .filter(Boolean).join('\n');
        let el = document.getElementById('feezal-classes');
        if (!el) {
            el = document.createElement('style');
            el.id = 'feezal-classes';
            document.head.appendChild(el);
        }
        el.textContent = cssText;
        feezal.classes = this._classes;
        document.dispatchEvent(new CustomEvent('feezal-classes-changed'));
    }

    _addClass() {
        let n = 1;
        while (this._classes[`class-${n}`]) n++;
        const newName = `class-${n}`;
        this._classes = {...this._classes, [newName]: {}};
        this._syncClassesStyle();
        this._editingClass = newName;
        this.updateComplete.then(() => {
            const input = this.shadowRoot.querySelector('.class-name-input');
            if (input) {
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            }
        });
    }

    _startRenameClass(name) {
        this._editingClass = name;
        this.updateComplete.then(() => {
            const input = this.shadowRoot.querySelector('.class-name-input');
            if (input) {
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            }
        });
    }

    _commitRenameClass(oldName, inputValue) {
        this._editingClass = null;
        const newName = inputValue.trim();
        if (!newName || newName === oldName) return;
        // Rename key, preserving insertion order.
        const next = {};
        for (const [k, v] of Object.entries(this._classes)) {
            next[k === oldName ? newName : k] = v;
        }
        this._classes = next;
        // Update collapse state to follow the rename.
        const colNext = new Set(this._collapsedClasses);
        if (colNext.has(oldName)) { colNext.delete(oldName); colNext.add(newName); }
        this._collapsedClasses = colNext;
        // Update class attribute on all canvas elements that carry the old name.
        if (feezal.site) {
            feezal.site.querySelectorAll(`.feezal-class-${oldName}`).forEach(el => {
                el.classList.remove(`feezal-class-${oldName}`);
                el.classList.add(`feezal-class-${newName}`);
            });
        }
        this._syncClassesStyle();
        feezal.app && feezal.app.change && feezal.app.change();
    }

    _deleteClass(name) {
        const next = {...this._classes};
        delete next[name];
        this._classes = next;
        this._syncClassesStyle();
    }

    _toggleCollapse(name) {
        const next = new Set(this._collapsedClasses);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        this._collapsedClasses = next;
    }

    _onAddPropInput(cls, val) {
        const q = val.trim().toLowerCase();
        const matches = CSS_PROP_NAMES.filter(p => q.length === 0 || p.includes(q)).slice(0, 12);
        this._addPropFor = {cls, val, matches, cursor: -1};
    }

    _onAddPropKeydown(cls, e) {
        if (this._addPropFor.cls !== cls) return;
        const {matches, cursor} = this._addPropFor;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this._addPropFor = {...this._addPropFor, cursor: Math.min(cursor + 1, matches.length - 1)};
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this._addPropFor = {...this._addPropFor, cursor: Math.max(cursor - 1, -1)};
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const inputEl = e.target;
            const chosen = cursor >= 0 ? matches[cursor] : inputEl.value.trim();
            if (chosen) this._commitAddPropToClass(cls, chosen);
        } else if (e.key === 'Escape') {
            this._addPropFor = {cls: null, val: '', matches: [], cursor: -1};
        }
    }

    _commitAddPropToClass(cls, propName) {
        const prop = propName.trim();
        if (!prop) return;
        const props = this._classes[cls] || {};
        if (prop in props) {
            this._addPropFor = {cls: null, val: '', matches: [], cursor: -1};
            return;
        }
        this._classes = {...this._classes, [cls]: {...props, [prop]: ''}};
        this._syncClassesStyle();
        this._addPropFor = {cls: null, val: '', matches: [], cursor: -1};
        // Clear the add-prop input and focus the new property's value field
        this.updateComplete.then(() => {
            const addInp = this.shadowRoot.querySelector(`.class-add-input[data-cls="${cls}"]`);
            if (addInp) addInp.value = '';
            const inp = this.shadowRoot.querySelector(`.prop-val[data-cls="${cls}"][data-key="${prop}"]`);
            if (inp) inp.focus();
        });
    }

    _collectCssVars() {
        const vars = new Set();
        try {
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        for (const m of (rule.cssText || '').matchAll(/(--[\w-]+)\s*:/g)) vars.add(m[1]);
                    }
                } catch { /* cross-origin */ }
            }
        } catch {}
        this._cssVars = [...vars].sort((a, b) => {
            const af = a.startsWith('--feezal-'), bf = b.startsWith('--feezal-');
            return af === bf ? a.localeCompare(b) : af ? -1 : 1;
        });
    }

    _onValInput(cls, key, e) {
        const val = e.target.value;
        // Priority 1: CSS variable autocomplete — trigger on var(--
        const m = val.match(/var\(--([-\w]*)$/);
        if (m) {
            const prefix = '--' + m[1];
            const matches = this._cssVars.filter(v => v.startsWith(prefix));
            if (matches.length > 0) {
                const rect = e.target.getBoundingClientRect();
                this._valAutoState = {cls, key, input: val, isVar: true, matches, cursor: -1, top: rect.bottom + 2, left: rect.left, width: rect.width};
                return;
            }
        }
        // Priority 2: enum value suggestions for known properties
        const enumVals = CSS_ENUMS[key];
        if (enumVals) {
            const q = val.trim().toLowerCase();
            const matches = q ? enumVals.filter(v => v.startsWith(q)) : enumVals;
            if (matches.length > 0) {
                const rect = e.target.getBoundingClientRect();
                this._valAutoState = {cls, key, input: val, isVar: false, matches, cursor: -1, top: rect.bottom + 2, left: rect.left, width: rect.width};
                return;
            }
        }
        if (this._valAutoState) this._valAutoState = null;
    }

    _onValKeydown(cls, key, e) {
        if (!this._valAutoState || this._valAutoState.cls !== cls || this._valAutoState.key !== key) return;
        const {matches, cursor} = this._valAutoState;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this._valAutoState = {...this._valAutoState, cursor: Math.min(cursor + 1, matches.length - 1)};
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this._valAutoState = {...this._valAutoState, cursor: Math.max(cursor - 1, -1)};
        } else if (e.key === 'Enter' && cursor >= 0) {
            e.preventDefault();
            this._selectValOption(matches[cursor], cls, key);
        } else if (e.key === 'Escape') {
            this._valAutoState = null;
        }
    }

    _selectValOption(optionValue, cls, key) {
        let newVal;
        if (this._valAutoState?.isVar) {
            // CSS var: substitute into the var(-- expression at end
            const current = this._valAutoState.input ?? '';
            newVal = current.replace(/var\(--([-\w]*)$/, `var(${optionValue})`);
        } else {
            // Enum value: replace whole value
            newVal = optionValue;
        }
        this._valAutoState = null;
        this._setPropVal(cls, key, newVal);
        this.updateComplete.then(() => {
            const inp = this.shadowRoot.querySelector(`.prop-val[data-cls="${cls}"][data-key="${key}"]`);
            if (inp) inp.value = newVal;
        });
    }

    _setPropVal(name, key, val) {
        this._classes = {...this._classes, [name]: {...(this._classes[name] || {}), [key]: val}};
        this._syncClassesStyle();
    }

    _renameProp(name, oldKey, newKey, val) {
        const props = {...(this._classes[name] || {})};
        delete props[oldKey];
        props[newKey] = val;
        this._classes = {...this._classes, [name]: props};
        this._syncClassesStyle();
    }

    _deleteProp(name, key) {
        const props = {...(this._classes[name] || {})};
        delete props[key];
        this._classes = {...this._classes, [name]: props};
        this._syncClassesStyle();
    }

    /** Returns current non-empty colour overrides for deploy serialization. */
    get themeOverrides() {
        const result = {};
        for (const [k, v] of Object.entries(this._overrides)) {
            if (v) result[k] = v;
        }
        return result;
    }

    _setOverride(varName, value) {
        this._overrides = {...this._overrides, [varName]: value};
        if (feezal.site) {
            if (value) feezal.site.style.setProperty(varName, value);
            else feezal.site.style.removeProperty(varName);
        }
        feezal.app && feezal.app.change && feezal.app.change();
    }

    _clearOverride(varName) {
        const next = {...this._overrides};
        delete next[varName];
        this._overrides = next;
        if (feezal.site) feezal.site.style.removeProperty(varName);
        feezal.app && feezal.app.change && feezal.app.change();
    }

    _toColorHex(value) {
        if (!value) return '#000000';
        if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return value.slice(0, 7).padEnd(7, '0');
        const m = value.match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)/);
        if (m) return '#' + [m[1], m[2], m[3]].map(n => parseInt(n, 10).toString(16).padStart(2, '0')).join('');
        return '#000000';
    }

    // ── User theme management ─────────────────────────────────────────────

    _fetchUserThemes() {
        return fetch('/api/themes')
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data) this._userThemes = data.themes || []; })
            .catch(() => {});
    }

    async _saveUserTheme() {
        const name = this._saveThemeName.trim();
        if (!name) return;
        const overrides = this.themeOverrides;
        if (!Object.keys(overrides).length) return;

        try {
            const res = await fetch('/api/themes', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name, overrides})
            });
            if (!res.ok) return;
            const {slug} = await res.json();

            // Reload user themes, select the new one, clear overrides.
            this._fetchUserThemes();
            this._overrides = {};
            if (feezal.site) {
                for (const v of Object.keys(this._overrides)) feezal.site.style.removeProperty(v);
            }
            this._saveThemeOpen = false;
            this._saveThemeName = '';
            this._selectTheme(slug);
        } catch { /* ignore */ }
    }

    async _deleteUserTheme(slug, e) {
        e.stopPropagation();
        try {
            await fetch(`/api/themes/${slug}`, {method: 'DELETE'});
            this._userThemes = this._userThemes.filter(t => t.slug !== slug);
            if (this.currentTheme === slug) this._selectTheme('default');
        } catch { /* ignore */ }
    }

    // Called after site HTML is loaded. viewerConfig is config.viewer from viewer.json.
    siteReady(viewerConfig) {
        const theme = viewerConfig && viewerConfig.theme;
        if (theme) {
            this.currentTheme = theme;
            if (feezal.site) {
                const base = feezal.site.className.split(' ').filter(c => !c.startsWith('feezal-theme-'));
                feezal.site.className = [theme, ...base].join(' ').trim();
            }
        } else {
            const match = feezal.site && feezal.site.className.match(/(feezal-theme-\S+)/);
            this.currentTheme = match ? match[1] : 'default';
        }

        // Restore saved colour overrides.
        const savedOverrides = (viewerConfig && viewerConfig.themeOverrides) || {};
        this._overrides = savedOverrides;
        if (feezal.site) {
            for (const [k, v] of Object.entries(savedOverrides)) {
                if (v) feezal.site.style.setProperty(k, v);
            }
        }

        this.themes = feezal.themes || [];
        this._fetchUserThemes().then(() => this._syncUserThemeLink(this.currentTheme));

        // Restore saved CSS classes.
        const savedClasses = (viewerConfig && viewerConfig.classes) || {};
        this._classes = savedClasses;
        feezal.classes = savedClasses;
        this._syncClassesStyle();

        this._sampleColors();
    }

    // ── Render helpers ────────────────────────────────────────────────────────

    _renderSwatches(cls) {
        const palette = cls === 'default'
            ? DEFAULT_SWATCHES
            : (this._colors[cls] || []);   // empty → placeholder

        if (palette.length === 0) {
            // Not yet sampled — show neutral placeholders
            return html`<div class="swatches">
                <div class="swatch" style="background:#e0e0e0"></div>
                <div class="swatch" style="background:#bdbdbd"></div>
                <div class="swatch" style="background:#757575"></div>
            </div>`;
        }

        return html`<div class="swatches">
            ${palette.slice(0, 3).map(c => html`
                <div class="swatch" style="background:${c}"></div>`)}
        </div>`;
    }

    render() {
        const npmThemes = this.themes.map(t => ({cls: pkgToClass(t), label: pkgToLabel(t), user: false}));
        const userOpts  = this._userThemes.map(t => ({cls: t.slug, label: t.label, user: true}));
        const all = [
            {cls: 'default', label: 'Default', user: false},
            ...npmThemes,
            ...userOpts
        ];
        const current      = all.find(t => t.cls === this.currentTheme) || all[0];
        const isDefault    = this.currentTheme === 'default';
        const activeCount  = Object.values(this._overrides).filter(v => v).length;
        const themeVars    = this._themeVars[this.currentTheme] || {};

        return html`
            <div class="section">
                <div class="section-label">Theme</div>
                <div class="picker">
                    <button class="trigger"
                        @click="${() => {
                            if (!this._open && Object.keys(this._colors).length === 0) {
                                this._sampleColors();
                            }
                            this._open = !this._open;
                        }}">
                        ${this._renderSwatches(current.cls)}
                        <span class="trigger-name">${current.label}</span>
                        <span class="trigger-arrow">${this._open ? '▴' : '▾'}</span>
                    </button>

                    ${this._open ? html`
                        <div class="dropdown">
                            ${all.map(t => html`
                                <div class="option ${t.cls === this.currentTheme ? 'active' : ''}"
                                    @click="${() => this._selectTheme(t.cls)}">
                                    ${this._renderSwatches(t.cls)}
                                    <span class="option-name">${t.label}</span>
                                    ${t.user ? html`<span class="option-user">✏</span>` : ''}
                                    ${t.cls === this.currentTheme
                                        ? html`<span class="option-check">✓</span>`
                                        : html``}
                                    ${t.user ? html`
                                        <button class="option-del" title="Delete theme"
                                            @click="${e => this._deleteUserTheme(t.cls, e)}">×</button>
                                    ` : ''}
                                </div>`)}
                        </div>` : html``}
                </div>
            </div>

            <div class="overrides-section">
                <div class="collapsible-hdr" @click="${() => this._overridesOpen = !this._overridesOpen}">
                    <span class="section-label">Colour overrides</span>
                    ${activeCount > 0 ? html`<span class="overrides-badge">${activeCount}</span>` : ''}
                    <span class="collapsible-arrow">${this._overridesOpen ? '▴' : '▾'}</span>
                </div>
                ${this._overridesOpen ? html`
                    <div class="overrides-body${isDefault ? ' overrides-disabled' : ''}">
                        ${OVERRIDE_VARS.map(varName => {
                            const value       = this._overrides[varName] || '';
                            const placeholder = themeVars[varName] || '';
                            return html`
                                <div class="or-row">
                                    <sl-input size="small"
                                        label="${varName}"
                                        placeholder="${placeholder}"
                                        autocomplete="off"
                                        .value="${value}"
                                        @sl-input="${e => this._setOverride(varName, e.target.value)}">
                                    </sl-input>
                                    <input type="color" class="or-color"
                                        .value="${this._toColorHex(value || placeholder)}"
                                        ?disabled="${isDefault}"
                                        @input="${e => this._setOverride(varName, e.target.value)}">
                                    <button class="or-clear${value ? ' or-active' : ''}"
                                        title="Clear override"
                                        @click="${() => this._clearOverride(varName)}">×</button>
                                </div>`;
                        })}
                        ${activeCount > 0 ? html`
                            <div class="save-theme-wrap">
                                ${this._saveThemeOpen ? html`
                                    <div class="save-theme-row">
                                        <sl-input size="small"
                                            placeholder="Theme name…"
                                            autocomplete="off"
                                            .value="${this._saveThemeName}"
                                            @sl-input="${e => this._saveThemeName = e.target.value}"
                                            @keydown="${e => {
                                                if (e.key === 'Enter') this._saveUserTheme();
                                                if (e.key === 'Escape') this._saveThemeOpen = false;
                                            }}">
                                        </sl-input>
                                        <button class="save-theme-btn"
                                            ?disabled="${!this._saveThemeName.trim()}"
                                            @click="${() => this._saveUserTheme()}">Save</button>
                                        <button class="save-theme-btn"
                                            @click="${() => this._saveThemeOpen = false}">✕</button>
                                    </div>
                                ` : html`
                                    <button class="save-theme-btn"
                                        @click="${() => this._saveThemeOpen = true}">Save as theme…</button>
                                `}
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>

            <div class="classes-section">
                <div class="collapsible-hdr" @click="${() => this._classesOpen = !this._classesOpen}">
                    <span class="section-label">Classes</span>
                    ${Object.keys(this._classes).length > 0 ? html`<span class="overrides-badge">${Object.keys(this._classes).length}</span>` : ''}
                    <span class="collapsible-arrow">${this._classesOpen ? '▴' : '▾'}</span>
                </div>
                ${this._classesOpen ? html`
                    <div class="classes-body">
                        ${Object.entries(this._classes).map(([name, props]) => html`
                            <div class="class-card${this._collapsedClasses.has(name) ? ' collapsed' : ''}">
                                <div class="class-card-hdr">
                                    ${this._editingClass === name ? html`
                                        <input class="class-name-input" type="text"
                                            .value="${name}"
                                            @keydown="${e => {
                                                if (e.key === 'Enter') { e.preventDefault(); this._commitRenameClass(name, e.target.value); }
                                                if (e.key === 'Escape') this._editingClass = null;
                                            }}"
                                            @blur="${e => this._commitRenameClass(name, e.target.value)}">
                                    ` : html`
                                        <button class="class-card-toggle"
                                            @click="${() => this._toggleCollapse(name)}">${this._collapsedClasses.has(name) ? '\u25b6' : '\u25be'}</button>
                                        <span class="class-card-name" title="Click to rename"
                                            @click="${() => this._startRenameClass(name)}">${name}</span>
                                    `}
                                    <button class="class-card-del" title="Delete class"
                                        @click="${() => this._deleteClass(name)}">×</button>
                                </div>
                                ${!this._collapsedClasses.has(name) ? html`
                                    <div class="class-props-list">
                                        ${Object.entries(props).map(([k, v]) => html`
                                            <div class="prop-row">
                                                <input class="prop-key" type="text" .value="${k}"
                                                    @blur="${e => { const nk = e.target.value.trim(); if (nk && nk !== k) this._renameProp(name, k, nk, v); else if (!nk) e.target.value = k; }}">
                                                <input class="prop-val" type="text" .value="${v}"
                                                    data-cls="${name}" data-key="${k}"
                                                    @input="${e => this._onValInput(name, k, e)}"
                                                    @keydown="${e => this._onValKeydown(name, k, e)}"
                                                    @blur="${e => { setTimeout(() => { if (this._valAutoState?.cls === name && this._valAutoState?.key === k) this._valAutoState = null; }, 150); this._setPropVal(name, k, e.target.value); }}">
                                                <button class="prop-del" @click="${() => this._deleteProp(name, k)}">×</button>
                                            </div>`)}
                                    </div>
                                    <div class="class-props-foot">
                                        <div class="add-prop-input-wrap">
                                            <input class="class-add-input" type="text"
                                                placeholder="+ Add CSS property…"
                                                data-cls="${name}"
                                                @focus="${e => this._onAddPropInput(name, e.target.value)}"
                                                @input="${e => this._onAddPropInput(name, e.target.value)}"
                                                @keydown="${e => this._onAddPropKeydown(name, e)}"
                                                @blur="${() => setTimeout(() => { if (this._addPropFor.cls === name) this._addPropFor = {cls: null, val: '', matches: [], cursor: -1}; }, 150)}">
                                            ${this._addPropFor.cls === name && this._addPropFor.matches.length ? html`
                                                <ul class="class-prop-list" @mousedown="${e => e.preventDefault()}">
                                                    ${this._addPropFor.matches.map((p, i) => html`
                                                        <li class="${i === this._addPropFor.cursor ? 'apc-cursor' : ''}"
                                                            @click="${() => this._commitAddPropToClass(name, p)}">${p}</li>
                                                    `)}
                                                </ul>
                                            ` : ''}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>`)}
                        <div class="new-class-wrap">
                            <button class="new-class-btn" @click="${() => this._addClass()}">+ New class</button>
                        </div>
                    </div>
                ` : ''}
            </div>
            ${this._valAutoState ? html`
                <ul class="class-val-list"
                    style="top:${this._valAutoState.top}px;left:${this._valAutoState.left}px;width:${this._valAutoState.width}px"
                    @mousedown="${e => e.preventDefault()}">
                    ${this._valAutoState.matches.map((v, i) => html`
                        <li class="${i === this._valAutoState.cursor ? 'apc-cursor' : ''}"
                            @click="${() => this._selectValOption(v, this._valAutoState.cls, this._valAutoState.key)}">${v}</li>
                    `)}
                </ul>
            ` : ''}`;
    }
}

window.customElements.define('feezal-sidebar-themes', FeezalSidebarThemes);



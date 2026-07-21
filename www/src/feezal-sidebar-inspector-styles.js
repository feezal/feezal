import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import {LIVE_APPLY_DEBOUNCE_MS} from './feezal-sidebar-inspector-attributes.js';
// N34: built-in per-property style editors (editor bundle only — the viewer
// never loads the inspector, so declaring an editor tag in a viewer-bundled
// descriptor is just a string there).
import './feezal-style-editor-background.js';

/** Properties managed by the editor internals — must not be exposed for user editing. */
const EDITOR_RESERVED_PROPS = new Set(['cursor', 'z-index', 'transform']);

/**
 * N34: identity of a `styles` descriptor entry — plain property name, or the
 * virtual group id of a custom style-editor entry ({group, editor, …}).
 */
const styleKey = p => typeof p === 'string' ? p : (p.property ?? (p.group && `group:${p.group}`));

/**
 * N34: the CSS longhands a group entry covers. An explicit `covers: [...]`
 * on the descriptor wins; otherwise the editor component declares them via
 * `static covers = [...]` on its class.
 */
function groupCovers(entry) {
    if (Array.isArray(entry.covers)) return entry.covers;
    return window.customElements.get(entry.editor)?.covers ?? [];
}

/** Curated list of common CSS property names for the 'Add property' autocomplete. */
const CSS_PROP_NAMES = [
    'align-content', 'align-items', 'align-self', 'animation', 'aspect-ratio',
    'background', 'background-color', 'background-image', 'background-position',
    'background-repeat', 'background-size', 'border', 'border-bottom', 'border-color',
    'border-left', 'border-radius', 'border-right', 'border-style', 'border-top',
    'border-width', 'bottom', 'box-shadow', 'box-sizing', 'color', 'column-gap',
    'cursor', 'display', 'filter', 'flex', 'flex-direction', 'flex-grow',
    'flex-shrink', 'flex-wrap', 'font', 'font-family', 'font-size', 'font-style',
    'font-weight', 'gap', 'grid-column', 'grid-row', 'grid-template-columns',
    'grid-template-rows', 'height', 'justify-content', 'justify-self', 'left',
    'letter-spacing', 'line-height', 'margin', 'margin-bottom', 'margin-left',
    'margin-right', 'margin-top', 'max-height', 'max-width', 'min-height',
    'min-width', 'mix-blend-mode', 'object-fit', 'opacity', 'outline',
    'overflow', 'overflow-x', 'overflow-y', 'padding', 'padding-bottom',
    'padding-left', 'padding-right', 'padding-top', 'pointer-events', 'position',
    'resize', 'right', 'row-gap', 'text-align', 'text-decoration', 'text-overflow',
    'text-transform', 'top', 'transform', 'transition', 'user-select', 'visibility',
    'white-space', 'width', 'z-index',
];

/** CSS properties with a known, finite value set → rendered as sl-select. */
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
    'cursor':            ['auto', 'default', 'pointer', 'crosshair', 'move', 'text', 'wait', 'help', 'not-allowed', 'grab', 'grabbing', 'zoom-in', 'zoom-out', 'none'],
    'box-sizing':        ['content-box', 'border-box'],
    'font-weight':       ['normal', 'bold', 'lighter', 'bolder', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
    'text-transform':    ['none', 'uppercase', 'lowercase', 'capitalize'],
    'text-overflow':     ['clip', 'ellipsis'],
    'white-space':       ['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line'],
    'user-select':       ['auto', 'none', 'text', 'all'],
    'resize':            ['none', 'both', 'horizontal', 'vertical'],
    'object-fit':        ['fill', 'contain', 'cover', 'none', 'scale-down'],
    'mix-blend-mode':    ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'],
};

class FeezalSidebarInspectorStyles extends LitElement {
    static properties = {
        selectedElems:  {type: Array},
        items:          {type: Array},
        _varDropdown:   {state: true},
        _varPos:        {state: true},
        _addProp:       {state: true},
        _addPropList:   {state: true},
        _addPropCursor: {state: true}
    };

    _cssVars = [];

    constructor() {
        super();
        this.selectedElems = [];
        this.items = [];
        this._varDropdown = {idx: -1, matches: [], cursor: -1, visible: false};
        this._addProp = '';
        this._addPropList = [];
        this._addPropCursor = -1;
        this._varPos = {top: 0, left: 0, width: 200};
    }

    static styles = css`
        :host { display: block; margin: 12px; }
        .fields-wrap { display: flex; flex-wrap: wrap; gap: 0 4px; }
        .field { position: relative; margin-bottom: 8px; width: 100%; }
        .field.half { width: calc(50% - 2px); }
        .row { display: flex; align-items: flex-end; gap: 4px; margin-bottom: 4px; }
        .row sl-input, .row sl-select { flex: 1; }
        /* Background/border follow the inherited feezal dark-mode vars so the
           surround around the native swatch isn't a bright box in dark mode. */
        .row input[type=color] { width: 36px; height: 32px; padding: 2px; border: 1px solid var(--feezal-border, #ccc); background: var(--feezal-bg, #fff); border-radius: 3px; cursor: pointer; flex-shrink: 0; }
        .row input[type=color]::-webkit-color-swatch-wrapper { padding: 0; }
        .row input[type=color]::-webkit-color-swatch { border: none; border-radius: 2px; }
        /* N20: a var() colour that can't be resolved shows a checkerboard so the author knows */
        .row input[type=color].unresolved::-webkit-color-swatch {
            background-image: repeating-conic-gradient(#bbb 0% 25%, #fff 0% 50%);
            background-size: 8px 8px;
        }
        /* Dark mode: style Shoelace parts via inherited CSS vars */
        sl-input::part(form-control-label), sl-select::part(form-control-label) { color: var(--sl-input-label-color, inherit); }
        sl-input::part(base), sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }

        /* ── Add custom CSS property ───────────────────────────────── */
        .add-prop-wrap { position: relative; margin-top: 10px; border-top: 1px solid var(--feezal-border, #ddd); padding-top: 10px; }
        .add-prop-wrap sl-input::part(base) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); }
        .add-prop-wrap sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        .add-prop-wrap sl-input::part(form-control-label) { color: var(--sl-input-label-color, inherit); font-size: 11px; }
        .prop-list {
            position: absolute; top: 100%; left: 0; right: 0; z-index: 9999;
            list-style: none; margin: 2px 0 0; padding: 4px 0;
            background: var(--feezal-bg, #fff); border: 1px solid var(--feezal-border, #ccc);
            border-radius: 4px; box-shadow: 0 4px 14px rgba(0,0,0,.18);
            max-height: 160px; overflow-y: auto; font-size: 12px; font-family: monospace;
        }
        .prop-list li {
            padding: 4px 10px; cursor: pointer;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            color: var(--feezal-color, #333);
        }
        .prop-list li:hover, .prop-list li.cursor {
            background: var(--sl-color-primary-600, #0284c7); color: #fff;
        }

        /* ── CSS variable autocomplete ─────────────────────────────── */
        .var-list {
            position: fixed; z-index: 9999;
            list-style: none; margin: 0; padding: 4px 0;
            background: var(--feezal-bg, #fff); border: 1px solid var(--feezal-border, #ccc);
            border-radius: 4px; box-shadow: 0 4px 14px rgba(0,0,0,.18);
            max-height: 180px; overflow-y: auto; font-size: 12px; font-family: monospace;
        }
        .var-list li {
            padding: 4px 10px; cursor: pointer;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            color: var(--feezal-color, #333);
        }
        .var-list li:hover, .var-list li.cursor {
            background: var(--sl-color-primary-600, #0284c7); color: #fff;
        }

        /* ── Remove (×) button on custom properties ───────────────── */        .custom-sep {
            flex-basis: 100%;
            margin-top: 10px;
            border-top: 1px solid var(--feezal-border, #ddd);
            padding-top: 6px;
        }        .remove-btn {
            flex-shrink: 0;
            width: 20px; height: 30px;
            border: none; background: none; cursor: pointer;
            color: var(--feezal-color, #666);
            font-size: 15px; line-height: 1;
            padding: 0; border-radius: 3px;
            opacity: 0.4; transition: opacity 0.1s, color 0.1s;
        }
        .remove-btn:hover { opacity: 1; color: #c00; }

        /* Mixed state (multi-select, values differ across selection) */
        .field.mixed sl-input::part(base),
        .field.mixed sl-select::part(combobox) { opacity: 0.75; }

        /* ── N34: custom style-group editor host ───────────────────── */
        .group-field { margin-top: 4px; }
        .group-label {
            font-size: var(--sl-input-label-font-size-small, 13px);
            color: var(--sl-input-label-color, inherit);
            margin-bottom: 4px;
        }

        /* ── Classes selector ───────────────────────────────────────── */
        .classes-wrap { margin-top: 10px; border-top: 1px solid var(--feezal-border, #ddd); padding-top: 10px; }
        .classes-header { font-size: 11px; color: var(--feezal-color, #666); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
        .classes-wrap sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        /* Fix dark-mode badge contrast: override Shoelace neutral tokens with explicit feezal vars */
        .classes-wrap sl-select::part(tag) { background: rgba(2,132,199,0.18); border-color: rgba(2,132,199,0.45); }
        .classes-wrap sl-select::part(tag__content) { color: var(--feezal-color, #333); }
        .classes-wrap sl-select::part(tag__remove-button) { color: var(--feezal-color, #555); }
        .classes-empty { font-size: 11px; color: var(--feezal-color,#999); opacity: 0.6; }
    `;

    connectedCallback() {
        super.connectedCallback();
        requestAnimationFrame(() => this._collectCssVars());
        this._onClassesChanged = () => this.requestUpdate();
        document.addEventListener('feezal-classes-changed', this._onClassesChanged);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('feezal-classes-changed', this._onClassesChanged);
    }

    _collectCssVars() {
        const vars = new Set();
        try {
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        for (const m of (rule.cssText || '').matchAll(/(--[\w-]+)\s*:/g)) {
                            vars.add(m[1]);
                        }
                    }
                } catch { /* cross-origin sheet */ }
            }
        } catch {}
        // Sort: --feezal-* first, then alphabetically
        this._cssVars = [...vars].sort((a, b) => {
            const af = a.startsWith('--feezal-'), bf = b.startsWith('--feezal-');
            return af === bf ? a.localeCompare(b) : af ? -1 : 1;
        });
    }

    updated(changed) {
        if (changed.has('selectedElems')) {
            // U36: never let a pending debounced live-commit fire against a
            // different selection — the value belongs to the previous element.
            this._cancelLiveTimers();
            this._selectedElemsChanged();
            // Re-collect vars when a new element is selected (theme may have changed)
            this._collectCssVars();
        }
        this._syncGroupEditors();
    }

    // ── N34: custom style-group editors ───────────────────────────────────

    /**
     * Mount the declared group-editor widgets into their hosts (mirror of the
     * N6 custom-inspector sync): the widget receives the selection via
     * `.elements` (and `.element` = primary) and emits `feezal-style-changed`
     * events the inspector applies.
     */
    _syncGroupEditors() {
        for (const host of this.shadowRoot?.querySelectorAll('.group-editor-host') ?? []) {
            const item = this.items.find(it => it.group === host.dataset.group);
            if (!item?.editor) { host.innerHTML = ''; continue; }
            let editor = host.firstElementChild;
            if (!editor || editor.localName !== item.editor) {
                host.innerHTML = '';
                editor = document.createElement(item.editor);
                host.appendChild(editor);
            }
            if (editor.elements !== this.selectedElems) {
                editor.elements = this.selectedElems;
                editor.element = this.selectedElems[0] ?? null;
            }
        }
    }

    /**
     * A group editor changed a longhand family: detail.props maps CSS property
     * → value (null/'' removes). Applied to every selected element atomically,
     * one history checkpoint.
     */
    _onGroupStyleChanged(e) {
        const props = e.detail?.props;
        if (!props) return;
        e.stopPropagation();
        this.selectedElems.forEach(el => {
            for (const [prop, value] of Object.entries(props)) {
                if (value === null || value === undefined || value === '') {
                    el.style.removeProperty(prop);
                } else {
                    el.style.setProperty(prop, value);
                }
            }
        });
        feezal.app.change();
    }

    render() {
        const {idx: dropIdx, matches, cursor, visible} = this._varDropdown;
        const {top, left, width} = this._varPos;
        return html`
            <div class="fields-wrap">
            ${this.items.map((item, idx) => { if (item.group) return html`
                <div class="field group-field">
                    <div class="group-label">${item.label || item.group}</div>
                    <div class="group-editor-host" data-group="${item.group}"
                        @feezal-style-changed="${e => this._onGroupStyleChanged(e)}"></div>
                </div>
            `; const colorHex = item.color ? this._toColorHex(item) : ''; return html`
                ${item.custom && (idx === 0 || !this.items[idx - 1].custom) ? html`
                    <div class="custom-sep"></div>
                ` : ''}
                <div class="field ${item.class || ''} ${item.mixed ? 'mixed' : ''}">
                    <div class="row ${item.invalid ? 'invalid' : ''}">
                        ${CSS_ENUMS[item.property] ? html`
                            <sl-select
                                label="${item.property}"
                                size="small"
                                data-property="${item.property}"
                                .value="${item.mixed ? '' : (item.value || '')}"
                                @sl-change="${e => this._change(e, idx)}">
                                ${CSS_ENUMS[item.property].map(v => html`
                                    <sl-option value="${v}">${v}</sl-option>
                                `)}
                            </sl-select>
                        ` : html`
                            <sl-input
                                label="${item.property}"
                                size="small"
                                autocomplete="off"
                                .value="${item.mixed ? '' : (item.value || '')}"
                                placeholder="${item.mixed ? '— varies —' : (item.default || '')}"
                                data-property="${item.property}"
                                @sl-input="${e => this._liveInput(e, idx)}"
                                @keydown="${e => this._onVarKeydown(e, idx)}"
                                @sl-change="${e => this._change(e, idx)}"
                                @sl-blur="${e => this._blur(e, idx)}">
                            </sl-input>
                        `}
                        ${item.color ? html`
                            <input type="color"
                                class="${colorHex ? '' : 'unresolved'}"
                                .value="${colorHex || '#000000'}"
                                @input="${e => this._colorInput(e, idx)}">
                        ` : ''}
                        ${item.custom ? html`
                            <button class="remove-btn" title="Remove property"
                                @click="${() => this._removeStyle(idx)}">×</button>
                        ` : ''}
                    </div>
                </div>
            `; })}
            </div>
            ${visible ? html`
                <ul class="var-list"
                    style="top:${top}px;left:${left}px;width:${width}px"
                    @mousedown="${e => e.preventDefault()}">
                    ${matches.map((v, i) => html`
                        <li class="${i === cursor ? 'cursor' : ''}"
                            @click="${() => this._selectVar(v, dropIdx)}">
                            ${v}
                        </li>
                    `)}
                </ul>
            ` : ''}
            <div class="add-prop-wrap">
                <sl-input
                    size="small"
                    label="Add CSS property"
                    placeholder="e.g. font-size"
                    .value="${this._addProp}"
                    autocomplete="off"
                    @sl-input="${e => this._onAddPropInput(e.target.value)}"
                    @keydown="${e => this._onAddPropKeydown(e)}"
                    @sl-blur="${() => setTimeout(() => this._addPropList = [], 150)}">
                </sl-input>
                ${this._addPropList.length ? html`
                    <ul class="prop-list" @mousedown="${e => e.preventDefault()}">
                        ${this._addPropList.map((p, i) => html`
                            <li class="${i === this._addPropCursor ? 'cursor' : ''}"
                                @click="${() => this._commitAddProp(p)}">${p}</li>
                        `)}
                    </ul>
                ` : ''}
            </div>            <div class="classes-wrap">
                <div class="classes-header">Classes</div>
                ${Object.keys(feezal.classes || {}).length ? html`
                    <sl-select size="small" placeholder="Apply classes…" multiple clearable
                        .value="${this._getCurrentClasses()}"
                        @sl-change="${e => this._onClassesChange(e)}">
                        ${Object.keys(feezal.classes || {}).map(name => html`
                            <sl-option value="${name}">${name}</sl-option>
                        `)}
                    </sl-select>
                ` : html`<div class="classes-empty">No classes defined yet</div>`}
            </div>        `;
    }

    // ── CSS var autocomplete ──────────────────────────────────────────────

    _onVarInput(e, idx) {
        const val = e.target.value;
        // Detect if the text ends with an open var(-- expression
        const m = val.match(/var\(--([-\w]*)$/);
        if (m) {
            const prefix = '--' + m[1];
            const matches = this._cssVars.filter(v => v.startsWith(prefix));
            if (matches.length > 0) {
                // Position the fixed dropdown below the input element
                const rect = e.target.getBoundingClientRect();
                this._varPos = {top: rect.bottom + 2, left: rect.left, width: rect.width};
                this._varDropdown = {idx, matches, cursor: -1, visible: true, currentInput: val};
                return;
            }
        }
        if (this._varDropdown.visible) {
            this._varDropdown = {...this._varDropdown, visible: false};
        }
    }

    _onVarKeydown(e, idx) {
        if (!this._varDropdown.visible || this._varDropdown.idx !== idx) return;
        const {matches, cursor} = this._varDropdown;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this._varDropdown = {...this._varDropdown, cursor: Math.min(cursor + 1, matches.length - 1)};
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this._varDropdown = {...this._varDropdown, cursor: Math.max(cursor - 1, -1)};
        } else if (e.key === 'Enter' && cursor >= 0) {
            e.preventDefault();
            this._selectVar(matches[cursor], idx);
        } else if (e.key === 'Escape') {
            this._varDropdown = {...this._varDropdown, visible: false};
        }
    }

    _selectVar(varName, idx) {
        const current = this._varDropdown.currentInput ?? this.items[idx]?.value ?? '';
        const newVal = current.replace(/var\(--([\w-]*)$/, `var(${varName})`);
        this._varDropdown = {...this._varDropdown, visible: false};
        this._applyValue(idx, newVal);
    }

    _applyValue(idx, value) {
        // Definitive commit (var-autocomplete pick) — drop any pending
        // debounced live-commit for the same field first (U36).
        if (this._liveTimers) {
            clearTimeout(this._liveTimers[idx]);
            delete this._liveTimers[idx];
        }

        const item = this.items[idx];
        this.selectedElems.forEach(el => el.style.setProperty(item.property, value));
        this.items = this.items.map((it, i) => i === idx ? {...it, value, invalid: false, mixed: false} : it);
        feezal.app.change();
    }

    /**
     * Resolve a CSS colour value to a `#rrggbb` hex for the native colour swatch.
     * Handles `var(--x)`, `var(--x, fallback)`, `color-mix(…)`, rgb/named colours by
     * resolving them against the selected element's computed styles (N20).
     * Returns '' when the value cannot be resolved to an opaque colour.
     */
    _toColorHex(item) {
        const value = this._effectiveColorValue(item);
        if (!value) return '';
        const v = String(value).trim();
        // Fast path: already a hex literal.
        const hexMatch = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (hexMatch) return v.length === 4
            ? '#' + [...v.slice(1)].map(c => c + c).join('')
            : v.toLowerCase();
        // Anything else (var(), color-mix(), rgb(), named) → resolve via a probe
        // in the element's shadow root so its custom properties resolve correctly.
        return this._resolveColor(v);
    }

    /**
     * The colour to show in the swatch: the inline value if set, otherwise the
     * element's *effective* colour for this property (so un-customised colours
     * show their real default/theme colour rather than black).
     */
    _effectiveColorValue(item) {
        if (item.value) return item.value;
        const el = this.selectedElems && this.selectedElems[0];
        if (!el) return item.default || '';
        const cs = getComputedStyle(el);
        if (item.property.startsWith('--')) {
            return cs.getPropertyValue(item.property).trim() || item.default || '';
        }
        if (item.property === 'background') return cs.backgroundColor;
        if (item.property === 'color')      return cs.color;
        return cs.getPropertyValue(item.property).trim() || item.default || '';
    }

    _resolveColor(value) {
        const el = this.selectedElems && this.selectedElems[0];
        if (!el) return '';
        // Resolve inside the element's shadow root so its `:host`-defined
        // --feezal-* custom properties (and inherited theme vars) apply — a
        // light-DOM child would NOT see the :host vars.
        const root = el.shadowRoot || el;
        let probe;
        try {
            probe = document.createElement('span');
            probe.style.cssText = 'display:none!important;position:absolute';
            probe.style.color = value;
            if (!probe.style.color) return '';   // browser rejected the value
            root.appendChild(probe);
            return this._rgbToHex(getComputedStyle(probe).color);
        } catch {
            return '';
        } finally {
            if (probe && probe.parentNode) probe.parentNode.removeChild(probe);
        }
    }

    _rgbToHex(rgb) {
        const m = rgb && rgb.match(/rgba?\(([^)]+)\)/i);
        if (!m) return '';
        const parts = m[1].split(/[,\s/]+/).map(s => parseFloat(s)).filter(n => !isNaN(n));
        if (parts.length < 3) return '';
        const [r, g, b, a] = parts;
        if (a === 0) return '';   // fully transparent = unresolved var with no fallback
        const hex = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
        return '#' + hex(r) + hex(g) + hex(b);
    }

    _colorInput(e, idx) {
        const item = this.items[idx];
        this.selectedElems.forEach(el => {
            el.style.setProperty(item.property, e.target.value);
        });
        this.items = this.items.map((it, i) => i === idx ? {...it, value: e.target.value, mixed: false} : it);
        feezal.app.change();
    }

    _blur(e, idx) {
        // Delay so a mousedown click on the var-list dropdown registers before we close it
        setTimeout(() => {
            if (this._varDropdown.visible && this._varDropdown.idx === idx) {
                this._varDropdown = {...this._varDropdown, visible: false};
            }
        }, 150);
        if (this.selectedElems.length > 0) {
            const item = this.items[idx];
            const el = this.selectedElems[0];
            if (!item.invalid && el.style[item.property] !== e.target.value) {
                e.target.value = el.style.getPropertyValue(item.property);
            }
        }
    }

    /** sl-change (blur/Enter): flush — cancel any pending debounce and commit
     * with a history checkpoint (U36). */
    _change(e, idx) {
        if (this._liveTimers) {
            clearTimeout(this._liveTimers[idx]);
            delete this._liveTimers[idx];
        }

        this._changeValue(e.target.value, idx, true);
    }

    /** U36: debounced live-apply while typing — the style updates on the
     * canvas ~LIVE_APPLY_DEBOUNCE_MS after the last keystroke, without a
     * history checkpoint (blur/Enter pushes the single undo step). */
    _liveInput(e, idx) {
        this._onVarInput(e, idx);   // keep the var(--…) autocomplete behaviour
        const value = e.target.value;
        this._liveTimers ??= {};
        clearTimeout(this._liveTimers[idx]);
        this._liveTimers[idx] = setTimeout(() => {
            delete this._liveTimers[idx];
            this._changeValue(value, idx, false);
        }, LIVE_APPLY_DEBOUNCE_MS);
    }

    _cancelLiveTimers() {
        for (const t of Object.values(this._liveTimers || {})) clearTimeout(t);
        this._liveTimers = {};
    }

    _changeValue(value, idx, history) {
        const item = this.items[idx];
        if (!item) return;
        let invalid = false;
        this.selectedElems.forEach(el => {
            const previous = el.style.getPropertyValue(item.property);
            if (previous !== value) {
                el.style.setProperty(item.property, value);
                invalid = invalid || (previous === el.style.getPropertyValue(item.property));
            }
        });
        if (history && !invalid) {
            feezal.app.change();
        }

        // Live typing (history=false) keeps the typed text in the item even
        // while it's transiently invalid ("re" of "red") — resetting it would
        // stomp the input mid-typing (U36 caret safety). The flush keeps the
        // old reset-to-last-valid behaviour.
        const kept = (invalid && history) ? item.value : value;
        this.items = this.items.map((it, i) => i === idx ? {...it, value: kept, invalid, mixed: false} : it);
    }

    setStyle(target, changes) {
        if (!target.classList.contains('feezal-selected')) {
            return;
        }

        // N34: out-of-band change to a covered longhand → tell the mounted
        // group editor to re-read its element.
        for (const host of this.shadowRoot?.querySelectorAll('.group-editor-host') ?? []) {
            const item = this.items.find(it => it.group === host.dataset.group);
            if (item?.covers?.some(p => changes.includes(p))) {
                host.firstElementChild?.refresh?.();
            }
        }

        this.items = this.items.map(item => {
            if (item.group || !changes.includes(item.property)) {
                return item;
            }

            const allEqual = this.selectedElems
                .map(el => el.style.getPropertyValue(item.property))
                .every(v => v === target.style.getPropertyValue(item.property));
            return {...item, value: allEqual ? target.style.getPropertyValue(item.property) : '', mixed: !allEqual};
        });
    }

    _selectedElemsChanged() {
        if (!this.selectedElems || this.selectedElems.length === 0) {
            this.items = [];
            return;
        }

        const el = this.selectedElems[0];
        const cls = window.customElements.get(el.name ? 'feezal-view' : el.localName);
        if (!cls || !cls.feezal) {
            this.items = [];
            return;
        }

        this.options = cls.feezal;

        // For multi-select: intersect declared styles across all selected element classes.
        let allDeclared = this.options.styles || [];
        // U41: children of a flow view are laid out by the flex container — top/
        // left are meaningless, so hide them (width/height + the % presets stay).
        const inFlowView = !el.name && this.selectedElems.every(e =>
            !e.name && e.parentElement?.localName === 'feezal-view' && e.parentElement.childPosition === 'flow');
        if (inFlowView) {
            allDeclared = allDeclared.filter(p => !['top', 'left'].includes(styleKey(p)));
        }
        const filteredDeclared = this.selectedElems.length === 1 ? allDeclared : allDeclared.filter(prop => {
            const key = styleKey(prop);
            return this.selectedElems.every(e => {
                const eName = e.name ? 'feezal-view' : e.localName;
                const eCls = window.customElements.get(eName);
                return (eCls?.feezal?.styles || []).some(s => styleKey(s) === key);
            });
        });

        const declaredItems = filteredDeclared.map(prop => {
            const property = typeof prop === 'string' ? {property: prop} : prop;
            // N34: a {group, editor} entry renders a custom style editor
            // widget instead of a value row — it owns a whole longhand family.
            if (property.group) {
                return {...property, covers: groupCovers(property), invalid: false};
            }
            const propName = property.property;
            const vals = this.selectedElems.map(e => e.style.getPropertyValue(propName));
            const mixed = this.selectedElems.length > 1 && vals.some(v => v !== vals[0]);
            const value = mixed ? '' : vals[0];
            const small = ['top', 'left', 'width', 'height'].includes(propName);
            return {
                ...property,
                value,
                mixed,
                color: property.type === 'color',
                class: small ? 'half' : '',
                invalid: false
            };
        });

        // Custom properties: union across all selected elements.
        // Mixed = not present on all elements, or present on all but with differing values.
        // N34: longhands covered by a group editor are suppressed too — they are
        // edited through the group widget, not as stray custom rows.
        const declaredSet = new Set(declaredItems.flatMap(it => it.group ? it.covers : [it.property]));
        const customMap = new Map(); // propName → {values: string[], presentCount: number}

        for (const e of this.selectedElems) {
            const styleAttr = e.getAttribute('style') || '';
            for (const decl of styleAttr.split(';')) {
                const colonIdx = decl.indexOf(':');
                if (colonIdx === -1) continue;
                const propName = decl.slice(0, colonIdx).trim();
                if (!propName || propName.startsWith('--') || declaredSet.has(propName) || EDITOR_RESERVED_PROPS.has(propName)) continue;
                // U41: top/left are meaningless in a flow view — never show them,
                // even as a stray inline "custom" row (they were filtered out of
                // the declared set above, which would otherwise re-surface them).
                if (inFlowView && (propName === 'top' || propName === 'left')) continue;
                const value = e.style.getPropertyValue(propName);
                if (!customMap.has(propName)) customMap.set(propName, {values: [], presentCount: 0});
                const entry = customMap.get(propName);
                entry.values.push(value);
                entry.presentCount++;
            }
        }

        const customItems = [];
        for (const [propName, {values, presentCount}] of customMap) {
            const onAll = presentCount === this.selectedElems.length;
            const mixed = !onAll || (this.selectedElems.length > 1 && values.some(v => v !== values[0]));
            const value = mixed ? '' : values[0];
            const isEnum = Boolean(CSS_ENUMS[propName]);
            const isColor = !isEnum && (propName.includes('color') || propName === 'background');
            customItems.push({
                property: propName,
                value,
                mixed,
                color: isColor,
                class: '',
                invalid: false,
                custom: true
            });
        }

        this.items = [...declaredItems, ...customItems];
    }
    // ── Add custom CSS property ───────────────────────────────────────────────

    /** N34: longhands owned by a mounted group editor (+ their shorthand). */
    _coveredProps() {
        return new Set(this.items.flatMap(it => it.group ? (it.covers || []) : []));
    }

    _onAddPropInput(val) {
        this._addProp = val;
        const q = val.trim().toLowerCase();
        if (q.length === 0) {
            this._addPropList = [];
            this._addPropCursor = -1;
            return;
        }
        const covered = this._coveredProps();
        this._addPropList = CSS_PROP_NAMES.filter(p => p.includes(q) && !EDITOR_RESERVED_PROPS.has(p) && !covered.has(p)).slice(0, 12);
        this._addPropCursor = -1;
    }

    _onAddPropKeydown(e) {
        const list = this._addPropList;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this._addPropCursor = Math.min(this._addPropCursor + 1, list.length - 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this._addPropCursor = Math.max(this._addPropCursor - 1, -1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const chosen = this._addPropCursor >= 0 ? list[this._addPropCursor] : this._addProp.trim();
            if (chosen) this._commitAddProp(chosen);
        } else if (e.key === 'Escape') {
            this._addPropList = [];
            this._addPropCursor = -1;
        }
    }

    _removeStyle(idx) {
        const item = this.items[idx];
        this.selectedElems.forEach(el => el.style.removeProperty(item.property));
        this.items = this.items.filter((_, i) => i !== idx);
        feezal.app.change();
    }

    _commitAddProp(propName) {
        const prop = propName.trim().toLowerCase();
        if (!prop || EDITOR_RESERVED_PROPS.has(prop) || this._coveredProps().has(prop)) return;
        // Don't duplicate an existing item
        if (this.items.some(it => it.property === prop)) {
            this._addProp = '';
            this._addPropList = [];
            this._addPropCursor = -1;
            return;
        }
        // Read current value from selected element's inline style
        const value = this.selectedElems[0]?.style.getPropertyValue(prop) ?? '';
        const isEnum = Boolean(CSS_ENUMS[prop]);
        const isColor = !isEnum && (prop.includes('color') || prop === 'background');
        this.items = [...this.items, {
            property: prop,
            value,
            color: isColor,
            class: '',
            invalid: false,
            custom: true
        }];
        this._addProp = '';
        this._addPropList = [];
        this._addPropCursor = -1;
        // B45: move focus into the new row's value control so the keyboard
        // flow "name ⏎ value ⏎" works without reaching for the mouse. The row
        // renders on the next update; both control shapes (sl-input, and
        // sl-select for enum properties) carry data-property and focus().
        this.updateComplete.then(() => {
            const esc = window.CSS?.escape ? CSS.escape(prop) : prop;
            const ctl = this.renderRoot?.querySelector(`[data-property="${esc}"]`);
            if (ctl) {
                ctl.scrollIntoView?.({block: 'nearest'});
                ctl.focus?.();
            }
        });
    }

    // ── Style Classes ─────────────────────────────────────────────────────────────────

    _getCurrentClasses() {
        if (!this.selectedElems || !this.selectedElems[0]) return [];
        return [...this.selectedElems[0].classList]
            .filter(c => c.startsWith('feezal-class-'))
            .map(c => c.slice('feezal-class-'.length));
    }

    _onClassesChange(e) {
        const selected = Array.isArray(e.target.value) ? e.target.value : [];
        this.selectedElems.forEach(el => {
            // Remove all existing feezal-class-* from the element
            [...el.classList].filter(c => c.startsWith('feezal-class-')).forEach(c => el.classList.remove(c));
            // Apply selected classes
            selected.forEach(name => el.classList.add(`feezal-class-${name}`));
            // Strip inline styles that conflict with any applied class props
            const conflictProps = new Set(
                selected.flatMap(name => Object.keys((feezal.classes || {})[name] || {}))
            );
            for (const prop of conflictProps) {
                if (el.style.getPropertyValue(prop)) el.style.removeProperty(prop);
            }
        });
        feezal.app.change();
        this._selectedElemsChanged();
    }
}

window.customElements.define('feezal-sidebar-inspector-styles', FeezalSidebarInspectorStyles);


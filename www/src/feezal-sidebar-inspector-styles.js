import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';

/** Properties managed by the editor internals — must not be exposed for user editing. */
const EDITOR_RESERVED_PROPS = new Set(['cursor', 'z-index', 'transform']);

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
        .row input[type=color] { width: 36px; height: 32px; padding: 2px; border: 1px solid #ccc; border-radius: 3px; cursor: pointer; flex-shrink: 0; }
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
            this._selectedElemsChanged();
            // Re-collect vars when a new element is selected (theme may have changed)
            this._collectCssVars();
        }
    }

    render() {
        const {idx: dropIdx, matches, cursor, visible} = this._varDropdown;
        const {top, left, width} = this._varPos;
        return html`
            <div class="fields-wrap">
            ${this.items.map((item, idx) => html`
                ${item.custom && (idx === 0 || !this.items[idx - 1].custom) ? html`
                    <div class="custom-sep"></div>
                ` : ''}
                <div class="field ${item.class || ''} ${item.mixed ? 'mixed' : ''}">
                    <div class="row ${item.invalid ? 'invalid' : ''}">
                        ${CSS_ENUMS[item.property] ? html`
                            <sl-select
                                label="${item.property}"
                                size="small"
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
                                placeholder="${item.mixed ? '— varies —' : ''}"
                                data-property="${item.property}"
                                @sl-input="${e => this._onVarInput(e, idx)}"
                                @keydown="${e => this._onVarKeydown(e, idx)}"
                                @sl-change="${e => this._change(e, idx)}"
                                @sl-blur="${e => this._blur(e, idx)}">
                            </sl-input>
                        `}
                        ${item.color ? html`
                            <input type="color"
                                .value="${this._toColorHex(item.value)}"
                                @input="${e => this._colorInput(e, idx)}">
                        ` : ''}
                        ${item.custom ? html`
                            <button class="remove-btn" title="Remove property"
                                @click="${() => this._removeStyle(idx)}">×</button>
                        ` : ''}
                    </div>
                </div>
            `)}
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
        const item = this.items[idx];
        this.selectedElems.forEach(el => el.style.setProperty(item.property, value));
        this.items = this.items.map((it, i) => i === idx ? {...it, value, invalid: false, mixed: false} : it);
        feezal.app.change();
    }

    _toColorHex(value) {
        if (!value || value.startsWith('#')) {
            return value || '#000000';
        }

        // Try to parse rgb/rgba
        return value;
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

    _change(e, idx) {
        const item = this.items[idx];
        let invalid = false;
        this.selectedElems.forEach(el => {
            const previous = el.style.getPropertyValue(item.property);
            if (previous !== e.target.value) {
                el.style.setProperty(item.property, e.target.value);
                invalid = invalid || (previous === el.style.getPropertyValue(item.property));
            }
        });
        if (!invalid) {
            feezal.app.change();
        }

        this.items = this.items.map((it, i) => i === idx ? {...it, value: invalid ? it.value : e.target.value, invalid, mixed: false} : it);
    }

    setStyle(target, changes) {
        if (!target.classList.contains('feezal-selected')) {
            return;
        }

        this.items = this.items.map(item => {
            if (!changes.includes(item.property)) {
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
        const allDeclared = this.options.styles || [];
        const filteredDeclared = this.selectedElems.length === 1 ? allDeclared : allDeclared.filter(prop => {
            const propName = typeof prop === 'string' ? prop : prop.property;
            return this.selectedElems.every(e => {
                const eName = e.name ? 'feezal-view' : e.localName;
                const eCls = window.customElements.get(eName);
                return (eCls?.feezal?.styles || []).some(s => (typeof s === 'string' ? s : s.property) === propName);
            });
        });

        const declaredItems = filteredDeclared.map(prop => {
            const property = typeof prop === 'string' ? {property: prop} : prop;
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
        const declaredSet = new Set(declaredItems.map(it => it.property));
        const customMap = new Map(); // propName → {values: string[], presentCount: number}

        for (const e of this.selectedElems) {
            const styleAttr = e.getAttribute('style') || '';
            for (const decl of styleAttr.split(';')) {
                const colonIdx = decl.indexOf(':');
                if (colonIdx === -1) continue;
                const propName = decl.slice(0, colonIdx).trim();
                if (!propName || propName.startsWith('--') || declaredSet.has(propName) || EDITOR_RESERVED_PROPS.has(propName)) continue;
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

    _onAddPropInput(val) {
        this._addProp = val;
        const q = val.trim().toLowerCase();
        if (q.length === 0) {
            this._addPropList = [];
            this._addPropCursor = -1;
            return;
        }
        this._addPropList = CSS_PROP_NAMES.filter(p => p.includes(q) && !EDITOR_RESERVED_PROPS.has(p)).slice(0, 12);
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
        if (!prop || EDITOR_RESERVED_PROPS.has(prop)) return;
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


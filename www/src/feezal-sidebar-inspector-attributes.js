import {LitElement, html, css} from 'lit';
import {html as staticHtml, unsafeStatic} from 'lit/static-html.js';

// U36: trailing-debounce interval for live-apply-while-typing in the
// attribute AND style inspectors (the styles panel imports this constant).
export const LIVE_APPLY_DEBOUNCE_MS = 250;

// U58: the discovery-stamp primitives moved to a shared, headless module so
// the ⚡ picker and the bulk Generate wizard apply identical wiring.
// valueTemplateLeaf is re-exported here for back-compat with existing importers.
import {stampDiscovery, valueTemplateLeaf, discoveryLabel, discoveryAttributeSuffix} from './feezal-discovery-stamp.js';
export {valueTemplateLeaf};

import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/textarea/textarea.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js';
import './feezal-template-editor.js';
// U53: the shared styled theme picker — mounted via the N6 custom hook for
// feezal-view's `theme` attribute (and by the themes sidebar for the site).
import './feezal-theme-select.js';
import MATERIAL_ICONS from './material-design-icons.js';
import {iconSets} from './feezal-icon.js';

/**
 * feezal-editable-list (U35) — the generic list editor behind the
 * `type: 'objectList'` attribute descriptor: one row per item with typed
 * per-field inputs, ＋ add, per-row ✕ delete, and drag-handle reordering.
 *
 * The attribute stays the single source of truth: `value` is the raw JSON
 * attribute string; edits emit `value-changed` with the items ARRAY (the
 * inspector's _change serializes objects back to the JSON attribute).
 * Unparseable non-empty values fall back to a raw text input (never
 * destroyed). A single field with an empty `key` switches to bare-string
 * items (e.g. `["eco","turbo"]`).
 *
 * Field spec: [{key, type?: 'string'|'number'|'color'|'select', options?, placeholder?}]
 */
class FeezalEditableList extends LitElement {
    static properties = {
        value:  {type: String},
        fields: {type: Array},
        label:  {type: String},
        _dragIdx: {state: true},
    };

    static styles = css`
        :host { display: block; }
        .list-label { font-size: 11px; color: var(--feezal-color, #666); display: inline-block; }
        button.add { background: none; border: 1px solid var(--feezal-border, #ccc); border-radius: 3px; cursor: pointer; padding: 2px 6px; margin-left: 6px; color: var(--feezal-color, inherit); }
        ul { list-style: none; margin: 4px 0; padding: 0; border-bottom: 1px solid var(--feezal-border, #ddd); }
        li { display: flex; align-items: center; gap: 4px; padding: 4px 0; }
        li.drop-target { box-shadow: inset 0 2px 0 var(--sl-color-primary-600, #0284c7); }
        li input, li select { flex: 1; min-width: 0; padding: 4px; background: var(--feezal-bg, white); color: var(--feezal-color, inherit); border: 1px solid var(--feezal-border, #ccc); border-radius: 3px; font-size: 12px; box-sizing: border-box; }
        li input[type=color] { flex: 0 0 28px; padding: 1px; height: 26px; cursor: pointer; }
        .del { background: none; border: none; cursor: pointer; color: #c62828; font-size: 16px; padding: 0 4px; }
        .drag { cursor: move; color: var(--feezal-color, #999); opacity: 0.6; padding: 0 2px; user-select: none; }
        .fallback-hint { font-size: 10px; color: #e65100; margin-top: 2px; }
        .raw { width: 100%; box-sizing: border-box; padding: 4px; font-size: 12px;
            background: var(--feezal-bg, white); color: var(--feezal-color, inherit);
            border: 1px solid var(--feezal-border, #ccc); border-radius: 3px; }
    `;

    constructor() {
        super();
        this.value = '';
        this.fields = [{key: 'label'}, {key: 'value'}];
        this.label = 'items';
        this._dragIdx = null;
    }

    /** Bare mode: a single field with an empty key → items are plain strings. */
    get _bare() {
        return this.fields.length === 1 && !this.fields[0].key;
    }

    /** Parse the raw attribute string. Returns {items} or {error} (unparseable). */
    _parse() {
        // Robustness: accept a ready-made array too (the inspector normally
        // hands us the attribute STRING, but never break if an array slips
        // through a property binding).
        if (Array.isArray(this.value)) return {items: this.value};
        // Polymer's attribute reflection HTML-escapes quotes when it
        // serializes array properties (paper-dropdown items) — unescape
        // before parsing.
        const raw = String(this.value ?? '').trim().replace(/&quot;/g, '"');
        if (!raw) return {items: []};
        try {
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return {error: true};
            return {items: arr};
        } catch {
            return {error: true};
        }
    }

    _emit(items) {
        this.dispatchEvent(new CustomEvent('value-changed', {detail: {value: items}}));
    }

    render() {
        const {items, error} = this._parse();

        // Never destroy what we can't parse — raw fallback input instead.
        if (error) {
            return html`
                <span class="list-label">${this.label}</span>
                <input class="raw" .value="${this.value ?? ''}" autocomplete="off"
                    @change="${e => this._emit(e.target.value)}">
                <div class="fallback-hint">Not a JSON array — edit the raw value or fix it to get the list editor.</div>
            `;
        }

        return html`
            <span class="list-label">${this.label}</span>
            <button class="add" title="Add item" @click="${() => this._add(items)}">+</button>
            <ul>
                ${items.map((item, rowIdx) => html`
                    <li class="${this._dragIdx !== null && this._dragOver === rowIdx ? 'drop-target' : ''}"
                        @dragover="${e => this._onDragOver(e, rowIdx)}"
                        @drop="${e => this._onDrop(e, rowIdx, items)}">
                        <span class="drag" title="Drag to reorder" draggable="true"
                            @dragstart="${e => this._onDragStart(e, rowIdx)}"
                            @dragend="${() => { this._dragIdx = null; this._dragOver = null; }}">⠿</span>
                        ${this.fields.map(f => this._fieldInput(item, rowIdx, f, items))}
                        <button class="del" title="Remove item" @click="${() => this._remove(rowIdx, items)}">✕</button>
                    </li>
                `)}
            </ul>
        `;
    }

    _fieldInput(item, rowIdx, field, items) {
        const val = this._bare ? (typeof item === 'string' ? item : String(item ?? '')) : (item?.[field.key] ?? '');
        const set = v => this._propChanged(rowIdx, field, v, items);
        if (field.type === 'select') {
            return html`
                <select .value="${val}" @change="${e => set(e.target.value)}">
                    ${(field.options || []).map(opt => html`<option value="${opt}" ?selected="${opt === val}">${opt}</option>`)}
                </select>`;
        }
        if (field.type === 'color') {
            return html`
                <input .value="${val}" placeholder="${field.placeholder ?? field.key}" autocomplete="off"
                    @change="${e => set(e.target.value)}">
                <input type="color" title="Pick colour" .value="${/^#[0-9a-fA-F]{6}$/.test(val) ? val : '#000000'}"
                    @change="${e => set(e.target.value)}">`;
        }
        return html`
            <input type="${field.type === 'number' ? 'number' : 'text'}"
                .value="${String(val)}" placeholder="${field.placeholder ?? field.key}" autocomplete="off"
                @change="${e => set(field.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value)}">`;
    }

    // ── Row operations (always emit a NEW array — the attribute re-parses) ──

    _add(items) {
        const row = this._bare ? '' : Object.fromEntries(this.fields.map(f => [f.key, '']));
        this._emit([...items, row]);
    }

    _remove(idx, items) {
        this._emit(items.filter((_, i) => i !== idx));
    }

    _propChanged(rowIdx, field, value, items) {
        this._emit(items.map((row, i) => {
            if (i !== rowIdx) return row;
            return this._bare ? value : {...(typeof row === 'object' && row !== null ? row : {}), [field.key]: value};
        }));
    }

    // ── Drag & drop reordering ──

    _onDragStart(e, idx) {
        this._dragIdx = idx;
        e.dataTransfer.effectAllowed = 'move';
        // Firefox needs data for a drag to start.
        e.dataTransfer.setData('text/plain', String(idx));
    }

    _onDragOver(e, idx) {
        if (this._dragIdx === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (this._dragOver !== idx) {
            this._dragOver = idx;
            this.requestUpdate();
        }
    }

    _onDrop(e, idx, items) {
        e.preventDefault();
        const from = this._dragIdx;
        this._dragIdx = null;
        this._dragOver = null;
        if (from === null || from === idx) return;
        const next = [...items];
        const [moved] = next.splice(from, 1);
        next.splice(idx, 0, moved);
        this._emit(next);
    }
}

window.customElements.define('feezal-editable-list', FeezalEditableList);

// ---------------------------------------------------------------------------

/**
 * Variant families: base names for which every non-zero `${base}_${step}`
 * variant exists. The ZERO step is optional — upstream is inconsistent
 * there: some knx-uf families spell it `_00`, others `_0`, and the shutter/
 * garage families have no zero variant at all (basic-icon-value falls back
 * to the nearest available step). Pure — exported for tests.
 *
 * @param {string[]|Set<string>} names  a set's icon names
 * @param {number[]} steps              e.g. [0, 10, …, 100]
 * @returns {string[]} sorted family base names
 */
export function iconVariantBases(names, steps) {
    const all = names instanceof Set ? names : new Set(names);
    const required = steps.filter(step => step !== 0);
    const probe = `_${required[0]}`;   // candidates derived from the first required step
    const bases = new Set();
    for (const name of all) {
        if (!name.endsWith(probe)) continue;
        const base = name.slice(0, -probe.length);
        if (bases.has(base)) continue;
        if (required.every(step => all.has(`${base}_${step}`))) bases.add(base);
    }
    return [...bases].sort();
}

/**
 * N23: compute the icon picker's grouped matches across icon sets.
 * Pure — exported for tests.
 *
 * @param {object} opts
 * @param {string[]} opts.materialNames  built-in Material names
 * @param {Map}      opts.sets           registry Map(setName → {names, …})
 * @param {string}   opts.activeSet      'all' | 'material' | a registered set name
 * @param {string}   opts.query          raw typed text; a "set:" prefix scopes to that set
 * @param {number}   [opts.cap=90]       max tiles per view
 * @param {number[]} [opts.variantSteps] variant-family mode: offer only base
 *          names whose `${base}_${step}` variants all exist (iconVariantBases);
 *          each flat entry then carries a `preview` name (the mid-step variant)
 *          while `value` stays the family base.
 * @returns {{activeSet: string, groups: Array<{set: string, names: string[]}>,
 *            flat: Array<{set: string, name: string, value: string, preview?: string}>}}
 *          value is the attribute value to store: bare for Material, set:name otherwise.
 */
export function iconPickerGroups({materialNames, sets, activeSet, query, cap = 90, variantSteps = null}) {
    const setNames = ['material', ...sets.keys()];
    let q = String(query || '').trim().toLowerCase();

    // Typing a "set:" prefix scopes the search to that set.
    const colon = q.indexOf(':');
    if (colon > -1 && setNames.includes(q.slice(0, colon))) {
        activeSet = q.slice(0, colon);
        q = q.slice(colon + 1);
    }
    if (activeSet !== 'all' && !setNames.includes(activeSet)) {
        activeSet = 'material';
    }

    const namesOf = set => set === 'material' ? materialNames : (sets.get(set)?.names ?? []);
    const listOf = set => variantSteps ? iconVariantBases(namesOf(set), variantSteps) : namesOf(set);
    const valueOf = (set, name) => set === 'material' ? name : `${set}:${name}`;
    const midStep = variantSteps ? variantSteps[Math.floor(variantSteps.length / 2)] : null;

    const groups = [];
    const flat = [];
    let left = cap;
    for (const set of (activeSet === 'all' ? setNames : [activeSet])) {
        if (left <= 0) break;
        const all = listOf(set);
        const names = (q ? all.filter(n => n.includes(q)) : all).slice(0, left);
        if (names.length === 0) continue;
        left -= names.length;
        groups.push({set, names});
        names.forEach(name => flat.push({
            set, name,
            value: valueOf(set, name),
            ...(variantSteps ? {preview: valueOf(set, `${name}_${midStep}`)} : {})
        }));
    }
    return {activeSet, groups, flat};
}

/**
 * feezal-sidebar-inspector-attributes — attribute editor for selected elements.
 */
class FeezalSidebarInspectorAttributes extends LitElement {
    static properties = {
        selectedElems:      {type: Array},
        items:              {type: Array},
        _completionIdx:     {state: true},  // item index with open completions (-1 = none)
        _completions:       {state: true},  // string[] — current completions
        _completionCursor:  {state: true},  // keyboard-navigation cursor in list
        _helpTip:           {state: true},  // custom tooltip: { text, x, y } | null
        _discoveryMatch:    {state: true},  // discovered entity matching a topic field | null
        _discoveryFilter:   {state: true},  // search text for the discovery picker
        _iconIdx:           {state: true},  // item index with open icon picker (-1 = none)
        _iconQuery:         {state: true},  // current search text in the icon picker
        _iconSet:           {state: true},  // N23: active set chip ('all' | 'material' | registered set)
        _iconCursor:        {state: true},  // N23: keyboard cursor in the icon grid (-1 = none)
        _collapsedSections: {state: true}   // U39: Set of collapsed section names
    };

    // U39: section names that start collapsed (boilerplate / rarely-touched).
    static DEFAULT_COLLAPSED_SECTIONS = new Set(['availability', 'advanced']);

    static styles = css`
        :host { display: block; margin: 12px; }
        .attr { display: inline-block; width: 100%; vertical-align: top; margin-bottom: 8px; }
        .attr.half { width: calc(50% - 4px); }
        sl-input, sl-textarea, sl-select { width: 100%; }
        /* Monospace for textarea (template content) */
        sl-textarea::part(textarea) { font-family: Consolas, monospace; font-size: 12px; }
        /* Invalid state */
        .attr.invalid sl-input::part(base),
        .attr.invalid sl-select::part(combobox),
        .attr.invalid sl-textarea::part(textarea) { border-color: #c62828; }
        /* Mixed state (multi-select, values differ across selection) */
        .attr.mixed sl-input::part(base),
        .attr.mixed sl-select::part(combobox),
        .attr.mixed sl-textarea::part(textarea) { opacity: 0.75; }
        /* Checkbox alignment */
        sl-checkbox { padding-top: 18px; }

        /* ── U39: structured inspector — sections + advanced disclosure ── */
        .attr-section { margin: 0 0 6px; border-top: 1px solid var(--feezal-border, #e3e3e3); }
        .attr-section:first-of-type { border-top: none; }
        .sec-header {
            display: flex; align-items: center; gap: 6px; cursor: pointer;
            padding: 8px 0 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
            text-transform: uppercase; color: var(--feezal-color, #555); user-select: none;
        }
        .sec-header:hover { color: var(--sl-color-primary-600, #0284c7); }
        .sec-caret { font-size: 10px; width: 10px; color: var(--feezal-color, #888); }
        .sec-body { padding-top: 2px; }
        details.adv-section { margin: 2px 0 6px; }
        details.adv-section > summary {
            cursor: pointer; font-size: 11px; color: var(--feezal-color, #777);
            padding: 4px 0; list-style: revert; user-select: none;
        }
        details.adv-section > summary:hover { color: var(--sl-color-primary-600, #0284c7); }
        details.adv-section[open] > summary { margin-bottom: 4px; }
        /* Dark mode: style Shoelace parts + checkbox via inherited CSS vars */
        sl-input::part(form-control-label), sl-textarea::part(form-control-label), sl-select::part(form-control-label) { color: var(--sl-input-label-color, inherit); font-size: 12px; }
        sl-checkbox { color: var(--feezal-color, inherit); }
        sl-input::part(base), sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        sl-textarea::part(textarea) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }

        /* ── Attribute help icon ────────────────────────────────────── */
        .label-with-help { display: inline-flex; align-items: center; gap: 3px; }
        .help-icon {
            display: inline-flex; align-items: center; justify-content: center;
            width: 13px; height: 13px;
            font-size: 10px; line-height: 1; font-style: italic;
            border-radius: 50%; border: 1px solid currentColor;
            color: var(--sl-color-primary-500, #0ea5e9);
            opacity: 0.75; cursor: default; user-select: none; flex-shrink: 0;
        }
        .help-icon:hover { opacity: 1; }
        .help-tip {
            position: fixed; z-index: 9999;
            background: #333; color: #fff;
            padding: 6px 10px; border-radius: 4px;
            font-size: 12px; max-width: 240px; line-height: 1.4;
            pointer-events: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transform: translate(-50%, calc(-100% - 8px));
        }

        /* ── MQTT topic autocomplete ───────────────────────────────── */
        .topic-wrap { position: relative; }
        .completions {
            position: absolute; top: 100%; left: 0; right: 0; z-index: 500;
            list-style: none; margin: 2px 0 0; padding: 4px 0;
            background: var(--feezal-bg, #fff); border: 1px solid var(--feezal-border, #ccc);
            border-radius: 4px; box-shadow: 0 4px 14px rgba(0,0,0,0.18);
            max-height: 180px; overflow-y: auto; font-size: 12px;
        }
        .completions li {
            padding: 4px 10px; cursor: pointer;
            color: var(--feezal-color, #333);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .completions li:hover, .completions li.active { background: var(--feezal-bg-sub, #f0f0f0); }
        /* ── Element help panel ────────────────────────────────────────────── */
        .help-section {
            margin-top: 16px; padding: 10px 12px;
            border: 1px solid var(--feezal-border, #ddd);
            border-radius: 6px; background: var(--feezal-bg-sub, #f8f8f8);
            font-size: 12px; color: var(--feezal-color, #555);
        }
        .help-section summary {
            cursor: pointer; font-weight: 600; font-size: 12px;
            color: var(--feezal-color, #333); list-style: none;
            display: flex; align-items: center; gap: 4px;
        }
        .help-section summary::before { content: '▶'; font-size: 9px; opacity: 0.6; }
        details[open] .help-section summary::before { content: '▼'; }
        .help-desc { margin-top: 8px; line-height: 1.5; }
        .help-links { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
        .help-links a { color: var(--sl-color-primary-600, #0284c7); text-decoration: none; }
        .help-links a:hover { text-decoration: underline; }
        /* ── Colour attribute ──────────────────────────────────────── */
        .color-wrap { display: flex; align-items: flex-end; gap: 4px; }
        .color-wrap sl-input { flex: 1; }
        .color-wrap input[type=color] {
            width: 36px; height: 32px; padding: 2px; flex-shrink: 0;
            border: 1px solid var(--feezal-border, #ccc); border-radius: 3px;
            cursor: pointer; background: var(--feezal-bg, #fff);
        }
        /* ── Icon attribute picker (N19) ───────────────────────────────── */
        .material-icons {
            font-family: 'Material Icons';
            font-weight: normal; font-style: normal;
            font-size: inherit; line-height: 1; letter-spacing: normal; text-transform: none;
            display: inline-block; white-space: nowrap; word-wrap: normal; direction: ltr;
            -webkit-font-feature-settings: 'liga'; font-feature-settings: 'liga';
            -webkit-font-smoothing: antialiased;
        }
        .icon-wrap { position: relative; }
        .icon-wrap sl-input span[slot=prefix] { font-size: 18px; opacity: 0.85; }
        .icon-wrap sl-input feezal-icon[slot=prefix] { font-size: 18px; opacity: 0.85; }
        .icon-pop {
            position: absolute; top: 100%; left: 0; right: 0; z-index: 9999;
            margin-top: 2px;
            background: var(--feezal-bg, #fff); border: 1px solid var(--feezal-border, #ccc);
            border-radius: 4px; box-shadow: 0 4px 14px rgba(0,0,0,.18);
            max-height: 260px; display: flex; flex-direction: column;
        }
        /* N23: set-chooser chip row above the grid */
        .icon-sets {
            display: flex; flex-wrap: wrap; gap: 4px; padding: 6px 6px 4px;
            border-bottom: 1px solid var(--feezal-border, #eee);
        }
        .icon-set-chip {
            border: 1px solid var(--feezal-border, #ccc); background: none;
            color: var(--feezal-color, #333); border-radius: 10px;
            font-size: 11px; padding: 2px 8px; cursor: pointer; line-height: 1.4;
        }
        .icon-set-chip:hover { border-color: var(--sl-color-primary-500, #0ea5e9); }
        .icon-set-chip.active {
            background: var(--sl-color-primary-600, #0284c7); border-color: var(--sl-color-primary-600, #0284c7);
            color: #fff;
        }
        .icon-grid {
            padding: 6px; overflow-y: auto;
            display: grid; grid-template-columns: repeat(auto-fill, minmax(34px, 1fr)); gap: 2px;
        }
        .icon-set-header {
            grid-column: 1 / -1; font-size: 10px; text-transform: uppercase;
            letter-spacing: 0.06em; opacity: 0.55; padding: 4px 2px 1px;
            color: var(--feezal-color, #333);
        }
        .icon-empty {
            padding: 10px 8px; font-size: 12px; opacity: 0.55; font-style: italic;
            color: var(--feezal-color, #333);
        }
        .icon-tile {
            display: flex; align-items: center; justify-content: center;
            width: 100%; height: 34px; border: none; background: none; cursor: pointer;
            border-radius: 4px; color: var(--feezal-color, #333);
        }
        .icon-tile:hover { background: var(--sl-color-primary-600, #0284c7); color: #fff; }
        .icon-tile.active { background: rgba(2,132,199,0.18); }
        .icon-tile.cursor { outline: 2px solid var(--sl-color-primary-500, #0ea5e9); outline-offset: -2px; }
        .icon-tile .material-icons, .icon-tile feezal-icon { font-size: 20px; }
        /* ── Auto-discovery banner (N12) ───────────────────────────────── */
        .discovery-banner {
            display: flex; align-items: center; gap: 6px;
            padding: 6px 10px; margin: 0 0 8px;
            background: var(--sl-color-warning-100, #fef3c7);
            border: 1px solid var(--sl-color-warning-400, #fbbf24);
            border-radius: 6px; font-size: 12px; line-height: 1.4;
            color: var(--feezal-color, #333);
        }
        .discovery-banner .disc-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .discovery-banner .disc-name { font-weight: 600; }
        .disc-apply {
            flex-shrink: 0; background: var(--sl-color-warning-500, #f59e0b); color: #fff;
            border: none; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 11px;
        }
        .disc-apply:hover { background: var(--sl-color-warning-600, #d97706); }
        .disc-dismiss {
            flex-shrink: 0; background: none; border: none; cursor: pointer;
            color: var(--feezal-color, #888); font-size: 14px; line-height: 1; padding: 0 2px;
        }
        /* ── Auto-discovery device picker (custom inspectors) ───────────── */
        .discovery-picker {
            display: flex; align-items: center; gap: 6px;
            padding: 6px 8px; margin: 0 0 10px;
            background: var(--feezal-bg-sub, #f5f5f5);
            border: 1px solid var(--feezal-border, #e0e0e0);
            border-radius: 6px;
        }
        .discovery-picker .dp-icon { color: var(--sl-color-warning-500, #f59e0b); font-size: 13px; flex-shrink: 0; }
        .discovery-picker .dp-select { flex: 1; min-width: 0; }
        .discovery-picker .dp-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        .discovery-picker .dp-clear {
            flex-shrink: 0; background: none; border: none; cursor: pointer;
            color: var(--feezal-color, #888); font-size: 13px; line-height: 1; padding: 0 2px;
        }
        .discovery-picker .dp-search-wrap {
            padding: 4px 6px; border-bottom: 1px solid var(--feezal-border, #e0e0e0);
            position: sticky; top: 0; background: var(--feezal-bg, #fff); z-index: 1;
        }
        .discovery-picker .dp-search {
            width: 100%; box-sizing: border-box; padding: 3px 7px; border-radius: 4px;
            border: 1px solid var(--feezal-border, #ccc); background: var(--feezal-bg, #fff);
            color: var(--feezal-color, #333); font-size: 12px; outline: none;
        }
        .discovery-picker .dp-search:focus { border-color: var(--sl-color-primary-500, #0ea5e9); }
    `;

    constructor() {
        super();
        this.selectedElems = [];
        this.items         = [];
        this._collapsedSections = new Set();
        this._completionIdx    = -1;
        this._completions      = [];
        this._completionCursor = -1;
        // Asset autocomplete (type:'asset') — lazily loaded, cached list.
        this._assetsLoaded = false;
        this._assetPaths   = [];
        this._completionTimer  = null;
        this._helpTip          = null;
        this._discoveryMatch   = null;
        this._discoveryFilter  = '';
        this.__discoveryEntities = []; // non-reactive cache
        this._iconIdx          = -1;
        this._iconQuery        = '';
        this._iconTimer        = null;
        this._iconSet          = localStorage.getItem('feezal-icon-set') || 'material';
        this._iconCursor       = -1;
    }

    connectedCallback() {
        super.connectedCallback();
        this._fetchDiscoveryEntities();
        // N23: re-render when an icon-set package registers after load.
        this._onIconSetsChanged = () => this.requestUpdate();
        document.addEventListener('feezal-iconsets-changed', this._onIconSetsChanged);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('feezal-iconsets-changed', this._onIconSetsChanged);
    }

    updated(changed) {
        if (changed.has('selectedElems')) {
            // U36: never let a pending debounced live-commit fire against a
            // different selection — the value belongs to the previous element.
            this._cancelLiveTimers();
            this._rebuildItems();
            this._fetchDiscoveryEntities(); // refresh device list for the picker/banner
            this._discoveryFilter = ''; // reset filter when selection changes
        }
        this._syncCustomInspector();
    }

    // ── U36: debounced live-apply while typing ────────────────────────────────
    // Free-text inputs commit to the element ~LIVE_APPLY_DEBOUNCE_MS after the
    // last keystroke (no history checkpoint — the canvas just updates live);
    // sl-change (blur/Enter) flushes immediately WITH a single history
    // checkpoint, so a typing burst is one undo step.

    _liveChange(value, idx) {
        // U44: the × clear already removed the attribute — swallow the empty
        // sl-input Shoelace emits right after sl-clear, or the debounced
        // commit would re-create the attribute as an empty string.
        if (this._clearGuard === idx && value === '') return;
        this._liveTimers ??= {};
        clearTimeout(this._liveTimers[idx]);
        this._liveTimers[idx] = setTimeout(() => {
            delete this._liveTimers[idx];
            this._change(value, idx, false);
        }, LIVE_APPLY_DEBOUNCE_MS);
    }

    /**
     * U44: × clear — remove the attribute entirely (back to the descriptor
     * default) instead of writing an empty string; the default placeholder
     * takes over again. Routed through the normal dirty pipeline (one undo
     * step). Shoelace's clear click ALSO emits sl-input + sl-change with ''
     * — a one-tick guard swallows those so they can't undo the removal,
     * while deliberate "explicit empty" edits (select-all + delete) keep
     * their existing setAttribute('') semantics.
     */
    _clearAttr(idx) {
        if (this._liveTimers) {
            clearTimeout(this._liveTimers[idx]);
            delete this._liveTimers[idx];
        }
        const item = this.items[idx];
        const htmlAttr = this._toKebab(item.attrName || item.label);
        feezal.editor.selectedElems.forEach(el => el.removeAttribute(htmlAttr));
        this.items = this.items.map((it, i) => i === idx ? {...it, value: '', invalid: false, mixed: false} : it);
        this._clearGuard = idx;
        setTimeout(() => { if (this._clearGuard === idx) this._clearGuard = null; }, 0);
        feezal.app.change();
    }

    _flushChange(value, idx) {
        if (this._liveTimers) {
            clearTimeout(this._liveTimers[idx]);
            delete this._liveTimers[idx];
        }

        this._change(value, idx, true);
    }

    _cancelLiveTimers() {
        for (const t of Object.values(this._liveTimers || {})) clearTimeout(t);
        this._liveTimers = {};
    }

    render() {
        // Resolve help text from the selected element's feezal descriptor.
        const el = this.selectedElems?.[0];
        const tagName = el?.name ? 'feezal-view' : el?.localName;
        const cls = tagName ? window.customElements.get(tagName) : null;
        const feezalInfo = cls?.feezal;
        const customInspector = feezalInfo?.inspector;

        // ── Custom inspector (N6) ──────────────────────────────────────────
        // When the selected element declares feezal().inspector, render a host
        // container. The actual custom element is injected imperatively in
        // _syncCustomInspector() after the DOM update.
        if (customInspector && this.selectedElems?.length === 1) {
            return html`
                ${this._renderDiscoveryPicker()}
                <div id="custom-inspector-host"
                    @feezal-attribute-changed="${this._onCustomAttrChanged}">
                </div>
                ${this._helpTip ? html`<div class="help-tip" style="left:${this._helpTip.x}px;top:${this._helpTip.y}px">${this._helpTip.text}</div>` : ''}
            `;
        }

        // ── Standard attribute form ────────────────────────────────────────
        const desc = feezalInfo?.description;
        const links = feezalInfo?.links;
        const hasHelp = desc || (links && links.length > 0);
        return html`
            ${this._renderDiscoveryPicker()}
            ${this._discoveryMatch ? html`
                <div class="discovery-banner">
                    <span class="disc-label">⚡ <span class="disc-name">${this._discoveryMatch.name}</span> detected</span>
                    <button class="disc-apply" @click="${this._onAutoConfig}">Auto-configure</button>
                    <button class="disc-dismiss" title="Dismiss" @click="${() => { this._discoveryMatch = null; }}">&#x2715;</button>
                </div>
            ` : ''}
            ${this._visibleGroups().map(g => this._renderGroup(g))}
            ${hasHelp ? html`
                <details class="help-section">
                    <summary>Help</summary>
                    ${desc ? html`<div class="help-desc">${desc}</div>` : ''}
                    ${links && links.length ? html`
                        <div class="help-links">
                            ${links.map(l => html`<a href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`)}
                        </div>
                    ` : ''}
                </details>
            ` : ''}
        ${this._helpTip ? html`<div class="help-tip" style="left:${this._helpTip.x}px;top:${this._helpTip.y}px">${this._helpTip.text}</div>` : ''}
        `;
    }

    /** U39: one attribute field. */
    _renderAttr(item, idx) {
        return html`
            <div class="attr ${item.half ? 'half' : ''} ${item.invalid ? 'invalid' : ''} ${item.mixed ? 'mixed' : ''}">
                ${this._renderInput(item, idx)}
            </div>`;
    }

    /** U39: render one section group — header-less for the section-less leading group. */
    _renderGroup(g) {
        const advanced = g.advanced.length
            ? html`<details class="adv-section"><summary>Advanced</summary>
                    ${g.advanced.map(({item, idx}) => this._renderAttr(item, idx))}
                </details>`
            : '';
        if (!g.section) {
            return html`${g.main.map(({item, idx}) => this._renderAttr(item, idx))}${advanced}`;
        }
        const collapsed = this._collapsedSections.has(g.section.toLowerCase());
        return html`
            <div class="attr-section">
                <div class="sec-header" @click="${() => this._toggleSection(g.section.toLowerCase())}">
                    <span class="sec-caret">${collapsed ? '▸' : '▾'}</span>${g.section}
                </div>
                ${collapsed ? '' : html`
                    <div class="sec-body">
                        ${g.main.map(({item, idx}) => this._renderAttr(item, idx))}
                        ${advanced}
                    </div>`}
            </div>`;
    }

    // ── Custom inspector sync (N6) ────────────────────────────────────────
    // Called after every render. Creates or updates the custom inspector
    // element inside #custom-inspector-host if one is required.
    _syncCustomInspector() {
        const host = this.shadowRoot?.querySelector('#custom-inspector-host');
        if (!host) return;

        const el = this.selectedElems?.[0];
        if (!el) { host.innerHTML = ''; return; }

        // If the same custom inspector is already attached to this element, do nothing.
        const existing = host.firstElementChild;
        if (existing && existing.element === el) return;

        const tagName = el.name ? 'feezal-view' : el.localName;
        const inspectorTag = window.customElements.get(tagName)?.feezal?.inspector;
        if (!inspectorTag) { host.innerHTML = ''; return; }

        host.innerHTML = '';
        const inspectorEl = document.createElement(inspectorTag);
        inspectorEl.element = el;
        host.appendChild(inspectorEl);
    }

    // Handles feezal-attribute-changed events dispatched by custom inspectors.
    _onCustomAttrChanged(e) {
        const {name, value} = e.detail || {};
        if (!name) return;
        this.selectedElems.forEach(element => {
            // Look up the descriptor so a default-true boolean persists an
            // explicit "false" when OFF (custom inspectors emit `checked || null`,
            // so `null`/`false` both mean off here).
            const spec = window.customElements.get(element.localName)?.feezal?.attributes
                ?.find(a => (typeof a === 'string' ? a : a.name) === name);
            if (spec && typeof spec === 'object' && spec.type === 'boolean') {
                const on = value === true;
                if (Boolean(spec.default)) {
                    element.setAttribute(name, on ? 'true' : 'false');
                } else if (on) {
                    element.setAttribute(name, 'true');
                } else {
                    element.removeAttribute(name);
                }
            } else if (value === null || value === undefined) {
                element.removeAttribute(name);
            } else if (typeof value === 'boolean') {
                if (value) element.setAttribute(name, '');
                else element.removeAttribute(name);
            } else if (typeof value === 'object') {
                element.setAttribute(name, JSON.stringify(value));
            } else {
                element.setAttribute(name, String(value));
            }
        });
        feezal.app.change();
        e.stopPropagation();
    }

    // ── Help-icon label slot ──────────────────────────────────────────────────
    _labelTpl(label, help) {
        if (!help) return '';
        return html`<span slot="label" class="label-with-help">${label}<span class="help-icon" @mouseenter="${e => this._showHelp(e, help)}" @mouseleave="${() => this._hideHelp()}">i</span></span>`;
    }

    _showHelp(e, text) {
        const rect = e.currentTarget.getBoundingClientRect();
        this._helpTip = { text, x: rect.left + rect.width / 2, y: rect.top };
    }

    _hideHelp() {
        this._helpTip = null;
    }

    /**
     * WP3/E106 platform hook — render a `type:'custom'` descriptor's component.
     * The registered `<component>` tag is rendered with lit-html static
     * interpolation (the tag is data-driven, so `unsafeStatic`/`staticHtml`),
     * gets the selected element via `.element`, and has its N6
     * `feezal-attribute-changed` events routed through _onCustomAttrChanged —
     * the identical dirty+undo commit path used by whole-element N6 inspectors.
     * No label row is rendered: the component owns its entire UI. Only single
     * selection reaches here (multi-select custom items are dropped upstream).
     */
    _renderCustom(item) {
        const el = this.selectedElems?.[0] || null;
        const tag = unsafeStatic(item.component);
        return staticHtml`
            <${tag} .element="${el}"
                @feezal-attribute-changed="${this._onCustomAttrChanged}"></${tag}>`;
    }

    _renderInput(item, idx) {
        if (item.custom) return this._renderCustom(item);
        const {elem, label, value, mixed} = item;
        const labelSlot = this._labelTpl(label, elem.help);
        const labelAttr = elem.help ? '' : label;

        if (elem.list) {
            // U35: objectList / list attributes — the raw JSON attribute string
            // is the single source of truth; the control emits the items array
            // (serialized back to JSON by _change) or the raw string when the
            // current value is unparseable (fallback mode).
            return html`
                <feezal-editable-list
                    label="${label}"
                    .value="${mixed ? '' : (value ?? '')}"
                    .fields="${elem.itemFields}"
                    @value-changed="${e => this._change(e.detail.value, idx, true)}">
                </feezal-editable-list>
            `;
        }

        if (elem.dropdown) {
            // Show the default option when the attribute is unset (a select
            // can't show a greyed placeholder), so the effective value is visible.
            // U44: × only while the attribute is EXPLICITLY set — the select
            // always displays an effective value, so Shoelace's own "when
            // non-empty" rule would show × permanently.
            // B50: a descriptor with `emptyOption` gets an explicit "(default)"
            // entry (Shoelace options need a non-empty value → sentinel) —
            // picking it removes the attribute like the × clear, and it shows
            // as selected while the attribute is unset.
            const EMPTY = '__feezal-empty__';
            const hasEmpty = item.emptyOption != null;
            const selValue = mixed ? '' : (value || (hasEmpty ? EMPTY : (item.default ?? '')));
            return html`
                <sl-select .label="${labelAttr}" size="small" .value="${selValue}"
                    ?clearable="${!mixed && value != null && value !== ''}"
                    @sl-clear="${() => this._clearAttr(idx)}"
                    @sl-change="${e => {
                        if (hasEmpty && e.target.value === EMPTY) {
                            if (value != null && value !== '') this._clearAttr(idx);
                        } else {
                            this._change(e.target.value, idx, true);
                        }
                    }}">
                    ${labelSlot}
                    ${hasEmpty ? html`<sl-option value="${EMPTY}">${item.emptyOption}</sl-option>` : ''}
                    ${(elem.options || []).map(opt => html`
                        <sl-option value="${opt}">${opt}</sl-option>
                    `)}
                </sl-select>
            `;
        }

        if (elem.textarea) {
            // If the attribute has editor:true, use the Monaco-backed template editor.
            if (elem.editor) {
                return html`
                    <feezal-template-editor
                        .label="${label}"
                        .value="${mixed ? '' : (value || '')}"
                        .variables="${elem.variables || ['msg']}"
                        .darkMode="${window.feezal?.app?._darkMode ?? false}"
                        @feezal-change="${e => this._change(e.detail.value, idx, true)}">
                    </feezal-template-editor>
                `;
            }
            return html`
                <sl-textarea .label="${labelAttr}" size="small" rows="6"
                    autocomplete="off"
                    .value="${mixed ? '' : (value || '')}"
                    placeholder="${mixed ? '— varies —' : ''}"
                    @sl-input="${e => this._liveChange(e.target.value, idx)}"
                    @sl-change="${e => this._flushChange(e.target.value, idx)}">
                    ${labelSlot}
                </sl-textarea>
            `;
        }

        if (elem.checkbox) {
            return html`
                <sl-checkbox size="small" .checked="${Boolean(value)}"
                    ?indeterminate="${mixed}"
                    @sl-change="${e => this._change(e.target.checked, idx, true)}">
                    ${label}${elem.help ? html` <span class="help-icon" @mouseenter="${e => this._showHelp(e, elem.help)}" @mouseleave="${() => this._hideHelp()}">i</span>` : ''}
                </sl-checkbox>
            `;
        }

        if (elem.color) {
            return html`
                <div class="color-wrap">
                    <sl-input .label="${labelAttr}" size="small"
                        autocomplete="off" clearable
                        .value="${mixed ? '' : (value ?? '')}"
                        placeholder="${mixed ? '— varies —' : ''}"
                        @sl-clear="${() => this._clearAttr(idx)}"
                        @sl-input="${e => this._liveChange(e.target.value, idx)}"
                        @sl-change="${e => this._flushChange(e.target.value, idx)}">
                        ${labelSlot}
                    </sl-input>
                    <input type="color"
                        title="Pick colour"
                        .value="${this._toCssColorHex(mixed ? '' : value)}"
                        @input="${e => this._change(e.target.value, idx, true)}">
                </div>
            `;
        }

        if (elem.icon) {
            const open = this._iconIdx === idx;
            const registered = [...iconSets().keys()];
            const multiSet = registered.length > 0;
            const variantSteps = elem.iconVariants || null;

            // Variant-family mode (e.g. basic-icon-value): only sets that
            // actually contain complete families get a chip, and the
            // persisted chip falls back to the first set that qualifies.
            const namesOfSet = set => set === 'material' ? MATERIAL_ICONS : (iconSets().get(set)?.names ?? []);
            const eligibleSets = variantSteps && open
                ? ['material', ...registered].filter(set => iconVariantBases(namesOfSet(set), variantSteps).length > 0)
                : ['material', ...registered];
            let wantedSet = multiSet ? this._iconSet : 'material';
            if (variantSteps && wantedSet !== 'all' && !eligibleSets.includes(wantedSet)) {
                wantedSet = eligibleSets[0] ?? 'all';
            }

            const {activeSet, groups, flat} = open
                ? iconPickerGroups({
                    materialNames: MATERIAL_ICONS,
                    sets: iconSets(),
                    activeSet: wantedSet,
                    query: this._iconQuery,
                    variantSteps
                })
                : {activeSet: this._iconSet, groups: [], flat: []};
            const chips = multiSet ? ['all', ...eligibleSets] : [];
            let tileIndex = -1;
            return html`
                <div class="icon-wrap">
                    <sl-input .label="${labelAttr}" size="small"
                        autocomplete="off"
                        .value="${mixed ? '' : (value ?? '')}"
                        placeholder="${mixed ? '— varies —' : 'icon name'}"
                        @sl-focus="${() => this._openIconPicker(idx, value)}"
                        @sl-input="${e => { this._iconQuery = e.target.value; this._iconIdx = idx; this._iconCursor = -1; }}"
                        @sl-blur="${() => this._scheduleCloseIcon(idx)}"
                        @sl-change="${e => this._change(e.target.value, idx, true)}"
                        @keydown="${e => this._iconKeydown(e, idx, flat)}">
                        ${labelSlot}
                        ${value && !mixed ? html`<feezal-icon slot="prefix" name="${value}"></feezal-icon>` : ''}
                    </sl-input>
                    ${open && (groups.length || chips.length) ? html`
                        <div class="icon-pop" @mousedown="${e => e.preventDefault()}">
                            ${chips.length ? html`
                                <div class="icon-sets">
                                    ${chips.map(set => html`
                                        <button class="icon-set-chip ${set === activeSet ? 'active' : ''}"
                                            @click="${() => this._selectIconSet(set)}">${set === 'all' ? 'All' : set}</button>
                                    `)}
                                </div>
                            ` : ''}
                            ${groups.length === 0 ? html`
                                <div class="icon-empty">no matching icons</div>
                            ` : ''}
                            <div class="icon-grid">
                                ${groups.map(group => html`
                                    ${activeSet === 'all' && chips.length ? html`
                                        <div class="icon-set-header">${group.set}</div>
                                    ` : ''}
                                    ${group.names.map(() => {
                                        tileIndex++;
                                        const entry = flat[tileIndex];
                                        const isCursor = tileIndex === this._iconCursor;
                                        return html`
                                            <button class="icon-tile ${entry.value === value ? 'active' : ''} ${isCursor ? 'cursor' : ''}"
                                                title="${entry.value}"
                                                @click="${() => this._selectIcon(entry.value, idx)}">
                                                ${group.set === 'material' && !entry.preview
                                                    ? html`<span class="material-icons">${entry.name}</span>`
                                                    : html`<feezal-icon name="${entry.preview ?? entry.value}"></feezal-icon>`}
                                            </button>
                                        `;
                                    })}
                                `)}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        if (elem.mqttTopic) {
            return html`
                <div class="topic-wrap">
                    <sl-input .label="${labelAttr}" size="small"
                        autocomplete="off" clearable
                        .value="${mixed ? '' : (value ?? '')}"
                        placeholder="${mixed ? '— varies —' : ''}"
                        @sl-clear="${() => this._clearAttr(idx)}"
                        @sl-focus="${e => this._onTopicInput(e.target.value, idx)}"
                        @sl-input="${e => { this._onTopicInput(e.target.value, idx); this._liveChange(e.target.value, idx); }}"
                        @sl-blur="${() => this._scheduleCloseCompletions(idx)}"
                        @sl-change="${e => this._flushChange(e.target.value, idx)}"
                        @keydown="${e => this._onTopicKeydown(e, idx)}">
                        ${labelSlot}
                    </sl-input>
                    ${this._completionIdx === idx && this._completions.length ? html`
                        <ul class="completions">
                            ${this._completions.map((c, ci) => html`
                                <li class="${ci === this._completionCursor ? 'active' : ''}"
                                    @mousedown="${e => { e.preventDefault(); this._selectCompletion(c, idx); }}">
                                    ${c}
                                </li>
                            `)}
                        </ul>
                    ` : ''}
                </div>
            `;
        }

        if (elem.asset) {
            // Asset picker — reuses the mqtt-topic completion UI, but the
            // completions come from the site's assets (filtered by `accept`).
            return html`
                <div class="topic-wrap">
                    <sl-input .label="${labelAttr}" size="small"
                        autocomplete="off" clearable
                        .value="${mixed ? '' : (value ?? '')}"
                        placeholder="${mixed ? '— varies —' : (item.default != null ? String(item.default) : '')}"
                        @sl-clear="${() => this._clearAttr(idx)}"
                        @sl-focus="${e => this._onAssetInput(e.target.value, idx, elem.accept)}"
                        @sl-input="${e => { this._onAssetInput(e.target.value, idx, elem.accept); this._liveChange(e.target.value, idx); }}"
                        @sl-blur="${() => this._scheduleCloseCompletions(idx)}"
                        @sl-change="${e => this._flushChange(e.target.value, idx)}"
                        @keydown="${e => this._onTopicKeydown(e, idx)}">
                        ${labelSlot}
                    </sl-input>
                    ${this._completionIdx === idx && this._completions.length ? html`
                        <ul class="completions">
                            ${this._completions.map((c, ci) => html`
                                <li class="${ci === this._completionCursor ? 'active' : ''}"
                                    @mousedown="${e => { e.preventDefault(); this._selectCompletion(c, idx); }}">
                                    ${c}
                                </li>
                            `)}
                        </ul>
                    ` : ''}
                </div>
            `;
        }

        // Default: text / number input — an unset field shows the default as a
        // greyed placeholder so the effective value is visible. U44: × clears
        // back to that default (Shoelace shows it only while non-empty, which
        // is exactly "explicitly set" here).
        return html`
            <sl-input .label="${labelAttr}" size="small"
                type="${elem.inputType || 'text'}"
                autocomplete="off" clearable
                title="${elem.tooltip || ''}"
                .value="${mixed ? '' : (value ?? '')}"
                placeholder="${mixed ? '— varies —' : (item.default != null ? String(item.default) : '')}"
                min="${elem.min ?? ''}" max="${elem.max ?? ''}" step="${elem.step ?? ''}"
                @sl-clear="${() => this._clearAttr(idx)}"
                @sl-input="${e => this._liveChange(e.target.value, idx)}"
                @sl-change="${e => this._flushChange(e.target.value, idx)}">
                ${labelSlot}
            </sl-input>
        `;
    }

    // Convert camelCase property names to kebab-case HTML attribute names.
    // Polymer observes 'subscribe', not 'subscribe'.
    // Lit uses the same convention unless overridden with the attribute: option.
    _toKebab(name) {
        return name.replace(/([A-Z])/g, c => '-' + c.toLowerCase());
    }

    // ── Color helper ──────────────────────────────────────────────────────────
    _toCssColorHex(value) {
        if (!value) return '#000000';
        if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
        if (/^#[0-9a-fA-F]{3}$/.test(value)) {
            const [, r, g, b] = value.match(/^#(.)(.)(.)$/);
            return `#${r}${r}${g}${g}${b}${b}`;
        }
        // Try rgb()/rgba()
        const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('');
        return '#000000';
    }

    // ── MQTT topic autocomplete ───────────────────────────────────────────────
    _onTopicInput(prefix, idx) {
        console.debug('[feezal:mqtt-ac] topic input idx=' + idx, JSON.stringify(prefix));
        if (this._completionTimer) clearTimeout(this._completionTimer);
        this._completionTimer = setTimeout(() => this._fetchCompletions(prefix, idx), 150);
    }

    async _fetchCompletions(prefix, idx) {
        try {
            const r = await fetch(`/api/topics/completions?prefix=${encodeURIComponent(prefix)}`);
            if (!r.ok) { this._completions = []; return; }
            const {completions} = await r.json();
            this._completionIdx    = idx;
            this._completionCursor = -1;
            this._completions      = completions || [];
        } catch {
            this._completions = [];
        }
    }

    _onTopicKeydown(e, idx) {
        if (this._completionIdx !== idx || !this._completions.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this._completionCursor = Math.min(this._completionCursor + 1, this._completions.length - 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this._completionCursor = Math.max(this._completionCursor - 1, -1);
        } else if (e.key === 'Enter' && this._completionCursor >= 0) {
            e.preventDefault();
            this._selectCompletion(this._completions[this._completionCursor], idx);
        } else if (e.key === 'Escape' || e.key === 'Tab') {
            this._completionIdx    = -1;
            this._completions      = [];
            this._completionCursor = -1;
        }
    }

    _selectCompletion(val, idx) {
        if (val.endsWith('/')) {
            // Descend into next level and stay open — intermediate state.
            this._change(val, idx, false);
            this._fetchCompletions(val, idx);
        } else {
            // A picked completion is a definitive commit (U36: flush).
            this._flushChange(val, idx);
            this._completionIdx    = -1;
            this._completions      = [];
            this._completionCursor = -1;
        }
    }

    _scheduleCloseCompletions(idx) {
        setTimeout(() => {
            if (this._completionIdx === idx) {
                this._completionIdx    = -1;
                this._completions      = [];
                this._completionCursor = -1;
            }
        }, 200);
    }

    // ── Asset autocomplete (type:'asset') ──────────────────────────────────────
    // Fetches the site's assets once, then reuses the mqtt-completion UI/keyboard
    // handling to suggest asset paths (as /assets/<site>/<path> URLs — the same
    // value the drag-to-canvas creates).
    async _ensureAssets() {
        if (this._assetsLoaded) return;
        this._assetsLoaded = true;
        const site = (typeof feezal !== 'undefined' && feezal.siteName) || 'default';
        try {
            const r = await fetch(`/api/assets/${encodeURIComponent(site)}`);
            if (!r.ok) return;
            const data = await r.json();
            const siteVals   = (data.site   || []).map(f => `/assets/${site}/${f.path}`);
            const globalVals = (data.global || []).map(f => `/assets/global/${f.path}`);
            this._assetPaths = [...siteVals, ...globalVals].sort();
        } catch { /* offline / no assets — autocomplete stays empty */ }
    }

    async _onAssetInput(prefix, idx, accept) {
        await this._ensureAssets();
        const exts = Array.isArray(accept) ? accept.map(x => String(x).toLowerCase()) : null;
        const p = String(prefix || '').toLowerCase();
        this._completions = (this._assetPaths || [])
            .filter(path => !exts || exts.includes((path.split('.').pop() || '').toLowerCase()))
            .filter(path => !p || path.toLowerCase().includes(p))
            .slice(0, 50);
        this._completionIdx    = idx;
        this._completionCursor = -1;
    }

    // ── Icon picker (N19) ──────────────────────────────────────────────────────
    _openIconPicker(idx, value) {
        this._iconIdx   = idx;
        this._iconQuery = value || '';
    }

    _selectIcon(name, idx) {
        clearTimeout(this._iconTimer);
        this._iconIdx    = -1;
        this._iconQuery  = '';
        this._iconCursor = -1;
        this._change(name, idx, true);
    }

    /** N23: switch the active set chip; persisted so the popup reopens on it. */
    _selectIconSet(set) {
        this._iconSet = set;
        this._iconCursor = -1;
        try {
            localStorage.setItem('feezal-icon-set', set);
        } catch { /* quota — non-fatal */ }
    }

    /** N23: keyboard navigation in the icon grid (cursor + Enter/Escape). */
    _iconKeydown(e, idx, flat) {
        if (this._iconIdx !== idx || flat.length === 0) return;
        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
                this._iconCursor = Math.min(this._iconCursor + 1, flat.length - 1);
                e.preventDefault();
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                this._iconCursor = Math.max(this._iconCursor - 1, -1);
                e.preventDefault();
                break;
            case 'Enter':
                if (this._iconCursor >= 0 && flat[this._iconCursor]) {
                    this._selectIcon(flat[this._iconCursor].value, idx);
                    e.preventDefault();
                    e.stopPropagation();
                }
                break;
            case 'Escape':
                this._iconIdx = -1;
                this._iconCursor = -1;
                e.stopPropagation();
                break;
        }
    }

    _scheduleCloseIcon(idx) {
        clearTimeout(this._iconTimer);
        this._iconTimer = setTimeout(() => {
            if (this._iconIdx === idx) this._iconIdx = -1;
        }, 150);
    }

    _change(newValue, idx, applyImmediately) {
        // U44: swallow the empty sl-change Shoelace emits right after sl-clear
        // (see _clearAttr) — the attribute was already removed.
        if (this._clearGuard === idx && (newValue === '' || newValue == null)) return;
        const item  = this.items[idx];
        const attr  = item.attrName || item.label;  // attrName for attribute ops, label as fallback
        let invalid = false;

        feezal.editor.selectedElems.forEach(element => {
            const elementClass = window.customElements.get(element.localName);
            if (!elementClass || !elementClass.feezal) {
                return;
            }

            const attrOptions = elementClass.feezal.attributes.find(a => (typeof a === 'string' ? a : a.name) === attr);
            if (attrOptions && attrOptions.validator && !attrOptions.validator(newValue)) {
                invalid = true;
                return;
            }

            if (typeof newValue === 'boolean') {
                const htmlAttr = this._toKebab(attr);
                const boolDefault = attrOptions && typeof attrOptions === 'object' ? Boolean(attrOptions.default) : false;
                if (boolDefault) {
                    // Default-true booleans must persist an explicit "false" when
                    // switched OFF — a plain removeAttribute serialises as absent
                    // = back to the default (needs the feezalBoolean converter on
                    // the element to read the "false"). ON writes explicit "true".
                    element.setAttribute(htmlAttr, newValue ? 'true' : 'false');
                } else if (newValue) {
                    element.setAttribute(htmlAttr, 'true');
                } else {
                    element.removeAttribute(htmlAttr);
                }
            } else if (typeof newValue === 'object') {
                element.setAttribute(this._toKebab(attr), JSON.stringify(newValue));
            } else {
                if (attrOptions && attrOptions.template) {
                    let template = element.querySelector('template');
                    if (!template) {
                        template = document.createElement('template');
                        element.append(template);
                    }

                    template.innerHTML = newValue;

                    // Force a preview render in the editor. The Polymer _msgChanged
                    // observer returns early when msg is empty ({}), so nothing shows
                    // unless we give it at least a non-empty object to work with.
                    if (feezal.isEditor && element._msgChanged) {
                        element._processTemplate = null; // force template fn rebuild
                        if (!element.msg || !Object.keys(element.msg).length) {
                            element.msg = {_feezalPreview: true};
                        } else {
                            element._msgChanged();
                        }
                    }
                } else {
                    element.setAttribute(this._toKebab(attr), newValue);
                }
            }
        });

        // Apply interact side effects when the locked attribute is toggled via the inspector
        if (attr === 'locked' && feezal.editor) {
            feezal.editor.selectedElems.forEach(el => feezal.editor.setLocked(el, newValue));
        }

        // U35 fix: object values (list-editor arrays) are written to the
        // attribute as JSON — keep item.value aligned with the attribute
        // string, otherwise the re-render feeds the array to String-typed
        // controls ("[object Object],…" + fallback UI).
        const itemValue = (typeof newValue === 'object' && newValue !== null)
            ? JSON.stringify(newValue)
            : newValue;
        this.items = this.items.map((it, i) => i === idx ? {...it, value: itemValue, invalid, mixed: false} : it);

        if (applyImmediately && !invalid) {
            feezal.app.change();
        }

        // Check for a discovery match when a MQTT topic field is committed
        if (item?.elem?.mqttTopic && typeof newValue === 'string' && newValue && !newValue.endsWith('/')) {
            this._checkDiscovery(newValue);
        }
    }

    _blur(e, idx) {
        const item = this.items[idx];
        if (item && item.hasChange) {
            feezal.app.change();
        }
    }

    _rebuildItems() {
        if (!this.selectedElems || this.selectedElems.length === 0) {
            this.items = [];
            return;
        }

        const el = this.selectedElems[0];

        // U32: component instances — the inspector is driven by the template's
        // feezal-params metadata, not by class metadata. Stamped children are
        // never editable here (strict no-override; divergence = Detach).
        if (el.localName === 'feezal-component') {
            this._rebuildComponentItems(el);
            return;
        }

        const tagName = el.name ? 'feezal-view' : el.localName;
        const cls = window.customElements.get(tagName);
        if (!cls || !cls.feezal || !cls.feezal.attributes) {
            this.items = [];
            return;
        }

        // If the element declares a custom inspector (N6), skip the standard
        // attribute form entirely — the inspector handles its own UI.
        if (cls.feezal.inspector && this.selectedElems.length === 1) {
            this.items = [];
            return;
        }

        // For multi-select: only show attributes present on ALL selected elements.
        // Use the first element's spec for control types, options, etc.
        const allAttrs = cls.feezal.attributes;
        const filteredAttrs = this.selectedElems.length === 1 ? allAttrs : allAttrs.filter(attr => {
            const name = typeof attr === 'string' ? attr : attr.name;
            return this.selectedElems.every(e => {
                const eName = e.name ? 'feezal-view' : e.localName;
                const eCls = window.customElements.get(eName);
                return eCls?.feezal?.attributes?.some(a => (typeof a === 'string' ? a : a.name) === name);
            });
        });

        const viewNames = feezal.views ? [...feezal.views].map(v => v.getAttribute('name')) : [];

        this.items = filteredAttrs.map(attr => {
            // Attributes may be plain strings ('subscribe') or objects
            // ({name: 'min', size: 'half', dropdown: [...], ...}).
            const attrName = typeof attr === 'string' ? attr : attr.name;
            const attrSpec = typeof attr === 'string' ? {} : attr;

            // WP3/E106 platform hook: a `type:'custom'` descriptor hosts a
            // registered component (`component:'<tag>'`) inside the structured
            // inspector instead of a labelled control. The component receives
            // the selected element as `.element` and emits N6-style
            // `feezal-attribute-changed` events, which are routed through the
            // SAME dirty+undo commit path (_onCustomAttrChanged) that the
            // whole-element N6 inspectors use. A custom entry lives in its
            // `section` and honours `advanced`/`visibleWhen` like any other.
            // Multi-select: dropped (returns null → filtered out below), because
            // the component is authored around a single element — mirroring N6
            // custom inspectors, which only render for a single selection.
            if (attrSpec.type === 'custom') {
                if (this.selectedElems.length !== 1) return null;
                return {
                    label:       attrName || attrSpec.component,
                    attrName:    attrName || attrSpec.component,
                    custom:      true,
                    component:   attrSpec.component,
                    value:       null,
                    mixed:       false,
                    half:        false,
                    invalid:     false,
                    section:     attrSpec.section || '',
                    advanced:    Boolean(attrSpec.advanced),
                    visibleWhen: attrSpec.visibleWhen || null,
                    default:     undefined,
                    elem:        {custom: true}
                };
            }

            // Support both legacy {dropdown: [...]} and new {type:'select', options:[...]} formats.
            const options = attrSpec.dropdown === 'views'
                ? viewNames
                : (attrSpec.dropdown ||
                   (attrSpec.type === 'select' && attrSpec.options ? attrSpec.options : null));
            const half = ['top', 'left', 'width', 'height'].includes(attrName) || attrSpec.size === 'half';

            // ── Smart control auto-detection ──────────────────────────────
            // 0. U35: object/string list — explicit {type:'objectList'} (or the
            //    legacy {list:true}) renders the generic list editor.
            const isList = attrSpec.type === 'objectList' || Boolean(attrSpec.list);
            // 1. Boolean: explicit in spec ({checkbox:true} or {type:'boolean'}) OR Lit property
            //    Lit elementProperties uses camelCase keys → also check via cls.properties
            const litProp = cls.elementProperties?.get(attrName) ?? cls.properties?.[attrName];
            const isBool = Boolean(attrSpec.checkbox) || attrSpec.type === 'boolean'
                || (litProp?.type === Boolean);
            // 2. Color: explicit {type:'color'} OR name contains "color"
            const isColor = !isBool && !options && !attrSpec.textarea && !isList
                && (attrSpec.type === 'color' || attrName.toLowerCase().includes('color'));
            // 3. MQTT topic: explicit type, or name contains "topic", or the standard subscribe/publish attrs
            const isTopic = !isBool && !isColor && !options && !attrSpec.textarea && !isList
                && (attrSpec.type === 'mqttTopic'
                    || attrName.toLowerCase().includes('topic')
                    || attrName === 'subscribe' || attrName === 'publish');
            // 4. Icon: explicit ({type:'icon'} / {iconPicker:true}) OR any attribute named icon* (N19)
            const isIcon = !isBool && !isColor && !isTopic && !options && !attrSpec.textarea && !isList
                && (attrSpec.iconPicker || attrSpec.type === 'icon' || /^icon(-|$)/i.test(attrName));
            // 5. Asset picker: explicit {type:'asset'} autocompletes the site's
            //    assets, optionally filtered by {accept:['json', …]} extensions.
            const isAsset = !isBool && !isColor && !isTopic && !isIcon && !options
                && !attrSpec.textarea && !isList && attrSpec.type === 'asset';

            // Read value from ALL selected elements and detect mixed state.
            const vals = this.selectedElems.map(e => {
                if (attrSpec.template) return e.querySelector('template')?.innerHTML ?? '';
                const rawAttr = e.getAttribute(this._toKebab(attrName)) ?? e.getAttribute(attrName) ?? null;
                // Boolean: an ABSENT attribute means the descriptor default (so a
                // default-true boolean shows checked); "false"/"0" means off.
                return isBool
                    ? (rawAttr === null ? Boolean(attrSpec.default) : (rawAttr !== 'false' && rawAttr !== '0'))
                    : (rawAttr ?? '');
            });
            const mixed = this.selectedElems.length > 1 && vals.some(v => v !== vals[0]);
            const value = mixed ? (isBool ? false : null) : vals[0];

            // Derive display type for plain text/number inputs (not used for special controls)
            const inputType = (!isBool && !isColor && !options && attrSpec.type !== 'select'
                               && attrSpec.type !== 'boolean' && attrSpec.type !== 'color')
                ? (attrSpec.type || 'text')
                : 'text';

            return {
                label:   attrName,   // always the real HTML attribute name
                attrName,            // always the HTML attribute name
                value,
                mixed,
                half,
                invalid: false,
                // U39: structured-inspector metadata (all optional; absent →
                // today's flat behaviour).
                section: attrSpec.section || '',
                advanced: Boolean(attrSpec.advanced),
                visibleWhen: attrSpec.visibleWhen || null,
                default: attrSpec.default,
                // B50: dropdowns may declare an explicit "unset" entry (e.g. the
                // view theme's "Site theme (default)") — selecting it removes
                // the attribute, exactly like the × clear.
                emptyOption: attrSpec.emptyOption,
                elem: {
                    input: !options && !attrSpec.textarea && !isBool && !isList && !isColor && !isTopic && !isIcon && !isAsset,
                    inputType,
                    dropdown: Boolean(options),
                    options,
                    textarea: Boolean(attrSpec.textarea),
                    editor: Boolean(attrSpec.editor),
                    variables: attrSpec.variables || [],
                    checkbox: isBool,
                    color: isColor,
                    mqttTopic: isTopic,
                    icon: isIcon,
                    asset: isAsset,
                    accept: attrSpec.accept || null,
                    list: isList,
                    // U35: per-item field spec; legacy {columns:['a','b']}
                    // converts to itemFields; default is the canonical
                    // label/value pair.
                    itemFields: attrSpec.itemFields
                        || (attrSpec.columns ? attrSpec.columns.map(c => ({key: c})) : [{key: 'label'}, {key: 'value'}]),
                    tooltip: attrSpec.tooltip,
                    help: attrSpec.help || '',
                    template: Boolean(attrSpec.template),
                    validator: attrSpec.validator,
                    iconVariants: attrSpec.iconVariants,
                    min: attrSpec.min,
                    max: attrSpec.max,
                    step: attrSpec.step
                }
            };
        }).filter(Boolean);   // drop null entries (custom items under multi-select)

        // Inject locked checkbox for all non-view elements
        if (tagName !== 'feezal-view') {
            const lockedVals = this.selectedElems.map(e => e.hasAttribute('locked'));
            const lockedMixed = this.selectedElems.length > 1 && lockedVals.some(v => v !== lockedVals[0]);
            this.items = [...this.items, {
                label: 'locked',
                attrName: 'locked',
                value: lockedMixed ? false : lockedVals[0],
                mixed: lockedMixed,
                half: false,
                invalid: false,
                elem: {
                    input: false, inputType: 'text', dropdown: false, options: null,
                    textarea: false, checkbox: true, color: false, mqttTopic: false, list: false,
                    itemFields: undefined, tooltip: undefined,
                    help: 'Prevent this element from being moved or resized in the editor',
                    template: false, validator: undefined, min: undefined, max: undefined, step: undefined
                }
            }];
        }

        this._initCollapsedSections();
    }

    // ── U39: structured inspector — sections / conditional visibility / advanced

    /**
     * Reset which sections start collapsed for the current selection: the
     * boilerplate "Availability"/"Advanced" sections (case-insensitive), only
     * when they actually exist in this element's descriptors.
     */
    _initCollapsedSections() {
        const present = new Set(this.items.map(it => (it.section || '').toLowerCase()).filter(Boolean));
        this._collapsedSections = new Set(
            [...FeezalSidebarInspectorAttributes.DEFAULT_COLLAPSED_SECTIONS].filter(s => present.has(s)));
    }

    /** Effective attribute values (inline value, else descriptor default) keyed by HTML attr name — for visibleWhen. */
    _effectiveValues() {
        const map = {};
        for (const it of this.items) {
            const v = (it.value === '' || it.value == null) ? it.default : it.value;
            map[it.attrName] = v;
        }
        return map;
    }

    /**
     * U39 visibleWhen: a single `{attr, equals}` or an array of them (ANDed).
     * `equals` is a value or an array of accepted values. Absent → always visible.
     * Comparison is loose-ish: booleans and numbers coerce to string so
     * `equals: 'true'` / `equals: true` and `equals: 1` / `'1'` both work.
     */
    _passesVisibleWhen(cond, values) {
        if (!cond) return true;
        const list = Array.isArray(cond) ? cond : [cond];
        const norm = v => (v === true ? 'true' : v === false ? 'false' : String(v ?? ''));
        return list.every(c => {
            if (!c || !c.attr) return true;
            const actual = norm(values[c.attr]);
            const accepted = (Array.isArray(c.equals) ? c.equals : [c.equals]).map(norm);
            return accepted.includes(actual);
        });
    }

    /**
     * Group the currently-visible items by section for display, preserving each
     * item's original index (change handlers key on it). Section-less items form
     * a leading, header-less group. Groups order by first appearance; each group
     * separates `advanced` items into an Advanced disclosure.
     */
    _visibleGroups() {
        const values = this._effectiveValues();
        const byName = new Map();
        const order = [];
        this.items.forEach((item, idx) => {
            if (!this._passesVisibleWhen(item.visibleWhen, values)) return;
            const section = item.section || '';
            if (!byName.has(section)) { byName.set(section, {section, main: [], advanced: [], first: idx}); order.push(section); }
            byName.get(section)[item.advanced ? 'advanced' : 'main'].push({item, idx});
        });
        return order
            .map(s => byName.get(s))
            .filter(g => g.main.length || g.advanced.length)
            .sort((a, b) => a.first - b.first);
    }

    _toggleSection(name) {
        const next = new Set(this._collapsedSections);
        next.has(name) ? next.delete(name) : next.add(name);
        this._collapsedSections = next;
    }

    /**
     * U32: build inspector items for feezal-component instances from the
     * template's feezal-params. The declared type maps onto the existing
     * typed controls (mqttTopic → topic autocomplete, color → picker, …).
     * Multi-select works when all selected instances are the same component.
     */
    _rebuildComponentItems(el) {
        const componentName = el.getAttribute('name');
        const sameComponent = this.selectedElems.every(e =>
            e.localName === 'feezal-component' && e.getAttribute('name') === componentName);
        const params = sameComponent ? (el.params || {}) : {};

        this.items = Object.entries(params).map(([paramName, spec]) => {
            const type = spec.type || 'string';
            const isColor = type === 'color';
            const isTopic = type === 'mqttTopic';
            const isIcon = type === 'icon';
            // Substitution is textual, so boolean params are edited as an
            // explicit true/false dropdown rather than a checkbox.
            const options = type === 'select' ? (spec.options || [])
                : (type === 'boolean' ? ['true', 'false'] : null);
            const fallback = spec.default === undefined ? '' : String(spec.default);

            const vals = this.selectedElems.map(e => e.getAttribute(paramName) ?? fallback);
            const mixed = this.selectedElems.length > 1 && vals.some(v => v !== vals[0]);

            return {
                label: paramName,
                attrName: paramName,
                value: mixed ? null : vals[0],
                mixed,
                half: false,
                invalid: false,
                elem: {
                    input: !options && !isColor && !isTopic && !isIcon,
                    inputType: type === 'number' ? 'number' : 'text',
                    dropdown: Boolean(options),
                    options,
                    textarea: false,
                    editor: false,
                    variables: [],
                    checkbox: false,
                    color: isColor,
                    mqttTopic: isTopic,
                    icon: isIcon,
                    list: false,
                    columns: undefined,
                    tooltip: undefined,
                    help: spec.label || '',
                    template: false,
                    validator: undefined,
                    min: undefined,
                    max: undefined,
                    step: undefined
                }
            };
        });

        // Locked checkbox — same as for regular elements.
        const lockedVals = this.selectedElems.map(e => e.hasAttribute('locked'));
        const lockedMixed = this.selectedElems.length > 1 && lockedVals.some(v => v !== lockedVals[0]);
        this.items = [...this.items, {
            label: 'locked',
            attrName: 'locked',
            value: lockedMixed ? false : lockedVals[0],
            mixed: lockedMixed,
            half: false,
            invalid: false,
            elem: {
                input: false, inputType: 'text', dropdown: false, options: null,
                textarea: false, checkbox: true, color: false, mqttTopic: false, list: false,
                columns: undefined, tooltip: undefined,
                help: 'Prevent this element from being moved or resized in the editor',
                template: false, validator: undefined, min: undefined, max: undefined, step: undefined
            }
        }];
    }

    _makeTextItem(el, attrName) {
        return {
            label:    attrName,
            attrName,
            value: el.getAttribute(this._toKebab(attrName)) ?? el.getAttribute(attrName) ?? '',
            half: false,
            invalid: false,
            elem: {
                input: true, inputType: 'text', dropdown: false, options: null,
                textarea: false, checkbox: false, color: false, mqttTopic: false, list: false,
                columns: undefined, tooltip: undefined, template: false,
                validator: undefined, min: undefined, max: undefined, step: undefined
            }
        };
    }

    _makeTopicItem(el, attrName) {
        return {
            label:    attrName,
            attrName,
            value: el.getAttribute(this._toKebab(attrName)) ?? el.getAttribute(attrName) ?? '',
            half: false,
            invalid: false,
            elem: {
                input: false, inputType: 'text', dropdown: false, options: null,
                textarea: false, checkbox: false, color: false, mqttTopic: true, list: false,
                columns: undefined, tooltip: undefined, template: false,
                validator: undefined, min: undefined, max: undefined, step: undefined
            }
        };
    }

    // ── Auto-discovery (N12) ──────────────────────────────────────────────────

    async _fetchDiscoveryEntities() {
        try {
            const r = await fetch('/api/discovery/devices');
            if (r.ok) {
                const {devices} = await r.json();
                this.__discoveryEntities = devices || [];
                this.requestUpdate(); // refresh the device picker once entities arrive
            }
        } catch { /* offline or server not connected */ }
    }

    // Device picker shown above a custom inspector (N6). Lists every discovered
    // entity whose component matches the element's declared discovery component,
    // so the user can link/auto-configure without typing a topic first.
    _renderDiscoveryPicker() {
        const el = this.selectedElems?.[0];
        if (!el) return '';
        const tagName = el.name ? 'feezal-view' : el.localName;
        const cls = window.customElements.get(tagName);
        const component = cls?.feezal?.discovery?.component;
        if (!component) return '';

        const allMatches = (this.__discoveryEntities || []).filter(e => e.component === component);
        if (!allMatches.length) return '';

        const q = (this._discoveryFilter || '').toLowerCase().trim();
        const matches = q
            ? allMatches.filter(m => {
                const label = this._discoveryOptionLabel(m).toLowerCase();
                const name  = (m.name || '').toLowerCase();
                const id    = (m.discovery_id || '').toLowerCase();
                return label.includes(q) || name.includes(q) || id.includes(q);
            })
            : allMatches;

        const linkedId = el.getAttribute('discovery-id') || '';
        const showSearch = allMatches.length > 5;
        // Shoelace <sl-select> treats a space in an <sl-option> value as a value
        // delimiter (multi-value tokens), so option/select values that contain a
        // space can never resolve on @sl-change. Native Homematic discovery_ids
        // like "hm-climate:Thermostat Hobbyraum:1" contain spaces, so we
        // percent-encode every value here and decode in _onPickDiscovery. HA ids
        // are space-free, so encodeURIComponent is a round-trip no-op for them
        // (only ":"/"/" get encoded, which decode restores) \u2014 behaviour unchanged.
        return html`
            <div class="discovery-picker">
                <span class="dp-icon" title="Auto-discovered devices (${allMatches.length})">\u26A1</span>
                <sl-select class="dp-select" size="small" hoist
                    placeholder="Link a discovered device\u2026"
                    value="${encodeURIComponent(linkedId)}"
                    @sl-after-show="${() => this.renderRoot.querySelector('.dp-search')?.focus()}"
                    @sl-hide="${() => { this._discoveryFilter = ''; }}"
                    @sl-change="${e => this._onPickDiscovery(e.target.value)}">
                    ${showSearch ? html`
                        <div class="dp-search-wrap"
                            @click="${e => e.stopPropagation()}"
                            @mousedown="${e => e.stopPropagation()}">
                            <input class="dp-search" type="text"
                                placeholder="Filter ${allMatches.length} devices\u2026"
                                .value="${this._discoveryFilter || ''}"
                                @input="${e => { e.stopPropagation(); this._discoveryFilter = e.target.value; }}"
                                @keydown="${e => e.stopPropagation()}">
                        </div>` : ''}
                    ${matches.map(m => html`<sl-option value="${encodeURIComponent(m.discovery_id)}">${this._discoveryOptionLabel(m)}</sl-option>`)}
                    ${!matches.length ? html`<sl-option value="" disabled>No matches for \u201c${this._discoveryFilter}\u201d</sl-option>` : ''}
                </sl-select>
                ${linkedId ? html`<button class="dp-clear" title="Unlink device" @click="${this._onClearDiscovery}">&#x2715;</button>` : ''}
            </div>
        `;
    }

    // Build a meaningful option label from the discovery payload. The entity
    // `name` is often just the component type ("light"), so prefer the status
    // topic(s) found in the config, falling back to the name.
    // U58: label + attribute-suffix logic now lives in the shared discovery
    // module so the ⚡ picker and the Generate wizard label devices identically.
    _discoveryOptionLabel(entity) {
        return discoveryLabel(entity);
    }

    _discoveryAttributeSuffix(entity, base) {
        return discoveryAttributeSuffix(entity, base);
    }

    _onPickDiscovery(encodedId) {
        if (!encodedId) return;
        // Values are percent-encoded in _renderDiscoveryPicker (see note there) to
        // survive Shoelace's space-delimited value handling — decode before lookup.
        const id = decodeURIComponent(encodedId);
        const entity = (this.__discoveryEntities || []).find(e => e.discovery_id === id);
        if (entity) this._applyDiscovery(entity);
    }

    _onClearDiscovery() {
        const el = this.selectedElems?.[0];
        if (!el) return;
        el.removeAttribute('discovery-id');
        feezal.app.change();
        this.requestUpdate();
        this.shadowRoot?.querySelector('#custom-inspector-host')?.firstElementChild?.requestUpdate?.();
    }

    // Scan the entity cache for one whose config contains a topic field matching
    // the entered value. Only considers entities matching the element's declared
    // discovery component (if any), so the banner never fires for wrong element types.
    _checkDiscovery(topic) {
        if (!topic || !this.__discoveryEntities?.length) return;
        const el = this.selectedElems?.[0];
        if (!el) return;
        const tagName = el.name ? 'feezal-view' : el.localName;
        const cls = window.customElements.get(tagName);
        const expectedComponent = cls?.feezal?.discovery?.component;

        const match = this.__discoveryEntities.find(entity => {
            if (expectedComponent && entity.component !== expectedComponent) return false;
            const cfg = entity.config || {};
            return Object.values(cfg).some(v => typeof v === 'string' && v === topic);
        });

        this._discoveryMatch = match || null;
    }

    _onAutoConfig() {
        const entity = this._discoveryMatch;
        if (!entity) return;
        this._applyDiscovery(entity);
        this._discoveryMatch = null;
    }

    // Apply a discovery entity's config to the selected element using the element's
    // feezal().discovery.map descriptor. Each entry maps a discovery config key to
    // a feezal attribute, with optional value transforms.
    _applyDiscovery(entity) {
        const el = this.selectedElems?.[0];
        if (!el) return;
        // U58: the stamping itself lives in the shared headless module so the
        // ⚡ picker and the bulk Generate wizard wire devices identically. The
        // inspector-specific redraw stays here.
        if (!stampDiscovery(el, entity)) return;
        this._rebuildItems();
        feezal.app.change();
        // Refresh a custom inspector (N6) so its fields show the applied values.
        this.shadowRoot?.querySelector('#custom-inspector-host')?.firstElementChild?.requestUpdate?.();
    }
}

window.customElements.define('feezal-sidebar-inspector-attributes', FeezalSidebarInspectorAttributes);


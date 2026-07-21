/* global feezal */
import {LitElement, html, css} from 'lit';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js';

/**
 * E50 — Conditions tab of the element inspector.
 *
 * Edits the element's `conditions` attribute: a JSON list of rows that
 * declaratively bind visibility / classes / styles / attributes to MQTT
 * topics. The attribute is the single source of truth (round-trips through
 * the Monaco source editor); effects are applied by the shared engine in
 * @feezal/feezal-element (viewer only — the editor shows a badge instead).
 *
 * MVP: single-element selection only (the inspector gates the tab).
 */

const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'matches'];
const ACTIONS = [
    {value: 'show',      label: 'show while matched'},
    {value: 'hide',      label: 'hide while matched'},
    {value: 'class',     label: 'add class'},
    {value: 'style',     label: 'apply style'},
    {value: 'attribute', label: 'set attribute'},
];
const CUSTOM = '__custom__';

class FeezalSidebarInspectorConditions extends LitElement {
    static properties = {
        selectedElems: {attribute: false},
        _completions:      {state: true},
        _completionIdx:    {state: true},
        _completionCursor: {state: true},
        _customAttr:       {state: true},   // Set of row indices using free-text attribute names
        _styleDrafts:      {state: true},   // rowIdx → [[key, value], …] keyless style rows being edited
    };

    static styles = css`
        :host { display: block; padding: 8px; font-size: 12px; color: var(--feezal-color, #333); }
        .intro { font-size: 11px; opacity: 0.65; line-height: 1.45; margin: 2px 2px 10px; }
        .row-card { border: 1px solid var(--feezal-border, #e0e0e0); border-radius: 6px; padding: 6px; margin-bottom: 8px; }
        .row-head { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
        .row-num {
            flex: 0 0 auto; width: 18px; height: 18px; border-radius: 50%;
            background: var(--sl-color-primary-600, #0284c7); color: #fff; font-size: 11px;
            display: flex; align-items: center; justify-content: center;
        }
        .row-head .spacer { flex: 1; }
        .ib {
            flex: 0 0 auto; width: 24px; height: 26px; border: none; background: none; cursor: pointer;
            color: var(--feezal-color, #555); border-radius: 4px; font-size: 14px;
        }
        .ib:hover { background: var(--feezal-btn-hover, rgba(0,0,0,0.07)); }
        .ib:disabled { opacity: 0.3; cursor: default; }
        .ib.danger:hover { color: #c62828; }
        .grid { display: flex; gap: 6px; margin-top: 6px; }
        .grid > .field { flex: 1; min-width: 0; }
        .field { display: flex; flex-direction: column; gap: 2px; }
        .field > label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; }
        sl-input, sl-select { width: 100%; }
        sl-input::part(base), sl-select::part(combobox) {
            background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333);
        }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--feezal-color, #333); }
        .btn {
            border: 1px solid var(--feezal-border, #ccc); background: var(--feezal-bg, #fff); color: var(--feezal-color, #333);
            border-radius: 5px; padding: 4px 10px; font: inherit; font-size: 11px; cursor: pointer;
        }
        .btn:hover { background: var(--feezal-btn-hover, rgba(0,0,0,0.06)); }
        .style-row { display: flex; gap: 4px; align-items: center; margin-top: 4px; }
        .style-row sl-input { flex: 1; min-width: 0; }
        /* ── MQTT topic autocomplete (same pattern as the Attributes tab) ── */
        .topic-wrap { position: relative; }
        .completions {
            position: absolute; z-index: 30; left: 0; right: 0; margin: 0; padding: 2px 0;
            list-style: none; max-height: 180px; overflow-y: auto;
            background: var(--feezal-bg, #fff); border: 1px solid var(--feezal-border, #ccc);
            border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 12px;
        }
        .completions li { padding: 3px 8px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .completions li:hover, .completions li.active { background: var(--feezal-btn-hover, rgba(2,132,199,0.12)); }
        sl-checkbox { --sl-input-font-size-small: 11px; }
        sl-checkbox::part(label) { font-size: 11px; color: var(--feezal-color, #333); }
    `;

    constructor() {
        super();
        this.selectedElems = [];
        this._completions = [];
        this._completionIdx = -1;
        this._completionCursor = -1;
        this._customAttr = new Set();
        this._styleDrafts = {};
    }

    willUpdate(changed) {
        if (changed.has('selectedElems')) {
            // Fresh element → stale per-row editing state must not leak over.
            this._customAttr = new Set();
            this._styleDrafts = {};
        }
    }

    get _element() {
        return (this.selectedElems && this.selectedElems.length === 1) ? this.selectedElems[0] : null;
    }

    _rows() {
        try {
            const r = JSON.parse(this._element?.getAttribute('conditions') || '[]');
            return Array.isArray(r) ? r : [];
        } catch {
            return [];
        }
    }

    _save(rows) {
        const el = this._element;
        if (!el) return;
        if (rows.length === 0) {
            el.removeAttribute('conditions');
        } else {
            el.setAttribute('conditions', JSON.stringify(rows));
        }

        feezal.app.change();
        // Let the inspector refresh the tab count / canvas badge state.
        this.dispatchEvent(new CustomEvent('conditions-changed', {bubbles: true, composed: true}));
        this.requestUpdate();
    }

    _patch(i, key, value) {
        const rows = this._rows();
        if (!rows[i]) return;
        if (value === '' || value === undefined || value === false) {
            delete rows[i][key];
        } else {
            rows[i][key] = value;
        }

        this._save(rows);
    }

    _add() {
        const rows = this._rows();
        rows.push({subscribe: '', operator: '=', value: '', action: 'hide'});
        this._save(rows);
    }

    _remove(i) {
        const rows = this._rows();
        rows.splice(i, 1);
        this._customAttr.delete(i);
        this._styleDrafts = {};   // indices shift — drop draft rows
        this._save(rows);
    }

    _move(i, dir) {
        const rows = this._rows();
        const j = i + dir;
        if (j < 0 || j >= rows.length) return;
        [rows[i], rows[j]] = [rows[j], rows[i]];
        this._styleDrafts = {};   // indices shift — drop draft rows
        this._save(rows);
    }

    // ── Style key/value sub-rows (action = style) ─────────────────────────────
    // Persisted entries live in the row's style object; entries WITHOUT a key
    // yet live as per-row drafts in component state — _patchStyle drops
    // keyless entries from the attribute, so a freshly added "+ style
    // property" row would otherwise vanish on the next render (the bug).

    _styleEntries(row) {
        return Object.entries(row.style && typeof row.style === 'object' ? row.style : {});
    }

    /** Persisted entries + keyless draft rows still being edited. */
    _displayStyleEntries(row, i) {
        return [...this._styleEntries(row), ...(this._styleDrafts[i] || [])];
    }

    _addStyleDraft(i) {
        this._styleDrafts = {...this._styleDrafts, [i]: [...(this._styleDrafts[i] || []), ['', '']]};
    }

    /** Apply an edit/removal to the combined display list: keyed entries are
     * persisted into the row's style object, keyless ones stay as drafts. */
    _commitStyleEntries(i, entries) {
        this._styleDrafts = {...this._styleDrafts, [i]: entries.filter(([k]) => !k)};
        this._patchStyle(i, entries);
    }

    _patchStyle(i, entries) {
        const style = {};
        for (const [k, v] of entries) {
            if (k) style[k] = v;
        }

        const rows = this._rows();
        if (!rows[i]) return;
        rows[i].style = style;
        this._save(rows);
    }

    // ── Attribute-name select options (from the element's descriptor) ────────

    _declaredAttributes() {
        const cls = this._element && window.customElements.get(this._element.localName);
        const attrs = cls?.feezal?.attributes || [];
        return attrs
            .map(a => (typeof a === 'string' ? a : a.name))
            .filter(Boolean)
            .map(n => n.replace(/([A-Z])/g, c => '-' + c.toLowerCase()));
    }

    // ── MQTT topic autocomplete (fetch pattern shared with the Attributes tab;
    //    free text — including ${param} placeholders — is always accepted) ────

    _onTopicInput(prefix, idx) {
        if (this._completionTimer) clearTimeout(this._completionTimer);
        // ${param} placeholders (U32 component templates) get no live-topic
        // lookup — they are resolved at stamp time.
        if (prefix.includes('${')) {
            this._completionIdx = -1;
            this._completions = [];
            return;
        }

        this._completionTimer = setTimeout(async () => {
            try {
                const r = await fetch(`/api/topics/completions?prefix=${encodeURIComponent(prefix)}`);
                if (!r.ok) { this._completions = []; return; }
                const {completions} = await r.json();
                this._completionIdx = idx;
                this._completionCursor = -1;
                this._completions = completions || [];
            } catch {
                this._completions = [];
            }
        }, 150);
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
            this._closeCompletions();
        }
    }

    _selectCompletion(val, idx) {
        this._patch(idx, 'subscribe', val);
        if (val.endsWith('/')) {
            this._onTopicInput(val, idx);
        } else {
            this._closeCompletions();
        }
    }

    _closeCompletions() {
        this._completionIdx = -1;
        this._completions = [];
        this._completionCursor = -1;
    }

    _scheduleCloseCompletions(idx) {
        setTimeout(() => {
            if (this._completionIdx === idx) this._closeCompletions();
        }, 200);
    }

    // ── Render ────────────────────────────────────────────────────────────────

    _actionFields(row, i) {
        if (row.action === 'class') {
            return html`
                <div class="grid">
                    <div class="field">
                        <label>class name</label>
                        <sl-input size="small" autocomplete="off" .value="${row.class || ''}"
                            @sl-change="${e => this._patch(i, 'class', e.target.value)}"></sl-input>
                    </div>
                </div>`;
        }

        if (row.action === 'style') {
            const entries = this._displayStyleEntries(row, i);
            return html`
                <div class="field" style="margin-top:6px">
                    <label>styles while matched</label>
                    ${entries.map(([k, v], si) => html`
                        <div class="style-row">
                            <sl-input size="small" autocomplete="off" placeholder="property" .value="${k}"
                                @sl-change="${e => { const es = this._displayStyleEntries(row, i).map(en => [...en]); es[si][0] = e.target.value; this._commitStyleEntries(i, es); }}"></sl-input>
                            <sl-input size="small" autocomplete="off" placeholder="value" .value="${v}"
                                @sl-change="${e => { const es = this._displayStyleEntries(row, i).map(en => [...en]); es[si][1] = e.target.value; this._commitStyleEntries(i, es); }}"></sl-input>
                            <button class="ib danger" title="Remove style property"
                                @click="${() => { const es = this._displayStyleEntries(row, i).map(en => [...en]); es.splice(si, 1); this._commitStyleEntries(i, es); }}">✕</button>
                        </div>`)}
                    <div style="margin-top:4px">
                        <button class="btn" @click="${() => this._addStyleDraft(i)}">+ style property</button>
                    </div>
                </div>`;
        }

        if (row.action === 'attribute') {
            const declared = this._declaredAttributes();
            const custom = this._customAttr.has(i) || (row.attribute && !declared.includes(row.attribute));
            return html`
                <div class="grid">
                    <div class="field">
                        <label>attribute</label>
                        ${custom || declared.length === 0 ? html`
                            <sl-input size="small" autocomplete="off" placeholder="attribute name" .value="${row.attribute || ''}"
                                @sl-change="${e => this._patch(i, 'attribute', e.target.value)}"></sl-input>
                        ` : html`
                            <sl-select size="small" hoist .value="${row.attribute || ''}"
                                @sl-change="${e => {
                                    if (e.target.value === CUSTOM) {
                                        this._customAttr.add(i);
                                        this.requestUpdate();
                                    } else {
                                        this._patch(i, 'attribute', e.target.value);
                                    }
                                }}">
                                ${declared.map(n => html`<sl-option value="${n}">${n}</sl-option>`)}
                                <sl-option value="${CUSTOM}">custom…</sl-option>
                            </sl-select>
                        `}
                    </div>
                    <div class="field">
                        <label>set to value</label>
                        <sl-input size="small" autocomplete="off" .value="${row['attribute-value'] ?? ''}"
                            @sl-change="${e => this._patch(i, 'attribute-value', e.target.value)}"></sl-input>
                    </div>
                </div>`;
        }

        // show / hide
        return html`
            <div class="grid" style="align-items:center">
                <sl-checkbox size="small" ?checked="${Boolean(row['keep-layout'])}"
                    @sl-change="${e => this._patch(i, 'keep-layout', e.target.checked)}">
                    keep layout (visibility:hidden instead of display:none)
                </sl-checkbox>
            </div>`;
    }

    render() {
        const el = this._element;
        if (!el) return html``;
        const rows = this._rows();
        return html`
            <div class="intro">
                Bind this element's visibility, classes, styles or attributes to MQTT topics.
                Rows evaluate independently; <b>show</b>/<b>hide</b> rows AND-combine.
                Effects apply in the viewer only.
            </div>
            ${rows.map((row, i) => html`
                <div class="row-card">
                    <div class="row-head">
                        <span class="row-num">${i + 1}</span>
                        <span class="spacer"></span>
                        <button class="ib" title="Move up" ?disabled="${i === 0}" @click="${() => this._move(i, -1)}">▲</button>
                        <button class="ib" title="Move down" ?disabled="${i === rows.length - 1}" @click="${() => this._move(i, 1)}">▼</button>
                        <button class="ib danger" title="Remove condition" @click="${() => this._remove(i)}">✕</button>
                    </div>
                    <div class="field topic-wrap">
                        <label>subscribe</label>
                        <sl-input size="small" autocomplete="off" placeholder="topic or \${param}" .value="${row.subscribe || ''}"
                            @sl-focus="${e => this._onTopicInput(e.target.value, i)}"
                            @sl-input="${e => this._onTopicInput(e.target.value, i)}"
                            @sl-blur="${() => this._scheduleCloseCompletions(i)}"
                            @sl-change="${e => this._patch(i, 'subscribe', e.target.value)}"
                            @keydown="${e => this._onTopicKeydown(e, i)}"></sl-input>
                        ${this._completionIdx === i && this._completions.length ? html`
                            <ul class="completions">
                                ${this._completions.map((c, ci) => html`
                                    <li class="${ci === this._completionCursor ? 'active' : ''}"
                                        @mousedown="${e => { e.preventDefault(); this._selectCompletion(c, i); }}">${c}</li>`)}
                            </ul>` : ''}
                    </div>
                    <div class="grid">
                        <div class="field">
                            <label>property</label>
                            <sl-input size="small" autocomplete="off" placeholder="payload"
                                title="U49: dot-path into the message to compare, e.g. val or state.temperature. Empty = the whole payload."
                                .value="${row.property || ''}"
                                @sl-change="${e => this._patch(i, 'property', e.target.value.trim())}"></sl-input>
                        </div>
                        <div class="field" style="flex:0 0 92px">
                            <label>operator</label>
                            <sl-select size="small" hoist .value="${row.operator || '='}"
                                @sl-change="${e => this._patch(i, 'operator', e.target.value)}">
                                ${OPERATORS.map(op => html`<sl-option value="${op}">${op}</sl-option>`)}
                            </sl-select>
                        </div>
                    </div>
                    <div class="grid">
                        <div class="field">
                            <label>value</label>
                            <sl-input size="small" autocomplete="off" .value="${row.value ?? ''}"
                                @sl-change="${e => this._patch(i, 'value', e.target.value)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>action</label>
                            <sl-select size="small" hoist .value="${row.action || 'hide'}"
                                @sl-change="${e => this._patch(i, 'action', e.target.value)}">
                                ${ACTIONS.map(a => html`<sl-option value="${a.value}">${a.label}</sl-option>`)}
                            </sl-select>
                        </div>
                    </div>
                    ${this._actionFields(row, i)}
                </div>
            `)}
            <button class="btn" @click="${this._add}">+ Add condition</button>
        `;
    }
}

window.customElements.define('feezal-sidebar-inspector-conditions', FeezalSidebarInspectorConditions);
export {FeezalSidebarInspectorConditions};

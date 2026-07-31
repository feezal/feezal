/* global feezal */
import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/color-picker/color-picker.js';
import {parseColorRanges, rangeSwatchGradient, RANGE_SUFFIX}
    from '@feezal/feezal-element/feezal-color-ranges.js';
import {resolveCssColor, normalizeHexa} from './feezal-color-util.js';

/**
 * feezal-sidebar-color-ranges (U65) — the site-level manager for named colour
 * ranges, mounted as the "Ranges" tab of the Themes sidebar (colour ranges are
 * site-wide appearance data, exactly like themes and classes).
 *
 * The single source of truth is the `color-ranges` attribute on
 * `<feezal-site>` — every edit re-serializes the whole array there (removed
 * entirely when the last range goes), marks the site dirty, and broadcasts
 * `feezal-color-ranges-changed` on `document` so open inspectors refresh
 * their Range dropdowns.
 *
 * Renaming REWRITES every reference (element `--*-range` style pairs and
 * gauge `ranges` attributes) across all views — names are the identity, and a
 * silent rename would strand every binding. Deleting warns with the same
 * usage count; stranded references degrade safely (the bound var just keeps
 * its last colour), so deletion is allowed.
 */
class FeezalSidebarColorRanges extends LitElement {
    static properties = {
        _ranges:    {state: true},   // parsed working copy
        _collapsed: {state: true},   // Set of collapsed range names
        _renaming:  {state: true},   // name of the range being renamed inline
        _creating:  {state: true},   // {name, type} | null — the new-range form
    };

    static styles = css`
        :host { display: block; padding: 12px; }
        .hint { font-size: 11px; color: var(--feezal-color, #888); margin-bottom: 10px; line-height: 1.5; }
        .card {
            border: 1px solid var(--feezal-border, #ddd); border-radius: 6px;
            margin-bottom: 8px; overflow: visible;
        }
        .card-hdr { display: flex; align-items: center; gap: 6px; padding: 6px 8px; }
        .card-toggle { background: none; border: none; cursor: pointer; color: var(--feezal-color, #888); padding: 0 2px; }
        .card-name { font-size: 13px; font-weight: 600; color: var(--feezal-color, #333); cursor: pointer; }
        .card-type { font-size: 10px; color: var(--feezal-color, #999); text-transform: uppercase; letter-spacing: 0.05em; }
        .card-usage { font-size: 10px; color: var(--feezal-color, #999); margin-left: auto; }
        .card-del { background: none; border: none; cursor: pointer; color: #c62828; font-size: 15px; padding: 0 4px; }
        .strip { height: 10px; border-radius: 3px; margin: 0 8px 6px;
            background-color: var(--feezal-bg-sub, #eee); }
        .rows { padding: 0 8px 8px; }
        .row { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
        .row sl-input { flex: 1; min-width: 0; }
        .row sl-input.num { flex: 0 0 64px; }
        .row .del { background: none; border: none; cursor: pointer; color: #c62828; font-size: 14px; padding: 0 2px; }
        .row-label { font-size: 11px; color: var(--feezal-color, #777); flex: 0 0 auto; width: 64px; }
        .add-btn, .new-btn {
            font-size: 11px; padding: 4px 10px; border: 1px dashed var(--feezal-border, #ccc);
            background: none; cursor: pointer; border-radius: 4px; color: var(--feezal-color, #666);
        }
        .add-btn:hover, .new-btn:hover { border-color: var(--sl-color-primary-600, #0284c7); color: var(--sl-color-primary-600, #0284c7); }
        .space-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
        .space-row sl-select { flex: 1; }
        .rename-input {
            font-size: 13px; font-weight: 600; padding: 1px 4px;
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #333);
            border: 1px solid var(--sl-color-primary-600, #0284c7); border-radius: 3px;
        }
        .create-form { border: 1px dashed var(--feezal-border, #ccc); border-radius: 6px; padding: 8px; margin-bottom: 8px; }
        .create-form .row sl-select { flex: 1; }
        .create-actions { display: flex; gap: 6px; margin-top: 6px; }
        .create-actions button {
            font-size: 11px; padding: 4px 10px; border: 1px solid var(--feezal-border, #ccc);
            background: none; cursor: pointer; border-radius: 4px; color: var(--feezal-color, #666);
        }
        .create-actions button.primary { border-color: var(--sl-color-primary-600, #0284c7); color: var(--sl-color-primary-600, #0284c7); }
        sl-input::part(form-control-label) { color: var(--sl-input-label-color, inherit); font-size: 11px; }
        sl-input::part(base), sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        sl-color-picker { flex-shrink: 0; }
    `;

    constructor() {
        super();
        this._ranges = [];
        this._collapsed = new Set();
        this._renaming = null;
        this._creating = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this.refresh();
    }

    /** Re-read the working copy from the site attribute. */
    refresh() {
        this._ranges = parseColorRanges(feezal.site?.getAttribute('color-ranges') || '');
    }

    /** U47 sentinel entry point: open the new-range form (pre-named). */
    startCreate(name = '') {
        this._creating = {name, type: 'bands'};
        this.updateComplete.then(() =>
            this.renderRoot.querySelector('.create-form sl-input')?.focus());
    }

    // ── persistence ──────────────────────────────────────────────────────────

    _commit() {
        const site = feezal.site;
        if (!site) return;
        if (this._ranges.length === 0) {
            site.removeAttribute('color-ranges');
        } else {
            site.setAttribute('color-ranges', JSON.stringify(this._ranges));
        }
        this._ranges = [...this._ranges];
        feezal.app?.change?.();
        document.dispatchEvent(new CustomEvent('feezal-color-ranges-changed'));
    }

    // ── usage across the site ────────────────────────────────────────────────

    /** Elements referencing `name` — `--*-range` style pairs + gauge `ranges`. */
    _usages(name) {
        const out = [];
        if (!feezal.site) return out;
        for (const el of feezal.site.querySelectorAll('*')) {
            const style = el.style;
            if (style) {
                for (let i = 0; i < style.length; i++) {
                    const prop = style[i];
                    if (prop.startsWith('--') && prop.endsWith(RANGE_SUFFIX) &&
                        style.getPropertyValue(prop).trim() === name) {
                        out.push({el, kind: 'style', prop});
                    }
                }
            }
            if ((el.getAttribute?.('ranges') || '').trim() === name) {
                out.push({el, kind: 'attr'});
            }
        }
        return out;
    }

    /** Names travel through sl-option values (space-delimited) and CSS custom
     * properties — keep them to word characters and dashes. */
    static slug(name) {
        return String(name || '').trim().replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '');
    }

    _rename(oldName, newName) {
        this._renaming = null;
        newName = FeezalSidebarColorRanges.slug(newName);
        if (!newName || newName === oldName) return;
        if (this._ranges.some(r => r.name === newName)) return;   // duplicate → refuse
        // rewrite every reference — names are the identity
        for (const use of this._usages(oldName)) {
            if (use.kind === 'style') use.el.style.setProperty(use.prop, newName);
            else use.el.setAttribute('ranges', newName);
        }
        this._ranges = this._ranges.map(r => r.name === oldName ? {...r, name: newName} : r);
        this._commit();
    }

    _delete(name) {
        const used = this._usages(name).length;
        if (used > 0 &&
            !confirm(`"${name}" is used by ${used} element${used === 1 ? '' : 's'}. ` +
                'Their colours will keep the last resolved value. Delete anyway?')) return;
        this._ranges = this._ranges.filter(r => r.name !== name);
        this._commit();
    }

    // ── per-range editing (working copy → commit on every change) ───────────

    _patch(name, fn) {
        this._ranges = this._ranges.map(r => r.name === name ? fn({...r}) : r);
        this._commit();
    }

    _setRowColor(range, listKey, index, color) {
        this._patch(range.name, r => {
            r[listKey] = r[listKey].map((row, i) => i === index ? {...row, color} : row);
            return r;
        });
    }

    _resolveSwatch(color) {
        return color ? resolveCssColor(color, feezal.site || this) : '';
    }

    _colorRow(range, listKey, row, index, numKey) {
        const swatch = this._resolveSwatch(row.color);
        return html`
            <div class="row">
                <sl-input class="num" size="small" type="number" no-spin-buttons
                    .value="${String(row[numKey])}"
                    @sl-change="${e => this._patch(range.name, r => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return r;
                        r[listKey] = r[listKey].map((x, i) => i === index ? {...x, [numKey]: v} : x)
                            .sort((a, b) => a[numKey] - b[numKey]);
                        return r;
                    })}">
                </sl-input>
                <sl-input size="small" placeholder="#hex / var(--…)"
                    .value="${row.color}"
                    @sl-change="${e => this._setRowColor(range, listKey, index, e.target.value.trim())}">
                </sl-input>
                <sl-color-picker size="small" hoist opacity no-format-toggle format="hex"
                    class="${swatch ? '' : 'unresolved'}" .value="${swatch}"
                    @sl-change="${e => this._setRowColor(range, listKey, index, normalizeHexa(e.target.value))}">
                </sl-color-picker>
                <button class="del" title="Remove"
                    ?disabled="${range[listKey].length <= 1}"
                    @click="${() => this._patch(range.name, r => {
                        if (r[listKey].length <= 1) return r;
                        r[listKey] = r[listKey].filter((_, i) => i !== index);
                        return r;
                    })}">×</button>
            </div>`;
    }

    _enumRow(range, key, index) {
        const color = range.map[key];
        const swatch = this._resolveSwatch(color);
        return html`
            <div class="row">
                <sl-input class="num" size="small" .value="${key}"
                    @sl-change="${e => this._patch(range.name, r => {
                        const nk = e.target.value.trim();
                        if (!nk || nk === key || nk in r.map) return r;
                        const entries = Object.entries(r.map);
                        entries[index] = [nk, entries[index][1]];
                        r.map = Object.fromEntries(entries);
                        return r;
                    })}">
                </sl-input>
                <sl-input size="small" placeholder="#hex / var(--…)" .value="${color}"
                    @sl-change="${e => this._patch(range.name, r => {
                        r.map = {...r.map, [key]: e.target.value.trim()};
                        return r;
                    })}">
                </sl-input>
                <sl-color-picker size="small" hoist opacity no-format-toggle format="hex"
                    class="${swatch ? '' : 'unresolved'}" .value="${swatch}"
                    @sl-change="${e => this._patch(range.name, r => {
                        r.map = {...r.map, [key]: normalizeHexa(e.target.value)};
                        return r;
                    })}">
                </sl-color-picker>
                <button class="del" title="Remove"
                    @click="${() => this._patch(range.name, r => {
                        r.map = Object.fromEntries(Object.entries(r.map).filter(([k]) => k !== key));
                        return r;
                    })}">×</button>
            </div>`;
    }

    _defaultRow(range) {
        const swatch = this._resolveSwatch(range.default);
        return html`
            <div class="row">
                <span class="row-label">default</span>
                <sl-input size="small" placeholder="none — keep previous colour"
                    .value="${range.default || ''}"
                    @sl-change="${e => this._patch(range.name, r => ({...r, default: e.target.value.trim()}))}">
                </sl-input>
                <sl-color-picker size="small" hoist opacity no-format-toggle format="hex"
                    class="${swatch ? '' : 'unresolved'}" .value="${swatch}"
                    @sl-change="${e => this._patch(range.name, r => ({...r, default: normalizeHexa(e.target.value)}))}">
                </sl-color-picker>
            </div>`;
    }

    _card(range) {
        const collapsed = this._collapsed.has(range.name);
        const used = this._usages(range.name).length;
        return html`
            <div class="card">
                <div class="card-hdr">
                    <button class="card-toggle" @click="${() => {
                        const s = new Set(this._collapsed);
                        s.has(range.name) ? s.delete(range.name) : s.add(range.name);
                        this._collapsed = s;
                    }}">${collapsed ? '▶' : '▾'}</button>
                    ${this._renaming === range.name ? html`
                        <input class="rename-input" .value="${range.name}"
                            @keydown="${e => {
                                if (e.key === 'Enter') this._rename(range.name, e.target.value);
                                if (e.key === 'Escape') this._renaming = null;
                            }}"
                            @blur="${e => this._rename(range.name, e.target.value)}">
                    ` : html`
                        <span class="card-name" title="Click to rename (rewrites all references)"
                            @click="${() => this._renaming = range.name}">${range.name}</span>
                    `}
                    <span class="card-type">${range.type}</span>
                    <span class="card-usage">${used ? `${used} in use` : ''}</span>
                    <button class="card-del" title="Delete range" @click="${() => this._delete(range.name)}">×</button>
                </div>
                <div class="strip" style="background-image: ${rangeSwatchGradient(range)}"></div>
                ${collapsed ? '' : html`
                    <div class="rows">
                        ${range.type === 'bands' ? html`
                            ${range.bands.map((b, i) => this._colorRow(range, 'bands', b, i, 'from'))}
                            <button class="add-btn" @click="${() => this._patch(range.name, r => {
                                const last = r.bands[r.bands.length - 1];
                                r.bands = [...r.bands, {from: last.from + 10, color: last.color}];
                                return r;
                            })}">+ band</button>
                        ` : ''}
                        ${range.type === 'gradient' ? html`
                            <div class="space-row">
                                <span class="row-label">blend in</span>
                                <sl-select size="small" .value="${range.space}"
                                    @sl-change="${e => this._patch(range.name, r => ({...r, space: e.target.value}))}">
                                    <sl-option value="oklch">oklch (perceptual)</sl-option>
                                    <sl-option value="srgb">srgb</sl-option>
                                </sl-select>
                            </div>
                            ${range.stops.map((s, i) => this._colorRow(range, 'stops', s, i, 'at'))}
                            <button class="add-btn" @click="${() => this._patch(range.name, r => {
                                const last = r.stops[r.stops.length - 1];
                                r.stops = [...r.stops, {at: last.at + 10, color: last.color}];
                                return r;
                            })}">+ stop</button>
                        ` : ''}
                        ${range.type === 'enum' ? html`
                            ${Object.keys(range.map).map((k, i) => this._enumRow(range, k, i))}
                            <button class="add-btn" @click="${() => this._patch(range.name, r => {
                                let k = 'value';
                                let n = 1;
                                while (k in r.map) k = 'value' + n++;
                                r.map = {...r.map, [k]: '#888888'};
                                return r;
                            })}">+ value</button>
                        ` : ''}
                        ${this._defaultRow(range)}
                    </div>
                `}
            </div>`;
    }

    _create() {
        const name = FeezalSidebarColorRanges.slug(this._creating?.name);
        const type = this._creating?.type || 'bands';
        if (!name || this._ranges.some(r => r.name === name)) return;
        const fresh = type === 'bands'
            ? {name, type, default: '', bands: [{from: 0, color: 'var(--primary-color, #0284c7)'}]}
            : type === 'gradient'
                ? {name, type, default: '', space: 'oklch',
                    stops: [{at: 0, color: '#4caf50'}, {at: 100, color: '#e53935'}]}
                : {name, type, default: 'var(--secondary-text-color, #888)', map: {on: '#4caf50', off: '#9e9e9e'}};
        this._ranges = [...this._ranges, fresh];
        this._creating = null;
        this._commit();
    }

    render() {
        return html`
            <div class="hint">
                Named value→colour mappings, shared by the whole site. Any colour knob in the
                Styles tab can be driven by one (mode "Range"), and a gauge's
                <code>ranges</code> attribute accepts a name.
            </div>
            ${this._ranges.map(r => this._card(r))}
            ${this._creating ? html`
                <div class="create-form">
                    <div class="row">
                        <sl-input size="small" placeholder="range name…"
                            .value="${this._creating.name}"
                            @sl-input="${e => this._creating = {...this._creating, name: e.target.value}}"
                            @keydown="${e => {
                                if (e.key === 'Enter') this._create();
                                if (e.key === 'Escape') this._creating = null;
                            }}">
                        </sl-input>
                        <sl-select size="small" .value="${this._creating.type}"
                            @sl-change="${e => this._creating = {...this._creating, type: e.target.value}}">
                            <sl-option value="bands">bands</sl-option>
                            <sl-option value="gradient">gradient</sl-option>
                            <sl-option value="enum">enum</sl-option>
                        </sl-select>
                    </div>
                    <div class="create-actions">
                        <button class="primary"
                            ?disabled="${!this._creating.name.trim() || this._ranges.some(r => r.name === this._creating.name.trim())}"
                            @click="${() => this._create()}">Create</button>
                        <button @click="${() => this._creating = null}">Cancel</button>
                    </div>
                </div>
            ` : html`
                <button class="new-btn" @click="${() => this.startCreate()}">+ New colour range</button>
            `}
        `;
    }
}

window.customElements.define('feezal-sidebar-color-ranges', FeezalSidebarColorRanges);

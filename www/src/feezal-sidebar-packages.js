/* global feezal */
import {LitElement, html, css} from 'lit';

/**
 * feezal-sidebar-packages (N4) — Package Manager sidebar tab.
 *
 * Search the npm registry for feezal add-on packages (elements / themes /
 * element sets), install / update / remove them. Installs are one blocking
 * server step (npm + bundle); the server emits `elementsChanged` and the
 * panel offers a reload to pick up the new package. N29: installing a
 * feezal-elements-* set expands it into its member elements server-side;
 * installed members are grouped (indented) under their set row, and removing
 * the set removes its members.
 */
const TYPES = [
    {key: 'all',     label: 'All'},
    {key: 'element', label: 'Elements'},
    {key: 'theme',   label: 'Themes'},
    {key: 'bundle',  label: 'Sets'},
];

// N29: 'bundle' is the wire name; show it as "set" to users.
const typeLabel = t => (t === 'bundle' ? 'set' : t);

class FeezalSidebarPackages extends LitElement {
    static properties = {
        _filter:    {state: true},
        _query:     {state: true},
        _results:   {state: true},
        _installed: {state: true},
        _busy:      {state: true},   // package name currently working, 'search', or ''
        _output:    {state: true},
        _error:     {state: true},
        _dirty:     {state: true},   // something changed → offer reload
    };

    static styles = css`
        :host { display: block; height: 100%; overflow: auto; font-size: 12px;
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #333); padding: 8px; box-sizing: border-box; }
        .seg { display: flex; gap: 2px; background: var(--feezal-bg-sub, #eee); border-radius: 6px; padding: 2px; margin-bottom: 8px; }
        .seg button { flex: 1; border: none; background: none; color: inherit; font: inherit; font-size: 11px; padding: 4px; border-radius: 4px; cursor: pointer; }
        .seg button.on { background: var(--feezal-bg, #fff); font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.12); }
        .searchbar { display: flex; gap: 6px; margin-bottom: 8px; }
        .searchbar input { flex: 1; min-width: 0; padding: 5px 7px; font: inherit; box-sizing: border-box;
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #333); border: 1px solid var(--feezal-border, #ccc); border-radius: 5px; }
        .btn { border: 1px solid var(--feezal-border, #ccc); background: var(--feezal-bg, #fff); color: var(--feezal-color, #333);
            border-radius: 5px; padding: 4px 9px; font: inherit; font-size: 11px; cursor: pointer; white-space: nowrap; }
        .btn:hover { background: var(--feezal-btn-hover, rgba(0,0,0,0.06)); }
        .btn.primary { background: var(--sl-color-primary-600, #0284c7); border-color: var(--sl-color-primary-600, #0284c7); color: #fff; }
        .btn.danger:hover { color: #c62828; border-color: #c62828; }
        .btn:disabled { opacity: 0.5; cursor: default; }
        h4 { margin: 12px 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; }
        .row { display: flex; align-items: center; gap: 6px; padding: 6px; border: 1px solid var(--feezal-border, #e0e0e0); border-radius: 6px; margin-bottom: 5px; }
        .row.member { margin-left: 14px; }
        .row .meta { flex: 1; min-width: 0; }
        .row .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .row .name a { color: inherit; text-decoration: none; }
        .row .sub { font-size: 10px; opacity: 0.6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .chip { flex: 0 0 auto; font-size: 9px; padding: 1px 5px; border-radius: 8px; background: rgba(2,132,199,0.16); color: var(--sl-color-primary-700, #0369a1); }
        .badge { flex: 0 0 auto; font-size: 10px; color: var(--sl-color-warning-700, #b45309); }
        .empty, .hint { opacity: 0.6; font-size: 11px; padding: 4px 2px; line-height: 1.4; }
        .error { color: var(--sl-color-danger-600, #d32f2f); font-size: 11px; margin: 6px 0; }
        .reload { display: flex; align-items: center; gap: 8px; background: rgba(2,132,199,0.12); border: 1px solid rgba(2,132,199,0.4);
            border-radius: 6px; padding: 6px 8px; margin: 8px 0; font-size: 11px; }
        .reload .spacer { flex: 1; }
        pre.out { background: rgba(127,127,127,0.10); border: 1px solid var(--feezal-border, rgba(127,127,127,0.28)); border-radius: 6px;
            padding: 6px 8px; margin: 8px 0 0; font-size: 10px; max-height: 160px; overflow: auto; white-space: pre-wrap; }
        .spin { display: inline-block; width: 12px; height: 12px; border: 2px solid currentColor; border-right-color: transparent;
            border-radius: 50%; animation: feezal-spin 0.7s linear infinite; }
        @keyframes feezal-spin { to { transform: rotate(360deg); } }
    `;

    constructor() {
        super();
        this._filter = 'all';
        this._query = '';
        this._results = [];
        this._installed = [];
        this._busy = '';
        this._output = '';
        this._error = '';
        this._dirty = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this._loadInstalled();
    }

    async _loadInstalled() {
        try {
            const res = await fetch('/api/elements');
            const data = await res.json();
            this._installed = data.packages || [];
        } catch { /* leave as-is */ }
    }

    async _search() {
        const text = this._query.trim();
        this._error = '';
        this._busy = 'search';
        try {
            const type = this._filter === 'all' ? '' : `&type=${this._filter}`;
            const res = await fetch(`/api/elements/search?text=${encodeURIComponent(text)}${type}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'search failed');
            this._results = data.results || [];
        } catch (err) {
            this._error = err.message;
            this._results = [];
        } finally {
            this._busy = '';
        }
    }

    async _act(url, body, name) {
        this._error = '';
        this._output = '';
        this._busy = name;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            this._output = [data.stdout, data.stderr].filter(Boolean).join('\n').trim();
            if (!res.ok || data.ok === false) throw new Error(data.error || 'operation failed');
            this._dirty = true;
            await this._loadInstalled();
        } catch (err) {
            this._error = err.message;
        } finally {
            this._busy = '';
        }
    }

    _install(pkg)  { return this._act('/api/elements', {package: pkg.name, version: pkg.version}, pkg.name); }
    _update(pkg)   { return this._act('/api/elements/update', {package: pkg.name}, pkg.name); }
    _remove(pkg)   { return this._act('/api/elements/remove', {package: pkg.name}, pkg.name); }

    _isInstalled(name) { return this._installed.some(p => p.name === name); }

    /**
     * Installed rows for the active filter. In the All and Sets views, set
     * members are grouped (indented) under their set instead of listed
     * top-level; type filters stay flat so e.g. Elements shows every element.
     * A member whose set is no longer installed is shown top-level.
     */
    _installedView() {
        const all = this._installed;
        if (this._filter !== 'all' && this._filter !== 'bundle') {
            return all.filter(p => p.type === this._filter).map(p => ({p, member: false}));
        }
        const bundles = new Set(all.filter(p => p.type === 'bundle').map(p => p.name));
        const top = all.filter(p => !(p.set && bundles.has(p.set)));
        const rows = [];
        for (const p of (this._filter === 'bundle' ? top.filter(t => t.type === 'bundle') : top)) {
            rows.push({p, member: false});
            if (p.type === 'bundle') {
                all.filter(m => m.set === p.name).forEach(m => rows.push({p: m, member: true}));
            }
        }
        return rows;
    }

    render() {
        const installed = this._installedView();
        const results = this._results.filter(r => !this._isInstalled(r.name));
        return html`
            <div class="seg">
                ${TYPES.map(t => html`<button class="${this._filter === t.key ? 'on' : ''}"
                    @click="${() => { this._filter = t.key; this._results = []; }}">${t.label}</button>`)}
            </div>

            <div class="searchbar">
                <input placeholder="Search npm for feezal packages…" .value="${this._query}"
                    @input="${e => { this._query = e.target.value; }}"
                    @keydown="${e => { if (e.key === 'Enter') this._search(); }}">
                <button class="btn" ?disabled="${this._busy === 'search'}" @click="${this._search}">
                    ${this._busy === 'search' ? html`<span class="spin"></span>` : 'Search'}
                </button>
            </div>

            ${this._error ? html`<div class="error">${this._error}</div>` : ''}

            ${this._dirty ? html`
                <div class="reload">
                    <span>Reload to load the changed packages.</span>
                    <span class="spacer"></span>
                    <button class="btn primary" @click="${() => location.reload()}">Reload</button>
                </div>` : ''}

            ${results.length ? html`
                <h4>Search results</h4>
                ${results.map(r => this._resultRow(r))}` : ''}

            <h4>Installed${this._filter !== 'all' ? ` · ${typeLabel(this._filter)}s` : ''}</h4>
            ${installed.length
                ? installed.map(({p, member}) => this._installedRow(p, member))
                : html`<div class="empty">No packages installed${this._filter !== 'all' ? ` of this type` : ''} yet.</div>`}

            ${this._output ? html`<pre class="out">${this._output}</pre>` : ''}
        `;
    }

    _resultRow(r) {
        const busy = this._busy === r.name;
        return html`
            <div class="row">
                <div class="meta">
                    <div class="name">${r.name}</div>
                    <div class="sub">${r.version} · ${r.description || r.author || ''}</div>
                </div>
                <span class="chip">${typeLabel(r.type)}</span>
                <button class="btn primary" ?disabled="${!!this._busy}" @click="${() => this._install(r)}">
                    ${busy ? html`<span class="spin"></span>` : 'Install'}
                </button>
            </div>`;
    }

    _installedRow(p, member = false) {
        const busy = this._busy === p.name;
        const outdated = p.latest && p.latest !== p.version;
        const isBundle = p.type === 'bundle';
        return html`
            <div class="row ${member ? 'member' : ''}">
                <div class="meta">
                    <div class="name"><a href="https://www.npmjs.com/package/${p.name}" target="_blank" rel="noopener noreferrer">${p.name}</a></div>
                    <div class="sub">${p.version} · ${typeLabel(p.type)}</div>
                </div>
                ${outdated ? html`<span class="badge" title="Update available">→ ${p.latest}</span>` : ''}
                ${outdated ? html`<button class="btn" ?disabled="${!!this._busy}" @click="${() => this._update(p)}">
                    ${busy ? html`<span class="spin"></span>` : 'Update'}</button>` : ''}
                <button class="btn danger" ?disabled="${!!this._busy}"
                    title="${isBundle ? 'Removes the set and its member elements' : ''}"
                    @click="${() => this._remove(p)}">
                    ${busy ? html`<span class="spin"></span>` : 'Remove'}
                </button>
            </div>`;
    }
}

customElements.define('feezal-sidebar-packages', FeezalSidebarPackages);
export {FeezalSidebarPackages};

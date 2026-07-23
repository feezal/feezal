/* global feezal */
import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js';
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';

import {stampDiscovery, resolveElementTag, layoutGrid, knownComponents, discoveryLabel} from './feezal-discovery-stamp.js';

/**
 * U58 — the **Generate** wizard: a bulk element + app scaffold from MQTT
 * discovery, reached from the top-bar Generate button.
 *
 * Phase ① (this file) ships the **Devices** tile: pick a style family, tick
 * the discovered devices you want, and one pre-wired element per device is
 * dropped onto the current view in a deterministic auto-grid. Append-only with
 * a `discovery-id` dupe-guard (a device already on the view is skipped, never
 * duplicated); families that lack an element for a device's function are
 * skipped-and-reported (parity gap), never silently dropped.
 *
 * The stamping, tag resolution and grid packing are the shared headless
 * primitives in feezal-discovery-stamp.js — the same wiring the ⚡ per-element
 * picker applies. This component is only the UI + orchestration.
 *
 * The **App** tile is Phase ② (deferred) and renders as a disabled tile.
 */

// The only families the Devices wizard offers, in this exact order. A family is
// shown only if it actually ships at least one discovery element (so an empty
// family never appears). No other family is offered, whatever it ships.
const FAMILY_ORDER = ['glass', 'metro', 'circle', 'eink', 'basic', 'material'];
const FAMILY_LABELS = {glass: 'Glass', metro: 'Metro', circle: 'Circle', eink: 'E-ink', basic: 'Basic', material: 'Material'};

class FeezalGenerateDialog extends LitElement {
    static properties = {
        _stage:   {state: true},   // 'tiles' | 'devices' | 'result'
        _loading: {state: true},
        _error:   {state: true},
        _family:  {state: true},
        _filter:  {state: true},
        _checked: {state: true},   // Set<string> of entity keys
        _result:  {state: true},   // {added, view, skippedNoElem:[], skippedDupe:[]}
    };

    static styles = css`
        sl-dialog { --width: 720px; --sl-z-index-dialog: 20002; }
        sl-dialog::part(body) { padding-top: 8px; }

        /* ── tile chooser (Windows-Start style) ─────────────────────────── */
        .tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 8px 0; }
        .tile {
            display: flex; flex-direction: column; gap: 8px; align-items: flex-start;
            padding: 22px 20px; border-radius: 10px; cursor: pointer; text-align: left;
            border: 1px solid var(--feezal-tile-border, #e2e8f0);
            background: var(--feezal-tile-bg, #f8fafc);
            color: inherit; font: inherit;
            transition: background .12s, border-color .12s, transform .06s;
        }
        .tile:hover:not([disabled]) {
            background: var(--feezal-tile-hover, #eff6ff);
            border-color: var(--sl-color-primary-400, #38bdf8);
        }
        .tile:active:not([disabled]) { transform: translateY(1px); }
        .tile[disabled] { opacity: .5; cursor: default; }
        .tile .material-icons { font-size: 34px; color: var(--sl-color-primary-600, #0284c7); }
        .tile .t-title { font-size: 17px; font-weight: 600; }
        .tile .t-sub { font-size: 12.5px; opacity: .7; line-height: 1.35; }
        .tile .t-badge {
            margin-top: 4px; font-size: 10px; font-weight: 700; letter-spacing: .04em;
            text-transform: uppercase; padding: 2px 7px; border-radius: 10px;
            background: var(--feezal-badge-bg, #e2e8f0); color: var(--feezal-badge-fg, #64748b);
        }

        /* ── devices stage ──────────────────────────────────────────────── */
        .dev-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
        .families { display: inline-flex; border-radius: 8px; overflow: hidden; border: 1px solid var(--feezal-tile-border, #e2e8f0); }
        .families button {
            font: inherit; font-size: 13px; padding: 6px 13px; border: 0; cursor: pointer;
            background: var(--feezal-tile-bg, #f8fafc); color: inherit;
            border-right: 1px solid var(--feezal-tile-border, #e2e8f0);
        }
        .families button:last-child { border-right: 0; }
        .families button.sel {
            background: var(--sl-color-primary-600, #0284c7); color: #fff; font-weight: 600;
        }
        .dev-head sl-input { flex: 1; min-width: 160px; }
        .dev-count { font-size: 12.5px; opacity: .7; margin-left: auto; white-space: nowrap; }

        /* Fixed-height scroll area so the popup keeps its size while filtering
           (the loading / empty / list states all live inside it). */
        .dev-body { height: 46vh; overflow-y: auto; margin: 0 -4px; padding: 0 4px; }
        .groups { }
        .group-hd {
            display: flex; align-items: center; gap: 8px; position: sticky; top: 0;
            background: var(--feezal-dialog-bg, #fff); padding: 8px 2px 4px;
            font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase;
            opacity: .78; z-index: 1;
        }
        .group-hd label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
        .group-hd .g-count { font-weight: 400; opacity: .7; text-transform: none; letter-spacing: 0; }
        .row {
            display: flex; align-items: center; gap: 9px; padding: 5px 8px; border-radius: 6px;
            font-size: 13px; cursor: pointer;
        }
        .row:hover { background: var(--feezal-tile-hover, #eff6ff); }
        .row[data-gap] { cursor: default; opacity: .5; }
        .row[data-gap]:hover { background: transparent; }
        .row .r-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .row .r-badge {
            font-size: 10px; padding: 1px 6px; border-radius: 9px; flex: 0 0 auto;
            background: var(--feezal-badge-bg, #e2e8f0); color: var(--feezal-badge-fg, #64748b);
        }
        .row .r-gap { font-size: 11px; color: var(--sl-color-warning-600, #d97706); flex: 0 0 auto; }

        .empty { padding: 30px; text-align: center; opacity: .6; font-size: 13px; }
        .loading { display: flex; align-items: center; gap: 12px; padding: 24px; font-size: 13px; opacity: .8; }

        /* ── result stage ───────────────────────────────────────────────── */
        .result-ok { display: flex; align-items: center; gap: 10px; font-size: 15px; margin: 6px 0 14px; }
        .result-ok .material-icons { color: var(--sl-color-success-600, #16a34a); font-size: 26px; }
        .skip-block { margin-top: 10px; font-size: 13px; }
        .skip-block h4 { margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; opacity: .7; }
        .skip-block ul { margin: 0; padding-left: 18px; opacity: .85; }

        .footer { display: flex; gap: 8px; justify-content: flex-end; }
        .footer .spacer { flex: 1; }
        /* Default (Cancel) button hover — draw from the editor tokens instead of
           Shoelace's light neutral, which reads as white in dark mode. */
        sl-button[variant='default']::part(base):hover {
            background-color: var(--feezal-btn-hover, var(--sl-color-primary-50, #f0f9ff));
            border-color: var(--feezal-btn-hover-border, var(--sl-color-primary-300, #7dd3fc));
            color: var(--feezal-btn-hover-color, var(--sl-color-primary-700, #0369a1));
        }

        /* Material Icons ligature font — the class must be declared inside this
           shadow root (the @font-face itself is document-global and pierces the
           boundary); without this rule the icon names render as literal text. */
        .material-icons {
            font-family: 'Material Icons';
            font-weight: normal; font-style: normal;
            font-size: inherit; line-height: 1; letter-spacing: normal; text-transform: none;
            display: inline-block; white-space: nowrap; word-wrap: normal; direction: ltr;
            -webkit-font-feature-settings: 'liga'; font-feature-settings: 'liga';
            -webkit-font-smoothing: antialiased;
        }

        /* sl-checkbox follows the editor dark tokens (piped in from app-editor);
           the row's checkbox is display-only — the whole row handles the click. */
        .row sl-checkbox, .group-hd sl-checkbox { flex: 0 0 auto; }
        .row sl-checkbox { pointer-events: none; }
        .g-toggle { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
    `;

    constructor() {
        super();
        this._stage = 'tiles';
        this._loading = false;
        this._error = null;
        this._family = 'glass';
        this._filter = '';
        this._checked = new Set();
        this._result = null;
        this.__devices = [];
    }

    /** Open the wizard at the tile chooser. */
    open() {
        this._stage = 'tiles';
        this._error = null;
        this._filter = '';
        this._checked = new Set();
        this._result = null;
        // Default the family to the first available one.
        const fams = this._availableFamilies();
        if (fams.length && !fams.includes(this._family)) this._family = fams[0];
        this.requestUpdate();
        this.updateComplete.then(() => this.renderRoot.querySelector('sl-dialog')?.show());
    }

    _close() { this.renderRoot.querySelector('sl-dialog')?.hide(); }

    // The whitelisted families (FAMILY_ORDER) that ship ≥1 discovery element,
    // in the whitelist's exact order. No non-whitelisted family is ever offered.
    _availableFamilies() {
        const withDiscovery = new Set();
        for (const pkg of (window.feezal?.elements || [])) {
            const tag = pkg.replace(/^@[^/]+\//, '');
            const m = /^feezal-element-([a-z0-9]+)-(.+)$/.exec(tag);
            if (!m) continue;
            const cls = window.customElements.get(tag);
            if (cls?.feezal?.discovery) withDiscovery.add(m[1]);
        }
        return FAMILY_ORDER.filter(f => withDiscovery.has(f));
    }

    async _chooseDevices() {
        this._stage = 'devices';
        this._loading = true;
        this._error = null;
        this.requestUpdate();
        try {
            const res = await fetch('/api/discovery/devices');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const known = new Set(knownComponents());
            const list = (data.devices || []).filter(e => known.has(e.component));
            // Stable per-entity key: discovery_id is unique when present; fall
            // back to a synthetic composite for the rare id-less entity.
            list.forEach((e, i) => { e.__key = e.discovery_id || `${e.component}:${this._label(e)}:${i}`; });
            this.__devices = list;
        } catch (err) {
            this._error = String(err.message || err);
            this.__devices = [];
        }
        this._loading = false;
        this.requestUpdate();
    }

    // Friendly, distinguishable label — the shared ⚡ picker label, so a
    // multi-attribute z2m device shows one distinguishable row per attribute.
    _label(entity) {
        return discoveryLabel(entity) || '(device)';
    }

    _groupOf(entity) { return entity.sourceLabel || 'MQTT Discovery'; }

    // The entity's resolved element tag in the current family, or null (parity gap).
    _tagFor(entity) {
        return resolveElementTag(entity.component, this._family, entity.config?.device_class);
    }

    // Devices matching the filter, grouped by source (only generatable rows).
    _grouped() {
        const q = this._filter.trim().toLowerCase();
        const groups = new Map();
        for (const e of this.__devices) {
            if (q && !this._label(e).toLowerCase().includes(q) && !(e.component || '').includes(q)) continue;
            const g = this._groupOf(e);
            if (!groups.has(g)) groups.set(g, []);
            groups.get(g).push(e);
        }
        for (const arr of groups.values()) arr.sort((a, b) => this._label(a).localeCompare(this._label(b)));
        return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }

    _toggle(key) {
        const next = new Set(this._checked);
        next.has(key) ? next.delete(key) : next.add(key);
        this._checked = next;
    }

    // Toggle every generatable (non-gap) row in a group.
    _toggleGroup(entities) {
        const eligible = entities.filter(e => this._tagFor(e));
        const allOn = eligible.length > 0 && eligible.every(e => this._checked.has(e.__key));
        const next = new Set(this._checked);
        for (const e of eligible) allOn ? next.delete(e.__key) : next.add(e.__key);
        this._checked = next;
    }

    // Count of selected rows that will actually generate in the current family.
    _selectableCount() {
        let n = 0;
        for (const e of this.__devices) {
            if (this._checked.has(e.__key) && this._tagFor(e)) n++;
        }
        return n;
    }

    _generate() {
        const view = feezal.view;
        if (!view) { this._error = 'No active view.'; this.requestUpdate(); return; }

        const existing = new Set(
            [...view.children].map(c => c.getAttribute?.('discovery-id')).filter(Boolean)
        );
        const chosen = this.__devices.filter(e => this._checked.has(e.__key));

        const toCreate = [];
        const skippedDupe = [];
        const skippedNoElem = [];
        for (const entity of chosen) {
            const tag = this._tagFor(entity);
            if (!tag) { skippedNoElem.push(entity); continue; }
            if (entity.discovery_id && existing.has(entity.discovery_id)) { skippedDupe.push(entity); continue; }
            toCreate.push({entity, tag});
        }

        // Uniform cell from the resolved tags' defaultStyle (largest wins).
        let cellW = 0;
        let cellH = 0;
        for (const {tag} of toCreate) {
            const ds = window.customElements.get(tag)?.feezal?.defaultStyle || {};
            cellW = Math.max(cellW, parseFloat(ds.width) || 100);
            cellH = Math.max(cellH, parseFloat(ds.height) || 100);
        }
        const absolute = view.childPosition !== 'flow';
        const positions = absolute
            ? layoutGrid(toCreate.length, {cellW, cellH, viewWidth: view.clientWidth || 1200})
            : [];

        toCreate.forEach(({entity, tag}, i) => {
            const el = document.createElement(tag);
            view.append(el);
            feezal.editor.initElem(el, true);   // applies defaultStyle
            stampDiscovery(el, entity);
            if (absolute && positions[i]) {
                el.style.left = positions[i].left + 'px';
                el.style.top = positions[i].top + 'px';
            }
        });

        if (toCreate.length) feezal.app.change();

        this._result = {
            added: toCreate.length,
            view: view.getAttribute('name') || view.name || 'view',
            skippedNoElem,
            skippedDupe,
        };
        this._stage = 'result';
        this.requestUpdate();
    }

    render() {
        return html`
            <sl-dialog label="${this._dialogTitle()}" @sl-request-close="${e => { if (e.detail.source === 'overlay') e.preventDefault(); }}">
                ${this._stage === 'tiles' ? this._renderTiles()
                    : this._stage === 'devices' ? this._renderDevices()
                    : this._renderResult()}
            </sl-dialog>
        `;
    }

    _dialogTitle() {
        if (this._stage === 'devices') return 'Generate — Devices';
        if (this._stage === 'result') return 'Generate — Done';
        return 'Generate';
    }

    _renderTiles() {
        return html`
            <div class="tiles">
                <button class="tile" @click="${this._chooseDevices}">
                    <span class="material-icons">grid_view</span>
                    <span class="t-title">Devices</span>
                    <span class="t-sub">One pre-wired element per discovered device, dropped onto the current view in a grid.</span>
                </button>
                <button class="tile" disabled>
                    <span class="material-icons">dashboard</span>
                    <span class="t-title">App</span>
                    <span class="t-sub">A Menu view with per-room sub-views wired into a navigation app.</span>
                    <span class="t-badge">Coming soon</span>
                </button>
            </div>
        `;
    }

    _renderDevices() {
        const fams = this._availableFamilies();
        const count = this._selectableCount();
        return html`
            <div class="dev-head">
                <div class="families">
                    ${fams.map(f => html`
                        <button class="${f === this._family ? 'sel' : ''}" @click="${() => { this._family = f; }}">
                            ${FAMILY_LABELS[f] || f}
                        </button>`)}
                </div>
                <sl-input size="small" clearable placeholder="Filter devices…"
                    value="${this._filter}"
                    @sl-input="${e => { this._filter = e.target.value; }}"></sl-input>
                <span class="dev-count">${count} selected</span>
            </div>

            <div class="dev-body">
                ${this._loading ? html`<div class="loading"><sl-spinner></sl-spinner> Loading discovered devices…</div>`
                    : this._error ? html`<div class="empty">Could not load devices: ${this._error}</div>`
                    : this._renderGroups()}
            </div>

            <div slot="footer" class="footer">
                <sl-button variant="text" @click="${() => { this._stage = 'tiles'; }}">Back</sl-button>
                <span class="spacer"></span>
                <sl-button @click="${this._close}">Cancel</sl-button>
                <sl-button variant="primary" ?disabled="${count === 0}" @click="${this._generate}">
                    Generate ${count} element${count === 1 ? '' : 's'}
                </sl-button>
            </div>
        `;
    }

    _renderGroups() {
        const groups = this._grouped();
        if (!groups.length) return html`<div class="empty">No matching devices.</div>`;
        return html`
            <div class="groups">
                ${groups.map(([name, entities]) => {
                    const eligible = entities.filter(e => this._tagFor(e));
                    const someOn = eligible.some(e => this._checked.has(e.__key));
                    const allOn = eligible.length > 0 && eligible.every(e => this._checked.has(e.__key));
                    return html`
                        <div class="group-hd">
                            <span class="g-toggle" style="${eligible.length ? '' : 'cursor:default'}"
                                @click="${() => eligible.length && this._toggleGroup(entities)}">
                                <sl-checkbox ?checked="${allOn}" ?indeterminate="${someOn && !allOn}"
                                    ?disabled="${!eligible.length}" style="pointer-events:none"></sl-checkbox>
                                ${name}
                            </span>
                            <span class="g-count">${eligible.length}/${entities.length}</span>
                        </div>
                        ${entities.map(e => this._renderRow(e))}
                    `;
                })}
            </div>
        `;
    }

    _renderRow(entity) {
        const tag = this._tagFor(entity);
        if (!tag) {
            return html`
                <div class="row" data-gap>
                    <span style="width:15px"></span>
                    <span class="r-label">${this._label(entity)}</span>
                    <span class="r-badge">${entity.component}</span>
                    <span class="r-gap" title="No ${FAMILY_LABELS[this._family] || this._family} element for this function">no ${FAMILY_LABELS[this._family] || this._family} version</span>
                </div>`;
        }
        const on = this._checked.has(entity.__key);
        return html`
            <div class="row" @click="${() => this._toggle(entity.__key)}">
                <sl-checkbox ?checked="${on}"></sl-checkbox>
                <span class="r-label">${this._label(entity)}</span>
                <span class="r-badge">${entity.component}</span>
            </div>`;
    }

    _renderResult() {
        const r = this._result || {added: 0, skippedNoElem: [], skippedDupe: []};
        // Group the parity gaps by component for a compact report.
        const byComp = {};
        for (const e of r.skippedNoElem) byComp[e.component] = (byComp[e.component] || 0) + 1;
        return html`
            <div class="result-ok">
                <span class="material-icons">check_circle</span>
                <span>Added <b>${r.added}</b> element${r.added === 1 ? '' : 's'} to “${r.view}”.</span>
            </div>
            ${r.skippedDupe.length ? html`
                <div class="skip-block">
                    <h4>Already on this view (${r.skippedDupe.length})</h4>
                    <ul>${r.skippedDupe.slice(0, 8).map(e => html`<li>${this._label(e)}</li>`)}
                        ${r.skippedDupe.length > 8 ? html`<li>…and ${r.skippedDupe.length - 8} more</li>` : ''}</ul>
                </div>` : ''}
            ${r.skippedNoElem.length ? html`
                <div class="skip-block">
                    <h4>No ${FAMILY_LABELS[this._family] || this._family} element (${r.skippedNoElem.length})</h4>
                    <ul>${Object.entries(byComp).map(([c, n]) => html`<li>${c} × ${n}</li>`)}</ul>
                </div>` : ''}
            <div slot="footer" class="footer">
                <sl-button variant="text" @click="${this._chooseDevices}">Pick more</sl-button>
                <span class="spacer"></span>
                <sl-button variant="primary" @click="${this._close}">Done</sl-button>
            </div>
        `;
    }
}

window.customElements.define('feezal-generate-dialog', FeezalGenerateDialog);
export {FeezalGenerateDialog};

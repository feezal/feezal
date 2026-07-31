/* global feezal */
import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js';
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';

import {stampDiscovery, resolveElementTag, layoutGrid, knownComponents, discoveryLabel,
    groupForApp, slugifyViewName, UNKNOWN_ROOM} from './feezal-discovery-stamp.js';
import {RangeSelect} from './feezal-range-select.js';

// U71: bundled family preview screenshots (A25 self-hosted — Vite emits each as
// a hashed asset in the editor chunk, not inlined). Drop a `<family>.png` into
// ./family-shots and add it here to illustrate that family; families without an
// image fall back to the label + a placeholder tile.
import glassShot from './family-shots/glass.png';
import metroShot from './family-shots/metro.png';
import circleShot from './family-shots/circle.png';
const FAMILY_SHOTS = {glass: glassShot, metro: metroShot, circle: circleShot};

// U70: the sentinel option value that opens the "new room" dialog.
const NEW_ROOM = '__feezal_new_room__';

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

// U67: is a discovery entity HA housekeeping (linkquality, last_seen, OTA
// update, RSSI, …) rather than a device function? HA marks these
// entity_category diagnostic|config, and z2m sets enabled_by_default:false on
// the ones hidden by default. Such rows are dropped from the wizard so a zigbee
// device offers only its functional entities.
function isDiagnostic(entity) {
    const cfg = entity?.config || {};
    return cfg.entity_category === 'diagnostic' || cfg.entity_category === 'config' ||
        cfg.enabled_by_default === false;
}

class FeezalGenerateDialog extends LitElement {
    static properties = {
        _stage:   {state: true},   // 'tiles' | 'devices' | 'app' | 'review' | 'result'
        _loading: {state: true},
        _error:   {state: true},
        _family:  {state: true},
        _filter:  {state: true},
        _checked: {state: true},   // Set<string> of entity keys
        _axis:    {state: true},   // App mode: 'room' | 'function'
        _assign:  {state: true},   // App review: Map<entityKey, {label, icon}>
        _result:  {state: true},   // {added, view, views?, skippedNoElem:[], skippedDupe:[]}
        _newRoomFor: {state: true},// U70: entity key awaiting a new-room name, or null
        _newRoomName: {state: true},
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
        /* no text selection: shift-click is range-select, not text-select. */
        .groups { user-select: none; -webkit-user-select: none; }
        .hint { font-size: 11px; opacity: .55; padding: 1px 4px 6px; }
        .hint b { font-weight: 700; opacity: .85; }
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

        /* ── App setup stage (U69: axis + family only) ──────────────────── */
        .app-setup { display: flex; flex-direction: column; gap: 14px; padding: 6px 0 4px; }
        .setup-row { display: flex; align-items: center; gap: 12px; }
        .setup-row.family-row { align-items: flex-start; }
        .setup-label { font-size: 12px; font-weight: 600; opacity: .7; width: 64px; flex: 0 0 auto; padding-top: 4px; }
        .setup-note { font-size: 12.5px; opacity: .75; margin-top: 2px; display: flex; align-items: center; gap: 8px; }

        /* U71: illustrated family picker — a thumbnail per family, selected one
           framed in the primary colour; families with no image fall back to a
           placeholder tile + the label. */
        .fam-gallery { display: flex; flex-wrap: wrap; gap: 10px; flex: 1; }
        .fam-card {
            display: flex; flex-direction: column; gap: 5px; width: 118px; padding: 6px;
            border: 2px solid transparent; border-radius: 9px; cursor: pointer;
            background: var(--feezal-tile-bg, #f8fafc); color: inherit; font: inherit;
            transition: border-color .12s, background .12s;
        }
        .fam-card:hover { background: var(--feezal-tile-hover, #eff6ff); }
        .fam-card.sel { border-color: var(--sl-color-primary-600, #0284c7); }
        .fam-shot {
            width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 5px;
            display: block; background: var(--feezal-badge-bg, #e2e8f0);
        }
        .fam-noshot { display: flex; align-items: center; justify-content: center; opacity: .45; }
        .fam-noshot .material-icons { font-size: 30px; }
        .fam-name { font-size: 12px; font-weight: 600; text-align: center; }
        .fam-card.sel .fam-name { color: var(--sl-color-primary-700, #0369a1); }

        /* U70: the new-room prompt stacks above the wizard dialog. */
        sl-dialog.newroom { --width: 340px; --sl-z-index-dialog: 20005; }

        /* ── App review stage ───────────────────────────────────────────── */
        .review-hint { font-size: 12.5px; opacity: .75; margin: 0 0 10px; line-height: 1.45; }
        .bucket { margin-bottom: 14px; }
        .bucket-hd {
            display: flex; align-items: center; gap: 8px; position: sticky; top: 0; z-index: 1;
            background: var(--feezal-dialog-bg, #fff); padding: 6px 2px 4px;
        }
        .bucket-hd .material-icons { font-size: 20px; opacity: .7; }
        .bucket-hd sl-input { width: 220px; }
        .row .r-move {
            font: inherit; font-size: 12px; max-width: 150px; flex: 0 0 auto;
            background: var(--sl-input-background-color, #fff);
            color: var(--sl-input-color, inherit);
            border: 1px solid var(--sl-input-border-color, #d0d0d0); border-radius: 5px;
            padding: 2px 4px;
        }

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
        this._axis = 'room';
        this._assign = new Map();
        this._result = null;
        this._newRoomFor = null;
        this._newRoomName = '';
        this.__devices = [];
        // U68: one range/drag selection helper for BOTH lists (device + review).
        this._sel = new RangeSelect({
            selection: () => this._checked,
            commit: s => { this._checked = s; },
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._endDrag();   // never leave window listeners behind
    }

    /** Open the wizard at the tile chooser. */
    open() {
        this._stage = 'tiles';
        this._error = null;
        this._filter = '';
        this._checked = new Set();
        this._sel.reset();
        this._newRoomFor = null;
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

    async _chooseDevices() { await this._loadInto('devices'); }

    async _chooseApp() { await this._loadInto('app'); }

    async _loadInto(stage) {
        this._stage = stage;
        this._loading = true;
        this._error = null;
        this.requestUpdate();
        try {
            const res = await fetch('/api/discovery/devices');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const known = new Set(knownComponents());
            // U67: drop HA housekeeping entities (z2m linkquality / last_seen /
            // OTA update, …). HA flags them entity_category diagnostic|config
            // (ent_cat → entity_category, expanded server-side) or
            // enabled_by_default:false — none are a device's primary function.
            // A multi-function device still yields one row per FUNCTIONAL entity.
            const list = (data.devices || []).filter(e => known.has(e.component) && !isDiagnostic(e));
            // Stable per-entity key: discovery_id is unique when present; fall
            // back to a synthetic composite for the rare id-less entity.
            list.forEach((e, i) => { e.__key = e.discovery_id || `${e.component}:${this._label(e)}:${i}`; });
            // App mode: join the device-group areas (E161 suggested_area) onto
            // the entities — the TRUSTED room signal, beating the lexicon.
            if (stage === 'app') {
                try {
                    const gr = await fetch('/api/discovery/device-groups');
                    const areas = new Map();
                    for (const g of (gr.ok ? (await gr.json()).groups : []) || []) {
                        if (g.area && g.deviceId) areas.set(g.deviceId, g.area);
                    }
                    for (const e of list) {
                        const devId = e.config?.device?.identifiers?.[0];
                        if (devId && areas.has(devId)) e.__area = areas.get(devId);
                    }
                } catch { /* no groups endpoint → lexicon only */ }
            }
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

    // ── U68: range + drag selection, shared by the device list AND the review ──

    // The selectable row keys in the CURRENTLY visible order — the sequence a
    // Shift-range runs over. Devices/App-setup list: eligible rows grouped by
    // source. Review: every device in bucket order (review holds only resolvable
    // rows). Used by the range fill.
    _orderedEligibleKeys() {
        const keys = [];
        for (const [, entities] of this._grouped()) {
            for (const e of entities) if (this._tagFor(e)) keys.push(e.__key);
        }
        return keys;
    }

    _orderedReviewKeys() {
        const keys = [];
        for (const b of this._reviewBuckets()) for (const e of b.entities) keys.push(e.__key);
        return keys;
    }

    _currentOrder() {
        return this._stage === 'review' ? this._orderedReviewKeys() : this._orderedEligibleKeys();
    }

    // Pointer press on a row: apply the range/drag rule and arm a drag so the
    // press action paints onto any row the pointer then crosses.
    _selPress(ev, key) {
        ev.preventDefault();                       // no focus/selection flicker
        this._sel.press(ev, key, this._currentOrder());
        this.requestUpdate();
        if (this._dragMove) return;                // already armed this gesture
        this._dragMove = e => {
            const row = this.renderRoot.elementFromPoint(e.clientX, e.clientY)?.closest?.('.row[data-key]');
            if (row) { this._sel.paint(row.dataset.key); this.requestUpdate(); }
        };
        this._dragUp = () => this._endDrag();
        window.addEventListener('pointermove', this._dragMove);
        window.addEventListener('pointerup', this._dragUp);
    }

    _endDrag() {
        this._sel.end();
        if (this._dragMove) window.removeEventListener('pointermove', this._dragMove);
        if (this._dragUp) window.removeEventListener('pointerup', this._dragUp);
        this._dragMove = this._dragUp = null;
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

    // ── U58 Phase ②: App mode ────────────────────────────────────────────────

    /** U69: the review IS the selection. Every generatable device is bucketed
     * and starts CHECKED; the user unchecks the ones they don't want in the
     * review itself, so there is no separate flat device list. Nothing is
     * created before confirm — backing out leaves no trace. */
    _toReview() {
        const eligible = this.__devices.filter(e => this._tagFor(e));
        this._checked = new Set(eligible.map(e => e.__key));   // all selected by default
        this._sel.reset();
        const buckets = groupForApp(eligible, this._axis);
        const assign = new Map();
        this._bucketMeta = new Map();   // label → {order, guessed}
        for (const b of buckets) {
            this._bucketMeta.set(b.label, {order: b.order, guessed: b.guessed});
            for (const e of b.entities) assign.set(e.__key, {label: b.label, icon: b.icon});
        }
        this._assign = assign;
        this._stage = 'review';
    }

    // Toggle every device in a review bucket (its header checkbox).
    _toggleBucket(entities) {
        const allOn = entities.length > 0 && entities.every(e => this._checked.has(e.__key));
        const next = new Set(this._checked);
        for (const e of entities) allOn ? next.delete(e.__key) : next.add(e.__key);
        this._checked = next;
    }

    /** The review buckets, derived from the editable assignment map — rooms
     * locale-sorted (Unassigned last), functions in taxonomy order. */
    _reviewBuckets() {
        const byLabel = new Map();
        for (const e of this.__devices) {
            const a = this._assign.get(e.__key);
            if (!a) continue;
            if (!byLabel.has(a.label)) {
                const meta = this._bucketMeta?.get(a.label) || {};
                byLabel.set(a.label, {label: a.label, icon: a.icon,
                    order: meta.order ?? null, guessed: meta.guessed ?? false, entities: []});
            }
            byLabel.get(a.label).entities.push(e);
        }
        const arr = [...byLabel.values()];
        if (this._axis === 'function') {
            return arr.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.label.localeCompare(b.label));
        }
        return arr.sort((a, b) =>
            (a.label === UNKNOWN_ROOM) - (b.label === UNKNOWN_ROOM) ||
            a.label.localeCompare(b.label, undefined, {sensitivity: 'base'}));
    }

    /** Rename a bucket (same-name rename = merge). */
    _renameBucket(from, to) {
        const label = String(to || '').trim();
        if (!label || label === from) return;
        const next = new Map(this._assign);
        for (const [k, a] of next) {
            if (a.label === from) next.set(k, {...a, label});
        }
        this._assign = next;
    }

    /** Move one entity to another bucket — existing (copy its icon) or a brand
     * new room (default icon; the bucket springs into being from the assign). */
    _reassign(key, label) {
        const target = [...this._assign.values()].find(a => a.label === label);
        const next = new Map(this._assign);
        next.set(key, {label, icon: target?.icon || 'meeting_room'});
        this._assign = next;
    }

    // ── U70: "＋ Create new room" from a device's move-to-room dropdown ──
    _onReassignChange(key, value) {
        if (value === NEW_ROOM) {
            this._newRoomFor = key;
            this._newRoomName = '';
            this.updateComplete.then(() => this.renderRoot.querySelector('.newroom')?.show());
            this.requestUpdate();   // reset the <select> back to its real value
            return;
        }
        this._reassign(key, value);
    }

    _confirmNewRoom() {
        const label = String(this._newRoomName || '').trim();
        if (label && this._newRoomFor) this._reassign(this._newRoomFor, label);
        this._closeNewRoom();
    }

    _closeNewRoom() {
        this.renderRoot.querySelector('.newroom')?.hide();
        this._newRoomFor = null;
        this._newRoomName = '';
    }

    /** Unique view name (the buckets may collide with non-view names only). */
    _uniqueViewName(base, taken) {
        let name = base;
        let i = 2;
        while (taken.has(name)) name = `${base} ${i++}`;
        return name;
    }

    _generateApp() {
        const site = feezal.site;
        if (!site) { this._error = 'No site.'; this.requestUpdate(); return; }

        // ── the app shell: reuse an existing layout-app, else create Menu ──
        let shell = site.querySelector('feezal-element-layout-app');
        let shellView = shell?.closest('feezal-view') || null;
        const viewNames = new Set([...site.querySelectorAll('feezal-view')].map(v => v.getAttribute('name')));
        let createdShell = false;
        if (!shell) {
            const menuName = this._uniqueViewName('Menu', viewNames);
            shellView = document.createElement('feezal-view');
            shellView.setAttribute('name', menuName);
            shellView.style.width = '100%';
            shellView.style.height = '100%';
            site.append(shellView);
            viewNames.add(menuName);
            shell = document.createElement('feezal-element-layout-app');
            shellView.append(shell);
            feezal.editor.initElem(shell, true);
            // U67: the shell must fill its Menu view — the view is 100% above,
            // but the element keeps its defaultStyle fixed size otherwise.
            shell.style.width = '100%';
            shell.style.height = '100%';
            shell.setAttribute('title', site.getAttribute?.('name') || 'Home');
            // B84 three-zone chrome: overlay on phones, slim rail on tablets,
            // full drawer on desktop (rail-breakpoint keeps its default).
            shell.setAttribute('rail', 'auto');
            // U67: cap the content width so cards get several columns on a big
            // screen (520px pinned glass cards to two); still user-editable.
            // A small U50 inset keeps cards off the chrome.
            shell.style.setProperty('--feezal-app-content-max-width', '960px');
            shell.style.setProperty('--feezal-app-content-padding', '12px');
            createdShell = true;
        }

        // ── site-wide dupe guard: a device carded ANYWHERE is not re-added ──
        const existing = new Set(
            [...site.querySelectorAll('[discovery-id]')].map(el => el.getAttribute('discovery-id')).filter(Boolean)
        );

        const buckets = this._reviewBuckets();
        const skippedDupe = [];
        let added = 0;
        const createdViews = [];
        let items;
        try { items = JSON.parse(shell.getAttribute('items') || '[]'); } catch { items = []; }
        if (!Array.isArray(items)) items = [];
        const itemViews = new Set(items.map(it => it?.view).filter(Boolean));

        // Labels are human (drawer entries); view NAMES are slugs — they reach
        // the URL (#/<view>, B30). Slugs are stable per label, so re-runs merge
        // by name; a same-run collision of two labels gets a numeric suffix.
        const slugUsed = new Map();   // slug → label (this run)
        for (const bucket of buckets) {
            // U69: only the devices still checked in the review are generated;
            // a bucket the user emptied creates no view.
            const chosen = bucket.entities.filter(e => this._checked.has(e.__key));
            if (!chosen.length) continue;
            let slug = slugifyViewName(bucket.label);
            if (slugUsed.has(slug) && slugUsed.get(slug) !== bucket.label) {
                let i = 2;
                while (slugUsed.has(`${slug}-${i}`)) i++;
                slug = `${slug}-${i}`;
            }
            slugUsed.set(slug, bucket.label);
            bucket.slug = slug;
            // merge into a same-named view, create it only when missing
            let view = site.querySelector(`feezal-view[name="${slug}"]`);
            if (!view) {
                view = document.createElement('feezal-view');
                view.setAttribute('name', slug);
                view.setAttribute('child-position', 'flow');
                // U67: left-align — cards fill from the top-left as the row
                // grows rather than floating centered.
                view.setAttribute('flow-justify', 'start');
                view.style.width = '100%';
                view.style.height = '100%';
                site.append(view);
                createdViews.push(slug);
            }
            for (const entity of chosen) {
                if (entity.discovery_id && existing.has(entity.discovery_id)) { skippedDupe.push(entity); continue; }
                const tag = this._tagFor(entity);
                if (!tag) continue;   // review only holds resolvable rows, belt & braces
                const el = document.createElement(tag);
                view.append(el);
                feezal.editor.initElem(el, true);
                stampDiscovery(el, entity);
                if (entity.discovery_id) existing.add(entity.discovery_id);
                added++;
            }
            // wire the drawer entry (append-only, merge by view name)
            if (!itemViews.has(bucket.slug)) {
                items.push({label: bucket.label, icon: bucket.icon, view: bucket.slug});
                itemViews.add(bucket.slug);
            }
        }

        shell.setAttribute('items', JSON.stringify(items));
        if (!shell.getAttribute('active-view') && items.length) {
            shell.setAttribute('active-view', items[0].view);
        }

        // U67: the Menu (app shell) is the entry point, so make it the FIRST
        // tab in the viewer, its generated sub-views next (bucket order), and
        // push any pre-existing hand-made views to the end. Re-appending a view
        // moves it — the established pattern in this file.
        const genNames = new Set([shellView.getAttribute('name'),
            ...buckets.map(b => b.slug).filter(Boolean)]);
        const bucketViews = buckets.map(b => b.slug).filter(Boolean)
            .map(slug => site.querySelector(`feezal-view[name="${slug}"]`)).filter(Boolean);
        const preExisting = [...site.querySelectorAll('feezal-view')]
            .filter(v => !genNames.has(v.getAttribute('name')));
        const seen = new Set();
        for (const v of [shellView, ...bucketViews, ...preExisting]) {
            if (v && !seen.has(v)) { seen.add(v); site.append(v); }
        }

        feezal.app.views = [...site.querySelectorAll('feezal-view')];
        feezal.app.change();   // the whole scaffold = one undo entry

        // U67: Menu is now the first view, so it is the site/viewer default
        // (both resolve the default as views[0]); also SELECT it in the editor
        // so the canvas shows Menu when the result dialog closes.
        feezal.app._setView?.(shellView.getAttribute('name'));

        this._result = {
            added,
            app: true,
            createdShell,
            view: shellView?.getAttribute('name') || 'Menu',
            views: createdViews,
            skippedNoElem: [],
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
                    : this._stage === 'app' ? this._renderApp()
                    : this._stage === 'review' ? this._renderReview()
                    : this._renderResult()}
            </sl-dialog>

            <!-- U70: create a new room, stacked above the wizard (editor-dark aware). -->
            <sl-dialog class="newroom" label="New room"
                @sl-request-close="${e => { if (e.detail.source === 'overlay') e.preventDefault(); }}">
                <sl-input placeholder="Room name" autofocus value="${this._newRoomName}"
                    @sl-input="${e => { this._newRoomName = e.target.value; }}"
                    @keydown="${e => { if (e.key === 'Enter') { e.preventDefault(); this._confirmNewRoom(); } }}"></sl-input>
                <div slot="footer" class="footer">
                    <sl-button @click="${this._closeNewRoom}">Cancel</sl-button>
                    <sl-button variant="primary" ?disabled="${!this._newRoomName.trim()}"
                        @click="${this._confirmNewRoom}">Create</sl-button>
                </div>
            </sl-dialog>
        `;
    }

    _dialogTitle() {
        if (this._stage === 'devices') return 'Generate — Devices';
        if (this._stage === 'app') return 'Generate — App';
        if (this._stage === 'review') return `Generate — App: ${this._axis === 'room' ? 'rooms' : 'functions'}`;
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
                <button class="tile" @click="${this._chooseApp}">
                    <span class="material-icons">dashboard</span>
                    <span class="t-title">App</span>
                    <span class="t-sub">A Menu view with per-room (or per-function) sub-views wired into a navigation app.</span>
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

    /** App step 1 (U69): choose the axis + family only. The devices themselves
     * are picked on the review screen, so there is no flat list here. */
    _renderApp() {
        const fams = this._availableFamilies();
        const eligible = this.__devices.filter(e => this._tagFor(e)).length;
        return html`
            <div class="app-setup">
                <div class="setup-row">
                    <span class="setup-label">Group by</span>
                    <div class="families">
                        <button class="${this._axis === 'room' ? 'sel' : ''}" @click="${() => { this._axis = 'room'; }}">By room</button>
                        <button class="${this._axis === 'function' ? 'sel' : ''}" @click="${() => { this._axis = 'function'; }}">By function</button>
                    </div>
                </div>
                <div class="setup-row family-row">
                    <span class="setup-label">Family</span>
                    <div class="fam-gallery">
                        ${fams.map(f => html`
                            <button class="fam-card ${f === this._family ? 'sel' : ''}"
                                title="${FAMILY_LABELS[f] || f}" @click="${() => { this._family = f; }}">
                                ${FAMILY_SHOTS[f]
                                    ? html`<img class="fam-shot" src="${FAMILY_SHOTS[f]}" alt="${FAMILY_LABELS[f]} preview" loading="lazy">`
                                    : html`<span class="fam-shot fam-noshot"><span class="material-icons">dashboard</span></span>`}
                                <span class="fam-name">${FAMILY_LABELS[f] || f}</span>
                            </button>`)}
                    </div>
                </div>
                <div class="setup-note">
                    ${this._loading ? html`<sl-spinner style="font-size:14px"></sl-spinner> Loading discovered devices…`
                        : this._error ? html`Could not load devices: ${this._error}`
                        : eligible ? html`<b>${eligible}</b> device${eligible === 1 ? '' : 's'} discovered — pick which to include on the next screen.`
                        : html`No generatable devices discovered in the <b>${FAMILY_LABELS[this._family] || this._family}</b> family.`}
                </div>
            </div>

            <div slot="footer" class="footer">
                <sl-button variant="text" @click="${() => { this._stage = 'tiles'; }}">Back</sl-button>
                <span class="spacer"></span>
                <sl-button @click="${this._close}">Cancel</sl-button>
                <sl-button variant="primary" ?disabled="${!eligible}" @click="${this._toReview}">
                    Review ${this._axis === 'room' ? 'rooms' : 'functions'}…
                </sl-button>
            </div>
        `;
    }

    /** Review stage (U69): the selection surface. Every device starts checked;
     * uncheck to exclude (with the U68 range/drag select). Rename a bucket
     * (same name = merge), move a device with its dropdown or make a new room
     * (U70). A bucket with no checked device produces no view. */
    _renderReview() {
        const buckets = this._reviewBuckets();
        const labels = buckets.map(b => b.label);
        const checkedIn = b => b.entities.filter(e => this._checked.has(e.__key)).length;
        const totalChecked = buckets.reduce((n, b) => n + checkedIn(b), 0);
        const views = buckets.filter(b => checkedIn(b) > 0).length;
        const isRoom = this._axis === 'room';
        return html`
            <div class="review-hint">
                ${buckets.length} ${isRoom ? 'rooms' : 'groups'} · <b>${totalChecked}</b> of
                ${buckets.reduce((n, b) => n + b.entities.length, 0)} devices selected —
                <b>untick</b> what you don't want (hold <b>Shift</b> or drag for a range),
                rename to merge, or move a device with its dropdown. Each group becomes a
                sub-view in the app drawer.
            </div>
            <div class="dev-body groups">
                ${buckets.map(b => {
                    const on = checkedIn(b);
                    return html`
                    <div class="bucket">
                        <div class="bucket-hd">
                            <span class="g-toggle" @click="${() => this._toggleBucket(b.entities)}">
                                <sl-checkbox ?checked="${on === b.entities.length}"
                                    ?indeterminate="${on > 0 && on < b.entities.length}"
                                    style="pointer-events:none"></sl-checkbox>
                            </span>
                            <span class="material-icons">${b.icon}</span>
                            <sl-input size="small" value="${b.label}"
                                @sl-change="${e => this._renameBucket(b.label, e.target.value)}"></sl-input>
                            <span class="g-count">${on}/${b.entities.length}</span>
                            ${b.guessed && isRoom && b.label !== UNKNOWN_ROOM
                                ? html`<span class="r-badge" title="Room guessed from the device name — no explicit area">guessed</span>` : ''}
                        </div>
                        ${b.entities.map(e => html`
                            <div class="row" data-key="${e.__key}"
                                @pointerdown="${ev => this._selPress(ev, e.__key)}">
                                <sl-checkbox ?checked="${this._checked.has(e.__key)}"></sl-checkbox>
                                <span class="r-label">${this._label(e)}</span>
                                <span class="r-badge">${e.component}</span>
                                <select class="r-move" .value="${b.label}"
                                    @pointerdown="${ev => ev.stopPropagation()}"
                                    @change="${ev => this._onReassignChange(e.__key, ev.target.value)}">
                                    ${labels.map(l => html`<option value="${l}" ?selected="${l === b.label}">${l}</option>`)}
                                    ${isRoom ? html`<option value="${NEW_ROOM}">＋ Create new room…</option>` : ''}
                                </select>
                            </div>`)}
                    </div>`;
                })}
            </div>
            <div slot="footer" class="footer">
                <sl-button variant="text" @click="${() => { this._stage = 'app'; }}">Back</sl-button>
                <span class="spacer"></span>
                <sl-button @click="${this._close}">Cancel</sl-button>
                <sl-button variant="primary" ?disabled="${totalChecked === 0}" @click="${this._generateApp}">
                    Generate app (${views} view${views === 1 ? '' : 's'})
                </sl-button>
            </div>
        `;
    }

    _renderGroups() {
        const groups = this._grouped();
        if (!groups.length) return html`<div class="empty">No matching devices.</div>`;
        const totalEligible = groups.reduce((n, [, es]) => n + es.filter(e => this._tagFor(e)).length, 0);
        return html`
            <div class="groups">
                ${totalEligible > 1 ? html`<div class="hint">Tip: hold <b>Shift</b> and click to select a range.</div>` : ''}
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
            <div class="row" data-key="${entity.__key}"
                @pointerdown="${ev => this._selPress(ev, entity.__key)}">
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
        const summary = r.app
            ? html`<span>Added <b>${r.added}</b> element${r.added === 1 ? '' : 's'} across
                ${r.views.length ? html`<b>${r.views.length}</b> new view${r.views.length === 1 ? '' : 's'}
                    (${r.views.join(', ')})` : 'existing views'} —
                ${r.createdShell ? html`app shell created on “${r.view}”.` : html`wired into the existing app on “${r.view}”.`}</span>`
            : html`<span>Added <b>${r.added}</b> element${r.added === 1 ? '' : 's'} to “${r.view}”.</span>`;
        return html`
            <div class="result-ok">
                <span class="material-icons">check_circle</span>
                ${summary}
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
                <sl-button variant="text" @click="${() => (this._result?.app ? this._chooseApp() : this._chooseDevices())}">Pick more</sl-button>
                <span class="spacer"></span>
                <sl-button variant="primary" @click="${this._close}">Done</sl-button>
            </div>
        `;
    }
}

window.customElements.define('feezal-generate-dialog', FeezalGenerateDialog);
export {FeezalGenerateDialog};

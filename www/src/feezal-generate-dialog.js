/* global feezal */
import {LitElement, html, css} from 'lit';
import {repeat} from 'lit/directives/repeat.js';

import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js';
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';

import {stampDiscovery, resolveElementTag, layoutGrid, knownComponents, discoveryLabel,
    groupForApp, functionBucket, slugifyViewName, UNKNOWN_ROOM,
    assignRoom, lexiconWordsForLabel} from './feezal-discovery-stamp.js';
import {RangeSelect} from './feezal-range-select.js';
import './feezal-icon-input.js';   // U78: the shared icon picker for the room list

// U74: a generated app adopts the theme that matches its element family, so the
// result looks like the family's preview screenshot. Only families with a
// dedicated look are mapped; the rest keep the site's current theme.
const FAMILY_THEME = {
    glass:  'feezal-theme-midnight-blue',
    metro:  'feezal-theme-metro',
    circle: 'feezal-theme-gruvbox-light',
};

// U74: the feezal default gradient painted behind the frosted cards on every
// glass sub-view. Written EXACTLY as the Background style editor
// (feezal-style-editor-background) serialises a gradient — a `background-image`
// linear-gradient with `deg,` + `%` stops — so the inspector reflects it and
// the view renders it immediately (setting the `background` shorthand instead
// left the editor/renderer reading nothing until the user re-edited it).
const GLASS_GRADIENT = 'linear-gradient(180deg, #0284c7 0%, #1e293b 100%)';

// A generated app also gets a hidden "System" view (not in the drawer) holding
// the site-wide chrome elements — a boot splash and a connection-status
// overlay. Both hoist themselves to <body> in the viewer, so they work from an
// always-inactive view.
const SYSTEM_VIEW = 'System';
const SYSTEM_ELEMENTS = ['feezal-element-system-splash', 'feezal-element-system-connection-status'];

// U71: bundled family preview screenshots (A25 self-hosted — Vite emits each as
// a hashed asset in the editor chunk, not inlined). Drop a `<family>.png` into
// ./family-shots and add it here to illustrate that family; families without an
// image fall back to the label + a placeholder tile.
import glassShot from './family-shots/glass.png';
import metroShot from './family-shots/metro.png';
import circleShot from './family-shots/circle.png';
import einkShot from './family-shots/eink.png';
const FAMILY_SHOTS = {glass: glassShot, metro: metroShot, circle: circleShot, eink: einkShot};

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

// The App generator only offers the styled, app-oriented families — the plain
// `basic` and `material` families are excluded from the App flow's picker (they
// stay available on the Devices tile).
const APP_FAMILY_EXCLUDE = new Set(['basic', 'material']);

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
        _stage:   {state: true},   // 'tiles' | 'newsite' | 'devices' | 'app' | 'rooms' | 'review' | 'result'
        _loading: {state: true},
        _error:   {state: true},
        _family:  {state: true},
        _filter:  {state: true},
        _newSiteName: {state: true},  // U80: name for the new site the App generator creates
        _autoFlow:    {state: true},  // U80: resumed on the fresh new site → auto-deploy + viewer link
        _checked: {state: true},   // Set<string> of entity keys
        _axis:    {state: true},   // App mode: 'room' | 'function'
        _assign:  {state: true},   // App review: Map<entityKey, {label, icon}>
        _rooms:   {state: true},   // U78: the editable room list (room axis) — [{label, icon, words, guessed, detected}] | null
        _selected: {state: true},  // U75: review row SELECTION (highlight, bulk ops) — distinct from _checked
        _result:  {state: true},   // {added, view, views?, skippedNoElem:[], skippedDupe:[]}
        _newRoomFor: {state: true},// U70/U75: entity key(s) awaiting a new-room name, or null
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
        /* U75: review row SELECTION highlight (distinct from the include checkbox). */
        .row.selected, .row.selected:hover { background: var(--feezal-sel-bg, #cfe5fb); }

        /* U75: bulk action bar — appears while ≥1 review row is selected. */
        .bulk-bar {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 10px; margin: 2px 0 8px; border-radius: 8px;
            background: var(--feezal-tile-hover, #eff6ff);
            border: 1px solid var(--sl-color-primary-300, #7dd3fc);
            font-size: 12.5px; position: sticky; top: 0; z-index: 3;
        }
        .bulk-bar .bulk-n { font-weight: 600; flex: 0 0 auto; }
        .bulk-bar .spacer { flex: 1; }
        .bulk-bar select.bulk-move {
            font: inherit; font-size: 12px; padding: 3px 6px; border-radius: 6px;
            background: var(--sl-input-background-color, #fff); color: var(--sl-input-color, inherit);
            border: 1px solid var(--sl-input-border-color, #d0d0d0);
        }

        /* ── U78: room-review stage ─────────────────────────────────────── */
        /* Reserve a stable height so the dialog does not shrink as rooms are
           removed. min-height (not a fixed height + overflow) is deliberate: the
           per-row icon picker opens an absolutely-positioned popup, which an
           overflow:auto scroll container would clip. */
        .room-list { display: flex; flex-direction: column; gap: 6px; margin: 4px 0 10px;
            min-height: 46vh; }
        .room-row {
            display: flex; align-items: center; gap: 8px;
            padding: 4px 6px; border-radius: 8px;
            border: 1px solid var(--feezal-tile-border, #e2e8f0);
            background: var(--feezal-tile-bg, #f8fafc);
        }
        .room-row .spacer { flex: 1; }
        .room-drag { cursor: grab; opacity: .5; font-size: 20px; user-select: none; }
        .room-drag:active { cursor: grabbing; }
        .room-icon { width: 132px; flex: 0 0 auto; }
        .room-name { width: 200px; flex: 0 0 auto; }
        .room-btn {
            display: inline-flex; align-items: center; justify-content: center;
            width: 26px; height: 26px; padding: 0; border-radius: 6px; cursor: pointer;
            border: 1px solid transparent; background: transparent; color: inherit; opacity: .8;
        }
        .room-btn:hover:not([disabled]) { background: var(--feezal-tile-hover, #eff6ff); opacity: 1; }
        .room-btn[disabled] { opacity: .25; cursor: default; }
        .room-btn .material-icons { font-size: 18px; }
        .room-btn.room-x:hover { color: var(--sl-color-danger-600, #dc2626); }
        .room-empty { padding: 16px; text-align: center; opacity: .6; font-size: 12.5px; }
        .room-add { display: flex; align-items: center; gap: 8px; }
        .room-add sl-input { flex: 1; }

        .empty { padding: 30px; text-align: center; opacity: .6; font-size: 13px; }
        .loading { display: flex; align-items: center; gap: 12px; padding: 24px; font-size: 13px; opacity: .8; }

        /* ── App setup stage (U69: axis + family only) ──────────────────── */
        .app-setup { display: flex; flex-direction: column; gap: 14px; padding: 6px 0 4px; }
        .setup-row { display: flex; align-items: center; gap: 12px; }
        .setup-row.family-row { align-items: flex-start; }
        .setup-label { font-size: 12px; font-weight: 600; opacity: .7; width: 64px; flex: 0 0 auto; padding-top: 4px; }
        .setup-note { font-size: 12.5px; opacity: .75; margin-top: 2px; display: flex; align-items: center; gap: 8px; }
        .retry-link { color: var(--sl-color-primary-600, #0284c7); cursor: pointer; text-decoration: underline; }

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
        .bucket-hd .r-badge {
            font-size: 10px; padding: 1px 6px; border-radius: 9px; flex: 0 0 auto;
            background: var(--feezal-badge-bg, #e2e8f0); color: var(--feezal-badge-fg, #64748b);
        }
        /* U77: a frequency-detected zone reads differently from a lexicon guess. */
        .bucket-hd .r-badge.detected { background: var(--sl-color-primary-100, #e0f2fe); color: var(--sl-color-primary-700, #0369a1); }
        .row .r-move {
            font: inherit; font-size: 12px; max-width: 150px; flex: 0 0 auto;
            background: var(--sl-input-background-color, #fff);
            color: var(--sl-input-color, inherit);
            border: 1px solid var(--sl-input-border-color, #d0d0d0); border-radius: 5px;
            padding: 2px 4px;
        }

        /* ── result stage ───────────────────────────────────────────────── */
        /* U80: new-site name prompt */
        .newsite { display: flex; flex-direction: column; gap: 10px; padding: 8px 0; }
        .newsite p { margin: 0; font-size: 13px; }
        .newsite sl-input { width: 100%; }
        .newsite-err { color: var(--sl-color-danger-600, #dc2626); font-size: 12.5px; }
        .newsite-hint { font-size: 12px; opacity: .7; }

        .result-ok { display: flex; align-items: center; gap: 10px; font-size: 15px; margin: 6px 0 14px; }
        .result-ok .material-icons { color: var(--sl-color-success-600, #16a34a); font-size: 26px; }
        /* U80: prominent viewer link on the result screen */
        .viewer-cta { margin: 4px 0 6px; }
        .viewer-link {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 600;
            background: var(--sl-color-primary-600, #0284c7); color: #fff;
        }
        .viewer-link:hover { background: var(--sl-color-primary-500, #0ea5e9); }
        .viewer-link .material-icons { font-size: 18px; }
        .viewer-hint { font-size: 12px; opacity: .7; margin: 8px 0 0; }
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
        this._rooms = null;
        this._result = null;
        this._newSiteName = '';
        this._autoFlow = false;
        this._newRoomFor = null;
        this._newRoomName = '';
        this.__devices = [];
        // U68: the range/drag helper driving the CHECKBOXES (device list + the
        // bucket-header toggle).
        this._sel = new RangeSelect({
            selection: () => this._checked,
            commit: s => { this._checked = s; },
        });
        // U75: a SECOND range/drag helper driving the review row SELECTION (the
        // highlight the bulk "move to room" acts on) — separate from _checked so
        // clicking a row no longer toggles its include checkbox.
        this._selected = new Set();
        this._selReview = new RangeSelect({
            selection: () => this._selected,
            commit: s => { this._selected = s; },
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
        this._clearSelection();
        this._rooms = null;
        this._autoFlow = false;
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

    async _chooseApp() {
        // The App flow never offers basic/material — if one is left selected from
        // the Devices tile, fall back to the first app-eligible family.
        if (APP_FAMILY_EXCLUDE.has(this._family)) {
            const appFams = this._availableFamilies().filter(f => !APP_FAMILY_EXCLUDE.has(f));
            if (appFams.length) this._family = appFams[0];
        }
        await this._loadInto('app');
    }

    // ── U80: the App generator always creates a NEW site ──────────────────────
    // The App tile first asks for the new site's name (prefilled siteN), creates
    // it (inheriting the current site's broker connection), then switches the
    // editor to it; the wizard resumes there and auto-deploys at the end.

    /** Next free "siteN" name (site1, site2, …). */
    async _nextSiteName() {
        let names = [];
        try {
            const res = await fetch('/api/sites');
            if (res.ok) { const data = await res.json(); names = data.sites || data || []; }
        } catch { /* offline — fall through to site1 */ }
        const taken = new Set(names.map(n => String(n).toLowerCase()));
        let i = 1;
        while (taken.has('site' + i)) i++;
        return 'site' + i;
    }

    async _chooseAppOnNewSite() {
        this._error = null;
        this._newSiteName = await this._nextSiteName();
        this._stage = 'newsite';
        this.updateComplete.then(() => this.renderRoot.querySelector('.newsite sl-input')?.focus?.());
    }

    async _confirmNewSite() {
        const name = String(this._newSiteName || '').trim();
        if (!name) return;
        if (!/^[^/\\]+$/.test(name)) { this._error = 'A site name cannot contain / or \\.'; this.requestUpdate(); return; }
        this._error = null;
        this._creatingSite = true;
        this.requestUpdate();
        try {
            const res = await fetch('/api/sites', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name, fromSite: feezal.siteName}),
            });
            if (!res.ok) {
                this._error = res.status === 409 ? 'A site with that name already exists.' : 'Could not create the site.';
                this._creatingSite = false;
                this.requestUpdate();
                return;
            }
            // Resume the App generator on the new site after the reload (loadViews
            // in the inspector picks this up and calls resumeNewSiteApp()).
            sessionStorage.setItem('feezal:generateAppSite', name);
            this._navigateTo(`/editor/?/${encodeURIComponent(name)}/`);
        } catch {
            this._error = 'Could not reach the server.';
            this._creatingSite = false;
            this.requestUpdate();
        }
    }

    /** Full-page navigation to switch the editor to another site (seam for tests). */
    _navigateTo(url) { window.location.href = url; }

    /** Called by the editor after it switches to the freshly-created site: open
     * the wizard straight at the App setup and mark the auto-deploy flow. */
    resumeNewSiteApp() {
        this.open();
        this._autoFlow = true;
        this._chooseApp();
    }

    /** One discovery fetch → the filtered, keyed, area-joined device list. */
    async _fetchDevices(stage) {
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
        return list;
    }

    async _loadInto(stage) {
        this._stage = stage;
        this._loading = true;
        this._error = null;
        this.requestUpdate();
        // U80: a freshly-created site's server bridge is still connecting and
        // taking the retained discovery burst, so a single fetch would open the
        // App wizard on "0 devices discovered". In the new-site flow, poll until
        // devices show up (or ~24 s pass). A normal open fetches once.
        const maxAttempts = (stage === 'app' && this._autoFlow) ? 12 : 1;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                this.__devices = await this._fetchDevices(stage);
                this._error = null;
                if (this.__devices.length || attempt === maxAttempts) break;
            } catch (err) {
                this.__devices = [];
                this._error = String(err.message || err);
                if (attempt === maxAttempts) break;
            }
            if (this._stage !== stage) return;   // user navigated away / cancelled
            await new Promise(r => setTimeout(r, 2000));
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
    // press action paints onto any row the pointer then crosses. U75: in the
    // review the gesture drives the row SELECTION (_selReview); in the device
    // list it drives the CHECKBOXES (_sel).
    _selPress(ev, key) {
        ev.preventDefault();                       // no focus/selection flicker
        const sel = this._stage === 'review' ? this._selReview : this._sel;
        this._activeSel = sel;
        sel.press(ev, key, this._currentOrder());
        this.requestUpdate();
        if (this._dragMove) return;                // already armed this gesture
        this._dragMove = e => {
            const row = this.renderRoot.elementFromPoint(e.clientX, e.clientY)?.closest?.('.row[data-key]');
            if (row) { this._activeSel.paint(row.dataset.key); this.requestUpdate(); }
        };
        this._dragUp = () => this._endDrag();
        window.addEventListener('pointermove', this._dragMove);
        window.addEventListener('pointerup', this._dragUp);
    }

    _endDrag() {
        this._activeSel?.end();
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

    // ── U78: room-review step (room axis only) — edit the found rooms first ──

    /** Derive the editable room list from auto-detection (buckets minus the
     * Unassigned fallback), each carrying its lexicon match words + icon. */
    _buildRoomsFrom(eligible) {
        this._rooms = groupForApp(eligible, 'room')
            .filter(b => b.label !== UNKNOWN_ROOM)
            .map(b => ({label: b.label, icon: b.icon, guessed: b.guessed, detected: b.detected,
                words: lexiconWordsForLabel(b.label)}));
    }

    /** Step 1 of the App room flow: review the ROOMS (not the devices). */
    _toRooms() {
        this._buildRoomsFrom(this.__devices.filter(e => this._tagFor(e)));
        this._newRoomName = '';
        this._stage = 'rooms';
    }

    /** The setup screen's primary action: rooms get their own review step
     * first; functions go straight to the device review. */
    _startReview() {
        if (this._axis === 'room') this._toRooms();
        else this._toReview();
    }

    _removeRoom(i) { this._rooms = this._rooms.filter((_, idx) => idx !== i); }
    _setRoomIcon(i, icon) { this._rooms = this._rooms.map((r, idx) => idx === i ? {...r, icon} : r); }
    _renameRoom(i, label) {
        const l = String(label || '').trim();
        // Keep labels unique — they key the list and become view slugs.
        if (!l || this._rooms.some((r, idx) => idx !== i && r.label.toLowerCase() === l.toLowerCase())) return;
        this._rooms = this._rooms.map((r, idx) => idx === i ? {...r, label: l} : r);
    }
    _moveRoom(i, dir) {
        const j = i + dir;
        if (j < 0 || j >= this._rooms.length) return;
        const rooms = [...this._rooms];
        [rooms[i], rooms[j]] = [rooms[j], rooms[i]];
        this._rooms = rooms;
    }
    _addRoom() {
        const label = String(this._newRoomName || '').trim();
        this._newRoomName = '';
        if (!label || this._rooms.some(r => r.label.toLowerCase() === label.toLowerCase())) return;
        this._rooms = [...this._rooms,
            {label, icon: 'meeting_room', guessed: false, detected: false, words: lexiconWordsForLabel(label)}];
    }

    // Drag-drop reorder (grab the handle, drop on a row).
    _roomDragStart(e, i) { this._dragRoomIdx = i; if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; }
    _roomDragOver(e) { e.preventDefault(); }
    _roomDrop(e, to) {
        e.preventDefault();
        const from = this._dragRoomIdx;
        this._dragRoomIdx = null;
        if (from == null || from === to) return;
        const rooms = [...this._rooms];
        const [moved] = rooms.splice(from, 1);
        rooms.splice(to, 0, moved);
        this._rooms = rooms;
    }
    _roomDragEnd() { this._dragRoomIdx = null; }

    /** U69: the review IS the selection. Every generatable device is bucketed
     * and starts CHECKED; the user unchecks the ones they don't want in the
     * review itself. Nothing is created before confirm. U78: on the room axis
     * devices are assigned to the user-edited room list (order = drawer order);
     * the function axis keeps the taxonomy grouping. */
    _toReview() {
        const eligible = this.__devices.filter(e => this._tagFor(e));
        this._checked = new Set(eligible.map(e => e.__key));   // all selected by default
        this._sel.reset();
        this._clearSelection();                                // U75: no rows selected on entry
        const assign = new Map();
        this._bucketMeta = new Map();   // label → {order, guessed, detected}

        if (this._axis === 'room') {
            if (this._rooms == null) this._buildRoomsFrom(eligible);   // direct entry (no room-review): auto-detect
            this._rooms.forEach((r, i) =>
                this._bucketMeta.set(r.label, {order: i, guessed: r.guessed, detected: r.detected}));
            let anyUnassigned = false;
            for (const e of eligible) {
                const r = assignRoom(e, this._rooms);
                if (r) assign.set(e.__key, {label: r.label, icon: r.icon});
                else { assign.set(e.__key, {label: UNKNOWN_ROOM, icon: 'inventory_2'}); anyUnassigned = true; }
            }
            if (anyUnassigned) this._bucketMeta.set(UNKNOWN_ROOM, {order: this._rooms.length, guessed: false, detected: false});
        } else {
            for (const b of groupForApp(eligible, 'function')) {
                this._bucketMeta.set(b.label, {order: b.order, guessed: b.guessed, detected: b.detected});
                for (const e of b.entities) assign.set(e.__key, {label: b.label, icon: b.icon});
            }
        }
        this._assign = assign;
        this._stage = 'review';
    }

    // ── U75: review row selection (highlight) + bulk operations ──────────────
    _clearSelection() { this._selected = new Set(); this._selReview.reset(); }

    /** Set _checked on/off for every selected row (bulk check/uncheck). */
    _bulkCheck(on) {
        if (!this._selected.size) return;
        const next = new Set(this._checked);
        for (const k of this._selected) on ? next.add(k) : next.delete(k);
        this._checked = next;
    }

    /** Move every selected row to a room (bulk). The "＋ Create new room"
     * sentinel opens the new-room dialog for the whole selection instead. */
    _bulkMove(value) {
        if (!value || !this._selected.size) return;
        if (value === NEW_ROOM) {
            this._newRoomFor = [...this._selected];
            this.updateComplete.then(() => this.renderRoot.querySelector('.newroom')?.show());
            this.requestUpdate();
            return;
        }
        const keys = [...this._selected];
        const target = [...this._assign.values()].find(a => a.label === value);
        const next = new Map(this._assign);
        for (const k of keys) next.set(k, {label: value, icon: target?.icon || 'meeting_room'});
        this._assign = next;
        this._clearSelection();
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
                    order: meta.order ?? null, guessed: meta.guessed ?? false,
                    detected: meta.detected ?? false, entities: []});
            }
            byLabel.get(a.label).entities.push(e);
        }
        const arr = [...byLabel.values()];
        if (this._axis === 'function') {
            return arr.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.label.localeCompare(b.label));
        }
        // U78: rooms follow the user's room-review order (Unassigned last); a
        // bucket with no order (created later in device-review) sorts after.
        return arr.sort((a, b) =>
            (a.label === UNKNOWN_ROOM) - (b.label === UNKNOWN_ROOM) ||
            (a.order ?? 999) - (b.order ?? 999) ||
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

    // ── U70: "＋ Create new room" from a device's move-to-room dropdown.
    // _newRoomFor holds the key(s) awaiting the name (U75: an array so the bulk
    // bar can create a room for a whole selection). ──
    _onReassignChange(key, value) {
        if (value === NEW_ROOM) {
            this._newRoomFor = [key];
            this._newRoomName = '';
            this.updateComplete.then(() => this.renderRoot.querySelector('.newroom')?.show());
            this.requestUpdate();   // reset the <select> back to its real value
            return;
        }
        this._reassign(key, value);
    }

    _confirmNewRoom() {
        const label = String(this._newRoomName || '').trim();
        const keys = this._newRoomFor;
        if (label && keys && keys.length) {
            for (const k of keys) this._reassign(k, label);
            this._clearSelection();   // U75: a bulk create clears the selection
        }
        this._closeNewRoom();
    }

    _closeNewRoom() {
        this.renderRoot.querySelector('.newroom')?.hide();
        this._newRoomFor = null;
        this._newRoomName = '';
    }

    // ── U75: single-row toggle of the include checkbox (checkbox click only).
    // The <sl-checkbox> is display-only (pointer-events:none); a wrapper span
    // owns the click + stops it reaching the row's selection gesture — the same
    // proven pattern as the bucket-header toggle. ──
    _toggleChecked(key) {
        const next = new Set(this._checked);
        next.has(key) ? next.delete(key) : next.add(key);
        this._checked = next;
    }

    /** Unique view name (the buckets may collide with non-view names only). */
    _uniqueViewName(base, taken) {
        let name = base;
        let i = 2;
        while (taken.has(name)) name = `${base} ${i++}`;
        return name;
    }

    /** U74: apply the chosen family's site theme — through the themes sidebar's
     * `_selectTheme` so it loads the CSS AND persists (the deploy reads
     * `themesSidebar.theme` into config.viewer.theme; a raw className is not
     * persisted and reverts on reload). Only when the site is still on the
     * DEFAULT theme, so a theme the user picked is never clobbered. Falls back
     * to a plain className when the sidebar isn't reachable (e.g. tests). */
    _applyFamilyTheme() {
        const themeClass = FAMILY_THEME[this._family];
        if (!themeClass) return;
        const site = feezal.site;
        if (!site) return;
        const themesSidebar = feezal.app?.shadowRoot?.querySelector?.('feezal-sidebar-themes');
        const current = themesSidebar?.currentTheme
            || site.className.match(/feezal-theme-\S+/)?.[0] || 'default';
        if (current && current !== 'default') return;   // respect a user-chosen theme
        if (themesSidebar?._selectTheme) {
            themesSidebar._selectTheme(themeClass);      // className + CSS + persistence
        } else {
            const base = site.className.split(' ').filter(c => !c.startsWith('feezal-theme-'));
            site.className = [themeClass, ...base].join(' ').trim();
        }
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

        // U74: match the site theme to the chosen element family so the app
        // looks like the family's preview. Applied whenever the site is still on
        // the DEFAULT theme (so it works on a reused shell too) — never clobbers
        // a theme the user has picked.
        this._applyFamilyTheme();

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
                // U74: glass sub-views carry the default gradient behind the
                // frosted cards — set as `background-image` (the exact property
                // the Background style editor reads/writes) so it renders and the
                // inspector reflects it without a re-edit.
                if (this._family === 'glass') view.style.setProperty('background-image', GLASS_GRADIENT);
                site.append(view);
                createdViews.push(slug);
            }
            // U72: within a view, order cards by function (lights → cover →
            // climate → contact → sensor …) in room mode, alphabetically in
            // function mode (where the bucket already IS the function).
            if (this._axis === 'function') {
                chosen.sort((a, b) => this._label(a).localeCompare(this._label(b), undefined, {sensitivity: 'base'}));
            } else {
                chosen.sort((a, b) =>
                    (functionBucket(a).order ?? 99) - (functionBucket(b).order ?? 99) ||
                    this._label(a).localeCompare(this._label(b), undefined, {sensitivity: 'base'}));
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

        // An extra hidden "System" view (NOT wired into the drawer) holding the
        // splash + connection-status chrome. Both hoist themselves to <body> in
        // the viewer, so they work from this always-inactive view. Created once,
        // merged by name on a re-run.
        let systemView = site.querySelector(`feezal-view[name="${SYSTEM_VIEW}"]`);
        if (!systemView) {
            systemView = document.createElement('feezal-view');
            systemView.setAttribute('name', SYSTEM_VIEW);
            systemView.setAttribute('child-position', 'flow');
            systemView.setAttribute('flow-justify', 'start');
            systemView.style.width = '100%';
            systemView.style.height = '100%';
            site.append(systemView);
            for (const tag of SYSTEM_ELEMENTS) {
                if (!customElements.get(tag)) continue;   // belt & braces
                const el = document.createElement(tag);
                systemView.append(el);
                feezal.editor.initElem(el, true);
            }
            createdViews.push(SYSTEM_VIEW);
        }

        shell.setAttribute('items', JSON.stringify(items));
        if (!shell.getAttribute('active-view') && items.length) {
            shell.setAttribute('active-view', items[0].view);
        }

        // U67: the Menu (app shell) is the entry point, so make it the FIRST
        // tab in the viewer, its generated sub-views next (bucket order), and
        // push any pre-existing hand-made views to the end. Re-appending a view
        // moves it — the established pattern in this file.
        const genNames = new Set([shellView.getAttribute('name'), SYSTEM_VIEW,
            ...buckets.map(b => b.slug).filter(Boolean)]);
        // U80: a freshly-created site ships with one empty scaffold view
        // ("view1"). On the new-site flow, drop any empty pre-existing view so
        // Menu is the sole first/default view (no stray empty view lingers).
        if (this._autoFlow) {
            for (const v of [...site.querySelectorAll('feezal-view')]) {
                if (!genNames.has(v.getAttribute('name')) && v.children.length === 0) v.remove();
            }
        }
        const bucketViews = buckets.map(b => b.slug).filter(Boolean)
            .map(slug => site.querySelector(`feezal-view[name="${slug}"]`)).filter(Boolean);
        const preExisting = [...site.querySelectorAll('feezal-view')]
            .filter(v => !genNames.has(v.getAttribute('name')));
        const seen = new Set();
        // Menu first, generated sub-views next, the hidden System view after
        // them, pre-existing hand-made views last.
        for (const v of [shellView, ...bucketViews, systemView, ...preExisting]) {
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
        // U80: on the switch-to-new-site flow, publish the freshly generated app
        // automatically so the viewer link on the result screen works at once.
        if (this._autoFlow) feezal.app?._deploy?.();
        this._stage = 'result';
        this.requestUpdate();
    }

    render() {
        return html`
            <sl-dialog label="${this._dialogTitle()}" @sl-request-close="${e => { if (e.detail.source === 'overlay') e.preventDefault(); }}">
                ${this._stage === 'tiles' ? this._renderTiles()
                    : this._stage === 'newsite' ? this._renderNewSite()
                    : this._stage === 'devices' ? this._renderDevices()
                    : this._stage === 'app' ? this._renderApp()
                    : this._stage === 'rooms' ? this._renderRooms()
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
        if (this._stage === 'newsite') return 'Generate — App: new site';
        if (this._stage === 'devices') return 'Generate — Devices';
        if (this._stage === 'app') return 'Generate — App';
        if (this._stage === 'rooms') return 'Generate — App: rooms';
        if (this._stage === 'review') return `Generate — App: ${this._axis === 'room' ? 'devices' : 'functions'}`;
        if (this._stage === 'result') return 'Generate — Done';
        return 'Generate';
    }

    _renderNewSite() {
        return html`
            <div class="newsite">
                <p>The App generator builds your dashboard on a <b>new site</b> — your current site stays untouched. Name it (you'll land in the editor on it, and it deploys automatically at the end):</p>
                <sl-input label="New site name" autofocus value="${this._newSiteName}"
                    ?disabled="${this._creatingSite}"
                    @sl-input="${e => { this._newSiteName = e.target.value; }}"
                    @keydown="${e => { if (e.key === 'Enter') { e.preventDefault(); this._confirmNewSite(); } }}"></sl-input>
                ${this._error ? html`<p class="newsite-err">${this._error}</p>` : ''}
                <p class="newsite-hint">It inherits this site's MQTT broker connection, so your discovered devices are ready right away.</p>
            </div>
            <div slot="footer" class="footer">
                <sl-button variant="text" @click="${() => { this._stage = 'tiles'; }}" ?disabled="${this._creatingSite}">Back</sl-button>
                <span class="spacer"></span>
                <sl-button @click="${this._close}" ?disabled="${this._creatingSite}">Cancel</sl-button>
                <sl-button variant="primary" ?loading="${this._creatingSite}"
                    ?disabled="${!this._newSiteName.trim() || this._creatingSite}"
                    @click="${this._confirmNewSite}">Create &amp; continue</sl-button>
            </div>`;
    }

    _renderTiles() {
        return html`
            <div class="tiles">
                <button class="tile" @click="${this._chooseDevices}">
                    <span class="material-icons">grid_view</span>
                    <span class="t-title">Devices</span>
                    <span class="t-sub">One pre-wired element per discovered device, dropped onto the current view in a grid.</span>
                </button>
                <button class="tile" @click="${this._chooseAppOnNewSite}">
                    <span class="material-icons">dashboard</span>
                    <span class="t-title">App</span>
                    <span class="t-sub">A Menu view with per-room (or per-function) sub-views wired into a navigation app — created as a new site.</span>
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
        const fams = this._availableFamilies().filter(f => !APP_FAMILY_EXCLUDE.has(f));
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
                    ${this._loading ? html`<sl-spinner style="font-size:14px"></sl-spinner> ${this._autoFlow
                            ? 'Connecting to your broker and discovering your devices — this can take a few seconds on a fresh site…'
                            : 'Loading discovered devices…'}`
                        : this._error ? html`Could not load devices: ${this._error}`
                        : eligible ? html`<b>${eligible}</b> device${eligible === 1 ? '' : 's'} discovered — pick which to include on the next screen.`
                        : html`No generatable devices discovered${this._autoFlow ? ' yet' : ''} in the <b>${FAMILY_LABELS[this._family] || this._family}</b> family.${this._autoFlow ? html` <a class="retry-link" @click="${() => this._chooseApp()}">Retry</a>` : ''}`}
                </div>
            </div>

            <div slot="footer" class="footer">
                <sl-button variant="text" @click="${() => { this._stage = 'tiles'; }}">Back</sl-button>
                <span class="spacer"></span>
                <sl-button @click="${this._close}">Cancel</sl-button>
                <sl-button variant="primary" ?disabled="${!eligible}" @click="${this._startReview}">
                    ${this._axis === 'room' ? 'Review rooms…' : 'Review devices…'}
                </sl-button>
            </div>
        `;
    }

    /** U78 room-review stage: edit the found rooms (remove / add / rename /
     * reorder / icon) BEFORE the device review. On continue, devices are
     * re-matched to this edited list (a deleted room's devices are re-scanned
     * against the remaining rooms). Room order here IS the app drawer order. */
    _renderRooms() {
        const eligible = this.__devices.filter(e => this._tagFor(e)).length;
        const rooms = this._rooms || [];
        return html`
            <div class="review-hint">
                Review the <b>rooms</b> found — remove any you don't want (✕), add your own, drag or use
                ↑/↓ to set the <b>drawer order</b>, and pick each icon. Devices are matched to these rooms
                on the next step; anything unmatched lands in <b>Unassigned</b>.
            </div>
            <div class="room-list">
                ${rooms.length ? repeat(rooms, r => r.label, (r, i) => html`
                    <div class="room-row" @dragover="${this._roomDragOver}" @drop="${e => this._roomDrop(e, i)}">
                        <span class="room-drag material-icons" draggable="true" title="Drag to reorder"
                            @dragstart="${e => this._roomDragStart(e, i)}" @dragend="${this._roomDragEnd}">drag_indicator</span>
                        <feezal-icon-input class="room-icon" value="${r.icon || ''}"
                            @feezal-change="${e => this._setRoomIcon(i, e.detail.value)}"></feezal-icon-input>
                        <sl-input class="room-name" size="small" value="${r.label}"
                            @sl-change="${e => this._renameRoom(i, e.target.value)}"></sl-input>
                        ${r.detected ? html`<span class="r-badge detected" title="Detected group — devices sharing a recurring name">detected</span>`
                            : r.guessed ? html`<span class="r-badge" title="Guessed from device names — no explicit area">guessed</span>` : ''}
                        <span class="spacer"></span>
                        <button class="room-btn" title="Move up" ?disabled="${i === 0}" @click="${() => this._moveRoom(i, -1)}"><span class="material-icons">arrow_upward</span></button>
                        <button class="room-btn" title="Move down" ?disabled="${i === rooms.length - 1}" @click="${() => this._moveRoom(i, 1)}"><span class="material-icons">arrow_downward</span></button>
                        <button class="room-btn room-x" title="Remove room" @click="${() => this._removeRoom(i)}"><span class="material-icons">close</span></button>
                    </div>`)
                    : html`<div class="room-empty">No rooms yet — add one below, or every device lands in “Unassigned”.</div>`}
            </div>
            <div class="room-add">
                <sl-input size="small" placeholder="Add a room…" value="${this._newRoomName}"
                    @sl-input="${e => { this._newRoomName = e.target.value; }}"
                    @keydown="${e => { if (e.key === 'Enter') { e.preventDefault(); this._addRoom(); } }}"></sl-input>
                <sl-button size="small" ?disabled="${!this._newRoomName.trim()}" @click="${this._addRoom}">Add room</sl-button>
            </div>
            <div slot="footer" class="footer">
                <sl-button variant="text" @click="${() => { this._stage = 'app'; }}">Back</sl-button>
                <span class="spacer"></span>
                <sl-button @click="${this._close}">Cancel</sl-button>
                <sl-button variant="primary" ?disabled="${!eligible}" @click="${this._toReview}">Review devices…</sl-button>
            </div>`;
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
                tick a device's <b>box</b> to include it; <b>click rows</b> (Shift or drag for
                a range) to select, then move them together with the bar. Rename a
                ${isRoom ? 'room' : 'group'} to merge. Each becomes a sub-view in the app drawer.
            </div>
            ${this._selected.size ? html`
                <div class="bulk-bar">
                    <span class="bulk-n">${this._selected.size} selected</span>
                    <select class="bulk-move" @change="${ev => { this._bulkMove(ev.target.value); ev.target.value = ''; }}">
                        <option value="">Move to ${isRoom ? 'room' : 'group'}…</option>
                        ${labels.map(l => html`<option value="${l}">${l}</option>`)}
                        ${isRoom ? html`<option value="${NEW_ROOM}">＋ Create new room…</option>` : ''}
                    </select>
                    <sl-button size="small" @click="${() => this._bulkCheck(true)}">Check</sl-button>
                    <sl-button size="small" @click="${() => this._bulkCheck(false)}">Uncheck</sl-button>
                    <span class="spacer"></span>
                    <sl-button size="small" variant="text" @click="${() => this._clearSelection()}">Clear</sl-button>
                </div>` : ''}
            <div class="dev-body groups">
                ${repeat(buckets, b => b.label, b => {
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
                            ${b.detected && isRoom
                                ? html`<span class="r-badge detected" title="Detected group — devices that share a recurring name; rename or dismiss">detected</span>`
                                : b.guessed && isRoom && b.label !== UNKNOWN_ROOM
                                ? html`<span class="r-badge" title="Room guessed from the device name — no explicit area">guessed</span>` : ''}
                        </div>
                        ${repeat(b.entities, e => e.__key, e => html`
                            <div class="row ${this._selected.has(e.__key) ? 'selected' : ''}" data-key="${e.__key}"
                                @pointerdown="${ev => this._selPress(ev, e.__key)}">
                                <span class="cb-hit" @pointerdown="${ev => ev.stopPropagation()}"
                                    @click="${ev => { ev.stopPropagation(); this._toggleChecked(e.__key); }}">
                                    <sl-checkbox ?checked="${this._checked.has(e.__key)}" style="pointer-events:none"></sl-checkbox>
                                </span>
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
        const viewerUrl = feezal.siteName === 'default' ? '/viewer/' : '/viewer/' + encodeURIComponent(feezal.siteName) + '/';
        return html`
            <div class="result-ok">
                <span class="material-icons">check_circle</span>
                ${summary}
            </div>
            ${r.app ? html`
                <div class="viewer-cta">
                    <a class="viewer-link" href="${viewerUrl}" target="_blank" rel="noopener">
                        <span class="material-icons">open_in_new</span>
                        Open “${feezal.siteName}” in the viewer
                    </a>
                    <p class="viewer-hint">
                        ${this._autoFlow ? 'Deployed automatically. ' : ''}This opens the live dashboard in a new tab —
                        add it to a wall tablet's home screen, or use Deploy → Export for a self-contained bundle.
                    </p>
                </div>` : ''}
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

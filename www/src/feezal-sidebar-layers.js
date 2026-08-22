/* global feezal */
import {LitElement, html, css} from 'lit';
import {repeat} from 'lit/directives/repeat.js';

import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';

import {fuzzyScoreAny} from './feezal-fuzzy.js';

/** Expanded view names, so the tree looks the same after a reload. */
const OPEN_VIEWS_KEY = 'feezal-layers-open-views';

/**
 * U87 — the site outline: a Layers sidebar panel.
 *
 * A dense dashboard is hard to work with on the canvas alone — overlapping
 * cards are hard to hit, a card hidden behind another is invisible, and
 * stacking order (which IS DOM order, see U33) has no visual representation
 * anywhere. This panel is the structural view of the whole site: every view as
 * a collapsible node (only the OPEN one expanded, the rest collapsed so a
 * 20-view site stays readable), each listing its elements top-most first.
 *
 * Per element row: palette icon (the element TYPE is its tooltip), label
 * (label → name → tag), a topic hint, a lock toggle, and drag-to-restack.
 * Dragging onto ANOTHER view's header moves the element there; holding Ctrl
 * copies instead (the cursor shows the platform's copy affordance). Click
 * selects — switching views first when the element lives elsewhere — and
 * Ctrl/Shift extend exactly like the canvas. Right-click opens the same
 * actions as the canvas context menu, delegated to the inspector so there is
 * one implementation of cut/copy/duplicate/delete/lock/stacking.
 *
 * The filter is a fuzzy search over element type, label and topics (see
 * feezal-fuzzy.js): typing "temp" surfaces every temperature card across ALL
 * views, with non-matching views hidden rather than hiding hits.
 */
class FeezalSidebarLayers extends LitElement {
    static properties = {
        /** current view name — drives which node starts expanded */
        view: {type: String},
        _filter: {state: true},
        _open: {state: true},        // view names currently expanded (persisted)
        _dragEl: {state: true},
        _dropEl: {state: true},
        _dropView: {state: true},    // view header being hovered during a drag
        _copyDrag: {state: true},    // Ctrl held → copy instead of move
        _menu: {state: true},        // {x, y, el?, viewName?}
        _revision: {state: true},
    };

    static styles = css`
        :host {
            display: flex; flex-direction: column; height: 100%;
            font-size: 12.5px; box-sizing: border-box;
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #222);
        }
        /* Same tab chrome as the inspector, so the two sidebar panels read as
           one system (39px tab + 2px nav track = the 41px view tab bar). */
        sl-tab-group { flex: 1; min-height: 0; display: flex; flex-direction: column; }
        sl-tab-group::part(base) { flex: 1; min-height: 0; display: flex; flex-direction: column; }
        sl-tab-group::part(body) { flex: 1; min-height: 0; overflow: hidden; }
        sl-tab-group::part(nav) { background: var(--feezal-bg-sub, #f5f5f5); }
        sl-tab::part(base) { font-size: 14px; padding: 0 8px; height: 39px; }
        sl-tab-panel { height: 100%; }
        sl-tab-panel::part(base) {
            height: 100%; padding: 0; box-sizing: border-box;
            display: flex; flex-direction: column; overflow: hidden;
        }
        .search { padding: 8px; border-bottom: 1px solid var(--feezal-border, #e0e0e0); }
        .search input {
            width: 100%; box-sizing: border-box; font: inherit; font-size: 12.5px;
            padding: 5px 8px; border-radius: 4px;
            border: 1px solid var(--feezal-border, #ccc);
            background: var(--feezal-bg-sub, #fff); color: var(--feezal-color, #222);
        }
        .search input:focus { outline: none; border-color: var(--sl-color-primary-500, #0ea5e9); }
        .tree { flex: 1; min-height: 0; overflow-y: auto; }
        .empty { padding: 18px 12px; opacity: 0.6; text-align: center; line-height: 1.5; }
        .view-row {
            display: flex; align-items: center; gap: 6px;
            padding: 6px 9px; cursor: pointer; user-select: none;
            font-weight: 600;
            background: var(--feezal-bg-sub, #f5f5f5);
            border-bottom: 1px solid var(--feezal-border, #e8e8e8);
            position: sticky; top: 0; z-index: 1;
        }
        .view-row:hover { background: var(--feezal-btn-hover, rgba(127,127,127,0.14)); }
        .view-row.current { color: var(--sl-color-primary-600, #0284c7); }
        .view-row.drop-target {
            outline: 2px dashed var(--sl-color-primary-500, #0ea5e9);
            outline-offset: -2px;
        }
        .caret { flex: 0 0 auto; width: 12px; font-size: 10px; opacity: 0.7; }
        .view-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .badge { flex: 0 0 auto; font-size: 10.5px; opacity: 0.6; font-variant-numeric: tabular-nums; }
        ul { list-style: none; margin: 0; padding: 0; }
        li {
            display: flex; align-items: center; gap: 7px;
            padding: 5px 9px 5px 20px; cursor: pointer;
            border-left: 3px solid transparent; user-select: none;
        }
        li:hover { background: var(--feezal-btn-hover, rgba(127,127,127,0.12)); }
        li.selected {
            background: var(--feezal-sel-bg, rgba(2,132,199,0.16));
            border-left-color: var(--sl-color-primary-600, #0284c7);
        }
        li.locked .label { opacity: 0.55; font-style: italic; }
        li.drop-before { box-shadow: inset 0 2px 0 var(--sl-color-primary-600, #0284c7); }
        li.drop-after  { box-shadow: inset 0 -2px 0 var(--sl-color-primary-600, #0284c7); }
        li.dragging { opacity: 0.4; }
        .grip { cursor: grab; opacity: 0.35; flex: 0 0 auto; font-size: 13px; line-height: 1; }
        .grip:active { cursor: grabbing; }
        /* The icon column must hold its width even when an element has no
           palette icon (or the glyph font has not loaded) — otherwise those
           rows' labels slide left and the list looks ragged. */
        .ico {
            flex: 0 0 18px; width: 18px; height: 16px;
            display: inline-flex; align-items: center; justify-content: center;
            color: var(--sl-color-primary-600, #0284c7);
            overflow: hidden;
        }
        .ico feezal-icon { font-size: 16px; line-height: 1; }
        .ico .fallback { opacity: 0.45; font-size: 13px; line-height: 1; }
        .label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        /* U113: the feezal-id chip — identity for scripts/forms, reads like a
           code token so it is not mistaken for the label. */
        .fid {
            flex: 0 1 auto; max-width: 35%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px;
            padding: 0 4px; border-radius: 3px;
            background: color-mix(in srgb, var(--feezal-color, #333) 10%, transparent);
            opacity: 0.85;
        }
        .topic {
            flex: 0 1 auto; max-width: 40%; opacity: 0.55; font-size: 11px;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl;
        }
        .lock {
            flex: 0 0 auto; border: 0; background: none; cursor: pointer; padding: 2px;
            color: inherit; opacity: 0.35; font-size: 12px; line-height: 1;
        }
        .lock:hover, .lock.on { opacity: 0.9; }
        .hint { padding: 6px 10px; opacity: 0.6; font-size: 11px; line-height: 1.4; }

        /* ── context menu (same look as the canvas one) ────────────────────── */
        .ctx {
            position: fixed; z-index: 10000; min-width: 170px; padding: 4px 0;
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #222);
            border: 1px solid var(--feezal-border, #ccc); border-radius: 6px;
            box-shadow: 0 4px 20px rgba(0,0,0,.25);
            font-weight: 400;
        }
        .ctx-item { padding: 5px 14px; cursor: pointer; white-space: nowrap; }
        .ctx-item:hover:not(.ctx-disabled) { background: var(--sl-color-primary-600, #0284c7); color: #fff; }
        .ctx-item.danger:hover { background: var(--feezal-ctx-danger, #c62828); color: #fff; }
        .ctx-item.ctx-disabled { opacity: 0.4; cursor: default; }
        .ctx-item.has-sub { position: relative; display: flex; align-items: center; gap: 10px; }
        .ctx-arrow { margin-left: auto; font-size: 9px; opacity: 0.7; }
        .ctx-sep { height: 1px; margin: 4px 0; background: var(--feezal-border, #e0e0e0); }
        /* The flyout is fixed-positioned by _positionSub(), which flips it left
           and caps its height against the viewport (a site can have any number
           of views). */
        .ctx-sub {
            position: fixed; min-width: 150px; max-width: 280px; padding: 4px 0;
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #222);
            border: 1px solid var(--feezal-border, #ccc); border-radius: 6px;
            box-shadow: 0 4px 20px rgba(0,0,0,.25);
        }
        .ctx-sub .ctx-item { overflow: hidden; text-overflow: ellipsis; }
    `;

    constructor() {
        super();
        this.view = '';
        this._filter = '';
        this._open = this._restoreOpen() ?? new Set();
        this._dragEl = null;
        this._dropEl = null;
        this._dropView = null;
        this._copyDrag = false;
        this._menu = null;
        this._revision = 0;
        // Elements and views are added/removed/restacked by the canvas, the
        // palette, the clipboard and the generate wizard — observing the site
        // is far more robust than asking each of those to notify us.
        this._observer = typeof MutationObserver === 'undefined' ? null
            : new MutationObserver(() => { this._revision++; });
        this._onDocPointer = e => {
            if (!this._menu) return;
            if (!e.composedPath().includes(this.shadowRoot.querySelector('.ctx'))) this._menu = null;
        };
    }

    connectedCallback() {
        super.connectedCallback();
        this._observe();
        document.addEventListener('pointerdown', this._onDocPointer, true);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._observer?.disconnect();
        clearTimeout(this._siteWaitTimer);
        document.removeEventListener('pointerdown', this._onDocPointer, true);
    }

    updated() {
        if (this._observed !== feezal?.site) this._observe();
        // Opening a view or selecting an element must reveal it in the tree.
        this._syncOpenToSelection();
        if (this._menu) this._clampMenu();
    }

    /**
     * Attach the observer to the site — retrying while it does not exist yet.
     * The editor renders its sidebar panels BEFORE the site markup is loaded
     * over the socket, so a one-shot attach in connectedCallback silently left
     * the panel empty until some unrelated property change re-rendered it
     * (the reported "shows nothing until I type in the filter").
     */
    _observe() {
        this._observer?.disconnect();
        clearTimeout(this._siteWaitTimer);
        this._observed = feezal?.site || null;
        if (this._observed) {
            this._observer?.observe(this._observed, {
                childList: true, subtree: true, attributes: true,
                // `class` carries the canvas selection (feezal-selected), so the
                // panel mirrors selection changes without any plumbing.
                attributeFilter: ['class', 'locked', 'label', 'name', 'subscribe', 'publish', 'feezal-id'],
            });
            this._revision++;            // render now that there IS a site
            return;
        }
        this._siteWaitTimer = setTimeout(() => this._observe(), 250);
    }

    // ── model ───────────────────────────────────────────────────────────────

    get _views() {
        return [...(feezal?.site?.querySelectorAll?.('feezal-view') || [])];
    }

    /**
     * A view's canvas elements in DOM order — the same order the canvas reads
     * in. This deliberately does NOT follow the usual layers-panel convention
     * of listing the top-most element first: feezal's flow/grid views lay their
     * children out in DOM order, so reversing made the tree run backwards
     * against what the user is looking at.
     *
     * Identified by WHAT THEY ARE, not by the `feezal-editable` class: that
     * class is stamped by the editor when it initialises a view, so a view the
     * user has not visited in this session carries none — after a reload its
     * elements were simply missing from the tree.
     */
    _elementsOf(view) {
        return [...view.children]
            .filter(el => el.localName &&
                (el.localName.startsWith('feezal-element-') || el.localName === 'feezal-component'));
    }

    _label(el) {
        return el.getAttribute?.('label') || el.getAttribute?.('name') ||
            el.getAttribute?.('text') ||
            (el.localName === 'feezal-component' ? 'component' : '') ||
            this._type(el);
    }

    /** The element's palette identity, e.g. "glass-contact". */
    _type(el) {
        return (el.localName || '').replace('feezal-element-', '');
    }

    _topic(el) {
        return el.getAttribute?.('subscribe') || el.getAttribute?.('publish') ||
            el.getAttribute?.('subscribe-state') || '';
    }

    /** U113 — the element's scripting/form identity, shown beside the label. */
    _feezalId(el) {
        return el.getAttribute?.('feezal-id') || '';
    }

    _icon(el) {
        return window.customElements.get(el.localName)?.feezal?.palette?.icon || '';
    }

    _score(el) {
        return fuzzyScoreAny(this._filter.trim(), [
            this._type(el), this._label(el), this._feezalId(el),
            el.getAttribute?.('subscribe') || '', el.getAttribute?.('publish') || '',
        ]);
    }

    get _tree() {
        const filtering = Boolean(this._filter.trim());
        return this._views.map(view => {
            const name = view.getAttribute('name') || '';
            let elements = this._elementsOf(view);
            if (filtering) {
                elements = elements
                    .map(el => ({el, score: this._score(el)}))
                    .filter(x => x.score > 0)
                    .sort((a, b) => b.score - a.score)
                    .map(x => x.el);
            }
            return {view, name, elements, open: filtering ? elements.length > 0 : this._isOpen(name)};
        }).filter(node => !filtering || node.elements.length);
    }

    /**
     * Expansion model (U87 feedback — the earlier invert-the-default rule
     * "did not feel good" because switching views silently collapsed the one
     * you had just been working in):
     *
     *  - start with only the current view open (a 20-view site stays readable);
     *  - NEVER auto-collapse — opening a view, or selecting an element on it,
     *    only ever ADDS to the open set, so nothing closes behind your back;
     *  - collapsing is a deliberate click on the header;
     *  - the open set is persisted, so the tree looks the same after a reload.
     */
    _isOpen(name) {
        return this._open.has(name);
    }

    _toggleView(name) {
        const next = new Set(this._open);
        if (next.has(name)) next.delete(name); else next.add(name);
        this._open = next;
        this._persistOpen();
    }

    /** Open a view (idempotent) — never closes anything else. */
    _openView(name) {
        if (!name || this._open.has(name)) return;
        this._open = new Set(this._open).add(name);
        this._persistOpen();
    }

    _persistOpen() {
        try {
            localStorage.setItem(OPEN_VIEWS_KEY, JSON.stringify([...this._open]));
        } catch { /* private mode / quota — the tree just won't persist */ }
    }

    _restoreOpen() {
        try {
            const saved = JSON.parse(localStorage.getItem(OPEN_VIEWS_KEY) || 'null');
            if (Array.isArray(saved)) return new Set(saved.filter(n => typeof n === 'string'));
        } catch { /* corrupt value — fall through to the default */ }
        return null;
    }

    /** Keep the open set in step with what the user is working on: the current
     *  view, and the view holding the current selection. */
    _syncOpenToSelection() {
        this._openView(this.view || feezal?.site?.view);
        for (const el of this._selection()) {
            const view = el.parentElement;
            if (view?.tagName === 'FEEZAL-VIEW') this._openView(view.getAttribute('name'));
        }
    }

    // ── interaction ─────────────────────────────────────────────────────────

    get _inspector() {
        return feezal?.app?.shadowRoot?.querySelector('feezal-sidebar-inspector');
    }

    /** The canvas selection, read from the DOM — the canvas marks it with the
     *  `feezal-selected` class, which is the one source of truth. */
    _selection() {
        return [...(feezal?.site?.querySelectorAll?.('.feezal-selected') || [])]
            .filter(el => el.tagName !== 'FEEZAL-VIEW');
    }

    async _selectView(name) {
        if (feezal?.site && feezal.site.view !== name) {
            feezal.app?._setView?.(name);
            await new Promise(r => setTimeout(r));
        }
    }

    async _onRowClick(event, el, node) {
        await this._selectView(node.name);
        const inspector = this._inspector;
        if (!inspector) return;
        const rows = node.elements;
        const current = this._selection();

        let next;
        if (event.shiftKey && current.length && rows.includes(current[current.length - 1])) {
            const from = rows.indexOf(current[current.length - 1]);
            const to = rows.indexOf(el);
            const [lo, hi] = from < to ? [from, to] : [to, from];
            next = rows.slice(lo, hi + 1);
        } else if (event.ctrlKey || event.metaKey) {
            next = current.includes(el) ? current.filter(e => e !== el) : [...current, el];
        } else {
            next = [el];
        }

        // Keep the sidebar on Layers — selecting here is part of navigating the
        // tree, so swapping to the Inspector would pull the panel away
        // mid-task (the canvas still reveals the Inspector, as before).
        // Selection never moves the sidebar (see inspector.selectElement),
        // so nothing to opt out of here any more.
        const keepPanel = {};
        if (next.length) inspector.selectElement(next, keepPanel);
        else inspector.selectElement(null, keepPanel);
        el.scrollIntoView?.({block: 'nearest', inline: 'nearest'});
    }

    _toggleLock(event, el) {
        event.stopPropagation();
        if (el.hasAttribute('locked')) el.removeAttribute('locked');
        else el.setAttribute('locked', '');
        this._inspector?.setLocked?.(el, el.hasAttribute('locked'));
        feezal.app?.change();
        this.requestUpdate();
    }

    // ── context menu ────────────────────────────────────────────────────────

    async _onElementContext(event, el, node) {
        event.preventDefault();
        event.stopPropagation();
        // Right-clicking an unselected row selects it first (Explorer/Finder
        // behaviour) so the delegated actions operate on what was clicked.
        if (!el.classList.contains('feezal-selected')) {
            await this._onRowClick({}, el, node);
        }
        this._menu = {x: event.clientX, y: event.clientY, el, viewName: node.name};
    }

    _onViewContext(event, node) {
        event.preventDefault();
        event.stopPropagation();
        this._menu = {x: event.clientX, y: event.clientY, viewName: node.name, isView: true};
    }

    /** Delegate to the inspector so cut/copy/duplicate/delete/lock/stacking
     *  have exactly ONE implementation, shared with the canvas menu. */
    _menuAction(action) {
        this._menu = null;
        this._inspector?._ctxAction?.(action);
    }

    _menuMoveTo(viewName, removeOriginal) {
        this._menu = null;
        this._inspector?._ctxCopyToView?.(viewName, removeOriginal);
    }

    /** Keep the just-opened menu inside the viewport: a menu opened near the
     *  bottom/right edge would otherwise render off-screen (the canvas menu
     *  clamps the same way). Updates the stored x/y once; the settled
     *  measurement then fits and no further change is made. */
    _clampMenu() {
        const menu = this.renderRoot?.querySelector('.ctx');
        if (!menu || !this._menu) return;
        const r = menu.getBoundingClientRect();
        const margin = 8;
        const {x, y} = this._menu;
        let nx = x;
        let ny = y;
        if (y + r.height > window.innerHeight - margin) {
            ny = Math.max(margin, window.innerHeight - margin - r.height);
        }
        if (x + r.width > window.innerWidth - margin) {
            nx = Math.max(margin, window.innerWidth - margin - r.width);
        }
        if (nx !== x || ny !== y) this._menu = {...this._menu, x: nx, y: ny};
        if (this._menu.sub) this._positionSub();
    }

    /** Place an open Move/Copy submenu against the viewport: flip it to the
     *  item's left when it would overflow the right edge, shift it up at the
     *  bottom, and cap its height (a site can have any number of views). */
    _positionSub() {
        const sub = this.renderRoot?.querySelector('.ctx-sub');
        const item = sub?.parentElement;
        if (!sub || !item) return;
        const r = item.getBoundingClientRect();
        const margin = 8;
        sub.style.maxHeight = 'none';
        const subW = sub.offsetWidth;
        const natural = sub.scrollHeight;

        let left = r.right - 2;
        if (left + subW > window.innerWidth - margin) left = Math.max(margin, r.left - subW + 2);
        const used = Math.min(natural, window.innerHeight - 2 * margin);
        let top = r.top - 4;
        if (top + used > window.innerHeight - margin) top = window.innerHeight - margin - used;
        if (top < margin) top = margin;

        sub.style.left = `${left}px`;
        sub.style.top = `${top}px`;
        sub.style.maxHeight = `${used}px`;
        sub.style.overflowY = natural > used ? 'auto' : '';
    }

    _openSub(type) {
        clearTimeout(this._subTimer);
        this._subTimer = null;
        this._menu = {...this._menu, sub: type};
    }

    _scheduleSubClose() {
        this._subTimer = setTimeout(() => {
            this._menu = this._menu ? {...this._menu, sub: null} : null;
            this._subTimer = null;
        }, 120);
    }

    _clearSubTimer() {
        clearTimeout(this._subTimer);
        this._subTimer = null;
    }

    _viewAction(action, name) {
        this._menu = null;
        const app = feezal?.app;
        if (action === 'rename') app?._editView?.(null, name);
        else if (action === 'duplicate') app?._duplicateView?.(name);
        else if (action === 'delete') app?._confirmDeleteView?.(name);
        else if (action === 'open') app?._setView?.(name);
        // U109: whole-view clipboard — delegated to the editor shell, so the
        // tab-bar menu and this one share one implementation.
        else if (action === 'copy') app?._copyView?.(name);
        else if (action === 'cut') app?._cutView?.(name);
        else if (action === 'paste') app?._pasteViewFromClipboard?.();
    }

    // ── drag: restack within a view, move/copy across views ─────────────────

    _onDragStart(event, el) {
        this._dragEl = el;
        this._copyDrag = event.ctrlKey || event.metaKey;
        // `copyMove` lets the browser show the platform's own copy cursor (the
        // little +) when Ctrl is held, and the plain move cursor otherwise.
        event.dataTransfer.effectAllowed = 'copyMove';
        event.dataTransfer.setData('text/plain', this._label(el));
    }

    _onDragOver(event, el) {
        if (!this._dragEl) return;
        // Restack only makes sense among siblings.
        if (el.parentElement !== this._dragEl.parentElement) return;
        event.preventDefault();
        this._copyDrag = event.ctrlKey || event.metaKey;
        event.dataTransfer.dropEffect = 'move';   // reordering is never a copy
        this._dropEl = el;
        this._dropView = null;
    }

    _onDrop(event, target) {
        event.preventDefault();
        const moved = this._dragEl;
        this._resetDrag();
        if (!moved || moved === target) return;
        const view = moved.parentElement;
        if (!view || target.parentElement !== view) return;

        // The list now runs in DOM order, so a drop takes the TARGET's row:
        // dragging downwards lands after it, dragging upwards lands before it.
        // (Both branches flipped when the tree stopped being reversed — with
        // the old order the same intent needed the opposite insert.)
        const list = this._elementsOf(view);
        if (list.indexOf(moved) < list.indexOf(target)) view.insertBefore(moved, target.nextSibling);
        else view.insertBefore(moved, target);

        feezal.app?.change();
        this.requestUpdate();
    }

    /** Dropping on a VIEW header moves the element into that view (Ctrl = copy). */
    _onViewDragOver(event, node) {
        if (!this._dragEl) return;
        event.preventDefault();
        this._copyDrag = event.ctrlKey || event.metaKey;
        event.dataTransfer.dropEffect = this._copyDrag ? 'copy' : 'move';
        this._dropView = node.name;
        this._dropEl = null;
    }

    _onViewDrop(event, node) {
        event.preventDefault();
        const moved = this._dragEl;
        const copy = this._copyDrag || event.ctrlKey || event.metaKey;
        this._resetDrag();
        if (!moved) return;
        const target = node.view;
        if (!target || moved.parentElement === target) return;

        const clone = feezal.app?._clone ? feezal.app._clone(moved) : moved.cloneNode(true);
        target.append(clone);
        if (!copy) moved.remove();
        feezal.app?.change();
        feezal.app?.toast?.(
            `${copy ? 'Copied' : 'Moved'} “${this._label(moved)}” to ${node.name}`,
            {variant: 'success'});
        this.requestUpdate();
    }

    _resetDrag() {
        this._dragEl = null;
        this._dropEl = null;
        this._dropView = null;
        this._copyDrag = false;
    }

    // ── render ──────────────────────────────────────────────────────────────

    _renderMenu() {
        const m = this._menu;
        if (!m) return '';
        const style = `left:${m.x}px; top:${m.y}px`;
        const otherViews = this._views
            .map(v => v.getAttribute('name'))
            .filter(n => n && n !== m.viewName);

        if (m.isView) {
            return html`
                <div class="ctx" style="${style}" @contextmenu="${e => e.preventDefault()}">
                    <div class="ctx-item" @click="${() => this._viewAction('open', m.viewName)}">Open view</div>
                    <div class="ctx-item" @click="${() => this._viewAction('rename', m.viewName)}">Rename…</div>
                    <div class="ctx-item" @click="${() => this._viewAction('duplicate', m.viewName)}">Duplicate</div>
                    <div class="ctx-sep"></div>
                    <div class="ctx-item" @click="${() => this._viewAction('copy', m.viewName)}">Copy view</div>
                    <div class="ctx-item" @click="${() => this._viewAction('cut', m.viewName)}">Cut view</div>
                    <div class="ctx-item" @click="${() => this._viewAction('paste', m.viewName)}">Paste view</div>
                    <div class="ctx-sep"></div>
                    <div class="ctx-item danger" @click="${() => this._viewAction('delete', m.viewName)}">Delete view</div>
                </div>`;
        }

        const locked = m.el?.hasAttribute('locked');
        return html`
            <div class="ctx" style="${style}" @contextmenu="${e => e.preventDefault()}">
                <div class="ctx-item" @click="${() => this._menuAction('cut')}">Cut</div>
                <div class="ctx-item" @click="${() => this._menuAction('copy')}">Copy</div>
                <div class="ctx-item" @click="${() => this._menuAction('duplicate')}">Duplicate</div>
                <div class="ctx-sep"></div>
                <div class="ctx-item" @click="${() => this._menuAction('bringToFront')}">Bring to front</div>
                <div class="ctx-item" @click="${() => this._menuAction('bringForward')}">Bring forward</div>
                <div class="ctx-item" @click="${() => this._menuAction('sendBackward')}">Send backward</div>
                <div class="ctx-item" @click="${() => this._menuAction('sendToBack')}">Send to back</div>
                ${otherViews.length ? html`
                    <div class="ctx-sep"></div>
                    <div class="ctx-item has-sub"
                        @mouseenter="${() => this._openSub('copy')}"
                        @mouseleave="${() => this._scheduleSubClose()}">
                        Copy to view… <span class="ctx-arrow">▶</span>
                        ${m.sub === 'copy' ? html`
                            <div class="ctx-sub"
                                @mouseenter="${() => this._clearSubTimer()}"
                                @mouseleave="${() => this._scheduleSubClose()}">
                                ${otherViews.map(v => html`
                                    <div class="ctx-item" @click="${() => this._menuMoveTo(v, false)}">${v}</div>`)}
                            </div>` : ''}
                    </div>
                    <div class="ctx-item has-sub"
                        @mouseenter="${() => this._openSub('move')}"
                        @mouseleave="${() => this._scheduleSubClose()}">
                        Move to view… <span class="ctx-arrow">▶</span>
                        ${m.sub === 'move' ? html`
                            <div class="ctx-sub"
                                @mouseenter="${() => this._clearSubTimer()}"
                                @mouseleave="${() => this._scheduleSubClose()}">
                                ${otherViews.map(v => html`
                                    <div class="ctx-item" @click="${() => this._menuMoveTo(v, true)}">${v}</div>`)}
                            </div>` : ''}
                    </div>` : ''}
                <div class="ctx-sep"></div>
                <div class="ctx-item" @click="${() => this._menuAction('lock')}">${locked ? 'Unlock' : 'Lock'}</div>
                <div class="ctx-item danger" @click="${() => this._menuAction('delete')}">Delete</div>
            </div>`;
    }

    _renderElement(el, node) {
        const selected = el.classList.contains('feezal-selected');
        const locked = el.hasAttribute('locked');
        const icon = this._icon(el);
        const topic = this._topic(el);
        const feezalId = this._feezalId(el);
        const type = this._type(el);
        const dropping = this._dropEl === el && this._dragEl && this._dragEl !== el;
        const before = dropping && node.elements.indexOf(this._dragEl) > node.elements.indexOf(el);
        return html`
            <li class="${selected ? 'selected' : ''} ${locked ? 'locked' : ''}
                       ${this._dragEl === el ? 'dragging' : ''}
                       ${dropping ? (before ? 'drop-before' : 'drop-after') : ''}"
                draggable="true"
                @click="${e => this._onRowClick(e, el, node)}"
                @contextmenu="${e => this._onElementContext(e, el, node)}"
                @dragstart="${e => this._onDragStart(e, el)}"
                @dragover="${e => this._onDragOver(e, el)}"
                @drop="${e => this._onDrop(e, el)}"
                @dragend="${() => this._resetDrag()}">
                <span class="grip" title="Drag to restack — drop on a view to move it there (Ctrl to copy)">⠿</span>
                <span class="ico" title="${type}">
                    ${icon ? html`<feezal-icon name="${icon}"></feezal-icon>`
                           : html`<span class="fallback">▢</span>`}
                </span>
                <span class="label" title="${type}">${this._label(el)}</span>
                ${feezalId ? html`<span class="fid" title="feezal-id: ${feezalId}">#${feezalId}</span>` : ''}
                ${topic ? html`<span class="topic" title="${topic}">${topic}</span>` : ''}
                <button class="lock ${locked ? 'on' : ''}" title="${locked ? 'Unlock' : 'Lock'}"
                    @click="${e => this._toggleLock(e, el)}">${locked ? '🔒' : '🔓'}</button>
            </li>`;
    }

    render() {
        const tree = this._tree;
        const filtering = Boolean(this._filter.trim());
        const currentView = this.view || feezal?.site?.view;
        return html`
            <sl-tab-group>
                <sl-tab slot="nav" panel="elements">Elements</sl-tab>
                <sl-tab-panel name="elements">
                    <div class="search">
                        <input type="search" placeholder="Filter elements — name, label, feezal-id or topic"
                            .value="${this._filter}"
                            @input="${e => { this._filter = e.target.value; }}"
                            @keydown="${e => { if (e.key === 'Escape') { this._filter = ''; e.stopPropagation(); } }}">
                    </div>
                    <div class="tree">
                        ${tree.length ? repeat(tree, n => n.name, node => html`
                            <div class="view-row ${node.name === currentView ? 'current' : ''}
                                        ${this._dropView === node.name ? 'drop-target' : ''}"
                                @click="${() => this._toggleView(node.name)}"
                                @contextmenu="${e => this._onViewContext(e, node)}"
                                @dragover="${e => this._onViewDragOver(e, node)}"
                                @drop="${e => this._onViewDrop(e, node)}">
                                <span class="caret">${node.open ? '▾' : '▸'}</span>
                                <span class="view-name" title="${node.name}">${node.name}</span>
                                <span class="badge">${node.elements.length}</span>
                            </div>
                            ${node.open ? html`
                                <ul>${repeat(node.elements, el => el, el => this._renderElement(el, node))}</ul>
                            ` : ''}`)
                        : html`<div class="empty">${filtering
                            ? html`Nothing matches “${this._filter}”.`
                            : html`This site has no elements yet.<br>Drag one in from the palette.`}</div>`}
                    </div>
                    ${filtering ? '' : html`<div class="hint">Top-most first. Drag to restack or onto a view to move it there (Ctrl = copy).</div>`}
                </sl-tab-panel>
            </sl-tab-group>
            ${this._renderMenu()}
        `;
    }
}

window.customElements.define('feezal-sidebar-layers', FeezalSidebarLayers);
export {FeezalSidebarLayers};

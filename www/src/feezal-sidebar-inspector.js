import {LitElement, html, css} from 'lit';

import DragSelect from 'dragselect';
import sortable from 'html5sortable/dist/html5sortable.es.js';
import interact from 'interactjs';

import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';

import './feezal-sidebar-inspector-styles.js';
import './feezal-sidebar-inspector-attributes.js';

class FeezalSidebarInspector extends LitElement {
    static properties = {
        viewSelected:   {type: Boolean, notify: true},
        selectedElems:  {type: Array},
        view:           {type: String},
        snapping:       {type: String, reflect: true},
        gridSize:       {type: Number, reflect: true},
        gridVisible:    {type: Boolean, reflect: true},
        gridColor:      {type: String, reflect: true},
        _ctxMenu:       {state: true},
        _shortcutsOpen: {state: true}
    };

    static styles = css`
        :host { display: flex; flex-direction: column; height: 100%; background-color: var(--feezal-bg, white); box-sizing: border-box; }
        sl-tab-group {
            flex: 1; min-height: 0; display: flex; flex-direction: column;
            --track-color: transparent;
        }
        sl-tab-group::part(base) { flex: 1; min-height: 0; display: flex; flex-direction: column; }
        sl-tab-group::part(body) { flex: 1; min-height: 0; overflow: hidden; }
        sl-tab-group::part(nav) { background: var(--feezal-bg-sub, #f5f5f5); }
        sl-tab::part(base) { font-size: 14px; padding: 10px 8px; }
        sl-tab-panel { height: 100%; }
        sl-tab-panel::part(base) { height: 100%; overflow-y: auto; padding: 0; box-sizing: border-box; }
        /* ── Selection badge ──────────────────────────────────────────────── */
        .sel-badge {
            margin-left: auto; align-self: center; margin-right: 8px;
            font-size: 11px; line-height: 1.4; padding: 2px 8px;
            border-radius: 10px;
            background: var(--feezal-sel-badge-bg, #e0f2fe);
            color: var(--feezal-sel-badge-color, #0369a1);
            border: 1px solid var(--feezal-sel-badge-border, #7dd3fc);
            white-space: nowrap; max-width: 150px;
            overflow: hidden; text-overflow: ellipsis;
            cursor: default; user-select: none; flex-shrink: 0;
        }

        /* ── Context menu ─────────────────────────────────────────────────── */
        .ctx-menu {
            position: fixed; z-index: 10000;
            background: var(--feezal-bg, #fff);
            border: 1px solid var(--feezal-border, #ccc);
            border-radius: 6px;
            box-shadow: 0 4px 20px rgba(0,0,0,.22);
            min-width: 180px; padding: 4px 0;
            font-size: 13px; color: var(--feezal-color, #333);
            user-select: none;
        }
        .ctx-item {
            position: relative;
            padding: 6px 12px 6px 28px;
            cursor: pointer;
            display: flex; align-items: center; gap: 16px;
            white-space: nowrap;
        }
        .ctx-item:hover:not(.ctx-disabled) { background: var(--sl-color-primary-600, #0284c7); color: #fff; }
        .ctx-disabled { opacity: 0.4; pointer-events: none; }
        .ctx-sep { height: 1px; background: var(--feezal-border, #ddd); margin: 4px 0; }
        .ctx-kbd { font-size: 11px; opacity: 0.65; font-family: monospace; margin-left: auto; }
        .ctx-arrow { font-size: 10px; opacity: 0.6; margin-left: auto; }
        .ctx-sub {
            position: absolute; left: calc(100% - 2px); top: -4px;
            background: var(--feezal-bg, #fff);
            border: 1px solid var(--feezal-border, #ccc);
            border-radius: 6px;
            box-shadow: 0 4px 20px rgba(0,0,0,.2);
            min-width: 140px; padding: 4px 0; z-index: 10001;
        }

        /* ── Keyboard shortcuts modal ────────────────────────────────────── */
        .shortcuts-overlay {
            position: fixed; inset: 0; z-index: 20000;
            background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center;
        }
        .shortcuts-modal {
            background: var(--feezal-bg, #fff); border: 1px solid var(--feezal-border, #ccc);
            border-radius: 10px; box-shadow: 0 8px 40px rgba(0,0,0,0.35);
            padding: 20px 24px; min-width: 340px; max-width: 480px;
            color: var(--feezal-color, #333); position: relative;
        }
        .shortcuts-modal h3 { margin: 0 0 14px; font-size: 15px; font-weight: 600; }
        .shortcuts-modal table { border-collapse: collapse; width: 100%; font-size: 13px; }
        .shortcuts-modal td { padding: 5px 4px; }
        .shortcuts-modal td:first-child { font-family: monospace; white-space: nowrap; min-width: 140px; opacity: 0.72; }
        .shortcuts-modal tr:not(:last-child) td { border-bottom: 1px solid var(--feezal-border, #eee); }
        .shortcuts-close {
            position: absolute; top: 10px; right: 12px;
            border: none; background: none; cursor: pointer; font-size: 18px;
            color: var(--feezal-color, #666); line-height: 1; padding: 2px;
        }
        .shortcuts-close:hover { color: #c00; }
    `;

    constructor() {
        super();
        this.viewSelected = false;
        this.selectedElems = [];
        this.editorConfig = {};
        this.currentView = [];
        this.snapping = 'elements';
        this.gridSize = 24;
        this.gridVisible = false;
        this.gridColor = '#cccccc';
        this.dragselect = {};
        this._ctxMenu = {visible: false, x: 0, y: 0, onElem: false, subMenu: null};
        this._shortcutsOpen = false;
        this._shiftDown = false;
        this._ctrlDown = false;
    }

    _selectionLabel() {
        const n = this.selectedElems?.length ?? 0;
        if (!n) return '';
        if (n > 1) return `${n} elements`;
        const el = this.selectedElems[0];
        if (this.viewSelected) {
            return `view: ${el.getAttribute?.('name') || '?'}`;
        }
        return (el.localName || '').replace('feezal-element-', '');
    }

    render() {
        const cm = this._ctxMenu;
        const hasClip = Boolean(feezal.app?._clipboardTpl?.content?.childNodes?.length);
        const otherViews = cm.visible ? this._otherViews() : [];
        const selLabel = this._selectionLabel();
        const isLocked = !this.viewSelected && this.selectedElems.length > 0 &&
            Boolean(this.selectedElems[0].hasAttribute?.('locked'));
        return html`
            <sl-tab-group>
                <sl-tab slot="nav" panel="attributes">Attributes</sl-tab>
                <sl-tab slot="nav" panel="styles">Styles</sl-tab>
                ${selLabel ? html`<div slot="nav" class="sel-badge" title="${selLabel}">${selLabel}</div>` : ''}
                <sl-tab-panel name="attributes">
                    <feezal-sidebar-inspector-attributes
                        .selectedElems="${this.selectedElems}">
                    </feezal-sidebar-inspector-attributes>
                </sl-tab-panel>
                <sl-tab-panel name="styles">
                    <feezal-sidebar-inspector-styles
                        .selectedElems="${this.selectedElems}">
                    </feezal-sidebar-inspector-styles>
                </sl-tab-panel>
            </sl-tab-group>
            ${cm.visible ? html`
                <div class="ctx-menu"
                    style="top:${cm.y}px;left:${cm.x}px"
                    @mousedown="${e => e.stopPropagation()}">
                    ${cm.onElem ? html`
                        <div class="ctx-item" @click="${() => this._ctxAction('cut')}">
                            Cut <span class="ctx-kbd">Ctrl+X</span>
                        </div>
                        <div class="ctx-item" @click="${() => this._ctxAction('copy')}">
                            Copy <span class="ctx-kbd">Ctrl+C</span>
                        </div>
                    ` : ''}
                    <div class="ctx-item ${hasClip ? '' : 'ctx-disabled'}" @click="${() => this._ctxAction('paste')}">
                        Paste <span class="ctx-kbd">Ctrl+V</span>
                    </div>
                    ${cm.onElem ? html`
                        <div class="ctx-item" @click="${() => this._ctxAction('duplicate')}">
                            Duplicate <span class="ctx-kbd">Ctrl+D</span>
                        </div>
                        <div class="ctx-sep"></div>
                        <div class="ctx-item"
                            @mouseenter="${() => this._openCtxSub('copy')}"
                            @mouseleave="${() => this._scheduleCtxSub(null)}">
                            Copy to view… <span class="ctx-arrow">▶</span>
                            ${cm.subMenu === 'copy' ? html`
                                <div class="ctx-sub"
                                    @mouseenter="${() => this._clearCtxSub()}"
                                    @mouseleave="${() => this._scheduleCtxSub(null)}">
                                    ${otherViews.map(v => html`
                                        <div class="ctx-item" @click="${() => this._ctxCopyToView(v, false)}">${v}</div>
                                    `)}
                                </div>
                            ` : ''}
                        </div>
                        <div class="ctx-item"
                            @mouseenter="${() => this._openCtxSub('move')}"
                            @mouseleave="${() => this._scheduleCtxSub(null)}">
                            Move to view… <span class="ctx-arrow">▶</span>
                            ${cm.subMenu === 'move' ? html`
                                <div class="ctx-sub"
                                    @mouseenter="${() => this._clearCtxSub()}"
                                    @mouseleave="${() => this._scheduleCtxSub(null)}">
                                    ${otherViews.map(v => html`
                                        <div class="ctx-item" @click="${() => this._ctxCopyToView(v, true)}">${v}</div>
                                    `)}
                                </div>
                            ` : ''}
                        </div>
                        <div class="ctx-sep"></div>
                        <div class="ctx-item" @click="${() => this._ctxAction('delete')}">
                            Delete <span class="ctx-kbd">Del</span>
                        </div>
                        <div class="ctx-sep"></div>
                        <div class="ctx-item" @click="${() => this._ctxAction('lock')}">
                            ${isLocked ? 'Unlock' : 'Lock'} <span class="ctx-kbd">Ctrl+L</span>
                        </div>
                    ` : ''}
                    <div class="ctx-item" @click="${() => this._ctxAction('selectAll')}">
                        Select All <span class="ctx-kbd">Ctrl+A</span>
                    </div>
                </div>
            ` : ''}
            ${this._shortcutsOpen ? html`
                <div class="shortcuts-overlay" @click="${() => this._shortcutsOpen = false}">
                    <div class="shortcuts-modal" @click="${e => e.stopPropagation()}">
                        <button class="shortcuts-close" @click="${() => this._shortcutsOpen = false}">×</button>
                        <h3>Keyboard Shortcuts</h3>
                        <table>
                            <tr><td>Delete</td><td>Delete selected elements</td></tr>
                            <tr><td>Escape</td><td>Deselect / close dialog</td></tr>
                            <tr><td>Ctrl+Z</td><td>Undo</td></tr>
                            <tr><td>Ctrl+A</td><td>Select all elements</td></tr>
                            <tr><td>Ctrl+C / X / V</td><td>Copy / Cut / Paste</td></tr>
                            <tr><td>Ctrl+D</td><td>Duplicate selection</td></tr>
                            <tr><td>Ctrl+L</td><td>Lock / unlock selection</td></tr>
                            <tr><td>Ctrl+I / ?</td><td>Open this shortcuts dialog</td></tr>
                            <tr><td>Arrow keys</td><td>Nudge by 1 px</td></tr>
                            <tr><td>Alt+Arrow keys</td><td>Nudge by grid size</td></tr>
                            <tr><td>Ctrl+click</td><td>Add / remove element from selection</td></tr>
                            <tr><td>Ctrl while drag/resize</td><td>Disable snapping temporarily (or enable element snap when off)</td></tr>
                            <tr><td>Shift while drag/resize</td><td>Switch snap mode: elements ↔ grid (or enable grid when off)</td></tr>
                        </table>
                    </div>
                </div>
            ` : ''}
        `;
    }

    connectedCallback() {
        super.connectedCallback();

        // Inject global CSS for the lock-icon decorator on locked editable elements.
        // Uses CSS mask so the icon inherits the editor selection colour variable.
        if (!document.getElementById('feezal-editor-lock-style')) {
            const style = document.createElement('style');
            style.id = 'feezal-editor-lock-style';
            // SVG lock icon (Material Design) encoded for data URL
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z'/></svg>`;
            const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
            style.textContent = `
                .feezal-editable[locked]::after {
                    content: '';
                    display: block;
                    position: absolute;
                    top: -1px; right: -1px;
                    width: 14px; height: 14px;
                    background-color: rgba(var(--feezal-selection-rgb, 2,132,199), 0.9);
                    -webkit-mask: ${url} center / contain no-repeat;
                    mask: ${url} center / contain no-repeat;
                    pointer-events: none;
                    z-index: 1000;
                }
            `;
            document.head.append(style);
        }

        this._onConnected = e => {
            if (!e.detail.reconnect) {
                feezal.connection.getSite(feezal.siteName, data => {
                    console.log('getSite', data);
                    // data.viewer is the whole config object {connection, viewer}.
                    // data.viewer.viewer holds the viewer-specific settings (theme, etc.).
                    const viewerConfig = data.viewer && data.viewer.viewer;
                    this.loadViews(data.views, viewerConfig);
                    if (data.viewer && data.viewer.connection) {
                        const viewerSidebar = feezal.app.shadowRoot.querySelector('feezal-sidebar-viewer');
                        if (viewerSidebar) {
                            viewerSidebar.connection = data.viewer.connection;
                        }
                    }

                    this._keyboard();
                });
            }
        };
        feezal.connection.addEventListener('connected', this._onConnected);

        this._snapKeyDown = e => {
            const prevShift = this._shiftDown;
            const prevCtrl = this._ctrlDown;
            this._shiftDown = e.shiftKey;
            this._ctrlDown = e.ctrlKey;
            // If modifiers changed during an active drag/resize, hide element snap lines
            // immediately — they will redraw on next mousemove when still appropriate.
            if ((this._shiftDown !== prevShift || this._ctrlDown !== prevCtrl) &&
                    (this.dragElement || this.resizeElement)) {
                for (const id of ['#vsnap1', '#vsnap2', '#hsnap1', '#hsnap2']) {
                    const el = feezal.container.querySelector(id);
                    if (el) el.style.display = 'none';
                }
            }
        };
        this._snapKeyUp = e => {
            this._shiftDown = e.shiftKey;
            this._ctrlDown = e.ctrlKey;
        };
        document.addEventListener('keydown', this._snapKeyDown);
        document.addEventListener('keyup', this._snapKeyUp);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        feezal.connection.removeEventListener('connected', this._onConnected);
        if (this._keyHandler) {
            window.removeEventListener('keydown', this._keyHandler);
            this._keyboardBound = false;
        }
        document.removeEventListener('keydown', this._snapKeyDown);
        document.removeEventListener('keyup', this._snapKeyUp);
    }

    restoreViews(html) {
        this.dragselect = {};
        if (html !== undefined) {
            feezal.site.innerHTML = html;
        }

        feezal.app.views = [...feezal.views];
        feezal.site.querySelectorAll('.dragselect-rectangle').forEach(el => el.remove());
        feezal.app._removeClassesFromChildren(feezal.site, ['feezal-selected', 'feezal-editable', 'ds-selectable']);
        this._viewChanged();
    }

    loadViews(data, viewerConfig) {
        this.dragselect = {};
        feezal.app.innerHTML = data;
        feezal.app.views = [...feezal.views];
        feezal.app._removeClassesFromChildren(feezal.site, ['feezal-selected']);
        feezal.site.querySelectorAll('.dragselect-rectangle').forEach(el => el.remove());
        feezal.ready = true;
        feezal.app.shadowRoot.querySelector('feezal-sidebar-themes').siteReady(viewerConfig);
        feezal.app.addHistory();
        this._viewChanged();
        feezal.site.setAttribute('tabindex', 1);
        const firstView = feezal.views[0];
        const navView = feezal.app.nav.view || (firstView && firstView.getAttribute('name')) || '';
        if (!feezal.app.nav.view && firstView) {
            // Navigate to first view if no hash set yet
            feezal.app._setView(navView);
        }

        feezal.site.view = navView;
        feezal.site.updateVisibility();
    }

    updated(changed) {
        if (changed.has('snapping')) {
            // handled by app-editor observer
        }

        if (changed.has('gridSize')) {
            this._gridSizeChanged();
        }

        if (changed.has('gridColor')) {
            this._gridSizeChanged();
        }

        if (changed.has('gridVisible')) {
            this._gridVisibleChanged(this.gridVisible);
        }

        if (changed.has('view')) {
            this._viewChanged();
        }
    }

    _gridSizeChanged() {
        const grid = feezal.app.shadowRoot.querySelector('#grid');
        if (grid) {
            Object.assign(grid.style, {
                backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent ${this.gridSize - 1}px, rgba(0,0,0,0.1) ${this.gridSize - 1}px, ${this.gridColor} ${this.gridSize}px), repeating-linear-gradient(-90deg, transparent, transparent ${this.gridSize - 1}px, rgba(0,0,0,0.1) ${this.gridSize - 2}px, rgba(0,0,0,0.1) ${this.gridSize}px)`,
                backgroundSize: `${this.gridSize}px ${this.gridSize}px`
            });
        }

        // Keep snap helper line colors in sync with the configured grid color.
        for (const id of ['#vsnap1', '#vsnap2', '#hsnap1', '#hsnap2']) {
            const el = feezal.app.shadowRoot.querySelector(id);
            if (el) el.style.borderColor = this.gridColor;
        }
    }

    _gridVisibleChanged(value) {
        const grid = feezal.app.shadowRoot.querySelector('#grid');
        if (grid) {
            grid.style.display = value ? 'block' : 'none';
        }
    }

    _updateSelection() {
        // Don't disrupt an in-progress interact drag — DragSelect fires callback
        // via ds.break() in its dragstart handler and would otherwise reset
        // selectedElems to [view] before interact's onmove runs.
        if (this.dragElement) return;

        const view = feezal.getView(this.view);
        const selectedElems = [...view.querySelectorAll('.feezal-selected')];
        if (selectedElems.length > 0) {
            this.selectedElems = selectedElems;
            this.viewSelected = false;
        } else {
            this.selectedElems = [view];
            this.viewSelected = true;
        }

        this.dispatchEvent(new CustomEvent('view-selected-changed', {bubbles: true, composed: true, detail: {value: this.viewSelected}}));
    }

    _initSortable(view) {
        sortable(view, {
            items: '.feezal-element',
            forcePlaceholderSize: true,
            placeholderClass: 'feezal-placeholder'
        });
    }

    _initDragSelect() {
        const view = feezal.getView(this.view);
        if (!this.dragselect) {
            this.dragselect = {};
        }

        if (!this.dragselect[this.view]) {
            const selector = document.createElement('div');
            selector.style.cssText = 'position:absolute;background:rgba(0,0,0,0.1);border:1px dotted rgba(250,120,0,0.8);display:none;pointer-events:none';
            selector.classList.add('dragselect-rectangle');
            view.append(selector);

            const ds = new DragSelect({
                area: view,
                selector,
                selectedClass: 'feezal-selected',
                keyboardDrag: false
            });
            ds.subscribe('dragstart', ({event}) => {
                if (event && event.target && event.target.tagName !== 'FEEZAL-VIEW') {
                    ds.break();
                } else {
                    // A real rubber-band drag is starting.
                    this._dsDidDrag = true;
                }
            });
            ds.subscribe('callback', ({items}) => {
                const wasDrag = this._dsDidDrag;
                this._dsDidDrag = false;

                if (!wasDrag) {
                    // ds.break() was called — this was a click on an element or an
                    // interact.js drag gesture, not a rubber-band. Do nothing here:
                    // the click handler (or selectElement called from onstart) manages
                    // selectedElems and feezal-selected classes. Removing classes here
                    // would strip the selection outline immediately after a drag ends.
                    return;
                }

                // Rubber-band gesture (including zero-distance click on empty canvas).
                // Synchronise feezal-selected with DragSelect's reported selection:
                // clear all first, then re-apply what DragSelect says is selected.
                // This handles the case where DragSelect does not clear previously
                // selected elements for a zero-distance rubber band.
                [...feezal.view.querySelectorAll('.feezal-selected')]
                    .forEach(el => el.classList.remove('feezal-selected'));
                items.forEach(el => el.classList.add('feezal-selected'));

                this._updateSelection();
                // Suppress the click event that fires on mouseup after a rubber-band
                // drag — it would otherwise clear the selection we just set.
                this._ignoreNextClick = true;
                setTimeout(() => { this._ignoreNextClick = false; }, 50);
            });
            this.dragselect[this.view] = ds;

            // Seed already-present editable elements (querySelectorAll with wildcard
            // tag names is not valid CSS; use class-based query instead).
            const existing = [...view.querySelectorAll('.feezal-editable')];
            if (existing.length > 0) {
                ds.addSelectables(existing);
            }

            // Reliable click-selection via composedPath — DragSelect alone cannot
            // reliably detect clicks on Polymer elements with shadow DOM.
            // Capture phase fires before Polymer's internal event handlers.
            // Also handles empty-space clicks to select the view, so view selection
            // is not solely dependent on DragSelect's callback (which can become
            // unreliable after stop()/start() cycles on view switch).
            view.addEventListener('click', e => {
                // Ignore the synthetic click that fires after rubber-band selection or
                // element drag ends — those gestures set _ignoreNextClick to prevent
                // inadvertently clearing the selection.
                if (this._ignoreNextClick) { this._ignoreNextClick = false; return; }

                const elem = e.composedPath().find(
                    el => el.localName && el.localName.startsWith('feezal-element-') && el.feezalEditable
                );
                if (!elem) {
                    // Click on empty canvas space — select the view itself.
                    this.selectElement();
                    return;
                }

                if (e.shiftKey || e.ctrlKey || e.metaKey) {
                    const cur = this.selectedElems.filter(el => el.tagName !== 'FEEZAL-VIEW');
                    const newSel = cur.includes(elem) ? cur.filter(el => el !== elem) : [...cur, elem];
                    this.selectElement(newSel.length ? newSel : undefined);
                } else {
                    this.selectElement(elem);
                }
            }, true); // capture phase

            // Context menu (right-click) on the canvas
            view.addEventListener('contextmenu', e => {
                e.preventDefault();
                e.stopPropagation();
                const elem = e.composedPath().find(
                    el => el.localName && el.localName.startsWith('feezal-element-') && el.feezalEditable
                );
                if (elem && !this.selectedElems.includes(elem)) {
                    this.selectElement(elem);
                }
                const onElem = Boolean(elem) && !this.viewSelected;
                this._showCtxMenu(e.clientX, e.clientY, onElem);
            }, true);
        }

        // Defer start() to the next animation frame so DragSelect computes
        // the SelectorArea position AFTER feezal-view.style.display has been
        // set to '' by feezal-view's own Lit update (which runs as a microtask
        // after _viewChanged). Without this, the view is still display:none
        // when updatePos() runs, giving a zero-size SelectorArea that blocks
        // all clicks (B2).
        const viewName = this.view;
        requestAnimationFrame(() => {
            if (this.view === viewName && this.dragselect && this.dragselect[viewName]) {
                this.dragselect[viewName].start();
            }
        });
    }

    _viewChanged() {
        if (!feezal.ready) {
            return;
        }

        const view = feezal.getView(this.view);
        const views = [...feezal.site.querySelectorAll('feezal-view')].map(v => v.name);
        if (!views.includes(this.view)) {
            this.view = views[0];
            location.hash = '/' + this.view;
        }

        // Stop DragSelect on all other views so only the active view
        // responds to pointer events. Without this, all views' DragSelect
        // instances compete for the same events when views were still visible.
        Object.entries(this.dragselect).forEach(([name, ds]) => {
            if (name !== this.view) ds.stop();
        });

        switch (view.childPosition) {
            case 'static':
                this._initSortable(view);
                break;
            default:
                this._initDragSelect();
        }

        this.currentView = [view];
        [...view.children].forEach(element => {
            if (element.localName.startsWith('feezal-element-') && !element.feezalEditable) {
                this.initElem(element);
            } else if (this.dragselect[this.view]) {
                this.dragselect[this.view].removeSelection(element);
            }
        });

        this.selectElement();
    }

    _keyboard() {
        if (this._keyboardBound) return;
        this._keyboardBound = true;
        this._keyHandler = event => {
            // Don't intercept when a text input has focus (e.g. inspector sl-input).
            const ae = document.activeElement;
            if (ae) {
                if (['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName)) return;
                if (ae.isContentEditable) return;
                // Shoelace components delegate focus to an inner <input> in their shadow root.
                const shadowActive = ae.shadowRoot && ae.shadowRoot.activeElement;
                if (shadowActive && ['INPUT', 'TEXTAREA'].includes(shadowActive.tagName)) return;
            }

            // Dialog-level shortcuts work regardless of canvas focus.
            if (this._shortcutsOpen && event.key === 'Escape') {
                this._shortcutsOpen = false;
                event.stopPropagation();
                return;
            }

            // Ctrl+I toggles the shortcuts dialog regardless of canvas focus.
            if ((event.metaKey || event.ctrlKey) && event.key === 'i') {
                event.preventDefault();
                this._shortcutsOpen = !this._shortcutsOpen;
                return;
            }

            // View deletion works regardless of whether feezal-site has focus
            // (clicking a tab focuses the tab, not feezal-site).
            if (event.key === 'Delete' && this.viewSelected) {
                return; // TECHNICAL DEBT: SKIP THIS FOR NOW. WE CAN'T REALLIABLY DETECT WHERE FOCUS IS...
                this.dispatchEvent(new CustomEvent('delete-view', {
                    bubbles: true, composed: true,
                    detail: { name: feezal.view?.getAttribute('name') }
                }));
                return;
            }

            // Arrow-key movement: only when feezal-site itself is document.activeElement.
            if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
                if (!this.viewSelected && document.activeElement.tagName === 'FEEZAL-SITE') {
                    const step = (event.ctrlKey || event.shiftKey) ? 1 : this.gridSize;
                    if (event.key === 'ArrowRight')     this._moveElems(step, 0, true);
                    else if (event.key === 'ArrowLeft') this._moveElems(-step, 0, true);
                    else if (event.key === 'ArrowUp')   this._moveElems(0, -step, true);
                    else                                this._moveElems(0, step, true);
                    event.stopPropagation();
                }
                return;
            }

            // Canvas shortcuts only fire when feezal-site itself has keyboard focus
            // (i.e. the user last clicked on the canvas, not on a sidebar control).
            if (feezal.app.querySelector('feezal-site:focus')) {
                switch (event.key) {
                    case 'Delete':
                        if (!this.viewSelected) {
                            this._deleteElems();
                        }

                        break;
                    case 'Escape':
                        if (!this.viewSelected) {
                            this.selectElement(this.currentView);
                        }

                        break;
                    case 'z':
                        if ((event.metaKey || event.ctrlKey) && !this.viewSelected) {
                            feezal.app._undo();
                        }

                        break;
                    case 'a':
                        if (event.metaKey || event.ctrlKey) {
                            event.preventDefault();
                            this.selectElement(feezal.view.querySelectorAll('.feezal-editable'));
                        }

                        break;
                    case 'd':
                        if ((event.metaKey || event.ctrlKey) && !this.viewSelected) {
                            event.preventDefault();
                            this._duplicateElems();
                        }

                        break;
                    case 'l':
                        if ((event.metaKey || event.ctrlKey) && !this.viewSelected) {
                            event.preventDefault();
                            this.selectedElems.forEach(el => {
                                const willLock = !el.hasAttribute('locked');
                                el.toggleAttribute('locked', willLock);
                                this.setLocked(el, willLock);
                            });
                            feezal.app.change();
                            this.selectedElems = [...this.selectedElems];
                        }

                        break;
                    case '?':
                        if (!event.metaKey && !event.ctrlKey) {
                            this._shortcutsOpen = !this._shortcutsOpen;
                        }

                        break;
                    default:
                        return;
                }

                event.stopPropagation();
            }
        };
        window.addEventListener('keydown', this._keyHandler);
    }

    _deleteElems() {
        this.selectedElems.forEach(el => el.remove());
        this.selectedElems = [];
        feezal.app.change();
    }

    _selectedElemsChanged() {
        const tabs = feezal.app.shadowRoot.querySelector('#tabs');
        if (tabs) {
            if (this.selectedElems.length === 1 && this.selectedElems[0].tagName === 'FEEZAL-VIEW') {
                tabs.style.setProperty('--tab-active-color', 'orange');
            } else {
                tabs.style.removeProperty('--tab-active-color');
            }
        }

        feezal.app.sidebar = 'inspector';
    }

    _moveElems(dx, dy) {
        this.selectedElems
            .filter(el => !el.hasAttribute('locked'))
            .forEach(element => {
                if (dx) {
                    element.style.left = ((Number.parseFloat(element.style.left) || 0) + dx) + 'px';
                }

                if (dy) {
                    element.style.top = ((Number.parseFloat(element.style.top) || 0) + dy) + 'px';
                }
            });
        this.shadowRoot.querySelector('feezal-sidebar-inspector-styles').setStyle(this.selectedElems[0], ['left', 'top']);
        if (!this.dragElement) {
            clearTimeout(this.changeTimeout);
            this.changeTimeout = setTimeout(() => feezal.app.change(), 3000);
        }
    }

    _snapSize(x, y) {
        if (this.resizeElement) {
            const rect = this.resizeElement.getBoundingClientRect();
            const snap = this._snap(x + rect.x, y + rect.y);
            if (snap) {
                const object = {range: snap.range};
                if (snap.x) {
                    object.width = snap.x - rect.x;
                }

                if (snap.y) {
                    object.height = snap.y - rect.y;
                }

                return object;
            }
        }
    }

    // Compute the active snapping mode given the current modifier key state.
    // Shift switches between 'grid' and 'elements' (from 'off' activates 'grid').
    // Ctrl alone toggles: configured → off; off → elements.
    _effectiveSnapping() {
        const base = this.snapping;
        if (this._shiftDown) {
            if (base === 'elements') return 'grid';
            if (base === 'grid') return 'elements';
            return 'grid'; // off + shift → grid
        }
        if (this._ctrlDown) {
            return base === 'off' ? 'elements' : 'off';
        }
        return base;
    }

    _snap(x, y) {
        const effective = this._effectiveSnapping();
        if (effective === 'off') {
            return;
        }

        const view = feezal.getView(this.view);
        const viewRect = view.getBoundingClientRect();

        if (effective === 'grid') {
            return {
                x: Math.floor(Math.round((x - viewRect.x) / this.gridSize) * this.gridSize + viewRect.x),
                y: Math.floor(Math.round((y - viewRect.y) / this.gridSize) * this.gridSize + viewRect.y),
                range: Math.floor(this.gridSize / 2.5)
            };
        }

        const vsnap1 = feezal.container.querySelector('#vsnap1');
        const hsnap1 = feezal.container.querySelector('#hsnap1');
        const vsnap2 = feezal.container.querySelector('#vsnap2');
        const hsnap2 = feezal.container.querySelector('#hsnap2');

        // cvTop: top of #container-view in viewport coords — snap lines are absolutely
        // positioned inside it, so their CSS `top` must be relative to this value.
        const cvRect = feezal.app.shadowRoot.querySelector('#container-view').getBoundingClientRect();
        const cvTop = cvRect.top;
        // snapLineTop: how far down (in px, relative to #container-view) the vertical
        // snap lines should start — measured from the bottom of the tab menu bar so
        // the lines never bleed into the tab switcher.
        const menuBottom = feezal.app.shadowRoot.querySelector('#container-view-menu').getBoundingClientRect().bottom;
        const snapLineTop = Math.round(menuBottom - cvRect.top);

        // Points to compare against other elements' edges.
        // When dragging: all 4 corners of the drag element. x,y is the TL corner
        // (relativePoints: [{x:0,y:0}]), so other corners are derived from the element size.
        // When called from _snapSize (resize, dragElement is null): single point x,y.
        let corners;
        if (this.dragElement) {
            const dr = this.dragElement.getBoundingClientRect();
            corners = [
                { x,              y },
                { x: x + dr.width, y },
                { x,              y: y + dr.height },
                { x: x + dr.width, y: y + dr.height },
            ];
        } else {
            corners = [{ x, y }];
        }

        const range = 24;
        // Track the nearest X and Y snaps across ALL corners × ALL elements.
        // nearX / nearY start at `range` so that only edges within range win.
        let nearX = range;
        let nearY = range;
        const object = {};
        let vsnapEl = null, vsnapOtherEl = null, vsnapPos;
        let hsnapEl = null, hsnapOtherEl = null, hsnapPos;

        [...view.children].forEach(element => {
            if (!element.localName.startsWith('feezal-element-') || element === this.resizeElement || element === this.dragElement) {
                return;
            }

            const rect = element.getBoundingClientRect();
            const tx = rect.x - viewRect.x;
            const ty = rect.y - cvTop;
            const tr = tx + rect.width;
            const tb = ty + rect.height;

            for (const corner of corners) {
                const cx = corner.x - viewRect.x;
                const cy = corner.y - cvTop;

                const distX = Math.abs(cx - tx);
                const distR = Math.abs(cx - tr);
                const distY = Math.abs(cy - ty);
                const distB = Math.abs(cy - tb);

                // X snaps — return the x value that TL (= x argument) must reach so
                // that THIS corner aligns with the element edge.
                if (distX < nearX) {
                    nearX = distX;
                    object.x = tx + viewRect.x + (x - corner.x);
                    vsnapEl = vsnap1; vsnapOtherEl = vsnap2; vsnapPos = tx;
                }
                if (distR < nearX) {
                    nearX = distR;
                    object.x = tr + viewRect.x + (x - corner.x);
                    vsnapEl = vsnap2; vsnapOtherEl = vsnap1; vsnapPos = tr;
                }

                // Y snaps — same principle on the vertical axis.
                if (distY < nearY) {
                    nearY = distY;
                    object.y = ty + cvTop + (y - corner.y);
                    hsnapEl = hsnap1; hsnapOtherEl = hsnap2; hsnapPos = ty;
                }
                if (distB < nearY) {
                    nearY = distB;
                    object.y = tb + cvTop + (y - corner.y);
                    hsnapEl = hsnap2; hsnapOtherEl = hsnap1; hsnapPos = tb;
                }
            }
        });

        // Show the winning snap line, hide the other in each axis.
        if (vsnapEl) {
            vsnapEl.style.cssText = `left:${vsnapPos - 1}px;display:block;top:${snapLineTop}px;height:calc(100% - ${snapLineTop}px)`;
            vsnapOtherEl.style.display = 'none';
        } else {
            vsnap1.style.display = 'none';
            vsnap2.style.display = 'none';
        }
        if (hsnapEl) {
            hsnapEl.style.cssText = `top:${hsnapPos - 1.5}px;display:block`;
            hsnapOtherEl.style.display = 'none';
        } else {
            hsnap1.style.display = 'none';
            hsnap2.style.display = 'none';
        }

        if (object.x !== undefined || object.y !== undefined) {
            // When both axes snap simultaneously, set range to the actual combined
            // distance + 1 so interact.js's Euclidean check always passes.
            object.range = (object.x !== undefined && object.y !== undefined)
                ? Math.ceil(Math.sqrt(nearX * nearX + nearY * nearY)) + 1
                : range;
            return object;
        }
    }

    initElem(element, created) {
        if (element.feezalEditable) {
            return;
        }

        const absolute = element.parentNode.childPosition === 'absolute';
        element.feezalEditable = true;
        element.classList.add('feezal-editable');
        const elementOptions = window.customElements.get(element.localName) && window.customElements.get(element.localName).feezal || {};

        if (!elementOptions) {
            console.error(element.localName, 'feezal property missing');
            return;
        }

        if (created && elementOptions.defaultStyle) {
            Object.assign(element.style, elementOptions.defaultStyle);
        }

        if (absolute) {
            if (element.hasAttribute('locked')) {
                // Locked: register for selection only, skip drag/resize interact
                const ds = this.dragselect && this.dragselect[this.view];
                if (ds) ds.addSelectables(element);
                element._feezalInDragSelect = true;
            } else {
                this.initAbsolute(element, elementOptions);
            }
        } else {
            this.initStatic(element, elementOptions);
        }
    }

    setLocked(element, locked) {
        if (locked) {
            interact(element).unset();
        } else {
            this.initAbsolute(element);
        }
    }

    initStatic(element) {
        element.addEventListener('click', () => {
            [...feezal.view.querySelectorAll('.feezal-selected')].forEach(el => el.classList.remove('feezal-selected'));
            this.selectElement(element);
        });
    }

    initAbsolute(element) {
        // Register with DragSelect (guard against double-registration on re-init after unlock)
        const ds = this.dragselect && this.dragselect[this.view];
        if (ds && !element._feezalInDragSelect) {
            ds.addSelectables(element);
            element._feezalInDragSelect = true;
        }

        interact(element)
            .draggable({
                restrict: {
                    // Always recompute — feezal.view moves in the viewport as the
                    // canvas container scrolls, so a cached rect would become stale.
                    // Subtract 1px from bottom so the element never lands on the
                    // exact bottom edge, which would trigger a spurious scrollbar.
                    restriction: () => {
                        const r = feezal.view.getBoundingClientRect();
                        return {left: r.left, top: r.top, right: r.right, bottom: r.bottom - 1};
                    },
                    elementRect: {top: 0, left: 0, bottom: 1, right: 1}
                },
                autoScroll: {
                    enabled: true,
                    container: feezal.site,
                    speed: 300,
                    margin: 40
                },
                snap: {
                    targets: [(x, y) => this._snap(x, y)],
                    relativePoints: [{x: 0, y: 0}]
                },
                onstart: event => {
                    this.dragElement = element;
                    // Use selectedElems (authoritative state) rather than the CSS class —
                    // DragSelect adds selectedClass on pointerdown before onstart fires,
                    // so the CSS check would incorrectly skip selectElement().
                    if (!this.selectedElems.includes(element)) {
                        this.selectElement(element);
                    }
                    // Re-apply feezal-selected to all selected elements. DragSelect
                    // clears the class on all elements during ds.break() (which fires
                    // on every pointer-down on an element), before our callback can
                    // guard against it — leaving non-dragged elements without the
                    // selection outline for the duration of the drag.
                    this.selectedElems.forEach(el => el.classList.add('feezal-selected'));

                    this.selectedElems
                        .filter(el => el.tagName !== 'FEEZAL-VIEW' && !el.hasAttribute('locked'))
                        .forEach(el => {
                            el._startLeft = Number.parseFloat(el.style.left) || 0;
                            el._startTop = Number.parseFloat(el.style.top) || 0;
                        });
                },
                onmove: event => {
                    this.selectedElems
                        .filter(el => el.tagName !== 'FEEZAL-VIEW' && !el.hasAttribute('locked'))
                        .forEach(el => {
                            el._startLeft = (el._startLeft || 0) + event.dx;
                            el._startTop = (el._startTop || 0) + event.dy;
                            el.style.left = Math.round(el._startLeft) + 'px';
                            el.style.top = Math.round(el._startTop) + 'px';
                        });
                    this.shadowRoot.querySelector('feezal-sidebar-inspector-styles').setStyle(element, ['left', 'top']);
                },
                onend: () => {
                    this.dragElement = null;
                    // Suppress the click that browsers fire on mouseup after a drag
                    // — it would otherwise reset a multi-selection to a single element.
                    this._ignoreNextClick = true;
                    setTimeout(() => { this._ignoreNextClick = false; }, 50);
                    feezal.app.change();
                    const vsnap1 = feezal.container.querySelector('#vsnap1');
                    const vsnap2 = feezal.container.querySelector('#vsnap2');
                    const hsnap1 = feezal.container.querySelector('#hsnap1');
                    const hsnap2 = feezal.container.querySelector('#hsnap2');
                    if (vsnap1) { vsnap1.style.display = 'none'; }
                    if (vsnap2) { vsnap2.style.display = 'none'; }
                    if (hsnap1) { hsnap1.style.display = 'none'; }
                    if (hsnap2) { hsnap2.style.display = 'none'; }
                }
            })
            .on('autoscroll', event => {
                // The canvas container scrolled during the drag. Compensate by
                // shifting each dragged element's position by the scroll delta so
                // the element stays visually pinned under the pointer.
                if (element !== this.dragElement) return;
                this.selectedElems
                    .filter(el => el.tagName !== 'FEEZAL-VIEW' && !el.hasAttribute('locked'))
                    .forEach(el => {
                        el._startLeft = (el._startLeft || 0) + event.delta.x;
                        el._startTop  = (el._startTop  || 0) + event.delta.y;
                        el.style.left = Math.round(el._startLeft) + 'px';
                        el.style.top  = Math.round(el._startTop)  + 'px';
                    });
                this.shadowRoot.querySelector('feezal-sidebar-inspector-styles').setStyle(element, ['left', 'top']);
            })
            .resizable({
                edges: {right: true, bottom: true, left: '.resize-left', top: false},
                snapSize: {targets: [(x, y) => this._snapSize(x, y)]},
                onstart: () => { this.resizeElement = element; },
                onmove: event => {
                    if (event.rect.width > 10) {
                        element.style.width = Math.round(event.rect.width) + 'px';
                    }

                    if (event.rect.height > 10) {
                        element.style.height = Math.round(event.rect.height) + 'px';
                    }

                    this.shadowRoot.querySelector('feezal-sidebar-inspector-styles').setStyle(element, ['width', 'height']);
                },
                onend: () => {
                    this.resizeElement = null;
                    feezal.app.change();
                    for (const id of ['#vsnap1', '#vsnap2', '#hsnap1', '#hsnap2']) {
                        const el = feezal.container.querySelector(id);
                        if (el) el.style.display = 'none';
                    }
                }
            });
    }

    selectElement(elems) {
        const view = feezal.getView(this.view);
        [...view.querySelectorAll('.feezal-selected')].forEach(el => el.classList.remove('feezal-selected'));

        if (!elems) {
            this.selectedElems = [view];
            this.viewSelected = true;
            this.dispatchEvent(new CustomEvent('view-selected-changed', {bubbles: true, composed: true, detail: {value: true}}));
            return;
        }

        const arr = elems instanceof NodeList ? [...elems] : (Array.isArray(elems) ? elems : [elems]);
        arr.forEach(el => el.classList.add('feezal-selected'));
        this.selectedElems = arr;
        this.viewSelected = arr.length === 1 && arr[0].tagName === 'FEEZAL-VIEW';
        this.dispatchEvent(new CustomEvent('view-selected-changed', {bubbles: true, composed: true, detail: {value: this.viewSelected}}));
        this._selectedElemsChanged();
        // Focus the site so keyboard shortcuts (Delete, arrows, Ctrl+Z) work.
        if (!this.viewSelected && feezal.site) {
            feezal.site.focus();
        }
    }

    // ── Context menu ──────────────────────────────────────────────────────────

    _showCtxMenu(x, y, onElem) {
        this._ctxMenu = {visible: true, x, y, onElem, subMenu: null};
        // Remove any previously registered close handler before attaching a new one
        if (this._ctxMenuCloseHandler) {
            document.removeEventListener('mousedown', this._ctxMenuCloseHandler, true);
            document.removeEventListener('keydown', this._ctxMenuCloseHandler, true);
        }
        const close = (e) => {
            if (e.type === 'keydown' && e.key !== 'Escape') return;
            // Don't close when the mousedown is inside the menu – let the click event
            // fire first so item click handlers (_ctxAction) can run.
            if (e.type === 'mousedown' && e.composedPath().some(el => el.classList?.contains('ctx-menu'))) return;
            this._closeCtxMenu();
        };
        this._ctxMenuCloseHandler = close;
        document.addEventListener('mousedown', close, true);
        document.addEventListener('keydown', close, true);
    }

    _closeCtxMenu() {
        this._ctxMenu = {...this._ctxMenu, visible: false};
        if (this._ctxMenuCloseHandler) {
            document.removeEventListener('mousedown', this._ctxMenuCloseHandler, true);
            document.removeEventListener('keydown', this._ctxMenuCloseHandler, true);
            this._ctxMenuCloseHandler = null;
        }
    }

    _otherViews() {
        return [...(feezal.site?.querySelectorAll('feezal-view') ?? [])]
            .map(v => v.getAttribute('name'))
            .filter(n => n && n !== this.view);
    }

    _openCtxSub(type) {
        if (this._ctxSubTimer) { clearTimeout(this._ctxSubTimer); this._ctxSubTimer = null; }
        this._ctxMenu = {...this._ctxMenu, subMenu: type};
    }

    _scheduleCtxSub(type) {
        this._ctxSubTimer = setTimeout(() => {
            this._ctxMenu = {...this._ctxMenu, subMenu: type};
            this._ctxSubTimer = null;
        }, 120);
    }

    _clearCtxSub() {
        if (this._ctxSubTimer) { clearTimeout(this._ctxSubTimer); this._ctxSubTimer = null; }
    }

    _ctxAction(action) {
        this._closeCtxMenu();
        switch (action) {
            case 'cut':
                feezal.app._clipboardTpl.innerHTML = '';
                this.selectedElems.forEach(el => feezal.app._clipboardTpl.content.append(feezal.app._clone(el)));
                feezal.app._clean(feezal.app._clipboardTpl.content);
                this._deleteElems();
                break;
            case 'copy':
                feezal.app._clipboardTpl.innerHTML = '';
                this.selectedElems.forEach(el => feezal.app._clipboardTpl.content.append(feezal.app._clone(el)));
                feezal.app._clean(feezal.app._clipboardTpl.content);
                break;
            case 'paste':
                feezal.app._pasteInternal();
                break;
            case 'duplicate':
                this._duplicateElems();
                break;
            case 'delete':
                this._deleteElems();
                break;
            case 'selectAll':
                this.selectElement(feezal.view.querySelectorAll('.feezal-editable'));
                break;
            case 'lock':
                this.selectedElems
                    .filter(el => el.tagName !== 'FEEZAL-VIEW')
                    .forEach(el => {
                        const willLock = !el.hasAttribute('locked');
                        if (willLock) {
                            el.setAttribute('locked', '');
                        } else {
                            el.removeAttribute('locked');
                        }
                        this.setLocked(el, willLock);
                    });
                feezal.app.change();
                this.selectedElems = [...this.selectedElems];
                break;
        }
    }

    _duplicateElems() {
        const offset = this.gridSize || 20;
        const newSel = [];
        this.selectedElems
            .filter(el => el.tagName !== 'FEEZAL-VIEW')
            .forEach(el => {
                const clone = feezal.app._clone(el);
                clone.style.left = (parseFloat(el.style.left || 0) + offset) + 'px';
                clone.style.top  = (parseFloat(el.style.top  || 0) + offset) + 'px';
                feezal.view.append(clone);
                this.initElem(clone);
                newSel.push(clone);
            });
        if (newSel.length) {
            this.selectElement(newSel);
            feezal.app.change();
        }
    }

    _ctxCopyToView(targetViewName, removeOriginal) {
        this._closeCtxMenu();
        const targetView = feezal.getView(targetViewName);
        if (!targetView) return;
        this.selectedElems
            .filter(el => el.tagName !== 'FEEZAL-VIEW')
            .forEach(el => {
                const clone = feezal.app._clone(el);
                targetView.append(clone);
            });
        if (removeOriginal) {
            this._deleteElems();
        } else {
            feezal.app.change();
        }
    }
}

window.customElements.define('feezal-sidebar-inspector', FeezalSidebarInspector);

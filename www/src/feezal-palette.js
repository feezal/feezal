import interact from 'interactjs';
import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/input/input.js';

class FeezalPalette extends LitElement {
    static properties = {
        categories: {type: Array},
        filter: {type: String},
        _collapsed: {state: true},
        _componentCtx: {state: true}   // U32: {x, y, name} context menu on a component entry
    };

    static styles = css`
        :host {
            display: inline-flex;
            flex-direction: column;
            height: 100%;
            background-color: var(--feezal-bg, white);
            flex: 0 0 175px;
            box-sizing: border-box;
            border-right: 2px solid var(--feezal-border, #e4e4e7);
        }
        #palette-menu {
            background: var(--feezal-bg-sub, #f5f5f5);
            border-bottom: 2px solid var(--feezal-border, #d4d4d8);
            height: 41px;
            padding: 0 6px;
            display: flex;
            align-items: center;
            box-sizing: border-box;
        }
        #palette-menu sl-input { flex: 1; min-width: 0; overflow: hidden; width: 161px;}
        #palette-list {
            overflow-y: auto;
            flex: 1;
        }
        .category { width: 100%; display: block; box-sizing: border-box; }
        .header {
            font-size: 15px;
            font-weight: 500;
            padding: 12px 4px 4px;
            height: 36px;
            box-sizing: border-box;
            color: var(--feezal-color, inherit);
            display: flex;
            align-items: center;
            gap: 4px;
            cursor: pointer;
            user-select: none;
        }
        .header:hover { background: var(--feezal-btn-hover, rgba(0,0,0,0.05)); }
        .header .chevron { margin-left: auto; font-size: 18px; opacity: 0.55; }
        .material-icons {
            font-family: 'Material Icons';
            font-weight: normal; font-style: normal;
            font-size: inherit; line-height: 1; letter-spacing: normal; text-transform: none;
            display: inline-block; white-space: nowrap; word-wrap: normal; direction: ltr;
            -webkit-font-feature-settings: 'liga'; font-feature-settings: 'liga';
            -webkit-font-smoothing: antialiased;
        }
        .element {
            box-sizing: border-box;
            padding: 4px;
            height: 32px;
            width: calc(100% - 8px);
            margin: 4px;
            border: 1px solid var(--sl-color-primary-300);
            background-color: var(--feezal-bg-sub, #f5f5f5);
            border-radius: 4px;
            font-size: 15px;
            cursor: grab;
            user-select: none;
        }
        sl-input::part(base) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); }
        sl-input::part(base):focus-within { border-color: var(--feezal-border, #ccc); box-shadow: none; }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        /* U32: context menu on component entries */
        .component-ctx {
            position: fixed; z-index: 1000; min-width: 150px;
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #333);
            border: 1px solid var(--feezal-border, #ccc); border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2); padding: 4px 0; font-size: 13px;
        }
        .component-ctx .item { padding: 5px 12px; cursor: pointer; }
        .component-ctx .item:hover { background: var(--sl-color-primary-600, #0284c7); color: #fff; }
        .component-ctx .item.danger:hover { background: #c62828; }
    `;

    constructor() {
        super();
        this.categories = [];
        this.filter = '';
        this._collapsed = new Set();
        // First run (no saved state) → default all categories collapsed except
        // "Basic" once the categories are known (_rebuildCategories). A stored
        // value (even empty "[]") means the user has a saved preference.
        this._needsDefaultCollapse = localStorage.getItem('feezal-palette-collapsed') === null;
        try {
            this._collapsed = new Set(JSON.parse(localStorage.getItem('feezal-palette-collapsed') || '[]'));
        } catch { /* corrupt value — start expanded */ }
    }

    _toggleCategory(name) {
        const next = new Set(this._collapsed);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        this._collapsed = next;
        try {
            localStorage.setItem('feezal-palette-collapsed', JSON.stringify([...next]));
        } catch { /* quota — non-fatal */ }
    }

    render() {
        return html`
            <div id="palette-menu">
                <sl-input size="small" placeholder="filter" clearable
                    autocomplete="off"
                    .value="${this.filter}"
                    @sl-input="${e => { this.filter = e.target.value; this._rebuildCategories(); }}"
                    @sl-clear="${() => { this.filter = ''; this._rebuildCategories(); }}">
                </sl-input>
            </div>
            <div id="palette-list">
                ${this.categories.map(cat => {
                    // A filter force-expands every category so matches are always visible.
                    const collapsed = !this.filter && this._collapsed.has(cat.name);
                    return html`
                    <div class="category">
                        <div class="header" @click="${() => this._toggleCategory(cat.name)}">
                            ${cat.name}
                            ${this.filter ? '' : html`<span class="material-icons chevron">${collapsed ? 'chevron_right' : 'expand_more'}</span>`}
                        </div>
                        ${collapsed ? '' : cat.elements.map(el => html`
                            <div class="element"
                                style="${el.color ? `background-color:${el.color}` : ''}"
                                data-el="${el.el}"
                                data-component="${el.component || ''}"
                                @contextmenu="${el.component ? e => this._componentCtxMenu(e, el.component) : null}">${el.name}</div>
                        `)}
                    </div>
                `;})}
            </div>
            ${this._componentCtx ? html`
                <div class="component-ctx" style="left:${this._componentCtx.x}px;top:${this._componentCtx.y}px"
                    @mousedown="${e => e.stopPropagation()}">
                    <div class="item" @click="${() => this._componentCtxAction('edit')}">Edit component</div>
                    <div class="item" @click="${() => this._componentCtxAction('rename')}">Rename…</div>
                    <div class="item danger" @click="${() => this._componentCtxAction('delete')}">Delete…</div>
                </div>
            ` : ''}
        `;
    }

    // U32: right-click menu on a Components palette entry — component
    // lifecycle must work even when no instance exists on any view.
    _componentCtxMenu(e, name) {
        e.preventDefault();
        e.stopPropagation();
        this._componentCtx = {x: e.clientX, y: e.clientY, name};
        const close = ev => {
            if (ev.type === 'keydown' && ev.key !== 'Escape') return;
            // Don't close on mousedown inside the menu — this capture-phase
            // listener fires before the item's click event; closing here would
            // remove the item from the DOM before its @click can run.
            if (ev.type === 'mousedown' && ev.composedPath().some(el => el.classList?.contains('component-ctx'))) return;
            this._componentCtx = null;
            document.removeEventListener('mousedown', close, true);
            document.removeEventListener('keydown', close, true);
        };
        setTimeout(() => {
            document.addEventListener('mousedown', close, true);
            document.addEventListener('keydown', close, true);
        }, 0);
    }

    _componentCtxAction(action) {
        const name = this._componentCtx?.name;
        this._componentCtx = null;
        if (!name) return;
        if (action === 'edit') feezal.app._openComponentEdit(name);
        else if (action === 'rename') feezal.app._componentRenameOpen(name);
        else if (action === 'delete') feezal.app._componentDeleteRequest(name);
    }

    connectedCallback() {
        super.connectedCallback();
        // WebComponentsReady was a polyfill event — modern browsers never fire it.
        // Run after first render instead.
        this.updateComplete.then(() => {
            this._rebuildCategories();
            this._initInteract();
        });
    }

    /** Public: rebuild the category list (called after site load / component changes). */
    refresh() {
        this._rebuildCategories();
    }

    _rebuildCategories() {
        const categories = {};

        // U32: the site's own components come first — one palette entry per
        // <template feezal-component> definition; dropping creates an instance.
        const componentTemplates = feezal.site
            ? [...feezal.site.querySelectorAll('template[feezal-component]')]
            : [];
        componentTemplates.forEach(template => {
            const name = template.getAttribute('feezal-component');
            if (!name) return;
            if (!this.filter || name.toLowerCase().includes(this.filter.toLowerCase())) {
                (categories.Components = categories.Components || [])
                    .push({el: 'feezal-component', name, component: name});
            }
        });

        // feezal.elements contains custom-element tag names — multi-element
        // family packages (N29 Phase B) contribute every tag their manifest
        // declares. The scope-strip stays as belt-and-braces for a stale
        // cached feezal-elements.js that still holds package names.
        (feezal.elements || []).forEach(pkgName => {
            const tagName = pkgName.replace(/^@[^/]+\//, '');
            const cls = window.customElements.get(tagName);
            if (!cls) {
                return;
            }

            const config = (cls.paletteOptions || cls.feezal || {}).palette || {name: tagName, category: 'Other'};
            if (!this.filter || config.name.toLowerCase().includes(this.filter.toLowerCase())) {
                if (!categories[config.category]) {
                    categories[config.category] = [];
                }

                categories[config.category].push({el: tagName, ...config});
            }
        });
        this.categories = Object.entries(categories)
            .map(([name, elements]) => ({name, elements}))
            .sort((a, b) => {
                const ORDER = ['Components', 'Basic', 'Layout', 'System', 'Material', 'Glass', 'Metro', 'Simple', 'Carbon', 'Paper', 'Panel', 'TUI'];
                const ai = ORDER.indexOf(a.name);
                const bi = ORDER.indexOf(b.name);
                if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
                if (ai === -1) return 1;
                if (bi === -1) return -1;
                return ai - bi;
            });

        // First-run default: everything collapsed except "Basic". Persist so
        // it happens once, and subsequent user toggles behave normally.
        if (this._needsDefaultCollapse && this.categories.length) {
            this._needsDefaultCollapse = false;
            this._collapsed = new Set(this.categories.map(c => c.name).filter(n => n !== 'Basic'));
            try {
                localStorage.setItem('feezal-palette-collapsed', JSON.stringify([...this._collapsed]));
            } catch { /* quota — non-fatal */ }
        }
    }

    /**
     * B20: position the dragged new element at its (possibly snapped) location.
     * `_dragPos` holds the raw, unsnapped position in view-local px so snapping
     * never accumulates into the drag delta; the inspector's `_snap()` works in
     * client coordinates of the element's top-left and returns a target + range
     * (same contract interact.js uses for the regular element drag).
     *
     * The displayed position is additionally clamped to the view bounds —
     * mirroring the interact `restrict` modifier a regular element drag has
     * (initAbsolute in feezal-sidebar-inspector.js, incl. the 1px bottom
     * reserve against a spurious scrollbar). Only the DISPLAYED position is
     * clamped: `_dragPos` stays raw so dragging far left back over the
     * palette still cancels the creation in onend (x + width < 0).
     */
    _applySnappedPos() {
        if (!this.newElem || !this._dragPos) {
            return;
        }

        const viewRect = feezal.view.getBoundingClientRect();
        const clientX = this._dragPos.x + viewRect.x;
        const clientY = this._dragPos.y + viewRect.y;
        let {x, y} = this._dragPos;

        const snap = feezal.editor._snap(clientX, clientY);
        if (snap) {
            if (snap.x !== undefined && Math.abs(snap.x - clientX) <= snap.range) {
                x = snap.x - viewRect.x;
            }

            if (snap.y !== undefined && Math.abs(snap.y - clientY) <= snap.range) {
                y = snap.y - viewRect.y;
            }
        }

        const elRect = this.newElem.getBoundingClientRect();
        x = Math.max(0, Math.min(x, viewRect.width - elRect.width));
        y = Math.max(0, Math.min(y, viewRect.height - elRect.height - 1));

        this.newElem.style.left = Math.round(x) + 'px';
        this.newElem.style.top = Math.round(y) + 'px';
    }

    _initInteract() {
        interact('.element', {context: this.renderRoot})
            .draggable({
                restrict: {
                    restriction: feezal.container,
                    elementRect: {top: 0, left: 0, bottom: 1, right: 1},
                    endOnly: true
                },
                onstart: event => {
                    const viewRect = feezal.view.getBoundingClientRect();
                    this.newElem = document.createElement(event.target.dataset.el);
                    // U32: component entries create an instance of the named
                    // component — declared param defaults apply automatically.
                    if (event.target.dataset.component) {
                        this.newElem.setAttribute('name', event.target.dataset.component);
                    }
                    feezal.view.append(this.newElem);
                    const newElementRect = this.newElem.getBoundingClientRect();
                    feezal.editor.initElem(this.newElem, true);
                    this.newElem.style.outlineWidth = '2px';
                    // B20: track the unsnapped position (view-local px) and let the
                    // inspector's snap machinery treat the new element like a normal
                    // element drag — the initial drop snaps exactly like a re-drag,
                    // including grid/element snapping and the guide lines.
                    this._dragPos = {
                        x: event.clientX - viewRect.x - (newElementRect.width / 2),
                        y: event.clientY - viewRect.y - (newElementRect.height / 2)
                    };
                    feezal.editor.dragElement = this.newElem;
                    this._applySnappedPos();
                },
                onmove: event => {
                    this._dragPos.x += event.dx;
                    this._dragPos.y += event.dy;
                    this._applySnappedPos();
                },
                onend: () => {
                    feezal.editor.dragElement = null;
                    // B32(palette): the final _applySnappedPos() below calls the
                    // inspector's _snap(), which REDRAWS the guide lines — so
                    // hiding must happen AFTER it, on every exit path.
                    const hideSnapLines = () => {
                        for (const id of ['#vsnap1', '#vsnap2', '#hsnap1', '#hsnap2']) {
                            const line = feezal.container.querySelector(id);
                            if (line) line.style.display = 'none';
                        }
                    };

                    if (!this.newElem) {
                        hideSnapLines();
                        return;
                    }

                    // Cancel gesture: dragging far left back over the palette
                    // removes the element. Checked against the RAW drag
                    // position — the displayed position is clamped to the view
                    // bounds by _applySnappedPos() and can never go negative.
                    if (this._dragPos.x + this.newElem.getBoundingClientRect().width < 0) {
                        this.newElem.remove();
                        delete this.newElem;
                        hideSnapLines();
                        return;
                    }

                    this._applySnappedPos();
                    hideSnapLines();
                    feezal.editor.selectElement(this.newElem);
                    this.newElem.style.outlineWidth = null;
                    feezal.app.change();
                }
            });
    }
}

window.customElements.define('feezal-palette', FeezalPalette);

/* global feezal */
import {LitElement, html, css} from 'lit';
import {repeat} from 'lit/directives/repeat.js';
import {fuzzyScoreAny} from './feezal-fuzzy.js';

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
 * Per element row: palette icon, label (label → name → tag), a topic hint, a
 * lock toggle, and drag-to-restack. Click selects — switching views first when
 * the element lives elsewhere — and Ctrl/Shift extend exactly like the canvas.
 *
 * The filter is a fuzzy search over element name, label and topics (see
 * feezal-fuzzy.js): typing "temp" surfaces every temperature card across ALL
 * views, with non-matching views auto-expanded away rather than hiding hits.
 *
 * Deliberately not a full tree of nested children: elements inside components
 * belong to the component's own edit mode, and U3's grouping is what will
 * introduce real nesting here.
 */
class FeezalSidebarLayers extends LitElement {
    static properties = {
        /** current view name — drives which node starts expanded */
        view: {type: String},
        _filter: {state: true},
        _toggled: {state: true},     // view names whose expand state the user flipped
        _dragEl: {state: true},
        _dropEl: {state: true},
        _revision: {state: true},
    };

    static styles = css`
        :host {
            display: flex; flex-direction: column; height: 100%;
            font-size: 12.5px; background: var(--feezal-bg, #fff); box-sizing: border-box;
        }
        .search { padding: 8px; border-bottom: 1px solid var(--feezal-border, #e0e0e0); }
        .search input {
            width: 100%; box-sizing: border-box; font: inherit; font-size: 12.5px;
            padding: 5px 8px; border-radius: 4px;
            border: 1px solid var(--feezal-border, #ccc);
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #222);
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
        feezal-icon, .icon {
            flex: 0 0 auto; width: 16px; font-size: 16px; line-height: 1; text-align: center;
            color: var(--sl-color-primary-600, #0284c7);
        }
        .label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
    `;

    constructor() {
        super();
        this.view = '';
        this._filter = '';
        this._toggled = new Set();
        this._dragEl = null;
        this._dropEl = null;
        this._revision = 0;
        // Elements and views are added/removed/restacked by the canvas, the
        // palette, the clipboard and the generate wizard — observing the site
        // is far more robust than asking each of those to notify us.
        this._observer = typeof MutationObserver === 'undefined' ? null
            : new MutationObserver(() => { this._revision++; });
    }

    connectedCallback() {
        super.connectedCallback();
        this._observe();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._observer?.disconnect();
    }

    updated() {
        if (this._observed !== feezal?.site) this._observe();
    }

    _observe() {
        this._observer?.disconnect();
        this._observed = feezal?.site || null;
        if (this._observed) {
            this._observer?.observe(this._observed, {
                childList: true, subtree: true,
                attributes: true,
                // `class` carries the canvas selection (feezal-selected), so the
                // panel mirrors selection changes without any plumbing — and
                // cannot drift from what the canvas actually shows.
                attributeFilter: ['class', 'locked', 'label', 'name', 'subscribe', 'publish'],
            });
        }
    }

    // ── model ───────────────────────────────────────────────────────────────

    get _views() {
        return [...(feezal?.site?.querySelectorAll?.('feezal-view') || [])];
    }

    _elementsOf(view) {
        return [...view.children]
            .filter(el => el.classList?.contains('feezal-editable'))
            .reverse();                       // top-most first (paint order)
    }

    _label(el) {
        return el.getAttribute?.('label') || el.getAttribute?.('name') ||
            el.getAttribute?.('text') ||
            (el.localName === 'feezal-component' ? 'component' : '') ||
            (el.localName || '').replace('feezal-element-', '');
    }

    _topic(el) {
        return el.getAttribute?.('subscribe') || el.getAttribute?.('publish') ||
            el.getAttribute?.('subscribe-state') || '';
    }

    _icon(el) {
        return window.customElements.get(el.localName)?.feezal?.palette?.icon || '';
    }

    /** Fuzzy-match an element on tag, label and topic. */
    _score(el) {
        return fuzzyScoreAny(this._filter.trim(), [
            (el.localName || '').replace('feezal-element-', ''),
            this._label(el),
            el.getAttribute?.('subscribe') || '',
            el.getAttribute?.('publish') || '',
        ]);
    }

    /** The tree to render: [{view, name, elements, open, matched}] */
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
            return {
                view, name, elements,
                // While filtering, every view with a hit is open (hiding hits
                // behind a collapsed node would defeat the search); otherwise
                // only the current view is, unless the user says otherwise.
                open: filtering ? elements.length > 0 : this._isOpen(name),
            };
        }).filter(node => !filtering || node.elements.length);
    }

    /**
     * Default: only the current view is expanded (a 20-view site stays
     * readable). `_toggled` holds the views the user flipped by hand, so one
     * rule covers both directions — collapse the current view, expand another
     * — and switching views re-applies the default to untouched nodes.
     */
    _isOpen(name) {
        const isCurrent = name === (this.view || feezal?.site?.view);
        return this._toggled.has(name) ? !isCurrent : isCurrent;
    }

    _toggleView(name) {
        const next = new Set(this._toggled);
        if (next.has(name)) next.delete(name); else next.add(name);
        this._toggled = next;
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

        if (next.length) inspector.selectElement(next); else inspector.selectElement();
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

    // ── drag to restack (within one view) ───────────────────────────────────

    _onDragStart(event, el) {
        this._dragEl = el;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', this._label(el));
    }

    _onDragOver(event, el) {
        if (!this._dragEl || el.parentElement !== this._dragEl.parentElement) return;
        event.preventDefault();
        this._dropEl = el;
    }

    _onDrop(event, target) {
        event.preventDefault();
        const moved = this._dragEl;
        this._dragEl = null;
        this._dropEl = null;
        if (!moved || moved === target) return;
        const view = moved.parentElement;
        if (!view || target.parentElement !== view) return;   // never across views

        // The list is top-most first, the DOM is bottom-most first: dropping
        // onto a row lower in the LIST means "go behind it" in the DOM.
        const list = this._elementsOf(view);
        if (list.indexOf(moved) < list.indexOf(target)) view.insertBefore(moved, target);
        else view.insertBefore(moved, target.nextSibling);

        feezal.app?.change();
        this.requestUpdate();
    }

    _onDragEnd() {
        this._dragEl = null;
        this._dropEl = null;
    }

    // ── render ──────────────────────────────────────────────────────────────

    _renderElement(el, node) {
        const selected = el.classList.contains('feezal-selected');
        const locked = el.hasAttribute('locked');
        const icon = this._icon(el);
        const topic = this._topic(el);
        const dropping = this._dropEl === el && this._dragEl && this._dragEl !== el;
        const before = dropping &&
            node.elements.indexOf(this._dragEl) > node.elements.indexOf(el);
        return html`
            <li class="${selected ? 'selected' : ''} ${locked ? 'locked' : ''}
                       ${this._dragEl === el ? 'dragging' : ''}
                       ${dropping ? (before ? 'drop-before' : 'drop-after') : ''}"
                draggable="true"
                @click="${e => this._onRowClick(e, el, node)}"
                @dragstart="${e => this._onDragStart(e, el)}"
                @dragover="${e => this._onDragOver(e, el)}"
                @drop="${e => this._onDrop(e, el)}"
                @dragend="${this._onDragEnd}">
                <span class="grip" title="Drag to restack">⠿</span>
                ${icon ? html`<feezal-icon name="${icon}"></feezal-icon>`
                       : html`<span class="icon">▢</span>`}
                <span class="label" title="${el.localName}">${this._label(el)}</span>
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
            <div class="search">
                <input type="search" placeholder="Filter elements — name, label or topic"
                    .value="${this._filter}"
                    @input="${e => { this._filter = e.target.value; }}"
                    @keydown="${e => { if (e.key === 'Escape') { this._filter = ''; e.stopPropagation(); } }}">
            </div>
            <div class="tree">
                ${tree.length ? repeat(tree, n => n.name, node => html`
                    <div class="view-row ${node.name === currentView ? 'current' : ''}"
                        @click="${() => this._toggleView(node.name)}">
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
            ${filtering ? '' : html`<div class="hint">Top-most first. Drag to restack, click to select.</div>`}
        `;
    }
}

window.customElements.define('feezal-sidebar-layers', FeezalSidebarLayers);
export {FeezalSidebarLayers};

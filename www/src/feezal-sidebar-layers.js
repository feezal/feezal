/* global feezal */
import {LitElement, html, css} from 'lit';
import {repeat} from 'lit/directives/repeat.js';

/**
 * U87 — element outline / layers panel.
 *
 * A dense view is hard to work with on the canvas alone: overlapping cards are
 * hard to hit, a card hidden behind another is invisible, and stacking order
 * (which IS DOM order — see U33) has no visual representation anywhere. This
 * panel lists the current view's elements in paint order, top-most first, and
 * mirrors the canvas selection both ways.
 *
 * Per row: the element's palette icon, its label (label attribute → name →
 * tag), a topic hint (subscribe/publish), a lock toggle, and drag-to-restack.
 * Click selects (and scrolls the element into view on the canvas); Ctrl/Cmd
 * and Shift extend the selection exactly like the canvas does.
 *
 * Deliberately NOT a general tree: only the current view's direct children are
 * listed. Nested elements live inside components (their own edit mode) and
 * layout containers; U3's grouping will introduce real nesting, and this
 * panel is where that will surface.
 */
class FeezalSidebarLayers extends LitElement {
    static properties = {
        selectedElems: {type: Array},
        _dragIndex: {state: true},
        _dropIndex: {state: true},
        /** bumped by the MutationObserver — the panel lists LIVE DOM nodes,
         *  which Lit cannot observe on its own. */
        _revision: {state: true},
    };

    static styles = css`
        :host { display: block; font-size: 12.5px; }
        .empty { padding: 18px 10px; opacity: 0.6; text-align: center; line-height: 1.5; }
        .hint { padding: 6px 10px; opacity: 0.65; font-size: 11px; line-height: 1.4; }
        ul { list-style: none; margin: 0; padding: 0; }
        li {
            display: flex; align-items: center; gap: 7px;
            padding: 5px 9px; cursor: pointer;
            border-left: 3px solid transparent;
            user-select: none;
        }
        li:hover { background: var(--feezal-btn-hover, rgba(127, 127, 127, 0.12)); }
        li.selected {
            background: var(--feezal-sel-bg, rgba(2, 132, 199, 0.16));
            border-left-color: var(--sl-color-primary-600, #0284c7);
        }
        li.locked .label { opacity: 0.55; font-style: italic; }
        li.drop-before { box-shadow: inset 0 2px 0 var(--sl-color-primary-600, #0284c7); }
        li.drop-after  { box-shadow: inset 0 -2px 0 var(--sl-color-primary-600, #0284c7); }
        li.dragging { opacity: 0.4; }
        .grip {
            cursor: grab; opacity: 0.4; flex: 0 0 auto; font-size: 14px; line-height: 1;
        }
        .grip:active { cursor: grabbing; }
        feezal-icon, .icon {
            flex: 0 0 auto; width: 16px; font-size: 16px; line-height: 1; text-align: center;
            color: var(--sl-color-primary-600, #0284c7);
        }
        .label {
            flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .topic {
            flex: 0 1 auto; max-width: 42%; opacity: 0.55; font-size: 11px;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl;
        }
        .lock {
            flex: 0 0 auto; border: 0; background: none; cursor: pointer; padding: 2px;
            color: inherit; opacity: 0.35; font-size: 13px; line-height: 1;
        }
        .lock:hover { opacity: 0.9; }
        .lock.on { opacity: 0.9; }
    `;

    constructor() {
        super();
        this.selectedElems = [];
        this._dragIndex = null;
        this._dropIndex = null;
        this._revision = 0;
        // Elements are added/removed/restacked by the canvas, the palette, the
        // clipboard and the generate wizard — watching the view is far more
        // robust than asking every one of those to notify us.
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
        // The active view changes under us (tab switch) — re-target.
        if (this._observed !== feezal?.view) this._observe();
    }

    _observe() {
        this._observer?.disconnect();
        this._observed = feezal?.view || null;
        if (this._observed) {
            this._observer?.observe(this._observed, {childList: true, attributes: true,
                attributeFilter: ['locked', 'label', 'name', 'subscribe', 'publish']});
        }
    }

    /** The current view's canvas elements, TOP-MOST FIRST (paint order reversed). */
    get _rows() {
        const view = feezal?.view;
        if (!view) return [];
        return [...view.children]
            .filter(el => el.classList?.contains('feezal-editable'))
            .reverse();
    }

    _label(el) {
        const attr = el.getAttribute?.('label') || el.getAttribute?.('name') || el.getAttribute?.('text');
        if (attr) return attr;
        if (el.localName === 'feezal-component') return el.getAttribute('name') || 'component';
        return (el.localName || '').replace('feezal-element-', '');
    }

    /** The wiring hint — whichever topic the element actually carries. */
    _topic(el) {
        return el.getAttribute?.('subscribe') || el.getAttribute?.('publish') ||
            el.getAttribute?.('subscribe-state') || '';
    }

    _icon(el) {
        const cls = window.customElements.get(el.localName);
        return cls?.feezal?.palette?.icon || '';
    }

    // ── selection (mirrors the canvas gestures) ─────────────────────────────

    _onRowClick(event, el) {
        const inspector = this.closest('feezal-sidebar-inspector') ||
            feezal.app?.shadowRoot?.querySelector('feezal-sidebar-inspector');
        if (!inspector) return;
        const rows = this._rows;
        const current = this.selectedElems.filter(e => e.tagName !== 'FEEZAL-VIEW');

        let next;
        if (event.shiftKey && current.length) {
            // range from the last selected row to this one, in list order
            const from = rows.indexOf(current[current.length - 1]);
            const to = rows.indexOf(el);
            const [lo, hi] = from < to ? [from, to] : [to, from];
            next = rows.slice(lo, hi + 1);
        } else if (event.ctrlKey || event.metaKey) {
            next = current.includes(el) ? current.filter(e => e !== el) : [...current, el];
        } else {
            next = [el];
        }

        if (!next.length) inspector.selectElement();
        else inspector.selectElement(next);
        // bring it into view on the canvas — the whole point for a dense view
        el.scrollIntoView?.({block: 'nearest', inline: 'nearest'});
    }

    _toggleLock(event, el) {
        event.stopPropagation();
        const inspector = this.closest('feezal-sidebar-inspector') ||
            feezal.app?.shadowRoot?.querySelector('feezal-sidebar-inspector');
        if (el.hasAttribute('locked')) el.removeAttribute('locked');
        else el.setAttribute('locked', '');
        inspector?.setLocked?.(el, el.hasAttribute('locked'));
        feezal.app?.change();
        this.requestUpdate();
    }

    // ── drag to restack (list order is reversed paint order) ────────────────

    _onDragStart(event, index) {
        this._dragIndex = index;
        event.dataTransfer.effectAllowed = 'move';
        // Firefox needs data set for a drag to start at all.
        event.dataTransfer.setData('text/plain', String(index));
    }

    _onDragOver(event, index) {
        if (this._dragIndex === null) return;
        event.preventDefault();
        this._dropIndex = index;
    }

    _onDrop(event, index) {
        event.preventDefault();
        const from = this._dragIndex;
        this._dragIndex = null;
        this._dropIndex = null;
        if (from === null || from === index) return;

        const rows = this._rows;
        const moved = rows[from];
        const target = rows[index];
        if (!moved || !target || !feezal.view) return;

        // List is top-most first; the DOM is bottom-most first. Dropping ONTO a
        // row means "take that row's place", so insert before the target in
        // list terms = after it in DOM terms.
        if (from > index) feezal.view.insertBefore(moved, target.nextSibling);
        else feezal.view.insertBefore(moved, target);

        feezal.app?.change();
        this.requestUpdate();
    }

    _onDragEnd() {
        this._dragIndex = null;
        this._dropIndex = null;
    }

    render() {
        const rows = this._rows;
        if (!rows.length) {
            return html`<div class="empty">This view has no elements yet.<br>
                Drag one in from the palette.</div>`;
        }
        const selected = new Set(this.selectedElems || []);
        return html`
            <div class="hint">Top-most first. Drag to restack, click to select.</div>
            <ul>
                ${repeat(rows, el => el, (el, i) => {
                    const icon = this._icon(el);
                    const topic = this._topic(el);
                    const locked = el.hasAttribute('locked');
                    return html`
                        <li class="${selected.has(el) ? 'selected' : ''} ${locked ? 'locked' : ''}
                                   ${this._dragIndex === i ? 'dragging' : ''}
                                   ${this._dropIndex === i && this._dragIndex !== null
                                        ? (this._dragIndex > i ? 'drop-before' : 'drop-after') : ''}"
                            draggable="true"
                            @click="${e => this._onRowClick(e, el)}"
                            @dragstart="${e => this._onDragStart(e, i)}"
                            @dragover="${e => this._onDragOver(e, i)}"
                            @drop="${e => this._onDrop(e, i)}"
                            @dragend="${this._onDragEnd}">
                            <span class="grip" title="Drag to restack">⠿</span>
                            ${icon
                                ? html`<feezal-icon name="${icon}"></feezal-icon>`
                                : html`<span class="icon">▢</span>`}
                            <span class="label" title="${el.localName}">${this._label(el)}</span>
                            ${topic ? html`<span class="topic" title="${topic}">${topic}</span>` : ''}
                            <button class="lock ${locked ? 'on' : ''}"
                                title="${locked ? 'Unlock' : 'Lock'}"
                                @click="${e => this._toggleLock(e, el)}">${locked ? '🔒' : '🔓'}</button>
                        </li>`;
                })}
            </ul>
        `;
    }
}

window.customElements.define('feezal-sidebar-layers', FeezalSidebarLayers);
export {FeezalSidebarLayers};

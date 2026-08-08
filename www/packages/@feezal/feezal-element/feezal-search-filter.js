/* global feezal */
/**
 * @feezal/feezal-element/feezal-search-filter.js (E170)
 *
 * Shared engine of the `*-search` element family: live-filter the sibling
 * elements of a view by matching their `label` and `href` attributes.
 *
 * Contract (decided 08/2026):
 * - Filtering toggles the dedicated `feezal-search-hidden` attribute — never
 *   inline `display`, which conditions (E50) and the editor own. The one
 *   document-level rule below hides via display:none, which IS the decided
 *   semantics for both view kinds: absolutely-positioned siblings do not
 *   move (hide-in-place), flow/grid tiles close up (natural reflow).
 * - Hidden elements stay CONNECTED — subscriptions stay warm (a filter is
 *   not a teardown; same principle as N40).
 * - An element with neither `label` nor `href` always stays visible — a
 *   search bar must not blank decorative/layout elements.
 * - Viewer-only: the editor canvas never filters (editing a half-hidden
 *   view is chaos); the elements guard on `feezal.isEditor`.
 */
import {FeezalElement, feezalBoolean, html} from './feezal-element.js';

export const SEARCH_HIDDEN_ATTR = 'feezal-search-hidden';

/** Inject the (single, idempotent) document-level hiding rule. Views are
 * light DOM in both the viewer and layout-app's embedded clones, so one
 * document rule reaches every canvas element. */
export function ensureSearchFilterStyle(doc = document) {
    if (doc.getElementById('feezal-search-filter-style')) return;
    const s = doc.createElement('style');
    s.id = 'feezal-search-filter-style';
    s.textContent = `[${SEARCH_HIDDEN_ATTR}] { display: none !important; }`;
    doc.head.append(s);
}

/**
 * Apply `query` to every canvas element of `view` (children that are
 * feezal elements / component instances). Empty query = clear. Search
 * elements themselves (and `except`) are never hidden. Returns the number
 * of elements hidden.
 */
export function applySearchFilter(view, query, {except = null} = {}) {
    if (!view) return 0;
    const q = String(query || '').trim().toLowerCase();
    let hidden = 0;
    for (const el of [...view.children]) {
        const name = el.localName || '';
        if (!name.startsWith('feezal-element-') && name !== 'feezal-component') continue;
        if (el === except || name.endsWith('-search')) continue;
        if (!q) { el.removeAttribute(SEARCH_HIDDEN_ATTR); continue; }
        const hay = `${el.getAttribute('label') || ''} ${el.getAttribute('href') || ''}`.trim().toLowerCase();
        // No label AND no href → always visible.
        if (!hay || hay.includes(q)) {
            el.removeAttribute(SEARCH_HIDDEN_ATTR);
        } else {
            el.setAttribute(SEARCH_HIDDEN_ATTR, '');
            hidden++;
        }
    }
    return hidden;
}

export function clearSearchFilter(view) {
    applySearchFilter(view, '');
}

/**
 * Shared base class of the family's search elements. Subclasses supply the
 * family chrome (styles + render wrapping `renderSearchInput()`); everything
 * else — debounce, apply/clear, Escape, the editor guard — lives here.
 */
export class FeezalSearchBase extends FeezalElement {
    /** Shared attribute descriptors — spread into the family descriptors. */
    static get searchAttributes() {
        return [
            {name: 'placeholder', type: 'string', default: 'Search…',
                help: 'Placeholder text shown in the empty search field.'},
        ];
    }

    static properties = {
        placeholder: {type: String, reflect: true},
        _q:          {state: true},
    };

    constructor() {
        super();
        this.placeholder = 'Search…';
        this._q = '';
        this._debounceMs = 200;
    }

    connectedCallback() {
        super.connectedCallback();
        ensureSearchFilterStyle();
    }

    disconnectedCallback() {
        // A removed search bar must not leave the view half-hidden. closest()
        // returns null once we are detached — use the view stashed by _apply().
        clearTimeout(this._deb);
        if (!feezal.isEditor && this._filteredView) clearSearchFilter(this._filteredView);
        this._filteredView = null;
        super.disconnectedCallback();
    }

    _onInput(value) {
        this._q = value;
        clearTimeout(this._deb);
        this._deb = setTimeout(() => this._apply(), this._debounceMs);
    }

    _apply() {
        if (feezal.isEditor) return;   // viewer-only — never filter the canvas
        const view = this.closest('feezal-view');
        this._filteredView = this._q ? view : null;
        applySearchFilter(view, this._q, {except: this});
    }

    _clear() {
        clearTimeout(this._deb);
        this._q = '';
        const input = this.renderRoot?.querySelector?.('input');
        if (input) input.value = '';
        this._apply();
        input?.focus?.();
    }

    _onKeydown(e) {
        if (e.key === 'Escape' && this._q) {
            e.stopPropagation();
            this._clear();
        }
    }

    /** The shared input markup — families style `.search`, `input` and `.sx`
     * (clear button; pass clearButton: false to omit it, as basic does). */
    renderSearchInput({clearButton = true} = {}) {
        // The filter is viewer-only BY DESIGN — but a silent no-op on the
        // editor canvas reads as broken (reported exactly so). Typing there
        // shows an inline note instead of nothing. Inline-styled on purpose:
        // one shared hint, no per-family CSS to keep in sync.
        const editorNote = feezal.isEditor && this._q ? html`
            <span class="search-editor-note"
                style="flex:0 0 auto;font-size:10px;opacity:.6;white-space:nowrap;padding:0 6px;"
                title="Filtering runs in the viewer — the editor canvas never hides elements.">filters in viewer</span>` : '';
        return html`
            <div class="search">
                <input type="search" .value="${this._q}" placeholder="${this.placeholder || ''}"
                    aria-label="${this.placeholder || 'Search'}"
                    title="${feezal.isEditor ? 'Filtering runs in the viewer — the editor canvas never hides elements.' : ''}"
                    @input="${e => this._onInput(e.target.value)}"
                    @keydown="${e => this._onKeydown(e)}">
                ${editorNote}
                ${clearButton && this._q ? html`
                    <button class="sx" title="Clear" @click="${() => this._clear()}">&times;</button>` : ''}
            </div>`;
    }
}

// Re-export for the thin family views' convenience.
export {feezalBoolean};

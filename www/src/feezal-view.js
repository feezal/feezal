// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal viewer runtime
import {LitElement, html, css} from 'lit';
import {FeezalConditions} from '@feezal/feezal-element/feezal-conditions.js';   // U95
import {getMessageProperty} from '@feezal/feezal-element';   // U95

/**
 * U90 — child-position values whose children are laid out by the CONTAINER
 * (flow = flex, grid = CSS grid), as opposed to `absolute` where each child
 * carries its own inline top/left. Everything the editor gates on "the view
 * places its own children" (align/distribute, top/left style rows, palette
 * drop-by-DOM-order, reorder-instead-of-drag) keys on this, so a new
 * container mode never has to be hunted down across the editor again.
 * `static` is U41's legacy alias for `flow`.
 */
/**
 * U95 — the condition actions a VIEW accepts.
 *
 * Deliberately no show/hide. A hidden view is not a `display:none`: it would
 * have to disappear from layout-app drawer entries, basic-navigation tabs and
 * swipe order, and refuse direct routing by falling through to the first
 * visible view. Anything less leaves navigation pointing at something that is
 * not there, so the action is not offered at all.
 */
export const VIEW_CONDITION_ACTIONS = ['class', 'style', 'attribute'];

const FLOW_LIKE = new Set(['flow', 'grid', 'static']);
export const isFlowLike = view => FLOW_LIKE.has(view?.childPosition);

// U90 — cell fallback when a grid view has no child with a declared px size to
// derive one from (an empty view, or children sized purely by CSS).
const GRID_FALLBACK_CELL = {w: 120, h: 60};

/** Positive number from an attribute value (the knobs are written unitless), else 0. */
const attrNum = value => {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Positive length from an inline style value, but ONLY when it is in px.
 * Percentages are deliberately rejected: `width: 50%` is a flow idiom (half a
 * flex row), and parsing it as "50" would both give the tile a nonsense span
 * and — since the cell is derived from the smallest child — collapse the whole
 * grid to 50px cells. In grid mode the cell count IS the sizing model, so a
 * percentage-sized child simply occupies one cell.
 */
const stylePx = value =>
    typeof value === 'string' && value.endsWith('px') ? attrNum(value) : 0;

/**
 * feezal-view
 *
 * A single page/view within a feezal-site. Contains dashboard elements.
 * Replaces the Polymer implementation.
 */
class FeezalView extends LitElement {
    static properties = {
        name: {type: String, reflect: true},
        visible: {type: Boolean},
        // U51 — per-view theme (full class name or bare suffix; empty = site theme)
        theme: {type: String, reflect: true},
        // U95 — topic that sets `theme` at runtime (see _wireTheme for how the
        // editor's prevent-MQTT setting applies).
        subscribeTheme: {type: String, attribute: 'subscribe-theme', reflect: true},
        childPosition: {type: String, attribute: 'child-position', reflect: true},
        // U95 — E50 conditions on a view. Class/style/attribute only; see
        // VIEW_CONDITION_ACTIONS below for why hiding is not among them.
        conditions: {type: String, attribute: 'conditions'},
        // U41 — flow layout knobs (only meaningful when child-position="flow").
        flowGap:       {type: String, attribute: 'flow-gap', reflect: true},
        flowDirection: {type: String, attribute: 'flow-direction', reflect: true},
        flowJustify:   {type: String, attribute: 'flow-justify', reflect: true},
        flowAlign:     {type: String, attribute: 'flow-align', reflect: true},
        // U90 — grid layout knobs (only meaningful when child-position="grid").
        // Cell width/height are OPTIONAL: left empty they are derived from the
        // smallest child, which is what makes switching a view to grid look
        // right without configuring anything.
        gridCellWidth:  {type: String, attribute: 'grid-cell-width', reflect: true},
        gridCellHeight: {type: String, attribute: 'grid-cell-height', reflect: true},
        gridGap:        {type: String, attribute: 'grid-gap', reflect: true},
        gridJustify:    {type: String, attribute: 'grid-justify', reflect: true},
        gridDense:      {type: Boolean, attribute: 'grid-dense', reflect: true}
    };

    static styles = css`
        /* A38 — the view is the CONTAINING BLOCK for its absolutely positioned
           children: every element's top/left is view-relative (that is what the
           style inspector edits and what B80 stashes/restores), which only
           holds while the view itself is positioned.
           This was never declared. DragSelect happened to set position:relative
           on its area element, so the editor worked by side effect and the
           viewer got away with it because a 100%-sized view lines up with its
           parent anyway. Dropping the library removed the containing block and
           took element offsets, canvas scroll extent and align/distribute with
           it — so it is declared here, in the view itself, where the viewer and
           the static export see it too. */
        :host([child-position="absolute"]) {
            position: relative;
        }
        :host([child-position="absolute"]) ::slotted(*) {
            position: absolute;
        }
        /* U41 — flow layout: the slot is a wrapping flex container, so the
           view's elements float left-to-right, row by row (tiles), and keep
           their own width/height (percentages work — they are flex items).
           Lives in feezal-view so the viewer and static export render
           identically to the editor. */
        :host([child-position="flow"]) slot {
            display: flex;
            flex-wrap: wrap;
            flex-direction: var(--feezal-flow-direction, row);
            gap: var(--feezal-flow-gap, 5px);
            justify-content: var(--feezal-flow-justify, flex-start);
            align-items: var(--feezal-flow-align, flex-start);
            align-content: var(--feezal-flow-align, flex-start);
            width: 100%;
            /* height (not min-height): the flex container is capped to the view's
               height so flex-wrap can start a NEW COLUMN when column-direction
               content reaches the bottom (or a new row for row-direction). The
               view fills the canvas via its own width/height, so an empty flow
               view still fills. */
            height: 100%;
            box-sizing: border-box;
        }
        /* Flow items stay in flex flow but must be POSITIONED (relative) — the
           editor injects a click-catching :host(.feezal-editable)::after overlay
           with position:absolute;inset:0, which only stays contained to the tile
           when the tile itself is a positioned ancestor. A static tile lets that
           overlay escape and cover the whole canvas (cursor:move everywhere,
           dead view tabs, off-by-coordinates selection). No !important — the
           drag lift sets position:fixed inline, and the editor strips legacy
           top/left from flow tiles so relative doesn't offset them. */
        :host([child-position="flow"]) ::slotted(*) { position: relative; }
        /* U90 — grid layout: a real CSS grid of fixed cells. Unlike flex (whose
           lines are independent, so nothing can ever sit BESIDE the lower half
           of a double-height tile), a grid places a 2x2 tile across two rows
           and the following tiles flow into the space left next to it.
           Dense packing is opt-in because it lets a later tile move BACKWARDS
           into an earlier hole — which packs tighter but decouples visual order
           from DOM order, and DOM order is what reorder-by-drag (U33/U41)
           edits. */
        :host([child-position="grid"]) slot {
            display: grid;
            grid-template-columns: repeat(auto-fill, var(--feezal-grid-cell-width, 120px));
            grid-auto-rows: var(--feezal-grid-cell-height, 60px);
            grid-auto-flow: var(--feezal-grid-flow, row);
            gap: var(--feezal-grid-gap, 5px);
            justify-content: var(--feezal-grid-justify, start);
            align-content: start;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
        }
        /* Grid tiles are QUANTISED to their cell span: the span is derived from
           the element's authored width/height, so letting the element also keep
           that size would overflow the (rounded) area and overlap its
           neighbour. The authored size stays on the element untouched — it is
           the span's source of truth, and switching back to flow/absolute
           restores it — so this override has to win over the inline style,
           hence !important. The feezal-lift class is the editor's drag lift,
           which positions the tile fixed under the pointer at its real pixel
           size and must therefore be exempt. */
        :host([child-position="grid"]) ::slotted(*) { position: relative; }
        :host([child-position="grid"]) ::slotted(:not(.feezal-lift)) {
            width: auto !important;
            height: auto !important;
            min-width: 0;
            min-height: 0;
        }
        ::slotted(.feezal-placeholder) {
            display: block;
            background-color: rgba(var(--feezal-selection-rgb, 2,132,199), 0.1);
            border: 1px dashed rgba(var(--feezal-selection-rgb, 2,132,199), 0.4);
        }
        ::slotted(.feezal-editable) {
            cursor: move;
        }
        ::slotted(.feezal-editable[locked]) {
            cursor: default;
        }
        ::slotted(.feezal-selected) {
            outline: 2px solid rgba(var(--feezal-selection-rgb, 2,132,199), 0.9) !important;
            outline-offset: 1px;
        }
    `;

    static get feezal() {
        return {
            attributes: [
                {
                    // kebab HTML attribute name (matches the reflected attribute
                    // AND the flow knobs' visibleWhen key — the inspector keys
                    // its value map by this descriptor name).
                    name: 'child-position',
                    dropdown: ['absolute', 'flow', 'grid']
                },
                {
                    // U51 — per-view theme. Themes are class-scoped
                    // (.feezal-theme-<n> { --vars… }), so putting the class on
                    // the view scopes the theme to this view only.
                    // U53: rendered by the SHARED styled picker (shortened
                    // names + colour swatches — the same control as the site
                    // theme selector). Its element mount keeps the B50
                    // contract: a leading "Inherit" entry (B74; a view with no
                    // theme inherits the site theme) and a × clear, both
                    // REMOVING the attribute.
                    name: 'theme',
                    type: 'custom',
                    component: 'feezal-theme-select',
                    emptyOption: 'Inherit',
                    default: '',
                },
                {
                    // U95 — the U51 theme, MQTT-settable. Payload is a theme
                    // name (the same values the Theme control offers, bare
                    // suffix or full class); an empty payload or `default`
                    // clears back to the site theme, which is what makes a
                    // "reset" publish possible without knowing the site's
                    // theme name.
                    name: 'subscribe-theme',
                    type: 'mqttTopic',
                    help: 'Topic that sets this view’s theme at runtime (viewer). Payload = a theme name, same values as Theme; an empty payload or “default” clears back to the site theme.'
                },
                {
                    // N37 — per-view override of the site's pause-hidden-
                    // subscriptions default. `never` = the escape hatch for
                    // views with non-retained data that must not miss
                    // messages while hidden (keeps the connection cache warm
                    // for later embedded clones).
                    name: 'pause-subscriptions',
                    type: 'select',
                    options: ['inherit', 'always', 'never'],
                    default: 'inherit',
                    help: 'Pause this view’s MQTT subscriptions while it is hidden (viewer only). inherit = follow the site setting; always = pause even when the site default is off; never = keep subscribed (non-retained data, warm cache for embedded copies).'
                },
                {
                    // N40 — per-view override of the site's lazy-view-
                    // subscriptions default. Lazy defers the FIRST subscribe
                    // until the view is revealed (composes with pause, which
                    // drops it again on a later hide). `never` keeps the view
                    // eagerly subscribed from load (non-retained data).
                    name: 'lazy-subscriptions',
                    type: 'select',
                    options: ['inherit', 'always', 'never'],
                    default: 'inherit',
                    help: 'Subscribe this view’s MQTT topics only when it is first shown (viewer only). inherit = follow the site setting; always = defer even when the site default is off; never = subscribe eagerly from load (non-retained data). Combine with Pause to keep the view fully on-demand.'
                },
                // U41 — flow knobs; U39 conditional visibility hides them unless
                // the view is in flow mode.
                {name: 'flow-gap', type: 'number', default: 5, section: 'Flow layout',
                    visibleWhen: {attr: 'child-position', equals: 'flow'}, help: 'Gap between elements (px).'},
                {name: 'flow-direction', type: 'select', options: ['row', 'column'], default: 'row', section: 'Flow layout',
                    visibleWhen: {attr: 'child-position', equals: 'flow'}, help: 'Main axis: row = left→right then wrap; column = top→bottom then wrap.'},
                {name: 'flow-justify', type: 'select', options: ['start', 'center', 'end', 'space-between'], default: 'start', section: 'Flow layout',
                    visibleWhen: {attr: 'child-position', equals: 'flow'}, help: 'Alignment along the main axis.'},
                {name: 'flow-align', type: 'select', options: ['start', 'center', 'end', 'stretch'], default: 'start', section: 'Flow layout',
                    visibleWhen: {attr: 'child-position', equals: 'flow'}, help: 'Alignment along the cross axis.'},
                // U90 — grid knobs, hidden unless the view is in grid mode.
                {name: 'grid-cell-width', type: 'number', section: 'Grid layout',
                    visibleWhen: {attr: 'child-position', equals: 'grid'},
                    help: 'Width of one grid cell (px). Leave empty to derive it from the narrowest element in this view.'},
                {name: 'grid-cell-height', type: 'number', section: 'Grid layout',
                    visibleWhen: {attr: 'child-position', equals: 'grid'},
                    help: 'Height of one grid cell (px). Leave empty to derive it from the shortest element in this view.'},
                {name: 'grid-gap', type: 'number', default: 5, section: 'Grid layout',
                    visibleWhen: {attr: 'child-position', equals: 'grid'}, help: 'Gap between cells (px).'},
                {name: 'grid-justify', type: 'select', options: ['start', 'center', 'end', 'space-between'], default: 'start', section: 'Grid layout',
                    visibleWhen: {attr: 'child-position', equals: 'grid'}, help: 'Horizontal alignment of the whole grid within the view.'},
                {name: 'grid-dense', type: 'boolean', default: false, section: 'Grid layout',
                    visibleWhen: {attr: 'child-position', equals: 'grid'},
                    help: 'Pack tightly: let a later element move backwards to fill a hole left by a larger one. Fills more gaps, but the visual order no longer matches the element order, which makes reordering by drag harder to predict.'}
            ],
            // N34: `background` is a style GROUP — the editor renders the rich
            // Background editor (None/Solid/Image/Gradient) in place of a raw
            // value row; the widget owns the whole background-* longhand family
            // (covers declared on the editor class). Editor-only: the viewer
            // never resolves the editor tag.
            styles: ['width', 'height',
                {group: 'background', editor: 'feezal-style-editor-background', label: 'Background'}]
        };
    }

    constructor() {
        super();
        this.childPosition = 'absolute';
        this._conditions = new FeezalConditions(this, {actions: VIEW_CONDITION_ACTIONS});
        // U95/U88 — the MQTT inspector panel reads `_subscriptions` to show what
        // the selection REALLY wired, so a view keeps the same bookkeeping an
        // element's base class does. Real handles only; nothing declared-but-
        // unwired goes in here, or unsubscribe() would be handed a non-handle.
        this._subscriptions = [];
        this._themeSub = null;
        this._themeTopic = '';
        this._gridSheet = null;
        this._gridObserver = null;
        this._gridSyncPending = false;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._conditions.disconnect();   // U95 — releases its subscriptions
        this._unwireTheme();             // U95 — and so does the theme topic
        this._gridObserver?.disconnect();
        this._gridObserver = null;
    }

    render() {
        return html`<slot @slotchange=${this._scheduleGridSync}></slot>`;
    }

    firstUpdated() {
        // U90 — per-child grid spans can't be expressed by a static sheet
        // (::slotted() has no way to read an element's size), so they are
        // generated as `::slotted(:nth-child(n))` rules into a sheet of our
        // own. Deliberately NOT inline styles on the children: the editor
        // serializes inline styles into views.html, and layout artifacts there
        // would both pollute saved markup and fight the B80 hand-off.
        try {
            const sheet = new CSSStyleSheet();
            this.shadowRoot.adoptedStyleSheets = [...this.shadowRoot.adoptedStyleSheets, sheet];
            this._gridSheet = sheet;
        } catch {
            // Engine without constructable stylesheets: a plain <style> node
            // appended after Lit's render markers behaves identically.
            const node = document.createElement('style');
            this.shadowRoot.append(node);
            this._gridSheet = {replaceSync: text => { node.textContent = text; }};
        }
        this._syncGrid();
    }

    updated(changed) {
        if (changed.has('visible')) {
            this._visibleChange(this.visible);
        }
        if (changed.has('theme')) {
            this._applyThemeClass();
        }
        // U95 — the attribute can change under the editor (source mode, undo,
        // history restore), and connect() re-reads it and rewires itself.
        if (changed.has('conditions')) {
            this._conditions.connect();
        }
        // U95 — same for the theme topic. NOT gated on `theme` changing: a
        // message arriving on the topic sets `theme`, and rewiring from that
        // would tear down the subscription that just fired.
        if (changed.has('subscribeTheme')) {
            this._wireTheme();
        }
        // U41 — the legacy `static` value is aliased to `flow` at load (no file
        // migration; the next save writes `flow`).
        if (changed.has('childPosition') && this.childPosition === 'static') {
            this.childPosition = 'flow';
        }
        if (changed.has('flowGap') || changed.has('flowDirection') ||
            changed.has('flowJustify') || changed.has('flowAlign')) {
            this._syncFlowVars();
        }
        // U90 — the grid geometry depends on the mode AND on every knob.
        if (changed.has('childPosition') || changed.has('gridCellWidth') ||
            changed.has('gridCellHeight') || changed.has('gridGap') ||
            changed.has('gridJustify') || changed.has('gridDense')) {
            this._syncGrid();
        }
    }

    /**
     * U90 — recompute the grid sheet on the next frame. Coalesced because the
     * triggers are hot: dragging or resizing a tile in the editor rewrites a
     * child's inline style on every pointer frame.
     */
    _scheduleGridSync() {
        if (this._gridSyncPending) return;
        this._gridSyncPending = true;
        requestAnimationFrame(() => {
            this._gridSyncPending = false;
            this._syncGrid();
        });
    }

    /**
     * U90 — resolve the cell size. An explicit grid-cell-width/height wins;
     * otherwise it is the SMALLEST authored child size, which makes the common
     * case ("one tile is deliberately double-size") work with no configuration
     * at all: the ordinary tiles define the cell and the big one spans 2x2.
     */
    _gridCell() {
        let w = attrNum(this.gridCellWidth);
        let h = attrNum(this.gridCellHeight);
        if (!w || !h) {
            let minW = Infinity;
            let minH = Infinity;
            for (const el of this.children) {
                if (el.nodeType !== Node.ELEMENT_NODE) continue;
                const cw = stylePx(el.style?.width);
                const ch = stylePx(el.style?.height);
                if (cw) minW = Math.min(minW, cw);
                if (ch) minH = Math.min(minH, ch);
            }
            if (!w) w = Number.isFinite(minW) ? minW : GRID_FALLBACK_CELL.w;
            if (!h) h = Number.isFinite(minH) ? minH : GRID_FALLBACK_CELL.h;
        }
        return {w: Math.max(8, Math.round(w)), h: Math.max(8, Math.round(h))};
    }

    /**
     * U90 — write the grid custom properties and the per-child span rules.
     *
     * Both go into the generated sheet rather than onto the host's style
     * attribute: the child MutationObserver below watches `style`, and mutating
     * the host from inside its own callback would loop.
     */
    _syncGrid() {
        this._observeGridChildren();
        if (!this._gridSheet) return;
        if (this.childPosition !== 'grid') {
            this._gridSheet.replaceSync('');
            return;
        }

        const rawGap = Number.parseFloat(this.gridGap);
        const gap = Number.isFinite(rawGap) && rawGap >= 0 ? rawGap : 5;
        const cell = this._gridCell();
        // Round rather than ceil: an element a few px off a clean multiple
        // (borders, hand-nudged sizes) should land on the nearest cell count,
        // not always grow.
        const spanOf = (size, unit) => Math.max(1, Math.round((size + gap) / (unit + gap)));

        const rules = [
            ':host{' +
                `--feezal-grid-cell-width:${cell.w}px;` +
                `--feezal-grid-cell-height:${cell.h}px;` +
                `--feezal-grid-gap:${gap}px;` +
                `--feezal-grid-flow:${this.gridDense ? 'row dense' : 'row'};` +
                `--feezal-grid-justify:${this.gridJustify || 'start'};` +
            '}'
        ];
        // nth-child is 1-based over ALL element children — including the
        // editor's drag placeholder, which is why the index is taken from the
        // full child list and not from a filtered one.
        [...this.children].forEach((el, i) => {
            if (el.nodeType !== Node.ELEMENT_NODE) return;
            const cols = stylePx(el.style?.width) ? spanOf(stylePx(el.style.width), cell.w) : 1;
            const rows = stylePx(el.style?.height) ? spanOf(stylePx(el.style.height), cell.h) : 1;
            if (cols > 1 || rows > 1) {
                rules.push(`::slotted(:nth-child(${i + 1})){grid-column:span ${cols};grid-row:span ${rows}}`);
            }
        });
        this._gridSheet.replaceSync(rules.join('\n'));
    }

    /** U90 — watch child add/remove and child size edits, but only in grid mode. */
    _observeGridChildren() {
        if (this.childPosition !== 'grid') {
            this._gridObserver?.disconnect();
            this._gridObserver = null;
            return;
        }
        if (this._gridObserver) return;
        this._gridObserver = new MutationObserver(records => {
            // Ignore our own host mutations; only child geometry matters.
            if (records.every(r => r.target === this)) return;
            this._scheduleGridSync();
        });
        this._gridObserver.observe(this, {
            childList: true, subtree: true, attributes: true, attributeFilter: ['style']
        });
    }

    /** U41 — map the flow-* attributes onto the CSS custom properties the slot reads. */
    _syncFlowVars() {
        const set = (prop, val) => val ? this.style.setProperty(prop, val) : this.style.removeProperty(prop);
        set('--feezal-flow-gap', (this.flowGap ?? '') !== '' ? `${this.flowGap}px` : '');
        set('--feezal-flow-direction', this.flowDirection || '');
        set('--feezal-flow-justify', this.flowJustify || '');
        set('--feezal-flow-align', this.flowAlign || '');
    }

    /**
     * U95 — the host contract FeezalConditions needs. Without it the engine
     * falls back to plain `msg.payload` and silently ignores a configured
     * property path, so a condition on nested JSON would never match.
     */
    getProperty(obj, prop) {
        return getMessageProperty(obj, prop);
    }

    _visibleChange(visible) {
        // Hide/show the view itself so inactive views don't stack on screen.
        this.style.display = visible ? '' : 'none';

        this.querySelectorAll('*').forEach(element => {
            if (element.tagName.startsWith('FEEZAL-ELEMENT-')) {
                element.visible = visible;
            }
        });
    }

    /**
     * U51 — apply/remove the per-view theme class. Themes are class-scoped
     * CSS, so the class alone scopes the theme to this view (and to clones of
     * it: layout-app/dialog-view embeds copy attributes, and their own
     * lifecycle re-derives the class). The `theme` attribute OWNS the
     * feezal-theme-* classes on views: stale serialized classes are stripped,
     * which also self-heals saved markup. Suppressed while a site-level
     * user/MQTT theme override is active — the user's choice wins everywhere
     * (see feezal-site's `theme` control command / E91).
     */
    _applyThemeClass() {
        const suppressed = Boolean(window.feezal?.site?._themeOverride);
        const raw = (this.theme || '').trim();
        const wanted = !suppressed && raw
            ? (raw.startsWith('feezal-theme-') ? raw : 'feezal-theme-' + raw)
            : null;
        [...this.classList]
            .filter(c => c.startsWith('feezal-theme-') && c !== wanted)
            .forEach(c => this.classList.remove(c));
        if (wanted) this.classList.add(wanted);
    }

    /**
     * U95 — release the theme subscription. Split out because three callers
     * need it: the rewire below, disconnect, and a topic cleared to empty.
     */
    _unwireTheme() {
        if (!this._themeSub) return;
        feezal?.connection?.unsubscribe?.(this._themeSub);
        this._subscriptions = this._subscriptions.filter(s => s !== this._themeSub);
        this._themeSub = null;
    }

    /**
     * U95 — (re)wire `subscribe-theme`: the U51 per-view theme, MQTT-settable.
     *
     * An empty payload clears back to the site theme — that is the documented
     * reset, and it means a publisher can hand a view back without knowing
     * which theme the site runs. `theme` reflects, so setting the property is
     * enough: the attribute follows and `updated()` re-derives the class.
     *
     * The editor gate sits INSIDE the callback, not before the subscribe. The
     * topic is wired either way — that is what lets the U88 MQTT tab show the
     * live payload, which is the panel's whole point — but the value is not
     * APPLIED while "prevent MQTT element manipulation" is on: `theme`
     * reflects, so a broker value would be written into the saved views.html.
     * Turning the setting off gives live theming on the canvas, same as
     * elements.
     */
    _wireTheme() {
        const topic = (this.subscribeTheme || '').trim();
        // Idempotent for an unchanged topic: connectedCallback and the first
        // updated() both call this for the same value, and a resubscribe there
        // would drop a retained message already delivered to the old handle.
        if (this._themeSub && topic === this._themeTopic) return;

        this._unwireTheme();
        this._themeTopic = topic;
        if (!topic) return;
        if (typeof feezal === 'undefined') return;
        if (!feezal.connection?.sub) return;

        this._themeSub = feezal.connection.sub(topic, message => {
            if (feezal.isEditor && feezal.preventEditorMqtt !== false) return;
            // Read through getProperty (the U95 step-1 extraction) rather than
            // message.payload directly — the view has ONE payload reader and
            // this is it, even though the default path is equivalent today.
            const raw = String(this.getProperty(message, 'payload') ?? '').trim();
            // Same vocabulary as the site-level `theme` control command (E91):
            // both '' and 'default' clear. Someone who knows one should not
            // have to learn the other.
            this.theme = !raw || raw === 'default' ? '' : raw;
        });
        this._subscriptions.push(this._themeSub);
    }

    connectedCallback() {
        super.connectedCallback();
        // U51: strip stale serialized theme classes / apply the attribute on
        // mount — the updated() hook only fires when the property changes.
        this._applyThemeClass();
        // U95: re-wire after a detach/re-attach (a view switch moves nodes) —
        // the property has not changed, so updated() would not fire. _wireTheme
        // drops the previous handle first, so this cannot double-subscribe.
        this._wireTheme();
        // U90: re-arm the child observer after a detach/re-attach (view
        // switches move nodes around) — no property changes, so updated()
        // would not fire.
        this._syncGrid();
        // U95: connect() is idempotent and no-ops in the editor, so calling it
        // here AND from updated() is safe — which is what makes a view that is
        // re-attached on a view switch pick its subscriptions back up.
        this._conditions.connect();
        if (!feezal.isEditor && this.subscribe) {
            feezal.connection.sub(this.subscribe + '/addclass', message => {
                this.classList.add(message.payload);
            });
            feezal.connection.sub(this.subscribe + '/removeclass', message => {
                this.classList.remove(message.payload);
            });
        }
    }
}

window.customElements.define('feezal-view', FeezalView);

export {FeezalView};

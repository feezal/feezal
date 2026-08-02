import {LitElement, html, css} from 'lit';

import {RubberBand} from './feezal-canvas-rubberband.js';   // A38
import {isCanvasElement, stripCanvasZIndex, stackingSiblings, stackingState,
    reorderElements, stashAbsoluteGeometry, restoreAbsoluteGeometry, hideSnapOverlays}
    from './feezal-canvas-geometry.js';   // A37
import interact from 'interactjs';

import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';

import './feezal-sidebar-inspector-styles.js';
import './feezal-sidebar-inspector-attributes.js';
import './feezal-sidebar-inspector-conditions.js';
import './feezal-sidebar-debug.js';    // U88
import {clippyStyles, clippyMarkup, clippyEnabled} from './feezal-clippy.js';
import {align, distribute, matchSize, operationLabel} from './feezal-canvas-align.js';   // U83
import {isFlowLike} from './feezal-view.js';   // U90
import {bestEqualGap} from './feezal-canvas-gaps.js';   // U89

/** Inspector tabs that only exist while exactly ONE element is selected. */
const SINGLE_ELEMENT_TABS = ['conditions', 'debug'];

// E115 — function-identity aliases for the Switch-family pairing: a family
// whose tag suffix diverges for the SAME function is normalised here so its twin
// pairs up (E138: the numeric readout is `*-value` everywhere but `eink-number`).
// E148: eink's numeric card was renamed eink-number → eink-value, so the
// former number↔value divergence is gone — no aliases needed. (basic-number
// stays the unstyled primitive and is deliberately NOT paired with the styled
// -value cards.) Kept as an empty map for any future divergence.
const FN_ALIAS = {};
const FAMILY_LABELS = {eink: 'E-ink', tui: 'TUI', wled: 'WLED'};
const familyLabel = f => FAMILY_LABELS[f] || (f ? f.charAt(0).toUpperCase() + f.slice(1) : f);

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
        _switchReport:  {state: true},   // E115: transient Switch-family summary
        _shortcutsOpen: {state: true}
    };

    static styles = css`
        :host { display: flex; flex-direction: column; height: 100%; background-color: var(--feezal-bg, white); box-sizing: border-box; }
        sl-tab-group { flex: 1; min-height: 0; display: flex; flex-direction: column; }
        sl-tab-group::part(base) { flex: 1; min-height: 0; display: flex; flex-direction: column; }
        sl-tab-group::part(body) { flex: 1; min-height: 0; overflow: hidden; }
        sl-tab-group::part(nav) { background: var(--feezal-bg-sub, #f5f5f5); }
        /* 39px tab + 2px nav track = 41px — matches the .ftab view tab bar
           left of the sidebar (same rule in feezal-sidebar-viewer). */
        sl-tab::part(base) { font-size: 14px; padding: 0 8px; height: 39px; }
        sl-tab-panel { height: 100%; }
        sl-tab-panel::part(base) { height: 100%; overflow-y: auto; padding: 0; box-sizing: border-box; }
        /* ── Selection badge ──────────────────────────────────────────────── */
        .sel-badge {
            margin-left: auto; align-self: center; margin-right: 8px;
            font-size: 11px; line-height: 1.4; padding: 2px 8px;
            border-radius: 10px;
            /* The app sets --feezal-sel-badge-* (dark values) on this element
               in dark mode; light-mode fallbacks below. The old
               :host(.dark)/:host-context selectors never matched (dark is a
               class on the app host, not on this nested component). */
            background: var(--feezal-sel-badge-bg, var(--sl-color-primary-100, #e0f2fe));
            color: var(--feezal-sel-badge-color, var(--sl-color-primary-700, #0369a1));
            border: 1px solid var(--feezal-sel-badge-border, var(--sl-color-primary-300, #7dd3fc));
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
        .ctx-item.danger:hover:not(.ctx-disabled) { background: var(--feezal-ctx-danger, #c62828); color: #fff; }
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
            min-width: 140px; max-width: 280px; padding: 4px 0; z-index: 10001;
            /* The view list is unbounded — cap the height and scroll. JS
               (_positionCtxSub) refines the exact placement + height against the
               viewport when the submenu opens. */
            max-height: 70vh; overflow-y: auto;
        }
        .ctx-sub .ctx-item { overflow: hidden; text-overflow: ellipsis; }
        /* U83: the align submenu is a fixed short list — no scrolling needed,
           and it should not inherit the view list's generous width. */
        .ctx-sub.align-sub { min-width: 180px; max-height: none; }

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

        /* E115: transient Switch-family report (never silently lossy). */
        .switch-toast {
            position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%);
            z-index: 20001; max-width: 560px;
            padding: 9px 16px; border-radius: 8px; cursor: pointer;
            font-size: 12.5px; line-height: 1.35;
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #222);
            border: 1px solid var(--sl-color-primary-400, #38bdf8);
            box-shadow: 0 6px 24px rgba(0,0,0,0.28);
        }
        .switch-toast.warn { border-color: var(--warning-color, #f59e0b); }

        /* U46: opt-in paperclip assistant, shared with the source-mode popup. */
        ${clippyStyles}
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
        this._rubberBand = null;   // A38: one instance, retargeted per view
        this._ctxMenu = {visible: false, x: 0, y: 0, onElem: false, subMenu: null};
        this._switchReport = null;
        this._shortcutsOpen = false;
        this._shiftDown = false;
        this._ctrlDown = false;
    }

    /** Exactly one feezal element (not a view, not a component, not several). */
    get _singleElementSelected() {
        return !this.viewSelected && this.selectedElems.length === 1 &&
            Boolean(this.selectedElems[0]?.localName?.startsWith?.('feezal-element-'));
    }

    /** U95 — exactly one selected VIEW. Views carry conditions and (via
     *  subscribe-theme) MQTT wiring of their own, so they earn the same tabs. */
    get _singleViewSelected() {
        return Boolean(this.viewSelected) && this.selectedElems.length === 1 &&
            this.selectedElems[0]?.localName === 'feezal-view';
    }

    /** The selection the Conditions and MQTT tabs operate on — ONE predicate, so
     *  the tabs and the U88 fall-back-to-Attributes rule can never disagree. */
    get _wiringTarget() {
        return this._singleElementSelected || this._singleViewSelected;
    }

    _selectionLabel() {
        const n = this.selectedElems?.length ?? 0;
        if (!n) return '';
        if (n > 1) return `${n} elements`;
        const el = this.selectedElems[0];
        if (this.viewSelected) {
            return `view: ${el.getAttribute?.('name') || '?'}`;
        }
        if (el.localName === 'feezal-component') {
            return `component: ${el.getAttribute?.('name') || '?'}`;
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
        // U32: component context-menu entries. "Create component…" needs a
        // selection of plain elements (no nesting of instances); the component
        // actions need the selection to be instances only.
        const selNonView = this.viewSelected ? [] : this.selectedElems.filter(el => el.tagName !== 'FEEZAL-VIEW');
        const canCreateComponent = selNonView.length > 0 &&
            !selNonView.some(el => el.localName === 'feezal-component');
        const isComponentSel = selNonView.length > 0 &&
            selNonView.every(el => el.localName === 'feezal-component');
        // U33: stacking-order menu state (DOM order = paint order).
        const stacking = cm.visible && cm.onElem && feezal.view
            ? stackingState(feezal.view, selNonView)
            : {canFront: false, canBack: false, canForward: false, canBackward: false};
        // U83: align/distribute needs ≥2 unlocked absolutely-positioned
        // elements (a flow view lays its children out itself, so moving them
        // by inline offsets would do nothing).
        const alignable = cm.visible && cm.onElem && !isFlowLike(feezal.view)
            ? selNonView.filter(el => !el.hasAttribute('locked'))
            : [];
        const alignCount = alignable.length;
        const canAlign = alignCount > 1;
        // E50 Conditions and U88 MQTT are both single-SELECTION panels (a
        // condition set or a message tail for several elements at once is
        // noise, not information) — one predicate, so the tabs and the
        // fall-back-to-Attributes rule can never disagree.
        // U95 widened both to a single selected VIEW, which now runs the
        // conditions engine and can carry a subscribe-theme topic. Component
        // instances are still out (a later iteration; see the E50 archive).
        const canConditions = this._wiringTarget;
        const condCount = canConditions ? this._conditionCount(this.selectedElems[0]) : 0;
        const canDebug = this._wiringTarget;
        // E115: families the current selection can be switched to (union of each
        // element's twins in other installed families).
        const switchTargets = cm.visible && cm.onElem ? this._switchFamilyTargets() : [];
        return html`
            <sl-tab-group @sl-tab-show="${e => { this._activeTab = e.detail.name; }}">
                <sl-tab slot="nav" panel="attributes">Attributes</sl-tab>
                <sl-tab slot="nav" panel="styles">Styles</sl-tab>
                ${canConditions ? html`
                    <sl-tab slot="nav" panel="conditions">Conditions${condCount ? ` · ${condCount}` : ''}</sl-tab>
                ` : ''}
                ${canDebug ? html`
                    <sl-tab slot="nav" panel="debug" title="Live MQTT wiring of the selection">MQTT</sl-tab>
                ` : ''}
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
                ${canConditions ? html`
                    <sl-tab-panel name="conditions">
                        <feezal-sidebar-inspector-conditions
                            .selectedElems="${this.selectedElems}"
                            @conditions-changed="${() => this.requestUpdate()}">
                        </feezal-sidebar-inspector-conditions>
                    </sl-tab-panel>
                ` : ''}
                ${canDebug ? html`
                    <sl-tab-panel name="debug">
                        <feezal-sidebar-debug .selectedElems="${this.selectedElems}"></feezal-sidebar-debug>
                    </sl-tab-panel>
                ` : ''}
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
                        <div class="ctx-item ${stacking.canFront ? '' : 'ctx-disabled'}"
                            @click="${() => stacking.canFront && this._ctxAction('bringToFront')}">
                            Bring to front <span class="ctx-kbd">Ctrl+Shift+]</span>
                        </div>
                        <div class="ctx-item ${stacking.canForward ? '' : 'ctx-disabled'}"
                            @click="${() => stacking.canForward && this._ctxAction('bringForward')}">
                            Bring forward <span class="ctx-kbd">Ctrl+]</span>
                        </div>
                        <div class="ctx-item ${stacking.canBackward ? '' : 'ctx-disabled'}"
                            @click="${() => stacking.canBackward && this._ctxAction('sendBackward')}">
                            Send backward <span class="ctx-kbd">Ctrl+[</span>
                        </div>
                        <div class="ctx-item ${stacking.canBack ? '' : 'ctx-disabled'}"
                            @click="${() => stacking.canBack && this._ctxAction('sendToBack')}">
                            Send to back <span class="ctx-kbd">Ctrl+Shift+[</span>
                        </div>
                        ${canAlign ? html`
                            <div class="ctx-sep"></div>
                            <div class="ctx-item"
                                @mouseenter="${() => this._openCtxSub('align')}"
                                @mouseleave="${() => this._scheduleCtxSub(null)}">
                                Align &amp; distribute… <span class="ctx-arrow">▶</span>
                                ${cm.subMenu === 'align' ? html`
                                    <div class="ctx-sub align-sub"
                                        @mouseenter="${() => this._clearCtxSub()}"
                                        @mouseleave="${() => this._scheduleCtxSub(null)}">
                                        ${[['left', 'Align left'], ['hcenter', 'Centre horizontally'], ['right', 'Align right']]
                                            .map(([m, label]) => html`
                                                <div class="ctx-item" @click="${() => this._ctxAlign(m)}">${label}</div>`)}
                                        <div class="ctx-sep"></div>
                                        ${[['top', 'Align top'], ['vcenter', 'Centre vertically'], ['bottom', 'Align bottom']]
                                            .map(([m, label]) => html`
                                                <div class="ctx-item" @click="${() => this._ctxAlign(m)}">${label}</div>`)}
                                        ${alignCount > 2 ? html`
                                            <div class="ctx-sep"></div>
                                            <div class="ctx-item" @click="${() => this._ctxAlign('horizontal')}">Distribute horizontally</div>
                                            <div class="ctx-item" @click="${() => this._ctxAlign('vertical')}">Distribute vertically</div>` : ''}
                                        <div class="ctx-sep"></div>
                                        <div class="ctx-item" @click="${() => this._ctxAlign('width')}">Match width</div>
                                        <div class="ctx-item" @click="${() => this._ctxAlign('height')}">Match height</div>
                                        <div class="ctx-item" @click="${() => this._ctxAlign('both')}">Match size</div>
                                    </div>` : ''}
                            </div>` : ''}
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
                        ${switchTargets.length ? html`
                            <div class="ctx-item"
                                @mouseenter="${() => this._openCtxSub('switch')}"
                                @mouseleave="${() => this._scheduleCtxSub(null)}">
                                Switch family… <span class="ctx-arrow">▶</span>
                                ${cm.subMenu === 'switch' ? html`
                                    <div class="ctx-sub"
                                        @mouseenter="${() => this._clearCtxSub()}"
                                        @mouseleave="${() => this._scheduleCtxSub(null)}">
                                        ${switchTargets.map(t => html`
                                            <div class="ctx-item" @click="${() => this._ctxSwitchFamily(t.family)}">
                                                ${familyLabel(t.family)}${t.count > 1 ? html` <span class="ctx-kbd">${t.count}</span>` : ''}
                                            </div>
                                        `)}
                                    </div>
                                ` : ''}
                            </div>
                            <div class="ctx-sep"></div>
                        ` : ''}
                        ${canCreateComponent ? html`
                            <div class="ctx-item" @click="${() => this._ctxAction('createComponent')}">
                                Create component…
                            </div>
                            <div class="ctx-sep"></div>
                        ` : ''}
                        ${isComponentSel ? html`
                            <div class="ctx-item" @click="${() => this._ctxAction('editComponent')}">
                                Edit component
                            </div>
                            <div class="ctx-item" @click="${() => this._ctxAction('detachComponent')}">
                                Detach
                            </div>
                            <div class="ctx-item" @click="${() => this._ctxAction('renameComponent')}">
                                Rename component…
                            </div>
                            <div class="ctx-item danger" @click="${() => this._ctxAction('deleteComponent')}">
                                Delete component…
                            </div>
                            <div class="ctx-sep"></div>
                        ` : ''}
                        <div class="ctx-item danger" @click="${() => this._ctxAction('delete')}">
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
            ${this._switchReport ? html`
                <div class="switch-toast ${this._switchReport.warn ? 'warn' : ''}"
                    @click="${() => { this._switchReport = null; }}">
                    ${this._switchReport.text}
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
                            <tr><td>Ctrl+Shift+Z / Ctrl+Y</td><td>Redo</td></tr>
                            <tr><td>Ctrl+S</td><td>Deploy (save)</td></tr>
                            <tr><td>Ctrl+A</td><td>Select all elements</td></tr>
                            <tr><td>Ctrl+C / X / V</td><td>Copy / Cut / Paste</td></tr>
                            <tr><td>Ctrl+D</td><td>Duplicate selection</td></tr>
                            <tr><td>Ctrl+L</td><td>Lock / unlock selection</td></tr>
                            <tr><td>Ctrl+] / Ctrl+[</td><td>Bring forward / send backward</td></tr>
                            <tr><td>Ctrl+Shift+] / Ctrl+Shift+[</td><td>Bring to front / send to back</td></tr>
                            <tr><td>Ctrl+I / ?</td><td>Open this shortcuts dialog</td></tr>
                            <tr><td>Arrow keys</td><td>Nudge by grid size</td></tr>
                            <tr><td>Ctrl/Shift+Arrow keys</td><td>Nudge by 1 px</td></tr>
                            <tr><td>Ctrl+click</td><td>Add / remove element from selection</td></tr>
                            <tr><td>Ctrl while drag/resize</td><td>Disable snapping temporarily (or enable element snap when off)</td></tr>
                            <tr><td>Shift while drag/resize</td><td>Switch snap mode: elements ↔ grid (or enable grid when off)</td></tr>
                        </table>
                        ${clippyEnabled() ? clippyMarkup() : ''}
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
            // E50: eye decorator for elements carrying conditions (effects are
            // never applied in the editor — the badge is the affordance).
            const eyeSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'/></svg>`;
            const eyeUrl = `url("data:image/svg+xml,${encodeURIComponent(eyeSvg)}")`;
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
                .feezal-editable[conditions]:not([conditions=""])::before {
                    content: '';
                    display: block;
                    position: absolute;
                    top: -1px; left: -1px;
                    width: 14px; height: 14px;
                    background-color: rgba(var(--feezal-selection-rgb, 2,132,199), 0.9);
                    -webkit-mask: ${eyeUrl} center / contain no-repeat;
                    mask: ${eyeUrl} center / contain no-repeat;
                    pointer-events: none;
                    z-index: 1000;
                }
                /* U33: canvas stacking is DOM order — neutralize any inline
                   z-index a drag gesture writes (the lift uses 9999), which
                   would otherwise paint over the sanctioned stacking order.
                   Also self-heals sites saved while DragSelect was accumulating
                   its own ±1-per-select junk. Stripped from the serialized HTML
                   at save time (stripCanvasZIndex). */
                feezal-view > .feezal-editable {
                    z-index: auto !important;
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
                    // Restore the editor-only view folder tree (U8).
                    if (feezal.app && typeof feezal.app.setFolders === 'function') {
                        feezal.app.setFolders(viewerConfig && viewerConfig.folders);
                    }
                    const viewerSidebar = feezal.app.shadowRoot.querySelector('feezal-sidebar-viewer');
                    if (viewerSidebar) {
                        if (data.viewer && data.viewer.connection) {
                            viewerSidebar.connection = data.viewer.connection;
                        }
                        // U43: the loaded config IS the deployed state — arm
                        // the Apply-connection-settings dirty detection.
                        viewerSidebar.markConnectionDeployed?.();
                        // A9: restore the PWA opt-in from the persisted config
                        viewerSidebar.pwa = Boolean(viewerConfig && viewerConfig.pwa);
                        viewerSidebar.security = (viewerConfig && viewerConfig.security) || {};   // A28
                        // A9 Tier 2a: mobile-app export settings
                        viewerSidebar.app = (viewerConfig && viewerConfig.app) || {};
                        // Seed the Site tab from the loaded <feezal-site>
                        // attributes — they are the persisted source of truth
                        // (they travel with the serialized site HTML).
                        if (feezal.site) {
                            const attr = name => feezal.site.getAttribute(name) || '';
                            viewerSidebar.site = {
                                name: feezal.siteName,
                                pageTitle: attr('page-title'),
                                subscribe: attr('subscribe'),
                                publish: attr('publish'),
                                locale: attr('locale'),                          // N38: '' = browser language

                                playlist: attr('playlist'),                      // N26
                                playlistEnabled: feezal.site.hasAttribute('playlist-enabled'),
                                playlistDwell: attr('playlist-dwell'),
                                playlistResume: attr('playlist-resume'),
                                playlistTransition: attr('playlist-transition'),
                                presence: attr('presence'),                      // N24: '' = on (default), 'off' = disabled
                                autoReload: attr('auto-reload'),                 // N32: '' = on (default), 'off' = disabled
                                // N37: pause hidden views' subscriptions (viewer bandwidth)
                                pauseHiddenSubscriptions: feezal.site.hasAttribute('pause-hidden-subscriptions'),
                                pauseGraceSeconds: attr('pause-grace-seconds'),
                                // N40: lazy view subscriptions (subscribe on first show)
                                lazyViewSubscriptions: feezal.site.hasAttribute('lazy-view-subscriptions')
                            };
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
                hideSnapOverlays(feezal.container);
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
        this._gridRO?.disconnect();
        this._childPosObserver?.disconnect();
    }

    /**
     * Capture a DOM-identity-independent snapshot of the current element
     * selection: {tag, idx} per selected element, indexed among the active
     * view's canvas children. Used by undo (feezal-app-editor._undo):
     * restoreViews() replaces the site's innerHTML wholesale, so the node
     * references in selectedElems die with the swap.
     */
    captureSelection() {
        if (this.viewSelected || !feezal.view) return [];
        const children = [...feezal.view.children].filter(isCanvasElement);
        return this.selectedElems
            .map(el => ({tag: el.localName, idx: children.indexOf(el)}))
            .filter(s => s.idx >= 0);
    }

    /**
     * Re-select the captured elements after a restore. A capture entry only
     * matches when the same tag sits at the same index — structural undos
     * (delete/paste/restack) may shift indices, and silently selecting a
     * different element type would be worse than falling back. When nothing
     * matches, the view selection restoreViews() ended with simply stands.
     */
    restoreSelection(captured) {
        if (!captured || captured.length === 0 || !feezal.view) return;
        const children = [...feezal.view.children].filter(isCanvasElement);
        const matched = captured
            .map(s => children[s.idx])
            .filter((el, i) => el && el.localName === captured[i].tag);
        if (matched.length > 0) {
            this.selectElement(matched);
        }
    }

    /** A38: drop the rubber band's listeners and any overlay in flight. */
    _disposeRubberBand() {
        this._rubberBand?.destroy();
        this._rubberBand = null;
    }

    restoreViews(html) {
        this._disposeRubberBand();
        if (html !== undefined) {
            feezal.site.innerHTML = html;
        }

        // U32: snapshots taken during a component edit may contain the
        // pseudo-view — it must never survive a restore as a regular view.
        feezal.site.querySelectorAll('feezal-view[feezal-component-edit]').forEach(el => el.remove());
        feezal.app._onRestoreViews?.();

        feezal.app.views = [...feezal.views];
        // A38 legacy scrub: the band's overlay only exists mid-gesture, but
        // sites saved before that still carry a serialized rectangle.
        feezal.site.querySelectorAll('.dragselect-rectangle').forEach(el => el.remove());
        feezal.app._removeClassesFromChildren(feezal.site, ['feezal-selected', 'feezal-editable', 'ds-selectable']);
        feezal.palette?.refresh?.();
        // U25: the <style id="feezal-classes"> block travels inside the restored
        // markup — resync the Classes editor and inspector list to match it.
        feezal.app.shadowRoot.querySelector('feezal-sidebar-themes')?.reloadClasses?.();
        this._viewChanged();
    }

    loadViews(data, viewerConfig) {
        this._disposeRubberBand();
        feezal.app.innerHTML = data;
        feezal.app.views = [...feezal.views];
        feezal.app._removeClassesFromChildren(feezal.site, ['feezal-selected']);
        feezal.site.querySelectorAll('.dragselect-rectangle').forEach(el => el.remove());
        feezal.ready = true;
        feezal.app.shadowRoot.querySelector('feezal-sidebar-themes').siteReady(viewerConfig);
        feezal.palette?.refresh?.();
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

        // U80: the App generator creates a NEW site and switches the editor to
        // it; resume the wizard here (straight at the App setup, auto-deploy at
        // the end). Guarded so it fires once, only on the just-created site.
        try {
            if (sessionStorage.getItem('feezal:generateAppSite') === feezal.siteName) {
                sessionStorage.removeItem('feezal:generateAppSite');
                // Promise.resolve() so it still fires if updateComplete is absent
                // (`?.then?.()` would silently no-op and skip the whole resume).
                Promise.resolve(feezal.app.updateComplete).then(() =>
                    feezal.app.shadowRoot?.querySelector('feezal-generate-dialog')?.resumeNewSiteApp?.());
            }
        } catch { /* sessionStorage unavailable — no resume */ }
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

        // E50/U88: the Conditions and MQTT tabs disappear when the selection
        // becomes a multi-selection (U95: no longer when it becomes a view) —
        // fall back to Attributes, or sl-tab-group is left pointing at a panel
        // that no longer exists and the inspector renders BLANK.
        // U95: viewSelected is a separate property, and the gate now depends on
        // it — a selection change that only flips that flag must still be seen.
        if ((changed.has('selectedElems') || changed.has('viewSelected')) &&
            SINGLE_ELEMENT_TABS.includes(this._activeTab) && !this._wiringTarget) {
            this._activeTab = 'attributes';
            this.shadowRoot.querySelector('sl-tab-group')?.show?.('attributes');
        }

        // Keep the context menu (and its submenus) on-screen. The top-level menu
        // is opened at the cursor and can overflow the bottom/right with a tall
        // menu near an edge — clamp it into the viewport first; then position any
        // open submenu against the (now settled) menu.
        if (changed.has('_ctxMenu') && this._ctxMenu?.visible) {
            this._clampCtxMenu();
            if (this._ctxMenu.subMenu) this._positionCtxSub();
        }
    }

    /** Clamp the just-opened context menu into the viewport: if it would overflow
     * the bottom (a tall menu near the bottom edge) shift it UP; likewise off the
     * right edge. Updates the stored x/y (so re-renders — e.g. a submenu opening —
     * keep the clamped position) exactly once; the settled measurement then fits
     * and no further change is made. */
    _clampCtxMenu() {
        const menu = this.renderRoot?.querySelector('.ctx-menu');
        if (!menu) return;
        const r = menu.getBoundingClientRect();
        const margin = 8;
        const {x, y} = this._ctxMenu;
        let nx = x, ny = y;
        if (y + r.height > window.innerHeight - margin) ny = Math.max(margin, window.innerHeight - margin - r.height);
        if (x + r.width > window.innerWidth - margin) nx = Math.max(margin, window.innerWidth - margin - r.width);
        if (nx !== x || ny !== y) this._ctxMenu = {...this._ctxMenu, x: nx, y: ny};
    }

    /** Place an open Copy/Move/Switch submenu against the viewport: it can hold
     * any number of views, so flip it to the item's left when it would overflow
     * the right edge, shift it up when it would overflow the bottom, and cap its
     * height to the viewport with an internal scroll. */
    _positionCtxSub() {
        const sub = this.renderRoot?.querySelector('.ctx-sub');
        const item = sub?.parentElement;
        if (!sub || !item) return;
        const r = item.getBoundingClientRect();
        const margin = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        sub.style.position = 'fixed';
        sub.style.maxHeight = 'none';                 // measure the natural size first
        const subW = sub.offsetWidth;
        const natural = sub.scrollHeight;

        // Horizontal: prefer the item's right edge; flip to its left on overflow.
        let left = r.right - 2;
        if (left + subW > vw - margin) left = Math.max(margin, r.left - subW + 2);

        // Vertical: cap the height to the viewport (scroll the rest) and shift up
        // so the capped menu stays fully on-screen.
        const used = Math.min(natural, vh - 2 * margin);
        let top = r.top - 4;
        if (top + used > vh - margin) top = vh - margin - used;
        if (top < margin) top = margin;

        sub.style.left = `${left}px`;
        sub.style.top = `${top}px`;
        sub.style.maxHeight = `${used}px`;
        sub.style.overflowY = natural > used ? 'auto' : '';
    }

    /** E50: number of condition rows on an element (for the tab label). */
    _conditionCount(el) {
        try {
            const rows = JSON.parse(el?.getAttribute?.('conditions') || '[]');
            return Array.isArray(rows) ? rows.length : 0;
        } catch {
            return 0;
        }
    }

    /**
     * Re-run _viewChanged() without a property change — used by the source view
     * (N15) after it rewrites a feezal-view's innerHTML to rebind interact.js
     * drag/resize handles on the new DOM elements.
     */

    /**
     * B80 — the view's `child-position` changed while it is on screen.
     *
     * The attribute alone only re-styles (the slot becomes a flex container,
     * children become `position: relative`); every child still carries the
     * interact.js wiring — and the inline offsets — of the OLD mode, which is
     * what made a live switch scatter the tiles until a reload. Redo exactly
     * what a reload does, per element, right now.
     */
    reinitChildPosition() {
        const view = feezal.getView(this.view);
        if (!view) return;

        // The view-level machinery differs per mode (rubber-band select is
        // absolute-only), so re-run that dispatch too.
        this._disposeRubberBand();
        switch (view.childPosition) {
            case 'static':
            case 'flow':
            case 'grid':     // U90 — container-placed, same as flow
                this._attachCanvasSelection(view);
                break;
            default:
                this._initRubberBand();
        }

        for (const element of [...view.children]) {
            if (!isCanvasElement(element)) continue;
            // Drop the previous mode's interact.js bindings before re-init;
            // leaving them attached means an element is draggable under two
            // conflicting models at once.
            try { interact(element).unset(); } catch { /* never bound */ }
            element.feezalEditable = false;
            this.initElem(element);
        }
        this.selectElement();
    }

    rebindView() {
        this._viewChanged();
    }

    _gridSizeChanged() {
        const grid = feezal.app.shadowRoot.querySelector('#grid');
        if (grid) {
            const gs = this.gridSize;
            const c  = this.gridColor;
            // B14: both axes use the configured grid colour, drawn as a 1px line at
            // the start of each cell. Alignment to the view origin is handled by the
            // background-position set in _positionGrid().
            grid.style.backgroundImage =
                `linear-gradient(to right, ${c} 1px, transparent 1px),` +
                `linear-gradient(to bottom, ${c} 1px, transparent 1px)`;
            grid.style.backgroundSize = `${gs}px ${gs}px`;
            this._positionGrid(grid);
        }

        // Keep snap helper line colors in sync with the configured grid color.
        // NOT the U89 gap arrows: those are deliberately drawn in the selection
        // colour, because they are an active proposal rather than a passive
        // alignment hint.
        for (const id of ['#vsnap1', '#vsnap2', '#hsnap1', '#hsnap2']) {
            const el = feezal.app.shadowRoot.querySelector(id);
            if (el) el.style.borderColor = this.gridColor;
        }
    }

    /**
     * B14: overlay the grid on the visible canvas viewport (feezal-site) — never the
     * tab bar — and phase-shift its lines so the first line coincides with the active
     * view's 0,0 origin (accounting for the view margin / scroll offset).
     */
    _positionGrid(grid) {
        const site = feezal.site;
        const cv   = feezal.app.shadowRoot.querySelector('#container-view');
        if (!site || !cv) return;

        // Reposition when the canvas resizes (window / sidebar drag).
        if (!this._gridRO) {
            this._gridRO = new ResizeObserver(() => {
                const g = feezal.app.shadowRoot.querySelector('#grid');
                if (g && g.style.display !== 'none') this._positionGrid(g);
            });
            this._gridRO.observe(site);
        }

        const s = site.getBoundingClientRect();
        const r = cv.getBoundingClientRect();
        grid.style.top    = Math.round(s.top - r.top) + 'px';
        grid.style.left   = Math.round(s.left - r.left) + 'px';
        grid.style.width  = Math.round(s.width) + 'px';
        grid.style.height = Math.round(s.height) + 'px';

        const gs   = this.gridSize || 1;
        const view = feezal.view;
        const v    = view ? view.getBoundingClientRect() : s;
        const offX = (((v.left - s.left) % gs) + gs) % gs;
        const offY = (((v.top  - s.top)  % gs) + gs) % gs;
        grid.style.backgroundPosition = `${offX}px ${offY}px`;
    }

    _gridVisibleChanged(value) {
        const grid = feezal.app.shadowRoot.querySelector('#grid');
        if (grid) {
            grid.style.display = value ? 'block' : 'none';
            if (value) this._positionGrid(grid);
        }
    }

    _updateSelection() {
        // Don't disrupt an in-progress interact drag: re-reading the selection
        // from the DOM mid-gesture would reset selectedElems to [view] before
        // interact's onmove runs.
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

    /**
     * U41 — click-select + context menu on the canvas via composedPath. Works
     * for absolute (rubber band) AND flow/grid (interact.js reorder) views; the
     * click never depends on the drag machinery. Attached once per view element.
     */
    _attachCanvasSelection(view) {
        if (view._feezalSelectionWired) return;
        view._feezalSelectionWired = true;

        view.addEventListener('click', e => {
            // Ignore the synthetic click after a rubber-band / drag / reorder
            // gesture (which set _ignoreNextClick to keep the selection).
            if (this._ignoreNextClick) { this._ignoreNextClick = false; return; }

            const elem = e.composedPath().find(el => isCanvasElement(el) && el.feezalEditable);
            if (!elem) {
                this.selectElement();   // empty canvas → select the view
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

        view.addEventListener('contextmenu', e => {
            e.preventDefault();
            e.stopPropagation();
            const elem = e.composedPath().find(el => isCanvasElement(el) && el.feezalEditable);
            if (elem && !this.selectedElems.includes(elem)) {
                this.selectElement(elem);
            }
            const onElem = Boolean(elem) && !this.viewSelected;
            this._showCtxMenu(e.clientX, e.clientY, onElem);
        }, true);

        // U52: double-click on a component INSTANCE enters component edit
        // mode — the context-menu entry's discoverable sibling. Guarded on
        // feezal-component, so double-clicks on other element types (and on
        // plain elements inside edit mode) are untouched.
        view.addEventListener('dblclick', e => {
            const elem = e.composedPath().find(el => el.localName === 'feezal-component' && el.feezalEditable);
            if (!elem) return;
            e.preventDefault();
            e.stopPropagation();
            feezal.app._openComponentEdit(elem.getAttribute('name'));
        }, true);
    }

    /**
     * U41 — reorder an element within a flow view with **interact.js** (not
     * native HTML5 drag): the dragged tile is lifted out of flow (position:
     * fixed, following the pointer) while a placeholder holds its slot; moving
     * the placeholder among the siblings live-reflows the flex layout. Reorder
     * is DOM order (U33), committed to the dirty/undo pipeline on drop.
     *
     * U90 — grid views use this unchanged. The placeholder is sized from the
     * dragged tile's RENDERED rect, which in grid mode is its cell area, so it
     * claims the same span while the drag is in flight and the hit-test in
     * _flowMovePlaceholder stays valid (grid places in row-major order, like
     * flex, as long as `dense` is off).
     */
    initFlow(element) {
        // Flow tiles are laid out by the flex container, so an inline top/left
        // left over from absolute editing would offset them off their flex slot
        // (`position: relative`). B80: STASH those offsets rather than deleting
        // them — switching back to absolute used to pile every element at 0,0
        // because the originals were gone for good. The stash persists in
        // views.html and is stripped only at viewer/export delivery, so
        // absolute → flow → deploy → absolute round-trips losslessly.
        stashAbsoluteGeometry(element);
        element.style.removeProperty('top');
        element.style.removeProperty('left');
        // Props the drag lift temporarily overrides — captured on start and
        // restored on end so an AUTHORED width/height (e.g. set in the style
        // inspector) survives a drag instead of being wiped.
        const LIFT_PROPS = ['position', 'left', 'top', 'width', 'height', 'margin', 'z-index', 'pointer-events', 'opacity'];
        interact(element)
            .draggable({
                autoScroll: {enabled: true, container: feezal.site, speed: 300, margin: 40},
                listeners: {
                    start: () => {
                        if (!this.selectedElems.includes(element)) this.selectElement(element);
                        const r = element.getBoundingClientRect();
                        element._flowOrig = {};
                        for (const p of LIFT_PROPS) element._flowOrig[p] = element.style.getPropertyValue(p);
                        const ph = document.createElement('div');
                        ph.className = 'feezal-placeholder';
                        ph.style.cssText = `width:${Math.round(r.width)}px;height:${Math.round(r.height)}px;flex:0 0 auto;box-sizing:border-box;`;
                        element.parentElement.insertBefore(ph, element);
                        element._flowPh = ph;
                        element._flowPos = {x: r.left, y: r.top};
                        // U90: in a grid view the tile is normally stretched to
                        // its cell area (width/height forced to auto). The lift
                        // positions it fixed under the pointer, where it must
                        // carry its own pixel size again — this class is the
                        // stretch rule's exemption.
                        element.classList.add('feezal-lift');
                        Object.assign(element.style, {
                            position: 'fixed', left: `${r.left}px`, top: `${r.top}px`,
                            width: `${r.width}px`, height: `${r.height}px`,
                            margin: '0', zIndex: '9999', pointerEvents: 'none', opacity: '0.85'
                        });
                        this.dragElement = element;
                    },
                    move: event => {
                        const p = element._flowPos;
                        p.x += event.dx; p.y += event.dy;
                        element.style.left = `${p.x}px`;
                        element.style.top = `${p.y}px`;
                        this._flowMovePlaceholder(element, event.clientX, event.clientY);
                    },
                    end: () => {
                        const ph = element._flowPh;
                        if (ph && ph.parentElement) ph.parentElement.insertBefore(element, ph);
                        ph?.remove();
                        element._flowPh = null;
                        element.classList.remove('feezal-lift');   // U90
                        // Restore the authored inline values (top/left stay stripped).
                        const orig = element._flowOrig || {};
                        for (const p of LIFT_PROPS) {
                            if (orig[p]) element.style.setProperty(p, orig[p]);
                            else element.style.removeProperty(p);
                        }
                        element._flowOrig = null;
                        this.dragElement = null;
                        this._ignoreNextClick = true;
                        setTimeout(() => { this._ignoreNextClick = false; }, 50);
                        feezal.app.change();   // reorder = DOM order; dirty + undo history
                    }
                }
            })
            .resizable({
                // U41: flow tiles keep their own width/height and float — resizing
                // just adjusts the flex item's size (right/bottom edges + the left
                // handle), the row reflows. Components are fixed-size.
                enabled: element.localName !== 'feezal-component',
                edges: {right: true, bottom: true, left: '.resize-left', top: false},
                listeners: {
                    start: () => { this.resizeElement = element; },
                    move: event => {
                        if (event.rect.width > 10) element.style.width = `${Math.round(event.rect.width)}px`;
                        if (event.rect.height > 10) element.style.height = `${Math.round(event.rect.height)}px`;
                        this.shadowRoot.querySelector('feezal-sidebar-inspector-styles').setStyle(element, ['width', 'height']);
                    },
                    end: () => { this.resizeElement = null; feezal.app.change(); }
                }
            });
    }

    /** U41 — slot the flow placeholder before the sibling under the pointer (row-major). */
    _flowMovePlaceholder(dragged, cx, cy) {
        const view = dragged.parentElement;
        const ph = dragged._flowPh;
        if (!view || !ph) return;
        const sibs = [...view.children].filter(el =>
            el !== dragged && el !== ph && el.classList && el.classList.contains('feezal-editable'));
        let before = null;
        for (const el of sibs) {
            const r = el.getBoundingClientRect();
            if (cy < r.top + r.height / 2 || (cy < r.bottom && cx < r.left + r.width / 2)) { before = el; break; }
        }
        if (before) { if (ph.nextElementSibling !== before) view.insertBefore(ph, before); }
        else view.appendChild(ph);
    }

    /**
     * A38 — rubber-band selection for an absolute view.
     *
     * One instance, retargeted at the live view node. Everything the DragSelect
     * version needed here is gone with it: no per-view instance map, no
     * selectables to seed or re-seed, and no requestAnimationFrame deferral —
     * the band measures nothing until the gesture happens, so a view that is
     * still display:none at wire-up time cannot produce a dead selector area
     * (B2). See feezal-canvas-rubberband.js for how B2/B35/B48 dissolve.
     */
    _initRubberBand() {
        const view = feezal.getView(this.view);
        if (!view) return;

        if (!this._rubberBand) {
            this._rubberBand = new RubberBand({
                onSelection: () => {
                    this._updateSelection();
                    // Suppress the click that fires on pointerup after a band —
                    // it would otherwise clear the selection just made.
                    this._ignoreNextClick = true;
                    setTimeout(() => { this._ignoreNextClick = false; }, 50);
                },
                scrollContainer: () => feezal.site,
            });
        }

        // B48: the view ELEMENT under a name can be replaced (the component-edit
        // pseudo-view is destroyed on commit and recreated under the same name),
        // so always retarget rather than trusting a cached instance.
        this._rubberBand.bind(view);
        this._rubberBand.start();

        // Reliable click-selection via composedPath — shared with flow/grid
        // views, which have no rubber band. Attached once per view element.
        this._attachCanvasSelection(view);
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

        // A38: only the active view listens, and the single instance is
        // retargeted below — there is no longer a set of per-view instances
        // competing for the same pointer events to stop one by one.

        switch (view.childPosition) {
            case 'static':   // U41 — legacy alias, treated as flow
            case 'flow':
            case 'grid':     // U90 — reorders exactly like flow; only the
                             // container's placement algorithm differs.
                // Flow reorder is per-element interact.js (initFlow) — the view
                // only needs the shared click-selection / context menu.
                this._rubberBand?.stop();
                this._attachCanvasSelection(view);
                break;
            default:
                this._initRubberBand();
        }

        this.currentView = [view];
        [...view.children].forEach(element => {
            if (isCanvasElement(element) && !element.feezalEditable) {
                this.initElem(element);
            }
        });

        this.selectElement();
        this._observeChildPosition(view);
    }

    /**
     * B80 — re-init the canvas when the view's `child-position` flips while it
     * is on screen.
     *
     * Hooked with a MutationObserver rather than from the attribute editor: the
     * attribute can also change through the source view, undo/redo and history
     * restore, and all of those have to re-init too. One observer covers every
     * route into the same state change.
     */
    _observeChildPosition(view) {
        this._childPosObserver?.disconnect();
        if (!view || typeof MutationObserver !== 'function') return;
        this._childPosObserver = new MutationObserver(() => this.reinitChildPosition());
        this._childPosObserver.observe(view, {attributes: true, attributeFilter: ['child-position']});
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
                if (this._shortcutsOpen) this._shortcutsOpen = false;
                else this._openShortcutsRevealed();
                return;
            }

            // B99: a "delete the selected VIEW with Delete" path used to sit
            // here behind an unconditional `return` (dead since it was written)
            // because focus cannot be attributed reliably — a Delete pressed
            // anywhere outside a text field would have destroyed a whole view,
            // which is far too destructive for an ambiguous focus state.
            // Deleting a view stays an explicit act: the tab context menu.
            if (event.key === 'Delete' && this.viewSelected) return;

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
                        // U82: undo/redo are EDITOR-level actions, not element
                        // actions — this used to require an element selection
                        // (`!this.viewSelected`), so undo was dead in exactly
                        // the state the destructive operations leave behind:
                        // deleting an element (or pressing Escape) selects the
                        // view, and the deletion could then not be undone.
                        if (event.metaKey || event.ctrlKey) {
                            event.preventDefault();
                            if (event.shiftKey) feezal.app._redoStep();
                            else feezal.app._undo();
                        }

                        break;
                    case 'y':
                        // U82: the Windows redo idiom, same canvas-focus gate.
                        if (event.metaKey || event.ctrlKey) {
                            event.preventDefault();
                            feezal.app._redoStep();
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
                    // U33 — stacking order. Shift usually changes the key
                    // itself (Shift+] → "}"), so both spellings are handled.
                    case ']':
                    case '}':
                        if ((event.metaKey || event.ctrlKey) && !this.viewSelected) {
                            event.preventDefault();
                            this._reorderSelection(event.shiftKey || event.key === '}' ? 'front' : 'forward');
                        }

                        break;
                    case '[':
                    case '{':
                        if ((event.metaKey || event.ctrlKey) && !this.viewSelected) {
                            event.preventDefault();
                            this._reorderSelection(event.shiftKey || event.key === '{' ? 'back' : 'backward');
                        }

                        break;
                    case '?':
                        if (!event.metaKey && !event.ctrlKey) {
                            if (this._shortcutsOpen) this._shortcutsOpen = false;
                            else this._openShortcutsRevealed();
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

    /**
     * B43: open the shortcuts dialog AND make sure it can actually be seen.
     * The overlay renders inside this sidebar panel, which is display:none
     * whenever another sidebar tab is active or the sidebar is collapsed —
     * opening it there produced an invisible dialog and the ? button (and
     * Ctrl+I / ?) appeared dead. Reveal transiently: the tab choice is NOT
     * persisted, so the user's saved sidebar tab survives a reload.
     */
    _openShortcutsRevealed() {
        if (feezal.app) {
            feezal.app.sidebarVisible = true;
            feezal.app.sidebar = 'inspector';
        }
        this._shortcutsOpen = true;
    }

    _deleteElems() {
        // B18 no longer needs bookkeeping here: A38's rubber band queries the
        // DOM live at gesture end, so a removed node simply stops being found —
        // there is no selectables set left holding a stale reference.
        this.selectedElems.forEach(el => el.remove());
        // B18: don't leave an empty selection behind — select the active view
        // (exactly like a click on empty canvas), so the inspector shows the
        // view and the canvas/tab-bar state re-renders instead of going blank.
        this.selectElement(null);
        feezal.app.change();
    }

    _selectedElemsChanged() {
        // B18: the tab bar is #view-tabs (U8 folder-aware bar) — the old #tabs
        // selector matched nothing, so the view-selected tint never showed.
        const tabs = feezal.app.shadowRoot.querySelector('#view-tabs');
        if (tabs) {
            if (this.selectedElems.length === 1 && this.selectedElems[0].tagName === 'FEEZAL-VIEW') {
                tabs.style.setProperty('--tab-active-color', 'orange');
            } else {
                tabs.style.removeProperty('--tab-active-color');
            }
        }

        // Opt-in only: see selectElement(). A plain selection leaves the right
        // sidebar exactly where the user put it.
        if (this._revealInspector) feezal.app.sidebar = 'inspector';
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

    /**
     * U89 — draw the gap guides: per axis, the span the neighbour pair already
     * has and the equal one being proposed.
     *
     * The spans are positioned STATICALLY, on the cross-axis centre of the
     * neighbour that supplies the gap. An earlier version put them on the
     * dragged element's centre line, which meant they slid up and down with the
     * pointer while measuring something that was not moving — the annotation has
     * to stay put for the two spans to read as equal.
     *
     * B112 — both axes render at once. They used to share one pair of markers
     * and the axis "closest to the drag" claimed it, so on a position where both
     * proposals were live the two sets fought and flickered by whichever won
     * that frame. The axes already resolve independently in `_snap()`; the
     * annotation now does too, out of its own marker pool.
     *
     * B113 — every span end also gets a helper line across the whole canvas,
     * perpendicular to the arrow, so an arrow visibly terminates ON a line at a
     * right angle: "this span runs between these two edges". Ends are deduped —
     * the measured and proposed spans of a rhythm candidate can share one.
     *
     * Coordinate note: the markers live inside #container-view, so y is already
     * container-relative (boxes were built as `rect.y - cvTop`) while x needs
     * `viewLeftInCv` to get there.
     */
    _drawGapGuides(gapX, gapY, {viewLeftInCv = 0, viewTopInCv = 0, snapLineTop = 0} = {}) {
        const pool = selector => [...(feezal.container?.querySelectorAll(selector) || [])];
        const arrows = pool('.gap-arrow');
        const vlines = pool('.gap-vline');
        const hlines = pool('.gap-hline');
        if (!arrows.length) return;

        // Collected first, applied second: the pools are shared by both axes, so
        // nothing can be written until it is known how many each axis wants.
        const wantArrows = [];
        const wantVlines = [];
        const wantHlines = [];

        for (const [axis, best] of [['x', gapX], ['y', gapY]]) {
            if (!best) continue;
            const label = `${Math.round(best.gap)}`;
            const {anchor} = best;
            // Cross-axis centre of the anchor — where the annotation parks.
            const centre = axis === 'x'
                ? (anchor.top + anchor.bottom) / 2
                : (anchor.left + anchor.right) / 2 + viewLeftInCv;

            for (const span of [best.measured, best.proposed]) {
                const length = Math.max(0, span.to - span.from);
                wantArrows.push({
                    label,
                    vertical: axis === 'y',
                    css: axis === 'x'
                        ? `display:block;top:${centre}px;left:${span.from + viewLeftInCv}px;width:${length}px;`
                        : `display:block;left:${centre}px;top:${span.from}px;height:${length}px;width:0;`,
                });
            }

            // B116 — ONE helper line per axis, not one per span end.
            //
            // B113 drew all four ends, which is the complete "between which
            // edges" story — but the two arrows already tell that story, so the
            // other three lines were noise. The one that earns its place is the
            // dragged element's own edge: where the snap will actually put it.
            //
            // Which edge that is depends on the side the candidate proposes.
            // Placing AFTER the anchor, the dragged box's LEADING edge closes
            // the proposed gap (`proposed.to`); placing before it — or centring
            // between two — its TRAILING edge does (`proposed.from`). Either
            // way it is the end of the proposed span that belongs to the moving
            // element rather than to a stationary neighbour, so the proposed
            // arrow still terminates ON the line at 90°.
            const {proposed, side} = best;
            const at = Math.round(side === 'after' ? proposed.to : proposed.from);
            // U99: the readout is view-relative, which for y means undoing the
            // container offset the boxes were built with.
            if (axis === 'x') {
                wantVlines.push({
                    pos: `left: ${at}`,
                    css: `display:block;left:${at + viewLeftInCv}px;` +
                        `top:${snapLineTop}px;height:calc(100% - ${snapLineTop}px);`,
                });
            } else {
                wantHlines.push({
                    pos: `top: ${Math.round(at - viewTopInCv)}`,
                    css: `display:block;top:${at}px;`,
                });
            }
        }

        arrows.forEach((el, i) => {
            const want = wantArrows[i];
            if (!want) { el.style.display = 'none'; el.textContent = ''; el.classList.remove('vertical'); return; }
            el.classList.toggle('vertical', want.vertical);
            el.textContent = want.label;
            el.style.cssText = want.css;
        });
        const applyLines = (els, want) => els.forEach((el, i) => {
            el.style.cssText = want[i]?.css || 'display:none';
            el.dataset.pos = want[i]?.pos || '';
        });
        applyLines(vlines, wantVlines);
        applyLines(hlines, wantHlines);
    }

    _snap(x, y) {
        const effective = this._effectiveSnapping();
        if (effective === 'off') {
            return;
        }

        const view = feezal.getView(this.view);
        const viewRect = view.getBoundingClientRect();

        /**
         * B104 — is this element MOVING with the current gesture?
         *
         * A moving element must never be a snap target. For a single drag that
         * is just the dragged element; for a MULTI-selection drag the other
         * selected elements ride along via the group-move logic, so they are
         * moving too — leaving them in the target set made the group magnet
         * against its own members and jitter while being dragged.
         *
         * The rule is scoped to an active drag: outside one, a parked selection
         * is stationary and stays a perfectly good snap target.
         */
        const isMoving = element => element === this.resizeElement
            || element === this.dragElement
            || (Boolean(this.dragElement) && Boolean(this.selectedElems?.includes(element)));

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
        // B8 (related): vertical snap-line x positions are computed view-relative
        // below; the lines live in #container-view, whose origin differs from the
        // view origin by the canvas scroll offset (and view margin). Translate by
        // this delta when writing CSS `left`, or the lines drift by the scroll
        // amount on an oversized, scrolled canvas.
        const viewLeftInCv = viewRect.left - cvRect.left;
        // U99: the vertical twin, for the readout only. Horizontal guide positions
        // are carried in CONTAINER-relative y (`rect.y - cvTop`), but the label has
        // to show the number the element's `top` style uses — view-relative. Same
        // correction the B114 audit calls for: on a scrolled canvas the view origin
        // moves inside the container, and an uncorrected readout drifts with it.
        const viewTopInCv = viewRect.top - cvRect.top;
        // snapLineTop: how far down (in px, relative to #container-view) the vertical
        // snap lines should start — measured from the bottom of the tab menu bar so
        // the lines never bleed into the tab switcher.
        const menuBottom = feezal.app.shadowRoot.querySelector('#container-view-menu').getBoundingClientRect().bottom;
        const snapLineTop = Math.round(menuBottom - cvRect.top);

        const range = 24;

        // N11 — while dragging, track each of the four dragged sides independently
        // (left/right → vsnap1/vsnap2, top/bottom → hsnap1/hsnap2) so up to two
        // vertical and two horizontal guide lines can appear at once. interact.js
        // still snaps to a single position per axis: the closer side wins.
        if (this.dragElement) {
            const dr = this.dragElement.getBoundingClientRect();
            const w = dr.width, h = dr.height;
            const cxL = x - viewRect.x, cxR = x + w - viewRect.x;   // dragged left/right edges
            const cyT = y - cvTop,      cyB = y + h - cvTop;        // dragged top/bottom edges
            let L = {dist: range}, R = {dist: range}, T = {dist: range}, B = {dist: range};

            [...view.children].forEach(element => {
                if (!isCanvasElement(element) || isMoving(element)) {
                    return;
                }
                const rect = element.getBoundingClientRect();
                const tx = rect.x - viewRect.x, tr = tx + rect.width;
                const ty = rect.y - cvTop,      tb = ty + rect.height;
                let d;
                // Each dragged side snaps to the nearest matching other-element edge.
                d = Math.abs(cxL - tx); if (d < L.dist) L = {dist: d, pos: tx, target: tx + viewRect.x};
                d = Math.abs(cxL - tr); if (d < L.dist) L = {dist: d, pos: tr, target: tr + viewRect.x};
                d = Math.abs(cxR - tx); if (d < R.dist) R = {dist: d, pos: tx, target: tx + viewRect.x - w};
                d = Math.abs(cxR - tr); if (d < R.dist) R = {dist: d, pos: tr, target: tr + viewRect.x - w};
                d = Math.abs(cyT - ty); if (d < T.dist) T = {dist: d, pos: ty, target: ty + cvTop};
                d = Math.abs(cyT - tb); if (d < T.dist) T = {dist: d, pos: tb, target: tb + cvTop};
                d = Math.abs(cyB - ty); if (d < B.dist) B = {dist: d, pos: ty, target: ty + cvTop - h};
                d = Math.abs(cyB - tb); if (d < B.dist) B = {dist: d, pos: tb, target: tb + cvTop - h};
            });

            // Show/hide each guide line independently.
            // U99: each carries its view-relative position as `data-pos`; the CSS
            // renders it as the line's readout (see feezal-app-editor).
            const vLine = (el, t) => {
                el.style.cssText = t.dist < range
                    ? `left:${t.pos + viewLeftInCv - 1}px;display:block;top:${snapLineTop}px;height:calc(100% - ${snapLineTop}px)`
                    : 'display:none';
                el.dataset.pos = `left: ${Math.round(t.pos)}`;
            };
            const hLine = (el, t) => {
                el.style.cssText = t.dist < range
                    ? `top:${t.pos - 1.5}px;display:block`
                    : 'display:none';
                el.dataset.pos = `top: ${Math.round(t.pos - viewTopInCv)}`;
            };
            vLine(vsnap1, L); vLine(vsnap2, R);
            hLine(hsnap1, T); hLine(hsnap2, B);

            // U89 — equal-gap propagation. Another pass over the SAME sibling
            // measurements: instead of matching edges, match the gap a
            // neighbouring pair already has. Edge snapping wins ties, because an
            // exact alignment is a stronger intent than a rhythm.
            const draggedBox = {left: cxL, right: cxR, top: cyT, bottom: cyB};
            const laneBoxes = [...view.children]
                .filter(element => isCanvasElement(element) && !isMoving(element))
                .map(element => {
                    const r = element.getBoundingClientRect();
                    return {
                        left: r.x - viewRect.x, right: r.x + r.width - viewRect.x,
                        top: r.y - cvTop, bottom: r.y + r.height - cvTop,
                    };
                });
            const gapX = bestEqualGap(draggedBox, laneBoxes, 'x', {range});
            const gapY = bestEqualGap(draggedBox, laneBoxes, 'y', {range});
            this._drawGapGuides(gapX, gapY, {viewLeftInCv, viewTopInCv, snapLineTop});

            // interact.js snaps to one position per axis — the closer side wins.
            const object = {};
            let nearX = range, nearY = range;
            // U89: edge and equal-gap compete on DISTANCE — an edge that merely
            // happens to be in range must not beat a gap proposal three times
            // closer. Edges win an exact tie: aligning is a stronger intent
            // than continuing a rhythm.
            const xWin = L.dist <= R.dist ? L : R;
            if (xWin.dist < range && !(gapX && gapX.distance < xWin.dist)) {
                object.x = xWin.target; nearX = xWin.dist;
            } else if (gapX) {
                object.x = gapX.lead + viewRect.x; nearX = gapX.distance;
            }
            const yWin = T.dist <= B.dist ? T : B;
            if (yWin.dist < range && !(gapY && gapY.distance < yWin.dist)) {
                object.y = yWin.target; nearY = yWin.dist;
            } else if (gapY) {
                object.y = gapY.lead + cvTop; nearY = gapY.distance;
            }

            if (object.x !== undefined || object.y !== undefined) {
                object.range = (object.x !== undefined && object.y !== undefined)
                    ? Math.ceil(Math.sqrt(nearX * nearX + nearY * nearY)) + 1
                    : range;
                return object;
            }
            return;
        }

        // ── Resize / single-point path (winner-takes-all, unchanged) ──────────────
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

        // Track the nearest X and Y snaps across ALL corners × ALL elements.
        // nearX / nearY start at `range` so that only edges within range win.
        let nearX = range;
        let nearY = range;
        const object = {};
        let vsnapEl = null, vsnapOtherEl = null, vsnapPos;
        let hsnapEl = null, hsnapOtherEl = null, hsnapPos;

        [...view.children].forEach(element => {
            if (!isCanvasElement(element) || isMoving(element)) {
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

        // Show the winning snap line, hide the other in each axis. U99: same
        // view-relative readout as the drag path — a resize snaps to the same
        // edges and deserves the same annotation.
        if (vsnapEl) {
            vsnapEl.style.cssText = `left:${vsnapPos + viewLeftInCv - 1}px;display:block;top:${snapLineTop}px;height:calc(100% - ${snapLineTop}px)`;
            vsnapEl.dataset.pos = `left: ${Math.round(vsnapPos)}`;
            vsnapOtherEl.style.display = 'none';
        } else {
            vsnap1.style.display = 'none';
            vsnap2.style.display = 'none';
        }
        if (hsnapEl) {
            hsnapEl.style.cssText = `top:${hsnapPos - 1.5}px;display:block`;
            hsnapEl.dataset.pos = `top: ${Math.round(hsnapPos - viewTopInCv)}`;
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

        // Inject a glass overlay into the element's shadow root so that any
        // remaining pointer events cannot reach shadow-DOM internals.  This
        // complements the :host(.feezal-editable) * { pointer-events:none }
        // rule already present in feezal base-class styles.
        if (element.shadowRoot && !element.shadowRoot.querySelector('.feezal-glass-style')) {
            const glassStyle = document.createElement('style');
            glassStyle.className = 'feezal-glass-style';
            // U42: corner resize grip — shown when hovering a SELECTED element
            // (not on every hover: too noisy on a dense canvas), in the
            // selection-ring colour, exactly where the resize hit-area is.
            // Suppressed wherever resize is: component instances (fixed-size,
            // resizable disabled below) and flow children get no grip rule;
            // :not([locked]) tracks lock toggles live. Purely visual —
            // pointer-events none, the interact.js edges do the work.
            const resizableGrip = absolute && element.localName !== 'feezal-component';
            glassStyle.textContent =
                ':host(.feezal-editable)::after{content:"";position:absolute;inset:0;z-index:5;cursor:inherit;}' +
                (resizableGrip ? '\n:host(.feezal-editable.feezal-selected:not([locked]):hover)::before{' +
                    'content:"";position:absolute;right:0;bottom:0;width:12px;height:12px;z-index:6;' +
                    'pointer-events:none;' +
                    'background:linear-gradient(135deg,transparent 50%,rgba(var(--feezal-selection-rgb, 2,132,199),0.9) 50%);' +
                    '}' : '');
            element.shadowRoot.appendChild(glassStyle);
        }

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
                // Locked: still rubber-band selectable (it carries
                // .feezal-editable, which is what the band queries), just no
                // drag/resize interact wiring.
            } else {
                this.initAbsolute(element, elementOptions);
            }
        } else {
            this.initFlow(element);
        }
    }

    setLocked(element, locked) {
        if (locked) {
            interact(element).unset();
        } else {
            this.initAbsolute(element);
        }
    }


    /**
     * B8 — current canvas extent in view-content coordinates: the visible
     * view box extended to the farthest element edges. Snapshotted once per
     * drag (cached in _dragExtent, cleared in onstart/onend) so the dragged
     * element can never push the boundary along and grow the canvas.
     */
    _viewContentExtent() {
        const view = feezal.view;
        const vr = view.getBoundingClientRect();
        let right = vr.width;
        let bottom = vr.height;
        for (const el of view.children) {
            if (!isCanvasElement(el)) continue;
            const r = el.getBoundingClientRect();
            right = Math.max(right, r.right - vr.left);
            bottom = Math.max(bottom, r.bottom - vr.top);
        }
        return {right, bottom};
    }

    /**
     * B8 — drag boundary for the active view, in viewport coordinates.
     *
     * Per-axis branch on the view's sizing mode:
     * - Fixed px axis: clamp to the view's full LAYOUT size (offsetWidth/
     *   offsetHeight from the rect's left/top edge) so the far edge stays
     *   reachable independent of any canvas scroll state.
     * - Auto/percentage axis: the view box is only as large as the visible
     *   canvas while elements may live beyond it — clamp to the EXISTING
     *   canvas extent (box ∪ farthest element edges, snapshotted at drag
     *   start). Everything already reachable by scrolling stays reachable,
     *   but a drag never grows the canvas.
     * Bottom keeps a -1 guard while the content doesn't overflow the box
     * yet, so an element never lands exactly on the edge and triggers a
     * spurious scrollbar. left/top always clamp to the view origin.
     */
    _dragRestriction() {
        const view = feezal.view;
        const r = view.getBoundingClientRect();
        const fixedW = /^\d+(\.\d+)?px$/.test(view.style.width);
        const fixedH = /^\d+(\.\d+)?px$/.test(view.style.height);
        if (!this._dragExtent) {
            this._dragExtent = this._viewContentExtent();
        }
        const ext = this._dragExtent;
        const extBottom = ext.bottom - (ext.bottom <= view.offsetHeight ? 1 : 0);
        return {
            left: r.left,
            top: r.top,
            right: fixedW ? r.left + view.offsetWidth : r.left + ext.right,
            bottom: fixedH ? r.top + view.offsetHeight - 1 : r.top + extBottom
        };
    }

    /**
     * B114 — the page↔client seam for interact.js.
     *
     * interact works in PAGE coordinates (client + window scroll); every
     * measurement in this file comes from `getBoundingClientRect`, which is
     * CLIENT space. The two are identical while the page does not scroll — and
     * the editor shell is a fixed flex layout, so normally it does not. But an
     * UNDERSIZED window makes the shell overflow horizontally and the page
     * itself scrolls, and then both handoffs are off by exactly that amount:
     * measured with a 300px page scroll, the drag restriction let an element
     * land 300px past the view's left edge and snapping stopped engaging at
     * all (every distance inflated by 300, far outside the 24px range).
     *
     * Converted HERE rather than inside `_snap()` / `_dragRestriction()`: both
     * have other callers in client space — `_snapSize()` derives client
     * coordinates itself (interact hands size snapping plain width/height,
     * which carries no origin) and feeds them straight in. So the shared
     * implementations stay client-space and this is the one documented seam.
     */
    _snapForInteract(x, y) {
        const {scrollX, scrollY} = window;
        const snap = this._snap(x - scrollX, y - scrollY);
        if (!snap) return snap;
        if (snap.x !== undefined) snap.x += scrollX;
        if (snap.y !== undefined) snap.y += scrollY;
        return snap;
    }

    /** B114 — `_dragRestriction()` in the page coordinates interact expects. */
    _restrictionForInteract() {
        const {scrollX, scrollY} = window;
        const r = this._dragRestriction();
        return {
            left: r.left + scrollX, right: r.right + scrollX,
            top: r.top + scrollY, bottom: r.bottom + scrollY,
        };
    }

    initAbsolute(element) {
        // B80: coming back from flow, the element has no inline top/left —
        // restore what flow stashed, or fall back to where it is actually
        // rendered so nothing stacks in the corner.
        restoreAbsoluteGeometry(element);
        // A38: nothing to register — the rubber band finds elements by class at
        // gesture time, so there is no double-registration case to guard.

        interact(element)
            .draggable({
                restrict: {
                    // Always recompute — feezal.view moves in the viewport as the
                    // canvas container scrolls, so a cached rect would become stale.
                    // B114: …and in PAGE coordinates, which is what interact reads.
                    restriction: () => this._restrictionForInteract(),
                    elementRect: {top: 0, left: 0, bottom: 1, right: 1}
                },
                autoScroll: {
                    enabled: true,
                    container: feezal.site,
                    speed: 300,
                    margin: 40
                },
                snap: {
                    // B114: interact hands these PAGE coordinates and reads the
                    // returned target back as page coordinates too.
                    targets: [(x, y) => this._snapForInteract(x, y)],
                    relativePoints: [{x: 0, y: 0}]
                },
                onstart: event => {
                    this.dragElement = element;
                    // B8: fresh canvas-extent snapshot for this drag (the
                    // restriction closure caches it lazily on first use).
                    this._dragExtent = null;
                    // Use selectedElems (authoritative state) rather than the
                    // CSS class: the class is presentation, the array is truth.
                    if (!this.selectedElems.includes(element)) {
                        this.selectElement(element);
                    }
                    // Re-assert the outline on every selected element for the
                    // duration of the drag.
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
                    this._dragExtent = null;
                    this._drawGapGuides(null, null);   // U89
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
                // U32: component instances are fixed-size (the template's
                // bounding box) — resizing is disabled entirely for them.
                enabled: element.localName !== 'feezal-component',
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
                    hideSnapOverlays(feezal.container);
                }
            });
    }

    /**
     * @param {Element|Element[]|NodeList} [elems]  the new selection; falsy
     *        selects the current view.
     * @param {{revealInspector?: boolean}} [opts]  `revealInspector: true`
     *        switches the right sidebar to the Inspector.
     *
     * Selection NEVER moves the sidebar by default. Switching panels under
     * someone who is working in Layers, Themes or Assets is disorienting, and
     * a selection is not a request to go somewhere — it is how you point at
     * things. Only genuinely ADDING an element to the canvas opts in (palette
     * drop, asset drop), because a brand-new element is unconfigured and the
     * attribute panel is the obvious next stop. Duplicating, pasting and
     * component extraction deliberately do not: those produce already-
     * configured elements.
     */
    selectElement(elems, opts = {}) {
        this._revealInspector = opts.revealInspector === true;
        const view = feezal.getView(this.view);
        // B109: clear the class SITE-WIDE, not just within the active view.
        // Selecting an element on another view (the Layers tree does this, and
        // it switches the view first) used to leave the previous view's element
        // carrying `feezal-selected` — invisible on the canvas because that view
        // is hidden, but the Layers tree mirrors the class site-wide and showed
        // two selected rows. The stale class is latent state for anything else
        // reading selection across views, so it is cleared centrally here
        // rather than patched on the tree's path.
        const scope = feezal.site || view;
        [...scope.querySelectorAll('.feezal-selected')].forEach(el => el.classList.remove('feezal-selected'));

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
            // U33 — stacking order (DOM order = paint order; locked elements
            // may be restacked — reordering changes neither position nor size)
            case 'bringToFront':
            case 'bringForward':
            case 'sendBackward':
            case 'sendToBack':
                this._reorderSelection({
                    bringToFront: 'front', bringForward: 'forward',
                    sendBackward: 'backward', sendToBack: 'back'
                }[action]);
                break;
            // U32 — component actions
            case 'createComponent':
                feezal.app._openCreateComponent(this.selectedElems);
                break;
            case 'editComponent':
                feezal.app._openComponentEdit(this.selectedElems[0]?.getAttribute('name'));
                break;
            case 'detachComponent':
                feezal.app._detachComponent(this.selectedElems.filter(el => el.localName === 'feezal-component'));
                break;
            case 'renameComponent':
                feezal.app._componentRenameOpen(this.selectedElems[0]?.getAttribute('name'));
                break;
            case 'deleteComponent':
                feezal.app._componentDeleteRequest(this.selectedElems[0]?.getAttribute('name'));
                break;
        }
    }

    /** U33: reorder the selection in its view; one undo step on success. */
    _reorderSelection(direction) {
        const selection = this.selectedElems.filter(el => el.tagName !== 'FEEZAL-VIEW');
        if (!feezal.view || selection.length === 0) return;
        if (reorderElements(feezal.view, selection, direction)) {
            feezal.app.change();
            this.selectedElems = [...this.selectedElems];   // refresh menu state
        }
    }

    /**
     * U83: align / distribute / match-size the current selection.
     *
     * Geometry comes from the elements' RENDERED boxes (offsetLeft/Width),
     * not the inline style — an element can be sized by a class or a preset
     * and still has to line up. The engine returns only what changes; one
     * undo snapshot covers the whole operation, and locked elements are
     * skipped and reported.
     *
     * @param {string} op  an ALIGN_MODES entry, 'horizontal'|'vertical'
     *                     (distribute) or 'width'|'height'|'both' (match size)
     */
    _ctxAlign(op) {
        this._closeCtxMenu();
        if (!feezal.view || isFlowLike(feezal.view)) return;
        const selection = this.selectedElems.filter(el => el.tagName !== 'FEEZAL-VIEW');
        const movable = selection.filter(el => !el.hasAttribute('locked'));
        const skipped = selection.length - movable.length;
        if (movable.length < 2) return;

        const boxes = movable.map(el => ({
            id: el,
            left: el.offsetLeft, top: el.offsetTop,
            width: el.offsetWidth, height: el.offsetHeight,
        }));

        let patches;
        if (op === 'horizontal' || op === 'vertical') patches = distribute(boxes, op);
        else if (['width', 'height', 'both'].includes(op)) patches = matchSize(boxes, op);
        else patches = align(boxes, op);

        if (!patches.length) {
            feezal.app.toast?.(`Already ${op === 'both' ? 'the same size' : 'aligned'}`, {variant: 'info'});
            return;
        }

        for (const p of patches) {
            const el = p.id;
            if ('left' in p)   el.style.left = Math.round(p.left) + 'px';
            if ('top' in p)    el.style.top = Math.round(p.top) + 'px';
            if ('width' in p)  el.style.width = Math.round(p.width) + 'px';
            if ('height' in p) el.style.height = Math.round(p.height) + 'px';
        }
        // Reflect the new geometry in the Styles inspector, then ONE snapshot.
        this.shadowRoot.querySelector('feezal-sidebar-inspector-styles')
            ?.setStyle(this.selectedElems[0], ['left', 'top', 'width', 'height']);
        feezal.app.change();
        feezal.app.toast?.(operationLabel(op, patches.length, skipped), {variant: 'success'});
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

    // ── E115: switch an element to its twin in another family ────────────────
    // Map<functionKey, Map<family, tag>> over all installed feezal elements. The
    // pairing key is the tag-function (E138 standardised these across families;
    // E148 removed the last divergence, so FN_ALIAS is now empty).
    _familyFunctionMap() {
        const map = new Map();
        for (const pkg of (window.feezal?.elements || [])) {
            const tag = pkg.replace(/^@[^/]+\//, '');
            const m = /^feezal-element-([a-z0-9]+)-(.+)$/.exec(tag);
            if (!m) continue;
            const cls = window.customElements.get(tag);
            if (!cls?.feezal) continue;
            const family = m[1];
            const key = FN_ALIAS[m[2]] || m[2];
            if (!map.has(key)) map.set(key, new Map());
            map.get(key).set(family, tag);
        }
        return map;
    }

    // {family, key} for a canvas element from its tag, or null.
    _elemFunction(el) {
        const m = /^feezal-element-([a-z0-9]+)-(.+)$/.exec(el.localName || '');
        return m ? {family: m[1], key: FN_ALIAS[m[2]] || m[2]} : null;
    }

    // Target families for the current selection: any family (other than an
    // element's own) with a twin for at least one selected element, + the count
    // of selected elements that would switch to it.
    _switchFamilyTargets() {
        const map = this._familyFunctionMap();
        const counts = new Map();
        for (const el of this.selectedElems) {
            if (el.tagName === 'FEEZAL-VIEW' || el.localName === 'feezal-component') continue;
            const fn = this._elemFunction(el);
            const twins = fn && map.get(fn.key);
            if (!twins) continue;
            for (const family of twins.keys()) {
                if (family === fn.family) continue;
                counts.set(family, (counts.get(family) || 0) + 1);
            }
        }
        return [...counts.entries()]
            .map(([family, count]) => ({family, count}))
            .sort((a, b) => familyLabel(a.family).localeCompare(familyLabel(b.family)));
    }

    // Swap each selected element to its twin in `targetFamily`, carrying the
    // shared attribute contract + discovery-id + geometry, dropping the source
    // family's chrome and any orphan attributes (reported, never silent).
    _ctxSwitchFamily(targetFamily) {
        this._closeCtxMenu();
        const map = this._familyFunctionMap();
        const ALWAYS = new Set(['discovery-id', 'locked', 'data-group']);
        const newSel = [];
        const dropped = new Set();
        let switched = 0;
        let skipped = 0;

        for (const el of [...this.selectedElems]) {
            if (el.tagName === 'FEEZAL-VIEW' || el.localName === 'feezal-component') { skipped++; continue; }
            const fn = this._elemFunction(el);
            const targetTag = fn && map.get(fn.key)?.get(targetFamily);
            if (!targetTag || targetFamily === fn.family) { skipped++; continue; }
            const targetCls = window.customElements.get(targetTag);
            // Attribute descriptors are either a `{name}` object or a bare string.
            const declared = new Set((targetCls?.feezal?.attributes || [])
                .map(a => typeof a === 'string' ? a : a?.name).filter(Boolean));

            const swapped = document.createElement(targetTag);
            for (const attr of [...el.attributes]) {
                if (attr.name === 'style' || attr.name === 'class') continue;
                if (declared.has(attr.name) || ALWAYS.has(attr.name)) swapped.setAttribute(attr.name, attr.value);
                else dropped.add(attr.name);
            }
            el.replaceWith(swapped);          // in place — preserves DOM order / grouping
            this.initElem(swapped, true);     // applies the target family's defaultStyle
            // Preserve position + generic inline CSS; drop the source family's
            // --feezal-* chrome overrides (adopting the target look is the
            // point) AND its width/height — families differ in proportions, so
            // the twin starts at its own defaultStyle size (the old size is
            // deliberately not remembered for switching back).
            for (let i = 0; i < el.style.length; i++) {
                const p = el.style[i];
                if (p.startsWith('--feezal-') || p === 'width' || p === 'height') continue;
                swapped.style.setProperty(p, el.style.getPropertyValue(p));
            }
            newSel.push(swapped);
            switched++;
        }

        if (!switched) return;
        this.selectElement(newSel);
        feezal.app.change();   // whole batch = one undo entry

        const parts = [`Switched ${switched} to ${familyLabel(targetFamily)}`];
        if (skipped) parts.push(`${skipped} skipped (no ${familyLabel(targetFamily)} twin)`);
        if (dropped.size) parts.push(`dropped: ${[...dropped].sort().join(', ')}`);
        this._showSwitchReport(parts.join(' · '), dropped.size > 0);
    }

    _showSwitchReport(text, warn) {
        this._switchReport = {text, warn};
        if (this._switchReportTimer) clearTimeout(this._switchReportTimer);
        this._switchReportTimer = setTimeout(() => { this._switchReport = null; }, warn ? 9000 : 5000);
    }
}

window.customElements.define('feezal-sidebar-inspector', FeezalSidebarInspector);

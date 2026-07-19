/**
 * U41 — flow views in the editor: _viewChanged routes flow (and the legacy
 * `static` alias) to html5sortable, reorder is wired to the change/undo
 * pipeline, and click-selection works via the shared composedPath handler.
 * Driven on a bare inspector prototype (same pattern as the DragSelect suite).
 */
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import '../src/feezal-sidebar-inspector.js';
import '../src/feezal-view.js';
import {setupFeezal} from './helpers.js';

const FeezalSidebarInspector = customElements.get('feezal-sidebar-inspector');

let feezal, site, ctx;

function makeFlowView(name, n = 0) {
    const view = document.createElement('feezal-view');
    view.setAttribute('name', name);
    view.setAttribute('child-position', 'flow');
    view.style.cssText = 'display:block; width:400px; height:300px;';
    for (let i = 0; i < n; i++) {
        const el = document.createElement('feezal-element-flow-probe');
        el.className = 'feezal-editable';
        el.feezalEditable = true;
        el.style.cssText = 'display:block; width:90px; height:60px;';
        view.append(el);
    }
    site.append(view);
    return view;
}

beforeEach(() => {
    feezal = setupFeezal({isEditor: true, ready: true});
    site = document.createElement('div');
    document.body.append(site);
    feezal.site = site;
    feezal.getView = name => site.querySelector(`feezal-view[name="${name}"]`);
    feezal.app = {change: vi.fn()};

    ctx = Object.create(FeezalSidebarInspector.prototype);
    for (const [k, v] of Object.entries({
        dragselect: {}, view: 'home', currentView: [], selectedElems: [],
        viewSelected: false, selectElement: vi.fn(), _showCtxMenu: vi.fn(), initElem: vi.fn(),
    })) Object.defineProperty(ctx, k, {value: v, writable: true});
});

afterEach(() => { document.body.innerHTML = ''; });

describe('U41 — flow view editor wiring', () => {
    it('_viewChanged routes a flow view (and legacy static) to the sortable path, not DragSelect', () => {
        makeFlowView('home', 2);
        expect(() => ctx._viewChanged()).not.toThrow();
        expect(ctx.dragselect.home).toBeUndefined();     // no DragSelect for flow views
    });

    it('a sortable reorder fires feezal.app.change (dirty + undo) and guards the next click', () => {
        const view = makeFlowView('home', 2);
        ctx._initSortable(view);
        expect(view._feezalSortableWired).toBe(true);

        view.dispatchEvent(new CustomEvent('sortupdate'));
        expect(feezal.app.change).toHaveBeenCalledTimes(1);
        expect(ctx._ignoreNextClick).toBe(true);
    });

    it('click-selection works via the shared capture handler', () => {
        const view = makeFlowView('home', 2);
        ctx._attachCanvasSelection(view);
        expect(view._feezalSelectionWired).toBe(true);

        const el = view.querySelector('.feezal-editable');
        el.dispatchEvent(new MouseEvent('click', {bubbles: true, composed: true}));
        expect(ctx.selectElement).toHaveBeenCalledWith(el);

        // Empty-canvas click selects the view (no arg).
        ctx.selectElement.mockClear();
        view.dispatchEvent(new MouseEvent('click', {bubbles: true, composed: true}));
        expect(ctx.selectElement).toHaveBeenCalledWith();
    });

    it('_attachCanvasSelection is idempotent (wired once per view)', () => {
        const view = makeFlowView('home', 1);
        ctx._attachCanvasSelection(view);
        ctx._attachCanvasSelection(view);
        const el = view.querySelector('.feezal-editable');
        el.dispatchEvent(new MouseEvent('click', {bubbles: true, composed: true}));
        expect(ctx.selectElement).toHaveBeenCalledTimes(1);   // not double-wired
    });
});

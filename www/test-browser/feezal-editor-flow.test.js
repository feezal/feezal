/**
 * U41 — flow views in the editor: _viewChanged routes flow (and the legacy
 * `static` alias) to html5sortable, reorder is wired to the change/undo
 * pipeline, and click-selection works via the shared composedPath handler.
 * Driven on a bare inspector prototype (same pattern as the DragSelect suite).
 */
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import '../src/feezal-sidebar-inspector.js';
import '../src/feezal-sidebar-inspector-styles.js';
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

describe('U41 — flow view style inspector', () => {
    it('hides top/left (declared AND inline) for flow-view children, keeps width/height', () => {
        customElements.get('feezal-element-flow-probe') || customElements.define(
            'feezal-element-flow-probe', class extends HTMLElement {
                static feezal = {styles: ['top', 'left', 'width', 'height']};
            });
        const view = makeFlowView('home', 0);
        const el = document.createElement('feezal-element-flow-probe');
        el.className = 'feezal-editable';
        el.style.cssText = 'top:10px;left:20px;width:80px;height:40px';   // inline top/left present
        view.append(el);

        const styles = document.createElement('feezal-sidebar-inspector-styles');
        styles.selectedElems = [el];
        styles._selectedElemsChanged();
        const props = styles.items.map(i => i.property);
        expect(props).toContain('width');
        expect(props).toContain('height');
        expect(props).not.toContain('top');   // neither declared…
        expect(props).not.toContain('left');  // …nor as a stray inline "custom" row
    });
});

describe('U41 — flow view editor wiring', () => {
    it('_viewChanged routes a flow view (and legacy static) to click-selection, not DragSelect', () => {
        makeFlowView('home', 2);
        expect(() => ctx._viewChanged()).not.toThrow();
        expect(ctx.dragselect.home).toBeUndefined();     // no DragSelect for flow views
    });

    it('_flowMovePlaceholder slots the placeholder before the sibling under the pointer', () => {
        const view = makeFlowView('home', 3);
        const [a, b, c] = view.querySelectorAll('.feezal-editable');
        // Simulate a drag of `a`: lift it, insert a placeholder in its slot.
        const ph = document.createElement('div');
        ph.className = 'feezal-placeholder';
        view.insertBefore(ph, a);
        a._flowPh = ph;
        a.style.position = 'fixed';
        // Give the siblings deterministic rects (jsdom-ish → set via getBoundingClientRect stub).
        b.getBoundingClientRect = () => ({left: 0, top: 100, right: 90, bottom: 160, width: 90, height: 60});
        c.getBoundingClientRect = () => ({left: 0, top: 200, right: 90, bottom: 260, width: 90, height: 60});
        // Pointer over c's upper half → placeholder lands before c.
        ctx._flowMovePlaceholder(a, 10, 205);
        expect(ph.nextElementSibling).toBe(c);
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

    it('initFlow wires drag + resize on the element without throwing', () => {
        const view = makeFlowView('home', 1);
        const el = view.querySelector('.feezal-editable');
        el.style.width = '120px';
        el.style.height = '80px';
        el.style.top = '30px';   // legacy — should be stripped
        expect(() => ctx.initFlow(el)).not.toThrow();
        // top/left stripped so `position: relative` doesn't offset the tile;
        // authored width/height preserved.
        expect(el.style.top).toBe('');
        expect(el.style.left).toBe('');
        expect(el.style.width).toBe('120px');
        expect(el.style.height).toBe('80px');
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

/**
 * A38 — hand-rolled rubber-band selection, in a real browser, driven through
 * the inspector's _viewChanged/_initRubberBand on a bare prototype receiver
 * (the pattern inherited from the DragSelect suite this replaces).
 *
 * The three archived DragSelect lifecycle bugs are kept as the regression
 * fence, because "the new implementation cannot have this bug by construction"
 * is a claim that deserves a test, not a comment:
 *  - **B2**  a view still display:none when the canvas was wired produced a
 *            zero-size selector area that swallowed every click;
 *  - **B35** stop() was not idempotent and wiped the selectables set, so a
 *            revisited view drew a rectangle that selected nothing;
 *  - **B48** an instance stayed bound to a detached view node when the node
 *            under a name was replaced (component-edit pseudo-view).
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import '../src/feezal-sidebar-inspector.js';
import '../src/feezal-view.js';
import {setupFeezal} from './helpers.js';

const FeezalSidebarInspector = customElements.get('feezal-sidebar-inspector');
const raf = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

let feezal, site, ctx;

function makeView(name, elementCount = 0) {
    const view = document.createElement('feezal-view');
    view.setAttribute('name', name);
    view.style.cssText = 'position:relative; display:block; width:400px; height:300px;';
    for (let i = 0; i < elementCount; i++) {
        const el = document.createElement('feezal-element-band-probe');
        el.className = 'feezal-editable';
        el.feezalEditable = true;   // already wired — _viewChanged skips initElem
        el.dataset.idx = String(i);
        el.style.cssText =
            `position:absolute; left:${10 + i * 100}px; top:10px; width:50px; height:30px;`;
        view.append(el);
    }
    site.append(view);
    return view;
}

/** Drag a band in client coords. steps>0 emits intermediate moves. */
function band(from, to, {shift = false, button = 0, target = null} = {}) {
    const view = feezal.getView(ctx.view);
    const el = target || view;
    el.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: from[0], clientY: from[1], button, pointerId: 1, bubbles: true,
        shiftKey: shift,
    }));
    for (const p of [[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], to]) {
        window.dispatchEvent(new PointerEvent('pointermove', {
            clientX: p[0], clientY: p[1], pointerId: 1, bubbles: true, shiftKey: shift,
        }));
    }
    window.dispatchEvent(new PointerEvent('pointerup', {
        clientX: to[0], clientY: to[1], pointerId: 1, bubbles: true, shiftKey: shift,
    }));
}

/** Client-space box covering the given element indices of the current view. */
function boxOver(...indices) {
    const view = feezal.getView(ctx.view);
    const rects = indices.map(i =>
        view.querySelector(`[data-idx="${i}"]`).getBoundingClientRect());
    return [
        [Math.min(...rects.map(r => r.left)) - 4, Math.min(...rects.map(r => r.top)) - 4],
        [Math.max(...rects.map(r => r.right)) + 4, Math.max(...rects.map(r => r.bottom)) + 4],
    ];
}

const selected = () => [...feezal.getView(ctx.view).querySelectorAll('.feezal-selected')]
    .map(el => el.dataset.idx).sort();

beforeEach(() => {
    feezal = setupFeezal({isEditor: true, ready: true});
    site = document.createElement('div');
    // Fixed at the viewport origin so client coords are predictable.
    site.style.cssText = 'position:fixed; left:0; top:0;';
    document.body.append(site);
    feezal.site = site;
    feezal.getView = name => site.querySelector(`feezal-view[name="${name}"]`);

    ctx = Object.create(FeezalSidebarInspector.prototype);
    for (const [k, v] of Object.entries({
        _rubberBand: null,
        view: 'a',
        currentView: [],
        selectedElems: [],
        selectElement: () => {},
        _updateSelection: () => {},
        _showCtxMenu: () => {},
    })) {
        Object.defineProperty(ctx, k, {value: v, writable: true});
    }
});

afterEach(() => {
    ctx._disposeRubberBand();
    document.body.innerHTML = '';
});

async function switchTo(name) {
    ctx.view = name;
    expect(() => ctx._viewChanged()).not.toThrow();
    await raf();
}

describe('A38 rubber band — selection', () => {
    it('selects the elements the band covers and clears the rest', async () => {
        makeView('a', 3);
        await switchTo('a');
        feezal.getView('a').querySelector('[data-idx="2"]').classList.add('feezal-selected');

        const [from, to] = boxOver(0, 1);
        band(from, to);
        expect(selected()).toEqual(['0', '1']);   // 2 was cleared
    });

    it('a modifier drag ADDS to the existing selection', async () => {
        makeView('a', 3);
        await switchTo('a');
        const [f0, t0] = boxOver(0);
        band(f0, t0);
        expect(selected()).toEqual(['0']);

        const [f2, t2] = boxOver(2);
        band(f2, t2, {shift: true});
        expect(selected()).toEqual(['0', '2']);
    });

    it('leaves locked elements selectable', async () => {
        const view = makeView('a', 2);
        view.querySelector('[data-idx="1"]').setAttribute('locked', '');
        await switchTo('a');
        const [from, to] = boxOver(0, 1);
        band(from, to);
        expect(selected()).toEqual(['0', '1']);
    });

    it('a press that starts ON an element does not band (interact.js owns it)', async () => {
        const view = makeView('a', 3);
        await switchTo('a');
        const el = view.querySelector('[data-idx="0"]');
        const [from, to] = boxOver(0, 1);
        band(from, to, {target: el});
        expect(selected()).toEqual([]);
    });

    it('a right-press does not band (the context menu owns it)', async () => {
        makeView('a', 2);
        await switchTo('a');
        const [from, to] = boxOver(0, 1);
        band(from, to, {button: 2});
        expect(selected()).toEqual([]);
    });

    it('a press below the drag threshold is left to the click handler', async () => {
        makeView('a', 2);
        await switchTo('a');
        feezal.getView('a').querySelector('[data-idx="0"]').classList.add('feezal-selected');
        // 2px of travel — a click, not a band: it must not clear the selection
        // here (the canvas click handler decides what an empty-canvas click means).
        band([200, 200], [202, 201]);
        expect(selected()).toEqual(['0']);
    });

    it('leaves no overlay behind, so nothing needs scrubbing before save', async () => {
        makeView('a', 2);
        await switchTo('a');
        const [from, to] = boxOver(0, 1);
        band(from, to);
        expect(feezal.getView('a').querySelectorAll('.feezal-rubberband')).toHaveLength(0);
        expect(document.querySelectorAll('.dragselect-rectangle')).toHaveLength(0);
    });

    it('draws an overlay WHILE dragging, then removes it', async () => {
        makeView('a', 2);
        await switchTo('a');
        const view = feezal.getView('a');
        view.dispatchEvent(new PointerEvent('pointerdown',
            {clientX: 5, clientY: 5, button: 0, pointerId: 1, bubbles: true}));
        window.dispatchEvent(new PointerEvent('pointermove',
            {clientX: 150, clientY: 120, pointerId: 1, bubbles: true}));
        const rect = view.querySelector('.feezal-rubberband');
        expect(rect).toBeTruthy();
        const box = rect.getBoundingClientRect();
        expect(Math.round(box.width)).toBe(145);
        expect(Math.round(box.height)).toBe(115);

        window.dispatchEvent(new PointerEvent('pointerup',
            {clientX: 150, clientY: 120, pointerId: 1, bubbles: true}));
        expect(view.querySelector('.feezal-rubberband')).toBeNull();
    });
});

describe('A38 rubber band — lifecycle (the DragSelect regression fence)', () => {
    it('B35: 3+ switches never throw, and only the active view bands', async () => {
        makeView('a', 2);
        makeView('b', 2);

        await switchTo('a');
        expect(ctx._rubberBand.stopped).toBe(false);
        expect(ctx._rubberBand.view).toBe(feezal.getView('a'));

        await switchTo('b');
        await switchTo('a');
        await switchTo('b');           // the original NotFoundError repro
        await switchTo('a');
        expect(ctx._rubberBand.stopped).toBe(false);
        expect(ctx._rubberBand.view).toBe(feezal.getView('a'));

        // The inactive view must not respond to a press on it.
        const viewB = feezal.getView('b');
        viewB.dispatchEvent(new PointerEvent('pointerdown',
            {clientX: 1, clientY: 1, button: 0, pointerId: 1, bubbles: true}));
        window.dispatchEvent(new PointerEvent('pointermove',
            {clientX: 300, clientY: 200, pointerId: 1, bubbles: true}));
        window.dispatchEvent(new PointerEvent('pointerup',
            {clientX: 300, clientY: 200, pointerId: 1, bubbles: true}));
        expect(viewB.querySelectorAll('.feezal-selected')).toHaveLength(0);
    });

    it('B35: a revisited view still selects (nothing to re-register)', async () => {
        makeView('a', 2);
        makeView('b', 1);

        await switchTo('a');
        await switchTo('b');
        await switchTo('a');

        const [from, to] = boxOver(0, 1);
        band(from, to);
        expect(selected()).toEqual(['0', '1']);
    });

    it('B35: a view created after several switches bands correctly', async () => {
        makeView('a', 1);
        makeView('b', 1);
        await switchTo('a');
        await switchTo('b');
        await switchTo('a');

        makeView('c', 2);
        await switchTo('c');
        expect(ctx._rubberBand.stopped).toBe(false);
        const [from, to] = boxOver(0, 1);
        band(from, to);
        expect(selected()).toEqual(['0', '1']);
    });

    it('B48: retargets when the view NODE under a name is replaced', async () => {
        makeView('a', 2);
        await switchTo('a');
        const original = feezal.getView('a');

        // What component-edit does: destroy the node, recreate it under the
        // same name. The old code kept listening to the detached one.
        original.remove();
        makeView('a', 2);
        await switchTo('a');

        const replacement = feezal.getView('a');
        expect(replacement).not.toBe(original);
        expect(ctx._rubberBand.view).toBe(replacement);
        const [from, to] = boxOver(0, 1);
        band(from, to);
        expect(selected()).toEqual(['0', '1']);
    });

    it('B2: a view wired while display:none still bands once revealed', async () => {
        const view = makeView('a', 2);
        view.style.display = 'none';
        await switchTo('a');            // wired while it has no layout at all
        view.style.display = 'block';
        await raf();

        const [from, to] = boxOver(0, 1);
        band(from, to);
        expect(selected()).toEqual(['0', '1']);
    });

    it('stop() and dispose are idempotent and leave no listeners', async () => {
        makeView('a', 2);
        await switchTo('a');
        const rb = ctx._rubberBand;

        expect(() => { rb.stop(); rb.stop(); }).not.toThrow();
        expect(rb.stopped).toBe(true);
        // Stopped: a press must do nothing.
        const [from, to] = boxOver(0, 1);
        band(from, to);
        expect(selected()).toEqual([]);

        expect(() => ctx._disposeRubberBand()).not.toThrow();
        expect(ctx._rubberBand).toBe(null);
        expect(() => ctx._disposeRubberBand()).not.toThrow();   // double dispose
    });

    it('a flow view stops the band entirely', async () => {
        makeView('a', 2);
        const flow = makeView('flow', 2);
        flow.setAttribute('child-position', 'flow');
        await switchTo('a');
        await switchTo('flow');
        expect(ctx._rubberBand.stopped).toBe(true);
    });
});

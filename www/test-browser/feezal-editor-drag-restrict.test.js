/**
 * B8 — drag boundaries on oversized views + snap-line positioning under
 * canvas scroll. Real layout in Chromium: a scrollable fake canvas
 * (container-view > site > view) with the inspector's methods invoked on a
 * bare prototype receiver, exactly like the app wires them.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import '../src/feezal-sidebar-inspector.js';
import {setupFeezal} from './helpers.js';

const FeezalSidebarInspector = customElements.get('feezal-sidebar-inspector');

let feezal;
let cv, menu, site, view;

/** container-view (fixed 400×300 at 50,40) > site (scroller) > view. */
function buildCanvas({viewWidth, viewHeight}) {
    cv = document.createElement('div');
    cv.style.cssText = 'position:fixed; left:50px; top:40px; width:400px; height:300px; overflow:hidden;';
    menu = document.createElement('div');
    menu.style.cssText = 'position:absolute; left:0; top:0; width:100%; height:30px;';
    cv.append(menu);
    for (const id of ['vsnap1', 'vsnap2', 'hsnap1', 'hsnap2']) {
        const line = document.createElement('div');
        line.id = id;
        line.style.cssText = 'position:absolute; display:none;';
        cv.append(line);
    }
    site = document.createElement('div');
    site.style.cssText = 'position:absolute; inset:0; overflow:auto;';
    view = document.createElement('div');
    view.style.cssText = `position:relative; width:${viewWidth}; height:${viewHeight}; flex:none;`;
    site.append(view);
    cv.append(site);
    document.body.append(cv);

    feezal.view = view;
    feezal.container = cv;
    feezal.getView = () => view;
    feezal.app = {shadowRoot: {querySelector: sel => (sel === '#container-view' ? cv : menu)}};
    return view;
}

function inspectorCtx(props = {}) {
    const ctx = Object.create(FeezalSidebarInspector.prototype);
    for (const [k, v] of Object.entries({
        snapping: 'elements', gridSize: 20, view: 'home',
        dragElement: null, resizeElement: null,
        _shiftDown: false, _ctrlDown: false,
        ...props
    })) {
        Object.defineProperty(ctx, k, {value: v, writable: true});
    }
    return ctx;
}

function addElement(left, top, width, height) {
    const el = document.createElement('feezal-element-test-b8');
    el.style.cssText = `position:absolute; display:block; left:${left}px; top:${top}px; width:${width}px; height:${height}px;`;
    view.append(el);
    return el;
}

beforeEach(() => {
    feezal = setupFeezal();
});

afterEach(() => {
    cv?.remove();
});

describe('B8 — _dragRestriction()', () => {
    it('fixed view: spans the full layout size regardless of canvas scroll', () => {
        buildCanvas({viewWidth: '1000px', viewHeight: '800px'});
        const ctx = inspectorCtx();

        const before = ctx._dragRestriction();
        expect(before.right - before.left).toBe(1000);
        expect(before.bottom - before.top).toBe(799);   // -1 spurious-scrollbar guard

        site.scrollLeft = 200;
        site.scrollTop = 150;
        const after = ctx._dragRestriction();
        // Origin shifts with the scroll, the span must not shrink.
        expect(after.left).toBeCloseTo(before.left - 200, 0);
        expect(after.top).toBeCloseTo(before.top - 150, 0);
        expect(after.right - after.left).toBe(1000);
        expect(after.bottom - after.top).toBe(799);
    });

    it('auto/percentage view: no upper clamp at all', () => {
        buildCanvas({viewWidth: '100%', viewHeight: '100%'});
        const ctx = inspectorCtx();
        const r = ctx._dragRestriction();
        expect(r.right - r.left).toBe(1e6);
        expect(r.bottom - r.top).toBe(1e6);
        // Origin still clamps to the view's top-left.
        const rect = view.getBoundingClientRect();
        expect(r.left).toBeCloseTo(rect.left, 0);
        expect(r.top).toBeCloseTo(rect.top, 0);
    });

    it('mixed: fixed width clamps, auto height stays open', () => {
        buildCanvas({viewWidth: '640px', viewHeight: '100%'});
        const ctx = inspectorCtx();
        const r = ctx._dragRestriction();
        expect(r.right - r.left).toBe(640);
        expect(r.bottom - r.top).toBe(1e6);
    });
});

describe('B8 — vertical snap lines under horizontal canvas scroll', () => {
    function snapAt(ctx, xViewport, yViewport) {
        return ctx._snap(xViewport, yViewport);
    }

    it('draws the guide container-relative when the site is scrolled right', () => {
        buildCanvas({viewWidth: '1000px', viewHeight: '800px'});
        const target = addElement(500, 100, 100, 50);
        const dragged = addElement(10, 400, 80, 40);
        const ctx = inspectorCtx({dragElement: dragged});

        site.scrollLeft = 200;
        const targetX = target.getBoundingClientRect().left;   // viewport x of the snap edge

        // Drag TL corner 5px right of the target's left edge, vertically far
        // from any horizontal edge.
        const snap = snapAt(ctx, targetX + 5, 600);
        expect(snap).toBeTruthy();
        expect(snap.x).toBeCloseTo(targetX, 0);   // snaps the element to the edge

        const vsnap1 = cv.querySelector('#vsnap1');
        expect(vsnap1.style.display).toBe('block');
        // The guide line lives inside #container-view — container-relative x.
        const expectedLeft = targetX - cv.getBoundingClientRect().left - 1;
        expect(parseFloat(vsnap1.style.left)).toBeCloseTo(expectedLeft, 0);
    });

    it('unscrolled canvas keeps the previous line position (regression guard)', () => {
        buildCanvas({viewWidth: '1000px', viewHeight: '800px'});
        const target = addElement(500, 100, 100, 50);
        const dragged = addElement(10, 400, 80, 40);
        const ctx = inspectorCtx({dragElement: dragged});

        const targetX = target.getBoundingClientRect().left;
        const snap = snapAt(ctx, targetX + 5, 600);
        expect(snap).toBeTruthy();

        const vsnap1 = cv.querySelector('#vsnap1');
        const expectedLeft = targetX - cv.getBoundingClientRect().left - 1;
        expect(parseFloat(vsnap1.style.left)).toBeCloseTo(expectedLeft, 0);
    });
});

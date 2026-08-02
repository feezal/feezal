/**
 * feezal-sidebar-inspector — the canvas rules, without the canvas.
 *
 * The inspector owns drag/resize/selection, so most of it needs interact.js
 * and real layout. What is unit-testable — and what has historically produced
 * user-visible bugs (B8 far-edge drag, B9/B20 snapping) — are the *rules*
 * around that machinery:
 *
 *  - which snapping mode is active for a given modifier combination,
 *  - where the grid rounds a coordinate to, and how wide the snap range is,
 *  - the drag boundary, which branches per axis on whether the view is sized
 *    in fixed px or auto/percent (B8),
 *  - selection bookkeeping and the events it fires,
 *  - the context-menu open/close listener lifecycle, which leaked handlers
 *    before it kept a reference to the one it registered.
 *
 * Element rects are stubbed, so these pin the arithmetic and the branching,
 * not the layout engine.
 */
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../src/feezal-sidebar-inspector.js';

/** A stand-in canvas element with a controllable rect. */
function makeEl(tag, rect) {
    const el = document.createElement(tag);
    el.getBoundingClientRect = () => ({
        x: rect.x, y: rect.y, left: rect.x, top: rect.y,
        width: rect.w, height: rect.h,
        right: rect.x + rect.w, bottom: rect.y + rect.h,
    });
    return el;
}

/** A feezal-view whose rect, layout size and style sizing are all controlled. */
function makeView({x = 0, y = 0, w = 800, h = 600, styleWidth = '800px', styleHeight = '600px',
    offsetWidth = 800, offsetHeight = 600, children = []} = {}) {
    const view = makeEl('feezal-view', {x, y, w, h});
    view.setAttribute('name', 'home');
    view.style.width = styleWidth;
    view.style.height = styleHeight;
    Object.defineProperty(view, 'offsetWidth', {value: offsetWidth, configurable: true});
    Object.defineProperty(view, 'offsetHeight', {value: offsetHeight, configurable: true});
    children.forEach(c => view.append(c));
    return view;
}

function makeInspector(view) {
    const el = document.createElement('feezal-sidebar-inspector');
    el.view = 'home';
    window.feezal = {
        view,
        views: [view],
        getView: () => view,
        site: null,
        isEditor: true,
        // _selectedElemsChanged() tints the view-tab bar through the app shell.
        app: {shadowRoot: {querySelector: () => null}},
    };
    return el;
}

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { vi.restoreAllMocks(); });

describe('_effectiveSnapping — modifier overrides', () => {
    const modes = (base, shift, ctrl) => {
        const el = makeInspector(makeView());
        el.snapping = base;
        el._shiftDown = shift;
        el._ctrlDown = ctrl;
        return el._effectiveSnapping();
    };

    it('passes the configured mode through with no modifier', () => {
        expect(modes('grid', false, false)).toBe('grid');
        expect(modes('elements', false, false)).toBe('elements');
        expect(modes('off', false, false)).toBe('off');
    });

    it('shift swaps grid ⇄ elements, and turns off into grid', () => {
        expect(modes('grid', true, false)).toBe('elements');
        expect(modes('elements', true, false)).toBe('grid');
        expect(modes('off', true, false)).toBe('grid');
    });

    it('ctrl disables an active mode and enables elements when off', () => {
        expect(modes('grid', false, true)).toBe('off');
        expect(modes('elements', false, true)).toBe('off');
        expect(modes('off', false, true)).toBe('elements');
    });

    it('shift wins over ctrl when both are held', () => {
        expect(modes('grid', true, true)).toBe('elements');
    });
});

describe('_snap — grid mode', () => {
    it('rounds to the nearest grid multiple, relative to the view origin', () => {
        const el = makeInspector(makeView({x: 100, y: 50}));
        el.snapping = 'grid';
        el.gridSize = 20;
        // x: 112 is 12 into the view → nearest multiple of 20 is 20 → 120 absolute.
        // y:  58 is  8 into the view → rounds back to 0 → the view origin, 50.
        expect(el._snap(112, 58)).toMatchObject({x: 120, y: 50});
        // Both just past the half-step → both round up.
        expect(el._snap(111, 61)).toMatchObject({x: 120, y: 70});
    });

    it('derives the snap range from the grid size', () => {
        const el = makeInspector(makeView());
        el.snapping = 'grid';
        el.gridSize = 25;
        expect(el._snap(0, 0).range).toBe(10);          // floor(25 / 2.5)
    });

    it('returns nothing at all when snapping is off', () => {
        const el = makeInspector(makeView());
        el.snapping = 'off';
        expect(el._snap(37, 41)).toBeUndefined();
    });
});

describe('_snapSize — resize snapping is expressed as width/height', () => {
    it('converts a snapped corner into a size delta from the element origin', () => {
        const view = makeView({x: 0, y: 0});
        const el = makeInspector(view);
        el.snapping = 'grid';
        el.gridSize = 10;
        el.resizeElement = makeEl('feezal-element-basic-number', {x: 30, y: 40, w: 50, h: 20});
        // Corner offset (52, 33) from an element at (30, 40) → absolute (82, 73)
        // → snaps to (80, 70) → size becomes 80-30 = 50, 70-40 = 30.
        expect(el._snapSize(52, 33)).toMatchObject({width: 50, height: 30});
    });

    it('does nothing without a resize target', () => {
        const el = makeInspector(makeView());
        el.snapping = 'grid';
        el.gridSize = 10;
        el.resizeElement = null;
        expect(el._snapSize(10, 10)).toBeUndefined();
    });
});

describe('_viewContentExtent — the canvas the content actually occupies', () => {
    it('is the view box when nothing overflows it', () => {
        const el = makeInspector(makeView({w: 800, h: 600}));
        expect(el._viewContentExtent()).toEqual({right: 800, bottom: 600});
    });

    it('grows to the farthest element edge', () => {
        const child = makeEl('feezal-element-basic-number', {x: 700, y: 500, w: 400, h: 300});
        const el = makeInspector(makeView({w: 800, h: 600, children: [child]}));
        expect(el._viewContentExtent()).toEqual({right: 1100, bottom: 800});
    });

    it('ignores non-canvas children', () => {
        const decoration = makeEl('div', {x: 0, y: 0, w: 5000, h: 5000});
        const el = makeInspector(makeView({w: 800, h: 600, children: [decoration]}));
        expect(el._viewContentExtent()).toEqual({right: 800, bottom: 600});
    });
});

describe('_dragRestriction — B8, per-axis on the view sizing mode', () => {
    it('a fixed-px view clamps to its full layout size, not its scrolled rect', () => {
        // Rect is narrower than the layout size — the canvas is scrolled.
        const el = makeInspector(makeView({
            x: 10, y: 20, w: 300, h: 200,
            styleWidth: '800px', styleHeight: '600px', offsetWidth: 800, offsetHeight: 600,
        }));
        expect(el._dragRestriction()).toEqual({
            left: 10, top: 20,
            right: 10 + 800,
            bottom: 20 + 600 - 1,          // -1 so it can't touch the edge
        });
    });

    it('a percentage-sized view clamps to the EXISTING content extent, so a drag never grows the canvas', () => {
        const child = makeEl('feezal-element-basic-number', {x: 0, y: 0, w: 1000, h: 900});
        const el = makeInspector(makeView({
            x: 0, y: 0, w: 800, h: 600,
            styleWidth: '100%', styleHeight: '100%', offsetWidth: 800, offsetHeight: 600,
            children: [child],
        }));
        const r = el._dragRestriction();
        expect(r.right).toBe(1000);        // the element's far edge, not the box
        expect(r.bottom).toBe(900);        // content overflows → no -1 guard
    });

    it('keeps the -1 guard while the content still fits, so no spurious scrollbar', () => {
        const el = makeInspector(makeView({
            x: 0, y: 0, w: 800, h: 600,
            styleWidth: '100%', styleHeight: '100%', offsetWidth: 800, offsetHeight: 600,
        }));
        expect(el._dragRestriction().bottom).toBe(599);
    });

    it('snapshots the extent once per drag', () => {
        const el = makeInspector(makeView({styleWidth: '100%', styleHeight: '100%'}));
        const spy = vi.spyOn(el, '_viewContentExtent');
        el._dragRestriction();
        el._dragRestriction();
        expect(spy).toHaveBeenCalledTimes(1);
    });
});

/**
 * B112/B113 — the gap guides, drawn from candidates the U89 geometry produced.
 *
 * The e2e suite proves this against a real drag; this pins the arithmetic that
 * decides how many markers light up and where, which is where the two bugs were:
 * one pair of markers shared by both axes (B112), and no helper lines at all
 * (B113).
 */
describe('_drawGapGuides — both axes, plus the helper lines', () => {
    /** Marker pools, as feezal-app-editor renders them. */
    function makeContainer() {
        const root = document.createElement('div');
        const add = (cls, n) => Array.from({length: n}, () => {
            const el = document.createElement('div');
            el.className = cls;
            root.append(el);
            return el;
        });
        return {root, arrows: add('gap-arrow', 4), vlines: add('gap-vline', 4), hlines: add('gap-hline', 4)};
    }

    const candidate = ({gap, measured, proposed, anchor}) => ({gap, measured, proposed, anchor, distance: 3});
    const shown = els => els.filter(el => el.style.display === 'block');

    let container;
    beforeEach(() => { container = makeContainer(); });

    /** makeInspector() replaces window.feezal wholesale, so the pools go in after. */
    function inspector() {
        const el = makeInspector(makeView());
        window.feezal.container = container.root;
        return el;
    }

    const gapX = candidate({
        gap: 50, anchor: {left: 150, right: 250, top: 0, bottom: 100},
        measured: {from: 100, to: 150}, proposed: {from: 250, to: 300},
    });
    const gapY = candidate({
        gap: 50, anchor: {left: 300, right: 400, top: 100, bottom: 150},
        measured: {from: 50, to: 100}, proposed: {from: 150, to: 200},
    });

    it('draws BOTH axes at once — they no longer share one pair of markers', () => {
        const el = inspector();
        el._drawGapGuides(gapX, gapY, 0, 35);

        const arrows = shown(container.arrows);
        expect(arrows).toHaveLength(4);
        expect(arrows.filter(a => a.classList.contains('vertical'))).toHaveLength(2);
        expect(arrows.filter(a => !a.classList.contains('vertical'))).toHaveLength(2);
        expect(arrows.every(a => a.textContent === '50')).toBe(true);
    });

    it('puts a helper line at every distinct span end, per axis', () => {
        const el = inspector();
        el._drawGapGuides(gapX, gapY, 0, 35);
        // x ends 100/150/250/300 → four verticals; y ends 50/100/150/200 → four horizontals.
        expect(shown(container.vlines)).toHaveLength(4);
        expect(shown(container.hlines)).toHaveLength(4);
        expect(shown(container.vlines).map(l => l.style.left))
            .toEqual(['100px', '150px', '250px', '300px']);
        expect(shown(container.hlines).map(l => l.style.top))
            .toEqual(['50px', '100px', '150px', '200px']);
    });

    it('dedupes an end the two spans share', () => {
        // A centred candidate whose proposed span starts where the measured one ends.
        const touching = candidate({
            gap: 20, anchor: {left: 0, right: 100, top: 0, bottom: 50},
            measured: {from: 100, to: 120}, proposed: {from: 120, to: 140},
        });
        const el = inspector();
        el._drawGapGuides(touching, null, 0, 35);
        expect(shown(container.vlines).map(l => l.style.left)).toEqual(['100px', '120px', '140px']);
    });

    it('translates x by the canvas scroll delta, y is already container-relative', () => {
        const el = inspector();
        el._drawGapGuides(gapX, gapY, 40, 35);
        expect(shown(container.vlines)[0].style.left).toBe('140px');   // 100 + 40
        expect(shown(container.hlines)[0].style.top).toBe('50px');     // unchanged
    });

    it('clears every marker when there is nothing to propose', () => {
        const el = inspector();
        el._drawGapGuides(gapX, gapY, 0, 35);
        el._drawGapGuides(null, null);
        expect(shown(container.arrows)).toHaveLength(0);
        expect(shown(container.vlines)).toHaveLength(0);
        expect(shown(container.hlines)).toHaveLength(0);
        expect(container.arrows.every(a => a.textContent === '')).toBe(true);
    });
});

/**
 * B114 — the page↔client seam.
 *
 * interact.js works in PAGE coordinates; every measurement in the inspector
 * comes from getBoundingClientRect, which is CLIENT space. Identical until the
 * page itself scrolls — which an undersized editor window makes it do — and
 * then snapping and the drag restriction were both off by exactly the scroll.
 *
 * Tested here rather than only in the browser because the vertical half cannot
 * be held still in a real drag: pulling the pointer toward the top of the window
 * makes the browser re-scroll the page mid-gesture.
 */
describe('B114 — page↔client conversion at the interact boundary', () => {
    const withScroll = (x, y, fn) => {
        const [ox, oy] = [window.scrollX, window.scrollY];
        Object.defineProperty(window, 'scrollX', {value: x, configurable: true});
        Object.defineProperty(window, 'scrollY', {value: y, configurable: true});
        try {
            return fn();
        } finally {
            Object.defineProperty(window, 'scrollX', {value: ox, configurable: true});
            Object.defineProperty(window, 'scrollY', {value: oy, configurable: true});
        }
    };

    it('shifts the query into client space and the answer back into page space', () => {
        const el = makeInspector(makeView());
        el._snap = vi.fn(() => ({x: 100, y: 200, range: 24}));

        const out = withScroll(300, 150, () => el._snapForInteract(340, 170));
        // asked in client space…
        expect(el._snap).toHaveBeenCalledWith(40, 20);
        // …answered in page space
        expect(out).toEqual({x: 400, y: 350, range: 24});
    });

    it('leaves an axis alone when that axis did not snap', () => {
        const el = makeInspector(makeView());
        el._snap = vi.fn(() => ({y: 200, range: 24}));
        const out = withScroll(300, 150, () => el._snapForInteract(340, 170));
        expect(out.x).toBeUndefined();
        expect(out.y).toBe(350);
    });

    it('passes a no-snap result straight through', () => {
        const el = makeInspector(makeView());
        el._snap = () => undefined;
        expect(withScroll(300, 150, () => el._snapForInteract(340, 170))).toBeUndefined();
    });

    it('is the identity while the page is not scrolled — the normal case', () => {
        const el = makeInspector(makeView());
        el._snap = vi.fn(() => ({x: 100, y: 200, range: 24}));
        const out = withScroll(0, 0, () => el._snapForInteract(340, 170));
        expect(el._snap).toHaveBeenCalledWith(340, 170);
        expect(out).toEqual({x: 100, y: 200, range: 24});
    });

    it('offsets the restriction rect on both axes', () => {
        const el = makeInspector(makeView({
            x: 10, y: 20, w: 800, h: 600,
            styleWidth: '800px', styleHeight: '600px', offsetWidth: 800, offsetHeight: 600,
        }));
        const client = el._dragRestriction();
        const page = withScroll(300, 150, () => el._restrictionForInteract());
        expect(page).toEqual({
            left: client.left + 300, right: client.right + 300,
            top: client.top + 150, bottom: client.bottom + 150,
        });
    });
});

describe('selection', () => {
    it('selecting nothing selects the view itself and announces it', () => {
        const view = makeView();
        const el = makeInspector(view);
        const seen = [];
        el.addEventListener('view-selected-changed', e => seen.push(e.detail.value));
        el.selectElement(null);
        expect(el.viewSelected).toBe(true);
        expect(el.selectedElems).toEqual([view]);
        expect(seen).toEqual([true]);
    });

    it('marks the selected elements and clears the previous selection', () => {
        const a = makeEl('feezal-element-basic-number', {x: 0, y: 0, w: 10, h: 10});
        const b = makeEl('feezal-element-basic-number', {x: 0, y: 0, w: 10, h: 10});
        const view = makeView({children: [a, b]});
        const el = makeInspector(view);

        el.selectElement(a);
        expect(a.classList.contains('feezal-selected')).toBe(true);
        expect(el.viewSelected).toBe(false);

        el.selectElement(b);
        expect(a.classList.contains('feezal-selected')).toBe(false);
        expect(b.classList.contains('feezal-selected')).toBe(true);
        expect(el.selectedElems).toEqual([b]);
    });

    it('accepts a NodeList as well as an array', () => {
        const a = makeEl('feezal-element-basic-number', {x: 0, y: 0, w: 10, h: 10});
        const b = makeEl('feezal-element-basic-number', {x: 0, y: 0, w: 10, h: 10});
        const view = makeView({children: [a, b]});
        const el = makeInspector(view);
        el.selectElement(view.querySelectorAll('feezal-element-basic-number'));
        expect(el.selectedElems).toHaveLength(2);
        expect(el.viewSelected).toBe(false);
    });
});

describe('_conditionCount', () => {
    it('counts the rows of the conditions attribute', () => {
        const el = makeInspector(makeView());
        const target = document.createElement('div');
        target.setAttribute('conditions', '[{"topic":"a"},{"topic":"b"}]');
        expect(el._conditionCount(target)).toBe(2);
    });

    it('is 0 for missing, malformed or non-array values — never throws', () => {
        const el = makeInspector(makeView());
        expect(el._conditionCount(document.createElement('div'))).toBe(0);
        expect(el._conditionCount(null)).toBe(0);
        const bad = document.createElement('div');
        bad.setAttribute('conditions', 'not json');
        expect(el._conditionCount(bad)).toBe(0);
        bad.setAttribute('conditions', '{"topic":"a"}');
        expect(el._conditionCount(bad)).toBe(0);
    });
});

describe('context menu listener lifecycle', () => {
    it('opens at the given position and closes on Escape', () => {
        const el = makeInspector(makeView());
        el._showCtxMenu(120, 80, true);
        expect(el._ctxMenu).toMatchObject({visible: true, x: 120, y: 80, onElem: true});

        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
        expect(el._ctxMenu.visible).toBe(false);
    });

    it('ignores other keys', () => {
        const el = makeInspector(makeView());
        el._showCtxMenu(0, 0, false);
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'a'}));
        expect(el._ctxMenu.visible).toBe(true);
    });

    it('re-opening replaces the close handler instead of stacking one per open', () => {
        const el = makeInspector(makeView());
        const add = vi.spyOn(document, 'addEventListener');
        const remove = vi.spyOn(document, 'removeEventListener');
        el._showCtxMenu(0, 0, false);
        el._showCtxMenu(1, 1, false);
        el._closeCtxMenu();
        // Two opens register 2 pairs; the second open and the close each unregister one.
        expect(add.mock.calls.filter(c => c[0] === 'mousedown')).toHaveLength(2);
        expect(remove.mock.calls.filter(c => c[0] === 'mousedown')).toHaveLength(2);
        expect(el._ctxMenuCloseHandler).toBeNull();
    });

    it('a mousedown inside the menu does not close it (the click must land first)', () => {
        const el = makeInspector(makeView());
        el._showCtxMenu(0, 0, false);
        const menu = document.createElement('div');
        menu.classList.add('ctx-menu');
        document.body.append(menu);
        menu.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, composed: true}));
        expect(el._ctxMenu.visible).toBe(true);
    });

    it('a mousedown outside closes it', () => {
        const el = makeInspector(makeView());
        el._showCtxMenu(0, 0, false);
        document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, composed: true}));
        expect(el._ctxMenu.visible).toBe(false);
    });
});

describe('_otherViews — the move-to-view targets', () => {
    it('lists every view except the current one', () => {
        const el = makeInspector(makeView());
        const site = document.createElement('div');
        for (const name of ['home', 'kitchen', 'bath']) {
            const v = document.createElement('feezal-view');
            v.setAttribute('name', name);
            site.append(v);
        }
        feezal.site = site;
        expect(el._otherViews()).toEqual(['kitchen', 'bath']);
    });

    it('is empty with no site', () => {
        const el = makeInspector(makeView());
        feezal.site = null;
        expect(el._otherViews()).toEqual([]);
    });
});

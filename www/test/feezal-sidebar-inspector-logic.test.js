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

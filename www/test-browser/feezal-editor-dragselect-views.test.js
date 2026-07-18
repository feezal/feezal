/**
 * B35 — DragSelect lifecycle across view switches. Real DragSelect in a real
 * browser, driven through the inspector's _viewChanged/_initDragSelect on a
 * bare prototype receiver (same pattern as the B8 drag-restrict suite).
 *
 * Regressions covered:
 *  - ds.stop() is not idempotent (SelectorArea's unguarded removeChild threw
 *    NotFoundError from the 2nd/3rd view switch on, aborting _viewChanged —
 *    no rubber-band, no element init on the new view, B32/B33/B36 fallout),
 *  - stop() clears the SelectableSet: a revisited view drew the rectangle but
 *    selected nothing until the selectables are re-registered,
 *  - discarding the instance map (restoreViews/loadViews) leaked the
 *    .ds-selector-area overlay divs in document.body.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import '../src/feezal-sidebar-inspector.js';
import '../src/feezal-view.js';
import {setupFeezal} from './helpers.js';

const FeezalSidebarInspector = customElements.get('feezal-sidebar-inspector');

const raf = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

let feezal;
let site, ctx;

function makeView(name, elementCount = 0) {
    const view = document.createElement('feezal-view');
    view.setAttribute('name', name);
    view.style.cssText = 'position:relative; display:block; width:400px; height:300px;';
    for (let i = 0; i < elementCount; i++) {
        const el = document.createElement('feezal-element-b35-probe');
        el.className = 'feezal-editable';
        el.feezalEditable = true;   // already wired — _viewChanged skips initElem
        el.style.cssText = `position:absolute; left:${10 + i * 60}px; top:10px; width:50px; height:30px;`;
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

    ctx = Object.create(FeezalSidebarInspector.prototype);
    for (const [k, v] of Object.entries({
        dragselect: {},
        view: 'a',
        currentView: [],
        selectElement: () => {},
        _updateSelection: () => {},
    })) {
        Object.defineProperty(ctx, k, {value: v, writable: true});
    }
});

afterEach(() => {
    ctx._disposeDragSelect();
    document.body.innerHTML = '';
});

async function switchTo(name) {
    ctx.view = name;
    expect(() => ctx._viewChanged()).not.toThrow();
    await raf();
}

describe('B35 — DragSelect across view switches', () => {
    it('3+ switches never throw and only the active view runs', async () => {
        makeView('a', 1);
        makeView('b');

        await switchTo('a');
        expect(ctx.dragselect.a.stopped).toBe(false);

        await switchTo('b');           // 1st stop of a
        expect(ctx.dragselect.a.stopped).toBe(true);
        expect(ctx.dragselect.b.stopped).toBe(false);

        await switchTo('a');           // would be the 2nd stop of b's siblings
        await switchTo('b');           // 3rd switch — the original NotFoundError repro
        await switchTo('a');
        expect(ctx.dragselect.a.stopped).toBe(false);
        expect(ctx.dragselect.b.stopped).toBe(true);
    });

    it('a revisited view gets its selectables back (stop() cleared them)', async () => {
        const viewA = makeView('a', 2);
        makeView('b');
        const [el1, el2] = viewA.querySelectorAll('.feezal-editable');

        await switchTo('a');
        expect(ctx.dragselect.a.getSelectables()).toContain(el1);

        await switchTo('b');
        // stop() wiped the set; the registration flags must be dropped with it.
        expect(el1._feezalInDragSelect).toBe(false);
        expect(ctx.dragselect.a.getSelectables()).toHaveLength(0);

        await switchTo('a');
        const selectables = ctx.dragselect.a.getSelectables();
        expect(selectables).toContain(el1);
        expect(selectables).toContain(el2);
        expect(el1._feezalInDragSelect).toBe(true);
    });

    it('a view created after several switches still gets a working instance', async () => {
        makeView('a', 1);
        makeView('b');
        await switchTo('a');
        await switchTo('b');
        await switchTo('a');

        const viewC = makeView('c', 1);
        await switchTo('c');
        expect(ctx.dragselect.c).toBeTruthy();
        expect(ctx.dragselect.c.stopped).toBe(false);
        expect(ctx.dragselect.c.getSelectables()).toContain(viewC.querySelector('.feezal-editable'));
    });

    it('_disposeDragSelect removes every selector-area overlay and is idempotent', async () => {
        makeView('a', 1);
        makeView('b');
        await switchTo('a');
        await switchTo('b');
        expect(document.querySelectorAll('.ds-selector-area').length).toBeGreaterThan(0);

        expect(() => ctx._disposeDragSelect()).not.toThrow();
        expect(document.querySelectorAll('.ds-selector-area')).toHaveLength(0);
        expect(ctx.dragselect).toEqual({});
        expect(() => ctx._disposeDragSelect()).not.toThrow();   // double dispose
    });
});

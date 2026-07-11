import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../src/feezal-sidebar-inspector.js';

// Undo replaces feezal.site.innerHTML wholesale, killing the selected node
// references. captureSelection()/restoreSelection() carry the selection across
// as a (tag, index) identity among the active view's canvas children.

function makeView(tags) {
    const view = document.createElement('feezal-view');
    for (const tag of tags) {
        view.append(document.createElement(tag));
    }

    document.body.append(view);
    return view;
}

function makeInspector() {
    const insp = document.createElement('feezal-sidebar-inspector');
    insp.selectElement = vi.fn();   // isolate from canvas/DragSelect machinery
    return insp;
}

beforeEach(() => {
    feezal.isEditor = true;
    feezal.connection = {sub: vi.fn(() => ({})), unsubscribe: vi.fn(), pub: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn()};
});

afterEach(() => {
    document.body.innerHTML = '';
});

describe('captureSelection()', () => {
    it('records tag + index among canvas children (non-canvas nodes skipped)', () => {
        const view = makeView(['feezal-element-basic-number', 'feezal-element-material-button']);
        // Non-canvas junk between elements (e.g. the dragselect rectangle).
        view.insertBefore(document.createElement('div'), view.children[1]);
        feezal.view = view;

        const insp = makeInspector();
        insp.viewSelected = false;
        insp.selectedElems = [view.querySelector('feezal-element-material-button')];

        expect(insp.captureSelection()).toEqual([{tag: 'feezal-element-material-button', idx: 1}]);
    });

    it('returns [] when the view itself is selected', () => {
        feezal.view = makeView(['feezal-element-basic-number']);
        const insp = makeInspector();
        insp.viewSelected = true;
        insp.selectedElems = [feezal.view];
        expect(insp.captureSelection()).toEqual([]);
    });

    it('captures a multi-selection in order', () => {
        const view = makeView(['feezal-element-a-x', 'feezal-element-b-y', 'feezal-element-c-z']);
        feezal.view = view;
        const insp = makeInspector();
        insp.viewSelected = false;
        insp.selectedElems = [view.children[0], view.children[2]];
        expect(insp.captureSelection()).toEqual([
            {tag: 'feezal-element-a-x', idx: 0},
            {tag: 'feezal-element-c-z', idx: 2},
        ]);
    });
});

describe('restoreSelection()', () => {
    it('re-selects the same (tag, index) on the restored DOM — new node objects', () => {
        const view = makeView(['feezal-element-basic-number', 'feezal-element-material-button']);
        feezal.view = view;
        const insp = makeInspector();
        insp.viewSelected = false;
        insp.selectedElems = [view.children[1]];
        const captured = insp.captureSelection();

        // Simulate the innerHTML swap: fresh nodes, same structure.
        const restored = makeView(['feezal-element-basic-number', 'feezal-element-material-button']);
        view.remove();
        feezal.view = restored;

        insp.restoreSelection(captured);
        expect(insp.selectElement).toHaveBeenCalledWith([restored.children[1]]);
    });

    it('drops entries whose tag no longer matches at that index (structural undo)', () => {
        const insp = makeInspector();
        feezal.view = makeView(['feezal-element-material-button', 'feezal-element-basic-number']);

        insp.restoreSelection([
            {tag: 'feezal-element-basic-number', idx: 0},      // mismatch: button sits there now
            {tag: 'feezal-element-basic-number', idx: 1},      // match
        ]);
        expect(insp.selectElement).toHaveBeenCalledWith([feezal.view.children[1]]);
    });

    it('does not select anything when nothing matches (view fallback stands)', () => {
        const insp = makeInspector();
        feezal.view = makeView(['feezal-element-material-button']);
        insp.restoreSelection([{tag: 'feezal-element-basic-number', idx: 0}]);
        insp.restoreSelection([{tag: 'feezal-element-basic-number', idx: 5}]);   // gone entirely
        expect(insp.selectElement).not.toHaveBeenCalled();
    });

    it('no-ops on an empty capture (view was selected before the undo)', () => {
        const insp = makeInspector();
        feezal.view = makeView(['feezal-element-material-button']);
        insp.restoreSelection([]);
        expect(insp.selectElement).not.toHaveBeenCalled();
    });
});

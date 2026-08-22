/**
 * B119 — fault isolation in the canvas inspector.
 *
 * The report: the right-click menu "died" intermittently, and element
 * snapping died and came back WITH it — two unrelated features failing
 * together. The coupling is structural: the inspector's render() derived its
 * menu/tab state from DOM it does not own (selection, view, other elements'
 * descriptors) with no guard, so ONE throwing read aborted the whole render —
 * no `.ctx-menu` (menu dead), no `<feezal-sidebar-inspector-styles>` child
 * (the drag `onmove` dereferenced it unguarded → snapping dead) — and both
 * recovered together once the cause cleared.
 *
 * These tests mount the REAL inspector (the prior suites all use bare
 * prototypes with the side effects stubbed, which is exactly why this
 * constellation went untested) and feed it hostile state.
 */
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {setupFeezal, until} from './helpers.js';
import '../src/feezal-sidebar-inspector.js';

let inspector, view, site;

beforeEach(async () => {
    setupFeezal({isEditor: true, ready: true});
    // The inspector reads the editor globals live; provide the minimum.
    site = document.createElement('feezal-site');
    view = document.createElement('feezal-view');
    view.setAttribute('name', 'v');
    site.append(view);
    document.body.append(site);
    Object.assign(window.feezal, {
        site,
        view,
        getView: () => view,
        app: {change() {}, shadowRoot: {querySelector: () => null}},
        container: document.body,
    });
    inspector = document.createElement('feezal-sidebar-inspector');
    document.body.append(inspector);
    await inspector.updateComplete;
});

afterEach(() => {
    inspector?.remove();
    site?.remove();
    vi.restoreAllMocks();
});

describe('render() degrades per value instead of aborting (B119)', () => {
    it('opens the context menu even while a derived read throws', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        // A hostile selection: a "view" whose getAttribute throws, the kind of
        // thing a stale/foreign node in the selection produces.
        inspector._selectionLabel = () => { throw new Error('hostile selection'); };

        inspector._showCtxMenu(40, 60, false);
        await inspector.updateComplete;

        const menu = inspector.shadowRoot.querySelector('.ctx-menu');
        expect(menu, 'the menu still renders').not.toBeNull();
        expect(menu.style.top).toBe('60px');
        // …and the sibling panel the drag handlers need is still there too.
        expect(inspector.shadowRoot.querySelector('feezal-sidebar-inspector-styles')).not.toBeNull();
        expect(warn).toHaveBeenCalled();   // the failure is reported, not swallowed
    });

    it('keeps every other menu feature when one derived read throws', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        inspector._switchFamilyTargets = () => { throw new Error('descriptor blew up'); };
        inspector._showCtxMenu(10, 10, true);
        await inspector.updateComplete;
        const menu = inspector.shadowRoot.querySelector('.ctx-menu');
        expect(menu).not.toBeNull();
        expect(menu.textContent).toContain('Paste');
    });
});

describe('_viewChanged isolates its three features (B119)', () => {
    it('wires the canvas ctx menu and initialises the elements even when the rubber band throws', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const child = document.createElement('feezal-element-basic-number');
        view.append(child);
        inspector.view = 'v';
        inspector._initRubberBand = () => { throw new Error('rubber band exploded'); };
        const init = vi.spyOn(inspector, 'initElem').mockImplementation(() => {});

        expect(() => inspector._viewChanged()).not.toThrow();

        expect(view._feezalSelectionWired, 'ctx-menu / click wiring still attached').toBe(true);
        expect(init).toHaveBeenCalledWith(child);

        // And the right-click really opens the menu through that wiring.
        view.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, clientX: 30, clientY: 50}));
        await until(() => inspector.shadowRoot.querySelector('.ctx-menu'));
    });

    it('one element refusing initElem does not leave its siblings uninitialised', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const a = document.createElement('feezal-element-basic-number');
        const b = document.createElement('feezal-element-basic-number');
        view.append(a, b);
        inspector.view = 'v';
        inspector._initRubberBand = () => {};
        const seen = [];
        inspector.initElem = el => { seen.push(el); if (el === a) throw new Error('hostile child'); };

        expect(() => inspector._viewChanged()).not.toThrow();
        expect(seen).toEqual([a, b]);
    });

    it('the wired latch is only set once the listeners exist', () => {
        const v = document.createElement('feezal-view');
        const add = vi.spyOn(v, 'addEventListener').mockImplementation(() => { throw new Error('no listeners'); });
        expect(() => inspector._attachCanvasSelection(v)).toThrow();
        expect(v._feezalSelectionWired, 'a half-wired view must not claim to be wired').toBeFalsy();
        add.mockRestore();
        inspector._attachCanvasSelection(v);
        expect(v._feezalSelectionWired).toBe(true);
    });
});

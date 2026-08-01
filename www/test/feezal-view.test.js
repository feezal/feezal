import {describe, it, expect, vi} from 'vitest';

import '../src/feezal-view.js';
import {isFlowLike} from '../src/feezal-view.js';

function makeView(name) {
    const view = document.createElement('feezal-view');
    if (name) view.setAttribute('name', name);
    return view;
}

describe('feezal-view visibility', () => {
    it('hides the view element itself when not visible', () => {
        const view = makeView('home');
        view._visibleChange(false);
        expect(view.style.display).toBe('none');
        view._visibleChange(true);
        expect(view.style.display).toBe('');
    });

    it('propagates visibility to feezal-element-* descendants', () => {
        const view = makeView('home');
        const light = document.createElement('feezal-element-circle-light');
        const nested = document.createElement('feezal-element-basic-image');
        const wrapper = document.createElement('div');
        wrapper.append(nested);
        view.append(light, wrapper);

        view._visibleChange(true);
        expect(light.visible).toBe(true);
        expect(nested.visible).toBe(true);

        view._visibleChange(false);
        expect(light.visible).toBe(false);
        expect(nested.visible).toBe(false);
    });

    it('leaves non-feezal children untouched', () => {
        const view = makeView('home');
        const div = document.createElement('div');
        view.append(div);
        view._visibleChange(true);
        expect(div.visible).toBeUndefined();
    });

    it('defaults childPosition to absolute', () => {
        expect(makeView().childPosition).toBe('absolute');
    });
});

describe('viewer addclass/removeclass subscriptions', () => {
    function subscribedHandler(sub, topic) {
        return sub.mock.calls.find(call => call[0] === topic)[1];
    }

    it('registers addclass/removeclass topics in the viewer and applies them', () => {
        feezal.isEditor = false;
        feezal.connection = {sub: vi.fn()};
        const view = makeView('home');
        view.subscribe = 'ctrl/home';
        document.body.append(view);

        expect(feezal.connection.sub).toHaveBeenCalledTimes(2);

        subscribedHandler(feezal.connection.sub, 'ctrl/home/addclass')({payload: 'alert'});
        expect(view.classList.contains('alert')).toBe(true);

        subscribedHandler(feezal.connection.sub, 'ctrl/home/removeclass')({payload: 'alert'});
        expect(view.classList.contains('alert')).toBe(false);
    });

    it('does not subscribe in the editor', () => {
        feezal.isEditor = true;
        feezal.connection = {sub: vi.fn()};
        const view = makeView('home');
        view.subscribe = 'ctrl/home';
        document.body.append(view);
        expect(feezal.connection.sub).not.toHaveBeenCalled();
    });

    it('does not subscribe without a subscribe topic', () => {
        feezal.isEditor = false;
        feezal.connection = {sub: vi.fn()};
        document.body.append(makeView('home'));
        expect(feezal.connection.sub).not.toHaveBeenCalled();
    });
});

// ── U41: flow layout ───────────────────────────────────────────────────────
describe('feezal-view flow layout (U41)', () => {
    it('aliases the legacy child-position="static" to "flow" on load', async () => {
        const view = makeView('home');
        view.setAttribute('child-position', 'static');
        document.body.append(view);
        await view.updateComplete;
        await view.updateComplete;   // alias sets the prop, reflection flushes next cycle
        // updated() rewrites it; the alias reflects to the attribute (saves flow).
        expect(view.childPosition).toBe('flow');
        expect(view.getAttribute('child-position')).toBe('flow');
    });

    it('maps the flow-* attributes onto --feezal-flow-* custom properties', async () => {
        const view = makeView('home');
        view.setAttribute('child-position', 'flow');
        view.setAttribute('flow-gap', '16');
        view.setAttribute('flow-direction', 'column');
        view.setAttribute('flow-justify', 'space-between');
        view.setAttribute('flow-align', 'stretch');
        document.body.append(view);
        await view.updateComplete;
        expect(view.style.getPropertyValue('--feezal-flow-gap')).toBe('16px');
        expect(view.style.getPropertyValue('--feezal-flow-direction')).toBe('column');
        expect(view.style.getPropertyValue('--feezal-flow-justify')).toBe('space-between');
        expect(view.style.getPropertyValue('--feezal-flow-align')).toBe('stretch');
    });

    it('exposes flow knobs as attributes gated on child-position="flow" (U39 visibleWhen)', () => {
        const attrs = customElements.get('feezal-view').feezal.attributes;
        const gap = attrs.find(a => a.name === 'flow-gap');
        expect(gap).toBeTruthy();
        expect(gap.visibleWhen).toEqual({attr: 'child-position', equals: 'flow'});
        // The child-position dropdown is kebab-named so its value keys the U39
        // visibleWhen map — and offers absolute | flow | grid (U90; no legacy
        // "static").
        const cp = attrs.find(a => a.name === 'child-position');
        expect(cp).toBeTruthy();
        expect(cp.dropdown).toEqual(['absolute', 'flow', 'grid']);
        // Every flow knob keys off 'child-position' — the SAME name the
        // child-position descriptor exposes (regression: it was 'childPosition').
        for (const n of ['flow-gap', 'flow-direction', 'flow-justify', 'flow-align']) {
            expect(attrs.find(a => a.name === n).visibleWhen.attr).toBe(cp.name);
        }
    });
});

// ── U51: per-view themes — the theme attribute owns feezal-theme-* classes ──

describe('per-view theme (U51)', () => {
    async function mountView(attrs = {}) {
        const view = makeView('themed');
        for (const [k, v] of Object.entries(attrs)) view.setAttribute(k, v);
        document.body.append(view);
        await view.updateComplete;
        return view;
    }

    it('applies the theme class for a bare suffix and a full class name', async () => {
        feezal.site = null;
        const bare = await mountView({theme: 'dark-mint'});
        expect(bare.classList.contains('feezal-theme-dark-mint')).toBe(true);
        const full = await mountView({theme: 'feezal-theme-tui'});
        expect(full.classList.contains('feezal-theme-tui')).toBe(true);
        bare.remove(); full.remove();
    });

    it('changing / clearing the attribute swaps / removes the class', async () => {
        feezal.site = null;
        const view = await mountView({theme: 'dark-mint'});
        view.setAttribute('theme', 'metro');
        await view.updateComplete;
        expect([...view.classList].filter(c => c.startsWith('feezal-theme-'))).toEqual(['feezal-theme-metro']);
        view.setAttribute('theme', '');
        await view.updateComplete;
        expect([...view.classList].some(c => c.startsWith('feezal-theme-'))).toBe(false);
        view.remove();
    });

    it('strips a stale serialized theme class on mount (attribute owns the class)', async () => {
        feezal.site = null;
        const view = makeView('stale');
        view.className = 'feezal-theme-old-choice something-else';
        document.body.append(view);
        await view.updateComplete;
        expect(view.classList.contains('feezal-theme-old-choice')).toBe(false);
        expect(view.classList.contains('something-else')).toBe(true);
        view.remove();
    });

    it('is suppressed while a site-level theme override is active (user choice wins)', async () => {
        feezal.site = {_themeOverride: 'feezal-theme-user-pick'};
        const view = await mountView({theme: 'dark-mint'});
        expect(view.classList.contains('feezal-theme-dark-mint')).toBe(false);

        // Override cleared → the site calls _applyThemeClass() again.
        feezal.site = {_themeOverride: null};
        view._applyThemeClass();
        expect(view.classList.contains('feezal-theme-dark-mint')).toBe(true);
        view.remove();
    });

    it('U53: the theme attribute mounts the shared styled picker (custom hook)', () => {
        // The picker itself derives its options from feezal.themes at render
        // time (browser-tested in test-browser/feezal-theme-select.test.js).
        const spec = customElements.get('feezal-view').feezal.attributes.find(a => a?.name === 'theme');
        expect(spec).toMatchObject({type: 'custom', component: 'feezal-theme-select'});
    });
});


/**
 * U90 — grid layout. The geometry itself (does a 2x2 tile actually leave room
 * beside it?) is a real-CSS question and lives in the browser suite; what is
 * unit-testable here is the arithmetic that feeds it: which cell size gets
 * resolved, and which span rules that produces.
 */
describe('U90 grid mode', () => {
    /** A grid view whose generated sheet is captured instead of applied. */
    function gridView(children = [], props = {}) {
        const view = document.createElement('feezal-view');
        view.childPosition = 'grid';
        Object.assign(view, props);
        for (const [w, h] of children) {
            const el = document.createElement('feezal-element-basic-number');
            if (w) el.style.width = `${w}px`;
            if (h) el.style.height = `${h}px`;
            view.append(el);
        }
        let css = '';
        view._gridSheet = {replaceSync: text => { css = text; }};
        view._syncGrid();
        return {view, css: () => css};
    }

    const spanRules = css => css.split('\n').filter(l => l.startsWith('::slotted'));

    it('classifies container-placed modes, absolute excluded', () => {
        const view = document.createElement('feezal-view');
        for (const mode of ['flow', 'grid', 'static']) {
            view.childPosition = mode;
            expect(isFlowLike(view), mode).toBe(true);
        }
        view.childPosition = 'absolute';
        expect(isFlowLike(view)).toBe(false);
        expect(isFlowLike(null)).toBe(false);
        expect(isFlowLike(undefined)).toBe(false);
    });

    it('derives the cell from the SMALLEST child, so a double tile spans 2x2', () => {
        // The reported case: eleven 245x180 cards plus one 520x380 camera.
        const {css} = gridView([[520, 380], [245, 180], [245, 180]]);
        expect(css()).toContain('--feezal-grid-cell-width:245px');
        expect(css()).toContain('--feezal-grid-cell-height:180px');
        // Only the camera gets a rule; the cards are 1x1 and need none.
        expect(spanRules(css())).toEqual(
            ['::slotted(:nth-child(1)){grid-column:span 2;grid-row:span 2}']);
    });

    it('an explicit cell size wins over the derived one', () => {
        const {css} = gridView([[240, 180], [120, 90]],
            {gridCellWidth: '120', gridCellHeight: '90'});
        expect(css()).toContain('--feezal-grid-cell-width:120px');
        expect(spanRules(css())).toEqual(
            ['::slotted(:nth-child(1)){grid-column:span 2;grid-row:span 2}']);
    });

    it('falls back to a usable cell when no child declares a size', () => {
        const {css} = gridView([[0, 0], [0, 0]]);
        expect(css()).toContain('--feezal-grid-cell-width:120px');
        expect(css()).toContain('--feezal-grid-cell-height:60px');
        expect(spanRules(css())).toEqual([]);   // everything is 1x1
    });

    it('rounds to the nearest cell count rather than always growing', () => {
        // 250 is a hair over 2 cells (245) and must NOT become 3.
        const {css} = gridView([[250, 90], [120, 90]],
            {gridCellWidth: '120', gridCellHeight: '90'});
        expect(spanRules(css())).toEqual(
            ['::slotted(:nth-child(1)){grid-column:span 2;grid-row:span 1}']);
    });

    it('counts nth-child over ALL element children, including the drag placeholder', () => {
        const {view, css} = gridView([[120, 90], [245, 90]],
            {gridCellWidth: '120', gridCellHeight: '90'});
        expect(spanRules(css())).toEqual(
            ['::slotted(:nth-child(2)){grid-column:span 2;grid-row:span 1}']);

        // The editor inserts a placeholder before the dragged tile; the wide
        // tile is now the THIRD child and its rule has to follow it.
        const ph = document.createElement('div');
        ph.className = 'feezal-placeholder';
        view.insertBefore(ph, view.children[1]);
        view._syncGrid();
        expect(spanRules(css())).toEqual(
            ['::slotted(:nth-child(3)){grid-column:span 2;grid-row:span 1}']);
    });

    it('ignores percentage sizes instead of reading them as pixels', () => {
        // `width: 50%` is a flow idiom. Parsed naively it would look like 50px
        // and — because the cell is derived from the SMALLEST child — drag the
        // whole grid down to 50px cells.
        const view = document.createElement('feezal-view');
        view.childPosition = 'grid';
        for (const style of ['width:50%;height:100%', 'width:240px;height:180px']) {
            const el = document.createElement('feezal-element-basic-number');
            el.style.cssText = style;
            view.append(el);
        }
        let css = '';
        view._gridSheet = {replaceSync: text => { css = text; }};
        view._syncGrid();

        expect(css).toContain('--feezal-grid-cell-width:240px');
        expect(css).toContain('--feezal-grid-cell-height:180px');
        // The percentage tile just occupies one cell — no span rule at all.
        expect(spanRules(css)).toEqual([]);
    });

    it('dense packing is opt-in', () => {
        const {css} = gridView([[120, 90]]);
        expect(css()).toContain('--feezal-grid-flow:row;');

        const dense = gridView([[120, 90]], {gridDense: true});
        expect(dense.css()).toContain('--feezal-grid-flow:row dense;');
    });

    it('honours the gap in both the variable and the span arithmetic', () => {
        // gap 0 -> a 240px tile is exactly 2 cells of 120.
        const {css} = gridView([[240, 90], [120, 90]],
            {gridCellWidth: '120', gridCellHeight: '90', gridGap: '0'});
        expect(css()).toContain('--feezal-grid-gap:0px');
        expect(spanRules(css())).toEqual(
            ['::slotted(:nth-child(1)){grid-column:span 2;grid-row:span 1}']);
    });

    it('empties the sheet and drops the observer when the view leaves grid mode', () => {
        const {view, css} = gridView([[520, 380], [245, 180]]);
        expect(css()).not.toBe('');
        expect(view._gridObserver).toBeTruthy();

        view.childPosition = 'flow';
        view._syncGrid();
        expect(css()).toBe('');
        expect(view._gridObserver).toBe(null);
    });

    it('exposes the grid knobs only while the view is in grid mode', () => {
        const attrs = customElements.get('feezal-view').feezal.attributes;
        const names = attrs.filter(a => a?.name?.startsWith('grid-')).map(a => a.name);
        expect(names).toEqual(['grid-cell-width', 'grid-cell-height', 'grid-gap',
            'grid-justify', 'grid-dense']);
        for (const a of attrs.filter(a => a?.name?.startsWith('grid-'))) {
            expect(a.visibleWhen, a.name).toEqual({attr: 'child-position', equals: 'grid'});
        }
        const mode = attrs.find(a => a?.name === 'child-position');
        expect(mode.dropdown).toEqual(['absolute', 'flow', 'grid']);
    });
});

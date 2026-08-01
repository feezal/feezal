/**
 * U90 — grid child-position, in a REAL browser: the whole point of the mode is
 * a CSS-layout outcome (does a double-size tile leave usable room beside it?),
 * which jsdom cannot answer. The span arithmetic that feeds this is unit-tested
 * in test/feezal-view.test.js.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import '../src/feezal-view.js';
import {setupFeezal} from './helpers.js';

const CELL = 120;
const GAP = 5;
const COLS = 3;

let host;

/** Mount a view with the given tiles, sized to exactly COLS columns. */
async function mountView(mode, tiles, attrs = {}) {
    const view = document.createElement('feezal-view');
    view.setAttribute('name', 'g');
    view.setAttribute('child-position', mode);
    if (mode === 'grid') {
        view.setAttribute('grid-cell-width', String(CELL));
        view.setAttribute('grid-cell-height', String(CELL));
        view.setAttribute('grid-gap', String(GAP));
    } else {
        view.setAttribute('flow-gap', String(GAP));
    }
    for (const [k, v] of Object.entries(attrs)) view.setAttribute(k, v);
    view.style.cssText =
        `display:block;width:${COLS * CELL + (COLS - 1) * GAP}px;height:900px;`;
    for (const [label, w, h] of tiles) {
        const el = document.createElement('div');
        el.dataset.label = label;
        el.style.cssText = `display:block;width:${w}px;height:${h}px;`;
        view.append(el);
    }
    host.append(view);
    await view.updateComplete;
    // one frame for the rAF-coalesced span sync
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return view;
}

/** Visual layout as "row -> labels, left to right". */
function rowsOf(view) {
    const vr = view.getBoundingClientRect();
    const rows = new Map();
    for (const el of view.children) {
        const b = el.getBoundingClientRect();
        if (!b.width) continue;
        const y = Math.round(b.top - vr.top);
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y).push([Math.round(b.left - vr.left), el.dataset.label]);
    }
    return [...rows.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, cells]) => cells.sort((a, b) => a[0] - b[0]).map(c => c[1]).join(' '));
}

const contentHeight = view => Math.max(0, ...[...view.children]
    .map(el => el.getBoundingClientRect().bottom - view.getBoundingClientRect().top));

beforeEach(() => {
    // feezal-view's connectedCallback consults the global (viewer-side MQTT
    // wiring), so the harness has to exist before a view is mounted.
    setupFeezal({isEditor: true, ready: true});
    host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;';
    document.body.append(host);
});

afterEach(() => host.remove());

describe('U90 grid layout', () => {
    // The reported case, scaled down: one 2x2 tile then a run of 1x1 tiles.
    const REPORTED = [
        ['big', CELL * 2 + GAP, CELL * 2 + GAP],
        ...['a', 'b', 'c', 'd', 'e'].map(l => [l, CELL, CELL]),
    ];

    it('flow leaves the space beside a double-height tile unusable', async () => {
        const view = await mountView('flow', REPORTED);
        // Nothing sits next to the LOWER half of the big tile: the row after
        // the first starts below it.
        expect(rowsOf(view)).toEqual(['big a', 'b c d', 'e']);
    });

    it('grid flows the following tiles into the space beside it', async () => {
        const view = await mountView('grid', REPORTED);
        expect(rowsOf(view)).toEqual(['big a', 'b', 'c d e']);
    });

    it('grid is shorter than flow for the same content', async () => {
        const flow = await mountView('flow', REPORTED);
        const flowH = contentHeight(flow);
        flow.remove();
        const grid = await mountView('grid', REPORTED);
        expect(contentHeight(grid)).toBeLessThan(flowH);
    });

    it('quantises a tile to its cell span instead of overflowing it', async () => {
        // 250px is a hair over two 120px cells + 5px gap (245).
        const view = await mountView('grid', [['wide', 250, CELL], ['x', CELL, CELL]]);
        const wide = view.children[0].getBoundingClientRect();
        expect(Math.round(wide.width)).toBe(CELL * 2 + GAP);
        // ...and the authored size is untouched, so switching modes restores it.
        expect(view.children[0].style.width).toBe('250px');
    });

    it('derives the cell from the smallest tile when none is configured', async () => {
        const view = document.createElement('feezal-view');
        view.setAttribute('name', 'auto');
        view.setAttribute('child-position', 'grid');
        view.style.cssText = 'display:block;width:500px;height:600px;';
        for (const [label, w, h] of [['big', 200, 200], ['s1', 98, 98], ['s2', 98, 98]]) {
            const el = document.createElement('div');
            el.dataset.label = label;
            el.style.cssText = `display:block;width:${w}px;height:${h}px;`;
            view.append(el);
        }
        host.append(view);
        await view.updateComplete;
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        // cell = 98 -> 200px spans 2 cells (98*2 + 5 gap = 201)
        expect(Math.round(view.children[0].getBoundingClientRect().width)).toBe(201);
        expect(Math.round(view.children[1].getBoundingClientRect().width)).toBe(98);
    });

    it('sparse (default) keeps visual order equal to DOM order; dense does not', async () => {
        // Two 1x1 tiles, then a 2-wide one that cannot fit in column 3: it
        // wraps and leaves a hole only a LATER tile could fill.
        const tiles = [['a', CELL, CELL], ['b', CELL, CELL],
            ['BIG', CELL * 2 + GAP, CELL], ['c', CELL, CELL], ['d', CELL, CELL]];

        const sparse = await mountView('grid', tiles);
        expect(rowsOf(sparse)).toEqual(['a b', 'BIG c', 'd']);
        sparse.remove();

        const dense = await mountView('grid', tiles, {'grid-dense': ''});
        // 'c' moved BACKWARDS into the hole — tighter, but now the visual
        // order (a b c BIG d) no longer matches the DOM order (a b BIG c d),
        // which is why this is opt-in.
        expect(rowsOf(dense)).toEqual(['a b c', 'BIG d']);
    });

    it('re-lays out when a tile is resized, without touching the light DOM', async () => {
        const view = await mountView('grid', [['x', CELL, CELL], ['y', CELL, CELL]]);
        expect(rowsOf(view)).toEqual(['x y']);

        // What the editor's resize does: rewrite the inline size.
        view.children[0].style.width = `${CELL * 2 + GAP}px`;
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        expect(Math.round(view.children[0].getBoundingClientRect().width)).toBe(CELL * 2 + GAP);
        // The span lives in the shadow sheet, never as an inline style, so the
        // serialized markup stays clean.
        expect(view.children[0].getAttribute('style')).not.toContain('grid-');
    });

    it('drops grid styling entirely when the view leaves grid mode', async () => {
        const view = await mountView('grid', REPORTED);
        expect(rowsOf(view)).toEqual(['big a', 'b', 'c d e']);

        view.setAttribute('child-position', 'flow');
        await view.updateComplete;
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        // Back to flex: the big tile is its authored size again and the space
        // beside it is dead once more.
        expect(rowsOf(view)).toEqual(['big a', 'b c d', 'e']);
    });
});

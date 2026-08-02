/**
 * U83 — the alignment / distribution / match-size geometry engine (pure, so it
 * tests without a DOM; the inspector wires it to inline styles + one undo
 * snapshot).
 */
import {describe, it, expect} from 'vitest';
import {
    align, distribute, matchSize, selectionBounds, operationLabel, ALIGN_MODES,
} from '../src/feezal-canvas-align.js';

const box = (id, left, top, width = 100, height = 50) => ({id, left, top, width, height});

// a: 10,10 100x50   b: 200,80 60x30   c: 400,200 40x100
const A = box('a', 10, 10);
const B = box('b', 200, 80, 60, 30);
const C = box('c', 400, 200, 40, 100);

describe('selectionBounds', () => {
    it('spans every box', () => {
        expect(selectionBounds([A, B, C])).toEqual({
            left: 10, top: 10, right: 440, bottom: 300, width: 430, height: 290,
        });
    });
    it('is null for an empty selection', () => {
        expect(selectionBounds([])).toBe(null);
    });
});

describe('align to the selection bounds', () => {
    it('left / right / hcenter move only the x axis', () => {
        const left = align([A, B, C], 'left');
        expect(left.map(p => [p.id, p.left])).toEqual([['b', 10], ['c', 10]]);   // a already there
        expect(left.every(p => !('top' in p))).toBe(true);

        // right edge = 440; c already ends there, so only a and b move
        expect(align([A, B, C], 'right').map(p => [p.id, p.left]))
            .toEqual([['a', 340], ['b', 380]]);

        const centre = align([A, B, C], 'hcenter');
        // selection centre = 10 + 430/2 = 225
        expect(centre.find(p => p.id === 'a').left).toBe(175);   // 225 - 100/2
        expect(centre.find(p => p.id === 'b').left).toBe(195);   // 225 - 60/2
    });

    it('top / bottom / vcenter move only the y axis', () => {
        const top = align([A, B, C], 'top');
        expect(top.map(p => [p.id, p.top])).toEqual([['b', 10], ['c', 10]]);
        expect(top.every(p => !('left' in p))).toBe(true);

        const bottom = align([A, B, C], 'bottom');
        expect(bottom.find(p => p.id === 'a').top).toBe(250);    // 300 - 50
        expect(bottom.find(p => p.id === 'b').top).toBe(270);
    });

    it('every documented mode is implemented', () => {
        for (const mode of ALIGN_MODES) {
            expect(() => align([A, B], mode), mode).not.toThrow();
        }
    });

    it('an explicit frame aligns INTO it (single element → view)', () => {
        const view = {left: 0, top: 0, width: 1000, height: 600};
        expect(align([A], 'right', view)).toEqual([{id: 'a', left: 900}]);
        expect(align([A], 'hcenter', view)).toEqual([{id: 'a', left: 450}]);
        expect(align([A], 'vcenter', view)).toEqual([{id: 'a', top: 275}]);
    });

    it('reports nothing when everything is already aligned', () => {
        const aligned = [box('x', 5, 0), box('y', 5, 100)];
        expect(align(aligned, 'left')).toEqual([]);
    });

    it('an empty selection is a no-op', () => {
        expect(align([], 'left')).toEqual([]);
    });
});

describe('distribute', () => {
    it('equalizes the gaps and keeps the outer two anchored', () => {
        // 0..100, 150..210, 400..500 → span 500, sizes 100+60+100=260, gap 120
        const boxes = [box('a', 0, 0, 100), box('b', 150, 0, 60), box('c', 400, 0, 100)];
        const patches = distribute(boxes, 'horizontal');
        expect(patches).toEqual([{id: 'b', left: 220}]);   // 0+100+120
        // the anchors did not move → they are not in the patch list
        expect(patches.find(p => p.id === 'a')).toBeUndefined();
        expect(patches.find(p => p.id === 'c')).toBeUndefined();
    });

    it('works on the vertical axis and sorts by position, not selection order', () => {
        const boxes = [box('c', 0, 400, 10, 100), box('a', 0, 0, 10, 100), box('b', 0, 111, 10, 100)];
        const patches = distribute(boxes, 'vertical');
        // span 500, sizes 300, gap 100 → b at 0+100+100 = 200
        expect(patches).toEqual([{id: 'b', top: 200}]);
    });

    it('needs at least three boxes', () => {
        expect(distribute([A, B], 'horizontal')).toEqual([]);
        expect(distribute([A], 'horizontal')).toEqual([]);
    });

    it('already-even spacing reports no change', () => {
        const boxes = [box('a', 0, 0, 50), box('b', 100, 0, 50), box('c', 200, 0, 50)];
        expect(distribute(boxes, 'horizontal')).toEqual([]);
    });
});

describe('matchSize', () => {
    it('uses the FIRST selected element as the reference', () => {
        expect(matchSize([A, B, C], 'both')).toEqual([
            {id: 'b', width: 100, height: 50},
            {id: 'c', width: 100, height: 50},
        ]);
    });

    it('width / height touch only that dimension', () => {
        expect(matchSize([A, B], 'width')).toEqual([{id: 'b', width: 100}]);
        expect(matchSize([A, B], 'height')).toEqual([{id: 'b', height: 50}]);
    });

    it('an explicit reference wins', () => {
        expect(matchSize([A, B], 'width', 'b')).toEqual([{id: 'a', width: 60}]);
    });

    it('needs at least two boxes and reports equal sizes as no change', () => {
        expect(matchSize([A], 'both')).toEqual([]);
        expect(matchSize([box('a', 0, 0), box('b', 9, 9)], 'both')).toEqual([]);
    });
});

describe('operationLabel', () => {
    it('names the operation, counts and locked skips', () => {
        expect(operationLabel('left', 3)).toBe('Aligned left — 3 elements');
        expect(operationLabel('both', 1)).toBe('Matched size — 1 element');
        expect(operationLabel('horizontal', 4, 2))
            .toBe('Distributed horizontally — 4 elements (2 locked skipped)');
    });
});


/**
 * U91 — distribute never overlaps.
 *
 * The equal gap goes NEGATIVE once the selection sums to more than the span
 * between the outermost two, which used to "space them evenly" by stacking
 * them on top of each other. Gaps are allowed; overlap is not.
 */
describe('distribute — never overlap (U91)', () => {
    const at = (id, left, width = 100) => ({id, left, top: 0, width, height: 50});

    it('packs edge-to-edge when the span is too tight', () => {
        // span 0..250 (250), three 100px elements = 300 > 250
        const out = distribute([at('a', 0), at('b', 60), at('c', 150)], 'horizontal');
        const byId = Object.fromEntries(out.map(p => [p.id, p.left]));
        expect(byId.b).toBe(100);          // flush against a
        expect(byId.c).toBe(200);          // flush against b
    });

    it('never produces a negative gap, whatever the crowding', () => {
        const boxes = [at('a', 0), at('b', 10), at('c', 20), at('d', 30)];
        const out = distribute(boxes, 'horizontal');
        const placed = boxes
            .map(b => ({...b, left: out.find(p => p.id === b.id)?.left ?? b.left}))
            .sort((x, y) => x.left - y.left);
        for (let i = 1; i < placed.length; i++) {
            const prev = placed[i - 1];
            expect(placed[i].left, placed[i].id + ' overlaps ' + prev.id)
                .toBeGreaterThanOrEqual(prev.left + prev.width);
        }
    });

    it('lets the strip grow past the old outer edge — that is the trade', () => {
        const out = distribute([at('a', 0), at('b', 60), at('c', 150)], 'horizontal');
        // c was the rightmost at 150; packed it lands at 200, past the old edge
        expect(out.find(p => p.id === 'c').left).toBe(200);
    });

    it('keeps the first element exactly where it was', () => {
        const out = distribute([at('a', 40), at('b', 80), at('c', 140)], 'horizontal');
        // 'a' is unchanged, so it is not even in the patch list
        expect(out.find(p => p.id === 'a')).toBeUndefined();
        expect(out.find(p => p.id === 'b').left).toBe(140);
    });

    it('leaves the roomy case exactly as before — both anchors pinned', () => {
        // span 0..500, three 100px elements -> gap 100
        const out = distribute([at('a', 0), at('b', 220), at('c', 400)], 'horizontal');
        expect(out.find(p => p.id === 'b').left).toBe(200);
        expect(out.find(p => p.id === 'c')).toBeUndefined();   // outer anchor unmoved
    });

    it('packs vertically too', () => {
        const out = distribute([
            {id: 'a', left: 0, top: 0, width: 50, height: 100},
            {id: 'b', left: 0, top: 40, width: 50, height: 100},
            {id: 'c', left: 0, top: 90, width: 50, height: 100},
        ], 'vertical');
        const byId = Object.fromEntries(out.map(p => [p.id, p.top]));
        expect(byId.b).toBe(100);
        expect(byId.c).toBe(200);
    });

    it('touching exactly is not overlapping — a zero gap is fine', () => {
        // span 0..300, three 100px -> gap exactly 0, nothing needs to move
        expect(distribute([at('a', 0), at('b', 100), at('c', 200)], 'horizontal')).toEqual([]);
    });
});

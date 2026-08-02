/**
 * U89 — equal-gap detection.
 *
 * The core case is neighbour-gap propagation: two cards 16px apart, drag a
 * third towards them, get 16px proposed. These tests pin the geometry and the
 * two judgement calls it encodes — adjacent pair only, and same lane only.
 */
import {describe, it, expect} from 'vitest';
import {equalGapCandidates, centeredCandidates, bestEqualGap} from '../src/feezal-canvas-gaps.js';

/** A box from left/top/width/height, the way the canvas thinks. */
const box = (left, top, w = 100, h = 50) =>
    ({left, top, right: left + w, bottom: top + h});

/** Two cards in a row, 16px apart: [0..100] [116..216] */
const PAIR = [box(0, 0), box(116, 0)];

describe('equalGapCandidates — the propagation case', () => {
    it('proposes the neighbours\' own gap on the far side', () => {
        const dragged = box(300, 0);
        const after = equalGapCandidates(dragged, PAIR, 'x')
            .filter(c => c.side === 'after' && c.anchor === PAIR[1]);
        expect(after).toHaveLength(1);
        expect(after[0].gap).toBe(16);
        expect(after[0].lead).toBe(232);        // 216 + 16
        expect(after[0].reference).toBe(PAIR[0]);
    });

    it('mirrors it on the other side of the row', () => {
        const dragged = box(-300, 0);
        const before = equalGapCandidates(dragged, PAIR, 'x')
            .filter(c => c.side === 'before' && c.anchor === PAIR[0]);
        expect(before).toHaveLength(1);
        expect(before[0].gap).toBe(16);
        // leading edge = anchor.left - gap - width = 0 - 16 - 100
        expect(before[0].lead).toBe(-116);
    });

    it('reports both spans, so the hint can show them as equal', () => {
        const c = equalGapCandidates(box(300, 0), PAIR, 'x')
            .find(x => x.side === 'after' && x.anchor === PAIR[1]);
        expect(c.measured).toEqual({from: 100, to: 116});   // the existing gap
        expect(c.proposed).toEqual({from: 216, to: 232});   // the one offered
        expect(c.measured.to - c.measured.from).toBe(c.proposed.to - c.proposed.from);
    });

    it('works on the vertical axis too', () => {
        const column = [box(0, 0), box(0, 66)];             // 16px apart vertically
        const c = equalGapCandidates(box(0, 300), column, 'y')
            .find(x => x.side === 'after' && x.anchor === column[1]);
        expect(c.gap).toBe(16);
        expect(c.lead).toBe(132);                            // 116 + 16
    });
});

describe('the judgement calls', () => {
    it('ignores elements in another lane — an invisible gap is not a gap', () => {
        const otherRow = [box(0, 400), box(116, 400)];
        expect(equalGapCandidates(box(300, 0), otherRow, 'x')).toEqual([]);
    });

    it('needs a PAIR: a lone neighbour proposes nothing', () => {
        expect(equalGapCandidates(box(300, 0), [box(0, 0)], 'x')).toEqual([]);
    });

    it('ignores touching or overlapping neighbours', () => {
        const touching = [box(0, 0), box(100, 0)];           // 0px gap
        expect(equalGapCandidates(box(300, 0), touching, 'x')).toEqual([]);
        const overlapping = [box(0, 0), box(80, 0)];
        expect(equalGapCandidates(box(300, 0), overlapping, 'x')).toEqual([]);
    });

    it('measures from the ADJACENT pair, not the whole row', () => {
        // 0..100, gap 16 -> 116..216, gap 40 -> 256..356
        const row = [box(0, 0), box(116, 0), box(256, 0)];
        const afterLast = equalGapCandidates(box(500, 0), row, 'x')
            .filter(c => c.side === 'after' && c.anchor === row[2]);
        // echoes the 40px gap next to it, NOT the 16px one further away
        expect(afterLast.map(c => c.gap)).toEqual([40]);
    });
});

describe('bestEqualGap', () => {
    it('picks the candidate the drag is nearest to, within range', () => {
        const dragged = box(235, 0);                        // 3px past the 232 proposal
        const best = bestEqualGap(dragged, PAIR, 'x', {range: 8});
        expect(best.lead).toBe(232);
        expect(best.gap).toBe(16);
        expect(best.distance).toBe(3);
    });

    it('returns null when nothing is within range', () => {
        expect(bestEqualGap(box(300, 0), PAIR, 'x', {range: 8})).toBeNull();
    });

    it('breaks ties toward the smaller gap, so the guide cannot flicker', () => {
        // Two rhythms whose proposals land the same distance away: 10 and 30.
        const row = [box(0, 0), box(110, 0),                  // gap 10
            box(600, 0), box(730, 0)];                        // gap 30
        // after box(110..210) with gap 10 -> 220 ; before box(600) with gap 30 -> 470
        const dragged = box(225, 0);
        const best = bestEqualGap(dragged, row, 'x', {range: 20});
        expect(best.gap).toBe(10);
    });

    it('is stable: the same inputs give the same answer', () => {
        const a = bestEqualGap(box(235, 0), PAIR, 'x', {range: 8});
        const b = bestEqualGap(box(235, 0), PAIR, 'x', {range: 8});
        expect(a).toEqual(b);
    });
});

/**
 * Dropping into a HOLE has no rhythm to echo, so the offer is the middle:
 * equal gaps left and right. Same candidate shape, measured differently.
 */
describe('centeredCandidates', () => {
    // 0..100 and 460..560 -> 360px free
    const HOLE = [box(0, 0), box(460, 0)];

    it('proposes the position with equal gaps on both sides', () => {
        const [c] = centeredCandidates(box(200, 0), HOLE, 'x');
        expect(c.gap).toBe(130);              // (360 - 100) / 2
        expect(c.lead).toBe(230);             // 100 + 130
        expect(c.kind).toBe('centered');
        // the two spans it annotates really are equal
        expect(c.measured.to - c.measured.from).toBe(c.proposed.to - c.proposed.from);
    });

    it('ignores a hole too small for the element', () => {
        const tight = [box(0, 0), box(180, 0)];   // 80px free, element is 100
        expect(centeredCandidates(box(120, 0), tight, 'x')).toEqual([]);
    });

    it('works vertically', () => {
        const column = [box(0, 0), box(0, 400)];  // 350px free below the first
        const [c] = centeredCandidates(box(0, 200), column, 'y');
        expect(c.gap).toBe(150);              // (350 - 50) / 2
        expect(c.lead).toBe(200);
    });

    it('is offered by bestEqualGap alongside the rhythm cases', () => {
        const best = bestEqualGap(box(236, 0), HOLE, 'x', {range: 24});
        expect(best.kind).toBe('centered');
        expect(best.lead).toBe(230);
    });

    it('loses a tie to an existing rhythm — echoing beats centring', () => {
        // a rhythm proposal and a centring proposal the same distance away
        const row = [box(0, 0), box(116, 0), box(500, 0)];
        const dragged = box(232, 0);
        const best = bestEqualGap(dragged, row, 'x', {range: 24});
        expect(best.kind).toBe('rhythm');
    });
});

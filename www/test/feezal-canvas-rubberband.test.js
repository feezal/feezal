/**
 * A38 — the rubber band's pure geometry. The gesture itself is a real-browser
 * concern (test-browser/feezal-editor-rubberband.test.js); what is worth
 * pinning here is the hit test, because "does this rectangle touch that one"
 * is exactly the kind of predicate that silently drifts by one edge case.
 */
import {describe, it, expect} from 'vitest';
import {rectsIntersect, boxBetween} from '../src/feezal-canvas-rubberband.js';

const rect = (left, top, right, bottom) => ({left, top, right, bottom});

describe('rectsIntersect', () => {
    it('detects overlap regardless of which rect is passed first', () => {
        const a = rect(0, 0, 100, 100);
        const b = rect(50, 50, 150, 150);
        expect(rectsIntersect(a, b)).toBe(true);
        expect(rectsIntersect(b, a)).toBe(true);
    });

    it('counts full containment, both directions', () => {
        const outer = rect(0, 0, 100, 100);
        const inner = rect(20, 20, 40, 40);
        expect(rectsIntersect(outer, inner)).toBe(true);
        expect(rectsIntersect(inner, outer)).toBe(true);
    });

    it('does NOT count merely touching edges', () => {
        // A band dragged up to an element's left edge has not covered it —
        // treating this as a hit makes selection feel sticky and imprecise.
        expect(rectsIntersect(rect(0, 0, 50, 50), rect(50, 0, 100, 50))).toBe(false);
        expect(rectsIntersect(rect(0, 0, 50, 50), rect(0, 50, 50, 100))).toBe(false);
    });

    it('rejects separation on either axis alone', () => {
        const a = rect(0, 0, 50, 50);
        expect(rectsIntersect(a, rect(60, 0, 100, 50))).toBe(false);    // x apart
        expect(rectsIntersect(a, rect(0, 60, 50, 100))).toBe(false);    // y apart
        expect(rectsIntersect(a, rect(60, 60, 100, 100))).toBe(false);  // both
    });

    it('a degenerate band still contains a point inside a rect', () => {
        // Geometrically correct, and unreachable in practice: a band only
        // applies a selection once it passes the drag threshold, so a click
        // never reaches the hit test (browser suite covers that path).
        expect(rectsIntersect(rect(25, 25, 25, 25), rect(0, 0, 50, 50))).toBe(true);
        // ...but a degenerate band OUTSIDE the rect still misses.
        expect(rectsIntersect(rect(80, 80, 80, 80), rect(0, 0, 50, 50))).toBe(false);
    });
});

describe('boxBetween', () => {
    it('normalises whichever way the drag went', () => {
        const expected = {left: 10, top: 20, right: 60, bottom: 90};
        expect(boxBetween(10, 20, 60, 90)).toEqual(expected);   // down-right
        expect(boxBetween(60, 90, 10, 20)).toEqual(expected);   // up-left
        expect(boxBetween(60, 20, 10, 90)).toEqual(expected);   // down-left
        expect(boxBetween(10, 90, 60, 20)).toEqual(expected);   // up-right
    });

    it('handles negative client coords (a drag off the top-left of the viewport)', () => {
        expect(boxBetween(-30, -10, 20, 40))
            .toEqual({left: -30, top: -10, right: 20, bottom: 40});
    });
});

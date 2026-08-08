/**
 * B122 — small elements resize when you try to drag them.
 *
 * interact's default 20px resize edge margin covers most of a small element,
 * so a centre press started a resize from the middle (measured: a 50×25
 * element grew to 50×65 instead of moving). checkResizeAction re-validates
 * the flagged edges against a size-derived band (min(12, w/4, h/4), floor 4)
 * and demotes the gesture to a drag when the pointer is near no edge.
 */
import {describe, it, expect} from 'vitest';
import {resizeMargin, checkResizeAction} from '../src/feezal-canvas-geometry.js';

const rect = (width, height, left = 0, top = 0) =>
    ({left, top, width, height, right: left + width, bottom: top + height});

const resize = edges => ({name: 'resize', edges});

describe('resizeMargin (B122)', () => {
    it('caps at 12px for large elements (matches the corner grip)', () => {
        expect(resizeMargin(rect(400, 300))).toBe(12);
    });
    it('shrinks to a quarter of the smaller dimension', () => {
        expect(resizeMargin(rect(50, 25))).toBe(6.25);
        expect(resizeMargin(rect(40, 40))).toBe(10);
    });
    it('never goes below the 4px grabbability floor', () => {
        expect(resizeMargin(rect(12, 12))).toBe(4);
    });
});

describe('checkResizeAction (B122)', () => {
    it('the reported case: centre press on a 50×25 element becomes a DRAG, not a resize', () => {
        const a = checkResizeAction(resize({right: true, bottom: true}), {x: 25, y: 12.5}, rect(50, 25));
        expect(a).toEqual({name: 'drag'});
    });

    it('a 40×40 metro tile (editor minimum) still drags from the centre', () => {
        const a = checkResizeAction(resize({right: true, bottom: true}), {x: 20, y: 20}, rect(40, 40));
        expect(a).toEqual({name: 'drag'});
    });

    it('a corner press on the same small element keeps the resize with both edges', () => {
        const a = checkResizeAction(resize({right: true, bottom: true}), {x: 48, y: 23}, rect(50, 25));
        expect(a.name).toBe('resize');
        expect(a.edges.right).toBe(true);
        expect(a.edges.bottom).toBe(true);
    });

    it('an edge press keeps only the edge the pointer is actually near', () => {
        // Near the bottom edge, horizontally centred: right must be dropped.
        const a = checkResizeAction(resize({right: true, bottom: true}), {x: 25, y: 24}, rect(50, 25));
        expect(a.name).toBe('resize');
        expect(a.edges.bottom).toBe(true);
        expect(a.edges.right).toBe(false);
    });

    it('a left-handle resize near the left edge survives', () => {
        const a = checkResizeAction(resize({left: true}), {x: 3, y: 12}, rect(50, 25));
        expect(a.name).toBe('resize');
        expect(a.edges.left).toBe(true);
    });

    it('offset rects work (client coordinates, not element-local)', () => {
        const r = rect(50, 25, 200, 100);
        expect(checkResizeAction(resize({right: true, bottom: true}), {x: 225, y: 112}, r)).toEqual({name: 'drag'});
        expect(checkResizeAction(resize({right: true, bottom: true}), {x: 249, y: 124}, r).name).toBe('resize');
    });

    it('non-resize actions and empty edges pass through untouched', () => {
        const drag = {name: 'drag'};
        expect(checkResizeAction(drag, {x: 0, y: 0}, rect(50, 25))).toBe(drag);
        expect(checkResizeAction(null, {x: 0, y: 0}, rect(50, 25))).toBe(null);
        const noEdges = {name: 'resize'};
        expect(checkResizeAction(noEdges, {x: 0, y: 0}, rect(50, 25))).toBe(noEdges);
    });

    it('large elements keep a working 12px band on every flagged edge', () => {
        const r = rect(200, 100);
        expect(checkResizeAction(resize({right: true, bottom: true}), {x: 195, y: 50}, r).edges.right).toBe(true);
        expect(checkResizeAction(resize({right: true, bottom: true}), {x: 100, y: 50}, r)).toEqual({name: 'drag'});
    });
});

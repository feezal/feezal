import {describe, it, expect, beforeEach} from 'vitest';

// U33 — element stacking order via DOM sibling order (no z-index).
import {stackingSiblings, stackingState, reorderElements} from '../src/feezal-sidebar-inspector.js';

/** A fake view: children a..e are editable; a <style> node never counts. */
let view;
let el = {};

function ids() {
    return stackingSiblings(view).map(n => n.id).join('');
}

beforeEach(() => {
    view = document.createElement('div');
    const style = document.createElement('style');
    style.id = 'feezal-classes';
    view.append(style);
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
        const node = document.createElement('span');
        node.id = id;
        node.classList.add('feezal-editable');
        view.append(node);
        el[id] = node;
    }
    document.body.append(view);
});

describe('stackingSiblings()', () => {
    it('lists editable children in DOM order, skipping non-editable nodes', () => {
        expect(ids()).toBe('abcde');
        expect(view.children.length).toBe(6);   // style node present but not counted
    });
});

describe('reorderElements() — single element', () => {
    it('bring to front appends', () => {
        expect(reorderElements(view, [el.b], 'front')).toBe(true);
        expect(ids()).toBe('acdeb');
    });

    it('send to back prepends (after non-painting nodes is irrelevant)', () => {
        expect(reorderElements(view, [el.d], 'back')).toBe(true);
        expect(ids()).toBe('dabce');
    });

    it('forward/backward swap with the adjacent editable sibling', () => {
        expect(reorderElements(view, [el.b], 'forward')).toBe(true);
        expect(ids()).toBe('acbde');
        expect(reorderElements(view, [el.b], 'backward')).toBe(true);
        expect(ids()).toBe('abcde');
    });

    it('no-ops at the edges', () => {
        expect(reorderElements(view, [el.e], 'front')).toBe(false);
        expect(reorderElements(view, [el.e], 'forward')).toBe(false);
        expect(reorderElements(view, [el.a], 'back')).toBe(false);
        expect(reorderElements(view, [el.a], 'backward')).toBe(false);
        expect(ids()).toBe('abcde');
    });
});

describe('reorderElements() — multi-selection (block, relative order kept)', () => {
    it('front moves the block to the end in original order', () => {
        expect(reorderElements(view, [el.d, el.b], 'front')).toBe(true);   // selection order ≠ DOM order
        expect(ids()).toBe('acebd');
    });

    it('back moves the block to the start in original order', () => {
        expect(reorderElements(view, [el.d, el.b], 'back')).toBe(true);
        expect(ids()).toBe('bdace');
    });

    it('forward steps the block across one obstacle', () => {
        expect(reorderElements(view, [el.a, el.b], 'forward')).toBe(true);
        expect(ids()).toBe('cabde');
    });

    it('backward steps the block across one obstacle', () => {
        expect(reorderElements(view, [el.d, el.e], 'backward')).toBe(true);
        expect(ids()).toBe('abdec');
    });

    it('a scattered selection compacts when brought to front', () => {
        expect(reorderElements(view, [el.a, el.c], 'front')).toBe(true);
        expect(ids()).toBe('bdeac');
    });
});

describe('stackingState()', () => {
    it('middle element: everything enabled', () => {
        expect(stackingState(view, [el.c])).toEqual(
            {canFront: true, canBack: true, canForward: true, canBackward: true});
    });

    it('frontmost element: front/forward disabled', () => {
        expect(stackingState(view, [el.e])).toEqual(
            {canFront: false, canBack: true, canForward: false, canBackward: true});
    });

    it('backmost element: back/backward disabled', () => {
        expect(stackingState(view, [el.a])).toEqual(
            {canFront: true, canBack: false, canForward: true, canBackward: false});
    });

    it('contiguous tail selection: front disabled, back enabled', () => {
        expect(stackingState(view, [el.d, el.e])).toEqual(
            {canFront: false, canBack: true, canForward: false, canBackward: true});
    });

    it('scattered selection touching the end can still compact to front', () => {
        expect(stackingState(view, [el.a, el.e]).canFront).toBe(true);
        expect(stackingState(view, [el.a, el.e]).canForward).toBe(false);
    });

    it('everything selected or nothing selected: all disabled', () => {
        expect(stackingState(view, Object.values(el))).toEqual(
            {canFront: false, canBack: false, canForward: false, canBackward: false});
        expect(stackingState(view, [])).toEqual(
            {canFront: false, canBack: false, canForward: false, canBackward: false});
    });
});

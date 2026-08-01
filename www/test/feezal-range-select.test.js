/**
 * U68/U75 — the shared range + drag selection state machine behind the
 * Generate wizard's device list and review. This is the logic that regressed
 * once already (the review's Shift/drag multi-check broke when the row-select
 * layer landed), so every documented gesture is pinned here:
 * plain press = toggle + anchor; Shift+press = fill/clear the anchor range;
 * Shift with no anchor = fill upward to the boundary; drag = paint the press
 * result; the host's Set is never mutated in place.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {RangeSelect} from '../src/feezal-range-select.js';

const ORDER = ['a', 'b', 'c', 'd', 'e'];

let selection;
let sel;
beforeEach(() => {
    selection = new Set();
    sel = new RangeSelect({
        selection: () => selection,
        commit: next => { selection = next; },
    });
});

const press = (key, shiftKey = false) => sel.press({shiftKey}, key, ORDER);

describe('plain press', () => {
    it('toggles the pressed row and sets the anchor', () => {
        press('b');
        expect([...selection]).toEqual(['b']);
        expect(sel.anchor).toBe('b');
        press('b');
        expect([...selection]).toEqual([]);
        expect(sel.anchor).toBe('b');
    });

    it('commits a NEW Set instead of mutating the host state in place', () => {
        const before = selection;
        press('a');
        expect(selection).not.toBe(before);
        expect(before.size).toBe(0);
    });
});

describe('Shift+press with an anchor', () => {
    it('fills the whole range when the pressed row toggles ON', () => {
        press('b');
        press('d', true);
        expect([...selection].sort()).toEqual(['b', 'c', 'd']);
    });

    it('clears the whole range when the pressed row toggles OFF', () => {
        press('a');
        press('e', true);            // a..e all on
        expect(selection.size).toBe(5);
        press('c', true);            // c is on → result off → clear a..c
        expect([...selection].sort()).toEqual(['d', 'e']);
    });

    it('keeps the anchor so a second Shift+press moves the endpoint', () => {
        press('b');
        press('d', true);
        expect(sel.anchor).toBe('b');
        press('e', true);            // still ranges from b
        expect([...selection].sort()).toEqual(['b', 'c', 'd', 'e']);
    });

    it('ranges work upward (pressed row before the anchor)', () => {
        press('d');
        press('a', true);
        expect([...selection].sort()).toEqual(['a', 'b', 'c', 'd']);
    });

    it('an anchor missing from the current order falls back to a plain toggle', () => {
        press('b');
        sel.press({shiftKey: true}, 'd', ['c', 'd', 'e']);   // 'b' not in this list
        expect([...selection].sort()).toEqual(['b', 'd']);
        expect(sel.anchor).toBe('d');
    });
});

describe('Shift+press without an anchor (boundary fill)', () => {
    it('fills upward from the pressed row to the first already-on row', () => {
        selection = new Set(['a']);
        press('d', true);
        // fills d, c, b — stops at a (already on)
        expect([...selection].sort()).toEqual(['a', 'b', 'c', 'd']);
        expect(sel.anchor).toBe('d');
    });

    it('with no boundary it fills to the top of the list', () => {
        press('c', true);
        expect([...selection].sort()).toEqual(['a', 'b', 'c']);
    });

    it('a key outside the order just toggles itself', () => {
        sel.press({shiftKey: true}, 'zz', ORDER);
        expect([...selection]).toEqual(['zz']);
    });
});

describe('drag painting', () => {
    it('paints the press result onto every crossed row and moves the anchor', () => {
        press('a');                  // arms an ON drag
        expect(sel.dragging).toBe(true);
        sel.paint('b');
        sel.paint('c');
        expect([...selection].sort()).toEqual(['a', 'b', 'c']);
        expect(sel.anchor).toBe('c');
    });

    it('an OFF press paints deselection', () => {
        selection = new Set(['a', 'b', 'c']);
        press('a');                  // a was on → result off
        sel.paint('b');
        expect([...selection]).toEqual(['c']);
    });

    it('painting a row already in the target state commits nothing', () => {
        press('a');
        const committed = selection;
        sel.paint('a');              // already on
        expect(selection).toBe(committed);
    });

    it('end() stops the drag; paint() after it is a no-op', () => {
        press('a');
        sel.end();
        expect(sel.dragging).toBe(false);
        sel.paint('b');
        expect([...selection]).toEqual(['a']);
    });

    it('reset() forgets anchor and drag (list/stage change)', () => {
        press('a');
        sel.reset();
        expect(sel.anchor).toBe(null);
        expect(sel.dragging).toBe(false);
    });
});

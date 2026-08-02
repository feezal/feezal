// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal editor
/**
 * A37 — canvas geometry & stacking helpers.
 *
 * Pure functions over canvas DOM: what counts as a canvas element, the U33
 * DOM-order stacking model, and the B80 absolute↔container geometry hand-off.
 * They were already module-scope exports inside feezal-sidebar-inspector.js;
 * this is a move, not a rewrite, so the inspector shrinks by everything that
 * never needed its instance state.
 */

// U32: everything the canvas machinery treats as a first-class element —
// regular feezal elements plus component instances. Stamped children inside a
// <feezal-component> are direct children of the instance (not the view), so
// they are never enumerated or wired.
export const isCanvasElement = el =>
    Boolean(el.localName) && (el.localName.startsWith('feezal-element-') || el.localName === 'feezal-component');

/**
 * Every canvas overlay a gesture can leave behind: the N11 edge guides and the
 * U89 gap guides.
 *
 * One selector because there are three places that must hide ALL of them — drag
 * end, palette drop, and a modifier key changing mid-gesture — and B112/B113
 * turned the gap markers into pools. The fixed id lists those places carried
 * silently stopped covering the second axis and the helper lines the moment the
 * pools appeared, which is a stale-overlay bug nothing would have caught.
 */
export const SNAP_OVERLAY_SELECTOR =
    '#vsnap1, #vsnap2, #hsnap1, #hsnap2, .gap-arrow, .gap-vline, .gap-hline';

/** Hide every snap/gap overlay inside `root` (no-op when there is no root). */
export function hideSnapOverlays(root) {
    for (const el of root?.querySelectorAll?.(SNAP_OVERLAY_SELECTOR) || []) {
        el.style.display = 'none';
    }
}

// U33: canvas stacking is DOM order, period. Drag gestures write inline
// z-index (the lift uses 9999) that would pollute saved sites and silently
// defeat DOM-order stacking; sites saved before A38 also carry DragSelect's
// cumulative +1/-1-per-select junk, which this self-heals. Live on the canvas
// an injected !important rule neutralizes any inline z-index (see the editor
// style below); at save time this helper removes it from the serialized clone
// so views.html stays clean. z-index on canvas elements is editor-managed —
// hand-set values do not survive a save.
export function stripCanvasZIndex(root) {
    root.querySelectorAll('.feezal-editable').forEach(el => {
        el.style.zIndex = '';
    });
}

// ── U33: element stacking order — pure DOM-order helpers ───────────────────
// Stacking is DOM sibling order (no z-index): a later sibling paints on top.
// Only .feezal-editable siblings count; non-element nodes (the U25
// <style id="feezal-classes"> block, text nodes) never paint and are skipped.
// Exported for tests.

/** Editable siblings of a view, in DOM (= paint) order. */
export function stackingSiblings(view) {
    return [...view.children].filter(el => el.classList.contains('feezal-editable'));
}

/** The selection in DOM order, restricted to editable elements of the view. */
function _selectionInDomOrder(view, elements) {
    const siblings = stackingSiblings(view);
    return siblings.filter(el => elements.includes(el));
}

/**
 * What the current selection can do — drives menu enable/disable.
 * front/back are enabled unless the selection already IS the contiguous
 * tail/head of the editable siblings; forward/backward need a non-selected
 * editable sibling beyond the selection's last/first element.
 */
export function stackingState(view, elements) {
    const siblings = stackingSiblings(view);
    const selection = _selectionInDomOrder(view, elements);
    if (selection.length === 0 || selection.length === siblings.length) {
        return {canFront: false, canBack: false, canForward: false, canBackward: false};
    }
    const lastIdx = siblings.indexOf(selection[selection.length - 1]);
    const firstIdx = siblings.indexOf(selection[0]);
    const canForward = siblings.slice(lastIdx + 1).some(el => !selection.includes(el));
    const canBackward = siblings.slice(0, firstIdx).some(el => !selection.includes(el));
    const isTail = siblings.slice(-selection.length).every(el => selection.includes(el));
    const isHead = siblings.slice(0, selection.length).every(el => selection.includes(el));
    return {canFront: !isTail, canBack: !isHead, canForward, canBackward};
}

/**
 * Reorder the selected elements within their view.
 * @param {'front'|'back'|'forward'|'backward'} direction
 * @returns {boolean} whether anything moved
 *
 * Multi-selections move as a block preserving their relative order;
 * forward/backward step across ONE non-selected editable sibling (the
 * obstacle is moved across the selection, so one step = one paint layer).
 */
export function reorderElements(view, elements, direction) {
    const state = stackingState(view, elements);
    const selection = _selectionInDomOrder(view, elements);
    const siblings = stackingSiblings(view);

    switch (direction) {
        case 'front':
            if (!state.canFront) return false;
            selection.forEach(el => view.append(el));
            return true;
        case 'back':
            if (!state.canBack) return false;
            [...selection].reverse().forEach(el => view.prepend(el));
            return true;
        case 'forward': {
            if (!state.canForward) return false;
            const lastIdx = siblings.indexOf(selection[selection.length - 1]);
            const obstacle = siblings.slice(lastIdx + 1).find(el => !selection.includes(el));
            selection[0].before(obstacle);
            return true;
        }
        case 'backward': {
            if (!state.canBackward) return false;
            const firstIdx = siblings.indexOf(selection[0]);
            const obstacle = siblings.slice(0, firstIdx).reverse().find(el => !selection.includes(el));
            selection[selection.length - 1].after(obstacle);
            return true;
        }
    }
    return false;
}

// ── B80: absolute ↔ flow geometry hand-off ──────────────────────────────────
// Flow lays elements out by the flex container, so their absolute offsets have
// to come off the inline style — but they must not be LOST, or switching back
// piles everything at 0,0. They are parked on data-abs-* instead, which
// survives save/deploy (like data-group) and is stripped at delivery.
const ABS_TOP = 'data-abs-top';
const ABS_LEFT = 'data-abs-left';

export function stashAbsoluteGeometry(element) {
    const top = element.style.top;
    const left = element.style.left;
    // Only stash a real absolute offset; an element born in flow has none, and
    // overwriting an existing stash with '' would destroy it.
    if (top) element.setAttribute(ABS_TOP, top);
    if (left) element.setAttribute(ABS_LEFT, left);
}

export function restoreAbsoluteGeometry(element) {
    // An element that already carries inline offsets is not coming from flow.
    if (element.style.top || element.style.left) return;

    const top = element.getAttribute(ABS_TOP);
    const left = element.getAttribute(ABS_LEFT);
    if (top || left) {
        if (top) element.style.top = top;
        if (left) element.style.left = left;
        element.removeAttribute(ABS_TOP);
        element.removeAttribute(ABS_LEFT);
        return;
    }

    // No stash: born in flow, or legacy HTML saved before B80. Freeze the
    // element where it is currently RENDERED, so the switch looks like nothing
    // moved instead of collapsing the whole view into the top-left corner.
    const view = element.parentElement;
    if (!view || typeof element.getBoundingClientRect !== 'function') return;
    const r = element.getBoundingClientRect();
    const vr = view.getBoundingClientRect();
    if (!r.width && !r.height) return;          // not laid out (detached/hidden)
    element.style.top = `${Math.round(r.top - vr.top)}px`;
    element.style.left = `${Math.round(r.left - vr.left)}px`;
}

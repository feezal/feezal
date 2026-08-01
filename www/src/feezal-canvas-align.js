/**
 * U83 — alignment, distribution and size-matching for a canvas multi-selection.
 *
 * Pure geometry: every function takes plain boxes and returns the boxes that
 * must CHANGE, so the whole engine is unit-testable without a DOM. The caller
 * (feezal-sidebar-inspector) reads geometry off the elements, applies the
 * returned patches to their inline styles and takes ONE undo snapshot.
 *
 * Conventions:
 *  - a box is {id, left, top, width, height}; `id` is whatever the caller uses
 *    to map back to its element (the element itself works).
 *  - only ABSOLUTELY positioned elements can be aligned; a flow view lays its
 *    children out itself, so the caller filters those out first.
 *  - locked elements are never moved — the caller filters them and reports the
 *    skipped count.
 *  - a patch is {id, left?, top?, width?, height?} carrying only what changed;
 *    an operation that would move nothing returns [].
 */

/** The bounding box of a set of boxes. */
export function selectionBounds(boxes) {
    if (!boxes.length) return null;
    const left = Math.min(...boxes.map(b => b.left));
    const top = Math.min(...boxes.map(b => b.top));
    const right = Math.max(...boxes.map(b => b.left + b.width));
    const bottom = Math.max(...boxes.map(b => b.top + b.height));
    return {left, top, right, bottom, width: right - left, height: bottom - top};
}

/** Drop no-op patches so an operation that changes nothing is reported as []. */
function changed(patches) {
    return patches.filter(p =>
        ('left' in p && Math.round(p.left) !== Math.round(p._was.left)) ||
        ('top' in p && Math.round(p.top) !== Math.round(p._was.top)) ||
        ('width' in p && Math.round(p.width) !== Math.round(p._was.width)) ||
        ('height' in p && Math.round(p.height) !== Math.round(p._was.height)))
        .map(({_was, ...patch}) => patch);
}

export const ALIGN_MODES = ['left', 'hcenter', 'right', 'top', 'vcenter', 'bottom'];

/**
 * Align boxes to a reference frame.
 *
 * @param {Array} boxes    the selection
 * @param {string} mode    one of ALIGN_MODES
 * @param {object} [frame] the frame to align INTO — the view box when aligning
 *                         a single element to its view; defaults to the
 *                         selection's own bounds (the multi-selection case).
 */
export function align(boxes, mode, frame = null) {
    if (!boxes.length) return [];
    const f = frame || selectionBounds(boxes);
    if (!f) return [];
    const right = f.right ?? (f.left + f.width);
    const bottom = f.bottom ?? (f.top + f.height);

    return changed(boxes.map(b => {
        const patch = {id: b.id, _was: b};
        switch (mode) {
            case 'left':    patch.left = f.left; break;
            case 'right':   patch.left = right - b.width; break;
            case 'hcenter': patch.left = f.left + ((right - f.left) - b.width) / 2; break;
            case 'top':     patch.top = f.top; break;
            case 'bottom':  patch.top = bottom - b.height; break;
            case 'vcenter': patch.top = f.top + ((bottom - f.top) - b.height) / 2; break;
            default: break;
        }
        return patch;
    }));
}

/**
 * Distribute boxes so the GAPS between them are equal, keeping the two
 * outermost elements where they are (the standard behaviour: the extent of the
 * selection never changes). Needs at least 3 boxes — with 2 there is one gap
 * and nothing to equalize.
 *
 * @param {'horizontal'|'vertical'} axis
 */
export function distribute(boxes, axis) {
    if (boxes.length < 3) return [];
    const horizontal = axis === 'horizontal';
    const start = b => (horizontal ? b.left : b.top);
    const size = b => (horizontal ? b.width : b.height);

    const sorted = [...boxes].sort((a, b) => start(a) - start(b));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const span = (start(last) + size(last)) - start(first);
    const totalSize = sorted.reduce((sum, b) => sum + size(b), 0);
    // Negative when the elements overlap more than the span allows — the gap
    // simply goes negative, which still spaces them evenly (and predictably).
    const gap = (span - totalSize) / (sorted.length - 1);

    let cursor = start(first);
    return changed(sorted.map((b, i) => {
        const patch = {id: b.id, _was: b};
        // The outermost two keep their exact position (no rounding drift).
        if (i === 0 || i === sorted.length - 1) {
            cursor = (i === 0 ? start(b) : cursor) + size(b) + gap;
            if (horizontal) patch.left = start(b); else patch.top = start(b);
            return patch;
        }
        if (horizontal) patch.left = cursor; else patch.top = cursor;
        cursor += size(b) + gap;
        return patch;
    }));
}

/**
 * Give every box the size of a reference box (the FIRST selected element —
 * the same convention as every design tool: the anchor is what you picked
 * first). Position is untouched.
 *
 * @param {'width'|'height'|'both'} what
 */
export function matchSize(boxes, what, referenceId = null) {
    if (boxes.length < 2) return [];
    const ref = referenceId === null
        ? boxes[0]
        : boxes.find(b => b.id === referenceId) || boxes[0];

    return changed(boxes.map(b => {
        const patch = {id: b.id, _was: b};
        if (what === 'width' || what === 'both') patch.width = ref.width;
        if (what === 'height' || what === 'both') patch.height = ref.height;
        return patch;
    }));
}

/** Human label for the toast/report line ("Aligned 4 elements", …). */
export function operationLabel(op, count, skipped = 0) {
    const noun = `${count} element${count === 1 ? '' : 's'}`;
    const tail = skipped ? ` (${skipped} locked skipped)` : '';
    const verbs = {
        left: 'Aligned left', hcenter: 'Centred horizontally', right: 'Aligned right',
        top: 'Aligned top', vcenter: 'Centred vertically', bottom: 'Aligned bottom',
        horizontal: 'Distributed horizontally', vertical: 'Distributed vertically',
        width: 'Matched width', height: 'Matched height', both: 'Matched size',
    };
    return `${verbs[op] || 'Changed'} — ${noun}${tail}`;
}

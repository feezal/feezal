// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal editor
/**
 * U89 — equal-gap detection for the canvas drag.
 *
 * U83 gave the explicit Distribute operation; this is the live hint, so a row
 * can be laid out by hand without invoking it. The core case is **neighbour-gap
 * propagation**: when the dragged element approaches a stationary element, look
 * at THAT element's gap to its own next neighbour on the other side, and
 * propose the same gap on this side. Dropping a third card beside two cards
 * spaced 16px apart proposes 16px — rows grow with a consistent rhythm without
 * anyone measuring anything.
 *
 * Two decisions the roadmap left open, settled here:
 *
 * 1. **How far to look: the adjacent pair only.** A candidate needs an anchor
 *    and that anchor's other-side neighbour — two stationary elements. Scanning
 *    the whole row would offer gaps that are not visually adjacent to where the
 *    pointer is, which reads as the canvas guessing rather than helping.
 * 2. **Only elements sharing the row/column count.** A gap between boxes that
 *    do not overlap on the cross axis is not a gap anyone can see, so the
 *    overlap test is what keeps the proposals meaningful.
 *
 * Pure geometry: boxes in, candidates out. The caller supplies boxes in one
 * coordinate space and decides what to do with the result (draw arrows, snap).
 */

/**
 * How many markers the canvas has to hold — derived here rather than guessed in
 * the template, because it follows straight from the candidate shape above.
 *
 * Every candidate draws TWO spans (the gap a neighbour pair already has, and
 * the one being proposed), and B112 draws both axes at once, so four arrows.
 *
 * Helper lines: B113 put one at every span END (four per axis), B116 cut that
 * to the single line the dragged element's own edge lands on — the arrows
 * already tell the between-which-edges story, so the other three were noise.
 * One per axis, and the two axes need different orientations, hence a pool each
 * of exactly one.
 */
export const GAP_ARROW_COUNT = 4;
export const GAP_LINE_COUNT = 1;

/** Do two boxes overlap on the axis ACROSS the one being measured? */
function sharesLane(a, b, axis) {
    return axis === 'x'
        ? a.top < b.bottom && a.bottom > b.top
        : a.left < b.right && a.right > b.left;
}

const lead = (box, axis) => (axis === 'x' ? box.left : box.top);
const trail = (box, axis) => (axis === 'x' ? box.right : box.bottom);
const size = (box, axis) => trail(box, axis) - lead(box, axis);

/**
 * Equal-gap candidates for one axis.
 *
 * @param {object} dragged  the moving box (only its SIZE matters — its position
 *                          is what we are proposing)
 * @param {object[]} others stationary boxes
 * @param {'x'|'y'} axis
 * @param {object} [opts]
 * @param {number} [opts.minGap=1]  ignore touching/overlapping pairs: a 0px gap
 *                                  proposes "stack them", which is noise
 * @returns {Array<{lead:number, gap:number, anchor:object, reference:object,
 *                  measured:{from:number,to:number}, proposed:{from:number,to:number},
 *                  side:'after'|'before'}>}
 *   `lead` is where the dragged box's leading edge would go.
 */
export function equalGapCandidates(dragged, others, axis, {minGap = 1} = {}) {
    const span = size(dragged, axis);
    const lane = others.filter(o => sharesLane(dragged, o, axis));
    const out = [];

    for (const anchor of lane) {
        // …the anchor's neighbours on each side, nearest first.
        const before = lane.filter(o => o !== anchor && trail(o, axis) <= lead(anchor, axis))
            .sort((a, b) => trail(b, axis) - trail(a, axis))[0];
        const after = lane.filter(o => o !== anchor && lead(o, axis) >= trail(anchor, axis))
            .sort((a, b) => lead(a, axis) - lead(b, axis))[0];

        // Place AFTER the anchor, echoing the gap it already has BEFORE it.
        if (before) {
            const gap = lead(anchor, axis) - trail(before, axis);
            if (gap >= minGap) {
                out.push({
                    lead: trail(anchor, axis) + gap,
                    gap, anchor, reference: before, side: 'after', kind: 'rhythm',
                    measured: {from: trail(before, axis), to: lead(anchor, axis)},
                    proposed: {from: trail(anchor, axis), to: trail(anchor, axis) + gap},
                });
            }
        }
        // …and the mirror: place BEFORE the anchor, echoing its gap AFTER.
        if (after) {
            const gap = lead(after, axis) - trail(anchor, axis);
            if (gap >= minGap) {
                out.push({
                    lead: lead(anchor, axis) - gap - span,
                    gap, anchor, reference: after, side: 'before', kind: 'rhythm',
                    measured: {from: trail(anchor, axis), to: lead(after, axis)},
                    proposed: {from: lead(anchor, axis) - gap, to: lead(anchor, axis)},
                });
            }
        }
    }
    return out;
}

/**
 * Centred candidates: drop an element BETWEEN two others and get equal gaps on
 * both sides.
 *
 * The propagation case above needs an existing rhythm to echo. Dropping into a
 * hole between two elements has no rhythm to copy — what people want there is
 * the middle, and "equal gap left and right" is exactly the same idea measured
 * differently. So it is the same candidate shape, and the two arrows drawn for
 * it are the left and right gaps, which are equal at the proposed position.
 *
 * @returns candidates with `kind: 'centered'`
 */
export function centeredCandidates(dragged, others, axis, {minGap = 1} = {}) {
    const span = size(dragged, axis);
    const lane = others
        .filter(o => sharesLane(dragged, o, axis))
        .sort((a, b) => lead(a, axis) - lead(b, axis));
    const out = [];

    for (let i = 0; i + 1 < lane.length; i++) {
        const before = lane[i];
        const after = lane[i + 1];
        const free = lead(after, axis) - trail(before, axis);
        const gap = (free - span) / 2;
        // A hole too small for the element (or for a visible gap) is not an offer.
        if (gap < minGap) continue;
        const start = trail(before, axis) + gap;
        out.push({
            lead: start, gap, anchor: before, reference: after,
            side: 'between', kind: 'centered',
            measured: {from: trail(before, axis), to: start},
            proposed: {from: start + span, to: lead(after, axis)},
        });
    }
    return out;
}

/**
 * The candidate the dragged box is closest to, within `range`.
 *
 * Ties break toward the SMALLER gap: when two rhythms are equally close, the
 * tighter one is the one the user is more likely to be continuing, and picking
 * deterministically keeps the guide from flickering between two answers on
 * consecutive frames.
 */
export function bestEqualGap(dragged, others, axis, {range = 8, minGap = 1} = {}) {
    const current = lead(dragged, axis);
    const candidates = [
        ...equalGapCandidates(dragged, others, axis, {minGap}),
        ...centeredCandidates(dragged, others, axis, {minGap}),
    ];
    let best = null;
    for (const candidate of candidates) {
        const distance = Math.abs(candidate.lead - current);
        if (distance > range) continue;
        // Nearer wins; on a tie prefer echoing an existing rhythm over
        // centring, then the smaller gap — deterministic either way, so the
        // guide cannot flicker between two answers on consecutive frames.
        const better = !best
            || distance < best.distance
            || (distance === best.distance && best.kind === 'centered' && candidate.kind !== 'centered')
            || (distance === best.distance && best.kind === candidate.kind && candidate.gap < best.gap);
        if (better) best = {...candidate, distance};
    }
    return best;
}

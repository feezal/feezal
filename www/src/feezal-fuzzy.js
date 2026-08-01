/**
 * Tiny subsequence fuzzy matcher (U87).
 *
 * "temp" matches "Kitchen temperature" and "home/kt/temp_c"; "ktemp" matches
 * "Kitchen temperature" too (the letters appear in order, not necessarily
 * adjacent). Scoring rewards matches that are contiguous, at a word boundary
 * and early in the string, so the obvious hit sorts first.
 *
 * Deliberately dependency-free and ~40 lines: the alternative was pulling in
 * fuse.js for one filter box.
 */

/**
 * @param {string} needle  the user's query (already trimmed)
 * @param {string} haystack
 * @returns {number} 0 = no match, higher = better
 */
export function fuzzyScore(needle, haystack) {
    if (!needle) return 1;
    const n = needle.toLowerCase();
    const h = String(haystack || '').toLowerCase();
    if (!h) return 0;

    // A plain substring hit always beats a scattered one.
    const direct = h.indexOf(n);
    if (direct !== -1) {
        const boundary = direct === 0 || /[\s/_\-.:]/.test(h[direct - 1]);
        return 1000 - direct + (boundary ? 200 : 0) + n.length * 10;
    }

    let score = 0;
    let hi = 0;
    let streak = 0;
    for (const ch of n) {
        const found = h.indexOf(ch, hi);
        if (found === -1) return 0;                 // not a subsequence → no match
        const boundary = found === 0 || /[\s/_\-.:]/.test(h[found - 1]);
        streak = found === hi ? streak + 1 : 0;     // contiguous run
        score += 10 + streak * 5 + (boundary ? 15 : 0) - Math.min(found - hi, 10);
        hi = found + 1;
    }
    return Math.max(1, score);
}

/**
 * Best score across several haystacks (name, label, topics…), so an element
 * matches on whichever field the user had in mind.
 */
export function fuzzyScoreAny(needle, haystacks) {
    let best = 0;
    for (const h of haystacks) {
        const s = fuzzyScore(needle, h);
        if (s > best) best = s;
    }
    return best;
}

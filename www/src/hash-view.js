/**
 * View-name ↔ location.hash helpers (B30).
 *
 * Browsers percent-encode non-ASCII characters when a hash is assigned:
 * setting `#/Küche` reads back as `#/K%C3%BCche`. Reading the hash without
 * decoding makes the view lookup fail for names with umlauts (falling back
 * to the default view), and raw comparisons against an expected hash never
 * match (re-writing the hash on every switch). Always read the view name
 * through viewFromHash(); writing `location.hash = '/' + name` is fine —
 * the browser does the encoding.
 */

const _dec = s => {
    try { return decodeURIComponent(s); } catch { return s; } // stray % → literal
};

/**
 * N30: split the hash into `{view, embedded}`.
 * `#/<view>` → {view, embedded: null}; `#/<view>/<embedded>` deep-links into a
 * layout-app shell on `<view>` and activates its `<embedded>` drawer entry.
 * The separator is the first *raw* slash (never percent-encoded), so each
 * segment is decoded independently — umlauts in either name round-trip (B30).
 */
export function viewPathFromHash(hash = location.hash) {
    const raw = hash.replace(/^#\/?/, '');
    const slash = raw.indexOf('/');
    if (slash < 0) return {view: _dec(raw), embedded: null};
    return {view: _dec(raw.slice(0, slash)), embedded: _dec(raw.slice(slash + 1)) || null};
}

/** Top-level view name carried in the given (default: current) location hash. */
export function viewFromHash(hash = location.hash) {
    return viewPathFromHash(hash).view;
}

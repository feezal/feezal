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

/** View name carried in the given (default: current) location hash. */
export function viewFromHash(hash = location.hash) {
    const raw = hash.replace(/^#\/?/, '');
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw; // stray % — treat as literal
    }
}

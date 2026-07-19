/**
 * @feezal/feezal-lottie — shared lazy loader for lottie-web (E89 / E39).
 *
 * Intentionally NOT named `feezal-element-*`: the server's package scan treats
 * every `feezal-element-*` directory as a dashboard element and would try to
 * palette/bundle it (see server/src/build/elements.js `_scan()`). This is a
 * pure code-sharing package, same precedent as `@feezal/feezal-glass`.
 *
 * This module owns the ONE dynamic `import('lottie-web')` site in the codebase.
 * Both `feezal-element-basic-lottie` and the splash element (E39, its `lottie`
 * attribute) call `loadLottie()`, so the ~250 kB lottie-web dependency lands in
 * a single on-demand Rollup chunk that is fetched only when a dashboard
 * actually needs a Lottie animation — never in the base viewer/export payload.
 *
 * The import is memoised: the first call starts the fetch, every later call
 * (from either consumer, or a second element instance) resolves to the same
 * cached promise, so the chunk is downloaded and evaluated at most once.
 */

let _promise = null;

/**
 * Lazily load lottie-web (once). Resolves to the lottie factory (the default
 * export — the object exposing `loadAnimation(...)`).
 *
 * @returns {Promise<import('lottie-web').default>}
 */
export function loadLottie() {
    if (_promise) {
        return _promise;
    }
    // Explicit string literal so Rollup can statically analyse it and emit a
    // proper lazy chunk (a variable-based import() would defeat code-splitting).
    _promise = import('lottie-web').then(mod => mod.default ?? mod);
    return _promise;
}

/**
 * Test seam — pre-seed (or reset) the memoised factory so component tests can
 * inject a fake lottie factory and never fetch/evaluate the real library.
 * Passing a factory resolves `loadLottie()` to it; passing nothing clears the
 * cache. Not used in production code.
 *
 * @param {object|null} factory
 */
export function __setLottieFactoryForTests(factory) {
    _promise = factory ? Promise.resolve(factory) : null;
}

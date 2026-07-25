/**
 * A31 W3 — files excluded from every www coverage report.
 *
 * Shared by vitest.config.mjs (logic-unit) and vitest.browser.config.mjs
 * (component) so the two suites measure the SAME denominator — otherwise the
 * merged report (scripts/coverage-merge.mjs) would count a file only because
 * one of the two configs happened to include it.
 *
 * Only generated, vendored or entry-point code belongs here: it is untestable
 * by construction and sat at 0 % inside the include, dragging the ratio down.
 * Anything with a real test stays in, even if that test is thin.
 */
export const COVERAGE_EXCLUDE = [
    // Generated: the Material icon-name table (scripts/, not hand-written).
    'src/material-design-icons.js',
    // Vendored: the trimmed Monaco entry re-export. (feezal-monaco-loader.js
    // is NOT excluded — it is hand-written and has its own unit test.)
    'src/monaco-slim.js',
    // Bundle entry point — a few import statements, nothing to assert.
    'src/viewer-main.js',
    // Never source: fixtures, generated manifests, nested installs.
    'editor/feezal-elements.js',
    '**/node_modules/**',
    '**/*.config.*',
    '**/test/**',
    '**/test-browser/**',
    '**/test-e2e/**'
];

import {defineConfig} from 'vitest/config';

// Frontend logic-unit tests (A17 phase 2) — pure-logic paths of the editor and
// viewer components, run in happy-dom (no rendering assertions, no browser).
// Component tests in real browsers (Vitest browser mode) are a later phase.
export default defineConfig({
    test: {
        environment: 'happy-dom',
        include: ['test/**/*.test.js'],
        setupFiles: ['test/setup.js'],
        coverage: {
            provider: 'v8',
            // lcov for the Codecov upload, text/html for humans
            reporter: ['text', 'html', 'lcov'],
            include: [
                'src/**/*.js',
                // The element SDK base class — the foundation every element
                // builds on, held to (near) full coverage below.
                'packages/@feezal/feezal-element/feezal-element.js'
            ],
            // A17 ratchet: this measures the happy-dom logic-unit layer only —
            // the big Lit UI files are exercised by the browser/E2E layers,
            // which v8 coverage doesn't see. Floors sit just below current
            // values (20.5/15.5/18/21.5 as of the feezal-element base-class
            // tests). Raise, never lower.
            thresholds: {
                statements: 20,
                branches: 15,
                functions: 17,
                lines: 21,
                // Per-file ratchet: the element base class stays at (near)
                // 100% — it underpins every element package.
                'packages/@feezal/feezal-element/feezal-element.js': {
                    statements: 100,
                    branches: 95,
                    functions: 100,
                    lines: 100
                }
            }
        }
    }
});

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
            include: ['src/**/*.js'],
            // A17 ratchet: this measures the happy-dom logic-unit layer only —
            // the big Lit UI files are exercised by the browser/E2E layers,
            // which v8 coverage doesn't see. Floors sit just below current
            // values (16/11/13/17 as of the connection/viewer/history-bar
            // tests). Raise, never lower.
            thresholds: {
                statements: 15,
                branches: 10,
                functions: 12,
                lines: 16
            }
        }
    }
});

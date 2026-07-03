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
            include: ['src/**/*.js'],
            // A17 ratchet: this measures the happy-dom logic-unit layer only —
            // the big Lit UI files are exercised by the browser/E2E layers,
            // which v8 coverage doesn't see. Floors sit just below current
            // values (10/7/7/11 at introduction). Raise, never lower.
            thresholds: {
                statements: 9,
                branches: 6,
                functions: 6,
                lines: 9
            }
        }
    }
});

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
                'packages/@feezal/feezal-element/feezal-element.js'
            ]
            // No coverage thresholds — CI never fails on coverage; the
            // reporters above still publish the numbers to Codecov / html.
        }
    }
});

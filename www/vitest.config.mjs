import {defineConfig} from 'vitest/config';
import {COVERAGE_EXCLUDE} from './coverage-exclude.mjs';

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
            // A31 W2 — the include used to be `src/**` plus the single file
            // feezal-element.js, so the ~15 unit tests that drive shared
            // packages/@feezal logic (the controllers, the settling machinery,
            // the conditions engine, the Homematic fault table…) had their
            // coverage DISCARDED. Those modules are counted now.
            //
            // Deliberately NOT `packages/@feezal/**`: the element packages are
            // exercised by the browser suite, and pulling their ~49k LOC into
            // this suite's denominator would misreport what these tests cover.
            // The browser config includes them; the merged report
            // (scripts/coverage-merge.mjs) unions the two.
            include: [
                'src/**/*.js',
                'packages/@feezal/feezal-element/*.js',
                'packages/@feezal/feezal-controller-*/*.js'
            ],
            exclude: [...COVERAGE_EXCLUDE]
            // No coverage thresholds here — the floor is enforced once, on the
            // MERGED number, by scripts/coverage-merge.mjs.
        }
    }
});

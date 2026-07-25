import {defineConfig} from 'vitest/config';
import {playwright} from '@vitest/browser-playwright';
import {COVERAGE_EXCLUDE} from './coverage-exclude.mjs';

// Frontend component tests (A17 phase 3) — real web components in real
// browsers via Vitest browser mode: shadow DOM, Lit lifecycle, ::slotted
// styling, MutationObserver.  Run with `npm run test:browser`.
//
// Browsers default to chromium; set FEEZAL_TEST_BROWSERS=chromium,firefox,webkit
// to run the matrix (CI does). Binaries: `npx playwright install <browser>`
// (CI adds --with-deps for system libraries).
//
// WSL note: Chromium needs libnss3 + libnspr4 (`sudo apt-get install -y
// libnss3 libnspr4`).  Without root, extract the debs to ~/pw-libs and export
// LD_LIBRARY_PATH=$HOME/pw-libs/extracted/usr/lib/x86_64-linux-gnu instead.
// firefox/webkit need more system libraries — prefer CI for the full matrix.
const browsers = (process.env.FEEZAL_TEST_BROWSERS || 'chromium')
    .split(',').map(s => s.trim()).filter(Boolean);

// A31 W1: vitest's v8 coverage provider reads Chromium's CDP profiler, so it
// cannot instrument firefox/webkit. A `--coverage` run is therefore pinned to
// chromium here rather than in the npm script — that keeps the script free of
// a cross-platform env-var prefix (no cross-env dependency), and makes the
// constraint impossible to bypass by exporting FEEZAL_TEST_BROWSERS.
const collectingCoverage = process.argv.includes('--coverage');
const instances = (collectingCoverage ? ['chromium'] : browsers).map(browser => ({browser}));

export default defineConfig({
    // The element smoke harness imports every element package at once; warm
    // the dep optimizer so vite does not reload mid-run on a cold cache.
    optimizeDeps: {
        include: [
            'lit', 'lit/directives/unsafe-html.js', 'leaflet',
            '@shoelace-style/shoelace/dist/components/input/input.js',
            '@shoelace-style/shoelace/dist/components/select/select.js',
            '@shoelace-style/shoelace/dist/components/option/option.js',
            '@shoelace-style/shoelace/dist/components/switch/switch.js',
            '@material/web/checkbox/checkbox.js',
            '@material/web/chips/filter-chip.js',
            '@material/web/icon/icon.js',
            '@material/web/iconbutton/icon-button.js',
            '@material/web/slider/slider.js',
            '@material/web/fab/fab.js',
            '@material/web/textfield/outlined-text-field.js',
            '@material/web/progress/linear-progress.js',
            '@material/web/select/outlined-select.js',
            '@material/web/select/select-option.js',
            '@material/web/radio/radio.js',
            '@polymer/polymer/polymer-element.js',
            '@polymer/paper-icon-button/paper-icon-button.js',
            '@polymer/paper-button/paper-button',
            '@polymer/paper-dropdown-menu/paper-dropdown-menu',
            '@polymer/paper-item/paper-item',
            '@polymer/paper-listbox/paper-listbox',
            '@polymer/paper-checkbox',
            '@polymer/paper-slider',
            '@polymer/paper-tabs/paper-tabs',
            '@polymer/paper-tabs/paper-tab',
            '@polymer/paper-toggle-button',
            'date-fns-tz', 'date-fns/locale'
        ]
    },
    test: {
        include: ['test-browser/**/*.test.js'],
        browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances,
            screenshotFailures: false
        },
        // A31 W1 — the biggest measurement gap: 65 test files exercise the
        // ~49k LOC of packages/@feezal/* elements (the smoke harness alone
        // mounts every installed package), and none of it was counted because
        // this config had no coverage block. Opt-in via `--coverage`
        // (`npm run test:browser:coverage`) so the plain matrix run stays
        // uninstrumented.
        //
        // v8 in browser mode is Chromium-only (it reads CDP coverage), so a
        // --coverage run is pinned to chromium above. The firefox / webkit
        // matrix keeps running without coverage — it is there to catch engine
        // differences, not to add lines.
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            reportsDirectory: 'coverage-browser',
            include: [
                'src/**/*.js',
                'packages/@feezal/**/*.js'
            ],
            exclude: [...COVERAGE_EXCLUDE]
            // No coverage thresholds here — the floor is enforced once, on the
            // MERGED number, by scripts/coverage-merge.mjs.
        }
    }
});

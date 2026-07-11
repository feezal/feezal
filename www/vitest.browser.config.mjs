import {defineConfig} from 'vitest/config';
import {playwright} from '@vitest/browser-playwright';

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
            instances: browsers.map(browser => ({browser})),
            screenshotFailures: false
        }
    }
});

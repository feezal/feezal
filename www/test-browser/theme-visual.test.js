/**
 * Theme regression tests — every built-in theme package, applied for real.
 *
 * Two layers:
 *  1. Functional: each theme class resolves the core CSS custom properties
 *    and themes are actually distinct from one another.
 *  2. Visual: a text-free swatch grid of the core variables per theme is
 *    screenshot-compared against committed baselines. Solid colour rects
 *    render byte-identically for a pinned chromium on linux, so this runs
 *    only there (local WSL and CI use the same playwright chromium).
 *
 * Refresh baselines after an intentional theme change:
 *   npm run test:browser -- --update test-browser/theme-visual.test.js
 */
import {describe, it, expect} from 'vitest';
import {page, server} from '@vitest/browser/context';

import '@feezal/feezal-theme-blue-night';
import '@feezal/feezal-theme-dark-mint';
import '@feezal/feezal-theme-dark-orange';
import '@feezal/feezal-theme-gruvbox-dark';
import '@feezal/feezal-theme-gruvbox-light';
import '@feezal/feezal-theme-light-orange';
import '@feezal/feezal-theme-midnight-blue';
import '@feezal/feezal-theme-solarized-dark';
import '@feezal/feezal-theme-solarized-light';

const THEMES = [
    'feezal-theme-blue-night',
    'feezal-theme-dark-mint',
    'feezal-theme-dark-orange',
    'feezal-theme-gruvbox-dark',
    'feezal-theme-gruvbox-light',
    'feezal-theme-light-orange',
    'feezal-theme-midnight-blue',
    'feezal-theme-solarized-dark',
    'feezal-theme-solarized-light'
];

// The variables every theme must define (directly or via var() chains) —
// these drive element colours across the board.
const CORE_VARS = [
    '--primary-background-color',
    '--secondary-background-color',
    '--primary-text-color',
    '--secondary-text-color',
    '--primary-color',
    '--accent-color',
    '--disabled-text-color',
    '--divider-color'
];

function themedContainer(theme) {
    const el = document.createElement('div');
    el.className = theme;
    document.body.append(el);
    return el;
}

/** Resolve a custom property to a concrete colour via a probe element. */
function resolveVar(container, name) {
    const probe = document.createElement('div');
    probe.style.color = `var(${name})`;
    container.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
}

describe('theme variables (functional)', () => {
    for (const theme of THEMES) {
        it(`${theme} resolves all core variables`, () => {
            document.body.innerHTML = '';
            const container = themedContainer(theme);
            for (const name of CORE_VARS) {
                const value = resolveVar(container, name);
                // an undefined var leaves color at the default rgb(0, 0, 0)
                // only if the theme genuinely painted black it may legally
                // equal it — require the raw property to be present instead
                const raw = getComputedStyle(container).getPropertyValue(name).trim();
                expect(raw, `${theme} does not define ${name}`).not.toBe('');
                expect(value, `${theme}: ${name} resolves to no colour`).toMatch(/^rgb/);
            }
        });
    }

    it('themes are pairwise distinct on the core palette', () => {
        document.body.innerHTML = '';
        const fingerprints = new Map();
        for (const theme of THEMES) {
            const container = themedContainer(theme);
            fingerprints.set(theme, CORE_VARS.map(v => resolveVar(container, v)).join('|'));
        }
        const seen = new Map();
        for (const [theme, fp] of fingerprints) {
            expect(seen.get(fp), `${theme} has the same palette as ${seen.get(fp)}`).toBeUndefined();
            seen.set(fp, theme);
        }
    });
});

describe('theme swatch screenshots (visual)', () => {
    // Pixel baselines are linux-chromium only (pinned playwright build —
    // identical output in WSL and CI). Other instances skip.
    const canScreenshot = server.browser === 'chromium' && navigator.platform.includes('Linux');

    for (const theme of THEMES) {
        it.runIf(canScreenshot)(`${theme} swatch grid matches the baseline`, async () => {
            document.body.innerHTML = '';
            const container = themedContainer(theme);
            const grid = document.createElement('div');
            grid.style.cssText = 'display:flex;width:360px;height:60px;';
            for (const name of CORE_VARS) {
                const swatch = document.createElement('div');
                swatch.style.cssText = `flex:1;height:60px;background:var(${name});`;
                grid.append(swatch);
            }
            container.append(grid);

            await expect(page.elementLocator(grid)).toMatchScreenshot(`swatches-${theme}`);
        });
    }
});

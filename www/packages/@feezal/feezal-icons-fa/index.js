/* global feezal */
/**
 * @feezal/feezal-icons-fa — Font Awesome Free for feezal (N28).
 *
 * Registers THREE icon sets from one package (the styles are separate
 * namespaces upstream): icon values are
 *
 *   fa-solid:house      fa-regular:heart      fa-brands:github
 *
 * The brands style (~600 logos: GitHub, Spotify, Home Assistant, …) fills a
 * real gap — MDI carries only a shrinking brand set.
 *
 * Render mode (inline SVG), mandatory here: Font Awesome's webfont is
 * class+codepoint based, which cannot reach shadow DOM — and inline SVG
 * follows `currentColor`, so icons track the active feezal theme. FA
 * viewBoxes vary in width (0 0 320…640 512); render() returns unsized SVG
 * and <feezal-icon> sizes it to 1em.
 *
 * This full module is loaded by the editor (the picker offers every icon,
 * one chip per style). Viewer pages and static exports do NOT load it — the
 * server tree-shakes per site and inlines only the icons the site actually
 * uses (see the plural `feezal.sets` field in package.json and
 * docs/icons-spec.md §1/§4a).
 *
 * Icon artwork: Font Awesome Free, CC BY 4.0 (see LICENSE.txt). Generated
 * data modules — regenerate with generate.mjs.
 */
import SOLID from './icons-solid.js';
import REGULAR from './icons-regular.js';
import BRANDS from './icons-brands.js';

feezal.registerIcons('fa-solid', {
    names: Object.keys(SOLID),
    render(name) {
        return SOLID[name] || '';
    }
});

feezal.registerIcons('fa-regular', {
    names: Object.keys(REGULAR),
    render(name) {
        return REGULAR[name] || '';
    }
});

feezal.registerIcons('fa-brands', {
    names: Object.keys(BRANDS),
    render(name) {
        return BRANDS[name] || '';
    }
});

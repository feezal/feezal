/* global feezal */
/**
 * @feezal/feezal-icons-knx-uf — the KNX-User-Forum icon set for feezal (N23).
 *
 * Registers the "knx-uf" icon set: ~940 purpose-built home-automation icons
 * (KNX, HVAC, blinds, sensors, audio, weather, …) from the
 * OpenAutomationProject/knx-uf-iconset. Icon values are `knx-uf:<name>`
 * with the upstream file names (knx-uf:audio_audio, knx-uf:fts_sunblind, …).
 *
 * Render mode: SVGO-optimized inline SVG; the set's fixed white strokes are
 * mapped to currentColor at generation time, so icons follow the active
 * feezal theme instead of being white-only.
 *
 * This full module is loaded by the editor (the picker offers every icon).
 * Viewer pages and static exports do NOT load it — the server tree-shakes
 * per site and inlines only the icons the site actually uses (see the
 * `feezal.icons` field in package.json and docs/icons-spec.md §data module).
 *
 * Icon artwork: CC BY-SA 3.0 DE — see LICENSE.txt and AUTHORS.txt (the
 * attribution travels with this package and with exports embedding it).
 */
import ICONS from './icons.js';

feezal.registerIcons('knx-uf', {
    names: Object.keys(ICONS),
    render(name) {
        return ICONS[name] || '';
    }
});

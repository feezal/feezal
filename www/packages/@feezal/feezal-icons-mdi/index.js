/* global feezal */
/**
 * @feezal/feezal-icons-mdi — Pictogrammers Material Design Icons for feezal (N23).
 *
 * Registers the "mdi" icon set: icon values are `mdi:<name>` with the same
 * kebab-case names Home Assistant uses (mdi:lightbulb, mdi:sofa, …).
 *
 * Render mode (inline SVG) rather than the MDI webfont: the webfont is
 * class+codepoint based, which cannot reach shadow DOM — and inline SVG
 * follows `currentColor`, so icons track the active feezal theme.
 *
 * This full module is loaded by the editor (the picker offers every icon).
 * Viewer pages and static exports do NOT load it — the server tree-shakes
 * per site and inlines only the icons the site actually uses (see the
 * `feezal.icons` field in package.json and docs/icons-spec.md §data module).
 *
 * Icon data: Pictogrammers Material Design Icons, icons Apache License 2.0
 * (see LICENSE). Generated file icons.js — regenerate from @mdi/js.
 */
import ICONS from './icons.js';

feezal.registerIcons('mdi', {
    names: Object.keys(ICONS),
    render(name) {
        return ICONS[name] || '';
    }
});

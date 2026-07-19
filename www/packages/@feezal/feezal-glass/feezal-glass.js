/**
 * @feezal/feezal-glass (E106)
 *
 * Shared code for the Glass card family. Intentionally NOT named
 * `feezal-element-*` — the server's package scan treats every
 * `feezal-element-*` directory as a dashboard element and would try to
 * palette/bundle it (see server/src/build/elements.js `_scan()`). This is a
 * pure code-sharing package, same precedent as `@feezal/feezal-element`.
 *
 * First dedup increment (E106): only logic provably identical across all
 * ten glass card elements today. No CSS, no base class, no descriptors yet
 * — see the E106 roadmap entry for the remaining scope.
 */

/** Size preset → [width, height] px, shared by every glass card's `size`
 * attribute (Auto / 2×2 / 2×1). */
export const GLASS_SIZES = {'2x2': [150, 150], '2x1': [150, 75]};

/** The size grid writes the element's inline geometry (editor keeps full
 * manual control afterwards). Call from `updated()` when `changed.has('size')`. */
export function applySizePreset(el, map = GLASS_SIZES) {
    const p = map[el.size];
    if (p) {
        el.style.width = p[0] + 'px';
        el.style.height = p[1] + 'px';
    }
}

/** Payload comparison: string coercion (case-insensitive) plus boolean
 * true/false matching the HA/z2m ON/OFF conventions. Consolidated from the
 * identical copies in glass-switch and glass-light (glass-contact's copy is
 * case-sensitive and was left local — see E106 roadmap entry). */
export function payloadMatch(value, configured) {
    if (String(value).toLowerCase() === String(configured).toLowerCase()) return true;
    if (value === true && /^(on|true|1|yes)$/i.test(String(configured))) return true;
    if (value === false && /^(off|false|0|no)$/i.test(String(configured))) return true;
    return false;
}

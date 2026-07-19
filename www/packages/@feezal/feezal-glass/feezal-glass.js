import {css} from '@feezal/feezal-element';

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
 * ten glass card elements today (GLASS_SIZES/applySizePreset/payloadMatch).
 *
 * Second increment (E106): `glassCardStyles` below — the frost-chrome CSS
 * fragment shared by the 5 "simple" cards (button/switch/contact/occupancy/
 * sensor). Popup cards (light/climate/cover/fan/wled) and dialogs are a
 * later increment — see the E106 roadmap entry for the remaining scope.
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

/**
 * Shared frost-card chrome for the 5 "simple" glass cards (button, switch,
 * contact, occupancy, sensor). Diffed byte-for-byte across all five before
 * extraction — contains ONLY the `:host`/`.card`/`@supports`/`degrade`
 * declarations that were identical in every one of them. Composed FIRST in
 * each element's `static styles` array (before the element's own css
 * block), so declarations not listed here (cursor, transition, gap,
 * touch-action, `--_state-color`, and every `.card.<state>` override) stay
 * local to each element because they differ by at least one card — moving
 * those would change what that card renders.
 */
export const glassCardStyles = css`
    :host { display: block; box-sizing: border-box; container-type: size; overflow: visible; }
    .card {
        position: absolute; inset: var(--feezal-glass-margin, 6px); box-sizing: border-box;
        display: flex; flex-direction: column; justify-content: space-between;
        padding: 12px;
        border-radius: var(--feezal-glass-radius, 24px);
        background: var(--feezal-glass-tint, rgba(255,255,255,0.35));
        -webkit-backdrop-filter: blur(var(--feezal-glass-blur, 20px));
        backdrop-filter: blur(var(--feezal-glass-blur, 20px));
        border: 1px solid var(--feezal-glass-border, rgba(255,255,255,0.55));
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        color: var(--feezal-glass-color, #1d1d1f);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        user-select: none;
    }
    @supports (corner-shape: squircle) { .card { corner-shape: squircle; } }
    :host([degrade]) .card {
        -webkit-backdrop-filter: none; backdrop-filter: none;
        background: var(--feezal-glass-solid, rgba(245,245,247,0.94));
    }
`;

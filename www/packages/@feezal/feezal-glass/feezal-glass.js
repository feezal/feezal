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

/**
 * Shared details-POPOVER chrome for the 5 "popup" glass cards (light,
 * climate, cover, fan, wled). Diffed byte-for-byte across all five before
 * extraction — contains ONLY the popover container (`.details`, its degrade
 * variant, `::backdrop`, `.title`) and the `.flip-btn` that opens it. Popover
 * CONTENTS (`.vslider`, `.wheel`, `input.ct`, `.mode*`, sliders, and every
 * other card-specific control) stay local — those differ by at least one
 * card. Composed after `glassCardStyles` and the card's own frost `.card`
 * block in each element's `static styles` array.
 *
 * `gap: 16px` here matches light/climate/cover/fan; glass-wled uses 14px and
 * keeps a local `.details { gap: 14px; }` override after this fragment.
 */
export const glassPopupStyles = css`
    .details {
        /* Anchored above (or below) the card by _positionDetails(). */
        position: fixed; left: 0; top: 0; margin: 0; z-index: 99999;
        width: 200px; height: fit-content; max-height: 90vh;
        box-sizing: border-box; padding: 16px;
        display: flex; flex-direction: column; align-items: center; gap: 16px;
        border: 1px solid var(--feezal-glass-border, rgba(255,255,255,0.55));
        border-radius: var(--feezal-glass-radius, 24px);
        background: var(--feezal-glass-tint, rgba(255,255,255,0.7));
        -webkit-backdrop-filter: blur(var(--feezal-glass-blur, 20px));
        backdrop-filter: blur(var(--feezal-glass-blur, 20px));
        box-shadow: 0 16px 48px rgba(0,0,0,0.3);
        color: var(--feezal-glass-color, #1d1d1f);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: visible;
    }
    :host([degrade]) .details {
        -webkit-backdrop-filter: none; backdrop-filter: none;
        background: var(--feezal-glass-solid, rgba(245,245,247,0.97));
    }
    .details::backdrop { background: rgba(0, 0, 0, 0.35); }
    .details .title {
        font-size: 13px; font-weight: 700; align-self: stretch; text-align: center;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .flip-btn {
        position: absolute; top: 6px; right: 8px;
        border: none; background: none; cursor: pointer; padding: 2px;
        color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
        font-family: 'Material Icons'; font-size: var(--feezal-glass-font-size-unit, 12px); line-height: 1;
    }
`;

/**
 * U66: shared colour plumbing for the editor's alpha-capable pickers.
 *
 * Three surfaces show a colour swatch next to a free-text value (the styles
 * inspector, the attribute inspector, the background editor), and each had its
 * own 6-digit-hex parsing with its own gaps — an `rgba(…)` or 8-digit hex left
 * the swatch lying black. This module is the one implementation all of them
 * use, and it keeps the alpha channel end to end.
 *
 * Editor bundle only — the viewer never parses colours for display.
 */

/**
 * Canonical serialized form of a picker result: lowercase, and a fully-opaque
 * 8-digit hex collapses to 6 digits so untouched-alpha picks keep serializing
 * exactly as before U66 (`#ff0000ff` → `#ff0000`).
 */
export function normalizeHexa(value) {
    let v = String(value || '').trim().toLowerCase();
    if (/^#[0-9a-f]{8}$/.test(v) && v.endsWith('ff')) v = v.slice(0, 7);
    if (/^#[0-9a-f]{4}$/.test(v) && v.endsWith('f')) v = v.slice(0, 4);
    return v;
}

/** `#rgb`/`#rgba` → `#rrggbb`/`#rrggbbaa`; longhand passes through lowercase. */
function expandHex(v) {
    return v.length <= 5
        ? '#' + [...v.slice(1)].map(c => c + c).join('')
        : v.toLowerCase();
}

const hex2 = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

/**
 * A computed colour string → `#rrggbb[aa]`. Handles `rgb()`/`rgba()` (comma
 * or space syntax) AND the `color(srgb r g b / a)` form Chromium uses to
 * serialize color-mix() results (components 0–1 there). Alpha is KEPT
 * (8 digits when < 1). Returns '' when it doesn't parse.
 */
export function rgbToHexa(rgb) {
    const v = String(rgb || '');
    let m = v.match(/rgba?\(([^)]+)\)/i);
    let scale = 1;
    if (!m) {
        m = v.match(/color\(srgb\s+([^)]+)\)/i);
        scale = 255;   // color(srgb …) components are 0–1
    }
    if (!m) return '';
    const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(s => parseFloat(s));
    if (parts.length < 3 || parts.some(n => Number.isNaN(n))) return '';
    const [r, g, b, a] = parts;
    const base = '#' + hex2(r * scale) + hex2(g * scale) + hex2(b * scale);
    return (a === undefined || a >= 1) ? base : base + hex2(a * 255);
}

/**
 * A colour literal → `#rrggbb[aa]`, without touching the DOM: 3/4/6/8-digit
 * hex and rgb()/rgba(). Anything else (var(), color-mix(), names) returns ''
 * — resolve those with {@link resolveCssColor}.
 */
export function literalToHexa(value) {
    const v = String(value || '').trim();
    if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return normalizeHexa(expandHex(v));
    return rgbToHexa(v);
}

/**
 * Resolve ANY CSS colour value — literals, names, `var(--x)` chains,
 * `color-mix(…)` — to `#rrggbb[aa]` by probing inside `host`'s shadow root,
 * so the element's own custom properties and the inherited theme apply.
 * Returns '' when the value cannot be resolved (→ show the checkerboard).
 *
 * `transparent` and other alpha-0 colours resolve to `#…00` — with an
 * alpha-capable picker that is a real value, not an unresolved one. The one
 * ambiguity: an UNDEFINED `var()` in the `color` property computes to the
 * inherited colour rather than failing, so a dangling reference shows the
 * host's text colour. That was true before U66 and is unchanged.
 */
export function resolveCssColor(value, host) {
    const v = String(value || '').trim();
    if (!v) return '';
    const fast = literalToHexa(v);
    if (fast) return fast;
    if (!host) return '';
    let probe;
    try {
        probe = document.createElement('span');
        probe.style.cssText = 'display:none!important;position:absolute';
        probe.style.color = v;
        if (!probe.style.color) return '';   // the browser rejected the value
        (host.shadowRoot || host).appendChild(probe);
        return normalizeHexa(rgbToHexa(getComputedStyle(probe).color));
    } catch {
        return '';
    } finally {
        if (probe && probe.parentNode) probe.parentNode.removeChild(probe);
    }
}

/**
 * The theme-var alpha rule (U66 decision 2b): what to write back when the
 * picker reports `pickedHexa` and the authored value was `authored`.
 *
 * If the authored value is a theme reference — `var(--x…)` directly, or the
 * `color-mix(in srgb, var(--x…) NN%, transparent)` form a previous alpha edit
 * produced — and the picked RGB still equals that reference's resolved RGB
 * (i.e. the user ONLY moved the alpha slider), the reference is KEPT and the
 * alpha expressed around it:
 *
 *     var(--primary-color)  + alpha 40 %
 *         → color-mix(in srgb, var(--primary-color) 40%, transparent)
 *
 * back at 100 % the plain var() returns. The full authored expression (with
 * its fallback chain) is embedded, so `var(--a, var(--b, #ccc))` keeps its
 * fallbacks. Any pick that changes the RGB itself becomes a literal — that is
 * the user choosing a different colour, and pretending it is still the theme
 * colour would be dishonest.
 *
 * Note: color-mix multiplies onto whatever alpha the theme colour already
 * carries (a 50 % mix of an rgba(…,.5) var is 25 % effective) — the swatch
 * preview shows the true result.
 *
 * `resolve` is a (cssValue → '#rrggbb[aa]') resolver, usually
 * v => resolveCssColor(v, host).
 */
export function composeThemeAlpha(authored, pickedHexa, resolve) {
    const picked = normalizeHexa(pickedHexa);
    const a = String(authored || '').trim();
    const mix = a.match(/^color-mix\(in srgb,\s*(var\(.+\))\s+[\d.]+%\s*,\s*transparent\)$/i);
    const base = mix ? mix[1] : (/^var\(/i.test(a) ? a : null);
    if (base) {
        const baseRgb = (resolve(base) || '').slice(0, 7);
        if (baseRgb && baseRgb === picked.slice(0, 7)) {
            const alpha = /^#[0-9a-f]{8}$/.test(picked)
                ? Math.round((parseInt(picked.slice(7, 9), 16) / 255) * 100)
                : 100;
            return alpha >= 100 ? base : `color-mix(in srgb, ${base} ${alpha}%, transparent)`;
        }
    }
    return picked;
}

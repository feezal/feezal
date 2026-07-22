/**
 * @feezal/feezal-element/feezal-color.js (E137)
 *
 * Cross-controller color/scaling machinery shared by the light (and later
 * wled) behavior controllers — consolidated from the byte-identical copies
 * that lived in material/glass/metro-light. Pure functions, unit-testable.
 */

/** Ring % → raw MQTT value. Rounds to the granularity of 1 % of the range so
 * sub-integer ranges survive (Homematic dimmers use a 0–1 LEVEL: 49 % → 0.49)
 * while integer ranges (0–100, 0–254) keep publishing whole numbers. */
export function pctToRaw(pct, min, max) {
    const value = min + (pct / 100) * (max - min);
    const step = Math.abs(max - min) / 100;
    if (step >= 1 || step === 0) return Math.round(value);
    const decimals = Math.min(6, Math.ceil(-Math.log10(step)));
    return Number(value.toFixed(decimals));
}

/** Simple warm-to-cool interpolation: 2700 K (warm) → 6500 K (cool). */
export function kelvinToRgb(k) {
    const t = Math.max(0, Math.min(1, (k - 2700) / 3800));
    return [Math.round(255 - t * 60), Math.round(210 + t * 45), Math.round(90 + t * 165)];
}

export function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(c => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('');
}

export function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
    let h = 0;
    if (d) {
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        else if (max === g) h = ((b - r) / d + 2) * 60;
        else h = ((r - g) / d + 4) * 60;
    }
    return {h, s: max ? d / max : 0, v: max};
}

export function hsvToRgb(h, s, v) {
    const i = Math.floor(h / 60) % 6;
    const f = h / 60 - Math.floor(h / 60);
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const combos = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]];
    const [r, g, b] = combos[i];
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/** "r,g,b" string / JSON array / array → [r,g,b] (null when unparseable). */
export function parseRgb(raw) {
    try {
        if (typeof raw === 'string' && !raw.startsWith('[')) {
            const parts = raw.split(',').map(Number);
            if (parts.length >= 3 && parts.every(n => !isNaN(n))) return parts.slice(0, 3);
        }
        const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(arr)) return arr.slice(0, 3).map(Number);
    } catch {}
    return null;
}

/** CIE 1931 xy (+ optional brightness) → sRGB (zigbee2mqtt / Hue {x,y}). */
export function xyToRgb(x, y, bri = 1) {
    if (!y) return [255, 255, 255];
    const Y = bri;
    const X = (Y / y) * x;
    const Z = (Y / y) * (1 - x - y);
    let r =  X * 1.656492 - Y * 0.354851 - Z * 0.255038;
    let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
    let b =  X * 0.051713 - Y * 0.121364 + Z * 1.011530;
    const gamma = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
    [r, g, b] = [r, g, b].map(c => gamma(Math.max(0, c)));
    const max = Math.max(r, g, b, 1);
    return [r, g, b].map(c => Math.round(Math.max(0, Math.min(1, c / max)) * 255));
}

/* global feezal */
/**
 * @feezal/feezal-element/feezal-locale — the ONE locale for the whole site
 * (N38), and the helpers every consumer shares so they cannot disagree:
 *
 *  - `currentLocale()` — resolution order: an explicit `feezal.locale`
 *    (set by the viewer bootstrap or tests) → the `<feezal-site locale>`
 *    attribute (serializes with the site, travels into exports) → the
 *    browser (`navigator.language`). The empty default is deliberate:
 *    zero-config correctness — a German browser shows `1,5` immediately,
 *    and an export with no explicit locale follows the viewing device,
 *    while a site that SETS one has it pinned by serialization.
 *
 *  - `formatNumber(value, {digits, grouping, locale})` — `Intl.NumberFormat`
 *    done once, with one cached formatter per (locale, digits, grouping).
 *    Elements adopt this in place of `toFixed()` + concat (element-spec §4).
 *    Grouping is OFF by default: the separator localizes always, but
 *    `1234 W` on a wall panel reads better than `1.234 W` unless the user
 *    opts in per element.
 *
 *  - `resolveLocaleChain(locale)` — plain BCP-47 truncation, most specific
 *    first, `en` last: `de-AT → de → en`, `zh-Hans-CN → zh-Hans → zh → en`.
 *    Shared so A27's element defaults, the editor catalog and the Intl call
 *    sites agree about what `pt-BR` falls back to.
 *
 *  - `localizedDefault(spec, locale)` — A27 phase 1: resolve a descriptor's
 *    `defaultI18n` dict against the chain, `default` as the final fallback.
 *    The dict's PRESENCE is the opt-in — a descriptor without one (every
 *    `payload-*` wire attribute) can never be localized.
 *
 * Locale changes broadcast as a `feezal-locale-change` event on `document`
 * (dispatched by whoever changes the locale — the Site Settings panel, or
 * `setLocale()` below); `FeezalElement` re-applies localized defaults and
 * re-renders on it.
 */

/** BCP-47 fallback chain: most specific first, 'en' always last. */
export function resolveLocaleChain(locale) {
    const chain = [];
    let l = String(locale || '').trim();
    while (l) {
        chain.push(l);
        const cut = l.lastIndexOf('-');
        l = cut > 0 ? l.slice(0, cut) : '';
    }
    if (!chain.includes('en')) chain.push('en');
    return chain;
}

/** The active locale: explicit global → site attribute → browser. The site
 * element is looked up in the DOM as a fallback, because element constructors
 * can run before the bootstrap assigns `feezal.site`. */
export function currentLocale() {
    if (typeof feezal !== 'undefined' && feezal.locale) return feezal.locale;
    const siteEl = (typeof feezal !== 'undefined' && feezal.site) ||
        (typeof document !== 'undefined' && document.querySelector('feezal-site'));
    const site = siteEl?.getAttribute?.('locale');
    if (site) return site;
    return (typeof navigator !== 'undefined' && navigator.language) || 'en';
}

/** Set the explicit locale global and broadcast the change. '' clears back
 * to site-attribute/browser resolution. */
export function setLocale(locale) {
    if (typeof feezal === 'undefined') return;
    feezal.locale = locale || '';
    document.dispatchEvent(new CustomEvent('feezal-locale-change'));
}

// One formatter per (locale, digits, grouping) — Intl.NumberFormat
// construction is expensive relative to format().
const formatters = new Map();

function formatterFor(locale, digits, grouping) {
    const key = `${locale}|${digits ?? ''}|${grouping ? 1 : 0}`;
    let f = formatters.get(key);
    if (!f) {
        const options = {useGrouping: Boolean(grouping)};
        if (digits !== undefined && digits !== null && digits !== '') {
            options.minimumFractionDigits = Number(digits);
            options.maximumFractionDigits = Number(digits);
        } else {
            // No digits set → show the payload's own precision (up to Intl's
            // cap), matching the old String(value) behaviour.
            options.maximumFractionDigits = 20;
        }
        try {
            f = new Intl.NumberFormat(locale, options);
        } catch {
            f = new Intl.NumberFormat('en', options);   // bad locale string
        }
        formatters.set(key, f);
    }
    return f;
}

/**
 * Localized number rendering. Non-numeric values pass through as-is (MQTT
 * payloads may be state words — formatNumber never turns 'unknown' into
 * 'NaN'). `digits` rounds to a fixed fraction; absent = the value's own
 * precision. `grouping` opts into thousands separators. `locale` overrides
 * the site/browser locale (per-element attributes stay authoritative).
 */
export function formatNumber(value, {digits, grouping, locale} = {}) {
    const n = typeof value === 'number' ? value : parseFloat(value);
    if (!Number.isFinite(n)) return value == null ? '' : String(value);
    return formatterFor(locale || currentLocale(), digits, grouping).format(n);
}

/**
 * A27 phase 1: the locale-aware default of an attribute descriptor.
 * `spec.defaultI18n` maps locales → strings; resolution walks the fallback
 * chain and lands on `spec.default` (the en source string).
 */
export function localizedDefault(spec, locale = currentLocale()) {
    if (!spec?.defaultI18n) return spec?.default;
    const chain = resolveLocaleChain(locale);
    for (const l of chain) {
        if (spec.defaultI18n[l] != null) return spec.defaultI18n[l];
    }
    return spec.default;
}


/**
 * N41 — the one implementation of "render this reading for a value card".
 *
 * `displayValue` was copy-pasted across the value cards and then drifted: glass
 * was fixed for N38 locale while circle and eink kept a raw `toFixed`, so the
 * SAME reading rendered `1234.5` on one card and `1.234,5` on another in the
 * same dashboard. That is user-visible, and it is exactly what one copy per
 * family buys you.
 *
 * Rules, in order:
 *  - empty (null/undefined/'') → the editor shows a localized sample so the
 *    canvas previews the site locale; the viewer shows an em dash;
 *  - a finite number with `decimals` set → fixed fraction, localized;
 *  - an object → JSON, so a structured payload is at least visible;
 *  - any other numeric payload → localized with its own precision;
 *  - anything else (state words like `unknown`) → passed through untouched.
 *
 * @param {*} raw                     the payload
 * @param {object}  [opts]
 * @param {*}       [opts.decimals]   '' / null = the value's own precision
 * @param {boolean} [opts.grouping]   thousands separators
 * @param {number}  [opts.sample]     editor placeholder reading (default 21.5)
 * @param {string}  [opts.empty]      viewer placeholder (default '—')
 * @param {boolean} [opts.isEditor]   defaults to the live editor flag
 */
export function formatValueDisplay(raw, {
    decimals, grouping, sample = 21.5, empty = '—', isEditor,
} = {}) {
    const editor = isEditor === undefined
        ? Boolean(globalThis.feezal?.isEditor)
        : isEditor;
    if (raw === null || raw === undefined || raw === '') {
        return editor ? formatNumber(sample, {digits: 1, grouping}) : empty;
    }
    const n = Number(raw);
    if (decimals !== '' && decimals !== null && decimals !== undefined && Number.isFinite(n)) {
        return formatNumber(n, {
            digits: Math.max(0, Math.min(6, Number(decimals) || 0)),
            grouping,
        });
    }
    if (typeof raw === 'object') return JSON.stringify(raw);
    return Number.isFinite(n) ? formatNumber(n, {grouping}) : String(raw);
}

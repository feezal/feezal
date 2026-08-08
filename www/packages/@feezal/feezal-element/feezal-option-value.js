/**
 * B128 — Shoelace <sl-select> treats SPACES in option values as multi-value
 * delimiters, so an <sl-option> whose value contains a space can never match
 * or round-trip ("Living room" picked → tokenizes → a broken name is stored).
 *
 * Encode every FREE-FORM string fed into an sl-option value (view names are
 * the recurring case) and decode it in the change handler — one helper pair,
 * used by every picker, so arbitrary names keep working. Fixed enum values
 * and space-free sentinels pass through unchanged (encodeURIComponent leaves
 * `-`/`_`/alphanumerics alone), so comparisons against sentinels still work
 * on the DECODED value.
 */
export const encodeOptionValue = v => encodeURIComponent(String(v ?? ''));

export const decodeOptionValue = v => {
    try {
        return decodeURIComponent(String(v ?? ''));
    } catch {
        return String(v ?? '');   // not something we encoded — pass through
    }
};

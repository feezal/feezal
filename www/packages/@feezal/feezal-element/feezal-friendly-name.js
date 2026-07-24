// Shared friendly-label normalization (U62 / E135 device-health).
//
// Lives in @feezal/feezal-element so BOTH the editor (discovery stamping,
// www/src/feezal-discovery-stamp.js re-exports this) and element packages
// (e.g. the device-health inspector building its device list) derive labels
// the SAME way. Pure, dependency-free.
//
// Normalize a discovered device/entity name into a friendly, human label:
//   1. strip a trailing Homematic channel suffix (`…:14` / `…:0` → drop only a
//      trailing `:<digits>`, never a colon elsewhere),
//   2. underscores → spaces, collapse whitespace runs,
//   3. capitalize the first letter of each *all-lowercase* word — words that
//      already carry an uppercase letter are left entirely alone, so acronyms
//      and units survive (`kWh`, `CO2`, `WLED` unchanged; `licht` → `Licht`),
//   4. idempotent — an already-friendly name (`Wohnzimmer Lampe`) is unchanged.
export function friendlyName(raw) {
    let s = String(raw ?? '').trim();
    if (!s) return '';
    s = s.replace(/:\d+$/, '');                 // 1. trailing HM channel suffix
    s = s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();   // 2. underscores → spaces
    // 3. capitalize the first letter only of words with no existing uppercase.
    s = s.replace(/\S+/g, w => (/[A-Z]/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)));
    return s;
}

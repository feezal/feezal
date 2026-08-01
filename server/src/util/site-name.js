'use strict';

/**
 * B97 — THE site-name validator (single implementation).
 *
 * A14: sites live under <dataDir>/sites/, so a site name only has to be a
 * safe single path segment — no slashes (a decoded %2f would otherwise
 * traverse), no leading dot (blocks `.`/`..` and hidden dirs), bounded
 * length. Used by the API router (router.param), the app-level asset/viewer
 * routes and the PWA routes; B97 replaced four drifted copies of this rule.
 */
function isValidSiteName(name) {
    return typeof name === 'string' &&
        name.length > 0 && name.length <= 128 &&
        !/[\\/]/.test(name) &&
        !name.startsWith('.');
}

module.exports = {isValidSiteName};

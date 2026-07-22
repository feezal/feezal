'use strict';

/**
 * A28 — configurable per-site CSP.
 *
 * A25 shipped a FIXED policy (code directives locked to 'self', content
 * directives wide open). This module makes it configurable per site while
 * enforcing the non-negotiable invariants in the BUILDER, not the UI:
 *
 *  - script-src/style-src always retain 'unsafe-inline' (+ 'unsafe-eval' on
 *    script) — feezal's bootstrap/template machinery needs them; allowlisting
 *    ADDS origins, never strips baseline tokens.
 *  - font-src keeps data:, img/media keep data: blob: (B51-class breakage
 *    otherwise), worker/base/object stay at baseline.
 *  - connect-src always includes 'self' + data: (B51) + the MQTT broker
 *    origin (derived from the connection settings) — without it every
 *    tightened site instantly breaks.
 *
 * Config shape (viewer.security.csp in the site config; every aspect
 * optional, absent → the A25 baseline = fully backwards compatible):
 *   {images|frames|connect|scripts|styles|fonts: {mode: 'all'|'self'|'hosts', hosts: []}}
 * `images` covers BOTH img-src and media-src (one user-facing aspect).
 *
 * Violation reports: the viewer header carries a same-origin
 * `report-uri /api/csp-report/<site>`; reports land in a small per-site ring
 * buffer (local only, capped — the A25 privacy stance) that feeds the
 * Security tab's one-click "blocked: xyz — allow?" chips.
 */

// scheme://host[:port], bare host[:port], or *.example.com — no paths.
const ORIGIN_RE = /^(?:(?:https?|wss?):\/\/)?(?:\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(?::\d{1,5})?$/i;

function validateOrigin(origin) {
    return typeof origin === 'string' && origin.length <= 256 && ORIGIN_RE.test(origin.trim());
}

/** Sanitize an aspect config into {mode, hosts[]} (invalid → baseline null). */
function aspect(cfg) {
    if (!cfg || typeof cfg !== 'object') return null;
    const mode = ['all', 'self', 'hosts'].includes(cfg.mode) ? cfg.mode : null;
    if (!mode) return null;
    const hosts = Array.isArray(cfg.hosts) ? cfg.hosts.filter(validateOrigin).map(h => h.trim()) : [];
    return {mode, hosts};
}

/**
 * Build the source list for one directive.
 * @param base   tokens that are ALWAYS present (the invariants)
 * @param open   the wide-open form (A25 baseline for content directives)
 * @param cfg    sanitized aspect or null (null → openDefault ? open : base)
 * @param openDefault whether the A25 baseline for this directive is open
 */
function sources(base, open, cfg, openDefault) {
    if (!cfg) return openDefault ? open : base;
    if (cfg.mode === 'all') return open;
    if (cfg.mode === 'self') return base;
    return [...base, ...cfg.hosts];
}

/**
 * Build the per-site CSP header value for a VIEWER page.
 * @param {object|null} csp     viewer.security.csp (may be absent)
 * @param {object} opts         {siteName, brokerOrigin?}
 */
function buildCsp(csp, {siteName, brokerOrigin} = {}) {
    const c = csp && typeof csp === 'object' ? csp : {};
    const images  = aspect(c.images);
    const frames  = aspect(c.frames);
    const connect = aspect(c.connect);
    const scripts = aspect(c.scripts);
    const styles  = aspect(c.styles);
    const fonts   = aspect(c.fonts);

    // connect-src invariants: 'self' + data: (B51) + the broker origin.
    const connectBase = ["'self'", 'data:'];
    if (brokerOrigin && validateOrigin(brokerOrigin)) connectBase.push(brokerOrigin);

    const directives = [
        ["default-src", ["'self'"]],
        ['script-src', sources(["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            ['*', "'unsafe-inline'", "'unsafe-eval'"], scripts, false)],
        ['style-src', sources(["'self'", "'unsafe-inline'"],
            ['*', "'unsafe-inline'"], styles, false)],
        ['font-src', sources(["'self'", 'data:'], ['*', 'data:'], fonts, false)],
        ['img-src', sources(["'self'", 'data:', 'blob:'], ['*', 'data:', 'blob:'], images, true)],
        ['media-src', sources(["'self'", 'data:', 'blob:'], ['*', 'data:', 'blob:'], images, true)],
        ['connect-src', sources(connectBase, ['*', 'data:'], connect, true)],
        ['frame-src', sources(["'self'"], ['*'], frames, true)],
        ['worker-src', ["'self'", 'blob:']],
        ['object-src', ["'none'"]],
        ['base-uri', ["'self'"]],
    ];
    const parts = directives.map(([name, list]) => `${name} ${[...new Set(list)].join(' ')}`);
    if (siteName) parts.push(`report-uri /api/csp-report/${encodeURIComponent(siteName)}`);
    return parts.join('; ');
}

/**
 * Derive the broker ORIGIN for connect-src from a connection URI. Bridged
 * connections (mqtt:// via server) go over socket.io = 'self' → null.
 */
function brokerOriginFromUri(uri) {
    const m = /^(wss?):\/\/([^/:?#]+)(:\d+)?/i.exec(String(uri || ''));
    return m ? `${m[1].toLowerCase()}://${m[2]}${m[3] || ''}` : null;
}

// ── Violation ring buffer (per site, local only, capped) ────────────────────
const MAX_ENTRIES_PER_SITE = 50;
const violations = new Map();   // site → [{host, directive, count, lastSeen}]

/** Record one CSP violation report (browser `application/csp-report` shape). */
function recordViolation(site, report) {
    const r = (report && (report['csp-report'] || report)) || {};
    const blocked = String(r['blocked-uri'] ?? r.blockedURL ?? '');
    const directive = String(r['effective-directive'] ?? r['violated-directive'] ?? '').split(' ')[0];
    if (!directive) return;
    let host;
    try { host = blocked.includes('://') ? new URL(blocked).host : blocked; } catch { host = blocked; }
    if (!host) return;
    host = host.slice(0, 256);

    let list = violations.get(site);
    if (!list) { list = []; violations.set(site, list); }
    const existing = list.find(e => e.host === host && e.directive === directive);
    if (existing) {
        existing.count += 1;
        existing.lastSeen = Date.now();
    } else {
        list.push({host, directive, count: 1, lastSeen: Date.now()});
        if (list.length > MAX_ENTRIES_PER_SITE) list.shift();
    }
}

/** Recent violations for a site (newest last-seen first). */
function getViolations(site) {
    return [...(violations.get(site) || [])].sort((a, b) => b.lastSeen - a.lastSeen);
}

function clearViolations(site) {
    if (site === undefined) violations.clear();
    else violations.delete(site);
}

module.exports = {
    buildCsp,
    brokerOriginFromUri,
    validateOrigin,
    recordViolation,
    getViolations,
    clearViolations,
    MAX_ENTRIES_PER_SITE,
};

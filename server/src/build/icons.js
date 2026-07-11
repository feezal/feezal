'use strict';

/**
 * N23 — per-site icon tree-shaking.
 *
 * Icon-set packages (feezal-icons-*) carry their full data only in the
 * editor, where the picker offers every icon. Viewer pages and static
 * exports get a server-generated mini-registration containing just the
 * icons the site actually uses: the server discovers the installed sets,
 * scans the site HTML for `<set>:<name>` references, reads the package's
 * declared data module (package.json `feezal.icons` — a
 * `export default {name: '<svg …>'}` JSON object) and inlines the matching
 * entries.
 *
 * User-installed packages (Package Manager / manual drop) are bundled into a
 * single index.js at install time, so their per-icon data is not separable —
 * the viewer page loads their full module instead (no tree-shaking).
 */

const fs = require('fs');
const path = require('path');

/** Data-module parse cache: absolute path → {mtimeMs, icons}. */
const _dataCache = new Map();

/**
 * Discover installed icon-set packages.
 *
 * @param {string}      wwwDir           www root (dist in prod, www in dev)
 * @param {string|null} userElementsDir  <dataDir>/elements or null
 * @returns {Array<{name: string, set: string, kind: 'bundled'|'user',
 *                  dir: string, main: string, iconsFile: string|null}>}
 */
function discoverIconPackages(wwwDir, userElementsDir) {
    const out = [];

    const scan = (baseDir, kind) => {
        if (!baseDir || !fs.existsSync(baseDir)) return;
        const walk = dir => {
            for (const entry of fs.readdirSync(dir)) {
                const abs = path.join(dir, entry);
                if (entry.startsWith('@')) {
                    walk(abs);
                    continue;
                }
                if (!entry.startsWith('feezal-icons-')) continue;
                const pjPath = path.join(abs, 'package.json');
                if (!fs.existsSync(pjPath)) continue;
                let pj;
                try {
                    pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
                } catch {
                    continue;
                }
                const meta = pj.feezal || {};
                const name = path.relative(baseDir, abs).split(path.sep).join('/');
                const main = pj.main || 'index.js';
                // N28: a package may register SEVERAL sets (Font Awesome:
                // fa-solid / fa-regular / fa-brands) via the plural form
                // `feezal.sets: [{set, icons}, …]` — one discovery entry per
                // set, sharing the package identity. The singular
                // `feezal.set` + `feezal.icons` form stays supported.
                const declared = Array.isArray(meta.sets) && meta.sets.length > 0
                    ? meta.sets
                    : [{set: meta.set || entry.replace(/^feezal-icons-/, ''), icons: meta.icons}];
                for (const d of declared) {
                    if (!d || !d.set) continue;
                    const iconsFile = d.icons ? path.join(abs, d.icons) : null;
                    out.push({
                        name,
                        set: d.set,
                        kind,
                        dir: abs,
                        main,
                        iconsFile: iconsFile && fs.existsSync(iconsFile) ? iconsFile : null
                    });
                }
            }
        };
        walk(baseDir);
    };

    const bundledDir = fs.existsSync(path.join(wwwDir, 'packages'))
        ? path.join(wwwDir, 'packages')
        : path.join(wwwDir, 'node_modules');
    scan(bundledDir, 'bundled');
    scan(userElementsDir, 'user');

    return out;
}

/** Parse a data module (`export default {…};` with a JSON object literal). */
function readIconData(iconsFile) {
    const {mtimeMs} = fs.statSync(iconsFile);
    const cached = _dataCache.get(iconsFile);
    if (cached && cached.mtimeMs === mtimeMs) return cached.icons;

    const src = fs.readFileSync(iconsFile, 'utf8');
    const start = src.indexOf('export default ');
    const end = src.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error(`not a data module: ${iconsFile}`);
    const icons = JSON.parse(src.slice(start + 'export default '.length, end + 1));
    _dataCache.set(iconsFile, {mtimeMs, icons});
    return icons;
}

/**
 * Scan site HTML for `<set>:<name>` icon references. Only *known* set names
 * are matched, so URLs (https:) and MQTT payloads never false-positive into
 * a registration. Over-matching plain prose costs a few stray entries at
 * worst — each is a few hundred bytes.
 *
 * @returns {Map<string, string[]>} set → sorted unique names
 */
function extractUsedIcons(siteHtml, setNames) {
    const used = new Map();
    for (const set of setNames) {
        const escaped = set.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
        const re = new RegExp(`\\b${escaped}:([A-Za-z0-9_-]+)`, 'g');
        const names = new Set();
        let m;
        while ((m = re.exec(siteHtml)) !== null) names.add(m[1]);
        if (names.size) used.set(set, [...names].sort());
    }
    return used;
}

/** `</script>`-safe JSON for inlining into a <script> block. */
function _inlineJson(value) {
    return JSON.stringify(value).replace(/<\//g, '<\\/');
}

/** One registerIcons statement for a shaken subset. Plain JS, no imports. */
function registrationJs(set, subset) {
    return `feezal.registerIcons(${JSON.stringify(set)}, {names: ${_inlineJson(Object.keys(subset))}, ` +
        `render: (icons => name => icons[name] || '')(${_inlineJson(subset)})});`;
}

/**
 * Everything a per-site artifact (viewer page, static export) needs to render
 * the site's icons:
 *   - inlineJs: shaken registrations for bundled sets (plain JS statements)
 *   - userModuleUrls: full-module URLs for user-installed sets in use
 *     (per-icon data is not separable from an installed bundle)
 */
function siteIconArtifacts({wwwDir, userElementsDir, siteHtml, logger = console}) {
    const packages = discoverIconPackages(wwwDir, userElementsDir);
    if (packages.length === 0) return {inlineJs: '', userModuleUrls: []};

    const used = extractUsedIcons(siteHtml, packages.map(p => p.set));
    const parts = [];
    const userModuleUrls = [];

    for (const pkg of packages) {
        const names = used.get(pkg.set);
        if (!names) continue;
        if (pkg.iconsFile) {
            let icons;
            try {
                icons = readIconData(pkg.iconsFile);
            } catch (err) {
                logger.warn?.(`icons: cannot read data for ${pkg.name}: ${err.message}`);
                continue;
            }
            const subset = {};
            const allNames = Object.keys(icons);
            for (const name of names) {
                if (icons[name] !== undefined) subset[name] = icons[name];
                // Variant families: elements like basic-icon-value construct
                // `${base}_<step>` names at runtime from a base reference in
                // the HTML — include every numeric-suffix variant of a used
                // name so viewers/exports can render all steps.
                const variantRe = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}_\\d+$`);
                for (const candidate of allNames) {
                    if (variantRe.test(candidate)) subset[candidate] = icons[candidate];
                }
            }
            if (Object.keys(subset).length) parts.push(registrationJs(pkg.set, subset));
        } else if (pkg.kind === 'user') {
            const url = `/user-elements/${pkg.name}/${pkg.main}`;
            // N28: multi-set packages yield one discovery entry per set —
            // load the module once.
            if (!userModuleUrls.includes(url)) userModuleUrls.push(url);
        }
    }

    return {inlineJs: parts.join('\n'), userModuleUrls};
}

module.exports = {
    discoverIconPackages,
    readIconData,
    extractUsedIcons,
    registrationJs,
    siteIconArtifacts
};

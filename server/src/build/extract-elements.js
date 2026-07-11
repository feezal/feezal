'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Utilities for extracting the set of feezal element/theme packages actually
 * used by a site so that the static export can bundle only those.
 */

/**
 * Parse feezal site HTML to collect all custom element tag names that are used.
 *
 * Handles:
 *  - Opening tags: <feezal-element-*  and  <feezal-theme-*
 *  - child-element="…" attributes (feezal-element-layout-repeater renders a
 *    child element type that doesn't appear as a tag in the HTML itself)
 *
 * @param {string} siteHtml  Raw views.html content.
 * @returns {string[]}       Sorted, deduplicated array of tag names,
 *                           e.g. ['feezal-element-material-switch', 'feezal-theme-dark-mint']
 */
function extractUsedElements(siteHtml) {
    const tags = new Set();

    // Opening tags: <feezal-element-foo-bar  or  <feezal-theme-foo-bar
    const tagRe = /<(feezal-(?:element|theme)-[\w-]+)\b/g;
    let m;
    while ((m = tagRe.exec(siteHtml)) !== null) tags.add(m[1]);

    // child-element="feezal-element-…" attribute (repeater's rendered child)
    const childRe = /\bchild-element="(feezal-(?:element|theme)-[\w-]+)"/g;
    while ((m = childRe.exec(siteHtml)) !== null) tags.add(m[1]);

    return [...tags].sort();
}

/**
 * N29 Phase B: build a tag → package-name lookup for multi-element family
 * packages (feezal-elements-*, any scope) found in node_modules. Their tags
 * do NOT equal their package name, so tagsToPackages() needs this map to
 * keep them from being dropped out of static exports. Phase A set markers
 * (feezal.type 'bundle') list member *packages*, not tags — skipped.
 *
 * @param {string} nodeModulesDir  Absolute path to node_modules.
 * @returns {Object<string, string>}  e.g. {'feezal-element-metro-tile': '@feezal/feezal-elements-metro'}
 */
function buildTagToPackageMap(nodeModulesDir) {
    const map = {};
    let entries;
    try { entries = fs.readdirSync(nodeModulesDir); } catch { return map; }

    const familyDirs = [];
    for (const entry of entries) {
        if (entry.startsWith('@')) {
            let scoped;
            try { scoped = fs.readdirSync(path.join(nodeModulesDir, entry)); } catch { continue; }
            scoped.filter(s => s.startsWith('feezal-elements-'))
                .forEach(s => familyDirs.push({dir: path.join(nodeModulesDir, entry, s), name: `${entry}/${s}`}));
        } else if (entry.startsWith('feezal-elements-')) {
            familyDirs.push({dir: path.join(nodeModulesDir, entry), name: entry});
        }
    }

    for (const {dir, name} of familyDirs) {
        try {
            const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
            const manifest = pkg.feezal || {};
            if (manifest.type === 'bundle' || !Array.isArray(manifest.elements)) continue;
            for (const tag of manifest.elements) map[tag] = pkg.name || name;
        } catch { /* corrupt or code-less dir — ignore */ }
    }
    return map;
}

/**
 * Map element/theme tag names to their npm package names.
 *
 * 'feezal-element-material-switch'  →  '@feezal/feezal-element-material-switch'
 * 'feezal-theme-dark-mint'          →  '@feezal/feezal-theme-dark-mint'
 *
 * N29 Phase B: tags declared by a multi-element family package resolve
 * through `tagMap` (see buildTagToPackageMap) instead of the `@feezal/${tag}`
 * convention; several tags collapsing into one family package are deduplicated.
 *
 * @param {string[]} tags
 * @param {Object<string, string>} [tagMap]  tag → package-name overrides
 * @returns {string[]}
 */
function tagsToPackages(tags, tagMap = {}) {
    return [...new Set(tags.map(tag => tagMap[tag] || `@feezal/${tag}`))];
}

/**
 * Filter a list of package names to those whose directory exists inside
 * the given node_modules root.  Silently drops missing packages so that
 * user-installed or renamed elements don't break the whole export.
 *
 * @param {string}   nodeModulesDir  Absolute path to node_modules.
 * @param {string[]} packages        Package names, e.g. ['@feezal/feezal-element-…'].
 * @returns {{ resolvable: string[], missing: string[] }}
 */
function partitionPackages(nodeModulesDir, packages) {
    const resolvable = [];
    const missing = [];
    for (const pkg of packages) {
        // '@feezal/feezal-element-foo'  →  node_modules/@feezal/feezal-element-foo
        const parts = pkg.startsWith('@') ? pkg.split('/') : ['', pkg];
        const pkgDir = path.join(nodeModulesDir, ...parts);
        (fs.existsSync(pkgDir) ? resolvable : missing).push(pkg);
    }
    return {resolvable, missing};
}

module.exports = {extractUsedElements, tagsToPackages, buildTagToPackageMap, partitionPackages};

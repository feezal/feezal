'use strict';

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
 * Map element/theme tag names to their @feezal/ npm package names.
 *
 * 'feezal-element-material-switch'  →  '@feezal/feezal-element-material-switch'
 * 'feezal-theme-dark-mint'          →  '@feezal/feezal-theme-dark-mint'
 *
 * @param {string[]} tags
 * @returns {string[]}
 */
function tagsToPackages(tags) {
    return tags.map(tag => `@feezal/${tag}`);
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
    const fs = require('fs');
    const path = require('path');
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

module.exports = {extractUsedElements, tagsToPackages, partitionPackages};

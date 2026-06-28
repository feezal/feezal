'use strict';

const fs = require('fs');
const path = require('path');

const BLACKLIST = new Set([
    '@interactjs',
    '@polymer',
    '@webcomponents',
    'dragselect',
    'interactjs',
    'web-animations-js'
]);

/**
 * Discovers feezal element and theme packages from:
 *   - <wwwDir>/packages/    (bundled elements; renamed from node_modules/ so npm publish keeps them)
 *   - <wwwDir>/node_modules/ (fallback for monorepo dev where packages/ doesn't exist)
 *   - <wwwDir>/src/          (built-in elements always bundled in the editor Vite chunk)
 *   - <wwwDir>/feezal-builtin-elements.json (manifest generated at build time for prod)
 *   - userElementsDir        (user-installed, served via /user-elements/)
 *
 * Returns an array of element descriptor objects. Does NOT write any files.
 *
 * @param {string}      wwwDir          Absolute path to the www/dist (prod) or www (dev) directory.
 * @param {string|null} userElementsDir Absolute path to <dataDir>/elements/, or null.
 * @param {object}      logger
 * @returns {Array<{bare: string, main: string, type: string, kind: string, builtin: boolean}>}
 */
function discoverElements(wwwDir, userElementsDir, logger) {
    const elements = [];

    // --- Bundled element packages ---
    // In production (after npm install) elements live in packages/ to survive npm publish.
    // In the monorepo (dev) they live in node_modules/ as installed by pnpm.
    const packagesDir = fs.existsSync(path.join(wwwDir, 'packages'))
        ? path.join(wwwDir, 'packages')
        : path.join(wwwDir, 'node_modules');
    _scan(packagesDir, packagesDir, elements, 'bundled');

    // --- User-installed element packages ---
    if (userElementsDir && fs.existsSync(userElementsDir)) {
        _scan(userElementsDir, userElementsDir, elements, 'user');
    }

    // --- Built-in elements (bundled directly into the editor Vite chunk) ---
    // In dev: scan www/src/. In prod: read the manifest written by the Vite build plugin.
    const srcDir = path.join(wwwDir, 'src');
    const manifestPath = path.join(wwwDir, 'feezal-builtin-elements.json');
    if (fs.existsSync(srcDir)) {
        fs.readdirSync(srcDir)
            .filter(f => f.startsWith('feezal-element-') && f.endsWith('.js'))
            .forEach(f => {
                const bare = f.replace(/\.js$/, '');
                elements.push({bare, type: 'element', kind: 'builtin', builtin: true});
                logger.info('found built-in element ' + bare);
            });
    } else if (fs.existsSync(manifestPath)) {
        JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
            .forEach(bare => {
                elements.push({bare, type: 'element', kind: 'builtin', builtin: true});
                logger.info('found built-in element ' + bare);
            });
    }

    elements.filter(el => !el.builtin).forEach(el => logger.info('found element ' + el.bare));

    return elements;
}

/**
 * Generates the JavaScript module body for the dynamic GET /editor/feezal-elements.js route.
 *
 * Uses absolute URL paths (e.g. /node_modules/...) so the browser resolves them without
 * an import map — Vite's dev import maps are NOT available for this Express-served response.
 *
 * Built-in elements are already bundled in the editor Vite chunk; they need no import here,
 * but their names ARE included in window.feezal.elements so they appear in the palette.
 *
 * @param {Array} elements  Output of discoverElements()
 * @returns {string}
 */
function generateElementsModule(elements) {
    // Bundled elements are already in the editor chunk (Vite bundles feezal-elements.js
    // at build time). This dynamic route only updates the palette registry so that
    // newly-installed or user-supplied elements are reflected without a full rebuild.
    //
    // User elements: imports are emitted for elements in <data-dir>/elements/ so their
    // custom element class is registered in the browser. These packages must be
    // pre-bundled (no bare specifiers) — see element-spec.md §User elements.
    const userImports = elements
        .filter(el => el.kind === 'user')
        .map(el => `import '/user-elements/${el.bare}/${el.main}';`)
        .join('\n');

    const elementNames = JSON.stringify(
        elements.filter(el => el.type === 'element').map(el => el.bare),
        null,
        '  '
    );
    const themeNames = JSON.stringify(
        elements.filter(el => el.type === 'theme').map(el => el.bare),
        null,
        '  '
    );

    const parts = [];
    if (userImports) parts.push(userImports);
    parts.push(`window.feezal.elements = ${elementNames};`);
    parts.push(`window.feezal.themes = ${themeNames};`);
    return parts.join('\n\n') + '\n';
}

/**
 * Writes www/editor/feezal-elements.js using bare specifiers for the Vite build.
 *
 * This file is imported by viewer-main.js at build time, so Vite/Rollup resolves the
 * bare specifiers against node_modules and bundles all elements into viewer-bundle.js.
 * It is NOT imported by the editor entry at runtime — the editor loads the dynamic
 * Express route instead.
 *
 * Also triggers a best-effort refresh of Material Design Icons codepoints.
 *
 * @param {string} wwwDir   Absolute path to the www/ source directory (not dist/).
 * @param {object} logger
 * @returns {Promise<void>}
 */
async function writeElementsFile(wwwDir, logger) {
    fetchMaterialIcons(wwwDir);

    // For writing the build-time file, scan node_modules/ directly (we're in the monorepo).
    const nodeModulesDir = path.join(wwwDir, 'node_modules');
    const elements = [];
    _scan(nodeModulesDir, nodeModulesDir, elements, 'bundled');

    // Built-in elements from src/ — included via relative import for the viewer bundle.
    const srcDir = path.join(wwwDir, 'src');
    if (fs.existsSync(srcDir)) {
        fs.readdirSync(srcDir)
            .filter(f => f.startsWith('feezal-element-') && f.endsWith('.js'))
            .forEach(f => {
                const bare = f.replace(/\.js$/, '');
                elements.push({bare, importPath: `../src/${f}`, type: 'element', kind: 'builtin', builtin: true});
                logger.info('found built-in element ' + bare);
            });
    }

    elements.filter(el => !el.builtin).forEach(el => logger.info('found element ' + el.bare));

    const code =
        elements.map(el => `import '${el.builtin ? el.importPath : el.bare}';`).join('\n') +
        '\n\n' +
        'window.feezal.elements = ' +
            JSON.stringify(
                elements.filter(el => el.type === 'element').map(el => el.bare),
                null,
                '  '
            ) +
        ';\n\n' +
        'window.feezal.themes = ' +
            JSON.stringify(
                elements.filter(el => el.type === 'theme').map(el => el.bare),
                null,
                '  '
            ) +
        ';\n';

    await fs.promises.writeFile(
        path.join(wwwDir, 'editor', 'feezal-elements.js'),
        code,
        'utf8'
    );
}

function _scan(dir, baseDir, elements, kind) {
    if (!fs.existsSync(dir)) {
        return;
    }

    const list = fs.readdirSync(dir);

    // Recurse into scoped package directories (e.g. @feezal)
    list
        .filter(p => !BLACKLIST.has(p) && p.startsWith('@'))
        .forEach(p => _scan(path.join(dir, p), baseDir, elements, kind));

    // Collect matching packages
    list
        .filter(p => !BLACKLIST.has(p))
        .filter(p => p.startsWith('feezal-element-') || p.startsWith('feezal-theme-'))
        .forEach(p => {
            const absolute = path.join(dir, p);
            const pkgPath = path.join(absolute, 'package.json');
            if (!fs.existsSync(pkgPath)) {
                return;
            }

            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            const type = p.startsWith('feezal-element-') ? 'element' : 'theme';
            const bare = path.relative(baseDir, absolute).split(path.sep).join('/');
            const main = pkg.main || 'index.js';
            elements.push({absolute, bare, type, main, kind, builtin: false});
        });
}

function fetchMaterialIcons(wwwDir) {
    const dest = path.join(wwwDir, 'src', 'material-design-icons.js');
    if (!fs.existsSync(path.dirname(dest))) {
        return; // prod: src/ directory not present, nothing to update
    }

    const url = 'https://raw.githubusercontent.com/google/material-design-icons/master/font/MaterialIcons-Regular.codepoints';
    fetch(url)
        .then(res => res.text())
        .then(body => {
            const icons = body.split('\n').map(line => line.split(' ')[0]).filter(Boolean);
            fs.writeFileSync(dest, 'export default ' + JSON.stringify(icons));
        })
        .catch(() => {
            // Non-fatal: icons file may already exist from a previous run
        });
}

module.exports = {discoverElements, generateElementsModule, writeElementsFile};

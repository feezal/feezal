'use strict';

const path = require('path');
const fs   = require('fs').promises;
const {Writable} = require('stream');
const crypto = require('node:crypto');

const {ZipArchive} = require('archiver');
const {extractUsedElements, tagsToPackages, partitionPackages} = require('./extract-elements.js');

/**
 * In-memory cache: sorted-package-list hash  →  {code, sizeKb, elemCount}
 * Cleared on server restart.  Keyed by a SHA-256 of the element+theme list.
 */
const _bundleCache = new Map();

/**
 * Build a minimal IIFE bundle containing only the feezal packages actually
 * used in the given site HTML.  Results are cached in-memory by a hash of
 * the resolved package list; the cache persists for the lifetime of the
 * server process.
 *
 * Throws if the Vite build fails — callers should catch and fall back.
 *
 * @param {string}      wwwDir     Absolute path to www/.
 * @param {string}      siteHtml   Raw views.html content (parsed for element tags).
 * @param {string|null} theme      Active theme name (e.g. 'feezal-theme-dark-mint')
 *                                 or null for the default theme.
 * @param {object}      logger
 * @returns {Promise<string>}  Minified IIFE JS string.
 */
async function buildFilteredBundle(wwwDir, siteHtml, theme, logger) {
    const nodeModulesDir = path.join(wwwDir, 'node_modules');

    // Determine which element packages the site actually needs.
    const usedTags = extractUsedElements(siteHtml);
    const usedPackages = tagsToPackages(usedTags);

    // Add the active theme package if it is a built-in one (i.e. package exists).
    const themePackage = theme ? `@feezal/${theme}` : null;
    if (themePackage && !usedPackages.includes(themePackage)) {
        usedPackages.push(themePackage);
    }

    const {resolvable, missing} = partitionPackages(nodeModulesDir, usedPackages);

    if (missing.length) {
        logger.debug(`export: ${missing.length} package(s) not found, will be skipped: ${missing.join(', ')}`);
    }

    logger.debug(`export: building filtered bundle with ${resolvable.length} package(s): ${resolvable.join(', ')}`);

    // Stable cache key from the exact resolved package list.
    const cacheKey = crypto
        .createHash('sha256')
        .update(resolvable.slice().sort().join('\n'))
        .digest('hex')
        .slice(0, 16);

    if (_bundleCache.has(cacheKey)) {
        const cached = _bundleCache.get(cacheKey);
        logger.debug(`export: cache hit (${cached.sizeKb} kB, ${cached.elemCount} elements)`);
        return cached.code;
    }

    // Generate a temporary entry file that imports only the needed packages.
    // feezal-app-viewer.js already imports feezal-site.js and feezal-view.js.
    const entryLines = [
        "import './feezal-connection.js';",
        "import './feezal-app-viewer.js';",
        ...resolvable.map(pkg => `import '${pkg}';`)
    ];
    const entryPath = path.join(wwwDir, 'src', '_export-entry.js');
    await fs.writeFile(entryPath, entryLines.join('\n') + '\n', 'utf8');

    try {
        // Load Vite via dynamic import (Vite 6 is ESM-only; we are in CJS).
        const vitePath = path.join(nodeModulesDir, 'vite', 'dist', 'node', 'index.js');
        const {build: viteBuild} = await import(vitePath);

        logger.debug('export: starting Vite build...');
        const t0 = Date.now();

        const result = await viteBuild({
            root: wwwDir,
            logLevel: 'silent',
            configFile: false,            // don't load www/vite.config.js
            build: {
                write: false,             // in-memory output only
                minify: 'esbuild',
                reportCompressedSize: false,
                rollupOptions: {
                    input: {'viewer-bundle': entryPath},
                    output: {
                        format: 'iife',
                        name: '_feezal',
                        inlineDynamicImports: true,
                        entryFileNames: '[name].js'
                    },
                    onwarn(w) {
                        if (w.code !== 'CIRCULAR_DEPENDENCY') {
                            logger.debug(`export: rollup ${w.code}: ${w.message}`);
                        }
                    }
                }
            }
        });

        // result may be a single output object or an array (multi-config).
        const outputs = Array.isArray(result) ? result : [result];
        const chunk = outputs[0].output.find(c => c.type === 'chunk' && c.isEntry);
        if (!chunk) throw new Error('Vite build produced no entry chunk');

        const elapsed = Date.now() - t0;
        const sizeKb = Math.round(chunk.code.length / 1024);
        logger.debug(`export: filtered bundle built in ${elapsed} ms — ${sizeKb} kB (${resolvable.length} elements)`);

        _bundleCache.set(cacheKey, {code: chunk.code, sizeKb, elemCount: resolvable.length});
        return chunk.code;
    } finally {
        await fs.unlink(entryPath).catch(() => {});
    }
}

/**
 * Composes the static index.html with all viewer JS inlined as a plain
 * <script> block (no module imports, no external files — works on file://).
 */
function composeIndexHtml(siteName, siteHtml, connectionConfig, inlineJs, themeOverrides, userThemeCss, classes) {
    const connectionAttr = connectionConfig && Object.keys(connectionConfig).length
        ? ` config='${JSON.stringify(connectionConfig).replace(/'/g, "&#39;")}'`
        : '';

    // Build inline style for colour-variable overrides (sanitised).
    let overrideStyle = '';
    if (themeOverrides && Object.keys(themeOverrides).length) {
        const props = Object.entries(themeOverrides)
            .filter(([k]) => /^--[\w-]+$/.test(k))
            .map(([k, v]) => `${k}:${String(v).replace(/[;"'\\]/g, '')}`)
            .join(';');
        if (props) overrideStyle = `\n<style>feezal-site{${props}}</style>`;
    }

    // Inline user-theme CSS (already loaded by caller if applicable).
    const userThemeStyle = userThemeCss ? `\n<style>${userThemeCss}</style>` : '';

    // Build CSS for defined classes.
    let classesStyle = '';
    if (classes && Object.keys(classes).length) {
        const cssText = Object.entries(classes)
            .map(([name, props]) => {
                if (!/^[a-zA-Z][\w-]*$/.test(name)) return '';
                const propStr = Object.entries(props || {})
                    .filter(([k, v]) => k && v && /^[\w-]+$/.test(k))
                    .map(([k, v]) => `${k}:${String(v).replace(/[;"'\\]/g, '')}`)
                    .join(';');
                return propStr ? `.feezal-class-${name}{${propStr}}` : '';
            })
            .filter(Boolean).join('\n');
        if (cssText) classesStyle = `\n<style>${cssText}</style>`;
    }

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Feezal - ${siteName}</title>
<style>
html, body { width: 100%; height: 100%; padding: 0; margin: 0; font-family: 'Roboto', sans-serif; font-size: 14px; }
.feezal-view { margin: auto !important; }
</style>
<link href="https://fonts.googleapis.com/css?family=Roboto|Material+Icons&display=block" rel="stylesheet">
<script>
window.feezal = {
    elements: new Set(),
    _subQueue: [],
    define: (tag, elem) => { window.customElements.define(tag, elem); window.feezal.elements.add(tag); },
    get app() { return document.querySelector('feezal-app-viewer'); },
    get connection() {
        const el = document.querySelector('feezal-connection');
        if (!el) return null;
        if (typeof el.sub !== 'function') {
            return {
                sub: (topic, options, callback) => { if (topic) feezal._subQueue.push({topic, options, callback}); },
                unsubscribe: () => {},
                pub: () => {},
                connected: false
            };
        }
        return el;
    },
    get site() { return feezal.app.querySelector('feezal-site'); },
    get view() { return feezal.getView(feezal.site && feezal.site.view); },
    get views() { return feezal.app.querySelectorAll('feezal-view'); },
    get container() { return feezal.app.shadowRoot.querySelector('#container'); },
    getView(name) {
        if (!name) return feezal.site.querySelector('feezal-view');
        return feezal.site.querySelector('feezal-view[name="' + name + '"]');
    },
    // Assets are bundled alongside index.html in the ZIP — paths are already relative.
    resolveAsset(p) { return p || ''; }
};
<` + `/script>${userThemeStyle}${overrideStyle}${classesStyle}
</head>
<body>
<feezal-connection backend="mqtt"${connectionAttr}></feezal-connection>
<feezal-app-viewer>${siteHtml}</feezal-app-viewer>
<script>${inlineJs}<` + `/script>
</body>
</html>`;
}

/**
 * Builds a static export ZIP for the given site.
 *
 * The ZIP contains a single index.html with all viewer JS inlined — no
 * separate script files. This means the file works from a file:// URL
 * (no CORS) and on any static host with no further configuration.
 *
 * The JS is assembled by running a per-site Vite build that only includes
 * the element packages actually referenced in the site HTML (tree-shaking).
 * Output is minified with esbuild and cached in-memory by a hash of the
 * resolved package list.  If the Vite build fails for any reason the
 * function falls back to wrapping the full pre-built viewer-bundle.js with
 * Rollup (same behaviour as before A8).
 *
 * @param {string} wwwDir    Absolute path to the www/ directory.
 * @param {string} siteName  Used in the page title.
 * @param {object} site      { html: string, config: object } from storage.getSite()
 * @param {object} [logger]  Optional logger with debug/info/error methods.
 * @returns {Promise<Buffer>} ZIP file buffer
 */
async function createExport(wwwDir, siteName, {html: siteHtml, config}, logger = console, storage = null) {
    const distDir = path.join(wwwDir, 'dist');
    const connectionConfig = (config && config.connection) || null;
    const theme = (config && config.viewer && config.viewer.theme) || null;
    const themeOverrides = (config && config.viewer && config.viewer.themeOverrides) || {};
    const classes = (config && config.viewer && config.viewer.classes) || {};

    // Inline user-theme CSS when the active theme is a user-defined one.
    let userThemeCss = '';
    if (theme && storage && storage.dataDir) {
        const userThemeFile = path.join(storage.dataDir, 'themes', theme + '.css');
        try {
            userThemeCss = require('fs').readFileSync(userThemeFile, 'utf8');
        } catch { /* not a user theme */ }
    }

    // Re-apply the theme class to feezal-site (stripped on deploy, stored in viewer.theme).
    if (theme) {
        siteHtml = siteHtml.replace(/(<feezal-site\b)([^>]*)(>)/, (_, tag, attrs, end) => {
            if (/\bclass="/.test(attrs)) {
                attrs = attrs.replace(/\bclass="/, `class="${theme} `);
            } else if (/\bclass[\s>]/.test(attrs + end)) {
                attrs = attrs.replace(/\bclass\b/, `class="${theme}"`);
            } else {
                attrs += ` class="${theme}"`;
            }
            return `${tag}${attrs}${end}`;
        });
    }

    // ------------------------------------------------------------------
    // Option A: per-site filtered Vite build (tree-shaking + minification)
    // ------------------------------------------------------------------
    let inlineJs = await buildFilteredBundle(wwwDir, siteHtml, theme, logger)
        .catch(err => {
            logger.warn(`export: filtered Vite build failed (${err.message}), falling back to full bundle`);
            return null;
        });

    // ------------------------------------------------------------------
    // Fallback: full viewer-bundle.js wrapped as IIFE by Rollup.
    // The source is already minified by Vite so no extra minifier needed.
    // ------------------------------------------------------------------
    if (!inlineJs) {
        const rollupPath = path.join(wwwDir, 'node_modules', 'rollup', 'dist', 'rollup.js');
        logger.debug(`export: loading Rollup fallback from ${rollupPath}`);
        const {rollup} = require(rollupPath);

        const inputPath = path.join(distDir, 'viewer-bundle.js');
        logger.debug(`export: bundling ${inputPath} via Rollup`);
        const bundle = await rollup({
            input: inputPath,
            onwarn(w) { logger.debug(`export: rollup warn: ${w.message}`); }
        });

        const {output} = await bundle.generate({
            format: 'iife',
            name: '_feezal',
            inlineDynamicImports: true
        });
        await bundle.close();

        inlineJs = output[0].code;
        logger.debug(`export: full bundle size: ${Math.round(inlineJs.length / 1024)} kB`);
    }

    logger.debug('export: composing HTML...');
    const indexHtml = composeIndexHtml(siteName, siteHtml, connectionConfig, inlineJs, themeOverrides, userThemeCss, classes);

    logger.debug('export: creating ZIP...');

    let assetFiles = null;
    if (storage) {
        try {
            assetFiles = await storage.getAssetFilesForExport(siteName);
        } catch (e) {
            logger.debug('export: could not gather assets: ' + e.message);
        }
    }

    return new Promise((resolve, reject) => {
        const chunks = [];
        const sink = new Writable({
            write(chunk, _enc, cb) { chunks.push(chunk); cb(); }
        });

        const archive = new ZipArchive({zlib: {level: 6}});
        archive.on('error', reject);
        sink.on('finish', () => resolve(Buffer.concat(chunks)));
        archive.pipe(sink);

        archive.append(indexHtml, {name: 'index.html'});

        if (assetFiles) {
            for (const file of assetFiles.global.files) {
                archive.file(path.join(assetFiles.global.base, file), {name: 'global/' + file});
            }
            for (const file of assetFiles.site.files) {
                archive.file(path.join(assetFiles.site.base, file), {name: 'assets/' + file});
            }
        }

        archive.finalize();
    });
}

module.exports = createExport;

'use strict';

const path = require('path');
const {Writable} = require('stream');

const {ZipArchive} = require('archiver');

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
 * The JS is assembled by running the pre-built Vite output through Rollup
 * (available in www/node_modules as a Vite peer dep) with
 * inlineDynamicImports:true, producing one self-contained IIFE.
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
                // quoted class="..." → prepend theme
                attrs = attrs.replace(/\bclass="/, `class="${theme} `);
            } else if (/\bclass[\s>]/.test(attrs + end)) {
                // bare class attribute (no value) → replace with proper value
                attrs = attrs.replace(/\bclass\b/, `class="${theme}"`);
            } else {
                attrs += ` class="${theme}"`;
            }
            return `${tag}${attrs}${end}`;
        });
    }

    // Rollup lives in www/node_modules (installed as a Vite peer dep).
    // Require the CJS entry directly — avoids package exports-map resolution
    // issues when require() is called with a directory path.
    const rollupPath = path.join(wwwDir, 'node_modules', 'rollup', 'dist', 'rollup.js');
    logger.debug(`export: loading Rollup from ${rollupPath}`);
    const {rollup} = require(rollupPath);

    const inputPath = path.join(distDir, 'viewer-bundle.js');
    logger.debug(`export: bundling ${inputPath}`);
    const bundle = await rollup({
        input: inputPath,
        onwarn(w) { logger.debug(`export: rollup warn: ${w.message}`); }
    });

    logger.debug('export: generating IIFE output (inlineDynamicImports)...');
    const {output} = await bundle.generate({
        format: 'iife',
        name: '_feezal',           // IIFE wrapper name -- unused at runtime
        inlineDynamicImports: true // fold every dynamic import() into the bundle
    });

    await bundle.close();

    logger.debug(`export: JS inlined (${output[0].code.length} chars), composing HTML...`);
    const inlineJs = output[0].code;
    const indexHtml = composeIndexHtml(siteName, siteHtml, connectionConfig, inlineJs, themeOverrides, userThemeCss, classes);

    logger.debug('export: creating ZIP...');

    // Gather assets before entering the Promise constructor (can't use await inside it).
    let assetFiles = null;
    if (storage) {
        try {
            assetFiles = await storage.getAssetFilesForExport(siteName);
        } catch (e) {
            logger.debug('export: could not gather assets: ' + e.message);
        }
    }

    // Package into a ZIP -- single index.html, no separate JS assets needed.
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

        // Bundle assets into the ZIP
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

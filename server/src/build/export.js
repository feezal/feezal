'use strict';

const path = require('path');
const fs   = require('fs').promises;
const {Writable} = require('stream');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const {ZipArchive} = require('archiver');
const {extractUsedElements, tagsToPackages, buildTagToPackageMap, partitionPackages} = require('./extract-elements.js');
const {usedUserPackages} = require('./elements.js');
const {siteIconArtifacts} = require('./icons.js');
const pwa = require('./pwa.js');

/**
 * In-memory cache: sorted-package-list hash  →  {code, sizeKb, elemCount, report}
 * Cleared on server restart.  Keyed by a SHA-256 of the element+theme list.
 */
const _bundleCache = new Map();

/**
 * U34: map one Rollup module id to a size-report bucket.
 *
 * Buckets: one per `@feezal/feezal-{element,theme,icons}-*` package, the
 * shared element runtime, one per top-level npm dependency (lit, mqtt, …),
 * and "feezal core" for the viewer runtime in www/src plus virtual helper
 * modules (Vite polyfills, commonjs shims — a few hundred bytes).
 */
function bucketForModuleId(id) {
    const p = String(id).replace(/^\0/, '').replace(/\\/g, '/');
    // Feezal packages by name — matches both node_modules/@feezal/… and the
    // workspace real path packages/@feezal/… (Vite resolves the symlink).
    const feezalPkg = p.match(/@feezal\/(feezal-(?:element|theme|icons)-[a-z0-9-]+)\//);
    if (feezalPkg) return '@feezal/' + feezalPkg[1];
    if (/@feezal\/feezal-element\//.test(p)) return '@feezal/feezal-element (runtime)';
    const dep = p.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
    if (dep) return dep[1];
    return 'feezal core';
}

/**
 * U34: aggregate an output chunk's per-module byte attribution into buckets.
 *
 * Rollup's `modules` map carries pre-minification `renderedLength`/`code`
 * per module id (Vite minifies the finished chunk afterwards), so per-bucket
 * numbers are pro-rata estimates normalised to the exact totals: minified
 * bytes scale each bucket's rendered share to `chunk.code.length`; gzip
 * compresses each bucket's concatenated source independently and scales the
 * results so they add up to the whole-bundle gzip. Totals are exact.
 *
 * Returns null when the build carries no usable module metadata.
 */
function buildBundleReport(chunk) {
    if (!chunk || !chunk.modules || !chunk.code) return null;

    const buckets = new Map();   // name → {rendered, code}
    let totalRendered = 0;
    for (const [id, mod] of Object.entries(chunk.modules)) {
        const rendered = (mod && mod.renderedLength) || 0;
        if (!rendered) continue;
        const name = bucketForModuleId(id);
        const bucket = buckets.get(name) || {rendered: 0, code: ''};
        bucket.rendered += rendered;
        if (mod.code) bucket.code += mod.code;
        buckets.set(name, bucket);
        totalRendered += rendered;
    }
    if (!totalRendered) return null;

    const totalMinified = chunk.code.length;
    const totalGzip = zlib.gzipSync(chunk.code).length;

    const raw = [...buckets].map(([name, bucket]) => ({
        name,
        rendered: bucket.rendered,
        // no rendered source (tree-shaken re-exports etc.) → assume the
        // average compression ratio via the normalisation below
        gzRaw: bucket.code ? zlib.gzipSync(bucket.code).length : bucket.rendered,
    }));
    const gzSum = raw.reduce((sum, r) => sum + r.gzRaw, 0);

    const rows = raw
        .map(r => ({
            name: r.name,
            minified: Math.round((r.rendered / totalRendered) * totalMinified),
            gzip: Math.round((r.gzRaw / gzSum) * totalGzip),
        }))
        .sort((a, b) => b.minified - a.minified);

    return {totalMinified, totalGzip, estimate: true, buckets: rows};
}

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
 * @returns {Promise<{code: string, report: object|null}>}
 *          Minified IIFE JS string + U34 per-bucket size report.
 */
/**
 * U51 — full theme class names referenced by per-view `theme` attributes in
 * the site markup (bare suffixes normalized to feezal-theme-<name>).
 */
function viewThemeClasses(siteHtml) {
    const out = new Set();
    for (const m of String(siteHtml || '').matchAll(/<feezal-view\b[^>]*\btheme\s*=\s*"([^"]+)"/g)) {
        const cls = m[1].startsWith('feezal-theme-') ? m[1] : 'feezal-theme-' + m[1];
        if (/^feezal-theme-[\w-]+$/.test(cls)) out.add(cls);
    }
    return out;
}

async function buildFilteredBundle(wwwDir, siteHtml, theme, logger) {
    const nodeModulesDir = path.join(wwwDir, 'node_modules');

    // Determine which element packages the site actually needs. Tags exposed
    // by multi-element family packages (N29 Phase B) resolve through the
    // manifest map instead of the @feezal/<tag> convention.
    const usedTags = extractUsedElements(siteHtml);
    const usedPackages = tagsToPackages(usedTags, buildTagToPackageMap(nodeModulesDir));

    // Add the active theme package if it is a built-in one (i.e. package exists).
    const themePackage = theme ? `@feezal/${theme}` : null;
    if (themePackage && !usedPackages.includes(themePackage)) {
        usedPackages.push(themePackage);
    }

    // U51: per-view themes — every theme a feezal-view references must ship
    // in the bundle too (bundled theme packages inject their CSS on import).
    for (const cls of viewThemeClasses(siteHtml)) {
        const pkg = `@feezal/${cls}`;
        if (!usedPackages.includes(pkg)) usedPackages.push(pkg);
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
        return {code: cached.code, report: cached.report};
    }

    // Generate a temporary entry file that imports only the needed packages.
    // feezal-app-viewer.js already imports feezal-site.js and feezal-view.js.
    // feezal-presence.js is part of the viewer runtime (N24: status toast,
    // retained presence status, per-client commands) — viewer-main.js imports
    // it for the served viewer; exports need it here too.
    const entryLines = [
        "import './feezal-connection.js';",
        "import './feezal-app-viewer.js';",
        "import './feezal-component.js';",
        "import './feezal-icon.js';",
        "import './feezal-presence.js';",
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
            plugins: [
                // Exports are always ws:// (direct MQTT). The feezal bridge backend
                // (socket.io-client) is never reachable — stub it out so it doesn't
                // get bundled.
                {
                    name: 'feezal-export-strip-socketio',
                    load(id) {
                        if (id.includes('feezal-connection-feezal')) return '';
                    }
                }
            ],
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

        // U34: per-contributor size report — a by-product of this build.
        const report = buildBundleReport(chunk);

        _bundleCache.set(cacheKey, {code: chunk.code, sizeKb, elemCount: resolvable.length, report});
        return {code: chunk.code, report};
    } finally {
        await fs.unlink(entryPath).catch(() => {});
    }
}

/**
 * A16: plan the asset bundle for a static export.
 *
 * Only assets actually *referenced* by the site (markup, config, user theme
 * CSS) are bundled, and everything lands in a single `assets/` tree next to
 * index.html — the editor-only `global/` pool never leaks into the bundle.
 *
 * Recognised reference forms in `scanText`:
 *   /assets/<site>/<p>   current copy-on-use form (absolute server URL)
 *   /assets/global/<p>   legacy global reference (absolute server URL)
 *   assets/<p>           relative site form (already export-ready)
 *   global/<p>           relative legacy global form
 *
 * Site assets keep their relative path under `assets/` and are authoritative
 * on collisions; a referenced global asset whose path is already taken gets a
 * `-1`, `-2`, … suffix before the extension. Absolute references are always
 * rewritten to the relative `assets/…` form so the bundle works on file://.
 *
 * @returns {{entries: Array<{abs: string, zip: string}>,
 *            rewrites: Array<[string, string]>}}
 */
function planExportAssets(scanText, siteName, assetFiles) {
    const entries = [];
    const rewrites = [];
    if (!assetFiles) return {entries, rewrites};

    const pools = {
        site:   {base: assetFiles.site.base,   files: new Set(assetFiles.site.files)},
        global: {base: assetFiles.global.base, files: new Set(assetFiles.global.files)},
    };
    const decode = s => { try { return decodeURIComponent(s); } catch { return s; } };
    const poolPath = (pool, raw) => {
        const p = decode(raw);
        if (pools[pool].files.has(p)) return p;
        if (pools[pool].files.has(raw)) return raw;
        return null;                                   // referenced but not on disk
    };

    // ── collect references ───────────────────────────────────────────────
    // refText is the exact substring in the document (tail encoding preserved).
    const refs = [];
    const escapedSite = siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const absRe = new RegExp(`/assets/(global|${escapedSite})/([^"'()\\s>]+)`, 'g');
    for (const m of scanText.matchAll(absRe)) {
        refs.push({text: m[0], tail: m[2], pool: m[1] === 'global' ? 'global' : 'site'});
    }
    // relative forms only in attribute/url positions to avoid matching prose
    const relRe = /(["'(=])(global|assets)\/([^"'()\s>]+)/g;
    for (const m of scanText.matchAll(relRe)) {
        refs.push({text: m[2] + '/' + m[3], tail: m[3], pool: m[2] === 'global' ? 'global' : 'site', relative: true});
    }

    // ── assign ZIP paths: site first (authoritative), then global ───────
    const taken = new Map();     // zip-relative path under assets/ → source key
    const zipped = new Set();    // de-dupe entries
    const addEntry = (pool, diskPath, target) => {
        const zip = 'assets/' + target;
        if (zipped.has(zip)) return;
        zipped.add(zip);
        entries.push({abs: path.join(pools[pool].base, diskPath), zip});
    };

    for (const ref of refs.filter(r => r.pool === 'site')) {
        const p = poolPath('site', ref.tail);
        if (p === null) continue;
        taken.set(p, 'site:' + p);
        addEntry('site', p, p);
        if (!ref.relative) rewrites.push([ref.text, 'assets/' + ref.tail]);
    }

    const globalTarget = new Map();  // disk path → assigned target
    for (const ref of refs.filter(r => r.pool === 'global')) {
        const p = poolPath('global', ref.tail);
        if (p === null) continue;
        let target = globalTarget.get(p);
        if (!target) {
            target = p;
            let n = 0;
            while (taken.has(target) && taken.get(target) !== 'global:' + p) {
                n += 1;
                target = p.replace(/(\.[^./\\]*)?$/, ext => `-${n}${ext || ''}`);
            }
            taken.set(target, 'global:' + p);
            globalTarget.set(p, target);
            addEntry('global', p, target);
        }
        // renamed targets are written raw (matching how the markup stores names)
        rewrites.push([ref.text, 'assets/' + (target === p ? ref.tail : target)]);
    }

    // longest-first so absolute forms never get clipped by relative ones
    rewrites.sort((a, b) => b[0].length - a[0].length);
    return {entries, rewrites};
}

/** Apply [from, to] pairs to a string (no-op for empty input). */
function applyRewrites(text, rewrites) {
    let out = text;
    for (const [from, to] of rewrites) out = out.split(from).join(to);
    return out;
}

/**
 * Composes the static index.html with all viewer JS inlined as a plain
 * <script> block (no module imports, no external files — works on file://).
 *
 * N27: `userPkgModules` ([{name, code}]) are the used installed packages'
 * self-contained ESM bundles, inlined as module scripts after the viewer
 * bundle (inline modules run from file://; src= module references don't).
 */
function composeIndexHtml(siteName, siteHtml, connectionConfig, inlineJs, themeOverrides, userThemeCss, classes, userPkgModules = []) {
    // A closing </script> inside the bundled code would terminate the inline
    // script early — the standard escape keeps the JS semantics identical.
    const escapeInline = code => code.replace(/<\/script/gi, '<\\/script');
    const userPkgScripts = userPkgModules
        .map(m => `\n<script type="module">/* ${m.name} (installed package) */\n${escapeInline(m.code)}<` + `/script>`)
        .join('');
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
<link href="fonts/fonts.css" rel="stylesheet">
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
<script>${inlineJs}<` + `/script>${userPkgScripts}
</body>
</html>`;
}

/**
 * N10: never bake broker credentials into a static export — anyone holding
 * the file could read them. Credentials (URI userinfo or username/password
 * fields) are stripped and replaced by a `credentialPrompt` flag; the
 * exported viewer asks for them at runtime (feezal-connection-mqtt) and
 * keeps them in session/local storage on the device. The viaServer flag is
 * dropped too — exports are always direct browser connections.
 */
function sanitizeExportConnection(connectionConfig, logger = console) {
    if (!connectionConfig) return null;
    const sanitized = {...connectionConfig};
    delete sanitized.viaServer;
    let hadCredentials = false;
    if (sanitized.username || sanitized.password) {
        hadCredentials = true;
        delete sanitized.username;
        delete sanitized.password;
    }
    if (sanitized.uri) {
        try {
            const u = new URL(sanitized.uri);
            if (u.username || u.password) {
                hadCredentials = true;
                u.username = '';
                u.password = '';
                sanitized.uri = u.toString();
            }
        } catch { /* unparseable URI — leave as-is */ }
    }
    if (hadCredentials) {
        sanitized.credentialPrompt = true;
        logger.info('export: broker credentials stripped — the exported viewer will prompt at runtime');
    }
    return sanitized;
}

/**
 * N8/N10: exports do TLS in the browser — the CA / client certificate
 * uploaded on the server can never apply there. When the site has TLS
 * material, ship per-platform setup instructions in the ZIP (the
 * certificates themselves are deliberately NOT included: a private key in
 * a static file would be a liability).
 */
function buildTlsSetupMd(siteName, {ca, mtls}) {
    const lines = [
        `# TLS setup for the "${siteName}" dashboard`,
        '',
        'This exported dashboard connects to your MQTT broker **directly from the',
        'browser** (`wss://`). TLS is handled by the browser itself, so the',
        'certificates configured on the feezal server are **not** part of this',
        'export and cannot be — browsers only trust certificates from the',
        'operating system / browser certificate store.',
        '',
        '> **Shortcut:** if you can put a publicly trusted certificate (e.g.',
        '> Let\'s Encrypt) on your broker, do that — every device then works',
        '> without any of the steps below.',
        ''
    ];
    if (ca) {
        lines.push(
            '## Trust the broker\'s CA certificate',
            '',
            'Your broker uses a self-signed or private-CA certificate. Import the',
            'CA certificate (`ca.pem` / `.crt`) **on every device** that opens this',
            'dashboard:',
            '',
            '- **Windows:** double-click the certificate → *Install Certificate* →',
            '  *Local Machine* → store: *Trusted Root Certification Authorities*',
            '  (or `certmgr.msc`).',
            '- **macOS:** double-click to open *Keychain Access* → add to the',
            '  *System* keychain → set *Trust* → *Always Trust*.',
            '- **Linux:** copy to `/usr/local/share/ca-certificates/` and run',
            '  `sudo update-ca-certificates` (Debian/Ubuntu) or use `trust anchor`',
            '  (Fedora/Arch). Chrome/Chromium may additionally need',
            '  `certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n broker-ca -i ca.pem`.',
            '- **Firefox (all platforms):** Firefox keeps its own store — Settings →',
            '  *Privacy & Security* → *Certificates* → *View Certificates* →',
            '  *Authorities* → *Import*, tick *Trust this CA to identify websites*.',
            '- **Android:** Settings → *Security* → *Encryption & credentials* →',
            '  *Install a certificate* → *CA certificate*.',
            '- **iOS:** AirDrop/mail the file, install the profile under Settings →',
            '  *General* → *VPN & Device Management*, then enable full trust under',
            '  Settings → *General* → *About* → *Certificate Trust Settings*.',
            ''
        );
    }
    if (mtls) {
        lines.push(
            '## Client certificate (mTLS)',
            '',
            'Your broker requires mutual TLS. The client certificate and private',
            'key are **not** included in this export. Obtain them from whoever',
            'operates the broker (as a `.p12`/`.pfx` bundle) and install them in',
            'the OS / browser certificate store of every device — the browser',
            'presents the certificate automatically when the broker requests it',
            'during the TLS handshake:',
            '',
            '- **Windows:** double-click the `.p12`/`.pfx` → Certificate Import',
            '  Wizard → *Personal* store.',
            '- **macOS:** double-click → *Keychain Access* → *login* keychain.',
            '- **Linux (Chrome/Chromium):**',
            '  `pk12util -d sql:$HOME/.pki/nssdb -i client.p12`',
            '- **Firefox:** Settings → *Certificates* → *View Certificates* →',
            '  *Your Certificates* → *Import*.',
            '- **Android/iOS:** install the `.p12` as a user certificate / identity',
            '  profile (same paths as the CA import above).',
            ''
        );
    }
    lines.push(
        '---',
        '',
        'See the feezal user guide (*TLS and self-signed brokers*) for the full',
        'explanation of which connection modes use which certificate store.',
        ''
    );
    return lines.join('\n');
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
async function createExport(wwwDir, siteName, site, logger = console, storage = null) {
    const bundle = await buildExportBundle(wwwDir, siteName, site, logger, storage);
    return zipBundle(siteName, bundle);
}

/**
 * Build the export content without zipping — index.html plus the file
 * entries (assets, PWA files). Reused by the Capacitor project export
 * (A9 Tier 2), which nests the same content under www/.
 *
 * @returns {Promise<{indexHtml: string,
 *          entries: Array<{zip: string, abs?: string, content?: string}>}>}
 */
async function buildExportBundle(wwwDir, siteName, {html: siteHtml, config}, logger = console, storage = null) {
    const distDir = path.join(wwwDir, 'dist');
    const connectionConfig = sanitizeExportConnection((config && config.connection) || null, logger);
    const theme = (config && config.viewer && config.viewer.theme) || null;
    const themeOverrides = (config && config.viewer && config.viewer.themeOverrides) || {};
    const classes = (config && config.viewer && config.viewer.classes) || {};

    // Inline user-theme CSS when the active theme is a user-defined one.
    // U51: per-view `theme` attributes may reference further themes — inline
    // every referenced user theme's CSS too (bundled themes ride along via
    // their packages in the filtered bundle).
    let userThemeCss = '';
    if (storage && storage.dataDir) {
        const wanted = new Set();
        if (theme) wanted.add(theme);
        for (const t of viewThemeClasses(siteHtml)) wanted.add(t);
        for (const cls of wanted) {
            try {
                userThemeCss += require('fs').readFileSync(path.join(storage.dataDir, 'themes', cls + '.css'), 'utf8') + '\n';
            } catch { /* not a user theme */ }
        }
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
        .then(result => result.code)
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

    // ------------------------------------------------------------------
    // N23: per-site icon tree-shaking. Icon sets are not part of the viewer
    // bundle — append a mini-registration containing only the icons this
    // site references. Runs after the bundle (either path), so
    // feezal.registerIcons is defined when the appended statements execute.
    // User-installed sets cannot be shaken (single-file install bundles) and
    // are not folded into exports — flagged in the log.
    // ------------------------------------------------------------------
    try {
        const userElementsDir = storage && storage.dataDir
            ? path.join(storage.dataDir, 'elements')
            : null;
        const {inlineJs: iconJs, userModuleUrls} = siteIconArtifacts({
            wwwDir, userElementsDir, siteHtml, logger
        });
        if (iconJs) {
            inlineJs += '\n;' + iconJs;
            logger.debug(`export: appended tree-shaken icon registrations (${Math.round(iconJs.length / 1024)} kB)`);
        }
        if (userModuleUrls.length) {
            logger.warn(`export: ${userModuleUrls.length} user-installed icon set(s) in use are not included in the export`);
        }
    } catch (err) {
        logger.warn('export: icon registration failed: ' + err.message);
    }

    // ------------------------------------------------------------------
    // N27: user-installed element/theme packages the site uses. Their
    // install bundles are self-contained ESM — inline each as a module
    // script in index.html. Inlining (not a src= reference) is required:
    // exports must work from file://, where external module scripts are
    // CORS-blocked but inline modules run fine.
    // ------------------------------------------------------------------
    const userPkgModules = [];   // [{name, code}]
    try {
        const userElementsDir = storage && storage.dataDir
            ? path.join(storage.dataDir, 'elements')
            : null;
        for (const el of usedUserPackages({wwwDir, userElementsDir, siteHtml, theme})) {
            const code = await fs.readFile(path.join(el.absolute, el.main), 'utf8');
            userPkgModules.push({name: el.bare, code});
            logger.debug(`export: inlining installed package ${el.bare} (${Math.round(code.length / 1024)} kB)`);
        }
    } catch (err) {
        logger.warn('export: user package inlining failed: ' + err.message);
    }

    // ------------------------------------------------------------------
    // A16: referenced-only assets, flattened into a single assets/ tree.
    // Absolute /assets/… references are rewritten to relative assets/…
    // so the bundle works from file://; legacy global/ references are
    // flattened (collision-suffixed) into the same tree.
    // ------------------------------------------------------------------
    let assetFiles = null;
    if (storage) {
        try {
            assetFiles = await storage.getAssetFilesForExport(siteName);
        } catch (e) {
            logger.debug('export: could not gather assets: ' + e.message);
        }
    }

    const scanText = [
        siteHtml,
        userThemeCss,
        JSON.stringify(themeOverrides),
        JSON.stringify(classes),
        JSON.stringify(connectionConfig || {})
    ].join('\n');
    const plan = planExportAssets(scanText, siteName, assetFiles);
    logger.debug(`export: bundling ${plan.entries.length} referenced asset(s), ${plan.rewrites.length} reference rewrite(s)`);

    siteHtml = applyRewrites(siteHtml, plan.rewrites);
    userThemeCss = applyRewrites(userThemeCss, plan.rewrites);
    const rewriteJson = obj => JSON.parse(applyRewrites(JSON.stringify(obj), plan.rewrites));
    const finalOverrides = rewriteJson(themeOverrides);
    const finalClasses = rewriteJson(classes);

    logger.debug('export: composing HTML...');
    let indexHtml = composeIndexHtml(siteName, siteHtml, connectionConfig, inlineJs, finalOverrides, userThemeCss, finalClasses, userPkgModules);

    // ------------------------------------------------------------------
    // A9: when the site opts in (viewer.pwa), the bundle becomes an
    // installable PWA — manifest + service worker + icons, all relative.
    // The registration is http-guarded: service workers can't register
    // from file://, so the offline bundle behaves exactly as before.
    // ------------------------------------------------------------------
    const pwaFiles = [];   // [{name, content}] strings appended to the ZIP
    const pwaIconEntries = [];   // [{abs, zip}]
    if (pwa.pwaEnabled(config)) {
        const iconOpts = {dataDir: storage && storage.dataDir, siteName, wwwDir};
        const icons = pwa.availableIcons(iconOpts);
        const meta = (storage && storage.dataDir) ? pwa.readPwaMeta(storage.dataDir, siteName) : null;

        const manifest = pwa.buildManifest({
            siteName,
            startUrl: './',
            scope: './',
            iconBase: 'icons/',
            icons,
            meta,
        });
        pwaFiles.push({name: 'manifest.webmanifest', content: JSON.stringify(manifest, null, 2)});
        // B52: key the cache name off the export CONTENT (there is no server
        // version at runtime) — re-exporting after a change yields a new
        // sw.js, so a hosted export updates installed PWAs on plain reload.
        const contentId = require('crypto').createHash('sha1').update(indexHtml).digest('hex').slice(0, 10);
        pwaFiles.push({name: 'sw.js', content: pwa.buildServiceWorker({
            cacheName: `feezal-pwa-${siteName}-${contentId}`,
            shell: ['./', ...icons.map(icon => 'icons/' + icon.name)],
        })});
        for (const icon of icons) {
            pwaIconEntries.push({abs: icon.file, zip: 'icons/' + icon.name});
        }

        indexHtml = pwa.injectPwaTags(indexHtml, {
            manifestUrl: 'manifest.webmanifest',
            appleTouchIconUrl: icons.some(i => i.name === 'apple-touch-icon.png')
                ? 'icons/apple-touch-icon.png' : null,
            themeColor: (meta && meta.backgroundColor) || undefined,
            swUrl: 'sw.js',
            httpGuard: true,
        });
        logger.debug(`export: PWA enabled — manifest + sw + ${pwaIconEntries.length} icon(s)`);
    }

    // ------------------------------------------------------------------
    // N8/N10: TLS setup instructions. Exports terminate TLS in the browser,
    // so uploaded CA / client certificates cannot apply — when the site has
    // TLS material, ship a TLS-SETUP.md (never the certificates themselves).
    // ------------------------------------------------------------------
    const securityFiles = [];
    if (storage && storage.dataDir) {
        const certsDir = path.join(storage.dataDir, 'sites', siteName, 'certs');
        const fsSync = require('fs');
        const hasCa = fsSync.existsSync(path.join(certsDir, 'ca.pem'));
        const hasClientCert = fsSync.existsSync(path.join(certsDir, 'client.crt'));
        if (hasCa || hasClientCert) {
            securityFiles.push({name: 'TLS-SETUP.md', content: buildTlsSetupMd(siteName, {ca: hasCa, mtls: hasClientCert})});
            logger.info(`export: site uses ${hasClientCert ? 'mTLS' : 'a private CA'} — TLS-SETUP.md included (certificates are NOT in the export)`);
        }
    }

    // A25: self-hosted fonts — the export's index.html links fonts/fonts.css
    // (relative), so the ZIP (and the Capacitor bundle nesting it) must carry
    // the font files; otherwise the export would fall back to raw ligature
    // text offline, or worse, someone would "fix" it with a CDN link again.
    const fontEntries = [];
    try {
        const fontsDir = path.join(distDir, 'fonts');
        for (const f of require('fs').readdirSync(fontsDir)) {
            fontEntries.push({abs: path.join(fontsDir, f), zip: 'fonts/' + f});
        }
    } catch (err) {
        logger.warn('export: fonts missing from dist (run the www build): ' + err.message);
    }

    return {
        indexHtml,
        entries: [
            // A16: one flat assets/ tree with only the referenced files.
            ...plan.entries.map(entry => ({zip: entry.zip, abs: entry.abs})),
            // A25: self-hosted Roboto + Material Icons.
            ...fontEntries,
            // A9: PWA manifest, service worker and icons (only when opted in).
            ...pwaFiles.map(file => ({zip: file.name, content: file.content})),
            ...pwaIconEntries.map(entry => ({zip: entry.zip, abs: entry.abs})),
            // N8/N10: TLS setup instructions when the site has TLS material.
            ...securityFiles.map(file => ({zip: file.name, content: file.content})),
        ],
    };
}

/**
 * U34: bundle size breakdown for a site's static export — what makes the
 * inlined viewer JS as big as it is.
 *
 * Runs (or cache-hits — same key as the export itself) the filtered Vite
 * build and returns its per-bucket report, plus the tree-shaken icon
 * registrations that get appended after the bundle. Throws when no report
 * is available (Vite build failed → the export would use the unattributable
 * full-bundle fallback).
 *
 * @returns {Promise<{totalMinified: number, totalGzip: number,
 *          estimate: boolean, elemCount: number,
 *          buckets: Array<{name: string, minified: number, gzip: number}>}>}
 */
async function exportBundleReport(wwwDir, siteName, {html: siteHtml, config}, logger = console, storage = null) {
    const theme = (config && config.viewer && config.viewer.theme) || null;
    const {report} = await buildFilteredBundle(wwwDir, siteHtml, theme, logger);
    if (!report) throw new Error('build produced no per-module metadata');

    // Copy — the cached report must stay pristine across calls.
    const out = {
        ...report,
        elemCount: report.buckets.filter(b => /^@feezal\/feezal-element-/.test(b.name)).length,
        buckets: report.buckets.map(bucket => ({...bucket})),
    };

    // N23 icon registrations are appended after the Vite bundle — size them
    // as their own bucket so the totals match the actual inlined JS.
    try {
        const userElementsDir = storage && storage.dataDir
            ? path.join(storage.dataDir, 'elements')
            : null;
        const {inlineJs: iconJs} = siteIconArtifacts({wwwDir, userElementsDir, siteHtml, logger});
        if (iconJs) {
            const gzip = zlib.gzipSync(iconJs).length;
            out.buckets.push({name: 'icons (tree-shaken)', minified: iconJs.length, gzip});
            out.totalMinified += iconJs.length;
            out.totalGzip += gzip;
            out.buckets.sort((a, b) => b.minified - a.minified);
        }
    } catch (err) {
        logger.warn('bundle report: icon sizing failed: ' + err.message);
    }

    // N27: used installed packages are inlined as module scripts — one
    // bucket per package so the report totals match the actual index.html.
    try {
        const userElementsDir = storage && storage.dataDir
            ? path.join(storage.dataDir, 'elements')
            : null;
        for (const el of usedUserPackages({wwwDir, userElementsDir, siteHtml, theme})) {
            const code = await fs.readFile(path.join(el.absolute, el.main), 'utf8');
            const gzip = zlib.gzipSync(code).length;
            out.buckets.push({name: `${el.bare} (installed)`, minified: code.length, gzip});
            out.totalMinified += code.length;
            out.totalGzip += gzip;
        }
        out.buckets.sort((a, b) => b.minified - a.minified);
    } catch (err) {
        logger.warn('bundle report: installed package sizing failed: ' + err.message);
    }

    return out;
}

/** Zip a bundle under a single top-level <sitename>/ folder (A15). */
function zipBundle(siteName, bundle) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const sink = new Writable({
            write(chunk, _enc, cb) { chunks.push(chunk); cb(); }
        });

        const archive = new ZipArchive({zlib: {level: 6}});
        archive.on('error', reject);
        sink.on('finish', () => resolve(Buffer.concat(chunks)));
        archive.pipe(sink);

        // Sanitise the name to a safe single path segment (defence-in-depth;
        // names are already validated).
        const dirName = String(siteName)
            .replace(/[\\/]/g, '_')
            .replace(/\.\.+/g, '.')
            .replace(/^\.+/, '')
            .trim() || 'site';
        const root = dirName + '/';

        archive.append(bundle.indexHtml, {name: root + 'index.html'});
        for (const entry of bundle.entries) {
            if (entry.abs) archive.file(entry.abs, {name: root + entry.zip});
            else archive.append(entry.content, {name: root + entry.zip});
        }

        archive.finalize();
    });
}

module.exports = createExport;
// reused by the Capacitor project export + exposed for unit tests
module.exports.buildExportBundle = buildExportBundle;
module.exports.planExportAssets = planExportAssets;
module.exports.applyRewrites = applyRewrites;
// U34: bundle size breakdown
module.exports.exportBundleReport = exportBundleReport;
module.exports.buildBundleReport = buildBundleReport;
module.exports.bucketForModuleId = bucketForModuleId;

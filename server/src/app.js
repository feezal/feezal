'use strict';

const path = require('path');
const http = require('http');
const crypto = require('crypto');
const {promises: fs} = require('fs');

const express = require('express');
const session = require('express-session');
const {Server: SocketIO} = require('socket.io');
const createAuthMiddleware = require('./auth/middleware.js');
const createApiRouter = require('./routes/api.js');
const mqttBridge = require('./mqtt/bridge.js');
const createHub = require('./socket/hub.js');
const pwa = require('./build/pwa.js');
const csp = require('./csp.js');
const {discoverElements, generateElementsModule, usedUserPackages} = require('./build/elements.js');
const {siteIconArtifacts} = require('./build/icons.js');

/** Format a git commit message for display in the historical-preview banner. */
function _fmtCommitLabel(msg) {
    if (!msg) return 'Auto-save';
    if (msg.startsWith('init:'))    return 'Initial version';
    if (msg.startsWith('restore:')) return msg.replace(/^restore:\s*/, '').replace(/\s*\([a-f0-9]{7}\)$/, '');
    if (msg.startsWith('save:'))    return 'Auto-save';
    if (/^\d{4}-\d{2}-\d{2}T/.test(msg)) {
        try { return new Date(msg).toLocaleString('en-US', {month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit'}); }
        catch { return msg; }
    }
    return msg;
}

/**
 * Creates the feezal Express application and Socket.IO server.
 *
 * @param {object} config
 * @param {string}         config.wwwDir           Absolute path to www/ directory.
 * @param {import('./storage/adapter')} config.storage
 * @param {string|null}    [config.editorPassword]  Plain-text password for editor access.
 * @param {string|boolean} [config.trustProxyAuth]  Proxy auth header name or true for default.
 * @param {boolean}        [config.publicViewer]    Whether /viewer routes require auth (default: true = public).
 * @param {object}         [config.logger]          Logger with debug/info/warn/error methods.
 * @returns {Promise<{app: express.Application, server: http.Server, io: SocketIO}>}
 */
async function createApp(config) {
    const {
        wwwDir,
        storage,
        editorPassword = null,
        trustProxyAuth = false,
        publicViewer = true,
        logger = console
    } = config;

    // --- Storage bootstrap ---
    // Initialise per-site git repositories for sites that already exist on disk.
    // New sites get their repo when first saved.  Errors are non-fatal.
    if (typeof storage.init === 'function') {
        await storage.init(logger).catch(err =>
            logger.warn('storage init: ' + err.message)
        );
    }

    const app = express();
    const server = http.createServer(app);

    // --- Auth setup ---
    const {editorAuth, loginRouter, sessionSecret} = await createAuthMiddleware({
        editorPassword,
        trustProxyAuth
    });

    app.use(session({
        secret: sessionSecret || crypto.randomBytes(32).toString('hex'),
        resave: false,
        saveUninitialized: false,
        cookie: {httpOnly: true, sameSite: 'strict'}
    }));

    // --- Socket.IO ---
    const io = new SocketIO(server, {
        path: '/socket.io'
    });

    // --- Body parsing ---
    // A9: PWA icon uploads carry a base64-encoded icon set + source image —
    // they need a larger limit and must be parsed BEFORE the default parser,
    // which would reject them with 413 at its 100kb default. The default
    // parser skips bodies that are already parsed.
    app.use('/api/sites/:name/pwa-icons', express.json({limit: '25mb'}));
    app.use(express.json());
    app.use(express.urlencoded({extended: false}));

    // --- A25: Content-Security-Policy ------------------------------------
    // The structural no-third-party guarantee: scripts, styles and fonts may
    // only come from feezal itself — a pasted CDN link fails loudly instead
    // of silently phoning out. Deliberately open where dashboards carry
    // user-configured content: images/media (cameras, OSM tiles, asset URLs),
    // connect (the MQTT broker lives wherever the user says), and frames
    // (basic-iframe embeds Grafana & friends). 'unsafe-inline' is required by
    // the generated viewer bootstrap and shadow-DOM style injection — this
    // CSP is an egress policy, not an XSS boundary.
    const CSP = [
        "default-src 'self'",
        // 'unsafe-eval': feezal-element-basic-template (and system-script)
        // compile the dashboard author's templates via new Function — a core
        // feature. The eval'd code is the author's own site content.
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self' data:",
        "img-src * data: blob:",
        "media-src * data: blob:",
        // B51: '*' does NOT match the data: scheme — Shoelace SYSTEM icons
        // (select carets, checkbox check, the U44 clear ×, dialog close) are
        // data:image/svg+xml URIs loaded via fetch(), so without data: here
        // they all render empty. Scheme-local, no egress hole.
        'connect-src * data:',
        'frame-src *',
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
    ].join('; ');
    app.use((_req, res, next) => {
        res.setHeader('Content-Security-Policy', CSP);
        next();
    });

    // --- A28: CSP violation reports (public — viewer pages post here) -----
    // Browsers send application/csp-report; a small per-site ring buffer
    // (local only, capped) feeds the Security tab's suggestion chips.
    app.post('/api/csp-report/:site',
        express.json({type: ['application/csp-report', 'application/json'], limit: '10kb'}),
        (req, res) => {
            const site = req.params.site;
            if (typeof site === 'string' && site.length <= 128 && !/[\\/]/.test(site)) {
                try { csp.recordViolation(site, req.body); } catch { /* malformed report */ }
            }
            res.status(204).end();
        });

    // --- Login routes (public) ---
    app.use('/login', loginRouter);

    // --- Redirect root to editor ---
    app.get('/', (_req, res) => res.redirect(302, '/editor/'));

    // --- Static files (Vite pre-built output) ---
    // The editor SPA and viewer bundle are built with `npm run build` inside www/.
    // In dev, wwwDir is the www/ parent so we append 'dist'; in production wwwDir IS
    // the dist directory already (server/dist/ or feezal/dist/ after npm install).
    const distDir = require('fs').existsSync(path.join(wwwDir, 'dist'))
        ? path.join(wwwDir, 'dist')
        : wwwDir;

    // --- B52: update-aware caching ------------------------------------
    // Content-hashed Vite output under /assets/ is immutable and may cache
    // forever; EVERYTHING with a stable name (viewer-bundle.js, editor/*,
    // the element manifest, fonts, user content) must revalidate on each
    // load — express already emits ETag/Last-Modified, so revalidation is a
    // cheap 304, not a re-download. Without this, browsers heuristically
    // cached the stable-name bundle, which after an update requested a
    // DELETED old hashed chunk → 404 until a hard refresh.
    const HASHED_ASSET = /[/\\]assets[/\\][^/\\]+-[\w-]{8,}\.\w+$/;
    const staticCacheHeaders = {
        setHeaders(res, filePath) {
            res.setHeader('Cache-Control', HASHED_ASSET.test(filePath)
                ? 'public, max-age=31536000, immutable'
                : 'no-cache');
        },
    };
    app.use('/', express.static(distDir, staticCacheHeaders));

    // Element packages: in production they live in packages/ (renamed from node_modules/
    // so npm publish doesn't strip them). In dev (monorepo) fall back to node_modules/.
    const elementPackagesDir = require('fs').existsSync(path.join(wwwDir, 'packages'))
        ? path.join(wwwDir, 'packages')
        : path.join(wwwDir, 'node_modules');
    app.use('/node_modules', express.static(elementPackagesDir, staticCacheHeaders));

    // --- Asset static files --- (A14 layout)
    // Global assets: /assets/global/<path>  →  <dataDir>/global/assets/<path>
    // Site assets:   /assets/<site>/<path>  →  <dataDir>/sites/<site>/assets/<path>
    // User themes:   /themes/<slug>.css     →  <dataDir>/themes/<slug>.css
    if (storage.dataDir) {
        app.use('/assets/global', express.static(path.join(storage.dataDir, 'global', 'assets'), staticCacheHeaders));
        app.get('/assets/:site/*', (req, res, next) => {
            const file = path.join(storage.dataDir, 'sites', req.params.site, 'assets', req.params[0]);
            res.setHeader('Cache-Control', 'no-cache');   // B52: user content revalidates
            res.sendFile(file, err => { if (err) next(); });
        });
        app.use('/themes', express.static(path.join(storage.dataDir, 'themes'), staticCacheHeaders));

        // User-installed element packages (drop-in; no rebuild required)
        app.use('/user-elements', express.static(path.join(storage.dataDir, 'elements'), staticCacheHeaders));
    }

    // --- Socket.IO hub ---
    // Must be created before the API router so getTopicCompletions is available.
    const {getTopicCompletions} = createHub(io, {storage, logger});

    // --- Protected API routes ---
    app.use('/api', editorAuth, createApiRouter(storage, wwwDir, logger, {
        getTopicCompletions,
        getDiscoveredEntities: mqttBridge.getDiscoveredEntities,
        getDiscoveredEntity:   mqttBridge.getDiscoveredEntity,
        getDeviceGroups:       mqttBridge.getDeviceGroups,
        emitElementsChanged:   () => io.emit('elementsChanged'),
    }));

    // --- Editor route (protected) ---
    // The editor SPA is served from dist/editor/index.html.
    // The site name is passed as the URL query: /editor/?/<siteName>/
    app.get('/editor/', editorAuth, (_req, res) => {
        res.setHeader('Cache-Control', 'no-cache');   // B52: revalidate each load
        res.sendFile(path.join(distDir, 'editor', 'index.html'));
    });

    // --- Legacy /feezal/* redirects (backward-compat for existing bookmarks) ---
    app.use('/feezal', (req, res) => {
        res.redirect(301, req.path || '/');
    });

    // --- Viewer route (dynamic HTML generation) ---
    // Generates a viewer page on-the-fly for each site.
    // The page loads the pre-built viewer-bundle.js and embeds the saved site HTML.
    // Viewer connects directly to MQTT-WS; no feezal server involvement at runtime.
    const defaultSiteName = 'default';

    const viewerHandler = async (req, res, next) => {
        try {
            const siteName = req.params.site || defaultSiteName;
            const {html: siteHtml, config} = await storage.getSite(siteName);

            // ?sha=<hex> — preview a historical version of views.html.
            // The historical viewer config (theme, overrides, classes) is used for
            // the preview; connection settings are always taken from the current
            // config so we never try to reconnect to a stale broker address.
            let historicalHtml = null;
            let historicalViewerConfig = null;
            const shaParam = req.query.sha;
            if (shaParam && /^[a-f0-9]{7,40}$/.test(shaParam) &&
                typeof storage.getSiteAtVersion === 'function') {
                try {
                    const v = await storage.getSiteAtVersion(siteName, shaParam);
                    historicalHtml = v.html;
                    historicalViewerConfig = (v.config && v.config.viewer) || null;
                } catch { /* sha not found or git unavailable — fall through to current */ }
            }

            // Fetch commit list for prev/next navigation in the preview banner.
            let prevSha = null, nextSha = null, commitLabel = shaParam ? shaParam.slice(0, 7) : '';
            if (historicalHtml && storage.dataDir) {
                try {
                    const {listCommits} = require('./build/git.js');
                    const commits = await listCommits(path.join(storage.dataDir, 'sites', siteName));
                    const idx = commits.findIndex(c =>
                        c.sha === shaParam || c.sha.startsWith(shaParam) || shaParam.startsWith(c.sha.slice(0, 7))
                    );
                    if (idx !== -1) {
                        // commits[0] = newest; older = higher index, newer = lower index
                        if (idx + 1 < commits.length) prevSha = commits[idx + 1].sha;
                        if (idx - 1 >= 0)             nextSha = commits[idx - 1].sha;
                        commitLabel = _fmtCommitLabel(commits[idx].message);
                    }
                } catch { /* non-fatal — prev/next stay null */ }
            }
            // config is stored as {viewer, connection}; feezal-connection expects
            // the inner connection object (with uri, clientId, etc.), not the wrapper.
            const connectionConfig = (config && config.connection) || null;

            // mqtt:// and mqtts:// cannot be opened from the browser directly — the
            // browser's WebSocket API only supports ws:// and wss://.  Route these
            // through the feezal server's Socket.IO bridge instead. N10: the user
            // can also opt ws://-family connections into the bridge ("connect via
            // server") so broker credentials never reach the viewer page.
            const connectionUri = connectionConfig?.uri || '';
            const usesBridge = /^mqtts?:\/\//.test(connectionUri) || connectionConfig?.viaServer === true;
            const backendValue = usesBridge ? 'feezal' : 'mqtt';

            // N10: bridged viewers talk Socket.IO only — the broker config
            // (incl. credentials in the URI) must not be injected into the page.
            const connectionAttr = !usesBridge && connectionConfig && Object.keys(connectionConfig).length
                ? ` config='${JSON.stringify(connectionConfig).replace(/'/g, '&#39;')}'`
                : '';

            // Inject the persisted theme class into the feezal-site root element.
            // For historical previews use the viewer config captured at that commit.
            const viewerConfig = historicalViewerConfig || (config && config.viewer) || null;
            const theme = viewerConfig && viewerConfig.theme;
            // Use the historical version for preview when ?sha= was provided.
            let themedHtml = historicalHtml || siteHtml;
            if (theme && /^feezal-theme-[\w-]+$/.test(theme)) {
                const hasClass = /<feezal-site[^>]*\bclass\s*=/.test(themedHtml);
                if (hasClass) {
                    themedHtml = themedHtml.replace(/(<feezal-site[^>]*\bclass\s*=\s*")/, `$1${theme} `);
                } else {
                    themedHtml = themedHtml.replace(/(<feezal-site\b)/, `$1 class="${theme}"`);
                }
            }

            // Build an inline <style> block for any colour-variable overrides.
            const themeOverrides = viewerConfig && viewerConfig.themeOverrides;
            let overrideStyle = '';
            if (themeOverrides && Object.keys(themeOverrides).length) {
                const props = Object.entries(themeOverrides)
                    .filter(([k]) => /^--[\w-]+$/.test(k))
                    .map(([k, v]) => `${k}:${String(v).replace(/[;"'\\]/g, '')}`)
                    .join(';');
                if (props) overrideStyle = `\n<style>feezal-site{${props}}</style>`;
            }

            // Inject <link> for user-defined themes (CSS files in dataDir/themes/).
            // U51: besides the active site theme, every theme referenced by a
            // per-view `theme` attribute must have its CSS present — bundled
            // themes inject on import, user themes need their link here.
            let userThemeLink = '';
            if (storage.dataDir) {
                const wanted = new Set();
                if (theme) wanted.add(theme);
                for (const m of themedHtml.matchAll(/<feezal-view\b[^>]*\btheme\s*=\s*"([^"]+)"/g)) {
                    const cls = m[1].startsWith('feezal-theme-') ? m[1] : 'feezal-theme-' + m[1];
                    if (/^feezal-theme-[\w-]+$/.test(cls)) wanted.add(cls);
                }
                for (const cls of wanted) {
                    try {
                        await fs.access(path.join(storage.dataDir, 'themes', cls + '.css'));
                        userThemeLink += `\n<link rel="stylesheet" href="/themes/${cls}.css">`;
                    } catch { /* not a user theme */ }
                }
            }

            // Build CSS for defined classes.
            const classes = viewerConfig && viewerConfig.classes;
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

            // N23: per-site icon tree-shaking. Bundled icon sets are NOT in
            // viewer-bundle.js — inline a mini-registration with only the
            // icons this site references; user-installed sets load their full
            // module (per-icon data is not separable from an install bundle).
            let iconScripts = '';
            try {
                const {inlineJs, userModuleUrls} = siteIconArtifacts({
                    wwwDir, userElementsDir, siteHtml: themedHtml, logger
                });
                if (inlineJs) iconScripts += `\n<script type="module">${inlineJs}<\/script>`;
                for (const url of userModuleUrls) {
                    iconScripts += `\n<script type="module" src="${url}"><\/script>`;
                }
            } catch (err) {
                logger.warn('viewer icons: ' + err.message);
            }

            // N27: user-installed element/theme packages. Install bundles are
            // self-contained ESM served from /user-elements/ — inject a module
            // script per package this site actually uses (used tags + the
            // active theme), so installed packages work in the live viewer,
            // not only on the editor canvas.
            let userPkgScripts = '';
            try {
                for (const el of usedUserPackages({wwwDir, userElementsDir, siteHtml: themedHtml, theme})) {
                    userPkgScripts += `\n<script type="module" src="/user-elements/${el.bare}/${el.main}"><\/script>`;
                    logger.debug(`viewer: injecting installed package ${el.bare}`);
                }
            } catch (err) {
                logger.warn('viewer user packages: ' + err.message);
            }

            let page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Feezal – ${siteName}</title>
<style>
html, body { width: 100%; height: 100%; padding: 0; margin: 0; font-family: 'Roboto', sans-serif; font-size: 14px; }
.feezal-view { margin: auto !important; }
</style>
<link href="/fonts/fonts.css" rel="stylesheet">
<script>
window.feezal = {
    elements: new Set(),
    // Subscriptions queued before feezal-connection is upgraded.
    // Flushed by feezal-connection.connectedCallback.
    _subQueue: [],
    define: (tag, elem) => { window.customElements.define(tag, elem); window.feezal.elements.add(tag); },
    get app() { return document.querySelector('feezal-app-viewer'); },
    get connection() {
        const el = document.querySelector('feezal-connection');
        if (!el) return null;
        // If not yet upgraded, return a stub so sub() calls don't throw.
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
    resolveAsset(p) {
        if (!p) return '';
        if (p.startsWith('global/')) return '/assets/global/' + p.slice(7);
        if (p.startsWith('assets/')) return '/assets/${siteName}/' + p.slice(7);
        return p;
    }
};
<\/script>${userThemeLink}${overrideStyle}${classesStyle}
</head>
<body>
${historicalHtml ? `<script>window.feezal.historyBanner = ${JSON.stringify({
    sha:      shaParam,
    prevSha:  prevSha  || null,
    nextSha:  nextSha  || null,
    label:    commitLabel,
    siteName
})};<\/script>
<feezal-history-bar></feezal-history-bar>
<div style="margin-top:38px;height:calc(100% - 38px)">` : ''}
<feezal-connection backend="${backendValue}"${connectionAttr}></feezal-connection>
<feezal-app-viewer>${themedHtml}</feezal-app-viewer>
${historicalHtml ? '</div>' : ''}
<script type="module" src="/viewer-bundle.js"><\/script>
${iconScripts}${userPkgScripts}
</body>
</html>`;
            // A9: make the served viewer installable when the site opts in.
            if (pwa.pwaEnabled(config)) {
                const base = `/viewer/${encodeURIComponent(siteName)}`;
                const meta = storage.dataDir ? pwa.readPwaMeta(storage.dataDir, siteName) : null;
                page = pwa.injectPwaTags(page, {
                    manifestUrl: `${base}/manifest.webmanifest`,
                    appleTouchIconUrl: `${base}/icons/apple-touch-icon.png`,
                    themeColor: (meta && meta.backgroundColor) || undefined,
                    swUrl: `${base}/sw.js`,
                    swScope: base,
                });
            }

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');   // B52: generated HTML revalidates
            // A28: per-site CSP for the viewer DOCUMENT (assets keep the
            // global baseline header). The builder enforces the invariants
            // ('unsafe-inline'/eval retention, data:, broker auto-include)
            // and appends the same-origin report-uri; absent config → the
            // A25 baseline, fully backwards compatible.
            res.setHeader('Content-Security-Policy', csp.buildCsp(
                config?.viewer?.security?.csp,
                {siteName, brokerOrigin: csp.brokerOriginFromUri(connectionUri)}
            ));
            res.send(page);
        } catch (err) {
            next(err);
        }
    };

    // A9: per-site manifest / service worker / icons (404 unless viewer.pwa).
    pwa.registerPwaRoutes(app, {storage, wwwDir});

    if (publicViewer) {
        app.get('/viewer/', viewerHandler);
        app.get('/viewer/:site', viewerHandler);
    } else {
        app.get('/viewer/', editorAuth, viewerHandler);
        app.get('/viewer/:site', editorAuth, viewerHandler);
    }

    // --- Element discovery & dynamic element module ---
    // Scan bundled packages (packages/ or node_modules/) and user elements (<dataDir>/elements/).
    // The generated module is served at /editor/feezal-elements.js so the editor can load
    // element definitions at runtime without writing to the (potentially read-only) wwwDir.
    const userElementsDir = storage.dataDir ? path.join(storage.dataDir, 'elements') : null;
    discoverElements(wwwDir, userElementsDir, logger);   // startup log of what's available

    // Re-discover per request — packages installed (or manually dropped) into
    // <dataDir>/elements/ at runtime must appear after an editor reload, not
    // only after a server restart. The scan is a handful of readdirs; the
    // route is fetched once per editor load. Quiet logger: the startup scan
    // above already logged the inventory.
    const quietLogger = {info() {}, debug() {}};
    app.get('/editor/feezal-elements.js', (_req, res) => {
        const discovered = discoverElements(wwwDir, userElementsDir, quietLogger);
        res.setHeader('Cache-Control', 'no-cache');   // B52: stable name, generated content
        res.type('text/javascript').send(generateElementsModule(discovered));
    });

    return {app, server, io};
}

module.exports = createApp;

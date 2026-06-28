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
const {discoverElements, generateElementsModule} = require('./build/elements.js');

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
    app.use(express.json());
    app.use(express.urlencoded({extended: false}));

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
    app.use('/', express.static(distDir));

    // Element packages: in production they live in packages/ (renamed from node_modules/
    // so npm publish doesn't strip them). In dev (monorepo) fall back to node_modules/.
    const elementPackagesDir = require('fs').existsSync(path.join(wwwDir, 'packages'))
        ? path.join(wwwDir, 'packages')
        : path.join(wwwDir, 'node_modules');
    app.use('/node_modules', express.static(elementPackagesDir));

    // --- Asset static files ---
    // Global assets: /assets/global/<path>  →  <dataDir>/_global/assets/<path>
    // Site assets:   /assets/<site>/<path>  →  <dataDir>/<site>/assets/<path>
    // User themes:   /themes/<slug>.css     →  <dataDir>/themes/<slug>.css
    if (storage.dataDir) {
        app.use('/assets/global', express.static(path.join(storage.dataDir, '_global', 'assets')));
        app.get('/assets/:site/*', (req, res, next) => {
            const file = path.join(storage.dataDir, req.params.site, 'assets', req.params[0]);
            res.sendFile(file, err => { if (err) next(); });
        });
        app.use('/themes', express.static(path.join(storage.dataDir, 'themes')));

        // User-installed element packages (drop-in; no rebuild required)
        app.use('/user-elements', express.static(path.join(storage.dataDir, 'elements')));
    }

    // --- Socket.IO hub ---
    // Must be created before the API router so getTopicCompletions is available.
    const {getTopicCompletions} = createHub(io, {storage, logger});

    // --- Protected API routes ---
    app.use('/api', editorAuth, createApiRouter(storage, wwwDir, logger, {
        getTopicCompletions,
        getDiscoveredEntities: mqttBridge.getDiscoveredEntities,
        getDiscoveredEntity:   mqttBridge.getDiscoveredEntity,
    }));

    // --- Editor route (protected) ---
    // The editor SPA is served from dist/editor/index.html.
    // The site name is passed as the URL query: /editor/?/<siteName>/
    app.get('/editor/', editorAuth, (_req, res) => {
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
                    const commits = await listCommits(path.join(storage.dataDir, siteName));
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
            const connectionAttr = connectionConfig && Object.keys(connectionConfig).length
                ? ` config='${JSON.stringify(connectionConfig).replace(/'/g, '&#39;')}'`
                : '';

            // mqtt:// and mqtts:// cannot be opened from the browser directly — the
            // browser's WebSocket API only supports ws:// and wss://.  Route these
            // through the feezal server's Socket.IO bridge instead.
            const connectionUri = connectionConfig?.uri || '';
            const usesBridge = /^mqtts?:\/\//.test(connectionUri);
            const backendValue = usesBridge ? 'feezal' : 'mqtt';

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
            let userThemeLink = '';
            if (theme && storage.dataDir) {
                try {
                    await fs.access(path.join(storage.dataDir, 'themes', theme + '.css'));
                    userThemeLink = `\n<link rel="stylesheet" href="/themes/${theme}.css">`;
                } catch { /* not a user theme */ }
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

            const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Feezal – ${siteName}</title>
<style>
html, body { width: 100%; height: 100%; padding: 0; margin: 0; font-family: 'Roboto', sans-serif; font-size: 14px; }
.feezal-view { margin: auto !important; }
</style>
<link href="https://fonts.googleapis.com/css?family=Roboto|Material+Icons&display=block" rel="stylesheet">
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
${historicalHtml ? `<div style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#1565c0;color:#fff;padding:6px 14px;display:flex;align-items:center;gap:10px;font-family:sans-serif;font-size:13px;box-sizing:border-box">
  ${prevSha
      ? `<a href="/viewer/${siteName}?sha=${prevSha}" style="color:#fff;padding:3px 10px;border:1px solid rgba(255,255,255,0.5);border-radius:4px;text-decoration:none;font-size:12px;white-space:nowrap">&#8592; Older</a>`
      : `<span style="padding:3px 10px;border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:rgba(255,255,255,0.35);font-size:12px;cursor:default;white-space:nowrap">&#8592; Older</span>`}
  ${nextSha
      ? `<a href="/viewer/${siteName}?sha=${nextSha}" style="color:#fff;padding:3px 10px;border:1px solid rgba(255,255,255,0.5);border-radius:4px;text-decoration:none;font-size:12px;white-space:nowrap">Newer &#8594;</a>`
      : `<span style="padding:3px 10px;border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:rgba(255,255,255,0.35);font-size:12px;cursor:default;white-space:nowrap">Newer &#8594;</span>`}
  <span style="flex:1;text-align:center;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0.95">${commitLabel}</span>
  <a href="/viewer/${siteName}" style="color:#fff;padding:3px 10px;border:1px solid rgba(255,255,255,0.5);border-radius:4px;text-decoration:none;font-size:12px;white-space:nowrap">&#10005; Close</a>
</div><div style="margin-top:43px;height:calc(100% - 43px)">` : ''}
<feezal-connection backend="${backendValue}"${connectionAttr}></feezal-connection>
<feezal-app-viewer>${themedHtml}</feezal-app-viewer>
${historicalHtml ? '</div>' : ''}
<script type="module" src="/viewer-bundle.js"><\/script>
</body>
</html>`;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(page);
        } catch (err) {
            next(err);
        }
    };

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
    const discoveredElements = discoverElements(wwwDir, userElementsDir, logger);

    app.get('/editor/feezal-elements.js', (_req, res) => {
        res.type('text/javascript').send(generateElementsModule(discoveredElements));
    });

    return {app, server, io};
}

module.exports = createApp;

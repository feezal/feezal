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
            const theme = config && config.viewer && config.viewer.theme;
            let themedHtml = siteHtml;
            if (theme && /^feezal-theme-[\w-]+$/.test(theme)) {
                const hasClass = /<feezal-site[^>]*\bclass\s*=/.test(themedHtml);
                if (hasClass) {
                    themedHtml = themedHtml.replace(/(<feezal-site[^>]*\bclass\s*=\s*")/, `$1${theme} `);
                } else {
                    themedHtml = themedHtml.replace(/(<feezal-site\b)/, `$1 class="${theme}"`);
                }
            }

            // Build an inline <style> block for any colour-variable overrides.
            const themeOverrides = config && config.viewer && config.viewer.themeOverrides;
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
            const classes = config && config.viewer && config.viewer.classes;
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
<feezal-connection backend="${backendValue}"${connectionAttr}></feezal-connection>
<feezal-app-viewer>${themedHtml}</feezal-app-viewer>
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
        app.get('/view/', viewerHandler);
        app.get('/view/:site', viewerHandler);
    } else {
        app.get('/view/', editorAuth, viewerHandler);
        app.get('/view/:site', editorAuth, viewerHandler);
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

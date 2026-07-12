'use strict';

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const {execFile} = require('child_process');
const {promisify} = require('util');
const execFileAsync = promisify(execFile);
const prettyHtml = require('@starptech/prettyhtml');
const createExport = require('../build/export.js');
const bridge = require('../mqtt/bridge.js');
const pkgManager = require('../build/install.js');
const pwa = require('../build/pwa.js');
const capacitor = require('../build/capacitor.js');
const docker = require('../docker.js');
const apkBuild = require('../build/apk.js');
const aiConfig = require('../ai/config.js');
const aiProviders = require('../ai/providers.js');
const aiConversations = require('../ai/conversations.js');
const {buildSystemPrompt} = require('../ai/prompt.js');

/**
 * Extract the CN (Common Name) from a PEM certificate file using openssl.
 * Returns null if openssl is unavailable or the cert has no CN.
 * @param {string} certPath
 * @returns {Promise<string|null>}
 */
async function _extractCertCn(certPath) {
    try {
        const {stdout} = await execFileAsync(
            'openssl', ['x509', '-noout', '-subject', '-in', certPath],
            {timeout: 5000}
        );
        // stdout: "subject=C = US, O = Org, CN = My CA\n"
        const m = stdout.match(/CN\s*=\s*([^,\n\/]+)/);
        return m ? m[1].trim() : null;
    } catch {
        return null;
    }
}

// A14: sites live under <dataDir>/sites/, so they no longer collide with system
// dirs — a site name only has to be a safe single path segment.
const isValidSiteName = name =>
    typeof name === 'string' &&
    name.length > 0 && name.length <= 128 &&
    !/[\\/]/.test(name) &&
    !name.startsWith('.');

// Read current version from package.json once at module load time.
const { version: currentVersion } = require(path.join(__dirname, '../../package.json'));

/**
 * REST API router for site management.
 * All routes are mounted under /api and are protected by editorAuth
 * before this router is reached.
 *
 * @param {import('../storage/adapter')} storage
 * @param {string} wwwDir  Absolute path to the www/ directory (needed for export).
 * @param {object} logger
 * @returns {express.Router}
 */
function createApiRouter(storage, wwwDir, logger, {getTopicCompletions = null, getDiscoveredEntities = null, getDiscoveredEntity = null, getDeviceGroups = null, emitElementsChanged = null} = {}) {
    const router = express.Router();

    // Version info
    router.get('/version', (_req, res) => {
        res.json({version: currentVersion});
    });

    // Bridge (server ↔ broker) connection status for the editor's indicator
    // in the Connection settings tab. Credentials embedded in the URI are
    // redacted before it leaves the server.
    router.get('/bridge/status', (_req, res) => {
        const {connected, uri, lastError} = bridge.getStatus();
        res.json({
            connected,
            uri: uri ? uri.replace(/\/\/[^@/]+@/, '//') : null,
            lastError,
        });
    });

    // Format an HTML fragment with the same prettyhtml settings used on deploy,
    // so the editor source view matches the saved views.html style exactly.
    router.post('/format', (req, res) => {
        const html = req.body && req.body.html;
        if (typeof html !== 'string') {
            return res.status(400).json({error: 'html is required'});
        }
        try {
            const formatted = prettyHtml(html, {
                tabWidth: 4,
                prettier: {jsxBracketSameLine: true}
            }).toString();
            res.json({html: formatted});
        } catch (err) {
            res.status(400).json({error: err.message});
        }
    });

    // List all sites
    router.get('/sites', async (_req, res) => {
        try {
            const sites = await storage.listSites();
            res.json({sites});
        } catch (err) {
            res.status(500).json({error: err.message});
        }
    });

    // Create a new site
    router.post('/sites', async (req, res) => {
        const {name} = req.body;
        if (!name) {
            return res.status(400).json({error: 'name is required'});
        }
        if (!isValidSiteName(name)) {
            return res.status(400).json({error: `"${name}" is not a valid site name.`});
        }

        try {
            await storage.saveSite(name, {html: '', config: {}});
            res.status(201).json({name});
        } catch (err) {
            res.status(500).json({error: err.message});
        }
    });

    // Clone a site
    router.post('/sites/:name/clone', async (req, res) => {
        const {newName} = req.body;
        if (!newName) {
            return res.status(400).json({error: 'newName is required'});
        }
        if (!isValidSiteName(newName)) {
            return res.status(400).json({error: `"${newName}" is not a valid site name.`});
        }

        try {
            await storage.cloneSite(req.params.name, newName);
            res.json({name: newName});
        } catch (err) {
            res.status(500).json({error: err.message});
        }
    });

    // Rename a site
    router.patch('/sites/:name', async (req, res) => {
        const {newName} = req.body;
        if (!newName) {
            return res.status(400).json({error: 'newName is required'});
        }
        if (!isValidSiteName(newName)) {
            return res.status(400).json({error: `"${newName}" is not a valid site name.`});
        }

        try {
            await storage.renameSite(req.params.name, newName);
            res.json({name: newName});
        } catch (err) {
            res.status(500).json({error: err.message});
        }
    });

    // Delete a site
    router.delete('/sites/:name', async (req, res) => {
        try {
            await storage.deleteSite(req.params.name);
            res.status(204).send();
        } catch (err) {
            res.status(500).json({error: err.message});
        }
    });

    // ── Assets ─────────────────────────────────────────────────────────────

    // List assets (global + site)
    router.get('/assets/:site', async (req, res) => {
        try {
            const assets = await storage.listAssets(req.params.site);
            res.json(assets);
        } catch (err) {
            res.status(500).json({error: err.message});
        }
    });

    // Upload an asset (raw binary body; filename via ?path=, category via ?category=)
    router.post('/assets/:site',
        express.raw({type: '*/*', limit: '50mb'}),
        async (req, res) => {
            const category = req.query.category === 'global' ? 'global' : 'site';
            const filePath = req.query.path;
            if (!filePath) return res.status(400).json({error: 'path query param required'});
            try {
                await storage.saveAsset(category, req.params.site, filePath, req.body);
                res.status(201).json({path: filePath, category});
            } catch (err) {
                res.status(400).json({error: err.message});
            }
        }
    );

    // Delete an asset   ?category=global|site &path=<file>
    router.delete('/assets/:site', async (req, res) => {
        const category = req.query.category === 'global' ? 'global' : 'site';
        const filePath = req.query.path;
        if (!filePath) return res.status(400).json({error: 'path query param required'});
        try {
            await storage.deleteAsset(category, req.params.site, filePath);
            res.status(204).send();
        } catch (err) {
            res.status(500).json({error: err.message});
        }
    });

    // Rename / move an asset   body: {category, oldPath, newPath}
    router.patch('/assets/:site', async (req, res) => {
        const {category = 'site', oldPath, newPath} = req.body;
        if (!oldPath || !newPath) return res.status(400).json({error: 'oldPath and newPath required'});
        try {
            await storage.renameAsset(category, req.params.site, oldPath, newPath);
            res.json({path: newPath});
        } catch (err) {
            res.status(400).json({error: err.message});
        }
    });

    // Create a folder   body: {category, path}
    router.post('/assets/:site/mkdir', async (req, res) => {
        const {category = 'site', path: dirPath} = req.body;
        if (!dirPath) return res.status(400).json({error: 'path required'});
        try {
            await storage.createAssetDir(category, req.params.site, dirPath);
            res.status(201).json({path: dirPath});
        } catch (err) {
            res.status(400).json({error: err.message});
        }
    });

    // Transfer asset (move or copy) between categories
    // body: {srcCategory, srcPath, destCategory, destPath, copy}
    router.post('/assets/:site/transfer', express.json(), async (req, res) => {
        const {srcCategory, srcPath, destCategory, destPath, copy = false, unique = false} = req.body || {};
        const site = req.params.site;
        if (!srcCategory || !srcPath || !destCategory || !destPath) {
            return res.status(400).json({error: 'srcCategory, srcPath, destCategory, and destPath are required'});
        }
        if (!['global', 'site'].includes(srcCategory) || !['global', 'site'].includes(destCategory)) {
            return res.status(400).json({error: 'category must be "global" or "site"'});
        }
        try {
            if (copy) {
                // unique:true (copy-on-use of a global asset) never overwrites an
                // existing destination — it returns the suffixed path actually used.
                if (unique) {
                    const finalPath = await storage.copyAssetUnique(srcCategory, site, srcPath, destCategory, destPath);
                    return res.json({path: finalPath, category: destCategory});
                }
                await storage.copyAsset(srcCategory, site, srcPath, destCategory, destPath);
            } else {
                await storage.moveAsset(srcCategory, site, srcPath, destCategory, destPath);
                // Build the old and new asset URLs and update all references in views.html / viewer.json.
                const oldUrl = srcCategory === 'global'
                    ? `/assets/global/${srcPath}`
                    : `/assets/${site}/${srcPath}`;
                const newUrl = destCategory === 'global'
                    ? `/assets/global/${destPath}`
                    : `/assets/${site}/${destPath}`;
                await storage.updateAssetRefs(site, oldUrl, newUrl);
            }
            res.json({path: destPath, category: destCategory});
        } catch (err) {
            res.status(400).json({error: err.message});
        }
    });

    // ── MQTT topic completions ──────────────────────────────────────────────
    // Returns the next-level topic completions for a given prefix.
    // The topic trie is populated from live MQTT traffic seen by the hub.
    router.get('/topics/completions', (req, res) => {
        const prefix = typeof req.query.prefix === 'string' ? req.query.prefix : '';
        const completions = getTopicCompletions ? getTopicCompletions(prefix) : [];
        res.json({completions});
    });

    // ── AI assistant (U9) ───────────────────────────────────────────────────

    // Browser-safe config (never returns the API key).
    router.get('/ai/config', async (_req, res) => {
        try {
            const cfg = await aiConfig.loadAiConfig(storage);
            res.json(aiConfig.publicAiConfig(cfg));
        } catch (err) {
            res.status(500).json({error: err.message});
        }
    });

    // Save config. Body: {provider, apiKey?, model?, endpoint?}.
    // Omitting apiKey keeps the stored one; passing "" clears it.
    router.put('/ai/config', async (req, res) => {
        const {provider, apiKey, model, endpoint} = req.body || {};
        const valid = ['openai-compatible', 'anthropic', 'ollama'];
        if (!valid.includes(provider)) {
            return res.status(400).json({error: 'provider must be one of: ' + valid.join(', ')});
        }
        try {
            const existing = await aiConfig.loadAiConfig(storage);
            const next = {
                provider,
                model:    model || '',
                endpoint: endpoint || '',
                apiKey:   apiKey === undefined ? (existing.apiKey || '') : apiKey,
            };
            // Optional agent tool-round cap (U26). Absent → keep existing;
            // ''/null → clear (use the built-in default); number → clamp 1..100.
            const raw = req.body.maxToolRounds;
            if (raw === undefined) {
                if (Number.isInteger(existing.maxToolRounds)) next.maxToolRounds = existing.maxToolRounds;
            } else if (raw !== '' && raw !== null) {
                const n = parseInt(raw, 10);
                if (Number.isFinite(n)) next.maxToolRounds = Math.max(1, Math.min(100, n));
            }
            // Ollama context window (num_ctx). Absent → keep; ''/null → clear; else clamp.
            const rawCtx = req.body.numCtx;
            if (rawCtx === undefined) {
                if (Number.isInteger(existing.numCtx)) next.numCtx = existing.numCtx;
            } else if (rawCtx !== '' && rawCtx !== null) {
                const n = parseInt(rawCtx, 10);
                if (Number.isFinite(n)) next.numCtx = Math.max(512, Math.min(1048576, n));
            }
            await aiConfig.saveAiConfig(storage, next);
            res.json(aiConfig.publicAiConfig(next));
        } catch (err) {
            res.status(500).json({error: err.message});
        }
    });

    // List models for the configured provider (also doubles as a connection test).
    router.get('/ai/models', async (_req, res) => {
        try {
            const cfg = await aiConfig.loadAiConfig(storage);
            if (!cfg.provider) return res.status(400).json({error: 'AI not configured'});
            const models = await aiProviders.listModels(cfg);
            res.json({models});
        } catch (err) {
            res.status(502).json({error: err.message});
        }
    });

    // Streaming chat. Body: {messages:[{role,content}], context?, model?}.
    // Responds as SSE: `event: token|done|error` with JSON data.
    router.post('/ai/chat', async (req, res) => {
        const {messages, context, model, agent} = req.body || {};
        if (!Array.isArray(messages)) {
            return res.status(400).json({error: 'messages[] required'});
        }
        let cfg;
        try {
            cfg = await aiConfig.loadAiConfig(storage);
        } catch (err) {
            return res.status(500).json({error: err.message});
        }
        if (!cfg.provider) return res.status(400).json({error: 'AI not configured'});
        const useModel = model || cfg.model;
        if (!useModel) return res.status(400).json({error: 'no model selected'});

        const agentMode = agent === true;
        const fullMessages = [
            {role: 'system', content: buildSystemPrompt({...(context || {}), agent: agentMode})},
            ...messages.filter(m => m && m.role !== 'system'),
        ];

        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        if (typeof res.flushHeaders === 'function') res.flushHeaders();

        const controller = new AbortController();
        req.on('close', () => controller.abort());

        const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

        try {
            if (agentMode) {
                // U26: run the tool-calling loop, emit tool activity, then deliver
                // the final answer as a single token event.
                const aiTools = require('../ai/tools.js');
                const toolCtx = {elements: (context && context.elements) || []};
                let sentAny = false;
                const finalText = await aiProviders.chatWithTools(
                    cfg, fullMessages, useModel, aiTools.TOOL_SPECS,
                    (name, args) => aiTools.executeTool(name, args, toolCtx),
                    ev => {
                        if (ev.type === 'tool') send('tool', {name: ev.name, args: ev.args});
                        else if (ev.type === 'text' && ev.text && ev.text.trim()) {
                            send('token', {token: ev.text + '\n\n'});   // stream findings narration
                            sentAny = true;
                        }
                    },
                    controller.signal);
                if (finalText && finalText.trim()) { send('token', {token: finalText}); sentAny = true; }
                // Nothing at all → surface an error rather than a phantom bubble.
                if (!sentAny) {
                    throw new Error('The assistant finished without producing an answer. Try again, or turn agent mode off.');
                }
            } else {
                await aiProviders.streamChat(cfg, fullMessages, useModel,
                    token => send('token', {token}),
                    controller.signal);
            }
            send('done', {});
        } catch (err) {
            if (!controller.signal.aborted) send('error', {error: err.message});
        } finally {
            res.end();
        }
    });

    // Conversations (server-side history).
    router.get('/ai/conversations', async (_req, res) => {
        try {
            res.json({conversations: await aiConversations.listConversations(storage)});
        } catch (err) {
            res.status(500).json({error: err.message});
        }
    });

    router.get('/ai/conversations/:id', async (req, res) => {
        const c = await aiConversations.getConversation(storage, req.params.id);
        if (!c) return res.status(404).json({error: 'not found'});
        res.json(c);
    });

    router.put('/ai/conversations/:id', async (req, res) => {
        const {title, messages} = req.body || {};
        try {
            const conv = await aiConversations.saveConversation(storage,
                {id: req.params.id, title, messages});
            res.json(conv);
        } catch (err) {
            res.status(400).json({error: err.message});
        }
    });

    router.delete('/ai/conversations/:id', async (req, res) => {
        try {
            await aiConversations.deleteConversation(storage, req.params.id);
            res.status(204).send();
        } catch (err) {
            res.status(500).json({error: err.message});
        }
    });

    // ── Auto-discovery (N12) ───────────────────────────────────────────────
    // Returns the flat list of all discovered MQTT entities.
    router.get('/discovery/devices', (_req, res) => {
        const devices = getDiscoveredEntities ? getDiscoveredEntities() : [];
        res.json({devices});
    });

    // Returns entities grouped by physical device (device.identifiers[0]).
    // Each group includes an elementHint field (e.g. "plant") when applicable.
    router.get('/discovery/device-groups', (_req, res) => {
        const groups = getDeviceGroups ? getDeviceGroups() : [];
        res.json({groups});
    });

    // Returns a single discovered entity by discovery_id.
    // The ID contains slashes (e.g. "light/0x00158d/lamp"), so use a wildcard param.
    router.get('/discovery/devices/*', (req, res) => {
        const id = req.params[0];
        const device = getDiscoveredEntity ? getDiscoveredEntity(id) : null;
        if (!device) return res.status(404).json({error: 'not found'});
        res.json(device);
    });

    // ── User themes ────────────────────────────────────────────────────────

    // List user themes
    router.get('/themes', async (_req, res) => {
        if (!storage.dataDir) return res.json({themes: []});
        const dir = path.join(storage.dataDir, 'themes');
        try {
            await fs.mkdir(dir, {recursive: true});
            const files = await fs.readdir(dir);
            const themes = files
                .filter(f => f.endsWith('.css') && /^feezal-theme-[\w-]+\.css$/.test(f))
                .map(f => {
                    const slug  = f.slice(0, -4);
                    const label = slug.replace(/^feezal-theme-/, '').replace(/-/g, ' ');
                    return {slug, label};
                });
            res.json({themes});
        } catch (err) {
            res.status(500).json({error: err.message});
        }
    });

    // Create a user theme from a name + overrides object
    router.post('/themes', async (req, res) => {
        if (!storage.dataDir) return res.status(503).json({error: 'No dataDir configured'});
        const {name, overrides} = req.body;
        if (!name || typeof name !== 'string') return res.status(400).json({error: 'name required'});
        if (!overrides || typeof overrides !== 'object') return res.status(400).json({error: 'overrides required'});

        // Derive a safe CSS-class slug from the user-supplied name.
        const slug = 'feezal-theme-' + name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        if (slug === 'feezal-theme-') return res.status(400).json({error: 'invalid name'});

        const dir = path.join(storage.dataDir, 'themes');
        await fs.mkdir(dir, {recursive: true});

        // Sanitise prop names and values to prevent CSS injection.
        const props = Object.entries(overrides)
            .filter(([k]) => /^--[\w-]+$/.test(k))
            .map(([k, v]) => `    ${k}: ${String(v).replace(/[;"'\\]/g, '')};`)
            .join('\n');
        const css = `feezal-site.${slug} {\n${props}\n}\n`;

        await fs.writeFile(path.join(dir, slug + '.css'), css, 'utf8');
        res.status(201).json({slug, label: name});
    });

    // Delete a user theme
    router.delete('/themes/:slug', async (req, res) => {
        if (!storage.dataDir) return res.status(503).json({error: 'No dataDir configured'});
        const {slug} = req.params;
        if (!/^feezal-theme-[\w-]+$/.test(slug)) return res.status(400).json({error: 'invalid slug'});

        const file = path.join(storage.dataDir, 'themes', slug + '.css');
        try {
            await fs.unlink(file);
            res.status(204).send();
        } catch (err) {
            if (err.code === 'ENOENT') return res.status(404).json({error: 'not found'});
            res.status(500).json({error: err.message});
        }
    });

    // ── Package Manager (N4) — install/list/remove element & theme packages ────
    // (Scoped names contain '/', so remove/update take the name in the body
    //  rather than a path param.)

    // List installed add-on packages (all types), best-effort "latest" per pkg.
    router.get('/elements', async (_req, res) => {
        if (!storage.dataDir) return res.json({packages: []});
        try {
            const installed = await pkgManager.listInstalled(storage.dataDir);
            // Best-effort latest-version lookup (never fail the list on a registry hiccup).
            await Promise.all(installed.map(async p => {
                try {
                    const r = await fetch(`https://registry.npmjs.org/${p.name.replace('/', '%2f')}/latest`);
                    if (r.ok) { const j = await r.json(); if (j.version) p.latest = j.version; }
                } catch { /* offline — no update badge */ }
            }));
            res.json({packages: installed});
        } catch (err) {
            res.status(500).json({error: err.message});
        }
    });

    // Registry search, scoped to a type keyword. GET /api/elements/search?text=&type=element|theme|icons|bundle
    router.get('/elements/search', async (req, res) => {
        const text = String(req.query.text || '').trim();
        const type = ['theme', 'element', 'icons', 'bundle'].includes(req.query.type) ? req.query.type : null;
        const kws  = type ? [pkgManager.typeKeyword(type)] : ['feezal-element', 'feezal-theme', 'feezal-icons', 'feezal-elements'];
        try {
            const merged = [];
            await Promise.all(kws.map(async kw => {
                const q = encodeURIComponent(`keywords:${kw} ${text}`.trim());
                const r = await fetch(`https://registry.npmjs.org/-/v1/search?text=${q}&size=20`);
                if (!r.ok) return;
                const j = await r.json();
                for (const o of (j.objects || [])) {
                    const pk = o.package || {};
                    if (!pkgManager.isAllowedPackage(pk.name)) continue;
                    merged.push({
                        name: pk.name, version: pk.version, description: pk.description || '',
                        author: (pk.author && pk.author.name) || (pk.publisher && pk.publisher.username) || '',
                        type: pkgManager.derivePkgType(pk.name), links: pk.links,
                    });
                }
            }));
            // de-dup by name
            const seen = new Set();
            res.json({results: merged.filter(m => (seen.has(m.name) ? false : seen.add(m.name)))});
        } catch (err) {
            res.status(502).json({error: 'registry search failed: ' + err.message});
        }
    });

    // Install a package. Body: { package, version? }
    router.post('/elements', async (req, res) => {
        if (!storage.dataDir) return res.status(503).json({error: 'No dataDir configured'});
        const {package: pkg, version} = req.body || {};
        if (!pkgManager.isAllowedPackage(pkg)) {
            return res.status(400).json({error: 'package must be a feezal-element-*, feezal-elements-* (set), feezal-theme-* or feezal-icons-* name'});
        }
        try {
            const result = await pkgManager.installPackage({wwwDir, dataDir: storage.dataDir, pkg, version, logger});
            if (emitElementsChanged) emitElementsChanged();
            res.json(result);
        } catch (err) {
            res.status(500).json({ok: false, error: err.message, stdout: err.stdout || '', stderr: err.stderr || ''});
        }
    });

    // Update (reinstall at latest). Body: { package }
    router.post('/elements/update', async (req, res) => {
        if (!storage.dataDir) return res.status(503).json({error: 'No dataDir configured'});
        const {package: pkg} = req.body || {};
        if (!pkgManager.isAllowedPackage(pkg)) return res.status(400).json({error: 'invalid package'});
        try {
            const result = await pkgManager.installPackage({wwwDir, dataDir: storage.dataDir, pkg, logger});
            if (emitElementsChanged) emitElementsChanged();
            res.json(result);
        } catch (err) {
            res.status(500).json({ok: false, error: err.message, stdout: err.stdout || '', stderr: err.stderr || ''});
        }
    });

    // Remove a package. Body: { package }
    router.post('/elements/remove', async (req, res) => {
        if (!storage.dataDir) return res.status(503).json({error: 'No dataDir configured'});
        const {package: pkg} = req.body || {};
        if (!pkgManager.isAllowedPackage(pkg)) return res.status(400).json({error: 'invalid package'});
        try {
            await pkgManager.removePackage(storage.dataDir, pkg);
            if (emitElementsChanged) emitElementsChanged();
            res.json({ok: true});
        } catch (err) {
            res.status(500).json({error: err.message});
        }
    });

    // ── Version history (git) ──────────────────────────────────────────────

    // Shared helper: resolve the site's git repo dir (A14 — under sites/).
    const siteRepoDir = name => storage.dataDir ? path.join(storage.dataDir, 'sites', name) : null;

    // List commits (most recent first)
    router.get('/sites/:name/history', async (req, res) => {
        const {listCommits} = require('../build/git.js');
        const dir = siteRepoDir(req.params.name);
        if (!dir) return res.json({history: [], supported: false});
        try {
            const history = await listCommits(dir);
            res.json({history, supported: true});
        } catch (err) {
            res.status(500).json({error: err.message});
        }
    });

    // Restore a version (non-destructive: creates a new commit at HEAD)
    router.post('/sites/:name/history/:sha/restore', async (req, res) => {
        const {sha, name} = req.params;
        if (!/^[a-f0-9]{7,40}$/.test(sha)) return res.status(400).json({error: 'invalid sha'});
        const {restoreVersion} = require('../build/git.js');
        const dir = siteRepoDir(name);
        if (!dir) return res.status(503).json({error: 'no dataDir'});
        const {label} = req.body || {};
        try {
            await restoreVersion(dir, name, sha, label || sha.slice(0, 7));
            res.json({ok: true});
        } catch (err) {
            res.status(500).json({error: err.message});
        }
    });

    // Fetch a file's content at a specific commit — used by the history diff overlay (N16).
    // GET /api/sites/:name/history/:sha/file?path=site.html
    // A14: commits made before the rename carry the old filenames — fall back to them.
    const LEGACY_FILE_NAME = {'site.html': 'views.html', 'site.json': 'viewer.json'};
    router.get('/sites/:name/history/:sha/file', async (req, res) => {
        const {sha, name} = req.params;
        if (!/^[a-f0-9]{7,40}$/.test(sha)) return res.status(400).json({error: 'invalid sha'});
        const filepath = req.query.path;
        if (!filepath || !/^[\w.-]+$/.test(filepath)) {
            return res.status(400).json({error: 'invalid path'});
        }
        const {showFile} = require('../build/git.js');
        const dir = siteRepoDir(name);
        if (!dir) return res.status(503).json({error: 'no dataDir'});
        try {
            let content;
            try {
                content = await showFile(dir, sha, filepath);
            } catch (err) {
                const legacy = LEGACY_FILE_NAME[filepath];
                if (!legacy) throw err;
                content = await showFile(dir, sha, legacy);
            }
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.send(content);
        } catch (err) {
            res.status(404).json({error: err.message});
        }
    });

    // Export a site as a self-contained static ZIP
    router.get('/sites/:name/export', async (req, res) => {
        const name = req.params.name;
        logger.info(`export requested for site '${name}'`);
        try {
            const site = await storage.getSite(name);

            // Static exports run entirely in the browser — raw TCP MQTT (mqtt:// / mqtts://)
            // cannot be opened from a browser tab.  Fail early before the expensive Rollup
            // bundle step so the user gets a clear, actionable message.
            const connectionUri = site.config && site.config.connection && site.config.connection.uri;
            if (connectionUri && /^mqtts?:\/\//.test(connectionUri)) {
                return res.status(422).json({
                    error: 'Static export is not supported with mqtt:// or mqtts:// connections. ' +
                        'Exported sites connect directly from the browser and require a ' +
                        'WebSocket-capable MQTT broker. Switch the connection protocol to ' +
                        'ws:// or wss:// before exporting.'
                });
            }

            logger.debug(`export: loaded site '${name}', running Rollup bundle...`);
            const zipBuffer = await createExport(wwwDir, name, site, logger, storage);
            logger.info(`export: done for '${name}', sending ${zipBuffer.length} bytes`);
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${name}.zip"`);
            res.send(zipBuffer);
        } catch (err) {
            logger.error(`export error for '${name}': ${err.message}`);
            logger.error(err.stack);
            res.status(500).json({error: err.message});
        }
    });

    // U34: bundle size breakdown for the static export — per-contributor
    // byte attribution from the same filtered Vite build the export runs
    // (shared in-memory cache, so report ⇄ export don't build twice).
    router.get('/sites/:name/bundle-report', async (req, res) => {
        const name = req.params.name;
        logger.debug(`bundle report requested for site '${name}'`);
        try {
            const site = await storage.getSite(name);
            const report = await createExport.exportBundleReport(wwwDir, name, site, logger, storage);
            res.json(report);
        } catch (err) {
            logger.warn(`bundle report error for '${name}': ${err.message}`);
            res.status(500).json({error: err.message});
        }
    });

    // A9 Tier 2a: export the site as a ready-to-build Capacitor project.
    // ?appName= and ?appId= override (and usually mirror) viewer.app.
    router.get('/sites/:name/export-capacitor', async (req, res) => {
        const name = req.params.name;
        const {appName, appId} = req.query;
        if (appId && !/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(appId)) {
            return res.status(400).json({
                error: 'appId must be reverse-DNS like io.feezal.mysite (letters, digits, underscores; segments start with a letter)'
            });
        }
        logger.info(`capacitor export requested for site '${name}'`);
        try {
            const site = await storage.getSite(name);

            // Same constraint as the static export: the WebView speaks
            // browser WebSocket only.
            const connectionUri = site.config && site.config.connection && site.config.connection.uri;
            if (connectionUri && /^mqtts?:\/\//.test(connectionUri)) {
                return res.status(422).json({
                    error: 'The mobile app connects from a WebView and needs a ws:// or wss:// ' +
                        'broker connection — mqtt:// / mqtts:// cannot be used. Switch the ' +
                        'connection protocol before exporting.'
                });
            }

            const zipBuffer = await capacitor.createCapacitorExport(
                wwwDir, name, site, {appName, appId}, logger, storage);
            const stored = (site.config && site.config.viewer && site.config.viewer.app) || {};
            const fileName = capacitor.projectDirName(appName || stored.name || name);
            logger.info(`capacitor export: done for '${name}', sending ${zipBuffer.length} bytes`);
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}-app.zip"`);
            res.send(zipBuffer);
        } catch (err) {
            logger.error(`capacitor export error for '${name}': ${err.message}`);
            res.status(500).json({error: err.message});
        }
    });

    // ── A9 Tier 2b / A13: Docker-backed server features ────────────────────

    // Capabilities drive the visibility of the build/update UI.
    router.get('/server/capabilities', async (_req, res) => {
        res.json(await docker.capabilities());
    });

    // Start an APK build job.
    router.post('/sites/:name/build-apk', async (req, res) => {
        const caps = await docker.capabilities();
        if (!caps.dockerBuilds) return res.status(403).json({error: 'server-side builds are not enabled'});
        if (apkBuild.isBusy()) return res.status(409).json({error: 'a build is already running'});
        try {
            const site = await storage.getSite(req.params.name);
            const {appName, appId} = req.query;
            const job = await apkBuild.startBuild({
                wwwDir, siteName: req.params.name, site,
                options: {appName, appId}, logger, storage,
            });
            res.status(202).json({jobId: job.id});
        } catch (err) {
            res.status(err.code === 'BUSY' ? 409 : 500).json({error: err.message});
        }
    });

    // Live build log via SSE (replays the backlog, then streams).
    router.get('/build-apk/:jobId/events', (req, res) => {
        const job = apkBuild.getJob(req.params.jobId);
        if (!job) return res.status(404).json({error: 'no such job'});
        res.set({'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive'});
        res.flushHeaders();
        const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        for (const line of job.log) send('log', {line});
        if (job.status !== 'running') {
            send('done', {status: job.status, error: job.error});
            return res.end();
        }
        const onLog = line => send('log', {line});
        const onDone = payload => { send('done', payload); res.end(); };
        job.emitter.on('log', onLog);
        job.emitter.once('done', onDone);
        req.on('close', () => {
            job.emitter.off('log', onLog);
            job.emitter.off('done', onDone);
        });
    });

    // Fetch the built APK.
    router.get('/build-apk/:jobId/result', (req, res) => {
        const job = apkBuild.getJob(req.params.jobId);
        if (!job) return res.status(404).json({error: 'no such job'});
        if (job.status === 'running') return res.status(409).json({error: 'build still running'});
        if (job.status !== 'success' || !job.apk) {
            return res.status(410).json({error: job.error || 'build did not produce an APK'});
        }
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', `attachment; filename="${job.fileName}"`);
        res.send(job.apk);
    });

    // Cancel a running build.
    router.delete('/build-apk/:jobId', async (req, res) => {
        const cancelled = await apkBuild.cancel(req.params.jobId);
        if (!cancelled) return res.status(404).json({error: 'no running job with that id'});
        res.status(202).json({cancelled: true});
    });

    // A13: restart feezal (docker restart of the own container, or a
    // process-manager exit on bare metal).
    router.post('/server/restart', async (_req, res) => {
        const caps = await docker.capabilities();
        if (!caps.restart) return res.status(403).json({error: 'restart is not enabled'});
        res.status(202).json({restarting: true});
        setTimeout(async () => {
            if (caps.selfUpdate) {
                try { await docker.restartSelf(); return; }
                catch (err) { logger.error('self-restart failed: ' + err.message); }
            }
            // bare metal: rely on the process manager's restart policy
            process.exit(0);
        }, 300);
    });

    // A13: update feezal — one-shot watchtower sibling pulls the new image
    // and recreates this container.
    router.post('/server/update', async (_req, res) => {
        const caps = await docker.capabilities();
        if (!caps.selfUpdate) return res.status(403).json({error: 'self-update is not enabled'});
        try {
            const lines = [];
            const name = await docker.updateSelf(line => {
                lines.push(line);
                logger.info('update: ' + line);
            });
            res.status(202).json({updating: name, log: lines});
        } catch (err) {
            logger.error('self-update failed: ' + err.message);
            res.status(500).json({error: err.message});
        }
    });

    // ── TLS certificate management (N8) ───────────────────────────────────

    // Valid cert types and their on-disk filenames.
    const CERT_FILES = {ca: 'ca.pem', cert: 'client.crt', key: 'client.key'};
    // A14: certs live inside the site dir (<dataDir>/sites/<name>/certs) and are
    // kept out of git via the site's .gitignore.
    const certDir = name => storage.dataDir ? path.join(storage.dataDir, 'sites', name, 'certs') : null;

    // A cert change must reach the live bridge: the TLS material is only READ
    // at connect time, and connect() skips when uri/certDir are unchanged —
    // so an uploaded CA never took effect until a server restart. If the
    // bridge is using this site's cert dir, force a reconnect that re-reads
    // the files.
    async function _bridgeCertRefresh(siteName, dir) {
        try {
            if (!dir || bridge.getStatus().certDir !== dir) return;
            const {config} = await storage.getSite(siteName);
            const connection = config && config.connection;
            if (connection) {
                logger.info(`certs for "${siteName}" changed — reconnecting the MQTT bridge`);
                bridge.reconnect(connection, logger, dir);
            }
        } catch (err) {
            logger.warn('bridge cert refresh failed: ' + err.message);
        }
    }

    // GET /api/sites/:name/certs — which cert files are present (never returns content)
    router.get('/sites/:name/certs', async (req, res) => {
        const dir = certDir(req.params.name);
        if (!dir) return res.json({ca: false, cert: false, key: false});
        const result = {};
        for (const [type, file] of Object.entries(CERT_FILES)) {
            const filePath = path.join(dir, file);
            try {
                await fs.access(filePath);
                result[type] = true;
                if (type === 'ca') result.caCn = await _extractCertCn(filePath);
            } catch {
                result[type] = false;
            }
        }
        res.json(result);
    });

    // POST /api/sites/:name/certs — store a PEM cert by text
    // Body: {type: 'ca'|'cert'|'key', pem: '<PEM string>'}
    router.post('/sites/:name/certs', async (req, res) => {
        const {type, pem} = req.body || {};
        if (!CERT_FILES[type]) {
            return res.status(400).json({error: 'type must be ca, cert, or key'});
        }
        if (typeof pem !== 'string' || !pem.includes('-----BEGIN ')) {
            return res.status(400).json({error: 'pem must be a valid PEM-format string'});
        }
        const dir = certDir(req.params.name);
        if (!dir) return res.status(503).json({error: 'No dataDir configured'});
        await fs.mkdir(dir, {recursive: true});
        // Normalise line endings; strip null bytes (defence-in-depth).
        const sanitized = pem.replace(/\r\n/g, '\n').replace(/\0/g, '').trim() + '\n';
        await fs.writeFile(path.join(dir, CERT_FILES[type]), sanitized, 'utf8');
        await _bridgeCertRefresh(req.params.name, dir);
        res.status(201).json({type, stored: true});
    });

    // DELETE /api/sites/:name/certs/:type — remove a stored cert
    router.delete('/sites/:name/certs/:type', async (req, res) => {
        const {type} = req.params;
        if (!CERT_FILES[type]) {
            return res.status(400).json({error: 'type must be ca, cert, or key'});
        }
        const dir = certDir(req.params.name);
        if (!dir) return res.status(503).json({error: 'No dataDir configured'});
        try {
            await fs.unlink(path.join(dir, CERT_FILES[type]));
            await _bridgeCertRefresh(req.params.name, dir);
            res.status(204).send();
        } catch (err) {
            if (err.code === 'ENOENT') return res.status(404).json({error: 'not found'});
            res.status(500).json({error: err.message});
        }
    });

    // ── A9: per-site PWA icon set (generated by the editor) ───────────────
    // Lives in <dataDir>/sites/<name>/pwa/ next to the original source image
    // and pwa.json (crop rect + background colour) for regeneration.
    const pwaIconDir = name =>
        (storage.dataDir && isValidSiteName(name)) ? pwa.pwaDir(storage.dataDir, name) : null;
    const SOURCE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];

    // GET /api/sites/:name/pwa-icons — status + regeneration data
    router.get('/sites/:name/pwa-icons', async (req, res) => {
        const dir = pwaIconDir(req.params.name);
        if (!dir) return res.json({custom: false, meta: null});
        const custom = pwa.hasCustomIcons(storage.dataDir, req.params.name);
        const meta = pwa.readPwaMeta(storage.dataDir, req.params.name);
        const result = {custom, meta};
        if (custom && req.query.include === 'source' && meta && meta.source) {
            try {
                const data = await fs.readFile(path.join(dir, path.basename(meta.source)));
                result.source = {name: meta.source, data: data.toString('base64')};
            } catch { /* source missing — regeneration will require a re-upload */ }
        }
        res.json(result);
    });

    // PUT /api/sites/:name/pwa-icons — store the editor-generated set
    // Body: {icons: {'icon-192.png': <base64>, …}, source: {name, data}, meta: {crop, backgroundColor}}
    router.put('/sites/:name/pwa-icons',
        express.json({limit: '25mb'}),
        async (req, res) => {
            const dir = pwaIconDir(req.params.name);
            if (!dir) return res.status(503).json({error: 'No dataDir configured'});
            const {icons, source, meta} = req.body || {};
            if (!icons || typeof icons !== 'object') {
                return res.status(400).json({error: 'icons object required'});
            }
            const names = Object.keys(icons);
            if (!names.length || names.some(n => !pwa.PWA_ICON_FILES.includes(n))) {
                return res.status(400).json({error: 'icon names must be one of: ' + pwa.PWA_ICON_FILES.join(', ')});
            }
            let sourceName = null;
            if (source && source.name && source.data) {
                const ext = path.extname(source.name).toLowerCase();
                if (!SOURCE_EXT.includes(ext)) {
                    return res.status(400).json({error: 'source extension must be one of: ' + SOURCE_EXT.join(', ')});
                }
                sourceName = 'source' + ext;
            }
            try {
                await fs.mkdir(dir, {recursive: true});
                for (const [name, data] of Object.entries(icons)) {
                    await fs.writeFile(path.join(dir, name), Buffer.from(data, 'base64'));
                }
                if (sourceName) {
                    await fs.writeFile(path.join(dir, sourceName), Buffer.from(source.data, 'base64'));
                }
                await fs.writeFile(path.join(dir, 'pwa.json'), JSON.stringify({
                    ...(meta && typeof meta === 'object' ? meta : {}),
                    source: sourceName || (pwa.readPwaMeta(storage.dataDir, req.params.name) || {}).source || null,
                }, null, 2));
                res.status(201).json({stored: names.length});
            } catch (err) {
                res.status(500).json({error: err.message});
            }
        }
    );

    // DELETE /api/sites/:name/pwa-icons — reset to the default feezal icons
    router.delete('/sites/:name/pwa-icons', async (req, res) => {
        const dir = pwaIconDir(req.params.name);
        if (!dir) return res.status(503).json({error: 'No dataDir configured'});
        try {
            await fs.rm(dir, {recursive: true, force: true});
            res.status(204).send();
        } catch (err) {
            res.status(500).json({error: err.message});
        }
    });

    return router;
}

module.exports = createApiRouter;

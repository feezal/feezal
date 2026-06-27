'use strict';

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const createExport = require('../build/export.js');

// Names reserved for internal use that must never be treated as site names.
const RESERVED_SITE_NAMES = new Set(['_global', 'themes']);
const isReservedSiteName = name => RESERVED_SITE_NAMES.has(name) || name.startsWith('_');

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
function createApiRouter(storage, wwwDir, logger, {getTopicCompletions = null, getDiscoveredEntities = null, getDiscoveredEntity = null} = {}) {
    const router = express.Router();

    // Version info
    router.get('/version', (_req, res) => {
        res.json({version: currentVersion});
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
        if (isReservedSiteName(name)) {
            return res.status(400).json({error: `"${name}" is a reserved name and cannot be used as a site name.`});
        }
        if (RESERVED_SITE_NAMES.has(name) || name.startsWith('_')) {
            return res.status(400).json({error: `"${name}" is a reserved name and cannot be used as a site name.`});
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
        if (isReservedSiteName(newName)) {
            return res.status(400).json({error: `"${newName}" is a reserved name and cannot be used as a site name.`});
        }
        if (RESERVED_SITE_NAMES.has(newName) || newName.startsWith('_')) {
            return res.status(400).json({error: `"${newName}" is a reserved name and cannot be used as a site name.`});
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
        if (isReservedSiteName(newName)) {
            return res.status(400).json({error: `"${newName}" is a reserved name and cannot be used as a site name.`});
        }
        if (RESERVED_SITE_NAMES.has(newName) || newName.startsWith('_')) {
            return res.status(400).json({error: `"${newName}" is a reserved name and cannot be used as a site name.`});
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

    // ── MQTT topic completions ──────────────────────────────────────────────
    // Returns the next-level topic completions for a given prefix.
    // The topic trie is populated from live MQTT traffic seen by the hub.
    router.get('/topics/completions', (req, res) => {
        const prefix = typeof req.query.prefix === 'string' ? req.query.prefix : '';
        const completions = getTopicCompletions ? getTopicCompletions(prefix) : [];
        res.json({completions});
    });

    // ── Auto-discovery (N12) ───────────────────────────────────────────────
    // Returns the flat list of all discovered MQTT entities.
    router.get('/discovery/devices', (_req, res) => {
        const devices = getDiscoveredEntities ? getDiscoveredEntities() : [];
        res.json({devices});
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

    // ── Version history (git) ──────────────────────────────────────────────

    // Shared helper: resolve the site's git repo dir.
    const siteRepoDir = name => storage.dataDir ? path.join(storage.dataDir, name) : null;

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

    return router;
}

module.exports = createApiRouter;

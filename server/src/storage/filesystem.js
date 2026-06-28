'use strict';

const fs = require('fs').promises;
const path = require('path');

const StorageAdapter = require('./adapter.js');
const {initRepo, autoCommit, showFile, setLogger} = require('../build/git.js');

const VIEWS_FILE = 'views.html';
const CONFIG_FILE = 'viewer.json';
const GLOBAL_DIR = '_global';

// Directories inside dataDir that are not sites.
const RESERVED_SITE_NAMES = new Set(['_global', 'themes']);
const isReservedSiteName = name => RESERVED_SITE_NAMES.has(name) || name.startsWith('_');

const DEFAULT_SITE_HTML = `<feezal-site><feezal-view name="view1" style="
        width: 100%;
        height: 100%;
        background: var(--primary-background-color);
    "></feezal-view></feezal-site>`;

class FilesystemStorage extends StorageAdapter {
    /**
     * @param {string} dataDir  Root directory where site folders are stored.
     */
    constructor(dataDir) {
        super();
        this.dataDir = dataDir;
        this._logger = console;
    }

    _sitePath(name) {
        return path.join(this.dataDir, name);
    }

    /**
     * Initialise per-site git repositories for all existing sites.
     * Called once at daemon startup.  Safe to call multiple times.
     *
     * @param {object} [logger]
     */
    async init(logger = console) {
        this._logger = logger;
        setLogger(logger);
        const sites = await this.listSites();
        logger.info(`git: found ${sites.length} site(s) to initialise: ${sites.join(', ') || '(none)'}`);
        for (const site of sites) {
            try {
                await initRepo(this._sitePath(site), site);
            } catch (err) {
                logger.warn(`git: failed to init repo for "${site}": ${err.message}`);
            }
        }
    }

    async listSites() {
        try {
            const entries = await fs.readdir(this.dataDir, {withFileTypes: true});
            return entries
                .filter(e => e.isDirectory() && !isReservedSiteName(e.name))
                .map(e => e.name);
        } catch {
            return [];
        }
    }

    async getSite(name) {
        let html = DEFAULT_SITE_HTML;
        let config = {};

        try {
            const raw = await fs.readFile(path.join(this._sitePath(name), VIEWS_FILE), 'utf8');
            html = raw.trim() ? raw : DEFAULT_SITE_HTML;
        } catch {
            // Site not yet saved — return defaults
        }

        try {
            const raw = await fs.readFile(path.join(this._sitePath(name), CONFIG_FILE), 'utf8');
            config = JSON.parse(raw);
        } catch {
            // No config yet
        }

        return {html, config};
    }

    /**
     * Return the views.html and viewer config of a site at a specific git commit.
     * Falls back to current content if git is unavailable or the sha is invalid.
     * @param {string} name  Site name.
     * @param {string} sha   Commit hash (7–40 hex chars).
     * @returns {Promise<{html: string, config: object|null}>}
     */
    async getSiteAtVersion(name, sha) {
        const html = await showFile(this._sitePath(name), sha, VIEWS_FILE);
        let config = null;
        try {
            const raw = await showFile(this._sitePath(name), sha, CONFIG_FILE);
            if (raw) config = JSON.parse(raw);
        } catch { /* viewer.json absent in older commits — non-fatal */ }
        return {html: html || DEFAULT_SITE_HTML, config};
    }

    async saveSite(name, {html, config}) {
        const sitePath = this._sitePath(name);
        const isNew = !require('fs').existsSync(path.join(sitePath, '.git'));
        await fs.mkdir(sitePath, {recursive: true});
        await Promise.all([
            fs.writeFile(path.join(sitePath, VIEWS_FILE), html, 'utf8'),
            fs.writeFile(path.join(sitePath, CONFIG_FILE), JSON.stringify(config, null, 2), 'utf8')
        ]);
        // Git auto-commit — awaited so the .git dir is stable before returning,
        // but errors are swallowed so they never fail the save.
        try {
            if (isNew) {
                await initRepo(sitePath, name);
            } else {
                await autoCommit(sitePath, name);
            }
        } catch (err) {
            this._logger.warn(`git: save commit failed for "${name}": ${err.message}`);
        }
    }

    async deleteSite(name) {
        await fs.rm(this._sitePath(name), {recursive: true, force: true});
    }

    async cloneSite(name, newName) {
        await fs.cp(this._sitePath(name), this._sitePath(newName), {recursive: true});
        // Give the clone its own independent git history (drop the source's .git).
        const newPath = this._sitePath(newName);
        await fs.rm(path.join(newPath, '.git'), {recursive: true, force: true});
        try { await initRepo(newPath, newName); } catch (err) {
            this._logger.warn(`git: clone init failed for "${newName}": ${err.message}`);
        }
    }

    async renameSite(name, newName) {
        // The .git directory moves with the site directory — history is preserved.
        await fs.rename(this._sitePath(name), this._sitePath(newName));
    }

    // ── Asset helpers ──────────────────────────────────────────────────────

    _assetBase(category, siteName) {
        return category === 'global'
            ? path.join(this.dataDir, GLOBAL_DIR, 'assets')
            : path.join(this._sitePath(siteName), 'assets');
    }

    _resolveAssetPath(base, filePath) {
        const normalized = path.normalize(filePath).replace(/\\/g, '/');
        if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
            throw new Error('invalid asset path');
        }
        const resolved = path.join(base, normalized);
        if (!resolved.startsWith(base + path.sep) && resolved !== base) {
            throw new Error('invalid asset path');
        }
        return resolved;
    }

    async _listFilesRec(dir, baseDir) {
        const results = [];
        try {
            const entries = await fs.readdir(dir, {withFileTypes: true});
            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    const sub = await this._listFilesRec(full, baseDir);
                    results.push(...sub);
                } else {
                    const stat = await fs.stat(full);
                    results.push({
                        path: path.relative(baseDir, full).replace(/\\/g, '/'),
                        size: stat.size,
                        modified: stat.mtimeMs
                    });
                }
            }
        } catch { /* dir does not exist yet */ }
        return results;
    }

    async listAssets(siteName) {
        const globalBase = this._assetBase('global', siteName);
        const siteBase   = this._assetBase('site',   siteName);
        const [globalFiles, siteFiles] = await Promise.all([
            this._listFilesRec(globalBase, globalBase),
            this._listFilesRec(siteBase, siteBase)
        ]);
        return {global: globalFiles, site: siteFiles};
    }

    async saveAsset(category, siteName, filePath, buffer) {
        const base = this._assetBase(category, siteName);
        const dest = this._resolveAssetPath(base, filePath);
        await fs.mkdir(path.dirname(dest), {recursive: true});
        await fs.writeFile(dest, buffer);
    }

    async deleteAsset(category, siteName, filePath) {
        const base   = this._assetBase(category, siteName);
        const target = this._resolveAssetPath(base, filePath);
        const stat   = await fs.stat(target).catch(() => null);
        if (!stat) return;
        if (stat.isDirectory()) {
            await fs.rm(target, {recursive: true, force: true});
        } else {
            await fs.unlink(target);
        }
    }

    async renameAsset(category, siteName, oldPath, newPath) {
        const base = this._assetBase(category, siteName);
        const from = this._resolveAssetPath(base, oldPath);
        const to   = this._resolveAssetPath(base, newPath);
        await fs.mkdir(path.dirname(to), {recursive: true});
        await fs.rename(from, to);
    }

    async createAssetDir(category, siteName, dirPath) {
        const base   = this._assetBase(category, siteName);
        const target = this._resolveAssetPath(base, dirPath);
        await fs.mkdir(target, {recursive: true});
    }

    /** Returns {global: {base, files}, site: {base, files}} for export bundling. */
    async getAssetFilesForExport(siteName) {
        const globalBase = this._assetBase('global', siteName);
        const siteBase   = this._assetBase('site',   siteName);
        const [globalFiles, siteFiles] = await Promise.all([
            this._listFilesRec(globalBase, globalBase),
            this._listFilesRec(siteBase, siteBase)
        ]);
        return {
            global: {base: globalBase, files: globalFiles.map(f => f.path)},
            site:   {base: siteBase,   files: siteFiles.map(f => f.path)}
        };
    }
}

module.exports = FilesystemStorage;

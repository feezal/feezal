'use strict';

const fs = require('fs').promises;
const path = require('path');

const StorageAdapter = require('./adapter.js');
const {initRepo, autoCommit, showFile, setLogger} = require('../build/git.js');

const VIEWS_FILE = 'site.html';    // per-site markup (A14 — was views.html)
const CONFIG_FILE = 'site.json';   // per-site config (A14 — was viewer.json)
const SITES_DIR = 'sites';         // A14 — every site lives under <dataDir>/sites/
const GLOBAL_DIR = 'global';       // A14 — was _global

// A14: sites live under <dataDir>/sites/, so a site name can no longer collide
// with a root-level system dir. It only has to be a safe single path segment.

// Site names may contain quotes, spaces or MQTT wildcards (+, #) — only this
// safe subset gets interpolated into topic attributes / topic strings.
const TOPIC_SAFE_NAME = /^[\w-]+$/;

/** The default site topics: subscribe feezal/<name>/set, publish feezal/<name>.
 * Applied to fresh sites; renameSite/cloneSite retarget them as long as the
 * user hasn't customised them. */
const defaultSiteTopics = name => TOPIC_SAFE_NAME.test(name)
    ? {subscribe: `feezal/${name}/set`, publish: `feezal/${name}`}
    : null;

function defaultSiteHtml(name) {
    const topics = defaultSiteTopics(name);
    const attrs = topics ? ` subscribe="${topics.subscribe}" publish="${topics.publish}"` : '';
    return `<feezal-site${attrs}><feezal-view name="view1" style="
        width: 100%;
        height: 100%;
        background: var(--primary-background-color);
    "></feezal-view></feezal-site>`;
}

/**
 * Rewrite the <feezal-site> subscribe/publish attributes from the OLD name's
 * defaults to the NEW name's — each attribute independently, and only when it
 * still carries the old default (a user-customised topic is never touched).
 * Element-level subscribe/publish attributes inside the views are left alone.
 */
function retargetDefaultTopics(html, oldName, newName) {
    const oldTopics = defaultSiteTopics(oldName);
    const newTopics = defaultSiteTopics(newName);
    if (!html || !oldTopics || !newTopics) return html;
    return html.replace(/<feezal-site\b[^>]*>/, tag => tag
        .replace(`subscribe="${oldTopics.subscribe}"`, `subscribe="${newTopics.subscribe}"`)
        .replace(`publish="${oldTopics.publish}"`, `publish="${newTopics.publish}"`));
}

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
        return path.join(this.dataDir, SITES_DIR, name);
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
            const entries = await fs.readdir(path.join(this.dataDir, SITES_DIR), {withFileTypes: true});
            return entries
                .filter(e => e.isDirectory())
                .map(e => e.name);
        } catch {
            return [];
        }
    }

    async getSite(name) {
        let html = defaultSiteHtml(name);
        let config = {};

        try {
            const raw = await fs.readFile(path.join(this._sitePath(name), VIEWS_FILE), 'utf8');
            html = raw.trim() ? raw : defaultSiteHtml(name);
        } catch {
            // Site not yet saved — return defaults
        }

        try {
            const raw = await fs.readFile(path.join(this._sitePath(name), CONFIG_FILE), 'utf8');
            config = JSON.parse(raw);
        } catch {
            // No config file yet = a never-saved site: seed the default theme
            // so a fresh install / new site opens themed instead of unstyled.
            // Once saved, the stored config wins (an intentionally cleared
            // theme is respected because the file then exists).
            config = {theme: 'feezal-theme-midnight-blue'};
        }

        return {html, config};
    }

    /**
     * Return the site markup (site.html) and config of a site at a specific git commit.
     * Falls back to current content if git is unavailable or the sha is invalid.
     * @param {string} name  Site name.
     * @param {string} sha   Commit hash (7–40 hex chars).
     * @returns {Promise<{html: string, config: object|null}>}
     */
    async getSiteAtVersion(name, sha) {
        const repo = this._sitePath(name);
        // A14: commits made before the file rename carry the old names — fall
        // back to them so historical previews/diffs keep working without a
        // data migration.
        const html = await this._showFileLegacy(repo, sha, VIEWS_FILE, 'views.html');
        let config = null;
        try {
            const raw = await this._showFileLegacy(repo, sha, CONFIG_FILE, 'viewer.json');
            if (raw) config = JSON.parse(raw);
        } catch { /* config absent in older commits — non-fatal */ }
        return {html: html || defaultSiteHtml(name), config};
    }

    /**
     * `git show sha:<file>`, falling back to the legacy filename for commits
     * created before the A14 rename. Throws only if neither name resolves.
     */
    async _showFileLegacy(repoDir, sha, file, legacyFile) {
        try {
            return await showFile(repoDir, sha, file);
        } catch {
            return showFile(repoDir, sha, legacyFile);
        }
    }

    async saveSite(name, {html, config}) {
        const sitePath = this._sitePath(name);
        const isNew = !require('fs').existsSync(path.join(sitePath, '.git'));
        await fs.mkdir(sitePath, {recursive: true});
        // A14: TLS certs (N8) live in <site>/certs/ — keep private keys out of git.
        await this._ensureGitignore(sitePath);
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

    /** Ensure the site dir ignores its certs/ folder so keys are never committed. */
    async _ensureGitignore(sitePath) {
        const gitignore = path.join(sitePath, '.gitignore');
        try {
            await fs.access(gitignore);
        } catch {
            await fs.writeFile(gitignore, 'certs/\n', 'utf8');
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
        // Default topics follow the new name (before the initial commit) —
        // customised topics stay pointed at whatever the user set.
        await this._retargetTopics(newName, name);
        try { await initRepo(newPath, newName); } catch (err) {
            this._logger.warn(`git: clone init failed for "${newName}": ${err.message}`);
        }
    }

    async renameSite(name, newName) {
        // The .git directory moves with the site directory — history is preserved.
        await fs.rename(this._sitePath(name), this._sitePath(newName));
        // Default topics follow the new name; customised topics stay put.
        if (await this._retargetTopics(newName, name)) {
            try { await autoCommit(this._sitePath(newName), newName); } catch (err) {
                this._logger.warn(`git: rename topic-retarget commit failed for "${newName}": ${err.message}`);
            }
        }
    }

    /** Rewrite site.html of `siteName` from `oldName`'s default topics to its
     * own (see retargetDefaultTopics). Returns true if the file changed. */
    async _retargetTopics(siteName, oldName) {
        const file = path.join(this._sitePath(siteName), VIEWS_FILE);
        let html;
        try {
            html = await fs.readFile(file, 'utf8');
        } catch {
            return false;   // never saved — getSite serves fresh defaults anyway
        }
        const updated = retargetDefaultTopics(html, oldName, siteName);
        if (updated === html) return false;
        await fs.writeFile(file, updated, 'utf8');
        return true;
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

    async _listDirsRec(dir, baseDir) {
        const results = [];
        try {
            const entries = await fs.readdir(dir, {withFileTypes: true});
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const full = path.join(dir, entry.name);
                    results.push(path.relative(baseDir, full).replace(/\\/g, '/'));
                    const sub = await this._listDirsRec(full, baseDir);
                    results.push(...sub);
                }
            }
        } catch { /* dir does not exist yet */ }
        return results;
    }

    async listAssets(siteName) {
        const globalBase = this._assetBase('global', siteName);
        const siteBase   = this._assetBase('site',   siteName);
        const [globalFiles, siteFiles, globalDirs, siteDirs] = await Promise.all([
            this._listFilesRec(globalBase, globalBase),
            this._listFilesRec(siteBase, siteBase),
            this._listDirsRec(globalBase, globalBase),
            this._listDirsRec(siteBase, siteBase)
        ]);
        return {global: globalFiles, site: siteFiles, globalDirs, siteDirs};
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

    async copyAsset(srcCategory, siteName, srcPath, destCategory, destPath) {
        const srcBase  = this._assetBase(srcCategory, siteName);
        const destBase = this._assetBase(destCategory, siteName);
        const from = this._resolveAssetPath(srcBase,  srcPath);
        const to   = this._resolveAssetPath(destBase, destPath);
        await fs.mkdir(path.dirname(to), {recursive: true});
        await fs.copyFile(from, to);
    }

    async moveAsset(srcCategory, siteName, srcPath, destCategory, destPath) {
        await this.copyAsset(srcCategory, siteName, srcPath, destCategory, destPath);
        const srcBase = this._assetBase(srcCategory, siteName);
        const from    = this._resolveAssetPath(srcBase, srcPath);
        await fs.unlink(from);
    }

    /**
     * Content-deduplicating copy (B15, copy-on-use of global assets). Walks the
     * candidate chain `name`, `name-1`, `name-2`, … and:
     *   (a) a free slot     → copy there, return it;
     *   (b) taken, identical → reuse it (no copy) so the src points at the existing file;
     *   (c) taken, different → try the next suffix.
     * Identity = same size, then a byte-for-byte compare. Returns the relative
     * destination path used.
     */
    async copyAssetUnique(srcCategory, siteName, srcPath, destCategory, destPath) {
        const srcBase  = this._assetBase(srcCategory, siteName);
        const destBase = this._assetBase(destCategory, siteName);
        const srcAbs   = this._resolveAssetPath(srcBase, srcPath);
        const ext  = path.extname(destPath);
        const stem = destPath.slice(0, destPath.length - ext.length);

        let srcStat = null;
        try { srcStat = await fs.stat(srcAbs); } catch { /* missing source → copyAsset will throw below */ }

        for (let n = 0; ; n++) {
            const candidate = n === 0 ? destPath : `${stem}-${n}${ext}`;
            const candAbs = this._resolveAssetPath(destBase, candidate);
            let candStat = null;
            try { candStat = await fs.stat(candAbs); } catch { candStat = null; }

            if (!candStat) {                                   // (a) free
                await this.copyAsset(srcCategory, siteName, srcPath, destCategory, candidate);
                return candidate;
            }
            if (srcStat && candStat.size === srcStat.size &&   // (b) identical → reuse
                await this._filesEqual(srcAbs, candAbs)) {
                return candidate;
            }
            // (c) different → next suffix
        }
    }

    /** Byte-for-byte file comparison (callers pre-check size for a cheap reject). */
    async _filesEqual(a, b) {
        try {
            const [ba, bb] = await Promise.all([fs.readFile(a), fs.readFile(b)]);
            return ba.equals(bb);
        } catch {
            return false;
        }
    }

    /**
     * Walk site.html and site.json for the given site and replace all
     * occurrences of oldUrl with newUrl.  A git commit is made if anything changed.
     */
    async updateAssetRefs(siteName, oldUrl, newUrl) {
        const sitePath  = this._sitePath(siteName);
        const viewsFile = path.join(sitePath, VIEWS_FILE);
        const cfgFile   = path.join(sitePath, CONFIG_FILE);
        let changed = false;
        for (const file of [viewsFile, cfgFile]) {
            const content = await fs.readFile(file, 'utf8').catch(() => null);
            if (content && content.includes(oldUrl)) {
                await fs.writeFile(file, content.split(oldUrl).join(newUrl), 'utf8');
                changed = true;
            }
        }
        if (changed) {
            try {
                await autoCommit(sitePath, siteName);
            } catch (err) {
                this._logger.warn(`git: ref-update commit failed for "${siteName}": ${err.message}`);
            }
        }
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

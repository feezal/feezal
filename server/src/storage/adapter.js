'use strict';

/**
 * StorageAdapter — interface contract (JSDoc only, no runtime enforcement).
 *
 * Implementations must provide all methods below. The filesystem backend
 * is the default. Future backends (e.g. SQLite) implement the same surface.
 *
 * @interface
 */
class StorageAdapter {
    /**
     * List all site names.
     * @returns {Promise<string[]>}
     */
    async listSites() {
        throw new Error('Not implemented');
    }

    /**
     * Load a site's HTML and config.
     * @param {string} name
     * @returns {Promise<{html: string, config: object}>}
     */
    async getSite(name) {
        throw new Error('Not implemented');
    }

    /**
     * Persist a site's HTML and config. Creates the site if it does not exist.
     * @param {string} name
     * @param {{html: string, config: object}} data
     * @returns {Promise<void>}
     */
    async saveSite(name, {html, config}) { // eslint-disable-line no-unused-vars
        throw new Error('Not implemented');
    }

    /**
     * Permanently delete a site.
     * @param {string} name
     * @returns {Promise<void>}
     */
    async deleteSite(name) {
        throw new Error('Not implemented');
    }

    /**
     * Duplicate a site under a new name.
     * @param {string} name
     * @param {string} newName
     * @returns {Promise<void>}
     */
    async cloneSite(name, newName) { // eslint-disable-line no-unused-vars
        throw new Error('Not implemented');
    }

    /**
     * Rename a site.
     * @param {string} name
     * @param {string} newName
     * @returns {Promise<void>}
     */
    async renameSite(name, newName) { // eslint-disable-line no-unused-vars
        throw new Error('Not implemented');
    }

    // ── Assets ─────────────────────────────────────────────────────────────

    /** @returns {Promise<{global: Array, site: Array}>} */
    async listAssets(siteName) { // eslint-disable-line no-unused-vars
        throw new Error('Not implemented');
    }

    /** @returns {Promise<void>} */
    async saveAsset(category, siteName, filePath, buffer) { // eslint-disable-line no-unused-vars
        throw new Error('Not implemented');
    }

    /** @returns {Promise<void>} */
    async deleteAsset(category, siteName, filePath) { // eslint-disable-line no-unused-vars
        throw new Error('Not implemented');
    }

    /** @returns {Promise<void>} */
    async renameAsset(category, siteName, oldPath, newPath) { // eslint-disable-line no-unused-vars
        throw new Error('Not implemented');
    }

    /** @returns {Promise<void>} */
    async createAssetDir(category, siteName, dirPath) { // eslint-disable-line no-unused-vars
        throw new Error('Not implemented');
    }

    /** @returns {Promise<{global:{base,files},site:{base,files}}>} */
    async getAssetFilesForExport(siteName) { // eslint-disable-line no-unused-vars
        return {global: {base: '', files: []}, site: {base: '', files: []}};
    }
}

module.exports = StorageAdapter;

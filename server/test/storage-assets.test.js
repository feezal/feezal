/**
 * Unit tests for the asset side of storage/filesystem.js: upload/list/delete/
 * rename/mkdir/copy/move, path-traversal rejection, updateAssetRefs rewriting,
 * and the export file listing. Everything runs against a throwaway data dir.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';

const require = createRequire(import.meta.url);
const FilesystemStorage = require('../src/storage/filesystem.js');

let dataDir, storage;
beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'feezal-assets-'));
    storage = new FilesystemStorage(dataDir);
    storage._logger = {debug() {}, info() {}, warn() {}, error() {}};
});
afterEach(async () => { await rm(dataDir, {recursive: true, force: true}); });

describe('saveAsset / listAssets', () => {
    it('stores site and global assets in separate buckets', async () => {
        await storage.saveAsset('site', 's', 'a.png', Buffer.from('AAA'));
        await storage.saveAsset('global', null, 'g.png', Buffer.from('GGG'));
        const {site, global} = await storage.listAssets('s');
        expect(site.map(f => f.path)).toEqual(['a.png']);
        expect(global.map(f => f.path)).toEqual(['g.png']);
        expect(site[0].size).toBe(3);
    });

    it('creates nested directories and lists them', async () => {
        await storage.saveAsset('site', 's', 'img/icons/a.png', Buffer.from('x'));
        const {site, siteDirs} = await storage.listAssets('s');
        expect(site.map(f => f.path)).toEqual(['img/icons/a.png']);
        expect(siteDirs).toEqual(expect.arrayContaining(['img', 'img/icons']));
    });

    it('rejects path traversal and absolute paths', async () => {
        await expect(storage.saveAsset('site', 's', '../evil.png', Buffer.from('x'))).rejects.toThrow(/invalid asset path/);
        await expect(storage.saveAsset('site', 's', '/etc/passwd', Buffer.from('x'))).rejects.toThrow(/invalid asset path/);
    });
});

describe('mutating asset ops', () => {
    it('deleteAsset removes a file', async () => {
        await storage.saveAsset('site', 's', 'a.png', Buffer.from('x'));
        await storage.deleteAsset('site', 's', 'a.png');
        expect((await storage.listAssets('s')).site).toEqual([]);
    });

    it('deleteAsset removes a directory recursively', async () => {
        await storage.saveAsset('site', 's', 'sub/a.png', Buffer.from('x'));
        await storage.deleteAsset('site', 's', 'sub');
        const {site, siteDirs} = await storage.listAssets('s');
        expect(site).toEqual([]);
        expect(siteDirs).toEqual([]);
    });

    it('renameAsset moves a file to a new name', async () => {
        await storage.saveAsset('site', 's', 'a.png', Buffer.from('x'));
        await storage.renameAsset('site', 's', 'a.png', 'b.png');
        expect((await storage.listAssets('s')).site.map(f => f.path)).toEqual(['b.png']);
    });

    it('createAssetDir makes an empty directory', async () => {
        await storage.createAssetDir('site', 's', 'newdir');
        expect((await storage.listAssets('s')).siteDirs).toContain('newdir');
    });

    it('copyAsset duplicates across categories, moveAsset removes the source', async () => {
        await storage.saveAsset('global', null, 'logo.png', Buffer.from('LOGO'));
        await storage.copyAsset('global', 's', 'logo.png', 'site', 'logo.png');
        let a = await storage.listAssets('s');
        expect(a.global.map(f => f.path)).toContain('logo.png');
        expect(a.site.map(f => f.path)).toContain('logo.png');

        await storage.saveAsset('global', null, 'move-me.png', Buffer.from('MV'));
        await storage.moveAsset('global', 's', 'move-me.png', 'site', 'moved.png');
        a = await storage.listAssets('s');
        expect(a.site.map(f => f.path)).toContain('moved.png');
        expect(a.global.map(f => f.path)).not.toContain('move-me.png');   // source gone
    });
});

describe('updateAssetRefs', () => {
    it('rewrites the old URL to the new one in site.html and site.json', async () => {
        await storage.saveSite('s', {
            html: '<img src="/assets/global/logo.png"> and again /assets/global/logo.png',
            config: {background: '/assets/global/logo.png'},
        });
        await storage.updateAssetRefs('s', '/assets/global/logo.png', '/assets/s/logo.png');
        const {html, config} = await storage.getSite('s');
        expect(html).not.toContain('/assets/global/logo.png');
        expect(html.match(/\/assets\/s\/logo\.png/g)).toHaveLength(2);
        expect(config.background).toBe('/assets/s/logo.png');
    });
});

describe('getAssetFilesForExport', () => {
    it('returns base dirs and relative file lists for both buckets', async () => {
        await storage.saveAsset('site', 's', 'a.png', Buffer.from('x'));
        await storage.saveAsset('global', null, 'g.png', Buffer.from('y'));
        const out = await storage.getAssetFilesForExport('s');
        expect(out.site.files).toEqual(['a.png']);
        expect(out.global.files).toEqual(['g.png']);
        expect(typeof out.site.base).toBe('string');
        expect(typeof out.global.base).toBe('string');
    });
});

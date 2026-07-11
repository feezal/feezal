import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';

const require = createRequire(import.meta.url);
const FilesystemStorage = require('../src/storage/filesystem.js');

let dataDir;
let storage;

beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'feezal-test-'));
    storage = new FilesystemStorage(dataDir);
});

afterEach(async () => {
    await rm(dataDir, {recursive: true, force: true});
});

describe('FilesystemStorage', () => {
    describe('listSites', () => {
        it('returns empty array when data dir has no sites', async () => {
            expect(await storage.listSites()).toEqual([]);
        });

        it('lists created sites', async () => {
            await storage.saveSite('alpha', {html: '<feezal-site></feezal-site>', config: {}});
            await storage.saveSite('beta',  {html: '<feezal-site></feezal-site>', config: {}});
            const sites = await storage.listSites();
            expect(sites).toContain('alpha');
            expect(sites).toContain('beta');
        });
    });

    describe('getSite / saveSite', () => {
        it('returns default html with default topics when site does not exist', async () => {
            const {html} = await storage.getSite('nonexistent');
            expect(html).toContain('<feezal-site subscribe="feezal/nonexistent/set" publish="feezal/nonexistent">');
        });

        it('omits default topics for names unsafe in topics/attributes', async () => {
            // Site names may contain quotes, spaces and MQTT wildcards — such
            // names get no default topics instead of broken ones.
            for (const name of ['my site', 'a"b', 'x+y', 'x#']) {
                const {html} = await storage.getSite(name);
                expect(html).toContain('<feezal-site>');
                expect(html).not.toContain('subscribe=');
            }
        });

        it('round-trips html and config', async () => {
            const html = '<feezal-site><feezal-view name="v1"></feezal-view></feezal-site>';
            const config = {connection: {uri: 'ws://broker:9001'}};
            await storage.saveSite('mysite', {html, config});
            const loaded = await storage.getSite('mysite');
            expect(loaded.html).toBe(html);
            expect(loaded.config).toEqual(config);
        });

        it('creates the site directory when it does not exist yet', async () => {
            await storage.saveSite('newsite', {html: '', config: {}});
            const sites = await storage.listSites();
            expect(sites).toContain('newsite');
        });
    });

    describe('deleteSite', () => {
        it('removes a site', async () => {
            await storage.saveSite('todelete', {html: '', config: {}});
            await storage.deleteSite('todelete');
            expect(await storage.listSites()).not.toContain('todelete');
        });

        it('does not throw when site does not exist', async () => {
            await expect(storage.deleteSite('ghost')).resolves.not.toThrow();
        });
    });

    describe('cloneSite', () => {
        it('creates an independent copy of a site', async () => {
            const html = '<feezal-site><feezal-view name="v1"></feezal-view></feezal-site>';
            await storage.saveSite('original', {html, config: {x: 1}});
            await storage.cloneSite('original', 'clone');
            const cloned = await storage.getSite('clone');
            expect(cloned.html).toBe(html);
            expect(cloned.config).toEqual({x: 1});
            // Mutation of clone must not affect original
            await storage.saveSite('clone', {html: '<feezal-site></feezal-site>', config: {}});
            const orig = await storage.getSite('original');
            expect(orig.html).toBe(html);
        });
    });

    describe('renameSite', () => {
        it('moves the site to a new name', async () => {
            await storage.saveSite('before', {html: '<x/>', config: {}});
            await storage.renameSite('before', 'after');
            expect(await storage.listSites()).not.toContain('before');
            expect(await storage.listSites()).toContain('after');
        });
    });

    describe('default site topics follow rename/clone (unless customised)', () => {
        const withTopics = (sub, pub) =>
            `<feezal-site subscribe="${sub}" publish="${pub}"><feezal-view name="v1"></feezal-view></feezal-site>`;

        it('rename retargets topics that still match the old defaults', async () => {
            await storage.saveSite('old', {html: withTopics('feezal/old/set', 'feezal/old'), config: {}});
            await storage.renameSite('old', 'new');
            const {html} = await storage.getSite('new');
            expect(html).toContain('subscribe="feezal/new/set"');
            expect(html).toContain('publish="feezal/new"');
        });

        it('rename leaves user-customised topics alone', async () => {
            await storage.saveSite('old', {html: withTopics('home/cmnd', 'home/stat'), config: {}});
            await storage.renameSite('old', 'new');
            const {html} = await storage.getSite('new');
            expect(html).toContain('subscribe="home/cmnd"');
            expect(html).toContain('publish="home/stat"');
        });

        it('rename retargets each attribute independently (one default, one customised)', async () => {
            await storage.saveSite('old', {html: withTopics('feezal/old/set', 'home/stat'), config: {}});
            await storage.renameSite('old', 'new');
            const {html} = await storage.getSite('new');
            expect(html).toContain('subscribe="feezal/new/set"');
            expect(html).toContain('publish="home/stat"');
        });

        it('rename does not touch element-level topics inside the views', async () => {
            const html = '<feezal-site subscribe="feezal/old/set" publish="feezal/old">'
                + '<feezal-view name="v1"><feezal-element-basic-number subscribe="feezal/old/temp">'
                + '</feezal-element-basic-number></feezal-view></feezal-site>';
            await storage.saveSite('old', {html, config: {}});
            await storage.renameSite('old', 'new');
            const loaded = await storage.getSite('new');
            expect(loaded.html).toContain('<feezal-site subscribe="feezal/new/set" publish="feezal/new">');
            expect(loaded.html).toContain('feezal-element-basic-number subscribe="feezal/old/temp"');
        });

        it('clone retargets default topics to the clone name', async () => {
            await storage.saveSite('src', {html: withTopics('feezal/src/set', 'feezal/src'), config: {}});
            await storage.cloneSite('src', 'copy');
            const copy = await storage.getSite('copy');
            expect(copy.html).toContain('subscribe="feezal/copy/set"');
            expect(copy.html).toContain('publish="feezal/copy"');
            // The source keeps its own topics.
            const src = await storage.getSite('src');
            expect(src.html).toContain('publish="feezal/src"');
        });

        it('a never-deployed site (empty html file) serves fresh defaults after rename', async () => {
            await storage.saveSite('old', {html: '', config: {}});   // POST /sites shape
            await storage.renameSite('old', 'new');
            const {html} = await storage.getSite('new');
            expect(html).toContain('subscribe="feezal/new/set"');
        });
    });

    describe('copyAssetUnique — content dedup (B15)', () => {
        it('reuses an identical copy and only suffixes when content differs', async () => {
            await storage.saveSite('s', {html: '<x/>', config: {}});
            await storage.saveAsset('global', null, 'logo.png', Buffer.from('AAAA'));

            const p1 = await storage.copyAssetUnique('global', 's', 'logo.png', 'site', 'logo.png');
            const p2 = await storage.copyAssetUnique('global', 's', 'logo.png', 'site', 'logo.png');
            expect(p1).toBe('logo.png');
            expect(p2).toBe('logo.png');                    // same file → reused, no dup

            // A different global file with the same name → suffixed, not overwritten.
            await storage.saveAsset('global', null, 'logo.png', Buffer.from('BBBBBB'));
            const p3 = await storage.copyAssetUnique('global', 's', 'logo.png', 'site', 'logo.png');
            const p4 = await storage.copyAssetUnique('global', 's', 'logo.png', 'site', 'logo.png');
            expect(p3).toBe('logo-1.png');
            expect(p4).toBe('logo-1.png');                  // re-drag of the different file → reused

            const {site} = await storage.listAssets('s');
            expect(site.map(f => f.path).sort()).toEqual(['logo-1.png', 'logo.png']);
        });
    });
});

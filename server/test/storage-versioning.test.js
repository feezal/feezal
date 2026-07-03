/**
 * Tests for FilesystemStorage.getSiteAtVersion — reading a site's markup/config
 * at a past git commit, including the A14 legacy-filename fallback
 * (views.html / viewer.json for commits made before the rename).
 * git-gated: skips when the binary is unavailable.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm, mkdir, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';

const require = createRequire(import.meta.url);
const FilesystemStorage = require('../src/storage/filesystem.js');
const git = require('../src/build/git.js');

const hasGit = await git.isGitAvailable();
const silent = {debug() {}, info() {}, warn() {}, error() {}};

describe.skipIf(!hasGit)('getSiteAtVersion', () => {
    let dataDir, storage;
    beforeEach(async () => {
        dataDir = await mkdtemp(join(tmpdir(), 'feezal-ver-'));
        storage = new FilesystemStorage(dataDir);
        storage._logger = silent;
    });
    afterEach(async () => { await rm(dataDir, {recursive: true, force: true}); });

    it('returns the html/config committed at a given sha', async () => {
        await storage.saveSite('s', {html: '<v1/>', config: {a: 1}});
        const sha1 = (await git.listCommits(storage._sitePath('s')))[0].sha;
        await storage.saveSite('s', {html: '<v2/>', config: {a: 2}});

        const at1 = await storage.getSiteAtVersion('s', sha1);
        expect(at1.html).toBe('<v1/>');
        expect(at1.config).toEqual({a: 1});
    });

    it('falls back to the legacy views.html / viewer.json filenames', async () => {
        // Simulate a pre-A14 repo: only views.html + viewer.json exist.
        const dir = storage._sitePath('legacy');
        await mkdir(dir, {recursive: true});
        await writeFile(join(dir, 'views.html'), '<legacy/>', 'utf8');
        await writeFile(join(dir, 'viewer.json'), JSON.stringify({old: true}), 'utf8');
        await git.initRepo(dir, 'legacy');
        const sha = (await git.listCommits(dir))[0].sha;

        const at = await storage.getSiteAtVersion('legacy', sha);
        expect(at.html).toBe('<legacy/>');
        expect(at.config).toEqual({old: true});
    });
});

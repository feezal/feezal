/**
 * Unit/integration tests for build/git.js against a real temporary repo.
 * git is optional at runtime, so the whole suite skips when the binary is
 * absent (matching the module's own no-op behaviour).
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';

const require = createRequire(import.meta.url);
const git = require('../src/build/git.js');

const hasGit = await git.isGitAvailable();

describe.skipIf(!hasGit)('build/git.js (real repo)', () => {
    let repo;
    beforeEach(async () => { repo = await mkdtemp(join(tmpdir(), 'feezal-git-')); });
    afterEach(async () => { await rm(repo, {recursive: true, force: true}); });

    it('initRepo creates the repo with an initial commit of the present files', async () => {
        await writeFile(join(repo, 'site.html'), '<v1/>', 'utf8');
        await git.initRepo(repo, 'mysite');
        const log = await git.listCommits(repo);
        expect(log).toHaveLength(1);
        expect(log[0].message).toBe('init: mysite');
        expect(log[0].sha).toMatch(/^[a-f0-9]{40}$/);
    });

    it('autoCommit records a new commit when a tracked file changed', async () => {
        await writeFile(join(repo, 'site.html'), '<v1/>', 'utf8');
        await git.initRepo(repo, 's');
        expect(await git.listCommits(repo)).toHaveLength(1);

        // A real change → one new commit, newest first.
        await writeFile(join(repo, 'site.html'), '<v2/>', 'utf8');
        await git.autoCommit(repo, 's', 'second');
        const log = await git.listCommits(repo);
        expect(log).toHaveLength(2);
        expect(log[0].message).toBe('second');
    });

    it('showFile returns file content as it was at a given commit', async () => {
        await writeFile(join(repo, 'site.html'), '<v1/>', 'utf8');
        await git.initRepo(repo, 's');
        const first = (await git.listCommits(repo))[0].sha;

        await writeFile(join(repo, 'site.html'), '<v2/>', 'utf8');
        await git.autoCommit(repo, 's', 'v2');

        expect(await git.showFile(repo, first, 'site.html')).toBe('<v1/>');
    });

    it('restoreVersion brings back old content and appends a restore commit (history preserved)', async () => {
        await writeFile(join(repo, 'site.html'), '<v1/>', 'utf8');
        await git.initRepo(repo, 's');
        const first = (await git.listCommits(repo))[0].sha;

        await writeFile(join(repo, 'site.html'), '<v2/>', 'utf8');
        await git.autoCommit(repo, 's', 'v2');

        await git.restoreVersion(repo, 's', first, 'v1');
        const log = await git.listCommits(repo);
        expect(log).toHaveLength(3);                    // init, v2, restore
        expect(log[0].message).toMatch(/^restore:/);
        // Working tree is back to v1 content at HEAD.
        expect(await git.showFile(repo, log[0].sha, 'site.html')).toBe('<v1/>');
    });
});

'use strict';

/**
 * Thin helpers for per-site git repositories.
 *
 * Each feezal site directory is its own self-contained git repo.  No npm
 * packages are required — all operations are spawned as child processes.
 *
 * Git is optional: if the `git` binary is absent from PATH every function
 * resolves successfully (with a no-op).  This keeps non-git environments
 * working without error.
 */

const {execFile} = require('node:child_process');
const path = require('path');
const {existsSync} = require('fs');

// Identity injected into every commit via -c flags.
// Avoids requiring a global git user config on the host / in Docker.
const IDENTITY = [
    '-c', 'user.name=feezal',
    '-c', 'user.email=feezal@localhost'
];

// Lazily-resolved git-available flag: null = unchecked, true/false = result.
let _gitAvailable = null;

/**
 * Returns true if the `git` binary can be found in PATH.
 * Result is cached for the lifetime of the process.
 */
async function isGitAvailable() {
    if (_gitAvailable !== null) return _gitAvailable;
    try {
        await _gitExec(process.cwd(), ['--version']);
        _gitAvailable = true;
    } catch {
        _gitAvailable = false;
    }
    return _gitAvailable;
}

/** Internal: spawn git and resolve with trimmed stdout, or reject with stderr. */
function _gitExec(repoDir, args) {
    return new Promise((resolve, reject) => {
        execFile('git', args, {cwd: repoDir}, (err, stdout, stderr) => {
            if (err) reject(new Error(stderr.trim() || err.message));
            else resolve(stdout.trim());
        });
    });
}

/**
 * Initialise a per-site git repository if it does not exist yet.
 * Safe to call on an already-initialised repo — `git init` is idempotent.
 *
 * @param {string} repoDir  Absolute path to the site directory.
 * @param {string} siteName Site name, used in the initial commit message.
 */
async function initRepo(repoDir, siteName) {
    if (!await isGitAvailable()) return;
    const isNew = !existsSync(path.join(repoDir, '.git'));
    if (isNew) {
        await _gitExec(repoDir, ['-c', 'init.defaultBranch=main', 'init']);
        // Commit whatever files are already present (views.html, viewer.json, …).
        await _autoCommit(repoDir, `init: ${siteName}`);
    }
}

/**
 * Stage all changes in repoDir and create a timestamped auto-save commit.
 * Silently does nothing if there is nothing to commit.
 *
 * @param {string} repoDir
 * @param {string} siteName
 * @param {string} [message]  Override commit message (default: `save: <siteName> @ <ISO>`)
 */
async function autoCommit(repoDir, siteName, message) {
    if (!await isGitAvailable()) return;
    await _autoCommit(repoDir, message || `save: ${siteName} @ ${new Date().toISOString()}`);
}

/** Internal commit helper (already knows git is available). */
async function _autoCommit(repoDir, message) {
    try {
        await _gitExec(repoDir, ['add', '-A']);
        await _gitExec(repoDir, [...IDENTITY, 'commit', '-m', message]);
    } catch (err) {
        // "nothing to commit" / "nothing added" → not an error
        if (!/(nothing to commit|nothing added|no changes added)/.test(err.message)) {
            throw err;
        }
    }
}

// ── History operations ─────────────────────────────────────────────────────

/**
 * List all commits in the repo, most recent first.
 * @param {string} repoDir
 * @returns {Promise<Array<{sha:string, date:string, message:string}>>}
 */
async function listCommits(repoDir) {
    if (!await isGitAvailable()) return [];
    try {
        const SEP = '\x1f';
        const out = await _gitExec(repoDir, [
            'log', `--pretty=format:%H${SEP}%aI${SEP}%s`, '--'
        ]);
        if (!out) return [];
        return out.split('\n').map(line => {
            const parts = line.split(SEP);
            return {sha: parts[0].trim(), date: parts[1].trim(), message: parts[2] ? parts[2].trim() : ''};
        });
    } catch {
        return [];
    }
}

/**
 * Return the raw content of a file at a given commit.
 * @param {string} repoDir
 * @param {string} sha     Commit hash (7–40 hex chars).
 * @param {string} filepath Path relative to the repo root.
 * @returns {Promise<string>}
 */
async function showFile(repoDir, sha, filepath) {
    if (!await isGitAvailable()) throw new Error('git not available');
    return _gitExec(repoDir, ['show', `${sha}:${filepath}`]);
}

/**
 * Non-destructive restore: checks out the state from `sha` into the working
 * tree (without moving HEAD), then creates a new restore commit at the tip.
 * All existing history is preserved.
 *
 * @param {string} repoDir
 * @param {string} siteName  Used in the commit message.
 * @param {string} sha
 * @param {string} [label]   Human-readable label for the commit message.
 */
async function restoreVersion(repoDir, siteName, sha, label) {
    if (!await isGitAvailable()) throw new Error('git not available');
    // Restore working tree to sha without touching HEAD or the index.
    await _gitExec(repoDir, ['checkout', sha, '--', '.']);
    const msg = `restore: from "${label || sha.slice(0, 7)}" (${sha.slice(0, 7)})`;
    await _autoCommit(repoDir, msg);
}

/**
 * Destructive discard: saves the current HEAD as an archive branch, then
 * hard-resets to `sha`.  The discarded commits are kept and can be recovered.
 *
 * @param {string} repoDir
 * @param {string} sha
 */
async function discardToVersion(repoDir, sha) {
    if (!await isGitAvailable()) throw new Error('git not available');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await _gitExec(repoDir, ['branch', `archive/${timestamp}`]);
    await _gitExec(repoDir, ['reset', '--hard', sha]);
}

/**
 * List all archive/* branches (created by discardToVersion), newest first.
 * @param {string} repoDir
 * @returns {Promise<Array<{name:string, date:string, tipMessage:string}>>}
 */
async function listArchiveBranches(repoDir) {
    if (!await isGitAvailable()) return [];
    try {
        const SEP = '\x1f';
        const out = await _gitExec(repoDir, [
            'branch', '--list', 'archive/*',
            `--format=%(refname:short)${SEP}%(creatordate:iso)${SEP}%(subject)`
        ]);
        if (!out) return [];
        return out.split('\n')
            .filter(Boolean)
            .map(line => {
                const parts = line.split(SEP);
                return {name: parts[0].trim(), date: parts[1].trim(), tipMessage: parts[2] ? parts[2].trim() : ''};
            })
            .reverse();
    } catch {
        return [];
    }
}

/**
 * Permanently delete an archive/* branch.
 * Throws if the branch name is not an archive branch (safety guard).
 * @param {string} repoDir
 * @param {string} branchName   Must start with 'archive/'.
 */
async function deleteArchiveBranch(repoDir, branchName) {
    if (!await isGitAvailable()) throw new Error('git not available');
    if (!branchName.startsWith('archive/')) throw new Error('can only delete archive/ branches');
    await _gitExec(repoDir, ['branch', '-D', branchName]);
}

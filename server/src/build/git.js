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

module.exports = {initRepo, autoCommit, isGitAvailable};

#!/usr/bin/env node
'use strict';

/**
 * release.js — one-click version bump + tag.
 *
 * Usage:
 *   node scripts/release.js patch|minor|major     (npm run release / release:minor / release:major)
 *   node scripts/release.js 2.1.0                 (explicit version)
 *   node scripts/release.js patch --dry-run       (show what would happen, change nothing)
 *
 * Bumps root, server/ and www/ package.json (+ the version fields in their
 * package-lock.json) by editing the JSON directly — no npm involved — then
 * commits "chore(release): vX.Y.Z" and creates the vX.Y.Z tag.
 *
 * It deliberately does NOT push: pushing the v* tag triggers the Docker
 * release workflow (see docs/development.md §3). Push when you mean it:
 *   git push origin master vX.Y.Z
 */

const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

const ROOT = path.join(__dirname, '..');
const PACKAGES = ['.', 'server', 'www'];

const args = process.argv.slice(2).filter(a => a !== '--dry-run');
const dryRun = process.argv.includes('--dry-run');
const spec = args[0] || 'patch';

function fail(message) {
    console.error(`\n  ✖ ${message}\n`);
    process.exit(1);
}

function git(...argv) {
    return execFileSync('git', argv, {cwd: ROOT, encoding: 'utf8'}).trim();
}

// ── Determine the new version ────────────────────────────────────────────────

const rootPkgPath = path.join(ROOT, 'package.json');
const current = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8')).version;

let next;
if (/^\d+\.\d+\.\d+$/.test(spec)) {
    next = spec;
} else if (['patch', 'minor', 'major'].includes(spec)) {
    const [major, minor, patch] = current.split('.').map(Number);
    next = spec === 'major' ? `${major + 1}.0.0`
        : spec === 'minor' ? `${major}.${minor + 1}.0`
        : `${major}.${minor}.${patch + 1}`;
} else {
    fail(`Unknown argument "${spec}" — expected patch, minor, major or an explicit x.y.z version.`);
}

// ── Preconditions ────────────────────────────────────────────────────────────

if (git('status', '--porcelain') !== '') {
    fail('Working tree is not clean — commit or stash your changes first.');
}

if (git('tag', '-l', `v${next}`) !== '') {
    fail(`Tag v${next} already exists.`);
}

console.log(`\n  Release: ${current} → ${next}${dryRun ? '   (dry run — nothing will be written)' : ''}\n`);

// ── Bump package.json + package-lock.json in all three packages ─────────────

const touched = [];
for (const dir of PACKAGES) {
    for (const file of ['package.json', 'package-lock.json']) {
        const abs = path.join(ROOT, dir, file);
        if (!fs.existsSync(abs)) continue;
        const raw = fs.readFileSync(abs, 'utf8');
        const json = JSON.parse(raw);
        json.version = next;
        // The lockfile carries the version twice: top-level and packages[""].
        if (json.packages && json.packages['']) {
            json.packages[''].version = next;
        }
        // Preserve the file's indentation (root uses 2 spaces, server/www 4).
        const indent = /^(\s+)"/m.exec(raw)?.[1] ?? '    ';
        if (!dryRun) {
            fs.writeFileSync(abs, JSON.stringify(json, null, indent) + '\n');
        }
        touched.push(path.join(dir, file).replace(/\\/g, '/').replace(/^\.\//, ''));
        console.log(`  ✓ ${path.join(dir, file)}`);
    }
}

// ── Commit + tag ─────────────────────────────────────────────────────────────

if (dryRun) {
    console.log(`\n  Would commit "chore(release): v${next}" and tag v${next}.\n`);
    process.exit(0);
}

git('add', ...touched);
git('commit', '-m', `chore(release): v${next}`);
git('tag', `v${next}`);

console.log(`\n  ✓ Committed and tagged v${next}`);
console.log(`\n  To publish (triggers the Docker release workflow):`);
console.log(`    git push origin master v${next}\n`);

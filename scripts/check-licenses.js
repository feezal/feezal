#!/usr/bin/env node
'use strict';

/**
 * License gate (A21): verify that every production dependency in all
 * workspaces carries an allowlisted license. Walks package-lock.json
 * (v2/v3 "packages" map), skips dev/devOptional entries, and reads each
 * installed package's package.json license field. No dependencies.
 *
 * Exit code 1 if any production dependency has a license outside the
 * allowlist — extend ALLOWED deliberately, never silently.
 *
 * Usage: node scripts/check-licenses.js
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const workspaces = ['.', 'server', 'www'];

// Licenses compatible with distributing feezal (AGPL-3.0 core, MIT viewer/SDK).
const ALLOWED = new Set([
    'MIT', 'MIT-0', 'ISC', '0BSD',
    'BSD-2-Clause', 'BSD-3-Clause',
    'Apache-2.0',
    'MPL-2.0',
    'CC0-1.0', 'CC-BY-3.0', 'CC-BY-4.0',
    'OFL-1.1',        // SIL Open Font License — bundled webfonts (icon/theme packages)
    'Unlicense', 'BlueOak-1.0.0', 'WTFPL',
    'Python-2.0', 'Zlib', 'Artistic-2.0', 'W3C',
    'AGPL-3.0-only'   // feezal itself (workspace links in lockfiles)
]);

function licenseAllowed(expr) {
    if (!expr) return false;
    expr = expr.trim().replace(/^\(|\)$/g, '');
    // For OR expressions any allowed alternative suffices.
    if (/\bOR\b/.test(expr)) {
        return expr.split(/\s+OR\s+/).some(part => licenseAllowed(part));
    }
    // AND expressions require every part to be allowed.
    if (/\bAND\b/.test(expr)) {
        return expr.split(/\s+AND\s+/).every(part => licenseAllowed(part));
    }
    return ALLOWED.has(expr.trim());
}

function readLicense(pkgDir) {
    const pj = path.join(pkgDir, 'package.json');
    let json;
    try {
        json = JSON.parse(fs.readFileSync(pj, 'utf8'));
    } catch {
        return null; // not installed (e.g. skipped optional dep) — not a violation
    }
    let lic = json.license
        || (Array.isArray(json.licenses) && json.licenses.map(l => l.type || l).join(' OR '))
        || null;
    if (lic && typeof lic === 'object') lic = lic.type || null;
    return {name: json.name || path.basename(pkgDir), license: lic || 'UNKNOWN'};
}

let checked = 0;
const violations = [];

for (const ws of workspaces) {
    const lockPath = path.join(repoRoot, ws, 'package-lock.json');
    if (!fs.existsSync(lockPath)) {
        console.error(`warning: no package-lock.json in ${ws}/ — skipped`);
        continue;
    }
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const packages = lock.packages || {};
    for (const [key, entry] of Object.entries(packages)) {
        if (!key.includes('node_modules/')) continue;      // root + workspace links
        if (entry.dev || entry.devOptional) continue;       // production deps only
        if (entry.link) continue;                           // symlinked workspace package
        const info = readLicense(path.join(repoRoot, ws, key));
        if (!info) continue;
        checked++;
        // Own packages are covered by the repo licenses.
        if (info.name.startsWith('@feezal/')) continue;
        if (!licenseAllowed(info.license)) {
            violations.push(`${ws}/${key}: ${info.name} — ${info.license}`);
        }
    }
}

console.log(`license gate: ${checked} production dependencies checked`);
if (checked < 100) {
    console.error('license gate: FAILED — implausibly few packages found; are node_modules installed?');
    process.exit(1);
}
if (violations.length) {
    console.error('\nDISALLOWED LICENSES:');
    for (const v of violations) console.error('  ' + v);
    console.error('\nIf a license is genuinely acceptable, add it to ALLOWED in scripts/check-licenses.js.');
    process.exit(1);
}
console.log('license gate: OK — all licenses allowlisted');

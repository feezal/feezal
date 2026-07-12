'use strict';

/**
 * Package Manager backend (N4) — install / list / remove feezal add-on packages
 * of type `element` and `theme` (icon sets deferred).
 *
 * Install pipeline (blocking):
 *   1. validate the name against the feezal-<type>-* allowlist,
 *   2. `npm install <spec>` into a throwaway staging dir (--ignore-scripts),
 *   3. Vite-bundle the installed package's entry into a self-contained ESM
 *      (bare specifiers like `@feezal/feezal-element` / `lit` inlined), reusing
 *      the www toolchain the export feature already loads by path,
 *   4. write the bundle + a minimal package.json to <dataDir>/elements/<pkg>/,
 *      where discoverElements()/_scan() already looks and /user-elements serves.
 *
 * The browser can't resolve bare specifiers, so the on-install bundle is what
 * makes a raw npm element loadable at runtime.
 *
 * Element sets (N29 Phase A): a `feezal-elements-*` package carrying
 * `feezal: {type: 'bundle', elements: [...]}` has no code of its own — its
 * members are expanded from the same staging install: each listed element is
 * bundled and written to its own <dataDir>/elements/<member>/ dir (with the
 * set name recorded in `feezal.set`), plus a code-less marker dir for the set
 * itself so it appears in the installed list and can be updated/removed as a
 * unit. Removing the set removes exactly the members that record membership;
 * discovery skips the marker (the feezal-elements- dir name matches no
 * element/theme/icons prefix).
 *
 * Multi-element families (N29 Phase B): a `feezal-elements-*` package carrying
 * `feezal: {type: 'elements', elements: [<tag>, …]}` ships ONE bundle whose
 * entry defines every listed custom-element tag (shared family base class
 * bundled once). It installs exactly like a single element — one dir, one
 * index.js — with the tag manifest preserved in the written package.json so
 * discovery/palette/export know which tags it exposes. Remove/update treat it
 * as one unit; there are no member dirs.
 */

const fs   = require('fs');
const fsp  = fs.promises;
const path = require('path');
const os   = require('os');
const {execFile} = require('child_process');
const {pathToFileURL} = require('url');

const ELEMENTS_SUBDIR = 'elements';                 // <dataDir>/elements/
// 'feezal-elements-' (plural) marks an N29 element set. The prefixes are
// mutually exclusive — 'feezal-elements-x' has an 's' where 'feezal-element-'
// requires the dash — so match order is irrelevant.
const PREFIXES = {'feezal-elements-': 'bundle', 'feezal-element-': 'element', 'feezal-theme-': 'theme', 'feezal-icons-': 'icons'};
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** Bare package name (strip an optional @scope/). */
function bareName(pkg) {
    const s = String(pkg || '').trim();
    return s.startsWith('@') ? s.split('/').slice(1).join('/') : s;
}

/** feezal package type from the name, or null if it isn't a feezal add-on. */
function derivePkgType(pkg) {
    const bare = bareName(pkg);
    for (const [prefix, type] of Object.entries(PREFIXES)) {
        if (bare.startsWith(prefix)) return type;
    }
    return null;
}

/** Valid npm name (optionally scoped) that matches a feezal add-on prefix. */
function isAllowedPackage(pkg) {
    const s = String(pkg || '').trim();
    if (!/^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i.test(s)) return false;
    return derivePkgType(s) !== null;
}

/** Registry-search keyword for a type filter ('element' | 'theme' | 'icons' | 'bundle'). */
function typeKeyword(type) {
    if (type === 'theme') return 'feezal-theme';
    if (type === 'icons') return 'feezal-icons';
    if (type === 'bundle') return 'feezal-elements';
    return 'feezal-element';
}

/** On-disk install dir for a package (@scope/ becomes a nested dir). */
function pkgDir(dataDir, pkg) {
    const s = String(pkg).trim();
    const parts = s.startsWith('@') ? s.split('/') : [s];
    return path.join(dataDir, ELEMENTS_SUBDIR, ...parts);
}

// ── List / remove ────────────────────────────────────────────────────────────

async function _walk(dir, base, out) {
    let entries;
    try { entries = await fsp.readdir(dir, {withFileTypes: true}); } catch { return; }
    for (const e of entries) {
        if (!e.isDirectory()) continue;
        const abs = path.join(dir, e.name);
        if (e.name.startsWith('@')) { await _walk(abs, base, out); continue; }
        const pj = path.join(abs, 'package.json');
        if (!fs.existsSync(pj)) continue;
        try {
            const pkg = JSON.parse(await fsp.readFile(pj, 'utf8'));
            const name = pkg.name || path.relative(base, abs).split(path.sep).join('/');
            const type = (pkg.feezal && pkg.feezal.type) || derivePkgType(name) || 'element';
            const entry = {name, version: pkg.version || '0.0.0', type, pinned: !!(pkg.feezal && pkg.feezal.pinned)};
            // N29: members installed via a set record it; the UI groups by it.
            if (pkg.feezal && pkg.feezal.set) entry.set = pkg.feezal.set;
            out.push(entry);
        } catch { /* skip corrupt */ }
    }
}

/** Installed add-on packages (all types) under <dataDir>/elements/. */
async function listInstalled(dataDir) {
    const base = path.join(dataDir, ELEMENTS_SUBDIR);
    const out = [];
    await _walk(base, base, out);
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
}

async function _rmPkgDir(dataDir, pkg) {
    const base = path.join(dataDir, ELEMENTS_SUBDIR);
    const dir  = pkgDir(dataDir, pkg);
    if (dir !== base && !dir.startsWith(base + path.sep)) throw new Error('invalid path');
    await fsp.rm(dir, {recursive: true, force: true});
    // Prune a now-empty @scope dir.
    const parent = path.dirname(dir);
    if (parent !== base && path.basename(parent).startsWith('@')) {
        try { if ((await fsp.readdir(parent)).length === 0) await fsp.rmdir(parent); } catch { /* not empty */ }
    }
}

async function removePackage(dataDir, pkg) {
    if (!isAllowedPackage(pkg)) throw new Error('invalid package name');
    // N29: removing a set also removes the members that record membership of
    // exactly this set (a member installed individually, or claimed by a
    // different set, is left alone).
    try {
        const pj = JSON.parse(await fsp.readFile(path.join(pkgDir(dataDir, pkg), 'package.json'), 'utf8'));
        if (pj.feezal && pj.feezal.type === 'bundle' && Array.isArray(pj.feezal.elements)) {
            for (const member of pj.feezal.elements) {
                if (!isAllowedPackage(member) || derivePkgType(member) === 'bundle') continue;
                try {
                    const mPj = JSON.parse(await fsp.readFile(path.join(pkgDir(dataDir, member), 'package.json'), 'utf8'));
                    if (mPj.feezal && mPj.feezal.set === (pj.name || pkg)) await _rmPkgDir(dataDir, member);
                } catch { /* member not installed — nothing to remove */ }
            }
        }
    } catch { /* no manifest — plain package dir */ }
    await _rmPkgDir(dataDir, pkg);
}

// ── npm + bundle ─────────────────────────────────────────────────────────────

function _runNpm(args, cwd) {
    return new Promise((resolve, reject) => {
        execFile(NPM, args, {cwd, timeout: 180000, maxBuffer: 16 * 1024 * 1024, windowsHide: true},
            (err, stdout, stderr) => {
                if (err) { err.stdout = stdout; err.stderr = stderr; return reject(err); }
                resolve({stdout: stdout || '', stderr: stderr || ''});
            });
    });
}

/**
 * N23: copy a package's non-JS sidecar assets (fonts, SVGs, LICENSE/attribution
 * files) into the install dir, preserving relative paths, so they are served
 * from /user-elements/<pkg>/… next to the bundled entry. Icon packages
 * reference them via `new URL('./file', import.meta.url)` or url() in injected
 * CSS. JS/TS/source-map/markdown files and nested node_modules are skipped —
 * the bundle already contains the code.
 */
async function _copyAssets(srcDir, destDir) {
    const SKIP_DIRS = new Set(['node_modules', '.git']);
    const SKIP_FILE = /\.(js|mjs|cjs|ts|map|md)$/i;
    let copied = 0;
    async function walk(rel) {
        const abs = path.join(srcDir, rel);
        const entries = await fsp.readdir(abs, {withFileTypes: true});
        for (const entry of entries) {
            const entryRel = path.join(rel, entry.name);
            if (entry.isDirectory()) {
                if (!SKIP_DIRS.has(entry.name)) await walk(entryRel);
                continue;
            }
            if (SKIP_FILE.test(entry.name) || entry.name === 'package.json') continue;
            await fsp.mkdir(path.dirname(path.join(destDir, entryRel)), {recursive: true});
            await fsp.copyFile(path.join(srcDir, entryRel), path.join(destDir, entryRel));
            copied++;
        }
    }
    await walk('.');
    return copied;
}

/** Vite-bundle `entryAbs` (resolving deps from `root`) into a single ESM string. */
async function _bundle(wwwDir, entryAbs, root, logger) {
    const vitePath = path.join(wwwDir, 'node_modules', 'vite', 'dist', 'node', 'index.js');
    const {build: viteBuild} = await import(pathToFileURL(vitePath).href);
    const result = await viteBuild({
        root,
        logLevel: 'silent',
        configFile: false,
        build: {
            write: false,
            minify: 'esbuild',
            reportCompressedSize: false,
            rollupOptions: {
                input: entryAbs,
                output: {format: 'es', entryFileNames: 'index.js', inlineDynamicImports: true},
                onwarn(w) { if (w.code !== 'CIRCULAR_DEPENDENCY') logger.debug?.(`install: rollup ${w.code}: ${w.message}`); },
            },
        },
    });
    const outputs = Array.isArray(result) ? result : [result];
    const chunk = outputs[0].output.find(c => c.type === 'chunk' && c.isEntry);
    if (!chunk) throw new Error('bundling produced no entry chunk');
    return chunk.code;
}

/**
 * N29 Phase A: expand an element set. Every member listed in
 * `feezal.elements` is bundled from the staging install and written to its
 * own <dataDir>/elements/<member>/ dir with `feezal.set` recording the
 * membership; the set itself gets a code-less marker dir (its package.json
 * carries the bundle manifest) so it shows up in the installed list and can
 * be updated / removed as a unit.
 */
async function _installBundleMembers({staging, wwwDir, dataDir, pkg, pj, logger}) {
    const members = (pj.feezal && Array.isArray(pj.feezal.elements)) ? pj.feezal.elements : [];
    if (!members.length) {
        throw new Error(`"${pkg}" is a bundle but its feezal.elements list is empty or missing`);
    }
    for (const member of members) {
        if (!isAllowedPackage(member) || derivePkgType(member) !== 'element') {
            throw new Error(`bundle member "${member}" is not a feezal-element-* package`);
        }
    }

    const setName = pj.name || pkg;
    const installed = [];
    for (const member of members) {
        const memberDir = path.join(staging, 'node_modules', ...member.split('/'));
        const memberPj  = JSON.parse(await fsp.readFile(path.join(memberDir, 'package.json'), 'utf8'));
        const code = await _bundle(wwwDir, path.join(memberDir, memberPj.main || 'index.js'), staging, logger);

        const destDir = pkgDir(dataDir, member);
        await fsp.rm(destDir, {recursive: true, force: true});
        await fsp.mkdir(destDir, {recursive: true});
        await fsp.writeFile(path.join(destDir, 'index.js'), code, 'utf8');
        await fsp.writeFile(path.join(destDir, 'package.json'), JSON.stringify({
            name: memberPj.name || member, version: memberPj.version || '0.0.0',
            main: 'index.js', feezal: {type: 'element', set: setName},
        }, null, 2));
        installed.push({name: memberPj.name || member, version: memberPj.version || '0.0.0'});
        logger.info?.(`install: bundled set member ${member}@${memberPj.version}`);
    }

    // Marker dir: no index.js — discoverElements' prefix filter never matches
    // feezal-elements-* dirs, so nothing tries to serve it.
    const destDir = pkgDir(dataDir, pkg);
    await fsp.rm(destDir, {recursive: true, force: true});
    await fsp.mkdir(destDir, {recursive: true});
    await fsp.writeFile(path.join(destDir, 'package.json'), JSON.stringify({
        name: setName, version: pj.version || '0.0.0',
        feezal: {type: 'bundle', elements: members},
    }, null, 2));

    return {ok: true, name: setName, version: pj.version || '0.0.0', type: 'bundle', members: installed};
}

/**
 * Install one package end-to-end.
 * @returns {Promise<{ok, name, version, type, stdout, stderr}>}
 */
async function installPackage({wwwDir, dataDir, pkg, version, logger = console}) {
    if (!isAllowedPackage(pkg)) {
        throw new Error(`"${pkg}" is not an installable feezal package (expected feezal-element-*, feezal-elements-*, feezal-theme-* or feezal-icons-*)`);
    }
    const type = derivePkgType(pkg);
    const spec = version ? `${pkg}@${version}` : pkg;
    const staging = await fsp.mkdtemp(path.join(os.tmpdir(), 'feezal-pkg-'));
    let stdout = '', stderr = '';
    try {
        await fsp.writeFile(path.join(staging, 'package.json'),
            JSON.stringify({name: 'feezal-pkg-staging', private: true}));

        // --prefer-online: revalidate npm's packument cache — right after a
        // publish, the cached "latest" (5-minute registry TTL) can silently
        // resolve to the previous version.
        logger.info?.(`install: npm install ${spec} (staging: ${staging})`);
        const res = await _runNpm(['install', spec, '--ignore-scripts', '--no-audit', '--no-fund', '--no-save', '--prefer-online'], staging);
        stdout += res.stdout; stderr += res.stderr;

        const installedDir = path.join(staging, 'node_modules', ...String(pkg).split('/'));
        const pj = JSON.parse(await fsp.readFile(path.join(installedDir, 'package.json'), 'utf8'));
        logger.info?.(`install: resolved ${pj.name || pkg}@${pj.version || '0.0.0'}`);

        // N29: the plural feezal-elements- prefix covers both set shapes;
        // the manifest's feezal.type decides which pipeline applies.
        // Phase B: a multi-element family ships one bundle defining all its
        // tags — install it like a single element, preserving the tag
        // manifest so discovery/palette/export know what it exposes.
        const isFamily = pj.feezal && pj.feezal.type === 'elements';
        if (isFamily) {
            const tags = Array.isArray(pj.feezal.elements) ? pj.feezal.elements : [];
            if (!tags.length) {
                throw new Error(`"${pkg}" is a multi-element package but its feezal.elements tag list is empty or missing`);
            }
            for (const tag of tags) {
                if (!/^feezal-element-[a-z0-9][\w-]*$/.test(String(tag))) {
                    throw new Error(`"${pkg}" declares an invalid element tag "${tag}" (expected feezal-element-<category>-<name>)`);
                }
            }
        } else if (type === 'bundle' || (pj.feezal && pj.feezal.type === 'bundle')) {
            // Phase A: a bundle package has no code — expand its members from
            // the same staging install (they are dependencies, so npm already
            // fetched them) and write a code-less marker dir for the set itself.
            const result = await _installBundleMembers({staging, wwwDir, dataDir, pkg, pj, logger});
            return {...result, stdout, stderr};
        }

        const entryAbs = path.join(installedDir, pj.main || 'index.js');

        const code = await _bundle(wwwDir, entryAbs, staging, logger);

        const destDir = pkgDir(dataDir, pkg);
        await fsp.rm(destDir, {recursive: true, force: true});
        await fsp.mkdir(destDir, {recursive: true});
        await fsp.writeFile(path.join(destDir, 'index.js'), code, 'utf8');
        // N23: icon sets ship font/SVG asset files (and license/attribution
        // files) alongside the JS entry — copy them next to the bundle.
        if (type === 'icons') {
            const copied = await _copyAssets(installedDir, destDir);
            logger.debug?.(`install: copied ${copied} sidecar asset file(s) for ${pkg}`);
        }
        // Phase B family: the written manifest keeps the declared tag list.
        const feezalMeta = isFamily ? {type: 'elements', elements: pj.feezal.elements} : {type};
        await fsp.writeFile(path.join(destDir, 'package.json'),
            JSON.stringify({name: pj.name || pkg, version: pj.version || '0.0.0', main: 'index.js', feezal: feezalMeta}, null, 2));

        return {ok: true, name: pj.name || pkg, version: pj.version || '0.0.0', type: feezalMeta.type, stdout, stderr};
    } catch (err) {
        err.stdout = stdout + (err.stdout || '');
        err.stderr = stderr + (err.stderr || '');
        throw err;
    } finally {
        await fsp.rm(staging, {recursive: true, force: true}).catch(() => {});
    }
}

module.exports = {
    // pure (tested)
    bareName, derivePkgType, isAllowedPackage, typeKeyword, pkgDir,
    // fs ops
    listInstalled, removePackage, installPackage,
    // exposed for a bundling smoke test / sidecar-asset tests
    bundleEntry: _bundle,
    copyAssets: _copyAssets,
    ELEMENTS_SUBDIR,
};

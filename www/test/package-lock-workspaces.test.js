/**
 * The workspace lockfile must not accumulate entries for packages that no
 * longer exist.
 *
 * `npm install` never prunes a renamed workspace: the old key survives in
 * package-lock.json as `"extraneous": true`. That stays invisible — until one
 * of those ghosts declares a dependency on ANOTHER package that later gets
 * renamed. The edge then dangles, and `npm sbom --package-lock-only` (the
 * release workflow's SBOM step) aborts with ESBOMPROBLEMS, which is a broken
 * *release build* long after the rename that caused it.
 *
 * That is exactly how it happened: `metro-occupancy` → `metro-motion` (E138)
 * left a ghost depending on `metro-tile`; renaming `metro-tile` →
 * `metro-button` (E152) five items later broke the Docker release. Two more
 * ghosts (`glass-occupancy`, `glass-shutter`) were sitting there too.
 *
 * So: fail here, in a two-second unit test, instead of in the release job.
 * Fix by removing the stale `packages/@feezal/<name>` keys from
 * www/package-lock.json (they carry no resolution info worth keeping) and
 * re-running `npm install`.
 */
import {describe, it, expect} from 'vitest';
import {readFileSync, readdirSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const wwwDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(readFileSync(join(wwwDir, 'package-lock.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(wwwDir, 'package.json'), 'utf8'));
const onDisk = new Set(readdirSync(join(wwwDir, 'packages', '@feezal')));

const workspaceKeys = Object.keys(lock.packages)
    .filter(k => k.startsWith('packages/@feezal/'));

describe('www/package-lock.json workspace hygiene', () => {
    it('has a workspace entry for every package on disk', () => {
        const inLock = new Set(workspaceKeys.map(k => k.split('/').pop()));
        expect([...onDisk].filter(name => !inLock.has(name))).toEqual([]);
    });

    it('has no entry for a package that no longer exists', () => {
        const stale = workspaceKeys.filter(k => !onDisk.has(k.split('/').pop()));
        expect(stale, 'stale lockfile entries — see this file\'s header').toEqual([]);
    });

    it('marks nothing extraneous', () => {
        const extraneous = workspaceKeys.filter(k => lock.packages[k].extraneous);
        expect(extraneous).toEqual([]);
    });

    it('resolves every @feezal dependency a workspace declares', () => {
        const known = new Set([...onDisk].map(n => '@feezal/' + n));
        const dangling = [];
        for (const key of workspaceKeys) {
            for (const dep of Object.keys(lock.packages[key].dependencies || {})) {
                if (dep.startsWith('@feezal/') && !known.has(dep)) dangling.push(`${key} -> ${dep}`);
            }
        }
        // This is the edge that actually breaks `npm sbom`.
        expect(dangling).toEqual([]);
    });

    it('keeps every @feezal dependency of www/package.json installable', () => {
        const declared = Object.keys(pkg.dependencies).filter(d => d.startsWith('@feezal/'));
        const missing = declared.filter(d => !onDisk.has(d.replace('@feezal/', '')));
        expect(missing, 'declared in package.json but not in packages/@feezal').toEqual([]);
    });
});

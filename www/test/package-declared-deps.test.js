/**
 * A32 — a per-element npm dependency must live in the element package, not be
 * hoisted to the app's www/package.json.
 *
 * @feezal/* element packages are published and versioned (scripts/release.js).
 * A dependency that only ONE (or a few) elements import must be declared by
 * that package, so a standalone `npm install @feezal/feezal-element-x` resolves
 * — it must not rely on the app happening to hoist the widget to the shared
 * node_modules. That was the bug: three `@polymer/paper-*` widgets used only by
 * `feezal-element-paper-dropdown` sat in www/package.json.
 *
 * This guard is a RATCHET on the anti-pattern: a third-party dependency in
 * www/package.json that is imported by element packages but NOT by the app
 * itself (src/ or editor/) is misplaced. The pre-existing offenders are
 * grandfathered explicitly (a documented follow-up — moving design-system
 * toolkits into their families is a larger, separate cleanup); anything NEW
 * fails here, at the commit that introduced it.
 *
 * (Sibling of package-lock-workspaces.test.js — same "fail in a 2s unit test,
 * not in the release job" spirit.)
 */
import {describe, it, expect} from 'vitest';
import {readFileSync, readdirSync, statSync, existsSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const wwwDir = join(dirname(fileURLToPath(import.meta.url)), '..');

// Pre-existing element-only deps still hoisted to www/package.json. Each is a
// design-system toolkit / heavy widget used only by its element family; moving
// them into those packages is A32's principle applied more widely — tracked as
// a follow-up. NOTHING may be added here without the same follow-up intent.
const GRANDFATHERED = new Set([
    '@material/web',            // 17 circle/material family elements
    '@carbon/web-components',   // 6 carbon family elements
    'leaflet',                  // the map element
    'lottie-web',               // basic-lottie / system-splash / feezal-lottie
]);

function walk(dir, out = []) {
    if (!existsSync(dir)) return out;
    for (const e of readdirSync(dir)) {
        if (e === 'node_modules' || e === 'dist' || e === '.git') continue;
        const p = join(dir, e);
        const st = statSync(p);
        if (st.isDirectory()) walk(p, out);
        else if (e.endsWith('.js')) out.push(p);
    }
    return out;
}

function pkgOf(spec) {
    if (spec.startsWith('.') || spec.startsWith('/')) return null;
    const parts = spec.split('/');
    return spec.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
}

function importedPackages(files) {
    const re = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
    const names = new Set();
    for (const f of files) {
        for (const m of readFileSync(f, 'utf8').matchAll(re)) {
            const p = pkgOf(m[1] || m[2] || m[3]);
            if (p) names.add(p);
        }
    }
    return names;
}

const pkg = JSON.parse(readFileSync(join(wwwDir, 'package.json'), 'utf8'));
const thirdParty = Object.keys(pkg.dependencies || {}).filter(d => !d.startsWith('@feezal/'));

const appImports = importedPackages([...walk(join(wwwDir, 'src')), ...walk(join(wwwDir, 'editor'))]);
const elementImports = importedPackages(walk(join(wwwDir, 'packages', '@feezal')));

describe('A32 — no element-only dependency is hoisted to www/package.json', () => {
    it('every app dependency imported by elements is also used by the app (else it belongs in the element package)', () => {
        const misplaced = thirdParty.filter(d =>
            elementImports.has(d) && !appImports.has(d) && !GRANDFATHERED.has(d));
        expect(misplaced,
            'these deps are imported only by @feezal element packages — declare them in the element package(s) and remove from www/package.json')
            .toEqual([]);
    });

    it('the grandfather list is honest — every entry is still a hoisted element-only dep (prune it when moved)', () => {
        const stale = [...GRANDFATHERED].filter(d =>
            !(thirdParty.includes(d) && elementImports.has(d) && !appImports.has(d)));
        expect(stale, 'grandfathered deps that are no longer hoisted/element-only — remove them from GRANDFATHERED')
            .toEqual([]);
    });
});

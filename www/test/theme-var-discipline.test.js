/**
 * Theme-variable discipline ratchet (07/2026, by user decree):
 *
 *   Colour defaults reference ONLY the canonical theme variables, BARE.
 *   No `--sl-color-*` anywhere in dashboard-facing code, and no fallback of
 *   any kind after a canonical variable — `var(--primary-color)` is the whole
 *   value, never `var(--primary-color, var(--sl-color-primary-600, #1ba1e2))`.
 *
 * The default look is supplied exactly once, by `src/feezal-base-theme.js`
 * (a `:root` block both bundles load), not by per-element fallbacks — three
 * copies of every default colour is how the old chains drifted apart.
 *
 * Scope: every element/controller package under packages/@feezal (theme
 * packages excluded — they DEFINE the variables) and the viewer-facing src
 * modules. Editor chrome (sidebars, app shell) is Shoelace UI and keeps its
 * `--sl-*` tokens; the one Shoelace surface inside element packages — the N6
 * custom-inspector components — may keep the two dark-mode plumbing vars
 * `--sl-input-color` / `--sl-input-label-color`, nothing else.
 */
import {describe, it, expect} from 'vitest';
import {readdirSync, readFileSync, statSync, existsSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join, relative} from 'path';

const www = join(dirname(fileURLToPath(import.meta.url)), '..');

const CANONICAL = [
    'primary-background-color', 'secondary-background-color',
    'primary-text-color', 'secondary-text-color', 'disabled-text-color',
    'divider-color', 'primary-color', 'accent-color', 'error-color',
    'warning-color', 'success-color', 'info-color', 'card-background-color',
];

const VIEWER_SRC = [
    'src/feezal-base-theme.js', 'src/feezal-site.js', 'src/feezal-view.js',
    'src/feezal-component.js', 'src/feezal-app-viewer.js',
    'src/feezal-history-bar.js', 'src/feezal-connection.js',
    'src/feezal-connection-overlay.js', 'src/feezal-presence.js',
    'src/feezal-icon.js',
];

function* files() {
    const base = join(www, 'packages', '@feezal');
    for (const pkg of readdirSync(base)) {
        if (pkg.startsWith('feezal-theme-')) continue;
        const dir = join(base, pkg);
        if (!statSync(dir).isDirectory()) continue;
        const walk = function* (d) {
            for (const entry of readdirSync(d)) {
                if (entry === 'node_modules') continue;
                const p = join(d, entry);
                if (statSync(p).isDirectory()) yield* walk(p);
                else if (entry.endsWith('.js')) yield p;
            }
        };
        yield* walk(dir);
    }
    for (const rel of VIEWER_SRC) {
        const p = join(www, rel);
        if (existsSync(p)) yield p;
    }
}

const offendersOf = pattern => {
    const out = [];
    for (const path of files()) {
        const src = readFileSync(path, 'utf8');
        const lines = src.split('\n');
        lines.forEach((line, i) => {
            if (pattern.test(line)) out.push(`${relative(www, path)}:${i + 1}  ${line.trim().slice(0, 100)}`);
            pattern.lastIndex = 0;
        });
    }
    return out;
};

describe('theme-variable discipline', () => {
    it('no --sl-color-* in dashboard-facing code (map to the canonical vars)', () => {
        expect(offendersOf(/--sl-color-/)).toEqual([]);
    });

    it('no --sl-* at all beyond the two N6 dark-mode plumbing vars', () => {
        expect(offendersOf(/--sl-(?!input-color|input-label-color)[\w-]+/)).toEqual([]);
    });

    it('canonical theme vars are referenced BARE — never with a fallback', () => {
        const pattern = new RegExp(String.raw`var\(\s*--(?:${CANONICAL.join('|')})\s*,`);
        expect(offendersOf(pattern)).toEqual([]);
    });

    it('the base theme defines every canonical variable exactly once', () => {
        const src = readFileSync(join(www, 'src', 'feezal-base-theme.js'), 'utf8');
        for (const name of CANONICAL) {
            const definitions = src.match(new RegExp(`--${name}:`, 'g')) || [];
            expect(definitions.length, `--${name}`).toBe(1);
        }
    });
});

/**
 * A25 — privacy regression: no third-party CDN/host may creep back into the
 * shipped code. Scans the source trees (and the built dist, when present)
 * for forbidden hosts; the explicit allowlist below is the complete set of
 * sanctioned outbound references — extend it CONSCIOUSLY or not at all.
 */
import {describe, it, expect} from 'vitest';
import {readdirSync, readFileSync, statSync, existsSync} from 'fs';
import {join, relative} from 'path';
import {fileURLToPath} from 'url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

// Hosts that must never appear in feezal's own code or build output.
const FORBIDDEN = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn.jsdelivr.net',
    'unpkg.com',
    'cdnjs.cloudflare.com',
];

// Sanctioned outbound references (file path substring → hosts allowed there).
// Everything here is either user-triggered, env-gated or documented:
//   - api.js: npm registry — package search (user action) + update check
//     (opt-in ?checkUpdates=1 behind an explicit button)
//   - elements.js: icon codepoints refresh — env-gated (FEEZAL_FETCH_ICON_CODEPOINTS)
//   - providers.js: AI assistant endpoints — user-configured feature
//   - material-map: OSM tile default — documented in the element help text
const ALLOWED = [
    {file: 'server/src/routes/api.js', hosts: ['registry.npmjs.org']},
    {file: 'server/src/build/elements.js', hosts: ['raw.githubusercontent.com']},
    {file: 'server/src/ai/providers.js', hosts: ['api.anthropic.com', 'api.openai.com']},
    {file: 'feezal-element-material-map', hosts: ['tile.openstreetmap.org', 'openstreetmap.org']},
    // UI text describing the user-configured endpoints / user-triggered action
    // — display strings, not requests.
    {file: 'www/src/feezal-sidebar-editor.js', hosts: ['api.anthropic.com', 'api.openai.com']},
    {file: 'www/src/feezal-sidebar-packages.js', hosts: ['registry.npmjs.org']},
];

const SCAN_DIRS = ['www/src', 'www/editor', 'www/viewer-src', 'www/packages', 'server/src'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);
const EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.json']);

function* walk(dir) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
            if (!SKIP_DIRS.has(entry)) yield* walk(full);
        } else if (EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
            yield full;
        }
    }
}

function scanTree(dirs, hosts) {
    const hits = [];
    for (const dir of dirs) {
        const abs = join(ROOT, dir);
        if (!existsSync(abs)) continue;
        for (const file of walk(abs)) {
            const rel = relative(ROOT, file).replace(/\\/g, '/');
            const text = readFileSync(file, 'utf8');
            for (const host of hosts) {
                if (!text.includes(host)) continue;
                const allowed = ALLOWED.some(a => rel.includes(a.file) && a.hosts.includes(host));
                if (!allowed) hits.push(`${rel}: ${host}`);
            }
        }
    }
    return hits;
}

describe('A25 — no third-party hosts in shipped code', () => {
    it('source trees are free of CDN/font hosts', () => {
        expect(scanTree(SCAN_DIRS, FORBIDDEN)).toEqual([]);
    });

    it('outbound hosts appear ONLY in their sanctioned files', () => {
        const outbound = ['registry.npmjs.org', 'raw.githubusercontent.com', 'api.anthropic.com', 'api.openai.com'];
        expect(scanTree(SCAN_DIRS, outbound)).toEqual([]);
    });

    it('the built editor/viewer output is free of CDN/font hosts (skipped without a build)', () => {
        const dist = join(ROOT, 'www', 'dist');
        if (!existsSync(dist)) return;   // no build in this environment — source scan above still guards
        const hits = [];
        const check = (file) => {
            const text = readFileSync(file, 'utf8');
            for (const host of FORBIDDEN) {
                if (text.includes(host)) hits.push(`${relative(ROOT, file)}: ${host}`);
            }
        };
        check(join(dist, 'editor', 'index.html'));
        check(join(dist, 'viewer-bundle.js'));
        expect(hits).toEqual([]);
    });

    it("B51 — the CSP grants data: on connect-src (Shoelace SYSTEM icons are fetch()'d data: URIs; '*' does not match schemes)", () => {
        const src = readFileSync(join(ROOT, 'server', 'src', 'app.js'), 'utf8');
        expect(src).toContain("'connect-src * data:'");
        expect(src).toContain("font-src 'self' data:");
    });

    it('the vendored fonts are present (self-hosting is not aspirational)', () => {
        const fonts = join(ROOT, 'www', 'public', 'fonts');
        const files = readdirSync(fonts);
        expect(files).toContain('fonts.css');
        expect(files).toContain('material-icons.woff2');
        expect(files.some(f => f.startsWith('roboto-') && f.endsWith('.woff2'))).toBe(true);
        // fonts.css must reference only local paths.
        const css = readFileSync(join(fonts, 'fonts.css'), 'utf8');
        expect(css).not.toMatch(/https?:\/\//);
    });
});

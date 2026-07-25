/**
 * B75 — user-facing strings must not leak internal roadmap IDs (E##/N##/B##/
 * U##/A##). They belong in code comments / commits / the roadmap, not in help
 * tooltips, labels, placeholders or element descriptions shown in the editor.
 *
 * This guard scans element descriptors (www/packages/@feezal) and the editor
 * bundle (www/src) for `help|label|placeholder|description: '…'` string values
 * that contain a roadmap-ID token, with a small allowlist for real tokens that
 * happen to share the shape (chemistry / paper sizes / units).
 */
import {describe, it, expect} from 'vitest';
import {readFileSync, readdirSync, statSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');   // www/

// Roadmap IDs: one of the roadmap section prefixes + 1–3 digits.
const ID_RE = /\b([ENBUA]\d{1,3})\b/;
// Real tokens that match the shape but are NOT roadmap IDs.
const ALLOW = new Set(['A4', 'A3', 'A5', 'B5', 'B4', 'N2', 'O2', 'B12', 'U2', 'E5', 'E10', 'E85']);

// user-facing descriptor fields; matches a single-quoted string value on one line.
const FIELD_RE = /\b(?:help|label|placeholder|description)\s*:\s*'((?:\\.|[^'])*)'/g;

function walk(dir, out = []) {
    let entries;
    try { entries = readdirSync(dir); } catch { return out; }
    for (const name of entries) {
        if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) walk(p, out);
        else if (name.endsWith('.js') && !name.endsWith('.test.js')) out.push(p);
    }
    return out;
}

describe('B75 — no roadmap IDs in user-facing strings', () => {
    it('finds no leaked roadmap ID in help/label/placeholder/description', () => {
        const files = [
            ...walk(join(ROOT, 'packages', '@feezal')),
            ...walk(join(ROOT, 'src')),
        ];
        const offenders = [];
        for (const file of files) {
            const txt = readFileSync(file, 'utf8');
            let m;
            FIELD_RE.lastIndex = 0;
            while ((m = FIELD_RE.exec(txt))) {
                const val = m[1];
                const hit = val.match(ID_RE);
                if (hit && !ALLOW.has(hit[1])) {
                    offenders.push(`${file.slice(ROOT.length + 1)} :: ${hit[1]} :: "${val.slice(0, 60)}"`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});

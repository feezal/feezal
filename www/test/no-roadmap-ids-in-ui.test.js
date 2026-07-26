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

// B78 — the descriptor scan above has a blind spot: text written straight into
// a lit `html``` template renders to the user without ever being a `help:`
// value. Three hint blocks and a title= tooltip leaked that way after B75.
//
// Catching it precisely is the trick — `E5`, `B12` etc. legitimately appear in
// markup as class names, hex colours and so on. What actually leaked has a
// narrow shape: an ID immediately followed by a COLON, at the start of a line
// of rendered text or right after `title="`. That is what this matches, so the
// guard stays quiet about incidental look-alikes.
//
// Explicitly NOT matched: `// N37:` line comments, `/* … */` blocks and
// `<!-- U53: … -->` HTML comments. Referencing the roadmap there is correct —
// the rule is about what users see, not what maintainers read.
const TEMPLATE_ID_RE = /(?:^\s*|title="\s*|>\s*)([ENBUA]\d{1,3}):\s/gm;
const LINE_COMMENT_RE = /^\s*(?:\/\/|\*|\/\*|<!--)/;

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

    // B78: the same rule, for text rendered straight out of an html`` template.
    it('finds no leaked roadmap ID in rendered template text or title tooltips', () => {
        const offenders = [];
        for (const file of walk(join(ROOT, 'src'))) {
            const txt = readFileSync(file, 'utf8');
            const lines = txt.split('\n');
            TEMPLATE_ID_RE.lastIndex = 0;
            let m;
            while ((m = TEMPLATE_ID_RE.exec(txt))) {
                if (ALLOW.has(m[1])) continue;
                // Which line did this land on? Comments are legitimate.
                // Locate by the ID token itself: the match starts at the line
                // BREAK for the `^\s*` alternative, which would name the line
                // above and send the reader to the wrong place.
                const at = m.index + m[0].indexOf(m[1]);
                const line = lines[txt.slice(0, at).split('\n').length - 1] ?? '';
                if (LINE_COMMENT_RE.test(line)) continue;
                offenders.push(`${file.slice(ROOT.length + 1)} :: ${m[1]} :: "${line.trim().slice(0, 60)}"`);
            }
        }
        expect(offenders).toEqual([]);
    });

    // The guard is only worth having if it actually fires — pin that, so a
    // future refactor of the regexes cannot quietly turn it into a no-op.
    it('the template scan really catches a leak', () => {
        const sample = [
            '            <div class="pwa-hint">',
            '                N37: hidden views unsubscribe their MQTT topics.',
            '            </div>',
            '            <span title="U49: dot-path into the message">?</span>',
            '            // N37: this comment is fine and must NOT be flagged',
            '            <!-- U53: nor this HTML comment -->',
            '            <div class="E5-legacy">A4: paper size</div>',
        ].join('\n');

        const hits = [];
        const lines = sample.split('\n');
        TEMPLATE_ID_RE.lastIndex = 0;
        let m;
        while ((m = TEMPLATE_ID_RE.exec(sample))) {
            const at = m.index + m[0].indexOf(m[1]);
            const line = lines[sample.slice(0, at).split('\n').length - 1] ?? '';
            if (ALLOW.has(m[1]) || LINE_COMMENT_RE.test(line)) continue;
            hits.push(m[1]);
        }
        expect(hits).toEqual(['N37', 'U49']);   // the two real leaks, nothing else
    });
});

/**
 * N41 ratchet — the availability attribute block comes from the shared
 * fragment, not from a local copy.
 *
 * That 4-line descriptor set was pasted into 57 element files and its help text
 * drifted into eight wordings for the same four knobs. Users read those
 * strings, and which wording they got depended on which family the element
 * happened to belong to. `availabilityAttributes()` is now the source; this
 * fails CI when a new element hand-rolls the block again.
 */
import {describe, it, expect} from 'vitest';
import {readFileSync, readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const PKGS = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', '@feezal');

/**
 * Files still carrying a local block, each for a reason the sweep could not
 * resolve mechanically — they are NOT "not done yet in general", they are
 * individually blocked:
 *
 *  - `partial`  the element declares only 3 of the 4 knobs; adopting the
 *               fragment would ADD `message-property-availability`, which is a
 *               behaviour change, not a refactor;
 *  - `split`    the descriptors are not contiguous (interleaved with
 *               element-specific attributes), so the block cannot be swapped
 *               without reordering the inspector;
 *  - `advanced` a descriptor carries a per-file `advanced` flag the fragment
 *               does not model.
 *
 * Converting one and deleting its line is always welcome — as long as the
 * before/after attribute set is identical.
 */
const LOCAL_BY_DESIGN = new Map([
    ['feezal-controller-multivalue.js', 'partial'],
    ['feezal-element-circle-climate.js', 'split'],
    ['feezal-element-circle-cover.js', 'split'],
    ['feezal-element-circle-loadpoint.js', 'partial'],
    ['feezal-element-circle-meter.js', 'partial'],
    ['feezal-element-circle-wled.js', 'split'],
    ['feezal-element-eink-wled.js', 'split'],
    ['feezal-element-glass-climate.js', 'advanced'],
    ['feezal-element-glass-gauge.js', 'partial'],
    ['feezal-element-glass-loadpoint.js', 'partial'],
    ['feezal-element-glass-meter.js', 'partial'],
    ['feezal-element-glass-value.js', 'partial'],
    ['feezal-element-glass-wled.js', 'split'],
    ['feezal-element-metro-climate.js', 'advanced'],
    ['feezal-element-metro-cover.js', 'split'],
    ['feezal-element-metro-gauge.js', 'partial'],
    ['feezal-element-metro-loadpoint.js', 'partial'],
    ['feezal-element-metro-meter.js', 'partial'],
    ['feezal-element-metro-value.js', 'partial'],
    ['feezal-element-metro-wled.js', 'split'],
    // the fragment itself declares the canonical descriptors
    ['feezal-discovery-fragments.js', 'source'],
]);

/** Every element source file under packages/@feezal. */
function sourceFiles() {
    const out = [];
    for (const pkg of readdirSync(PKGS)) {
        let files;
        try { files = readdirSync(join(PKGS, pkg)); } catch { continue; }
        for (const file of files) {
            if (file.endsWith('.js')) out.push([file, join(PKGS, pkg, file)]);
        }
    }
    return out;
}

describe('availability fragment adoption (N41)', () => {
    const files = sourceFiles();

    it('scans a realistic number of element files', () => {
        // A ratchet that silently stops finding anything is worse than none.
        expect(files.length).toBeGreaterThan(50);
    });

    it('no NEW element hand-rolls the availability descriptor block', () => {
        const local = files
            .filter(([name]) => !LOCAL_BY_DESIGN.has(name))
            .filter(([, path]) => readFileSync(path, 'utf8').includes("name: 'subscribe-availability'"))
            .map(([name]) => name);
        expect(local, 'These declare `subscribe-availability` locally. Spread ' +
            '`availabilityAttributes({...})` from @feezal/feezal-element/feezal-discovery-fragments.js ' +
            'instead, or add the file to LOCAL_BY_DESIGN with the reason it cannot adopt.').toEqual([]);
    });

    it('the allowlist has no stale entries', () => {
        const stale = [...LOCAL_BY_DESIGN.keys()].filter(name => {
            const hit = files.find(([f]) => f === name);
            return !hit || !readFileSync(hit[1], 'utf8').includes("name: 'subscribe-availability'");
        });
        expect(stale, 'these adopted the fragment (or vanished) — drop them from LOCAL_BY_DESIGN')
            .toEqual([]);
    });

    it('the adopters really do use the fragment', () => {
        const adopters = files.filter(([, path]) =>
            readFileSync(path, 'utf8').includes('availabilityAttributes('));
        // 37 converted in the sweep, plus the fragment module itself.
        expect(adopters.length).toBeGreaterThanOrEqual(37);
    });
});

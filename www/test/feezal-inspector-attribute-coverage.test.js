import {describe, it, expect} from 'vitest';
import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

// B88 — custom inspectors REPLACE the generic attribute panel, so a new
// attribute added to `feezal.attributes` is invisible until a control is added
// by hand. That gap has already happened three times on layout-app (show-
// active-label, header, active-view). This guard fails CI when a declared
// attribute has no reference in the element's custom-inspector source, turning
// "someone remembered" into a test.
//
// Static scan (B88: "start static — it catches the real case, forgetting
// entirely"): extract the attribute names from the `attributes: [...]` block
// and assert each appears in the inspector portion of the file. Elements whose
// inspector is co-located in the same file (all of feezal's today).

const here = dirname(fileURLToPath(import.meta.url));
const pkgs = join(here, '..', 'packages', '@feezal');

// Elements guarded, with an allow-list of attributes deliberately NOT given a
// dedicated inspector control (deprecated + mapped onto a newer control,
// managed by a bespoke UI, or internal). Extend this list as inspectors grow.
const GUARDED = {
    'feezal-element-layout-app': {
        // slim/autohide/hide-header are deprecated: mapped onto rail/header and
        // still referenced by the mapping helpers, so they DO appear — no need
        // to allow-list. `subscribe`/`publish` are the deprecated element-level
        // view-router MQTT topics (superseded by the N30 site contract) — no
        // dedicated control on purpose.
        allow: ['subscribe', 'publish'],
    },
    // `subscribe`: the deprecated element-level active-view topic, no control.
    'feezal-element-material-navbar': {allow: ['subscribe']},
    'feezal-element-basic-device-health': {allow: []},
};

/** Attribute names declared in the element's `attributes: [...]` block. */
function declaredAttributes(src) {
    const start = src.indexOf('attributes: [');
    expect(start, 'attributes: [ block').toBeGreaterThan(-1);
    // Walk bracket depth to find the matching close.
    let i = src.indexOf('[', start), depth = 0, end = -1;
    for (; i < src.length; i++) {
        if (src[i] === '[') depth++;
        else if (src[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
    }
    // Drop nested arrays (options: […], iconVariants, etc.) so their string
    // VALUES ('never', 'start', …) aren't mistaken for attribute names.
    const block = src.slice(start, end + 1).replace(/\[[^[\]]*\]/g, '[]');
    const names = new Set();
    // object form: {name: 'foo', …}
    for (const m of block.matchAll(/\{\s*name:\s*'([a-z][a-z0-9-]*)'/g)) names.add(m[1]);
    // bare string form — a quoted string that is a direct array element
    // (preceded by [ or , and followed by , or ]); excludes key: 'value' pairs.
    for (const m of block.matchAll(/(?:[[,]\s*)'([a-z][a-z0-9-]*)'\s*(?:,|\])/gm)) names.add(m[1]);
    return names;
}

/** The custom-inspector portion of the file — from its class definition on. */
function inspectorSource(src) {
    const m = src.match(/class\s+\w*Inspector\s+extends/);
    expect(m, 'a co-located ...Inspector class').toBeTruthy();
    return src.slice(m.index);
}

describe('B88 — custom inspectors expose every declared attribute', () => {
    for (const [pkg, {allow}] of Object.entries(GUARDED)) {
        it(`${pkg}: no declared attribute is missing from its inspector`, () => {
            const src = readFileSync(join(pkgs, pkg, `${pkg}.js`), 'utf8');
            const attrs = declaredAttributes(src);
            const insp = inspectorSource(src);
            const missing = [...attrs].filter(name =>
                !allow.includes(name) &&
                !insp.includes(`'${name}'`) && !insp.includes(`"${name}"`));
            expect(missing, `attributes with no inspector control in ${pkg}`).toEqual([]);
        });
    }
});

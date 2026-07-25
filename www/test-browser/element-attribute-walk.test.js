/**
 * Element attribute walk — the companion to element-smoke.test.js.
 *
 * The smoke harness mounts every element ONCE, with default attributes. That
 * proves each element loads and renders, but leaves every *conditional* render
 * branch untested: the `look`/`mode`/`variant`/`type` selects that pick a
 * whole visual, and the booleans that add or remove chrome. Those branches are
 * where a template typo hides — the element still mounts, it just breaks the
 * moment someone picks that option in the inspector.
 *
 * So: for every element, walk its OWN declared `select` options and boolean
 * attributes (read from `feezal.attributes`, so this widens automatically as
 * elements gain options) and re-render on each. Data-driven and shallow by
 * design — it asserts "every declared option renders without throwing", not
 * what it renders; looks and wiring stay with the per-element suites.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {fakeConnection} from './helpers.js';

window.feezal = {
    isEditor: false,
    views: [],
    site: document.createElement('div'),
    connection: fakeConnection(),
    getView: () => null,
    resolveAsset: p => p || ''
};

const uncaught = [];
let currentTag = '(import)';
window.addEventListener('error', e => {
    uncaught.push({tag: currentTag, message: String(e.error?.message || e.message)});
    e.preventDefault();
});
window.addEventListener('unhandledrejection', e => {
    uncaught.push({tag: currentTag, message: String(e.reason?.message || e.reason)});
    e.preventDefault();
});

await import('../editor/feezal-elements.js');

const TAGS = window.feezal.elements.map(pkg => pkg.replace(/^@[^/]+\//, ''));

// Same standalone-mount helpers the smoke harness needs.
const EXTRA_ATTRS = {
    'feezal-element-layout-repeater': {'child-element': 'feezal-element-basic-number'},
    'feezal-element-material-select': {options: '[{"value":"a","label":"A"}]'},
    'feezal-element-carbon-select': {options: '[{"value":"a","label":"A"}]'},
    'feezal-element-basic-iframe': {src: 'about:blank'}
};

// Bound the walk so a wide element can't dominate the run.
const MAX_VARIANTS = 24;

/**
 * The attribute variants worth rendering: every option of every `select`, and
 * both states of every boolean. Values are applied as attributes, which is how
 * a saved dashboard and the inspector both set them.
 */
function variantsFor(cls) {
    const attrs = cls?.feezal?.attributes;
    if (!Array.isArray(attrs)) return [];
    const out = [];
    for (const a of attrs) {
        if (!a || typeof a !== 'object' || !a.name) continue;
        if (a.type === 'select' && Array.isArray(a.options)) {
            for (const opt of a.options) {
                const value = typeof opt === 'object' ? opt?.value : opt;
                if (value === undefined || value === null || value === '') continue;
                out.push([a.name, String(value)]);
            }
        } else if (a.type === 'boolean') {
            out.push([a.name, 'true'], [a.name, 'false']);
        }
    }
    return out.slice(0, MAX_VARIANTS);
}

const errorsFor = tag => uncaught.filter(u => u.tag === tag).map(u => u.message);

describe(`element attribute walk — ${TAGS.length} installed packages`, () => {
    beforeEach(() => {
        window.feezal.connection = fakeConnection();
        window.feezal.views = [];
        window.feezal.site = document.createElement('div');
        document.body.innerHTML = '';
    });

    it('the descriptors actually declare branching options to walk', () => {
        const walkable = TAGS.filter(t => variantsFor(customElements.get(t)).length > 0);
        // Sanity floor: if this collapses, the descriptors stopped being
        // readable and the whole suite would silently become a no-op.
        expect(walkable.length).toBeGreaterThan(30);
    });

    for (const tag of TAGS) {
        const cls = customElements.get(tag);
        const variants = variantsFor(cls);
        if (variants.length === 0) continue;

        it(`${tag} renders every declared option (${variants.length})`, async () => {
            currentTag = tag;
            const el = document.createElement(tag);
            el.setAttribute('subscribe', `stat/${tag}`);
            for (const [name, value] of Object.entries(EXTRA_ATTRS[tag] || {})) {
                el.setAttribute(name, value);
            }
            document.body.append(el);
            await el.updateComplete;

            for (const [name, value] of variants) {
                el.setAttribute(name, value);
                await el.updateComplete;
                // A payload while the option is active — several elements only
                // reach the interesting branch once they hold a value.
                window.feezal.connection.deliver(`stat/${tag}`, '42');
                await el.updateComplete;
                // renderRoot on Lit elements, shadowRoot on the legacy Polymer
                // paper family — either proves the element still has a tree.
                expect(el.renderRoot ?? el.shadowRoot,
                    `${tag}[${name}=${value}] lost its render root`).toBeTruthy();
            }

            el.remove();
            await Promise.resolve();
            expect(errorsFor(tag), `${tag} threw while walking its options`).toEqual([]);
        });
    }
});

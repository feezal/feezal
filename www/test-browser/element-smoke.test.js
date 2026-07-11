/**
 * Element smoke harness — mounts EVERY installed element package in a real
 * browser: registered, mounts with a subscribe topic without throwing,
 * renders, survives a payload delivery and a visible toggle, and cleans up
 * its subscriptions on disconnect.
 *
 * This is the automated version of step 1 of the per-element manual recipe
 * in docs/TESTING.md §6. Element-specific behaviour lives in the dedicated
 * component test files.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {fakeConnection} from './helpers.js';

// The generated module assigns onto window.feezal — it must exist first,
// with enough surface for the more demanding elements (navigation, navbar,
// layout-view touch feezal.site/views).
window.feezal = {
    isEditor: false,
    views: [],
    site: document.createElement('div'),
    connection: fakeConnection(),
    getView: () => null,
    resolveAsset: p => p || ''
};

// Attribute uncaught errors (sync + async) to the element under test.
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

// Imports every element + theme package, exactly like the editor does.
await import('../editor/feezal-elements.js');

const TAGS = window.feezal.elements.map(pkg => pkg.replace(/^@[^/]+\//, ''));

// Per-element extra attributes so standalone mounting is meaningful.
const EXTRA_ATTRS = {
    'feezal-element-layout-repeater': {'child-element': 'feezal-element-basic-number'},
    'feezal-element-material-select': {options: '[{"value":"a","label":"A"}]'},
    'feezal-element-basic-iframe': {src: 'about:blank'}
};

// Known subscription leaks (do not extend — fix the element instead; an
// entry here only buys time until the fix lands). Currently empty: the
// harness enforces clean disconnects for every element.
const KNOWN_SUBSCRIPTION_LEAKS = new Set([]);

function errorsFor(tag) {
    return uncaught.filter(u => u.tag === tag).map(u => u.message);
}

describe(`element smoke — all ${TAGS.length} installed packages`, () => {
    beforeEach(() => {
        window.feezal.connection = fakeConnection();
        window.feezal.views = [];
        window.feezal.site = document.createElement('div');
        document.body.innerHTML = '';
    });

    it('the harness sees a plausible element list', () => {
        expect(TAGS.length).toBeGreaterThan(40);
        expect(TAGS).toContain('feezal-element-material-switch');
    });

    it('import registered a custom element for every package', () => {
        const unregistered = TAGS.filter(tag => !customElements.get(tag));
        expect(unregistered).toEqual([]);
    });

    for (const tag of TAGS) {
        it(`${tag} mounts, receives a payload, toggles visibility, cleans up`, async () => {
            currentTag = tag;
            const topic = `smoke/${tag}`;
            const el = document.createElement(tag);
            el.setAttribute('subscribe', topic);
            for (const [name, value] of Object.entries(EXTRA_ATTRS[tag] || {})) {
                el.setAttribute(name, value);
            }
            el.style.width = '200px';
            el.style.height = '100px';
            document.body.append(el);

            await el.updateComplete;                       // Lit render (undefined for Polymer — fine)
            await new Promise(r => setTimeout(r, 30));     // async setup settles

            // Payload deliveries must not throw (string, number-ish, JSON).
            window.feezal.connection.deliver(topic, '1');
            window.feezal.connection.deliver(topic, '42.5');
            window.feezal.connection.deliver(topic, {state: 'ON', value: 7});
            await el.updateComplete;

            // visible toggling drives dynamic subscriptions + view switching paths
            el.visible = true;
            await el.updateComplete;
            el.visible = false;
            await el.updateComplete;

            el.remove();
            await new Promise(r => setTimeout(r, 10));

            expect(errorsFor(tag)).toEqual([]);
            // Elements must release their subscriptions on disconnect.
            if (!KNOWN_SUBSCRIPTION_LEAKS.has(tag)) {
                expect(window.feezal.connection.subCount(),
                    'subscriptions left behind after disconnect').toBe(0);
            }
        });
    }
});

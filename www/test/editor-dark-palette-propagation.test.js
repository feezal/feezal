/**
 * B102 ratchet — a component that styles itself from the editor palette must be
 * FED that palette.
 *
 * The recurring shape: a `www/src` component writes
 * `background: var(--feezal-bg, #fff)`, which is correct and dark-ready — but
 * the values only exist where `feezal-app-editor`'s `:host(.dark)` block names
 * the tag. Miss that list and the light fallback wins, so the component renders
 * white in a dark editor. It happened to the connection-lost overlay, then
 * again to `feezal-toast` (B102).
 *
 * N43's chrome-adoption ratchet does not catch this: it covers Shoelace (`sl-*`)
 * chrome, not the `--feezal-*` palette contract. This is the missing half.
 */
import {describe, it, expect} from 'vitest';
import {readFileSync, readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const EDITOR = 'feezal-app-editor.js';

/** Palette custom properties supplied by the editor's dark block. */
const PALETTE = ['--feezal-bg', '--feezal-bg-sub', '--feezal-color', '--feezal-btn-hover'];

/**
 * Components that do NOT need their own entry because they are always rendered
 * inside a host that IS on the list (custom properties inherit through the
 * shadow tree). Each entry names that host — inheritance is only safe when the
 * component genuinely cannot be mounted anywhere else.
 */
const INHERITS = new Map([
    ['feezal-app-editor', 'defines the palette'],
    ['feezal-editable-list', 'always inside feezal-sidebar-inspector-attributes'],
    ['feezal-style-editor-background', 'always inside feezal-sidebar-inspector-styles'],
    ['feezal-theme-select', 'always inside the inspector / themes sidebar'],
    ['feezal-icon-input', 'always inside a dialog or sidebar that is on the list'],
    // The inspector's own panels — feezal-sidebar-inspector has its own
    // :host(.dark) block, and these only ever render inside it.
    ['feezal-sidebar-inspector-attributes', 'always inside feezal-sidebar-inspector'],
    ['feezal-sidebar-inspector-styles', 'always inside feezal-sidebar-inspector'],
    ['feezal-sidebar-inspector-conditions', 'always inside feezal-sidebar-inspector'],
    ['feezal-sidebar-debug', 'always inside feezal-sidebar-inspector'],
]);

/**
 * Pre-existing offenders, captured when this ratchet was added (B102) and NOT
 * yet audited one by one. They are here so the gate can block NEW misses today
 * rather than waiting for a full sweep — each is either a real dark-mode bug of
 * the B102 shape or an undocumented inheritance. Verify one, then either add
 * the tag to the editor's `:host(.dark)` list or move it to INHERITS with its
 * host; deleting a line from here is always welcome.
 */
const LEGACY_UNAUDITED = new Set([
    'feezal-pwa-icon-dialog',
    'feezal-sidebar-clients',
    'feezal-sidebar-color-ranges',
    'feezal-template-editor',
    'feezal-welcome-tour',
]);

/** Tags named in feezal-app-editor's `:host(.dark) <tag>` selectors. */
function propagationList() {
    const src = readFileSync(join(SRC, EDITOR), 'utf8');
    const tags = new Set();
    for (const m of src.matchAll(/:host\(\.dark\)\s+(feezal-[a-z0-9-]+)/g)) tags.add(m[1]);
    return tags;
}

/** Every custom element defined in a www/src file that reads the palette. */
function paletteConsumers() {
    const out = [];
    for (const file of readdirSync(SRC).filter(f => f.endsWith('.js'))) {
        const src = readFileSync(join(SRC, file), 'utf8');
        const usesPalette = PALETTE.some(v => new RegExp(`var\\(\\s*${v}\\s*,`).test(src));
        if (!usesPalette) continue;
        // A file may define more than one element; all of them render with the
        // palette this file reads, so all of them need feeding.
        for (const m of src.matchAll(/customElements\.define\(\s*['"]([a-z0-9-]+)['"]/g)) {
            out.push({tag: m[1], file});
        }
    }
    return out;
}

describe('editor dark-mode palette propagation', () => {
    const fed = propagationList();
    const consumers = paletteConsumers();

    it('finds the propagation list and the consumers (the scan itself works)', () => {
        // Guards against the ratchet silently passing because a regex stopped
        // matching after a refactor.
        expect(fed.size).toBeGreaterThan(5);
        expect(consumers.length).toBeGreaterThan(3);
        expect(fed.has('feezal-toast'), 'B102: feezal-toast is fed the palette').toBe(true);
    });

    it('no NEW component reads the palette without being fed it', () => {
        const missing = consumers
            .filter(c => !fed.has(c.tag) && !INHERITS.has(c.tag) && !LEGACY_UNAUDITED.has(c.tag))
            .map(c => `${c.tag} (${c.file})`);
        expect(missing, 'Components reading --feezal-* with a light fallback but absent ' +
            `from the ":host(.dark) <tag>" list in ${EDITOR}. Add the tag there, or add it ` +
            'to INHERITS with the host it inherits from.').toEqual([]);
    });

    it('the allowlists have no stale entries', () => {
        // An entry that is now ALSO fed, or no longer a consumer at all, is
        // dead weight that hides the next real miss.
        const tags = new Set(consumers.map(c => c.tag));
        const stale = [...INHERITS.keys(), ...LEGACY_UNAUDITED]
            .filter(tag => tag !== 'feezal-app-editor' && (!tags.has(tag) || fed.has(tag)));
        expect(stale, 'stale allowlist entries — remove them').toEqual([]);
    });
});

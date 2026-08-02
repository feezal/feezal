/**
 * B115 — every destructive context-menu row is red, in every menu.
 *
 * The element menu's own **Delete** row shipped without the class while the
 * machinery sat two lines above it in the same stylesheet, and the assets menu
 * had drifted to a different class, a different red and a different treatment
 * (red text instead of a red hover). Both are the same failure: the rule lived
 * in four-and-a-half copies, so a new menu started from whichever copy its
 * author happened to look at.
 *
 * This is a source ratchet rather than a per-menu browser assertion on purpose.
 * The menus live in five components with quite different mounting requirements,
 * and what has to be guarded is not "this menu renders red today" but "a row
 * added tomorrow cannot ship un-red" — which is a property of the source.
 */
import {describe, it, expect} from 'vitest';
import {readFileSync, readdirSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const files = readdirSync(SRC).filter(f => f.endsWith('.js'))
    .map(f => ({name: f, text: readFileSync(join(SRC, f), 'utf8')}));

/** Class attributes that mark a context-menu ROW (not the menu, not a button). */
const ROW_CLASS = /class="((?:[^"]*\s)?(?:ctx-item|view-ctx-item|item)(?:\s[^"]*)?)"/g;
/** Words that make a row destructive. `Detach` and `Cut` are not: nothing dies. */
const DESTRUCTIVE = /\b(delete|remove|forget|clear)\b/i;

/**
 * The `.danger:hover` CSS rules that belong to a context MENU — scoped by the
 * row classes above, because `.danger` is also a perfectly good name for a
 * destructive button elsewhere (packages, site manager, the conditions panel),
 * and those are not menus and not in this item's scope.
 */
function menuDangerRules(text) {
    return text.split('\n').filter(line =>
        /\.danger:hover/.test(line) &&
        /\bctx-item\b|\bview-ctx-item\b|component-ctx/.test(line));
}

/**
 * Menu rows as {classes, label, body}.
 *
 * `body` is everything from the class attribute to the row's closing tag — the
 * click handler included, deliberately: a row wired to `_ctxAction('delete')`
 * is destructive whatever its caption says, and that is the rule worth
 * enforcing. `label` is the visible caption, used for readable failures.
 */
function menuRows(text) {
    const rows = [];
    for (const match of text.matchAll(ROW_CLASS)) {
        const classes = match[1];
        // Only the menu row shapes; `class="item"` alone is too generic to scan
        // blindly, so it counts only inside a component-ctx menu.
        const isRow = /\bctx-item\b|\bview-ctx-item\b/.test(classes) ||
            (/\bitem\b/.test(classes) && text.includes('component-ctx'));
        if (!isRow) continue;
        // Menu rows are never nested, so the first </div> ends this one.
        const from = match.index + match[0].length;
        const body = text.slice(from, from + 600).split('</div>')[0];
        // The caption is what follows the LAST attribute — a handler containing
        // `=>` makes "find the tag's closing >" unreliable, but `">` is not
        // ambiguous here.
        const label = body.split('">').pop()
            .replace(/\$\{[^}]*\}/g, ' ')      // template expressions
            .replace(/<[^>]*>/g, ' ')          // nested spans (icons, kbd hints)
            .replace(/\s+/g, ' ')
            .trim();
        rows.push({classes, label, body});
    }
    return rows;
}

/** Destructive by caption OR by the action it invokes. */
const isDestructive = row => DESTRUCTIVE.test(row.label) || DESTRUCTIVE.test(row.body);

describe('B115 — destructive context-menu rows carry .danger', () => {
    it('finds the menus at all — the scan itself has to work', () => {
        const all = files.flatMap(f => menuRows(f.text));
        expect(all.length).toBeGreaterThan(20);
        // The known destructive rows, so an empty or broken scan cannot pass.
        const destructive = all.filter(isDestructive);
        expect(destructive.length).toBeGreaterThanOrEqual(5);
        // The canvas element menu's plain Delete — the row this item was about.
        // Its label carries the keyboard hint, hence the loose match.
        expect(destructive.some(r => /^Delete\b/.test(r.label))).toBe(true);
    });

    it('every destructive row in every menu is marked danger', () => {
        const offenders = [];
        for (const file of files) {
            for (const row of menuRows(file.text)) {
                if (isDestructive(row) && !/\bdanger\b/.test(row.classes)) {
                    offenders.push(`${file.name}: "${row.label}" (class="${row.classes}")`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('no menu hardcodes the red — they all read the shared token', () => {
        const offenders = [];
        for (const file of files) {
            for (const line of menuDangerRules(file.text)) {
                if (!line.includes('--feezal-ctx-danger')) {
                    offenders.push(`${file.name}: ${line.trim()}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('scopes itself to menu rules — other .danger controls are not menus', () => {
        // Package buttons, the site-manager rows and the conditions panel's icon
        // buttons all use `.danger` for their own thing. They are deliberately
        // out of scope, and the scan has to prove it does not drag them in.
        const all = files.flatMap(f => menuDangerRules(f.text));
        expect(all.length).toBeGreaterThanOrEqual(5);
        expect(all.some(l => l.includes('.btn.danger'))).toBe(false);
        expect(all.some(l => l.includes('row-btn'))).toBe(false);
    });

    it('the token is defined exactly once, in the editor shell', () => {
        const definers = files.filter(f => /--feezal-ctx-danger:\s*#/.test(f.text));
        expect(definers.map(f => f.name)).toEqual(['feezal-app-editor.js']);
    });

    it('a danger row also flips its text to white — red on dark text is unreadable', () => {
        for (const file of files) {
            for (const line of menuDangerRules(file.text)) {
                expect(line, `${file.name}: ${line.trim()}`).toMatch(/color:\s*#fff/);
            }
        }
    });
});

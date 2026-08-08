/**
 * U105 — Asset Manager multi-selection + bulk operations. Drives the panel
 * with a stubbed fetch (asset listing + per-file DELETE/PATCH endpoints) and
 * asserts the file-manager selection semantics, the bulk delete flow and the
 * bulk folder move.
 */
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import '../src/feezal-sidebar-assets.js';

const FILES = ['a.png', 'b.png', 'c.png', 'sub/d.png'];

let panel;
let deleted;
let moved;
const realFetch = globalThis.fetch;

function listing() {
    return {
        site: FILES.map(p => ({path: p, size: 100, modified: '2026-08-01'})),
        global: [],
        siteDirs: ['sub'],
        globalDirs: [],
    };
}

beforeEach(async () => {
    document.body.innerHTML = '';
    window.feezal = {siteName: 'default', editor: null, view: null,
        app: {change() {}}, views: []};
    deleted = [];
    moved = [];
    globalThis.fetch = vi.fn(async (url, opts = {}) => {
        const u = String(url);
        if (opts.method === 'DELETE') {
            deleted.push(decodeURIComponent(u.split('path=')[1]));
            return {ok: true, json: async () => ({})};
        }
        if (opts.method === 'PATCH') {
            moved.push(JSON.parse(opts.body));
            return {ok: true, json: async () => ({})};
        }
        return {ok: true, json: async () => listing()};
    });
    panel = document.createElement('feezal-sidebar-assets');
    document.body.append(panel);
    await panel.updateComplete;
    await new Promise(r => setTimeout(r));   // _load round-trip
    await panel.updateComplete;
});

afterEach(() => { globalThis.fetch = realFetch; });

const click = (file, mods = {}) =>
    panel._onFileClick({shiftKey: false, ctrlKey: false, metaKey: false, ...mods}, {path: file});
const selected = () => [...panel._selected].sort();

describe('selection semantics (file-manager rules)', () => {
    it('plain click replaces, Ctrl toggles, empty-area click clears', async () => {
        click('a.png');
        expect(selected()).toEqual(['a.png']);
        click('b.png');
        expect(selected()).toEqual(['b.png']);            // replace
        click('a.png', {ctrlKey: true});
        expect(selected()).toEqual(['a.png', 'b.png']);   // toggle on
        click('b.png', {ctrlKey: true});
        expect(selected()).toEqual(['a.png']);            // toggle off
        await panel.updateComplete;
        const zone = panel.renderRoot.querySelector('.drop-zone, .list-zone');
        zone.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        expect(selected()).toEqual([]);                   // empty-area click clears
    });

    it('Shift selects the range from the anchor over the visible order', () => {
        click('a.png');                                    // anchor
        click('c.png', {shiftKey: true});
        expect(selected()).toEqual(['a.png', 'b.png', 'c.png']);
        // reverse direction works too
        click('c.png');
        click('a.png', {shiftKey: true});
        expect(selected()).toEqual(['a.png', 'b.png', 'c.png']);
    });

    // U106 — a plain click SELECTS ONLY; the preview moved to dblclick /
    // context menu / Enter. Driven through the rendered tiles, because the
    // regression this guards is the @click wiring, not _onFileClick.
    it('a plain click on an image selects it and does NOT open the preview', async () => {
        const tile = panel.renderRoot.querySelector('[data-file="a.png"]');
        tile.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        await panel.updateComplete;
        expect(selected()).toEqual(['a.png']);
        expect(panel._previewOpen).toBeFalsy();
    });

    it('a double-click opens the preview; with a modifier held it does not', async () => {
        const tile = panel.renderRoot.querySelector('[data-file="a.png"]');
        tile.dispatchEvent(new MouseEvent('dblclick', {bubbles: true, ctrlKey: true}));
        await panel.updateComplete;
        expect(panel._previewOpen).toBeFalsy();            // Ctrl-dblclick = two toggles

        tile.dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
        await panel.updateComplete;
        expect(panel._previewOpen).toBe(true);
        expect(panel._preview.name).toBe('a.png');
    });

    it('the context menu offers Preview for an image, not for a folder', async () => {
        panel._ctxMenu = {x: 0, y: 0, file: 'a.png', isFolder: false};
        await panel.updateComplete;
        const items = [...panel.renderRoot.querySelectorAll('.ctx-item')].map(i => i.textContent.trim());
        expect(items[0]).toContain('Preview');             // above the existing entries

        panel.renderRoot.querySelector('.ctx-item').click();
        await panel.updateComplete;
        expect(panel._previewOpen).toBe(true);

        panel._previewOpen = false;
        panel._ctxMenu = {x: 0, y: 0, file: 'sub', isFolder: true};
        await panel.updateComplete;
        const folderItems = [...panel.renderRoot.querySelectorAll('.ctx-item')].map(i => i.textContent.trim());
        expect(folderItems.some(t => t.includes('Preview'))).toBe(false);
    });

    it('Enter previews the single selected image — and never a multi-selection', async () => {
        click('a.png');
        await panel.updateComplete;
        const zone = panel.renderRoot.querySelector('.drop-zone, .list-zone');
        zone.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
        await panel.updateComplete;
        expect(panel._previewOpen).toBe(true);

        panel._previewOpen = false;
        click('b.png', {ctrlKey: true});
        await panel.updateComplete;
        zone.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
        await panel.updateComplete;
        expect(panel._previewOpen).toBeFalsy();
    });

    it('list/details selection is background-only; the thumb tile keeps its outline', async () => {
        // The strong outline on text rows was the complaint; on an image tile
        // a tint alone is invisible, so the outline stays there. All three
        // modes checked explicitly — the default mode alone would leave the
        // other branch untested.
        click('a.png');
        for (const [mode, selector, wantsOutline] of [
            ['thumbs', '.tile.selected', true],
            ['list', '.list-row.selected', false],
            ['details', '.detail-row.selected', false],
        ]) {
            panel._viewMode = mode;
            await panel.updateComplete;
            const row = panel.renderRoot.querySelector(selector);
            expect(row, `${mode}: no selected row`).not.toBeNull();
            const cs = getComputedStyle(row);
            if (wantsOutline) {
                expect(cs.outlineStyle, mode).toBe('solid');
            } else {
                expect(cs.outlineStyle, mode).toBe('none');
                expect(cs.backgroundColor, mode).not.toBe('rgba(0, 0, 0, 0)');
            }
        }
    });

    it('selected rows carry the selection class and the infobar counts', async () => {
        click('a.png');
        click('b.png', {ctrlKey: true});
        await panel.updateComplete;
        expect(panel.renderRoot.querySelectorAll('.selected')).toHaveLength(2);
        expect(panel.renderRoot.querySelector('.infobar').textContent).toContain('2 selected');
    });

    it('navigating into a folder clears the selection', async () => {
        click('a.png');
        panel._folder = 'sub';
        await panel.updateComplete;
        await panel.updateComplete;   // updated() clears in a follow-up cycle
        expect(selected()).toEqual([]);
    });
});

describe('keyboard verbs on the zone', () => {
    it('Ctrl+A selects every visible file, Esc clears', async () => {
        panel._onZoneKeydown(new KeyboardEvent('keydown', {key: 'a', ctrlKey: true}));
        expect(selected()).toEqual(['a.png', 'b.png', 'c.png']);   // current folder only
        panel._onZoneKeydown(new KeyboardEvent('keydown', {key: 'Escape'}));
        expect(selected()).toEqual([]);
    });

    it('Del deletes the whole selection behind ONE counted confirm', async () => {
        click('a.png');
        click('b.png', {ctrlKey: true});
        panel._onZoneKeydown(new KeyboardEvent('keydown', {key: 'Delete'}));
        await panel.updateComplete;
        expect(panel._dlgConfirm.message).toBe('Delete 2 selected files?');
        panel._dlgConfirm.resolve(true);
        panel._dlgConfirm = null;
        await new Promise(r => setTimeout(r));
        expect(deleted.sort()).toEqual(['a.png', 'b.png']);
        expect(selected()).toEqual([]);
    });

    it('a declined confirm deletes nothing', async () => {
        click('a.png');
        const p = panel._deleteSelected();
        await panel.updateComplete;
        panel._dlgConfirm.resolve(false);
        panel._dlgConfirm = null;
        await p;
        expect(deleted).toEqual([]);
        expect(selected()).toEqual(['a.png']);   // selection survives a cancel
    });
});

describe('bulk move', () => {
    it('_moveFiles PATCHes every file into the target folder', async () => {
        await panel._moveFiles(['a.png', 'b.png'], 'sub');
        expect(moved).toEqual([
            {category: 'site', oldPath: 'a.png', newPath: 'sub/a.png'},
            {category: 'site', oldPath: 'b.png', newPath: 'sub/b.png'},
        ]);
    });

    it('aggregates partial failures into one error bar', async () => {
        globalThis.fetch = vi.fn(async (url, opts = {}) => {
            if (opts.method === 'PATCH') {
                const body = JSON.parse(opts.body);
                return body.oldPath === 'b.png'
                    ? {ok: false, json: async () => ({})}
                    : {ok: true, json: async () => ({})};
            }
            return {ok: true, json: async () => listing()};
        });
        await panel._moveFiles(['a.png', 'b.png'], 'sub');
        expect(panel._error).toBe('Move failed for: b.png');
    });
});

describe('single delete uses the path as-is (double-prefix regression)', () => {
    it('deleting a file inside a folder sends the category-relative path once', async () => {
        panel._folder = 'sub';
        await panel.updateComplete;
        const p = panel._delete('sub/d.png');
        await panel.updateComplete;
        panel._dlgConfirm.resolve(true);
        panel._dlgConfirm = null;
        await p;
        expect(deleted).toEqual(['sub/d.png']);   // NOT sub/sub/d.png
    });
});

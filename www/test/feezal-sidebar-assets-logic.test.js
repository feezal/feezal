/**
 * feezal-sidebar-assets — the asset manager's data layer.
 *
 * The panel's rendering is smoke-covered in the browser suite; what is tested
 * here is the part that decides WHAT gets rendered and what the server is
 * asked to do: the folder-scoping getters (which files count as "in this
 * folder", which folders exist — including empty ones the server lists
 * explicitly), the sort/search pipeline, and the fetch-backed mutations.
 *
 * Folder scoping is the subtle one: assets are a flat path list, so "current
 * folder" is a prefix filter plus a "no further slash" rule, and getting that
 * wrong either hides files or leaks nested ones into the parent view.
 *
 * The destructive actions await `_confirm()` / `_prompt()`, which resolve from
 * the RENDERED dialog — so the tests drive them the way the dialog does, which
 * also pins that a delete asks before it deletes.
 */
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../src/feezal-sidebar-assets.js';

let fetchMock;

const ASSETS = {
    site: [
        {path: 'logo.png', size: 300, modified: '2026-07-01T00:00:00Z'},
        {path: 'Banner.JPG', size: 100, modified: '2026-07-03T00:00:00Z'},
        {path: 'notes.txt', size: 200, modified: '2026-07-02T00:00:00Z'},
        {path: 'icons/home.svg', size: 50, modified: '2026-07-04T00:00:00Z'},
        {path: 'icons/deep/nested.svg', size: 10, modified: '2026-07-05T00:00:00Z'},
    ],
    siteDirs: ['icons', 'icons/deep', 'empty-folder'],
    global: [{path: 'shared.png', size: 1, modified: '2026-07-01T00:00:00Z'}],
};

function mockFetch(responses = []) {
    fetchMock = vi.fn(async () => {
        const next = responses.shift();
        if (next === undefined) return {ok: true, json: async () => ({}), text: async () => ''};
        if (next === null) throw new Error('network down');
        return next;
    });
    globalThis.fetch = fetchMock;
}

const ok = body => ({ok: true, json: async () => body, text: async () => JSON.stringify(body)});
const fail = text => ({ok: false, json: async () => ({}), text: async () => text});

/** Detached instance — no connectedCallback, so no auto-load or drag wiring. */
function makePanel(assets = ASSETS) {
    const el = document.createElement('feezal-sidebar-assets');
    el._assets = structuredClone(assets);
    return el;
}

const paths = list => list.map(f => f.path);

/** A right-click event shaped the way _openContextMenu reads it. */
const ctxEvent = (clientX, clientY) => ({
    type: 'contextmenu', preventDefault() {}, stopPropagation() {}, clientX, clientY,
});

beforeEach(() => {
    window.feezal = {siteName: 'default', isEditor: true, editor: null, views: []};
    mockFetch();
    localStorage.clear();
});

afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
});

describe('folder scoping', () => {
    it('lists only the direct children of the current folder', () => {
        const el = makePanel();
        expect(paths(el._currentList)).toEqual(['Banner.JPG', 'logo.png', 'notes.txt']);
        el._folder = 'icons';
        expect(paths(el._currentList)).toEqual(['icons/home.svg']);      // not icons/deep/nested.svg
        el._folder = 'icons/deep';
        expect(paths(el._currentList)).toEqual(['icons/deep/nested.svg']);
    });

    it('derives folders from paths AND from the explicit dir list (so empty folders show)', () => {
        const el = makePanel();
        expect(el._currentFolders).toEqual(['empty-folder', 'icons']);
        el._folder = 'icons';
        expect(el._currentFolders).toEqual(['deep']);
    });

    it('switches category without leaking the other category', () => {
        const el = makePanel();
        el._category = 'global';
        expect(paths(el._currentList)).toEqual(['shared.png']);
        expect(el._currentFolders).toEqual([]);
    });

    it('an unknown category is empty rather than throwing', () => {
        const el = makePanel();
        el._category = 'nope';
        expect(el._currentList).toEqual([]);
        expect(el._currentFolders).toEqual([]);
    });
});

describe('sorting', () => {
    it('defaults to name/asc, case-insensitively', () => {
        const el = makePanel();
        expect([el._sortKey, el._sortDir]).toEqual(['name', 'asc']);
        expect(paths(el._filteredList)).toEqual(['Banner.JPG', 'logo.png', 'notes.txt']);
    });

    it('flips direction when the same key is clicked again', () => {
        const el = makePanel();
        el._setSort('name');
        expect(el._sortDir).toBe('desc');
        expect(paths(el._filteredList)).toEqual(['notes.txt', 'logo.png', 'Banner.JPG']);
    });

    it('a different key restarts ascending', () => {
        const el = makePanel();
        el._setSort('name');                                   // → desc
        el._setSort('size');
        expect([el._sortKey, el._sortDir]).toEqual(['size', 'asc']);
        expect(paths(el._filteredList)).toEqual(['Banner.JPG', 'notes.txt', 'logo.png']);
    });

    it('sorts by extension and by date', () => {
        const el = makePanel();
        el._setSort('type');
        expect(paths(el._filteredList)).toEqual(['Banner.JPG', 'logo.png', 'notes.txt']);
        el._setSort('date');
        expect(paths(el._filteredList)).toEqual(['logo.png', 'notes.txt', 'Banner.JPG']);
    });
});

describe('search', () => {
    it('searches the whole category flat, ignoring the current folder', () => {
        const el = makePanel();
        el._folder = 'icons';
        el._search = 'svg';
        // Sorted by BASENAME (the default name sort): home.svg before nested.svg.
        expect(paths(el._filteredList)).toEqual(['icons/home.svg', 'icons/deep/nested.svg']);
    });

    it('matches on the basename only and is case-insensitive', () => {
        const el = makePanel();
        el._search = 'BANNER';
        expect(paths(el._filteredList)).toEqual(['Banner.JPG']);
        el._search = 'icons';                                  // a folder segment, not a basename
        expect(el._filteredList).toEqual([]);
    });

    it('hides folders while searching', () => {
        const el = makePanel();
        expect(el._filteredFolders).toEqual(['empty-folder', 'icons']);
        el._search = 'log';
        expect(el._filteredFolders).toEqual([]);
    });
});

describe('view preferences persist', () => {
    it('remembers the view mode and thumb size', () => {
        const el = makePanel();
        el._setViewMode('list');
        expect(el._viewMode).toBe('list');
        expect(localStorage.getItem('feezal-assets-viewmode')).toBe('list');
        el._setThumbSize(120);
        expect(localStorage.getItem('feezal-assets-thumbsize')).toBe('120');
    });
});

describe('loading', () => {
    it('replaces the asset map from the API', async () => {
        const el = makePanel({});
        mockFetch([ok(ASSETS)]);
        await el._load();
        expect(fetchMock).toHaveBeenCalledWith('/api/assets/default');
        expect(paths(el._currentList)).toHaveLength(3);
    });

    it('keeps the previous list when the API fails or errors', async () => {
        const el = makePanel();
        mockFetch([fail('nope')]);
        await el._load();
        expect(paths(el._currentList)).toHaveLength(3);
        mockFetch([null]);
        await el._load();
        expect(paths(el._currentList)).toHaveLength(3);
    });
});

describe('mutations', () => {
    it('deletes a file only after the confirm dialog is accepted', async () => {
        const el = makePanel();
        mockFetch([ok({}), ok(ASSETS)]);
        const pending = el._delete('logo.png');
        await Promise.resolve();
        expect(el._dlgConfirm.message).toContain('logo.png');       // asks first
        el._dlgConfirm.resolve(true);
        await pending;
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toContain('/api/assets/default');
        expect(decodeURIComponent(url)).toContain('logo.png');
        expect(init.method).toBe('DELETE');
    });

    it('a declined confirm deletes nothing', async () => {
        const el = makePanel();
        const pending = el._delete('logo.png');
        await Promise.resolve();
        el._dlgConfirm.resolve(false);
        await pending;
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('deleting a folder scopes the path to the current folder', async () => {
        const el = makePanel();
        el._folder = 'icons';
        mockFetch([ok({}), ok(ASSETS)]);
        const pending = el._deleteFolder('deep');
        await Promise.resolve();
        expect(el._dlgConfirm.message).toContain('deep');
        el._dlgConfirm.resolve(true);
        await pending;
        expect(decodeURIComponent(fetchMock.mock.calls[0][0])).toContain('icons/deep');
    });

    it('creates a folder under the current one', async () => {
        const el = makePanel();
        el._folder = 'icons';
        mockFetch([ok({}), ok(ASSETS)]);
        const pending = el._mkdir();
        await Promise.resolve();
        el._dlgPromptVal = 'new-folder';
        el._submitPrompt();
        await pending;
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('/api/assets/default/mkdir');
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body)).toMatchObject({category: 'site', path: 'icons/new-folder'});
    });

    it('a dismissed folder prompt creates nothing', async () => {
        const el = makePanel();
        const pending = el._mkdir();
        await Promise.resolve();
        el._dlgPrompt.resolve(null);
        await pending;
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('_submitPrompt ignores a blank name instead of resolving it', () => {
        const el = makePanel();
        el._prompt('Folder name');
        el._dlgPromptVal = '   ';
        el._submitPrompt();
        expect(el._dlgPrompt).toBeTruthy();                         // still open
    });

    it('renames a file and leaves rename mode', async () => {
        const el = makePanel();
        el._startRename('logo.png');
        expect(el._renaming).toBe('logo.png');
        expect(el._renameVal).toBe('logo.png');
        el._renameVal = 'logotype.png';
        mockFetch([ok({}), ok(ASSETS)]);
        await el._commitRename('logo.png');
        expect(el._renaming).toBeNull();
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('/api/assets/default');
        expect(init.method).toBe('PATCH');
        expect(JSON.parse(init.body)).toMatchObject({oldPath: 'logo.png', newPath: 'logotype.png'});
    });

    it('a rename keeps the file in its directory', async () => {
        const el = makePanel();
        el._startRename('icons/home.svg');
        expect(el._renameVal).toBe('home.svg');                     // basename only
        el._renameVal = 'house.svg';
        mockFetch([ok({}), ok(ASSETS)]);
        await el._commitRename('icons/home.svg');
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).newPath).toBe('icons/house.svg');
    });

    it('a rename to the same name is a no-op', async () => {
        const el = makePanel();
        el._startRename('logo.png');
        await el._commitRename('logo.png');
        expect(el._renaming).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('builds the asset URL for the active category', () => {
        const el = makePanel();
        expect(el._assetSrc('logo.png')).toContain('logo.png');
        el._category = 'global';
        expect(el._assetSrc('shared.png')).toContain('shared.png');
    });
});

describe('confirm / prompt dialog state', () => {
    it('_confirm resolves true only when the dialog is accepted', async () => {
        const el = makePanel();
        const pending = el._confirm('Delete it?');
        expect(el._dlgConfirm.message).toBe('Delete it?');
        el._dlgConfirm.resolve(true);
        await expect(pending).resolves.toBe(true);
    });

    it('_prompt hands back the typed value, and null when dismissed', async () => {
        const el = makePanel();
        el._dlgPromptVal = 'left over';
        const pending = el._prompt('Folder name');
        expect(el._dlgPromptVal).toBe('');                          // cleared on open
        el._dlgPromptVal = 'sub';
        el._submitPrompt();
        await expect(pending).resolves.toBe('sub');

        const second = el._prompt('Folder name');
        el._dlgPrompt.resolve(null);
        await expect(second).resolves.toBeNull();
    });
});

describe('context menu', () => {
    it('opens at the pointer with the file it was opened on', () => {
        const el = makePanel();
        el._openContextMenu(ctxEvent(40, 60), 'logo.png');
        expect(el._ctxMenu.file).toBe('logo.png');
        expect(el._ctxMenu.x).toBe(40);
        expect(el._ctxMenu.y).toBe(60);
        expect(el._ctxMenu.subLeft).toBe(false);
    });

    it('clamps to the window and flips the submenu near the right edge', () => {
        const el = makePanel();
        el._openContextMenu(ctxEvent(99999, 99999), 'logo.png');
        expect(el._ctxMenu.x).toBe(window.innerWidth - 165);
        expect(el._ctxMenu.y).toBe(window.innerHeight - 130);
        expect(el._ctxMenu.subLeft).toBe(true);
    });

    it('positions under the button when opened from the ⋮ menu, not the pointer', () => {
        const el = makePanel();
        el._openContextMenu({
            type: 'click', preventDefault() {}, stopPropagation() {},
            clientX: 0, clientY: 0,
            currentTarget: {getBoundingClientRect: () => ({left: 12, bottom: 30})},
        }, 'logo.png');
        expect([el._ctxMenu.x, el._ctxMenu.y]).toEqual([12, 32]);
    });

    it('marks a folder so the file-only entries are withheld', () => {
        const el = makePanel();
        el._openContextMenu(ctxEvent(0, 0), 'icons', {isFolder: true, folderName: 'icons'});
        expect(el._ctxMenu.isFolder).toBe(true);
        expect(el._ctxMenu.folderName).toBe('icons');
    });
});

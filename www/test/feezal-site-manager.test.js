/**
 * feezal-site-manager — the editor's site dropdown: list/filter, switch, and
 * the create / duplicate / rename / delete flows against /api/sites.
 *
 * All four mutations share the same shape (guard → fetch → reload-or-navigate
 * → alert on failure), so the guards are where the bugs live: an invalid name,
 * a name that already exists, a no-op rename, and "did the CURRENT site just
 * get renamed/deleted" (which navigates instead of reloading the list).
 */
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../src/feezal-site-manager.js';

let fetchMock;
let navigated;

/** Stand-in for the editor globals the component reads. */
function setupGlobals({siteName = 'default', hasChanges = false} = {}) {
    window.feezal = {siteName, hasChanges};
}

/** Queue fetch responses in call order; `null` entries reject. */
function mockFetch(responses) {
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

async function mountManager(sites = ['default', 'kitchen']) {
    mockFetch([ok({sites})]);
    const el = document.createElement('feezal-site-manager');
    document.body.append(el);
    await el.updateComplete;
    await Promise.resolve();          // let _loadSites() settle
    await el.updateComplete;
    return el;
}

beforeEach(() => {
    setupGlobals();
    navigated = [];
    // jsdom/happy-dom refuse a real navigation — capture the assignment.
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: {get href() { return navigated.at(-1) ?? ''; }, set href(v) { navigated.push(v); }},
    });
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('prompt', vi.fn(() => null));
});

afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
});

describe('site list', () => {
    it('loads and sorts the sites on connect', async () => {
        const el = await mountManager(['zulu', 'alpha', 'mike']);
        expect(el.sites).toEqual(['alpha', 'mike', 'zulu']);
        expect(fetchMock).toHaveBeenCalledWith('/api/sites');
    });

    it('falls back to the current site when the API is unreachable', async () => {
        setupGlobals({siteName: 'only-one'});
        mockFetch([null]);
        const el = document.createElement('feezal-site-manager');
        document.body.append(el);
        await el.updateComplete;
        await Promise.resolve();
        expect(el.sites).toEqual(['only-one']);
    });

    it('filters case-insensitively on a substring', async () => {
        const el = await mountManager(['Wohnzimmer', 'kitchen', 'Bad']);
        expect(el._filteredSites()).toHaveLength(3);       // no filter = everything
        el._filter = 'ZIMM';
        expect(el._filteredSites()).toEqual(['Wohnzimmer']);
        el._filter = 'nope';
        expect(el._filteredSites()).toEqual([]);
    });

    it('the toggle opens the dropdown and resets its transient state', async () => {
        const el = await mountManager();
        el._filter = 'stale';
        el._renaming = 'kitchen';
        el._confirmDelete = 'kitchen';
        el._toggle({currentTarget: {getBoundingClientRect: () => ({left: 12, bottom: 30})}});
        expect(el._open).toBe(true);
        expect(el._filter).toBe('');
        expect(el._renaming).toBeNull();
        expect(el._confirmDelete).toBeNull();
        expect([el._dropX, el._dropY]).toEqual([12, 34]);
    });
});

describe('switching site', () => {
    it('navigates to the picked site', async () => {
        const el = await mountManager();
        el._switchSite('kitchen');
        expect(navigated.at(-1)).toBe('/editor/?/kitchen/');
    });

    it('picking the CURRENT site just closes the dropdown', async () => {
        const el = await mountManager();
        el._open = true;
        el._switchSite('default');
        expect(el._open).toBe(false);
        expect(navigated).toHaveLength(0);
    });

    it('unsaved changes prompt first, and a cancelled prompt stays put', async () => {
        setupGlobals({hasChanges: true});
        const el = await mountManager();
        globalThis.confirm.mockReturnValueOnce(false);
        el._switchSite('kitchen');
        expect(navigated).toHaveLength(0);
        expect(globalThis.confirm).toHaveBeenCalled();
    });
});

describe('creating a site', () => {
    it('rejects an empty name before touching the API', async () => {
        const el = await mountManager();
        el._newName = '   ';
        await el._createSite();
        expect(el._newError).toMatch(/required/i);
        expect(fetchMock).toHaveBeenCalledTimes(1);         // only the initial list
    });

    it('rejects an invalid name', async () => {
        const el = await mountManager();
        el._newName = 'has/slash';
        await el._createSite();
        expect(el._newError).toMatch(/not a valid site name/i);
    });

    it('rejects a duplicate name', async () => {
        const el = await mountManager(['default', 'kitchen']);
        el._newName = 'kitchen';
        await el._createSite();
        expect(el._newError).toMatch(/already exists/i);
    });

    it('POSTs a valid name and navigates to it', async () => {
        const el = await mountManager();
        mockFetch([ok({})]);
        el._newName = 'garden';
        await el._createSite();
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('/api/sites');
        expect(init.method).toBe('POST');
        // A new site inherits the current site's MQTT connection (fromSite).
        expect(JSON.parse(init.body)).toEqual({name: 'garden', fromSite: feezal.siteName});
        expect(navigated.at(-1)).toBe('/editor/?/garden/');
        expect(el._busy).toBe(false);
    });

    it('surfaces a server error instead of navigating', async () => {
        const el = await mountManager();
        mockFetch([fail('disk full')]);
        el._newName = 'garden';
        await el._createSite();
        expect(el._newError).toBe('disk full');
        expect(navigated).toHaveLength(0);
        expect(el._busy).toBe(false);
    });

    it('Enter creates, Escape closes', async () => {
        const el = await mountManager();
        const create = vi.spyOn(el, '_createSite').mockResolvedValue();
        const close = vi.spyOn(el, '_closeNewDialog').mockImplementation(() => {});
        el._onNewKeydown({key: 'Enter'});
        expect(create).toHaveBeenCalled();
        el._onNewKeydown({key: 'Escape'});
        expect(close).toHaveBeenCalled();
    });
});

describe('duplicating a site', () => {
    it('does nothing when the prompt is dismissed', async () => {
        const el = await mountManager();
        globalThis.prompt.mockReturnValueOnce(null);
        await el._duplicateSite('default');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('refuses an invalid or existing target name', async () => {
        const el = await mountManager(['default', 'kitchen']);
        globalThis.prompt.mockReturnValueOnce('bad name/x');
        await el._duplicateSite('default');
        expect(globalThis.alert).toHaveBeenCalledWith(expect.stringMatching(/not a valid/i));

        globalThis.prompt.mockReturnValueOnce('kitchen');
        await el._duplicateSite('default');
        expect(globalThis.alert).toHaveBeenCalledWith(expect.stringMatching(/already exists/i));
    });

    it('clones and reloads the list', async () => {
        const el = await mountManager(['default']);
        globalThis.prompt.mockReturnValueOnce('default-copy');
        mockFetch([ok({}), ok({sites: ['default', 'default-copy']})]);
        await el._duplicateSite('default');
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('/api/sites/default/clone');
        expect(JSON.parse(init.body)).toEqual({newName: 'default-copy'});
        expect(el.sites).toEqual(['default', 'default-copy']);
    });
});

describe('renaming a site', () => {
    it('a no-op rename just cancels', async () => {
        const el = await mountManager();
        el._renaming = 'kitchen';
        el._renameValue = 'kitchen';
        await el._confirmRename();
        expect(el._renaming).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('PATCHes and reloads when renaming another site', async () => {
        const el = await mountManager(['default', 'kitchen']);
        el._startRename('kitchen');
        expect(el._renameValue).toBe('kitchen');
        el._renameValue = 'küche';
        mockFetch([ok({}), ok({sites: ['default', 'küche']})]);
        await el._confirmRename();
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('/api/sites/kitchen');
        expect(init.method).toBe('PATCH');
        expect(el.sites).toEqual(['default', 'küche']);
        expect(navigated).toHaveLength(0);
    });

    it('navigates when the CURRENT site is renamed', async () => {
        setupGlobals({siteName: 'default'});
        const el = await mountManager(['default']);
        el._renaming = 'default';
        el._renameValue = 'main';
        mockFetch([ok({})]);
        await el._confirmRename();
        expect(navigated.at(-1)).toBe('/editor/?/main/');
    });

    it('alerts on a server error and keeps the row in rename mode', async () => {
        const el = await mountManager(['default', 'kitchen']);
        el._renaming = 'kitchen';
        el._renameValue = 'busy';
        mockFetch([fail('site is locked')]);
        await el._confirmRename();
        expect(globalThis.alert).toHaveBeenCalledWith('site is locked');
        expect(el._renaming).toBe('kitchen');
    });

    it('Enter confirms, Escape cancels', async () => {
        const el = await mountManager();
        const confirmRename = vi.spyOn(el, '_confirmRename').mockResolvedValue();
        el._onRenameKeydown({key: 'Enter'});
        expect(confirmRename).toHaveBeenCalled();
        el._renaming = 'kitchen';
        el._onRenameKeydown({key: 'Escape'});
        expect(el._renaming).toBeNull();
    });
});

describe('deleting a site', () => {
    it('DELETEs and reloads when deleting another site', async () => {
        const el = await mountManager(['default', 'kitchen']);
        el._confirmDelete = 'kitchen';
        mockFetch([ok({}), ok({sites: ['default']})]);
        await el._deleteSite('kitchen');
        expect(fetchMock.mock.calls[0]).toEqual(['/api/sites/kitchen', {method: 'DELETE'}]);
        expect(el._confirmDelete).toBeNull();
        expect(el.sites).toEqual(['default']);
    });

    it('falls back to the default site when the CURRENT one is deleted', async () => {
        setupGlobals({siteName: 'kitchen'});
        const el = await mountManager(['default', 'kitchen']);
        mockFetch([ok({})]);
        await el._deleteSite('kitchen');
        expect(navigated.at(-1)).toBe('/editor/?/default/');
    });

    it('alerts on a server error', async () => {
        const el = await mountManager(['default', 'kitchen']);
        mockFetch([fail('in use')]);
        await el._deleteSite('kitchen');
        expect(globalThis.alert).toHaveBeenCalledWith('in use');
        expect(el._busy).toBe(false);
    });
});

describe('the body-level portal', () => {
    it('is created on connect and removed on disconnect', async () => {
        const el = await mountManager();
        expect(el._portalEl).toBeTruthy();
        expect(el._portalEl.isConnected).toBe(true);
        const portal = el._portalEl;
        el.remove();
        expect(portal.isConnected).toBe(false);
        expect(el._portalEl).toBeNull();
    });

    it('an outside pointerdown closes an open dropdown', async () => {
        const el = await mountManager();
        el._open = true;
        el._onDocClick({composedPath: () => [document.body]});
        expect(el._open).toBe(false);
    });

    it('a pointerdown inside the component keeps it open', async () => {
        const el = await mountManager();
        el._open = true;
        el._onDocClick({composedPath: () => [el]});
        expect(el._open).toBe(true);
    });
});

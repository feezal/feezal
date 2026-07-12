import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../src/feezal-sidebar-packages.js';

const INSTALLED = [
    {name: '@feezal/feezal-element-foo', version: '1.0.0', type: 'element'},
    {name: '@feezal/feezal-theme-bar', version: '2.0.0', latest: '2.1.0', type: 'theme'},
];

function stubFetch(...responses) {
    const fetch = vi.fn();
    responses.forEach(r => fetch.mockResolvedValueOnce(r));
    // default: installed-packages reload
    fetch.mockResolvedValue({ok: true, json: async () => ({packages: INSTALLED})});
    vi.stubGlobal('fetch', fetch);
    return fetch;
}

async function attachPanel() {
    const el = document.createElement('feezal-sidebar-packages');
    document.body.append(el);
    await el.updateComplete;
    await vi.waitFor(() => expect(el._installed).toHaveLength(INSTALLED.length));
    await el.updateComplete;
    return el;
}

beforeEach(() => {
    stubFetch();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('installed packages', () => {
    it('loads the installed list on attach', async () => {
        const el = await attachPanel();
        expect(fetch).toHaveBeenCalledWith('/api/elements');
        expect(el._installed).toEqual(INSTALLED);
    });

    it('keeps the previous list when the API is unreachable', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
        const el = document.createElement('feezal-sidebar-packages');
        el._installed = INSTALLED;
        await el._loadInstalled();
        expect(el._installed).toEqual(INSTALLED);
    });

    it('filters the installed list by the active type segment', async () => {
        const el = await attachPanel();
        el._filter = 'theme';
        await el.updateComplete;
        const names = [...el.shadowRoot.querySelectorAll('.row .name')].map(n => n.textContent.trim());
        expect(names).toEqual(['@feezal/feezal-theme-bar']);
    });

    it('offers an Icons tab that filters icon sets (N23)', async () => {
        const el = await attachPanel();
        el._installed = [...INSTALLED, {name: '@feezal/feezal-icons-fa', version: '1.0.0', type: 'icons'}];
        // The type filter is a tab bar since the unified-sidebar-tab-bars rework.
        const tabs = [...el.shadowRoot.querySelectorAll('sl-tab')].map(t => t.textContent.trim());
        expect(tabs).toContain('Icons');
        el._filter = 'icons';
        await el.updateComplete;
        const names = [...el.shadowRoot.querySelectorAll('.row .name')].map(n => n.textContent.trim());
        expect(names).toEqual(['@feezal/feezal-icons-fa']);
    });

    it('offers an update only for outdated packages', async () => {
        const el = await attachPanel();
        const rows = [...el.shadowRoot.querySelectorAll('.row')];
        const badge = row => row.querySelector('.badge');
        expect(badge(rows[0])).toBeNull();
        expect(badge(rows[1]).textContent).toContain('2.1.0');
    });
});

describe('element sets (N29) — grouping & labels', () => {
    const SET = '@feezal/feezal-elements-eink';
    const WITH_SET = [
        {name: '@feezal/feezal-element-solo', version: '1.0.0', type: 'element'},
        {name: SET, version: '3.0.1', type: 'bundle'},
        {name: '@feezal/feezal-element-eink-value', version: '3.0.1', type: 'element', set: SET},
        {name: '@feezal/feezal-element-eink-clock', version: '3.0.1', type: 'element', set: SET},
    ];

    async function attachWithSet() {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: async () => ({packages: WITH_SET})}));
        const el = document.createElement('feezal-sidebar-packages');
        document.body.append(el);
        await el.updateComplete;
        await vi.waitFor(() => expect(el._installed).toHaveLength(WITH_SET.length));
        await el.updateComplete;
        return el;
    }

    const rowNames = el => [...el.shadowRoot.querySelectorAll('.row')].map(r =>
        ({name: r.querySelector('.name').textContent.trim(), member: r.classList.contains('member')}));

    it('groups members indented under their set in the All view', async () => {
        const el = await attachWithSet();
        expect(rowNames(el)).toEqual([
            {name: '@feezal/feezal-element-solo', member: false},
            {name: SET, member: false},
            {name: '@feezal/feezal-element-eink-value', member: true},
            {name: '@feezal/feezal-element-eink-clock', member: true},
        ]);
    });

    it('the Sets filter shows only sets with their members', async () => {
        const el = await attachWithSet();
        el._filter = 'bundle';
        await el.updateComplete;
        expect(rowNames(el).map(r => r.name)).toEqual(
            [SET, '@feezal/feezal-element-eink-value', '@feezal/feezal-element-eink-clock']);
    });

    it('the Elements filter stays flat and includes set members', async () => {
        const el = await attachWithSet();
        el._filter = 'element';
        await el.updateComplete;
        const rows = rowNames(el);
        expect(rows.map(r => r.name)).toEqual([
            '@feezal/feezal-element-solo', '@feezal/feezal-element-eink-value', '@feezal/feezal-element-eink-clock']);
        expect(rows.every(r => !r.member)).toBe(true);
    });

    it('an orphaned member (set no longer installed) is listed top-level', async () => {
        const el = await attachWithSet();
        el._installed = WITH_SET.filter(p => p.type !== 'bundle');
        await el.updateComplete;
        expect(rowNames(el).every(r => !r.member)).toBe(true);
        expect(rowNames(el)).toHaveLength(3);
    });

    it('renders bundle rows and search results with the "set" label', async () => {
        const el = await attachWithSet();
        const setRow = [...el.shadowRoot.querySelectorAll('.row')].find(r =>
            r.querySelector('.name').textContent.trim() === SET);
        expect(setRow.querySelector('.sub').textContent).toContain('set');
        expect(setRow.querySelector('.btn.danger').title).toContain('member elements');

        el._results = [{name: '@feezal/feezal-elements-hmi', version: '1.0.0', type: 'bundle', description: 'HMI set'}];
        await el.updateComplete;
        const chip = [...el.shadowRoot.querySelectorAll('.chip')].map(c => c.textContent.trim());
        expect(chip).toContain('set');
    });
});

describe('_search()', () => {
    it('queries the registry and shows the results', async () => {
        const el = await attachPanel();
        stubFetch({ok: true, json: async () => ({results: [
            {name: '@feezal/feezal-element-new', version: '0.1.0', type: 'element', description: 'shiny'},
        ]})});
        el._query = 'new';
        await el._search();
        expect(fetch).toHaveBeenCalledWith('/api/elements/search?text=new');
        expect(el._results).toHaveLength(1);
    });

    it('scopes the search to the active type filter', async () => {
        const el = await attachPanel();
        const fetch = stubFetch({ok: true, json: async () => ({results: []})});
        el._filter = 'theme';
        await el._search();
        expect(fetch.mock.calls[0][0]).toBe('/api/elements/search?text=&type=theme');
    });

    it('surfaces search errors and clears stale results', async () => {
        const el = await attachPanel();
        el._results = [{name: 'stale'}];
        stubFetch({ok: false, json: async () => ({error: 'registry down'})});
        await el._search();
        expect(el._error).toBe('registry down');
        expect(el._results).toEqual([]);
    });

    it('hides already-installed packages from the search results', async () => {
        const el = await attachPanel();
        el._results = [
            {name: '@feezal/feezal-element-foo', version: '1.0.0', type: 'element'},
            {name: '@feezal/feezal-element-new', version: '0.1.0', type: 'element'},
        ];
        await el.updateComplete;
        // search-result rows render the bare name; installed rows link to npm
        const resultNames = [...el.shadowRoot.querySelectorAll('.row .name')]
            .filter(n => !n.querySelector('a'))
            .map(n => n.textContent.trim());
        expect(resultNames).toEqual(['@feezal/feezal-element-new']);
    });
});

describe('_act() — install/update/remove', () => {
    it('posts the action, collects npm output and marks the panel dirty', async () => {
        const el = await attachPanel();
        const fetch = stubFetch({ok: true, json: async () => ({ok: true, stdout: 'added 1 package', stderr: 'npm warn old'})});

        await el._install({name: '@feezal/feezal-element-new', version: '0.1.0'});

        const [url, init] = fetch.mock.calls[0];
        expect(url).toBe('/api/elements');
        expect(JSON.parse(init.body)).toEqual({package: '@feezal/feezal-element-new', version: '0.1.0'});
        expect(el._output).toBe('added 1 package\nnpm warn old');
        expect(el._dirty).toBe(true);
        expect(el._busy).toBe('');
        // reloads the installed list afterwards
        expect(fetch).toHaveBeenCalledWith('/api/elements');
    });

    it('routes update and remove to their endpoints', async () => {
        const el = await attachPanel();
        let fetch = stubFetch({ok: true, json: async () => ({ok: true})});
        await el._update({name: 'pkg'});
        expect(fetch.mock.calls[0][0]).toBe('/api/elements/update');

        fetch = stubFetch({ok: true, json: async () => ({ok: true})});
        await el._remove({name: 'pkg'});
        expect(fetch.mock.calls[0][0]).toBe('/api/elements/remove');
    });

    it('reports a failed operation without marking the panel dirty', async () => {
        const el = await attachPanel();
        stubFetch({ok: false, json: async () => ({error: 'npm exploded', stderr: 'boom'})});
        await el._install({name: 'pkg', version: '1.0.0'});
        expect(el._error).toBe('npm exploded');
        expect(el._output).toBe('boom');
        expect(el._dirty).toBe(false);
    });

    it('shows the reload hint after a successful change', async () => {
        const el = await attachPanel();
        stubFetch({ok: true, json: async () => ({ok: true})});
        await el._install({name: 'pkg', version: '1.0.0'});
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.reload')).not.toBeNull();
    });
});

/**
 * Package Manager sidebar (N4) — the full UI flow against a stubbed fetch:
 * installed list, search, install → reload prompt, update badge, remove,
 * and server-rejection surfacing. No npm, no network.
 */
import {describe, it, expect, beforeEach, vi} from 'vitest';
import '../src/feezal-sidebar-packages.js';
import {setupFeezal} from './helpers.js';

let responses;
let calls;

/** fetch stub: looks up `METHOD url-prefix` in `responses`. */
function stubFetch() {
    calls = [];
    globalThis.fetch = vi.fn(async (url, opts = {}) => {
        const method = (opts.method || 'GET').toUpperCase();
        calls.push({method, url: String(url), body: opts.body ? JSON.parse(opts.body) : null});
        const hit = responses.find(r => method === r.method && String(url).startsWith(r.url));
        if (!hit) throw new Error('unstubbed fetch: ' + method + ' ' + url);
        return {
            ok: hit.status ? hit.status < 400 : true,
            status: hit.status || 200,
            json: async () => hit.json
        };
    });
}

async function mountPanel() {
    const el = document.createElement('feezal-sidebar-packages');
    document.body.append(el);
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 10));   // _loadInstalled settles
    await el.updateComplete;
    return el;
}

const rows = el => [...el.shadowRoot.querySelectorAll('.row')]
    .map(r => r.querySelector('.name').textContent.trim());

beforeEach(() => {
    setupFeezal();
    responses = [
        {method: 'GET', url: '/api/elements/search', json: {results: []}},
        {method: 'GET', url: '/api/elements', json: {packages: [
            {name: '@feezal/feezal-element-material-switch', version: '1.1.0', type: 'element'},
            {name: '@feezal/feezal-theme-dark-mint', version: '1.0.0', type: 'theme', latest: '1.2.0'}
        ]}}
    ];
    stubFetch();
});

describe('installed list', () => {
    it('lists installed packages and filters by type', async () => {
        const el = await mountPanel();
        expect(rows(el)).toEqual([
            '@feezal/feezal-element-material-switch',
            '@feezal/feezal-theme-dark-mint'
        ]);

        const themesTab = [...el.shadowRoot.querySelectorAll('sl-tab')]
            .find(t => t.textContent.trim() === 'Themes');
        themesTab.click();
        await vi.waitFor(() => expect(rows(el)).toEqual(['@feezal/feezal-theme-dark-mint']));
    });

    it('shows the update badge + button only for outdated packages', async () => {
        const el = await mountPanel();
        const badges = el.shadowRoot.querySelectorAll('.badge');
        expect(badges).toHaveLength(1);
        expect(badges[0].textContent).toContain('1.2.0');
    });
});

describe('search + install', () => {
    it('searches and installs; success shows the reload prompt', async () => {
        responses.unshift({method: 'GET', url: '/api/elements/search', json: {results: [
            {name: '@feezal/feezal-element-material-tank', version: '2.0.0', type: 'element', description: 'Tank'}
        ]}});
        responses.unshift({method: 'POST', url: '/api/elements', json: {ok: true, stdout: 'added 1 package'}});

        const el = await mountPanel();
        const input = el.shadowRoot.querySelector('.searchbar input');
        input.value = 'tank';
        input.dispatchEvent(new Event('input'));
        input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
        await vi.waitFor(() => expect(rows(el)).toContain('@feezal/feezal-element-material-tank'));

        const searchCall = calls.find(c => c.url.includes('/api/elements/search'));
        expect(searchCall.url).toContain('text=tank');

        el.shadowRoot.querySelector('.row .btn.primary').click();
        await vi.waitFor(() => {
            expect(el.shadowRoot.querySelector('.reload')).not.toBeNull();
        });
        const install = calls.find(c => c.method === 'POST' && c.url.endsWith('/api/elements'));
        expect(install.body).toEqual({package: '@feezal/feezal-element-material-tank', version: '2.0.0'});
        expect(el.shadowRoot.querySelector('pre.out').textContent).toContain('added 1 package');
    });

    it('surfaces a server rejection (non-feezal package) as an error', async () => {
        responses.unshift({method: 'POST', url: '/api/elements', status: 400,
            json: {error: 'package must be a feezal-element-* or feezal-theme-* name'}});
        responses.unshift({method: 'GET', url: '/api/elements/search', json: {results: [
            {name: 'left-pad', version: '1.3.0', type: 'element'}
        ]}});

        const el = await mountPanel();
        el.shadowRoot.querySelector('.searchbar .btn').click();
        await vi.waitFor(() => expect(rows(el)).toContain('left-pad'));

        el.shadowRoot.querySelector('.row .btn.primary').click();
        await vi.waitFor(() => {
            expect(el.shadowRoot.querySelector('.error')?.textContent)
                .toContain('feezal-element-*');
        });
        expect(el.shadowRoot.querySelector('.reload')).toBeNull();
    });
});

describe('update + remove', () => {
    it('update posts the package name and refreshes', async () => {
        responses.unshift({method: 'POST', url: '/api/elements/update', json: {ok: true, stdout: 'updated'}});
        const el = await mountPanel();

        [...el.shadowRoot.querySelectorAll('.row .btn')]
            .find(b => b.textContent.trim() === 'Update').click();
        await vi.waitFor(() => expect(el.shadowRoot.querySelector('.reload')).not.toBeNull());

        const call = calls.find(c => c.url.endsWith('/api/elements/update'));
        // the registry-reported latest travels along so a stale npm packument
        // cache can't reinstall the old version
        expect(call.body).toEqual({package: '@feezal/feezal-theme-dark-mint', version: '1.2.0'});
    });

    it('remove posts the package name', async () => {
        responses.unshift({method: 'POST', url: '/api/elements/remove', json: {ok: true}});
        const el = await mountPanel();

        el.shadowRoot.querySelector('.row .btn.danger').click();
        await vi.waitFor(() => {
            const call = calls.find(c => c.url.endsWith('/api/elements/remove'));
            expect(call?.body).toEqual({package: '@feezal/feezal-element-material-switch'});
        });
    });
});

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import {labelFor} from '../src/feezal-history-bar.js';

// History entries as /api/sites/:site/history returns them.
const HISTORY = [
    {sha: 'aaaaaaa1111111', message: 'save: current state'},
    {sha: 'bbbbbbb2222222', message: 'save: older state'},
    {sha: 'ccccccc3333333', message: 'init: site created'}
];

function stubFetch(response) {
    const fetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetch);
    return fetch;
}

async function attachBar(banner) {
    window.feezal.historyBanner = banner;
    const el = document.createElement('feezal-history-bar');
    document.body.append(el);
    await el.updateComplete;
    return el;
}

const BANNER = {
    sha: 'aaaaaaa1111111',
    prevSha: 'bbbbbbb2222222',
    nextSha: null,
    label: 'current state',
    siteName: 'demo'
};

beforeEach(() => {
    stubFetch({json: async () => ({supported: true, history: HISTORY})});
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('labelFor()', () => {
    it('labels missing messages as auto-saves', () => {
        expect(labelFor(null)).toBe('Auto-save');
        expect(labelFor(undefined)).toBe('Auto-save');
    });

    it('labels init commits', () => {
        expect(labelFor('init: site created')).toBe('Initial version');
    });

    it('strips the restore prefix and the sha suffix', () => {
        expect(labelFor('restore: My label (abc1234)')).toBe('My label');
    });

    it('strips the save prefix', () => {
        expect(labelFor('save: hello world')).toBe('hello world');
    });

    it('passes anything else through verbatim', () => {
        expect(labelFor('some manual commit')).toBe('some manual commit');
    });
});

describe('_loadHistory()', () => {
    it('loads the commit list from the history API', async () => {
        const fetch = stubFetch({json: async () => ({supported: true, history: HISTORY})});
        const el = document.createElement('feezal-history-bar');
        await el._loadHistory('demo');
        expect(fetch).toHaveBeenCalledWith('/api/sites/demo/history');
        expect(el._history).toEqual(HISTORY);
    });

    it('treats an unsupported backend as an empty history', async () => {
        stubFetch({json: async () => ({supported: false})});
        const el = document.createElement('feezal-history-bar');
        await el._loadHistory('demo');
        expect(el._history).toEqual([]);
    });

    it('treats a fetch failure as an empty history', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
        const el = document.createElement('feezal-history-bar');
        await el._loadHistory('demo');
        expect(el._history).toEqual([]);
    });
});

describe('rendering', () => {
    it('renders nothing without a history banner', async () => {
        const fetch = stubFetch({json: async () => ({supported: true, history: []})});
        const el = document.createElement('feezal-history-bar');
        document.body.append(el);
        await el.updateComplete;
        expect(fetch).not.toHaveBeenCalled();
        expect(el.shadowRoot.getElementById('bar')).toBeNull();
    });

    it('renders the bar with sha, label and navigation links', async () => {
        const el = await attachBar(BANNER);
        const bar = el.shadowRoot.getElementById('bar');
        expect(bar.querySelector('.label').textContent).toContain('aaaaaaa');
        expect(bar.querySelector('.label').textContent).toContain('current state');
        const links = [...bar.querySelectorAll('.nav-link')];
        expect(links[0].getAttribute('href')).toBe('/viewer/demo?sha=bbbbbbb2222222');
        expect(links.at(-1).getAttribute('href')).toBe('/viewer/demo');
    });

    it('disables the Newer link on the newest commit', async () => {
        const el = await attachBar(BANNER);
        const [older, newer] = el.shadowRoot.querySelectorAll('.nav-link');
        expect(older.classList.contains('disabled')).toBe(false);
        expect(newer.classList.contains('disabled')).toBe(true);
        expect(newer.getAttribute('href')).toBe('#');
    });

    it('offers all commits except the current one for comparison', async () => {
        const el = await attachBar(BANNER);
        await vi.waitFor(() => {
            const options = [...el.shadowRoot.querySelectorAll('.compare-select option')];
            // placeholder + the two other commits; the shown commit is excluded
            expect(options.map(o => o.value)).toEqual(['', 'bbbbbbb2222222', 'ccccccc3333333']);
        });
    });

    it('omits the compare dropdown when there is nothing to compare against', async () => {
        stubFetch({json: async () => ({supported: true, history: [HISTORY[0]]})});
        const el = await attachBar(BANNER);
        await vi.waitFor(() => expect(el._history).toHaveLength(1));
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.compare-select')).toBeNull();
    });
});

describe('overlay lifecycle', () => {
    it('_closeOverlay() disposes the Monaco editor and clears the overlay', () => {
        const el = document.createElement('feezal-history-bar');
        const dispose = vi.fn();
        el._monacoEditor = {dispose};
        el._overlay = {mode: 'source', sha: 'aaaaaaa1111111', otherSha: '', label: 'x'};
        el._closeOverlay();
        expect(dispose).toHaveBeenCalledTimes(1);
        expect(el._monacoEditor).toBeNull();
        expect(el._overlay).toBeNull();
    });

    it('closes the overlay on Escape', async () => {
        const el = await attachBar(BANNER);
        el._overlay = {mode: 'source', sha: 'aaaaaaa1111111', otherSha: '', label: 'x'};
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
        expect(el._overlay).toBeNull();
    });

    it('ignores Escape while no overlay is open', async () => {
        const el = await attachBar(BANNER);
        expect(() => document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))).not.toThrow();
        expect(el._overlay).toBeNull();
    });
});

describe('_fetchFile()', () => {
    it('returns the file content for an ok response', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, text: async () => '<html>'}));
        const el = document.createElement('feezal-history-bar');
        await expect(el._fetchFile('demo', 'abc')).resolves.toBe('<html>');
        expect(fetch).toHaveBeenCalledWith('/api/sites/demo/history/abc/file?path=site.html');
    });

    it('throws the response body on an error status', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: false, text: async () => 'not found'}));
        const el = document.createElement('feezal-history-bar');
        await expect(el._fetchFile('demo', 'abc')).rejects.toThrow('not found');
    });
});

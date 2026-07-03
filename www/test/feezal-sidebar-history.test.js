import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import {labelFor, relativeTime} from '../src/feezal-sidebar-history.js';

const HISTORY = [
    {sha: 'aaaaaaa1111111', date: '2026-07-03T12:00:00Z', message: 'save: latest'},
    {sha: 'bbbbbbb2222222', date: '2026-07-02T12:00:00Z', message: 'restore: older state (ccccccc)'},
    {sha: 'ccccccc3333333', date: '2026-07-01T12:00:00Z', message: 'init: site created'},
];

function stubFetch(response) {
    const fetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetch);
    return fetch;
}

async function attachPanel() {
    const el = document.createElement('feezal-sidebar-history');
    document.body.append(el);
    await el.updateComplete;
    await vi.waitFor(() => expect(el._loading).toBe(false));
    await el.updateComplete;
    return el;
}

beforeEach(() => {
    stubFetch({json: async () => ({supported: true, history: HISTORY})});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('relativeTime()', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-03T12:00:00Z'));
    });

    it('formats each magnitude bucket', () => {
        expect(relativeTime('2026-07-03T11:59:30Z')).toBe('30 seconds ago');
        expect(relativeTime('2026-07-03T11:55:00Z')).toBe('5 minutes ago');
        expect(relativeTime('2026-07-03T09:00:00Z')).toBe('3 hours ago');
        expect(relativeTime('2026-07-01T12:00:00Z')).toBe('2 days ago');
        expect(relativeTime('2026-05-03T12:00:00Z')).toBe('2 months ago');
    });

    it('handles future dates', () => {
        expect(relativeTime('2026-07-03T12:05:00Z')).toBe('in 5 minutes');
    });
});

describe('labelFor()', () => {
    it('maps commit message prefixes to display labels', () => {
        expect(labelFor(null)).toBe('Auto-save');
        expect(labelFor('init: site created')).toBe('Initial version');
        expect(labelFor('restore: older state (abc1234)')).toBe('older state');
        expect(labelFor('save: my label')).toBe('my label');
        expect(labelFor('anything else')).toBe('anything else');
    });
});

describe('_load()', () => {
    it('fetches the site history using feezal.siteName', async () => {
        feezal.siteName = 'demo';
        const fetch = stubFetch({json: async () => ({supported: true, history: HISTORY})});
        const el = await attachPanel();
        expect(fetch).toHaveBeenCalledWith('/api/sites/demo/history');
        expect(el._history).toEqual(HISTORY);
    });

    it('falls back to the default site name', async () => {
        const fetch = stubFetch({json: async () => ({supported: true, history: []})});
        await attachPanel();
        expect(fetch).toHaveBeenCalledWith('/api/sites/default/history');
    });

    it('marks history unsupported as null', async () => {
        stubFetch({json: async () => ({supported: false})});
        const el = await attachPanel();
        expect(el._history).toBeNull();
    });

    it('surfaces load errors', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
        const el = await attachPanel();
        expect(el._error).toBe('offline');
    });
});

describe('rendering', () => {
    it('explains when history is unsupported', async () => {
        stubFetch({json: async () => ({supported: false})});
        const el = await attachPanel();
        expect(el.shadowRoot.querySelector('.state-msg').textContent).toContain('not available');
    });

    it('shows an empty state without saves', async () => {
        stubFetch({json: async () => ({supported: true, history: []})});
        const el = await attachPanel();
        expect(el.shadowRoot.querySelector('.state-msg').textContent).toContain('No saves yet');
    });

    it('renders one timeline entry per commit with labels', async () => {
        const el = await attachPanel();
        const labels = [...el.shadowRoot.querySelectorAll('.entry-label')].map(n => n.textContent.trim());
        expect(labels).toEqual(['latest', 'older state', 'Initial version']);
    });

    it('offers restore on every entry except the current one', async () => {
        const el = await attachPanel();
        const entries = [...el.shadowRoot.querySelectorAll('.entry')];
        const restoreButtons = entry => entry.querySelectorAll('button[title="Restore this version"]');
        expect(restoreButtons(entries[0])).toHaveLength(0);
        expect(restoreButtons(entries[1])).toHaveLength(1);
        expect(restoreButtons(entries[2])).toHaveLength(1);
    });

    it('marks restore entries in the timeline', async () => {
        const el = await attachPanel();
        const restoreEntry = [...el.shadowRoot.querySelectorAll('.entry-label')][1];
        expect(restoreEntry.classList.contains('restore')).toBe(true);
    });
});

describe('actions', () => {
    it('opens a preview tab pinned to the commit sha', async () => {
        feezal.siteName = 'demo';
        const open = vi.fn();
        vi.stubGlobal('open', open);
        const el = await attachPanel();
        el._preview('aaaaaaa1111111');
        expect(open).toHaveBeenCalledWith('/viewer/demo?sha=aaaaaaa1111111', '_blank');
    });

    it('reports a failed restore and clears the busy marker', async () => {
        const el = await attachPanel();
        stubFetch({ok: false, json: async () => ({error: 'dirty worktree'})});
        el._confirmRestore = {sha: 'bbbbbbb2222222', label: 'older state'};
        await el.updateComplete;
        await el._doRestore();
        expect(el._error).toBe('Restore failed: dirty worktree');
        expect(el._busy).toBeNull();
        expect(el._confirmRestore).toBeNull();
    });
});

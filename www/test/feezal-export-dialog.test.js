import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import {formatKb} from '../src/feezal-export-dialog.js';

const REPORT = {
    totalMinified: 300 * 1024,
    totalGzip: 90 * 1024,
    estimate: true,
    elemCount: 2,
    buckets: [
        {name: '@feezal/feezal-element-circle-light', minified: 120 * 1024, gzip: 36 * 1024},
        {name: 'lit', minified: 90 * 1024, gzip: 27 * 1024},
        {name: '@feezal/feezal-element-material-switch', minified: 60 * 1024, gzip: 18 * 1024},
        {name: 'feezal core', minified: 30 * 1024, gzip: 9 * 1024},
    ],
};

/** Mount the dialog with sl-dialog's animated show() stubbed out. */
async function mount() {
    const el = document.createElement('feezal-export-dialog');
    document.body.append(el);
    await el.updateComplete;
    const dlg = el.renderRoot.querySelector('sl-dialog');
    dlg.show = vi.fn();
    dlg.hide = vi.fn();
    return el;
}

beforeEach(() => {
    feezal.siteName = 'mysite';
});

afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
});

describe('formatKb', () => {
    it('one decimal under 100 kB, integers above', () => {
        expect(formatKb(12.1 * 1024)).toBe('12.1');
        expect(formatKb(0)).toBe('0.0');
        expect(formatKb(300 * 1024)).toBe('300');
        expect(formatKb(1234567)).toBe('1206');
    });
});

describe('bundle size breakdown (U34)', () => {
    it('open() fetches the report and renders totals + sorted bars, top 3 highlighted', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ok: true, json: async () => REPORT})));
        const el = await mount();
        await el.open();
        await el.updateComplete;

        expect(fetch).toHaveBeenCalledWith('/api/sites/mysite/bundle-report');
        expect(el.renderRoot.querySelector('sl-dialog').show).toHaveBeenCalled();

        const totals = el.renderRoot.querySelector('.totals').textContent;
        expect(totals).toContain('300 kB');
        expect(totals).toContain('~90.0 kB');
        expect(totals).toContain('estimates');

        const rows = [...el.renderRoot.querySelectorAll('.row')];
        expect(rows.map(r => r.querySelector('.name').textContent)).toEqual([
            '@feezal/feezal-element-circle-light', 'lit',
            '@feezal/feezal-element-material-switch', 'feezal core',
        ]);
        expect(rows.map(r => r.classList.contains('top'))).toEqual([true, true, true, false]);

        // 120/300 = 40% share, reflected in text and bar width
        const first = rows[0];
        expect(first.querySelector('.bytes').textContent).toContain('40.0%');
        expect(first.querySelector('.bar > div').style.width).toBe('40%');
    });

    it('shows a warning but keeps the download available when the report fails', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ok: false, json: async () => ({error: 'no metadata'})})));
        const el = await mount();
        await el.open();
        await el.updateComplete;

        expect(el.renderRoot.querySelector('.warn').textContent).toContain('no metadata');
        expect(el.renderRoot.querySelector('.rows')).toBeNull();
        const download = [...el.renderRoot.querySelectorAll('sl-button')]
            .find(b => b.textContent.includes('Download ZIP'));
        expect(download).toBeTruthy();
    });

    it('a network error is handled like a failed report', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
        const el = await mount();
        await el.open();
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.warn').textContent).toContain('offline');
    });
});

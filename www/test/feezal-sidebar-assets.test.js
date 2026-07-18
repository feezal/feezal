import {describe, it, expect, vi, beforeEach} from 'vitest';

import '../src/feezal-sidebar-assets.js';

// N33: "Set as background" context action — exercised on an unattached
// element (no rendering); feezal.view / feezal.views are plain elements
// standing in for the canvas views.
function makeAssets(category = 'site') {
    const el = document.createElement('feezal-sidebar-assets');
    el._category = category;
    el._load = vi.fn();   // network-backed refresh — not under test
    return el;
}

function makeView(name) {
    const v = document.createElement('feezal-view');
    v.setAttribute('name', name);
    return v;
}

beforeEach(() => {
    feezal.siteName = 'testsite';
    feezal.app = {change: vi.fn()};
    feezal.editor = {selectedElems: []};
    const v1 = makeView('view1');
    const v2 = makeView('view2');
    feezal.view = v1;
    feezal.views = [v1, v2];
});

describe('_setAsBackground()', () => {
    it('stamps image + cover/center/no-repeat longhands on the current view only', async () => {
        const el = makeAssets();
        await el._setAsBackground('img/photo.jpg', 'current');

        const [v1, v2] = feezal.views;
        expect(v1.style.backgroundImage).toBe('url("/assets/testsite/img/photo.jpg")');
        expect(v1.style.backgroundSize).toBe('cover');
        expect(v1.style.backgroundPosition).toMatch(/^center( center)?$/);
        expect(v1.style.backgroundRepeat).toBe('no-repeat');
        expect(v2.style.backgroundImage).toBe('');
        expect(feezal.app.change).toHaveBeenCalled();
    });

    it('scope "all" stamps every view of the site', async () => {
        const el = makeAssets();
        await el._setAsBackground('bg.png', 'all');

        for (const v of feezal.views) {
            expect(v.style.backgroundImage).toBe('url("/assets/testsite/bg.png")');
            expect(v.style.backgroundSize).toBe('cover');
        }
    });

    it('copies a global asset into the site first and uses the site copy URL', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({path: 'bg-1.png'})
        });
        const el = makeAssets('global');
        await el._setAsBackground('bg.png', 'current');

        expect(fetch).toHaveBeenCalledWith('/api/assets/testsite/transfer', expect.objectContaining({method: 'POST'}));
        const body = JSON.parse(fetch.mock.calls[0][1].body);
        expect(body).toMatchObject({srcCategory: 'global', srcPath: 'bg.png', destCategory: 'site', copy: true, unique: true});
        expect(feezal.view.style.backgroundImage).toBe('url("/assets/testsite/bg-1.png")');
        expect(el._load).toHaveBeenCalled();
    });

    it('falls back to the global URL when the copy fails', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));
        const el = makeAssets('global');
        await el._setAsBackground('bg.png', 'current');

        expect(feezal.view.style.backgroundImage).toBe('url("/assets/global/bg.png")');
    });

    it('nudges the style inspector when an affected view is selected', async () => {
        feezal.editor.selectedElems = [feezal.view];
        const before = feezal.editor.selectedElems;
        const el = makeAssets();
        await el._setAsBackground('a.jpg', 'current');

        expect(feezal.editor.selectedElems).not.toBe(before);
        expect(feezal.editor.selectedElems).toEqual(before);
    });
});

import {describe, it, expect, beforeEach} from 'vitest';

import '../src/feezal-app-viewer.js';

// The viewer app derives the active view from the URL hash. feezal.site is a
// plain stand-in here — only its writable `view` property is used.
function makeViews(...names) {
    return names.map(name => {
        const view = document.createElement('feezal-view');
        view.setAttribute('name', name);
        return view;
    });
}

async function attachViewer() {
    const el = document.createElement('feezal-app-viewer');
    document.body.append(el);
    await el.updateComplete;
    return el;
}

beforeEach(() => {
    location.hash = '';
    feezal.isEditor = false;
    feezal.views = makeViews('home', 'kitchen');
    feezal.site = {view: null};
});

describe('initial navigation', () => {
    it('writes the first view into an empty hash', async () => {
        await attachViewer();
        expect(location.hash).toBe('#/home');
    });

    it('adopts an existing hash instead of overwriting it', async () => {
        location.hash = '#/kitchen';
        await attachViewer();
        expect(location.hash).toBe('#/kitchen');
        expect(feezal.site.view).toBe('kitchen');
    });

    it('tolerates a site without views', async () => {
        feezal.views = [];
        await attachViewer();
        expect(location.hash).toBe('');
    });
});

describe('hashchange handling', () => {
    it('routes hash changes to feezal.site.view', async () => {
        await attachViewer();
        location.hash = '#/kitchen';
        window.dispatchEvent(new Event('hashchange'));
        expect(feezal.site.view).toBe('kitchen');
    });

    it('strips both "#" and a leading "/" from the hash', async () => {
        await attachViewer();
        location.hash = '#kitchen';
        window.dispatchEvent(new Event('hashchange'));
        expect(feezal.site.view).toBe('kitchen');
    });

    it('stops listening after disconnect', async () => {
        const el = await attachViewer();
        el.remove();
        feezal.site.view = 'home';
        location.hash = '#/kitchen';
        window.dispatchEvent(new Event('hashchange'));
        expect(feezal.site.view).toBe('home');
    });

    it('survives a hash change while feezal.site is not (yet) available', async () => {
        await attachViewer();
        feezal.site = null;
        location.hash = '#/kitchen';
        expect(() => window.dispatchEvent(new Event('hashchange'))).not.toThrow();
    });
});

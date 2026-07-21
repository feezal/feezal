import {describe, it, expect, beforeEach} from 'vitest';

import '../src/feezal-app-viewer.js';

// The viewer app derives the active view from the URL hash and delegates it
// to the site's view command (B41: the full `view/embedded` path, so deep
// links into a layout-app sub-view work on hash changes too). feezal.site is
// a plain stand-in here — `applyControlCommand('view', path)` records the
// path and mirrors the top-level part into `view` like the real site does.
function makeViews(...names) {
    return names.map(name => {
        const view = document.createElement('feezal-view');
        view.setAttribute('name', name);
        return view;
    });
}

function makeFakeSite() {
    return {
        view: null,
        viewCommands: [],
        applyControlCommand(cmd, payload) {
            if (cmd !== 'view') return;
            this.viewCommands.push(payload);
            this.view = String(payload).split('/')[0];
        }
    };
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
    feezal.site = makeFakeSite();
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
    it('routes hash changes to the site view command', async () => {
        await attachViewer();
        location.hash = '#/kitchen';
        window.dispatchEvent(new Event('hashchange'));
        expect(feezal.site.view).toBe('kitchen');
        expect(feezal.site.viewCommands.at(-1)).toBe('kitchen');
    });

    it('strips both "#" and a leading "/" from the hash', async () => {
        await attachViewer();
        location.hash = '#kitchen';
        window.dispatchEvent(new Event('hashchange'));
        expect(feezal.site.view).toBe('kitchen');
    });

    // B41: a deep link #/<view>/<embedded> must carry the embedded part into
    // the site's view command instead of dropping it.
    it('routes the full view/embedded path for deep links', async () => {
        await attachViewer();
        location.hash = '#/kitchen/heating';
        window.dispatchEvent(new Event('hashchange'));
        expect(feezal.site.viewCommands.at(-1)).toBe('kitchen/heating');
        expect(feezal.site.view).toBe('kitchen');
    });

    it('decodes percent-encoded names in both segments', async () => {
        await attachViewer();
        location.hash = '#/K%C3%BCche/Heizung%20oben';
        window.dispatchEvent(new Event('hashchange'));
        expect(feezal.site.viewCommands.at(-1)).toBe('Küche/Heizung oben');
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

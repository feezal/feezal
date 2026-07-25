import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../src/feezal-site.js';
import '../src/feezal-view.js';

function makeViews(...names) {
    return names.map(name => {
        const view = document.createElement('feezal-view');
        view.setAttribute('name', name);
        return view;
    });
}

beforeEach(() => {
    location.hash = '';
});

describe('updateVisibility()', () => {
    it('marks exactly the active view visible', () => {
        const site = document.createElement('feezal-site');
        feezal.views = makeViews('home', 'kitchen', 'bath');
        site.view = 'kitchen';
        site.updateVisibility();
        expect(feezal.views.map(v => v.visible)).toEqual([false, true, false]);
    });
});

describe('initial view from the URL hash', () => {
    it('falls back to the first view and writes the hash when none is set', () => {
        feezal.views = makeViews('home', 'kitchen');
        const site = document.createElement('feezal-site');
        document.body.append(site);
        expect(site.view).toBe('home');
        expect(location.hash).toBe('#/home');
    });

    it('adopts the view from an existing hash', () => {
        feezal.views = makeViews('home', 'kitchen');
        location.hash = '#/kitchen';
        const site = document.createElement('feezal-site');
        document.body.append(site);
        expect(site.view).toBe('kitchen');
    });
});

describe('viewer theme class mirroring', () => {
    it('copies feezal-theme-* classes to document.body outside the editor', () => {
        feezal.isEditor = false;
        feezal.views = makeViews('home');
        const site = document.createElement('feezal-site');
        site.classList.add('feezal-theme-dark-mint', 'other-class');
        document.body.append(site);
        expect(document.body.classList.contains('feezal-theme-dark-mint')).toBe(true);
        expect(document.body.classList.contains('other-class')).toBe(false);
        document.body.classList.remove('feezal-theme-dark-mint');
    });

    it('does not touch document.body in the editor', () => {
        feezal.isEditor = true;
        feezal.views = makeViews('home');
        const site = document.createElement('feezal-site');
        site.classList.add('feezal-theme-dark-mint');
        document.body.append(site);
        expect(document.body.classList.contains('feezal-theme-dark-mint')).toBe(false);
    });
});

// U51: theme command override state — an explicit choice suppresses per-view
// themes; '' / 'default' restores the baked theme and re-enables them.
describe('theme control command — override state (U51)', () => {
    function makeThemedSite() {
        feezal.isEditor = false;
        feezal.views = makeViews('home');
        const site = document.createElement('feezal-site');
        site.classList.add('feezal-theme-baked');
        document.body.append(site);
        return site;
    }

    it('an explicit theme sets the override and re-derives view themes', () => {
        const site = makeThemedSite();
        const view = document.createElement('feezal-view');
        view.setAttribute('theme', 'dark-mint');
        site.append(view);
        view._applyThemeClass();
        expect(view.classList.contains('feezal-theme-dark-mint')).toBe(true);

        feezal.site = site;
        site.applyControlCommand('theme', 'user-pick');

        expect(site._themeOverride).toBe('feezal-theme-user-pick');
        expect(site.classList.contains('feezal-theme-user-pick')).toBe(true);
        expect(site.classList.contains('feezal-theme-baked')).toBe(false);
        // The per-view theme is suppressed while the override is active.
        expect(view.classList.contains('feezal-theme-dark-mint')).toBe(false);
        document.body.className = '';
    });

    it("'default' clears the override, restores the baked theme and view themes", () => {
        const site = makeThemedSite();
        const view = document.createElement('feezal-view');
        view.setAttribute('theme', 'dark-mint');
        site.append(view);
        feezal.site = site;

        site.applyControlCommand('theme', 'user-pick');
        site.applyControlCommand('theme', 'default');

        expect(site._themeOverride).toBeNull();
        expect(site.classList.contains('feezal-theme-baked')).toBe(true);
        expect(site.classList.contains('feezal-theme-user-pick')).toBe(false);
        expect(document.body.classList.contains('feezal-theme-baked')).toBe(true);
        expect(view.classList.contains('feezal-theme-dark-mint')).toBe(true);
        document.body.className = '';
    });
});

describe('_syncViewBackground()', () => {
    it('mirrors the active view background into --feezal-canvas-bg', () => {
        const site = document.createElement('feezal-site');
        feezal.views = makeViews('home');
        feezal.views[0].style.background = 'rgb(1, 2, 3)';
        site.view = 'home';
        site._syncViewBackground();
        expect(site.style.getPropertyValue('--feezal-canvas-bg')).toContain('rgb(1, 2, 3)');
    });

    it('clears the property when the view has no background', () => {
        const site = document.createElement('feezal-site');
        feezal.views = makeViews('home');
        site.view = 'home';
        site.style.setProperty('--feezal-canvas-bg', 'red');
        site._syncViewBackground();
        expect(site.style.getPropertyValue('--feezal-canvas-bg')).toBe('');
    });
});

describe('viewer control subscriptions', () => {
    function subscribedHandler(sub, topic) {
        const call = sub.mock.calls.find(c => c[0] === topic);
        return call && call[1];
    }

    function makeViewerSite(attributes = {}) {
        feezal.isEditor = false;
        feezal.connection = {sub: vi.fn(), pub: vi.fn()};
        feezal.views = makeViews('home', 'kitchen');
        const site = document.createElement('feezal-site');
        Object.entries(attributes).forEach(([k, v]) => site.setAttribute(k, v));
        document.body.append(site);
        return site;
    }

    it('subscribes view/reload/theme control topics', () => {
        makeViewerSite({subscribe: 'ctrl'});
        const topics = feezal.connection.sub.mock.calls.map(c => c[0]);
        expect(topics).toContain('ctrl/view');
        expect(topics).toContain('ctrl/reload');
        expect(topics).toContain('ctrl/theme');
    });

    it('switches the view on a view control message', () => {
        const site = makeViewerSite({subscribe: 'ctrl'});
        subscribedHandler(feezal.connection.sub, 'ctrl/view')({payload: 'kitchen'});
        expect(site.view).toBe('kitchen');
    });

    it('swaps the body theme class, accepting the bare suffix', () => {
        makeViewerSite({subscribe: 'ctrl'});
        document.body.classList.add('feezal-theme-old');
        subscribedHandler(feezal.connection.sub, 'ctrl/theme')({payload: 'dark-mint'});
        expect(document.body.classList.contains('feezal-theme-dark-mint')).toBe(true);
        expect(document.body.classList.contains('feezal-theme-old')).toBe(false);
        document.body.classList.remove('feezal-theme-dark-mint');
    });

    it('swaps the theme class on the site element too (deployed HTML bakes it there)', () => {
        const site = makeViewerSite({subscribe: 'ctrl'});
        site.classList.add('feezal-theme-old');
        subscribedHandler(feezal.connection.sub, 'ctrl/theme')({payload: 'dark-mint'});
        expect(site.classList.contains('feezal-theme-dark-mint')).toBe(true);
        expect(site.classList.contains('feezal-theme-old')).toBe(false);
        document.body.classList.remove('feezal-theme-dark-mint');
    });

    it('accepts a full theme class name verbatim', () => {
        makeViewerSite({subscribe: 'ctrl'});
        subscribedHandler(feezal.connection.sub, 'ctrl/theme')({payload: 'feezal-theme-light-sky'});
        expect(document.body.classList.contains('feezal-theme-light-sky')).toBe(true);
        document.body.classList.remove('feezal-theme-light-sky');
    });

    it('publishes view changes to the publish topic', () => {
        const site = makeViewerSite({publish: 'state'});
        site.view = 'kitchen';
        site._viewChanged('kitchen');
        expect(feezal.connection.pub).toHaveBeenCalledWith('state/view', 'kitchen');
    });

    it('applies addclass/removeclass control messages to the site', () => {
        const site = makeViewerSite({subscribe: 'ctrl'});
        site._viewChanged('home');
        subscribedHandler(feezal.connection.sub, 'ctrl/addclass')({payload: 'alert'});
        expect(site.classList.contains('alert')).toBe(true);
        subscribedHandler(feezal.connection.sub, 'ctrl/removeclass')({payload: 'alert'});
        expect(site.classList.contains('alert')).toBe(false);
    });

    it('keeps the address-bar hash in sync with the active view', () => {
        const site = makeViewerSite();
        site.view = 'kitchen';
        site._viewChanged('kitchen');
        expect(location.hash).toBe('#/kitchen');
    });

    it('does not subscribe control topics in the editor', () => {
        feezal.isEditor = true;
        feezal.connection = {sub: vi.fn(), pub: vi.fn()};
        feezal.views = makeViews('home');
        const site = document.createElement('feezal-site');
        site.setAttribute('subscribe', 'ctrl');
        document.body.append(site);
        expect(feezal.connection.sub).not.toHaveBeenCalled();
    });
});

describe('page title', () => {
    it('writes page-title into the document title', () => {
        document.head.innerHTML = '<title>before</title>';
        feezal.views = makeViews('home');
        const site = document.createElement('feezal-site');
        site.setAttribute('page-title', 'My Dashboard');
        document.body.append(site);
        expect(document.querySelector('title').innerHTML).toBe('My Dashboard');
    });
});

describe('_syncViewBackground() — document mirroring for iOS safe areas', () => {
    it('mirrors the view background to html/body in the viewer', () => {
        feezal.isEditor = false;
        const site = document.createElement('feezal-site');
        feezal.views = makeViews('home');
        feezal.views[0].style.background = 'rgb(4, 5, 6)';
        site.view = 'home';
        site._syncViewBackground();
        expect(document.body.style.background).toContain('rgb(4, 5, 6)');
        expect(document.documentElement.style.background).toContain('rgb(4, 5, 6)');
        document.documentElement.style.background = '';
    });

    it('does not touch the document in the editor', () => {
        feezal.isEditor = true;
        const site = document.createElement('feezal-site');
        feezal.views = makeViews('home');
        feezal.views[0].style.background = 'rgb(7, 8, 9)';
        site.view = 'home';
        site._syncViewBackground();
        expect(document.body.style.background).not.toContain('rgb(7, 8, 9)');
    });
});

// B62 — a gradient view background used to tile and scroll away on the iOS
// viewer: the site's own background-attachment:local layer repeats down the
// scroll area. Gradients now come off the site entirely and are painted by the
// (viewport-sized, non-scrolling) document root mirror, no-repeat + cover.
describe('_syncViewBackground() — gradient backgrounds (B62)', () => {
    const GRADIENT = 'linear-gradient(180deg, rgb(1, 2, 3) 0%, rgb(9, 8, 7) 100%)';

    function syncedSite(background, {editor = false} = {}) {
        feezal.isEditor = editor;
        const site = document.createElement('feezal-site');
        feezal.views = makeViews('home');
        feezal.views[0].style.background = background;
        site.view = 'home';
        site._syncViewBackground();
        return site;
    }

    afterEach(() => {
        for (const el of [document.documentElement, document.body]) el.style.background = '';
    });

    it('flags a gradient view so the site stops painting the canvas itself', () => {
        const site = syncedSite(GRADIENT);
        expect(site.hasAttribute('gradient-bg')).toBe(true);
    });

    it('paints the gradient on html/body no-repeat, covering the viewport', () => {
        syncedSite(GRADIENT);
        for (const el of [document.documentElement, document.body]) {
            expect(el.style.backgroundImage).toContain('linear-gradient');
            expect(el.style.backgroundRepeat).toBe('no-repeat');
            expect(el.style.backgroundSize).toBe('cover');
            expect(el.style.backgroundAttachment).toBe('fixed');
        }
    });

    it('leaves solid colours on the pre-B62 path', () => {
        const site = syncedSite('rgb(1, 2, 3)');
        expect(site.hasAttribute('gradient-bg')).toBe(false);
        expect(site.style.getPropertyValue('--feezal-canvas-bg')).toContain('rgb(1, 2, 3)');
        // The shorthand alone — no gradient-only cover/fixed pinning.
        expect(document.body.style.backgroundRepeat).not.toBe('no-repeat');
        expect(document.body.style.backgroundSize).not.toBe('cover');
        expect(document.body.style.backgroundAttachment).not.toBe('fixed');
    });

    it('drops the flag again when the view switches back to a solid colour', () => {
        const site = syncedSite(GRADIENT);
        expect(site.hasAttribute('gradient-bg')).toBe(true);
        feezal.views[0].style.background = 'rgb(1, 2, 3)';
        site._syncViewBackground();
        expect(site.hasAttribute('gradient-bg')).toBe(false);
    });

    it('never flags in the editor — the checkerboard stays (U61)', () => {
        const site = syncedSite(GRADIENT, {editor: true});
        expect(site.hasAttribute('gradient-bg')).toBe(false);
        expect(site.style.getPropertyValue('--feezal-canvas-bg')).toContain('linear-gradient');
    });

    it('recognises radial and conic gradients too', () => {
        for (const bg of ['radial-gradient(circle, red, blue)', 'conic-gradient(red, blue)',
            'repeating-linear-gradient(45deg, red 0 10px, blue 10px 20px)']) {
            expect(syncedSite(bg).hasAttribute('gradient-bg'), bg).toBe(true);
        }
    });
});

// ── N30: layout-app view-router delegation ─────────────────────────────────
import {viewPathFromHash} from '../src/hash-view.js';

describe('viewPathFromHash() (N30)', () => {
    it('splits bare and nested hashes and decodes each segment', () => {
        expect(viewPathFromHash('#/main')).toEqual({view: 'main', embedded: null});
        expect(viewPathFromHash('#/main/page2')).toEqual({view: 'main', embedded: 'page2'});
        expect(viewPathFromHash('#/K%C3%BCche/B%C3%BCro')).toEqual({view: 'Küche', embedded: 'Büro'});
        expect(viewPathFromHash('')).toEqual({view: '', embedded: null});
    });
});

describe('site ↔ view-router delegation (N30)', () => {
    // Minimal fake router = a layout-app stand-in inside a feezal-view.
    function makeRouter(viewName, entries) {
        const holder = document.createElement('feezal-view');
        holder.setAttribute('name', viewName);
        const router = document.createElement('div');
        router.routableViews = () => entries;
        router._embedded = null;
        router.activeEmbedded = () => router._embedded;
        router.routeToEmbedded = vi.fn(name => { router._embedded = name; });
        holder.append(router);
        document.body.append(holder);
        return router;
    }

    function viewerSite(attrs = {}) {
        feezal.isEditor = false;
        feezal.connection = {sub: vi.fn(), pub: vi.fn()};
        feezal.views = makeViews('main', 'other');
        const site = document.createElement('feezal-site');
        Object.entries(attrs).forEach(([k, v]) => site.setAttribute(k, v));
        document.body.append(site);
        return site;
    }

    it('publishes and hashes the nested path when a visible router shows a sub-view', () => {
        const site = viewerSite({publish: 'state'});
        const router = makeRouter('main', ['page1', 'page2']);
        site.registerViewRouter(router);
        site.view = 'main';
        router._embedded = 'page2';
        site._viewChanged('main');
        expect(feezal.connection.pub).toHaveBeenCalledWith('state/view', 'main/page2');
        expect(location.hash).toBe('#/main/page2');
    });

    it('a bare inbound view command routes inside the visible router (no top-level switch)', () => {
        const site = viewerSite({publish: 'state'});
        const router = makeRouter('main', ['page1', 'page2']);
        site.registerViewRouter(router);
        site.view = 'main';
        feezal.connection.pub.mockClear();
        site.applyControlCommand('view', 'page2');
        expect(router.routeToEmbedded).toHaveBeenCalledWith('page2');
        expect(site.view).toBe('main');                               // top-level unchanged
        expect(feezal.connection.pub).toHaveBeenCalledWith('state/view', 'main/page2');
    });

    it('a bare command for a non-embedded name still switches the top-level view', () => {
        const site = viewerSite();
        const router = makeRouter('main', ['page1']);
        site.registerViewRouter(router);
        site.view = 'main';
        site.applyControlCommand('view', 'other');
        expect(site.view).toBe('other');
    });

    it('a nested inbound command switches top-level and routes the embedded view', async () => {
        const site = viewerSite();
        const router = makeRouter('main', ['page1', 'page2']);
        site.registerViewRouter(router);
        site.view = 'other';
        await site.updateComplete;
        site.applyControlCommand('view', 'main/page2');
        expect(site.view).toBe('main');
        await site.updateComplete;                       // _viewChanged applies the pending embedded
        expect(router.routeToEmbedded).toHaveBeenCalledWith('page2');
    });

    it('applies a deep-link embedded view once the router registers (order-independent)', () => {
        location.hash = '#/main/page2';
        const site = viewerSite();
        expect(site.view).toBe('main');
        const router = makeRouter('main', ['page1', 'page2']);
        site.registerViewRouter(router);                              // registers late
        expect(router.routeToEmbedded).toHaveBeenCalledWith('page2');
    });

    it('a plain site with no routers behaves exactly as before', () => {
        const site = viewerSite({publish: 'state'});
        site.applyControlCommand('view', 'other');
        expect(site.view).toBe('other');
        site._viewChanged('other');
        expect(feezal.connection.pub).toHaveBeenCalledWith('state/view', 'other');
        expect(location.hash).toBe('#/other');
    });
});

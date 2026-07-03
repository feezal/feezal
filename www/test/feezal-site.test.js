import {describe, it, expect, vi, beforeEach} from 'vitest';

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

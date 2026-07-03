import {describe, it, expect, beforeEach} from 'vitest';

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

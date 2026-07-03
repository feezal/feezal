/**
 * Component tests for feezal-site + feezal-view — real shadow DOM behaviour
 * that happy-dom can't verify: ::slotted() styling, view switching with the
 * Lit lifecycle, URL-hash sync and the MutationObserver background sync.
 */
import {describe, it, expect, beforeEach, vi} from 'vitest';
import '../src/feezal-site.js';
import '../src/feezal-view.js';
import {setupFeezal} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
    location.hash = '';
});

function makeView(name) {
    const view = document.createElement('feezal-view');
    view.setAttribute('name', name);
    return view;
}

/** feezal-site with views attached to the document, initial view = first. */
async function mountSite(...names) {
    const site = document.createElement('feezal-site');
    feezal.views = names.map(makeView);
    site.append(...feezal.views);
    document.body.append(site);
    await site.updateComplete;
    await Promise.all(feezal.views.map(v => v.updateComplete));
    return site;
}

describe('feezal-view ::slotted styling', () => {
    it('positions slotted children absolutely by default', async () => {
        const view = makeView('home');
        const child = document.createElement('div');
        view.append(child);
        document.body.append(view);
        await view.updateComplete;
        expect(getComputedStyle(child).position).toBe('absolute');
    });

    it('keeps children static with child-position="static"', async () => {
        const view = makeView('home');
        view.setAttribute('child-position', 'static');
        const child = document.createElement('div');
        view.append(child);
        document.body.append(view);
        await view.updateComplete;
        expect(getComputedStyle(child).position).toBe('static');
    });
});

describe('view switching', () => {
    it('starts on the first view and writes the URL hash', async () => {
        const site = await mountSite('home', 'kitchen');
        expect(site.view).toBe('home');
        expect(location.hash).toBe('#/home');
        expect(getComputedStyle(feezal.views[1]).display).toBe('none');
        expect(getComputedStyle(feezal.views[0]).display).not.toBe('none');
    });

    it('adopts the view from a pre-set hash', async () => {
        location.hash = '#/kitchen';
        const site = await mountSite('home', 'kitchen');
        expect(site.view).toBe('kitchen');
    });

    it('switching the view flips visibility, hash and element visible flags', async () => {
        const site = await mountSite('home', 'kitchen');
        const element = document.createElement('feezal-element-test-visibility');
        feezal.views[1].append(element);

        site.view = 'kitchen';
        await site.updateComplete;

        expect(location.hash).toBe('#/kitchen');
        expect(getComputedStyle(feezal.views[0]).display).toBe('none');
        expect(getComputedStyle(feezal.views[1]).display).not.toBe('none');
        expect(element.visible).toBe(true);

        site.view = 'home';
        await site.updateComplete;
        expect(element.visible).toBe(false);
    });

    it('publishes the view change when a publish base is set', async () => {
        const site = await mountSite('home', 'kitchen');
        site.setAttribute('publish', 'feezal/site');
        site.view = 'kitchen';
        await site.updateComplete;
        expect(feezal.connection.published).toContainEqual(
            {topic: 'feezal/site/view', payload: 'kitchen'}
        );
    });

    it('follows view/addclass/removeclass control topics when subscribed', async () => {
        location.hash = '';
        const site = document.createElement('feezal-site');
        site.setAttribute('subscribe', 'ctl/site');
        feezal.views = [makeView('home'), makeView('kitchen')];
        site.append(...feezal.views);
        document.body.append(site);
        await site.updateComplete;

        feezal.connection.deliver('ctl/site/view', 'kitchen');
        await site.updateComplete;
        expect(site.view).toBe('kitchen');

        feezal.connection.deliver('ctl/site/addclass', 'nightmode');
        expect(site.classList.contains('nightmode')).toBe(true);
        feezal.connection.deliver('ctl/site/removeclass', 'nightmode');
        expect(site.classList.contains('nightmode')).toBe(false);
    });
});

describe('canvas background sync', () => {
    it('mirrors the active view background and tracks later style changes', async () => {
        const site = await mountSite('home');
        feezal.views[0].style.background = 'rgb(1, 2, 3)';
        site._syncViewBackground();
        expect(site.style.getPropertyValue('--feezal-canvas-bg')).toContain('rgb(1, 2, 3)');

        // MutationObserver picks up subsequent style mutations.
        feezal.views[0].style.background = 'rgb(4, 5, 6)';
        await vi.waitFor(() => {
            expect(site.style.getPropertyValue('--feezal-canvas-bg')).toContain('rgb(4, 5, 6)');
        });
    });
});

describe('viewer theme class mirroring', () => {
    it('copies feezal-theme-* classes to document.body', async () => {
        const site = document.createElement('feezal-site');
        site.classList.add('feezal-theme-dark-mint');
        feezal.views = [makeView('home')];
        site.append(...feezal.views);
        document.body.append(site);
        await site.updateComplete;
        expect(document.body.classList.contains('feezal-theme-dark-mint')).toBe(true);
        document.body.classList.remove('feezal-theme-dark-mint');
    });
});

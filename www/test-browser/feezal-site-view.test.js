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

    it('B30: opens views with umlauts in the name (percent-encoded hash)', async () => {
        // Browsers store non-ASCII hashes percent-encoded — location.hash
        // reads back "#/K%C3%BCche" after assigning "#/Küche".
        location.hash = '#/Küche';
        const site = await mountSite('home', 'Küche');
        expect(site.view).toBe('Küche');
        expect(getComputedStyle(feezal.views[1]).display).not.toBe('none');
    });

    it('B30: switching to an umlaut view syncs the hash without looping', async () => {
        const site = await mountSite('home', 'Küche');
        site.view = 'Küche';
        await site.updateComplete;
        expect(decodeURIComponent(location.hash)).toBe('#/Küche');

        // A second update pass must not consider the hash out of sync
        // (raw comparison of encoded vs raw would re-write it every time).
        const before = location.hash;
        site._viewChanged(site.view);
        expect(location.hash).toBe(before);
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

/**
 * A38 — an absolute view must be the CONTAINING BLOCK for its children.
 *
 * Every element's inline top/left is view-relative: that is what the style
 * inspector writes, what B80 stashes and restores across a mode switch, and
 * what align/distribute computes against. It only holds while the view itself
 * is positioned — which was never declared, and worked for years only because
 * DragSelect set position:relative on its area element. Dropping that library
 * removed the containing block and silently broke element offsets, the canvas
 * scroll extent and align/distribute at once. Hence an explicit test.
 */
describe('absolute views establish a containing block', () => {
    it('positions a child relative to the VIEW, not an outer ancestor', async () => {
        // An offset ancestor: without the rule the child would resolve against
        // this instead, landing 40/30px off.
        const outer = document.createElement('div');
        outer.style.cssText = 'position:relative; padding:30px 0 0 40px;';
        document.body.append(outer);

        const view = document.createElement('feezal-view');
        view.setAttribute('name', 'abs');
        view.setAttribute('child-position', 'absolute');
        view.style.cssText = 'display:block; width:400px; height:300px;';
        const child = document.createElement('div');
        child.style.cssText = 'width:20px; height:20px;';
        child.style.left = '50px';
        child.style.top = '100px';
        view.append(child);
        outer.append(view);
        await view.updateComplete;

        expect(getComputedStyle(view).position).toBe('relative');
        const vr = view.getBoundingClientRect();
        const cr = child.getBoundingClientRect();
        expect(Math.round(cr.left - vr.left)).toBe(50);
        expect(Math.round(cr.top - vr.top)).toBe(100);
        outer.remove();
    });

    it('does not force position on container-placed views', async () => {
        // flow/grid children are laid out by the container; the host does not
        // need to be a containing block, and forcing it could change stacking.
        for (const mode of ['flow', 'grid']) {
            const view = document.createElement('feezal-view');
            view.setAttribute('name', 'c-' + mode);
            view.setAttribute('child-position', mode);
            view.style.cssText = 'display:block; width:200px; height:200px;';
            document.body.append(view);
            await view.updateComplete;
            expect(getComputedStyle(view).position, mode).toBe('static');
            view.remove();
        }
    });
});

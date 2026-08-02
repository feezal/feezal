/**
 * U97 — the editor status line.
 *
 * The footer owns no model: every segment is derived from the site DOM at
 * render time, and the only subscription is a MutationObserver on the site.
 * That is the property worth testing — not "does it print a number" but "does
 * the number follow the canvas", including the two cases that made the Layers
 * panel's version of this non-trivial: a site that arrives LATE (the shell
 * renders its chrome before the socket delivers the markup), and a site that is
 * REPLACED when the editor switches sites.
 */
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';

import '../src/feezal-footer.js';
import {formatBytes} from '../src/feezal-footer.js';

/** A stand-in site: views with elements, and an optional selection. */
function makeSite({views = 1, perView = 2, theme = null} = {}) {
    const site = document.createElement('feezal-site');
    if (theme) site.classList.add(`feezal-theme-${theme}`);
    for (let v = 0; v < views; v++) {
        const view = document.createElement('feezal-view');
        view.setAttribute('name', `view${v + 1}`);
        for (let e = 0; e < perView; e++) {
            const el = document.createElement('feezal-element-basic-number');
            el.setAttribute('label', `el${e + 1}`);
            view.append(el);
        }
        site.append(view);
    }
    document.body.append(site);
    return site;
}

async function mountFooter() {
    const footer = document.createElement('feezal-footer');
    document.body.append(footer);
    await footer.updateComplete;
    return footer;
}

/** Let the observer's microtask land, then the re-render. */
async function settle(footer) {
    await new Promise(r => setTimeout(r, 0));
    await footer.updateComplete;
}

const text = footer => footer.shadowRoot.textContent.replace(/\s+/g, ' ').trim();

beforeEach(() => {
    document.body.innerHTML = '';
    window.feezal = {site: null, view: null, connection: null};
});

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('formatBytes — the size a person reads', () => {
    it('scales through B / kB / MB', () => {
        expect(formatBytes(512)).toBe('512 B');
        expect(formatBytes(2048)).toBe('2.0 kB');
        expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
    });
});

describe('U97 — the footer reports the site', () => {
    it('counts views and elements', async () => {
        window.feezal.site = makeSite({views: 3, perView: 4});
        const footer = await mountFooter();
        await settle(footer);
        expect(text(footer)).toContain('3 views');
        expect(text(footer)).toContain('12 elements');
    });

    it('says "1 view", not "1 views"', async () => {
        window.feezal.site = makeSite({views: 1, perView: 1});
        const footer = await mountFooter();
        await settle(footer);
        expect(text(footer)).toContain('1 view ');
        expect(text(footer)).toContain('1 element ');
    });

    it('counts component instances as elements too', async () => {
        const site = makeSite({views: 1, perView: 1});
        site.querySelector('feezal-view').append(document.createElement('feezal-component'));
        window.feezal.site = site;
        const footer = await mountFooter();
        await settle(footer);
        expect(text(footer)).toContain('2 elements');
    });

    it('follows the canvas when an element is added', async () => {
        window.feezal.site = makeSite({views: 1, perView: 1});
        const footer = await mountFooter();
        await settle(footer);
        expect(text(footer)).toContain('1 element ');

        window.feezal.site.querySelector('feezal-view')
            .append(document.createElement('feezal-element-basic-number'));
        await settle(footer);
        expect(text(footer)).toContain('2 elements');
    });

    it('reports the distinct subscribed topics, not the subscription rows', async () => {
        window.feezal.site = makeSite();
        window.feezal.connection = {subscriptions: [
            {topic: 'a/b'}, {topic: 'a/b'}, {topic: 'c/d'}, {topic: null},
        ]};
        const footer = await mountFooter();
        await settle(footer);
        // Two distinct topics; the duplicate and the empty one do not count.
        expect(footer._topics).toBe(2);
    });

    it('names the active theme, defaulting when the site carries none', async () => {
        window.feezal.site = makeSite({theme: 'midnight-blue'});
        const footer = await mountFooter();
        await settle(footer);
        expect(text(footer)).toContain('midnight-blue');

        window.feezal.site.classList.remove('feezal-theme-midnight-blue');
        await settle(footer);
        expect(text(footer)).toContain('default');
    });
});

describe('U97 — the selection echo', () => {
    it('names the selected element by type and label', async () => {
        window.feezal.site = makeSite({views: 1, perView: 2});
        window.feezal.site.querySelector('[label="el2"]').classList.add('feezal-selected');
        const footer = await mountFooter();
        await settle(footer);
        expect(text(footer)).toContain('basic-number');
        expect(text(footer)).toContain('el2');
    });

    it('counts a multi-selection instead of naming one of them', async () => {
        window.feezal.site = makeSite({views: 1, perView: 3});
        for (const el of window.feezal.site.querySelectorAll('feezal-element-basic-number')) {
            el.classList.add('feezal-selected');
        }
        const footer = await mountFooter();
        await settle(footer);
        expect(text(footer)).toContain('3 elements');
    });

    it('falls back to the current view when nothing is selected', async () => {
        window.feezal.site = makeSite({views: 2, perView: 1});
        window.feezal.view = window.feezal.site.querySelectorAll('feezal-view')[1];
        const footer = await mountFooter();
        await settle(footer);
        expect(text(footer)).toContain('view');
        expect(text(footer)).toContain('view2');
    });

    it('tracks selection changes written as a class by the canvas', async () => {
        window.feezal.site = makeSite({views: 1, perView: 2});
        const footer = await mountFooter();
        await settle(footer);
        const el = window.feezal.site.querySelector('[label="el1"]');
        el.classList.add('feezal-selected');
        await settle(footer);
        expect(text(footer)).toContain('el1');
    });
});

describe('U97 — the observer contract', () => {
    it('waits for a site that arrives late', async () => {
        // The shell renders its chrome before the socket delivers the markup.
        const footer = await mountFooter();
        await settle(footer);
        expect(text(footer)).toContain('0 views');

        window.feezal.site = makeSite({views: 2, perView: 1});
        // The retry timer, not a re-render, is what has to notice.
        await new Promise(r => setTimeout(r, 300));
        await footer.updateComplete;
        expect(text(footer)).toContain('2 views');
    });

    it('re-attaches when the editor swaps the site element', async () => {
        window.feezal.site = makeSite({views: 1, perView: 1});
        const footer = await mountFooter();
        await settle(footer);

        window.feezal.site.remove();
        window.feezal.site = makeSite({views: 4, perView: 1});
        footer.requestUpdate();               // what a site switch triggers
        await footer.updateComplete;
        await settle(footer);
        expect(text(footer)).toContain('4 views');
    });

    it('does not re-measure the size for an attribute-only change', async () => {
        // outerHTML walks the whole site; a drag writes classes every frame, so
        // paying for that per frame is exactly what the cache exists to avoid.
        window.feezal.site = makeSite({views: 2, perView: 3});
        const footer = await mountFooter();
        await settle(footer);
        const structureAt = footer._structure;

        window.feezal.site.querySelector('feezal-element-basic-number')
            .classList.add('feezal-selected');
        await settle(footer);
        expect(footer._structure).toBe(structureAt);       // no re-measure

        window.feezal.site.querySelector('feezal-view')
            .append(document.createElement('feezal-element-basic-number'));
        await settle(footer);
        expect(footer._structure).toBeGreaterThan(structureAt);
    });

    /**
     * B119 — the footer's own first version shipped an invalid selector, and
     * the failure did not stay local: re-rendering on every mutation turned one
     * bad getter into an unhandled-rejection storm that took the editor's
     * right-click menu with it. The selector is fixed; this pins the shape.
     */
    it('degrades to a quiet row instead of throwing', async () => {
        window.feezal.site = makeSite();
        const footer = await mountFooter();
        await settle(footer);
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Any getter can be handed something it did not expect.
        Object.defineProperty(footer, '_views', {
            get() { throw new TypeError('hostile DOM'); }, configurable: true,
        });
        footer.requestUpdate();
        await expect(footer.updateComplete).resolves.not.toThrow();
        expect(text(footer)).toBe('—');
        expect(console.warn).toHaveBeenCalled();
    });

    it('recovers on the next render once the cause is gone', async () => {
        window.feezal.site = makeSite({views: 2, perView: 1});
        const footer = await mountFooter();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        Object.defineProperty(footer, '_views', {
            get() { throw new TypeError('hostile DOM'); }, configurable: true,
        });
        footer.requestUpdate();
        await footer.updateComplete;

        delete footer._views;                    // back to the prototype getter
        footer.requestUpdate();
        await footer.updateComplete;
        expect(text(footer)).toContain('2 views');
    });

    it('stops observing once detached', async () => {
        window.feezal.site = makeSite();
        const footer = await mountFooter();
        await settle(footer);
        const before = footer._revision;
        footer.remove();
        window.feezal.site.querySelector('feezal-view')
            .append(document.createElement('feezal-element-basic-number'));
        await new Promise(r => setTimeout(r, 0));
        expect(footer._revision).toBe(before);
    });
});

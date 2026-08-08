/**
 * B-repro — glass-search on a grid Portal view (user report): typing a term
 * did nothing. Reproduces the exact reported shape: child-position="grid",
 * glass theme class, glass-links with href + blank-ish labels, viewer mode.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-glass-search/feezal-element-glass-search.js';
import '../packages/@feezal/feezal-element-glass-link/feezal-element-glass-link.js';
import '../packages/@feezal/feezal-element-layout-app/feezal-element-layout-app.js';
import '../src/feezal-view.js';
import {setupFeezal, until} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();   // viewer mode
});

describe('E170 repro — search on a grid view', () => {
    it('typing filters the grid links by label/href', async () => {
        const view = document.createElement('feezal-view');
        view.setAttribute('name', 'Portal');
        view.setAttribute('child-position', 'grid');
        view.className = 'feezal-theme-glass';
        view.style.cssText = 'width:800px;height:600px;';
        view.innerHTML = `
            <feezal-element-glass-search class="feezal-element" placeholder="Search…" style="width:332px;height:53px;"></feezal-element-glass-search>
            <feezal-element-glass-link label=" " class="feezal-element" href="https://search.lan.example/" open="new-tab" style="width:172px;height:128px;" visible=""></feezal-element-glass-link>
            <feezal-element-glass-link label="Bookstack Wiki" class="feezal-element" href="https://bookstack.lan.example/" open="new-tab" style="width:172px;height:128px;" visible=""></feezal-element-glass-link>
            <feezal-element-glass-link label="Gitea" class="feezal-element" href="https://git.lan.example/" open="new-tab" style="width:172px;height:128px;" visible=""></feezal-element-glass-link>
        `;
        document.body.append(view);
        const search = view.querySelector('feezal-element-glass-search');
        await search.updateComplete;

        const input = search.shadowRoot.querySelector('input');
        expect(input).toBeTruthy();
        input.value = 'gitea';
        input.dispatchEvent(new Event('input', {bubbles: true}));

        const links = [...view.querySelectorAll('feezal-element-glass-link')];
        await until(() => links.some(l => l.hasAttribute('feezal-search-hidden')));
        expect(links[0].hasAttribute('feezal-search-hidden')).toBe(true);   // searxng (href only)
        expect(links[1].hasAttribute('feezal-search-hidden')).toBe(true);   // bookstack
        expect(links[2].hasAttribute('feezal-search-hidden')).toBe(false);  // gitea
        // and the hidden ones are actually not rendered
        expect(getComputedStyle(links[0]).display).toBe('none');
        expect(getComputedStyle(links[2]).display).not.toBe('none');
    });
});

describe('E170 — the editor no-op is DISCOVERABLE (the reported gap)', () => {
    it('typing on the editor canvas filters nothing but says so', async () => {
        feezal.isEditor = true;
        const view = document.createElement('feezal-view');
        view.setAttribute('name', 'p');
        view.innerHTML = '<feezal-element-glass-search></feezal-element-glass-search>' +
            '<feezal-element-glass-link label=Gitea href=https://git.example/></feezal-element-glass-link>';
        document.body.append(view);
        const search = view.querySelector('feezal-element-glass-search');
        await search.updateComplete;

        const input = search.shadowRoot.querySelector('input');
        input.value = 'zzz';
        input.dispatchEvent(new Event('input', {bubbles: true}));
        await new Promise(r => setTimeout(r, 300));
        await search.updateComplete;

        // nothing hidden (the decided contract) ...
        expect(view.querySelector('[feezal-search-hidden]')).toBeNull();
        // ... but the field SAYS why, instead of a silent no-op
        expect(search.shadowRoot.querySelector('.search-editor-note')).toBeTruthy();
    });

    it('the viewer shows no such note', async () => {
        feezal.isEditor = false;
        const view = document.createElement('feezal-view');
        view.setAttribute('name', 'p');
        view.innerHTML = '<feezal-element-glass-search></feezal-element-glass-search>';
        document.body.append(view);
        const search = view.querySelector('feezal-element-glass-search');
        await search.updateComplete;
        const input = search.shadowRoot.querySelector('input');
        input.value = 'x';
        input.dispatchEvent(new Event('input', {bubbles: true}));
        await search.updateComplete;
        expect(search.shadowRoot.querySelector('.search-editor-note')).toBeNull();
    });
});

describe('E170 — search inside a layout-app SUB-VIEW (shadow-embedded clone)', () => {
    it('filters the clone siblings AND they actually disappear', async () => {
        // Reported: works on a normal view, does nothing on a layout-app
        // sub-view. The clone lives in the shell SHADOW root, where the
        // document-level hiding rule cannot reach - the attribute was set,
        // nothing hid. The rule must be injected into the clone root too.
        const site = document.createElement('div');
        const view = document.createElement('feezal-view');
        view.setAttribute('name', 'portal');
        view.innerHTML =
            '<feezal-element-glass-search></feezal-element-glass-search>' +
            '<feezal-element-glass-link label=Gitea href=https://git.example/></feezal-element-glass-link>' +
            '<feezal-element-glass-link label=Mealie href=https://mealie.example/></feezal-element-glass-link>';
        site.append(view);
        document.body.append(site);
        feezal.site = site;

        const app = document.createElement('feezal-element-layout-app');
        app.setAttribute('items', JSON.stringify([{label: 'Portal', view: 'portal'}]));
        app.style.cssText = 'display:block;width:900px;height:600px;';
        document.body.append(app);
        await app.updateComplete;
        app._active = 'portal';
        app._embed(true);

        const clone = app.shadowRoot.querySelector('#content feezal-view');
        expect(clone).toBeTruthy();
        const search = clone.querySelector('feezal-element-glass-search');
        await search.updateComplete;

        const input = search.shadowRoot.querySelector('input');
        input.value = 'gitea';
        input.dispatchEvent(new Event('input', {bubbles: true}));

        const links = [...clone.querySelectorAll('feezal-element-glass-link')];
        await until(() => links.some(l => l.hasAttribute('feezal-search-hidden')));
        expect(links[1].hasAttribute('feezal-search-hidden')).toBe(true);
        // THE reported failure mode: attribute set but still visible - the
        // hiding rule must exist inside the shadow root.
        expect(getComputedStyle(links[1]).display).toBe('none');
        expect(getComputedStyle(links[0]).display).not.toBe('none');
        expect(app.shadowRoot.querySelector('#feezal-search-filter-style')).toBeTruthy();
    });
});

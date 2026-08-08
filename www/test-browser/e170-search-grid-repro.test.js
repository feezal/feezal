/**
 * B-repro — glass-search on a grid Portal view (user report): typing a term
 * did nothing. Reproduces the exact reported shape: child-position="grid",
 * glass theme class, glass-links with href + blank-ish labels, viewer mode.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-glass-search/feezal-element-glass-search.js';
import '../packages/@feezal/feezal-element-glass-link/feezal-element-glass-link.js';
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

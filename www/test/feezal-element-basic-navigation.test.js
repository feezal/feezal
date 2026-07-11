import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../packages/@feezal/feezal-element-basic-navigation/feezal-element-basic-navigation.js';

// A stand-in for feezal-site: `view` is a property reflected to the attribute,
// exactly like the Lit-reflected property the element observes (B23).
function makeFakeSite(initialView) {
    const site = document.createElement('div');
    Object.defineProperty(site, 'view', {
        get() { return this.getAttribute('view'); },
        set(v) { this.setAttribute('view', v); },
    });
    if (initialView) site.setAttribute('view', initialView);
    document.body.append(site);
    return site;
}

beforeEach(() => {
    feezal.connection = {sub: vi.fn(() => ({})), unsubscribe: vi.fn(), pub: vi.fn()};
    feezal.isEditor = false;
});

afterEach(() => {
    feezal.site = undefined;
    document.body.innerHTML = '';
});

async function mount(attrs = {}) {
    const el = document.createElement('feezal-element-basic-navigation');
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }

    document.body.append(el);
    await el.updateComplete;
    return el;
}

const activeLabels = el => [...el.shadowRoot.querySelectorAll('button.active')].map(b => b.textContent);

// B23: the highlight must follow the active view from ANY source (first load,
// URL hash, another navigation element), not only this element's own clicks.
describe('active-view sync (B23)', () => {
    it('highlights the initially active view on first load', async () => {
        feezal.site = makeFakeSite('Home');
        const el = await mount({views: 'Home, Settings'});
        expect(activeLabels(el)).toEqual(['Home']);
    });

    it('follows an external view switch (attribute set by someone else)', async () => {
        feezal.site = makeFakeSite('Home');
        const el = await mount({views: 'Home, Settings'});

        feezal.site.setAttribute('view', 'Settings');   // hash change / navbar / MQTT
        await vi.waitFor(async () => {
            await el.updateComplete;
            expect(activeLabels(el)).toEqual(['Settings']);
        });
    });

    it('picks up the view when the site gains it only after connect', async () => {
        feezal.site = makeFakeSite();                    // no view yet
        const el = await mount({views: 'Home, Settings'});
        expect(activeLabels(el)).toEqual([]);

        feezal.site.setAttribute('view', 'Home');        // deep-link resolution
        await vi.waitFor(async () => {
            await el.updateComplete;
            expect(activeLabels(el)).toEqual(['Home']);
        });
    });

    it('clicking a button navigates via the reflected site.view property', async () => {
        feezal.site = makeFakeSite('Home');
        const el = await mount({views: 'Home, Settings'});

        [...el.shadowRoot.querySelectorAll('button')].find(b => b.textContent === 'Settings').click();
        expect(feezal.site.getAttribute('view')).toBe('Settings');
        await vi.waitFor(async () => {
            await el.updateComplete;
            expect(activeLabels(el)).toEqual(['Settings']);
        });
    });
});

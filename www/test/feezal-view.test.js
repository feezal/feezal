import {describe, it, expect, vi} from 'vitest';

import '../src/feezal-view.js';

function makeView(name) {
    const view = document.createElement('feezal-view');
    if (name) view.setAttribute('name', name);
    return view;
}

describe('feezal-view visibility', () => {
    it('hides the view element itself when not visible', () => {
        const view = makeView('home');
        view._visibleChange(false);
        expect(view.style.display).toBe('none');
        view._visibleChange(true);
        expect(view.style.display).toBe('');
    });

    it('propagates visibility to feezal-element-* descendants', () => {
        const view = makeView('home');
        const light = document.createElement('feezal-element-material-light');
        const nested = document.createElement('feezal-element-basic-image');
        const wrapper = document.createElement('div');
        wrapper.append(nested);
        view.append(light, wrapper);

        view._visibleChange(true);
        expect(light.visible).toBe(true);
        expect(nested.visible).toBe(true);

        view._visibleChange(false);
        expect(light.visible).toBe(false);
        expect(nested.visible).toBe(false);
    });

    it('leaves non-feezal children untouched', () => {
        const view = makeView('home');
        const div = document.createElement('div');
        view.append(div);
        view._visibleChange(true);
        expect(div.visible).toBeUndefined();
    });

    it('defaults childPosition to absolute', () => {
        expect(makeView().childPosition).toBe('absolute');
    });
});

describe('viewer addclass/removeclass subscriptions', () => {
    function subscribedHandler(sub, topic) {
        return sub.mock.calls.find(call => call[0] === topic)[1];
    }

    it('registers addclass/removeclass topics in the viewer and applies them', () => {
        feezal.isEditor = false;
        feezal.connection = {sub: vi.fn()};
        const view = makeView('home');
        view.subscribe = 'ctrl/home';
        document.body.append(view);

        expect(feezal.connection.sub).toHaveBeenCalledTimes(2);

        subscribedHandler(feezal.connection.sub, 'ctrl/home/addclass')({payload: 'alert'});
        expect(view.classList.contains('alert')).toBe(true);

        subscribedHandler(feezal.connection.sub, 'ctrl/home/removeclass')({payload: 'alert'});
        expect(view.classList.contains('alert')).toBe(false);
    });

    it('does not subscribe in the editor', () => {
        feezal.isEditor = true;
        feezal.connection = {sub: vi.fn()};
        const view = makeView('home');
        view.subscribe = 'ctrl/home';
        document.body.append(view);
        expect(feezal.connection.sub).not.toHaveBeenCalled();
    });

    it('does not subscribe without a subscribe topic', () => {
        feezal.isEditor = false;
        feezal.connection = {sub: vi.fn()};
        document.body.append(makeView('home'));
        expect(feezal.connection.sub).not.toHaveBeenCalled();
    });
});

// ── U41: flow layout ───────────────────────────────────────────────────────
describe('feezal-view flow layout (U41)', () => {
    it('aliases the legacy child-position="static" to "flow" on load', async () => {
        const view = makeView('home');
        view.setAttribute('child-position', 'static');
        document.body.append(view);
        await view.updateComplete;
        await view.updateComplete;   // alias sets the prop, reflection flushes next cycle
        // updated() rewrites it; the alias reflects to the attribute (saves flow).
        expect(view.childPosition).toBe('flow');
        expect(view.getAttribute('child-position')).toBe('flow');
    });

    it('maps the flow-* attributes onto --feezal-flow-* custom properties', async () => {
        const view = makeView('home');
        view.setAttribute('child-position', 'flow');
        view.setAttribute('flow-gap', '16');
        view.setAttribute('flow-direction', 'column');
        view.setAttribute('flow-justify', 'space-between');
        view.setAttribute('flow-align', 'stretch');
        document.body.append(view);
        await view.updateComplete;
        expect(view.style.getPropertyValue('--feezal-flow-gap')).toBe('16px');
        expect(view.style.getPropertyValue('--feezal-flow-direction')).toBe('column');
        expect(view.style.getPropertyValue('--feezal-flow-justify')).toBe('space-between');
        expect(view.style.getPropertyValue('--feezal-flow-align')).toBe('stretch');
    });

    it('exposes flow knobs as attributes gated on child-position="flow" (U39 visibleWhen)', () => {
        const attrs = customElements.get('feezal-view').feezal.attributes;
        const gap = attrs.find(a => a.name === 'flow-gap');
        expect(gap).toBeTruthy();
        expect(gap.visibleWhen).toEqual({attr: 'child-position', equals: 'flow'});
        // The child-position dropdown is kebab-named so its value keys the U39
        // visibleWhen map — and offers absolute | flow (no legacy "static").
        const cp = attrs.find(a => a.name === 'child-position');
        expect(cp).toBeTruthy();
        expect(cp.dropdown).toEqual(['absolute', 'flow']);
        // Every flow knob keys off 'child-position' — the SAME name the
        // child-position descriptor exposes (regression: it was 'childPosition').
        for (const n of ['flow-gap', 'flow-direction', 'flow-justify', 'flow-align']) {
            expect(attrs.find(a => a.name === n).visibleWhen.attr).toBe(cp.name);
        }
    });
});

// ── U51: per-view themes — the theme attribute owns feezal-theme-* classes ──

describe('per-view theme (U51)', () => {
    async function mountView(attrs = {}) {
        const view = makeView('themed');
        for (const [k, v] of Object.entries(attrs)) view.setAttribute(k, v);
        document.body.append(view);
        await view.updateComplete;
        return view;
    }

    it('applies the theme class for a bare suffix and a full class name', async () => {
        feezal.site = null;
        const bare = await mountView({theme: 'dark-mint'});
        expect(bare.classList.contains('feezal-theme-dark-mint')).toBe(true);
        const full = await mountView({theme: 'feezal-theme-tui'});
        expect(full.classList.contains('feezal-theme-tui')).toBe(true);
        bare.remove(); full.remove();
    });

    it('changing / clearing the attribute swaps / removes the class', async () => {
        feezal.site = null;
        const view = await mountView({theme: 'dark-mint'});
        view.setAttribute('theme', 'metro');
        await view.updateComplete;
        expect([...view.classList].filter(c => c.startsWith('feezal-theme-'))).toEqual(['feezal-theme-metro']);
        view.setAttribute('theme', '');
        await view.updateComplete;
        expect([...view.classList].some(c => c.startsWith('feezal-theme-'))).toBe(false);
        view.remove();
    });

    it('strips a stale serialized theme class on mount (attribute owns the class)', async () => {
        feezal.site = null;
        const view = makeView('stale');
        view.className = 'feezal-theme-old-choice something-else';
        document.body.append(view);
        await view.updateComplete;
        expect(view.classList.contains('feezal-theme-old-choice')).toBe(false);
        expect(view.classList.contains('something-else')).toBe(true);
        view.remove();
    });

    it('is suppressed while a site-level theme override is active (user choice wins)', async () => {
        feezal.site = {_themeOverride: 'feezal-theme-user-pick'};
        const view = await mountView({theme: 'dark-mint'});
        expect(view.classList.contains('feezal-theme-dark-mint')).toBe(false);

        // Override cleared → the site calls _applyThemeClass() again.
        feezal.site = {_themeOverride: null};
        view._applyThemeClass();
        expect(view.classList.contains('feezal-theme-dark-mint')).toBe(true);
        view.remove();
    });

    it('U53: the theme attribute mounts the shared styled picker (custom hook)', () => {
        // The picker itself derives its options from feezal.themes at render
        // time (browser-tested in test-browser/feezal-theme-select.test.js).
        const spec = customElements.get('feezal-view').feezal.attributes.find(a => a?.name === 'theme');
        expect(spec).toMatchObject({type: 'custom', component: 'feezal-theme-select'});
    });
});

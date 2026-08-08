/**
 * E166 — the link cards (glass/metro/circle/eink-link).
 *
 * All behaviour lives in @feezal/feezal-controller-link, so it is tested ONCE
 * through one family and the others are covered by (a) the E137 parity suite
 * (contract declared) and (b) a per-family activation smoke here — the four
 * views may not drift in what a tap does.
 */
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {setupFeezal} from './helpers.js';

import '../packages/@feezal/feezal-element-glass-link/feezal-element-glass-link.js';
import '../packages/@feezal/feezal-element-metro-link/feezal-element-metro-link.js';
import '../packages/@feezal/feezal-element-circle-link/feezal-element-circle-link.js';
import '../packages/@feezal/feezal-element-eink-link/feezal-element-eink-link.js';

const TAGS = [
    'feezal-element-glass-link',
    'feezal-element-metro-link',
    'feezal-element-circle-link',
    'feezal-element-eink-link',
];

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
    // window.open / location.assign are the observable ends of activate().
    vi.spyOn(window, 'open').mockImplementation(() => null);
});

afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
});

async function mount(tag, attrs = {}) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.body.append(el);
    await el.updateComplete;
    return el;
}

describe('E166 — the shared link behaviour (via glass-link)', () => {
    it('new-tab opens with noopener', async () => {
        const el = await mount('feezal-element-glass-link',
            {href: 'https://grafana.local/d/abc', open: 'new-tab'});
        el.link.activate();
        expect(window.open).toHaveBeenCalledWith(
            'https://grafana.local/d/abc', '_blank', 'noopener,noreferrer');
    });

    it('does nothing without a target', async () => {
        const el = await mount('feezal-element-glass-link', {open: 'new-tab'});
        el.link.activate();
        expect(window.open).not.toHaveBeenCalled();
    });

    it('the editor NEVER navigates — a tap there is a selection', async () => {
        feezal.isEditor = true;
        const el = await mount('feezal-element-glass-link',
            {href: 'https://example.org', open: 'new-tab'});
        el.link.activate();
        expect(window.open).not.toHaveBeenCalled();
        expect(el.link.popupOpen).toBe(false);
    });

    it('a message on `subscribe` replaces the target at runtime', async () => {
        const el = await mount('feezal-element-glass-link',
            {href: 'https://old.example', subscribe: 'home/link', open: 'new-tab'});
        feezal.connection.deliver('home/link', 'https://new.example/live');
        el.link.activate();
        expect(window.open).toHaveBeenCalledWith(
            'https://new.example/live', '_blank', 'noopener,noreferrer');
    });

    it('…honouring message-property for a JSON payload', async () => {
        const el = await mount('feezal-element-glass-link',
            {href: 'x', subscribe: 'home/link', 'message-property': 'payload.url', open: 'new-tab'});
        feezal.connection.deliver('home/link', {url: 'https://nested.example'});
        el.link.activate();
        expect(window.open).toHaveBeenCalledWith(
            'https://nested.example', '_blank', 'noopener,noreferrer');
    });

    it('re-wires when the topic changes on the live canvas', async () => {
        const el = await mount('feezal-element-glass-link',
            {href: 'x', subscribe: 'home/a', open: 'new-tab'});
        el.setAttribute('subscribe', 'home/b');
        await el.updateComplete;
        feezal.connection.deliver('home/b', 'https://via-b.example');
        el.link.activate();
        expect(window.open).toHaveBeenCalledWith(
            'https://via-b.example', '_blank', 'noopener,noreferrer');
    });

    it('a #/view href routes the app in place — no navigation, no popup', async () => {
        // N30: whatever the open mode says, an internal route is an internal route.
        const kitchen = document.createElement('feezal-view');
        kitchen.setAttribute('name', 'kitchen');
        feezal.getView = name => (name === 'kitchen' ? kitchen : null);
        feezal.site = {view: ''};

        const el = await mount('feezal-element-glass-link',
            {href: '#/kitchen', open: 'popup-iframe'});
        el.link.activate();
        expect(feezal.site.view).toBe('kitchen');
        expect(el.link.popupOpen).toBe(false);
        expect(window.open).not.toHaveBeenCalled();
    });

    it('an unknown #hash is NOT swallowed by the router', async () => {
        // A hash link to an anchor on some page must still navigate normally.
        feezal.getView = () => null;
        feezal.site = {view: ''};
        const el = await mount('feezal-element-glass-link', {href: '#faq', open: 'new-tab'});
        el.link.activate();
        expect(feezal.site.view).toBe('');
        expect(window.open).toHaveBeenCalled();
    });

    it('popup-iframe embeds the target and always offers "open in tab"', async () => {
        const el = await mount('feezal-element-glass-link',
            {href: 'https://embed.example/panel', open: 'popup-iframe', label: 'Panel'});
        el.link.activate();
        await el.updateComplete;

        const popup = el.shadowRoot.querySelector('.link-popup');
        expect(popup).not.toBeNull();
        expect(popup.querySelector('iframe').getAttribute('src')).toBe('https://embed.example/panel');
        // The friendly fallback for X-Frame-Options/CSP blocks: embedding
        // failures are not detectable from here, so the affordance is permanent.
        const out = popup.querySelector('.bar a');
        expect(out.getAttribute('href')).toBe('https://embed.example/panel');
        expect(out.getAttribute('rel')).toContain('noopener');
        expect(popup.querySelector('.bar .title').textContent).toBe('Panel');
    });

    it('the popup closes on ✕ and on Escape', async () => {
        const el = await mount('feezal-element-glass-link',
            {href: 'https://embed.example', open: 'popup-iframe'});
        el.link.activate();
        await el.updateComplete;
        el.shadowRoot.querySelector('.link-popup .close').click();
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.link-popup')).toBeNull();

        el.link.activate();
        await el.updateComplete;
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.link-popup')).toBeNull();
    });

    it('detaching while the popup is open releases the Esc listener', async () => {
        // The N42 leak class: a document listener must not outlive the element.
        const el = await mount('feezal-element-glass-link',
            {href: 'https://embed.example', open: 'popup-iframe'});
        el.link.activate();
        el.remove();
        expect(el.link.popupOpen).toBe(false);
        // A later Escape must find nothing to call (no throw, no re-open).
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    });
});

describe('E166 — every family activates through the one controller', () => {
    for (const tag of TAGS) {
        it(`${tag}: a tap on the face opens the target`, async () => {
            const el = await mount(tag, {href: 'https://tap.example', open: 'new-tab'});
            // Each family's clickable face — the card, tile front, or disc.
            const face = el.shadowRoot.querySelector('.card, .face.front, .disc');
            expect(face, `${tag} has no clickable face`).not.toBeNull();
            face.click();
            expect(window.open).toHaveBeenCalledWith(
                'https://tap.example', '_blank', 'noopener,noreferrer');
        });

        it(`${tag}: an image face replaces the icon`, async () => {
            const el = await mount(tag, {href: 'x', image: '/assets/site/floorplan.png'});
            expect(el.shadowRoot.querySelector('.face-image')).not.toBeNull();
            expect(el.shadowRoot.querySelector('feezal-icon')).toBeNull();
        });

        it(`${tag}: an OVERSIZED image scales to fit the element`, async () => {
            // A real image with a huge intrinsic size (1600×1200): the whole
            // point of `contain` — the face must letterbox inside the element,
            // never crop to fill and never spill past its box.
            const big = 'data:image/svg+xml,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200">' +
                '<rect width="1600" height="1200" fill="#c00"/></svg>');
            const el = document.createElement(tag);
            el.setAttribute('href', 'x');
            el.setAttribute('image', big);
            // The canvas positions elements absolutely (feezal-view's slotted
            // rule); the card chrome anchors to that. A statically mounted host
            // would let the absolute .card resolve against the page instead.
            el.style.cssText = 'position:absolute;left:0;top:0;width:172px;height:128px;';
            document.body.append(el);
            await el.updateComplete;
            const img = el.shadowRoot.querySelector('.face-image');
            await new Promise(resolve => {
                if (img.complete) resolve();
                else img.addEventListener('load', resolve, {once: true});
            });
            await el.updateComplete;

            expect(getComputedStyle(img).objectFit).toBe('contain');
            const host = el.getBoundingClientRect();
            const face = img.getBoundingClientRect();
            // The img box stays inside the element (1px rounding tolerance).
            expect(face.width).toBeLessThanOrEqual(host.width + 1);
            expect(face.height).toBeLessThanOrEqual(host.height + 1);
            expect(face.right).toBeLessThanOrEqual(host.right + 1);
            expect(face.bottom).toBeLessThanOrEqual(host.bottom + 1);
        });
    }

    it('a non-empty label KEEPS its space beside an oversized image', async () => {
        // The report: the image took the whole card and the label lost its
        // room. PORTRAIT on purpose: a flexed replaced element's content basis
        // is the TRANSFERRED size (width × ratio), so landscape only nicks the
        // label a few px while portrait (basis ≈ 2.7× the card width) squeezes
        // a shrinkable label to nearly nothing — measured, 11px vs 3px.
        // Per family: the label box must be fully visible inside the host,
        // at its intrinsic height, free of the image/disc box.
        const big = 'data:image/svg+xml,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="1600">' +
            '<rect width="600" height="1600" fill="#0a0"/></svg>');
        const cases = [
            {tag: 'feezal-element-glass-link', label: '.label', face: '.face-image'},
            {tag: 'feezal-element-metro-link', label: '.tlabel', face: '.face-image'},
            {tag: 'feezal-element-circle-link', label: '.label', face: '.disc'},
        ];
        for (const {tag, label, face} of cases) {
            const el = document.createElement(tag);
            el.setAttribute('href', 'x');
            el.setAttribute('image', big);
            el.setAttribute('label', 'Grafana');
            el.style.cssText = 'position:absolute;left:0;top:0;width:172px;height:128px;';
            document.body.append(el);
            await el.updateComplete;
            const img = el.shadowRoot.querySelector('.face-image');
            await new Promise(resolve => {
                if (img.complete) resolve();
                else img.addEventListener('load', resolve, {once: true});
            });
            await el.updateComplete;

            const host = el.getBoundingClientRect();
            const labelBox = el.shadowRoot.querySelector(label).getBoundingClientRect();
            const faceBox = el.shadowRoot.querySelector(face).getBoundingClientRect();
            expect(labelBox.height, `${tag} label collapsed`).toBeGreaterThan(9);
            expect(labelBox.bottom, `${tag} label below the card`).toBeLessThanOrEqual(host.bottom + 1);
            // The face ends above the label line (metro overlays by family
            // convention, so there the IMAGE strip is what must stay clear).
            expect(faceBox.bottom, `${tag} face covers the label`)
                .toBeLessThanOrEqual(labelBox.top + 1);
            el.remove();
        }
    });

    it('the label colour is an exposed style knob, per family', async () => {
        const cases = [
            {tag: 'feezal-element-glass-link', label: '.label', knob: '--feezal-glass-label-color'},
            {tag: 'feezal-element-metro-link', label: '.tlabel', knob: '--feezal-metro-label-color'},
            {tag: 'feezal-element-circle-link', label: '.label', knob: '--feezal-link-text-color'},
        ];
        for (const {tag, label, knob} of cases) {
            const el = await mount(tag, {href: 'x', label: 'Grafana'});
            el.style.setProperty(knob, 'rgb(1, 2, 3)');
            await el.updateComplete;
            expect(getComputedStyle(el.shadowRoot.querySelector(label)).color,
                `${tag} ${knob}`).toBe('rgb(1, 2, 3)');
            // …and it is DECLARED, so the style inspector offers it.
            const styles = customElements.get(tag).feezal.styles;
            expect(styles.some(s => s.property === knob), `${tag} declares ${knob}`).toBe(true);
        }
    });

    it('the image attribute is an ASSET field, so the inspector autocompletes it', async () => {
        // Regressing to type:'string' would silently lose the picker — the
        // element keeps working, only the UI degrades (the B88 failure shape).
        const {linkAttributes} = await import('@feezal/feezal-controller-link');
        const image = linkAttributes.find(a => a.name === 'image');
        expect(image.type).toBe('asset');
        expect(image.accept).toContain('png');
        expect(image.accept).toContain('webp');
    });
});

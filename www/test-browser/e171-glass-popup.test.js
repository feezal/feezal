/**
 * E171 — glass popups: ① opt-in frosted page backdrop, ② opt-in open/close
 * animation (both shared machinery, knobs on every popup card), ③ the new
 * glass-popup container element (trigger + view/template content in the
 * family popup chrome).
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-glass-light/feezal-element-glass-light.js';
import '../packages/@feezal/feezal-element-glass-climate/feezal-element-glass-climate.js';
import '../packages/@feezal/feezal-element-glass-cover/feezal-element-glass-cover.js';
import '../packages/@feezal/feezal-element-glass-fan/feezal-element-glass-fan.js';
import '../packages/@feezal/feezal-element-glass-wled/feezal-element-glass-wled.js';
import '../packages/@feezal/feezal-element-glass-popup/feezal-element-glass-popup.js';
import '../src/feezal-view.js';
import {setupFeezal, mount, until} from './helpers.js';

const CARDS = ['light', 'climate', 'cover', 'fan', 'wled', 'popup']
    .map(f => `feezal-element-glass-${f}`);

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

describe('E171 — the shared popup knobs are declared everywhere', () => {
    it('every popup-owning glass card offers popup-backdrop + popup-animate', () => {
        for (const tag of CARDS) {
            const names = customElements.get(tag).feezal.attributes.map(a => a.name || a);
            expect(names, tag).toContain('popup-backdrop');
            expect(names, tag).toContain('popup-animate');
        }
    });
});

describe('E171 ① — frosted page backdrop (DEFAULT ON)', () => {
    async function openLight(attrs = {}) {
        const el = await mount('feezal-element-glass-light', attrs);
        el.openDetails();
        await el.updateComplete;
        return el.shadowRoot.querySelector('.details');
    }

    it('default: the page behind gets the family frost', async () => {
        const popup = await openLight();
        expect(popup).toBeTruthy();
        expect(getComputedStyle(popup, '::backdrop').backdropFilter).toContain('blur');
    });

    it('an explicit popup-backdrop="false" keeps the plain dim scrim', async () => {
        const popup = await openLight({'popup-backdrop': 'false', 'popup-animate': 'false'});
        expect(getComputedStyle(popup, '::backdrop').backdropFilter).toBe('none');
        expect(getComputedStyle(popup, '::backdrop').backgroundColor).toBe('rgba(0, 0, 0, 0.35)');
    });

    it('degrade contract: tint scrim without the live blur', async () => {
        const popup = await openLight({degrade: ''});
        expect(getComputedStyle(popup, '::backdrop').backdropFilter).toBe('none');
        expect(getComputedStyle(popup, '::backdrop').backgroundColor).not.toBe('rgba(0, 0, 0, 0.35)');
    });
});

describe('E171 ② — open/close morph from the card outline (DEFAULT ON)', () => {
    const frame = () => new Promise(r => requestAnimationFrame(() => r()));

    it('default: open morphs the popup OUT OF the card rect', async () => {
        const el = await mount('feezal-element-glass-light', {});
        el.style.cssText = 'position:absolute;left:20px;top:20px;width:172px;height:128px;';
        el.openDetails();
        await el.updateComplete;
        await frame();
        const anims = el.shadowRoot.querySelector('.details').getAnimations();
        expect(anims.length).toBeGreaterThan(0);
        // the FLIP from-keyframe carries the card→popup translate+scale
        const kf = anims[0].effect.getKeyframes();
        expect(kf[0].transform).toContain('translate');
        expect(kf[0].transform).toContain('scale');
        expect(kf.at(-1).transform).toBe('none');
    });

    it('an explicit popup-animate="false" opens without any tween', async () => {
        const el = await mount('feezal-element-glass-light', {'popup-animate': 'false'});
        el.style.cssText = 'position:absolute;left:20px;top:20px;width:172px;height:128px;';
        el.openDetails();
        await el.updateComplete;
        await frame();
        expect(el.shadowRoot.querySelector('.details').getAnimations()).toHaveLength(0);
    });

    it('close SHRINKS BACK into the card before removal — not a synchronous teardown', async () => {
        const el = await mount('feezal-element-glass-light', {});
        el.style.cssText = 'position:absolute;left:20px;top:20px;width:172px;height:128px;';
        el.openDetails();
        await el.updateComplete;
        await frame();
        el._closeDetails();
        // still open, tweening out toward the card rect
        expect(el._details).toBe(true);
        const anims = el.shadowRoot.querySelector('.details').getAnimations();
        expect(anims.length).toBeGreaterThan(0);
        expect(anims.at(-1).effect.getKeyframes().at(-1).transform).toContain('scale');
        await until(() => el._details === false);
        expect(el.shadowRoot.querySelector('.details')).toBeNull();
    });

    it('with popup-animate="false" the close is instant (the previous behavior)', async () => {
        const el = await mount('feezal-element-glass-light', {'popup-animate': 'false'});
        el.openDetails();
        await el.updateComplete;
        el._closeDetails();
        expect(el._details).toBe(false);
    });
});

describe('E171 ③ — glass-popup container', () => {
    function siteWith(name, markerHtml) {
        const site = document.createElement('div');
        const v = document.createElement('feezal-view');
        v.setAttribute('name', name);
        v.style.display = 'none';
        v.innerHTML = markerHtml;
        site.append(v);
        document.body.append(site);
        feezal.site = site;
        return site;
    }

    it('trigger modes: icon chip by default, label, invisible hotspot', async () => {
        const icon = await mount('feezal-element-glass-popup', {});
        expect(icon.shadowRoot.querySelector('.trigger feezal-icon')).toBeTruthy();
        icon.remove();

        const label = await mount('feezal-element-glass-popup', {trigger: 'label', label: 'More'});
        expect(label.shadowRoot.querySelector('.trigger feezal-icon')).toBeNull();
        expect(label.shadowRoot.querySelector('.tlabel').textContent).toBe('More');
        label.remove();

        const hot = await mount('feezal-element-glass-popup', {trigger: 'hotspot'});
        const cs = getComputedStyle(hot.shadowRoot.querySelector('.trigger'));
        expect(cs.backgroundColor).toBe('rgba(0, 0, 0, 0)');
        expect(cs.borderStyle).toBe('none');
    });

    it('a tap opens the popup in the viewer and NEVER in the editor', async () => {
        feezal.isEditor = true;
        const inEditor = await mount('feezal-element-glass-popup', {});
        inEditor.shadowRoot.querySelector('.trigger').click();
        await inEditor.updateComplete;
        expect(inEditor._details).toBe(false);
        inEditor.remove();

        feezal.isEditor = false;
        const el = await mount('feezal-element-glass-popup', {title: 'Info'});
        el.shadowRoot.querySelector('.trigger').click();
        await el.updateComplete;
        expect(el._details).toBe(true);
        expect(el.shadowRoot.querySelector('.details .title').textContent).toBe('Info');
    });

    it('view mode embeds a LIVE clone of the view inside the popup body', async () => {
        siteWith('sub', '<div id="marker">hello</div>');
        const el = await mount('feezal-element-glass-popup', {view: 'sub'});
        el.openDetails();
        await el.updateComplete;
        const body = el.shadowRoot.querySelector('.details .body');
        expect(body.classList.contains('viewmode')).toBe(true);
        const clone = body.querySelector('feezal-view');
        expect(clone).toBeTruthy();
        expect(clone.querySelector('#marker')).toBeTruthy();
        // the clone must not inherit the hidden source's display:none —
        // _visibleChange(true) owns the inline display, so assert computed.
        expect(getComputedStyle(clone).display).not.toBe('none');
    });

    it('template mode renders the light-DOM template with the msg context', async () => {
        const el = document.createElement('feezal-element-glass-popup');
        el.setAttribute('subscribe', 'pop/t');
        el.innerHTML = '<template><b>v=${msg.payload}</b></template>';
        document.body.append(el);
        await el.updateComplete;
        el.openDetails();
        await el.updateComplete;
        const body = el.shadowRoot.querySelector('.details .body');
        expect(body.innerHTML).toContain('v=');
        feezal.connection.deliver('pop/t', '42');
        await el.updateComplete;
        expect(body.innerHTML).toContain('v=42');
    });

    it('Escape closes the popup (the default close morph is awaited)', async () => {
        const el = await mount('feezal-element-glass-popup', {});
        el.openDetails();
        await el.updateComplete;
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
        await until(() => el._details === false);
        expect(el.shadowRoot.querySelector('.details')).toBeNull();
    });
});

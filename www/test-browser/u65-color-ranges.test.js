/**
 * U65 — site-wide named colour ranges, end to end in a real browser:
 *
 *  - the manager (Themes sidebar → Ranges) edits `<feezal-site color-ranges>`
 *    as the single source of truth — create, edit, rename-with-reference-
 *    rewrite, delete-with-usage-count;
 *  - the styles inspector's colour rows carry the Static / Subscribe / Range
 *    modes and serialize them as paired custom properties (storage shape B);
 *  - the base-class runtime maps MQTT values into the bound var — through a
 *    named range, or verbatim (Subscribe: the payload IS the colour);
 *  - the gauge's `ranges` attribute accepts a range NAME.
 *
 * Everything lives in attributes + inline styles, so "survives a static
 * export" is by construction — asserted here by round-tripping outerHTML.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../src/feezal-sidebar-color-ranges.js';
import '../src/feezal-sidebar-inspector-styles.js';
import {FeezalElement} from '@feezal/feezal-element';
import {bandColor, parseRanges} from '@feezal/feezal-gauge/feezal-gauge.js';
import {setupFeezal} from './helpers.js';

const RANGES = [
    {name: 'temp', type: 'bands', default: '', bands: [
        {from: 0, color: '#4caf50'}, {from: 21, color: '#ff9800'}, {from: 28, color: '#e53935'},
    ]},
    {name: 'mode', type: 'enum', default: '#888888', map: {heat: '#e53935', cool: '#2196f3'}},
];

class U65Card extends FeezalElement {
    static feezal = {
        attributes: ['subscribe', 'message-property'],
        styles: [{property: '--u65-fill-color', type: 'color', default: '#123456'}],
    };
}
if (!customElements.get('feezal-test-u65-card')) {
    customElements.define('feezal-test-u65-card', U65Card);
}

function mountSite(ranges = RANGES) {
    const site = document.createElement('div');
    site.id = 'u65-site';
    if (ranges) site.setAttribute('color-ranges', JSON.stringify(ranges));
    document.body.append(site);
    feezal.site = site;
    feezal.app = {change() { this.changed = (this.changed || 0) + 1; }};
    return site;
}

beforeEach(() => setupFeezal());

describe('manager panel — <feezal-site color-ranges> is the source of truth', () => {
    async function mountManager(ranges) {
        mountSite(ranges);
        const manager = document.createElement('feezal-sidebar-color-ranges');
        document.body.append(manager);
        await manager.updateComplete;
        return manager;
    }

    it('lists the site ranges with type + swatch strip', async () => {
        const manager = await mountManager();
        const cards = manager.shadowRoot.querySelectorAll('.card');
        expect(cards.length).toBe(2);
        expect(cards[0].querySelector('.card-name').textContent).toBe('temp');
        expect(cards[0].querySelector('.card-type').textContent).toBe('bands');
        expect(cards[0].querySelector('.strip').getAttribute('style')).toContain('linear-gradient');
    });

    it('creating a range writes the attribute and broadcasts', async () => {
        const manager = await mountManager(null);
        let broadcast = 0;
        document.addEventListener('feezal-color-ranges-changed', () => broadcast++, {once: true});
        manager.startCreate('Neuer Bereich');   // slugified — names travel through sl-option values
        await manager.updateComplete;
        manager._create();
        const stored = JSON.parse(feezal.site.getAttribute('color-ranges'));
        expect(stored[0].name).toBe('Neuer-Bereich');
        expect(stored[0].type).toBe('bands');
        expect(broadcast).toBe(1);
        expect(feezal.app.changed).toBe(1);
    });

    it('deleting an unused range needs no confirmation; the last one removes the attribute', async () => {
        const manager = await mountManager([RANGES[0]]);
        await manager._delete('temp');
        expect(manager._dlgConfirm).toBe(null);   // no dialog for an unused range
        expect(feezal.site.hasAttribute('color-ranges')).toBe(false);
    });

    it('deleting a USED range asks via a styled sl-dialog — never the browser confirm', async () => {
        const manager = await mountManager();
        const bound = document.createElement('div');
        bound.style.setProperty('--x-range', 'temp');
        feezal.site.append(bound);

        // Cancel keeps the range
        let done = manager._delete('temp');
        await manager.updateComplete;
        const dialog = manager.shadowRoot.querySelector('sl-dialog');
        expect(dialog.open).toBe(true);
        expect(dialog.textContent).toContain('used by 1 element');
        manager.shadowRoot.querySelector('sl-button[variant="default"]').click();
        await done;
        expect(JSON.parse(feezal.site.getAttribute('color-ranges')).map(r => r.name))
            .toContain('temp');

        // Delete removes it
        done = manager._delete('temp');
        await manager.updateComplete;
        manager.shadowRoot.querySelector('sl-button[variant="danger"]').click();
        await done;
        expect(JSON.parse(feezal.site.getAttribute('color-ranges')).map(r => r.name))
            .not.toContain('temp');
    });

    it('rename rewrites every reference — style pairs AND gauge attributes', async () => {
        const manager = await mountManager();
        const bound = document.createElement('div');
        bound.style.setProperty('--x-range', 'temp');
        const gauge = document.createElement('div');
        gauge.setAttribute('ranges', 'temp');
        feezal.site.append(bound, gauge);
        expect(manager._usages('temp').length).toBe(2);

        manager._rename('temp', 'temperatur');
        expect(bound.style.getPropertyValue('--x-range')).toBe('temperatur');
        expect(gauge.getAttribute('ranges')).toBe('temperatur');
        expect(JSON.parse(feezal.site.getAttribute('color-ranges'))[0].name).toBe('temperatur');
    });

    it('rename refuses a duplicate name', async () => {
        const manager = await mountManager();
        manager._rename('temp', 'mode');
        expect(JSON.parse(feezal.site.getAttribute('color-ranges')).map(r => r.name))
            .toEqual(['temp', 'mode']);
    });
});

describe('styles inspector — Static / Subscribe / Range on a colour row', () => {
    async function mountInspector() {
        mountSite();
        const card = document.createElement('feezal-test-u65-card');
        card.setAttribute('subscribe', 'stat/own');
        card.setAttribute('message-property', 'payload.val');
        card.classList.add('feezal-selected');
        feezal.site.append(card);
        const panel = document.createElement('feezal-sidebar-inspector-styles');
        panel.selectedElems = [card];
        document.body.append(panel);
        await panel.updateComplete;
        await new Promise(r => setTimeout(r, 30));
        await panel.updateComplete;
        return {card, panel};
    }

    const modeButtons = panel => [...panel.shadowRoot.querySelectorAll('.mode-row button')];

    it('a colour custom-property row shows the three modes, Static active', async () => {
        const {panel} = await mountInspector();
        const buttons = modeButtons(panel);
        expect(buttons.map(b => b.textContent)).toEqual(['Static', 'Subscribe', 'Range']);
        expect(buttons[0].classList.contains('active')).toBe(true);
    });

    it('Range mode pre-fills topic/property from the primary value and picks the first range', async () => {
        const {card, panel} = await mountInspector();
        modeButtons(panel)[2].click();
        await panel.updateComplete;
        expect(card.style.getPropertyValue('--u65-fill-color-source-topic')).toBe('stat/own');
        expect(card.style.getPropertyValue('--u65-fill-color-source-property')).toBe('payload.val');
        expect(card.style.getPropertyValue('--u65-fill-color-range')).toBe('temp');
        // the block is visible with the dropdown + editable source lines
        expect(panel.shadowRoot.querySelector('.bind-block sl-select')).toBeTruthy();
        expect(panel.shadowRoot.querySelector('.bind-block feezal-topic-input').value).toBe('stat/own');
    });

    it('Subscribe mode starts empty — it wants a COLOUR topic, not the primary value', async () => {
        const {card, panel} = await mountInspector();
        modeButtons(panel)[1].click();
        await panel.updateComplete;
        expect(card.style.getPropertyValue('--u65-fill-color-source-topic')).toBe('""');
        expect(card.style.getPropertyValue('--u65-fill-color-range')).toBe('');
        expect(card.style.getPropertyValue('--u65-fill-color-source-property')).toBe('');
    });

    it('back to Static drops the pairs and keeps the colour var itself', async () => {
        const {card, panel} = await mountInspector();
        card.style.setProperty('--u65-fill-color', '#ff9800');
        modeButtons(panel)[2].click();
        await panel.updateComplete;
        modeButtons(panel)[0].click();
        await panel.updateComplete;
        expect(card.style.getPropertyValue('--u65-fill-color-source-topic')).toBe('');
        expect(card.style.getPropertyValue('--u65-fill-color-range')).toBe('');
        expect(card.style.getPropertyValue('--u65-fill-color')).toBe('#ff9800');
    });

    it('the range dropdown lists site ranges behind the create sentinel, with swatch strips', async () => {
        const {panel} = await mountInspector();
        modeButtons(panel)[2].click();
        await panel.updateComplete;
        const options = [...panel.shadowRoot.querySelectorAll('.bind-block sl-option')];
        expect(options[0].value).toBe('__create__');
        expect(options.slice(1).map(o => o.value)).toEqual(['temp', 'mode']);
        expect(options[1].querySelector('.range-strip')).toBeTruthy();
    });

    it('the create sentinel fires the manager-opening event and keeps the selection', async () => {
        const {panel} = await mountInspector();
        modeButtons(panel)[2].click();
        await panel.updateComplete;
        let evt = null;
        window.addEventListener('feezal-open-color-ranges', e => evt = e, {once: true});
        const select = panel.shadowRoot.querySelector('.bind-block sl-select');
        select.value = '__create__';
        select.dispatchEvent(new CustomEvent('sl-change', {bubbles: true}));
        expect(evt?.detail?.create).toBe(true);
        expect(select.value).toBe('temp');   // snapped back
    });

    it('a plain CSS colour property (not --custom) stays Static-only', async () => {
        mountSite();
        const card = document.createElement('feezal-test-u65-card');
        card.classList.add('feezal-selected');
        card.style.setProperty('color', 'red');
        feezal.site.append(card);
        const panel = document.createElement('feezal-sidebar-inspector-styles');
        panel.selectedElems = [card];
        document.body.append(panel);
        await panel.updateComplete;
        // 'color' arrives as a custom row with a swatch but must NOT offer modes
        const rows = [...panel.shadowRoot.querySelectorAll('.field')];
        const colorRow = rows.find(r => r.textContent.includes('color') && !r.textContent.includes('--'));
        expect(colorRow?.querySelector('.mode-row')).toBeFalsy();
    });
});

describe('runtime — MQTT drives the bound var (FeezalElement base)', () => {
    async function liveCard() {
        mountSite();
        const card = document.createElement('feezal-test-u65-card');
        card.setAttribute('subscribe', 'stat/own');
        card.setAttribute('message-property', 'payload.val');
        return card;
    }

    it('Range mode: values map through the named range; no match keeps the colour', async () => {
        const card = await liveCard();
        card.style.setProperty('--u65-fill-color', '#123456');
        card.style.setProperty('--u65-fill-color-source-topic', 'stat/temp');
        card.style.setProperty('--u65-fill-color-range', 'temp');
        feezal.site.append(card);
        await card.updateComplete;
        feezal.connection.deliver('stat/temp', '23.5');
        expect(card.style.getPropertyValue('--u65-fill-color')).toBe('#ff9800');
        feezal.connection.deliver('stat/temp', '5');
        expect(card.style.getPropertyValue('--u65-fill-color')).toBe('#4caf50');
        feezal.connection.deliver('stat/temp', '-10');   // below every band
        expect(card.style.getPropertyValue('--u65-fill-color')).toBe('#4caf50');
    });

    it('Subscribe mode: the payload is written verbatim — hex or var()', async () => {
        const card = await liveCard();
        card.style.setProperty('--u65-fill-color-source-topic', 'stat/color');
        feezal.site.append(card);
        await card.updateComplete;
        feezal.connection.deliver('stat/color', '#e53935');
        expect(card.style.getPropertyValue('--u65-fill-color')).toBe('#e53935');
        feezal.connection.deliver('stat/color', 'var(--error-color)');
        expect(card.style.getPropertyValue('--u65-fill-color')).toBe('var(--error-color)');
    });

    it('Range with an empty topic reads the element PRIMARY value', async () => {
        const card = await liveCard();
        card.style.setProperty('--u65-fill-color-source-topic', '""');
        card.style.setProperty('--u65-fill-color-range', 'temp');
        feezal.site.append(card);
        await card.updateComplete;
        feezal.connection.deliver('stat/own', JSON.stringify({val: 30}));
        // fake connection delivers the raw string payload; getProperty walks it
        // only after JSON parse — the real connection parses JSON payloads, so
        // feed the object form here:
        feezal.connection.deliver('stat/own', {val: 30});
        expect(card.style.getPropertyValue('--u65-fill-color')).toBe('#e53935');
    });

    it('an enum range maps stringy states', async () => {
        const card = await liveCard();
        card.style.setProperty('--u65-fill-color-source-topic', 'stat/hvac');
        card.style.setProperty('--u65-fill-color-range', 'mode');
        feezal.site.append(card);
        await card.updateComplete;
        feezal.connection.deliver('stat/hvac', 'heat');
        expect(card.style.getPropertyValue('--u65-fill-color')).toBe('#e53935');
        feezal.connection.deliver('stat/hvac', 'standby');   // → enum default
        expect(card.style.getPropertyValue('--u65-fill-color')).toBe('#888888');
    });

    it('the whole binding survives an outerHTML round-trip (static export)', async () => {
        const card = await liveCard();
        card.style.setProperty('--u65-fill-color', '#ff9800');
        card.style.setProperty('--u65-fill-color-source-topic', 'stat/temp');
        card.style.setProperty('--u65-fill-color-range', 'temp');
        feezal.site.append(card);
        await card.updateComplete;

        const siteHtml = feezal.site.outerHTML;
        feezal.site.remove();

        // re-parse — exactly what a static export ships
        const wrap = document.createElement('div');
        wrap.innerHTML = siteHtml;
        const site2 = wrap.firstElementChild;
        document.body.append(site2);
        feezal.site = site2;
        const card2 = site2.querySelector('feezal-test-u65-card');
        expect(JSON.parse(site2.getAttribute('color-ranges'))[0].name).toBe('temp');
        expect(card2.style.getPropertyValue('--u65-fill-color')).toBe('#ff9800');   // last colour serialized
        await card2.updateComplete;
        feezal.connection.deliver('stat/temp', '30');
        expect(card2.style.getPropertyValue('--u65-fill-color')).toBe('#e53935');   // and live again
    });
});

describe('gauge `ranges` accepts a named site range', () => {
    beforeEach(() => mountSite());

    it('bands range: fill colour + needle zones, byte-compatible with inline JSON', () => {
        expect(bandColor('temp', 23)).toBe('#ff9800');
        expect(bandColor('temp', 30)).toBe('#e53935');
        expect(parseRanges('temp').map(b => b.from)).toEqual([0, 21, 28]);
        // inline JSON keeps working unchanged
        expect(bandColor('[{"from":0,"color":"#111111"}]', 5)).toBe('#111111');
    });

    it('enum range resolves; unknown name falls back', () => {
        expect(bandColor('mode', 'heat')).toBe('#e53935');
        expect(bandColor('nope', 50, '#fallback')).toBe('#fallback');
        expect(parseRanges('nope')).toEqual([]);
    });
});

/**
 * N38 (site locale → number formatting) + A27 phase 1 (language-aware element
 * defaults), end to end in a real browser:
 *
 *  - a German locale renders "21,5" on the value cards and "Ein/Aus" state
 *    words, with the author setting NOTHING;
 *  - explicitly set attributes always win over locale defaults;
 *  - a live locale change re-renders numbers AND re-resolves defaults;
 *  - the saved HTML is identical either way — locale defaults are never
 *    materialised (that is what makes shared dashboards language-neutral);
 *  - wire-protocol attributes (payload-*) can never be localized.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {FeezalElement, html} from '@feezal/feezal-element';
import {setLocale, formatNumber} from '@feezal/feezal-element/feezal-locale.js';
import '../packages/@feezal/feezal-element-basic-number/feezal-element-basic-number.js';
import '../packages/@feezal/feezal-element-glass-switch/feezal-element-glass-switch.js';
import {setupFeezal, mount} from './helpers.js';

class LocaleProbe extends FeezalElement {
    static feezal = {
        attributes: [
            {name: 'label-on', type: 'string', default: 'On', defaultI18n: {de: 'Ein'}},
            {name: 'payload-on', type: 'string', default: 'ON'},   // no dict — wire protocol
        ],
    };
    static properties = {
        labelOn:   {type: String, attribute: 'label-on'},   // display text: never reflected (A27)
        payloadOn: {type: String, reflect: true, attribute: 'payload-on'},
    };
    constructor() {
        super();
        this.labelOn = 'On';
        this.payloadOn = 'ON';
    }
    render() {
        return html`<span id="l">${this.labelOn}</span>`;
    }
}
if (!customElements.get('feezal-test-locale-probe')) {
    customElements.define('feezal-test-locale-probe', LocaleProbe);
}

beforeEach(() => setupFeezal());
afterEach(() => setLocale(''));

describe('A27: language-aware element defaults', () => {
    it('unset attribute renders the locale default; explicit attribute wins', async () => {
        setLocale('de');
        const unset = await mount('feezal-test-locale-probe');
        expect(unset.labelOn).toBe('Ein');
        expect(unset.shadowRoot.textContent).toContain('Ein');

        const explicit = await mount('feezal-test-locale-probe', {'label-on': 'Custom'});
        expect(explicit.labelOn).toBe('Custom');
    });

    it('en (and unknown locales) keep the English default', async () => {
        setLocale('fr');
        const el = await mount('feezal-test-locale-probe');
        expect(el.labelOn).toBe('On');
    });

    it('a live locale change re-resolves — and the HTML never changes', async () => {
        setLocale('en');
        const el = await mount('feezal-test-locale-probe');
        const before = el.outerHTML;
        expect(el.labelOn).toBe('On');

        setLocale('de-AT');   // chain: de-AT → de → en
        await el.updateComplete;
        expect(el.labelOn).toBe('Ein');
        // reflect:true would write the property back as an attribute — assert
        // it did NOT happen for the locale-applied value
        expect(el.outerHTML).toBe(before);
        expect(el.hasAttribute('label-on')).toBe(false);
    });

    it('payload-* attributes are never localized (no dict = no touch)', async () => {
        setLocale('de');
        const el = await mount('feezal-test-locale-probe');
        expect(el.payloadOn).toBe('ON');
    });

    it('a REAL element: glass-switch renders Ein/Aus under de with nothing set', async () => {
        setLocale('de');
        const el = await mount('feezal-element-glass-switch');
        await el.updateComplete;
        expect(el.textOn).toBe('Ein');
        expect(el.textOff).toBe('Aus');
        setLocale('en');
        await el.updateComplete;
        expect(el.textOn).toBe('On');
    });
});

describe('N38: localized number formatting', () => {
    it('basic-number renders the site-locale separator with nothing configured', async () => {
        setLocale('de');
        const el = await mount('feezal-element-basic-number');
        el.value = 21.5;
        await el.updateComplete;
        await el.updateComplete;   // _formatedValue is set inside updated() → chained cycle
        expect(el.shadowRoot.querySelector('#value').textContent).toBe('21,5');
    });

    it('an explicit decimal-separator attribute stays authoritative', async () => {
        setLocale('de');
        const el = await mount('feezal-element-basic-number', {'decimal-separator': ':'});
        el.value = 21.5;
        await el.updateComplete;
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('#value').textContent).toBe('21:5');
    });

    it('grouping is per-element opt-in', async () => {
        setLocale('de');
        const grouped = await mount('feezal-element-basic-number', {grouping: ''});
        grouped.value = 1234.5;
        await grouped.updateComplete;
        await grouped.updateComplete;
        expect(grouped.shadowRoot.querySelector('#value').textContent).toBe('1.234,5');

        const plain = await mount('feezal-element-basic-number');
        plain.value = 1234.5;
        await plain.updateComplete;
        await plain.updateComplete;
        expect(plain.shadowRoot.querySelector('#value').textContent).toBe('1234,5');
    });

    it('a live locale change re-formats the cached value', async () => {
        setLocale('en');
        const el = await mount('feezal-element-basic-number');
        el.value = 21.5;
        await el.updateComplete;
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('#value').textContent).toBe('21.5');
        setLocale('de');
        await el.updateComplete;
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('#value').textContent).toBe('21,5');
    });

    it('the site attribute drives the locale when no global is set', async () => {
        const site = document.createElement('div');
        site.setAttribute('locale', 'de');
        feezal.site = site;
        expect(formatNumber(3.5)).toBe('3,5');
    });
});

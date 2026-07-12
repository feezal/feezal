/**
 * Component tests for feezal-element-carbon-select — options rendering,
 * publish-on-selection, and the popup background styling injected into the
 * cds-select shadow root (Carbon's own .cds--select-option rule must not
 * win over it).
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '@feezal/feezal-element-carbon-select';
import {setupFeezal, mount} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

async function cdsSelect(el) {
    await el.updateComplete;
    const s = el.shadowRoot.querySelector('cds-select');
    await s.updateComplete;
    return s;
}

describe('options + publish', () => {
    it('renders the options list and publishes the selected value', async () => {
        const el = await mount('feezal-element-carbon-select', {
            publish: 'cmnd/mode',
            options: '[{"value":"auto","label":"Auto"},{"value":"off","label":"Off"}]'
        });
        const s = await cdsSelect(el);
        expect([...s.querySelectorAll('cds-select-item')].map(i => i.getAttribute('value')))
            .toEqual(['auto', 'off']);

        s.dispatchEvent(new CustomEvent('cds-select-selected', {
            bubbles: true, composed: true, detail: {value: 'off'}
        }));
        expect(feezal.connection.published).toEqual([{topic: 'cmnd/mode', payload: 'off'}]);
    });

    it('follows the subscribed value', async () => {
        const el = await mount('feezal-element-carbon-select', {
            subscribe: 'stat/mode',
            options: '[{"value":"auto","label":"Auto"},{"value":"off","label":"Off"}]'
        });
        feezal.connection.deliver('stat/mode', 'off');
        const s = await cdsSelect(el);
        expect(s.getAttribute('value')).toBe('off');
    });
});

describe('popup background injection', () => {
    it('--feezal-select-popup-background-color styles the native options', async () => {
        const el = await mount('feezal-element-carbon-select', {
            options: '[{"value":"a","label":"A"}]'
        });
        el.style.setProperty('--feezal-select-popup-background-color', 'rgb(1, 2, 3)');
        const s = await cdsSelect(el);
        await new Promise(resolve => setTimeout(resolve, 30));

        // The rule must carry the .cds--select-option class — Carbon ships its
        // own class rule for options, which outranks a bare `option` selector.
        const opt = s.shadowRoot.querySelector('option');
        expect(getComputedStyle(opt).backgroundColor).toBe('rgb(1, 2, 3)');
    });
});

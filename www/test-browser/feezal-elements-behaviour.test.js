/**
 * Behaviour tests for further core elements (A17 — extends the button/switch
 * pattern): MQTT state binding into real @material/web components and
 * interaction-to-publish, per element.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '@feezal/feezal-element-material-gauge';
import '@feezal/feezal-element-material-slider';
import '@feezal/feezal-element-material-progress';
import '@feezal/feezal-element-material-checkbox';
import '@feezal/feezal-element-material-contact';
import '@feezal/feezal-element-material-motion';
import '@feezal/feezal-element-material-select';
import '@feezal/feezal-element-material-input';
import {setupFeezal, mount} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

describe('gauge', () => {
    it('renders an SVG and follows numeric payloads', async () => {
        const el = await mount('feezal-element-material-gauge', {subscribe: 'stat/temp'});
        expect(el.shadowRoot.querySelector('svg')).not.toBeNull();

        feezal.connection.deliver('stat/temp', '42');
        await el.updateComplete;
        expect(el._value).toBe(42);
    });

    it('ignores non-numeric payloads', async () => {
        const el = await mount('feezal-element-material-gauge', {subscribe: 'stat/temp'});
        feezal.connection.deliver('stat/temp', '21');
        feezal.connection.deliver('stat/temp', 'garbage');
        await el.updateComplete;
        expect(el._value).toBe(21);
    });
});

describe('slider', () => {
    it('binds the payload to the md-slider value', async () => {
        const el = await mount('feezal-element-material-slider', {subscribe: 'stat/dim'});
        feezal.connection.deliver('stat/dim', '55');
        await el.updateComplete;
        const slider = el.shadowRoot.querySelector('md-slider');
        await slider.updateComplete;
        expect(slider.value).toBe(55);
    });

    it('publishes the numeric value as a string on change', async () => {
        const el = await mount('feezal-element-material-slider', {publish: 'cmnd/dim'});
        const slider = el.shadowRoot.querySelector('md-slider');
        slider.value = 70;
        slider.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toEqual([{topic: 'cmnd/dim', payload: '70'}]);
    });

    it('navigates JSON payloads via message-property', async () => {
        const el = await mount('feezal-element-material-slider', {
            'subscribe': 'stat/light',
            'message-property': 'payload.brightness'
        });
        feezal.connection.deliver('stat/light', {brightness: 128});
        await el.updateComplete;
        expect(el._value).toBe(128);
    });
});

describe('progress', () => {
    it('follows numeric payloads and renders both modes', async () => {
        const el = await mount('feezal-element-material-progress', {subscribe: 'stat/pct'});
        feezal.connection.deliver('stat/pct', '75');
        await el.updateComplete;
        expect(el._value).toBe(75);

        const linearHtml = el.shadowRoot.innerHTML;
        el.setAttribute('mode', 'circular');
        await el.updateComplete;
        expect(el.shadowRoot.innerHTML).not.toBe(linearHtml);
    });
});

describe('checkbox', () => {
    it('binds checked state from payload-on/off', async () => {
        const el = await mount('feezal-element-material-checkbox', {
            'subscribe': 'stat/flag', 'payload-on': 'yes', 'payload-off': 'no'
        });
        const box = el.shadowRoot.querySelector('md-checkbox');

        feezal.connection.deliver('stat/flag', 'yes');
        await el.updateComplete;
        await box.updateComplete;
        expect(box.checked).toBe(true);

        feezal.connection.deliver('stat/flag', 'no');
        await el.updateComplete;
        await box.updateComplete;
        expect(box.checked).toBe(false);
    });

    it('publishes payload-on / payload-off on change', async () => {
        const el = await mount('feezal-element-material-checkbox', {
            'publish': 'cmnd/flag', 'payload-on': 'yes', 'payload-off': 'no'
        });
        const box = el.shadowRoot.querySelector('md-checkbox');
        box.checked = true;
        box.dispatchEvent(new Event('change'));
        box.checked = false;
        box.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toEqual([
            {topic: 'cmnd/flag', payload: 'yes'},
            {topic: 'cmnd/flag', payload: 'no'}
        ]);
    });

    it('does not publish without a topic', async () => {
        const el = await mount('feezal-element-material-checkbox', {});
        const box = el.shadowRoot.querySelector('md-checkbox');
        box.checked = true;
        box.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toEqual([]);
    });
});

describe('contact', () => {
    it('maps open/closed/tilted payloads to the contact state', async () => {
        const el = await mount('feezal-element-material-contact', {
            'subscribe': 'stat/window', 'payload-tilted': 'TILTED'
        });

        feezal.connection.deliver('stat/window', 'ON');       // default payload-open
        expect(el._contactState).toBe('open');

        feezal.connection.deliver('stat/window', 'OFF');
        expect(el._contactState).toBe('closed');

        feezal.connection.deliver('stat/window', 'TILTED');
        expect(el._contactState).toBe('tilted');
    });

    it('tracks multiple contacts from the contacts JSON attribute', async () => {
        const el = await mount('feezal-element-material-contact', {
            contacts: JSON.stringify([
                {subscribe: 'w/1', label: 'One'},
                {subscribe: 'w/2', label: 'Two'}
            ])
        });
        feezal.connection.deliver('w/2', 'ON');
        await el.updateComplete;
        const dots = el.shadowRoot.querySelectorAll('.multi-dot');
        expect(dots).toHaveLength(2);
        expect(dots[0].classList.contains('open')).toBe(false);
        expect(dots[1].classList.contains('open')).toBe(true);
    });

    it('shows the unavailable marker when the availability topic reports offline', async () => {
        const el = await mount('feezal-element-material-contact', {
            'subscribe': 'stat/window',
            'subscribe-availability': 'tele/window/LWT'
        });
        feezal.connection.deliver('tele/window/LWT', 'offline');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.unavail')).not.toBeNull();

        feezal.connection.deliver('tele/window/LWT', 'online');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.unavail')).toBeNull();
    });
});

describe('motion', () => {
    it('maps active/clear payloads, unwrapping JSON state objects', async () => {
        const el = await mount('feezal-element-material-motion', {subscribe: 'stat/pir'});

        feezal.connection.deliver('stat/pir', 'ON');
        expect(el._active).toBe(true);

        feezal.connection.deliver('stat/pir', 'OFF');
        expect(el._active).toBe(false);

        feezal.connection.deliver('stat/pir', {state: 'ON'});   // zigbee2mqtt-style
        expect(el._active).toBe(true);
    });
});

describe('select', () => {
    it('renders options from the JSON attribute and follows the subscribed value', async () => {
        const el = await mount('feezal-element-material-select', {
            subscribe: 'stat/mode',
            options: JSON.stringify([
                {value: 'auto', label: 'Auto'},
                {value: 'eco', label: 'Eco'}
            ])
        });
        const options = el.shadowRoot.querySelectorAll('md-select-option');
        expect(options).toHaveLength(2);

        feezal.connection.deliver('stat/mode', 'eco');
        await el.updateComplete;
        expect(el._value).toBe('eco');
        expect(options[1].hasAttribute('selected') || options[1].selected).toBe(true);
    });
});

describe('input', () => {
    it('binds the payload into the text field', async () => {
        const el = await mount('feezal-element-material-input', {subscribe: 'stat/name'});
        feezal.connection.deliver('stat/name', 'living room');
        await el.updateComplete;
        const field = el.shadowRoot.querySelector('md-outlined-text-field');
        await field.updateComplete;
        expect(field.value).toBe('living room');
    });

    it('publishes on Enter and on blur', async () => {
        const el = await mount('feezal-element-material-input', {publish: 'cmnd/name'});
        const field = el.shadowRoot.querySelector('md-outlined-text-field');

        field.value = 'kitchen';
        field.dispatchEvent(new Event('input'));
        expect(feezal.connection.published).toEqual([]);   // not publish-on-input

        field.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
        expect(feezal.connection.published).toEqual([{topic: 'cmnd/name', payload: 'kitchen'}]);

        field.dispatchEvent(new Event('blur'));
        expect(feezal.connection.published).toHaveLength(2);
    });

    it('publishes every keystroke with publish-on-input', async () => {
        const el = await mount('feezal-element-material-input', {
            'publish': 'cmnd/live', 'publish-on-input': ''
        });
        const field = el.shadowRoot.querySelector('md-outlined-text-field');
        field.value = 'a';
        field.dispatchEvent(new Event('input'));
        expect(feezal.connection.published).toEqual([{topic: 'cmnd/live', payload: 'a'}]);
    });
});

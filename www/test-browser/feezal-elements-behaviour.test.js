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
import '@feezal/feezal-element-paper-button';
import '@feezal/feezal-element-paper-tabs';
import '@feezal/feezal-element-paper-dropdown';
import {setupFeezal, mount, until} from './helpers.js';

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

    it('B27: Homematic numeric payloads (0/1/2) drive the tristate incl. tilt handle', async () => {
        const el = await mount('feezal-element-material-contact', {
            'subscribe': 'hm/window/STATE',
            'payload-closed': '0', 'payload-open': '1', 'payload-tilted': '2'
        });

        feezal.connection.deliver('hm/window/STATE', 2);
        await el.updateComplete;
        expect(el._contactState).toBe('tilted');
        // Handle lever drawn pointing up (pivot y=30 → endpoint y=16)
        const lever = [...el.shadowRoot.querySelectorAll('svg.contact line')].pop();
        expect(lever.getAttribute('y2')).toBe('16');

        feezal.connection.deliver('hm/window/STATE', 1);
        expect(el._contactState).toBe('open');
        feezal.connection.deliver('hm/window/STATE', 0);
        expect(el._contactState).toBe('closed');
    });

    it('B27: rewires subscriptions when the topic changes on the live canvas', async () => {
        const el = await mount('feezal-element-material-contact', {
            'subscribe': 'stat/old', 'payload-tilted': '2'
        });

        el.setAttribute('subscribe', 'stat/new');
        await el.updateComplete;

        feezal.connection.deliver('stat/new', '2');
        expect(el._contactState).toBe('tilted');

        // The stale topic no longer reaches the element
        feezal.connection.deliver('stat/old', 'ON');
        expect(el._contactState).toBe('tilted');
    });

    it('E78: a legacy contacts attribute falls back to single-contact mode (multi-contact removed)', async () => {
        const el = await mount('feezal-element-material-contact', {
            contacts: JSON.stringify([
                {subscribe: 'w/1', label: 'One'},
                {subscribe: 'w/2', label: 'Two'}
            ])
        });
        await el.updateComplete;
        // Multi-contact mode was removed — the attribute is ignored, the
        // element renders the single-contact SVG (compose multiple contact
        // elements for room overviews instead).
        expect(el.shadowRoot.querySelector('.multi-dot')).toBeNull();
        expect(el.shadowRoot.querySelector('svg.contact')).not.toBeNull();
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

// E79: paper-button parity — same state-feedback + disabled contract as
// feezal-element-material-button (see its test file for the material side).
describe('paper-button (E79)', () => {
    it('active/inactive payloads toggle the reflected [active] attribute; others leave it unchanged', async () => {
        const el = await mount('feezal-element-paper-button', {
            label: 'Scene', publish: 'cmnd/scene', subscribe: 'stat/scene'
        });
        expect(el.hasAttribute('active')).toBe(false);

        feezal.connection.deliver('stat/scene', '1');       // default payload-active
        expect(el.hasAttribute('active')).toBe(true);
        feezal.connection.deliver('stat/scene', 'other');
        expect(el.hasAttribute('active')).toBe(true);       // unchanged on other payloads
        feezal.connection.deliver('stat/scene', '0');       // default payload-inactive
        expect(el.hasAttribute('active')).toBe(false);
    });

    it('disabled blocks publishing (UI guard)', async () => {
        const el = await mount('feezal-element-paper-button', {
            label: 'Go', publish: 'cmnd/x'
        });
        el.disabled = true;
        el._click();
        expect(feezal.connection.published).toEqual([]);
        el.disabled = false;
        el._click();
        expect(feezal.connection.published).toEqual([{topic: 'cmnd/x', payload: '1'}]);
    });
});

// U35 adoption: paper-tabs items — JSON array (list editor) + legacy slash format.
describe('paper-tabs items (U35)', () => {
    it('accepts a JSON array of tab names (what the list editor writes)', async () => {
        const el = await mount('feezal-element-paper-tabs', {items: '["One","Two","Three"]'});
        expect(el.arrItems).toEqual(['One', 'Two', 'Three']);
        expect(el.shadowRoot.querySelectorAll('paper-tab')).toHaveLength(3);
    });

    it('legacy slash-separated strings keep working', async () => {
        const el = await mount('feezal-element-paper-tabs', {items: 'One/Two'});
        expect(el.arrItems).toEqual(['One', 'Two']);
    });
});

// U35 adoption: paper-dropdown items — {name, value} rows from the list editor.
describe('paper-dropdown items (U35)', () => {
    it('renders paper-items from the JSON items attribute', async () => {
        const el = await mount('feezal-element-paper-dropdown', {
            items: JSON.stringify([{name: 'One', value: '1'}, {name: 'Two', value: '2'}])
        });
        await new Promise(r => setTimeout(r, 0));   // dom-repeat stamps async
        const opts = el.shadowRoot.querySelectorAll('paper-item');
        expect(opts).toHaveLength(2);
        expect(opts[0].textContent.trim()).toBe('One');
        expect(opts[1].getAttribute('data-value')).toBe('2');
    });
});

// layout-app hide-header: bar removed; floating hamburger keeps the overlay
// drawer reachable when narrow.
describe('layout-app hide-header', () => {
    it('renders the top bar by default and none with hide-header', async () => {
        await import('@feezal/feezal-element-layout-app');
        const withBar = await mount('feezal-element-layout-app', {title: 'T'});
        expect(withBar.shadowRoot.querySelector('.bar')).not.toBeNull();
        withBar.remove();

        const noBar = await mount('feezal-element-layout-app', {title: 'T', 'hide-header': ''});
        expect(noBar.shadowRoot.querySelector('.bar')).toBeNull();
        noBar.remove();
    });

    it('narrow + hide-header shows a floating hamburger that opens the drawer', async () => {
        await import('@feezal/feezal-element-layout-app');
        const el = await mount('feezal-element-layout-app', {'hide-header': '', breakpoint: '768'});
        el.style.cssText = 'display:block;width:400px;height:300px;';
        // ResizeObserver tick — delivery timing varies by engine (webkit on CI
        // needs well over one frame), so wait for the effect, not a fixed time.
        await until(() => el._narrow);
        await el.updateComplete;

        expect(el._narrow).toBe(true);
        const fab = el.shadowRoot.querySelector('.fab-menu');
        expect(fab).not.toBeNull();
        fab.click();
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.drawer').classList.contains('open')).toBe(true);
        // Hamburger hidden while the drawer is open (scrim closes it instead).
        expect(el.shadowRoot.querySelector('.fab-menu')).toBeNull();
        el.remove();
    });
});

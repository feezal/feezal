/**
 * Component tests for the FeezalElement base class — real Lit lifecycle in a
 * real browser: MQTT subscription wiring, the reserved control channel,
 * baseAttribute casting, editor gating and dynamic subscriptions.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {FeezalElement, html} from '@feezal/feezal-element';
import '@feezal/feezal-element-basic-image';
import {setupFeezal, mount} from './helpers.js';

// Plain base-class subclass — no element-specific subscriptions on top.
class TestPlain extends FeezalElement {
    render() { return html`<div>plain</div>`; }
}
customElements.define('feezal-element-test-plain', TestPlain);

// Subclass with a boolean baseAttribute (the "primary state topic" pattern).
class TestActive extends FeezalElement {
    static get feezal() { return {baseAttribute: 'active'}; }
    static properties = {
        ...FeezalElement.properties,
        active: {type: Boolean, reflect: true}
    };
    render() { return html`<div>active</div>`; }
}
customElements.define('feezal-element-test-active', TestActive);

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

describe('subscription lifecycle', () => {
    it('subscribes on connect and unsubscribes on disconnect', async () => {
        const el = await mount('feezal-element-test-plain', {subscribe: 'base/topic'});
        expect(feezal.connection.subCount()).toBeGreaterThan(0);
        el.remove();
        expect(feezal.connection.subCount()).toBe(0);
    });

    it('does not subscribe without a subscribe attribute', async () => {
        await mount('feezal-element-test-plain');
        expect(feezal.connection.subCount()).toBe(0);
    });

    it('is gated in the editor unless preventEditorMqtt is disabled', async () => {
        feezal.isEditor = true;
        await mount('feezal-element-test-plain', {subscribe: 'base/topic'});
        expect(feezal.connection.subCount()).toBe(0);

        feezal.preventEditorMqtt = false;
        await mount('feezal-element-test-plain', {subscribe: 'base/topic'});
        expect(feezal.connection.subCount()).toBeGreaterThan(0);
    });

    it('with dynamic-subscriptions, follows the visible flag', async () => {
        const el = await mount('feezal-element-test-plain', {
            'subscribe': 'dyn/topic',
            'dynamic-subscriptions': ''
        });
        expect(feezal.connection.subCount()).toBe(0);   // not visible yet

        el.visible = true;
        await el.updateComplete;
        expect(feezal.connection.subCount()).toBeGreaterThan(0);

        el.visible = false;
        await el.updateComplete;
        expect(feezal.connection.subCount()).toBe(0);
    });
});

describe('baseAttribute state topic', () => {
    it('sets the attribute from the payload, casting booleans', async () => {
        const el = await mount('feezal-element-test-active', {subscribe: 'dev/state'});

        feezal.connection.deliver('dev/state', '1');
        expect(el.hasAttribute('active')).toBe(true);

        feezal.connection.deliver('dev/state', 'false');
        expect(el.hasAttribute('active')).toBe(false);

        feezal.connection.deliver('dev/state', 'ON');   // non-numeric, not "false"
        expect(el.hasAttribute('active')).toBe(true);

        feezal.connection.deliver('dev/state', '0');
        expect(el.hasAttribute('active')).toBe(false);
    });

    it('respects message-property for nested payloads', async () => {
        const el = await mount('feezal-element-test-active', {
            'subscribe': 'dev/state',
            'message-property': 'payload.value.on'
        });
        feezal.connection.deliver('dev/state', {value: {on: '1'}});
        expect(el.hasAttribute('active')).toBe(true);
    });
});

describe('reserved control channel', () => {
    it('setattribute / removeattribute', async () => {
        const el = await mount('feezal-element-test-plain', {subscribe: 'ctl/base'});

        feezal.connection.deliver('ctl/base/setattribute', {title: 'hello', 'data-x': 5});
        expect(el.getAttribute('title')).toBe('hello');
        expect(el.getAttribute('data-x')).toBe('5');

        feezal.connection.deliver('ctl/base/removeattribute', 'title data-x');
        expect(el.hasAttribute('title')).toBe(false);
        expect(el.hasAttribute('data-x')).toBe(false);
    });

    it('setstyle / removestyle', async () => {
        const el = await mount('feezal-element-test-plain', {subscribe: 'ctl/base'});

        feezal.connection.deliver('ctl/base/setstyle', {opacity: '0.5'});
        expect(getComputedStyle(el).opacity).toBe('0.5');

        feezal.connection.deliver('ctl/base/removestyle', 'opacity');
        expect(getComputedStyle(el).opacity).toBe('1');
    });

    it('addclass / removeclass', async () => {
        const el = await mount('feezal-element-test-plain', {subscribe: 'ctl/base'});

        feezal.connection.deliver('ctl/base/addclass', 'alarm');
        expect(el.classList.contains('alarm')).toBe(true);

        feezal.connection.deliver('ctl/base/removeclass', 'alarm');
        expect(el.classList.contains('alarm')).toBe(false);
    });

    it('device telemetry on the base topic cannot reach the control handlers', async () => {
        const el = await mount('feezal-element-test-plain', {subscribe: 'ctl/base'});
        feezal.connection.deliver('ctl/base', {title: 'not-set-via-state'});
        expect(el.hasAttribute('title')).toBe(false);
    });
});

describe('a real element on top of the base (basic-image)', () => {
    it('renders the src into the shadow-DOM <img> and updates it from MQTT', async () => {
        const el = await mount('feezal-element-basic-image', {
            'src': 'static.png',
            'subscribe': 'img/url'
        });
        let img = el.shadowRoot.querySelector('img');
        expect(img.getAttribute('src')).toBe('static.png');

        feezal.connection.deliver('img/url', 'dynamic.png');
        await el.updateComplete;
        img = el.shadowRoot.querySelector('img');
        expect(img.getAttribute('src')).toBe('dynamic.png');
    });

    it('navigates JSON payloads via message-property', async () => {
        const el = await mount('feezal-element-basic-image', {
            'subscribe': 'img/meta',
            'message-property': 'payload.url'
        });
        feezal.connection.deliver('img/meta', {url: 'from-json.png'});
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('img').getAttribute('src')).toBe('from-json.png');
    });

    it('applies the fit attribute as object-fit', async () => {
        const el = await mount('feezal-element-basic-image', {src: 'x.png', fit: 'cover'});
        expect(getComputedStyle(el.shadowRoot.querySelector('img')).objectFit).toBe('cover');
    });
});

describe('N31 — base-class availability', () => {
    it('single topic string: offline payload flips _available and reflects [unavailable] in the viewer', async () => {
        const el = await mount('feezal-element-test-plain', {'subscribe-availability': 'tele/dev/LWT'});
        expect(el._available).toBe(true);

        feezal.connection.deliver('tele/dev/LWT', 'offline');
        expect(el._available).toBe(false);
        expect(el.hasAttribute('unavailable')).toBe(true);

        feezal.connection.deliver('tele/dev/LWT', 'online');
        expect(el._available).toBe(true);
        expect(el.hasAttribute('unavailable')).toBe(false);
    });

    it('unwraps JSON {"state":"..."} payloads (zigbee2mqtt availability)', async () => {
        const el = await mount('feezal-element-test-plain', {'subscribe-availability': 'z2m/dev/availability'});
        feezal.connection.deliver('z2m/dev/availability', '{"state":"offline"}');
        expect(el._available).toBe(false);
    });

    it('JSON array + mode all: every topic must be available', async () => {
        const el = await mount('feezal-element-test-plain', {
            'subscribe-availability': JSON.stringify(['z2m/bridge/state', 'z2m/dev/availability'])
        });
        feezal.connection.deliver('z2m/bridge/state', 'online');
        expect(el._available).toBe(true);
        feezal.connection.deliver('z2m/dev/availability', 'offline');
        expect(el._available).toBe(false);
        feezal.connection.deliver('z2m/dev/availability', 'online');
        expect(el._available).toBe(true);
    });

    it('mode any: one available topic suffices', async () => {
        const el = await mount('feezal-element-test-plain', {
            'subscribe-availability': JSON.stringify(['a/1', 'a/2']),
            'availability-mode': 'any'
        });
        feezal.connection.deliver('a/1', 'offline');
        feezal.connection.deliver('a/2', 'offline');
        expect(el._available).toBe(false);
        feezal.connection.deliver('a/2', 'online');
        expect(el._available).toBe(true);
    });

    it('per-entry property overrides the payload path', async () => {
        const el = await mount('feezal-element-test-plain', {
            'subscribe-availability': JSON.stringify([{topic: 'b/state', property: 'payload.state'}])
        });
        feezal.connection.deliver('b/state', {state: 'offline'});
        expect(el._available).toBe(false);
    });

    it('rewires when the attribute changes on the live canvas', async () => {
        const el = await mount('feezal-element-test-plain', {'subscribe-availability': 'old/LWT'});
        el.setAttribute('subscribe-availability', 'new/LWT');
        await el.updateComplete;
        feezal.connection.deliver('new/LWT', 'offline');
        expect(el._available).toBe(false);
        // stale topic no longer counts
        feezal.connection.deliver('old/LWT', 'online');
        expect(el._available).toBe(false);
    });

    it('never reflects [unavailable] in the editor (attribute would be serialized)', async () => {
        feezal.isEditor = true;
        const el = await mount('feezal-element-test-plain', {'subscribe-availability': 'tele/dev/LWT'});
        feezal.connection.deliver('tele/dev/LWT', 'offline');
        expect(el._available).toBe(false);
        expect(el.hasAttribute('unavailable')).toBe(false);
    });
});

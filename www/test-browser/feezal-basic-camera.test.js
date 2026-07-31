/**
 * E163 — basic-camera (hard-renamed from circle-camera): the pure-MQTT paths
 * and the configurable chrome. Streams (mjpeg/hls/webrtc) keep their e2e
 * coverage in test-e2e/material-camera.test.js; this suite drives the new
 * mqtt-image source, state chips, the Frigate-style event list and the
 * every-button-optional contract through the fake connection.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-basic-camera/feezal-element-basic-camera.js';
import {setupFeezal, mount} from './helpers.js';

// a 1×1 transparent gif — a valid, tiny data URL
const DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const BASE64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'.repeat(2);

let feezal;
beforeEach(() => {
    feezal = setupFeezal();
});

describe('mqtt-image source (E163)', () => {
    it('renders a data-URL payload straight into the feed', async () => {
        const el = await mount('feezal-element-basic-camera', {type: 'mqtt-image', subscribe: 'cam/snap'});
        expect(el.shadowRoot.querySelector('img.feed')).toBeNull();   // placeholder until a frame arrives
        feezal.connection.deliver('cam/snap', DATA_URL);
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('img.feed').src).toBe(DATA_URL);
    });

    it('prefixes a raw-base64 payload as a jpeg data URL', async () => {
        const el = await mount('feezal-element-basic-camera', {type: 'mqtt-image', subscribe: 'cam/snap'});
        feezal.connection.deliver('cam/snap', BASE64);
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('img.feed').src).toBe('data:image/jpeg;base64,' + BASE64);
    });
});

describe('state chips (all optional chrome)', () => {
    it('a nonzero-gated chip appears only while its value is truthy', async () => {
        const el = await mount('feezal-element-basic-camera', {
            type: 'mqtt-image', subscribe: 'cam/snap',
            chips: JSON.stringify([
                {subscribe: 'cam/person', label: 'Person', show: 'nonzero'},
                {subscribe: 'cam/name', label: 'Front', show: 'always'},
            ]),
        });
        await el.updateComplete;
        // the always chip renders immediately, the nonzero one waits
        let chips = [...el.shadowRoot.querySelectorAll('.chip')].map(c => c.textContent.trim());
        expect(chips).toEqual(['Front']);
        feezal.connection.deliver('cam/person', '2');
        await el.updateComplete;
        chips = [...el.shadowRoot.querySelectorAll('.chip')].map(c => c.textContent.trim());
        expect(chips.some(c => c.startsWith('Person'))).toBe(true);
        feezal.connection.deliver('cam/person', '0');
        await el.updateComplete;
        chips = [...el.shadowRoot.querySelectorAll('.chip')].map(c => c.textContent.trim());
        expect(chips).toEqual(['Front']);
    });
});

describe('event list (Frigate events topic)', () => {
    const EV = (camera, label, id, score = 0.87) => JSON.stringify({
        type: 'update',
        after: {id, camera, label, top_score: score, entered_zones: ['yard'], start_time: 1753700000},
    });

    it('lists events newest-first, camera-filtered, ring-buffered, thumbnailed', async () => {
        const el = await mount('feezal-element-basic-camera', {
            'type': 'mqtt-image', 'subscribe': 'frigate/hof/person/snapshot',
            'show-events': '', 'events-topic': 'frigate/events',
            'events-camera': 'hof', 'events-max': '2', 'event-thumbs': 'frigate/hof',
        });
        feezal.connection.deliver('frigate/hof/person/snapshot', DATA_URL);
        feezal.connection.deliver('frigate/events', EV('hof', 'person', 'e1'));
        feezal.connection.deliver('frigate/events', EV('elsewhere', 'car', 'e2'));   // filtered out
        feezal.connection.deliver('frigate/events', EV('hof', 'car', 'e3'));
        feezal.connection.deliver('frigate/events', EV('hof', 'dog', 'e4'));         // evicts e1
        await el.updateComplete;
        const rows = [...el.shadowRoot.querySelectorAll('.ev-row')];
        expect(rows).toHaveLength(2);
        expect(rows[0].querySelector('.ev-label').textContent).toBe('dog');
        expect(rows[1].querySelector('.ev-label').textContent).toBe('car');
        expect(rows[0].querySelector('.ev-score').textContent).toBe('87%');
        expect(rows[0].querySelector('.ev-zones').textContent).toBe('yard');
        // the person snapshot arrived on the thumbs wildcard → person thumb known
        expect(el._thumbs.person).toBe(DATA_URL);
    });

    it('is invisible without show-events — optional chrome', async () => {
        const el = await mount('feezal-element-basic-camera', {
            'type': 'mqtt-image', 'subscribe': 'cam/snap',
            'events-topic': 'frigate/events',
        });
        feezal.connection.deliver('frigate/events', EV('hof', 'person', 'e1'));
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.ev-row')).toBeNull();
    });
});

describe('configurable buttons (E163 refinement — every knob optional)', () => {
    it('the fullscreen button is opt-in and opens the popup', async () => {
        const el = await mount('feezal-element-basic-camera',
            {type: 'mqtt-image', subscribe: 'cam/snap'});
        feezal.connection.deliver('cam/snap', DATA_URL);
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.btn-fullscreen')).toBeNull();   // off by default
        el.setAttribute('show-fullscreen-button', '');
        await el.updateComplete;
        el.shadowRoot.querySelector('.btn-fullscreen').click();
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.popup')).not.toBeNull();
        expect(el.shadowRoot.querySelector('.popup .close')).not.toBeNull();   // default on
    });

    it('the popup close button can be disabled; Esc still closes', async () => {
        const el = await mount('feezal-element-basic-camera', {
            'type': 'mqtt-image', 'subscribe': 'cam/snap',
            'click-action': 'popup', 'popup-close-button': 'false',
        });
        feezal.connection.deliver('cam/snap', DATA_URL);
        await el.updateComplete;
        el.click();
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.popup')).not.toBeNull();
        expect(el.shadowRoot.querySelector('.popup .close')).toBeNull();
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.popup')).toBeNull();
    });

    it('live-on-demand: popup-type/popup-src open a different feed than the tile', async () => {
        const el = await mount('feezal-element-basic-camera', {
            'type': 'image', 'src': 'http://cam/still.jpg',
            'click-action': 'popup', 'popup-type': 'mjpeg', 'popup-src': 'http://cam/stream',
        });
        await el.updateComplete;
        el.click();
        await el.updateComplete;
        const img = el.shadowRoot.querySelector('.popup img.feed');
        expect(img.src).toBe('http://cam/stream');
    });
});

describe('pause-when-hidden (stop the feed off-screen)', () => {
    it('tears the feed + refresh timer down while hidden and restores when shown', async () => {
        const el = await mount('feezal-element-basic-camera', {
            'type': 'image', 'src': 'http://cam/still.jpg', 'refresh': '5', 'pause-when-hidden': '',
        });
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('img.feed')).not.toBeNull();
        expect(el.__refreshTimer).not.toBeNull();

        // Drive the observer deterministically — the live IntersectionObserver
        // would otherwise race the assertions with its own async callback.
        el._stopVisibilityWatch();
        el.__intersecting = false;
        el._recomputeVisibility();
        await el.updateComplete;
        expect(el._streamPaused).toBe(true);
        expect(el.shadowRoot.querySelector('img.feed')).toBeNull();      // feed dropped
        expect(el.shadowRoot.querySelector('.placeholder')).not.toBeNull();
        expect(el.__refreshTimer).toBeNull();                            // timer stopped

        el.__intersecting = true;
        el._recomputeVisibility();
        await el.updateComplete;
        expect(el._streamPaused).toBe(false);
        expect(el.shadowRoot.querySelector('img.feed')).not.toBeNull();  // feed back
        expect(el.__refreshTimer).not.toBeNull();
    });

    it('wires no observer unless pause-when-hidden is set', async () => {
        const el = await mount('feezal-element-basic-camera', {
            'type': 'image', 'src': 'http://cam/still.jpg',
        });
        await el.updateComplete;
        expect(el.__io).toBeNull();
        expect(el.shadowRoot.querySelector('img.feed')).not.toBeNull();
    });
});

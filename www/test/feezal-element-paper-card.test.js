import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../packages/@feezal/feezal-element-paper-card/feezal-element-paper-card.js';

let subCallbacks;

beforeEach(() => {
    subCallbacks = {};
    feezal.isEditor = false;
    feezal.connection = {
        sub: vi.fn((topic, cb) => { subCallbacks[topic] = cb; return {topic}; }),
        unsubscribe: vi.fn(),
        pub: vi.fn(),
    };
});

afterEach(() => {
    document.body.innerHTML = '';
});

async function mount(tag, attrs = {}, templateHtml) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }

    if (templateHtml) {
        const tpl = document.createElement('template');
        tpl.innerHTML = templateHtml;
        el.append(tpl);
    }

    document.body.append(el);
    await el.updateComplete;
    return el;
}

// E87: paper-card — renamed + modernised successor of paper-card-template.

describe('paper-card (E87)', () => {
    it('is named Card in the Paper palette category', () => {
        const cls = customElements.get('feezal-element-paper-card');
        expect(cls.feezal.palette).toMatchObject({category: 'Paper', name: 'Card'});
    });

    it('renders heading, subhead and header image', async () => {
        const el = await mount('feezal-element-paper-card', {
            heading: 'Living Room', subhead: 'Temperature', image: '/assets/room.jpg', 'image-height': '80px',
        });
        expect(el.renderRoot.querySelector('.card-heading').textContent).toBe('Living Room');
        expect(el.renderRoot.querySelector('.card-subhead').textContent).toBe('Temperature');
        const img = el.renderRoot.querySelector('.card-image');
        expect(img.getAttribute('src')).toBe('/assets/room.jpg');
        expect(img.getAttribute('style')).toContain('height:80px');
    });

    it('hides the header without heading/subhead', async () => {
        const el = await mount('feezal-element-paper-card');
        expect(el.renderRoot.querySelector('.card-header')).toBeNull();
    });

    it('renders the ${msg.*} template body from the subscribed topic', async () => {
        const el = await mount('feezal-element-paper-card', {subscribe: 'room/temp'},
            '${msg.payload} °C');
        subCallbacks['room/temp']({topic: 'room/temp', payload: '21.5'});
        await el.updateComplete;
        expect(el.renderRoot.querySelector('#content').innerHTML).toBe('21.5 °C');
    });

    it('elevation reflects for the shadow rules (0–5)', async () => {
        const el = await mount('feezal-element-paper-card', {elevation: '3'});
        expect(el.getAttribute('elevation')).toBe('3');
        expect(el.elevation).toBe(3);
    });
});

describe('legacy alias feezal-element-paper-card-template (E87 migration)', () => {
    it('stays registered and maps topic → subscribe', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const el = await mount('feezal-element-paper-card-template',
            {topic: 'legacy/topic', heading: 'Old Card'},
            'v=${msg.payload}');

        expect(el.getAttribute('subscribe')).toBe('legacy/topic');
        expect(feezal.connection.sub).toHaveBeenCalledWith('legacy/topic', expect.any(Function));
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('deprecated'));

        subCallbacks['legacy/topic']({topic: 'legacy/topic', payload: '7'});
        await el.updateComplete;
        expect(el.renderRoot.querySelector('#content').innerHTML).toBe('v=7');
        expect(el.renderRoot.querySelector('.card-heading').textContent).toBe('Old Card');
        warn.mockRestore();
    });

    it('an explicit subscribe wins over the legacy topic attribute', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const el = await mount('feezal-element-paper-card-template',
            {topic: 'legacy/topic', subscribe: 'new/topic'});
        expect(el.getAttribute('subscribe')).toBe('new/topic');
        warn.mockRestore();
    });
});

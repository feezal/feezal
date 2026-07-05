import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../packages/@feezal/feezal-element-basic-qrcode/feezal-element-basic-qrcode.js';

beforeEach(() => {
    feezal.connection = {sub: vi.fn(() => ({})), unsubscribe: vi.fn(), pub: vi.fn()};
});

afterEach(() => {
    document.body.innerHTML = '';
});

async function mount(attrs = {}, {editor = true} = {}) {
    feezal.isEditor = editor;
    const el = document.createElement('feezal-element-basic-qrcode');
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }

    document.body.append(el);
    await el.updateComplete;
    return el;
}

describe('descriptor', () => {
    it('declares baseAttribute value so payloads drive the code', () => {
        const cls = customElements.get('feezal-element-basic-qrcode');
        expect(cls.feezal.baseAttribute).toBe('value');
        expect(cls.feezal.palette).toMatchObject({category: 'Basic', name: 'QR Code'});
    });

    it('exposes module and background colours as themeable style descriptors', () => {
        const cls = customElements.get('feezal-element-basic-qrcode');
        const colors = cls.feezal.styles.filter(s => typeof s === 'object' && s.type === 'color');
        expect(colors.map(c => c.property)).toEqual(['--feezal-qrcode-color', '--feezal-qrcode-background']);
    });
});

describe('rendering', () => {
    it('renders an SVG QR code with a 2-module quiet zone', async () => {
        const el = await mount({value: 'hello'});
        const svg = el.shadowRoot.querySelector('svg');
        expect(svg).toBeTruthy();
        // 'hello' fits QR version 1 → 21 modules; viewBox adds 2 on each side
        expect(svg.getAttribute('viewBox')).toBe('-2 -2 25 25');
        expect(el.shadowRoot.querySelector('.qr-fg').getAttribute('d')).toMatch(/^M/);
        expect(el.shadowRoot.querySelector('.qr-bg')).toBeTruthy();
    });

    it('a payload-style attribute update re-encodes the code', async () => {
        const el = await mount({value: 'aaaa'});
        const before = el.shadowRoot.querySelector('.qr-fg').getAttribute('d');
        el.setAttribute('value', 'bbbb'); // what _subscribe does with a payload
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.qr-fg').getAttribute('d')).not.toBe(before);
    });

    it('grows to a larger QR version for longer content', async () => {
        const el = await mount({value: 'x'.repeat(200)});
        const [, , size] = el.shadowRoot.querySelector('svg').getAttribute('viewBox').split(' ').map(Number);
        expect(size).toBeGreaterThan(25);
    });

    it('encodes non-ASCII content as UTF-8 without breaking', async () => {
        const el = await mount({value: 'Grüße 🎉'});
        expect(el.shadowRoot.querySelector('.qr-fg').getAttribute('d')).toMatch(/^M/);
    });

    it('honours the error-correction level (denser code at H than L)', async () => {
        const data = 'x'.repeat(100);
        const low = await mount({value: data, ecc: 'L'});
        const high = await mount({value: data, ecc: 'H'});
        const size = el => Number(el.shadowRoot.querySelector('svg').getAttribute('viewBox').split(' ')[2]);
        expect(size(high)).toBeGreaterThan(size(low));
    });

    it('renders the optional caption and uses it as the aria-label', async () => {
        const el = await mount({value: 'x', label: 'Guest WiFi'});
        expect(el.shadowRoot.querySelector('.label').textContent).toBe('Guest WiFi');
        expect(el.shadowRoot.querySelector('svg').getAttribute('aria-label')).toBe('Guest WiFi');
    });
});

describe('edge states', () => {
    it('shows a data-too-long error instead of crashing', async () => {
        const el = await mount({value: 'x'.repeat(3000)});
        expect(el.shadowRoot.querySelector('.error').textContent).toContain('data too long');
        expect(el.shadowRoot.querySelector('svg')).toBeNull();
    });

    it('recovers when oversized content is replaced by a valid payload', async () => {
        const el = await mount({value: 'x'.repeat(3000)});
        el.setAttribute('value', 'ok');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('svg')).toBeTruthy();
        expect(el.shadowRoot.querySelector('.error')).toBeNull();
    });

    it('empty value: placeholder in the editor, nothing in the viewer', async () => {
        const ed = await mount();
        expect(ed.shadowRoot.querySelector('.editor-ph')).toBeTruthy();
        const vw = await mount({}, {editor: false});
        expect(vw.shadowRoot.querySelector('svg')).toBeNull();
        expect(vw.shadowRoot.querySelector('.editor-ph')).toBeNull();
    });
});

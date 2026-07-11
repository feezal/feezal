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

// ─── E76: content assistant — pure generate/parse helpers ────────────────────

import {buildQrValue, parseQrValue} from '../packages/@feezal/feezal-element-basic-qrcode/feezal-element-basic-qrcode.js';

describe('buildQrValue (E76)', () => {
    it('url: prefixes https:// only when the scheme is missing', () => {
        expect(buildQrValue('url', {url: 'example.com/x'})).toBe('https://example.com/x');
        expect(buildQrValue('url', {url: 'http://example.com'})).toBe('http://example.com');
        expect(buildQrValue('url', {url: ''})).toBe('');
    });

    it('wifi: escapes backslash ; , " : in ssid and password', () => {
        expect(buildQrValue('wifi', {ssid: 'My;Net', password: 'p"w:1,2', security: 'WPA'}))
            .toBe('WIFI:S:My\\;Net;T:WPA;P:p\\"w\\:1\\,2;;');
    });

    it('wifi: nopass omits P, hidden adds H:true', () => {
        expect(buildQrValue('wifi', {ssid: 'Guest', security: 'nopass', password: 'ignored', hidden: true}))
            .toBe('WIFI:S:Guest;T:nopass;H:true;;');
    });

    it('email: URL-encodes subject and body', () => {
        expect(buildQrValue('email', {to: 'a@b.c', subject: 'Hi there', body: 'x&y'}))
            .toBe('mailto:a@b.c?subject=Hi%20there&body=x%26y');
        expect(buildQrValue('email', {to: 'a@b.c'})).toBe('mailto:a@b.c');
    });

    it('phone / sms / geo', () => {
        expect(buildQrValue('phone', {number: '+491701234567'})).toBe('tel:+491701234567');
        expect(buildQrValue('sms', {number: '+49170', message: 'Hello'})).toBe('SMSTO:+49170:Hello');
        expect(buildQrValue('sms', {number: '+49170'})).toBe('SMSTO:+49170');
        expect(buildQrValue('geo', {lat: '53.55', lon: '9.99'})).toBe('geo:53.55,9.99');
    });

    it('vcard: minimal 3.0 with optional fields', () => {
        expect(buildQrValue('vcard', {name: 'Jane Doe', phone: '+49', org: 'ACME'}))
            .toBe('BEGIN:VCARD\nVERSION:3.0\nFN:Jane Doe\nTEL:+49\nORG:ACME\nEND:VCARD');
    });

    it('text: verbatim', () => {
        expect(buildQrValue('text', {text: 'anything WIFI:-ish'})).toBe('anything WIFI:-ish');
    });
});

describe('parseQrValue (E76 round-trip)', () => {
    it('round-trips every preset type', () => {
        const cases = [
            ['wifi', {ssid: 'My;Net', password: 'p"w:1,2', security: 'WPA', hidden: false}],
            ['wifi', {ssid: 'Guest', password: '', security: 'nopass', hidden: true}],
            ['email', {to: 'a@b.c', subject: 'Hi there', body: 'x&y'}],
            ['phone', {number: '+4917012'}],
            ['sms', {number: '+49170', message: 'Hello'}],
            ['geo', {lat: '53.55', lon: '9.99'}],
            ['vcard', {name: 'Jane', phone: '+49', email: 'j@d.e', org: 'ACME', url: 'https://acme.io'}],
        ];
        for (const [type, fields] of cases) {
            const parsed = parseQrValue(buildQrValue(type, fields));
            expect(parsed.type, type).toBe(type);
            expect(parsed.fields, type).toMatchObject(fields);
        }
    });

    it('plain https URLs open as url type', () => {
        expect(parseQrValue('https://example.com')).toEqual({type: 'url', fields: {url: 'https://example.com'}});
    });

    it('unknown content opens as text/raw with the string as-is', () => {
        expect(parseQrValue('hello world')).toEqual({type: 'text', fields: {text: 'hello world'}});
        expect(parseQrValue('')).toEqual({type: 'text', fields: {text: ''}});
    });

    it('an unparseable WIFI:-prefixed value falls back to raw (never destroyed)', () => {
        const broken = 'WIFI:garbage-without-keys';
        expect(parseQrValue(broken)).toEqual({type: 'text', fields: {text: broken}});
    });
});

describe('qrcode content-assistant inspector (E76)', () => {
    it('is declared in the descriptor and registered', () => {
        const cls = customElements.get('feezal-element-basic-qrcode');
        expect(cls.feezal.inspector).toBe('feezal-element-basic-qrcode-inspector');
        expect(customElements.get('feezal-element-basic-qrcode-inspector')).toBeTruthy();
    });

    it('opens on the parsed type and emits a regenerated value on field edits', async () => {
        const target = document.createElement('feezal-element-basic-qrcode');
        target.setAttribute('value', 'WIFI:S:Guest;T:WPA;P:secret;;');
        document.body.append(target);

        const insp = document.createElement('feezal-element-basic-qrcode-inspector');
        insp.element = target;
        document.body.append(insp);
        await insp.updateComplete;

        expect(insp._type).toBe('wifi');
        expect(insp._fields).toMatchObject({ssid: 'Guest', password: 'secret'});

        const emitted = vi.fn();
        insp.addEventListener('feezal-attribute-changed', emitted);
        insp._setField('ssid', 'Lounge');
        expect(emitted.mock.calls.at(-1)[0].detail)
            .toEqual({name: 'value', value: 'WIFI:S:Lounge;T:WPA;P:secret;;'});
    });

    it('switching the type does not clobber the value until a field is edited', async () => {
        const target = document.createElement('feezal-element-basic-qrcode');
        target.setAttribute('value', 'https://example.com');
        document.body.append(target);

        const insp = document.createElement('feezal-element-basic-qrcode-inspector');
        insp.element = target;
        document.body.append(insp);
        await insp.updateComplete;
        expect(insp._type).toBe('url');

        const emitted = vi.fn();
        insp.addEventListener('feezal-attribute-changed', emitted);
        insp._setType('wifi');
        await insp.updateComplete;
        expect(emitted).not.toHaveBeenCalled();          // switch alone emits nothing
        expect(target.getAttribute('value')).toBe('https://example.com');
    });
});

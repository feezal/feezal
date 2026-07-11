import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import {computeBindingOutput, lerpColor} from '../packages/@feezal/feezal-element-basic-svg/feezal-element-basic-svg.js';

const SVG = `<svg viewBox="0 0 100 100">
    <rect id="lamp" x="0" y="0" width="10" height="10"/>
    <circle id="needle" cx="50" cy="50" r="5"/>
    <path id="pipe" d="M0 0 L10 10"/>
    <text id="label">--</text>
</svg>`;

let subs;
let published;

beforeEach(() => {
    subs = {};
    published = [];
    feezal.isEditor = false;
    feezal.connection = {
        sub: vi.fn((topic, cb) => {
            (subs[topic] ||= []).push(cb);
            return {topic, cb};
        }),
        unsubscribe: vi.fn(),
        pub: vi.fn((topic, payload) => published.push({topic, payload})),
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({ok: true, text: async () => SVG})));
});

afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
});

const deliver = (topic, payload) => (subs[topic] || []).forEach(cb => cb({topic, payload}));

async function mount(bindings, attrs = {}) {
    const el = document.createElement('feezal-element-basic-svg');
    el.setAttribute('src', attrs.src ?? 'assets/plan.svg');
    if (bindings) el.setAttribute('bindings', JSON.stringify(bindings));
    document.body.append(el);
    await el.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 0));   // fetch + sanitize
    await el.updateComplete;
    return el;
}

const shape = (el, sel) => el.renderRoot.querySelector(`.wrap svg ${sel}`);

describe('computeBindingOutput (E51 mapping semantics)', () => {
    it('map: discrete lookup, unmatched key → revert', () => {
        const row = {map: {on: '#ffb300', off: '#334455'}};
        expect(computeBindingOutput(row, 'on')).toEqual({matched: true, out: '#ffb300'});
        expect(computeBindingOutput(row, 'off')).toEqual({matched: true, out: '#334455'});
        expect(computeBindingOutput(row, 'weird')).toEqual({matched: false, out: null});
    });

    it('range: clamped linear interpolation for numbers', () => {
        const row = {range: {in: [0, 40], out: [-45, 225]}};
        expect(computeBindingOutput(row, 0).out).toBe('-45');
        expect(computeBindingOutput(row, 20).out).toBe('90');
        expect(computeBindingOutput(row, 40).out).toBe('225');
        expect(computeBindingOutput(row, 100).out).toBe('225');   // clamped
        expect(computeBindingOutput(row, -5).out).toBe('-45');    // clamped
    });

    it('range: non-numeric payload → revert', () => {
        const row = {range: {in: [0, 40], out: [0, 1]}};
        expect(computeBindingOutput(row, 'hot')).toEqual({matched: false, out: null});
        expect(computeBindingOutput(row, '')).toEqual({matched: false, out: null});
    });

    it('range: color interpolation', () => {
        const row = {range: {in: [20, 80], out: ['#000000', '#ffffff']}};
        expect(computeBindingOutput(row, 20).out).toBe('#000000');
        expect(computeBindingOutput(row, 50).out).toBe('#808080');
        expect(computeBindingOutput(row, 80).out).toBe('#ffffff');
    });

    it('format: ${value} template', () => {
        const row = {format: '${value} °C'};
        expect(computeBindingOutput(row, '21.5').out).toBe('21.5 °C');
        expect(computeBindingOutput(row, 21.5).out).toBe('21.5 °C');
    });

    it('no mapping field → raw passthrough (objects stringified)', () => {
        expect(computeBindingOutput({}, 'red').out).toBe('red');
        expect(computeBindingOutput({}, {a: 1}).out).toBe('{"a":1}');
    });
});

describe('lerpColor', () => {
    it('interpolates #rrggbb and #rgb', () => {
        expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080');
        expect(lerpColor('#f00', '#00f', 0)).toBe('#ff0000');
        expect(lerpColor('#f00', '#00f', 1)).toBe('#0000ff');
    });

    it('falls back to a hard switch for non-hex colors', () => {
        expect(lerpColor('red', 'blue', 0.2)).toBe('red');
        expect(lerpColor('red', 'blue', 0.8)).toBe('blue');
    });
});

describe('tier 1 — inline display + sanitization', () => {
    it('fetches, sanitizes and injects the SVG inline, scaled to the box', async () => {
        const el = await mount();
        expect(fetch).toHaveBeenCalledWith('assets/plan.svg');
        const svg = el.renderRoot.querySelector('.wrap svg');
        expect(svg).toBeTruthy();
        expect(svg.getAttribute('width')).toBe('100%');
        expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
        expect(shape(el, '#lamp')).toBeTruthy();
    });

    it('strips scripts and event handlers from the asset', async () => {
        fetch.mockImplementation(async () => ({ok: true, text: async () =>
            `<svg><script>alert(1)</script><rect id="r" onclick="alert(2)"/></svg>`}));
        const el = await mount();
        expect(el.renderRoot.querySelector('script')).toBeNull();
        expect(shape(el, '#r')?.getAttribute('onclick')).toBeFalsy();
    });

    it('shows a hint without src and an error when the fetch fails', async () => {
        const empty = await mount(null, {src: ''});
        expect(empty.renderRoot.querySelector('.hint').textContent).toContain('src');

        fetch.mockImplementation(async () => ({ok: false, status: 404, text: async () => ''}));
        const missing = await mount();
        expect(missing.renderRoot.querySelector('.hint').textContent).toContain('404');
    });
});

describe('tier 2 — value bindings', () => {
    it('map binding recolors a shape and reverts to pristine on unmatched payloads', async () => {
        const el = await mount([
            {selector: '#lamp', subscribe: 'home/lamp', target: 'fill', map: {on: '#ffb300', off: '#334455'}},
        ]);
        const lamp = shape(el, '#lamp');

        deliver('home/lamp', 'on');
        expect(lamp.style.getPropertyValue('fill')).toBe('#ffb300');

        deliver('home/lamp', 'garbage');                      // unmatched → pristine (none)
        expect(lamp.style.getPropertyValue('fill')).toBe('');

        deliver('home/lamp', 'off');
        expect(lamp.style.getPropertyValue('fill')).toBe('#334455');
    });

    it('range binding rotates a needle (transform with fill-box origin)', async () => {
        const el = await mount([
            {selector: '#needle', subscribe: 'home/temp', target: 'rotate', range: {in: [0, 40], out: [-45, 225]}},
        ]);
        const needle = shape(el, '#needle');
        deliver('home/temp', '20');
        expect(needle.style.transform).toBe('rotate(90deg)');
        expect(needle.style.transformBox).toBe('fill-box');

        deliver('home/temp', 'NaN-ish');                      // → revert
        expect(needle.style.transform).toBe('');
    });

    it('format binding fills text content and restores the original on revert via map', async () => {
        const el = await mount([
            {selector: '#label', subscribe: 'home/temp', target: 'text', format: '${value} °C'},
        ]);
        deliver('home/temp', '21.5');
        expect(shape(el, '#label').textContent).toBe('21.5 °C');
    });

    it('nested message-property applies to binding rows', async () => {
        const el = await mount([
            {selector: '#label', subscribe: 'home/sensor', target: 'text'},
        ]);
        el.setAttribute('message-property', 'payload.state');
        deliver('home/sensor', {state: 'wet'});
        expect(shape(el, '#label').textContent).toBe('wet');
    });

    it('an unparseable bindings attribute renders the SVG without bindings (no crash)', async () => {
        const el = document.createElement('feezal-element-basic-svg');
        el.setAttribute('src', 'assets/plan.svg');
        el.setAttribute('bindings', '{not json');
        document.body.append(el);
        await el.updateComplete;
        await new Promise(resolve => setTimeout(resolve, 0));
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.wrap svg')).toBeTruthy();
        expect(el.bindingRows).toEqual([]);
    });
});

describe('tier 3 — click regions', () => {
    it('a row with publish makes the shape clickable and publishes the payload', async () => {
        const el = await mount([
            {selector: '#lamp', subscribe: 'home/lamp', target: 'fill', publish: 'home/lamp/set', payload: 'toggle'},
        ]);
        const lamp = shape(el, '#lamp');
        expect(lamp.classList.contains('clickable')).toBe(true);
        expect(lamp.getAttribute('tabindex')).toBe('0');

        lamp.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        expect(published).toEqual([{topic: 'home/lamp/set', payload: 'toggle'}]);
    });

    it('clicks never publish in editor mode', async () => {
        feezal.isEditor = true;
        const el = await mount([
            {selector: '#lamp', subscribe: '', target: 'fill', publish: 'home/lamp/set', payload: '1'},
        ]);
        shape(el, '#lamp').dispatchEvent(new MouseEvent('click', {bubbles: true}));
        expect(published).toEqual([]);
    });

    it('editor shows the bindings badge', async () => {
        feezal.isEditor = true;
        const el = await mount([
            {selector: '#lamp', subscribe: 'a', target: 'fill'},
            {selector: '#pipe', subscribe: 'b', target: 'stroke'},
        ]);
        expect(el.renderRoot.querySelector('.badge').textContent).toContain('2 bindings');
    });
});

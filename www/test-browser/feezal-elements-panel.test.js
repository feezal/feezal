/**
 * E56 panel family behaviour tests — the analog-cockpit elements, driven for
 * real: MQTT state binding, publish contracts (incl. editor guards), guard
 * cover, detents, segment rendering and needle/zone geometry.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '@feezal/feezal-element-panel-led';
import '@feezal/feezal-element-panel-switch';
import '@feezal/feezal-element-panel-7seg';
import '@feezal/feezal-element-panel-gauge';
import '@feezal/feezal-element-panel-knob';
import {setupFeezal, mount, until} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

describe('panel-led', () => {
    it('boolean-casts the payload in simple mode', async () => {
        const el = await mount('feezal-element-panel-led', {subscribe: 'stat/lamp'});
        expect(el.shadowRoot.querySelector('.lens.lit')).toBeNull();
        feezal.connection.deliver('stat/lamp', 'true');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.lens.lit')).not.toBeNull();
        feezal.connection.deliver('stat/lamp', '0');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.lens.lit')).toBeNull();
    });

    it('payload-on/payload-off match exactly; states map colour and blink', async () => {
        const el = await mount('feezal-element-panel-led', {
            subscribe: 'stat/pump',
            'payload-on': 'RUN', 'payload-off': 'IDLE',
            states: JSON.stringify([{payload: 'FAULT', color: '#f44336', mode: 'blink-fast'}]),
        });
        feezal.connection.deliver('stat/pump', 'RUN');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.lens.lit')).not.toBeNull();

        feezal.connection.deliver('stat/pump', 'FAULT');
        await el.updateComplete;
        const lens = el.shadowRoot.querySelector('.lens');
        expect(lens.classList.contains('blink-fast')).toBe(true);
        expect(lens.getAttribute('style')).toContain('#f44336');
    });
});

describe('panel-switch', () => {
    it('follows the state topic and publishes payload-on/off on flip', async () => {
        const el = await mount('feezal-element-panel-switch', {
            subscribe: 'stat/relay', publish: 'cmnd/relay',
            'payload-on': 'ON', 'payload-off': 'OFF',
        });
        feezal.connection.deliver('stat/relay', 'ON');
        await el.updateComplete;
        expect(el._on).toBe(true);

        el.shadowRoot.querySelector('svg').dispatchEvent(new MouseEvent('click', {bubbles: true}));
        await el.updateComplete;
        expect(el._on).toBe(false);
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/relay', payload: 'OFF'});
    });

    it('guard: first tap only opens the cover, second tap flips', async () => {
        const el = await mount('feezal-element-panel-switch', {publish: 'cmnd/siren', guard: ''});
        const click = () => el.shadowRoot.querySelector('svg').dispatchEvent(new MouseEvent('click', {bubbles: true}));

        click();
        await el.updateComplete;
        expect(feezal.connection.published).toHaveLength(0);
        expect(el.shadowRoot.querySelector('.cover.open')).not.toBeNull();

        click();
        await el.updateComplete;
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/siren', payload: 'ON'});
        expect(el.shadowRoot.querySelector('.cover.open')).toBeNull();   // closes after the flip
    });

    it('never publishes in the editor', async () => {
        feezal.isEditor = true;
        const el = await mount('feezal-element-panel-switch', {publish: 'cmnd/x'});
        el.shadowRoot.querySelector('svg').dispatchEvent(new MouseEvent('click', {bubbles: true}));
        expect(feezal.connection.published).toHaveLength(0);
    });

    it('the lever shaft is a rect (a <line> has a zero-width bbox — gradient renders nothing)', async () => {
        const el = await mount('feezal-element-panel-switch', {});
        const shaft = el.shadowRoot.querySelector('.lever rect');
        expect(shaft).not.toBeNull();
        expect(el.shadowRoot.querySelector('.lever line')).toBeNull();
    });

    it('label-on/label-off engrave the markers; empty hides them', async () => {
        const el = await mount('feezal-element-panel-switch', {'label-on': 'RUN', 'label-off': 'STOP'});
        const texts = [...el.shadowRoot.querySelectorAll('svg text')].map(t => t.textContent);
        expect(texts).toEqual(['RUN', 'STOP']);
        el.setAttribute('label-off', '');
        await el.updateComplete;
        expect([...el.shadowRoot.querySelectorAll('svg text')].map(t => t.textContent)).toEqual(['RUN']);
    });

    it('direction places OFF: lever points at the active position, layout flips horizontal', async () => {
        const lever = el => el.shadowRoot.querySelector('.lever').getAttribute('style');

        // default (off=down): OFF state points down (180°), ON points up (0°).
        const down = await mount('feezal-element-panel-switch', {subscribe: 'stat/a'});
        expect(lever(down)).toContain('rotate(180deg)');
        expect(down.shadowRoot.querySelector('svg').getAttribute('viewBox')).toBe('0 0 100 120');
        feezal.connection.deliver('stat/a', 'ON');
        await down.updateComplete;
        expect(lever(down)).toContain('rotate(0deg)');

        // off=right: horizontal layout, OFF points right (90°), ON left (-90°).
        const right = await mount('feezal-element-panel-switch', {subscribe: 'stat/b', direction: 'right'});
        expect(right.shadowRoot.querySelector('svg').getAttribute('viewBox')).toBe('0 0 120 100');
        expect(lever(right)).toContain('rotate(90deg)');
        feezal.connection.deliver('stat/b', 'ON');
        await right.updateComplete;
        expect(lever(right)).toContain('rotate(-90deg)');
    });
});

describe('panel-7seg', () => {
    const litCells = el => [...el.shadowRoot.querySelectorAll('svg > g > g')]
        .map(cell => [...cell.querySelectorAll('polygon')].filter(p => !p.classList.contains('ghost')).length);

    it('renders the subscribed value right-aligned with decimal point', async () => {
        const el = await mount('feezal-element-panel-7seg', {subscribe: 'stat/temp', digits: '4'});
        feezal.connection.deliver('stat/temp', '21.5');
        await el.updateComplete;
        expect(el.getAttribute('value')).toBe('21.5');   // baseAttribute wiring

        // 4 cells: blank, 2, 1(+dp), 5 — lit segment counts 0/5/2/5.
        expect(litCells(el)).toEqual([0, 5, 2, 5]);
        // dp sits on the "1" cell (index 2).
        const dps = [...el.shadowRoot.querySelectorAll('svg > g > g')]
            .map(cell => !cell.querySelector('circle').classList.contains('ghost'));
        expect(dps).toEqual([false, false, true, false]);
    });

    it('applies fixed decimals and renders minus', async () => {
        const el = await mount('feezal-element-panel-7seg', {digits: '4', decimals: '1', value: '-3'});
        await el.updateComplete;
        // -3.0 → cells: blank, -, 3(+dp), 0
        expect(litCells(el)).toEqual([0, 1, 5, 6]);
    });
});

describe('panel-gauge', () => {
    it('maps the value onto the 240° dial and renders zone arcs', async () => {
        const el = await mount('feezal-element-panel-gauge', {
            subscribe: 'stat/pressure', min: '0', max: '100',
            zones: JSON.stringify([{from: 80, to: 100, color: '#e53935'}]),
        });
        feezal.connection.deliver('stat/pressure', '50');
        await el.updateComplete;
        await new Promise(r => setTimeout(r, 30));
        // 50 % of 240° from 150° = 270°.
        expect(el.__angle).toBeCloseTo(270, 0);
        expect(el.shadowRoot.querySelector('.needle').getAttribute('transform')).toContain('rotate(');
        expect(el.shadowRoot.querySelectorAll('path[stroke="#e53935"]')).toHaveLength(1);
    });

    it('start-angle/sweep-angle reshape the dial; ticks and readout are configurable', async () => {
        const el = await mount('feezal-element-panel-gauge', {
            subscribe: 'stat/x', min: '0', max: '100',
            'start-angle': '180', 'sweep-angle': '180',
            ticks: '4', 'minor-ticks': '1', 'tick-labels': '1',
            'value-prefix': '≈', 'value-suffix': '!', unit: 'V',
        });
        feezal.connection.deliver('stat/x', '50');
        await el.updateComplete;
        await new Promise(r => setTimeout(r, 30));
        // 50 % of 180° from 180° = 270°.
        expect(el.__angle).toBeCloseTo(270, 0);
        // 4 major intervals, no minors → 5 tick lines; a numeral at each.
        expect(el.shadowRoot.querySelectorAll('svg line')).toHaveLength(5);
        expect(el.shadowRoot.querySelector('.readout').textContent).toBe('≈50 V!');

        // ticks=0 removes the scale; show-value=false removes the readout.
        el.setAttribute('ticks', '0');
        el.removeAttribute('show-value');
        await el.updateComplete;
        expect(el.shadowRoot.querySelectorAll('svg line')).toHaveLength(0);
        expect(el.shadowRoot.querySelector('.readout')).toBeNull();
    });

    it('the needle spring animates toward a new value', async () => {
        const el = await mount('feezal-element-panel-gauge', {subscribe: 'stat/p', min: '0', max: '100'});
        feezal.connection.deliver('stat/p', '0');
        await el.updateComplete;
        feezal.connection.deliver('stat/p', '100');
        await el.updateComplete;
        // Springs, does not jump: the first observed movement lies between the
        // endpoints. rAF cadence varies by engine (webkit on CI can take much
        // longer than one frame to start), so wait for movement, not a fixed
        // time — per-step displacement is dt-capped, so a 10 ms poll cannot
        // miss the whole transit.
        await until(() => el.__angle > 150);
        expect(el.__angle).toBeLessThan(400);
        // …and settles at the target eventually.
        await until(() => Math.abs(el.__angle - 390) < 0.5);
        expect(el.__angle).toBeCloseTo(390, 0);
    });
});

describe('panel-knob', () => {
    it('follows the subscribe topic and publishes on wheel steps', async () => {
        const el = await mount('feezal-element-panel-knob', {
            subscribe: 'stat/dim', publish: 'cmnd/dim', min: '0', max: '100', step: '5',
        });
        feezal.connection.deliver('stat/dim', '40');
        await el.updateComplete;
        expect(el._value).toBe(40);

        el.dispatchEvent(new WheelEvent('wheel', {deltaY: -1, cancelable: true}));
        await el.updateComplete;
        expect(el._value).toBe(45);
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/dim', payload: '45'});
    });

    it('keyboard arrows / Home / End publish snapped values', async () => {
        const el = await mount('feezal-element-panel-knob', {publish: 'cmnd/vol', min: '0', max: '10', step: '1'});
        el.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowUp', cancelable: true}));
        expect(el._value).toBe(1);
        el.dispatchEvent(new KeyboardEvent('keydown', {key: 'End', cancelable: true}));
        expect(el._value).toBe(10);
        expect(feezal.connection.published.map(p => p.payload)).toEqual(['1', '10']);
    });

    it('drag: pointer angle sets the value; detents snap to step', async () => {
        const el = await mount('feezal-element-panel-knob', {
            publish: 'cmnd/set', min: '0', max: '100', step: '10', detents: '',
        });
        el.style.cssText = 'display:block;width:100px;height:100px;';
        const svgEl = el.shadowRoot.querySelector('svg');
        const rect = svgEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        // Pointer straight ABOVE the centre = middle of the throw = 50.
        svgEl.dispatchEvent(new PointerEvent('pointerdown', {clientX: cx, clientY: cy - 40, bubbles: true, cancelable: true}));
        expect(el._value).toBe(50);
        // Drag right → 3 o'clock = 90° pointer angle = 225/270 of the throw
        // = 83.3 → detents snap to 80.
        window.dispatchEvent(new PointerEvent('pointermove', {clientX: cx + 40, clientY: cy}));
        expect(el._value).toBe(80);
        window.dispatchEvent(new PointerEvent('pointerup', {}));
        expect(feezal.connection.published.at(-1)).toEqual({topic: 'cmnd/set', payload: '80'});
    });

    it('start-angle/sweep-angle reshape the throw; ticks are configurable', async () => {
        const el = await mount('feezal-element-panel-knob', {
            subscribe: 'stat/x', min: '0', max: '100',
            'start-angle': '0', 'sweep-angle': '90', ticks: '4',
        });
        feezal.connection.deliver('stat/x', '100');
        await el.updateComplete;
        // max sits at start + sweep = 90°.
        expect(el.shadowRoot.querySelector('.cap g').getAttribute('transform')).toContain('rotate(90');
        // Ticks are direct SVG children (the indicator line is nested in .cap).
        expect(el.shadowRoot.querySelectorAll('svg > line')).toHaveLength(5);

        el.setAttribute('ticks', '0');
        await el.updateComplete;
        expect(el.shadowRoot.querySelectorAll('svg > line')).toHaveLength(0);
    });

    it('ignores interaction in the editor', async () => {
        feezal.isEditor = true;
        const el = await mount('feezal-element-panel-knob', {publish: 'cmnd/x', min: '0', max: '10'});
        el.dispatchEvent(new WheelEvent('wheel', {deltaY: -1, cancelable: true}));
        el.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowUp', cancelable: true}));
        expect(feezal.connection.published).toHaveLength(0);
    });
});

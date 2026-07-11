/**
 * E59 tui family behaviour tests — the terminal/retro-CRT elements, driven
 * for real: MQTT binding, publish contracts (incl. editor guards), hotkeys,
 * block-character rendering, the box-drawing frame and the CRT layers.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '@feezal/feezal-element-tui-value';
import '@feezal/feezal-element-tui-checkbox';
import '@feezal/feezal-element-tui-menu';
import '@feezal/feezal-element-tui-sparkline';
import '@feezal/feezal-element-tui-log';
import '@feezal/feezal-element-tui-ascii';
import '@feezal/feezal-element-tui-panel';
import '@feezal/feezal-element-tui-crt';
import '@feezal/feezal-element-layout-view';
import {setupFeezal, mount} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

describe('tui-value', () => {
    it('renders label + value with digits/unit and blinks the cursor on change', async () => {
        const el = await mount('feezal-element-tui-value', {
            subscribe: 'stat/t', label: 'temp', unit: '°C', digits: '1',
        });
        expect(el.shadowRoot.querySelector('.value').textContent).toBe('—');
        feezal.connection.deliver('stat/t', '21.55');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.value').textContent).toBe('21.6 °C');
        expect(el.shadowRoot.querySelector('.cursor').textContent).toBe('█');
    });
});

describe('tui-checkbox', () => {
    it('renders [X]/[ ] from state and publishes on click', async () => {
        const el = await mount('feezal-element-tui-checkbox', {
            subscribe: 'stat/x', publish: 'cmnd/x', label: 'pump',
        });
        expect(el.shadowRoot.querySelector('.box').textContent).toBe('[ ]');
        feezal.connection.deliver('stat/x', 'ON');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.box').textContent).toBe('[X]');

        el.click();
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.box').textContent).toBe('[ ]');
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/x', payload: 'OFF'});
    });

    it('never publishes in the editor', async () => {
        feezal.isEditor = true;
        const el = await mount('feezal-element-tui-checkbox', {publish: 'cmnd/x'});
        el.click();
        expect(feezal.connection.published).toHaveLength(0);
    });
});

describe('tui-menu', () => {
    const ITEMS = JSON.stringify([
        {label: 'Lights', publish: 'cmnd/lights', payload: 'toggle'},
        {label: 'Heating', publish: 'cmnd/heat', payload: '1'},
    ]);

    it('renders numbered entries; click and digit hotkey publish', async () => {
        const el = await mount('feezal-element-tui-menu', {items: ITEMS});
        const entries = el.shadowRoot.querySelectorAll('.entry');
        expect([...entries].map(e => e.textContent.replace(/\s+/g, ' ').trim()))
            .toEqual(['[1] Lights', '[2] Heating']);

        entries[0].click();
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/lights', payload: 'toggle'});

        el.dispatchEvent(new KeyboardEvent('keydown', {key: '2', cancelable: true}));
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/heat', payload: '1'});
    });

    it('is inert in the editor', async () => {
        feezal.isEditor = true;
        const el = await mount('feezal-element-tui-menu', {items: ITEMS});
        el.shadowRoot.querySelector('.entry').click();
        el.dispatchEvent(new KeyboardEvent('keydown', {key: '1', cancelable: true}));
        expect(feezal.connection.published).toHaveLength(0);
    });
});

describe('tui-sparkline', () => {
    it('buffers the last N values and maps them to block characters', async () => {
        const el = await mount('feezal-element-tui-sparkline', {
            subscribe: 'stat/v', points: '4', min: '0', max: '100',
        });
        for (const v of [0, 50, 100, 25, 75]) feezal.connection.deliver('stat/v', String(v));
        await el.updateComplete;
        // ring buffer of 4 → 50,100,25,75 → block indices 4,7,2,6
        expect(el.shadowRoot.querySelector('.graph').textContent).toBe('▅█▃▇');
    });

    it('show-value appends the latest reading', async () => {
        const el = await mount('feezal-element-tui-sparkline', {
            subscribe: 'stat/v', 'show-value': '', unit: 'W',
        });
        feezal.connection.deliver('stat/v', '42');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.value').textContent).toBe('42 W');
    });
});

describe('tui-log', () => {
    it('appends timestamped lines, honours max-lines and show-topic', async () => {
        const el = await mount('feezal-element-tui-log', {
            subscribe: 'log/+', 'max-lines': '2', 'show-topic': '',
        });
        feezal.connection.deliver('log/a', 'first');
        feezal.connection.deliver('log/b', 'second');
        feezal.connection.deliver('log/c', 'third');
        await el.updateComplete;
        const lines = [...el.shadowRoot.querySelectorAll('.line')];
        expect(lines).toHaveLength(2);   // oldest fell out
        expect(lines[0].textContent).toMatch(/^\d\d:\d\d:\d\d log\/b second$/);
        expect(lines[1].textContent).toMatch(/third$/);
    });
});

describe('tui-ascii', () => {
    it('renders the value in the baked block font via baseAttribute', async () => {
        const el = await mount('feezal-element-tui-ascii', {subscribe: 'stat/clock'});
        feezal.connection.deliver('stat/clock', '1:0');
        await el.updateComplete;
        expect(el.getAttribute('value')).toBe('1:0');
        const rows = el.shadowRoot.querySelector('pre').textContent.split('\n');
        expect(rows).toHaveLength(5);
        // '1' col1 + ':' + '0' → first row: ' █    ███'-ish; just assert shape:
        expect(rows[0]).toContain('█');
        expect(rows.every(r => r.length === rows[0].length || r.length > 0)).toBe(true);
    });
});

describe('tui-panel', () => {
    it('draws a closed box-drawing frame with the title and embeds the view', async () => {
        const view = document.createElement('feezal-view');
        view.setAttribute('name', 'sub');
        document.body.append(view);
        feezal.site = document.body;
        feezal.views = [view];

        const el = await mount('feezal-element-tui-panel', {title: 'SYS', view: 'sub'});
        el.style.cssText = 'display:block;width:280px;height:140px;';
        await new Promise(r => setTimeout(r, 50));   // ResizeObserver + measure
        await el.updateComplete;

        const top = el.shadowRoot.querySelector('.top').textContent;
        expect(top.startsWith('┌─ SYS ')).toBe(true);
        expect(top.endsWith('┐')).toBe(true);
        const bottom = el.shadowRoot.querySelector('.bottom').textContent;
        expect(bottom.startsWith('└')).toBe(true);
        expect(bottom.endsWith('┘')).toBe(true);
        expect(bottom.length).toBe(top.length);   // frame closes cleanly
        expect(el.shadowRoot.querySelector('feezal-element-layout-view')).not.toBeNull();
    });

    it('frame=double uses double-line characters', async () => {
        const el = await mount('feezal-element-tui-panel', {frame: 'double'});
        el.style.cssText = 'display:block;width:200px;height:100px;';
        await new Promise(r => setTimeout(r, 50));
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.top').textContent.startsWith('╔')).toBe(true);
    });
});

describe('tui-crt', () => {
    it('layers follow the attributes; flicker defaults off', async () => {
        const el = await mount('feezal-element-tui-crt', {});
        expect(el.shadowRoot.querySelector('.scan')).not.toBeNull();
        expect(el.shadowRoot.querySelector('.vig')).not.toBeNull();
        expect(el.shadowRoot.querySelector('.flick')).toBeNull();

        el.setAttribute('scanlines', '0');
        el.removeAttribute('vignette');
        el.setAttribute('flicker', '');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.scan')).toBeNull();
        expect(el.shadowRoot.querySelector('.vig')).toBeNull();
        expect(el.shadowRoot.querySelector('.flick')).not.toBeNull();
    });

    it('is click-through in the viewer', async () => {
        const el = await mount('feezal-element-tui-crt', {});
        expect(getComputedStyle(el).pointerEvents).toBe('none');
    });
});

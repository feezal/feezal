import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../src/feezal-sidebar-inspector-styles.js';
import {FeezalStyleEditorBackground} from '../src/feezal-style-editor-background.js';

// N34: custom style-group editors — the inspector mechanism and its first
// consumer, the unified Background editor.

// Element declaring the background group (same shape as feezal-view's entry).
class GroupTarget extends HTMLElement {
    static feezal = {
        attributes: [],
        styles: ['width', 'height',
            {group: 'background', editor: 'feezal-style-editor-background', label: 'Background'}]
    };
}
customElements.define('feezal-element-group-target', GroupTarget);

function makeEditor(el) {
    const ed = document.createElement('feezal-style-editor-background');
    ed.elements = el ? [el] : [];
    ed.element = el ?? null;
    ed._readFromElement();
    return ed;
}

function lastEmit(ed) {
    let detail = null;
    ed.addEventListener('feezal-style-changed', e => { detail = e.detail; });
    return () => detail;
}

let target;

beforeEach(() => {
    target = document.createElement('feezal-element-group-target');
    document.body.append(target);
    feezal.app = {change: vi.fn()};
    feezal.editor = {selectedElems: [target]};
});

afterEach(() => {
    document.body.innerHTML = '';
});

// ── Inspector group mechanism ─────────────────────────────────────────────

describe('style inspector — group entries (N34)', () => {
    async function makePanel(elems = [target]) {
        const panel = document.createElement('feezal-sidebar-inspector-styles');
        document.body.append(panel);
        panel.selectedElems = elems;
        await panel.updateComplete;
        return panel;
    }

    it('renders a group item with covers from the editor class and suppresses covered longhands', async () => {
        target.style.setProperty('background-image', 'url(/a.png)');
        target.style.setProperty('background-size', 'cover');
        const panel = await makePanel();

        const group = panel.items.find(it => it.group === 'background');
        expect(group).toBeTruthy();
        expect(group.editor).toBe('feezal-style-editor-background');
        expect(group.covers).toEqual(FeezalStyleEditorBackground.covers);
        // The inline background-* longhands must NOT appear as stray custom rows.
        expect(panel.items.some(it => it.custom && it.property?.startsWith('background'))).toBe(false);
        // Ordinary declared rows stay ordinary.
        expect(panel.items.some(it => it.property === 'width')).toBe(true);
    });

    it('mounts the editor widget into the group host with the selection', async () => {
        const panel = await makePanel();
        const host = panel.shadowRoot.querySelector('.group-editor-host');
        expect(host).toBeTruthy();
        const widget = host.firstElementChild;
        expect(widget.localName).toBe('feezal-style-editor-background');
        expect(widget.elements).toBe(panel.selectedElems);
        expect(widget.element).toBe(target);
    });

    it('applies a multi-property change event to every selected element (null removes)', async () => {
        const second = document.createElement('feezal-element-group-target');
        document.body.append(second);
        second.style.setProperty('background-color', 'red');
        const panel = await makePanel([target, second]);

        panel._onGroupStyleChanged(new CustomEvent('feezal-style-changed', {detail: {props: {
            'background-image': "url('/x.jpg')",
            'background-size': 'cover',
            'background-color': null,
        }}}));

        for (const el of [target, second]) {
            expect(el.style.getPropertyValue('background-image')).toContain('/x.jpg');
            expect(el.style.getPropertyValue('background-size')).toBe('cover');
            expect(el.style.getPropertyValue('background-color')).toBe('');
        }
        expect(feezal.app.change).toHaveBeenCalledTimes(1);
    });

    it('refuses to re-add a covered longhand via "Add CSS property"', async () => {
        const panel = await makePanel();
        const before = panel.items.length;
        panel._commitAddProp('background-image');
        expect(panel.items.length).toBe(before);
        panel._onAddPropInput('background');
        expect(panel._addPropList).not.toContain('background-image');
        expect(panel._addPropList).not.toContain('background');
        // Un-covered properties still offered.
        panel._onAddPropInput('font');
        expect(panel._addPropList).toContain('font-size');
    });
});

// ── Background editor widget ──────────────────────────────────────────────

describe('feezal-style-editor-background — reading', () => {
    it('detects image mode incl. size/repeat/position details', () => {
        target.style.setProperty('background-image', "url('/assets/site/bg.jpg')");
        target.style.setProperty('background-size', 'cover');
        target.style.setProperty('background-repeat', 'no-repeat');
        target.style.setProperty('background-position', 'center center');
        const ed = makeEditor(target);
        expect(ed._mode).toBe('image');
        expect(ed._url).toBe('/assets/site/bg.jpg');
        expect(ed._size).toBe('cover');
        expect(ed._repeat).toBe('no-repeat');
        expect(ed._position).toBe('center center');
    });

    it('detects gradient mode and round-trips its own serialisation', () => {
        target.style.setProperty('background-image', 'linear-gradient(45deg, #ff0000 0%, #0000ff 100%)');
        const ed = makeEditor(target);
        expect(ed._mode).toBe('gradient');
        expect(ed._gradType).toBe('linear');
        expect(ed._gradAngle).toBe(45);
        expect(ed._stops).toEqual([{color: '#ff0000', pos: 0}, {color: '#0000ff', pos: 100}]);
        expect(ed._gradientValue()).toBe('linear-gradient(45deg, #ff0000 0%, #0000ff 100%)');
    });

    it('detects solid and none modes', () => {
        target.style.setProperty('background-color', '#123456');
        expect(makeEditor(target)._mode).toBe('solid');
        target.style.removeProperty('background-color');
        expect(makeEditor(target)._mode).toBe('none');
    });

    it('reads an inline background SHORTHAND through the expanded longhands', () => {
        target.style.background = 'red';
        const ed = makeEditor(target);
        expect(ed._mode).toBe('solid');
        expect(ed._color).toBe('#ff0000');
    });

    it('flags mixed selections', () => {
        const second = document.createElement('feezal-element-group-target');
        second.style.setProperty('background-color', 'blue');
        target.style.setProperty('background-color', 'red');
        const ed = document.createElement('feezal-style-editor-background');
        ed.elements = [target, second];
        ed._readFromElement();
        expect(ed._mixed).toBe(true);
    });
});

describe('feezal-style-editor-background — emitting', () => {
    it('solid mode emits the colour and clears the rest of the family + shorthand', () => {
        const ed = makeEditor(target);
        const get = lastEmit(ed);
        ed._mode = 'solid';
        ed._color = '#336699';
        ed._emitCurrent();
        expect(get().props).toEqual({
            'background': null,
            'background-color': '#336699',
            'background-image': null,
            'background-size': null,
            'background-repeat': null,
            'background-position': null,
        });
    });

    it('image mode emits url + size/repeat/position', () => {
        const ed = makeEditor(target);
        const get = lastEmit(ed);
        ed._mode = 'image';
        ed._url = '/assets/site/bg.jpg';
        ed._size = 'contain';
        ed._repeat = 'repeat-x';
        ed._position = 'left top';
        ed._emitCurrent();
        expect(get().props['background-image']).toBe("url('/assets/site/bg.jpg')");
        expect(get().props['background-size']).toBe('contain');
        expect(get().props['background-repeat']).toBe('repeat-x');
        expect(get().props['background-position']).toBe('left top');
        expect(get().props['background']).toBe(null);
    });

    it('gradient mode serialises linear and radial gradients from the stop list', () => {
        const ed = makeEditor(target);
        const get = lastEmit(ed);
        ed._mode = 'gradient';
        ed._gradType = 'linear';
        ed._gradAngle = 90;
        ed._stops = [{color: '#000000', pos: 0}, {color: '#ffffff', pos: 50}, {color: '#ff0000', pos: 100}];
        ed._emitCurrent();
        expect(get().props['background-image'])
            .toBe('linear-gradient(90deg, #000000 0%, #ffffff 50%, #ff0000 100%)');

        ed._gradType = 'radial';
        ed._gradShape = 'circle';
        ed._emitCurrent();
        expect(get().props['background-image'])
            .toBe('radial-gradient(circle, #000000 0%, #ffffff 50%, #ff0000 100%)');
    });

    it('none mode clears the whole family', () => {
        const ed = makeEditor(target);
        const get = lastEmit(ed);
        ed._mode = 'none';
        ed._emitCurrent();
        expect(Object.values(get().props).every(v => v === null)).toBe(true);
    });

    it('stop editing: add / move / remove keep at least two stops', () => {
        const ed = makeEditor(target);
        ed._mode = 'gradient';
        ed._stops = [{color: '#000000', pos: 0}, {color: '#ffffff', pos: 100}];
        ed._addStop();
        expect(ed._stops.length).toBe(3);
        ed._moveStop(2, -1);
        expect(ed._stops[1].pos).toBe(100);
        ed._removeStop(2);
        expect(ed._stops.length).toBe(2);
        ed._removeStop(1);           // refused at the 2-stop floor
        expect(ed._stops.length).toBe(2);
    });
});

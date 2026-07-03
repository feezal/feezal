import {describe, it, expect} from 'vitest';

import '../src/feezal-view.js';

function makeView(name) {
    const view = document.createElement('feezal-view');
    if (name) view.setAttribute('name', name);
    return view;
}

describe('feezal-view visibility', () => {
    it('hides the view element itself when not visible', () => {
        const view = makeView('home');
        view._visibleChange(false);
        expect(view.style.display).toBe('none');
        view._visibleChange(true);
        expect(view.style.display).toBe('');
    });

    it('propagates visibility to feezal-element-* descendants', () => {
        const view = makeView('home');
        const light = document.createElement('feezal-element-material-light');
        const nested = document.createElement('feezal-element-basic-image');
        const wrapper = document.createElement('div');
        wrapper.append(nested);
        view.append(light, wrapper);

        view._visibleChange(true);
        expect(light.visible).toBe(true);
        expect(nested.visible).toBe(true);

        view._visibleChange(false);
        expect(light.visible).toBe(false);
        expect(nested.visible).toBe(false);
    });

    it('leaves non-feezal children untouched', () => {
        const view = makeView('home');
        const div = document.createElement('div');
        view.append(div);
        view._visibleChange(true);
        expect(div.visible).toBeUndefined();
    });

    it('defaults childPosition to absolute', () => {
        expect(makeView().childPosition).toBe('absolute');
    });
});

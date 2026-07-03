import {describe, it, expect, vi} from 'vitest';

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

describe('viewer addclass/removeclass subscriptions', () => {
    function subscribedHandler(sub, topic) {
        return sub.mock.calls.find(call => call[0] === topic)[1];
    }

    it('registers addclass/removeclass topics in the viewer and applies them', () => {
        feezal.isEditor = false;
        feezal.connection = {sub: vi.fn()};
        const view = makeView('home');
        view.subscribe = 'ctrl/home';
        document.body.append(view);

        expect(feezal.connection.sub).toHaveBeenCalledTimes(2);

        subscribedHandler(feezal.connection.sub, 'ctrl/home/addclass')({payload: 'alert'});
        expect(view.classList.contains('alert')).toBe(true);

        subscribedHandler(feezal.connection.sub, 'ctrl/home/removeclass')({payload: 'alert'});
        expect(view.classList.contains('alert')).toBe(false);
    });

    it('does not subscribe in the editor', () => {
        feezal.isEditor = true;
        feezal.connection = {sub: vi.fn()};
        const view = makeView('home');
        view.subscribe = 'ctrl/home';
        document.body.append(view);
        expect(feezal.connection.sub).not.toHaveBeenCalled();
    });

    it('does not subscribe without a subscribe topic', () => {
        feezal.isEditor = false;
        feezal.connection = {sub: vi.fn()};
        document.body.append(makeView('home'));
        expect(feezal.connection.sub).not.toHaveBeenCalled();
    });
});

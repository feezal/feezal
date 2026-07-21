import {describe, it, expect, beforeEach} from 'vitest';

import '../src/feezal-component.js';

// U32 — composed elements. The generic <feezal-component> instance stamps the
// substituted content of its site's <template feezal-component> into its
// light DOM.

/** Build a feezal-site containing a component template + one instance. */
function buildSite({params, templateHtml, instanceAttrs = {}} = {}) {
    const site = document.createElement('feezal-site');
    const template = document.createElement('template');
    template.setAttribute('feezal-component', 'room-card');
    if (params) template.setAttribute('feezal-params', JSON.stringify(params));
    template.innerHTML = templateHtml ?? `
        <feezal-element-material-light subscribe="\${prefix}/light/state" publish="\${prefix}/light/set"
            style="left:0px; top:0px; width:180px; height:56px"></feezal-element-material-light>
        <feezal-element-basic-number subscribe="\${prefix}/climate/temperature" label="\${label}"
            style="left:0px; top:64px; width:180px; height:40px"></feezal-element-basic-number>`;
    site.append(template);

    const view = document.createElement('feezal-view');
    view.setAttribute('name', 'home');
    const instance = document.createElement('feezal-component');
    instance.setAttribute('name', 'room-card');
    for (const [k, v] of Object.entries(instanceAttrs)) instance.setAttribute(k, v);
    view.append(instance);
    site.append(view);
    document.body.append(site);
    return {site, template, instance};
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const DEFAULT_PARAMS = {
    prefix: {type: 'mqttTopic', default: 'home/livingroom'},
    label: {type: 'string', default: 'Room'}
};

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('feezal-component stamping + substitution', () => {
    it('stamps the template content into the light DOM', () => {
        const {instance} = buildSite({params: DEFAULT_PARAMS});
        expect(instance.children.length).toBe(2);
        expect(instance.children[0].localName).toBe('feezal-element-material-light');
    });

    it('substitutes ${param} in attribute values with declared defaults', () => {
        const {instance} = buildSite({params: DEFAULT_PARAMS});
        expect(instance.children[0].getAttribute('subscribe')).toBe('home/livingroom/light/state');
        expect(instance.children[0].getAttribute('publish')).toBe('home/livingroom/light/set');
        expect(instance.children[1].getAttribute('label')).toBe('Room');
    });

    it('instance attributes override the declared defaults', () => {
        const {instance} = buildSite({
            params: DEFAULT_PARAMS,
            instanceAttrs: {prefix: 'home/kitchen', label: 'Kitchen'}
        });
        expect(instance.children[0].getAttribute('subscribe')).toBe('home/kitchen/light/state');
        expect(instance.children[1].getAttribute('label')).toBe('Kitchen');
    });

    it('substitutes ${param} in text nodes', () => {
        const {instance} = buildSite({
            params: {label: {type: 'string', default: 'Hello'}},
            templateHtml: '<span>${label} world</span>'
        });
        expect(instance.querySelector('span').textContent).toBe('Hello world');
    });

    it('substitutes inside nested inert <template> content', () => {
        const {instance} = buildSite({
            params: {prefix: {type: 'mqttTopic', default: 'x/y'}},
            templateHtml: '<feezal-element-basic-template subscribe="${prefix}/state">' +
                '<template><b>${prefix}</b></template></feezal-element-basic-template>'
        });
        const inner = instance.querySelector('template');
        expect(inner.innerHTML).toContain('x/y');
    });

    it('leaves undeclared ${...} placeholders untouched', () => {
        const {instance} = buildSite({
            params: {label: {type: 'string', default: 'x'}},
            templateHtml: '<span data-a="${label}" data-b="${undeclared}"></span>'
        });
        const span = instance.querySelector('span');
        expect(span.getAttribute('data-a')).toBe('x');
        expect(span.getAttribute('data-b')).toBe('${undeclared}');
    });

    it('undeclared parameter with no default substitutes as empty string', () => {
        const {instance} = buildSite({
            params: {label: {type: 'string'}},
            templateHtml: '<span data-a="${label}"></span>'
        });
        expect(instance.querySelector('span').getAttribute('data-a')).toBe('');
    });
});

describe('feezal-component sizing (template box as default, B46)', () => {
    it('writes the template bounding box as a shadow :host rule', () => {
        const {instance} = buildSite({params: DEFAULT_PARAMS});
        expect(instance._sizeStyle.textContent).toBe(':host { width: 180px; height: 104px; }');
    });

    it('does NOT write the size onto the instance inline style', () => {
        const {instance} = buildSite({params: DEFAULT_PARAMS});
        expect(instance.style.width).toBe('');
        expect(instance.style.height).toBe('');
    });

    // B46: an authored size (width: 100% in the inspector) must survive
    // stamping — the old direct style assignment clobbered it on every load.
    it('an authored inline size survives stamping and re-stamping', async () => {
        const {instance} = buildSite({
            params: DEFAULT_PARAMS,
            instanceAttrs: {style: 'width: 100%; height: 300px;'}
        });
        expect(instance.style.width).toBe('100%');
        expect(instance.style.height).toBe('300px');

        instance.setAttribute('prefix', 'home/bath');   // param change → re-stamp
        await flush();
        expect(instance.style.width).toBe('100%');
        expect(instance.style.height).toBe('300px');
    });

    it('an authored size on one axis leaves the other on the template default', () => {
        const {instance} = buildSite({
            params: DEFAULT_PARAMS,
            instanceAttrs: {style: 'width: 100%;'}
        });
        expect(instance.style.width).toBe('100%');
        expect(instance.style.height).toBe('');
        expect(instance._sizeStyle.textContent).toContain('height: 104px;');
    });
});

describe('feezal-component re-stamping', () => {
    it('re-stamps when a parameter attribute changes', async () => {
        const {instance} = buildSite({params: DEFAULT_PARAMS});
        instance.setAttribute('prefix', 'home/bath');
        await flush();
        expect(instance.children[0].getAttribute('subscribe')).toBe('home/bath/light/state');
    });

    it('does NOT re-stamp on class/style churn (editor drag bookkeeping)', async () => {
        const {instance} = buildSite({params: DEFAULT_PARAMS});
        const sentinel = document.createElement('i');
        sentinel.className = 'sentinel';
        instance.append(sentinel);
        instance.classList.add('feezal-selected');
        instance.style.left = '55px';
        await flush();
        expect(instance.querySelector('.sentinel')).not.toBeNull();
        // ...but a real attribute change re-stamps (sentinel is cleared).
        instance.setAttribute('label', 'X');
        await flush();
        expect(instance.querySelector('.sentinel')).toBeNull();
    });

    it('stamping is idempotent — reconnect does not duplicate content', () => {
        const {instance} = buildSite({params: DEFAULT_PARAMS});
        const view = instance.parentNode;
        instance.remove();
        view.append(instance);   // reconnect → connectedCallback → _stamp
        expect(instance.children.length).toBe(2);
    });
});

describe('feezal-component missing template', () => {
    it('renders a warning and stays empty when no template matches', () => {
        const site = document.createElement('feezal-site');
        const instance = document.createElement('feezal-component');
        instance.setAttribute('name', 'nope');
        site.append(instance);
        document.body.append(site);
        expect(instance.children.length).toBe(0);
        expect(instance.shadowRoot.querySelector('.feezal-component-missing').textContent)
            .toContain('nope');
    });
});

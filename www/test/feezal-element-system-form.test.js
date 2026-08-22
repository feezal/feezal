/**
 * E178 — system-form: a subview as a web form.
 *
 * The embedded view's members that carry a `feezal-id` and the U113 `.value`
 * contract are the fields; a member button with the submit-id (default
 * `submit`) fires the form script via its composed `feezal-press`; without
 * one the form renders its own submit button. The script gets `fzl` + `form`.
 */
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import {FeezalElementSystemForm, DEFAULT_FORM_SCRIPT, FORM_DTS} from '../packages/@feezal/feezal-element-system-form/feezal-element-system-form.js';
import {feezalEmit} from '../packages/@feezal/feezal-element/feezal-element.js';

/** A stand-in contract element: .value + composed feezal-change. */
class FakeField extends HTMLElement {
    constructor() { super(); this._v = ''; }
    get value() { return this._v; }
    set value(v) { this._v = v; }
}
if (!customElements.get('x-fake-field')) customElements.define('x-fake-field', FakeField);

let published;

beforeEach(() => {
    published = [];
    feezal.isEditor = false;
    feezal.connection = {
        connected: true,
        sub: vi.fn(() => ({})),
        unsubscribe: vi.fn(),
        pub: vi.fn((topic, payload, options = {}) => published.push({topic, payload, options})),
    };
    // A site with the view to embed.
    const site = document.createElement('feezal-site');
    site.innerHTML = `
        <feezal-view name="host"></feezal-view>
        <feezal-view name="contact" style="display:none">
            <x-fake-field feezal-id="name"></x-fake-field>
            <x-fake-field feezal-id="email"></x-fake-field>
            <x-fake-field></x-fake-field>
            <button feezal-id="submit">Send</button>
        </feezal-view>
        <feezal-view name="plain">
            <x-fake-field feezal-id="q"></x-fake-field>
        </feezal-view>`;
    document.body.append(site);
    feezal.site = site;
});

afterEach(() => {
    document.body.innerHTML = '';
    delete feezal.site;
});

/** Mount a form (inside the "host" view) with optional script source. */
async function mountForm(attrs = {}, script = null) {
    const el = document.createElement('feezal-element-system-form');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (script !== null) {
        const s = document.createElement('script');
        s.setAttribute('type', 'text/feezal');
        s.textContent = script;
        el.append(s);
    }
    feezal.site.querySelector('feezal-view[name="host"]').append(el);
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 0));
    return el;
}

const content = el => el.shadowRoot.querySelector('#content');
const settle = () => new Promise(r => setTimeout(r, 0));

describe('embedding', () => {
    it('clones the chosen view into the form body, visible, and finds the fields by feezal-id', async () => {
        const el = await mountForm({view: 'contact'});
        const clone = content(el).querySelector('feezal-view[name="contact"]');
        expect(clone).not.toBeNull();
        expect(clone.style.display).toBe('');
        expect(el._fields().map(f => f.getAttribute('feezal-id'))).toEqual(['name', 'email']);
    });

    it('uses the member submit button when one carries the submit-id — no own button', async () => {
        const el = await mountForm({view: 'contact'});
        expect(el._ownSubmit).toBe(false);
        expect(el.shadowRoot.querySelector('.own-submit')).toBeNull();
    });

    it('renders its own submit button when no member carries the submit-id', async () => {
        const el = await mountForm({view: 'plain', 'submit-label': 'Go'});
        expect(el._ownSubmit).toBe(true);
        expect(el.shadowRoot.querySelector('.own-submit').textContent.trim()).toBe('Go');
    });

    it('refuses to embed its own view and reports a missing view', async () => {
        const own = await mountForm({view: 'host'});
        expect(own._error).toMatch(/own view/);
        expect(content(own).children.length).toBe(0);
        const missing = await mountForm({view: 'nope'});
        expect(missing._error).toMatch(/not found/);
    });

    it('never embeds or runs on the editor canvas', async () => {
        feezal.isEditor = true;
        const el = await mountForm({view: 'contact', label: 'Contact'});
        expect(el.shadowRoot.querySelector('#content')).toBeNull();
        expect(el.shadowRoot.textContent).toContain('Form: Contact');
        await el.submit();
        expect(published).toEqual([]);
    });
});

describe('submit + the form script', () => {
    it('the default script publishes {feezalId: value} as JSON to the publish topic', async () => {
        const el = await mountForm({view: 'contact', publish: 'forms/contact'});
        expect(el.scriptSource).toBe(DEFAULT_FORM_SCRIPT);
        el.makeForm().val('name', 'Ada');
        el.makeForm().val('email', 'ada@example.org');

        // the member button's composed feezal-press is the trigger
        const button = content(el).querySelector('[feezal-id="submit"]');
        feezalEmit(button, 'press', {payload: '1'});
        await settle();

        expect(published).toHaveLength(1);
        expect(published[0].topic).toBe('forms/contact');
        expect(JSON.parse(published[0].payload)).toEqual({name: 'Ada', email: 'ada@example.org'});
        expect(published[0].options.retain).toBe(false);
    });

    it('a press from a member that is NOT the submit-id does nothing', async () => {
        const el = await mountForm({view: 'contact', publish: 'forms/contact'});
        feezalEmit(content(el).querySelector('[feezal-id="name"]'), 'press');
        await settle();
        expect(published).toEqual([]);
    });

    it('submit-id selects a different member as the trigger', async () => {
        const el = await mountForm({view: 'contact', publish: 't', 'submit-id': 'email'});
        expect(el._ownSubmit).toBe(false);
        expect(el._fields().map(f => f.getAttribute('feezal-id'))).toEqual(['name']);   // the trigger is not a field
        feezalEmit(content(el).querySelector('[feezal-id="email"]'), 'press');
        await settle();
        expect(published).toHaveLength(1);
    });

    it('the own submit button runs the script', async () => {
        const el = await mountForm({view: 'plain', publish: 'forms/q'});
        el.makeForm().val('q', 'hello');
        el.shadowRoot.querySelector('form').dispatchEvent(new Event('submit', {cancelable: true}));
        await settle();
        expect(JSON.parse(published[0].payload)).toEqual({q: 'hello'});
    });

    it('a custom script gets fzl + form: values/topic/attr/publish/el/val/reset', async () => {
        const el = await mountForm({view: 'contact', publish: 'forms/x'}, `
            const v = form.values();
            if (!v.name) { fzl.pub('invalid', 'name'); return; }   // validation = don't publish
            form.val('email', form.val('email').toLowerCase());
            fzl.pub('attr', form.attr('view') + '/' + form.topic);
            form.publish({...form.values(), ok: true}, {retain: true});
            form.reset();
        `);
        const form = el.makeForm();
        feezalEmit(content(el).querySelector('[feezal-id="submit"]'), 'press');
        await settle();
        expect(published.at(-1)).toMatchObject({topic: 'invalid', payload: 'name', options: {local: true}});

        form.val('name', 'Ada');
        form.val('email', 'ADA@EXAMPLE.ORG');
        feezalEmit(content(el).querySelector('[feezal-id="submit"]'), 'press');
        await settle();
        const attr = published.find(p => p.topic === 'attr');
        expect(attr.payload).toBe('contact/forms/x');
        const out = published.find(p => p.topic === 'forms/x');
        expect(JSON.parse(out.payload)).toEqual({name: 'Ada', email: 'ada@example.org', ok: true});
        expect(out.options.retain).toBe(true);
        // reset() restored the values captured at embed time
        expect(form.values()).toEqual({name: '', email: ''});
    });

    it('form.publish() without a topic warns instead of throwing; script errors are logged with the prefix', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const el = await mountForm({view: 'plain'}, 'form.publish(); throw new Error("boom");');
        await el.submit();
        expect(published).toEqual([]);
        expect(warn).toHaveBeenCalledWith('[form plain]', expect.stringContaining('no publish topic'));
        expect(error).toHaveBeenCalledWith('[form plain]', 'uncaught error:', expect.any(Error));
        warn.mockRestore();
        error.mockRestore();
    });

    it('runs on EVERY submit, not once per page load', async () => {
        const el = await mountForm({view: 'plain', publish: 'forms/q'});
        await el.submit();
        await el.submit();
        expect(published).toHaveLength(2);
    });
});

describe('typedefs + prefill', () => {
    it('FORM_DTS declares the form API and the prefill teaches the general fzl call', () => {
        for (const member of ['values(', 'topic', 'attr(', 'publish(', 'reset(', 'el(', 'val(']) {
            expect(FORM_DTS).toContain(member);
        }
        expect(DEFAULT_FORM_SCRIPT).toContain('fzl.mqtt.pub(form.topic, form.values())');
    });

    it('the descriptor is a System pseudo-element with a custom inspector', () => {
        const d = FeezalElementSystemForm.feezal;
        expect(d.palette.category).toBe('System');
        expect(d.inspector).toBe('feezal-element-system-form-inspector');
        expect(d.attributes.map(a => a.name)).toEqual(['view', 'publish', 'submit-id', 'submit-label', 'label']);
    });
});

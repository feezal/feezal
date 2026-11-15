/**
 * B127 — template content lost around copy/paste and multi-select.
 *
 * Cause: feezal-template-editor echoed every OUTSIDE value sync back as a
 * user edit. Monaco's setValue() fires onDidChangeModelContent, so syncing a
 * new selection's value into the editor emitted feezal-change 300 ms later,
 * and the inspector wrote that value into every selected element. With a
 * multi-selection of template elements whose contents differ the merged
 * value is '' (mixed) — and that '' then wiped all of them. The copy/paste
 * that followed merely exposed an element already emptied.
 *
 * The Monaco stub below behaves like the real editor in the one way that
 * matters here: setValue() fires the content-change listeners.
 */
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';

vi.mock('../src/feezal-monaco-loader.js', () => {
    const monaco = {
        editor: {create(wrap, opts) {
            let value = opts.value ?? '';
            const listeners = [];
            return {
                getValue: () => value,
                setValue(v) { value = v; listeners.forEach(cb => cb({isFlush: true})); },
                onDidChangeModelContent(cb) { listeners.push(cb); },
                updateOptions() {},
                dispose() {},
            };
        }},
        languages: {
            CompletionItemKind: {Variable: 1},
            registerCompletionItemProvider: () => ({dispose() {}}),
            typescript: {javascriptDefaults: {addExtraLib() {}}},
        },
    };
    return {loadMonaco: async () => monaco, syncMonacoStyles: () => {}};
});

await import('../src/feezal-sidebar-inspector-attributes.js');

class TemplateTarget extends HTMLElement {
    static feezal = {attributes: ['subscribe', {name: 'template', textarea: true, template: true, editor: true}], styles: []};
}
customElements.define('feezal-element-b127-template-target', TemplateTarget);

function makeTarget(content) {
    const el = document.createElement('feezal-element-b127-template-target');
    const tpl = document.createElement('template');
    tpl.innerHTML = content;
    el.append(tpl);
    document.body.append(el);
    return el;
}

const settle = async panel => {
    for (let i = 0; i < 5; i++) {
        await panel.updateComplete;
        await new Promise(r => setTimeout(r));
    }
};

let panel;

beforeEach(() => {
    // The panel asks the server for discovery entities — not part of this.
    vi.stubGlobal('fetch', () => Promise.resolve({ok: false, json: async () => ({})}));
    document.body.innerHTML = '';
    feezal.isEditor = true;
    feezal.app = {change: vi.fn()};
    feezal.editor = {selectedElems: []};
    panel = document.createElement('feezal-sidebar-inspector-attributes');
    document.body.append(panel);
});
afterEach(() => { document.body.innerHTML = ''; vi.unstubAllGlobals(); });

async function select(elems) {
    feezal.editor.selectedElems = elems;
    panel.selectedElems = elems;
    await settle(panel);
}

describe('B127 — the copy → paste chain keeps the template body', () => {
    const FeezalAppEditor = () => customElements.get('feezal-app-editor');

    function editorWithView() {
        const view = document.createElement('feezal-view');
        view.setAttribute('name', 'home');
        document.body.append(view);
        feezal.view = view;
        const app = Object.create(FeezalAppEditor().prototype);
        Object.defineProperty(app, '_clipboardTpl', {value: document.createElement('template'), writable: true});
        app.change = vi.fn();
        return {app, view};
    }

    it('Ctrl+C → system clipboard text → Ctrl+V', async () => {
        await import('../src/feezal-app-editor.js');
        const {app, view} = editorWithView();
        const src = makeTarget('<b>${msg.payload}</b><template><i>nested</i></template>');
        view.append(src);
        feezal.editor = {selectedElems: [src], initElem() {}, selectElement() {}};

        let text = '';
        app._copy({clipboardData: {setData: (t, v) => { text = v; }}, preventDefault() {}});
        expect(text).toContain('${msg.payload}');
        app._paste({clipboardData: {getData: () => text}, preventDefault() {}});

        const all = view.querySelectorAll('feezal-element-b127-template-target');
        expect(all).toHaveLength(2);
        expect(all[1].querySelector('template').innerHTML)
            .toBe('<b>${msg.payload}</b><template><i>nested</i></template>');
        expect(src.querySelector('template').innerHTML)
            .toBe('<b>${msg.payload}</b><template><i>nested</i></template>');

        app._pasteInternal();   // the in-memory clipboard pastes it again
        const again = view.querySelectorAll('feezal-element-b127-template-target');
        expect(again).toHaveLength(3);
        expect(again[2].querySelector('template').innerHTML)
            .toBe('<b>${msg.payload}</b><template><i>nested</i></template>');
    });
});

describe('B127 — selecting template elements never rewrites their content', () => {
    it('multi-selecting two templates with DIFFERENT contents leaves both intact', async () => {
        const a = makeTarget('<b>A ${msg.payload}</b>');
        const b = makeTarget('<i>B</i>');
        await select([a]);
        expect(panel.shadowRoot.querySelector('feezal-template-editor')).not.toBeNull();
        await select([a, b]);             // mixed → the editor shows ''
        await new Promise(r => setTimeout(r, 450));   // past the 300 ms debounce
        expect(a.querySelector('template').innerHTML).toBe('<b>A ${msg.payload}</b>');
        expect(b.querySelector('template').innerHTML).toBe('<i>B</i>');
        expect(feezal.app.change).not.toHaveBeenCalled();
    });

    it('switching between single template elements writes nothing', async () => {
        const a = makeTarget('one');
        const b = makeTarget('two');
        await select([a]);
        await select([b]);
        await new Promise(r => setTimeout(r, 450));
        expect(a.querySelector('template').innerHTML).toBe('one');
        expect(b.querySelector('template').innerHTML).toBe('two');
        expect(feezal.app.change).not.toHaveBeenCalled();
    });

    it('a real edit in a multi-selection still applies to all of them', async () => {
        const a = makeTarget('one');
        const b = makeTarget('two');
        await select([a, b]);
        const editor = panel.shadowRoot.querySelector('feezal-template-editor');
        editor.dispatchEvent(new CustomEvent('feezal-change', {detail: {value: 'same'}}));
        expect(a.querySelector('template').innerHTML).toBe('same');
        expect(b.querySelector('template').innerHTML).toBe('same');
    });
});

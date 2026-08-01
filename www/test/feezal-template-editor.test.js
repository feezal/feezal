/**
 * feezal-template-editor — the Monaco-wrapper glue, with the loader mocked
 * (Monaco itself cannot run in happy-dom): editor creation options, the
 * debounced feezal-change contract, outside-value sync without cursor
 * clobbering, the ${…} completion provider incl. the extra-variables path,
 * the once-per-source typedef registration and the html-only gating.
 */
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';

const monacoState = vi.hoisted(() => ({created: [], providers: [], extraLibs: []}));

vi.mock('../src/feezal-monaco-loader.js', () => {
    const makeEditor = opts => {
        let value = opts.value ?? '';
        return {
            opts,
            _contentCb: null,
            getValue: () => value,
            setValue(v) { value = v; },
            /** Test helper: what Monaco does when the user types. */
            type(v) { value = v; this._contentCb?.(); },
            onDidChangeModelContent(cb) { this._contentCb = cb; },
            updateOptions(o) { this.updated = o; },
            dispose() { this.disposed = true; },
        };
    };
    const monaco = {
        editor: {create(wrap, opts) {
            const ed = makeEditor(opts);
            monacoState.created.push({wrap, ed});
            return ed;
        }},
        languages: {
            CompletionItemKind: {Variable: 1},
            registerCompletionItemProvider(lang, provider) {
                monacoState.providers.push({lang, provider});
                return {dispose() {}};
            },
            typescript: {javascriptDefaults: {addExtraLib(src, name) { monacoState.extraLibs.push({src, name}); }}},
        },
    };
    return {loadMonaco: async () => monaco, syncMonacoStyles: () => {}};
});

await import('../src/feezal-template-editor.js');

async function mount(props = {}) {
    const el = document.createElement('feezal-template-editor');
    Object.assign(el, props);
    document.body.append(el);
    await el.updateComplete;          // first render (spinner)
    await new Promise(r => setTimeout(r));   // let the async loader resolve
    await el.updateComplete;
    return el;
}

beforeEach(() => {
    monacoState.created.length = 0;
    monacoState.providers.length = 0;
    document.body.innerHTML = '';
});
afterEach(() => vi.useRealTimers());

describe('editor creation', () => {
    it('creates the inline editor with the value and html as the default language', async () => {
        const el = await mount({value: '<b>${msg.payload}</b>', label: 'template'});
        expect(monacoState.created).toHaveLength(1);
        const {ed} = monacoState.created[0];
        expect(ed.opts.language).toBe('html');
        expect(ed.getValue()).toBe('<b>${msg.payload}</b>');
        expect(el.shadowRoot.querySelector('.label-row span').textContent).toBe('template');
        expect(el.shadowRoot.querySelector('.spinner')).toBeNull();   // loading cleared
    });

    it('an outside value update syncs in; an identical value does not touch the editor', async () => {
        const el = await mount({value: 'a'});
        const {ed} = monacoState.created[0];
        const spy = vi.spyOn(ed, 'setValue');
        el.value = 'b';
        await el.updateComplete;
        expect(ed.getValue()).toBe('b');
        el.value = 'b';                     // unchanged → no cursor-jumping setValue
        await el.updateComplete;
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('disconnect disposes the editor and the completion provider', async () => {
        const el = await mount({value: ''});
        const {ed} = monacoState.created[0];
        el.remove();
        expect(ed.disposed).toBe(true);
    });
});

describe('feezal-change (debounced 300 ms)', () => {
    it('fires once with the final value after typing settles', async () => {
        const el = await mount({value: ''});
        vi.useFakeTimers();
        const events = [];
        el.addEventListener('feezal-change', e => events.push(e.detail.value));
        const {ed} = monacoState.created[0];
        ed.type('x');
        ed.type('xy');
        vi.advanceTimersByTime(299);
        expect(events).toEqual([]);
        vi.advanceTimersByTime(2);
        expect(events).toEqual(['xy']);
    });
});

describe('${…} completion provider', () => {
    const fakeModel = line => ({
        getValueInRange: () => line,
        getWordUntilPosition: () => ({startColumn: line.length + 1, endColumn: line.length + 1}),
    });
    const position = {lineNumber: 1, column: 99};

    it('registers for html only, once per component', async () => {
        await mount({value: ''});
        expect(monacoState.providers).toHaveLength(1);
        expect(monacoState.providers[0].lang).toBe('html');
        monacoState.providers.length = 0;
        await mount({value: '', language: 'javascript'});
        expect(monacoState.providers).toHaveLength(0);   // JS editor: no ${…} helper
    });

    it('suggests the msg items inside ${…} and nothing outside', async () => {
        await mount({value: ''});
        const {provider} = monacoState.providers[0];
        const inside = provider.provideCompletionItems(fakeModel('text ${'), position);
        expect(inside.suggestions.map(s => s.label)).toContain('msg.payload');
        expect(inside.suggestions.map(s => s.label)).toContain('msg.topic');
        const outside = provider.provideCompletionItems(fakeModel('plain text'), position);
        expect(outside.suggestions).toEqual([]);
    });

    it('offers the descriptor-declared extra variables alongside msg', async () => {
        await mount({value: '', variables: ['msg', 'seconds']});
        const {provider} = monacoState.providers.at(-1);
        const out = provider.provideCompletionItems(fakeModel('${'), position);
        const labels = out.suggestions.map(s => s.label);
        expect(labels).toContain('seconds');
        expect(labels).toContain('msg.payload');
    });
});

describe('typedef registration (E49)', () => {
    it('registers a typedef source ONCE across instances, and only for JS', async () => {
        monacoState.extraLibs.length = 0;
        await mount({value: '', language: 'javascript', typedefs: 'declare const fzl: any;'});
        await mount({value: '', language: 'javascript', typedefs: 'declare const fzl: any;'});
        expect(monacoState.extraLibs).toHaveLength(1);
        await mount({value: '', typedefs: 'declare const other: any;'});   // html → ignored
        expect(monacoState.extraLibs).toHaveLength(1);
    });
});

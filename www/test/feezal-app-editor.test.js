import {describe, it, expect, beforeEach} from 'vitest';

import '../src/feezal-app-editor.js';

// U8 view-folder reconciliation. _reconcile() only reads feezal.views, so it
// is called on the prototype with a dummy receiver — no editor instance (and
// none of its DOM/socket wiring) is needed.
const FeezalAppEditor = customElements.get('feezal-app-editor');
const reconcile = tree => FeezalAppEditor.prototype._reconcile.call({}, tree);

// B39: _view() only reads feezal.siteName + location.hash and calls
// window.open — drive it on the prototype with a captured window.open.
function openedUrlFor(siteName, hash) {
    feezal.siteName = siteName;
    const orig = window.open;
    let url;
    window.open = u => { url = u; };
    try { FeezalAppEditor.prototype._view.call({}); } finally { window.open = orig; }
    return url;
}

function setViews(...names) {
    feezal.views = names.map(name => {
        const view = document.createElement('feezal-view');
        view.setAttribute('name', name);
        return view;
    });
}

beforeEach(() => {
    setViews('home', 'kitchen', 'bath');
});

describe('_reconcile() — view folder tree (U8)', () => {
    it('appends all views top-level for an empty tree', () => {
        expect(reconcile([])).toEqual([{view: 'home'}, {view: 'kitchen'}, {view: 'bath'}]);
    });

    it('treats a non-array tree as empty', () => {
        expect(reconcile('garbage')).toEqual([{view: 'home'}, {view: 'kitchen'}, {view: 'bath'}]);
    });

    it('drops dangling view refs and appends unreferenced views', () => {
        expect(reconcile([{view: 'gone'}, {view: 'kitchen'}])).toEqual([
            {view: 'kitchen'}, {view: 'home'}, {view: 'bath'}
        ]);
    });

    it('drops duplicate view refs', () => {
        expect(reconcile([{view: 'home'}, {view: 'home'}])).toEqual([
            {view: 'home'}, {view: 'kitchen'}, {view: 'bath'}
        ]);
    });

    it('drops malformed nodes', () => {
        expect(reconcile([42, 'x', null, {foo: 1}, {view: 5}])).toEqual([
            {view: 'home'}, {view: 'kitchen'}, {view: 'bath'}
        ]);
    });

    it('keeps folders with their id, name and children', () => {
        expect(reconcile([{id: 'f9', name: 'Rooms', children: [{view: 'kitchen'}]}])).toEqual([
            {id: 'f9', name: 'Rooms', children: [{view: 'kitchen'}]},
            {view: 'home'}, {view: 'bath'}
        ]);
    });

    it('assigns missing folder ids and default names', () => {
        const [folder] = reconcile([{children: []}]);
        expect(folder).toEqual({id: 'f1', name: 'Folder', children: []});
    });

    it('de-duplicates folder ids', () => {
        const result = reconcile([
            {id: 'a', name: 'One', children: []},
            {id: 'a', name: 'Two', children: []}
        ]);
        expect(result[0].id).toBe('a');
        expect(result[1].id).toBe('f1');
    });

    it('flattens folders nested deeper than 3 levels into their parent', () => {
        const deep = {
            id: 'l1', name: 'L1', children: [{
                id: 'l2', name: 'L2', children: [{
                    id: 'l3', name: 'L3', children: [{
                        id: 'l4', name: 'L4', children: [{view: 'kitchen'}]
                    }]
                }]
            }]
        };
        const [l1] = reconcile([deep]);
        const l3 = l1.children[0].children[0];
        // level-4 folder is gone, its content lifted into level 3
        expect(l3.children).toEqual([{view: 'kitchen'}]);
    });

    it('a view referenced inside a folder is not appended again', () => {
        const result = reconcile([{id: 'f1', name: 'F', children: [{view: 'bath'}]}]);
        expect(result.filter(n => n.view === 'bath')).toHaveLength(0);
        expect(result[0].children).toEqual([{view: 'bath'}]);
    });
});

// ---------------------------------------------------------------------------
// U32 — composed components: serialization stripping + lifecycle helpers

const app = () => Object.create(FeezalAppEditor.prototype);

describe('_clean() — U32 component stripping', () => {
    it('empties feezal-component instances (stamped content is regenerated)', () => {
        const tpl = document.createElement('template');
        tpl.innerHTML = '<feezal-site><feezal-view name="home">' +
            '<feezal-component name="c" prefix="a/b"><span>stamped</span></feezal-component>' +
            '</feezal-view></feezal-site>';
        FeezalAppEditor.prototype._clean.call(app(), tpl.content);
        const instance = tpl.content.querySelector('feezal-component');
        expect(instance.innerHTML).toBe('');
        expect(instance.getAttribute('prefix')).toBe('a/b');   // params survive
    });

    it('drops component-edit pseudo-views', () => {
        const tpl = document.createElement('template');
        tpl.innerHTML = '<feezal-site>' +
            '<feezal-view name="home"></feezal-view>' +
            '<feezal-view name="component:c" feezal-component-edit="c"></feezal-view>' +
            '</feezal-site>';
        FeezalAppEditor.prototype._clean.call(app(), tpl.content);
        expect(tpl.content.querySelectorAll('feezal-view').length).toBe(1);
        expect(tpl.content.querySelector('[feezal-component-edit]')).toBeNull();
    });

    it('keeps <template feezal-component> definitions untouched', () => {
        const tpl = document.createElement('template');
        tpl.innerHTML = '<feezal-site>' +
            '<template feezal-component="c" feezal-params=\'{"p":{"type":"string"}}\'>' +
            '<feezal-element-basic-number label="${p}"></feezal-element-basic-number></template>' +
            '<feezal-view name="home"></feezal-view></feezal-site>';
        FeezalAppEditor.prototype._clean.call(app(), tpl.content);
        const def = tpl.content.querySelector('template[feezal-component]');
        expect(def).not.toBeNull();
        expect(def.content.querySelector('feezal-element-basic-number').getAttribute('label')).toBe('${p}');
    });
});

describe('_checkComponentName() — U32 validation', () => {
    function withSite(...names) {
        const site = document.createElement('feezal-site');
        for (const n of names) {
            const t = document.createElement('template');
            t.setAttribute('feezal-component', n);
            site.append(t);
        }
        document.body.append(site);
        feezal.site = site;
    }

    it('accepts kebab-case names', () => {
        withSite();
        expect(FeezalAppEditor.prototype._checkComponentName.call(app(), 'room-card')).toBe('');
    });

    it('rejects invalid characters and leading digits', () => {
        withSite();
        const check = n => FeezalAppEditor.prototype._checkComponentName.call(app(), n);
        expect(check('Room')).not.toBe('');
        expect(check('1card')).not.toBe('');
        expect(check('a b')).not.toBe('');
        expect(check('')).not.toBe('');
    });

    it('rejects duplicates unless excluded (rename to self)', () => {
        withSite('room-card');
        const check = (n, ex) => FeezalAppEditor.prototype._checkComponentName.call(app(), n, ex);
        expect(check('room-card')).not.toBe('');
        expect(check('room-card', 'room-card')).toBe('');
    });
});

describe('_inferParamType() — U32', () => {
    const infer = (el, attr) => FeezalAppEditor.prototype._inferParamType.call(app(), el, attr);

    it('falls back to name-based detection for unknown elements', () => {
        const el = document.createElement('div');
        expect(infer(el, 'subscribe')).toBe('mqttTopic');
        expect(infer(el, 'publish')).toBe('mqttTopic');
        expect(infer(el, 'state-topic')).toBe('mqttTopic');
        expect(infer(el, 'accent-color')).toBe('color');
        expect(infer(el, 'label')).toBe('string');
    });
});

describe('_detachInstances() — U32', () => {
    it('expands instances into substituted children with translated positions', () => {
        // Real component machinery: template + stamped instance.
        const site = document.createElement('feezal-site');
        const t = document.createElement('template');
        t.setAttribute('feezal-component', 'c');
        t.setAttribute('feezal-params', '{"p":{"type":"string","default":"V"}}');
        t.innerHTML = '<feezal-element-basic-number label="${p}" style="left:10px; top:20px; width:50px; height:30px"></feezal-element-basic-number>';
        site.append(t);
        const view = document.createElement('feezal-view');
        view.setAttribute('name', 'home');
        const inst = document.createElement('feezal-component');
        inst.setAttribute('name', 'c');
        inst.style.left = '100px';
        inst.style.top = '200px';
        view.append(inst);
        site.append(view);
        document.body.append(site);
        feezal.editor = {initElem() {}};

        const out = FeezalAppEditor.prototype._detachInstances.call(app(), [inst]);
        expect(out.length).toBe(1);
        expect(view.querySelector('feezal-component')).toBeNull();
        const detached = view.querySelector('feezal-element-basic-number');
        expect(detached.getAttribute('label')).toBe('V');          // substituted value
        expect(detached.style.left).toBe('110px');                  // 10 + 100
        expect(detached.style.top).toBe('220px');                   // 20 + 200
    });
});

describe('_clone() — B31 light-DOM children survive copy/paste/duplicate', () => {
    it('deep-clones the light DOM (basic-template <template> child)', () => {
        const el = document.createElement('feezal-element-basic-template');
        el.setAttribute('subscribe', 'stat/temp');
        el.style.left = '10px';
        const tpl = document.createElement('template');
        tpl.innerHTML = '<b>${msg.payload}</b>';
        el.append(tpl);

        const clone = FeezalAppEditor.prototype._clone.call(app(), el);
        expect(clone.getAttribute('subscribe')).toBe('stat/temp');
        const clonedTpl = clone.querySelector('template');
        expect(clonedTpl).not.toBeNull();
        expect(clonedTpl.innerHTML).toBe('<b>${msg.payload}</b>');
        // Cloned, not moved — the original keeps its template.
        expect(el.querySelector('template')).not.toBe(clonedTpl);
        expect(el.querySelector('template')).not.toBeNull();
    });

    it('resets the drag cursor on the clone', () => {
        const el = document.createElement('div');
        el.style.cursor = 'move';
        const clone = FeezalAppEditor.prototype._clone.call(app(), el);
        expect(clone.style.cursor).toBe('');
    });
});

describe('_maybeAutoStartTour() — U37/U41 trigger gating', () => {
    async function run({seen = false, sourceMode = false, serverPrefs = 'unreachable'} = {}) {
        if (seen) localStorage.setItem('feezalTourSeen', '1');
        else localStorage.removeItem('feezalTourSeen');
        // Server prefs API stub: 'unreachable' rejects (serverless fallback
        // to localStorage), an object resolves as the prefs JSON.
        globalThis.fetch = serverPrefs === 'unreachable'
            ? () => Promise.reject(new Error('no server'))
            : () => Promise.resolve({ok: true, json: () => Promise.resolve(serverPrefs)});
        let started = false;
        // Plain data properties — _sourceMode/shadowRoot are reactive/accessor
        // properties on the prototype and must not run Lit internals here.
        const ctx = app();
        Object.defineProperty(ctx, '_sourceMode', {value: sourceMode});
        Object.defineProperty(ctx, 'shadowRoot', {value: {querySelector: () => ({start() { started = true; }})}});
        await ctx._maybeAutoStartTour();
        return started;
    }

    it('starts on a fresh site (views without elements, flag unset)', async () => {
        expect(await run()).toBe(true);
    });

    it('does not start once the localStorage seen-flag is set (serverless)', async () => {
        expect(await run({seen: true})).toBe(false);
    });

    it('U41: the server-side flag is authoritative — fresh data dir re-triggers despite localStorage', async () => {
        expect(await run({seen: true, serverPrefs: {}})).toBe(true);
    });

    it('U41: server-side tourSeen suppresses the tour', async () => {
        expect(await run({serverPrefs: {tourSeen: true}})).toBe(false);
    });

    it('does not start when any view already carries elements', async () => {
        feezal.views[1].append(document.createElement('feezal-element-basic-number'));
        expect(await run()).toBe(false);
    });

    it('does not start in source mode or without views', async () => {
        expect(await run({sourceMode: true})).toBe(false);
        feezal.views = [];
        expect(await run()).toBe(false);
    });
});

describe('_view() — opened viewer URL (B39)', () => {
    it('keeps a trailing slash on the site segment for a named site', () => {
        window.location.hash = '#/view1';
        expect(openedUrlFor('Rooms')).toBe('/viewer/Rooms/#/view1');
    });

    it('opens /viewer/ for the default site (unchanged)', () => {
        window.location.hash = '#/view1';
        expect(openedUrlFor('default')).toBe('/viewer/#/view1');
    });

    it('works with no hash', () => {
        window.location.hash = '';
        expect(openedUrlFor('Rooms')).toBe('/viewer/Rooms/');
    });
});

describe('_revealActiveViewLine() — U54', () => {
    const DOC = [
        '<feezal-site>',
        '    <feezal-view child-position="absolute" name="home">',
        '    </feezal-view>',
        '    <feezal-view name="kitchen">',
        '    </feezal-view>',
        '</feezal-site>',
    ].join('\n');

    function drive(viewName, text = DOC) {
        const calls = {revealed: null, cursor: null};
        const model = {
            getValue: () => text,
            getPositionAt(index) {
                const upto = text.slice(0, index).split('\n');
                return {lineNumber: upto.length, column: upto[upto.length - 1].length + 1};
            },
        };
        const self = {
            _sourceEditor: {
                getModel: () => model,
                revealLineNearTop: n => { calls.revealed = n; },
                setPosition: p => { calls.cursor = p; },
            },
        };
        feezal.site = {view: viewName};
        FeezalAppEditor.prototype._revealActiveViewLine.call(self);
        return calls;
    }

    it('reveals the active view line — attribute order not assumed', () => {
        expect(drive('home').revealed).toBe(2);      // name= comes after child-position=
        expect(drive('kitchen').revealed).toBe(4);
        expect(drive('kitchen').cursor).toEqual({lineNumber: 4, column: 5});
    });

    it('unknown or empty view name stays at the top (silent no-op)', () => {
        expect(drive('nope').revealed).toBeNull();
        expect(drive('').revealed).toBeNull();
    });

    it('exact name match only — no prefix false-positives', () => {
        const doc = DOC.replace('name="kitchen"', 'name="home2"');
        expect(drive('home2', doc).revealed).toBe(4);
        expect(drive('home', doc).revealed).toBe(2);
    });
});

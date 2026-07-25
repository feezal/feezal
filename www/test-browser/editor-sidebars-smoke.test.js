/**
 * Editor sidebar smoke tests.
 *
 * The heavy editor panels (themes, assets, AI chat, editor settings, template
 * editor, site manager) are ~4k lines of mostly `render()`, and almost none of
 * it was exercised: they need a live `feezal` global and a real API, so the
 * happy-dom logic suite skips them. That leaves their render branches — the
 * dialogs, empty/loaded/error states, view modes — completely unverified: a
 * template typo in any of them ships silently.
 *
 * This is the element-smoke pattern (test-browser/element-smoke.test.js)
 * applied to the editor's own components: mount each against a stubbed API,
 * then walk it through the render branches that a user actually reaches. It is
 * deliberately shallow — it asserts "this renders and does not throw", not
 * behaviour; the panels that have real logic keep their own suites.
 */
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';

import '../src/feezal-app-editor.js';
import '../src/feezal-sidebar-themes.js';
import '../src/feezal-sidebar-assets.js';
import '../src/feezal-ai-chat.js';
import '../src/feezal-sidebar-editor.js';
import '../src/feezal-site-manager.js';

// ── the API surface these panels hit on mount ───────────────────────────────
const ROUTES = [
    [/\/api\/sites$/,                 () => ({sites: ['default', 'kitchen']})],
    [/\/api\/themes\/[^/]+$/,         () => ({css: ':root{}'})],
    [/\/api\/themes/,                 () => ({themes: []})],
    [/\/api\/assets\/[^/?]+\?/,       () => ({assets: [
        {name: 'logo.png', path: 'logo.png', type: 'file', size: 2048, mtime: 1, url: '/assets/default/logo.png'},
        {name: 'icons', path: 'icons', type: 'dir'},
    ]})],
    [/\/api\/assets/,                 () => ({assets: []})],
    [/\/api\/ai\/models/,             () => ({models: [{id: 'm1', name: 'Model One'}]})],
    [/\/api\/ai\/conversations/,      () => ({conversations: []})],
    [/\/api\/ai\/config/,             () => ({provider: 'none', model: '', hasKey: false})],
    [/\/api\/editor\/prefs/,          () => ({})],
    [/\/api\/server\/capabilities/,   () => ({restart: false, update: false})],
    [/\/api\/topics\/completions/,    () => ({topics: []})],
];

function stubFetch() {
    globalThis.fetch = vi.fn(async url => {
        const href = String(url);
        const hit = ROUTES.find(([re]) => re.test(href));
        const body = hit ? hit[1]() : {};
        return {
            ok: true, status: 200,
            json: async () => body,
            text: async () => JSON.stringify(body),
            body: null,
        };
    });
}

/**
 * The editor globals the panels read at mount time — the shape `server/src/
 * app.js` injects into the real editor page.
 *
 * `connection` is an EventTarget, not a plain object: the connection-status
 * chrome subscribes to its events with addEventListener, and a bare stub makes
 * that throw asynchronously (an unhandled rejection, not a test failure — so
 * it would rot silently).
 */
function stubFeezalGlobal() {
    const view = document.createElement('div');
    view.setAttribute('name', 'home');
    const connection = Object.assign(new EventTarget(), {
        sub: () => {}, unsubscribe: () => {}, pub: () => {}, connected: true,
    });
    window.feezal = {
        isEditor: true,
        editor: null,               // suppresses the assets drag registration
        ready: false,               // suppresses the theme colour sampling
        siteName: 'default',
        hasChanges: false,
        // Package NAMES, not objects — pkgToClass()/pkgToLabel() split them.
        themes: ['@feezal/feezal-theme-dark-mint', '@feezal/feezal-theme-metro'],
        views: [view],
        site: null,
        elements: new Set(),
        connection,
        get app() { return document.querySelector('feezal-app-editor'); },
        get container() { return this.app?.shadowRoot?.querySelector('#container') ?? null; },
        getView: () => null,
    };
}

/** Mount, let the async mount work settle, and hand back the element. */
async function mount(tag, props = {}) {
    const el = document.createElement(tag);
    Object.assign(el, props);
    document.body.append(el);
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 0));   // fetch(...).then chains
    await el.updateComplete;
    return el;
}

/** Apply state props one batch at a time and re-render after each. */
async function walk(el, states) {
    for (const state of states) {
        Object.assign(el, state);
        el.requestUpdate();
        await el.updateComplete;
        expect(el.renderRoot.childElementCount, `${el.tagName} rendered nothing`).toBeGreaterThan(0);
    }
}

beforeEach(() => {
    stubFeezalGlobal();
    stubFetch();
    vi.stubGlobal('alert', () => {});
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('prompt', () => null);
});

afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
});

describe('feezal-sidebar-themes', () => {
    it('mounts and renders the theme list', async () => {
        const el = await mount('feezal-sidebar-themes', {currentTheme: 'dark-mint'});
        expect(el.renderRoot.textContent).toBeTruthy();
        expect(el.themes.length).toBe(2);
    });

    it('renders the picker, overrides, save-theme and class-editor branches', async () => {
        const el = await mount('feezal-sidebar-themes', {currentTheme: 'metro'});
        await walk(el, [
            {_open: true},
            {_open: false, _overridesOpen: true, _overrides: {'--primary-color': '#ff0000'}},
            {_saveThemeOpen: true, _saveThemeName: 'my-theme'},
            {_saveThemeOpen: false, _classes: [{name: 'card', props: {color: 'red'}}]},
            {_editingClass: 'card', _addPropFor: 'card'},
            {_userThemes: [{slug: 'mine', label: 'Mine'}]},
            {viewSelected: true},
        ]);
    });

    it('closes the picker on an outside pointerdown', async () => {
        const el = await mount('feezal-sidebar-themes');
        el._open = true;
        document.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, composed: true}));
        expect(el._open).toBe(false);
    });
});

describe('feezal-sidebar-assets', () => {
    it('mounts and lists the site assets', async () => {
        const el = await mount('feezal-sidebar-assets');
        expect(el.renderRoot.textContent).toBeTruthy();
    });

    it('renders grid/list views, sorting, search and the dialog branches', async () => {
        const el = await mount('feezal-sidebar-assets');
        await walk(el, [
            {_viewMode: 'list'},
            {_viewMode: 'grid', _sortKey: 'size', _sortDir: 'desc'},
            {_search: 'logo'},
            {_search: 'nothing-matches-this'},
            {_search: '', _uploading: true},
            {_uploading: false, _error: 'upload failed'},
            {_error: '', _renaming: 'logo.png', _renameVal: 'logo2.png'},
            {_renaming: null, _dlgConfirm: {message: 'Delete?', onOk: () => {}}},
            {_dlgConfirm: null, _dlgPrompt: {message: 'Folder name', onOk: () => {}}, _dlgPromptVal: 'sub'},
            {_dlgPrompt: null, _ctxMenu: {x: 10, y: 10, file: 'logo.png', isFolder: false}},
            {_ctxMenu: {x: 10, y: 10, file: 'icons', isFolder: true}},
            {_ctxMenu: null, _previewOpen: true,
                _preview: {name: 'logo.png', path: 'logo.png', type: 'file',
                    url: '/assets/default/logo.png'}},
            {_previewOpen: false, _category: 'global', _folder: 'icons'},
        ]);
    });
});

describe('feezal-ai-chat', () => {
    it('mounts with an empty conversation', async () => {
        const el = await mount('feezal-ai-chat', {viewNames: ['home']});
        expect(el.renderRoot.textContent).toBeTruthy();
    });

    it('renders the message, streaming, error, apply and history branches', async () => {
        const el = await mount('feezal-ai-chat', {viewNames: ['home', 'kitchen']});
        await walk(el, [
            {_messages: [
                {role: 'user', content: 'add a light card'},
                {role: 'assistant', content: 'Here you go:\n```html\n<div></div>\n```'},
            ]},
            {_streaming: true, _streamingText: 'thinking…'},
            {_streaming: false, _error: 'provider unreachable'},
            {_error: '', _pendingApply: {html: '<div></div>', view: 'home'}},
            {_applyError: 'could not apply'},
            {_applyError: '', _autoApply: true, _toast: 'Applied'},
            {_toast: '', _history: [{id: 'c1', title: 'Old chat', updated: 1}]},
            {_models: [{id: 'm1', name: 'Model One'}], _selectedModel: 'm1', _provider: 'ollama'},
            {_input: 'draft message', _targetView: 'kitchen'},
        ]);
    });
});

describe('feezal-sidebar-editor', () => {
    it('mounts and renders the editor preferences', async () => {
        const el = await mount('feezal-sidebar-editor');
        expect(el.renderRoot.textContent).toBeTruthy();
    });

    it('renders the grid, AI-provider and server-capability branches', async () => {
        const el = await mount('feezal-sidebar-editor');
        await walk(el, [
            {themeMode: 'dark', gridVisible: true, gridSize: 20, snapping: true},
            {themeMode: 'light', gridVisible: false, selectionColor: '#ff0000', gridColor: '#00ff00'},
            {preventEditorMqtt: true, _clippy: true},
            {_discoveryGrace: true, _discoveryGraceDays: 7},
            {_aiProvider: 'openai', _aiHasKey: true, _aiModel: 'gpt', _aiMaxRounds: 5},
            {_aiProvider: 'ollama', _aiEndpoint: 'http://localhost:11434', _aiNumCtx: 8192, _aiHasKey: false},
            {_aiStatus: 'saved'},
        ]);
    });
});

// The editor shell itself: ~1.4k lines, of which the toolbar/menu/tab chrome
// and every dialog is render-only. Mounting it exercises that chrome and, as a
// side effect, the child panels it composes.
describe('feezal-app-editor', () => {
    it('mounts and renders the toolbar chrome', async () => {
        const el = await mount('feezal-app-editor');
        const root = el.renderRoot;
        expect(root.querySelector('#menu')).toBeTruthy();
        expect(root.querySelector('#toolbar')).toBeTruthy();
        expect(root.textContent).toContain('Feezal');
    });

    it('renders the palette-collapsed, source-mode and dark-mode branches', async () => {
        const el = await mount('feezal-app-editor');
        await walk(el, [
            {paletteVisible: false},
            {paletteVisible: true, _sourceMode: true},
            {_sourceMode: false, _darkMode: true},
            {_darkMode: false, viewSelected: true},
            {viewSelected: false, _history: [{}, {}]},          // enables undo
            {_version: '3.14.15'},
        ]);
    });

    it('renders each sidebar tab and the dialog branches', async () => {
        const el = await mount('feezal-app-editor');
        await walk(el, [
            {_shortcutsOpen: true},
            {_shortcutsOpen: false, _tab: 'assets'},
            {_tab: 'themes'},
            {_tab: 'viewer'},
            {_tab: 'editor'},
            {_tab: 'inspector'},
        ]);
    });

    it('cleans its document listeners up on disconnect', async () => {
        const el = await mount('feezal-app-editor');
        el.remove();
        // A hashchange after teardown must not throw through the removed handler.
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        expect(el.isConnected).toBe(false);
    });
});

describe('feezal-site-manager', () => {
    it('mounts and renders the open dropdown through the body portal', async () => {
        const el = await mount('feezal-site-manager');
        el._open = true;
        el._dropX = 10;
        el._dropY = 20;
        await el.updateComplete;
        expect(el._portalEl.textContent).toContain('default');
    });

    it('renders the new-site dialog, rename row and delete confirmation', async () => {
        const el = await mount('feezal-site-manager');
        await walk(el, [
            {_newDialog: true, _newName: 'garden'},
            {_newDialog: true, _newError: 'A site with that name already exists.'},
            {_newDialog: false, _open: true, _renaming: 'kitchen', _renameValue: 'küche'},
            {_renaming: null, _confirmDelete: 'kitchen'},
            {_confirmDelete: null, _filter: 'kit'},
            {_busy: true},
        ]);
    });
});

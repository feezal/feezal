/**
 * Logic of two more editor panels: the viewer settings' broker URI, and the
 * themes panel's visual class editor.
 *
 * **Broker URI** — the connection is edited both as a raw URI and as separate
 * host/port/user/password fields, so the two must round-trip. A URI that fails
 * to parse must still be kept verbatim (the user is mid-typing), not silently
 * dropped.
 *
 * **Class editor** — user classes live as a real `<style id="feezal-classes">`
 * block inside the site, and the editor both writes it and reads it back after
 * out-of-band changes (source-editor apply, undo, history restore). Serialize
 * and parse therefore have to agree exactly, and the writer additionally has to
 * refuse property names/values that would let a class break out of its own rule
 * block.
 */
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../src/feezal-sidebar-viewer.js';
import '../src/feezal-sidebar-themes.js';

beforeEach(() => {
    document.body.innerHTML = '';
    window.feezal = {site: null, classes: {}, themes: [], views: [], ready: false, isEditor: true};
    globalThis.fetch = vi.fn(async () => ({ok: true, json: async () => ({}), text: async () => ''}));
});

afterEach(() => { vi.restoreAllMocks(); });

// ── Broker URI ──────────────────────────────────────────────────────────────

function makeViewerPanel(connection = {}) {
    const el = document.createElement('feezal-sidebar-viewer');
    el.connection = connection;
    return el;
}

describe('broker URI — parsing into fields', () => {
    it('splits a full URI into its parts', () => {
        const el = makeViewerPanel();
        el._parseUri('mqtts://user:secret@broker.example:8883');
        expect(el.connection).toMatchObject({
            uri: 'mqtts://user:secret@broker.example:8883',
            _protocol: 'mqtts', _host: 'broker.example', _port: '8883',
            _username: 'user', _password: 'secret',
        });
    });

    it('leaves the optional parts empty rather than undefined', () => {
        const el = makeViewerPanel();
        el._parseUri('ws://localhost');
        expect(el.connection).toMatchObject({
            _protocol: 'ws', _host: 'localhost', _port: '', _username: '', _password: '',
        });
    });

    it('keeps an unparseable URI verbatim and clears the structured fields', () => {
        const el = makeViewerPanel({_host: 'stale.example', _port: '1883'});
        el._parseUri('not a uri');
        expect(el.connection.uri).toBe('not a uri');
        expect(el.connection._host).toBe('');
        expect(el.connection._port).toBe('');
        expect(el.connection._protocol).toBe('mqtt');
    });

    it('ignores an empty URI entirely', () => {
        const el = makeViewerPanel({_host: 'keep.example'});
        el._parseUri('');
        expect(el.connection._host).toBe('keep.example');
    });
});

describe('broker URI — building from fields', () => {
    const build = fields => {
        const el = makeViewerPanel(fields);
        el._buildUri();
        return el.connection.uri;
    };

    it('assembles protocol, host and port', () => {
        expect(build({_protocol: 'mqtts', _host: 'broker.example', _port: '8883'}))
            .toBe('mqtts://broker.example:8883');
    });

    it('defaults the protocol to mqtt and the host to localhost', () => {
        expect(build({})).toBe('mqtt://localhost');
    });

    it('omits the port when blank', () => {
        expect(build({_protocol: 'ws', _host: 'h'})).toBe('ws://h');
    });

    it('includes credentials only when a username is set', () => {
        expect(build({_host: 'h', _username: 'u', _password: 'p'})).toBe('mqtt://u:p@h');
        expect(build({_host: 'h', _username: 'u'})).toBe('mqtt://u@h');
        expect(build({_host: 'h', _password: 'p'})).toBe('mqtt://h');   // password alone is meaningless
    });

    it('percent-encodes credentials so an @ or : cannot break the URI', () => {
        expect(build({_host: 'h', _username: 'a@b', _password: 'p:w/d'}))
            .toBe('mqtt://a%40b:p%3Aw%2Fd@h');
    });

    it('round-trips a URI through parse → build unchanged', () => {
        const el = makeViewerPanel();
        el._parseUri('mqtts://user:secret@broker.example:8883');
        el._buildUri();
        expect(el.connection.uri).toBe('mqtts://user:secret@broker.example:8883');
    });
});

// ── Themes: the visual class editor ─────────────────────────────────────────

function makeThemesPanel(classes = {}) {
    const site = document.createElement('feezal-site');
    document.body.append(site);
    window.feezal.site = site;
    const el = document.createElement('feezal-sidebar-themes');
    el._classes = classes;
    return el;
}

const styleBlock = () =>
    window.feezal.site.querySelector(':scope > style#feezal-classes')?.textContent ?? null;

describe('class editor — serializing to the site style block', () => {
    it('writes one rule per class, prefixed so it cannot collide with theme CSS', () => {
        const el = makeThemesPanel({card: {color: 'red', 'font-size': '12px'}});
        el._syncClassesStyle();
        expect(styleBlock()).toBe('.feezal-class-card{color:red;font-size:12px}');
    });

    it('publishes the map on the global and announces the change', () => {
        const el = makeThemesPanel({card: {color: 'red'}});
        const seen = vi.fn();
        document.addEventListener('feezal-classes-changed', seen);
        el._syncClassesStyle();
        expect(window.feezal.classes).toEqual({card: {color: 'red'}});
        expect(seen).toHaveBeenCalled();
        document.removeEventListener('feezal-classes-changed', seen);
    });

    it('drops empty classes and removes the block once nothing is left', () => {
        const el = makeThemesPanel({card: {color: 'red'}});
        el._syncClassesStyle();
        expect(styleBlock()).toBeTruthy();
        el._classes = {empty: {}};
        el._syncClassesStyle();
        expect(styleBlock()).toBeNull();
    });

    it('refuses property names that are not plain CSS idents', () => {
        const el = makeThemesPanel({card: {'color': 'red', 'bad}selector{x': 'y', '': 'z'}});
        el._syncClassesStyle();
        expect(styleBlock()).toBe('.feezal-class-card{color:red}');
    });

    it('strips characters from values that could terminate the rule', () => {
        // The value tries to close its own declaration AND its rule, then open
        // a new one. Stripping ; and braces leaves it inert inside the block.
        const el = makeThemesPanel({card: {color: 'red;} body{display:none'}});
        el._syncClassesStyle();
        expect(styleBlock()).toBe('.feezal-class-card{color:red bodydisplay:none}');
        // Exactly one rule — nothing escaped into a second selector.
        expect(styleBlock().match(/\{/g)).toHaveLength(1);
    });

    it('strips quotes so a value cannot smuggle a string out of the rule', () => {
        const el = makeThemesPanel({card: {content: '"a";color:red'}});
        el._syncClassesStyle();
        expect(styleBlock()).toBe('.feezal-class-card{content:acolor:red}');
    });

    it('reuses the existing style element instead of stacking new ones', () => {
        const el = makeThemesPanel({card: {color: 'red'}});
        el._syncClassesStyle();
        el._classes = {card: {color: 'blue'}};
        el._syncClassesStyle();
        expect(window.feezal.site.querySelectorAll('style#feezal-classes')).toHaveLength(1);
        expect(styleBlock()).toContain('blue');
    });
});

describe('class editor — parsing the block back', () => {
    it('round-trips serialize → parse', () => {
        const classes = {card: {color: 'red', 'font-size': '12px'}, badge: {opacity: '0.5'}};
        const el = makeThemesPanel(classes);
        el._syncClassesStyle();
        expect(el._parseClassesStyle()).toEqual(classes);
    });

    it('is empty when there is no block', () => {
        const el = makeThemesPanel();
        expect(el._parseClassesStyle()).toEqual({});
    });

    it('skips malformed declarations rather than failing the whole parse', () => {
        const el = makeThemesPanel();
        const style = document.createElement('style');
        style.id = 'feezal-classes';
        style.textContent = '.feezal-class-card{color:red;garbage;:novalue;width:10px}';
        window.feezal.site.append(style);
        expect(el._parseClassesStyle()).toEqual({card: {color: 'red', width: '10px'}});
    });

    it('reloadClasses adopts an out-of-band edit and announces it', () => {
        const el = makeThemesPanel({stale: {color: 'red'}});
        const style = document.createElement('style');
        style.id = 'feezal-classes';
        style.textContent = '.feezal-class-fresh{color:blue}';
        window.feezal.site.append(style);

        const seen = vi.fn();
        document.addEventListener('feezal-classes-changed', seen);
        el.reloadClasses();
        expect(el._classes).toEqual({fresh: {color: 'blue'}});
        expect(window.feezal.classes).toEqual({fresh: {color: 'blue'}});
        expect(seen).toHaveBeenCalled();
        document.removeEventListener('feezal-classes-changed', seen);
    });
});

describe('class editor — add / delete / collapse', () => {
    it('adds classes with the first free generated name', () => {
        const el = makeThemesPanel({'class-1': {}, 'class-2': {}});
        el._addClass();
        expect(Object.keys(el._classes)).toContain('class-3');
        expect(el._editingClass).toBe('class-3');
    });

    it('deletes a class and rewrites the block', () => {
        const el = makeThemesPanel({card: {color: 'red'}, badge: {opacity: '1'}});
        el._syncClassesStyle();
        el._deleteClass('card');
        expect(Object.keys(el._classes)).toEqual(['badge']);
        expect(styleBlock()).toBe('.feezal-class-badge{opacity:1}');
    });

    it('toggles a class collapsed and back', () => {
        const el = makeThemesPanel({card: {}});
        el._collapsedClasses = new Set();
        el._toggleCollapse('card');
        expect(el._collapsedClasses.has('card')).toBe(true);
        el._toggleCollapse('card');
        expect(el._collapsedClasses.has('card')).toBe(false);
    });
});

describe('class editor — the property-name autocomplete', () => {
    it('offers matches for a substring, capped to a dozen', () => {
        const el = makeThemesPanel({card: {}});
        el._onAddPropInput('card', 'colo');
        expect(el._addPropFor.cls).toBe('card');
        expect(el._addPropFor.matches.length).toBeGreaterThan(0);
        expect(el._addPropFor.matches.length).toBeLessThanOrEqual(12);
        expect(el._addPropFor.matches.every(p => p.includes('colo'))).toBe(true);
        expect(el._addPropFor.cursor).toBe(-1);
    });

    it('an empty query offers the head of the list, not nothing', () => {
        const el = makeThemesPanel({card: {}});
        el._onAddPropInput('card', '   ');
        expect(el._addPropFor.matches.length).toBe(12);
    });

    it('an unmatchable query offers nothing', () => {
        const el = makeThemesPanel({card: {}});
        el._onAddPropInput('card', 'zzzznotaproperty');
        expect(el._addPropFor.matches).toEqual([]);
    });
});

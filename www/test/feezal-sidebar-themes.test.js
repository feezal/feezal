import {describe, it, expect, vi, beforeEach} from 'vitest';

import '../src/feezal-sidebar-themes.js';

// U25 class definitions live in a <style id="feezal-classes"> block inside
// <feezal-site>. These tests exercise the parse/sync round-trip logic on an
// unattached element (no rendering) with a plain container standing in for
// feezal.site.
function makeThemes(classes = {}) {
    const el = document.createElement('feezal-sidebar-themes');
    el._classes = classes;
    el._collapsedClasses = new Set();
    return el;
}

beforeEach(() => {
    feezal.site = document.createElement('div');
});

function styleBlock() {
    return feezal.site.querySelector('style#feezal-classes');
}

describe('_syncClassesStyle()', () => {
    it('writes the class definitions as the first child of feezal-site', () => {
        feezal.site.append(document.createElement('feezal-view'));
        const el = makeThemes({card: {color: 'red', 'font-size': '12px'}});
        el._syncClassesStyle();

        const style = styleBlock();
        expect(style).not.toBeNull();
        expect(feezal.site.firstChild).toBe(style);
        expect(style.textContent).toBe('.feezal-class-card{color:red;font-size:12px}');
    });

    it('drops properties with invalid names and strips ;"\' from values', () => {
        const el = makeThemes({
            card: {
                'color': "red;'",
                'bad prop!': 'x',
                'background': 'url("img.png")'
            }
        });
        el._syncClassesStyle();
        const css = styleBlock().textContent;
        expect(css).toBe('.feezal-class-card{color:red;background:url(img.png)}');
    });

    it('omits classes with no valid properties and removes an empty block entirely', () => {
        const el = makeThemes({card: {color: 'red'}});
        el._syncClassesStyle();
        expect(styleBlock()).not.toBeNull();

        el._classes = {card: {}, empty: {'': 'x', foo: ''}};
        el._syncClassesStyle();
        expect(styleBlock()).toBeNull();
    });

    it('publishes the classes on feezal.classes and dispatches feezal-classes-changed', () => {
        const listener = vi.fn();
        document.addEventListener('feezal-classes-changed', listener);
        const classes = {card: {color: 'red'}};
        makeThemes(classes)._syncClassesStyle();
        document.removeEventListener('feezal-classes-changed', listener);
        expect(feezal.classes).toBe(classes);
        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe('_parseClassesStyle()', () => {
    it('returns an empty map when there is no style block', () => {
        expect(makeThemes()._parseClassesStyle()).toEqual({});
    });

    it('round-trips what _syncClassesStyle writes', () => {
        const classes = {
            'card': {'color': 'red', 'font-size': '12px'},
            'big-title': {'font-weight': 'bold'}
        };
        const el = makeThemes(classes);
        el._syncClassesStyle();
        expect(el._parseClassesStyle()).toEqual(classes);
    });

    it('tolerates whitespace and skips malformed declarations', () => {
        const style = document.createElement('style');
        style.id = 'feezal-classes';
        style.textContent = '.feezal-class-card { color : red ; nonsense ; font-size:12px }';
        feezal.site.append(style);
        expect(makeThemes()._parseClassesStyle()).toEqual({
            card: {'color': 'red', 'font-size': '12px'}
        });
    });
});

describe('class management', () => {
    it('_commitRenameClass() renames the key, keeps order and rewrites canvas elements', () => {
        const el = makeThemes({a: {color: 'red'}, b: {color: 'blue'}, c: {color: 'green'}});
        el._collapsedClasses = new Set(['b']);
        const user = document.createElement('div');
        user.classList.add('feezal-class-b');
        feezal.site.append(user);

        el._commitRenameClass('b', 'accent');

        expect(Object.keys(el._classes)).toEqual(['a', 'accent', 'c']);
        expect(el._classes.accent).toEqual({color: 'blue'});
        expect(el._collapsedClasses.has('accent')).toBe(true);
        expect(el._collapsedClasses.has('b')).toBe(false);
        expect(user.classList.contains('feezal-class-accent')).toBe(true);
        expect(user.classList.contains('feezal-class-b')).toBe(false);
        expect(styleBlock().textContent).toContain('.feezal-class-accent{color:blue}');
    });

    it('_commitRenameClass() ignores empty and unchanged names', () => {
        const el = makeThemes({a: {color: 'red'}});
        el._commitRenameClass('a', '   ');
        el._commitRenameClass('a', 'a');
        expect(Object.keys(el._classes)).toEqual(['a']);
    });

    it('_deleteClass() removes the class and its CSS', () => {
        const el = makeThemes({a: {color: 'red'}, b: {color: 'blue'}});
        el._syncClassesStyle();
        el._deleteClass('a');
        expect(el._classes).toEqual({b: {color: 'blue'}});
        expect(styleBlock().textContent).not.toContain('feezal-class-a');
    });

    it('_toggleCollapse() flips membership without mutating the previous set', () => {
        const el = makeThemes();
        const before = el._collapsedClasses;
        el._toggleCollapse('a');
        expect(el._collapsedClasses.has('a')).toBe(true);
        expect(before.has('a')).toBe(false);
        el._toggleCollapse('a');
        expect(el._collapsedClasses.has('a')).toBe(false);
    });
});

describe('theme getter', () => {
    it('maps the built-in default to null', () => {
        const el = makeThemes();
        el.currentTheme = 'default';
        expect(el.theme).toBeNull();
        el.currentTheme = 'feezal-theme-dark-mint';
        expect(el.theme).toBe('feezal-theme-dark-mint');
    });
});

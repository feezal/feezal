/**
 * U65 — site-wide named colour ranges: the shared parse/resolve module.
 *
 * The resolver is the one implementation every consumer uses (base-class
 * colour bindings, the gauge's named `ranges`, the editor's preview strips),
 * so its semantics are pinned here:
 *  - `bands` is the EXISTING gauge shape: sorted by `from`, last match wins;
 *  - `gradient` blends between stops via color-mix() (OKLCH default) so
 *    var() stop colours stay theme-aware — nothing resolves at map time;
 *  - `enum` maps stringified values, `default` catches the rest;
 *  - no match → '' — the caller keeps the previous colour (safe degradation).
 */
import {describe, it, expect, beforeEach, vi} from 'vitest';
import {
    parseColorRanges, resolveRangeColor, findColorRange, getSiteColorRanges,
    scanColorBindings, cssQuote, cssUnquote, rangeSwatchGradient, ColorBindings,
} from '../packages/@feezal/feezal-element/feezal-color-ranges.js';

const TEMP = {name: 'temp', type: 'bands', bands: [
    {from: 0, color: 'var(--ok-color, #4caf50)'},
    {from: 21, color: '#ff9800'},
    {from: 28, color: 'var(--error-color)'},
]};
const LOAD = {name: 'load', type: 'gradient', space: 'oklch', stops: [
    {at: 0, color: '#4caf50'},
    {at: 100, color: '#e53935'},
]};
const MODE = {name: 'mode', type: 'enum', default: 'var(--secondary-text-color)', map: {
    heat: '#e53935', cool: '#2196f3',
}};

describe('parseColorRanges', () => {
    it('validates, sorts and drops junk', () => {
        const parsed = parseColorRanges(JSON.stringify([
            {name: 'temp', type: 'bands', bands: [{from: 28, color: 'red'}, {from: 0, color: 'green'}]},
            {name: 'broken', type: 'bands', bands: []},          // no bands → dropped
            {name: 'nope', type: 'wat'},                         // unknown type → dropped
            {type: 'enum', map: {a: 'b'}},                       // no name → dropped
            {name: 'mode', type: 'enum', map: {on: '#fff'}},
        ]));
        expect(parsed.map(r => r.name)).toEqual(['temp', 'mode']);
        expect(parsed[0].bands.map(b => b.from)).toEqual([0, 28]);   // sorted
    });

    it('tolerates garbage input', () => {
        expect(parseColorRanges('not json')).toEqual([]);
        expect(parseColorRanges('{"an":"object"}')).toEqual([]);
        expect(parseColorRanges('')).toEqual([]);
    });

    it('gradient space defaults to oklch, override kept', () => {
        const [a] = parseColorRanges([{name: 'g', type: 'gradient', stops: [{at: 0, color: 'red'}]}]);
        expect(a.space).toBe('oklch');
        const [b] = parseColorRanges([{name: 'g', type: 'gradient', space: 'srgb', stops: [{at: 0, color: 'red'}]}]);
        expect(b.space).toBe('srgb');
    });
});

describe('resolveRangeColor — bands (the gauge contract)', () => {
    it('last match wins, sorted', () => {
        expect(resolveRangeColor(TEMP, 5)).toBe('var(--ok-color, #4caf50)');
        expect(resolveRangeColor(TEMP, 21)).toBe('#ff9800');       // inclusive from
        expect(resolveRangeColor(TEMP, 35)).toBe('var(--error-color)');
    });

    it('below the first band → default → "" (keep previous colour)', () => {
        expect(resolveRangeColor(TEMP, -5)).toBe('');
        expect(resolveRangeColor({...TEMP, default: '#ccc'}, -5)).toBe('#ccc');
    });

    it('a non-numeric value falls to the default', () => {
        expect(resolveRangeColor(TEMP, 'zwanzig')).toBe('');
        expect(resolveRangeColor({...TEMP, default: '#ccc'}, undefined)).toBe('#ccc');
    });

    it('numeric strings coerce (MQTT payloads are strings)', () => {
        expect(resolveRangeColor(TEMP, '23.5')).toBe('#ff9800');
    });
});

describe('resolveRangeColor — gradient', () => {
    it('clamps outside the stop span', () => {
        expect(resolveRangeColor(LOAD, -10)).toBe('#4caf50');
        expect(resolveRangeColor(LOAD, 200)).toBe('#e53935');
    });

    it('blends between stops with color-mix in the range space', () => {
        expect(resolveRangeColor(LOAD, 50)).toBe('color-mix(in oklch, #4caf50 50%, #e53935)');
        expect(resolveRangeColor(LOAD, 25)).toBe('color-mix(in oklch, #4caf50 75%, #e53935)');
        expect(resolveRangeColor({...LOAD, space: 'srgb'}, 50))
            .toBe('color-mix(in srgb, #4caf50 50%, #e53935)');
    });

    it('var() stops pass through unresolved (theme-aware at use time)', () => {
        const g = {name: 'g', type: 'gradient', space: 'oklch',
            stops: [{at: 0, color: 'var(--primary-color)'}, {at: 10, color: 'var(--error-color)'}]};
        expect(resolveRangeColor(g, 5))
            .toBe('color-mix(in oklch, var(--primary-color) 50%, var(--error-color))');
    });
});

describe('resolveRangeColor — enum', () => {
    it('maps stringified values, default catches the rest', () => {
        expect(resolveRangeColor(MODE, 'heat')).toBe('#e53935');
        expect(resolveRangeColor(MODE, 'off')).toBe('var(--secondary-text-color)');
        const noDefault = {name: 'm', type: 'enum', default: '', map: {on: '#fff'}};
        expect(resolveRangeColor(noDefault, 'off')).toBe('');
    });

    it('non-string values stringify (JSON booleans/numbers)', () => {
        const m = {name: 'm', type: 'enum', default: '', map: {true: '#0f0', 1: '#00f'}};
        expect(resolveRangeColor(m, true)).toBe('#0f0');
        expect(resolveRangeColor(m, 1)).toBe('#00f');
    });
});

describe('site storage + lookup', () => {
    beforeEach(() => {
        document.querySelectorAll('feezal-site-stub').forEach(n => n.remove());
        globalThis.feezal = globalThis.feezal || {};
    });

    it('reads <feezal-site color-ranges> via feezal.site, cached by string', () => {
        const site = document.createElement('div');
        site.setAttribute('color-ranges', JSON.stringify([TEMP]));
        feezal.site = site;
        expect(findColorRange('temp')?.bands?.length).toBe(3);
        expect(findColorRange('nope')).toBe(null);
        const first = getSiteColorRanges();
        expect(getSiteColorRanges()).toBe(first);                   // cached
        site.setAttribute('color-ranges', JSON.stringify([MODE]));
        expect(findColorRange('temp')).toBe(null);                  // cache busted
        expect(findColorRange('mode')).toBeTruthy();
    });
});

describe('cssQuote / cssUnquote — topic-safe storage', () => {
    it('plain topics stay verbatim', () => {
        expect(cssQuote('stat/temperatur')).toBe('stat/temperatur');
        expect(cssUnquote('stat/temperatur')).toBe('stat/temperatur');
    });

    it('quotes what would break a declaration, and round-trips', () => {
        for (const ugly of ['a topic/with space', 'semi;colon', 'q"uote', "it's", 'pay!load']) {
            const stored = cssQuote(ugly);
            expect(stored.startsWith('"') && stored.endsWith('"')).toBe(true);
            expect(cssUnquote(stored)).toBe(ugly);
        }
        expect(cssQuote('')).toBe('""');
        expect(cssUnquote('""')).toBe('');
    });
});

describe('scanColorBindings — the paired-property shape (storage shape B)', () => {
    it('finds bindings, unquotes, defaults the property to payload', () => {
        const el = document.createElement('div');
        el.style.setProperty('--feezal-dial-fill-color', '#e53935');
        el.style.setProperty('--feezal-dial-fill-color-source-topic', 'stat/temp');
        el.style.setProperty('--feezal-dial-fill-color-source-property', 'payload.val');
        el.style.setProperty('--feezal-dial-fill-color-range', 'temp');
        el.style.setProperty('--feezal-app-bar-bg-source-topic', '"topic with space"');
        el.style.setProperty('--unrelated-color', 'red');
        const bindings = scanColorBindings(el);
        expect(bindings).toEqual([
            {prop: '--feezal-dial-fill-color', topic: 'stat/temp', property: 'payload.val', range: 'temp'},
            {prop: '--feezal-app-bar-bg-source-topic'.replace('-source-topic', ''),
                topic: 'topic with space', property: 'payload', range: ''},
        ]);
    });
});

describe('ColorBindings runtime', () => {
    let subs;
    beforeEach(() => {
        subs = [];
        globalThis.feezal = {
            isEditor: false,
            connection: {
                sub: vi.fn((topic, cb) => { const s = {topic, cb}; subs.push(s); return s; }),
                unsubscribe: vi.fn(sub => { subs = subs.filter(s => s !== sub); }),
            },
        };
        const site = document.createElement('div');
        site.setAttribute('color-ranges', JSON.stringify([TEMP, MODE]));
        feezal.site = site;
    });

    const hostEl = () => {
        const el = document.createElement('div');
        // minimal FeezalElement surface the runtime uses
        el.getProperty = (obj, prop) => prop.split('.').reduce((o, k) => o?.[k], obj);
        return el;
    };

    it('Range mode maps the value through the named range into the var', () => {
        const el = hostEl();
        el.style.setProperty('--fill-source-topic', 'stat/temp');
        el.style.setProperty('--fill-source-property', 'payload');
        el.style.setProperty('--fill-range', 'temp');
        const cb = new ColorBindings(el);
        cb.connect();
        expect(subs.length).toBe(1);
        subs[0].cb({topic: 'stat/temp', payload: '23.5'});
        expect(el.style.getPropertyValue('--fill')).toBe('#ff9800');
        subs[0].cb({topic: 'stat/temp', payload: '30'});
        expect(el.style.getPropertyValue('--fill')).toBe('var(--error-color)');
        // no match → previous colour kept, not cleared
        subs[0].cb({topic: 'stat/temp', payload: '-40'});
        expect(el.style.getPropertyValue('--fill')).toBe('var(--error-color)');
        cb.disconnect();
        expect(subs.length).toBe(0);
    });

    it('Subscribe mode writes the payload verbatim — the payload IS the colour', () => {
        const el = hostEl();
        el.style.setProperty('--bg-source-topic', 'stat/color');
        const cb = new ColorBindings(el);
        cb.connect();
        subs[0].cb({topic: 'stat/color', payload: '#e53935'});
        expect(el.style.getPropertyValue('--bg')).toBe('#e53935');
        subs[0].cb({topic: 'stat/color', payload: 'var(--error-color)'});
        expect(el.style.getPropertyValue('--bg')).toBe('var(--error-color)');
        cb.disconnect();
    });

    it('Range mode with an empty topic falls back to the element primary value', () => {
        const el = hostEl();
        el.setAttribute('subscribe', 'stat/own');
        el.setAttribute('message-property', 'payload.val');
        el.style.setProperty('--fill-source-topic', '""');
        el.style.setProperty('--fill-range', 'temp');
        const cb = new ColorBindings(el);
        cb.connect();
        expect(subs[0].topic).toBe('stat/own');
        subs[0].cb({topic: 'stat/own', payload: {val: 25}});
        expect(el.style.getPropertyValue('--fill')).toBe('#ff9800');
        cb.disconnect();
    });

    it('Subscribe mode with an empty topic subscribes nothing', () => {
        const el = hostEl();
        el.setAttribute('subscribe', 'stat/own');
        el.style.setProperty('--bg-source-topic', '""');
        const cb = new ColorBindings(el);
        cb.connect();
        expect(subs.length).toBe(0);
        cb.disconnect();
    });

    it('is editor-gated like the primary subscription', () => {
        feezal.isEditor = true;
        feezal.preventEditorMqtt = undefined;   // default = prevent
        const el = hostEl();
        el.style.setProperty('--fill-source-topic', 'stat/temp');
        const cb = new ColorBindings(el);
        cb.connect();
        expect(subs.length).toBe(0);
        feezal.preventEditorMqtt = false;       // user opted in
        cb.connect();
        expect(subs.length).toBe(1);
        cb.disconnect();
    });

    it('connect() is idempotent for an unchanged binding set; rewire() resubscribes', () => {
        const el = hostEl();
        el.style.setProperty('--fill-source-topic', 'stat/temp');
        const cb = new ColorBindings(el);
        cb.connect();
        cb.connect();
        expect(subs.length).toBe(1);
        el.style.setProperty('--fill-source-topic', 'stat/other');
        cb.rewire();
        expect(subs.length).toBe(1);
        expect(subs[0].topic).toBe('stat/other');
        cb.disconnect();
    });
});

describe('rangeSwatchGradient — editor preview strips', () => {
    it('bands → hard steps, gradient → blend, enum → segments', () => {
        expect(rangeSwatchGradient(TEMP)).toContain('var(--ok-color, #4caf50) 0.0% 33.3%');
        expect(rangeSwatchGradient(LOAD)).toBe('linear-gradient(in oklch 90deg, #4caf50 0.0%, #e53935 100.0%)');
        expect(rangeSwatchGradient(MODE)).toContain('#e53935 0.0% 33.3%');
        expect(rangeSwatchGradient(null)).toBe('');
    });
});

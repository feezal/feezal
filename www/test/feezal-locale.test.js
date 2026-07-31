/**
 * N38 + A27 — the shared locale module: resolution order, the fallback chain,
 * cached Intl formatting, and locale-aware descriptor defaults.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {resolveLocaleChain, currentLocale, formatNumber, localizedDefault}
    from '../packages/@feezal/feezal-element/feezal-locale.js';

beforeEach(() => {
    globalThis.feezal = {};
});

describe('resolveLocaleChain — BCP-47 truncation, en last', () => {
    it('walks most specific first and lands on en', () => {
        expect(resolveLocaleChain('de-AT')).toEqual(['de-AT', 'de', 'en']);
        expect(resolveLocaleChain('zh-Hans-CN')).toEqual(['zh-Hans-CN', 'zh-Hans', 'zh', 'en']);
        expect(resolveLocaleChain('fr')).toEqual(['fr', 'en']);
    });

    it('en does not duplicate; empty yields just en', () => {
        expect(resolveLocaleChain('en')).toEqual(['en']);
        expect(resolveLocaleChain('en-US')).toEqual(['en-US', 'en']);
        expect(resolveLocaleChain('')).toEqual(['en']);
        expect(resolveLocaleChain(undefined)).toEqual(['en']);
    });
});

describe('currentLocale — explicit global → site attribute → browser', () => {
    it('feezal.locale wins over everything', () => {
        const site = document.createElement('div');
        site.setAttribute('locale', 'fr');
        feezal.site = site;
        feezal.locale = 'de';
        expect(currentLocale()).toBe('de');
    });

    it('the site attribute wins over the browser', () => {
        const site = document.createElement('div');
        site.setAttribute('locale', 'de-AT');
        feezal.site = site;
        expect(currentLocale()).toBe('de-AT');
    });

    it('no site locale → the browser language', () => {
        feezal.site = document.createElement('div');
        expect(currentLocale()).toBe(navigator.language || 'en');
    });
});

describe('formatNumber — Intl done once', () => {
    it('localizes the decimal separator', () => {
        expect(formatNumber(21.5, {locale: 'de'})).toBe('21,5');
        expect(formatNumber(21.5, {locale: 'en'})).toBe('21.5');
    });

    it('digits give a fixed fraction; absent keeps the value precision', () => {
        expect(formatNumber(21, {digits: 1, locale: 'de'})).toBe('21,0');
        expect(formatNumber(21.55, {digits: 1, locale: 'en'})).toBe('21.6');
        expect(formatNumber(21.125, {locale: 'en'})).toBe('21.125');
    });

    it('grouping is opt-in, and locale-correct', () => {
        expect(formatNumber(1234.5, {locale: 'de'})).toBe('1234,5');
        expect(formatNumber(1234.5, {grouping: true, locale: 'de'})).toBe('1.234,5');
        expect(formatNumber(1234.5, {grouping: true, locale: 'en'})).toBe('1,234.5');
    });

    it('non-numeric payloads pass through untouched — never "NaN"', () => {
        expect(formatNumber('unknown', {locale: 'de'})).toBe('unknown');
        expect(formatNumber('', {locale: 'de'})).toBe('');
        expect(formatNumber(null)).toBe('');
        expect(formatNumber(undefined)).toBe('');
    });

    it('numeric strings format (MQTT payloads are strings)', () => {
        expect(formatNumber('21.5', {locale: 'de'})).toBe('21,5');
    });

    it('a broken locale string falls back to en instead of throwing', () => {
        expect(formatNumber(1.5, {locale: 'not a locale!!'})).toBe('1.5');
    });

    it('uses the site locale when none is passed', () => {
        feezal.locale = 'de';
        expect(formatNumber(21.5)).toBe('21,5');
    });
});

describe('localizedDefault — the dict IS the opt-in (A27)', () => {
    const spec = {name: 'label-on', default: 'On', defaultI18n: {de: 'Ein'}};

    it('resolves through the chain and falls back to default', () => {
        expect(localizedDefault(spec, 'de')).toBe('Ein');
        expect(localizedDefault(spec, 'de-AT')).toBe('Ein');
        expect(localizedDefault(spec, 'fr')).toBe('On');
        expect(localizedDefault(spec, 'en')).toBe('On');
    });

    it('a descriptor without a dict is returned untouched — payload-* can never localize', () => {
        expect(localizedDefault({name: 'payload-on', default: 'ON'}, 'de')).toBe('ON');
        expect(localizedDefault(undefined, 'de')).toBe(undefined);
    });

    it('an exact-locale entry beats the language entry', () => {
        const s = {default: 'On', defaultI18n: {de: 'Ein', 'de-CH': 'Ii'}};
        expect(localizedDefault(s, 'de-CH')).toBe('Ii');
        expect(localizedDefault(s, 'de-AT')).toBe('Ein');
    });

    it('uses the current locale by default', () => {
        feezal.locale = 'de';
        expect(localizedDefault(spec)).toBe('Ein');
    });
});

describe('A27 language coverage — every shipped dict carries the full language set', () => {
    // The 07/2026 expansion: whatever ships a defaultI18n must translate to
    // ALL supported languages, so no card is half-localized. Scans every
    // element package source for dicts and asserts the key set.
    const LANGS = ['de', 'es', 'fr', 'it', 'pl', 'pt', 'tr'];

    it('all defaultI18n dicts in element packages carry de+es+fr+it+pl+pt+tr', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const root = path.resolve(__dirname, '../packages/@feezal');
        const dicts = [];
        const walk = dir => {
            for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
                const p = path.join(dir, e.name);
                if (e.isDirectory() && e.name !== 'node_modules') walk(p);
                else if (e.isFile() && e.name.endsWith('.js')) {
                    const src = fs.readFileSync(p, 'utf8');
                    for (const m of src.matchAll(/defaultI18n:\s*\{([^}]*)\}/g)) {
                        dicts.push({file: e.name, keys: [...m[1].matchAll(/(?:^|[,{]\s*)['"]?([\w-]+)['"]?\s*:/g)].map(k => k[1]).sort()});
                    }
                }
            }
        };
        walk(root);
        expect(dicts.length).toBeGreaterThan(30);   // the shipped set
        for (const d of dicts) {
            expect(d.keys, d.file).toEqual(LANGS);
        }
    });

    it('a Brazilian browser resolves to the pt entry', () => {
        const s = {default: 'On', defaultI18n: {de: 'Ein', es: 'Encendido', fr: 'Allumé', it: 'Acceso', pl: 'Włączony', pt: 'Ligado', tr: 'Açık'}};
        expect(localizedDefault(s, 'pt-BR')).toBe('Ligado');
        expect(localizedDefault(s, 'tr')).toBe('Açık');
        expect(localizedDefault(s, 'pl')).toBe('Włączony');
        expect(localizedDefault(s, 'nl')).toBe('On');   // unsupported → en default
    });
});

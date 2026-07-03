import {describe, it, expect} from 'vitest';

import '../src/feezal-sidebar-inspector-attributes.js';

const el = document.createElement('feezal-sidebar-inspector-attributes');

describe('_toKebab() — property name to attribute name', () => {
    it('converts camelCase to kebab-case', () => {
        expect(el._toKebab('childPosition')).toBe('child-position');
        expect(el._toKebab('minValue')).toBe('min-value');
    });

    it('leaves lowercase names untouched', () => {
        expect(el._toKebab('subscribe')).toBe('subscribe');
    });
});

describe('_toCssColorHex() — normalise colors for <input type=color>', () => {
    it('passes 6-digit hex through', () => {
        expect(el._toCssColorHex('#a1B2c3')).toBe('#a1B2c3');
    });

    it('expands 3-digit hex', () => {
        expect(el._toCssColorHex('#abc')).toBe('#aabbcc');
    });

    it('converts rgb()/rgba() triplets', () => {
        expect(el._toCssColorHex('rgb(255, 0, 16)')).toBe('#ff0010');
        expect(el._toCssColorHex('rgba(0, 128, 255, 0.5)')).toBe('#0080ff');
    });

    it('falls back to black for empty or unparseable values', () => {
        expect(el._toCssColorHex('')).toBe('#000000');
        expect(el._toCssColorHex('tomato')).toBe('#000000');
    });
});

describe('attribute item factories', () => {
    it('_makeTextItem() reads the kebab-case attribute first', () => {
        const target = document.createElement('div');
        target.setAttribute('min-value', '5');
        expect(el._makeTextItem(target, 'minValue').value).toBe('5');
    });

    it('_makeTextItem() falls back to the raw name, then empty string', () => {
        const target = document.createElement('div');
        target.setAttribute('minValue', '7');
        expect(el._makeTextItem(target, 'minValue').value).toBe('7');
        expect(el._makeTextItem(target, 'missing').value).toBe('');
    });

    it('_makeTopicItem() flags the item as an MQTT topic input', () => {
        const target = document.createElement('div');
        target.setAttribute('subscribe', 'home/temp');
        const item = el._makeTopicItem(target, 'subscribe');
        expect(item.value).toBe('home/temp');
        expect(item.elem.mqttTopic).toBe(true);
        expect(item.elem.input).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// N23 — icon picker grouping across sets (pure helper)

import {iconPickerGroups, iconVariantBases} from '../src/feezal-sidebar-inspector-attributes.js';

describe('iconPickerGroups() — N23 multi-set icon picker', () => {
    const MATERIAL = ['lightbulb', 'light_mode', 'thermostat'];
    const sets = () => new Map([
        ['mdi', {names: ['lightbulb', 'lightbulb-on', 'sofa']}],
        ['knx-uf', {names: ['sunblind', 'light-light']}]
    ]);

    it('material chip: bare values, filtered by substring', () => {
        const r = iconPickerGroups({materialNames: MATERIAL, sets: sets(), activeSet: 'material', query: 'light'});
        expect(r.groups).toEqual([{set: 'material', names: ['lightbulb', 'light_mode']}]);
        expect(r.flat[0]).toEqual({set: 'material', name: 'lightbulb', value: 'lightbulb'});
    });

    it('registered-set chip: prefixed values', () => {
        const r = iconPickerGroups({materialNames: MATERIAL, sets: sets(), activeSet: 'mdi', query: 'sofa'});
        expect(r.flat).toEqual([{set: 'mdi', name: 'sofa', value: 'mdi:sofa'}]);
    });

    it('typing a set: prefix scopes the search to that set', () => {
        const r = iconPickerGroups({materialNames: MATERIAL, sets: sets(), activeSet: 'material', query: 'mdi:light'});
        expect(r.activeSet).toBe('mdi');
        expect(r.flat.map(f => f.value)).toEqual(['mdi:lightbulb', 'mdi:lightbulb-on']);
    });

    it('an unknown prefix is treated as a plain substring query', () => {
        const r = iconPickerGroups({materialNames: MATERIAL, sets: sets(), activeSet: 'material', query: 'xxx:light'});
        expect(r.activeSet).toBe('material');
        expect(r.flat).toEqual([]);   // no material name contains "xxx:light"
    });

    it('all chip groups per set in order (material first)', () => {
        const r = iconPickerGroups({materialNames: MATERIAL, sets: sets(), activeSet: 'all', query: 'light'});
        expect(r.groups.map(g => g.set)).toEqual(['material', 'mdi', 'knx-uf']);
        expect(r.flat.map(f => f.value)).toEqual([
            'lightbulb', 'light_mode', 'mdi:lightbulb', 'mdi:lightbulb-on', 'knx-uf:light-light'
        ]);
    });

    it('caps the total tile count across groups', () => {
        const many = Array.from({length: 200}, (_, i) => `icon-${i}`);
        const r = iconPickerGroups({materialNames: many, sets: sets(), activeSet: 'all', query: ''});
        expect(r.flat.length).toBe(90);
        expect(r.groups[0].names.length).toBe(90);   // material exhausts the cap
    });

    it('falls back to material for a stale persisted chip', () => {
        const r = iconPickerGroups({materialNames: MATERIAL, sets: sets(), activeSet: 'uninstalled-set', query: ''});
        expect(r.activeSet).toBe('material');
    });
});

describe('iconVariantBases() + variant picker mode — basic-icon-value', () => {
    const STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const NAMES = [
        'fam_00', ...STEPS.slice(1).map(s => `fam_${s}`),          // complete, _00 zero alias
        ...STEPS.map(s => `dial_${s}`),                             // complete, plain _0
        ...STEPS.slice(1).map(s => `part_${s}`),                    // missing zero → excluded
        'plain', 'fam_50x'
    ];

    it('finds families with all tens steps — the zero step is optional', () => {
        // 'part' (10..100, no zero) qualifies: shutter/garage-style families.
        expect(iconVariantBases(NAMES, STEPS)).toEqual(['dial', 'fam', 'part']);
    });

    it('excludes families missing a non-zero step', () => {
        expect(iconVariantBases(NAMES.filter(n => n !== 'fam_60'), STEPS)).toEqual(['dial', 'part']);
    });

    it('variant mode offers family bases with a mid-step preview', () => {
        const sets = new Map([['vt', {names: NAMES}]]);
        const r = iconPickerGroups({materialNames: ['lightbulb'], sets, activeSet: 'vt', query: '', variantSteps: STEPS});
        expect(r.groups).toEqual([{set: 'vt', names: ['dial', 'fam', 'part']}]);
        expect(r.flat[1]).toEqual({set: 'vt', name: 'fam', value: 'vt:fam', preview: 'vt:fam_50'});
    });

    it('the tens-only family gets the mid-step preview too', () => {
        const sets = new Map([['vt', {names: NAMES}]]);
        const r = iconPickerGroups({materialNames: [], sets, activeSet: 'vt', query: 'part', variantSteps: STEPS});
        expect(r.flat).toEqual([{set: 'vt', name: 'part', value: 'vt:part', preview: 'vt:part_50'}]);
    });

    it('variant mode: query filters bases; material offers nothing', () => {
        const sets = new Map([['vt', {names: NAMES}]]);
        const scoped = iconPickerGroups({materialNames: ['lightbulb'], sets, activeSet: 'vt', query: 'dia', variantSteps: STEPS});
        expect(scoped.flat.map(f => f.value)).toEqual(['vt:dial']);
        const material = iconPickerGroups({materialNames: ['lightbulb'], sets, activeSet: 'material', query: '', variantSteps: STEPS});
        expect(material.groups).toEqual([]);
    });
});

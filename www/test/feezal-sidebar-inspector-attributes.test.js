import {describe, it, expect, vi} from 'vitest';

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

// ── U39: structured inspector (sections / visibleWhen / advanced) ──────────
describe('U39 — conditional visibility (_passesVisibleWhen)', () => {
    it('returns true when there is no condition', () => {
        expect(el._passesVisibleWhen(null, {})).toBe(true);
    });

    it('matches a single value (with boolean/number coercion)', () => {
        expect(el._passesVisibleWhen({attr: 'payload-mode', equals: 'json'}, {'payload-mode': 'json'})).toBe(true);
        expect(el._passesVisibleWhen({attr: 'payload-mode', equals: 'json'}, {'payload-mode': 'separate'})).toBe(false);
        expect(el._passesVisibleWhen({attr: 'on', equals: true}, {on: true})).toBe(true);
        expect(el._passesVisibleWhen({attr: 'on', equals: 'true'}, {on: true})).toBe(true);
        expect(el._passesVisibleWhen({attr: 'n', equals: 1}, {n: '1'})).toBe(true);
    });

    it('matches any value in an array', () => {
        const c = {attr: 'mode', equals: ['heat', 'auto']};
        expect(el._passesVisibleWhen(c, {mode: 'auto'})).toBe(true);
        expect(el._passesVisibleWhen(c, {mode: 'off'})).toBe(false);
    });

    it('ANDs an array of conditions', () => {
        const c = [{attr: 'payload-mode', equals: 'separate'}, {attr: 'show', equals: true}];
        expect(el._passesVisibleWhen(c, {'payload-mode': 'separate', show: true})).toBe(true);
        expect(el._passesVisibleWhen(c, {'payload-mode': 'separate', show: false})).toBe(false);
    });
});

describe('U39 — grouping + advanced split (_visibleGroups)', () => {
    function withItems(items) {
        const ins = document.createElement('feezal-sidebar-inspector-attributes');
        ins.items = items.map((it, i) => ({attrName: it.name, value: it.value ?? '', default: it.default,
            section: it.section || '', advanced: Boolean(it.advanced), visibleWhen: it.visibleWhen || null, _i: i}));
        return ins;
    }

    it('groups by section in first-appearance order, section-less items lead', () => {
        const ins = withItems([
            {name: 'locked'},                                  // section-less
            {name: 'sub', section: 'Connection'},
            {name: 'min', section: 'Setpoint'},
            {name: 'pub', section: 'Connection'},
        ]);
        const groups = ins._visibleGroups();
        expect(groups.map(g => g.section)).toEqual(['', 'Connection', 'Setpoint']);
        expect(groups[1].main.map(x => x.item.attrName)).toEqual(['sub', 'pub']);
    });

    it('hides items whose visibleWhen fails against effective values (default applies when unset)', () => {
        const ins = withItems([
            {name: 'payload-mode', section: 'Connection', default: 'separate'},   // unset → default separate
            {name: 'subscribe', section: 'Connection', visibleWhen: {attr: 'payload-mode', equals: 'json'}},
            {name: 'subscribe-setpoint', section: 'Connection', visibleWhen: {attr: 'payload-mode', equals: 'separate'}},
        ]);
        const conn = ins._visibleGroups().find(g => g.section === 'Connection');
        const names = conn.main.map(x => x.item.attrName);
        expect(names).toContain('subscribe-setpoint');   // separate is the effective default
        expect(names).not.toContain('subscribe');        // json-only, hidden
    });

    it('separates advanced items into the group.advanced bucket', () => {
        const ins = withItems([
            {name: 'sub', section: 'Connection'},
            {name: 'message-property', section: 'Connection', advanced: true},
        ]);
        const conn = ins._visibleGroups().find(g => g.section === 'Connection');
        expect(conn.main.map(x => x.item.attrName)).toEqual(['sub']);
        expect(conn.advanced.map(x => x.item.attrName)).toEqual(['message-property']);
    });

    it('preserves each item’s original index for change handlers', () => {
        const ins = withItems([
            {name: 'a', section: 'X'},
            {name: 'b', section: 'Y'},
            {name: 'c', section: 'X'},
        ]);
        const gx = ins._visibleGroups().find(g => g.section === 'X');
        expect(gx.main.map(x => x.idx)).toEqual([0, 2]);
    });
});

describe('U39 — default-collapsed sections (_initCollapsedSections)', () => {
    it('collapses Availability/Advanced when present, nothing else', () => {
        const ins = document.createElement('feezal-sidebar-inspector-attributes');
        ins.items = [
            {attrName: 'sub', section: 'Connection'},
            {attrName: 'av', section: 'Availability'},
        ];
        ins._initCollapsedSections();
        expect([...ins._collapsedSections]).toEqual(['availability']);
    });

    it('is empty when no boilerplate sections exist', () => {
        const ins = document.createElement('feezal-sidebar-inspector-attributes');
        ins.items = [{attrName: 'sub', section: 'Connection'}];
        ins._initCollapsedSections();
        expect(ins._collapsedSections.size).toBe(0);
    });
});

// ── U41/U39 regression: flow knobs must actually appear for a flow view ──────
import '../src/feezal-view.js';

describe('feezal-view flow knobs surface in the inspector (U41 visibleWhen)', () => {
    function itemsFor(childPosition) {
        const view = document.createElement('feezal-view');
        view.setAttribute('name', 'home');
        if (childPosition) view.setAttribute('child-position', childPosition);
        document.body.append(view);
        const ins = document.createElement('feezal-sidebar-inspector-attributes');
        ins.selectedElems = [view];
        ins._rebuildItems();
        const visible = ins._visibleGroups().flatMap(g => [...g.main, ...g.advanced]).map(x => x.item.attrName);
        document.body.innerHTML = '';
        return visible;
    }

    it('shows flow-gap/direction/justify/align only when child-position="flow"', () => {
        const flow = itemsFor('flow');
        for (const n of ['flow-gap', 'flow-direction', 'flow-justify', 'flow-align']) {
            expect(flow).toContain(n);
        }
        const absolute = itemsFor('absolute');
        expect(absolute).not.toContain('flow-gap');
    });
});

// ── WP3/E106: type:'custom' custom-inspector platform hook ──────────────────
import {LitElement as LitElementCustom, html} from 'lit';

// Tiny stub component standing in for a hosted inspector building block
// (e.g. the climate-profiles picker). It records the `.element` it receives and
// can emit the N6 `feezal-attribute-changed` protocol on demand.
class XTestPanel extends LitElementCustom {
    static properties = {element: {attribute: false}};
    constructor() { super(); this.element = null; }
    render() { return html`<div class="x-test-panel-body">panel</div>`; }
    stamp(name, value) {
        this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
            bubbles: true, composed: true, detail: {name, value},
        }));
    }
}
if (!customElements.get('x-test-panel')) customElements.define('x-test-panel', XTestPanel);

// A host element that exposes a `type:'custom'` descriptor in a section, plus a
// plain attribute and one gated behind visibleWhen.
class XCustomHost extends LitElementCustom {
    static get feezal() {
        return {
            attributes: [
                'subscribe',
                {name: 'mode', type: 'select', options: ['a', 'b'], section: 'Profiles', default: 'a'},
                {type: 'custom', component: 'x-test-panel', section: 'Profiles'},
                {type: 'custom', component: 'x-test-panel', section: 'Gated',
                 visibleWhen: {attr: 'mode', equals: 'b'}},
            ],
        };
    }
    render() { return html``; }
}
if (!customElements.get('x-custom-host')) customElements.define('x-custom-host', XCustomHost);

function makeInspectorFor(host) {
    const ins = document.createElement('feezal-sidebar-inspector-attributes');
    ins.selectedElems = [host];
    ins._rebuildItems();
    return ins;
}

describe('WP3/E106 — type:custom platform hook (_rebuildItems)', () => {
    it('carries a custom descriptor into an item with component + section + visibleWhen', () => {
        const host = document.createElement('x-custom-host');
        const ins = makeInspectorFor(host);
        const custom = ins.items.filter(it => it.custom);
        expect(custom).toHaveLength(2);
        expect(custom[0]).toMatchObject({custom: true, component: 'x-test-panel', section: 'Profiles'});
        expect(custom[1].visibleWhen).toEqual({attr: 'mode', equals: 'b'});
    });

    it('places the custom item in its section group', () => {
        const host = document.createElement('x-custom-host');
        const ins = makeInspectorFor(host);
        const profiles = ins._visibleGroups().find(g => g.section === 'Profiles');
        expect(profiles).toBeTruthy();
        expect(profiles.main.some(x => x.item.custom && x.item.component === 'x-test-panel')).toBe(true);
    });

    it('honours visibleWhen for the gated custom entry (hidden by default, shown when mode=b)', () => {
        const host = document.createElement('x-custom-host');
        let ins = makeInspectorFor(host);
        expect(ins._visibleGroups().some(g => g.section === 'Gated')).toBe(false);
        host.setAttribute('mode', 'b');
        ins = makeInspectorFor(host);
        expect(ins._visibleGroups().some(g => g.section === 'Gated')).toBe(true);
    });

    it('drops custom items under multi-select (component is single-element authored)', () => {
        const a = document.createElement('x-custom-host');
        const b = document.createElement('x-custom-host');
        const ins = document.createElement('feezal-sidebar-inspector-attributes');
        ins.selectedElems = [a, b];
        ins._rebuildItems();
        expect(ins.items.some(it => it.custom)).toBe(false);
    });
});

// ── E108: native self-discovery — client map ⇄ server contract ─────────────
// The server (native-discovery.js) synthesises discovery entities from native
// Homematic climate / WLED topics and merges them into /api/discovery/devices.
// These tests drive _applyDiscovery with the EXACT synthesised config shapes to
// prove the real element discovery maps consume the native contract.
import '../packages/@feezal/feezal-element-material-climate/feezal-element-material-climate.js';
import '../packages/@feezal/feezal-element-glass-wled/feezal-element-glass-wled.js';
import '../packages/@feezal/feezal-element-material-contact/feezal-element-material-contact.js';
import '../packages/@feezal/feezal-element-material-cover/feezal-element-material-cover.js';

describe('E108 — native discovery stamps onto *-climate + wled elements', () => {
    it('Homematic climate: native config stamps message-property/valve/modes/topics', () => {
        // Rich modes array exactly as the server emits for a BidCoS TRV.
        const modes = [
            {value: 0, label: 'Auto', publish: 'hm/set/TRV/4/AUTO_MODE', payload: 'true'},
            {value: 1, label: 'Manu', publish: 'hm/set/TRV/4/MANU_MODE', payload: '$setpoint'},
            {value: 1, label: 'Off', 'match-setpoint-max': 4.5,
                publish: 'hm/set/TRV/4/MANU_MODE', payload: '4.5'},
            {value: 3, label: 'Boost', momentary: true,
                publish: 'hm/set/TRV/4/BOOST_MODE', payload: 'true', off: 'restore'},
        ];
        const entity = {
            discovery_id: 'homematic/TRV/4',
            component: 'climate',
            source: 'homematic',
            name: 'Living-room TRV',
            config: {
                name: 'Living-room TRV',
                schema: 'separate',
                temperature_state_topic:   'hm/status/TRV/4/SET_TEMPERATURE',
                temperature_command_topic: 'hm/set/TRV/4/SET_TEMPERATURE',
                current_temperature_topic: 'hm/status/TRV/4/ACTUAL_TEMPERATURE',
                mode_state_topic:          'hm/status/TRV/4/CONTROL_MODE',
                action_topic:              'hm/status/TRV/4/VALVE_STATE',
                min_temp: 4.5, max_temp: 30.5, temp_step: 0.5,
                temperature_unit: 'C',
                modes,
                message_property: 'payload.val',
                message_property_setpoint: 'payload.val',
                message_property_actual: 'payload.val',
                message_property_mode: 'payload.val',
                message_property_valve: 'payload.val',
                message_property_boost_remaining: 'payload.val',
                valve_min: 0,
                valve_max: 100,
                availability_normalized: {
                    entries: [{topic: 'hm/status/TRV/0/UNREACH', property: 'payload.val'}],
                    mode: 'all', payloadAvailable: false, payloadUnavailable: true,
                },
            },
        };

        const el = document.createElement('feezal-element-material-climate');
        const change = vi.fn();
        globalThis.feezal.app = {change};

        const ins = document.createElement('feezal-sidebar-inspector-attributes');
        ins.selectedElems = [el];
        ins._applyDiscovery(entity);

        // Native-only keys (HA/z2m absent) — the crux of the E108 contract.
        expect(el.getAttribute('message-property')).toBe('payload.val');
        // Per-topic message-property twins each stamped to payload.val (E108 fix):
        // the per-read paths never fall back to the element-level one.
        expect(el.getAttribute('message-property-setpoint')).toBe('payload.val');
        expect(el.getAttribute('message-property-actual')).toBe('payload.val');
        expect(el.getAttribute('message-property-mode')).toBe('payload.val');
        expect(el.getAttribute('message-property-valve')).toBe('payload.val');
        expect(el.getAttribute('message-property-boost-remaining')).toBe('payload.val');
        expect(el.getAttribute('valve-min')).toBe('0');
        expect(el.getAttribute('valve-max')).toBe('100');
        expect(el.getAttribute('subscribe-valve')).toBe('hm/status/TRV/4/VALVE_STATE');
        // :0 UNREACH availability (property → JSON-array form; false=available).
        expect(el.getAttribute('subscribe-availability')).toBe(
            '[{"topic":"hm/status/TRV/0/UNREACH","property":"payload.val"}]');
        expect(el.getAttribute('payload-available')).toBe('false');
        expect(el.getAttribute('payload-unavailable')).toBe('true');
        // Setpoint topics stamp the SEPARATE-mode attrs (Homematic is separate mode).
        expect(el.getAttribute('subscribe-setpoint')).toBe('hm/status/TRV/4/SET_TEMPERATURE');
        expect(el.getAttribute('subscribe-mode')).toBe('hm/status/TRV/4/CONTROL_MODE');
        expect(el.getAttribute('payload-mode')).toBe('separate');
        expect(el.getAttribute('unit')).toBe('°C');
        // modes is JSON-stringified (round-trips back to the rich array).
        expect(JSON.parse(el.getAttribute('modes'))).toEqual(modes);
        expect(el.getAttribute('discovery-id')).toBe('homematic/TRV/4');
        expect(change).toHaveBeenCalled();
    });

    it('Homematic contact: native binary_sensor config stamps payload-tilted/type/subscribe/message-property + availability', () => {
        // Exactly the shape the ROTARY_HANDLE recognizer emits (tristate + tilt).
        const entity = {
            discovery_id: 'hm-contact:MEQ0200002',
            component: 'binary_sensor',
            source: 'homematic',
            sourceLabel: 'hm',
            name: 'Fenstergriff Bad',
            config: {
                name: 'Fenstergriff Bad',
                state_topic: 'hm/status/Fenstergriff Bad:1/STATE',
                value_template: '{{ value_json.val }}',
                device_class: 'window',
                payload_off: '0',
                payload_tilted: '1',
                payload_on: '2',
                availability_normalized: {
                    entries: [
                        {topic: 'hm/status/Fenstergriff Bad:0/UNREACH', property: 'payload.val'},
                        {topic: 'hm/status/Fenstergriff Bad:0/LOWBAT', property: 'payload.val'},
                    ],
                    mode: 'all', payloadAvailable: false, payloadUnavailable: true,
                },
            },
        };

        const el = document.createElement('feezal-element-material-contact');
        const change = vi.fn();
        globalThis.feezal.app = {change};

        const ins = document.createElement('feezal-sidebar-inspector-attributes');
        ins.selectedElems = [el];
        ins._applyDiscovery(entity);

        // The native-only tilt key lands on payload-tilted.
        expect(el.getAttribute('payload-tilted')).toBe('1');
        expect(el.getAttribute('payload-open')).toBe('2');
        expect(el.getAttribute('payload-closed')).toBe('0');
        // device_class → type via valueMap; value_template → message-property path.
        expect(el.getAttribute('type')).toBe('window');
        expect(el.getAttribute('subscribe')).toBe('hm/status/Fenstergriff Bad:1/STATE');
        expect(el.getAttribute('message-property')).toBe('payload.val');
        // Two-entry availability → JSON-array form; false=available.
        expect(el.getAttribute('subscribe-availability')).toBe(JSON.stringify([
            {topic: 'hm/status/Fenstergriff Bad:0/UNREACH', property: 'payload.val'},
            {topic: 'hm/status/Fenstergriff Bad:0/LOWBAT', property: 'payload.val'},
        ]));
        expect(el.getAttribute('payload-available')).toBe('false');
        expect(el.getAttribute('payload-unavailable')).toBe('true');
        expect(el.getAttribute('discovery-id')).toBe('hm-contact:MEQ0200002');
        expect(change).toHaveBeenCalled();
    });

    it('Homematic cover: native config stamps separate-mode position/stop topics + min/max + message-property + availability', () => {
        // Exactly the shape the hmCoverRecognizer emits for a Homematic blind
        // (LEVEL 0.0–1.0 → position_max 1, separate mode).
        const entity = {
            discovery_id: 'hm-cover:MEQ0500005:1',
            component: 'cover',
            source: 'homematic',
            sourceLabel: 'hm',
            name: 'Rolladen Wohnzimmer:1',
            config: {
                name: 'Rolladen Wohnzimmer:1',
                payload_mode: 'separate',
                position_state_topic:   'hm/status/Rolladen Wohnzimmer:1/LEVEL',
                position_command_topic: 'hm/set/Rolladen Wohnzimmer:1/LEVEL',
                stop_command_topic:     'hm/set/Rolladen Wohnzimmer:1/STOP',
                position_min: 0,
                position_max: 1,
                message_property: 'payload.val',
                message_property_position: 'payload.val',
                availability_normalized: {
                    entries: [{topic: 'hm/status/Rolladen Wohnzimmer:0/UNREACH', property: 'payload.val'}],
                    mode: 'all', payloadAvailable: false, payloadUnavailable: true,
                },
            },
        };

        const el = document.createElement('feezal-element-material-cover');
        const change = vi.fn();
        globalThis.feezal.app = {change};

        const ins = document.createElement('feezal-sidebar-inspector-attributes');
        ins.selectedElems = [el];
        ins._applyDiscovery(entity);

        // Homematic is SEPARATE mode — LEVEL position goes to the separate-mode attrs.
        expect(el.getAttribute('payload-mode')).toBe('separate');
        expect(el.getAttribute('subscribe-position')).toBe('hm/status/Rolladen Wohnzimmer:1/LEVEL');
        expect(el.getAttribute('publish-position')).toBe('hm/set/Rolladen Wohnzimmer:1/LEVEL');
        expect(el.getAttribute('publish-stop')).toBe('hm/set/Rolladen Wohnzimmer:1/STOP');
        // LEVEL 0.0–1.0 → max 1 (element scales to 0–100 %, no server scaling).
        expect(el.getAttribute('min')).toBe('0');
        expect(el.getAttribute('max')).toBe('1');
        expect(el.getAttribute('message-property')).toBe('payload.val');
        expect(el.getAttribute('message-property-position')).toBe('payload.val');
        // :0 UNREACH availability (property → JSON-array form; false=available).
        expect(el.getAttribute('subscribe-availability')).toBe(
            '[{"topic":"hm/status/Rolladen Wohnzimmer:0/UNREACH","property":"payload.val"}]');
        expect(el.getAttribute('payload-available')).toBe('false');
        expect(el.getAttribute('payload-unavailable')).toBe('true');
        expect(el.getAttribute('label')).toBe('Rolladen Wohnzimmer:1');
        expect(el.getAttribute('discovery-id')).toBe('hm-cover:MEQ0500005:1');
        expect(change).toHaveBeenCalled();
    });

    it('WLED: native config stamps topic + label + availability', () => {
        const entity = {
            discovery_id: 'wled/abc123',
            component: 'wled',
            source: 'wled',
            name: 'Desk strip',
            config: {
                name: 'Desk strip',
                device_topic: 'wled/abc123',
                availability_topic: 'wled/abc123/status',
                availability_normalized: {
                    entries: [{topic: 'wled/abc123/status'}],
                    mode: 'all',
                    payloadAvailable: 'online',
                    payloadUnavailable: 'offline',
                },
            },
        };

        const el = document.createElement('feezal-element-glass-wled');
        const change = vi.fn();
        globalThis.feezal.app = {change};

        const ins = document.createElement('feezal-sidebar-inspector-attributes');
        ins.selectedElems = [el];
        ins._applyDiscovery(entity);

        expect(el.getAttribute('topic')).toBe('wled/abc123');
        expect(el.getAttribute('label')).toBe('Desk strip');
        // Availability applied automatically from availability_normalized.
        expect(el.getAttribute('subscribe-availability')).toBe('wled/abc123/status');
        expect(el.getAttribute('payload-available')).toBe('online');
        expect(el.getAttribute('payload-unavailable')).toBe('offline');
        expect(el.getAttribute('discovery-id')).toBe('wled/abc123');
        expect(change).toHaveBeenCalled();
    });
});

describe('E108 — discovery picker encode/decode + source label', () => {
    // Native Homematic discovery_ids contain spaces ("hm-climate:Thermostat
    // Hobbyraum:1"), which Shoelace <sl-select> cannot round-trip as an option
    // value. The picker percent-encodes values and _onPickDiscovery decodes them.
    it('an entity whose discovery_id contains a space is still selectable (encode/decode round-trip)', () => {
        const entity = {
            discovery_id: 'hm-climate:Thermostat Hobbyraum',
            component: 'climate',
            source: 'homematic',
            sourceLabel: 'hm',
            name: 'Thermostat Hobbyraum',
            config: {
                name: 'Thermostat Hobbyraum',
                schema: 'separate',
                temperature_state_topic:   'hm/status/Thermostat Hobbyraum:1/SET_POINT_TEMPERATURE',
                temperature_command_topic: 'hm/set/Thermostat Hobbyraum:1/SET_POINT_TEMPERATURE',
                mode_state_topic:          'hm/status/Thermostat Hobbyraum:1/SET_POINT_MODE',
                message_property: 'payload.val',
                valve_min: 0, valve_max: 1,
            },
        };

        const el = document.createElement('feezal-element-material-climate');
        const change = vi.fn();
        globalThis.feezal.app = {change};

        const ins = document.createElement('feezal-sidebar-inspector-attributes');
        ins.selectedElems = [el];
        ins.__discoveryEntities = [entity];

        // Simulate the sl-select emitting the percent-encoded option value.
        ins._onPickDiscovery(encodeURIComponent(entity.discovery_id));

        // _applyDiscovery ran → attributes stamped, discovery-id preserves the space.
        expect(el.getAttribute('discovery-id')).toBe('hm-climate:Thermostat Hobbyraum');
        expect(el.getAttribute('subscribe-setpoint')).toBe('hm/status/Thermostat Hobbyraum:1/SET_POINT_TEMPERATURE');
        expect(el.getAttribute('message-property')).toBe('payload.val');
        expect(change).toHaveBeenCalled();
    });

    it('_discoveryOptionLabel: "hm: <name>" for a homematic-source entity, topic for an HA entity', () => {
        const ins = document.createElement('feezal-sidebar-inspector-attributes');

        // Native homematic entity → source-prefixed label.
        expect(ins._discoveryOptionLabel({
            sourceLabel: 'hm',
            name: 'Thermostat Hobbyraum',
            config: {current_temperature_topic: 'hm/status/Thermostat Hobbyraum:1/ACTUAL_TEMPERATURE'},
        })).toBe('hm: Thermostat Hobbyraum');

        // sourceLabel with no name falls back to just the label.
        expect(ins._discoveryOptionLabel({sourceLabel: 'hm'})).toBe('hm');

        // HA entity (no sourceLabel) → unchanged topic-preferring behaviour.
        expect(ins._discoveryOptionLabel({
            name: 'switch',
            config: {state_topic: 'home/lamp/state'},
        })).toBe('home/lamp/state');
    });
});

describe('WP3/E106 — type:custom rendering + change routing', () => {
    it('renders <x-test-panel> in the panel with .element set, and routes its change through the commit path', async () => {
        const host = document.createElement('x-custom-host');
        document.body.append(host);
        const change = vi.fn();
        globalThis.feezal.app = {change};

        const ins = document.createElement('feezal-sidebar-inspector-attributes');
        document.body.append(ins);
        ins.selectedElems = [host];
        await ins.updateComplete;
        // _rebuildItems() runs in updated() and sets this.items, scheduling a
        // second update — wait for that render too.
        await ins.updateComplete;

        const panel = ins.shadowRoot.querySelector('x-test-panel');
        expect(panel).toBeTruthy();
        expect(panel.element).toBe(host);

        // Emit the N6 protocol — the inspector must write the attribute onto the
        // selected element and mark the change (dirty + undo history).
        panel.stamp('publish', 'home/thermostat/set');
        expect(host.getAttribute('publish')).toBe('home/thermostat/set');
        expect(change).toHaveBeenCalledTimes(1);

        // A batch stamp of several attributes routes each through the same path
        // (per-attribute commit — one history entry each, acceptable for now).
        change.mockClear();
        panel.stamp('subscribe', 'home/thermostat/state');
        panel.stamp('mode', 'b');
        expect(host.getAttribute('subscribe')).toBe('home/thermostat/state');
        expect(host.getAttribute('mode')).toBe('b');
        expect(change).toHaveBeenCalledTimes(2);

        document.body.innerHTML = '';
    });
});

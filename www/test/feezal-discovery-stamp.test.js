import {describe, it, expect, beforeAll} from 'vitest';

import {
    valueTemplateLeaf,
    stampDiscovery,
    resolveElementTag,
    layoutGrid,
    knownComponents,
    discoveryLabel,
} from '../src/feezal-discovery-stamp.js';

// A minimal registered element exercising every stamp transform.
class StampFixture extends HTMLElement {
    static feezal = {
        discovery: {
            map: {
                state_topic: 'subscribe-state',
                command_topic: {attr: 'publish'},
                value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
                supported_color_modes: {attr: 'mode', transform: 'colorMode'},
                temperature_unit: {attr: 'unit', valueMap: {C: 'celsius', F: 'fahrenheit', _default: 'celsius'}},
                max_mireds: {attr: 'color-temp-max', unit: 'mired→kelvin'},
                options: {attr: 'options', transform: 'join'},
                pct_topic: {attr: 'pct', onlyWhen: {device_class: 'humidity'}},
            },
        },
        attributes: [{name: 'subscribe-battery-low'}],
    };
}

beforeAll(() => {
    if (!customElements.get('feezal-test-stampfixture')) {
        customElements.define('feezal-test-stampfixture', StampFixture);
    }
});

describe('valueTemplateLeaf', () => {
    it('parses dot form', () => expect(valueTemplateLeaf('{{ value_json.temperature }}')).toBe('temperature'));
    it('parses bracket form', () => expect(valueTemplateLeaf('{{ value_json["state"] }}')).toBe('state'));
    it('returns empty for complex/unsupported', () => {
        expect(valueTemplateLeaf('{{ value_json.a.b }}')).toBe('');
        expect(valueTemplateLeaf('')).toBe('');
        expect(valueTemplateLeaf(undefined)).toBe('');
    });
});

describe('stampDiscovery', () => {
    const stamp = cfg => {
        const el = document.createElement('feezal-test-stampfixture');
        const ok = stampDiscovery(el, {config: cfg, discovery_id: 'dev-1'});
        return {el, ok};
    };

    it('applies plain + object attr mappings and the discovery-id', () => {
        const {el, ok} = stamp({state_topic: 'a/state', command_topic: 'a/set'});
        expect(ok).toBe(true);
        expect(el.getAttribute('subscribe-state')).toBe('a/state');
        expect(el.getAttribute('publish')).toBe('a/set');
        expect(el.getAttribute('discovery-id')).toBe('dev-1');
    });

    it('converts value_template to a payload path, skipping unsupported ones', () => {
        expect(stamp({value_template: '{{ value_json.state }}'}).el.getAttribute('message-property')).toBe('payload.state');
        expect(stamp({value_template: '{{ value_json.a.b }}'}).el.hasAttribute('message-property')).toBe(false);
    });

    it('maps colour modes to a single centre control', () => {
        expect(stamp({supported_color_modes: ['color_temp']}).el.getAttribute('mode')).toBe('brightness_ct');
        expect(stamp({supported_color_modes: ['onoff']}).el.getAttribute('mode')).toBe('on_off');
        expect(stamp({supported_color_modes: ['rgbw', 'color_temp']}).el.getAttribute('mode')).toBe('rgb');
    });

    it('applies valueMap (with _default), mired→kelvin and join', () => {
        expect(stamp({temperature_unit: 'F'}).el.getAttribute('unit')).toBe('fahrenheit');
        expect(stamp({temperature_unit: 'K'}).el.getAttribute('unit')).toBe('celsius'); // _default
        expect(stamp({max_mireds: 500}).el.getAttribute('color-temp-max')).toBe('2000'); // 1e6/500
        expect(stamp({options: ['a', 'b']}).el.getAttribute('options')).toBe('a,b');
    });

    it('honours the onlyWhen guard', () => {
        expect(stamp({pct_topic: 'a/pct', device_class: 'humidity'}).el.getAttribute('pct')).toBe('a/pct');
        expect(stamp({pct_topic: 'a/pct', device_class: 'temperature'}).el.hasAttribute('pct')).toBe(false);
    });

    it('stamps normalized availability (plain vs JSON) and low-battery', () => {
        const plain = stamp({availability_normalized: {entries: [{topic: 'a/avail'}], mode: 'all'}}).el;
        expect(plain.getAttribute('subscribe-availability')).toBe('a/avail');

        const rich = stamp({availability_normalized: {entries: [{topic: 'a/avail', property: 'x'}], mode: 'any', payloadAvailable: '1', payloadUnavailable: '0'}}).el;
        expect(JSON.parse(rich.getAttribute('subscribe-availability'))).toHaveLength(1);
        expect(rich.getAttribute('availability-mode')).toBe('any');
        expect(rich.getAttribute('payload-available')).toBe('1');

        const batt = stamp({battery_low_normalized: {topic: 'a/batt', property: 'low', payloadLow: 'yes'}}).el;
        expect(batt.getAttribute('subscribe-battery-low')).toBe('a/batt');
        expect(batt.getAttribute('message-property-battery-low')).toBe('low');
    });

    it('returns false when the element declares no discovery map', () => {
        const el = document.createElement('div');
        expect(stampDiscovery(el, {config: {}})).toBe(false);
    });
});

describe('resolveElementTag', () => {
    // Pretend only the circle family + a couple of glass elements exist.
    const registered = new Set([
        'feezal-element-circle-light', 'feezal-element-circle-switch',
        'feezal-element-circle-climate', 'feezal-element-circle-contact',
        'feezal-element-circle-motion', 'feezal-element-circle-sensor',
        'feezal-element-circle-value', 'feezal-element-circle-wled',
        'feezal-element-glass-light', 'feezal-element-glass-switch',
    ]);
    const isReg = tag => registered.has(tag);

    it('resolves simple 1:1 components', () => {
        expect(resolveElementTag('light', 'circle', undefined, isReg)).toBe('feezal-element-circle-light');
        expect(resolveElementTag('switch', 'circle', undefined, isReg)).toBe('feezal-element-circle-switch');
        expect(resolveElementTag('wled', 'circle', undefined, isReg)).toBe('feezal-element-circle-wled');
    });

    it('routes binary_sensor by device_class', () => {
        expect(resolveElementTag('binary_sensor', 'circle', 'motion', isReg)).toBe('feezal-element-circle-motion');
        expect(resolveElementTag('binary_sensor', 'circle', 'door', isReg)).toBe('feezal-element-circle-contact');
        expect(resolveElementTag('binary_sensor', 'circle', 'smoke', isReg)).toBe('feezal-element-circle-sensor');
        // unknown device_class → contact default
        expect(resolveElementTag('binary_sensor', 'circle', 'weird', isReg)).toBe('feezal-element-circle-contact');
    });

    it('falls through sensor candidates (sensor → value)', () => {
        const noSensor = tag => registered.has(tag) && tag !== 'feezal-element-circle-sensor';
        expect(resolveElementTag('sensor', 'circle', undefined, noSensor)).toBe('feezal-element-circle-value');
    });

    it('returns null for a family parity gap', () => {
        expect(resolveElementTag('climate', 'glass', undefined, isReg)).toBeNull(); // glass-climate not registered here
        expect(resolveElementTag('vacuum', 'circle', undefined, isReg)).toBeNull();
    });

    it('returns null for an unknown component', () => {
        expect(resolveElementTag('lawnmower', 'circle', undefined, isReg)).toBeNull();
    });
});

describe('layoutGrid', () => {
    it('packs into rows that fit the view width', () => {
        const pos = layoutGrid(5, {cellW: 100, cellH: 80, viewWidth: 400, gapX: 16, gapY: 16, padX: 16, padY: 16});
        expect(pos).toHaveLength(5);
        // usable = 400-32 = 368; cols = floor((368+16)/(100+16)) = floor(384/116) = 3
        expect(pos[0]).toEqual({left: 16, top: 16});
        expect(pos[2].top).toBe(16);          // still first row
        expect(pos[3].left).toBe(16);         // wrapped to a new row
        expect(pos[3].top).toBe(16 + 80 + 16);
    });

    it('always yields at least one column for a narrow view', () => {
        const pos = layoutGrid(3, {cellW: 300, cellH: 100, viewWidth: 120});
        expect(pos.map(p => p.left)).toEqual([16, 16, 16]);
    });

    it('returns an empty array for zero elements', () => {
        expect(layoutGrid(0, {})).toEqual([]);
    });
});

describe('discoveryLabel', () => {
    it('reads "<source>: <name>" for a native-recognizer entity', () => {
        expect(discoveryLabel({sourceLabel: 'hm', name: 'Living switch'})).toBe('hm: Living switch');
        expect(discoveryLabel({sourceLabel: 'WLED'})).toBe('WLED');
    });

    it('appends the z2m attribute so multi-entry devices are distinguishable', () => {
        const temp = discoveryLabel({component: 'sensor', config: {state_topic: 'zigbee2mqtt/sensor_1', value_template: '{{ value_json.temperature }}'}});
        const humi = discoveryLabel({component: 'sensor', config: {state_topic: 'zigbee2mqtt/sensor_1', value_template: '{{ value_json.humidity }}'}});
        expect(temp).toBe('zigbee2mqtt/sensor_1 temperature');
        expect(humi).toBe('zigbee2mqtt/sensor_1 humidity');
        expect(temp).not.toBe(humi);
    });

    it('leaves a single-attribute device label unadorned', () => {
        expect(discoveryLabel({component: 'switch', config: {state_topic: 'a/state'}})).toBe('a/state');
    });
});

describe('knownComponents', () => {
    it('includes the core generatable components', () => {
        const c = knownComponents();
        for (const comp of ['light', 'switch', 'climate', 'cover', 'sensor', 'binary_sensor', 'wled']) {
            expect(c).toContain(comp);
        }
    });
});

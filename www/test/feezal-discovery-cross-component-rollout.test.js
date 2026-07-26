/**
 * E157 — rolling the E156 cross-component mechanism out to the rest of the
 * controls.
 *
 * E156 built `discovery.accepts` but applied it only to the 8 *-switch and 3
 * *-slider elements. Three groups were left behind, and each brings its own
 * wrinkle rather than being more of the same:
 *
 *   1. The 4 *-checkbox + material-chip already consume `switch`, so they take
 *      the shared light fragment verbatim — EXCEPT `paper-checkbox`, which
 *      reads from `topic`, not `subscribe`. That one key is parameterised;
 *      everything else stays shared, which is what this file pins.
 *   2. `panel-knob` is a slider with a different gesture. It gains the light
 *      axes but must KEEP its own `number` map — the slider's drops
 *      `unit_of_measurement`, which the knob displays.
 *   3. `material-tank` / `material-progress` are the mirror image of the
 *      slider's guardrail: read-only displays that must be offered a value to
 *      show and never a topic that would let them command the device.
 *
 * The hardest-pinned property here is (3): a read-only display handed a
 * settable `number` must come out with NO publish attribute at all.
 */
import {describe, it, expect, beforeAll} from 'vitest';
import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

import {
    elementAcceptsComponent, acceptedComponents, discoveryCandidates,
    discoveryVariantsFor, stampDiscovery,
} from '../src/feezal-discovery-stamp.js';
import {
    switchAcceptsLight, makeSwitchAcceptsLight, lightSettableAxes,
    sliderDiscovery, readonlyNumericDiscovery,
} from '@feezal/feezal-element/feezal-discovery-fragments.js';

const packagesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', '@feezal');

// Fixtures mirroring the three real descriptor shapes (the element modules
// themselves pull in md-*/carbon web components, which cannot instantiate
// under happy-dom — same reason the E156 suite uses fixtures).
class CheckboxFixture extends HTMLElement {
    static feezal = {
        attributes: [{name: 'label'}],
        discovery: {
            component: 'switch',
            accepts: [switchAcceptsLight],
            map: {
                state_topic: 'subscribe', command_topic: 'publish',
                payload_on: 'payload-on', payload_off: 'payload-off', name: 'label',
            },
        },
    };
}

class PaperCheckboxFixture extends HTMLElement {
    static feezal = {
        attributes: [{name: 'label'}],
        discovery: {
            component: 'switch',
            accepts: [makeSwitchAcceptsLight({subscribe: 'topic'})],
            map: {
                state_topic: 'topic', command_topic: 'publish',
                payload_on: 'payload-on', payload_off: 'payload-off', name: 'label',
            },
        },
    };
}

class KnobFixture extends HTMLElement {
    static feezal = {
        attributes: [{name: 'label'}],
        discovery: {
            component: 'number',
            accepts: lightSettableAxes,
            map: {
                state_topic: 'subscribe', command_topic: 'publish',
                min: 'min', max: 'max', step: 'step', name: 'label',
                unit_of_measurement: 'unit',
            },
        },
    };
}

class ReadonlyFixture extends HTMLElement {
    static feezal = {attributes: [{name: 'label'}], discovery: readonlyNumericDiscovery};
}

beforeAll(() => {
    const define = (tag, cls) => {
        if (!customElements.get(tag)) customElements.define(tag, cls);
    };
    define('feezal-test-e157-checkbox', CheckboxFixture);
    define('feezal-test-e157-paper-checkbox', PaperCheckboxFixture);
    define('feezal-test-e157-knob', KnobFixture);
    define('feezal-test-e157-readonly', ReadonlyFixture);
});

const entity = (component, config, id = 'dev-1') => ({component, config, discovery_id: id, name: config.name});
const stamp = (tag, ent, variant = null) => {
    const el = document.createElement(tag);
    stampDiscovery(el, ent, variant);
    return el;
};
const attrs = el => Object.fromEntries([...el.attributes].map(a => [a.name, a.value]));

// ── 1. on/off controls ──────────────────────────────────────────────────────
describe('a light offered to a checkbox / chip', () => {
    it('accepts light alongside switch', () => {
        const cls = customElements.get('feezal-test-e157-checkbox');
        expect(acceptedComponents(cls)).toEqual(['switch', 'light']);
        expect(elementAcceptsComponent(cls, 'sensor')).toBe(false);
    });

    it('wires a zigbee on/off light', () => {
        const el = stamp('feezal-test-e157-checkbox', entity('light', {
            name: 'Küchenlampe',
            state_topic: 'zigbee2mqtt/lamp', command_topic: 'zigbee2mqtt/lamp/set',
            payload_on: 'ON', payload_off: 'OFF',
        }));
        expect(attrs(el)).toMatchObject({
            subscribe: 'zigbee2mqtt/lamp',
            publish: 'zigbee2mqtt/lamp/set',
            'payload-on': 'ON',
            'payload-off': 'OFF',
        });
    });

    it('drives a Homematic dimmer with 1/0, not the 1.005 OLD_LEVEL sentinel', () => {
        // The order-sensitive branch of the shared fragment, re-pinned here:
        // these elements inherit it, so a reorder must fail here too.
        const el = stamp('feezal-test-e157-checkbox', entity('light', {
            name: 'Flurlicht',
            on_off_source: 'brightness',
            payload_on: '1.005', payload_off: '0',
            brightness_state_topic: 'hm/status/Flur:1/LEVEL',
            brightness_command_topic: 'hm/set/Flur:1/LEVEL',
        }));
        expect(attrs(el)).toMatchObject({
            subscribe: 'hm/status/Flur:1/LEVEL',
            publish: 'hm/set/Flur:1/LEVEL',
            'payload-on': '1',
            'payload-off': '0',
        });
    });

    it('a plain switch entity still uses the element\'s own map', () => {
        const el = stamp('feezal-test-e157-checkbox', entity('switch', {
            name: 'Steckdose', state_topic: 'stat/plug', command_topic: 'cmnd/plug',
        }));
        expect(attrs(el)).toMatchObject({subscribe: 'stat/plug', publish: 'cmnd/plug'});
    });
});

describe('paper-checkbox reads from `topic`, not `subscribe`', () => {
    it('wires the light\'s state topic to `topic`', () => {
        const el = stamp('feezal-test-e157-paper-checkbox', entity('light', {
            state_topic: 'zigbee2mqtt/lamp', command_topic: 'zigbee2mqtt/lamp/set',
            payload_on: 'ON', payload_off: 'OFF',
        }));
        expect(attrs(el)).toMatchObject({topic: 'zigbee2mqtt/lamp', publish: 'zigbee2mqtt/lamp/set'});
        expect(el.hasAttribute('subscribe')).toBe(false);
    });

    it('routes the Homematic branch to `topic` as well', () => {
        const el = stamp('feezal-test-e157-paper-checkbox', entity('light', {
            on_off_source: 'brightness',
            payload_on: '1.005', payload_off: '0',
            brightness_state_topic: 'hm/status/Flur:1/LEVEL',
            brightness_command_topic: 'hm/set/Flur:1/LEVEL',
        }));
        expect(attrs(el)).toMatchObject({
            topic: 'hm/status/Flur:1/LEVEL',
            publish: 'hm/set/Flur:1/LEVEL',
            'payload-on': '1',
        });
        expect(el.hasAttribute('subscribe')).toBe(false);
    });

    it('the default spelling is untouched — the 8 switches keep `subscribe`', () => {
        expect(switchAcceptsLight.map.state_topic).toBe('subscribe');
        expect(switchAcceptsLight.map.brightness_state_topic.attr).toBe('subscribe');
    });
});

// ── 2. panel-knob ───────────────────────────────────────────────────────────
describe('panel-knob — light axes without losing its own number map', () => {
    const knob = () => customElements.get('feezal-test-e157-knob');

    it('accepts number and light', () => {
        expect(acceptedComponents(knob()).sort()).toEqual(['light', 'number']);
    });

    it('keeps `unit_of_measurement` on a number entity (the slider map drops it)', () => {
        const el = stamp('feezal-test-e157-knob', entity('number', {
            name: 'Zielwert', state_topic: 'stat/n', command_topic: 'cmnd/n',
            min: 5, max: 35, step: 0.5, unit_of_measurement: '°C',
        }));
        expect(attrs(el)).toMatchObject({
            subscribe: 'stat/n', publish: 'cmnd/n', min: '5', max: '35', step: '0.5', unit: '°C',
        });
        // The regression this guards: the slider's `number` variant has no unit.
        const sliderNumber = sliderDiscovery.accepts.find(a => a.component === 'number');
        expect(sliderNumber.map.unit_of_measurement).toBeUndefined();
    });

    it('offers one row per settable light axis', () => {
        const rows = discoveryCandidates(knob(), [entity('light', {
            name: 'Wohnzimmer',
            brightness_state_topic: 'z/wz/brightness', brightness_command_topic: 'z/wz/set/brightness',
            brightness_scale: 254,
            color_temp_state_topic: 'z/wz/ct', color_temp_command_topic: 'z/wz/set/ct',
            min_mireds: 153, max_mireds: 500,
        })]);
        expect(rows.map(r => r.label)).toEqual([
            expect.stringContaining('brightness'),
            expect.stringContaining('color temp'),
        ]);
        const el = stamp('feezal-test-e157-knob', rows[0].entity, rows[0].variant);
        expect(attrs(el)).toMatchObject({
            subscribe: 'z/wz/brightness', publish: 'z/wz/set/brightness', max: '254',
        });
    });

    it('inherits the settable-only guardrail — a relay lamp is not offered', () => {
        expect(discoveryCandidates(knob(), [entity('light', {
            state_topic: 'stat/relay', command_topic: 'cmnd/relay',
            supported_color_modes: ['onoff'],
        })])).toEqual([]);
    });
});

// ── 3. read-only numeric displays ───────────────────────────────────────────
describe('read-only displays — the mirror-image guardrail', () => {
    const ro = () => customElements.get('feezal-test-e157-readonly');

    it('accepts sensor, number and light; nothing else', () => {
        expect(acceptedComponents(ro())).toEqual(['sensor', 'number', 'light']);
        expect(elementAcceptsComponent(ro(), 'switch')).toBe(false);
        expect(elementAcceptsComponent(ro(), 'cover')).toBe(false);
    });

    it('has no base component — every match arrives via accepts', () => {
        expect(readonlyNumericDiscovery.component).toBeUndefined();
    });

    it('wires a sensor with its unit', () => {
        const rows = discoveryCandidates(ro(), [entity('sensor', {
            name: 'Füllstand', state_topic: 'stat/tank', unit_of_measurement: '%',
        })]);
        expect(rows).toHaveLength(1);
        const el = stamp('feezal-test-e157-readonly', rows[0].entity, rows[0].variant);
        expect(attrs(el)).toMatchObject({subscribe: 'stat/tank', unit: '%'});
        expect(el.hasAttribute('publish')).toBe(false);
    });

    it('NEVER wires a command topic, even when the number has one', () => {
        // The guardrail proper: a settable number is still only ever READ here.
        const el = stamp('feezal-test-e157-readonly', entity('number', {
            name: 'Zielwert', state_topic: 'stat/n', command_topic: 'cmnd/n',
            min: 0, max: 250, unit_of_measurement: 'l',
        }));
        expect(attrs(el)).toMatchObject({subscribe: 'stat/n', min: '0', max: '250', unit: 'l'});
        expect(el.hasAttribute('publish')).toBe(false);
        // and no variant map in the fragment mentions a command topic at all
        for (const variant of readonlyNumericDiscovery.accepts) {
            expect(Object.keys(variant.map).some(k => k.includes('command_topic'))).toBe(false);
        }
    });

    it('offers a light\'s brightness as a read-only level', () => {
        const rows = discoveryCandidates(ro(), [entity('light', {
            name: 'Wohnzimmer',
            brightness_state_topic: 'z/wz/brightness',
            brightness_command_topic: 'z/wz/set/brightness',
            brightness_scale: 254,
        })]);
        expect(rows).toHaveLength(1);
        expect(rows[0].label).toContain('brightness');
        const el = stamp('feezal-test-e157-readonly', rows[0].entity, rows[0].variant);
        expect(attrs(el)).toMatchObject({subscribe: 'z/wz/brightness', max: '254'});
        expect(el.hasAttribute('publish')).toBe(false);
    });

    it('is not offered a value it cannot read', () => {
        // A command-only light (no brightness state) has nothing to display.
        const writeOnly = entity('light', {brightness_command_topic: 'cmnd/b'});
        expect(discoveryCandidates(ro(), [writeOnly])).toEqual([]);
        expect(discoveryVariantsFor(ro(), writeOnly)).toEqual([]);
    });
});

// ── parity guard ────────────────────────────────────────────────────────────
// The fixtures above prove the fragments behave; this proves the real elements
// actually use them. Static source check, because the element modules import
// md-*/carbon web components that cannot load under happy-dom.
describe('every rolled-out element declares the shared fragment', () => {
    const cases = [
        ['feezal-element-material-checkbox', 'switchAcceptsLight'],
        ['feezal-element-carbon-checkbox',   'switchAcceptsLight'],
        ['feezal-element-tui-checkbox',      'switchAcceptsLight'],
        ['feezal-element-material-chip',     'switchAcceptsLight'],
        ['feezal-element-paper-checkbox',    'makeSwitchAcceptsLight'],
        ['feezal-element-panel-knob',        'lightSettableAxes'],
        ['feezal-element-material-tank',     'readonlyNumericDiscovery'],
        ['feezal-element-material-progress', 'readonlyNumericDiscovery'],
    ];

    it.each(cases)('%s uses %s', (pkg, fragment) => {
        const src = readFileSync(join(packagesDir, pkg, `${pkg}.js`), 'utf8');
        expect(src).toContain(`import {${fragment}}`);
        expect(src).toContain('feezal-discovery-fragments.js');
        // and it is actually reachable from the descriptor, not just imported
        expect(/accepts:|discovery: readonlyNumericDiscovery/.test(src)).toBe(true);
    });
});

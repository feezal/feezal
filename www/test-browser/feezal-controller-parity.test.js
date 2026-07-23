/**
 * E137/E114 — controller-contract parity.
 *
 * Every family element that adopts a shared controller must declare the
 * controller's full attribute contract in its `feezal.attributes` — the
 * parity set is DERIVED from the controller package's *_CONSUMED_ATTRIBUTES
 * declaration, so adding an attribute to a controller fragment automatically
 * tightens this test for every adopting family.
 *
 * Documented per-family exclusions are allowed only where a family
 * legitimately does not support a capability (metro-climate has no json
 * payload mode — a constructor flag, not a fork).
 */
import {describe, it, expect} from 'vitest';
import {
    SENSOR_CONSUMED_ATTRIBUTES, sensorAttributes, sensorDiscoveryMap,
    sensorAttributesFor, sensorDiscoveryMapFor,
    MOTION_SENSOR_TYPES, ALARM_SENSOR_TYPES, SENSOR_TYPE_OPTIONS, SENSOR_DEVICE_CLASS_MAP,
    SensorController,
} from '@feezal/feezal-controller-sensor';
import {CONTACT_CONSUMED_ATTRIBUTES, CONTACT_ACTIVE_COLOR_VAR, ContactController} from '@feezal/feezal-controller-contact';
import {CLIMATE_CONSUMED_ATTRIBUTES} from '@feezal/feezal-controller-climate';
import {LIGHT_CONSUMED_ATTRIBUTES} from '@feezal/feezal-controller-light';
import {COVER_CONSUMED_ATTRIBUTES} from '@feezal/feezal-controller-cover';
import {WLED_CONSUMED_ATTRIBUTES} from '@feezal/feezal-controller-wled';
import '../packages/@feezal/feezal-element-circle-wled/feezal-element-circle-wled.js';
import '../packages/@feezal/feezal-element-glass-wled/feezal-element-glass-wled.js';
import '../packages/@feezal/feezal-element-metro-wled/feezal-element-metro-wled.js';
import '../packages/@feezal/feezal-element-eink-wled/feezal-element-eink-wled.js';
import '../packages/@feezal/feezal-element-circle-light/feezal-element-circle-light.js';
import '../packages/@feezal/feezal-element-circle-cover/feezal-element-circle-cover.js';
import '../packages/@feezal/feezal-element-glass-light/feezal-element-glass-light.js';
import '../packages/@feezal/feezal-element-metro-light/feezal-element-metro-light.js';
import '../packages/@feezal/feezal-element-eink-light/feezal-element-eink-light.js';
import '../packages/@feezal/feezal-element-circle-motion/feezal-element-circle-motion.js';
import '../packages/@feezal/feezal-element-glass-motion/feezal-element-glass-motion.js';
import '../packages/@feezal/feezal-element-glass-sensor/feezal-element-glass-sensor.js';
import '../packages/@feezal/feezal-element-metro-motion/feezal-element-metro-motion.js';
import '../packages/@feezal/feezal-element-metro-sensor/feezal-element-metro-sensor.js';
import '../packages/@feezal/feezal-element-circle-sensor/feezal-element-circle-sensor.js';
import '../packages/@feezal/feezal-element-eink-motion/feezal-element-eink-motion.js';
import '../packages/@feezal/feezal-element-circle-contact/feezal-element-circle-contact.js';
import '../packages/@feezal/feezal-element-glass-contact/feezal-element-glass-contact.js';
import '../packages/@feezal/feezal-element-metro-contact/feezal-element-metro-contact.js';
import '../packages/@feezal/feezal-element-circle-climate/feezal-element-circle-climate.js';
import '../packages/@feezal/feezal-element-glass-climate/feezal-element-glass-climate.js';
import '../packages/@feezal/feezal-element-metro-climate/feezal-element-metro-climate.js';
import '../packages/@feezal/feezal-element-eink-sensor/feezal-element-eink-sensor.js';
import '../packages/@feezal/feezal-element-eink-contact/feezal-element-eink-contact.js';
import '../packages/@feezal/feezal-element-eink-climate/feezal-element-eink-climate.js';
import '../packages/@feezal/feezal-element-metro-cover/feezal-element-metro-cover.js';
import '../packages/@feezal/feezal-element-glass-cover/feezal-element-glass-cover.js';
import '../packages/@feezal/feezal-element-eink-cover/feezal-element-eink-cover.js';

const CASES = [
    // E138: the boolean card is split into motion + alarm ('sensor') cards;
    // attribute NAMES are identical across slices, so one consumed set fits.
    {tag: 'feezal-element-circle-motion',  consumed: SENSOR_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-circle-sensor',  consumed: SENSOR_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-glass-motion',     consumed: SENSOR_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-glass-sensor',     consumed: SENSOR_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-metro-motion',     consumed: SENSOR_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-metro-sensor',     consumed: SENSOR_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-eink-motion',      consumed: SENSOR_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-circle-contact', consumed: CONTACT_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-glass-contact',    consumed: CONTACT_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-metro-contact',    consumed: CONTACT_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-circle-climate', consumed: CLIMATE_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-glass-climate',    consumed: CLIMATE_CONSUMED_ATTRIBUTES},
    // Metro has no json payload mode ({json: false} controller flag) — the
    // json-only attributes are deliberately not part of its contract.
    {tag: 'feezal-element-metro-climate',    consumed: CLIMATE_CONSUMED_ATTRIBUTES,
        except: ['payload-mode', 'publish', 'json-map']},
    // E57: the eink family consumes the controllers like every other family.
    {tag: 'feezal-element-eink-sensor',      consumed: SENSOR_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-eink-contact',     consumed: CONTACT_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-eink-climate',     consumed: CLIMATE_CONSUMED_ATTRIBUTES},
    // E137 light slice. material-outlet is deliberately NOT listed: it is the
    // capability-reduced on_off subset of material-light (E121/E122), not a
    // full light adopter.
    {tag: 'feezal-element-circle-light',   consumed: LIGHT_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-glass-light',      consumed: LIGHT_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-metro-light',      consumed: LIGHT_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-eink-light',       consumed: LIGHT_CONSUMED_ATTRIBUTES},
    // E137 cover slice — the adopters spread the controller fragment, no
    // exclusions.
    {tag: 'feezal-element-circle-cover',   consumed: COVER_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-glass-cover',      consumed: COVER_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-metro-cover',      consumed: COVER_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-eink-cover',       consumed: COVER_CONSUMED_ATTRIBUTES},
    // E137 wled slice — completes the decided v1 controller set.
    {tag: 'feezal-element-circle-wled',    consumed: WLED_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-glass-wled',       consumed: WLED_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-metro-wled',       consumed: WLED_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-eink-wled',        consumed: WLED_CONSUMED_ATTRIBUTES},
];

describe('E137 — adopting elements declare the full controller contract', () => {
    for (const {tag, consumed, except = []} of CASES) {
        it(`${tag} declares every consumed attribute`, () => {
            const cls = customElements.get(tag);
            expect(cls, `${tag} not defined`).toBeTruthy();
            const declared = new Set(cls.feezal.attributes.map(a => a.name));
            const missing = consumed.filter(n => !except.includes(n) && !declared.has(n));
            expect(missing).toEqual([]);
        });
    }

    it('the consumed sets themselves are non-trivial (derivation sanity)', () => {
        expect(SENSOR_CONSUMED_ATTRIBUTES.length).toBeGreaterThan(4);
        expect(CONTACT_CONSUMED_ATTRIBUTES).toContain('subscribe-battery-low');
        expect(CLIMATE_CONSUMED_ATTRIBUTES).toContain('subscribe-boost-state');
    });
});

// ── E138 groundwork: motion/alarm slice split of the sensor vocabulary ────────
const typeOptions = frag => frag.find(a => a.name === 'type').options;
const typeDefault = frag => frag.find(a => a.name === 'type').default;
function stubHost(attrs = {}) {
    return {getAttribute: n => (n in attrs ? attrs[n] : null), addController() {}};
}

describe('E138 — sensor vocabulary slices', () => {
    it('slice fragments carry only their slice type options + the right default', () => {
        expect(typeOptions(sensorAttributesFor('motion'))).toEqual(MOTION_SENSOR_TYPES);
        expect(typeDefault(sensorAttributesFor('motion'))).toBe('motion');
        expect(typeOptions(sensorAttributesFor('alarm'))).toEqual(ALARM_SENSOR_TYPES);
        expect(typeDefault(sensorAttributesFor('alarm'))).toBe('generic');
        // The two slices partition the full vocabulary, no overlap.
        expect([...MOTION_SENSOR_TYPES, ...ALARM_SENSOR_TYPES].sort())
            .toEqual([...SENSOR_TYPE_OPTIONS].sort());
        expect(MOTION_SENSOR_TYPES.some(t => ALARM_SENSOR_TYPES.includes(t))).toBe(false);
    });

    it('slice discovery maps route device_class within their slice, right _defaults', () => {
        const motion = sensorDiscoveryMapFor('motion').device_class.valueMap;
        expect(motion).toEqual({motion: 'motion', occupancy: 'presence', presence: 'presence', _default: 'motion'});
        const alarm = sensorDiscoveryMapFor('alarm').device_class.valueMap;
        expect(alarm._default).toBe('generic');
        expect(alarm.moisture).toBe('water-leak');
        expect(alarm.smoke).toBe('smoke');
        expect(alarm.carbon_monoxide).toBe('co');
        // Every mapped type stays inside its slice's option list.
        for (const t of Object.values(motion)) if (t !== undefined) expect(MOTION_SENSOR_TYPES).toContain(t);
        for (const [k, t] of Object.entries(alarm)) if (k !== '_default') expect(ALARM_SENSOR_TYPES).toContain(t);
    });

    it("the 'all' exports are unchanged (current cards keep the full vocabulary)", () => {
        expect(typeOptions(sensorAttributes)).toEqual(SENSOR_TYPE_OPTIONS);
        expect(typeDefault(sensorAttributes)).toBe('motion');
        // Identity preserved — the sensor-card test asserts this valueMap by ref.
        expect(sensorDiscoveryMap.device_class.valueMap).toBe(SENSOR_DEVICE_CLASS_MAP);
        expect(sensorDiscoveryMapFor('all').device_class.valueMap).toBe(SENSOR_DEVICE_CLASS_MAP);
    });

    it('active-state colour vars come from one shared definition', () => {
        expect(new SensorController(stubHost({type: 'motion'})).activeColorVar()).toBe('--accent-color');
        expect(new SensorController(stubHost({type: 'presence'})).activeColorVar()).toBe('--accent-color');
        expect(new SensorController(stubHost({type: 'smoke'})).activeColorVar()).toBe('--error-color');
        expect(new SensorController(stubHost({type: 'water-leak'})).activeColorVar()).toBe('--error-color');
        // No type set → the controller's 'motion' fallback → accent.
        expect(new SensorController(stubHost()).activeColorVar()).toBe('--accent-color');
        // Contact open/tilted → primary.
        expect(CONTACT_ACTIVE_COLOR_VAR).toBe('--primary-color');
        expect(new ContactController(stubHost()).activeColorVar()).toBe('--primary-color');
    });
});

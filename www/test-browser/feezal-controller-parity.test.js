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
import {SENSOR_CONSUMED_ATTRIBUTES} from '@feezal/feezal-controller-sensor';
import {CONTACT_CONSUMED_ATTRIBUTES} from '@feezal/feezal-controller-contact';
import {CLIMATE_CONSUMED_ATTRIBUTES} from '@feezal/feezal-controller-climate';
import '../packages/@feezal/feezal-element-material-motion/feezal-element-material-motion.js';
import '../packages/@feezal/feezal-element-glass-occupancy/feezal-element-glass-occupancy.js';
import '../packages/@feezal/feezal-element-metro-occupancy/feezal-element-metro-occupancy.js';
import '../packages/@feezal/feezal-element-material-contact/feezal-element-material-contact.js';
import '../packages/@feezal/feezal-element-glass-contact/feezal-element-glass-contact.js';
import '../packages/@feezal/feezal-element-metro-contact/feezal-element-metro-contact.js';
import '../packages/@feezal/feezal-element-material-climate/feezal-element-material-climate.js';
import '../packages/@feezal/feezal-element-glass-climate/feezal-element-glass-climate.js';
import '../packages/@feezal/feezal-element-metro-climate/feezal-element-metro-climate.js';

const CASES = [
    {tag: 'feezal-element-material-motion',  consumed: SENSOR_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-glass-occupancy',  consumed: SENSOR_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-metro-occupancy',  consumed: SENSOR_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-material-contact', consumed: CONTACT_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-glass-contact',    consumed: CONTACT_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-metro-contact',    consumed: CONTACT_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-material-climate', consumed: CLIMATE_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-glass-climate',    consumed: CLIMATE_CONSUMED_ATTRIBUTES},
    // Metro has no json payload mode ({json: false} controller flag) — the
    // json-only attributes are deliberately not part of its contract.
    {tag: 'feezal-element-metro-climate',    consumed: CLIMATE_CONSUMED_ATTRIBUTES,
        except: ['payload-mode', 'publish', 'json-map']},
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

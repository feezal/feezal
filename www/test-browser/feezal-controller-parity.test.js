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
import {LIGHT_CONSUMED_ATTRIBUTES} from '@feezal/feezal-controller-light';
import {COVER_CONSUMED_ATTRIBUTES} from '@feezal/feezal-controller-cover';
import '../packages/@feezal/feezal-element-material-light/feezal-element-material-light.js';
import '../packages/@feezal/feezal-element-material-cover/feezal-element-material-cover.js';
import '../packages/@feezal/feezal-element-glass-light/feezal-element-glass-light.js';
import '../packages/@feezal/feezal-element-metro-light/feezal-element-metro-light.js';
import '../packages/@feezal/feezal-element-eink-light/feezal-element-eink-light.js';
import '../packages/@feezal/feezal-element-material-motion/feezal-element-material-motion.js';
import '../packages/@feezal/feezal-element-glass-occupancy/feezal-element-glass-occupancy.js';
import '../packages/@feezal/feezal-element-metro-occupancy/feezal-element-metro-occupancy.js';
import '../packages/@feezal/feezal-element-material-contact/feezal-element-material-contact.js';
import '../packages/@feezal/feezal-element-glass-contact/feezal-element-glass-contact.js';
import '../packages/@feezal/feezal-element-metro-contact/feezal-element-metro-contact.js';
import '../packages/@feezal/feezal-element-material-climate/feezal-element-material-climate.js';
import '../packages/@feezal/feezal-element-glass-climate/feezal-element-glass-climate.js';
import '../packages/@feezal/feezal-element-metro-climate/feezal-element-metro-climate.js';
import '../packages/@feezal/feezal-element-eink-sensor/feezal-element-eink-sensor.js';
import '../packages/@feezal/feezal-element-eink-contact/feezal-element-eink-contact.js';
import '../packages/@feezal/feezal-element-eink-climate/feezal-element-eink-climate.js';
import '../packages/@feezal/feezal-element-metro-cover/feezal-element-metro-cover.js';
import '../packages/@feezal/feezal-element-glass-cover/feezal-element-glass-cover.js';
import '../packages/@feezal/feezal-element-eink-cover/feezal-element-eink-cover.js';

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
    // E57: the eink family consumes the controllers like every other family.
    {tag: 'feezal-element-eink-sensor',      consumed: SENSOR_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-eink-contact',     consumed: CONTACT_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-eink-climate',     consumed: CLIMATE_CONSUMED_ATTRIBUTES},
    // E137 light slice. material-outlet is deliberately NOT listed: it is the
    // capability-reduced on_off subset of material-light (E121/E122), not a
    // full light adopter.
    {tag: 'feezal-element-material-light',   consumed: LIGHT_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-glass-light',      consumed: LIGHT_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-metro-light',      consumed: LIGHT_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-eink-light',       consumed: LIGHT_CONSUMED_ATTRIBUTES},
    // E137 cover slice — the adopters spread the controller fragment, no
    // exclusions.
    {tag: 'feezal-element-material-cover',   consumed: COVER_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-glass-cover',      consumed: COVER_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-metro-cover',      consumed: COVER_CONSUMED_ATTRIBUTES},
    {tag: 'feezal-element-eink-cover',       consumed: COVER_CONSUMED_ATTRIBUTES},
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

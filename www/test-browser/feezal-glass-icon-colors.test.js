/**
 * E140 — per-state icon colour parity for the Glass family. The ON/active side
 * was already exposed (--feezal-glass-accent / -active-color), but the INACTIVE
 * side (off / inactive / closed / clear) previously fell back to the *unexposed*
 * shared --feezal-glass-muted, so it wasn't per-element settable. Each glass
 * state-icon element now exposes a dedicated inactive-state icon-colour var.
 */
import {describe, it, expect} from 'vitest';
import '../packages/@feezal/feezal-element-glass-switch/feezal-element-glass-switch.js';
import '../packages/@feezal/feezal-element-glass-button/feezal-element-glass-button.js';
import '../packages/@feezal/feezal-element-glass-light/feezal-element-glass-light.js';
import '../packages/@feezal/feezal-element-glass-contact/feezal-element-glass-contact.js';
import '../packages/@feezal/feezal-element-glass-sensor/feezal-element-glass-sensor.js';
import '../packages/@feezal/feezal-element-glass-motion/feezal-element-glass-motion.js';

const styleProps = tag => new Set(
    customElements.get(tag).feezal.styles.filter(s => typeof s === 'object' && s.property).map(s => s.property));
const defaultOf = (tag, prop) =>
    customElements.get(tag).feezal.styles.find(s => s?.property === prop)?.default;

// element → [inactive-state var, active-state var (already exposed)]
const CASES = {
    'feezal-element-glass-switch':  ['--feezal-glass-off-color', '--feezal-glass-accent'],
    'feezal-element-glass-button':  ['--feezal-glass-inactive-color', '--feezal-glass-accent'],
    'feezal-element-glass-light':   ['--feezal-glass-off-color', '--feezal-glass-accent'],
    'feezal-element-glass-contact': ['--feezal-glass-closed-color', '--feezal-glass-open-color'],
    'feezal-element-glass-sensor':  ['--feezal-glass-clear-color', '--feezal-glass-active-color'],
    'feezal-element-glass-motion':  ['--feezal-glass-clear-color', '--feezal-glass-active-color'],
};

describe('E140 — glass per-state icon colour vars', () => {
    for (const [tag, [inactive, active]] of Object.entries(CASES)) {
        it(`${tag} exposes both ${inactive} and ${active}`, () => {
            const have = styleProps(tag);
            expect(have.has(inactive), `${tag} missing ${inactive}`).toBe(true);
            expect(have.has(active), `${tag} missing ${active}`).toBe(true);
        });

        it(`${tag} defaults ${inactive} to the frost-muted colour`, () => {
            expect(defaultOf(tag, inactive)).toBe('var(--feezal-glass-muted, rgba(29,29,31,0.55))');
        });
    }
});

/**
 * E141 — every state-driven Metro tile exposes a dedicated per-state
 * background-colour var (the primary state no longer silently reuses the
 * generic --feezal-metro-accent). Defaults resolve to the accent so existing
 * dashboards are unchanged.
 */
import {describe, it, expect} from 'vitest';
import '../packages/@feezal/feezal-element-metro-switch/feezal-element-metro-switch.js';
import '../packages/@feezal/feezal-element-metro-light/feezal-element-metro-light.js';
import '../packages/@feezal/feezal-element-metro-contact/feezal-element-metro-contact.js';
import '../packages/@feezal/feezal-element-metro-motion/feezal-element-metro-motion.js';
import '../packages/@feezal/feezal-element-metro-sensor/feezal-element-metro-sensor.js';
import '../packages/@feezal/feezal-element-metro-lock/feezal-element-metro-lock.js';

const styleProps = tag => new Set(
    customElements.get(tag).feezal.styles.filter(s => typeof s === 'object' && s.property).map(s => s.property));
const defaultOf = (tag, prop) =>
    customElements.get(tag).feezal.styles.find(s => s?.property === prop)?.default;

const CASES = {
    'feezal-element-metro-switch':  ['--feezal-metro-on-color', '--feezal-metro-off-color'],
    'feezal-element-metro-light':   ['--feezal-metro-on-color', '--feezal-metro-off-color'],
    'feezal-element-metro-contact': ['--feezal-metro-closed-color', '--feezal-metro-open-color', '--feezal-metro-tilt-color'],
    'feezal-element-metro-motion':  ['--feezal-metro-active-color', '--feezal-metro-clear-color'],
    'feezal-element-metro-sensor':  ['--feezal-metro-active-color', '--feezal-metro-clear-color'],
    'feezal-element-metro-lock':    ['--feezal-metro-locked-color', '--feezal-metro-unlocked-color', '--feezal-metro-jammed-color'],
};

// The "primary" state var (the one that used to reuse the accent) defaults to it.
const ACCENT_DEFAULTED = {
    'feezal-element-metro-switch':  '--feezal-metro-on-color',
    'feezal-element-metro-light':   '--feezal-metro-on-color',
    'feezal-element-metro-contact': '--feezal-metro-closed-color',
    'feezal-element-metro-motion':  '--feezal-metro-clear-color',
    'feezal-element-metro-sensor':  '--feezal-metro-clear-color',
    'feezal-element-metro-lock':    '--feezal-metro-locked-color',
};

describe('E141 — metro per-state background vars', () => {
    for (const [tag, props] of Object.entries(CASES)) {
        it(`${tag} exposes ${props.join(', ')}`, () => {
            const have = styleProps(tag);
            for (const p of props) expect(have.has(p), `${tag} missing ${p}`).toBe(true);
        });
    }

    for (const [tag, prop] of Object.entries(ACCENT_DEFAULTED)) {
        it(`${tag} defaults ${prop} to the family accent`, () => {
            expect(defaultOf(tag, prop)).toBe('var(--feezal-metro-accent)');
        });
    }
});

/**
 * U101 — the three editor colour settings fill their fields.
 *
 * `::part(trigger) { width: 100% }` looks like it should be enough, and is not:
 * sl-color-picker renders the trigger inside an `<sl-dropdown class=
 * "color-dropdown">` in its own shadow root, that host is `display:
 * inline-block`, and the picker exposes no part for it. The trigger's 100% then
 * resolves against a box that shrink-wraps the trigger, so the swatch sat at
 * its natural size under a full-width label.
 *
 * Needs a real browser: the fix is a stylesheet adopted by another component's
 * shadow root, and the symptom is a measured width.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import '../src/feezal-sidebar-editor.js';

const FIELD = 300;   // a deliberately wide panel, so shrink-wrap is obvious

let panel;

beforeEach(async () => {
    panel = document.createElement('feezal-sidebar-editor');
    panel.style.width = `${FIELD}px`;
    document.body.append(panel);
    await panel.updateComplete;
    // The settings live in the "editor" tab; an inactive sl-tab-panel is
    // display:none, and nothing inside it has a width to measure.
    const tabs = panel.shadowRoot.querySelector('sl-tab-group');
    await tabs.updateComplete;
    tabs.show('editor');
    await tabs.updateComplete;
    // The pickers patch themselves after their own first update.
    await Promise.all([...panel.shadowRoot.querySelectorAll('sl-color-picker')]
        .map(p => p.updateComplete));
    await panel.updateComplete;
});

afterEach(() => { panel.remove(); document.body.innerHTML = ''; });

const pickers = () => [...panel.shadowRoot.querySelectorAll('sl-color-picker')];

describe('U101 — colour setting pickers fill their field', () => {
    it('renders one picker per colour setting', () => {
        // Selection, grid and the new snap-guide colour.
        expect(pickers()).toHaveLength(3);
        const labels = [...panel.shadowRoot.querySelectorAll('.color-label')]
            .map(l => l.textContent.trim().split('\n')[0].trim());
        expect(labels).toEqual(['Selection color', 'Grid color', 'Snap guide color']);
    });

    it('adopts the width rule into each picker shadow root', () => {
        for (const picker of pickers()) {
            const rules = [...picker.shadowRoot.adoptedStyleSheets]
                .flatMap(sheet => [...sheet.cssRules].map(r => r.cssText))
                .concat([...picker.shadowRoot.querySelectorAll('style')].map(s => s.textContent));
            expect(rules.some(text => text.includes('.color-dropdown') && text.includes('100%')))
                .toBe(true);
        }
    });

    it('makes the trigger as wide as its label, not shrink-wrapped', () => {
        for (const picker of pickers()) {
            const label = picker.closest('.color-label');
            const trigger = picker.shadowRoot.querySelector('[part~="trigger"]');
            const labelWidth = label.getBoundingClientRect().width;
            const triggerWidth = trigger.getBoundingClientRect().width;

            expect(labelWidth).toBeGreaterThan(40);            // the premise
            // Shrink-wrapped, the trigger is Shoelace's own ~2.5rem swatch;
            // stretched it matches the field it sits in.
            expect(triggerWidth).toBeCloseTo(labelWidth, 0);
        }
    });

    it('each picker offers the alpha channel', () => {
        // The other half of U101: transparency in all three settings.
        for (const picker of pickers()) {
            expect(picker.hasAttribute('opacity')).toBe(true);
        }
    });
});

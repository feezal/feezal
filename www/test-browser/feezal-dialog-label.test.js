/**
 * E142 — dialog editor-only placeholder label.
 *
 * The `-dialog` and `-countdown-dialog` elements gain an editor-only `label`
 * attribute that disambiguates several dialogs on the canvas ("Dialog: Confirm
 * delete"); it is NEVER rendered in the viewer. The `-dialog-view` elements do
 * NOT get a `label` — they already reference a view, so their placeholder shows
 * "Dialog: <viewname>" from the bound `view` attribute instead.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {dialogPlaceholderLabel} from '@feezal/feezal-element';
import {setupFeezal, mount} from './helpers.js';

import '../packages/@feezal/feezal-element-material-dialog/feezal-element-material-dialog.js';
import '../packages/@feezal/feezal-element-glass-dialog/feezal-element-glass-dialog.js';
import '../packages/@feezal/feezal-element-eink-dialog/feezal-element-eink-dialog.js';
import '../packages/@feezal/feezal-element-paper-dialog/feezal-element-paper-dialog.js';
import '../packages/@feezal/feezal-element-material-countdown-dialog/feezal-element-material-countdown-dialog.js';
import '../packages/@feezal/feezal-element-glass-countdown-dialog/feezal-element-glass-countdown-dialog.js';
import '../packages/@feezal/feezal-element-eink-countdown-dialog/feezal-element-eink-countdown-dialog.js';
import '../packages/@feezal/feezal-element-material-dialog-view/feezal-element-material-dialog-view.js';
import '../packages/@feezal/feezal-element-glass-dialog-view/feezal-element-glass-dialog-view.js';
import '../packages/@feezal/feezal-element-eink-dialog-view/feezal-element-eink-dialog-view.js';
import '../packages/@feezal/feezal-element-paper-dialog-view/feezal-element-paper-dialog-view.js';

// The label-bearing dialogs (attribute drives the placeholder text).
const LABEL_DIALOGS = [
    'feezal-element-material-dialog', 'feezal-element-glass-dialog',
    'feezal-element-eink-dialog', 'feezal-element-paper-dialog',
    'feezal-element-material-countdown-dialog', 'feezal-element-glass-countdown-dialog',
    'feezal-element-eink-countdown-dialog',
];
// The view-bearing dialogs (placeholder shows the bound view name, no `label`).
const VIEW_DIALOGS = [
    'feezal-element-material-dialog-view', 'feezal-element-glass-dialog-view',
    'feezal-element-eink-dialog-view', 'feezal-element-paper-dialog-view',
];

const declares = (tag, name) => customElements.get(tag).feezal.attributes.some(a => a.name === name);

describe('dialogPlaceholderLabel (E142)', () => {
    it('appends the label when set, else returns the base word', () => {
        expect(dialogPlaceholderLabel('Dialog', 'Confirm delete')).toBe('Dialog: Confirm delete');
        expect(dialogPlaceholderLabel('Dialog', '')).toBe('Dialog');
        expect(dialogPlaceholderLabel('Dialog', '   ')).toBe('Dialog');
        expect(dialogPlaceholderLabel('Countdown Dialog', 'Reboot')).toBe('Countdown Dialog: Reboot');
        expect(dialogPlaceholderLabel('Dialog', undefined)).toBe('Dialog');
    });
});

describe('E142 — label-bearing dialogs', () => {
    beforeEach(() => setupFeezal({isEditor: true}));

    for (const tag of LABEL_DIALOGS) {
        it(`${tag} declares the label attribute and shows it on the canvas`, async () => {
            expect(declares(tag, 'label')).toBe(true);
            const el = await mount(tag, {label: 'Confirm delete'});
            expect(el.renderRoot.textContent).toContain(': Confirm delete');
        });

        it(`${tag} never leaks the label into the viewer render`, async () => {
            setupFeezal({isEditor: false});
            const el = await mount(tag, {label: 'Confirm delete'});
            expect(el.renderRoot.textContent).not.toContain('Confirm delete');
        });
    }
});

describe('E142 — dialog-view uses the bound view name (no label attribute)', () => {
    beforeEach(() => setupFeezal({isEditor: true}));

    for (const tag of VIEW_DIALOGS) {
        it(`${tag} shows "Dialog: <viewname>" and has no label attribute`, async () => {
            expect(declares(tag, 'label')).toBe(false);
            const el = await mount(tag, {view: 'Light Settings'});
            expect(el.renderRoot.textContent).toContain('Dialog: Light Settings');
        });
    }
});

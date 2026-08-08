/**
 * N43 — the structural guard against the recurring dark-mode bug.
 *
 * Shoelace themes only the RESTING state of its controls, so every editor
 * dialog needs the same hover/focus overrides. Shipping them as copy-paste in
 * each component meant a new dialog started with NONE of them, and buttons /
 * inputs flashed white on hover in dark mode — repeatedly, across releases.
 *
 * The fix is `feezalDialogChrome`: one composed stylesheet. This test is the
 * ratchet — a new editor dialog that uses Shoelace controls must compose it
 * rather than re-inventing (or forgetting) the rules.
 */
import {describe, it, expect} from 'vitest';
import {readFileSync, readdirSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = f => readFileSync(join(srcDir, f), 'utf8');

/** Editor components that render Shoelace form controls inside a dialog. */
const DIALOGS = [
    'feezal-export-dialog.js',
    'feezal-generate-dialog.js',
    'feezal-connect-dialog.js',
    'feezal-capacitor-dialog.js',
];

// Panels/sidebars that predate N43 and theme Shoelace their own way. They are
// NOT broken — they carry their own working rules — but they are the migration
// backlog. Removing a name here (after adopting the shared chrome) is the
// intended direction; adding one needs a reason.
const LEGACY_UNMIGRATED = [
    'feezal-sidebar-viewer.js', 'feezal-sidebar-themes.js',
    'feezal-sidebar-editor.js', 'feezal-sidebar-color-ranges.js', 'feezal-pwa-icon-dialog.js',
    'feezal-icon-input.js', 'feezal-palette.js', 'feezal-sidebar-inspector-styles.js',
    'feezal-sidebar-inspector-attributes.js', 'feezal-app-editor.js', 'feezal-site-manager.js',
    'feezal-ai-chat.js', 'feezal-welcome-tour.js', 'feezal-sidebar-history.js',
    'feezal-sidebar-clients.js', 'feezal-template-editor.js', 'feezal-sidebar-inspector.js',
    'feezal-sidebar-inspector-conditions.js', 'feezal-sidebar-palette.js',
    'feezal-sidebar-packages.js', 'feezal-style-editor-background.js',
];

describe('N43 — shared dialog chrome', () => {
    it('every migrated dialog composes feezalDialogChrome', () => {
        for (const f of DIALOGS) {
            const src = read(f);
            expect(src, f).toContain("from './feezal-editor-chrome.js'");
            expect(src, f).toMatch(/static styles = \[feezalDialogChrome,/);
        }
    });

    it('no migrated dialog re-declares the shared button-hover rule', () => {
        for (const f of DIALOGS) {
            expect(read(f), f).not.toContain("sl-button[variant='default']::part(base):hover");
        }
    });

    it('the shared sheet covers the states Shoelace does NOT derive', () => {
        const chrome = read('feezal-editor-chrome.js');
        // the recurring bug is exactly these three: hover on a default button,
        // and the input background on hover AND focus
        expect(chrome).toContain("sl-button[variant='default']::part(base):hover");
        expect(chrome).toContain('--sl-input-background-color-hover');
        expect(chrome).toContain('--sl-input-background-color-focus');
    });

    it('RATCHET: a new editor dialog with Shoelace controls must compose the chrome', () => {
        const offenders = readdirSync(srcDir)
            .filter(f => f.endsWith('.js'))
            .filter(f => !DIALOGS.includes(f) && !LEGACY_UNMIGRATED.includes(f))
            .filter(f => {
                const src = read(f);
                const usesShoelaceControls = /<sl-(input|select|button|textarea|checkbox|switch)\b/.test(src);
                return usesShoelaceControls && !src.includes('feezal-editor-chrome.js');
            });
        expect(offenders,
            'new editor components using Shoelace controls must import feezalDialogChrome ' +
            '(or be added to LEGACY_UNMIGRATED with a reason)').toEqual([]);
    });

});

describe('N43 — z-index ladder', () => {
    it('layers are strictly ordered from canvas to tour', async () => {
        const {FEEZAL_Z} = await import('../src/feezal-editor-chrome.js');
        const order = ['canvasOverlay', 'menu', 'dialog', 'toast', 'connectionOverlay', 'tour'];
        const values = order.map(k => FEEZAL_Z[k]);
        expect(values.every(v => Number.isInteger(v))).toBe(true);
        expect([...values].sort((a, b) => a - b)).toEqual(values);
        // a toast must be visible above a dialog (that is why deploy errors work)
        expect(FEEZAL_Z.toast).toBeGreaterThan(FEEZAL_Z.dialog);
    });

    it('migrated dialogs take their dialog z-index from the constant', () => {
        for (const f of DIALOGS) {
            const src = read(f);
            if (!src.includes('--sl-z-index-dialog')) continue;
            expect(src, f).toContain('--sl-z-index-dialog: ${FEEZAL_Z.dialog}');
        }
    });
});

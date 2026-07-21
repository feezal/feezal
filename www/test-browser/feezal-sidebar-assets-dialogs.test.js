/**
 * B44 — Asset Manager dialogs must follow the editor theme. The new-folder
 * prompt (and the delete confirm) render inside the panel's shadow DOM; in
 * dark mode feezal-app-editor propagates the palette via --feezal-* /
 * --sl-input-* custom properties on the panel host. These tests set the same
 * vars the editor sets and assert the COMPUTED colours, so a regression to a
 * white input/panel in dark mode fails for real.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../src/feezal-sidebar-assets.js';
import {setupFeezal, until} from './helpers.js';

// The dark-mode palette feezal-app-editor sets on the sidebar panels
// (see :host(.dark) feezal-sidebar-assets { … } in feezal-app-editor.js).
const DARK_VARS = {
    '--feezal-bg': '#2e2e2e',
    '--feezal-bg-sub': '#262626',
    '--feezal-border': '#3d3d3d',
    '--feezal-color': 'rgba(255,255,255,0.85)',
    '--sl-input-background-color': '#252525',
    '--sl-input-border-color': '#444',
    '--sl-input-color': '#bdbdbd',
    '--sl-input-label-color': 'rgba(255,255,255,0.6)',
};

/** Perceived lightness 0-255 of a computed rgb()/rgba() string. */
function lightness(cssColor) {
    const m = cssColor.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
    if (!m) throw new Error('unparsable colour: ' + cssColor);
    return (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3;
}

async function mountAssets(dark) {
    const el = document.createElement('feezal-sidebar-assets');
    if (dark) {
        for (const [k, v] of Object.entries(DARK_VARS)) el.style.setProperty(k, v);
    }
    document.body.append(el);
    await el.updateComplete;
    return el;
}

beforeEach(() => {
    setupFeezal({isEditor: true, siteName: 'default'});
    // The panel loads the asset list on connect — a failing fetch is fine,
    // the dialogs under test are independent of it.
});

describe('new-folder prompt dialog (B44)', () => {
    it('input and panel are dark in dark mode', async () => {
        const el = await mountAssets(true);

        const promise = el._prompt('Folder name');
        await el.updateComplete;
        const dialog = [...el.shadowRoot.querySelectorAll('sl-dialog')]
            .find(d => d.getAttribute('label') === 'New Folder');
        expect(dialog).toBeTruthy();
        await until(() => dialog.open);

        const input = dialog.querySelector('sl-input');
        const inputBox = await until(() => input.shadowRoot?.querySelector('[part~="base"]'));
        const inputBg = getComputedStyle(inputBox).backgroundColor;
        expect(lightness(inputBg), `input background ${inputBg} should be dark`).toBeLessThan(80);

        const panel = dialog.shadowRoot.querySelector('[part~="panel"]');
        const panelBg = getComputedStyle(panel).backgroundColor;
        expect(lightness(panelBg), `dialog panel ${panelBg} should be dark`).toBeLessThan(80);

        // Resolve the pending prompt so nothing leaks between tests.
        el._dlgPrompt.resolve(null);
        el._dlgPrompt = null;
        await promise;
    });

    it('input and panel stay light without dark vars', async () => {
        const el = await mountAssets(false);

        const promise = el._prompt('Folder name');
        await el.updateComplete;
        const dialog = [...el.shadowRoot.querySelectorAll('sl-dialog')]
            .find(d => d.getAttribute('label') === 'New Folder');
        await until(() => dialog.open);

        const input = dialog.querySelector('sl-input');
        const inputBox = await until(() => input.shadowRoot?.querySelector('[part~="base"]'));
        const inputBg = getComputedStyle(inputBox).backgroundColor;
        expect(lightness(inputBg), `input background ${inputBg} should be light`).toBeGreaterThan(180);

        el._dlgPrompt.resolve(null);
        el._dlgPrompt = null;
        await promise;
    });
});

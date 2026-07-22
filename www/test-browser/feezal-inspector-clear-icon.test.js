/**
 * B51 — the U44 clear × must actually RENDER. Shoelace SYSTEM icons are
 * data:image/svg+xml URIs loaded via fetch(); the server CSP grants data: on
 * connect-src (asserted in server/test/privacy.test.js — '*' does not match
 * schemes). This guards the client half: the fetched SVG lands in the icon's
 * shadow DOM — an empty shadow root is exactly the invisible-but-clickable
 * B51 symptom.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import {setupFeezal, until} from './helpers.js';

beforeEach(() => { setupFeezal(); });

describe('B51 — the clear × renders its system icon', () => {
    it('a populated clearable sl-input shows the x-circle-fill SVG (not an empty box)', async () => {
        const input = document.createElement('sl-input');
        input.clearable = true;
        input.value = 'something';
        document.body.append(input);
        await input.updateComplete;

        const btn = await until(() => input.shadowRoot.querySelector('[part~="clear-button"]'));
        const icon = btn.querySelector('sl-icon');
        expect(icon).toBeTruthy();
        const svg = await until(() => icon.shadowRoot?.querySelector('svg'));
        expect(svg).toBeTruthy();
    });
});

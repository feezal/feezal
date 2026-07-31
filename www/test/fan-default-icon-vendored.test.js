import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import INSTALLED from '../src/material-design-icons.js';

// B93: `mode_fan` is NOT in the vendored classic Material Icons woff2 (A25 —
// self-hosted font), so the glass fan card spun a broken glyph ("one wing on a
// wrong position"). Guard the whole fan family: a card's default icon must be
// an installed symbol, and the broken name must not creep back in.
const here = dirname(fileURLToPath(import.meta.url));
const installed = new Set(INSTALLED);
const FANS = ['glass', 'circle', 'eink'];

describe('B93 — fan default icons are vendored symbols', () => {
    for (const fam of FANS) {
        const file = join(here, `../packages/@feezal/feezal-element-${fam}-fan/feezal-element-${fam}-fan.js`);
        const src = readFileSync(file, 'utf8');

        it(`${fam}-fan: no reference to the broken mode_fan glyph`, () => {
            expect(/\bmode_fan\b/.test(src)).toBe(false);
        });

        it(`${fam}-fan: palette icon is an installed symbol`, () => {
            const m = src.match(/palette:\s*\{[^}]*icon:\s*'([^']+)'/);
            expect(m, `${fam}-fan palette icon not found`).toBeTruthy();
            expect(installed.has(m[1]), `${fam}-fan palette icon "${m?.[1]}" is not vendored`).toBe(true);
        });

        // The `icon` attribute default (where declared) is rendered directly —
        // it must be vendored too (glass-fan spins it).
        it(`${fam}-fan: any icon-attribute default is an installed symbol`, () => {
            const m = src.match(/name:\s*'icon'[^}]*default:\s*'([^']+)'/);
            if (m) expect(installed.has(m[1]), `${fam}-fan icon default "${m[1]}" is not vendored`).toBe(true);
        });
    }
});

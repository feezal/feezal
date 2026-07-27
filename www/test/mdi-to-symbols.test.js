import {describe, it, expect} from 'vitest';

import {MDI_TO_SYMBOLS} from '../src/mdi-to-symbols.js';
import INSTALLED_SYMBOLS from '../src/material-design-icons.js';

// E161 — the mdi:* → Material Symbols alias table. A value that is not an
// installed Symbol renders blank, so this guard fails CI if any mapping targets
// a name feezal does not ship (the exact failure mode the table exists to avoid).

describe('MDI_TO_SYMBOLS table', () => {
    const installed = new Set(INSTALLED_SYMBOLS);

    it('maps every entry to an installed Material Symbol', () => {
        const bad = Object.entries(MDI_TO_SYMBOLS).filter(([, sym]) => !installed.has(sym));
        expect(bad).toEqual([]);
    });

    it('keys are bare mdi names without the mdi: prefix', () => {
        const prefixed = Object.keys(MDI_TO_SYMBOLS).filter(k => k.startsWith('mdi:'));
        expect(prefixed).toEqual([]);
    });

    it('covers the icons from the reported ESPHome device', () => {
        expect(MDI_TO_SYMBOLS.blur).toBe('blur_on');
        expect(MDI_TO_SYMBOLS['gas-cylinder']).toBe('gas_meter');
        expect(MDI_TO_SYMBOLS.gauge).toBe('speed');
        expect(MDI_TO_SYMBOLS.lightbulb).toBe('lightbulb');
    });
});

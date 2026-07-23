/**
 * U53 — the shared styled theme picker (<feezal-theme-select>): shortened
 * labels + colour swatches, one control for the themes sidebar (site theme)
 * and the view inspector (per-view `theme` attribute, N6 custom mount). The
 * element mount must keep the B50 contract: leading "Site theme (default)"
 * entry + × clear, both REMOVING the attribute (value null).
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../src/feezal-theme-select.js';
import '../src/feezal-view.js';
import {pkgToClass, pkgToLabel, sampleThemeColors, SWATCH_ROLES, toSwatchRecord, fillSwatch} from '../src/feezal-theme-select.js';
import {setupFeezal, mount} from './helpers.js';

let feezal;
beforeEach(() => {
    feezal = setupFeezal({themes: ['@feezal/feezal-theme-dark-mint', '@feezal/feezal-theme-metro']});
});

describe('U53 — feezal-theme-select', () => {
    it('helpers shorten package names', () => {
        expect(pkgToClass('@feezal/feezal-theme-dark-mint')).toBe('feezal-theme-dark-mint');
        expect(pkgToLabel('@feezal/feezal-theme-dark-mint')).toBe('dark-mint');
    });

    it('derives options from feezal.themes with shortened labels + swatch rows', async () => {
        const el = await mount('feezal-theme-select', {});
        el.colors = {'feezal-theme-dark-mint': {
            bg: '#111', bg2: '#181818', primary: '#3ddc97',
            text: '#eee', text2: '#999', divider: '#333', accent: '#ff9800',
        }};
        el.shadowRoot.querySelector('.trigger').click();
        await el.updateComplete;
        const names = [...el.shadowRoot.querySelectorAll('.option-name')].map(n => n.textContent);
        expect(names).toEqual(['dark-mint', 'metro']);
        expect(el.shadowRoot.querySelectorAll('.option .swatches').length).toBe(2);
    });

    it('U57: the compound swatch renders the bg chip, three role dots, divider and accent dot', async () => {
        const el = await mount('feezal-theme-select', {});
        el.colors = {'feezal-theme-dark-mint': {
            bg: 'rgb(17, 17, 17)', bg2: 'rgb(24, 24, 24)', primary: 'rgb(61, 220, 151)',
            text: 'rgb(238, 238, 238)', text2: 'rgb(153, 153, 153)',
            divider: 'rgb(51, 51, 51)', accent: 'rgb(255, 152, 0)',
        }};
        el.shadowRoot.querySelector('.trigger').click();
        await el.updateComplete;
        const opt = [...el.shadowRoot.querySelectorAll('.option')]
            .find(o => o.textContent.includes('dark-mint'));
        const chip = opt.querySelector('.chip');
        const halves = chip.querySelectorAll('.chip-half');
        expect(halves).toHaveLength(2);
        expect(halves[0].style.background).toBe('rgb(17, 17, 17)');   // --primary-background-color
        expect(halves[1].style.background).toBe('rgb(24, 24, 24)');   // --secondary-background-color
        const dots = chip.querySelectorAll('.chip-dots .dot');
        expect([...dots].map(d => d.style.background))
            .toEqual(['rgb(61, 220, 151)', 'rgb(238, 238, 238)', 'rgb(153, 153, 153)']); // primary/text/text2
        expect(opt.querySelector('.swatch-divider').style.background).toBe('rgb(51, 51, 51)'); // --divider-color
        expect(opt.querySelector('.dot-accent').style.background).toBe('rgb(255, 152, 0)');    // --accent-color
    });

    it('U57: sampleThemeColors returns the seven canonical roles per class; legacy arrays coerce; missing roles fill', () => {
        // sampleThemeColors needs feezal.site; assert the role set + helpers here.
        expect(SWATCH_ROLES).toEqual(['bg', 'bg2', 'primary', 'text', 'text2', 'divider', 'accent']);
        // Legacy [bg, text, text2] arrays (pre-U57) coerce to a partial record.
        expect(toSwatchRecord(['#111', '#eee', '#999'])).toEqual({bg: '#111', text: '#eee', text2: '#999'});
        // fillSwatch backfills every omitted role so the chip has no empty slot.
        const filled = fillSwatch({bg: '#111'});
        for (const r of SWATCH_ROLES) expect(filled[r], r).toBeTruthy();
        expect(filled.bg).toBe('#111');
        // sampleThemeColors keys colours by role (site present in the browser harness).
        feezal.site = document.createElement('div');
        document.body.append(feezal.site);
        const {colors} = sampleThemeColors(['feezal-theme-dark-mint']);
        expect(Object.keys(colors['feezal-theme-dark-mint']).sort()).toEqual([...SWATCH_ROLES].sort());
    });

    it('sidebar mount: explicit options + change event, delete-theme for user themes', async () => {
        const el = await mount('feezal-theme-select', {});
        el.options = [
            {cls: 'default', label: 'Default'},
            {cls: 'feezal-theme-x', label: 'x', user: true},
        ];
        el.colors = {};
        el.value = 'default';
        await el.updateComplete;
        const changes = [];
        const deletes = [];
        el.addEventListener('change', e => changes.push(e.detail.value));
        el.addEventListener('delete-theme', e => deletes.push(e.detail.cls));

        el.shadowRoot.querySelector('.trigger').click();
        await el.updateComplete;
        const options = [...el.shadowRoot.querySelectorAll('.option')];
        expect(options).toHaveLength(2);
        options[1].querySelector('.option-del').click();
        expect(deletes).toEqual(['feezal-theme-x']);
        options[1].click();
        expect(changes).toEqual(['feezal-theme-x']);
        expect(el.value).toBe('feezal-theme-x');
    });

    it('element mount: reads the theme attr, leads with "Site theme (default)", emits null to clear (B50)', async () => {
        const view = document.createElement('feezal-view');
        view.setAttribute('name', 'v1');
        view.setAttribute('theme', 'dark-mint');
        document.body.append(view);

        const el = await mount('feezal-theme-select', {});
        el.colors = {};
        el.element = view;
        await el.updateComplete;
        expect(el.value).toBe('feezal-theme-dark-mint');   // normalized from the bare suffix
        expect(el.emptyOption).toBe('Site theme (default)');
        expect(el.shadowRoot.querySelector('.trigger-name').textContent).toBe('dark-mint');

        const emitted = [];
        el.addEventListener('feezal-attribute-changed', e => emitted.push(e.detail));

        el.shadowRoot.querySelector('.trigger').click();
        await el.updateComplete;
        const first = el.shadowRoot.querySelector('.option');
        expect(first.querySelector('.option-name').textContent).toBe('Site theme (default)');
        first.click();
        expect(emitted).toEqual([{name: 'theme', value: null}]);   // null = removeAttribute

        // picking a theme emits the full class name
        el.shadowRoot.querySelector('.trigger').click();
        await el.updateComplete;
        [...el.shadowRoot.querySelectorAll('.option')].find(o => o.textContent.includes('metro')).click();
        expect(emitted[1]).toEqual({name: 'theme', value: 'feezal-theme-metro'});
    });

    it('the × on the trigger clears back to the site theme (B50 clear affordance)', async () => {
        const view = document.createElement('feezal-view');
        view.setAttribute('theme', 'feezal-theme-metro');
        document.body.append(view);
        const el = await mount('feezal-theme-select', {});
        el.colors = {};
        el.element = view;
        await el.updateComplete;
        const emitted = [];
        el.addEventListener('feezal-attribute-changed', e => emitted.push(e.detail));
        el.shadowRoot.querySelector('.trigger-clear').click();
        expect(emitted).toEqual([{name: 'theme', value: null}]);
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.trigger-clear')).toBeNull();   // nothing set → no ×
    });

    it('feezal-view mounts it via the N6 custom hook', () => {
        const spec = customElements.get('feezal-view').feezal.attributes
            .find(a => a?.name === 'theme');
        expect(spec).toMatchObject({type: 'custom', component: 'feezal-theme-select'});
    });
});

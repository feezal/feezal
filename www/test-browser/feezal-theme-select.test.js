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
import {pkgToClass, pkgToLabel} from '../src/feezal-theme-select.js';
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
        el.colors = {'feezal-theme-dark-mint': ['#111', '#222', '#333']};
        el.shadowRoot.querySelector('.trigger').click();
        await el.updateComplete;
        const names = [...el.shadowRoot.querySelectorAll('.option-name')].map(n => n.textContent);
        expect(names).toEqual(['dark-mint', 'metro']);
        expect(el.shadowRoot.querySelectorAll('.option .swatches').length).toBe(2);
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

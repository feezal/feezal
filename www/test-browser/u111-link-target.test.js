/**
 * U111 — the link family's `href` renders a URL / View mode control in the
 * generic attribute inspector. View mode is a picker over the site's views
 * (incl. layout-app routable sub-paths) writing `#/<view>` back; URL mode is
 * the plain text input. The attribute stays `href` — unchanged semantics.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-glass-link/feezal-element-glass-link.js';
import '../src/feezal-sidebar-inspector-attributes.js';
import '../src/feezal-view.js';
import {setupFeezal, until} from './helpers.js';

const SPACED = 'Living room';

let feezal;

async function mountPanel(attrs = {}) {
    const site = document.createElement('div');
    for (const n of ['main', SPACED]) {
        const v = document.createElement('feezal-view');
        v.setAttribute('name', n);
        site.append(v);
    }
    // a layout-app shell view: its entries are routable as shell/leaf
    const shell = document.createElement('feezal-view');
    shell.setAttribute('name', 'app');
    const app = document.createElement('feezal-element-layout-app');
    app.setAttribute('items', JSON.stringify([
        {label: 'Home', view: 'home'},
        {label: 'Sec', items: [{label: 'Sub', view: 'sub1'}]},
    ]));
    shell.append(app);
    site.append(shell);
    document.body.append(site);
    feezal.site = site;
    feezal.views = site.querySelectorAll('feezal-view');

    const link = document.createElement('feezal-element-glass-link');
    for (const [k, v] of Object.entries(attrs)) link.setAttribute(k, v);
    document.body.append(link);

    feezal.editor = {selectedElems: [link]};   // _change applies via the editor's selection
    const panel = document.createElement('feezal-sidebar-inspector-attributes');
    panel.selectedElems = [link];
    document.body.append(panel);
    await panel.updateComplete;
    await until(() => panel.shadowRoot.querySelector('.linktarget-wrap'));
    return {panel, link};
}

beforeEach(() => {
    feezal = setupFeezal({isEditor: true});
    feezal.app = {change() {}, requestUpdate() {}};
});

describe('U111 — href link-target control', () => {
    it('derives the mode from the value: empty/URL → text input, #/view → picker', async () => {
        const {panel} = await mountPanel({href: 'https://grafana.local/d/abc'});
        const wrap = panel.shadowRoot.querySelector('.linktarget-wrap');
        expect(wrap.querySelector('sl-input')).toBeTruthy();
        expect(wrap.querySelector('sl-select')).toBeNull();
        expect(wrap.querySelector('.lt-mode.active').textContent.trim()).toBe('URL');
    });

    it('a #/view href opens in View mode with the view selected — spaced names included (B128)', async () => {
        const {panel} = await mountPanel({href: '#/' + SPACED});
        const wrap = panel.shadowRoot.querySelector('.linktarget-wrap');
        const select = wrap.querySelector('sl-select');
        expect(select).toBeTruthy();
        expect(wrap.querySelector('.lt-mode.active').textContent.trim()).toBe('View');
        // encoded value, raw label
        const opt = [...select.querySelectorAll('sl-option')].find(o => o.textContent.trim() === SPACED);
        expect(opt.value).not.toContain(' ');
        expect(select.value).toBe(opt.value);
    });

    it('picking a view writes #/<view> back into href (raw name, unchanged semantics)', async () => {
        const {panel, link} = await mountPanel({href: '#/main'});
        const select = panel.shadowRoot.querySelector('.linktarget-wrap sl-select');
        const opt = [...select.querySelectorAll('sl-option')].find(o => o.textContent.trim() === SPACED);
        select.value = opt.value;
        select.dispatchEvent(new Event('sl-change'));
        await until(() => link.getAttribute('href') === '#/' + SPACED);
    });

    it('offers layout-app routable sub-paths (shell/leaf) beside the plain views', async () => {
        const {panel} = await mountPanel({href: '#/main'});
        const texts = [...panel.shadowRoot.querySelectorAll('.linktarget-wrap sl-option')]
            .map(o => o.textContent.trim());
        for (const t of ['main', SPACED, 'app', 'app/home', 'app/sub1']) {
            expect(texts).toContain(t);
        }
    });

    it('the mode toggle switches to the free URL input and back', async () => {
        const {panel} = await mountPanel({href: '#/main'});
        const wrap = () => panel.shadowRoot.querySelector('.linktarget-wrap');
        wrap().querySelectorAll('.lt-mode')[0].click();   // URL
        await panel.updateComplete;
        const input = wrap().querySelector('sl-input');
        expect(input).toBeTruthy();
        expect(input.value).toBe('#/main');               // value untouched by the toggle
        wrap().querySelectorAll('.lt-mode')[1].click();   // View
        await panel.updateComplete;
        expect(wrap().querySelector('sl-select')).toBeTruthy();
    });
});

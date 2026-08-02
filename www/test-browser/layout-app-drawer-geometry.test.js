/**
 * B90 — the drawer has ONE geometry, and every mode uses it.
 *
 * Reported: the wide drawer insets its entries, the slim rail does not, and the
 * icon shifts a few px when the two swap. Measured before the fix (icon x
 * relative to the drawer):
 *
 *                        pill    list
 *   full drawer           20      16
 *   slim rail at rest     19.5    19.5
 *   rail expanded         20      24     <- plus an 8px gutter list never had
 *   rail-menu overlay     97.5    97.5   <- collapsed presentation, icons centred
 *
 * Three separate causes: the expanded-rail and overlay rules hardcoded the pill
 * padding (so "list" grew a gutter on expand); the rest state CENTRED the icon,
 * which makes its x depend on the rail width and the entry style rather than on
 * the row's own padding; and the collapsed selectors are more specific than the
 * .rail-open ones, so the menu-button overlay kept the collapsed look whenever
 * the drawer was not hovered — i.e. always, on touch, which is what that button
 * exists for.
 *
 * The guard is positional, not textual: mount every mode, measure, require one
 * number. Stylesheet assertions would not have caught any of the three.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {userEvent} from '@vitest/browser/context';
import '../packages/@feezal/feezal-element-layout-app/feezal-element-layout-app.js';
import '../src/feezal-view.js';
import {setupFeezal} from './helpers.js';

const ITEMS = JSON.stringify([
    {label: 'Overview', icon: 'home', view: 'page1'},
    {label: 'Settings', icon: 'settings', view: 'page3'},
]);

beforeEach(() => setupFeezal());

// The pointer stays wherever the last hover left it, so a drawer mounted at the
// same spot is silently :hover-ed and a "rest" measurement is really an expanded
// one. Park it out of the way between mounts.
let parkEl;
async function park() {
    // Re-created per test: the runner clears the body between tests, and
    // hovering a detached node fails inside the locator, not in the assertion.
    if (!parkEl || !parkEl.isConnected) {
        parkEl = document.createElement('div');
        parkEl.style.cssText = 'position:fixed;right:0;bottom:0;width:40px;height:40px;z-index:9999;';
        document.body.append(parkEl);
    }
    await userEvent.hover(parkEl);
}

async function mount(attrs, boxWidth = 1400, hostStyle = '') {
    await park();
    const box = document.createElement('div');
    box.style.cssText = `width:${boxWidth}px;height:600px;position:relative;` +
        '--primary-background-color:#2a2a2a;--feezal-app-drawer-bg:rgba(80,80,80,0.25);';
    document.body.append(box);
    const el = document.createElement('feezal-element-layout-app');
    el.setAttribute('items', ITEMS);
    el.setAttribute('drawer-persistent', 'true');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.style.cssText = 'width:100%;height:100%;' + hostStyle;
    box.append(el);
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 350));
    return {el, box};
}

/** Icon offset from the drawer's own left edge, plus its absolute y. */
function iconPos(el) {
    const drawer = el.shadowRoot.querySelector('.drawer');
    const icon = el.shadowRoot.querySelector('.entry feezal-icon');
    const d = drawer.getBoundingClientRect();
    const i = icon.getBoundingClientRect();
    return {x: +(i.x - d.x).toFixed(1), y: +i.y.toFixed(1), drawerW: +d.width.toFixed(1)};
}

/**
 * Every drawer mode, measured. Returns {mode: iconPos}.
 * `extra` is merged into the element's attributes for all modes.
 */
async function everyMode(extra = {}, hostStyle = '') {
    const out = {};
    let m;

    m = await mount({...extra, rail: 'off'}, 1400, hostStyle);
    out['full drawer'] = iconPos(m.el);
    m.box.remove();

    // rail: auto — full above the rail breakpoint, slim below it
    m = await mount({...extra, rail: 'auto', 'rail-breakpoint': '1024'}, 1400, hostStyle);
    out['auto, above bp'] = iconPos(m.el);
    m.box.remove();
    m = await mount({...extra, rail: 'auto', 'rail-breakpoint': '1024'}, 900, hostStyle);
    out['auto, below bp'] = iconPos(m.el);
    m.box.remove();

    // narrow: the hamburger overlay
    m = await mount({...extra, breakpoint: '768'}, 500, hostStyle);
    m.el.shadowRoot.querySelector('.iconbtn').click();
    await m.el.updateComplete;
    await new Promise(r => setTimeout(r, 350));
    out['narrow overlay'] = iconPos(m.el);
    m.box.remove();

    // the rail menu button's overlay — clicked, NOT hovered (the touch case)
    m = await mount({...extra, rail: 'slim', 'rail-menu-button': 'true'}, 1400, hostStyle);
    m.el.shadowRoot.querySelector('.rail-menu').click();
    await m.el.updateComplete;
    await new Promise(r => setTimeout(r, 350));
    out['rail-menu overlay'] = iconPos(m.el);
    m.box.remove();

    // slim rail at rest, then hover-expanded (last — it moves the pointer)
    m = await mount({...extra, rail: 'slim'}, 1400, hostStyle);
    out['slim rest'] = iconPos(m.el);
    await userEvent.hover(m.el.shadowRoot.querySelector('.drawer'));
    await new Promise(r => setTimeout(r, 350));
    out['slim expanded'] = iconPos(m.el);
    m.box.remove();
    await park();

    return out;
}

/** Same x and y everywhere, reported as a readable table when it is not. */
function expectStable(modes, x) {
    const first = Object.values(modes)[0];
    const table = Object.entries(modes)
        .map(([mode, p]) => `${mode.padEnd(18)} x=${p.x} y=${p.y} drawer=${p.drawerW}`).join('\n');
    for (const [mode, p] of Object.entries(modes)) {
        expect(p.x, `${mode} icon x\n${table}`).toBeCloseTo(x, 0);
        expect(p.y, `${mode} icon y\n${table}`).toBeCloseTo(first.y, 0);
    }
}

describe('drawer entry geometry is identical in every mode (B90)', () => {
    it('entry-style="pill" — icon at drawer inset + entry padding (8 + 12)', async () => {
        expectStable(await everyMode({'entry-style': 'pill'}), 20);
    });

    it('entry-style="list" — flush drawer, icon at the entry padding (0 + 16)', async () => {
        expectStable(await everyMode({'entry-style': 'list'}), 16);
    });

    it('--feezal-app-drawer-entry-inset moves every mode together', async () => {
        // The reported ask: remove the gutter the wide drawer draws around its
        // entries. Setting it must not reintroduce a jump anywhere.
        expectStable(await everyMode({'entry-style': 'pill'}, '--feezal-app-drawer-entry-inset:0px;'), 12);
    });

    it('the rail is wide enough to centre the icon it aligns (pill = 64px, MD3)', async () => {
        const {el, box} = await mount({'entry-style': 'pill', rail: 'slim'});
        const {x, drawerW} = iconPos(el);
        expect(drawerW).toBeCloseTo(64, 0);
        // aligned with the expanded state AND centred in the rail: both hold
        // only because the rail width is derived from the same two numbers.
        expect(x + 12).toBeCloseTo(drawerW / 2, 0);
        box.remove();
        await park();
    });

    it('the rail-menu overlay shows its labels without a pointer (touch)', async () => {
        const {el, box} = await mount({rail: 'slim', 'rail-menu-button': 'true'});
        el.shadowRoot.querySelector('.rail-menu').click();
        await el.updateComplete;
        await new Promise(r => setTimeout(r, 350));
        const label = el.shadowRoot.querySelector('.entry .label');
        expect(getComputedStyle(label).opacity).toBe('1');
        expect(label.getBoundingClientRect().width).toBeGreaterThan(0);
        box.remove();
        await park();
    });
});


/**
 * U94 — the drawer nav and the content area scroll with a THIN, themed
 * scrollbar.
 *
 * Reported on the midnight-blue theme: scrolling worked but the thumb was
 * invisible, because shadow-DOM content gets the platform default and nothing
 * tied the thumb to the theme. Asserted on computed style rather than by
 * screenshot: headless Linux draws overlay scrollbars (zero gutter, thumb only
 * while scrolling), so a pixel check here would prove nothing about the
 * Chrome/Windows bar this was reported against.
 */
describe('U94 — themed thin scrollbars', () => {
    const surfaces = el => ['.drawer', '.content']
        .map(sel => [sel, el.shadowRoot.querySelector(sel)]);

    /** The element's own CSS, as the browser parsed it. */
    function ownRules(el) {
        const sheets = el.shadowRoot.adoptedStyleSheets?.length
            ? [...el.shadowRoot.adoptedStyleSheets]
            : [...el.shadowRoot.querySelectorAll('style')].map(n => n.sheet).filter(Boolean);
        return sheets.flatMap(sheet => [...sheet.cssRules]);
    }

    it('both scroll surfaces ask for a thin scrollbar', async () => {
        const {el} = await mount({});
        for (const [sel, node] of surfaces(el)) expect(node, sel).toBeTruthy();

        // Asserted on the DECLARED rule, not the computed value: headless
        // Firefox hides scrollbars, which forces computed `scrollbar-width` to
        // `none` even for a bare `overflow:auto; scrollbar-width:thin` div in a
        // plain shadow root (verified — and CSS.supports still reports true).
        // A computed-value check there tests the browser, not this element.
        // `scrollbar-color` is not overridden, so those assertions stay
        // computed-value based below.
        const rule = ownRules(el).find(r =>
            r.selectorText && r.style?.scrollbarWidth &&
            r.selectorText.includes('.drawer') && r.selectorText.includes('.content'));
        expect(rule, 'a rule covering both scroll surfaces').toBeTruthy();
        expect(rule.style.scrollbarWidth).toBe('thin');
    });

    it('the thumb takes its colour from the theme, over a transparent track', async () => {
        const {el, box} = await mount({});
        box.style.setProperty('--secondary-text-color', 'rgb(159, 179, 200)');
        await new Promise(r => setTimeout(r, 50));
        for (const [sel, node] of surfaces(el)) {
            const color = getComputedStyle(node).scrollbarColor;
            expect(color, sel).toContain('rgb(159, 179, 200)');
            expect(color, sel).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
        }
    });

    it('the style knob overrides the theme default', async () => {
        const {el, box} = await mount({});
        box.style.setProperty('--feezal-app-scrollbar-color', 'rgb(255, 122, 24)');
        await new Promise(r => setTimeout(r, 50));
        for (const [sel, node] of surfaces(el)) {
            expect(getComputedStyle(node).scrollbarColor, sel).toContain('rgb(255, 122, 24)');
        }
    });

    it('declares the knob as a style descriptor, so the inspector offers it', () => {
        const styles = customElements.get('feezal-element-layout-app').feezal.styles;
        const knob = styles.find(s => s && s.property === '--feezal-app-scrollbar-color');
        expect(knob).toBeTruthy();
        expect(knob.default).toBe('var(--secondary-text-color)');
    });
});

/**
 * U37 — welcome tour component: spotlight/step machinery, event-driven
 * hands-on progression, seen-flag persistence. The editor is faked — the
 * tour only needs shadowRoot.querySelector targets and _setSidebar.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import '../src/feezal-welcome-tour.js';
import {STEPS} from '../src/feezal-welcome-tour.js';
import {setupFeezal, until} from './helpers.js';

let feezal;
let tour;
let fakeEditor;
let targets;

function makeTarget(left, top, width, height) {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed; left:${left}px; top:${top}px; width:${width}px; height:${height}px;`;
    document.body.append(el);
    return el;
}

beforeEach(() => {
    feezal = setupFeezal();
    localStorage.removeItem('feezalTourSeen');
    targets = {
        '#palette': makeTarget(0, 40, 200, 400),
        '#container-view': makeTarget(200, 40, 500, 400),
        '#sidebar-panels': makeTarget(700, 40, 260, 400),
        '#btn-deploy-wrap': makeTarget(600, 4, 90, 30),
        '#menu-right': makeTarget(700, 4, 260, 30),   // sidebar tab switcher (top bar)
    };
    fakeEditor = {
        paletteVisible: false,
        sidebarVisible: false,
        sidebar: '',
        _setSidebar(name) { this.sidebar = name; },
        shadowRoot: {querySelector: sel => targets[sel] ?? null},
        updateComplete: Promise.resolve(true),
    };
    tour = document.createElement('feezal-welcome-tour');
    tour.editor = fakeEditor;
    document.body.append(tour);
});

afterEach(() => {
    tour.stop();
});

describe('welcome tour (U37)', () => {
    it('starts with the centred welcome page: full dim, no spotlight cutout', async () => {
        expect(tour.hasAttribute('data-active')).toBe(false);
        tour.start();
        await tour.updateComplete;
        expect(tour.hasAttribute('data-active')).toBe(true);
        expect(STEPS[0].id).toBe('welcome');
        expect(tour.shadowRoot.querySelector('.spotlight')).toBeNull();
        expect(tour.shadowRoot.querySelector('.backdrop-full')).not.toBeNull();
        expect(tour.shadowRoot.querySelector('.card h3').textContent).toContain('Welcome');
    });

    it('the terminology page follows the welcome page: element/view/site, centred, no cutout', async () => {
        tour.start();
        await tour.updateComplete;
        tour._next();
        await tour.updateComplete;
        expect(STEPS[tour._step].id).toBe('terminology');
        expect(tour.shadowRoot.querySelector('.spotlight')).toBeNull();
        const terms = [...tour.shadowRoot.querySelectorAll('.terms dt')].map(dt => dt.textContent);
        expect(terms).toEqual(['Element', 'View', 'Site']);
        expect(tour.shadowRoot.querySelectorAll('.terms dd')).toHaveLength(3);
    });

    it('sidebar steps extend the spotlight up to the sidebar tab switcher', async () => {
        tour.start();
        tour._goto(STEPS.findIndex(s => s.id === 'inspector'));
        await tour.updateComplete;
        const spot = tour.shadowRoot.querySelector('.spotlight');
        expect(spot).not.toBeNull();
        // #sidebar-panels top is 40; #menu-right top is 4 → cutout reaches up
        // to include the switcher (minus PAD), not just the panels.
        expect(parseFloat(spot.style.top)).toBeLessThan(40);
        // bottom still covers the panels (40 + 400 = 440)
        const bottom = parseFloat(spot.style.top) + parseFloat(spot.style.height);
        expect(bottom).toBeGreaterThan(430);
        // all sidebar steps carry the extend
        for (const id of ['inspector', 'theme', 'broker', 'broker-status', 'wire-topic', 'template-content']) {
            expect(STEPS.find(s => s.id === id).extend).toBeDefined();
        }
    });

    it('the palette step shows the spotlight cutout', async () => {
        tour.start();
        tour._goto(STEPS.findIndex(s => s.id === 'palette'));
        await tour.updateComplete;
        expect(fakeEditor.paletteVisible).toBe(true);   // step prepare ran
        const spot = tour.shadowRoot.querySelector('.spotlight');
        expect(spot).not.toBeNull();
        // Cutout tracks the #palette rect (6px padding)
        expect(parseFloat(spot.style.left)).toBeCloseTo(-6, 0);
        expect(parseFloat(spot.style.width)).toBeCloseTo(212, 0);
    });

    it('spotlight carries the glow ring with arrive + breathe animations, re-created per step', async () => {
        tour.start();
        await tour.updateComplete;
        expect(tour.shadowRoot.querySelector('.glow')).toBeNull();   // welcome page: no cutout
        tour._goto(STEPS.findIndex(s => s.id === 'palette'));
        await tour.updateComplete;
        const glow = tour.shadowRoot.querySelector('.spotlight .glow');
        expect(glow).not.toBeNull();
        expect(getComputedStyle(glow).animationName).toContain('feezal-tour-arrive');
        tour._next();
        await tour.updateComplete;
        // keyed by step — a NEW node each step, so the arrival animation replays
        expect(tour.shadowRoot.querySelector('.spotlight .glow')).not.toBe(glow);
    });

    it('Next/Back walk the steps; sidebar steps switch the tab (U41: theme before broker)', async () => {
        tour.start();
        await tour.updateComplete;
        tour._goto(STEPS.findIndex(s => s.id === 'inspector'));
        await tour.updateComplete;
        expect(fakeEditor.sidebarVisible).toBe(true);
        expect(fakeEditor.sidebar).toBe('inspector');
        tour._goto(STEPS.findIndex(s => s.id === 'theme'));
        await tour.updateComplete;
        expect(fakeEditor.sidebar).toBe('themes');
        tour._next();  // theme → broker settings
        await tour.updateComplete;
        expect(fakeEditor.sidebar).toBe('viewer');
        tour._back();
        await tour.updateComplete;
        expect(tour._step).toBe(STEPS.findIndex(s => s.id === 'theme'));
    });

    it('non-interactive steps block clicks, interactive steps do not', async () => {
        tour.start();
        await tour.updateComplete;
        expect(tour.shadowRoot.querySelector('.click-catcher')).not.toBeNull();
        tour._goto(STEPS.findIndex(s => s.id === 'broker'));
        await tour.updateComplete;
        expect(tour.shadowRoot.querySelector('.click-catcher')).toBeNull();
    });

    it('U41: the drop step targets the palette Template entry, falling back to the palette', async () => {
        // Fake palette has no shadowRoot → the target falls back to #palette.
        const dropStep = STEPS.find(s => s.id === 'drop-template');
        expect(dropStep.target(fakeEditor)).toBe(targets['#palette']);
    });

    it('U41: broker step body does not tell the user to type a protocol prefix', () => {
        const broker = STEPS.find(s => s.id === 'broker');
        expect(broker.body).not.toContain('mqtt://');
        expect(STEPS.findIndex(s => s.id === 'theme'))
            .toBeLessThan(STEPS.findIndex(s => s.id === 'broker'));
    });

    it('Skip persists the seen-flag and hides the tour', async () => {
        tour.start();
        await tour.updateComplete;
        tour.stop();
        await tour.updateComplete;
        expect(tour.hasAttribute('data-active')).toBe(false);
        expect(localStorage.getItem('feezalTourSeen')).toBe('1');
    });

    it('hands-on: advances when a basic-template lands on the view', async () => {
        const view = document.createElement('div');
        document.body.append(view);
        feezal.view = view;
        tour.start();
        const dropIdx = STEPS.findIndex(s => s.advance === 'drop');
        tour._goto(dropIdx);
        await tour.updateComplete;

        view.append(document.createElement('feezal-element-basic-template'));
        await until(() => tour._step === dropIdx + 1);
        expect(tour._exerciseEl.localName).toBe('feezal-element-basic-template');
    });

    it('hands-on: the topic step advances as soon as subscribe is set', async () => {
        const el = document.createElement('feezal-element-basic-template');
        document.body.append(el);
        tour.start();
        const wireIdx = STEPS.findIndex(s => s.advance === 'subscribe');
        tour._exerciseEl = el;
        tour._goto(wireIdx);
        await tour.updateComplete;

        el.setAttribute('subscribe', 'home/livingroom/temperature');
        await until(() => tour._step === wireIdx + 1);
        expect(STEPS[tour._step].advance).toBe('template');
    });

    it('hands-on: the template step advances once the template has content', async () => {
        const el = document.createElement('feezal-element-basic-template');
        el.setAttribute('subscribe', 'stat/temp');
        document.body.append(el);
        tour.start();
        const tplIdx = STEPS.findIndex(s => s.advance === 'template');
        tour._exerciseEl = el;
        tour._goto(tplIdx);
        await tour.updateComplete;
        expect(tour._step).toBe(tplIdx);   // subscribe alone does not advance it

        const tpl = document.createElement('template');
        tpl.innerHTML = '${msg.payload}°C';
        el.append(tpl);
        await until(() => tour._step === tplIdx + 1);
    });

    it('the template step shows the copyable snippet; clicking copies it', async () => {
        const written = [];
        Object.defineProperty(navigator, 'clipboard', {
            value: {writeText: text => { written.push(text); return Promise.resolve(); }},
            configurable: true,
        });
        tour.start();
        tour._goto(STEPS.findIndex(s => s.id === 'template-content'));
        await tour.updateComplete;

        const snippet = tour.shadowRoot.querySelector('.snippet');
        expect(snippet).not.toBeNull();
        expect(snippet.querySelector('code').textContent).toBe('${msg.payload}°C');
        snippet.click();
        await until(() => written.length === 1);
        expect(written[0]).toBe('${msg.payload}°C');
        await tour.updateComplete;
        expect(snippet.querySelector('.copy-hint').textContent).toBe('Copied!');
    });

    it('step order: broker → status → deploy → hands-on (deploy follows the connection entry)', () => {
        const idx = id => STEPS.findIndex(s => s.id === id);
        expect(idx('broker')).toBeLessThan(idx('broker-status'));
        expect(idx('broker-status')).toBeLessThan(idx('deploy'));
        expect(idx('deploy')).toBeLessThan(idx('drop-template'));
        expect(idx('wire-topic')).toBeLessThan(idx('template-content'));
    });

    it('finishing the last step ends the tour and sets the seen-flag', async () => {
        tour.start();
        tour._goto(STEPS.length - 1);
        await tour.updateComplete;
        tour._next();   // "Done"
        expect(tour.hasAttribute('data-active')).toBe(false);
        expect(localStorage.getItem('feezalTourSeen')).toBe('1');
    });
});

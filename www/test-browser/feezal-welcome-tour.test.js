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
        tour._path = 'explore';   // U73: past the fork, the hands-on path
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
        for (const id of ['inspector', 'theme', 'wire-topic', 'template-content']) {
            expect(STEPS.find(s => s.id === id).extend).toBeDefined();
        }
    });

    it('the palette step shows the spotlight cutout', async () => {
        tour.start();
        tour._path = 'explore';
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
        tour._path = 'explore';
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

    it('Next/Back walk the steps; sidebar steps switch the tab', async () => {
        tour.start();
        tour._path = 'explore';
        await tour.updateComplete;
        tour._goto(STEPS.findIndex(s => s.id === 'inspector'));
        await tour.updateComplete;
        expect(fakeEditor.sidebarVisible).toBe(true);
        expect(fakeEditor.sidebar).toBe('inspector');
        tour._next();  // inspector → theme
        await tour.updateComplete;
        expect(fakeEditor.sidebar).toBe('themes');
        tour._back();
        await tour.updateComplete;
        expect(tour._current().id).toBe('inspector');
    });

    it('non-interactive steps block clicks, interactive steps do not', async () => {
        tour.start();
        tour._path = 'explore';
        await tour.updateComplete;
        expect(tour.shadowRoot.querySelector('.click-catcher')).not.toBeNull();
        tour._goto(STEPS.findIndex(s => s.id === 'theme'));   // interactive step
        await tour.updateComplete;
        expect(tour.shadowRoot.querySelector('.click-catcher')).toBeNull();
    });

    it('U41: the drop step targets the palette Template entry, falling back to the palette', async () => {
        // Fake palette has no shadowRoot → the target falls back to #palette.
        const dropStep = STEPS.find(s => s.id === 'drop-template');
        expect(dropStep.target(fakeEditor)).toBe(targets['#palette']);
    });

    it('the broker-connection steps are gone from the tour (handled by the connect dialog)', () => {
        for (const id of ['broker', 'broker-status', 'deploy']) {
            expect(STEPS.some(s => s.id === id)).toBe(false);
        }
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
        tour._path = 'explore';
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
        tour._path = 'explore';
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
        tour._path = 'explore';
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
        tour._path = 'explore';
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

    it('step order: theme precedes the hands-on drop, and wiring precedes content', () => {
        const idx = id => STEPS.findIndex(s => s.id === id);
        expect(idx('theme')).toBeLessThan(idx('drop-template'));
        expect(idx('drop-template')).toBeLessThan(idx('wire-topic'));
        expect(idx('wire-topic')).toBeLessThan(idx('template-content'));
    });

    it('finishing the last step ends the tour and sets the seen-flag', async () => {
        tour.start();
        tour._path = 'explore';
        tour._goto(tour._steps().length - 1);   // the explore path's last step (finish)
        await tour.updateComplete;
        tour._next();   // "Done"
        expect(tour.hasAttribute('data-active')).toBe(false);
        expect(localStorage.getItem('feezalTourSeen')).toBe('1');
    });
});

describe('welcome tour (U73) — fork + autogenerate branch', () => {
    const idInSteps = id => tour._steps().findIndex(s => s.id === id);

    it('a fork step sits right after terminology, with two path choices and no Next', async () => {
        tour.start();
        tour._next();   // welcome → terminology
        tour._next();   // → fork
        await tour.updateComplete;
        expect(tour._current().id).toBe('fork');
        const choices = tour.shadowRoot.querySelectorAll('.fork-choice');
        expect(choices).toHaveLength(2);
        expect(tour.shadowRoot.querySelector('button.primary')).toBeNull();   // no Next on the fork
    });

    it('choosing "explore" reveals the hands-on steps (palette next)', async () => {
        tour.start();
        tour._goto(idInSteps('fork'));
        tour._choosePath('explore');
        await tour.updateComplete;
        expect(tour._path).toBe('explore');
        expect(tour._current().id).toBe('palette');
        expect(tour._steps().some(s => s.id === 'discovery-wait')).toBe(false);
    });

    it('choosing "autogenerate" skips the UI/hands-on steps and goes straight to discovery', async () => {
        tour.start();
        tour._goto(idInSteps('fork'));
        tour._choosePath('auto');
        await tour.updateComplete;
        expect(tour._path).toBe('auto');
        expect(tour._current().id).toBe('discovery-wait');   // no broker steps anymore
        const ids = tour._steps().map(s => s.id);
        expect(ids).toEqual(['welcome', 'terminology', 'fork', 'discovery-wait', 'generate']);
        expect(ids).not.toContain('palette');
        expect(ids).not.toContain('drop-template');
        expect(ids).not.toContain('broker');
    });

    it('discovery-wait advances to Generate once devices are discovered', async () => {
        let n = 0;
        const orig = window.fetch;
        window.fetch = async url => {
            if (String(url).includes('/api/discovery/devices')) {
                return {ok: true, json: async () => ({devices: n++ >= 1 ? [{discovery_id: 'x'}] : []})};
            }
            return {ok: false, json: async () => ({})};
        };
        // a stub generate dialog so the Generate step doesn't blow up
        targets['feezal-generate-dialog'] = {
            open() {}, _chooseApp() {}, _stage: 'app',
            updateComplete: Promise.resolve(true),
            shadowRoot: {querySelector: () => ({open: true})},
        };
        try {
            tour.start();
            tour._goto(idInSteps('fork'));
            tour._choosePath('auto');
            tour._goto(tour._steps().findIndex(s => s.id === 'discovery-wait'));
            await until(() => tour._current()?.id === 'generate', {timeout: 8000});
            expect(tour._current().id).toBe('generate');
        } finally {
            window.fetch = orig;
            delete targets['feezal-generate-dialog'];
        }
    });

    it('the discovery-wait bail-out lands the user in the editor', async () => {
        window.fetch = async () => ({ok: true, json: async () => ({devices: []})});
        tour.start();
        tour._goto(idInSteps('fork'));
        tour._choosePath('auto');
        tour._goto(tour._steps().findIndex(s => s.id === 'discovery-wait'));
        await tour.updateComplete;
        const bail = tour.shadowRoot.querySelector('.bailout button');
        expect(bail).not.toBeNull();
        bail.click();
        expect(tour.hasAttribute('data-active')).toBe(false);
        expect(localStorage.getItem('feezalTourSeen')).toBe('1');
    });

    it('the Generate step opens the dialog at the NEW-SITE App flow and ends the tour (B124)', async () => {
        let opened = false, choseNewSite = false, choseApp = false;
        const gen = {
            open() { opened = true; },
            _chooseAppOnNewSite() { choseNewSite = true; },
            _chooseApp() { choseApp = true; },
            _stage: 'app',
            updateComplete: Promise.resolve(true),
            shadowRoot: {querySelector: () => ({open: true})},
        };
        targets['feezal-generate-dialog'] = gen;
        try {
            tour.start();
            tour._path = 'auto';
            tour._goto(tour._steps().findIndex(s => s.id === 'generate'));
            await gen.updateComplete;
            await tour.updateComplete;
            expect(opened).toBe(true);
            // B124: the SAME flow as the Generate button's App tile — site-name
            // question + deferred create + auto-deploy — never the generate-in-
            // place path that left the site undeployed (white viewer, issue #4).
            expect(choseNewSite).toBe(true);
            expect(choseApp).toBe(false);
            // The tour ends at the hand-off (the flow's site switch reloads the
            // editor) and is marked seen so the reload cannot re-open it.
            expect(tour.hasAttribute('data-active')).toBe(false);
            expect(localStorage.getItem('feezalTourSeen')).toBe('1');
            // Nothing rendered — the dialog owns the screen.
            expect(tour.shadowRoot.querySelector('.card')).toBeNull();
            expect(tour.shadowRoot.querySelector('.backdrop-full')).toBeNull();
        } finally {
            delete targets['feezal-generate-dialog'];
        }
    });
});

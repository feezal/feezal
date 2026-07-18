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
    it('starts hidden and shows the first step (palette) on start()', async () => {
        expect(tour.hasAttribute('data-active')).toBe(false);
        tour.start();
        await tour.updateComplete;
        expect(tour.hasAttribute('data-active')).toBe(true);
        expect(fakeEditor.paletteVisible).toBe(true);   // step prepare ran
        const spot = tour.shadowRoot.querySelector('.spotlight');
        expect(spot).not.toBeNull();
        // Cutout tracks the #palette rect (6px padding)
        expect(parseFloat(spot.style.left)).toBeCloseTo(-6, 0);
        expect(parseFloat(spot.style.width)).toBeCloseTo(212, 0);
        expect(tour.shadowRoot.querySelector('.card h3').textContent).toBe(STEPS[0].title);
    });

    it('Next/Back walk the steps; sidebar steps switch the tab', async () => {
        tour.start();
        await tour.updateComplete;
        tour._next();
        tour._next();  // step 2 → inspector
        await tour.updateComplete;
        expect(tour._step).toBe(2);
        expect(fakeEditor.sidebarVisible).toBe(true);
        expect(fakeEditor.sidebar).toBe('inspector');
        tour._next();
        tour._next();  // step 4 → broker settings
        await tour.updateComplete;
        expect(fakeEditor.sidebar).toBe('viewer');
        tour._back();
        await tour.updateComplete;
        expect(tour._step).toBe(3);
    });

    it('non-interactive steps block clicks, interactive steps do not', async () => {
        tour.start();
        await tour.updateComplete;
        expect(tour.shadowRoot.querySelector('.click-catcher')).not.toBeNull();
        tour._goto(4);  // broker step — interactive
        await tour.updateComplete;
        expect(tour.shadowRoot.querySelector('.click-catcher')).toBeNull();
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

    it('hands-on: advances once subscribe AND template content are set', async () => {
        const el = document.createElement('feezal-element-basic-template');
        document.body.append(el);
        tour.start();
        const wireIdx = STEPS.findIndex(s => s.advance === 'subscribe');
        tour._exerciseEl = el;
        tour._goto(wireIdx);
        await tour.updateComplete;

        el.setAttribute('subscribe', 'stat/temp');
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(tour._step).toBe(wireIdx);   // template content still missing

        const tpl = document.createElement('template');
        tpl.innerHTML = '${msg.payload} °C';
        el.append(tpl);
        await until(() => tour._step === wireIdx + 1);
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

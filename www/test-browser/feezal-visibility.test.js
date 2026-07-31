/**
 * N37 — pause subscriptions of hidden views (viewer bandwidth saver): the
 * central FeezalVisibility controller + the FeezalElement pause/resume
 * machinery. View-level granularity, grace period, `never` escape hatch,
 * instant resume via reconnect cycle + B40 cache repaint, and the
 * connectedCallback precondition for elements stamped into a paused view.
 * (Each element wires several topics — payload + control subtopics — so all
 * assertions are RELATIVE subscription counts.)
 */
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import '../src/feezal-view.js';
import '@feezal/feezal-element-material-chip';
import {FeezalVisibility} from '../src/feezal-visibility.js';
import {setupFeezal} from './helpers.js';

let feezal;
let site;
let vis;

const subs = () => feezal.connection.subCount();

function makeSite({pause = true, lazy = false, grace = '0'} = {}) {
    site = document.createElement('div');
    if (pause) site.setAttribute('pause-hidden-subscriptions', '');
    if (lazy) site.setAttribute('lazy-view-subscriptions', '');
    site.setAttribute('pause-grace-seconds', grace);
    site.view = 'a';
    site.setAttribute('view', 'a');
    document.body.append(site);
    feezal.site = site;
    return site;
}

function addView(name, attrs = {}) {
    const view = document.createElement('feezal-view');
    view.setAttribute('name', name);
    for (const [k, v] of Object.entries(attrs)) view.setAttribute(k, v);
    site.append(view);
    return view;
}

function addChip(view, topic) {
    const el = document.createElement('feezal-element-material-chip');
    el.setAttribute('subscribe', topic);
    view.append(el);
    return el;
}

function switchView(name) {
    site.view = name;
    site.setAttribute('view', name);
    vis.update();   // deterministic in tests (no MutationObserver tick wait)
}

function attach(v) {
    vis = v;
    feezal.visibility = v;   // the connectedCallback precondition reads this
    return v;
}

beforeEach(() => {
    feezal = setupFeezal();
    vi.useFakeTimers();
});

afterEach(() => {
    vis?.dispose();
    vis = null;
    if (window.feezal) window.feezal.visibility = null;
    vi.useRealTimers();
});

describe('N37 — FeezalVisibility', () => {
    it('pauses a hidden view after the grace period and resumes instantly on show', async () => {
        makeSite({grace: '5'});
        const a = addView('a');
        const b = addView('b');
        addChip(a, 'stat/a');
        const chipB = addChip(b, 'stat/b');
        await chipB.updateComplete;
        const full = subs();
        feezal.connection.deliver('stat/b', 'ON');      // warm the cache for the repaint

        attach(new FeezalVisibility(site));
        expect(subs()).toBe(full);                      // grace running — nothing paused yet
        vi.advanceTimersByTime(5000);
        const paused = subs();
        expect(paused).toBeLessThan(full);              // hidden b unsubscribed
        expect(chipB.__n37Paused).toBe(true);

        switchView('b');                                // show b → immediate resume
        await chipB.updateComplete;
        expect(chipB.__n37Paused).toBe(false);
        expect(subs()).toBe(full);
    });

    it('a quick back-and-forth inside the grace period never churns', async () => {
        makeSite({grace: '30'});
        addView('a');
        const b = addView('b');
        const chip = addChip(b, 'stat/b');
        await chip.updateComplete;
        const full = subs();
        attach(new FeezalVisibility(site));
        vi.advanceTimersByTime(10_000);
        switchView('b');                                // back before the grace expired
        vi.advanceTimersByTime(60_000);
        expect(subs()).toBe(full);                      // never unsubscribed
    });

    it('pause-subscriptions="never" keeps a hidden view subscribed (warm-cache escape hatch)', async () => {
        makeSite({grace: '0'});
        addView('a');
        const b = addView('b', {'pause-subscriptions': 'never'});
        const chip = addChip(b, 'stat/b');
        await chip.updateComplete;
        const full = subs();
        attach(new FeezalVisibility(site));
        vi.advanceTimersByTime(1000);
        expect(subs()).toBe(full);
    });

    it('pause-subscriptions="always" pauses even when the site default is off; inherit stays live', async () => {
        makeSite({pause: false, grace: '0'});
        addView('a');
        const b = addView('b', {'pause-subscriptions': 'always'});
        const chipB = addChip(b, 'stat/b');
        const c = addView('c');                         // inherit + site off → stays
        const chipC = addChip(c, 'stat/c');
        await chipC.updateComplete;
        const full = subs();
        attach(new FeezalVisibility(site));
        vi.advanceTimersByTime(1000);
        expect(subs()).toBeLessThan(full);
        expect(chipB.__n37Paused).toBe(true);
        expect(chipC.__n37Paused).toBe(false);
    });

    it('an element stamped INTO an already-paused view does not subscribe (precondition)', async () => {
        makeSite({grace: '0'});
        addView('a');
        const b = addView('b');
        attach(new FeezalVisibility(site));
        vi.advanceTimersByTime(1000);
        const before = subs();

        const late = addChip(b, 'stat/late');
        await late.updateComplete;
        expect(subs()).toBe(before);                    // did not subscribe
        expect(late.__n37Paused).toBe(true);

        switchView('b');                                // resume wires it
        await late.updateComplete;
        expect(subs()).toBeGreaterThan(before);
        expect(late.__n37Paused).toBe(false);
    });
});

describe('N40 — lazy view subscriptions', () => {
    it('an initially-hidden view is paused immediately (no grace), the active view stays', async () => {
        makeSite({pause: false, lazy: true, grace: '30'});
        const a = addView('a');
        const chipA = addChip(a, 'stat/a');
        const b = addView('b');
        const chipB = addChip(b, 'stat/b');
        await chipB.updateComplete;
        const full = subs();

        attach(new FeezalVisibility(site));
        // no timer advance — lazy pauses the never-shown hidden view synchronously
        expect(subs()).toBeLessThan(full);
        expect(chipB.__n37Paused).toBe(true);
        expect(chipA.__n37Paused).toBe(false);
    });

    it('lazy-only: subscribes on first reveal, then stays warm on a later hide', async () => {
        makeSite({pause: false, lazy: true, grace: '30'});
        addView('a');
        const b = addView('b');
        const chipB = addChip(b, 'stat/b');
        await chipB.updateComplete;
        const full = subs();

        attach(new FeezalVisibility(site));
        expect(subs()).toBeLessThan(full);              // lazy-paused at load
        switchView('b');
        await chipB.updateComplete;
        expect(subs()).toBe(full);                      // first reveal → subscribes
        expect(chipB.__n37Paused).toBe(false);
        switchView('a');                                // hide again — pause OFF, already seen
        vi.advanceTimersByTime(60_000);
        expect(subs()).toBe(full);                      // stays warm
    });

    it('lazy-subscriptions="never" subscribes eagerly from load', async () => {
        makeSite({pause: false, lazy: true, grace: '0'});
        addView('a');
        const b = addView('b', {'lazy-subscriptions': 'never'});
        const chipB = addChip(b, 'stat/b');
        await chipB.updateComplete;
        const full = subs();

        attach(new FeezalVisibility(site));
        vi.advanceTimersByTime(1000);
        expect(subs()).toBe(full);                      // eager despite the site default
        expect(chipB.__n37Paused).toBe(false);
    });

    it('lazy-subscriptions="always" defers even when the site default is off', async () => {
        makeSite({pause: false, lazy: false, grace: '0'});
        addView('a');
        const b = addView('b', {'lazy-subscriptions': 'always'});
        const chipB = addChip(b, 'stat/b');
        const c = addView('c');                          // inherit + site off → eager
        const chipC = addChip(c, 'stat/c');
        await chipC.updateComplete;
        const full = subs();

        attach(new FeezalVisibility(site));
        expect(subs()).toBeLessThan(full);
        expect(chipB.__n37Paused).toBe(true);
        expect(chipC.__n37Paused).toBe(false);
    });

    it('true lazy (controller-first): an element in a hidden lazy view never subscribes until shown', async () => {
        makeSite({pause: false, lazy: true, grace: '0'});
        addView('a');
        const b = addView('b');
        attach(new FeezalVisibility(site));             // controller marks b lazy-paused (no elements yet)
        const before = subs();

        const chip = addChip(b, 'stat/lazy');           // element connects INTO the paused view
        await chip.updateComplete;
        expect(subs()).toBe(before);                    // the isPaused precondition skipped the subscribe
        expect(chip.__n37Paused).toBe(true);

        switchView('b');
        await chip.updateComplete;
        expect(subs()).toBeGreaterThan(before);         // first reveal wires it
        expect(chip.__n37Paused).toBe(false);
    });

    it('composes with N37: initial hide is immediate (lazy), a re-hide uses the grace (pause)', async () => {
        makeSite({pause: true, lazy: true, grace: '5'});
        addView('a');
        const b = addView('b');
        const chipB = addChip(b, 'stat/b');
        await chipB.updateComplete;
        const full = subs();

        attach(new FeezalVisibility(site));
        expect(subs()).toBeLessThan(full);              // lazy: immediate at load
        switchView('b');
        await chipB.updateComplete;
        expect(subs()).toBe(full);                      // revealed
        switchView('a');                                // re-hide → grace pause (N37)
        expect(subs()).toBe(full);                      // grace still running
        vi.advanceTimersByTime(5000);
        expect(subs()).toBeLessThan(full);              // now paused
    });
});

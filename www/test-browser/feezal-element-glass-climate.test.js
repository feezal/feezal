/**
 * E102 — glass-climate per-entry mode-descriptor model + momentary boost,
 * ported from material-climate. Mirrors the material-climate E102 test
 * suite (see feezal-element-circle-climate.test.js).
 */
import {describe, it, expect, beforeEach, vi} from 'vitest';
import '../packages/@feezal/feezal-element-glass-climate/feezal-element-glass-climate.js';
import {setupFeezal, mount} from './helpers.js';

let feezal;
beforeEach(() => { feezal = setupFeezal(); });

describe('glass-climate valve scaling (E102 WP1)', () => {
    it('separate-topic valve scales via valve-min/max and renders the popup line', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate', 'subscribe-valve': 'stat/level', 'valve-max': '1',
        });
        feezal.connection.deliver('stat/level', '0.5');
        await el.updateComplete;
        expect(el.climate.valve).toBe(50);
        el.openDetails();
        await el.updateComplete;
        const txt = el.renderRoot.textContent;
        expect(txt).toContain('Valve');
        expect(txt).toContain('50');
    });

    it('defaults 0–100 pass through unchanged (BidCoS VALVE_STATE)', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate', 'subscribe-valve': 'stat/v',
        });
        feezal.connection.deliver('stat/v', '73');
        await el.updateComplete;
        expect(el.climate.valve).toBe(73);
    });

    it('scales the valve read from a JSON payload too (position key)', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'json', subscribe: 'stat/t', 'valve-max': '1',
            'json-map': JSON.stringify({valve: 'level'}),
        });
        feezal.connection.deliver('stat/t', {level: 0.25});
        await el.updateComplete;
        expect(el.climate.valve).toBe(25);
    });

    it('nothing valve-related renders while subscribe-valve is unset', async () => {
        const el = await mount('feezal-element-glass-climate', {'payload-mode': 'separate'});
        expect(el.climate.valve).toBeNull();
        el.openDetails();
        await el.updateComplete;
        expect(el.renderRoot.textContent).not.toContain('Valve');
    });
});

describe('glass-climate per-entry mode descriptors (E102)', () => {
    it('a plain mode entry still publishes the value on publish-mode (unchanged)', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate', 'publish-mode': 'cmd/mode',
            modes: JSON.stringify([{value: 'heat', label: 'Heat'}]),
        });
        const published = [];
        feezal.connection.pub = (t, p) => published.push({t, p});
        el.climate.setMode({value: 'heat'});
        expect(published).toContainEqual({t: 'cmd/mode', p: 'heat'});
    });

    it('a per-entry publish/payload writes that datapoint; $setpoint resolves to the last real setpoint', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate', 'subscribe-setpoint': 'stat/sp',
            modes: JSON.stringify([{value: 1, label: 'Manu', publish: 'hm/set/TRV/4/MANU_MODE', payload: '$setpoint'}]),
        });
        feezal.connection.deliver('stat/sp', '21.5');   // remembers 21.5
        await el.updateComplete;
        const published = [];
        feezal.connection.pub = (t, p) => published.push({t, p});
        el.climate.setMode(el.climate.parsedModes()[0]);
        expect(published).toContainEqual({t: 'hm/set/TRV/4/MANU_MODE', p: '21.5'});
    });

    it('an object payload is published as JSON with $setpoint substituted (putParamset)', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate', 'subscribe-setpoint': 'stat/sp',
            modes: JSON.stringify([{value: 1, label: 'Off',
                publish: 'hm/paramset/WTH:1/VALUES', payload: {CONTROL_MODE: 1, SET_POINT_TEMPERATURE: 4.5}}]),
        });
        feezal.connection.deliver('stat/sp', '22');
        await el.updateComplete;
        const published = [];
        feezal.connection.pub = (t, p) => published.push({t, p});
        el.climate.setMode(el.climate.parsedModes()[0]);
        expect(published[0].t).toBe('hm/paramset/WTH:1/VALUES');
        expect(JSON.parse(published[0].p)).toEqual({CONTROL_MODE: 1, SET_POINT_TEMPERATURE: 4.5});
    });

    it('a momentary boost toggles: activate publishes, deactivate restores the pre-boost mode', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate', 'publish-mode': 'cmd/mode',
            modes: JSON.stringify([
                {value: 'auto', label: 'Auto'},
                {value: 'boost', label: 'Boost', momentary: true, publish: 'hm/set/TRV/4/BOOST_MODE', payload: 'true', off: 'restore'},
            ]),
        });
        el.climate.mode = 'auto';                       // pre-boost read-back
        const published = [];
        feezal.connection.pub = (t, p) => published.push({t, p});
        const boost = el.climate.parsedModes().find(m => m.momentary);

        el.climate.setMode(boost);                      // activate
        expect(el.climate.momentaryActive).toBe('boost');
        expect(published).toContainEqual({t: 'hm/set/TRV/4/BOOST_MODE', p: 'true'});

        published.length = 0;
        el.climate.setMode(boost);                      // deactivate → restore 'auto' on publish-mode
        expect(el.climate.momentaryActive).toBeNull();
        expect(published).toContainEqual({t: 'cmd/mode', p: 'auto'});
    });

    it('a momentary entry with off:{publish,payload} publishes the off write on deactivate (HmIP)', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate',
            modes: JSON.stringify([{value: 'boost', label: 'Boost', momentary: true,
                publish: 'hm/set/eTRV/1/BOOST_MODE', payload: 'true',
                off: {publish: 'hm/set/eTRV/1/BOOST_MODE', payload: 'false'}}]),
        });
        const published = [];
        feezal.connection.pub = (t, p) => published.push({t, p});
        const boost = el.climate.parsedModes()[0];
        el.climate.setMode(boost);
        el.climate.setMode(boost);
        expect(published).toContainEqual({t: 'hm/set/eTRV/1/BOOST_MODE', p: 'true'});
        expect(published).toContainEqual({t: 'hm/set/eTRV/1/BOOST_MODE', p: 'false'});
    });
});

describe('glass-climate boost countdown badge (E102 WP2)', () => {
    const boostModes = JSON.stringify([{value: 'boost', label: 'Boost', momentary: true,
        publish: 'hm/set/TRV/4/BOOST_MODE', payload: 'true',
        off: {publish: 'hm/set/TRV/4/BOOST_MODE', payload: 'false'}}]);

    it('activating a momentary entry with no device topic starts a client countdown (mm:ss badge)', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate', 'boost-duration': '5', modes: boostModes,
        });
        vi.useFakeTimers();
        try {
            el.climate.setMode(el.climate.parsedModes()[0]);          // activate
            expect(el.climate.boostRemaining).toBe(300);       // 5 min → 300 s
            vi.advanceTimersByTime(3000);
            expect(el.climate.boostRemaining).toBe(297);
            expect(el.climate.boostBadge()).toBe('04:57');
            el.openDetails();
            await el.updateComplete;
            expect(el.renderRoot.querySelector('.modes button.active .boost-badge')?.textContent).toBe('04:57');
        } finally { vi.useRealTimers(); }
    });

    it('a wired subscribe-boost-remaining message overrides with the device value (converted per unit)', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate',
            'subscribe-boost-remaining': 'stat/boost', 'boost-remaining-unit': 'minutes', modes: boostModes,
        });
        el.climate.setMode(el.climate.parsedModes()[0]);              // activate — device topic wired → no client timer
        expect(el.climate._boostTimer).toBeNull();
        feezal.connection.deliver('stat/boost', '3');   // 3 minutes → 180 s
        await el.updateComplete;
        expect(el.climate.boostRemaining).toBe(180);
        expect(el.climate.boostBadge()).toBe('03:00');

        el.setAttribute('boost-remaining-unit', 'seconds');
        feezal.connection.deliver('stat/boost', '90');  // 90 seconds as-is
        await el.updateComplete;
        expect(el.climate.boostRemaining).toBe(90);
        expect(el.climate.boostBadge()).toBe('01:30');
    });

    it('deactivation clears the badge/timer', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate', 'boost-duration': '5', modes: boostModes,
        });
        vi.useFakeTimers();
        try {
            const boost = el.climate.parsedModes()[0];
            el.climate.setMode(boost);                         // activate
            expect(el.climate.boostRemaining).toBe(300);
            el.climate.setMode(boost);                         // deactivate
            expect(el.climate.boostRemaining).toBeNull();
            expect(el.climate._boostTimer).toBeNull();
        } finally { vi.useRealTimers(); }
    });

    it('disconnect clears the interval', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate', 'boost-duration': '5', modes: boostModes,
        });
        vi.useFakeTimers();
        try {
            el.climate.setMode(el.climate.parsedModes()[0]);          // activate → interval running
            expect(el.climate._boostTimer).not.toBeNull();
            el.remove();                                // disconnectedCallback
            expect(el.climate._boostTimer).toBeNull();
        } finally { vi.useRealTimers(); }
    });
});

describe('glass-climate match-setpoint-max mode display (E102)', () => {
    // Off shares mode read-back value 1 with Manu, but carries match-setpoint-max.
    const modes = JSON.stringify([
        {value: 1, label: 'Manu'},
        {value: 1, label: 'Off', 'match-setpoint-max': 4.5},
    ]);

    it('shows Off active when the setpoint is <= 4.5, Manu active above it', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate',
            'subscribe-mode': 'stat/mode', 'subscribe-setpoint': 'stat/sp', modes,
        });
        feezal.connection.deliver('stat/mode', '1');
        feezal.connection.deliver('stat/sp', '4.5');    // off sentinel
        el.openDetails();
        await el.updateComplete;
        let active = [...el.renderRoot.querySelectorAll('.modes button.active')];
        expect(active.map(b => b.textContent.trim())).toEqual(['Off']);

        feezal.connection.deliver('stat/sp', '20');     // real setpoint → Manu
        await el.updateComplete;
        active = [...el.renderRoot.querySelectorAll('.modes button.active')];
        expect(active.map(b => b.textContent.trim())).toEqual(['Manu']);
    });
});

describe('glass-climate state line renders the mode LABEL (B57)', () => {
    const modes = JSON.stringify([{value: 0, label: 'Auto'}, {value: 1, label: 'Manu'}]);

    it('a numeric Homematic mode read-back shows its label, not the raw number', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate',
            'subscribe-mode': 'stat/mode', 'subscribe-setpoint': 'stat/sp', modes,
        });
        feezal.connection.deliver('stat/sp', '21.5');
        feezal.connection.deliver('stat/mode', '1');
        await el.updateComplete;
        const state = el.renderRoot.querySelector('.state').textContent;
        expect(state).toContain('• Manu');
        expect(state).not.toContain('• 1');
    });

    it('mode 0 (Auto) is not hidden by a truthiness guard', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate',
            'subscribe-mode': 'stat/mode', 'subscribe-setpoint': 'stat/sp', modes,
        });
        feezal.connection.deliver('stat/sp', '21.5');
        feezal.connection.deliver('stat/mode', '0');
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.state').textContent).toContain('• Auto');
    });

    it('an unknown mode read-back still shows the raw value', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate',
            'subscribe-mode': 'stat/mode', 'subscribe-setpoint': 'stat/sp', modes,
        });
        feezal.connection.deliver('stat/mode', 'eco');
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.state').textContent).toContain('• eco');
    });
});

describe('glass-climate Off sentinel (B53) + value-0 sanitizing (B55)', () => {
    const modes = JSON.stringify([
        {value: 0, label: 'Auto'},
        {value: 1, label: 'Manu'},
        {value: 1, label: 'Off', 'match-setpoint-max': 4.5},
    ]);

    it('keeps the {value: 0} Auto entry (B55) and renders its popup button', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate', 'subscribe-mode': 'stat/mode', modes,
        });
        expect(el.climate.parsedModes().map(m => m.label)).toEqual(['Auto', 'Manu', 'Off']);
        el.openDetails();
        await el.updateComplete;
        const labels = [...el.renderRoot.querySelectorAll('.modes button')].map(b => b.textContent.trim());
        expect(labels).toContain('Auto');
    });

    it('while Off is active the state line shows the label and no target temperature', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate',
            'subscribe-mode': 'stat/mode', 'subscribe-setpoint': 'stat/sp', modes,
        });
        feezal.connection.deliver('stat/sp', '21');     // remembered real setpoint
        feezal.connection.deliver('stat/mode', '1');
        feezal.connection.deliver('stat/sp', '4.5');    // wall dial → Off
        await el.updateComplete;
        const state = el.renderRoot.querySelector('.state').textContent;
        expect(state).toContain('Off');
        expect(state).not.toContain('→');
        expect(state).not.toContain('4.5');

        // The popup pill shows the label instead of 4.5° too.
        el.openDetails();
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.vslider .sp').textContent.trim()).toBe('Off');
    });
});

describe('glass-climate $setpoint type preservation (B58)', () => {
    it('a bare $setpoint inside an object payload substitutes as a JSON NUMBER (HmIP putParamset)', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate', 'subscribe-setpoint': 'stat/sp',
            modes: JSON.stringify([{value: 1, label: 'Manu',
                publish: 'hm/paramset/WTH:1/VALUES', payload: {CONTROL_MODE: 1, SET_POINT_TEMPERATURE: '$setpoint'}}]),
        });
        feezal.connection.deliver('stat/sp', '17');
        await el.updateComplete;
        const published = [];
        feezal.connection.pub = (t, p) => published.push({t, p});
        el.climate.setMode(el.climate.parsedModes()[0]);
        const obj = JSON.parse(published[0].p);
        expect(obj.SET_POINT_TEMPERATURE).toBe(17);
        expect(typeof obj.SET_POINT_TEMPERATURE).toBe('number');
    });
});

describe('glass-climate device-reported boost state (B54)', () => {
    const modes = JSON.stringify([
        {value: 0, label: 'Auto'},
        {value: 3, label: 'Boost', momentary: true, publish: 'hm/set/x/BOOST_MODE', payload: 'true',
            off: {publish: 'hm/set/x/BOOST_MODE', payload: 'false'}},
    ]);

    it('BOOST_MODE true forces the boost button active; a Manu read-back does not clear it', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate',
            'subscribe-mode': 'stat/mode', 'subscribe-boost-state': 'stat/boost', modes,
        });
        feezal.connection.deliver('stat/boost', 'true');
        feezal.connection.deliver('stat/mode', '1');    // HmIP keeps reporting Manu during boost
        el.openDetails();
        await el.updateComplete;
        expect(el.climate.boostForced).toBe(true);
        const active = [...el.renderRoot.querySelectorAll('.modes button.active')];
        expect(active.some(b => b.textContent.includes('Boost'))).toBe(true);

        feezal.connection.deliver('stat/boost', 'false');
        await el.updateComplete;
        expect(el.climate.boostForced).toBe(false);
        expect(el.climate.boostRemaining).toBeNull();
    });
});

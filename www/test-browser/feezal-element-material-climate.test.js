/**
 * E102 (partial) — material-climate valve-min/valve-max scaling. HmIP reports
 * the valve as LEVEL 0…1, BidCoS as VALVE_STATE 0–100; both must show 0–100 %.
 */
import {describe, it, expect, beforeEach, vi} from 'vitest';
import '../packages/@feezal/feezal-element-material-climate/feezal-element-material-climate.js';
import {setupFeezal, mount} from './helpers.js';

let feezal;
beforeEach(() => { feezal = setupFeezal(); });

describe('material-climate valve scaling (E102)', () => {
    it('defaults 0–100 pass through unchanged (BidCoS VALVE_STATE)', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t', 'subscribe-valve': 'stat/valve',
        });
        feezal.connection.deliver('stat/valve', '73');
        await el.updateComplete;
        expect(el.climate.valve).toBe(73);
    });

    it('scales HmIP LEVEL 0…1 to 0–100 % when valve-max=1', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t',
            'subscribe-valve': 'stat/level', 'valve-max': '1',
        });
        feezal.connection.deliver('stat/level', '0.5');
        await el.updateComplete;
        expect(el.climate.valve).toBe(50);
        feezal.connection.deliver('stat/level', '1');
        await el.updateComplete;
        expect(el.climate.valve).toBe(100);
    });

    it('clamps out-of-range values and survives a zero span', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t',
            'subscribe-valve': 'stat/v', 'valve-min': '0', 'valve-max': '1',
        });
        feezal.connection.deliver('stat/v', '2');       // > max
        await el.updateComplete;
        expect(el.climate.valve).toBe(100);

        el.setAttribute('valve-max', '0');                                // degenerate span → passthrough+clamp
        feezal.connection.deliver('stat/v', '42');
        await el.updateComplete;
        expect(el.climate.valve).toBe(42);
    });

    it('scales the valve read from a JSON payload too', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'json', subscribe: 'stat/t', 'valve-max': '1',
            'json-map': JSON.stringify({valve: 'level'}),
        });
        feezal.connection.deliver('stat/t', {level: 0.25});
        await el.updateComplete;
        expect(el.climate.valve).toBe(25);
    });
});

describe('material-climate per-entry mode descriptors (E102)', () => {
    it('a plain mode entry still publishes the value on publish-mode (unchanged)', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t',
            'publish-mode': 'cmd/mode', modes: JSON.stringify([{value: 'heat', label: 'Heat'}]),
        });
        const published = [];
        feezal.connection.pub = (t, p) => published.push({t, p});
        el.climate.setMode({value: 'heat'});
        expect(published).toContainEqual({t: 'cmd/mode', p: 'heat'});
    });

    it('a per-entry publish/payload writes that datapoint; $setpoint resolves to the last real setpoint', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t', 'subscribe-setpoint': 'stat/sp',
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
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t', 'subscribe-setpoint': 'stat/sp',
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
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t', 'publish-mode': 'cmd/mode',
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
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t',
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

describe('material-climate boost countdown badge (E102 WP2)', () => {
    const boostModes = JSON.stringify([{value: 'boost', label: 'Boost', momentary: true,
        publish: 'hm/set/TRV/4/BOOST_MODE', payload: 'true',
        off: {publish: 'hm/set/TRV/4/BOOST_MODE', payload: 'false'}}]);

    it('activating a momentary entry with no device topic starts a client countdown (mm:ss badge)', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t', 'boost-duration': '5', modes: boostModes,
        });
        vi.useFakeTimers();
        try {
            el.climate.setMode(el.climate.parsedModes()[0]);          // activate
            expect(el.climate.boostRemaining).toBe(300);       // 5 min → 300 s
            vi.advanceTimersByTime(3000);
            expect(el.climate.boostRemaining).toBe(297);
            expect(el.climate.boostBadge()).toBe('04:57');
            await el.updateComplete;
            const label = el.renderRoot.querySelector('md-filter-chip[selected]')?.getAttribute('label') || '';
            expect(label).toContain('04:57');
        } finally { vi.useRealTimers(); }
    });

    it('a wired subscribe-boost-remaining message overrides with the device value (converted per unit)', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t',
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
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t', 'boost-duration': '5', modes: boostModes,
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
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t', 'boost-duration': '5', modes: boostModes,
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

describe('material-climate match-setpoint-max mode display (E102)', () => {
    // Off shares mode read-back value 1 with Manu, but carries match-setpoint-max.
    const modes = JSON.stringify([
        {value: 1, label: 'Manu'},
        {value: 1, label: 'Off', 'match-setpoint-max': 4.5},
    ]);

    it('shows Off active when the setpoint is <= 4.5, Manu active above it', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t',
            'subscribe-mode': 'stat/mode', 'subscribe-setpoint': 'stat/sp', modes,
        });
        feezal.connection.deliver('stat/mode', '1');
        feezal.connection.deliver('stat/sp', '4.5');    // off sentinel
        await el.updateComplete;
        let selected = [...el.renderRoot.querySelectorAll('md-filter-chip[selected]')];
        expect(selected.map(c => c.getAttribute('label'))).toEqual(['Off']);

        feezal.connection.deliver('stat/sp', '20');     // real setpoint → Manu
        await el.updateComplete;
        selected = [...el.renderRoot.querySelectorAll('md-filter-chip[selected]')];
        expect(selected.map(c => c.getAttribute('label'))).toEqual(['Manu']);
    });
});

describe('material-climate Off sentinel (B53)', () => {
    const modes = JSON.stringify([
        {value: 1, label: 'Manu'},
        {value: 1, label: 'Off', 'match-setpoint-max': 4.5},
    ]);

    it('a previously-remembered real setpoint no longer masks the Off match', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t',
            'subscribe-mode': 'stat/mode', 'subscribe-setpoint': 'stat/sp', modes,
        });
        feezal.connection.deliver('stat/sp', '21');     // running at 21° → remembered
        feezal.connection.deliver('stat/mode', '1');
        await el.updateComplete;
        let selected = [...el.renderRoot.querySelectorAll('md-filter-chip[selected]')];
        expect(selected.map(c => c.getAttribute('label'))).toEqual(['Manu']);

        feezal.connection.deliver('stat/sp', '4.5');    // wall dial → Off
        await el.updateComplete;
        selected = [...el.renderRoot.querySelectorAll('md-filter-chip[selected]')];
        expect(selected.map(c => c.getAttribute('label'))).toEqual(['Off']);
    });

    it('while Off is active the centre shows the mode label instead of the 4.5° target', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t',
            'subscribe-mode': 'stat/mode', 'subscribe-setpoint': 'stat/sp', modes,
        });
        feezal.connection.deliver('stat/mode', '1');
        feezal.connection.deliver('stat/sp', '4.5');
        await el.updateComplete;
        const svgText = el.renderRoot.querySelector('svg.arc').textContent;
        expect(svgText).toContain('Off');
        expect(svgText).not.toContain('→');

        feezal.connection.deliver('stat/sp', '20');     // back to a real target
        await el.updateComplete;
        const after = el.renderRoot.querySelector('svg.arc').textContent;
        expect(after).toContain('→');
        expect(after).not.toContain('Off');
    });
});

describe('material-climate mode list sanitizing (B55)', () => {
    it('keeps a {value: 0} entry (Homematic Auto) and drops only empty/invalid ones', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t', 'subscribe-mode': 'stat/mode',
            modes: JSON.stringify([{value: 0, label: 'Auto'}, {value: 1, label: 'Manu'}, {label: 'broken'}]),
        });
        expect(el.climate.parsedModes().map(m => m.label)).toEqual(['Auto', 'Manu']);
        feezal.connection.deliver('stat/mode', '0');
        await el.updateComplete;
        const selected = [...el.renderRoot.querySelectorAll('md-filter-chip[selected]')];
        expect(selected.map(c => c.getAttribute('label'))).toEqual(['Auto']);
    });
});

describe('material-climate $setpoint type preservation (B58)', () => {
    it('a bare $setpoint inside an object payload substitutes as a JSON NUMBER (HmIP putParamset)', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t', 'subscribe-setpoint': 'stat/sp',
            modes: JSON.stringify([{value: 1, label: 'Manu',
                publish: 'hm/paramset/WTH:1/VALUES', payload: {CONTROL_MODE: 1, SET_POINT_TEMPERATURE: '$setpoint'}}]),
        });
        feezal.connection.deliver('stat/sp', '17');
        await el.updateComplete;
        const published = [];
        feezal.connection.pub = (t, p) => published.push({t, p});
        el.climate.setMode(el.climate.parsedModes()[0]);
        const obj = JSON.parse(published[0].p);
        // hm2mqtt silently drops FLOAT params typed as strings — must be a number.
        expect(obj.SET_POINT_TEMPERATURE).toBe(17);
        expect(typeof obj.SET_POINT_TEMPERATURE).toBe('number');
        expect(published[0].p).toContain(':17');
    });

    it('an embedded $setpoint inside a longer string still substitutes textually', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t', 'subscribe-setpoint': 'stat/sp',
            modes: JSON.stringify([{value: 1, label: 'Manu', publish: 'cmd/x', payload: 'temp=$setpoint'}]),
        });
        feezal.connection.deliver('stat/sp', '17');
        await el.updateComplete;
        const published = [];
        feezal.connection.pub = (t, p) => published.push({t, p});
        el.climate.setMode(el.climate.parsedModes()[0]);
        expect(published[0].p).toBe('temp=17');
    });
});

describe('material-climate device-reported boost state (B54)', () => {
    const modes = JSON.stringify([
        {value: 0, label: 'Auto'},
        {value: 3, label: 'Boost', momentary: true, publish: 'hm/set/x/BOOST_MODE', payload: 'true',
            off: {publish: 'hm/set/x/BOOST_MODE', payload: 'false'}},
    ]);

    it('BOOST_MODE true forces the boost chip active; a Manu mode read-back does not clear it', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t',
            'subscribe-mode': 'stat/mode', 'subscribe-boost-state': 'stat/boost', modes,
        });
        feezal.connection.deliver('stat/boost', 'true');
        await el.updateComplete;
        expect(el.climate.boostForced).toBe(true);
        expect(el.climate.boostRemaining).not.toBeNull();      // countdown keys off the device transition
        // The selected chip label carries the countdown badge ("Boost 05:00").
        const boostSelected = () => [...el.renderRoot.querySelectorAll('md-filter-chip[selected]')]
            .some(c => (c.getAttribute('label') || '').startsWith('Boost'));
        expect(boostSelected()).toBe(true);

        // HmIP SET_POINT_MODE keeps reporting Manu (1) during boost — must NOT flip.
        feezal.connection.deliver('stat/mode', '1');
        await el.updateComplete;
        expect(el.climate.boostForced).toBe(true);
        expect(boostSelected()).toBe(true);

        feezal.connection.deliver('stat/boost', 'false');
        await el.updateComplete;
        expect(el.climate.boostForced).toBe(false);
        expect(el.climate.boostRemaining).toBeNull();
        expect(boostSelected()).toBe(false);
    });

    it('tap-off while forced publishes the off strategy and clears the forced state', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t', 'subscribe-boost-state': 'stat/boost', modes,
        });
        feezal.connection.deliver('stat/boost', 'true');
        await el.updateComplete;
        const published = [];
        feezal.connection.pub = (t, p) => published.push({t, p});
        el.climate.setMode(el.climate.parsedModes().find(m => m.momentary));
        expect(published).toContainEqual({t: 'hm/set/x/BOOST_MODE', p: 'false'});
        expect(el.climate.boostForced).toBe(false);
    });
});

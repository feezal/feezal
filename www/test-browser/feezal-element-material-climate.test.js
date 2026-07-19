/**
 * E102 (partial) — material-climate valve-min/valve-max scaling. HmIP reports
 * the valve as LEVEL 0…1, BidCoS as VALVE_STATE 0–100; both must show 0–100 %.
 */
import {describe, it, expect, beforeEach} from 'vitest';
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
        expect(el._valve).toBe(73);
    });

    it('scales HmIP LEVEL 0…1 to 0–100 % when valve-max=1', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t',
            'subscribe-valve': 'stat/level', 'valve-max': '1',
        });
        feezal.connection.deliver('stat/level', '0.5');
        await el.updateComplete;
        expect(el._valve).toBe(50);
        feezal.connection.deliver('stat/level', '1');
        await el.updateComplete;
        expect(el._valve).toBe(100);
    });

    it('clamps out-of-range values and survives a zero span', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'separate', subscribe: 'stat/t',
            'subscribe-valve': 'stat/v', 'valve-min': '0', 'valve-max': '1',
        });
        feezal.connection.deliver('stat/v', '2');       // > max
        await el.updateComplete;
        expect(el._valve).toBe(100);

        el.valveMax = 0;                                // degenerate span → passthrough+clamp
        feezal.connection.deliver('stat/v', '42');
        await el.updateComplete;
        expect(el._valve).toBe(42);
    });

    it('scales the valve read from a JSON payload too', async () => {
        const el = await mount('feezal-element-material-climate', {
            'payload-mode': 'json', subscribe: 'stat/t', 'valve-max': '1',
            'json-map': JSON.stringify({valve: 'level'}),
        });
        feezal.connection.deliver('stat/t', {level: 0.25});
        await el.updateComplete;
        expect(el._valve).toBe(25);
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
        el._setMode({value: 'heat'});
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
        el._setMode(el._parsedModes()[0]);
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
        el._setMode(el._parsedModes()[0]);
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
        el._mode = 'auto';                       // pre-boost read-back
        const published = [];
        feezal.connection.pub = (t, p) => published.push({t, p});
        const boost = el._parsedModes().find(m => m.momentary);

        el._setMode(boost);                      // activate
        expect(el._momentaryActive).toBe('boost');
        expect(published).toContainEqual({t: 'hm/set/TRV/4/BOOST_MODE', p: 'true'});

        published.length = 0;
        el._setMode(boost);                      // deactivate → restore 'auto' on publish-mode
        expect(el._momentaryActive).toBeNull();
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
        const boost = el._parsedModes()[0];
        el._setMode(boost);
        el._setMode(boost);
        expect(published).toContainEqual({t: 'hm/set/eTRV/1/BOOST_MODE', p: 'true'});
        expect(published).toContainEqual({t: 'hm/set/eTRV/1/BOOST_MODE', p: 'false'});
    });
});

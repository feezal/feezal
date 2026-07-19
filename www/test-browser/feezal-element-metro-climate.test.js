/**
 * E102 — metro-climate per-entry mode-descriptor model + momentary boost,
 * ported from material-climate. Mirrors the material-climate E102 test
 * suite (see feezal-element-material-climate.test.js).
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-metro-climate/feezal-element-metro-climate.js';
import {setupFeezal, mount} from './helpers.js';

let feezal;
beforeEach(() => { feezal = setupFeezal(); });

describe('metro-climate per-entry mode descriptors (E102)', () => {
    it('a plain mode entry still publishes the value on publish-mode (unchanged)', async () => {
        const el = await mount('feezal-element-metro-climate', {
            'publish-mode': 'cmd/mode',
            modes: JSON.stringify([{value: 'heat', label: 'Heat'}]),
        });
        const published = [];
        feezal.connection.pub = (t, p) => published.push({t, p});
        el._setMode({value: 'heat'});
        expect(published).toContainEqual({t: 'cmd/mode', p: 'heat'});
    });

    it('a per-entry publish/payload writes that datapoint; $setpoint resolves to the last real setpoint', async () => {
        const el = await mount('feezal-element-metro-climate', {
            'subscribe-setpoint': 'stat/sp',
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
        const el = await mount('feezal-element-metro-climate', {
            'subscribe-setpoint': 'stat/sp',
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
        const el = await mount('feezal-element-metro-climate', {
            'publish-mode': 'cmd/mode',
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
        const el = await mount('feezal-element-metro-climate', {
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

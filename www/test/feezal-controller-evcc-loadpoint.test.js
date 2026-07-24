/**
 * E109 — EvccLoadpointController: reads the loadpoint scalars, publishes mode /
 * limit / current / phases commands, and exposes the heating flag.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {
    EvccLoadpointController, evccLoadpointAttributes, EVCC_LOADPOINT_CONSUMED_ATTRIBUTES,
    evccLoadpointDiscoveryMap, EVCC_MODES,
} from '../packages/@feezal/feezal-controller-evcc-loadpoint/feezal-controller-evcc-loadpoint.js';

let published;
beforeEach(() => {
    published = [];
    globalThis.feezal = {connection: {pub: (t, p) => published.push({t, p})}};
});

function fakeHost(attrs = {}) {
    const subs = [];
    return {
        getAttribute: n => (n in attrs ? attrs[n] : null),
        addController() {},
        addSubscription(topic, cb) { subs.push({topic, cb}); },
        getProperty: (msg, path) => String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), msg),
        requestUpdate() {},
        _unsubscribe() { subs.length = 0; },
        deliver(topic, payload) { subs.filter(s => s.topic === topic).forEach(s => s.cb({topic, payload})); },
    };
}

describe('EvccLoadpointController — reads', () => {
    it('reads mode / power / soc / limit / booleans and derives status', () => {
        const host = fakeHost({
            'subscribe-mode': 'lp/mode', 'subscribe-charge-power': 'lp/power',
            'subscribe-vehicle-soc': 'lp/soc', 'subscribe-limit-soc': 'lp/limit',
            'subscribe-connected': 'lp/conn', 'subscribe-charging': 'lp/chg',
            'subscribe-session-energy': 'lp/session',
        });
        const c = new EvccLoadpointController(host);
        c.wire();
        host.deliver('lp/mode', 'pv');
        host.deliver('lp/power', '3600');
        host.deliver('lp/soc', '55');
        host.deliver('lp/limit', '80');
        host.deliver('lp/conn', 'true');
        host.deliver('lp/chg', 'true');
        host.deliver('lp/session', '12500');
        expect(c.mode).toBe('pv');
        expect(c.chargePower).toBe(3600);
        expect(c.vehicleSoc).toBe(55);
        expect(c.limitSoc).toBe(80);
        expect(c.connected).toBe(true);
        expect(c.charging).toBe(true);
        expect(c.sessionEnergy).toBe(12500);
        expect(c.statusText).toBe('Charging');
    });

    it('statusText falls back to Connected then Idle', () => {
        const host = fakeHost({'subscribe-connected': 'lp/conn', 'subscribe-charging': 'lp/chg'});
        const c = new EvccLoadpointController(host);
        c.wire();
        host.deliver('lp/conn', 'true');
        host.deliver('lp/chg', 'false');
        expect(c.statusText).toBe('Connected');
        host.deliver('lp/conn', 'false');
        expect(c.statusText).toBe('Idle');
    });

    it('exposes the heating flag from the attribute', () => {
        expect(new EvccLoadpointController(fakeHost({heating: 'true'})).heating).toBe(true);
        expect(new EvccLoadpointController(fakeHost({heating: 'false'})).heating).toBe(false);
        expect(new EvccLoadpointController(fakeHost()).heating).toBe(false);
    });
});

describe('EvccLoadpointController — commands', () => {
    it('publishes mode / limit / current / phases to the /set topics', () => {
        const host = fakeHost({
            'publish-mode': 'lp/mode/set', 'publish-limit-soc': 'lp/limit/set',
            'publish-min-current': 'lp/min/set', 'publish-phases': 'lp/ph/set',
        });
        const c = new EvccLoadpointController(host);
        c.setMode('now');
        c.setLimitSoc(90);
        c.setMinCurrent(6);
        c.setPhases(3);
        expect(published).toEqual([
            {t: 'lp/mode/set', p: 'now'},
            {t: 'lp/limit/set', p: '90'},
            {t: 'lp/min/set', p: '6'},
            {t: 'lp/ph/set', p: '3'},
        ]);
        expect(c.mode).toBe('now');   // optimistic local update
    });
});

describe('E137 packaging', () => {
    it('the modes, consumed set and discovery map line up', () => {
        expect(EVCC_MODES.map(m => m.value)).toEqual(['off', 'pv', 'minpv', 'now']);
        expect(EVCC_LOADPOINT_CONSUMED_ATTRIBUTES).toEqual(evccLoadpointAttributes.map(a => a.name));
        expect(EVCC_LOADPOINT_CONSUMED_ATTRIBUTES).toContain('subscribe-mode');
        expect(EVCC_LOADPOINT_CONSUMED_ATTRIBUTES).toContain('heating');
        // every publish_* / subscribe_* map key targets a declared attribute
        const declared = new Set(evccLoadpointAttributes.map(a => a.name));
        for (const spec of Object.values(evccLoadpointDiscoveryMap)) {
            const attr = typeof spec === 'string' ? spec : spec.attr;
            if (attr !== 'label') expect(declared.has(attr), `map targets undeclared ${attr}`).toBe(true);
        }
    });
});

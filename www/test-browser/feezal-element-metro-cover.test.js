/**
 * E104 metro-cover behaviour tests — the Metro cover/shutter tile, driven
 * for real: the shared E137 CoverController contract (payload modes, B26
 * min/max scaling + dedicated up/stop/down topics, tilt), the Metro
 * front/back flip machinery and the N31 base-class availability badge.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-metro-cover/feezal-element-metro-cover.js';
import {setupFeezal, mount} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

describe('metro-cover position binding (separate mode, B26 min/max scaling)', () => {
    it('scales incoming device positions to % (0..1 Homematic → 50 %)', async () => {
        const el = await mount('feezal-element-metro-cover', {
            'payload-mode': 'separate',
            'subscribe-position': 'hm/cover/level',
            min: '0', max: '1',
        });
        // unconfigured viewer state → em dash
        expect(el.shadowRoot.querySelector('.value').textContent).toBe('—');

        feezal.connection.deliver('hm/cover/level', '0.5');
        await el.updateComplete;
        expect(el.cover.position).toBe(50);
        expect(el.shadowRoot.querySelector('.value').textContent).toBe('50%');

        feezal.connection.deliver('hm/cover/level', '1');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.value').textContent).toBe('100%');
    });

    it('publishes position targets scaled back to the device range', async () => {
        const el = await mount('feezal-element-metro-cover', {
            'payload-mode': 'separate',
            'subscribe-position': 'hm/cover/level', 'publish-position': 'hm/cover/level/set',
            min: '0', max: '1',
        });
        const slider = el.shadowRoot.querySelector('input[type=range].pos');
        slider.value = '50';
        slider.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual({topic: 'hm/cover/level/set', payload: '0.5'});
        expect(el.cover.position).toBe(50);
    });
});

describe('metro-cover up/stop/down commands', () => {
    it('back buttons publish the command payloads to publish-command', async () => {
        const el = await mount('feezal-element-metro-cover', {
            'payload-mode': 'separate', 'publish-command': 'cmnd/cover',
        });
        const buttons = el.shadowRoot.querySelectorAll('.cmds .mbtn');
        expect(buttons).toHaveLength(3);
        buttons[0].click();
        buttons[1].click();
        buttons[2].click();
        expect(feezal.connection.published).toEqual([
            {topic: 'cmnd/cover', payload: 'OPEN'},
            {topic: 'cmnd/cover', payload: 'STOP'},
            {topic: 'cmnd/cover', payload: 'CLOSE'},
        ]);
    });

    it('dedicated per-direction topics take precedence over publish-command (B26)', async () => {
        const el = await mount('feezal-element-metro-cover', {
            'payload-mode': 'separate', 'publish-command': 'cmnd/cover',
            'publish-up': 'cmnd/cover/up',
            'payload-up': 'UP',
        });
        const buttons = el.shadowRoot.querySelectorAll('.cmds .mbtn');
        buttons[0].click();   // Up → dedicated topic, custom payload
        buttons[1].click();   // Stop → falls back to publish-command
        expect(feezal.connection.published).toEqual([
            {topic: 'cmnd/cover/up', payload: 'UP'},
            {topic: 'cmnd/cover', payload: 'STOP'},
        ]);
    });
});

describe('metro-cover tilt / slat angle', () => {
    it('tilt slider only appears when a tilt topic is configured', async () => {
        const plain = await mount('feezal-element-metro-cover', {'payload-mode': 'separate'});
        expect(plain.shadowRoot.querySelector('input[type=range].tilt')).toBeNull();

        const tilted = await mount('feezal-element-metro-cover', {
            'payload-mode': 'separate', 'slat-angle': 'stat/tilt',
        });
        expect(tilted.shadowRoot.querySelector('input[type=range].tilt')).not.toBeNull();
    });

    it('scales incoming angles via slat-min/slat-max and publishes scaled back', async () => {
        const el = await mount('feezal-element-metro-cover', {
            'payload-mode': 'separate',
            'slat-angle': 'stat/tilt', 'publish-slat-angle': 'cmnd/tilt',
            'slat-min': '0', 'slat-max': '200',
        });
        feezal.connection.deliver('stat/tilt', '100');
        await el.updateComplete;
        expect(el.cover.tilt).toBe(50);
        const slider = el.shadowRoot.querySelector('input[type=range].tilt');
        expect(slider.value).toBe('50');

        slider.value = '25';
        slider.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/tilt', payload: '50'});
    });
});

describe('metro-cover json payload mode (zigbee2mqtt shape, default)', () => {
    it('single topic in, merged JSON object out; state infers position', async () => {
        const el = await mount('feezal-element-metro-cover', {
            subscribe: 'z2m/cover', publish: 'z2m/cover/set',
        });
        feezal.connection.deliver('z2m/cover', {position: 30});
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.value').textContent).toBe('30%');

        const slider = el.shadowRoot.querySelector('input[type=range].pos');
        slider.value = '60';
        slider.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual({topic: 'z2m/cover/set', payload: '{"position":60}'});

        // commands go to the json publish topic as {state: …}
        el.shadowRoot.querySelectorAll('.cmds .mbtn')[0].click();
        expect(feezal.connection.published).toContainEqual({topic: 'z2m/cover/set', payload: '{"state":"OPEN"}'});
    });

    it('state string infers position when no numeric position arrived yet', async () => {
        const el = await mount('feezal-element-metro-cover', {subscribe: 'z2m/cover'});
        feezal.connection.deliver('z2m/cover', {state: 'CLOSE'});
        await el.updateComplete;
        expect(el.cover.position).toBe(0);
        expect(el.shadowRoot.querySelector('.value').textContent).toBe('0%');
    });
});

describe('metro-cover flip machinery', () => {
    it('front tap flips to the back and publishes nothing', async () => {
        const el = await mount('feezal-element-metro-cover', {
            'payload-mode': 'separate', 'publish-command': 'cmnd/cover',
        });
        expect(el.shadowRoot.querySelector('.flip-btn')).not.toBeNull();   // ⋯ affordance
        el.shadowRoot.querySelector('.front').click();
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.tile').classList.contains('flipped')).toBe(true);
        expect(feezal.connection.published).toHaveLength(0);
    });

    it('never flips nor publishes in the editor', async () => {
        feezal.isEditor = true;
        const el = await mount('feezal-element-metro-cover', {
            'payload-mode': 'separate',
            'publish-command': 'cmnd/cover', 'publish-position': 'cmnd/pos',
        });
        el.shadowRoot.querySelector('.front').click();
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.tile').classList.contains('flipped')).toBe(false);

        // back controls are also editor-guarded
        el.shadowRoot.querySelectorAll('.cmds .mbtn')[0].click();
        const slider = el.shadowRoot.querySelector('input[type=range].pos');
        slider.value = '70';
        slider.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toHaveLength(0);
    });
});

describe('metro-cover availability (N31 base-class machinery)', () => {
    it('availability topic drives the Metro ! badge', async () => {
        const el = await mount('feezal-element-metro-cover', {
            subscribe: 'z2m/cover', 'subscribe-availability': 'z2m/cover/availability',
        });
        expect(el.shadowRoot.querySelector('.badge')).toBeNull();
        feezal.connection.deliver('z2m/cover/availability', 'offline');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.badge').textContent).toBe('!');
        feezal.connection.deliver('z2m/cover/availability', 'online');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.badge')).toBeNull();
    });
});

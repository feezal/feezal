/**
 * E188 — the audio family (glass / metro / circle) over
 * @feezal/feezal-controller-audio: capability-driven rows in every chrome,
 * ranges from the device, publishes on change, nothing in the editor.
 * Plus the media-card half: a soundbar has no transport topics, so the
 * media cards must render WITHOUT transport buttons when unwired.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-glass-audio/feezal-element-glass-audio.js';
import '../packages/@feezal/feezal-element-metro-audio/feezal-element-metro-audio.js';
import '../packages/@feezal/feezal-element-circle-audio/feezal-element-circle-audio.js';
import '../packages/@feezal/feezal-element-glass-media/feezal-element-glass-media.js';
import '../packages/@feezal/feezal-element-circle-media/feezal-element-circle-media.js';
import {setupFeezal, mount, until} from './helpers.js';

let feezal;
beforeEach(() => { feezal = setupFeezal(); });

const TAGS = ['feezal-element-glass-audio', 'feezal-element-metro-audio', 'feezal-element-circle-audio'];
const attrs = {subscribe: 'soundbar/status', publish: 'soundbar/set', 'message-property': 'payload.val'};
const feed = () => {
    feezal.connection.deliver('soundbar/status/eq', {val: 'Cinema'});
    feezal.connection.deliver('soundbar/status/eq_list', {val: ['Standard', 'Cinema', 'Music']});
    feezal.connection.deliver('soundbar/status/bass', {val: 2});
    feezal.connection.deliver('soundbar/status/woofer', {val: -3});
    feezal.connection.deliver('soundbar/status/woofer/min', {val: -15});
    feezal.connection.deliver('soundbar/status/woofer/max', {val: 6});
    feezal.connection.deliver('soundbar/status/night_mode', {val: false});
};

describe('audio family (E188)', () => {
    for (const tag of TAGS) {
        it(`${tag}: renders only the reported items with the device ranges, and publishes changes`, async () => {
            const el = await mount(tag, attrs);
            if (tag.includes('metro')) { el._flip(true); }
            feed();
            await until(() => el.shadowRoot.querySelectorAll('.audio .item').length === 3);
            await el.updateComplete;

            const names = [...el.shadowRoot.querySelectorAll('.audio .item .name')].map(n => n.textContent.trim());
            expect(names).toEqual(['Sound mode', 'Bass', 'Woofer']);
            const select = el.shadowRoot.querySelector('.audio select');
            expect([...select.options].map(o => o.value)).toEqual(['Standard', 'Cinema', 'Music']);
            expect(select.value).toBe('Cinema');
            const woofer = el.shadowRoot.querySelector('.audio input[title="Woofer"]');
            expect([woofer.min, woofer.max, woofer.value]).toEqual(['-15', '6', '-3']);
            expect(el.shadowRoot.querySelectorAll('.audio .flag')).toHaveLength(1);
            expect(el.shadowRoot.querySelector('.audio .flag').classList.contains('on')).toBe(false);

            select.value = 'Music';
            select.dispatchEvent(new Event('change', {bubbles: true}));
            woofer.value = '4';
            woofer.dispatchEvent(new Event('change', {bubbles: true}));
            el.shadowRoot.querySelector('.audio .flag').click();
            expect(feezal.connection.published).toEqual([
                {topic: 'soundbar/set/eq', payload: 'Music'},
                {topic: 'soundbar/set/woofer', payload: '4'},
                {topic: 'soundbar/set/night_mode', payload: 'true'},
            ]);
            await el.updateComplete;
            expect(el.shadowRoot.querySelector('.audio .flag').classList.contains('on')).toBe(true);
        });

        it(`${tag}: shows a waiting note before the device reports, and never publishes in the editor`, async () => {
            const el = await mount(tag, attrs);
            if (tag.includes('metro')) { el._flip(true); }
            await until(() => el.shadowRoot.querySelector('.audio .empty'));
            feezal.isEditor = true;
            feed();
            await until(() => el.shadowRoot.querySelector('.audio select'));
            const select = el.shadowRoot.querySelector('.audio select');
            select.value = 'Music';
            select.dispatchEvent(new Event('change', {bubbles: true}));
            expect(feezal.connection.published).toEqual([]);
        });
    }

    it('metro-audio: the front shows the current sound mode', async () => {
        const el = await mount('feezal-element-metro-audio', attrs);
        feezal.connection.deliver('soundbar/status/eq', {val: 'AI Sound Pro'});
        await until(() => el.shadowRoot.querySelector('.mode-line')?.textContent.trim() === 'AI Sound Pro');
    });
});

describe('media card without transport (the soundbar case)', () => {
    for (const tag of ['feezal-element-glass-media', 'feezal-element-circle-media']) {
        it(`${tag}: renders no transport buttons when publish-command is unwired, and shows them when wired`, async () => {
            const bare = await mount(tag, {subscribe: 'soundbar/status/play/state', 'subscribe-volume': 'soundbar/status/volume'});
            await bare.updateComplete;
            expect(bare.shadowRoot.querySelector('.transport'), 'no transport row').toBeNull();
            expect(bare.shadowRoot.querySelector('.disc-play'), 'no play button on the disc').toBeNull();
            expect(bare.shadowRoot.querySelector('.vol-row'), 'volume still renders').not.toBeNull();

            const wired = await mount(tag, {'publish-command': 'x/set', 'command-mode': 'topic'});
            await wired.updateComplete;
            expect(wired.shadowRoot.querySelector('.transport')).not.toBeNull();
        });
    }
});

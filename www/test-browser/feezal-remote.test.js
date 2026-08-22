/**
 * E187 — the remote family (glass / metro / circle) over
 * @feezal/feezal-controller-remote: the shared pad renders in every chrome,
 * a key press publishes the uppercased name to <publish>/button, the large
 * layout adds digits/colours and the app rows, the foreground app highlights
 * its row, and nothing publishes on the editor canvas.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-glass-remote/feezal-element-glass-remote.js';
import '../packages/@feezal/feezal-element-metro-remote/feezal-element-metro-remote.js';
import '../packages/@feezal/feezal-element-circle-remote/feezal-element-circle-remote.js';
import {setupFeezal, mount, until} from './helpers.js';

let feezal;
beforeEach(() => { feezal = setupFeezal(); });

const TAGS = ['feezal-element-glass-remote', 'feezal-element-metro-remote', 'feezal-element-circle-remote'];
const key = (el, name) => el.shadowRoot.querySelector(`.key[title="${name}"]`);

describe('remote family (E187)', () => {
    for (const tag of TAGS) {
        it(`${tag}: compact pad — a key press publishes the uppercased name to …/button`, async () => {
            const el = await mount(tag, {publish: 'lgtv/set'});
            await until(() => key(el, 'ENTER'));
            expect(key(el, 'HOME')).not.toBeNull();
            expect(key(el, 'VOLUMEUP')).not.toBeNull();
            expect(el.shadowRoot.querySelector('.digits'), 'compact has no digits').toBeNull();
            expect(el.shadowRoot.querySelector('.apps'), 'compact hides the app rows by default').toBeNull();

            key(el, 'ENTER').click();
            key(el, 'CHANNELDOWN').click();
            expect(feezal.connection.published).toEqual([
                {topic: 'lgtv/set/button', payload: 'ENTER'},
                {topic: 'lgtv/set/button', payload: 'CHANNELDOWN'},
            ]);
        });

        it(`${tag}: large layout adds digits, colour keys and the app rows; the foreground app is highlighted`, async () => {
            const el = await mount(tag, {
                publish: 'lgtv/set', layout: 'large',
                'subscribe-app': 'lgtv/status/foregroundApp',
                buttons: JSON.stringify([
                    {kind: 'app', label: 'Netflix', icon: 'movie', payload: 'netflix'},
                    {kind: 'output', label: 'ARC', payload: 'external_arc'},
                    {kind: 'raw', label: 'Hi', topic: 'toast', payload: 'hello'},
                ]),
            });
            await until(() => el.shadowRoot.querySelectorAll('.digits .key').length === 10);
            expect(el.shadowRoot.querySelectorAll('.colours .key')).toHaveLength(4);
            const apps = [...el.shadowRoot.querySelectorAll('.apps .key')];
            expect(apps.map(b => b.textContent.trim())).toEqual(['Netflix', 'ARC', 'Hi']);

            feezal.connection.deliver('lgtv/status/foregroundApp', {appId: 'netflix', windowId: '', processId: '3'});
            await until(() => el.shadowRoot.querySelector('.apps .key.active'));
            expect(el.shadowRoot.querySelector('.apps .key.active').textContent.trim()).toBe('Netflix');

            apps[0].click(); apps[1].click(); apps[2].click();
            key(el, '7').click();
            expect(feezal.connection.published).toEqual([
                {topic: 'lgtv/set/launch', payload: 'netflix'},
                {topic: 'lgtv/set/output', payload: 'external_arc'},
                {topic: 'lgtv/set/toast', payload: 'hello'},
                {topic: 'lgtv/set/button', payload: '7'},
            ]);
        });

        it(`${tag}: reflects volume + mute and publishes slider / mute changes`, async () => {
            const el = await mount(tag, {
                publish: 'lgtv/set', 'subscribe-volume': 'lgtv/status/volume', 'subscribe-mute': 'lgtv/status/mute',
            });
            feezal.connection.deliver('lgtv/status/volume', '23');
            feezal.connection.deliver('lgtv/status/mute', 'true');
            await until(() => el.remote.volume === 23 && el.remote.muted);
            await el.updateComplete;
            const slider = el.shadowRoot.querySelector('.vol-row input[type="range"]');
            expect(slider.value).toBe('23');
            slider.value = '40';
            slider.dispatchEvent(new Event('change', {bubbles: true}));
            el.shadowRoot.querySelector('.vol-row .key').click();
            expect(feezal.connection.published).toEqual([
                {topic: 'lgtv/set/volume', payload: '40'},
                {topic: 'lgtv/set/mute', payload: 'false'},
            ]);
        });

        it(`${tag}: never publishes on the editor canvas`, async () => {
            feezal.isEditor = true;
            const el = await mount(tag, {publish: 'lgtv/set'});
            await until(() => key(el, 'HOME'));
            key(el, 'HOME').click();
            expect(feezal.connection.published).toEqual([]);
        });
    }

    it('the three share one pad: the same key set renders in every family', async () => {
        const names = [];
        for (const tag of TAGS) {
            const el = await mount(tag, {layout: 'large'});
            await until(() => key(el, 'ENTER'));
            names.push([...el.shadowRoot.querySelectorAll('.key[title]')].map(b => b.title).filter(t => /^[A-Z0-9]+$/.test(t)).sort().join(','));
        }
        expect(new Set(names).size).toBe(1);
    });
});

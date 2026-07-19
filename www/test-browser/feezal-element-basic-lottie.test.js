/**
 * Component tests for feezal-element-basic-lottie (E89) in a real browser.
 *
 * The lottie-web library is never loaded here: `__setLottieFactoryForTests`
 * pre-seeds the shared loader with a fake factory whose `loadAnimation()`
 * returns a spy instance recording every method call. That keeps the test
 * deterministic (jsdom/chromium can't meaningfully render real Lottie) while
 * exercising the parts that matter — editor placeholder, transport payloads,
 * the value→segment map (incl. src-swap), reload-on-src-change, disconnect
 * cleanup, and the broken-src placeholder.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import '@feezal/feezal-element-basic-lottie';
import {__setLottieFactoryForTests} from '@feezal/feezal-lottie';
import {setupFeezal, mount, until} from './helpers.js';

let feezal;
let created;   // every AnimationItem the fake factory produced, in order

/** A fake lottie factory: records created instances + their method calls. */
function fakeLottie() {
    const instances = [];
    const factory = {
        loadAnimation(opts) {
            const inst = {
                opts,
                calls: [],
                handlers: {},
                destroyed: false,
                play() { this.calls.push('play'); },
                pause() { this.calls.push('pause'); },
                stop() { this.calls.push('stop'); },
                setSpeed(s) { this.calls.push(['setSpeed', s]); },
                setLoop(l) { this.calls.push(['setLoop', l]); },
                setDirection() {},
                playSegments(seg, force) { this.calls.push(['playSegments', seg, force]); },
                goToAndStop() { this.calls.push('goToAndStop'); },
                resize() { this.calls.push('resize'); },
                destroy() { this.calls.push('destroy'); this.destroyed = true; },
                addEventListener(ev, cb) { (this.handlers[ev] ||= []).push(cb); },
                removeEventListener() {},
                fire(ev) { (this.handlers[ev] || []).forEach(cb => cb()); }
            };
            instances.push(inst);
            return inst;
        }
    };
    return {factory, instances};
}

beforeEach(() => {
    feezal = setupFeezal();
    const fake = fakeLottie();
    created = fake.instances;
    __setLottieFactoryForTests(fake.factory);
});

afterEach(() => {
    __setLottieFactoryForTests(null);
});

async function mountLottie(attrs) {
    const el = await mount('feezal-element-basic-lottie', attrs);
    return el;
}

describe('editor placeholder', () => {
    it('renders a static placeholder and never loads the library in editor mode', async () => {
        feezal.isEditor = true;
        const el = await mountLottie({src: 'assets/weather.json', subscribe: 'dev/anim'});
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.placeholder')).not.toBeNull();
        expect(el.shadowRoot.querySelector('.stage')).toBeNull();
        // No animation instance was ever created.
        expect(created.length).toBe(0);
        // Delivering a payload in the editor does nothing (no subscription).
        feezal.connection.deliver('dev/anim', 'play');
        expect(created.length).toBe(0);
    });
});

describe('lazy load + lifecycle', () => {
    it('creates a lottie instance from src (viewer) with the resolved path', async () => {
        const el = await mountLottie({src: 'assets/weather.json'});
        const inst = await until(() => created[0]);
        expect(inst.opts.path).toBe('assets/weather.json');
        expect(inst.opts.renderer).toBe('svg');
        expect(inst.opts.loop).toBe(true);
        expect(inst.opts.autoplay).toBe(true);
        expect(el.shadowRoot.querySelector('.stage')).not.toBeNull();
    });

    it('with no src shows the placeholder and loads nothing', async () => {
        const el = await mountLottie({subscribe: 'dev/anim'});
        await el.updateComplete;
        await new Promise(r => setTimeout(r, 20));
        expect(created.length).toBe(0);
        expect(el.shadowRoot.querySelector('.placeholder')).not.toBeNull();
    });

    it('destroys the instance on disconnect and releases its subscription', async () => {
        const el = await mountLottie({src: 'assets/weather.json', subscribe: 'dev/anim'});
        const inst = await until(() => created[0]);
        expect(feezal.connection.subCount()).toBeGreaterThan(0);
        el.remove();
        await new Promise(r => setTimeout(r, 10));
        expect(inst.destroyed).toBe(true);
        expect(feezal.connection.subCount()).toBe(0);
    });
});

describe('transport payloads', () => {
    it('play / pause / stop call the matching instance methods', async () => {
        const el = await mountLottie({src: 'a.json', subscribe: 'dev/anim'});
        const inst = await until(() => created[0]);

        feezal.connection.deliver('dev/anim', 'pause');
        feezal.connection.deliver('dev/anim', 'play');
        feezal.connection.deliver('dev/anim', 'stop');
        await el.updateComplete;

        expect(inst.calls).toContain('pause');
        expect(inst.calls).toContain('play');
        expect(inst.calls).toContain('stop');
    });

    it('honours custom transport payload values', async () => {
        const el = await mountLottie({
            src: 'a.json', subscribe: 'dev/anim',
            'payload-play': 'GO', 'payload-stop': 'HALT'
        });
        const inst = await until(() => created[0]);
        feezal.connection.deliver('dev/anim', 'GO');
        feezal.connection.deliver('dev/anim', 'HALT');
        await el.updateComplete;
        expect(inst.calls).toContain('play');
        expect(inst.calls).toContain('stop');
    });

    it('ignores an unmatched payload (no throw, no method call)', async () => {
        const el = await mountLottie({src: 'a.json', subscribe: 'dev/anim'});
        const inst = await until(() => created[0]);
        const before = inst.calls.length;
        feezal.connection.deliver('dev/anim', 'whatever');
        await el.updateComplete;
        expect(inst.calls.length).toBe(before);
    });
});

describe('value → segment map', () => {
    it('plays the mapped frame segment and applies loop/speed overrides', async () => {
        const map = JSON.stringify({
            sunny: {segment: [0, 60]},
            rain: {segment: [61, 120], loop: true, speed: 2}
        });
        const el = await mountLottie({src: 'weather.json', subscribe: 'dev/anim', map});
        const inst = await until(() => created[0]);

        feezal.connection.deliver('dev/anim', 'sunny');
        await el.updateComplete;
        expect(inst.calls).toContainEqual(['playSegments', [0, 60], true]);

        feezal.connection.deliver('dev/anim', 'rain');
        await el.updateComplete;
        expect(inst.calls).toContainEqual(['playSegments', [61, 120], true]);
        expect(inst.calls).toContainEqual(['setLoop', true]);
        expect(inst.calls).toContainEqual(['setSpeed', 2]);
    });

    it('is checked BEFORE transport payloads', async () => {
        // "play" is both a map key AND the default transport play payload —
        // the map wins.
        const map = JSON.stringify({play: {segment: [5, 10]}});
        const el = await mountLottie({src: 'a.json', subscribe: 'dev/anim', map});
        const inst = await until(() => created[0]);
        feezal.connection.deliver('dev/anim', 'play');
        await el.updateComplete;
        expect(inst.calls).toContainEqual(['playSegments', [5, 10], true]);
        expect(inst.calls).not.toContain('play');
    });

    it('swaps src entirely: destroys the old instance and creates a new one', async () => {
        const map = JSON.stringify({storm: {src: 'storm.json'}});
        const el = await mountLottie({src: 'weather.json', subscribe: 'dev/anim', map});
        const first = await until(() => created[0]);
        expect(first.opts.path).toBe('weather.json');

        feezal.connection.deliver('dev/anim', 'storm');
        const second = await until(() => created[1]);
        expect(first.destroyed).toBe(true);
        expect(second.opts.path).toBe('storm.json');
    });
});

describe('src change reloads', () => {
    it('changing the src attribute destroys and re-creates the instance', async () => {
        const el = await mountLottie({src: 'one.json'});
        const first = await until(() => created[0]);
        expect(first.opts.path).toBe('one.json');

        el.setAttribute('src', 'two.json');
        const second = await until(() => created[1]);
        expect(first.destroyed).toBe(true);
        expect(second.opts.path).toBe('two.json');
    });
});

describe('broken src', () => {
    it('shows the placeholder on a data_failed event and never throws', async () => {
        const el = await mountLottie({src: 'missing.json'});
        const inst = await until(() => created[0]);
        // Simulate lottie-web failing to fetch/parse the asset.
        inst.fire('data_failed');
        await el.updateComplete;
        expect(el._broken).toBe(true);
        expect(el.shadowRoot.querySelector('.placeholder')).not.toBeNull();
    });
});

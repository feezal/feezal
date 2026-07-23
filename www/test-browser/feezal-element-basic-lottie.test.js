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
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import '@feezal/feezal-element-basic-lottie';
import {__setLottieFactoryForTests} from '@feezal/feezal-lottie';
import {setupFeezal, mount, until} from './helpers.js';

let feezal;
let created;   // every AnimationItem the fake factory produced, in order
let _origFetch;

/** A minimal but VALID Lottie object, tagged with the requested URL. */
function fakeLottieData(url) {
    return {v: '5.7.4', fr: 30, ip: 0, op: 60, w: 100, h: 100, layers: [], __src: String(url)};
}

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
    // The element now fetches + validates the JSON itself (instead of handing
    // lottie-web a `path`), so mock fetch to return a minimal VALID Lottie that
    // tags the requested URL — tests assert which src loaded via animationData.
    _origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async url => ({ok: true, json: async () => fakeLottieData(url)}));
});

afterEach(() => {
    __setLottieFactoryForTests(null);
    globalThis.fetch = _origFetch;
});

async function mountLottie(attrs) {
    const el = await mount('feezal-element-basic-lottie', attrs);
    return el;
}

describe('editor rendering', () => {
    it('renders the animation on the editor canvas (loads the lib) but does NOT subscribe to MQTT playback', async () => {
        feezal.isEditor = true;
        const el = await mountLottie({src: 'assets/weather.json', subscribe: 'dev/anim'});
        const inst = await until(() => created[0]);   // loads in the editor now
        expect(el.shadowRoot.querySelector('.stage')).not.toBeNull();
        // MQTT-driven playback is viewer-only — a delivered payload does nothing.
        const before = inst.calls.length;
        feezal.connection.deliver('dev/anim', 'play');
        await el.updateComplete;
        expect(inst.calls.length).toBe(before);
    });

    it('shows the chip and loads nothing in the editor when there is no src', async () => {
        feezal.isEditor = true;
        const el = await mountLottie({subscribe: 'dev/anim'});
        await el.updateComplete;
        await new Promise(r => setTimeout(r, 20));
        expect(el.shadowRoot.querySelector('.placeholder')).not.toBeNull();
        expect(created.length).toBe(0);
    });
});

describe('lazy load + lifecycle', () => {
    it('creates a lottie instance from src (viewer) with the resolved path', async () => {
        const el = await mountLottie({src: 'assets/weather.json'});
        const inst = await until(() => created[0]);
        expect(inst.opts.animationData.__src).toBe('assets/weather.json');
        expect(inst.opts.renderer).toBe('svg');
        expect(inst.opts.loop).toBe(true);
        expect(inst.opts.autoplay).toBe(true);
        expect(el.shadowRoot.querySelector('.stage')).not.toBeNull();
    });

    it('loop="false" disables looping and persists as an explicit attribute (default-true fix)', async () => {
        const el = await mountLottie({src: 'a.json', loop: 'false', autoplay: 'false'});
        const inst = await until(() => created[0]);
        expect(inst.opts.loop).toBe(false);
        expect(inst.opts.autoplay).toBe(false);
        // Stored as the literal "false" (not removed) so it survives save/reload.
        expect(el.getAttribute('loop')).toBe('false');
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
        expect(first.opts.animationData.__src).toBe('weather.json');

        feezal.connection.deliver('dev/anim', 'storm');
        const second = await until(() => created[1]);
        expect(first.destroyed).toBe(true);
        expect(second.opts.animationData.__src).toBe('storm.json');
    });
});

describe('src change reloads', () => {
    it('changing the src attribute destroys and re-creates the instance', async () => {
        const el = await mountLottie({src: 'one.json'});
        const first = await until(() => created[0]);
        expect(first.opts.animationData.__src).toBe('one.json');

        el.setAttribute('src', 'two.json');
        const second = await until(() => created[1]);
        expect(first.destroyed).toBe(true);
        expect(second.opts.animationData.__src).toBe('two.json');
    });
});

describe('broken src', () => {
    it('shows the placeholder on a data_failed event and never throws', async () => {
        const el = await mountLottie({src: 'missing.json'});
        const inst = await until(() => created[0]);
        // Simulate lottie-web failing on the animation data.
        inst.fire('data_failed');
        await el.updateComplete;
        expect(el._broken).toBe(true);
        expect(el.shadowRoot.querySelector('.placeholder')).not.toBeNull();
    });

    it('shows a "Not a Lottie" placeholder for a JSON that is not an animation', async () => {
        // A valid JSON that is not a Lottie (no layers array / version keys).
        globalThis.fetch = vi.fn(async () => ({ok: true, json: async () => ({foo: 'bar', hello: [1, 2]})}));
        const el = await mountLottie({src: 'data.json'});
        await until(() => el._invalid === true);
        expect(el._invalid).toBe(true);
        expect(created.length).toBe(0);   // never handed to lottie-web
        expect(el.shadowRoot.querySelector('.placeholder')?.textContent).toContain('Not a Lottie');
    });

    it('shows the broken placeholder when the JSON fetch fails (404)', async () => {
        globalThis.fetch = vi.fn(async () => ({ok: false, status: 404, json: async () => ({})}));
        const el = await mountLottie({src: 'missing.json'});
        await until(() => el._broken === true);
        expect(el._broken).toBe(true);
        expect(created.length).toBe(0);
        expect(el.shadowRoot.querySelector('.placeholder')).not.toBeNull();
    });
});

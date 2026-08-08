/**
 * E167 — glass-camera: basic-camera in the glass frost frame, nothing more.
 * The camera surface is inherited wholesale; these tests pin exactly that
 * (subclass + descriptor inheritance), the frame chrome (glass on the frame,
 * never on the picture), and the E115 basic ↔ glass pairing.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {FeezalElementBasicCamera} from '../packages/@feezal/feezal-element-basic-camera/feezal-element-basic-camera.js';
import {FeezalElementGlassCamera} from '../packages/@feezal/feezal-element-glass-camera/feezal-element-glass-camera.js';
import '../src/feezal-sidebar-inspector.js';
import {setupFeezal, mount} from './helpers.js';

const FeezalSidebarInspector = customElements.get('feezal-sidebar-inspector');

// a 1×1 transparent gif — a valid, tiny data URL
const DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

let feezal;
beforeEach(() => {
    feezal = setupFeezal({elements: [
        '@feezal/feezal-element-basic-camera',
        '@feezal/feezal-element-glass-camera',
    ]});
});

describe('E167 — glass-camera inherits the whole camera surface', () => {
    it('is a FeezalElementBasicCamera subclass with the descriptor inherited', () => {
        expect(Object.getPrototypeOf(FeezalElementGlassCamera)).toBe(FeezalElementBasicCamera);

        const d = FeezalElementGlassCamera.feezal;
        expect(d.palette.category).toBe('Glass');
        expect(d.palette.name).toBe('Camera');
        // discovery inherited unchanged — camera component + the Frigate keys
        expect(d.discovery.component).toBe('camera');
        for (const key of ['topic', 'events_topic', 'camera_name', 'thumbs_topic', 'chips']) {
            expect(Object.keys(d.discovery.map)).toContain(key);
        }
        // every base attribute is present, plus the family degrade knob
        const names = d.attributes.map(a => a.name || a);
        for (const a of FeezalElementBasicCamera.feezal.attributes.map(x => x.name || x)) {
            expect(names).toContain(a);
        }
        expect(names).toContain('degrade');
        // the frame owns radius + surface: those two base knobs are dropped
        expect(d.styles).not.toContain('border-radius');
        expect(d.styles.some(s => s?.property === '--feezal-camera-bg-color')).toBe(false);
        expect(d.styles.some(s => s?.property === '--feezal-glass-tint')).toBe(true);
    });

    it('the inherited mqtt-image path renders through the subclass, inside the frame', async () => {
        const el = await mount('feezal-element-glass-camera', {type: 'mqtt-image', subscribe: 'cam/snap'});
        el.style.cssText += 'position:absolute;width:172px;height:128px;';
        expect(el.shadowRoot.querySelector('img.feed')).toBeNull();
        feezal.connection.deliver('cam/snap', DATA_URL);
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('img.feed').src).toBe(DATA_URL);

        // the FRAME is glass: rounded frost host with a border…
        const host = getComputedStyle(el);
        expect(host.borderRadius).toBe('24px');
        expect(host.backdropFilter).toContain('blur');
        expect(parseFloat(host.paddingLeft)).toBeGreaterThan(0);
        // …the PICTURE is the picture: the stage clips to the inner radius,
        // no blur/tint layer of its own over the feed.
        const stage = getComputedStyle(el.shadowRoot.querySelector('.stage'));
        expect(stage.overflow).toBe('hidden');
        expect(['none', '']).toContain(stage.backdropFilter);
    });

    it('degrade swaps the frame blur for a solid — the family meaning, frame only', async () => {
        const el = await mount('feezal-element-glass-camera', {degrade: ''});
        expect(getComputedStyle(el).backdropFilter).toBe('none');
    });

    it('E115: basic-camera offers the glass twin as a switch target (and back)', () => {
        const view = document.createElement('div');
        document.body.append(view);
        const receiver = els => {
            const ctx = Object.create(FeezalSidebarInspector.prototype);
            Object.defineProperty(ctx, 'selectedElems', {value: els, writable: true});
            return ctx;
        };

        const basic = document.createElement('feezal-element-basic-camera');
        view.append(basic);
        expect(receiver([basic])._switchFamilyTargets().map(t => t.family)).toContain('glass');

        const glass = document.createElement('feezal-element-glass-camera');
        view.append(glass);
        expect(receiver([glass])._switchFamilyTargets().map(t => t.family)).toContain('basic');
        view.remove();
    });
});

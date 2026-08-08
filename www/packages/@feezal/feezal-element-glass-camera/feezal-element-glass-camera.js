import {css} from '@feezal/feezal-element';
import {FeezalElementBasicCamera} from '@feezal/feezal-element-basic-camera';

/**
 * feezal-element-glass-camera (E167)
 *
 * Deliberately minimal: basic-camera inside the glass family's frost frame —
 * nothing more. The whole camera surface (every attribute, mqtt-image, chips,
 * events, popup, buttons, discovery incl. the Frigate keys) is INHERITED from
 * FeezalElementBasicCamera; this subclass only re-skins the palette entry and
 * wraps the feed in the family chrome. The frame is glass, the picture is the
 * picture: the tint/blur live on the host (visible as the frame ring and any
 * letterbox area), the feed itself is never blurred or tinted. `degrade`
 * follows the family meaning for the frame only (solid instead of blur).
 */
class FeezalElementGlassCamera extends FeezalElementBasicCamera {
    static get feezal() {
        const base = FeezalElementBasicCamera.feezal;
        return {
            ...base,
            palette: {name: 'Camera', category: 'Glass', color: '#7aa5c9', icon: 'videocam'},
            description: 'basic-camera in the glass frost frame (rounded corners, tinted border — the feed itself ' +
                'stays untouched). Full camera surface inherited: streams, MQTT images, chips, events, popup.',
            attributes: [
                ...base.attributes,
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the frame\'s live backdrop blur with a semi-opaque solid — no per-frame GPU cost ' +
                        '(weak wall-tablet hardware). Affects the frame only, never the feed.'},
            ],
            styles: [
                // The frame owns the corner rounding (family radius) and the
                // host surface is the frost tint — drop exactly those two base
                // knobs, keep everything else (label/chip colours etc.).
                ...base.styles.filter(s => s !== 'border-radius' && s?.property !== '--feezal-camera-bg-color'),
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost frame tint (defaults from the theme).'},
                {property: '--feezal-glass-border', type: 'color', help: 'Frame border colour (defaults from the theme).'},
                {property: '--feezal-glass-radius', default: '24px', help: 'Frame corner radius.'},
                {property: '--feezal-glass-frame', default: '6px', help: 'Frame width around the feed.'},
            ],
        };
    }

    static properties = {
        degrade: {type: Boolean, reflect: true},
    };

    static styles = [FeezalElementBasicCamera.styles, css`
        :host {
            padding: var(--feezal-glass-frame, 6px);
            border-radius: var(--feezal-glass-radius, 24px);
            background: var(--feezal-glass-tint, rgba(255,255,255,0.35));
            -webkit-backdrop-filter: blur(var(--feezal-glass-blur, 20px));
            backdrop-filter: blur(var(--feezal-glass-blur, 20px));
            border: 1px solid var(--feezal-glass-border, rgba(255,255,255,0.55));
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }
        @supports (corner-shape: squircle) { :host { corner-shape: squircle; } }
        :host([degrade]) {
            -webkit-backdrop-filter: none; backdrop-filter: none;
            background: var(--feezal-glass-solid, rgba(245,245,247,0.94));
        }
        /* The feed clips to the INNER radius so it sits cleanly inside the
           rounded frame — no tint, no blur over the picture. */
        .stage {
            border-radius: calc(var(--feezal-glass-radius, 24px) - var(--feezal-glass-frame, 6px));
            overflow: hidden;
        }
    `];

    constructor() {
        super();
        this.degrade = false;
    }
}

customElements.define('feezal-element-glass-camera', FeezalElementGlassCamera);
export {FeezalElementGlassCamera};

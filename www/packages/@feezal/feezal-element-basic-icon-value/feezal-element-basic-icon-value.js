/* global feezal */
import {FeezalElement, html, css} from '@feezal/feezal-element';

// The 11 variant steps of a _0.._100 icon family (e.g. the knx-uf
// blade/shutter/dim/measure families) and the per-step colour properties.
const STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

/**
 * feezal-element-basic-icon-value — an icon that switches through a
 * _0.._100 variant family based on the received value.
 *
 * `icon` holds the family base (e.g. `knx-uf:fts_blade_s`); the incoming
 * payload is scaled by min/max to a 0–100 percentage, rounded to the nearest
 * 10, and the matching variant (`…_50`) is rendered. The actual variant is
 * resolved against the icon registry, tolerating the upstream `_00` zero
 * alias and falling back to the nearest available step for partial families
 * (e.g. `fts_shutter`, which has no zero variant).
 *
 * Per-step colours: --feezal-icon-value-color-0 … -100 (default
 * var(--primary-text-color)), so e.g. a tank icon can fade from green to red.
 */
class FeezalElementBasicIconValue extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                category: 'Basic',
                name: 'Icon Value',
                color: '#4a6080'
            },
            description: 'Icon switching through a _0.._100 variant family based on the received value (knx-uf blades, shutters, dim levels, tanks, …). min/max scale the payload; 11 per-step colour properties.',
            baseAttribute: 'value',
            attributes: [
                'subscribe',
                'messageProperty',
                {name: 'icon', type: 'icon', iconVariants: STEPS,
                    help: 'Base icon of a variant family (e.g. knx-uf:fts_blade_s) — the picker offers only families with all 11 _0.._100 variants.'},
                {name: 'min', type: 'number', size: 'half', help: 'Payload value mapped to variant _0'},
                {name: 'max', type: 'number', size: 'half', help: 'Payload value mapped to variant _100'},
                {name: 'value', type: 'number', help: 'Current value — live via subscribe; editable here for preview'},
                {name: 'click-through', type: 'boolean', default: false,
                    help: 'Viewer: let clicks/taps pass through this element to whatever sits beneath it (e.g. a button under the icon). In the editor the element stays selectable/draggable.'}
            ],
            styles: [
                'top', 'left', 'width', 'height',
                ...STEPS.map(step => ({
                    property: `--feezal-icon-value-color-${step}`,
                    type: 'color',
                    default: 'var(--primary-text-color)',
                    help: `Icon colour at variant _${step}`
                }))
            ],
            restrict: {minWidth: 16, minHeight: 16},
            defaultStyle: {width: '64px', height: '64px'}
        };
    }

    static properties = {
        // value is set via _subscribe (setAttribute) or the inspector — NOT
        // reflected (house convention, see basic-number): reflecting would
        // write the constructor default value="0" into the DOM at upgrade and
        // serialize it into every saved site.
        value: {type: Number},
        icon:  {type: String, reflect: true},
        min:   {type: Number, reflect: true},
        max:   {type: Number, reflect: true},
        clickThrough: {type: Boolean, reflect: true, attribute: 'click-through'}
    };

    static styles = [FeezalElement.styles, css`
        :host {
            /* Defaults — container-type:size collapses without an explicit
               size when the markup carries no inline width/height. */
            width: 64px;
            height: 64px;
            display: flex;
            align-items: center;
            justify-content: center;
            container-type: size;
        }
        feezal-icon { font-size: 90cqmin; line-height: 1; }
        /* E118: click-through — pointer events pass to elements beneath in
           the viewer; the editor keeps the element selectable/draggable. */
        :host([click-through]:not(.feezal-editable)) {
            pointer-events: none;
        }
    `];

    constructor() {
        super();
        this.value = 0;
        this.min = 0;
        this.max = 100;
        this.icon = '';
        this.clickThrough = false;
    }

    connectedCallback() {
        super.connectedCallback();
        // Icon sets register asynchronously (editor loads them at runtime) —
        // re-resolve the variant once the family's set becomes available.
        this._onIconSetsChanged = () => this.requestUpdate();
        document.addEventListener('feezal-iconsets-changed', this._onIconSetsChanged);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('feezal-iconsets-changed', this._onIconSetsChanged);
    }

    /** Scaled value → variant step (0..100 in tens), clamped. */
    get bucket() {
        const min = Number(this.min);
        const span = Number(this.max) - min;
        const value = Number(this.value);
        if (!Number.isFinite(value) || !Number.isFinite(span) || span === 0) return 0;
        const percent = Math.min(100, Math.max(0, ((value - min) / span) * 100));
        return Math.round(percent / 10) * 10;
    }

    /** Resolve the variant icon name for a step against the registry. */
    _variantName(bucket) {
        const raw = String(this.icon || '');
        if (!raw) return '';
        const colon = raw.indexOf(':');
        const set = colon > -1 ? raw.slice(0, colon) : null;
        const base = colon > -1 ? raw.slice(colon + 1) : raw;
        const prefix = set ? set + ':' : '';

        const names = set && typeof feezal !== 'undefined' && feezal.iconSetNames
            ? feezal.iconSetNames(set)
            : null;
        if (!names) {
            // Set not (yet) registered — best guess; feezal-icon shows its
            // fallback until the set arrives and we re-render.
            return `${prefix}${base}_${bucket}`;
        }

        const nameSet = new Set(names);
        const suffixFor = step => {
            if (nameSet.has(`${base}_${step}`)) return `_${step}`;
            if (step === 0 && nameSet.has(`${base}_00`)) return '_00';   // upstream zero alias
            return null;
        };

        // Nearest available step — partial families (fts_shutter has no zero
        // variant) still render something sensible.
        let best = null;
        for (const step of STEPS) {
            const suffix = suffixFor(step);
            if (suffix === null) continue;
            if (best === null || Math.abs(step - bucket) < Math.abs(best.step - bucket)) {
                best = {step, suffix};
            }
        }
        if (!best) return raw;   // not a variant family — render the icon itself
        return `${prefix}${base}${best.suffix}`;
    }

    render() {
        const bucket = this.bucket;
        const name = this._variantName(bucket);
        if (!name) return html``;
        return html`<feezal-icon name="${name}"
            style="color: var(--feezal-icon-value-color-${bucket}, var(--primary-text-color, #333))"></feezal-icon>`;
    }
}

customElements.define('feezal-element-basic-icon-value', FeezalElementBasicIconValue);
export {FeezalElementBasicIconValue};

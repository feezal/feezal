/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';
import {applySizePreset, glassCardStyles, glassBadgeTray} from '@feezal/feezal-glass';
import {AudioController, audioAttributes, audioDiscoveryMap, audioPanel, audioPanelStyles} from '@feezal/feezal-controller-audio';
import {availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';

/**
 * feezal-element-glass-audio (E188)
 *
 * Frosted-glass audio-processor card — sound mode / EQ, tone and channel
 * levels, the flags — for lgsb2mqtt (LG soundbars) and any bridge with the
 * same item tree. All behaviour lives in @feezal/feezal-controller-audio;
 * this is the glass VIEW. Renders ONLY the items the device reports.
 */

const AUDIO_SIZES = {'4x2': [354, 172], '4x4': [354, 354], '2x4': [172, 354]};

class FeezalElementGlassAudio extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Audio', category: 'Glass', color: '#7aa5c9', icon: 'equalizer'},
            description: 'Frosted-glass audio settings card (LG soundbars via lgsb2mqtt, or any bridge with a ' +
                'status/set item tree): sound mode select, bass / treble / channel level sliders with the ' +
                'device\'s own ranges, AV sync, and the on/off flags. Only the items the device reports are shown.',
            discovery: {component: 'audio', map: audioDiscoveryMap},
            attributes: [
                {name: 'size', type: 'select', options: ['', '4x2', '4x4', '2x4'], default: '',
                    help: 'Preset size: 4x2 = wide, 4x4 = square (room for every channel), 2x4 = narrow column. Empty keeps the current/manual size.'},
                // E188: the whole audio contract — one declaration, every family.
                ...audioAttributes,
                ...availabilityAttributes(),
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-accent', type: 'color', default: 'var(--primary-color)', help: 'Slider and active-flag colour.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Caption font size.'},
            ],
            defaultStyle: {width: '354px', height: '354px'},
            restrict: {minWidth: 160, minHeight: 96},
        };
    }

    static properties = {
        size:      {type: String,  reflect: true},
        label:     {type: String,  reflect: true},
        publish:   {type: String,  reflect: true},
        items:     {type: String,  attribute: 'items'},
        showFlags:  {type: Boolean, converter: feezalBoolean, attribute: 'show-flags'},
        showLevels: {type: Boolean, converter: feezalBoolean, attribute: 'show-levels'},
        showMode:   {type: Boolean, converter: feezalBoolean, attribute: 'show-mode'},
        degrade:   {type: Boolean, reflect: true},
    };

    static styles = [feezalBaseStyles, glassCardStyles, audioPanelStyles, css`
        .card { padding: 12px; overflow: auto; justify-content: flex-start; align-items: stretch; text-align: left; gap: 6px; }
        :host([degrade]) .card {
            -webkit-backdrop-filter: none; backdrop-filter: none;
            background: var(--feezal-glass-solid, rgba(255,255,255,0.82));
        }
        .caption {
            font-size: var(--feezal-glass-font-size-label, 12px); font-weight: 600; text-transform: uppercase;
            letter-spacing: 0.04em; opacity: 0.75; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .audio { --_audio-accent: var(--feezal-glass-accent, var(--primary-color)); }
    `];

    constructor() {
        super();
        this.size = '';
        this.label = '';
        this.publish = '';
        this.degrade = false;
        // E188: the behaviour layer — wiring, capability discovery, every publish.
        this.audio = new AudioController(this);
    }

    // The controller owns the subscriptions; suppress the base class path.
    _subscribe() { /* intentionally empty — AudioController.wire() */ }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('size')) applySizePreset(this, AUDIO_SIZES);
        this.audio.rewireIfChanged();
    }

    render() {
        return html`
            <div class="card">
                ${this.label || feezal.isEditor ? html`<div class="caption">${this.label || 'Audio'}</div>` : ''}
                ${audioPanel(this.audio)}
                ${glassBadgeTray({unavailable: !this._available})}
            </div>`;
    }
}

customElements.define('feezal-element-glass-audio', FeezalElementGlassAudio);
export {FeezalElementGlassAudio};

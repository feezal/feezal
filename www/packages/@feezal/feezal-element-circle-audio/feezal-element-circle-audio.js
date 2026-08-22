/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';
import {AudioController, audioAttributes, audioDiscoveryMap, audioPanel, audioPanelStyles} from '@feezal/feezal-controller-audio';
import {availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';

/**
 * feezal-element-circle-audio (E188)
 *
 * Circle-family audio-processor card for lgsb2mqtt (LG soundbars). All
 * behaviour lives in @feezal/feezal-controller-audio; this is the circle
 * VIEW: a round mode badge on top (the family's disc signature), the panel
 * below, label underneath. Only the items the device reports are shown.
 */

class FeezalElementCircleAudio extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Audio', category: 'Circle', color: '#1565c0', icon: 'equalizer'},
            description: 'Audio settings card (LG soundbars via lgsb2mqtt, or any bridge with a status/set item tree): ' +
                'a round sound-mode badge, the mode select, bass / treble / channel level sliders with the device\'s ' +
                'own ranges, AV sync and the on/off flags. Only the items the device reports are shown.',
            discovery: {component: 'audio', map: audioDiscoveryMap},
            attributes: [
                // E188: the whole audio contract — one declaration, every family.
                ...audioAttributes,
                ...availabilityAttributes(),
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-audio-color', type: 'color', default: 'var(--primary-color)', help: 'Accent — mode disc, sliders, active flags.'},
                {property: '--feezal-audio-field-color', type: 'color', default: 'var(--secondary-background-color)', help: 'Select / flag surface colour.'},
                {property: '--feezal-audio-text-color', type: 'color', default: 'var(--primary-text-color)', help: 'Text colour.'},
                {property: '--feezal-audio-error-color', type: 'color', default: 'var(--error-color)', help: 'Unavailable badge colour.'},
            ],
            defaultStyle: {width: '300px', height: '360px'},
            restrict: {minWidth: 160, minHeight: 120},
        };
    }

    static properties = {
        label:     {type: String,  reflect: true},
        publish:   {type: String,  reflect: true},
        items:     {type: String,  attribute: 'items'},
        showFlags:  {type: Boolean, converter: feezalBoolean, attribute: 'show-flags'},
        showLevels: {type: Boolean, converter: feezalBoolean, attribute: 'show-levels'},
        showMode:   {type: Boolean, converter: feezalBoolean, attribute: 'show-mode'},
    };

    static styles = [feezalBaseStyles, audioPanelStyles, css`
        :host {
            display: flex; flex-direction: column; align-items: stretch;
            padding: 8px; box-sizing: border-box; overflow: auto; gap: 8px; position: relative;
            color: var(--feezal-audio-text-color, var(--primary-text-color));
        }
        .unavail {
            position: absolute; top: 4px; right: 4px; font-size: 18px; line-height: 1;
            color: var(--feezal-audio-error-color, var(--error-color)); opacity: 0.8; pointer-events: none; z-index: 2;
        }
        .disc {
            width: 72px; height: 72px; border-radius: 50%; align-self: center; flex: 0 0 auto;
            display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
            background: var(--feezal-audio-color, var(--primary-color)); color: var(--primary-background-color);
            text-align: center; padding: 6px; box-sizing: border-box;
        }
        .disc .mi { font-family: 'Material Icons'; font-size: 22px; line-height: 1; }
        .disc .mode { font-size: 9px; font-weight: 600; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .audio {
            --_audio-accent: var(--feezal-audio-color, var(--primary-color));
            --_audio-field-bg: var(--feezal-audio-field-color, var(--secondary-background-color));
            --_audio-on-color: var(--primary-background-color);
        }
        .label {
            flex: 0 0 auto; font-size: 14px; font-weight: 600; text-align: center;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
    `];

    constructor() {
        super();
        this.label = '';
        this.publish = '';
        // E188: the behaviour layer — wiring, capability discovery, every publish.
        this.audio = new AudioController(this);
    }

    // The controller owns the subscriptions; suppress the base class path.
    _subscribe() { /* intentionally empty — AudioController.wire() */ }

    updated(changed) {
        super.updated(changed);
        this.audio.rewireIfChanged();
    }

    render() {
        const mode = this.audio.mode;
        return html`
            ${this._available ? '' : html`<span class="unavail" title="Unavailable">!</span>`}
            <div class="disc"><span class="mi">equalizer</span>
                ${mode || feezal.isEditor ? html`<span class="mode">${mode ?? 'Mode'}</span>` : ''}</div>
            ${audioPanel(this.audio)}
            ${this.label || feezal.isEditor
                ? html`<span class="label">${this.label || (feezal.isEditor ? 'Audio' : '')}</span>` : ''}
        `;
    }
}

customElements.define('feezal-element-circle-audio', FeezalElementCircleAudio);
export {FeezalElementCircleAudio};

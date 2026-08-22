/* global feezal */
import {html, css, feezalBoolean} from '@feezal/feezal-element';
import {MetroTileBase} from '@feezal/feezal-metro';
import {AudioController, audioAttributes, audioDiscoveryMap, audioPanel, audioPanelStyles} from '@feezal/feezal-controller-audio';
import {availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';

/**
 * feezal-element-metro-audio (E188)
 *
 * Metro-tile audio-processor card for lgsb2mqtt (LG soundbars). All
 * behaviour lives in @feezal/feezal-controller-audio; this is the metro VIEW:
 * the front shows the icon + the current sound mode, the BACK (⋯ flip)
 * carries the full panel. Only the items the device reports are shown.
 */

class FeezalElementMetroAudio extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Audio', category: 'Metro', color: '#1ba1e2', icon: 'equalizer'},
            description: 'Metro tile audio settings (LG soundbars via lgsb2mqtt, or any bridge with a status/set item ' +
                'tree): the front shows the sound mode, the back holds the mode select, bass / treble / channel ' +
                'level sliders with the device\'s own ranges, AV sync and the flags. Only reported items are shown.',
            discovery: {component: 'audio', map: audioDiscoveryMap},
            attributes: [
                ...MetroTileBase.tileAttributes,
                // E188: the whole audio contract — one declaration, every family.
                ...audioAttributes.filter(a => a.name !== 'label'),   // label comes from the tile rows
                ...availabilityAttributes(),
            ],
            styles: MetroTileBase.tileStyles,
            defaultStyle: {width: '310px', height: '150px'},
            restrict: {minWidth: 70, minHeight: 70},
        };
    }

    static properties = {
        publish:   {type: String,  reflect: true},
        items:     {type: String,  attribute: 'items'},
        showFlags:  {type: Boolean, converter: feezalBoolean, attribute: 'show-flags'},
        showLevels: {type: Boolean, converter: feezalBoolean, attribute: 'show-levels'},
        showMode:   {type: Boolean, converter: feezalBoolean, attribute: 'show-mode'},
    };

    static styles = [MetroTileBase.styles, audioPanelStyles, css`
        .mode-line { font-size: var(--_metro-unit-size); opacity: 0.9; max-width: 90%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .back-content { position: absolute; inset: 8px 8px 18px 8px; overflow: auto; }
        .audio {
            --_audio-accent: var(--feezal-metro-text, #fff);
            --_audio-on-color: var(--feezal-metro-accent, var(--primary-color));
            --_audio-field-bg: rgba(255,255,255,0.18);
        }
        .audio select, .audio .flag { border-radius: 0; }   /* Metro: sharp corners */
    `];

    constructor() {
        super();
        this.size = '4x2';
        this.icon = 'equalizer';
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

    /** Front tap: flip to the panel (the mode is the front's information). */
    baseAction() { this._flip(true); }

    renderBadge() {
        return this._available ? '' : '!';
    }

    renderFront() {
        const mode = this.audio.mode;
        return html`
            ${this.icon ? html`<feezal-icon name="${this.icon}"></feezal-icon>` : ''}
            <div class="mode-line">${mode ?? (feezal.isEditor ? 'Sound mode' : '')}</div>`;
    }

    renderBack() {
        return html`<div @click="${e => e.stopPropagation()}">${audioPanel(this.audio)}</div>`;
    }
}

customElements.define('feezal-element-metro-audio', FeezalElementMetroAudio);
export {FeezalElementMetroAudio};

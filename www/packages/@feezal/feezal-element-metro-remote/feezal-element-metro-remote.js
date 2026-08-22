/* global feezal */
import {html, css, feezalBoolean} from '@feezal/feezal-element';
import {MetroTileBase} from '@feezal/feezal-metro';
import {RemoteController, remoteAttributes, remotePad, remotePadStyles} from '@feezal/feezal-controller-remote';
import {availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';

/**
 * feezal-element-metro-remote (E187)
 *
 * Metro-tile TV remote for lgtv2mqtt (webOS). All behaviour lives in
 * @feezal/feezal-controller-remote; this is the metro VIEW: the flat accent
 * tile carries the pad on its front (white keys on the accent, no flip —
 * the remote IS the detail). 4x4 by default; the large layout wants the tall
 * 4x6 or a manual resize.
 */

class FeezalElementMetroRemote extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Remote', category: 'Metro', color: '#1ba1e2', icon: 'settings_remote'},
            description: 'Metro tile TV remote (webOS via lgtv2mqtt, or any one-topic-per-key bridge): ' +
                'D-pad, navigation, volume/channel rockers; the large layout adds number and colour keys ' +
                'and the configurable app / input / output rows. Reflects volume, mute, sound output and the foreground app.',
            attributes: [
                // size / label / icon — the family's shared tile rows (icon unused on the pad face).
                ...MetroTileBase.tileAttributes.filter(a => a.name !== 'icon'),
                // E187: the whole remote contract — one declaration, every family.
                ...remoteAttributes,
                ...availabilityAttributes(),
            ],
            styles: [
                ...MetroTileBase.tileStyles,
                {property: '--feezal-remote-dpad-size', default: '120px', help: 'D-pad edge length.'},
            ],
            defaultStyle: {width: '310px', height: '310px'},
            restrict: {minWidth: 150, minHeight: 150},
        };
    }

    static properties = {
        publish: {type: String,  reflect: true},
        layout:  {type: String,  reflect: true},
        buttons:     {type: String, attribute: 'buttons'},
        showButtons: {type: Boolean, converter: feezalBoolean, attribute: 'show-buttons'},
        showVolume:  {type: Boolean, converter: feezalBoolean, attribute: 'show-volume'},
        subscribeVolume: {type: String, attribute: 'subscribe-volume'},
        subscribeMute:   {type: String, attribute: 'subscribe-mute'},
        subscribeOutput: {type: String, attribute: 'subscribe-output'},
        subscribeApp:    {type: String, attribute: 'subscribe-app'},
    };

    static styles = [MetroTileBase.styles, remotePadStyles, css`
        .front { cursor: default; }
        /* The pad fills the face above the family's label strip. */
        .center { inset: 8px 8px 18px 8px; justify-content: flex-start; overflow: auto; }
        .pad {
            width: 100%;
            --_remote-key-bg: rgba(255,255,255,0.18);
            --_remote-key-hover-bg: rgba(255,255,255,0.3);
            --_remote-key-active-bg: var(--feezal-metro-text, #fff);
            --_remote-key-active-color: var(--feezal-metro-accent, var(--primary-color));
            --_remote-dpad-size: var(--feezal-remote-dpad-size, 120px);
        }
        .pad .key { border-radius: 0; }          /* Metro: sharp corners */
        .pad .dpad .key { border-radius: 0; }
        .pad .dpad .ok { border-radius: 0; }
    `];

    constructor() {
        super();
        this.size = '4x4';
        this.publish = '';
        this.layout = 'compact';
        // E187: the behaviour layer — wiring, state, every publish.
        this.remote = new RemoteController(this);
    }

    // The controller owns the subscriptions; suppress the base class path.
    _subscribe() { /* intentionally empty — RemoteController.wire() */ }

    updated(changed) {
        super.updated(changed);
        this.remote.rewireIfChanged();
    }

    /** No front tap action — the keys are the actions. */
    baseAction() { /* keys publish individually */ }

    renderBadge() {
        return this._available ? '' : '!';
    }

    renderFront() {
        // Stop the key clicks from reaching the tile's front-tap handler.
        return html`<div @click="${e => e.stopPropagation()}" style="width:100%">${remotePad(this.remote)}</div>`;
    }
}

customElements.define('feezal-element-metro-remote', FeezalElementMetroRemote);
export {FeezalElementMetroRemote};

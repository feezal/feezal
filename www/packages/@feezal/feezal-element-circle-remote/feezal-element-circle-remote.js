/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';
import {RemoteController, remoteAttributes, remotePad, remotePadStyles} from '@feezal/feezal-controller-remote';
import {availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';

/**
 * feezal-element-circle-remote (E187)
 *
 * Circle-family TV remote for lgtv2mqtt (webOS). All behaviour lives in
 * @feezal/feezal-controller-remote; this is the circle VIEW: the D-pad is a
 * DISC (the family's round signature) with the keys laid out around it on a
 * surface card, label below.
 */

class FeezalElementCircleRemote extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Remote', category: 'Circle', color: '#1565c0', icon: 'settings_remote'},
            description: 'Round-pad TV remote (webOS via lgtv2mqtt, or any one-topic-per-key bridge): ' +
                'D-pad disc, navigation, volume/channel rockers; the large layout adds number and colour keys ' +
                'and the configurable app / input / output rows. Reflects volume, mute, sound output and the foreground app.',
            attributes: [
                {name: 'label', type: 'string', default: '', help: 'Optional label shown below the pad.'},
                // E187: the whole remote contract — one declaration, every family.
                ...remoteAttributes,
                ...availabilityAttributes(),
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-remote-color', type: 'color', default: 'var(--primary-color)', help: 'Accent — D-pad disc and active keys.'},
                {property: '--feezal-remote-key-color', type: 'color', default: 'var(--secondary-background-color)', help: 'Key surface colour.'},
                {property: '--feezal-remote-text-color', type: 'color', default: 'var(--primary-text-color)', help: 'Key glyph / label colour.'},
                {property: '--feezal-remote-error-color', type: 'color', default: 'var(--error-color)', help: 'Unavailable badge colour.'},
                {property: '--feezal-remote-dpad-size', default: '140px', help: 'D-pad disc diameter.'},
            ],
            defaultStyle: {width: '300px', height: '360px'},
            restrict: {minWidth: 160, minHeight: 200},
        };
    }

    static properties = {
        label:   {type: String,  reflect: true},
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

    static styles = [feezalBaseStyles, remotePadStyles, css`
        :host {
            display: flex; flex-direction: column; align-items: center;
            padding: 8px; box-sizing: border-box; overflow: auto; gap: 8px; position: relative;
            color: var(--feezal-remote-text-color, var(--primary-text-color));
        }
        .unavail {
            position: absolute; top: 4px; right: 4px; font-size: 18px; line-height: 1;
            color: var(--feezal-remote-error-color, var(--error-color)); opacity: 0.8; pointer-events: none; z-index: 2;
        }
        .pad {
            width: 100%;
            --_remote-key-bg: var(--feezal-remote-key-color, var(--secondary-background-color));
            --_remote-key-hover-bg: color-mix(in srgb, var(--feezal-remote-color, var(--primary-color)) 25%, var(--feezal-remote-key-color, var(--secondary-background-color)));
            --_remote-key-active-bg: var(--feezal-remote-color, var(--primary-color));
            --_remote-key-active-color: var(--primary-background-color);
            --_remote-dpad-size: var(--feezal-remote-dpad-size, 140px);
        }
        /* The family signature: the D-pad is a disc. */
        .pad .dpad {
            border-radius: 50%; overflow: hidden; gap: 2px;
            background: var(--feezal-remote-color, var(--primary-color));
        }
        .pad .dpad .key { border-radius: 0; background: transparent; color: var(--primary-background-color); }
        .pad .dpad .key:hover { background: rgba(255,255,255,0.18); }
        .pad .dpad .ok { border-radius: 50%; background: var(--primary-background-color); color: var(--feezal-remote-color, var(--primary-color)); }
        .pad .key { border-radius: 999px; }
        .label {
            flex: 0 0 auto; font-size: 14px; font-weight: 600; text-align: center;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
        }
    `];

    constructor() {
        super();
        this.label = '';
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

    render() {
        return html`
            ${this._available ? '' : html`<span class="unavail" title="Unavailable">!</span>`}
            ${remotePad(this.remote)}
            ${this.label || feezal.isEditor
                ? html`<span class="label">${this.label || (feezal.isEditor ? 'Remote' : '')}</span>` : ''}
        `;
    }
}

customElements.define('feezal-element-circle-remote', FeezalElementCircleRemote);
export {FeezalElementCircleRemote};

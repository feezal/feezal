/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';
import {applySizePreset, glassCardStyles, glassBadgeTray} from '@feezal/feezal-glass';
import {RemoteController, remoteAttributes, remotePad, remotePadStyles} from '@feezal/feezal-controller-remote';
import {availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';

/**
 * feezal-element-glass-remote (E187)
 *
 * Frosted-glass TV remote for lgtv2mqtt (webOS) — and any bridge with a
 * one-topic-per-action set tree. All behaviour lives in
 * @feezal/feezal-controller-remote; this is the glass VIEW: the family's
 * frost card around the shared pad, the accent on active keys.
 */

const REMOTE_SIZES = {'4x4': [354, 354], '4x6': [354, 520], '2x4': [172, 354]};

class FeezalElementGlassRemote extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Remote', category: 'Glass', color: '#7aa5c9', icon: 'settings_remote'},
            description: 'Frosted-glass TV remote (webOS via lgtv2mqtt, or any one-topic-per-key bridge): ' +
                'D-pad, navigation, volume/channel rockers; the large layout adds number and colour keys ' +
                'and the configurable app / input / output rows. Reflects volume, mute, sound output and the foreground app.',
            attributes: [
                {name: 'size', type: 'select', options: ['', '4x4', '4x6', '2x4'], default: '',
                    help: 'Preset size: 4x4 = compact square, 4x6 = tall (large layout), 2x4 = narrow column. Empty keeps the current/manual size.'},
                {name: 'label', type: 'string', help: 'Caption above the pad (e.g. the TV name).'},
                // E187: the whole remote contract — one declaration, every family.
                ...remoteAttributes,
                ...availabilityAttributes(),
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-accent', type: 'color', default: 'var(--primary-color)', help: 'Active key colour (mute on, current app / output).'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Caption font size.'},
                {property: '--feezal-remote-dpad-size', default: '132px', help: 'D-pad edge length.'},
            ],
            defaultStyle: {width: '354px', height: '354px'},
            restrict: {minWidth: 160, minHeight: 200},
        };
    }

    static properties = {
        size:    {type: String,  reflect: true},
        label:   {type: String,  reflect: true},
        publish: {type: String,  reflect: true},
        layout:  {type: String,  reflect: true},
        // The list + status topics are attribute → property sync only (no
        // reflection, no constructor defaults — nothing stamped on save).
        buttons:     {type: String, attribute: 'buttons'},
        showButtons: {type: Boolean, converter: feezalBoolean, attribute: 'show-buttons'},
        showVolume:  {type: Boolean, converter: feezalBoolean, attribute: 'show-volume'},
        subscribeVolume: {type: String, attribute: 'subscribe-volume'},
        subscribeMute:   {type: String, attribute: 'subscribe-mute'},
        subscribeOutput: {type: String, attribute: 'subscribe-output'},
        subscribeApp:    {type: String, attribute: 'subscribe-app'},
        degrade: {type: Boolean, reflect: true},
    };

    static styles = [feezalBaseStyles, glassCardStyles, remotePadStyles, css`
        .card { padding: 12px; overflow: auto; justify-content: flex-start; gap: 6px; }
        :host([degrade]) .card {
            -webkit-backdrop-filter: none; backdrop-filter: none;
            background: var(--feezal-glass-solid, rgba(255,255,255,0.82));
        }
        .caption {
            font-size: var(--feezal-glass-font-size-label, 12px); font-weight: 600; text-transform: uppercase;
            letter-spacing: 0.04em; opacity: 0.75; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pad {
            --_remote-key-active-bg: var(--feezal-glass-accent, var(--primary-color));
            --_remote-dpad-size: var(--feezal-remote-dpad-size, 132px);
            width: 100%;
        }
    `];

    constructor() {
        super();
        this.size = '';
        this.label = '';
        this.publish = '';
        this.layout = 'compact';
        this.degrade = false;
        // E187: the behaviour layer — wiring, state, every publish.
        this.remote = new RemoteController(this);
    }

    // The controller owns the subscriptions; suppress the base class path.
    _subscribe() { /* intentionally empty — RemoteController.wire() */ }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('size')) applySizePreset(this, REMOTE_SIZES);
        this.remote.rewireIfChanged();
    }

    render() {
        return html`
            <div class="card">
                ${this.label || feezal.isEditor ? html`<div class="caption">${this.label || 'Remote'}</div>` : ''}
                ${remotePad(this.remote)}
                ${glassBadgeTray({unavailable: !this._available})}
            </div>`;
    }
}

customElements.define('feezal-element-glass-remote', FeezalElementGlassRemote);
export {FeezalElementGlassRemote};

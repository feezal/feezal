/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css, publishLocalAttribute} from '@feezal/feezal-element';
import {applySizePreset, glassCardStyles} from '@feezal/feezal-glass';

/**
 * feezal-element-glass-button (E58)
 *
 * Frosted-glass action button (renamed from glass-scene): an icon + label
 * squircle that publishes
 * a payload on tap. Optionally subscribes to a state topic — a payload equal
 * to `payload-active` renders the card in its active (brighter) state.
 *
 * Family conventions (all feezal-element-glass-*): hand-rolled Lit (no UI
 * library in the viewer bundle), frost via backdrop-filter over the theme
 * wallpaper, `degrade` boolean for weak GPUs (semi-opaque solid card, zero
 * per-frame blur cost), squircle corners via corner-shape where supported.
 */

class FeezalElementGlassButton extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Button', category: 'Glass', color: '#7aa5c9', icon: 'auto_awesome'},
            description: 'Frosted-glass button — publishes a payload on tap. Pair with the ' +
                'glass theme (wallpaper shines through the blur); set "degrade" on weak GPUs.',
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x2', '2x1'], default: '',
                    help: 'Preset size: 2x2 = square (150×150), 2x1 = wide (150×75). Empty keeps the current/manual size.'},
                {name: 'label',   type: 'string', help: 'Label under the icon.'},
                {name: 'icon',    type: 'string', default: 'auto_awesome', help: 'Icon name (icon picker sets, e.g. "movie" or "mdi:sofa").'},
                {name: 'publish', type: 'mqttTopic', help: 'Topic the tap publishes to.'},
                publishLocalAttribute,
                {name: 'payload', type: 'string', default: '1', help: 'Payload published on tap.'},
                {name: 'subscribe', type: 'mqttTopic', help: 'Optional state topic — highlights the card while active.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'payload-active', type: 'string', default: '1', help: 'Subscribed payload that counts as active.'},
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — visually similar, no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-accent', type: 'color', default: '#ff9f0a', help: 'Icon colour in the active state.'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-icon-size', default: '28px', help: 'Icon font size.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Label font size.'},
            ],
            defaultStyle: {width: '172px', height: '128px'},
            restrict: {minWidth: 60, minHeight: 60},
        };
    }

    static properties = {
        publishLocal: {type: Boolean, reflect: true, attribute: 'publish-local'},
        size:          {type: String,  reflect: true},
        label:         {type: String,  reflect: true},
        icon:          {type: String,  reflect: true},
        publish:       {type: String,  reflect: true},
        payload:       {type: String,  reflect: true},
        payloadActive: {type: String,  reflect: true, attribute: 'payload-active'},
        degrade:       {type: Boolean, reflect: true},
        _active:       {state: true},
    };

    static styles = [feezalBaseStyles, glassCardStyles, css`
        .card {
            cursor: pointer;
            gap: 4px;
            transition: transform 0.15s ease, background 0.2s ease;
        }
        .card:active { transform: scale(0.96); }
        .card.active { background: var(--feezal-glass-on-tint, rgba(255,255,255,0.62)); }
        feezal-icon {
            font-size: var(--feezal-glass-icon-size, 28px); line-height: 1;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            transition: color 0.2s ease;
        }
        .card.active feezal-icon { color: var(--feezal-glass-accent, #ff9f0a); }
        .label {
            font-size: var(--feezal-glass-font-size-label, 12px); font-weight: 600; line-height: 1.2;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        /* E105: much wider than tall → horizontal layout (Apple-Home wide
           tile): icon left, label right of it. */
        @container (min-aspect-ratio: 2/1) {
            .card {
                display: grid;
                grid-template: 'icon label' auto / auto 1fr;
                align-content: center;
                align-items: center;
                column-gap: 10px;
                text-align: left;
            }
            .card > feezal-icon { grid-area: icon; }
            .card .label { grid-area: label; }
        }
    `];

    constructor() {
        super();
        this.publishLocal = false;
        this.size = '';
        this.label = '';
        this.icon = 'auto_awesome';
        this.publish = '';
        this.payload = '1';
        this.payloadActive = '1';
        this.degrade = false;
        this._active = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this._wireSubscriptions();
    }

    _wireSubscriptions() {
        this.__wireSig = this.subscribe ?? '';
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                this._active = String(v) === String(this.payloadActive);
            });
        }
    }

    updated(changed) {
        super.updated(changed);
        // Topic set on the live canvas → rewire (see glass-light).
        if (this.isConnected && this.__wireSig !== undefined && (this.subscribe ?? '') !== this.__wireSig) {
            this._unsubscribe();
            this._wireSubscriptions();
        }
        // The size grid writes the element's inline geometry (editor keeps
        // full manual control afterwards).
        if (changed.has('size')) applySizePreset(this);
    }

    _tap() {
        if (feezal.isEditor) {
            return;
        }
        if (this.publish) {
            feezal.connection.pub(this.publish, this.payload ?? '1', {local: this.publishLocal});
        }
    }

    render() {
        return html`
            <div class="card ${this._active ? 'active' : ''}" role="button" tabindex="0"
                @click="${this._tap}"
                @keydown="${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._tap(); } }}">
                <feezal-icon name="${this.icon || 'auto_awesome'}"></feezal-icon>
                <span class="label">${this.label || (feezal.isEditor ? 'Button' : '')}</span>
            </div>
        `;
    }
}

customElements.define('feezal-element-glass-button', FeezalElementGlassButton);
export {FeezalElementGlassButton};

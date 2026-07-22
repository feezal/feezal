/* global feezal */
import {feezalBaseStyles, html, css, publishLocalAttribute} from '@feezal/feezal-element';
import {EinkBase, einkCardStyles} from '@feezal/feezal-eink';

/**
 * feezal-element-eink-button (E57)
 *
 * E-ink action button: icon + uppercase label card that publishes a payload
 * on tap (the whole card is the tap target). Optionally subscribes to a
 * state topic — a payload equal to `payload-active` renders the card as the
 * inverted block (the 1-bit active treatment; there is no accent colour
 * here). Same MQTT contract as feezal-element-glass-button.
 *
 * Family conventions (E57): black-on-white via --_fg/--_bg, thick rules,
 * no animation/transition/hover, redraw-deduped via renderSignature().
 */

class FeezalElementEinkButton extends EinkBase {
    static get feezal() {
        return {
            palette: {name: 'Button', category: 'Eink', color: '#222222', icon: 'smart_button'},
            description: 'E-ink button card — publishes a payload on tap; inverted block while active. 1-bit, redraw-deduped.',
            attributes: [
                {name: 'label',   type: 'string', help: 'Label under the icon (rendered uppercase).'},
                {name: 'icon',    type: 'string', default: 'auto_awesome', help: 'Icon name (icon picker sets, e.g. "movie" or "mdi:sofa").'},
                {name: 'publish', type: 'mqttTopic', help: 'Topic the tap publishes to.'},
                publishLocalAttribute,
                {name: 'payload', type: 'string', default: '1', help: 'Payload published on tap.'},
                {name: 'subscribe', type: 'mqttTopic', help: 'Optional state topic — inverts the card while active.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'payload-active', type: 'string', default: '1', help: 'Subscribed payload that counts as active.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-eink-font-size-label', default: '13px', help: 'Label font size.'},
                {property: '--feezal-eink-icon-size', default: '28px', help: 'Icon font size.'},
                {property: '--feezal-eink-rule', default: '3px', help: 'Rule/border thickness (≥2px).'},
            ],
            defaultStyle: {width: '150px', height: '110px'},
            restrict: {minWidth: 60, minHeight: 60},
        };
    }

    static properties = {
        publishLocal:  {type: Boolean, reflect: true, attribute: 'publish-local'},
        label:         {type: String,  reflect: true},
        icon:          {type: String,  reflect: true},
        publish:       {type: String,  reflect: true},
        payload:       {type: String,  reflect: true},
        payloadActive: {type: String,  reflect: true, attribute: 'payload-active'},
    };

    static styles = [feezalBaseStyles, einkCardStyles, css`
        .card {
            gap: 4px;
            align-items: center; justify-content: center; text-align: center;
            cursor: pointer;
        }
        feezal-icon { font-size: var(--feezal-eink-icon-size, 28px); line-height: 1; }
    `];

    constructor() {
        super();
        this.publishLocal = false;
        this.label = '';
        this.icon = 'auto_awesome';
        this.publish = '';
        this.payload = '1';
        this.payloadActive = '1';
        // Plain field, not reactive — MQTT pokes go through requestUpdate()
        // and the E57 renderSignature() dedup (see EinkBase.shouldUpdate).
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
                this.requestUpdate();
            });
        }
    }

    updated(changed) {
        super.updated(changed);
        // Topic set on the live canvas → rewire (see glass-button).
        if (this.isConnected && this.__wireSig !== undefined && (this.subscribe ?? '') !== this.__wireSig) {
            this._unsubscribe();
            this._wireSubscriptions();
        }
    }

    _tap() {
        if (feezal.isEditor) {
            return;
        }
        if (this.publish) {
            feezal.connection.pub(this.publish, this.payload ?? '1', {local: this.publishLocal});
        }
    }

    /** E57 redraw dedup: the inverted/active state is the only MQTT-driven visible output. */
    renderSignature() {
        return String(this._active);
    }

    render() {
        return html`
            <div class="card ${this._active ? 'inv' : ''}" role="button" tabindex="0"
                @click="${this._tap}"
                @keydown="${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._tap(); } }}">
                <feezal-icon name="${this.icon || 'auto_awesome'}"></feezal-icon>
                <span class="label">${this.label || (feezal.isEditor ? 'Button' : '')}</span>
            </div>
        `;
    }
}

customElements.define('feezal-element-eink-button', FeezalElementEinkButton);
export {FeezalElementEinkButton};

/* global feezal */
import {html, publishLocalAttribute} from '@feezal/feezal-element';
import {MetroTileBase} from '@feezal/feezal-metro';

/**
 * feezal-element-metro-button (E55, renamed E152)
 *
 * The Metro family's generic action tile: icon + label, tap publishes a
 * payload and/or navigates to a view (start-screen-as-navigation), optional
 * live badge from a topic.
 *
 * E152: was `feezal-element-metro-tile` — "Tile" was a Metro-only misnomer for
 * what every other family calls the button (material/glass/eink/paper/carbon
 * `-button`). The shared live-tile base class it used to carry moved to
 * `@feezal/feezal-metro` in the same change.
 */

class FeezalElementMetroButton extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Button', category: 'Metro', color: '#1ba1e2', icon: 'grid_view'},
            description: 'Generic Metro start-screen tile: icon + label, tap publishes a payload and/or navigates to a view; optional live badge from a topic.',
            attributes: [
                ...MetroTileBase.tileAttributes,
                {name: 'publish', type: 'mqttTopic', help: 'Topic published on tap (empty = none).'},
                {name: 'payload', type: 'string', default: '1', help: 'Payload published on tap.'},
                // E117: the tap publish is button-shaped UI wiring (its
                // navigate-to-view action is already page-local).
                publishLocalAttribute,
                {name: 'view', dropdown: 'views', help: 'View to navigate to on tap (empty = none).'},
                {name: 'subscribe', type: 'mqttTopic', help: 'Optional badge topic — the payload shows top-right (live-tile count).'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the badge value within the MQTT message. Default: payload'},
            ],
            styles: MetroTileBase.tileStyles,
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
        };
    }

    static properties = {
        publish: {type: String, reflect: true},
        payload: {type: String, reflect: true},
        publishLocal: {type: Boolean, reflect: true, attribute: 'publish-local'},
        view:    {type: String, reflect: true},
        _badge:  {state: true},
    };

    constructor() {
        super();
        this.publish = '';
        this.payload = '1';
        this.publishLocal = false;
        this.view = '';
        this._badge = '';
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                this._badge = v === null || v === undefined ? '' : String(v);
            });
        }
    }

    renderFront() {
        return this.icon ? html`<feezal-icon name="${this.icon}"></feezal-icon>` : '';
    }

    renderBadge() {
        return this._badge;
    }

    baseAction() {
        if (this.publish) feezal.connection.pub(this.publish, this.payload, {local: this.publishLocal});   // E117
        if (this.view && feezal.site) feezal.site.view = this.view;
    }
}

customElements.define('feezal-element-metro-button', FeezalElementMetroButton);
export {FeezalElementMetroButton};

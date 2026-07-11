/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-paper-card (E87)
 *
 * A paper card — heading + optional subhead and header image, paper elevation
 * shadow — with a `${msg.*}`-templated body (same templating idiom as
 * feezal-element-basic-template: a light-DOM <template> child evaluated
 * against the last message on `subscribe`).
 *
 * Successor of feezal-element-paper-card-template (renamed + modernised):
 * the legacy tag stays registered below as a deprecated alias that maps the
 * old `topic` attribute onto `subscribe`, so saved dashboards keep working.
 */
class FeezalElementPaperCard extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                category: 'Paper',
                name: 'Card',
                color: '#4a6080'
            },
            description: 'Paper card with heading, optional subhead/header image, elevation shadow ' +
                'and a templated body driven by an MQTT topic.',
            attributes: [
                'subscribe',
                {name: 'template', textarea: true, template: true, editor: true, help: 'Card body. Use ${msg.payload} to insert the received MQTT value. Other message properties like ${msg.topic} are also available.'},
                {name: 'heading',      type: 'string', default: '', help: 'Card heading (title row).'},
                {name: 'subhead',      type: 'string', default: '', help: 'Secondary text line under the heading.'},
                {name: 'image',        type: 'string', default: '', help: 'Header image URL shown above the heading (Asset Manager asset or any URL).'},
                {name: 'image-height', type: 'string', default: '', help: 'Header image height (e.g. "120px"). Empty: natural image height, capped at 40% of the card.'},
                {name: 'elevation',    type: 'number', default: 1, min: 0, max: 5, step: 1, help: 'Paper elevation shadow depth (0–5).'}
            ],
            styles: [
                'top', 'left', 'width', 'height',
                'font', 'color', 'text-align',
                'background', 'border', 'border-radius', 'padding', 'overflow',
                {property: '--paper-card-background-color', type: 'color', default: 'var(--card-background-color)', help: 'Card sheet background.'},
                {property: '--paper-card-header-color',     type: 'color', default: 'var(--primary-text-color)',    help: 'Heading text colour.'},
                {property: '--content-overflow', default: 'auto', help: 'Overflow behaviour of the card body (auto | hidden | scroll | visible).'}
            ],
            restrict: {minWidth: 12, minHeight: 12},
            defaultStyle: {
                width: '200px',
                height: '120px',
                color: 'var(--primary-text-color)'
            }
        };
    }

    static properties = {
        subscribe:   {type: String, reflect: true},
        heading:     {type: String, reflect: true},
        subhead:     {type: String, reflect: true},
        image:       {type: String, reflect: true},
        imageHeight: {type: String, reflect: true, attribute: 'image-height'},
        elevation:   {type: Number, reflect: true},
        msg:         {state: true},
    };

    // Paper elevation shadows (paper-styles shadow classes 0–5); the
    // transition animates runtime elevation changes (control topics / E50
    // condition rows) — always on, replacing the old animated-shadow toggle.
    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            border-radius: 2px;
            background: var(--paper-card-background-color, var(--card-background-color, #fff));
            transition: box-shadow 0.28s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 2px 2px 0 rgba(0,0,0,0.14), 0 1px 5px 0 rgba(0,0,0,0.12), 0 3px 1px -2px rgba(0,0,0,0.2);
        }
        :host([elevation="0"]) { box-shadow: none; }
        :host([elevation="2"]) { box-shadow: 0 4px 5px 0 rgba(0,0,0,0.14), 0 1px 10px 0 rgba(0,0,0,0.12), 0 2px 4px -1px rgba(0,0,0,0.4); }
        :host([elevation="3"]) { box-shadow: 0 6px 10px 0 rgba(0,0,0,0.14), 0 1px 18px 0 rgba(0,0,0,0.12), 0 3px 5px -1px rgba(0,0,0,0.4); }
        :host([elevation="4"]) { box-shadow: 0 8px 10px 1px rgba(0,0,0,0.14), 0 3px 14px 2px rgba(0,0,0,0.12), 0 5px 5px -3px rgba(0,0,0,0.4); }
        :host([elevation="5"]) { box-shadow: 0 16px 24px 2px rgba(0,0,0,0.14), 0 6px 30px 5px rgba(0,0,0,0.12), 0 8px 10px -5px rgba(0,0,0,0.4); }
        .card-image {
            display: block;
            width: 100%;
            object-fit: cover;
            max-height: 40%;
            border-radius: 2px 2px 0 0;
        }
        .card-header {
            padding: 12px 16px 0;
        }
        .card-heading {
            font-size: 20px;
            font-weight: 500;
            color: var(--paper-card-header-color, var(--primary-text-color, #212121));
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .card-subhead {
            font-size: 13px;
            color: var(--secondary-text-color, #757575);
            margin-top: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .card-content {
            flex: 1;
            min-height: 0;
            padding: 12px 16px;
            overflow: var(--content-overflow, auto);
        }
    `];

    constructor() {
        super();
        this.subscribe   = '';
        this.heading     = '';
        this.subhead     = '';
        this.image       = '';
        this.imageHeight = '';
        this.elevation   = 1;
        this.msg         = {};
    }

    render() {
        return html`
            ${this.image ? html`
                <img class="card-image" src="${this.image}" alt=""
                    style="${this.imageHeight ? `height:${this.imageHeight};max-height:none;` : ''}">` : ''}
            ${(this.heading || this.subhead) ? html`
                <div class="card-header">
                    ${this.heading ? html`<div class="card-heading">${this.heading}</div>` : ''}
                    ${this.subhead ? html`<div class="card-subhead">${this.subhead}</div>` : ''}
                </div>` : ''}
            <div id="content" class="card-content"></div>
        `;
    }

    updated(changed) {
        super.updated(changed);
        if (changed.has('subscribe')) {
            this._topicChanged();
        }
        if (changed.has('msg')) {
            this._msgChanged();
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._topicSubscription) {
            feezal.connection.unsubscribe(this._topicSubscription);
            this._topicSubscription = null;
        }
    }

    _topicChanged() {
        if (this._topicSubscription) {
            feezal.connection.unsubscribe(this._topicSubscription);
            this._topicSubscription = null;
        }
        if (this.subscribe) {
            this._topicSubscription = feezal.connection.sub(
                this.subscribe,
                msg => { this.msg = msg; }
            );
        }
    }

    _msgChanged() {
        if (!this._processTemplate && this.querySelector('template')) {
            // Build the template function from the light-DOM <template> child
            // (same mechanism as feezal-element-basic-template).
            // eslint-disable-next-line no-new-func
            this._processTemplate = new Function(
                'msg',
                'return `' + this.querySelector('template').innerHTML + '`;'
            );
        }
        if (!this.msg || Object.keys(this.msg).length === 0) {
            return;
        }
        try {
            const content = this.renderRoot.querySelector('#content');
            if (content && this._processTemplate) {
                content.innerHTML = this._processTemplate(this.msg);
            }
        } catch (error) {
            console.error(error.message);
        }
    }
}

window.customElements.define('feezal-element-paper-card', FeezalElementPaperCard);

/**
 * Deprecated alias — the pre-E87 tag. Maps the legacy `topic` attribute onto
 * `subscribe` so saved dashboards keep working; never appears in the palette
 * (the palette only lists package-name tags).
 */
class FeezalElementPaperCardTemplate extends FeezalElementPaperCard {
    connectedCallback() {
        if (this.hasAttribute('topic') && !this.hasAttribute('subscribe')) {
            this.setAttribute('subscribe', this.getAttribute('topic'));
        }
        super.connectedCallback();
        console.warn('[feezal] <feezal-element-paper-card-template> is deprecated — use <feezal-element-paper-card> (the legacy tag keeps working).');
    }
}

window.customElements.define('feezal-element-paper-card-template', FeezalElementPaperCardTemplate);

export {FeezalElementPaperCard, FeezalElementPaperCardTemplate};

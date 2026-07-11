/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

class FeezalElementBasicImage extends FeezalElement {
    static get feezal() {
        return {
            palette: {category: 'Basic', name: 'Image', color: '#4a6080'},
            description: 'Displays a static or MQTT-updated image.',
            attributes: [
                {
                    name: 'src',
                    type: 'string',
                    help: 'URL of the image. Can also be updated via the subscribe topic (MQTT payload replaces this value).'
                },
                {
                    name: 'alt',
                    type: 'string',
                    help: 'Alternative text for the image (accessibility).'
                },
                {
                    name: 'fit',
                    type: 'select',
                    options: ['cover', 'contain', 'fill', 'none', 'scale-down'],
                    default: 'contain',
                    help: 'CSS object-fit value controlling how the image is scaled to fill the element.'
                },
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.url" to navigate into a JSON payload.'},
                {name: 'click-through', type: 'boolean', default: false,
                    help: 'Viewer: let clicks/taps pass through this element to whatever sits beneath it (e.g. a button under a decorative image). In the editor the element stays selectable/draggable.'}
            ],
            styles: ['top', 'left', 'width', 'height', 'border', 'border-radius', 'padding', 'background'],
            defaultStyle: {width: '100px', height: '80px'}
        };
    }

    static properties = {
        src:       {type: String,  reflect: true},
        alt:       {type: String,  reflect: true},
        fit:       {type: String,  reflect: true},
        clickThrough: {type: Boolean, reflect: true, attribute: 'click-through'},
        _dynSrc:   {state: true}
    };

    static styles = [feezalBaseStyles, css`
        :host { display: flex; box-sizing: border-box; overflow: hidden; }
        /* E82 pattern (same as basic-template): click-through — pointer events
           pass to whatever sits beneath. Gated on the ABSENCE of the editor's
           feezal-editable class so the canvas element stays selectable. */
        :host([click-through]:not(.feezal-editable)) {
            pointer-events: none;
        }
        img {
            width: 100%; height: 100%;
            object-fit: var(--img-fit, contain);
            display: block;
        }
        .editor-placeholder {
            flex: 1; border: 2px dashed #4a6080; background: #e8edf2; border-radius: 4px;
            display: flex; align-items: center; justify-content: center; gap: 4px;
            font-size: 11px; color: #4a6080; user-select: none; box-sizing: border-box;
        }
        .editor-placeholder .icon { font-family: 'Material Icons'; font-size: 16px; font-style: normal; }
    `];

    constructor() {
        super();
        this.src     = '';
        this.alt     = '';
        this.fit     = 'contain';
        this.clickThrough = false;
        this._dynSrc = null;
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                this._dynSrc = this.getProperty(msg, this.messageProperty);
            });
        }
    }

    render() {
        const fitStyle = `--img-fit: ${this.fit || 'contain'};`;
        const src = this._dynSrc || this.src;
        return html`
            <style>:host { ${fitStyle} }</style>
            ${src
                ? html`<img src="${src}" alt="${this.alt || ''}">`
                : html`<div class="editor-placeholder"><span class="icon">image</span> Image</div>`}`;
    }
}

customElements.define('feezal-element-basic-image', FeezalElementBasicImage);
export {FeezalElementBasicImage};

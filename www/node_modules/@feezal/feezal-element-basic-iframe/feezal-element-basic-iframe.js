/* global feezal */
import {FeezalElement, html, css} from '@feezal/feezal-element';

class FeezalElementBasicIframe extends FeezalElement {
    static styles = [FeezalElement.styles, css`
        iframe {
            border: var(--feezal-basic-iframe-border);
            padding: 0;
            margin: 0;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
        }
    `];

    static get feezal() {
        return {
            palette: {
                category: 'Basic',
                name: 'Inlineframe',
                color: '#4a6080'
            },
            attributes: [
                'src',
                {name: 'persist', type: 'boolean', label: 'Persist on view change'},
                {name: 'preload', type: 'boolean', label: 'Preload in background'},
                {name: 'refresh', type: 'number',  label: 'Auto-refresh (s, 0 = off)'},
                'subscribe',
                'messageProperty'
            ],
            baseAttribute: 'src',
            styles: [
                'top', 'left', 'width', 'height',
                '--feezal-basic-iframe-border'
            ],
            restrict: {minWidth: 12, minHeight: 12}
        };
    }

    static properties = {
        src:     {type: String,  reflect: true},
        persist: {type: Boolean, reflect: true},
        preload: {type: Boolean, reflect: true},
        refresh: {type: Number,  reflect: true},
    };

    constructor() {
        super();
        this.src     = '';
        this.persist = false;
        this.preload = false;
        this.refresh = 0;
    }

    render() {
        return html`<iframe src="${this.src}" frameborder="0"></iframe>`;
    }
}

window.customElements.define('feezal-element-basic-iframe', FeezalElementBasicIframe);

export {FeezalElementBasicIframe};
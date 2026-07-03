import {FeezalPolymerElement, html} from "@feezal/feezal-element/feezal-polymer-element.js";

class FeezalElementPaperBadge extends FeezalPolymerElement {
    static get template() {
        return html`
            
        `;
    }
    static get properties() {
        return {
            subscribe: {
                type: String,
                value: '',
                reflectToAttribute: true,
            }


        }
    }


    static get feezal() {
        return {
            palette: {
                category: 'Paper',
                name: 'Badge',
                color: '#4a6080'
            },
            attributes: [
                'subscribe',
                'messageProperty'
            ],
            styles: [
                'top',
                'left',
                'width',
                'height',
                'font',
                'color',
                'text-align',
                'background',
                'border',
                'overflow',
            ],
            restrict: {
                minWidth: 36,
                minHeight: 12
            },
            defaultStyle: {
                width: '60px',
                height: '20px'
            }
        };
    }

}

window.customElements.define('feezal-element-paper-badge', FeezalElementPaperBadge);

export {FeezalElementPaperBadge};
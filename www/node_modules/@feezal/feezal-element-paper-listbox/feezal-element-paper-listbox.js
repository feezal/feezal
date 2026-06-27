import {FeezalPolymerElement, html} from "@feezal/feezal-element/feezal-polymer-element.js";

class FeezalElementPaperListbox extends FeezalPolymerElement {
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
                name: 'Listbox',
                color: '#4a6080'
            },
            attributes: [
                'subscribe'
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

window.customElements.define('feezal-element-paper-listbox', FeezalElementPaperListbox);

export {FeezalElementPaperListbox};
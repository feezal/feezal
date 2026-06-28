import {FeezalPolymerElement, html} from "@feezal/feezal-element/feezal-polymer-element.js";

import '@polymer/paper-dialog/paper-dialog';


class FeezalElementPaperDialog extends FeezalPolymerElement {
    static get template() {
        return html`
            <style include="feezal-style-element"></style>
            <div>
                <paper-dialog>
                    <h2>Header</h2>
                    <paper-dialog-scrollable>
                        Lorem ipsum...
                    </paper-dialog-scrollable>
                    <div class="buttons">
                        <paper-button dialog-dismiss>Cancel</paper-button>
                        <paper-button dialog-confirm autofocus>Accept</paper-button>
                    </div>
                </paper-dialog>
            </div>
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
                name: 'Dialog',
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

window.customElements.define('feezal-element-paper-dialog', FeezalElementPaperDialog);

export {FeezalElementPaperDialog};
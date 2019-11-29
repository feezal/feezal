import {PolymerElement, html} from '@polymer/polymer/polymer-element';

class FeezalMenu extends PolymerElement {
    static get template() {
        return html`
            <style>
                :host {
                    width: 100%;
                    display: block;
                    box-sizing: border-box;
                }
            </style>
            <div id="logo">Feezal</div>
            <div id="deploy"></div>
        `;
    }
}

window.customElements.define('feezal-menu', FeezalMenu);

import {LitElement, html, css} from 'lit';

class FeezalMenu extends LitElement {
    static styles = css`
        :host { width: 100%; display: block; box-sizing: border-box; }
    `;

    render() {
        return html`
            <div id="logo">Feezal</div>
            <div id="deploy"></div>
        `;
    }
}

window.customElements.define('feezal-menu', FeezalMenu);


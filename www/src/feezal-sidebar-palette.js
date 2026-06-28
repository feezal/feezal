import {LitElement, html, css} from 'lit';

class FeezalSidebarPalette extends LitElement {
    static styles = css`
        :host { display: block; height: 100%; background-color: var(--feezal-bg, white); box-sizing: border-box; }
    `;

    render() {
        return html``;
    }
}

window.customElements.define('feezal-sidebar-palette', FeezalSidebarPalette);


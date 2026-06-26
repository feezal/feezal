import {LitElement, html, css} from 'lit';

class FeezalSidebarPalette extends LitElement {
    static styles = css`
        :host { display: block; height: 100%; background-color: var(--feezal-bg, white); box-sizing: border-box; }
        #editor-form { margin: 12px; }
    `;

    render() {
        return html`<div id="editor-form"></div>`;
    }
}

window.customElements.define('feezal-sidebar-palette', FeezalSidebarPalette);


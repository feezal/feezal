/* global feezal */
import {FeezalElement, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-basic-icon — displays a single icon, nothing else.
 *
 * The icon is either configured (`icon` attribute — bare Material name or a
 * set-prefixed name like `mdi:sofa`, picked via the icon picker) or driven by
 * the subscribe payload (payload = icon name), so a topic can switch the
 * displayed symbol at runtime.
 *
 * Click-through: the host has pointer-events: none, so clicks pass to
 * whatever lies beneath — the icon can decorate a button (or any element)
 * without blocking it. The editor re-enables pointer events through the
 * feezal-editable class, so the element stays selectable and draggable on
 * the canvas.
 *
 * Colour: --feezal-icon-color (default var(--primary-text-color)).
 */
class FeezalElementBasicIcon extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                category: 'Basic',
                name: 'Icon',
                color: '#4a6080'
            },
            description: 'Displays an icon — configured or from the subscribe payload (payload = icon name, e.g. mdi:sofa). Click-through: pointer events pass to elements beneath, so it can decorate a button without blocking it.',
            baseAttribute: 'icon',
            attributes: [
                'subscribe',
                'messageProperty',
                {name: 'icon', type: 'icon', help: 'Icon name — bare Material or set-prefixed (mdi:sofa, knx-uf:fts_sunblind); a subscribe payload overrides it at runtime.'}
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-icon-color', type: 'color', default: 'var(--primary-text-color)', help: 'Icon colour.'}
            ],
            restrict: {minWidth: 12, minHeight: 12},
            defaultStyle: {width: '48px', height: '48px'}
        };
    }

    static properties = {
        // icon is user config (reflected) AND the base attribute — a
        // subscribe payload overwrites it via setAttribute at runtime.
        icon: {type: String, reflect: true}
    };

    static styles = [FeezalElement.styles, css`
        :host {
            /* Defaults — container-type:size collapses without an explicit
               size when the markup carries no inline width/height. */
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            container-type: size;
            /* Click-through: pointer events pass to whatever lies beneath,
               so the icon can sit on top of a button without blocking it. */
            pointer-events: none;
        }
        /* The editor needs the element clickable/draggable on the canvas. */
        :host(.feezal-editable) {
            pointer-events: auto;
        }
        feezal-icon {
            font-size: 90cqmin;
            line-height: 1;
            color: var(--feezal-icon-color, var(--primary-text-color, #333));
        }
    `];

    constructor() {
        super();
        this.icon = '';
    }

    render() {
        return this.icon ? html`<feezal-icon name="${this.icon}"></feezal-icon>` : html``;
    }
}

customElements.define('feezal-element-basic-icon', FeezalElementBasicIcon);
export {FeezalElementBasicIcon};

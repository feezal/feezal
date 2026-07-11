# @feezal/feezal-element

Base classes for [feezal](https://github.com/feezal/feezal) dashboard elements.

feezal is a browser-based MQTT dashboard editor and viewer. Dashboards are composed of web components (`feezal-element-*` packages); this package provides the base classes those elements extend:

- **`FeezalElement`** — the Lit 3 base class. MQTT subscription lifecycle (`addSubscription`, automatic unsubscribe), payload path extraction (`getProperty` / `message-property`), payload casting, the reserved `<subscribe>/setattribute|setstyle|addclass|…` runtime-control channel, and the per-element conditions engine.
- **`feezalBaseStyles`** — shared host styles every element composes into its `static styles`.
- **`html`, `css`** — re-exported from Lit so element packages need a single import.
- **`FeezalPolymerElement`** (`feezal-polymer-element.js`) — legacy Polymer 3 base used by the paper element family. New elements should extend `FeezalElement`.
- **`feezal-conditions.js`** — the shared conditions engine (declaratively bind visibility, classes, styles or attributes to MQTT topics). Wired up by both base classes; element authors get it for free.

## Installation

```sh
npm install @feezal/feezal-element
```

## Minimal element

```js
/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

class FeezalElementMyWidget extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'My Widget', category: 'Basic', color: '#4a6080'},
            attributes: [
                {name: 'subscribe', type: 'mqttTopic', help: 'State topic.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message.'},
            ],
            styles: ['top', 'left', 'width', 'height'],
            defaultStyle: {width: '80px', height: '40px'},
        };
    }

    static properties = {
        _value: {state: true},
    };

    static styles = [feezalBaseStyles, css``];

    constructor() {
        super();
        this._value = null; // reactive properties: constructor, never class fields
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                this._value = this.getProperty(msg, this.messageProperty);
            });
        }
    }

    render() {
        return html`<div>${this._value}</div>`;
    }
}

customElements.define('feezal-element-my-widget', FeezalElementMyWidget);
export {FeezalElementMyWidget};
```

## Authoring elements

Read the full element authoring specification before building anything real — descriptor reference (`palette`, `attributes`, `styles`, `discovery`, custom inspectors), MQTT topic conventions, CSS custom property conventions, Lit 3 gotchas and the publishing checklist:

**[docs/element-spec.md](https://github.com/feezal/feezal/blob/master/docs/element-spec.md)**

Element packages are named `feezal-element-<category>-<name>` under an npm scope; the categories `basic` and `paper` are reserved for official feezal elements. Scaffolding: [`create-feezal-element`](https://github.com/feezal/feezal/tree/master/packages/create-feezal-element).

## Versioning

This package uses lockstep **major** versions with the feezal server and the official element packages; minor/patch versions are independent. Element packages should depend on the matching major, e.g. `"@feezal/feezal-element": "^3.0.0"`.

## License

MIT. The base class and the viewer runtime your element runs inside are MIT-licensed — subclassing does **not** place your element under feezal's AGPL (which covers only the server and editor). You may license and distribute your element packages under any terms you choose.

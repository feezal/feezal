/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

// N35: bare `${msg.payload}` renders `[object Object]` for JSON payloads
// because the compiled template literal coerces objects/arrays via the
// default `Object.prototype.toString` / `Array.prototype.join(',')`.
// Recursively clone the value handed to the template and give every
// object/array in the clone a non-enumerable `toString` override that
// renders compact (0-space) JSON instead — property access and primitive
// values are unaffected. Operates on a clone so the original message
// object shared with other subscribers is never mutated. A WeakMap keyed
// by original->clone doubles as a cycle guard: a self-referencing value
// clones to a self-referencing clone, and the lazy toString falls back to
// the default `[object Object]` coercion (via try/catch) instead of
// throwing when JSON.stringify hits the cycle.
function withJsonStringCoercion(value, cloned = new WeakMap()) {
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (cloned.has(value)) {
        return cloned.get(value);
    }
    const clone = Array.isArray(value) ? [] : {};
    cloned.set(value, clone);
    for (const key of Object.keys(value)) {
        clone[key] = withJsonStringCoercion(value[key], cloned);
    }
    Object.defineProperty(clone, 'toString', {
        value() {
            try {
                return JSON.stringify(this);
            } catch {
                // Cyclic structure — JSON.stringify can't serialize it.
                // Fall back to the default coercion rather than throwing.
                return Object.prototype.toString.call(this);
            }
        },
        enumerable: false,
        configurable: true
    });
    return clone;
}

class FeezalElementBasicTemplate extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                category: 'Basic',
                name: 'Template',
                color: '#4a6080'
            },
            attributes: [
                'subscribe',
                {name: 'template', textarea: true, template: true, editor: true},
                {name: 'click-through', type: 'boolean', default: false,
                    help: 'Viewer: let clicks/taps pass through this element to whatever sits beneath it (e.g. a button under a decorative overlay). The whole element becomes transparent to pointer events — interactive content inside the template is not clickable either. In the editor the element stays selectable/draggable.'}
            ],
            styles: [
                'top', 'left', 'width', 'height',
                'font', 'color', 'text-align', 'background', 'border', 'overflow'
            ],
            restrict: {minWidth: 12, minHeight: 12},
            defaultStyle: {
                width: '240px',
                height: '80px',
                color: 'var(--primary-text-color)'
            },
            description: 'HTML template re-rendered on every received message. Use ${msg.payload} to insert the received MQTT value. If the payload is JSON it is parsed automatically — access its properties with ${msg.payload.prop}, e.g. ${msg.payload.temperature} or ${msg.payload.sensors[0].value}. A bare ${msg.payload} (or any object/array within it) renders as compact JSON automatically, e.g. {"temperature":21.5,"hum":40}. ${msg.topic} holds the topic string. Any JavaScript expression works inside ${…}, e.g. ${JSON.stringify(msg.payload, null, 2)} to pretty-print.'
        };
    }

    static properties = {
        subscribe:    {type: String,  reflect: true},
        clickThrough: {type: Boolean, reflect: true, attribute: 'click-through'},
        msg:   {state: true},
    };

    // E82: click-through — pointer events pass through to whatever sits
    // beneath the element in stacking order. Gated on the ABSENCE of the
    // editor's feezal-editable class, so on the canvas the element stays
    // selectable/draggable (the class is editor-only and stripped from
    // deployed/saved HTML by _clean()).
    static styles = [feezalBaseStyles, css`
        :host([click-through]:not(.feezal-editable)) {
            pointer-events: none;
        }
    `];

    constructor() {
        super();
        this.subscribe = '';
        this.clickThrough = false;
        this.msg   = {};
    }

    render() {
        return html`<div id="content"></div>`;
    }

    updated(changed) {
        super.updated(changed);
        if (changed.has('subscribe')) {
            this._topicChanged();
        }
        if (changed.has('msg')) {
            this._msgChanged();
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._topicSubscription) {
            feezal.connection.unsubscribe(this._topicSubscription);
            this._topicSubscription = null;
        }
    }

    _topicChanged() {
        if (this._topicSubscription) {
            feezal.connection.unsubscribe(this._topicSubscription);
            this._topicSubscription = null;
        }
        if (this.subscribe) {
            this._topicSubscription = feezal.connection.sub(
                this.subscribe,
                msg => { this.msg = msg; }
            );
        }
    }

    _msgChanged() {
        if (!this._processTemplate && this.querySelector('template')) {
            // Build the template function from the light-DOM <template> child.
            // eslint-disable-next-line no-new-func
            this._processTemplate = new Function(
                'msg',
                'return `' + this.querySelector('template').innerHTML + '`;'
            );
        }
        if (!this.msg || Object.keys(this.msg).length === 0) {
            return;
        }
        try {
            const content = this.renderRoot.querySelector('#content');
            if (content && this._processTemplate) {
                content.innerHTML = this._processTemplate(withJsonStringCoercion(this.msg));
            }
        } catch (error) {
            console.error(error.message);
        }
    }
}

window.customElements.define('feezal-element-basic-template', FeezalElementBasicTemplate);

export {FeezalElementBasicTemplate};
/* global feezal */
import {FeezalElement, html} from '@feezal/feezal-element';

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
                {name: 'template', textarea: true, template: true}
            ],
            styles: [
                'top', 'left', 'width', 'height',
                'font', 'color', 'text-align', 'background', 'border', 'overflow'
            ],
            restrict: {minWidth: 12, minHeight: 12},
            defaultStyle: {
                width: '60px',
                height: '20px',
                color: 'var(--primary-text-color)'
            }
        };
    }

    static properties = {
        subscribe: {type: String, reflect: true},
        msg:   {state: true},
    };

    constructor() {
        super();
        this.subscribe = '';
        this.msg   = {};
    }

    render() {
        if (feezal.isEditor) {
            return html`
                <div style="display:flex;align-items:center;gap:3px;white-space:nowrap;overflow:hidden;opacity:0.6">
                    <span style="overflow:hidden;text-overflow:ellipsis">Template${this.subscribe ? ': ' + this.subscribe : ''}</span>
                    <span title="Use \${msg.payload} in your template to insert the received MQTT value. Other message properties such as \${msg.topic} are also available."
                        style="flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border-radius:50%;border:1px solid currentColor;font-size:9px;cursor:help;opacity:1">i</span>
                </div>`;
        }
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
                content.innerHTML = this._processTemplate(this.msg);
            }
        } catch (error) {
            console.error(error.message);
        }
    }
}

window.customElements.define('feezal-element-basic-template', FeezalElementBasicTemplate);

export {FeezalElementBasicTemplate};
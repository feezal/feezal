/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

class FeezalElementMaterialBadge extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Badge', category: 'Simple', color: '#4a6080', icon: 'notifications'},
            description: 'MD3 notification badge — subscribes to a count/text topic and overlays a badge on a Material icon.',
            discovery: {
                component: 'sensor',
                map: {
                    state_topic: {attr: 'subscribe'},
                    name:        'label',
                },
            },
            attributes: [
                {name: 'subscribe', type: 'mqttTopic', help: 'Topic to read badge count or text from. Empty value hides the badge.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'icon',      type: 'string',    help: 'Material icon name for the base icon.'},
                {name: 'label',     type: 'string',    help: 'Label text shown below the icon.'},
                {name: 'max-count', type: 'number',    help: 'Maximum count to show; higher values display "99+". Default: 99'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-badge-color',      type: 'color', default: 'var(--error-color, #d32f2f)',         help: 'Badge dot background colour.'},
                {property: '--feezal-badge-icon-color',  type: 'color', default: 'var(--primary-text-color, #555)',     help: 'Base icon colour.'},
            ],
            defaultStyle: {width: '56px', height: '56px'},
        };
    }

    static properties = {
        subscribe: {type: String, reflect: true},
        icon:      {type: String, reflect: true},
        label:     {type: String, reflect: true},
        maxCount:  {type: Number, reflect: true, attribute: 'max-count'},
        _count:    {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            --feezal-badge-color:      var(--error-color, #d32f2f);
            --feezal-badge-icon-color: var(--primary-text-color, var(--feezal-color, #555));
            --md-sys-color-primary: var(--sl-color-primary-600, #0284c7);
            --md-sys-color-error: var(--feezal-badge-color);
        }
        .wrap {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        /* Use the loaded 'Material Icons' font. <md-icon> defaults to
           'Material Symbols Outlined' (not loaded), so its font-family cannot be
           overridden externally (its internal :host rule wins on specificity) and
           ligature names render as literal text. */
        .icon {
            font-family: 'Material Icons';
            font-style: normal;
            font-weight: normal;
            line-height: 1;
            font-size: 32px;
            color: var(--feezal-badge-icon-color);
        }
        .badge {
            position: absolute;
            top: 0;
            right: 0;
            transform: translate(40%, -40%);
            min-width: 18px;
            height: 18px;
            border-radius: 9px;
            background: var(--feezal-badge-color);
            color: #fff;
            font-size: 10px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 4px;
            box-sizing: border-box;
            line-height: 1;
        }
        .item-label {
            font-size: 11px;
            color: var(--secondary-text-color, #666);
            margin-top: 2px;
            text-align: center;
        }
        .editor-ph {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
        }
        .editor-icon-wrap {
            position: relative;
        }
        .editor-icon {
            font-size: 32px;
            font-family: 'Material Symbols Outlined', 'Material Icons', sans-serif;
            color: var(--primary-text-color, #555);
        }
        .editor-badge {
            position: absolute;
            top: -4px;
            right: -8px;
            min-width: 18px;
            height: 18px;
            border-radius: 9px;
            background: var(--feezal-badge-color);
            color: #fff;
            font-size: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 4px;
            box-sizing: border-box;
        }
    `];

    constructor() {
        super();
        this.subscribe = '';
        this.icon      = 'notifications';
        this.label     = '';
        this.maxCount  = 99;
        this._count    = '';
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                const n = parseInt(v, 10);
                if (!isNaN(n) && n > this.maxCount) {
                    this._count = `${this.maxCount}+`;
                } else {
                    this._count = String(v ?? '');
                }
            });
        }
    }

    render() {
        const hasCount = this._count !== '' && this._count !== '0' && this._count !== null;
        return html`
            <div class="wrap">
                <feezal-icon class="icon" name="${this.icon || 'notifications'}"></feezal-icon>
                ${hasCount ? html`<div class="badge">${this._count}</div>` : ''}
            </div>
            ${this.label ? html`<div class="item-label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-material-badge', FeezalElementMaterialBadge);
export {FeezalElementMaterialBadge};

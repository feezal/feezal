/* global feezal */
import {FeezalElement, html, css} from '@feezal/feezal-element';
import {formatNumber} from '@feezal/feezal-element/feezal-locale.js';

class FeezalElementBasicNumber extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                category: 'Basic',
                name: 'Number',
                color: '#4a6080'
            },
            attributes: [
                'subscribe',
                'messageProperty',
                {name: 'digits',           type: 'number', label: 'Decimal digits'},
                {name: 'decimalSeparator', label: 'Decimal separator',
                    help: 'Explicit override. Empty = the site locale decides (Site Settings, default: browser language).'},
                {name: 'grouping', type: 'boolean', default: false,
                    help: 'Format the value with thousands separators per the site locale (1.234 / 1,234). Off by default. Ignored when an explicit decimal separator is set.'},
                'prefix',
                'suffix',
                {name: 'click-through', type: 'boolean', default: false,
                    help: 'Viewer: let clicks/taps pass through this element to whatever sits beneath it (e.g. a button under a value label). In the editor the element stays selectable/draggable.'}
            ],
            baseAttribute: 'value',
            styles: [
                'top', 'left', 'width', 'height',
                'font', 'color', 'text-align', 'background', 'border', 'overflow'
            ],
            restrict: {minWidth: 36, minHeight: 12},
            defaultStyle: {
                width: '60px',
                height: '20px',
                textAlign: 'right',
                color: 'var(--primary-text-color)'
            }
        };
    }

    static properties = {
        // value is set via _subscribe (setAttribute) — not reflected to HTML attribute
        value:            {type: Number},
        // decimalSeparator uses an explicit kebab attribute to match saved views
        // NOT reflected: Lit reflects the constructor default on first render,
        // which baked decimal-separator="." into every saved dashboard and made
        // hasAttribute useless as the authored-override signal (N38).
        decimalSeparator: {type: String, attribute: 'decimal-separator'},
        digits:           {type: Number, reflect: true},
        prefix:           {type: String, reflect: true},
        suffix:           {type: String, reflect: true},
        clickThrough:     {type: Boolean, reflect: true, attribute: 'click-through'},
        grouping:         {type: Boolean, reflect: true},
        _formatedValue:   {state: true},
    };

    // E118: click-through — pointer events pass to elements beneath in the
    // viewer; the editor keeps the element selectable/draggable.
    static styles = [FeezalElement.styles, css`
        :host([click-through]:not(.feezal-editable)) {
            pointer-events: none;
        }
    `];

    constructor() {
        super();
        this.decimalSeparator = '.';
        this.digits           = undefined;
        this.prefix           = '';
        this.suffix           = '';
        this.clickThrough     = false;
        this.grouping         = false;
        this._formatedValue   = '';
    }

    render() {
        return html`
            <div>
                <span id="prefix">${this.prefix}</span><span id="value">${this._formatedValue}</span><span id="suffix">${this.suffix}</span>
            </div>
        `;
    }

    updated(changed) {
        super.updated(changed);
        // Re-format whenever any of the display-affecting properties change.
        if (changed.has('value') || changed.has('digits') || changed.has('decimalSeparator') || changed.has('grouping')) {
            this._valueChanged();
        }
    }

    /** N38: cached formatted output → re-format when the site locale changes. */
    _localeChanged() {
        this._valueChanged();
    }

    _valueChanged() {
        if (this.value == null) {
            return;
        }
        // N38: the site locale formats the number; an EXPLICIT
        // decimal-separator attribute keeps the old hand-rolled path and
        // stays authoritative (per-element overrides win over the locale).
        // Pre-N38 saves carry a reflection-baked decimal-separator="." on
        // every element - heal it ("." IS the en default, so nothing changes
        // for en and the locale takes over elsewhere).
        if (this.getAttribute('decimal-separator') === '.') {
            this.removeAttribute('decimal-separator');
        }
        if (this.hasAttribute('decimal-separator')) {
            let str;
            if (this.digits != null) {
                str = parseFloat(this.value, 10).toFixed(this.digits);
            } else {
                str = String(this.value);
            }
            if (this.decimalSeparator !== '.') {
                str = str.replace('.', this.decimalSeparator);
            }
            this._formatedValue = str;
            return;
        }
        this._formatedValue = formatNumber(this.value,
            {digits: this.digits ?? undefined, grouping: this.grouping});
    }
}

window.customElements.define('feezal-element-basic-number', FeezalElementBasicNumber);

export {FeezalElementBasicNumber};
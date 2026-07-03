/* global feezal */
import {FeezalElement, html} from '@feezal/feezal-element';

import {utcToZonedTime, format} from 'date-fns-tz';
import {be, de, enGB, enUS, es, fr, hr, hu, it, nl, pl, ru} from 'date-fns/locale';

const locales = {be, de, enGB, enUS, es, fr, hr, hu, it, nl, pl, ru};

class FeezalElementBasicDatetime extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                category: 'Basic',
                name: 'Datetime',
                color: '#4a6080'
            },
            attributes: [
                {name: 'format',   label: 'Format'},  // https://date-fns.org/v2.8.1/docs/format
                {
                    name: 'locale',
                    type: 'select',
                    options: Object.keys(locales),
                    label: 'Locale',
                    validator: val => Object.keys(locales).includes(val)
                },
                {
                    name: 'timezone',
                    label: 'Timezone',
                    validator: FeezalElementBasicDatetime.isValidTimeZone
                }
            ],
            baseAttribute: 'value',
            styles: [
                'top', 'left', 'width', 'height',
                'font', 'color', 'text-align', 'background', 'border', 'overflow'
            ],
            restrict: {minWidth: 30, minHeight: 12},
            defaultStyle: {
                width: '160px',
                height: '24px',
                color: 'var(--primary-text-color)'
            }
        };
    }

    static properties = {
        format:         {type: String, reflect: true},
        locale:         {type: String, reflect: true},
        timezone:       {type: String, reflect: true},
        _formatedValue: {state: true},
    };

    constructor() {
        super();
        this.format         = 'cccc, dd. MMMM yyyy H:mm:ss';
        this.locale         = FeezalElementBasicDatetime.getLocale();
        this.timezone       = Intl.DateTimeFormat().resolvedOptions().timeZone;
        this._formatedValue = '';
    }

    static getLocale() {
        if (navigator.languages) {
            const languages = [...new Set(navigator.languages.reduce((acc, cur) => {
                return cur.includes('-')
                    ? acc.concat([cur.replace('-', ''), cur.split('-')[0]])
                    : acc.concat([cur]);
            }, []))];
            for (const lang of languages) {
                if (Object.keys(locales).includes(lang)) {
                    return lang;
                }
            }
        }
        return 'enUS';
    }

    static isValidTimeZone(tz) {
        try {
            Intl.DateTimeFormat(undefined, {timeZone: tz});
            return true;
        } catch (_) {
            return false;
        }
    }

    render() {
        return html`<span>${this._formatedValue}</span>`;
    }

    connectedCallback() {
        super.connectedCallback();
        this._interval = setInterval(
            this._update.bind(this),
            this.format.includes('ss') ? 100 : 1000
        );
        this._update();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearInterval(this._interval);
    }

    _update() {
        this._formatedValue = format(
            utcToZonedTime(new Date(), this.timezone),
            this.format,
            {locale: locales[this.locale]}
        );
    }
}

window.customElements.define('feezal-element-basic-datetime', FeezalElementBasicDatetime);

export {FeezalElementBasicDatetime};
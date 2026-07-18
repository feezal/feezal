/* global feezal */
import {FeezalElement, html, css} from '@feezal/feezal-element';
import '@feezal/feezal-element/feezal-topic-input.js';
import {LitElement} from 'lit';
import qrcode from 'qrcode-generator';

// ─── E76: QR content presets — pure generate/parse helpers ──────────────────
// The inspector's content assistant generates the `value` attribute from
// typed fields and round-trips known schemes back into fields. Exported for
// unit tests. `value` stays the single source of truth — these never run in
// the viewer.

const WIFI_ESC = /([\\;,":])/g;
const escWifi = s => String(s).replace(WIFI_ESC, '\\$1');
const unescWifi = s => String(s).replace(/\\(.)/g, '$1');

export function buildQrValue(type, f = {}) {
    switch (type) {
        case 'url': {
            const url = String(f.url || '').trim();
            return !url || /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : 'https://' + url;
        }
        case 'wifi': {
            const sec = f.security || 'WPA';
            let v = `WIFI:S:${escWifi(f.ssid || '')};T:${sec};`;
            if (sec !== 'nopass' && f.password) v += `P:${escWifi(f.password)};`;
            if (f.hidden) v += 'H:true;';
            return v + ';';
        }
        case 'email': {
            const params = [];
            if (f.subject) params.push('subject=' + encodeURIComponent(f.subject));
            if (f.body) params.push('body=' + encodeURIComponent(f.body));
            return `mailto:${f.to || ''}` + (params.length > 0 ? '?' + params.join('&') : '');
        }
        case 'phone':
            return 'tel:' + (f.number || '');
        case 'sms':
            return `SMSTO:${f.number || ''}` + (f.message ? ':' + f.message : '');
        case 'geo':
            return `geo:${f.lat || ''},${f.lon || ''}`;
        case 'vcard': {
            const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${f.name || ''}`];
            if (f.phone) lines.push(`TEL:${f.phone}`);
            if (f.email) lines.push(`EMAIL:${f.email}`);
            if (f.org) lines.push(`ORG:${f.org}`);
            if (f.url) lines.push(`URL:${f.url}`);
            lines.push('END:VCARD');
            return lines.join('\n');
        }
        default:
            return String(f.text ?? '');
    }
}

/** Parse a value back into {type, fields}. Unparseable-but-prefixed values
 * fall back to text/raw with the string as-is — never destroyed. */
export function parseQrValue(value) {
    const v = String(value ?? '');
    if (v.startsWith('WIFI:')) {
        const fields = {ssid: '', password: '', security: 'WPA', hidden: false};
        const body = v.slice(5);
        const parts = [];
        let cur = '';
        for (let i = 0; i < body.length; i++) {
            const c = body[i];
            if (c === '\\' && i + 1 < body.length) { cur += c + body[++i]; continue; }
            if (c === ';') { parts.push(cur); cur = ''; continue; }
            cur += c;
        }

        if (cur) parts.push(cur);
        for (const p of parts) {
            if (!p) continue;
            const m = p.match(/^([A-Z]+):([\s\S]*)$/);
            if (!m) return {type: 'text', fields: {text: v}};   // fallback: never destroy
            const [, k, raw] = m;
            const val = unescWifi(raw);
            if (k === 'S') fields.ssid = val;
            else if (k === 'T') fields.security = val || 'WPA';
            else if (k === 'P') fields.password = val;
            else if (k === 'H') fields.hidden = val === 'true';
            else return {type: 'text', fields: {text: v}};
        }

        return {type: 'wifi', fields};
    }

    if (v.startsWith('mailto:')) {
        const rest = v.slice(7);
        const qi = rest.indexOf('?');
        const fields = {to: qi === -1 ? rest : rest.slice(0, qi), subject: '', body: ''};
        if (qi !== -1) {
            for (const pair of rest.slice(qi + 1).split('&')) {
                const [k, ...r] = pair.split('=');
                try {
                    const val = decodeURIComponent(r.join('=') || '');
                    if (k === 'subject') fields.subject = val;
                    else if (k === 'body') fields.body = val;
                } catch { /* keep raw-encoded */ }
            }
        }

        return {type: 'email', fields};
    }

    if (v.startsWith('tel:')) return {type: 'phone', fields: {number: v.slice(4)}};

    if (v.toUpperCase().startsWith('SMSTO:')) {
        const rest = v.slice(6);
        const ci = rest.indexOf(':');
        return {
            type: 'sms',
            fields: ci === -1
                ? {number: rest, message: ''}
                : {number: rest.slice(0, ci), message: rest.slice(ci + 1)},
        };
    }

    if (v.startsWith('geo:')) {
        const [lat = '', lon = ''] = v.slice(4).split(',');
        return {type: 'geo', fields: {lat, lon}};
    }

    if (v.startsWith('BEGIN:VCARD')) {
        const get = key => (v.match(new RegExp(`^${key}[^:\\n]*:(.*)$`, 'mi')) || [])[1]?.trim() ?? '';
        return {type: 'vcard', fields: {name: get('FN'), phone: get('TEL'), email: get('EMAIL'), org: get('ORG'), url: get('URL')}};
    }

    if (/^https?:\/\//i.test(v)) return {type: 'url', fields: {url: v}};

    return {type: 'text', fields: {text: v}};
}

/**
 * feezal-element-basic-qrcode — QR code from a static value or a live
 * MQTT payload (E74).
 *
 * Canonical uses: scan-to-open this dashboard on a phone (value = the
 * viewer URL), guest WiFi (WIFI:S:<ssid>;T:WPA;P:<pw>;; payload), deep
 * links to a Grafana dashboard or a device manual next to the matching
 * element.
 *
 * Rendered as inline SVG — module colour and background are theme-aware
 * CSS custom properties. Mind scanner contrast: on dark themes set
 * --feezal-qrcode-background to a light colour (scanners want dark
 * modules on a light background). A fixed 2-module quiet zone is drawn
 * around the code.
 */
class FeezalElementBasicQrcode extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                category: 'Basic',
                name: 'QR Code',
                color: '#4a6080'
            },
            description: 'Displays a QR code from a static value or the subscribe payload. Uses: scan-to-open the dashboard on a phone, guest WiFi (WIFI:S:<ssid>;T:WPA;P:<pw>;;), deep links. On dark themes set the background colour light for scanner contrast.',
            baseAttribute: 'value',
            // E76: content assistant — typed presets generate the value.
            inspector: 'feezal-element-basic-qrcode-inspector',
            attributes: [
                'subscribe',
                'messageProperty',
                {name: 'value', help: 'Encoded content — URL, WiFi string, any text. A subscribe payload overrides it at runtime.'},
                {name: 'ecc', dropdown: ['L', 'M', 'Q', 'H'], label: 'Error correction', help: 'Higher levels survive more damage/overlay but produce denser codes.'},
                {name: 'label', help: 'Optional caption below the code.'}
            ],
            styles: [
                'top', 'left', 'width', 'height', 'font-size',
                {property: '--feezal-qrcode-color', type: 'color', default: 'var(--primary-text-color, #000)', help: 'Module (dark dot) colour.'},
                {property: '--feezal-qrcode-background', type: 'color', default: 'transparent', help: 'Code background — set light on dark themes for scanner contrast.'}
            ],
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '160px', height: '160px'}
        };
    }

    static properties = {
        // value is user config AND the base attribute — a subscribe payload
        // overwrites it via setAttribute at runtime (viewer only).
        value: {type: String, reflect: true},
        ecc:   {type: String, reflect: true},
        label: {type: String, reflect: true},
        _qr:    {state: true},
        _error: {state: true}
    };

    static styles = [FeezalElement.styles, css`
        :host {
            width: 160px;
            height: 160px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        svg {
            flex: 1;
            min-height: 0;
            width: 100%;
        }
        .qr-bg { fill: var(--feezal-qrcode-background, transparent); }
        .qr-fg { fill: var(--feezal-qrcode-color, var(--primary-text-color, #000)); }
        .label {
            flex: none;
            font-size: 0.85em;
            color: var(--primary-text-color, #333);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 100%;
        }
        .editor-ph, .error {
            font-size: 12px;
            opacity: 0.5;
            font-style: italic;
            text-align: center;
        }
    `];

    constructor() {
        super();
        this.value = '';
        this.ecc = 'M';
        this.label = '';
        this._qr = null;
        this._error = false;
    }

    willUpdate(changed) {
        if (changed.has('value') || changed.has('ecc')) {
            this._compute();
        }
    }

    /** Encode value → {count, d} (SVG path of the dark modules). */
    _compute() {
        this._error = false;
        this._qr = null;
        const value = this.value;
        if (!value) {
            return;
        }

        try {
            const qr = qrcode(0, ['L', 'M', 'Q', 'H'].includes(this.ecc) ? this.ecc : 'M');
            // UTF-8: pre-encode to bytes ≤ 0xff so the encoder's default
            // byte mode emits proper UTF-8 for non-ASCII content.
            let bytes = String(value);
            if (/[\u0100-\uffff]/.test(bytes)) {
                bytes = [...new TextEncoder().encode(bytes)].map(b => String.fromCharCode(b)).join('');
            }

            qr.addData(bytes, 'Byte');
            qr.make();
            const count = qr.getModuleCount();
            let d = '';
            for (let row = 0; row < count; row++) {
                for (let col = 0; col < count; col++) {
                    if (qr.isDark(row, col)) {
                        d += `M${col} ${row}h1v1h-1z`;
                    }
                }
            }

            this._qr = {count, d};
        } catch {
            // data too long for the highest QR version at this ECC level
            this._error = true;
        }
    }

    render() {
        if (this._error) {
            return html`<div class="error">QR: data too long</div>`;
        }

        if (!this._qr) {
            return feezal.isEditor
                ? html`<div class="editor-ph">QR Code — set value or subscribe</div>`
                : html``;
        }

        const {count, d} = this._qr;
        const q = 2; // quiet-zone modules
        return html`
            <svg viewBox="${-q} ${-q} ${count + 2 * q} ${count + 2 * q}"
                preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges"
                role="img" aria-label="${this.label || 'QR code'}">
                <rect class="qr-bg" x="${-q}" y="${-q}"
                    width="${count + 2 * q}" height="${count + 2 * q}"></rect>
                <path class="qr-fg" d="${d}"></path>
            </svg>
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}
        `;
    }
}

window.customElements.define('feezal-element-basic-qrcode', FeezalElementBasicQrcode);

// ─── E76: content-assistant inspector (N6, editor-only) ─────────────────────
// Renders a type picker + per-type fields that GENERATE the `value`
// attribute, plus the element's remaining attributes. Uses <sl-*> without
// importing Shoelace — inspectors only ever render inside the editor, where
// Shoelace is loaded (the established custom-inspector pattern).

const QR_TYPES = [
    {value: 'text',  label: 'Text / raw'},
    {value: 'url',   label: 'Web URL'},
    {value: 'wifi',  label: 'WiFi'},
    {value: 'email', label: 'E-mail'},
    {value: 'phone', label: 'Phone'},
    {value: 'sms',   label: 'SMS'},
    {value: 'geo',   label: 'Geo location'},
    {value: 'vcard', label: 'Contact (vCard)'},
];

class FeezalElementBasicQrcodeInspector extends LitElement {
    static properties = {
        element:  {attribute: false},
        _type:    {state: true},
        _fields:  {state: true},
        _showPw:  {state: true},
    };

    static styles = css`
        :host { display: block; padding: 8px; font-size: 12px; color: var(--feezal-color, #333); }
        .section { border: 1px solid var(--feezal-border, #e0e0e0); border-radius: 6px; margin-bottom: 8px; }
        .sec-head { padding: 6px 8px; font-weight: 600; background: var(--feezal-bg-sub, #f5f5f5); border-radius: 6px 6px 0 0; }
        .sec-body { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
        .field { display: flex; flex-direction: column; gap: 2px; }
        .field > label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; }
        .row { display: flex; gap: 6px; }
        .row > .field { flex: 1; min-width: 0; }
        sl-input, sl-select, sl-textarea { width: 100%; }
        sl-input::part(base), sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input), sl-textarea::part(textarea) { background: var(--feezal-bg, #fff); color: var(--feezal-color, #333); }
        .preview {
            font-family: Consolas, monospace; font-size: 11px;
            background: var(--feezal-bg-sub, #f5f5f5); border: 1px solid var(--feezal-border, #e0e0e0);
            border-radius: 4px; padding: 6px; word-break: break-all; white-space: pre-wrap;
            color: var(--feezal-color, #333); user-select: text;
        }
        .hint { font-size: 10px; opacity: 0.55; line-height: 1.4; }
        sl-checkbox::part(label) { font-size: 11px; color: var(--feezal-color, #333); }
    `;

    constructor() {
        super();
        this.element = null;
        this._type = 'text';
        this._fields = {};
        this._showPw = false;
    }

    willUpdate(changed) {
        if (changed.has('element')) this._syncFromElement();
    }

    /** Round-trip: parse the current value back into type + fields. */
    _syncFromElement() {
        const parsed = parseQrValue(this.element?.getAttribute('value') || '');
        this._type = parsed.type;
        this._fields = parsed.fields;
        this._showPw = false;
    }

    _emit(name, value) {
        this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
            bubbles: true, composed: true, detail: {name, value},
        }));
    }

    _attr(name, dflt = '') { return this.element?.getAttribute(name) ?? dflt; }

    /** A field edit regenerates and writes the value attribute. */
    _setField(key, val) {
        this._fields = {...this._fields, [key]: val};
        this._emit('value', buildQrValue(this._type, this._fields));
    }

    /** Switching the type re-parses the current value when it matches the new
     * type; otherwise fields start blank — nothing is emitted until a field
     * is edited, so the existing value is never clobbered by the switch. */
    _setType(t) {
        const parsed = parseQrValue(this.element?.getAttribute('value') || '');
        this._type = t;
        this._fields = parsed.type === t ? parsed.fields : {};
    }

    _in(key, label, {placeholder = '', type = 'text'} = {}) {
        return html`
            <div class="field">
                <label>${label}</label>
                <sl-input size="small" autocomplete="off" type="${type}" placeholder="${placeholder}"
                    .value="${String(this._fields[key] ?? '')}"
                    @sl-change="${e => this._setField(key, e.target.value)}"></sl-input>
            </div>`;
    }

    _typeFields() {
        switch (this._type) {
            case 'url':
                return html`${this._in('url', 'URL', {placeholder: 'example.com/page — https:// is added when missing'})}`;
            case 'wifi':
                return html`
                    ${this._in('ssid', 'Network name (SSID)')}
                    <div class="field">
                        <label>Password</label>
                        <sl-input size="small" autocomplete="off" type="${this._showPw ? 'text' : 'password'}"
                            .value="${String(this._fields.password ?? '')}"
                            @sl-change="${e => this._setField('password', e.target.value)}">
                            <sl-icon-button slot="suffix" name="${this._showPw ? 'eye-slash' : 'eye'}" label="Reveal"
                                @click="${() => { this._showPw = !this._showPw; }}"></sl-icon-button>
                        </sl-input>
                    </div>
                    <div class="row">
                        <div class="field">
                            <label>Security</label>
                            <sl-select size="small" hoist .value="${this._fields.security || 'WPA'}"
                                @sl-change="${e => this._setField('security', e.target.value)}">
                                <sl-option value="WPA">WPA/WPA2</sl-option>
                                <sl-option value="WEP">WEP</sl-option>
                                <sl-option value="nopass">Open (no password)</sl-option>
                            </sl-select>
                        </div>
                        <div class="field" style="justify-content:flex-end">
                            <sl-checkbox size="small" ?checked="${Boolean(this._fields.hidden)}"
                                @sl-change="${e => this._setField('hidden', e.target.checked)}">hidden network</sl-checkbox>
                        </div>
                    </div>
                    <div class="hint">The password lands in the saved site HTML — same visibility as any attribute (see the credential docs).</div>`;
            case 'email':
                return html`
                    ${this._in('to', 'To', {placeholder: 'name@example.com'})}
                    ${this._in('subject', 'Subject (optional)')}
                    ${this._in('body', 'Body (optional)')}`;
            case 'phone':
                return html`${this._in('number', 'Number', {placeholder: '+49…'})}`;
            case 'sms':
                return html`
                    ${this._in('number', 'Number', {placeholder: '+49…'})}
                    ${this._in('message', 'Message (optional)')}`;
            case 'geo':
                return html`
                    <div class="row">
                        ${this._in('lat', 'Latitude', {placeholder: '53.55'})}
                        ${this._in('lon', 'Longitude', {placeholder: '9.99'})}
                    </div>`;
            case 'vcard':
                return html`
                    ${this._in('name', 'Name')}
                    <div class="row">
                        ${this._in('phone', 'Phone (optional)')}
                        ${this._in('email', 'E-mail (optional)')}
                    </div>
                    <div class="row">
                        ${this._in('org', 'Organisation (optional)')}
                        ${this._in('url', 'URL (optional)')}
                    </div>`;
            default:   // text / raw
                return html`
                    <div class="field">
                        <label>Value</label>
                        <sl-textarea size="small" rows="3" autocomplete="off"
                            .value="${String(this._fields.text ?? '')}"
                            @sl-change="${e => this._setField('text', e.target.value)}"></sl-textarea>
                    </div>`;
        }
    }

    render() {
        if (!this.element) return html``;
        const generated = buildQrValue(this._type, this._fields);
        return html`
            <div class="section">
                <div class="sec-head">Content</div>
                <div class="sec-body">
                    <div class="field">
                        <label>Type</label>
                        <sl-select size="small" hoist .value="${this._type}"
                            @sl-change="${e => this._setType(e.target.value)}">
                            ${QR_TYPES.map(t => html`<sl-option value="${t.value}">${t.label}</sl-option>`)}
                        </sl-select>
                    </div>
                    ${this._typeFields()}
                    ${this._type === 'text' ? '' : html`
                        <div class="field">
                            <label>Generated value</label>
                            <div class="preview">${generated || '—'}</div>
                        </div>`}
                </div>
            </div>

            <div class="section">
                <div class="sec-head">MQTT &amp; Display</div>
                <div class="sec-body">
                    <div class="field">
                        <label>subscribe</label>
                        <feezal-topic-input size="small" placeholder="mqtt/topic — payload overrides the value"
                            value="${this._attr('subscribe')}"
                            @sl-change="${e => this._emit('subscribe', e.target.value)}"></feezal-topic-input>
                    </div>
                    <div class="field">
                        <label>message-property</label>
                        <sl-input size="small" autocomplete="off" placeholder="payload"
                            .value="${this._attr('message-property')}"
                            @sl-change="${e => this._emit('message-property', e.target.value)}"></sl-input>
                    </div>
                    <div class="row">
                        <div class="field">
                            <label>Error correction</label>
                            <sl-select size="small" hoist .value="${this._attr('ecc') || 'M'}"
                                @sl-change="${e => this._emit('ecc', e.target.value)}">
                                ${['L', 'M', 'Q', 'H'].map(l => html`<sl-option value="${l}">${l}</sl-option>`)}
                            </sl-select>
                        </div>
                        <div class="field">
                            <label>Label</label>
                            <sl-input size="small" autocomplete="off"
                                .value="${this._attr('label')}"
                                @sl-change="${e => this._emit('label', e.target.value)}"></sl-input>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

window.customElements.define('feezal-element-basic-qrcode-inspector', FeezalElementBasicQrcodeInspector);

export {FeezalElementBasicQrcode, FeezalElementBasicQrcodeInspector};

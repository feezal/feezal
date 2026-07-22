/* global feezal */
import {html, css} from '@feezal/feezal-element';
import '@feezal/feezal-element/feezal-topic-input.js';
import {LitElement} from 'lit';
import {MetroTileBase} from '@feezal/feezal-element-metro-tile';
// E137: the cover behavior lives in the shared controller — this element
// is a VIEW (Metro tile chrome: flip faces, flat fill front, back sliders).
import {CoverController, coverAttributes, coverDiscoveryMap} from '@feezal/feezal-controller-cover';

/**
 * feezal-element-metro-cover (E104)
 *
 * Cover / shutter tile: the FRONT shows the current position in flat Metro
 * style (percentage figure + a flat fill descending from the top — no
 * skeuomorphic slats); tapping the tile flips to the BACK holding a position
 * slider, up/stop/down buttons and — only when tilt topics are configured —
 * a tilt slider.
 *
 * E137: the MQTT contract (payload-mode json/separate, B26 min/max +
 * slat-min/slat-max device-range scaling, dedicated publish-up/-stop/-down
 * topics winning over publish-command, tilt) is the shared CoverController's
 * — declared once, identical to material-cover. This view reads
 * `cover.position`/`cover.tilt`, applies its display-only `invert`, and
 * forwards gestures to `up()/stop()/down()/setPosition()/setTilt()`.
 * Availability is N31 base-class machinery — this element only declares the
 * attributes and renders the Metro `!` badge from `this._available`.
 */

// U39 inspector/tile presentation metadata merged onto the shared contract
// by attribute name (the contract itself stays single-source, E137).
const METRO_UI = {
    'slat-angle': {help: 'Subscribe: venetian-blind tilt/slat angle. The back shows a tilt slider when a tilt topic is configured.'},
};

class FeezalElementMetroCover extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Cover', category: 'Metro', color: '#1ba1e2', icon: 'blinds'},
            description: 'Metro cover/shutter tile: the front shows the position as a flat fill + percentage; tap flips to the back with a position slider, up/stop/down buttons and an optional tilt slider. Wiring contract identical to material-cover incl. json payload mode, dedicated up/stop/down topics and min/max range scaling (Homematic 0…1).',
            inspector: 'feezal-element-metro-cover-inspector',
            // E137: the discovery map is the controller package's fragment
            // (HA `cover` + the E108/E120 native Homematic separate-mode keys;
            // N31: availability is mapped automatically from the canonical
            // discovery record — no availability lines here).
            discovery: {component: 'cover', map: coverDiscoveryMap},
            attributes: [
                ...MetroTileBase.tileAttributes,
                // E137: the shared cover contract (both payload modes, B26
                // min/max + slat range scaling, dedicated up/stop/down topics,
                // tilt) — declared ONCE by the controller package; METRO_UI
                // merges tile presentation metadata per name.
                ...coverAttributes.map(a => ({...a, ...METRO_UI[a.name]})),
                // ── Display ───────────────────────────────────────────────────
                {name: 'invert',        type: 'boolean', default: false, help: 'Invert position scale: 0=open, 100=closed.'},
                {name: 'show-position', type: 'boolean', default: true,  help: 'Show the numeric position percentage on the tile front.'},
                // ── Availability (N31 base-class machinery) ───────────────────
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability — a ! badge appears while unavailable; controls stay enabled.'},
                {name: 'message-property-availability', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the availability message. Blank = fall back to element-level message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning the device is online.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning the device is offline.'},
            ],
            styles: [
                ...MetroTileBase.tileStyles,
                {property: '--feezal-metro-cover-fill', type: 'color',
                    default: 'rgba(0, 0, 0, 0.28)',
                    help: 'Overlay colour of the closed portion of the tile (the flat fill descending from the top).'},
            ],
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
        };
    }

    static properties = {
        payloadMode:      {type: String,  reflect: true, attribute: 'payload-mode'},
        publish:          {type: String,  reflect: true},
        jsonMap:          {type: String,  reflect: true, attribute: 'json-map'},
        subscribePosition: {type: String, reflect: true, attribute: 'subscribe-position'},
        msgPropPosition:  {type: String,  reflect: true, attribute: 'message-property-position'},
        publishPosition:  {type: String,  reflect: true, attribute: 'publish-position'},
        publishCommand:   {type: String,  reflect: true, attribute: 'publish-command'},
        publishUp:        {type: String,  reflect: true, attribute: 'publish-up'},
        publishStop:      {type: String,  reflect: true, attribute: 'publish-stop'},
        publishDown:      {type: String,  reflect: true, attribute: 'publish-down'},
        payloadUp:        {type: String,  reflect: true, attribute: 'payload-up'},
        payloadStop:      {type: String,  reflect: true, attribute: 'payload-stop'},
        payloadDown:      {type: String,  reflect: true, attribute: 'payload-down'},
        min:              {type: Number,  reflect: true},
        max:              {type: Number,  reflect: true},
        slatAngle:        {type: String,  reflect: true, attribute: 'slat-angle'},
        msgPropTilt:      {type: String,  reflect: true, attribute: 'message-property-tilt'},
        publishSlatAngle: {type: String,  reflect: true, attribute: 'publish-slat-angle'},
        slatMin:          {type: Number,  reflect: true, attribute: 'slat-min'},
        slatMax:          {type: Number,  reflect: true, attribute: 'slat-max'},
        invert:           {type: Boolean, reflect: true},
        showPosition:     {type: Boolean, reflect: true, attribute: 'show-position'},
        // N31: availability inherited from FeezalElement.
        discoveryId:      {type: String,  reflect: true, attribute: 'discovery-id'},
        // E137: cover state (position/tilt) lives on the CoverController
        // (plain fields + host.requestUpdate) — no reactive state needed.
    };

    static styles = [MetroTileBase.styles, css`
        :host { --feezal-metro-cover-fill: rgba(0, 0, 0, 0.28); }
        /* Flat fill layer — spans the whole face (the .center wrapper stops
           18px above the bottom, hence the negative inset). Content sits on
           top via position:relative + DOM order. */
        .center > * { position: relative; }
        .fill { position: absolute; inset: 0 0 -18px 0; pointer-events: none; }
        .value { font-size: min(var(--_metro-value-size), 28cqh); font-weight: 300; }   /* E129 */
        .cmds { display: flex; justify-content: center; gap: 8px; }
        .cmds .mbtn { padding: 2px 8px; }
        .cmds feezal-icon { font-size: 18px; vertical-align: middle; }
    `];

    constructor() {
        super();
        this.payloadMode = 'json';
        this.publish = '';
        this.jsonMap = '';
        this.subscribePosition = '';
        this.msgPropPosition = '';
        this.publishPosition = '';
        this.publishCommand = '';
        this.publishUp = '';
        this.publishStop = '';
        this.publishDown = '';
        this.payloadUp = 'OPEN';
        this.payloadStop = 'STOP';
        this.payloadDown = 'CLOSE';
        this.min = 0;
        this.max = 100;
        this.slatAngle = '';
        this.msgPropTilt = '';
        this.publishSlatAngle = '';
        this.slatMin = 0;
        this.slatMax = 100;
        this.invert = false;
        this.showPosition = true;
        this.discoveryId = '';
        // E137: the behavior layer — wires/parses/scales/publishes; this
        // view renders. Metro supports both payload modes (json default).
        this.cover = new CoverController(this);
    }

    // Fully self-managed subscriptions (via the CoverController) — suppress
    // the generic base path, which would treat the json base topic as a
    // control channel. Availability stays base-class business (independent).
    _subscribe() { /* intentionally empty — the CoverController wires everything */ }

    // ─── Controls (view → controller commands) ────────────────────────────────

    _cmdUp()   { if (!feezal.isEditor) this.cover.up(); }
    _cmdStop() { if (!feezal.isEditor) this.cover.stop(); }
    _cmdDown() { if (!feezal.isEditor) this.cover.down(); }

    _onPos(e) {
        if (feezal.isEditor) return;
        // E137: clamp/round/B26 range scaling + json-vs-separate publish all
        // live behind the controller command.
        this.cover.setPosition(e.target.value);
    }

    _onTilt(e) {
        if (feezal.isEditor) return;
        this.cover.setTilt(e.target.value);
    }

    updated(changed) {
        super.updated(changed);
        // Live-canvas topic/mode edits re-wire through the controller
        // (fresh subscriptions also trigger the broker's retained replay).
        this.cover.rewireIfChanged();
    }

    // ─── Faces ────────────────────────────────────────────────────────────────

    /** Front tap flips to the back (a cover has no single toggle action).
     * Editor-guarded by the base's _frontClick. */
    baseAction() {
        this._flip(true);
    }

    /** N31 availability — the Metro `!` badge, like metro-contact. */
    renderBadge() {
        return this._available ? '' : '!';
    }

    renderFront() {
        const displayPos = this.cover.position ?? (feezal.isEditor ? 50 : null);
        const eff = displayPos === null ? null : (this.invert ? 100 - displayPos : displayPos);
        const closed = eff === null ? 0 : Math.max(0, Math.min(100, 100 - eff));
        return html`
            <div class="fill" style="background: linear-gradient(to bottom, var(--feezal-metro-cover-fill) ${closed}%, transparent ${closed}%)"></div>
            ${this.icon ? html`<feezal-icon name="${this.icon}"></feezal-icon>` : ''}
            ${this.showPosition ? html`
                <div class="value">${displayPos === null ? '—' : `${Math.round(displayPos)}%`}</div>` : ''}
        `;
    }

    renderBack() {
        const hasTilt = !!(this.slatAngle || this.publishSlatAngle);
        const pos = this.cover.position ?? (feezal.isEditor ? 50 : 0);
        return html`
            <div class="cmds">
                <button class="mbtn up"   title="Up"   @click="${this._cmdUp}"><feezal-icon name="keyboard_arrow_up"></feezal-icon></button>
                <button class="mbtn stop" title="Stop" @click="${this._cmdStop}"><feezal-icon name="stop"></feezal-icon></button>
                <button class="mbtn down" title="Down" @click="${this._cmdDown}"><feezal-icon name="keyboard_arrow_down"></feezal-icon></button>
            </div>
            <div class="rowline">
                <feezal-icon name="height"></feezal-icon>
                <input type="range" class="pos" min="0" max="100" step="1"
                    .value="${String(Math.round(pos))}" @change="${this._onPos}">
            </div>
            ${hasTilt ? html`
                <div class="rowline">
                    <feezal-icon name="line_weight"></feezal-icon>
                    <input type="range" class="tilt" min="0" max="100" step="1"
                        .value="${String(Math.round(this.cover.tilt ?? 0))}" @change="${this._onTilt}">
                </div>` : ''}`;
    }
}

customElements.define('feezal-element-metro-cover', FeezalElementMetroCover);
export {FeezalElementMetroCover};

// ─── N6 custom inspector ─────────────────────────────────────────────────────
// Mirrors material-cover's inspector in the metro-light two-tab shape:
// Topics tab — json mode: State & Control section + capability-gated Tilt /
// Availability; separate mode: Position + Command sections + gated Tilt /
// Availability. Config tab — payload mode, command payloads, value ranges,
// display options, availability payloads, message properties, tile settings.

const COVER_SECTIONS = [
    // Separate-mode capability-gated sections
    {id: 'tilt', title: 'Tilt / Slat angle', topics: [
        {attr: 'slat-angle',         label: 'Subscribe (angle)'},
        {attr: 'publish-slat-angle', label: 'Publish (angle)'},
    ]},
    {id: 'availability', title: 'Availability', topics: [
        {attr: 'subscribe-availability', label: 'Subscribe'},
    ]},
];

const JSON_CAPABILITIES = [
    // In json mode there are no per-property topic fields; tilt is read
    // from the JSON object when the `tilt` key is present. We still let
    // the user wire a separate tilt publish topic if needed.
    {id: 'tilt', title: 'Tilt / Slat angle', topics: [
        {attr: 'publish-slat-angle', label: 'Publish separate tilt topic (optional)', placeholder: 'mqtt/cover/slat/set'},
    ]},
    {id: 'availability', title: 'Availability', topics: [
        {attr: 'subscribe-availability', label: 'Subscribe'},
    ]},
];

class FeezalElementMetroCoverInspector extends LitElement {
    static properties = {
        element: {attribute: false},
        _tab:    {state: true},
        _open:   {state: true},
    };

    static styles = css`
        :host { display: block; font-size: 12px; color: var(--feezal-color, #333); }
        sl-tab-panel::part(base) { padding: 8px 2px; }
        .section { border: 1px solid var(--feezal-border, #e0e0e0); border-radius: 6px; margin-bottom: 8px; }
        .sec-head {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 8px; font-weight: 600;
            background: var(--feezal-bg-sub, #f5f5f5);
            border-radius: 6px 6px 0 0;
        }
        .sec-head.collapsed { border-radius: 6px; }
        .sec-title { flex: 1; }
        .sec-body { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
        .field { display: flex; flex-direction: column; gap: 2px; }
        .field > label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; }
        sl-input, sl-select { width: 100%; }
        sl-input::part(form-control-label), sl-select::part(form-control-label) { color: var(--sl-input-label-color, inherit); font-size: 12px; }
        sl-input::part(base), sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        sl-switch { color: var(--feezal-color, inherit); }
        .row { display: flex; gap: 6px; }
        .row > .field { flex: 1; min-width: 0; }
        .hint { font-size: 10px; opacity: 0.55; padding: 0 2px 4px; }
    `;

    constructor() {
        super();
        this.element = null;
        this._tab = 'topics';
        this._open = {};
    }

    willUpdate(changed) {
        if (changed.has('element')) this._open = {};
    }

    _val(name) { return this.element?.getAttribute(name) ?? ''; }

    _bool(name, defaultVal = false) {
        if (!this.element) return defaultVal;
        if (!this.element.hasAttribute(name)) return defaultVal;
        return true;
    }

    _emit(name, value, rerender = false) {
        this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
            bubbles: true, composed: true, detail: {name, value},
        }));
        if (rerender) this.requestUpdate();
    }

    _sectionEnabled(sec) {
        if (this._open[sec.id]) return true;
        return sec.topics.some(t => this._val(t.attr) !== '');
    }

    _toggleSection(sec, e) {
        const on = e.target.checked;
        if (on) {
            this._open = {...this._open, [sec.id]: true};
        } else {
            sec.topics.forEach(t => this._emit(t.attr, ''));
            this._open = {...this._open, [sec.id]: false};
        }
        this.requestUpdate();
    }

    _topicInput(t) {
        return html`
            <div class="field">
                <label>${t.label}</label>
                <feezal-topic-input size="small" placeholder="${t.placeholder ?? 'mqtt/topic'}" value="${this._val(t.attr)}"
                    @sl-change="${e => this._emit(t.attr, e.target.value)}"></feezal-topic-input>
            </div>`;
    }

    _numInput(attr, label, placeholder) {
        return html`
            <div class="field">
                <label>${label}</label>
                <sl-input size="small" type="number" autocomplete="off" placeholder="${placeholder ?? ''}"
                    value="${this._val(attr)}" @sl-change="${e => this._emit(attr, e.target.value)}"></sl-input>
            </div>`;
    }

    _textInput(attr, label, placeholder) {
        return html`
            <div class="field">
                <label>${label}</label>
                <sl-input size="small" autocomplete="off" placeholder="${placeholder ?? ''}"
                    value="${this._val(attr)}" @sl-change="${e => this._emit(attr, e.target.value)}"></sl-input>
            </div>`;
    }

    render() {
        if (!this.element) return html``;
        return html`
            <sl-tab-group @sl-tab-show="${e => { this._tab = e.detail.name; }}">
                <sl-tab slot="nav" panel="topics" ?active="${this._tab === 'topics'}">Topics</sl-tab>
                <sl-tab slot="nav" panel="config" ?active="${this._tab === 'config'}">Config</sl-tab>
                <sl-tab-panel name="topics">${this._renderTopics()}</sl-tab-panel>
                <sl-tab-panel name="config">${this._renderConfig()}</sl-tab-panel>
            </sl-tab-group>`;
    }

    _gatedSections(sections) {
        return sections.map(sec => {
            const enabled = this._sectionEnabled(sec);
            return html`
                <div class="section">
                    <div class="sec-head ${enabled ? '' : 'collapsed'}">
                        <span class="sec-title">${sec.title}</span>
                        <sl-switch size="small" ?checked="${enabled}"
                            @sl-change="${e => this._toggleSection(sec, e)}"></sl-switch>
                    </div>
                    ${enabled ? html`<div class="sec-body">${sec.topics.map(t => this._topicInput(t))}</div>` : ''}
                </div>`;
        });
    }

    _renderTopics() {
        const isJson = (this._val('payload-mode') || 'json') === 'json';
        if (isJson) {
            return html`
                <div class="hint">JSON mode — one topic carries the whole state object.</div>
                <div class="section">
                    <div class="sec-head">State &amp; Control</div>
                    <div class="sec-body">
                        ${this._topicInput({attr: 'subscribe', label: 'Subscribe (state topic)'})}
                        ${this._topicInput({attr: 'publish',   label: 'Publish (…/set)'})}
                    </div>
                </div>
                ${this._gatedSections(JSON_CAPABILITIES)}`;
        }

        // ── Separate mode ──────────────────────────────────────────────────
        return html`
            <div class="section">
                <div class="sec-head">Position</div>
                <div class="sec-body">
                    ${this._topicInput({attr: 'subscribe-position', label: 'Subscribe'})}
                    ${this._topicInput({attr: 'publish-position',   label: 'Publish'})}
                </div>
            </div>
            <div class="section">
                <div class="sec-head">Command</div>
                <div class="sec-body">
                    ${this._topicInput({attr: 'publish-command', label: 'Up / Stop / Down'})}
                    ${this._topicInput({attr: 'publish-up',   label: 'Up (dedicated topic, optional)'})}
                    ${this._topicInput({attr: 'publish-stop', label: 'Stop (dedicated topic, optional)'})}
                    ${this._topicInput({attr: 'publish-down', label: 'Down (dedicated topic, optional)'})}
                </div>
            </div>
            ${this._gatedSections(COVER_SECTIONS)}`;
    }

    _renderConfig() {
        const payloadMode = this._val('payload-mode') || 'json';
        return html`
            <div class="section">
                <div class="sec-head">Payload mode</div>
                <div class="sec-body">
                    <div class="field">
                        <sl-select size="small" value="${payloadMode}"
                            @sl-change="${e => this._emit('payload-mode', e.target.value, true)}">
                            <sl-option value="json">json (single topic, default)</sl-option>
                            <sl-option value="separate">separate (one topic per property)</sl-option>
                        </sl-select>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Commands</div>
                <div class="sec-body">
                    ${this._textInput('payload-up',   'Up',   'OPEN')}
                    ${this._textInput('payload-stop', 'Stop', 'STOP')}
                    ${this._textInput('payload-down', 'Down', 'CLOSE')}
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Value ranges</div>
                <div class="sec-body">
                    <div class="hint">Device value scale — incoming values are scaled to 0–100&nbsp;%, published targets scaled back (Homematic: min 0, max 1).</div>
                    <div class="row">
                        ${this._numInput('min', 'Position min', '0')}
                        ${this._numInput('max', 'Position max', '100')}
                    </div>
                    <div class="row">
                        ${this._numInput('slat-min', 'Slat angle min', '0')}
                        ${this._numInput('slat-max', 'Slat angle max', '100')}
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Display</div>
                <div class="sec-body">
                    <div class="field">
                        <sl-switch size="small"
                            ?checked="${this._bool('invert', false)}"
                            @sl-change="${e => this._emit('invert', e.target.checked || null, true)}">
                            Invert (0 = open)
                        </sl-switch>
                    </div>
                    <div class="field">
                        <sl-switch size="small"
                            ?checked="${this._bool('show-position', true)}"
                            @sl-change="${e => this._emit('show-position', e.target.checked || null, true)}">
                            Show position %
                        </sl-switch>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Availability</div>
                <div class="sec-body">
                    <div class="row">
                        ${this._textInput('payload-available',   'Online payload',  'online')}
                        ${this._textInput('payload-unavailable', 'Offline payload', 'offline')}
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Message property</div>
                <div class="sec-body">
                    <div class="hint">Dot-notation path to extract a value from each message (e.g. <code>payload</code>, <code>data.value</code>). Blank = read top-level payload.</div>
                    ${this._textInput('message-property',              'Global (all topics)', 'payload')}
                    ${this._textInput('message-property-position',     'Position topic',      'payload')}
                    ${this._textInput('message-property-tilt',         'Tilt / slat topic',   'payload')}
                    ${this._textInput('message-property-availability', 'Availability topic',  'payload')}
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Tile</div>
                <div class="sec-body">
                    ${this._textInput('label', 'Label', 'Kitchen blinds')}
                    <div class="field"><label>Icon</label>
                        <feezal-icon-input .value="${this._val('icon')}"
                            @feezal-change="${e => { e.stopPropagation(); this._emit('icon', e.detail.value); }}"></feezal-icon-input></div>
                    <div class="field"><label>Size</label>
                        <sl-select size="small" value="${this._val('size')}"
                            @sl-change="${e => this._emit('size', e.target.value, true)}">
                            <sl-option value="">manual</sl-option>
                            <sl-option value="1x1">1x1</sl-option>
                            <sl-option value="2x2">2x2</sl-option>
                            <sl-option value="4x2">4x2</sl-option>
                            <sl-option value="4x4">4x4</sl-option>
                        </sl-select></div>
                </div>
            </div>`;
    }
}

customElements.define('feezal-element-metro-cover-inspector', FeezalElementMetroCoverInspector);
export {FeezalElementMetroCoverInspector};

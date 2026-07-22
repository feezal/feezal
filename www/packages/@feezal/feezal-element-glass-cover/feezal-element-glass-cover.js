/* global feezal */
import {feezalBaseStyles, html, css} from '@feezal/feezal-element';
// E137: the cover behavior lives in the shared controller — this element
// is a VIEW (Glass chrome: frost tile, details popup: position pill,
// up/stop/down buttons, tilt slider).
import {CoverController, coverAttributes, coverDiscoveryMap} from '@feezal/feezal-controller-cover';
import '@feezal/feezal-element/feezal-topic-input.js';
import {LitElement} from 'lit';
import {applySizePreset, glassCardStyles, glassPopupStyles, FeezalGlassCard} from '@feezal/feezal-glass';

/**
 * feezal-element-glass-cover (E58)
 *
 * Frosted-glass shutter/cover card. Tap (or the ⋯ button) opens the
 * Apple-Home-style details popup: a big vertical position pill (drag to
 * set, fill = open portion), up/stop/down buttons beneath, tilt slider
 * when configured.
 *
 * E137: the MQTT contract (json/separate payload modes, up/stop/down
 * command payloads + dedicated per-direction topics, B26 position/tilt
 * device-range scaling, HA discovery) is the shared
 * @feezal/feezal-controller-cover — identical to material-cover. This
 * view reads `cover.position`/`cover.tilt` and forwards gestures to
 * `up()/stop()/down()/setPosition(pct)/setTilt(pct)`; `invert` and the
 * drag preview stay display-only, element-local state.
 *
 * Family conventions (frost vars, degrade, squircle): see glass-button.
 */

class FeezalElementGlassCover extends FeezalGlassCard {
    static get feezal() {
        return {
            palette: {name: 'Cover', category: 'Glass', color: '#7aa5c9', icon: 'blinds'},
            description: 'Frosted-glass shutter/cover tile — tap opens the details popup: vertical position ' +
                'slider, up/stop/down buttons and (when configured) a tilt slider. Same wiring contract as the ' +
                'material cover card.',
            inspector: 'feezal-element-glass-cover-inspector',
            // E137: the discovery map is the controller package's fragment.
            discovery: {component: 'cover', map: coverDiscoveryMap},
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x2', '2x1'], default: '',
                    help: 'Preset size: 2x2 = square (150×150), 2x1 = wide (150×75). Empty keeps the current/manual size.'},
                // E137: the shared cover contract (both payload modes,
                // up/stop/down + dedicated per-direction topics, B26 position/
                // tilt scaling) — declared ONCE by the controller package.
                ...coverAttributes,
                {name: 'invert',        type: 'boolean', default: false, help: 'Invert position scale: 0=open, 100=closed.'},
                {name: 'show-position', type: 'boolean', default: true,  help: 'Show the numeric position in the state line.'},
                {name: 'label', type: 'string', help: 'Card label.'},
                {name: 'icon',  type: 'string', default: 'blinds', help: 'Icon name.'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Optional availability topic — badge when unavailable, controls stay enabled.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning online.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning offline.'},
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-accent', type: 'color', default: '#0a84ff', help: 'Button/state accent colour.'},
                {property: '--feezal-glass-shade', type: 'color', help: 'Shade layer colour (defaults to a stronger frost tint).'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-icon-size', default: '28px', help: 'Icon font size.'},
                {property: '--feezal-glass-font-size-state', default: '15px', help: 'State line font size.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Label font size.'},
                {property: '--feezal-glass-font-size-unit', default: '12px', help: 'Flip/detail button icon size.'},
            ],
            defaultStyle: {width: '172px', height: '128px'},
            restrict: {minWidth: 90, minHeight: 70},
        };
    }

    static properties = {
        size:              {type: String,  reflect: true},
        payloadMode:       {type: String,  reflect: true, attribute: 'payload-mode'},
        publish:           {type: String,  reflect: true},
        jsonMap:           {type: String,  reflect: true, attribute: 'json-map'},
        subscribePosition: {type: String,  reflect: true, attribute: 'subscribe-position'},
        msgPropPosition:   {type: String,  reflect: true, attribute: 'message-property-position'},
        publishPosition:   {type: String,  reflect: true, attribute: 'publish-position'},
        publishCommand:    {type: String,  reflect: true, attribute: 'publish-command'},
        publishUp:         {type: String,  reflect: true, attribute: 'publish-up'},
        publishStop:       {type: String,  reflect: true, attribute: 'publish-stop'},
        publishDown:       {type: String,  reflect: true, attribute: 'publish-down'},
        payloadUp:         {type: String,  reflect: true, attribute: 'payload-up'},
        payloadStop:       {type: String,  reflect: true, attribute: 'payload-stop'},
        payloadDown:       {type: String,  reflect: true, attribute: 'payload-down'},
        min:               {type: Number,  reflect: true},
        max:               {type: Number,  reflect: true},
        slatMin:           {type: Number,  reflect: true, attribute: 'slat-min'},
        slatMax:           {type: Number,  reflect: true, attribute: 'slat-max'},
        slatAngle:         {type: String,  reflect: true, attribute: 'slat-angle'},
        msgPropTilt:       {type: String,  reflect: true, attribute: 'message-property-tilt'},
        publishSlatAngle:  {type: String,  reflect: true, attribute: 'publish-slat-angle'},
        invert:            {type: Boolean, reflect: true},
        showPosition:      {type: Boolean, reflect: true, attribute: 'show-position'},
        label:             {type: String,  reflect: true},
        icon:              {type: String,  reflect: true},
        // N31: availability inherited from FeezalElement.
        degrade:           {type: Boolean, reflect: true},
        discoveryId:       {type: String,  reflect: true, attribute: 'discovery-id'},
        // E137: position/tilt live on the CoverController (plain fields +
        // host.requestUpdate) — only the pill drag preview stays element-local.
        _dragPos:   {state: true},   // live % while the position pill drags (null = not dragging)
    };

    static styles = [feezalBaseStyles, glassCardStyles, glassPopupStyles, css`
        .card {
            /* E106: deliberate override of the fragment's 12px padding — cover's
               face is tighter than the other popup cards. */
            padding: 10px; gap: 2px;
            overflow: hidden; touch-action: none;
        }
        .card { cursor: pointer; transition: transform 0.15s ease, background 0.2s ease; }
        .card:active { transform: scale(0.97); }
        feezal-icon { font-size: var(--feezal-glass-icon-size, 28px); line-height: 1; color: var(--feezal-glass-muted, rgba(29,29,31,0.55)); }
        .state { font-size: var(--feezal-glass-font-size-state, 15px); font-weight: 700; position: relative; }
        .label {
            font-size: var(--feezal-glass-font-size-label, 12px); font-weight: 600; line-height: 1.2; position: relative;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .unavail {
            position: absolute; bottom: 8px; right: 10px;
            font-size: 12px; color: var(--error-color, #d32f2f); opacity: 0.85; z-index: 1;
        }
        /* E105: much wider than tall → horizontal layout (Apple-Home wide
           tile): icon left, state/label stacked right of it. flip-btn and
           unavail stay absolutely positioned in their corners. */
        @container (min-aspect-ratio: 2/1) {
            .card {
                display: grid;
                grid-template: 'icon state' auto 'icon label' auto / auto 1fr;
                align-content: center;
                align-items: center;
                column-gap: 10px;
                text-align: left;
            }
            .card > feezal-icon { grid-area: icon; }
            .card .state { grid-area: state; align-self: end; }
            .card .label { grid-area: label; align-self: start; }
        }

        /* ── details popup (glass-light pattern) — browser top layer ── */
        /* Vertical position pill — fill = open portion. */
        .vslider {
            position: relative; width: 72px; height: 170px; flex: 0 0 auto;
            border-radius: 20px; overflow: hidden; cursor: grab;
            background: var(--feezal-glass-shade, color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 18%, transparent));
            touch-action: none; user-select: none;
        }
        .vslider .fill {
            position: absolute; left: 0; right: 0; bottom: 0;
            background: var(--feezal-glass-on-tint, rgba(255,255,255,0.95));
        }
        .vslider .pct {
            position: absolute; left: 0; right: 0; bottom: 10px; text-align: center;
            font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums;
            pointer-events: none;
        }
        .vslider feezal-icon {
            position: absolute; left: 0; right: 0; top: 12px; text-align: center;
            font-size: 22px; pointer-events: none;
        }
        .buttons { display: flex; gap: 8px; align-self: stretch; }
        .buttons button {
            flex: 1; border: none; cursor: pointer; padding: 8px 0;
            border-radius: 12px;
            background: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 8%, transparent);
            color: var(--feezal-glass-color, #1d1d1f);
            font-family: 'Material Icons'; font-size: 18px; line-height: 1;
        }
        .buttons button:active { background: var(--feezal-glass-accent, #0a84ff); color: #fff; }
        .tilt { display: flex; align-items: center; gap: 6px; align-self: stretch; font-size: 11px; }
        .tilt input[type="range"] { flex: 1; accent-color: var(--feezal-glass-accent, #0a84ff); cursor: pointer; }
    `];

    constructor() {
        super();
        this.size = '';
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
        this.slatMin = 0;
        this.slatMax = 100;
        this.slatAngle = '';
        this.msgPropTilt = '';
        this.publishSlatAngle = '';
        this.invert = false;
        this.showPosition = true;
        this.label = '';
        this.icon = 'blinds';
        this.degrade = false;
        this.discoveryId = '';
        this._dragPos = null;
        // E137: the behavior layer — wires/parses/publishes; this view renders.
        this.cover = new CoverController(this);
    }

    // Device cards manage subscriptions manually (via the controller);
    // suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    // E137: the CoverController wires everything in hostConnected.

    updated(changed) {
        super.updated(changed);
        // Live-canvas topic edits re-wire through the controller.
        this.cover.rewireIfChanged();
        // The size grid writes the element's inline geometry (editor keeps
        // full manual control afterwards).
        if (changed.has('size')) applySizePreset(this);
        // Promote the details popup into the top layer (glass-light pattern).
        if (changed.has('_details') && this._details) {
            const popup = this.renderRoot.querySelector('.details');
            if (popup?.showPopover && !popup.matches(':popover-open')) {
                try { popup.showPopover(); } catch { /* fixed+z-index fallback */ }
            }
            this._positionDetails();
        }
    }

    // ── details popup (glass-light pattern) ──────────────────────────────────

    _onCardClick() {
        if (this._suppressTap) {
            this._suppressTap = false;
            return;
        }
        this.openDetails();
    }

    /** Vertical position pill: pointer position → % open; publish on release. */
    _vsliderDown(e) {
        if (feezal.isEditor) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        this.__vsliderDragging = true;
        this._vsliderApply(e);
    }

    _vsliderMove(e) {
        if (this.__vsliderDragging) this._vsliderApply(e);
    }

    _vsliderUp(e) {
        if (!this.__vsliderDragging) return;
        this.__vsliderDragging = false;
        this._vsliderApply(e);
        const eff = this._dragPos;
        this._dragPos = null;
        // The pill shows the EFFECTIVE open % — convert back for inverted
        // scales. E137: clamp/scale/publish live behind the controller command.
        this.cover.setPosition(this.invert ? 100 - eff : eff);
    }

    _vsliderApply(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = Math.round((1 - (e.clientY - rect.top) / rect.height) * 100);
        this._dragPos = Math.max(0, Math.min(100, pct));
    }

    /** Effective open % (0 = closed): pill drag preview wins, else state. */
    _effPos() {
        if (this._dragPos !== null) return this._dragPos;
        const pos = this.cover.position ?? (feezal.isEditor ? 60 : null);
        if (pos === null) return null;
        return this.invert ? 100 - pos : pos;
    }

    _stateText() {
        const eff = this._effPos();
        if (eff === null) return feezal.isEditor ? 'Cover' : '—';
        const word = eff <= 0 ? 'Closed' : 'Open';
        return this.showPosition && eff > 0 && eff < 100 ? `${word} • ${eff} %` : word;
    }


    _renderDetails() {
        const eff = this._effPos() ?? 0;
        const hasTilt = Boolean(this.slatAngle || this.publishSlatAngle);
        return html`
            <div class="details" popover="manual">
                <div class="title">${this.label || 'Cover'}</div>
                <div class="vslider"
                    @pointerdown="${this._vsliderDown}"
                    @pointermove="${this._vsliderMove}"
                    @pointerup="${this._vsliderUp}">
                    <div class="fill" style="height:${eff}%"></div>
                    <feezal-icon name="${this.icon || 'blinds'}"></feezal-icon>
                    <div class="pct">${eff} %</div>
                </div>
                <div class="buttons">
                    <button title="Up" @click="${() => this.cover.up()}">keyboard_arrow_up</button>
                    <button title="Stop" @click="${() => this.cover.stop()}">stop</button>
                    <button title="Down" @click="${() => this.cover.down()}">keyboard_arrow_down</button>
                </div>
                ${hasTilt ? html`
                    <div class="tilt">
                        <span>Tilt</span>
                        <input type="range" min="0" max="100" .value="${String(this.cover.tilt ?? 0)}"
                            @change="${e => this.cover.setTilt(e.target.value)}">
                    </div>` : ''}
            </div>`;
    }

    render() {
        return html`
            <div class="card" role="button" tabindex="0"
                @click="${this._onCardClick}"
                @keydown="${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._onCardClick(); } }}">
                ${!this._available ? html`<span class="unavail" title="Device unavailable">⚠</span>` : ''}
                <button class="flip-btn" title="Details"
                    @click="${e => { e.stopPropagation(); this.openDetails(); }}">tune</button>
                <feezal-icon name="${this.icon || 'blinds'}"></feezal-icon>
                <span class="state">${this._stateText()}</span>
                <span class="label">${this.label || (feezal.isEditor ? 'Cover' : '')}</span>
            </div>
            ${this._details ? this._renderDetails() : ''}
        `;
    }
}

customElements.define('feezal-element-glass-cover', FeezalElementGlassCover);

// ── N6 custom inspector ──────────────────────────────────────────────────────
// Two-tab Topics/Config inspector — same structure as the material-cover
// inspector (capability-gated Tilt/Availability sections, payload mode +
// commands + display + message-property on Config).

const SHUTTER_SECTIONS = [
    {id: 'tilt', title: 'Tilt / Slat angle', topics: [
        {attr: 'slat-angle',         label: 'Subscribe (angle 0–100)'},
        {attr: 'publish-slat-angle', label: 'Publish (angle 0–100)'},
    ]},
    {id: 'availability', title: 'Availability', topics: [
        {attr: 'subscribe-availability', label: 'Subscribe'},
    ]},
];

const SHUTTER_JSON_CAPABILITIES = [
    {id: 'tilt', title: 'Tilt / Slat angle', topics: [
        {attr: 'publish-slat-angle', label: 'Publish separate tilt topic (optional)', placeholder: 'mqtt/cover/slat/set'},
    ]},
    {id: 'availability', title: 'Availability', topics: [
        {attr: 'subscribe-availability', label: 'Subscribe'},
    ]},
];

class FeezalElementGlassCoverInspector extends LitElement {
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
            display: flex; align-items: center; gap: 8px; padding: 6px 8px; font-weight: 600;
            background: var(--feezal-bg-sub, #f5f5f5); border-radius: 6px 6px 0 0;
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
        .row > .field { flex: 1; }
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
    _bool(name, defaultValue = false) {
        if (!this.element) return defaultValue;
        return this.element.hasAttribute(name) ? true : defaultValue;
    }

    _emit(name, value, rerender = false) {
        this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
            bubbles: true, composed: true, detail: {name, value},
        }));
        if (rerender) this.requestUpdate();
    }

    _topicInput(t) {
        return html`
            <div class="field">
                <label>${t.label}</label>
                <feezal-topic-input size="small" placeholder="${t.placeholder ?? 'mqtt/topic'}"
                    value="${this._val(t.attr)}"
                    @sl-change="${e => this._emit(t.attr, e.target.value)}"></feezal-topic-input>
            </div>`;
    }

    _textInput(attr, label, placeholder = '') {
        return html`
            <div class="field">
                <label>${label}</label>
                <sl-input size="small" autocomplete="off" placeholder="${placeholder}"
                    value="${this._val(attr)}"
                    @sl-change="${e => this._emit(attr, e.target.value)}"></sl-input>
            </div>`;
    }

    _numInput(attr, label, placeholder = '') {
        return html`
            <div class="field">
                <label>${label}</label>
                <sl-input size="small" type="number" autocomplete="off" placeholder="${placeholder}"
                    value="${this._val(attr)}"
                    @sl-change="${e => this._emit(attr, e.target.value)}"></sl-input>
            </div>`;
    }

    _sectionEnabled(sec) {
        if (this._open[sec.id]) return true;
        return sec.topics.some(t => this._val(t.attr) !== '');
    }

    _toggleSection(sec, e) {
        if (e.target.checked) {
            this._open = {...this._open, [sec.id]: true};
        } else {
            sec.topics.forEach(t => this._emit(t.attr, ''));
            this._open = {...this._open, [sec.id]: false};
        }
        this.requestUpdate();
    }

    render() {
        if (!this.element) return html``;
        return html`
            <sl-tab-group @sl-tab-show="${e => { this._tab = e.detail.name; }}">
                <sl-tab slot="nav" panel="topics" ?active="${this._tab === 'topics'}">Topics</sl-tab>
                <sl-tab slot="nav" panel="config" ?active="${this._tab === 'config'}">Config</sl-tab>
                <sl-tab-panel name="topics">${this._renderTopics()}</sl-tab-panel>
                <sl-tab-panel name="config">${this._renderConfig()}</sl-tab-panel>
            </sl-tab-group>
        `;
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
                        ${this._topicInput({attr: 'publish', label: 'Publish (…/set)'})}
                    </div>
                </div>
                ${this._gatedSections(SHUTTER_JSON_CAPABILITIES)}`;
        }
        return html`
            <div class="section">
                <div class="sec-head">Position</div>
                <div class="sec-body">
                    ${this._topicInput({attr: 'subscribe-position', label: 'Subscribe'})}
                    ${this._topicInput({attr: 'publish-position', label: 'Publish'})}
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
            ${this._gatedSections(SHUTTER_SECTIONS)}`;
    }

    _renderConfig() {
        return html`
            <div class="section">
                <div class="sec-head">Payload mode</div>
                <div class="sec-body">
                    <div class="field">
                        <sl-select size="small" value="${this._val('payload-mode') || 'json'}"
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
                    ${this._textInput('payload-up', 'Up', 'OPEN')}
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
                        <label>Size</label>
                        <sl-select size="small" value="${this._val('size') || ''}"
                            @sl-change="${e => this._emit('size', e.target.value)}">
                            <sl-option value="">Auto (manual size)</sl-option>
                            <sl-option value="2x2">2x2</sl-option>
                            <sl-option value="2x1">2x1</sl-option>
                        </sl-select>
                    </div>
                    <div class="field">
                        <sl-switch size="small" ?checked="${this._bool('invert', false)}"
                            @sl-change="${e => this._emit('invert', e.target.checked || null, true)}">
                            Invert (0 = open)
                        </sl-switch>
                    </div>
                    <div class="field">
                        <sl-switch size="small" ?checked="${this._val('show-position') !== 'false' && this._bool('show-position', true)}"
                            @sl-change="${e => this._emit('show-position', e.target.checked || null, true)}">
                            Show position %
                        </sl-switch>
                    </div>
                    ${this._textInput('label', 'Label', 'Kitchen blinds')}
                    ${this._textInput('icon', 'Icon', 'blinds')}
                    <div class="field">
                        <sl-switch size="small" ?checked="${this.element.hasAttribute('degrade')}"
                            @sl-change="${e => this._emit('degrade', e.target.checked || null)}">
                            Degrade (no live blur — weak GPUs)
                        </sl-switch>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Availability</div>
                <div class="sec-body">
                    ${this._topicInput({attr: 'subscribe-availability', label: 'Availability topic'})}
                    <div class="row">
                        ${this._textInput('payload-available', 'Online payload', 'online')}
                        ${this._textInput('payload-unavailable', 'Offline payload', 'offline')}
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Message property</div>
                <div class="sec-body">
                    <div class="hint">Dot-notation path per topic; blank falls back to the global one.</div>
                    ${this._textInput('message-property', 'Global (all topics)', 'payload')}
                    ${this._textInput('message-property-position', 'Position topic', 'payload')}
                    ${this._textInput('message-property-tilt', 'Tilt / slat topic', 'payload')}
                    ${this._textInput('message-property-availability', 'Availability topic', 'payload')}
                </div>
            </div>
        `;
    }
}

customElements.define('feezal-element-glass-cover-inspector', FeezalElementGlassCoverInspector);

/**
 * Deprecated alias — the pre-rename tag (was feezal-element-glass-shutter).
 * Saved dashboards keep rendering; never appears in the palette (the palette
 * only lists package-name tags). Remove after a deprecation window.
 */
class FeezalElementGlassShutter extends FeezalElementGlassCover {
    connectedCallback() {
        super.connectedCallback();
        console.warn('[feezal] <feezal-element-glass-shutter> is deprecated — use <feezal-element-glass-cover> (the legacy tag keeps working).');
    }
}
if (!customElements.get('feezal-element-glass-shutter')) {
    customElements.define('feezal-element-glass-shutter', FeezalElementGlassShutter);
}

export {FeezalElementGlassCover};

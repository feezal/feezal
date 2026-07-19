/**
 * feezal-climate-profiles — E102 WP3 device-profile stamping picker.
 *
 * A shared editor component that stamps a climate device profile onto the
 * selected `*-climate` element. Hosted three ways:
 *   • glass-climate / metro-climate — via the U39 `{type:'custom'}` inspector
 *     hook (rendered by feezal-sidebar-inspector-attributes, `.element` set,
 *     `feezal-attribute-changed` routed through the dirty+undo commit path).
 *   • material-climate — embedded at the top of its N6 custom-inspector Config
 *     tab, its events wired into material's existing attribute-commit path.
 *
 * Stamp flow: pick a profile + base topic + channel → build the attribute map
 * (climate-profiles.js) → emit ONE `feezal-attribute-changed` {detail:{name,
 * value}} per attribute (objects/arrays passed as-is; the commit path
 * JSON-stringifies them). When the element already has a non-default `modes`
 * attribute, an inline overwrite confirmation gates the stamp.
 *
 * Profiles are templates — after stamping, every attribute is plain and
 * hand-editable.
 */
import {LitElement, html, css} from 'lit';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import {CLIMATE_PROFILES, getClimateProfile} from './climate-profiles.js';

class FeezalClimateProfiles extends LitElement {
    static properties = {
        element:     {attribute: false},
        _profileId:  {state: true},
        _baseTopic:  {state: true},
        _channel:    {state: true},
        _confirming: {state: true},   // pending attribute map awaiting overwrite confirm
    };

    static styles = css`
        :host { display: block; }
        .profiles {
            border: 1px solid var(--divider-color, var(--feezal-border, #e0e0e0));
            border-radius: 6px; padding: 8px; margin-bottom: 10px;
            background: var(--secondary-background-color, var(--feezal-bg-sub, #f5f5f5));
        }
        .title {
            font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
            text-transform: uppercase; margin-bottom: 6px;
            color: var(--secondary-text-color, var(--feezal-color, #555));
        }
        .field { display: flex; flex-direction: column; gap: 2px; margin-bottom: 6px; }
        .field > label {
            font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em;
            color: var(--secondary-text-color, var(--feezal-color, #666));
        }
        .row { display: flex; gap: 6px; }
        .row > .field { flex: 1 1 0; min-width: 0; }
        sl-input, sl-select { width: 100%; }
        sl-input::part(form-control-label), sl-select::part(form-control-label) {
            color: var(--sl-input-label-color, inherit); font-size: 12px;
        }
        sl-input::part(base), sl-select::part(combobox) {
            background: var(--primary-background-color, var(--feezal-bg, #fff));
            border-color: var(--divider-color, var(--feezal-border, #ccc));
            color: var(--primary-text-color, var(--feezal-color, #333));
        }
        sl-input::part(input) {
            background: var(--primary-background-color, var(--feezal-bg, #fff));
            color: var(--primary-text-color, var(--sl-input-color, #333));
        }
        .hint {
            font-size: 10px; opacity: 0.6; line-height: 1.4; margin: 2px 0 6px;
            color: var(--secondary-text-color, var(--feezal-color, #666));
        }
        .stamp-btn {
            width: 100%; margin-top: 2px; cursor: pointer; padding: 6px 10px;
            border: none; border-radius: 5px; font-size: 12px; font-weight: 600;
            background: var(--primary-color, var(--sl-color-primary-600, #0284c7)); color: #fff;
        }
        .stamp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .confirm {
            margin-top: 8px; padding: 8px; border-radius: 5px;
            border: 1px solid var(--error-color, #d32f2f);
            background: color-mix(in srgb, var(--error-color, #d32f2f) 8%, transparent);
        }
        .confirm p {
            margin: 0 0 8px; font-size: 11px; line-height: 1.4;
            color: var(--primary-text-color, var(--feezal-color, #333));
        }
        .confirm .btns { display: flex; gap: 6px; }
        .confirm button {
            flex: 1; cursor: pointer; padding: 5px 8px; border-radius: 4px;
            font-size: 11px; font-weight: 600; border: 1px solid var(--divider-color, #ccc);
            background: var(--primary-background-color, #fff);
            color: var(--primary-text-color, #333);
        }
        .confirm button.danger {
            border-color: var(--error-color, #d32f2f);
            background: var(--error-color, #d32f2f); color: #fff;
        }
    `;

    constructor() {
        super();
        this.element = null;
        this._profileId = CLIMATE_PROFILES[0].id;
        this._baseTopic = '';
        this._channel = '';
        this._confirming = null;
    }

    /** Whether the selected profile is a Homematic (channel-aware) one. */
    get _needsChannel() {
        return this._profileId === 'hm2mqtt-bidcos' || this._profileId === 'hm2mqtt-hmip';
    }

    /** True when the element's current `modes` attribute holds real entries. */
    _hasNonDefaultModes() {
        const raw = (this.element?.getAttribute('modes') || '').trim();
        if (!raw) return false;
        try {
            const arr = JSON.parse(raw);
            return Array.isArray(arr) && arr.length > 0;
        } catch {
            return true;   // unparseable but non-empty → treat as user content
        }
    }

    _emit(name, value) {
        this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
            bubbles: true, composed: true, detail: {name, value},
        }));
    }

    /** Build the attribute map for the current profile + inputs. */
    _buildMap() {
        const profile = getClimateProfile(this._profileId);
        if (!profile) return null;
        return profile.build(this._baseTopic, this._channel);
    }

    _onStamp() {
        const map = this._buildMap();
        if (!map) return;
        if (this._hasNonDefaultModes()) {
            this._confirming = map;   // gate behind overwrite confirmation
            return;
        }
        this._stamp(map);
    }

    _stamp(map) {
        for (const [name, value] of Object.entries(map)) {
            this._emit(name, value);
        }
        this._confirming = null;
    }

    render() {
        if (!this.element) return html``;
        const needsChannel = this._needsChannel;
        return html`
            <div class="profiles">
                <div class="title">Device profile</div>
                <div class="field">
                    <label>Profile</label>
                    <sl-select size="small" hoist value="${this._profileId}"
                        @sl-change="${e => { this._profileId = e.target.value; this._confirming = null; }}">
                        ${CLIMATE_PROFILES.map(p => html`
                            <sl-option value="${p.id}">${p.label}</sl-option>`)}
                    </sl-select>
                </div>
                <div class="row">
                    <div class="field">
                        <label>Base topic</label>
                        <sl-input size="small" autocomplete="off"
                            placeholder="${needsChannel ? 'hm' : 'zigbee2mqtt/TRV'}"
                            value="${this._baseTopic}"
                            @sl-input="${e => { this._baseTopic = e.target.value; }}"></sl-input>
                    </div>
                    ${needsChannel ? html`
                        <div class="field">
                            <label>Channel</label>
                            <sl-input size="small" autocomplete="off"
                                placeholder="TRV/4"
                                value="${this._channel}"
                                @sl-input="${e => { this._channel = e.target.value; }}"></sl-input>
                        </div>` : ''}
                </div>
                ${needsChannel ? html`
                    <div class="hint">Base = bridge prefix (e.g. <code>hm</code>). Channel = the
                        device/channel path, e.g. <code>TRV/4</code> (BidCoS) or a channel address
                        like <code>OEQ1234567:1</code> (HmIP). For a virtual heating group use the
                        group's <code>:1</code> channel with the matching generation's profile.</div>
                    <div class="hint">⚠ hm2mqtt topic shapes are pending live-system verification.</div>
                ` : html`
                    <div class="hint">Base = the device's MQTT base topic; commands and state
                        derive from it.</div>`}
                <button class="stamp-btn" ?disabled="${this._confirming != null}"
                    @click="${this._onStamp}">Stamp profile</button>

                ${this._confirming ? html`
                    <div class="confirm">
                        <p>This element already has mode entries configured. Stamping overwrites
                            <code>modes</code> and the other wiring attributes. Continue?</p>
                        <div class="btns">
                            <button @click="${() => { this._confirming = null; }}">Cancel</button>
                            <button class="danger" @click="${() => this._stamp(this._confirming)}">Overwrite</button>
                        </div>
                    </div>` : ''}
            </div>
        `;
    }
}

customElements.define('feezal-climate-profiles', FeezalClimateProfiles);
export {FeezalClimateProfiles};

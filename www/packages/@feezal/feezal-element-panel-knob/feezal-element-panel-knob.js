/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {svg} from 'lit';

/**
 * feezal-element-panel-knob (E56)
 *
 * Rotary knob — drag-to-turn (pointer angle around the centre), scroll
 * wheel and keyboard arrows. min/max/step like a slider, but it *feels*
 * like hardware: 270° throw, tick scale, value arc, metallic cap with an
 * indicator line. Optional detents snap the drag to step multiples.
 *
 * Hand-rolled pointer-angle math instead of wrapping <round-slider> — the
 * throw is a plain arc (no circular wrap-around) and detents/keyboard are
 * first-class here (evaluated per the E56 note).
 *
 * Publishes the numeric value: throttled while dragging (200 ms), always
 * on release / wheel / keys. Editor mode never publishes; canvas drag is
 * unaffected (children get no pointer events in the editor).
 */
class FeezalElementPanelKnob extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Knob', category: 'Panel', color: '#455a64', icon: 'tune'},
            description: 'Rotary knob: drag to turn, scroll wheel and arrow keys. Subscribes to the value and publishes it on change — dimmers, volume, setpoints.',
            attributes: [
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.brightness" to navigate into a JSON payload.'},
                {name: 'publish', type: 'mqttTopic', help: 'Topic the numeric value is published to on change (throttled while dragging).'},
                {name: 'min',     type: 'number', default: 0,   help: 'Minimum value (start of the throw).'},
                {name: 'max',     type: 'number', default: 100, help: 'Maximum value (end of the throw).'},
                {name: 'step',    type: 'number', default: 1,   help: 'Value granularity for wheel/keyboard — and for the drag when detents is on.'},
                {name: 'detents', type: 'boolean', default: false, help: 'Snap the drag to step multiples (indexed feel instead of continuous).'},
                {name: 'start-angle', type: 'number', default: -135,
                    help: 'Knob angle of the minimum value, in degrees — 0 = 12 o\'clock, clockwise positive. Default -135 (lower left).'},
                {name: 'sweep-angle', type: 'number', default: 270, min: 10, max: 360,
                    help: 'Angular size of the throw in degrees; the maximum sits at start-angle + sweep-angle. Default 270.'},
                {name: 'ticks', type: 'number', default: 10, min: 0,
                    help: 'Number of scale intervals around the knob (0 = no ticks).'},
                {name: 'label',   type: 'string', help: 'Engraved label under the knob.'},
                {name: 'unit',    type: 'string', help: 'Unit shown next to the value readout.'},
                {name: 'digits',  type: 'number', default: 0, help: 'Decimal places of the value readout.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-panel-knob-color', type: 'color',
                    default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))',
                    help: 'Value arc + indicator colour.'},
                {property: '--feezal-panel-bezel', type: 'color', default: '#3c454d', help: 'Bezel/ring colour (shared across panel-* elements).'},
                {property: '--feezal-panel-text', type: 'color', default: '#aeb7bd', help: 'Scale/label colour (shared across panel-* elements).'},
            ],
            restrict: {minWidth: 60, minHeight: 60},
            defaultStyle: {width: '120px', height: '140px'},
            discovery: {
                component: 'number',
                map: {
                    state_topic:         'subscribe',
                    command_topic:       'publish',
                    min:                 'min',
                    max:                 'max',
                    step:                'step',
                    name:                'label',
                    unit_of_measurement: 'unit',
                    value_template:      {attr: 'message-property', transform: 'valueTemplateToPath'},
                },
            },
        };
    }

    static properties = {
        publish: {type: String,  reflect: true},
        min:     {type: Number,  reflect: true},
        max:     {type: Number,  reflect: true},
        step:    {type: Number,  reflect: true},
        detents: {type: Boolean, reflect: true},
        startAngle: {type: Number, reflect: true, attribute: 'start-angle'},
        sweepAngle: {type: Number, reflect: true, attribute: 'sweep-angle'},
        ticks:      {type: Number, reflect: true},
        label:   {type: String,  reflect: true},
        unit:    {type: String,  reflect: true},
        digits:  {type: Number,  reflect: true},
        _value:  {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 2px; box-sizing: border-box; overflow: hidden;
            --feezal-panel-knob-color: var(--primary-color, var(--sl-color-primary-600, #0284c7));
        }
        svg { flex: 1; min-height: 0; width: 100%; touch-action: none; user-select: none; -webkit-tap-highlight-color: transparent; }
        .cap { cursor: grab; }
        .cap.dragging { cursor: grabbing; }
        :host(:focus-visible) { outline: 2px solid var(--feezal-panel-knob-color); outline-offset: 2px; }
        .label {
            flex: 0 0 auto; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
            color: var(--feezal-panel-text, #aeb7bd);
            max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
    `];

    // Throw geometry: start-angle/sweep-angle attributes (0° = 12 o'clock,
    // clockwise); defaults give the classic 270° throw (-135° … +135°).
    static _CX = 50;
    static _CY = 50;

    _throw() {
        return {start: Number(this.startAngle) || 0, sweep: Number(this.sweepAngle) || 270};
    }

    constructor() {
        super();
        this.publish = '';
        this.min = 0;
        this.max = 100;
        this.step = 1;
        this.detents = false;
        this.startAngle = -135;
        this.sweepAngle = 270;
        this.ticks = 10;
        this.label = '';
        this.unit = '';
        this.digits = 0;
        this._value = null;
        this.__dragging = false;
        this.__pubTimer = null;
        this.__pubPending = null;
        this.__onMove = e => this._dragMove(e);
        this.__onUp = e => this._dragEnd(e);
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                if (this.__dragging) return;   // hardware rule: the hand wins
                const v = Number(this.getProperty(msg, this.messageProperty));
                if (!isNaN(v)) this._value = this._clamp(v);
            });
        }
        this.addEventListener('wheel', this.__onWheel = e => this._wheel(e), {passive: false});
        this.addEventListener('keydown', this.__onKey = e => this._keydown(e));
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('wheel', this.__onWheel);
        this.removeEventListener('keydown', this.__onKey);
        window.removeEventListener('pointermove', this.__onMove);
        window.removeEventListener('pointerup', this.__onUp);
        clearTimeout(this.__pubTimer);
    }

    // ── Value helpers ─────────────────────────────────────────────────────────

    _clamp(v) {
        return Math.min(this.max, Math.max(this.min, v));
    }

    _snap(v) {
        const step = Number(this.step) || 1;
        return this._clamp(Math.round((v - this.min) / step) * step + this.min);
    }

    _displayValue() {
        // Unconfigured hint on the editor canvas: park at 35 %.
        return this._value ?? (feezal.isEditor && !this.subscribe
            ? this.min + (this.max - this.min) * 0.35 : this.min);
    }

    _valueToAngle(v) {
        const {start, sweep} = this._throw();
        const span = this.max - this.min || 1;
        return start + Math.min(1, Math.max(0, (v - this.min) / span)) * sweep;
    }

    // ── Interaction ───────────────────────────────────────────────────────────

    _dragStart(e) {
        if (feezal.isEditor) return;
        e.preventDefault();
        this.__dragging = true;
        this.renderRoot.querySelector('.cap')?.classList.add('dragging');
        window.addEventListener('pointermove', this.__onMove);
        window.addEventListener('pointerup', this.__onUp);
        this._dragMove(e);
    }

    _dragMove(e) {
        if (!this.__dragging) return;
        const rect = this.renderRoot.querySelector('svg').getBoundingClientRect();
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);
        // Pointer angle, 0° = 12 o'clock, clockwise positive — normalised
        // into the configured throw (wrapped so e.g. a 200° start works).
        let angle = Math.atan2(dx, -dy) * 180 / Math.PI;
        const {start, sweep} = this._throw();
        while (angle < start) angle += 360;
        while (angle > start + 360) angle -= 360;
        // Outside the throw: snap to the nearer end.
        if (angle > start + sweep) {
            angle = angle - (start + sweep) < (start + 360 - angle) ? start + sweep : start;
        }
        let v = this.min + ((angle - start) / sweep) * (this.max - this.min);
        if (this.detents) v = this._snap(v);
        if (v !== this._value) {
            this._value = v;
            this._publishThrottled(v);
        }
    }

    _dragEnd() {
        if (!this.__dragging) return;
        this.__dragging = false;
        this.renderRoot.querySelector('.cap')?.classList.remove('dragging');
        window.removeEventListener('pointermove', this.__onMove);
        window.removeEventListener('pointerup', this.__onUp);
        // Non-detent drags publish the exact value; detents already snapped.
        this._publishNow(this._value);
    }

    _wheel(e) {
        if (feezal.isEditor) return;
        e.preventDefault();
        const direction = e.deltaY < 0 ? 1 : -1;
        const v = this._snap(this._displayValue() + direction * (Number(this.step) || 1));
        if (v !== this._value) {
            this._value = v;
            this._publishNow(v);
        }
    }

    _keydown(e) {
        if (feezal.isEditor) return;
        const step = Number(this.step) || 1;
        let delta = 0;
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') delta = step;
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') delta = -step;
        else if (e.key === 'Home') { delta = this.min - this._displayValue(); }
        else if (e.key === 'End') { delta = this.max - this._displayValue(); }
        else return;
        e.preventDefault();
        const v = this._snap(this._displayValue() + delta);
        if (v !== this._value) {
            this._value = v;
            this._publishNow(v);
        }
    }

    _publishThrottled(v) {
        this.__pubPending = v;
        if (this.__pubTimer) return;
        this.__pubTimer = setTimeout(() => {
            this.__pubTimer = null;
            this._publishNow(this.__pubPending);
        }, 200);
    }

    _publishNow(v) {
        clearTimeout(this.__pubTimer);
        this.__pubTimer = null;
        if (feezal.isEditor || !this.publish || v === null) return;
        const rounded = Number(v.toFixed(Math.max(0, this.digits ?? 0)));
        feezal.connection.pub(this.publish, String(rounded));
    }

    // ── Render ────────────────────────────────────────────────────────────────

    _polar(angleDeg, r) {
        const rad = (angleDeg - 90) * Math.PI / 180;
        return {x: FeezalElementPanelKnob._CX + r * Math.cos(rad), y: FeezalElementPanelKnob._CY + r * Math.sin(rad)};
    }

    _arcPath(a0, a1, r) {
        if (a1 - a0 >= 360) a1 = a0 + 359.9;   // full circle degenerates (start == end point)
        const p0 = this._polar(a0, r);
        const p1 = this._polar(a1, r);
        const large = a1 - a0 > 180 ? 1 : 0;
        return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
    }

    render() {
        const {start, sweep} = this._throw();
        const v = this._displayValue();
        const angle = this._valueToAngle(v);
        const ticks = [];
        const tickCount = Math.max(0, Math.round(Number(this.ticks) || 0));
        for (let i = 0; tickCount > 0 && i <= tickCount; i++) {
            const a = start + (i / tickCount) * sweep;
            const p0 = this._polar(a, 45);
            const p1 = this._polar(a, 41);
            ticks.push(svg`<line x1="${p0.x}" y1="${p0.y}" x2="${p1.x}" y2="${p1.y}"
                stroke="var(--feezal-panel-text, #aeb7bd)" stroke-width="1" opacity="0.7"/>`);
        }
        const readout = `${Number(v.toFixed(Math.max(0, this.digits)))}${this.unit ? ' ' + this.unit : ''}`;
        return html`
            <svg viewBox="0 0 100 100" @pointerdown="${this._dragStart}">
                <defs>
                    <radialGradient id="capg" cx="0.35" cy="0.3" r="0.9">
                        <stop offset="0" stop-color="#5c666f"/>
                        <stop offset="0.55" stop-color="#39424a"/>
                        <stop offset="1" stop-color="#23292f"/>
                    </radialGradient>
                </defs>
                ${ticks}
                <!-- throw track + value arc -->
                <path d="${this._arcPath(start, start + sweep, 37)}" stroke="#171c20" stroke-width="3.5" fill="none" stroke-linecap="round"/>
                ${v > this.min ? svg`
                    <path d="${this._arcPath(start, angle, 37)}" stroke="var(--feezal-panel-knob-color)"
                        stroke-width="3.5" fill="none" stroke-linecap="round"/>` : ''}
                <!-- knob cap -->
                <g class="cap">
                    <circle cx="50" cy="50" r="30" fill="url(#capg)"
                        stroke="var(--feezal-panel-bezel, #3c454d)" stroke-width="2"/>
                    <circle cx="50" cy="50" r="24" fill="none" stroke="#1d2328" stroke-width="1" opacity="0.7"/>
                    <!-- indicator line, rotates with the value -->
                    <g transform="rotate(${angle} 50 50)">
                        <line x1="50" y1="30" x2="50" y2="41" stroke="var(--feezal-panel-knob-color)"
                            stroke-width="3.5" stroke-linecap="round"/>
                    </g>
                    <text x="50" y="54" text-anchor="middle" font-size="10"
                        fill="var(--feezal-panel-text, #aeb7bd)" font-family="ui-monospace, monospace"
                        pointer-events="none">${readout}</text>
                </g>
            </svg>
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-panel-knob', FeezalElementPanelKnob);
export {FeezalElementPanelKnob};

/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {svg} from 'lit';

/**
 * feezal-element-panel-switch (E56, renamed from panel-toggle)
 *
 * A real flip switch — bat-handle lever on a screwed panel plate, with a
 * snap animation. The lever points at the active position. `direction`
 * places the OFF position (down = classic vertical switch, up, or
 * left/right for a horizontal switch); `label-on`/`label-off` engrave the
 * position markers. Optional guard cover (`guard`) for "are you sure"
 * actions: the red cover must be flipped open first; it snaps shut again
 * after a few seconds without a flip.
 *
 * MQTT contract like material-switch: subscribe → state (payload-on/off),
 * click publishes payload-on/payload-off.
 */

// Per-orientation geometry. Lever/cover markup is generated from these, so
// vertical and horizontal switches share one template.
const LAYOUTS = {
    vertical: {
        vb: '0 0 100 120',
        plate: {x: 14, y: 8, w: 72, h: 108},
        screws: [[22, 16], [78, 16], [22, 108], [78, 108]],
        recess: {rx: 12, ry: 22},
        pivot: [50, 62],
        // label anchor per lever angle (0° = up, clockwise)
        ends: {0: {x: 50, y: 30}, 180: {x: 50, y: 104}},
    },
    horizontal: {
        vb: '0 0 120 100',
        plate: {x: 8, y: 14, w: 104, h: 72},
        screws: [[16, 22], [104, 22], [16, 78], [104, 78]],
        recess: {rx: 22, ry: 12},
        pivot: [60, 50],
        ends: {90: {x: 96, y: 53}, '-90': {x: 24, y: 53}},
    },
};

// direction = position of the OFF state → lever angles per state.
const DIRECTIONS = {
    down:  {layout: 'vertical',   on: 0,   off: 180},
    up:    {layout: 'vertical',   on: 180, off: 0},
    left:  {layout: 'horizontal', on: 90,  off: -90},
    right: {layout: 'horizontal', on: -90, off: 90},
};

class FeezalElementPanelSwitch extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Switch', category: 'Panel', color: '#455a64', icon: 'toggle_on'},
            description: 'Skeuomorphic flip switch. Subscribes to the state and publishes payload-on/payload-off on flip. direction places the OFF position (vertical or horizontal switch); the guard attribute adds a safety cover that must be opened first.',
            attributes: [
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'publish',     type: 'mqttTopic', help: 'Topic to publish payload-on / payload-off to on flip.'},
                {name: 'label',       type: 'string', help: 'Engraved label under the switch.'},
                {name: 'direction',   type: 'select', options: ['down', 'up', 'left', 'right'], default: 'down',
                    help: 'Position of the OFF state: down (classic vertical switch, default), up, or left/right for a horizontal switch (give the element a wide box then).'},
                {name: 'label-on',    type: 'string', default: 'ON',  help: 'Engraved marker at the ON position (empty = none).'},
                {name: 'label-off',   type: 'string', default: 'OFF', help: 'Engraved marker at the OFF position (empty = none).'},
                {name: 'payload-on',  type: 'string', default: 'ON',  help: 'Payload published for / matched against the ON state. Default: ON'},
                {name: 'payload-off', type: 'string', default: 'OFF', help: 'Payload published for / matched against the OFF state. Default: OFF'},
                {name: 'guard', type: 'boolean', default: false,
                    help: 'Safety cover over the switch: the first tap opens the cover, only then can the switch be flipped. The cover closes again after 4 s.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-panel-switch-on-color', type: 'color',
                    default: 'var(--success-color, #43a047)',
                    help: 'ON position marker colour.'},
                {property: '--feezal-panel-bezel', type: 'color', default: '#3c454d', help: 'Bezel/plate colour (shared across panel-* elements).'},
                {property: '--feezal-panel-text', type: 'color', default: '#aeb7bd', help: 'Engraved label colour (shared across panel-* elements).'},
            ],
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '72px', height: '96px'},
            discovery: {
                component: 'switch',
                map: {
                    state_topic:    'subscribe',
                    command_topic:  'publish',
                    payload_on:     'payload-on',
                    payload_off:    'payload-off',
                    name:           'label',
                    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
                },
            },
        };
    }

    static properties = {
        publish:    {type: String,  reflect: true},
        label:      {type: String,  reflect: true},
        direction:  {type: String,  reflect: true},
        labelOn:    {type: String,  reflect: true, attribute: 'label-on'},
        labelOff:   {type: String,  reflect: true, attribute: 'label-off'},
        payloadOn:  {type: String,  reflect: true, attribute: 'payload-on'},
        payloadOff: {type: String,  reflect: true, attribute: 'payload-off'},
        guard:      {type: Boolean, reflect: true},
        _on:        {state: true},
        _guardOpen: {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 4px; box-sizing: border-box; overflow: hidden;
            --feezal-panel-switch-on-color: var(--success-color, #43a047);
        }
        svg { flex: 1; min-height: 0; width: 100%; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; }
        /* Lever snap: fast accelerate, small overshoot. transform-box makes
           the px origin (set inline, per orientation) resolve in viewBox units. */
        .lever { transition: transform 0.15s cubic-bezier(0.3, 1.4, 0.6, 1); transform-box: view-box; }
        .cover { transition: transform 0.18s ease; transform-box: view-box; }
        .cover.open { transform: translateY(-40px) scaleY(0.25); }
        .label {
            flex: 0 0 auto; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
            color: var(--feezal-panel-text, #aeb7bd);
            max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
    `];

    constructor() {
        super();
        this.publish = '';
        this.label = '';
        this.direction = 'down';
        this.labelOn = 'ON';
        this.labelOff = 'OFF';
        this.payloadOn = 'ON';
        this.payloadOff = 'OFF';
        this.guard = false;
        this._on = false;
        this._guardOpen = false;
        this.__guardTimer = null;
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                const raw = v === null || v === undefined ? '' : String(v);
                if (raw === this.payloadOn) this._on = true;
                else if (raw === this.payloadOff) this._on = false;
                else this._on = Boolean(this._payloadCast(Boolean, v));
            });
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearTimeout(this.__guardTimer);
    }

    _click() {
        if (feezal.isEditor) return;
        if (this.guard && !this._guardOpen) {
            // First tap only lifts the cover; it snaps shut again unused.
            this._guardOpen = true;
            clearTimeout(this.__guardTimer);
            this.__guardTimer = setTimeout(() => { this._guardOpen = false; }, 4000);
            return;
        }
        clearTimeout(this.__guardTimer);
        this._guardOpen = false;
        this._on = !this._on;
        if (this.publish) {
            feezal.connection.pub(this.publish, this._on ? this.payloadOn : this.payloadOff);
        }
    }

    _endLabel(layout, angle, text, active) {
        if (!text) return '';
        const pos = layout.ends[angle];
        return svg`
            <text x="${pos.x}" y="${pos.y}" text-anchor="middle" font-size="9" letter-spacing="1"
                fill="${active ? 'var(--feezal-panel-switch-on-color)' : 'var(--feezal-panel-text, #aeb7bd)'}"
                opacity="${active ? 1 : 0.7}" font-weight="${active ? 700 : 400}">${text}</text>`;
    }

    render() {
        const on = this._on;
        const dir = DIRECTIONS[this.direction] || DIRECTIONS.down;
        const layout = LAYOUTS[dir.layout];
        const {plate, recess} = layout;
        const [px, py] = layout.pivot;
        const angle = on ? dir.on : dir.off;
        return html`
            <svg viewBox="${layout.vb}" @click="${this._click}">
                <defs>
                    <linearGradient id="plate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stop-color="#4a545d"/>
                        <stop offset="0.5" stop-color="#39424a"/>
                        <stop offset="1" stop-color="#2b3238"/>
                    </linearGradient>
                    <linearGradient id="lever" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stop-color="#f2f4f5"/>
                        <stop offset="0.5" stop-color="#b9c1c7"/>
                        <stop offset="1" stop-color="#7c868e"/>
                    </linearGradient>
                </defs>

                <!-- panel plate with screw heads -->
                <rect x="${plate.x}" y="${plate.y}" width="${plate.w}" height="${plate.h}" rx="8" fill="url(#plate)"
                    stroke="var(--feezal-panel-bezel, #3c454d)" stroke-width="2"/>
                ${layout.screws.map(([x, y]) => svg`
                    <g>
                        <circle cx="${x}" cy="${y}" r="3.4" fill="#20262b"/>
                        <line x1="${x - 2.2}" y1="${y}" x2="${x + 2.2}" y2="${y}"
                            stroke="#5a646d" stroke-width="1" transform="rotate(${(x + y) * 7 % 180} ${x} ${y})"/>
                    </g>`)}

                <!-- position markers: label-on at the ON end, label-off at the OFF end -->
                ${this._endLabel(layout, dir.on, this.labelOn, on)}
                ${this._endLabel(layout, dir.off, this.labelOff, !on)}

                <!-- throw recess -->
                <ellipse cx="${px}" cy="${py}" rx="${recess.rx}" ry="${recess.ry}" fill="#171c20"/>
                <ellipse cx="${px}" cy="${py}" rx="${recess.rx}" ry="${recess.ry}" fill="none" stroke="#0d1114" stroke-width="1.5"/>

                <!-- bat-handle lever: drawn pointing up, rotated to the active
                     position. The shaft is a rect, NOT a <line>: a vertical
                     line has a zero-width bbox and objectBoundingBox gradients
                     render nothing on it (invisible lever). -->
                <g class="lever" style="transform-origin: ${px}px ${py}px; transform: rotate(${angle}deg)">
                    <rect x="${px - 4.5}" y="${py - 38}" width="9" height="42" rx="4.5" fill="url(#lever)"/>
                    <circle cx="${px}" cy="${py - 33}" r="8" fill="url(#lever)"/>
                    <circle cx="${px - 2.5}" cy="${py - 35.5}" r="2.4" fill="rgba(255,255,255,0.55)"/>
                </g>
                <circle cx="${px}" cy="${py}" r="6.5" fill="#20262b" stroke="#0d1114"/>

                <!-- guard cover -->
                ${this.guard ? svg`
                    <g class="cover ${this._guardOpen ? 'open' : ''}"
                        style="transform-origin: ${px}px ${plate.y + 6}px">
                        <rect x="${plate.x + 6}" y="${plate.y + 6}" width="${plate.w - 12}" height="${plate.h - 12}" rx="7"
                            fill="rgba(198, 40, 40, ${this._guardOpen ? 0.25 : 0.55})"
                            stroke="#8e1f1f" stroke-width="2"/>
                        <line x1="${plate.x + 14}" y1="${plate.y + 16}" x2="${plate.x + plate.w - 14}" y2="${plate.y + 16}"
                            stroke="#8e1f1f" stroke-width="2"/>
                        ${this._guardOpen ? '' : svg`
                            <text x="${px}" y="${py + 4}" text-anchor="middle" font-size="8" letter-spacing="1"
                                fill="#ffd7d7">GUARD</text>`}
                    </g>` : ''}
            </svg>
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-panel-switch', FeezalElementPanelSwitch);
export {FeezalElementPanelSwitch};

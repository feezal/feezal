/* global feezal */
import {FeezalElement, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-basic-ticker — horizontally scrolling text line (E73).
 *
 * Wall-display staple: announcements, active alarms, news, event feeds.
 * Content modes:
 *   - static `text` attribute
 *   - single topic: the subscribe payload replaces the text (baseAttribute)
 *   - multi-message: a JSON-array payload; each entry renders through
 *     `template` ({payload}, {topic}, {json:path} tokens), joined by
 *     `separator`
 *
 * The track holds the content twice and animates transform 0 → -50% for a
 * seamless wrap (GPU-friendly). Scroll pace is px/s, so it is independent of
 * content length. The animation suspends while the tab is hidden or the
 * element is offscreen (cheap on weak wall-tablet GPUs), and in the editor
 * the ticker renders static.
 */
class FeezalElementBasicTicker extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                category: 'Basic',
                name: 'Ticker',
                color: '#4a6080'
            },
            description: 'Horizontally scrolling text line for wall displays. The subscribe payload replaces the text; a JSON-array payload renders each entry through the template ({payload}, {topic}, {json:path}) joined by the separator.',
            baseAttribute: 'text',
            attributes: [
                'subscribe',
                'messageProperty',
                {name: 'text', help: 'Static content — replaced by the subscribe payload at runtime.'},
                {name: 'template', help: 'Per-item format in array mode. Tokens: {payload}, {topic}, {json:path}.'},
                {name: 'separator', help: 'Joiner between items in array mode (and around the seamless wrap).'},
                {name: 'speed', type: 'number', help: 'Scroll speed in pixels per second.'},
                {name: 'direction', dropdown: ['left', 'right'], help: 'Scroll direction.'},
                {name: 'pauseOnHover', dropdown: ['true', 'false'], label: 'Pause on hover'}
            ],
            styles: [
                'top', 'left', 'width', 'height',
                'font', 'font-size', 'color', 'background'
            ],
            restrict: {minWidth: 60, minHeight: 16},
            defaultStyle: {width: '400px', height: '40px'}
        };
    }

    static properties = {
        // text is user config AND the base attribute — a subscribe payload
        // overwrites it via setAttribute at runtime (viewer only).
        text:         {type: String, reflect: true},
        template:     {type: String, reflect: true},
        separator:    {type: String, reflect: true},
        speed:        {type: Number, reflect: true},
        direction:    {type: String, reflect: true},
        // String-typed so pause-on-hover="false" disables it (a bare Boolean
        // attribute cannot express a default-on option).
        pauseOnHover: {type: String, reflect: true, attribute: 'pause-on-hover'},
        _suspended:   {state: true}
    };

    static styles = [FeezalElement.styles, css`
        :host {
            width: 400px;
            height: 40px;
            display: flex;
            align-items: center;
            color: var(--primary-text-color, #333);
        }
        .viewport {
            width: 100%;
            overflow: hidden;
        }
        .track {
            display: inline-flex;
            white-space: nowrap;
            will-change: transform;
            animation: feezal-ticker-scroll var(--feezal-ticker-duration, 20s) linear infinite;
        }
        .track.reverse { animation-direction: reverse; }
        .track.suspended { animation-play-state: paused; }
        .track.static { animation: none; }
        .viewport.hoverpause:hover .track { animation-play-state: paused; }
        @keyframes feezal-ticker-scroll {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
        }
        .editor-ph {
            opacity: 0.5;
            font-style: italic;
            white-space: nowrap;
            overflow: hidden;
        }
    `];

    constructor() {
        super();
        this.text = '';
        this.template = '{payload}';
        this.separator = ' • ';
        this.speed = 60;
        this.direction = 'left';
        this.pauseOnHover = 'true';
        this._suspended = false;
    }

    connectedCallback() {
        super.connectedCallback();
        if (!feezal.isEditor) {
            this._onVisibility = () => {
                this._suspended = document.hidden || this._offscreen === true;
            };
            document.addEventListener('visibilitychange', this._onVisibility);
            if (typeof IntersectionObserver !== 'undefined') {
                this._io = new IntersectionObserver(entries => {
                    this._offscreen = !entries.some(e => e.isIntersecting);
                    this._onVisibility();
                });
                this._io.observe(this);
            }
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._onVisibility) {
            document.removeEventListener('visibilitychange', this._onVisibility);
            this._onVisibility = null;
        }
        this._io?.disconnect();
        this._io = null;
        this._ro?.disconnect();
        this._ro = null;
    }

    /** Content items: JSON array → templated entries; anything else → one item. */
    _items() {
        const raw = this.text;
        if (raw == null || raw === '') {
            return [];
        }
        if (typeof raw === 'string' && raw.trim().startsWith('[')) {
            try {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) {
                    return arr.map(entry => this._renderTemplate(entry));
                }
            } catch { /* not JSON — fall through to single-item mode */ }
        }
        return [String(raw)];
    }

    /** Apply the {payload} / {topic} / {json:path} tokens to one array entry. */
    _renderTemplate(entry) {
        const payload = typeof entry === 'object' && entry !== null ? JSON.stringify(entry) : String(entry);
        return String(this.template || '{payload}')
            .replace(/\{json:([^}]+)\}/g, (_, path) => {
                let obj = entry;
                if (typeof obj === 'string') {
                    try { obj = JSON.parse(obj); } catch { return ''; }
                }
                const value = obj && typeof obj === 'object' ? this.getProperty(obj, path.trim()) : undefined;
                if (value === undefined || value === null) {
                    return '';
                }
                return typeof value === 'object' ? JSON.stringify(value) : String(value);
            })
            .replace(/\{topic\}/g, this.subscribe || '')
            .replace(/\{payload\}/g, payload);
    }

    /** One run of content — ends with the separator so the wrap is seamless. */
    _run() {
        const items = this._items();
        return items.length ? items.join(this.separator) + this.separator : '';
    }

    render() {
        const run = this._run();
        if (!run) {
            return feezal.isEditor
                ? html`<div class="editor-ph">Ticker — set text or subscribe</div>`
                : html``;
        }
        const trackClasses = [
            'track',
            this.direction === 'right' ? 'reverse' : '',
            this._suspended ? 'suspended' : '',
            feezal.isEditor ? 'static' : ''
        ].filter(Boolean).join(' ');
        return html`
            <div class="viewport ${this.pauseOnHover !== 'false' ? 'hoverpause' : ''}">
                <div class="${trackClasses}">
                    <span class="run">${run}</span><span class="run" aria-hidden="true">${run}</span>
                </div>
            </div>
        `;
    }

    updated(changed) {
        super.updated(changed);
        if (changed.has('text') || changed.has('template') || changed.has('separator') ||
                changed.has('speed') || changed.has('direction')) {
            this._measure();
        }
    }

    /** Duration = run width / speed (px/s) — re-measured when the run resizes. */
    _measure() {
        const run = this.renderRoot.querySelector('.run');
        if (!run) {
            return;
        }
        if (!this._ro && typeof ResizeObserver !== 'undefined') {
            this._ro = new ResizeObserver(() => this._applyDuration());
        }
        this._ro?.disconnect();
        this._ro?.observe(run);
        this._applyDuration();
    }

    _applyDuration() {
        const run = this.renderRoot.querySelector('.run');
        const track = this.renderRoot.querySelector('.track');
        if (!run || !track) {
            return;
        }
        // offsetWidth is 0 in non-layout environments — estimate from length.
        const width = run.offsetWidth || this._run().length * 8;
        const duration = Math.max(1, Math.round(width / (this.speed || 60)));
        // Imperative (not reactive state): updating a CSS var must not
        // schedule another render cycle.
        track.style.setProperty('--feezal-ticker-duration', `${duration}s`);
    }
}

window.customElements.define('feezal-element-basic-ticker', FeezalElementBasicTicker);

export {FeezalElementBasicTicker};

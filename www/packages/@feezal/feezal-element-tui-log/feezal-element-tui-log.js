/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-tui-log (E59)
 *
 * Scrolling console feed: every message on the subscribed topic (wildcards
 * allowed) appends a `HH:MM:SS payload` line; the buffer keeps the last
 * `max-lines` entries and auto-scrolls to the newest. E32's logbook in
 * terminal clothes.
 */
class FeezalElementTuiLog extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Log', category: 'TUI', color: '#1e6b2f', icon: 'receipt_long'},
            description: 'Scrolling console feed of messages from the subscribed topic (wildcards allowed): timestamped lines, newest at the bottom.',
            attributes: [
                {name: 'subscribe', type: 'mqttTopic',
                    help: 'Topic to log — MQTT wildcards (+, #) are allowed to feed the log from many topics.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload.'},
                {name: 'max-lines',  type: 'number', default: 50, min: 1, max: 500, help: 'Buffer size — oldest lines fall out.'},
                {name: 'timestamps', type: 'boolean', default: true, help: 'Prefix each line with HH:MM:SS.'},
                {name: 'show-topic', type: 'boolean', default: false, help: 'Prefix each line with the topic it arrived on (useful with wildcards).'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'font-size',
                {property: '--feezal-tui-color', type: 'color', default: '#33ff66', help: 'Phosphor colour (shared across tui-* elements).'},
                {property: '--feezal-tui-bg', type: 'color', default: 'transparent', help: 'Background (shared across tui-* elements).'},
                {property: '--feezal-tui-glow', default: '5px', help: 'Phosphor glow radius; 0 disables (shared across tui-* elements).'},
            ],
            restrict: {minWidth: 80, minHeight: 40},
            defaultStyle: {width: '320px', height: '160px'},
        };
    }

    static properties = {
        maxLines:   {type: Number,  reflect: true, attribute: 'max-lines'},
        timestamps: {type: Boolean, reflect: true, converter: feezalBoolean},
        showTopic:  {type: Boolean, reflect: true, attribute: 'show-topic'},
        _lines:     {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: block; box-sizing: border-box; overflow: hidden;
            font-family: var(--feezal-tui-font, ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace);
            color: var(--feezal-tui-color, #33ff66);
            background: var(--feezal-tui-bg, transparent);
            text-shadow: 0 0 var(--feezal-tui-glow, 5px) color-mix(in srgb, var(--feezal-tui-color, #33ff66) 60%, transparent);
            font-size: 13px; line-height: 1.35;
        }
        .scroll { height: 100%; overflow-y: auto; overflow-x: hidden; padding: 2px 0.5ch; box-sizing: border-box; }
        .line { white-space: pre-wrap; word-break: break-all; }
        .meta { opacity: 0.55; }
        .hint { opacity: 0.5; }
    `];

    constructor() {
        super();
        this.maxLines = 50;
        this.timestamps = true;
        this.showTopic = false;
        this._lines = [];
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                const text = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
                const now = new Date();
                const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
                    .map(x => String(x).padStart(2, '0')).join(':');
                const n = Math.max(1, Math.min(500, Number(this.maxLines) || 50));
                this._lines = [...this._lines, {time, topic: msg.topic, text}].slice(-n);
            });
        }
    }

    updated(changed) {
        super.updated(changed);
        // Follow the newest line.
        if (changed.has('_lines')) {
            const scroll = this.renderRoot.querySelector('.scroll');
            if (scroll) scroll.scrollTop = scroll.scrollHeight;
        }
    }

    render() {
        return html`
            <div class="scroll">
                ${this._lines.length === 0 && feezal.isEditor
                    ? html`<div class="hint">${this.subscribe ? `logging ${this.subscribe}…` : 'set a subscribe topic'}</div>` : ''}
                ${this._lines.map(line => html`
                    <div class="line">${this.timestamps ? html`<span class="meta">${line.time} </span>` : ''}${
                        this.showTopic ? html`<span class="meta">${line.topic} </span>` : ''}${line.text}</div>`)}
            </div>`;
    }
}

customElements.define('feezal-element-tui-log', FeezalElementTuiLog);
export {FeezalElementTuiLog};

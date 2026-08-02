/* global feezal */
import {LitElement, html, css} from 'lit';
import {repeat} from 'lit/directives/repeat.js';

/**
 * U88 — per-element MQTT debug panel.
 *
 * "Why is this card empty?" used to mean opening devtools, enabling the MQTT
 * trace and reading the console. This shows the selected element's actual
 * wiring instead: every topic it subscribes to (read from the base class's
 * `_subscriptions`, so it reflects what the element REALLY wired, not what the
 * attributes suggest), the last payload per topic with a timestamp and a
 * message count, plus the topics it publishes to and a tail of outgoing
 * traffic (observed via the connection's `feezal-publish` event — publishes
 * never come back through the subscription path).
 *
 * The panel opens its OWN subscriptions so it works even when the editor's
 * "prevent MQTT element manipulation" setting keeps the element itself
 * unsubscribed — which is exactly the situation where a card looks dead and
 * the user wants to know whether data is arriving at all.
 *
 * Complements U38 (topic browser = broker-wide); this is element-scoped.
 */

const MAX_TAIL = 20;

/** Compact time for the tail rows (HH:MM:SS). */
const clock = ts => new Date(ts).toTimeString().slice(0, 8);

/** Render any payload as a short, readable one-liner. */
export function previewPayload(payload, max = 220) {
    let text;
    if (payload === null || payload === undefined) text = String(payload);
    else if (typeof payload === 'object') {
        try { text = JSON.stringify(payload); } catch { text = String(payload); }
    } else text = String(payload);
    if (text.startsWith('data:')) text = text.slice(0, text.indexOf(',') + 1) + '…(binary)';
    return text.length > max ? text.slice(0, max) + '…' : text;
}

/** The publish-ish topics an element declares (attributes, not runtime). */
export function publishTopics(el) {
    if (!el?.getAttributeNames) return [];
    return el.getAttributeNames()
        .filter(n => n === 'publish' || n.startsWith('publish-'))
        .map(n => ({attr: n, topic: el.getAttribute(n)}))
        .filter(p => p.topic);
}

class FeezalSidebarDebug extends LitElement {
    static properties = {
        selectedElems: {type: Array},
        _tail: {state: true},
        _seen: {state: true},
        _testPayload: {state: true},
    };

    static styles = css`
        :host { display: block; font-size: 12.5px; }
        .empty { padding: 18px 10px; opacity: 0.6; text-align: center; line-height: 1.5; }
        h4 {
            margin: 0; padding: 9px 10px 5px; font-size: 11px; font-weight: 700;
            text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6;
        }
        .row {
            display: flex; align-items: baseline; gap: 8px; padding: 4px 10px;
            border-top: 1px solid var(--feezal-border, rgba(127, 127, 127, 0.22));
        }
        .topic {
            flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            font-family: ui-monospace, Consolas, monospace; font-size: 11.5px;
        }
        .count { flex: 0 0 auto; opacity: 0.5; font-size: 11px; font-variant-numeric: tabular-nums; }
        .value {
            padding: 0 10px 5px; margin: 0;
            font-family: ui-monospace, Consolas, monospace; font-size: 11px; line-height: 1.45;
            white-space: pre-wrap; word-break: break-all; opacity: 0.85;
        }
        .value.waiting { opacity: 0.45; font-style: italic; font-family: inherit; }
        .when { flex: 0 0 auto; opacity: 0.5; font-size: 10.5px; font-variant-numeric: tabular-nums; }
        .tail { max-height: 34vh; overflow-y: auto; }
        .tail .row { gap: 6px; }
        .tail .dir { flex: 0 0 auto; font-weight: 700; opacity: 0.6; }
        .tail .dir.out { color: var(--sl-color-primary-600, #0284c7); }
        .test { display: flex; gap: 6px; padding: 7px 10px 10px; }
        .test input {
            flex: 1; min-width: 0; font: inherit; font-size: 12px; padding: 4px 7px;
            border-radius: 4px;
            border: 1px solid var(--feezal-border, #ccc);
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #222);
        }
        .test button {
            font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
            padding: 4px 11px; border-radius: 4px;
            border: 1px solid var(--feezal-border, #ccc);
            background: transparent; color: inherit;
        }
        .test button:hover:not(:disabled) {
            background: var(--feezal-btn-hover, rgba(127, 127, 127, 0.14));
        }
        .test button:disabled { opacity: 0.4; cursor: default; }
        .note { padding: 4px 10px 10px; font-size: 11px; opacity: 0.55; line-height: 1.4; }
    `;

    constructor() {
        super();
        this.selectedElems = [];
        this._tail = [];
        this._seen = new Map();     // topic → {payload, ts, count}
        this._testPayload = '';
        this._subs = [];
        this._onPublish = e => this._recordPublish(e.detail);
    }

    connectedCallback() {
        super.connectedCallback();
        feezal?.connection?.addEventListener?.('feezal-publish', this._onPublish);
        this._wire();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        feezal?.connection?.removeEventListener?.('feezal-publish', this._onPublish);
        this._unwire();
    }

    /**
     * A new selection means a new conversation: drop the previous element's
     * tail and re-subscribe. This runs in `willUpdate`, not `updated`, so the
     * cleared state is part of THIS render — clearing in `updated` would leave
     * the previous element's rows on screen for one extra frame.
     */
    willUpdate(changed) {
        if (changed.has('selectedElems')) {
            this._tail = [];
            this._seen = new Map();
            this._wire();
        }
    }

    /**
     * The single selection this panel reports on.
     *
     * U95: a view counts now. It was excluded because a view wired nothing;
     * with `subscribe-theme` and view-level conditions it keeps the same
     * `_subscriptions` registry an element's base class does, so the panel
     * needs no other change.
     */
    get _element() {
        const sel = this.selectedElems || [];
        return sel.length === 1 ? sel[0] : null;
    }

    /** Topics the selection ACTUALLY wired (registry, not attributes), deduped. */
    get _topics() {
        const el = this._element;
        if (!el?._subscriptions) return [];
        return [...new Set(el._subscriptions.map(s => s?.topic).filter(Boolean))];
    }

    _unwire() {
        for (const s of this._subs) feezal?.connection?.unsubscribe?.(s);
        this._subs = [];
    }

    /** Subscribe to the selected element's topics with our own callbacks. */
    _wire() {
        this._unwire();
        const topics = this._topics;
        if (!topics.length || !feezal?.connection?.sub) return;
        for (const topic of topics) {
            const sub = feezal.connection.sub(topic, msg => this._record(msg.topic || topic, msg.payload, 'in'));
            if (sub) this._subs.push(sub);
        }
    }

    _record(topic, payload, direction) {
        const ts = Date.now();
        const prev = this._seen.get(topic);
        this._seen = new Map(this._seen).set(topic, {payload, ts, count: (prev?.count || 0) + 1});
        this._tail = [{topic, payload, ts, direction, id: `${ts}-${this._tail.length}`},
            ...this._tail].slice(0, MAX_TAIL);
    }

    _recordPublish({topic, payload}) {
        // Only the selected element's own publish targets are interesting here.
        if (!publishTopics(this._element).some(p => p.topic === topic)) return;
        this._record(topic, payload, 'out');
    }

    _publishTest(topic) {
        feezal.connection.pub(topic, this._testPayload);
        feezal.app?.toast?.(`Published to ${topic}`, {variant: 'info'});
    }

    render() {
        const el = this._element;
        if (!el) {
            return html`<div class="empty">Select a single element or view to see its live MQTT wiring.</div>`;
        }
        const topics = this._topics;
        const outs = publishTopics(el);

        return html`
            <h4>Subscribes (${topics.length})</h4>
            ${topics.length ? topics.map(topic => {
                const seen = this._seen.get(topic);
                return html`
                    <div class="row">
                        <span class="topic" title="${topic}">${topic}</span>
                        ${seen ? html`<span class="count">${seen.count}×</span>
                            <span class="when">${clock(seen.ts)}</span>` : ''}
                    </div>
                    <div class="value ${seen ? '' : 'waiting'}">${
                        seen ? previewPayload(seen.payload) : 'waiting for a message…'}</div>`;
            }) : html`<div class="note">${el.tagName === 'FEEZAL-VIEW'
                ? html`This view subscribes to nothing — set Subscribe theme, or add a
                    condition, in the Attributes/Conditions tab.`
                : html`This element subscribes to nothing —
                    set a topic in the Attributes tab.`}</div>`}

            <h4>Publishes (${outs.length})</h4>
            ${outs.length ? outs.map(p => html`
                <div class="row">
                    <span class="topic" title="${p.topic}">${p.topic}</span>
                    <span class="count">${p.attr}</span>
                </div>
                <div class="test">
                    <input type="text" placeholder="test payload"
                        .value="${this._testPayload}"
                        @input="${e => { this._testPayload = e.target.value; }}"
                        @keydown="${e => { if (e.key === 'Enter') this._publishTest(p.topic); }}">
                    <button ?disabled="${!feezal.connection?.connected}"
                        @click="${() => this._publishTest(p.topic)}">Publish</button>
                </div>`)
                : html`<div class="note">This ${el.tagName === 'FEEZAL-VIEW' ? 'view' : 'element'} publishes nothing.</div>`}

            <h4>Live tail</h4>
            ${this._tail.length ? html`
                <div class="tail">
                    ${repeat(this._tail, t => t.id, t => html`
                        <div class="row">
                            <span class="when">${clock(t.ts)}</span>
                            <span class="dir ${t.direction === 'out' ? 'out' : ''}"
                                title="${t.direction === 'out' ? 'published' : 'received'}"
                                >${t.direction === 'out' ? '↑' : '↓'}</span>
                            <span class="topic" title="${t.topic}">${t.topic}</span>
                        </div>
                        <div class="value">${previewPayload(t.payload, 120)}</div>`)}
                </div>`
                : html`<div class="note">Nothing yet. Messages appear here as they arrive
                    (and when this element publishes).</div>`}
        `;
    }
}

window.customElements.define('feezal-sidebar-debug', FeezalSidebarDebug);
export {FeezalSidebarDebug};

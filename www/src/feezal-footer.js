import {LitElement, html, css} from 'lit';

import {isCanvasElement} from './feezal-canvas-geometry.js';   // A37

/**
 * U97 — the editor's status line.
 *
 * A slim always-visible row at the bottom of the shell, the classic IDE
 * footer: what is selected, and how big the thing you are editing is. Every
 * segment is a cheap read of state that already exists — the footer owns no
 * model of its own, which is what keeps it from drifting out of step with the
 * canvas.
 *
 * It is a LAYOUT ROW, not an overlay: the editor shell shortens the canvas
 * container by exactly this height. An overlay would cover the bottom edge of
 * the canvas, which is where elements get dragged to.
 *
 * Where the numbers come from, and why not from a notification:
 * elements are added by the palette, the clipboard, the generate wizard, the
 * AI assistant and the source editor; selection is written as a class by the
 * canvas. Observing the site DOM is one subscription that covers all of them,
 * the same reasoning (and the same retry-until-the-site-exists shape) as the
 * Layers panel.
 */

/** Serialized-size estimate, in the units a person reads. */
function formatBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** English-ish plural for the counts, so "1 views" never ships. */
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

class FeezalFooter extends LitElement {
    static properties = {
        // Bumped by the site observer; every segment is derived at render time.
        _revision: {state: true},
        // Structure-only revision: the size estimate walks the whole site, so it
        // must not be recomputed on every class change during a drag.
        _structure: {state: true},
        /**
         * `{cls, label}` from the shell's `_mqttDot()` — the broker state, fed
         * in rather than derived here. That mapping (deploying → connecting, no
         * uri → unknown, connected → ok, else err) is U93's, it is unit-tested
         * against that method, and two copies of it would drift the first time
         * a state is added.
         */
        mqtt: {type: Object},
    };

    static styles = css`
        :host {
            display: flex; align-items: center; gap: 0;
            height: 22px; box-sizing: border-box;
            padding: 0 8px;
            font-size: 11px; line-height: 1;
            background: var(--feezal-bg-sub, #f5f5f5);
            color: var(--feezal-color, #333);
            border-top: 1px solid var(--feezal-border, #e4e4e7);
            user-select: none; white-space: nowrap; overflow: hidden;
        }
        .seg {
            display: flex; align-items: center; gap: 4px;
            padding: 0 8px;
            overflow: hidden; text-overflow: ellipsis;
        }
        /* Separators between segments rather than around them, so the row has
           no leading/trailing rule. */
        .seg + .seg { border-left: 1px solid var(--feezal-border, #e4e4e7); }
        .spacer { flex: 1 1 auto; min-width: 0; }
        .muted { opacity: 0.65; }
        .selection { min-width: 0; }
        .selection .what { font-weight: 600; }
        /* The broker state, in the segment that counts its topics — a number of
           subscriptions means something quite different depending on whether
           the connection behind them is up. Same four states and the same
           colours as the U93 badge on the Site Settings tab, because they read
           the same source; a second palette for one dot would be a lie waiting
           to happen. */
        .mqtt-dot {
            width: 7px; height: 7px; border-radius: 50%;
            background: #9ca3af; flex: 0 0 auto;
            transition: background 0.2s;
        }
        .mqtt-dot.ok  { background: #2e9d4f; }
        .mqtt-dot.err { background: #d64545; }
        .mqtt-dot.connecting { background: #eab308; animation: mqtt-pulse 1s ease-in-out infinite; }
        @keyframes mqtt-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        .material-icons {
            font-family: 'Material Icons';
            font-weight: normal; font-style: normal;
            font-size: 13px; line-height: 1; letter-spacing: normal; text-transform: none;
            display: inline-block; white-space: nowrap; word-wrap: normal; direction: ltr;
            -webkit-font-feature-settings: 'liga'; font-feature-settings: 'liga';
            -webkit-font-smoothing: antialiased;
            opacity: 0.6;
        }
    `;

    constructor() {
        super();
        this._revision = 0;
        this._structure = 0;
        this._observer = typeof MutationObserver === 'undefined' ? null
            : new MutationObserver(records => {
                this._revision++;
                // Only a structural change can move the counts or the size.
                if (records.some(r => r.type === 'childList')) this._structure++;
            });
    }

    connectedCallback() {
        super.connectedCallback();
        this._observe();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._observer?.disconnect();
        clearTimeout(this._siteWaitTimer);
    }

    updated() {
        // The site element is replaced when the editor switches sites.
        if (this._observed !== feezal?.site) this._observe();
    }

    /**
     * Attach to the site, retrying while it does not exist yet — the shell
     * renders its chrome before the site markup arrives over the socket, so a
     * one-shot attach leaves the footer permanently empty.
     */
    _observe() {
        this._observer?.disconnect();
        clearTimeout(this._siteWaitTimer);
        this._observed = feezal?.site || null;
        if (this._observed) {
            this._observer?.observe(this._observed, {
                childList: true, subtree: true, attributes: true,
                // `class` carries the canvas selection; label/name are what the
                // selection echo prints.
                attributeFilter: ['class', 'label', 'name'],
            });
            this._revision++;
            this._structure++;
            return;
        }
        this._siteWaitTimer = setTimeout(() => this._observe(), 250);
    }

    // ── the model, all derived ──────────────────────────────────────────────

    get _views() {
        return [...(feezal?.site?.querySelectorAll?.('feezal-view') || [])];
    }

    /**
     * Canvas elements across every view — component instances included.
     *
     * Direct children of views only, which is the canvas's own model: a
     * component instance is ONE element, and the children it stamps inside
     * itself are not separately selectable, movable or countable.
     * (`feezal-element-*` is not a CSS selector — there is no wildcard tag
     * match — so this is the predicate the rest of the canvas uses.)
     */
    get _elements() {
        return this._views.flatMap(view => [...view.children].filter(isCanvasElement));
    }

    /** The canvas's own selected-class is the one source of truth (no plumbing). */
    get _selected() {
        return [...(feezal?.site?.querySelectorAll?.('.feezal-selected') || [])];
    }

    /**
     * Serialized-size estimate. `outerHTML` is what deploy writes, minus the
     * formatting pass — close enough to answer "is this site getting big?",
     * which is the only question a footer number needs to answer. Cached
     * against the structural revision so a drag never pays for it.
     */
    get _size() {
        if (this._sizeAt !== this._structure) {
            this._sizeAt = this._structure;
            this._sizeCache = feezal?.site?.outerHTML?.length || 0;
        }
        return this._sizeCache;
    }

    /** Distinct topics the connection currently holds, not subscription rows. */
    get _topics() {
        const subs = feezal?.connection?.subscriptions || [];
        return new Set(subs.map(s => s?.topic).filter(Boolean)).size;
    }

    /** The theme actually in effect for the site (U51 puts it on as a class). */
    get _theme() {
        const cls = [...(feezal?.site?.classList || [])]
            .find(c => c.startsWith('feezal-theme-'));
        return cls ? cls.replace('feezal-theme-', '') : 'default';
    }

    _selectionLabel() {
        const selected = this._selected;
        if (selected.length > 1) return {what: plural(selected.length, 'element'), detail: ''};
        const el = selected[0];
        if (!el) {
            // Nothing selected on the canvas means the view itself is the
            // subject — the same reading the inspector gives.
            const view = feezal?.view;
            return view
                ? {what: 'view', detail: view.getAttribute('name') || ''}
                : {what: 'nothing selected', detail: ''};
        }
        const tag = (el.localName || '').replace('feezal-element-', '');
        return {what: tag, detail: el.getAttribute('label') || el.getAttribute('name') || ''};
    }

    render() {
        // B119 — a status line must never be able to take the editor down.
        //
        // Its own first version shipped an invalid selector, and the failure
        // did not stay local: the observer re-entered render on every mutation,
        // so one bad getter became an unhandled-rejection storm and the
        // right-click menu died with it. The selector is fixed, but the shape
        // of the risk is permanent — this component re-renders on every canvas
        // mutation and reads DOM it does not own. So it degrades to a quiet row
        // rather than throwing, whatever it is handed.
        try {
            return this._render();
        } catch (error) {
            console.warn('feezal-footer: skipped a render', error);
            return html`<div class="seg muted">—</div>`;
        }
    }

    _render() {
        const sel = this._selectionLabel();
        return html`
            <div class="seg selection" title="Current selection">
                <span class="material-icons">ads_click</span>
                <span class="what">${sel.what}</span>
                ${sel.detail ? html`<span class="muted">${sel.detail}</span>` : ''}
            </div>
            <div class="spacer"></div>
            <div class="seg" title="Views in this site">${plural(this._views.length, 'view')}</div>
            <div class="seg" title="Elements across all views">${plural(this._elements.length, 'element')}</div>
            <div class="seg" title="Approximate serialized size of the site">${formatBytes(this._size)}</div>
            <div class="seg" title="${this.mqtt?.label || 'MQTT'} · distinct topics currently subscribed">
                <span class="mqtt-dot ${this.mqtt?.cls || 'unknown'}"></span>
                <span class="material-icons">rss_feed</span>${this._topics}
            </div>
            <div class="seg" title="Active site theme">${this._theme}</div>
        `;
    }
}

window.customElements.define('feezal-footer', FeezalFooter);
export {FeezalFooter, formatBytes};

/* global feezal */
/**
 * @feezal/feezal-controller-link (E166)
 *
 * The link-card behaviour as a Lit Reactive Controller — shared by
 * glass/metro/circle/eink-link so the four cannot drift (E137 discipline).
 * The controller owns everything that is NOT chrome:
 *
 *   - the effective target: `href`, replaceable at runtime by a message on
 *     `subscribe` (+ `message-property`) — the camera element's src-switch
 *     precedent;
 *   - `activate()`, the one tap entry point: editor-guarded (a tap in the
 *     editor selects, never navigates), `#/view` routes navigate the app IN
 *     PLACE (N30 — reloading the page to switch views would drop the MQTT
 *     session for nothing), and the three open modes;
 *   - the popup-iframe mode's lifecycle (top-layer promotion, Esc/✕ close),
 *     with the popup chrome itself exported from here too — it is deliberately
 *     identical across families, like the behaviour.
 *
 * No discovery fragment: a link is not a device — nothing announces it.
 */

import {css, html} from '@feezal/feezal-element';

/** The open modes, in the order the select shows them. Extensible on purpose
 * (the roadmap names a later kiosk-window mode) — activate() treats unknown
 * values as same-tab rather than throwing, so an old element under a newer
 * saved site degrades instead of dying. */
export const LINK_OPEN_MODES = ['same-tab', 'new-tab', 'popup-iframe'];

/** Shared attribute descriptors — spread into every family's `feezal.attributes`.
 * `icon` / `label` stay per family (their conventions and defaults differ);
 * everything behavioural is here so it exists exactly once. */
export const linkAttributes = [
    {name: 'href', type: 'string',
        help: 'Target URL. A #/view value navigates this app to that view in place (no reload).'},
    {name: 'subscribe', type: 'mqttTopic',
        help: 'Optional: a message on this topic REPLACES the target URL at runtime.'},
    {name: 'message-property', type: 'string', default: 'payload',
        help: 'Property path within the message payload (dot-notation). Blank = top-level payload.'},
    {name: 'open', type: 'select', options: LINK_OPEN_MODES, default: 'same-tab',
        help: 'How the target opens: this tab, a new tab, or embedded in a fullscreen popup (sites that forbid embedding show an error there — the popup header always offers "open in tab").'},
    // type 'asset': the inspector autocompletes the site's assets (free URLs
    // still typable — the picker only suggests), filtered to image files.
    {name: 'image', type: 'asset', accept: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'],
        help: 'Image face (Asset Manager path or URL) — replaces the icon when set; oversized images are scaled to fit.'},
];

/** Attribute names this controller consumes (parity-set derivation, E114). */
export const LINK_CONSUMED_ATTRIBUTES = linkAttributes.map(a => a.name);

export class LinkController {
    /** @param {import('lit').ReactiveControllerHost & HTMLElement} host */
    constructor(host) {
        this.host = host;
        host.addController?.(this);
        // ── state (plain fields, E137 decided) ──
        this.dynamicHref = '';        // a received message replaces the target
        this.popupOpen = false;
        this.__onKey = e => {
            if (e.key === 'Escape') this.closePopup();
        };
    }

    _attr(name, fallback = '') {
        const v = this.host.getAttribute(name);
        return v === null ? fallback : v;
    }

    /** The effective target: the last received message wins over the attribute. */
    get href() {
        return this.dynamicHref || this._attr('href');
    }

    get openMode() {
        return this._attr('open', 'same-tab');
    }

    signature() {
        return this._attr('subscribe');
    }

    hostConnected() {
        this.wire();
    }

    hostDisconnected() {
        // The popup dies with the element; the document listener must not
        // outlive it (the N42 listener-leak class).
        this.closePopup();
    }

    wire() {
        this.__sig = this.signature();
        const subscribe = this._attr('subscribe');
        if (subscribe) {
            this.host.addSubscription(subscribe, msg => {
                const v = this.host.getProperty(msg, this._attr('message-property') || 'payload');
                this.dynamicHref = v === undefined || v === null ? '' : String(v).trim();
                this.host.requestUpdate();
            });
        }
    }

    /** Call from the host's updated() to re-wire on live topic edits. */
    rewireIfChanged() {
        if (this.__sig !== undefined && this.signature() !== this.__sig) {
            this.host._unsubscribe();
            this.wire();
        }
    }

    /**
     * A `#/view` (or `#view`) href names a view of THIS app — return that name,
     * but only when the view actually exists: an unknown name falls through to
     * ordinary navigation, so a hash link to an anchor on some page is not
     * swallowed by the router.
     */
    internalView() {
        const href = this.href;
        if (!href.startsWith('#')) return null;
        const name = decodeURIComponent(href.replace(/^#\/?/, '').replace(/\/$/, ''));
        return name && feezal.getView?.(name) ? name : null;
    }

    /**
     * The tap. Editor-guarded here — one guard for four families — so the
     * canvas tap stays a selection and nothing ever navigates the editor away.
     */
    activate() {
        if (typeof feezal !== 'undefined' && feezal.isEditor) return;
        const url = this.href;
        if (!url) return;

        // N30 — an internal view route navigates in place, regardless of the
        // open mode: a popup or new tab of your own app's view is never what
        // that link means. `site.view` is the B23-approved entry (drives
        // updateVisibility + hash sync).
        const view = this.internalView();
        if (view) {
            feezal.site.view = view;
            return;
        }

        switch (this.openMode) {
            case 'popup-iframe':
                this.popupOpen = true;
                document.addEventListener('keydown', this.__onKey);
                this.host.requestUpdate();
                break;
            case 'new-tab':
                // noopener: the target must not get a handle on the dashboard.
                window.open(url, '_blank', 'noopener,noreferrer');
                break;
            default:
                window.location.assign(url);
        }
    }

    closePopup() {
        document.removeEventListener('keydown', this.__onKey);
        if (!this.popupOpen) return;
        this.popupOpen = false;
        this.host.requestUpdate();
    }

    /**
     * Promote the rendered popup to the browser TOP LAYER (basic-camera
     * precedent). Call from the host's updated(): the element only exists
     * after the render that `activate()` requested. Removing it from the DOM
     * on close dismisses the popover automatically; browsers without the
     * popover API fall back to the fixed+z-index rules.
     */
    syncPopup() {
        if (!this.popupOpen) return;
        const popup = this.host.shadowRoot?.querySelector('.link-popup');
        if (popup?.showPopover && !popup.matches(':popover-open')) {
            try { popup.showPopover(); } catch { /* fixed+z-index fallback */ }
        }
    }
}

/**
 * The popup chrome — identical across the four families on purpose.
 *
 * The header always offers "open in tab": sites that forbid embedding
 * (X-Frame-Options / CSP frame-ancestors) cannot be DETECTED from here — the
 * iframe fires `load` either way and cross-origin documents are opaque — so
 * the friendly fallback is a permanent affordance in the chrome, sitting
 * directly above whatever error page the browser paints into the blocked
 * frame.
 */
export const linkPopupStyles = css`
    .link-popup {
        position: fixed; inset: 3vh 3vw; z-index: 99999;
        width: auto; height: auto; margin: 0; border: 0; padding: 0; overflow: hidden;
        border-radius: 10px;
        background: var(--primary-background-color);
        color: var(--primary-text-color);
        display: flex; flex-direction: column;
        box-shadow: 0 16px 48px rgba(0,0,0,0.35);
    }
    .link-popup::backdrop { background: rgba(0, 0, 0, 0.55); }
    .link-popup .bar {
        flex: 0 0 auto; display: flex; align-items: center; gap: 10px;
        padding: 8px 12px;
        border-bottom: 1px solid var(--divider-color);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
    }
    .link-popup .bar .title {
        flex: 1 1 auto; min-width: 0; font-weight: 600;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .link-popup .bar a {
        flex: 0 0 auto; color: var(--primary-color); text-decoration: none;
    }
    .link-popup .bar a:hover { text-decoration: underline; }
    .link-popup .close {
        flex: 0 0 auto;
        width: 28px; height: 28px; border-radius: 50%; border: 0; cursor: pointer;
        background: transparent; color: inherit; font-size: 16px; line-height: 1;
        display: flex; align-items: center; justify-content: center;
    }
    .link-popup .close:hover { background: var(--divider-color); }
    .link-popup iframe {
        flex: 1 1 auto; width: 100%; border: 0; background: #fff;
    }
`;

/** Render the popup. The host includes this when `link.popupOpen`. */
export function linkPopup(link) {
    const url = link.href;
    return html`
        <div class="link-popup" popover="manual">
            <div class="bar">
                <span class="title">${link._attr('label') || url}</span>
                <a href="${url}" target="_blank" rel="noopener noreferrer"
                    title="Sites that do not allow embedding can be opened in a tab instead">Open in tab ↗</a>
                <button class="close" title="Close" @click="${() => link.closePopup()}">✕</button>
            </div>
            <iframe src="${url}" allow="fullscreen"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
        </div>
    `;
}

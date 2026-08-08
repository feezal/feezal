/* global feezal */
import {html, css} from '@feezal/feezal-element';
import {glassPopupStyles, glassPopupKnobs, FeezalGlassCard} from '@feezal/feezal-glass';
import {withJsonStringCoercion} from '@feezal/feezal-element-basic-template';

/**
 * feezal-element-glass-popup (E171 ③)
 *
 * A card-less popup CONTAINER: the element is a TRIGGER (glass icon chip,
 * label, both, or an invisible hotspot) that opens the family popup chrome
 * with either an embedded VIEW (cloned live, elements keep their MQTT
 * lifecycle — the dialog-view idea without the MQTT-open plumbing) or a
 * light-DOM `<template>` child rendered with the msg context exactly like
 * basic-template (the coercion helper is imported from there, not copied).
 * Any content gets the glass popup treatment without building a bespoke
 * card.
 *
 * The popover lifecycle (outside-tap dismiss, the E171 popup-backdrop /
 * popup-animate knobs and the closing tween) is inherited from
 * FeezalGlassCard; this element adds Escape-to-close and the content
 * embedding. Unlike glass-dialog / glass-dialog-view (MQTT-opened modals
 * with a canvas placeholder), this is a USER-tapped trigger — the overlap
 * check the roadmap asked for is exactly that distinction.
 */
class FeezalElementGlassPopup extends FeezalGlassCard {
    static get feezal() {
        return {
            palette: {name: 'Popup', category: 'Glass', color: '#7aa5c9', icon: 'open_in_new'},
            description: 'Glass popup container — a tap trigger (icon, label, or an invisible hotspot) opens the ' +
                'family frost popup showing either an embedded view or this element\'s own <template> content ' +
                '(rendered with the msg context like the template element).',
            attributes: [
                {name: 'trigger', type: 'select', options: ['icon', 'label', 'icon-label', 'hotspot'], default: 'icon',
                    help: 'What the element shows on the canvas: a glass icon chip, a label chip, both — or an ' +
                        'invisible hotspot (place it over any area to make it tappable).'},
                {name: 'icon', type: 'icon', default: 'open_in_new', help: 'Trigger icon (icon and icon-label modes).'},
                {name: 'label', type: 'string', default: '', help: 'Trigger label (label and icon-label modes).'},
                {name: 'title', type: 'string', default: '', help: 'Popup title (empty = none).'},
                {name: 'view', dropdown: 'views',
                    help: 'View to embed in the popup — its elements stay live (subscriptions, taps). ' +
                        'Empty = render this element\'s own <template> child instead.'},
                {name: 'subscribe', type: 'mqttTopic',
                    help: 'Template mode: messages on this topic re-render the template with the msg context ' +
                        '(use ${msg.payload} etc., like the template element). Unused when a view is embedded.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Property path within the message payload (dot-notation), for ${msg.…} access patterns.'},
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid — no per-frame GPU cost ' +
                        '(weak wall-tablet hardware). Trigger chip and popup alike.'},
                ...glassPopupKnobs,
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-icon-size', default: '28px', help: 'Trigger icon size.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Trigger label size.'},
                {property: '--feezal-glass-popup-body-height', default: '40vh', help: 'Popup body height in VIEW mode (template mode sizes to its content).'},
            ],
            defaultStyle: {width: '64px', height: '64px'},
            restrict: {minWidth: 24, minHeight: 24},
        };
    }

    static properties = {
        trigger:    {type: String, reflect: true},
        icon:       {type: String, reflect: true},
        label:      {type: String, reflect: true},
        popupTitle: {type: String, reflect: true, attribute: 'title'},
        view:       {type: String, reflect: true},
        msg:        {state: true},
    };

    static styles = [FeezalGlassCard.styles ?? [], glassPopupStyles, css`
        :host { display: block; }
        .trigger {
            width: 100%; height: 100%; box-sizing: border-box; padding: 4px;
            display: flex; align-items: center; justify-content: center; gap: 6px;
            cursor: pointer; user-select: none;
            border: 1px solid var(--feezal-glass-border, rgba(255,255,255,0.55));
            border-radius: var(--feezal-glass-radius, 24px);
            background: var(--feezal-glass-tint, rgba(255,255,255,0.35));
            -webkit-backdrop-filter: blur(var(--feezal-glass-blur, 20px));
            backdrop-filter: blur(var(--feezal-glass-blur, 20px));
            color: var(--feezal-glass-color, #1d1d1f);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        @supports (corner-shape: squircle) { .trigger { corner-shape: squircle; } }
        :host([degrade]) .trigger {
            -webkit-backdrop-filter: none; backdrop-filter: none;
            background: var(--feezal-glass-solid, rgba(245,245,247,0.94));
        }
        /* hotspot: fully invisible in the viewer; the editor's editable
           outline (base class) keeps it findable on the canvas. */
        .trigger.hotspot {
            border: none; background: none;
            -webkit-backdrop-filter: none; backdrop-filter: none;
        }
        .trigger feezal-icon { font-size: var(--feezal-glass-icon-size, 28px); line-height: 1; }
        .trigger .tlabel {
            font-size: var(--feezal-glass-font-size-label, 12px);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .details .body {
            align-self: stretch; position: relative; overflow: auto;
            max-height: 65vh;
        }
        .details .body.viewmode { height: var(--feezal-glass-popup-body-height, 40vh); }
    `];

    constructor() {
        super();
        this.trigger = 'icon';
        this.icon = 'open_in_new';
        this.label = '';
        this.popupTitle = '';
        this.view = '';
        this.msg = null;
        this.__tplFn = null;
        this.__sub = null;
        this.__esc = e => {
            if (e.key === 'Escape') this._closeDetails();
        };
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('keydown', this.__esc);
        if (this.__sub) {
            feezal.connection.unsubscribe(this.__sub);
            this.__sub = null;
        }
    }

    openDetails() {
        super.openDetails();
        if (this._details) document.addEventListener('keydown', this.__esc);
    }

    _closeDetails() {
        document.removeEventListener('keydown', this.__esc);
        super._closeDetails();
    }

    _onTap() {
        if (this._suppressTap) {
            this._suppressTap = false;
            return;
        }
        this.openDetails();
    }

    // ── template msg wiring (basic-template semantics) ─────────────────────
    _wireSub() {
        if (this.__sub) {
            feezal.connection.unsubscribe(this.__sub);
            this.__sub = null;
        }
        if (this.subscribe && !this.view) {
            this.__sub = feezal.connection.sub(this.subscribe, msg => { this.msg = msg; });
        }
    }

    // ── popup content ───────────────────────────────────────────────────────
    _fillBody() {
        const body = this.renderRoot.querySelector('.details .body');
        if (!body) return;
        if (this.view) {
            body.classList.add('viewmode');
            if (body.querySelector('feezal-view')) return;   // already embedded
            const src = feezal.site?.querySelector(`feezal-view[name="${this.view}"]`);
            if (!src) return;
            // A live clone — elements connect and subscribe like any embedded
            // view. The source view is hidden (inline display) — the clone
            // must not inherit that, and it lays out INSIDE the popup body.
            const clone = src.cloneNode(true);
            clone.style.display = 'block';
            clone.style.position = 'relative';
            clone.style.inset = 'auto';
            clone.style.width = '100%';
            clone.style.height = '100%';
            body.replaceChildren(clone);
            clone.visible = true;
            return;
        }
        body.classList.remove('viewmode');
        const tpl = this.querySelector('template');
        if (!tpl) return;
        if (!this.__tplFn) {
            // eslint-disable-next-line no-new-func
            this.__tplFn = new Function('msg', 'return `' + tpl.innerHTML + '`;');
        }
        try {
            body.innerHTML = this.__tplFn(withJsonStringCoercion(this.msg || {payload: '', topic: ''}));
        } catch {
            body.innerHTML = tpl.innerHTML;   // template without msg access
        }
    }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('subscribe') || changed.has('view')) this._wireSub();
        if (changed.has('_details') && this._details) {
            // Top-layer promotion (the family pattern), then fill the body —
            // the popup only exists in the DOM while open.
            const popup = this.renderRoot.querySelector('.details');
            if (popup?.showPopover && !popup.matches(':popover-open')) {
                try { popup.showPopover(); } catch { /* fixed+z-index fallback */ }
            }
            this._fillBody();
        }
        if (changed.has('msg') && this._details && !this.view) this._fillBody();
    }

    _renderTrigger() {
        const showIcon = this.trigger === 'icon' || this.trigger === 'icon-label';
        const showLabel = this.trigger === 'label' || this.trigger === 'icon-label';
        return html`
            <div class="trigger ${this.trigger}" role="button" tabindex="0"
                aria-haspopup="dialog" title="${this.label || this.popupTitle || ''}"
                @click="${this._onTap}"
                @keydown="${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._onTap(); } }}">
                ${showIcon && this.icon ? html`<feezal-icon name="${this.icon}"></feezal-icon>` : ''}
                ${showLabel && this.label ? html`<span class="tlabel">${this.label}</span>` : ''}
            </div>`;
    }

    render() {
        return html`
            ${this._renderTrigger()}
            ${this._details ? html`
                <div class="details" popover="manual">
                    ${this.popupTitle ? html`<div class="title">${this.popupTitle}</div>` : ''}
                    <div class="body"></div>
                </div>` : ''}
        `;
    }
}

customElements.define('feezal-element-glass-popup', FeezalElementGlassPopup);
export {FeezalElementGlassPopup};

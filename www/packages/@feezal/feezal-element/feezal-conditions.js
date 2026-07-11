/* global feezal */

/**
 * E50 — per-element conditions engine.
 *
 * Every element can carry a `conditions` attribute holding a JSON list of
 * rows that declaratively bind visibility, CSS classes, styles or attributes
 * to MQTT topics (or page-locally published ones, E49):
 *
 *   [{"subscribe": "home/alarm/state", "operator": "=", "value": "armed",
 *     "action": "attribute", "attribute": "disabled", "attribute-value": ""}]
 *
 * Row schema:
 *   subscribe        topic (exact or `${param}` placeholder inside components)
 *   property         optional dot-path into the message (default "payload")
 *   operator         = | != | > | < | >= | <= | matches   (default =)
 *   value            compare value (regex source for `matches`)
 *   action           show | hide | class | style | attribute
 *   class            (action=class)  class name to add while matched
 *   style            (action=style)  {prop: value, …} applied while matched
 *   attribute        (action=attribute) attribute name
 *   attribute-value  (action=attribute) value set while matched
 *   keep-layout      (action=show/hide) use visibility:hidden instead of
 *                    display:none so the element keeps its layout box
 *
 * Semantics (decided in the E50 roadmap entry):
 *   - rows evaluate independently against the last value on their topic;
 *   - visibility rows AND-combine — visible only if every `show` row matches
 *     and no `hide` row matches;
 *   - class/style/attribute rows apply while matched and revert when
 *     unmatched; several matching rows targeting the same style property or
 *     attribute: the later row wins;
 *   - reverting restores the element's pristine value (captured before any
 *     condition effect was applied);
 *   - effects are never applied in the editor (a badge shows instead).
 *
 * The engine is host-agnostic so both element base classes (Lit
 * FeezalElement and Polymer FeezalPolymerElement) share it.
 */

const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'matches'];
const ACTIONS   = ['show', 'hide', 'class', 'style', 'attribute'];

/** Parse + validate a conditions attribute value. Garbage in → []. */
export function parseConditions(raw) {
    if (!raw || typeof raw !== 'string') return [];
    let list;
    try {
        list = JSON.parse(raw);
    } catch {
        return [];
    }

    if (!Array.isArray(list)) return [];
    return list.filter(row =>
        row && typeof row === 'object' &&
        typeof row.subscribe === 'string' && row.subscribe.length > 0 &&
        ACTIONS.includes(row.action) &&
        (row.operator === undefined || OPERATORS.includes(row.operator)));
}

/** Evaluate one condition against a payload value. Pure. */
export function evalCondition(operator, compareValue, payload) {
    const op = operator || '=';
    switch (op) {
        case '=':
            return String(payload) === String(compareValue);
        case '!=':
            return String(payload) !== String(compareValue);
        case '>':
        case '<':
        case '>=':
        case '<=': {
            const a = Number(payload);
            const b = Number(compareValue);
            if (isNaN(a) || isNaN(b)) return false;
            if (op === '>')  return a > b;
            if (op === '<')  return a < b;
            if (op === '>=') return a >= b;
            return a <= b;
        }
        case 'matches':
            try {
                return new RegExp(String(compareValue)).test(String(payload));
            } catch {
                return false;
            }
        default:
            return false;
    }
}

export class FeezalConditions {
    /** @param {HTMLElement} host element the effects apply to (needs getProperty()) */
    constructor(host) {
        this.host = host;
        this._subs = [];
        this._rows = [];
        this._matched = [];
        this._pristine = null;
        this._active = false;
    }

    /**
     * (Re)start the engine from the host's current `conditions` attribute.
     * No-ops in the editor (effects are editor-badged, never applied) and
     * when the attribute is absent/empty/invalid.
     */
    connect() {
        const raw = this.host.getAttribute('conditions');
        // Idempotent for an unchanged attribute — connectedCallback and the
        // first Lit update may both call connect() for the same value.
        if (this._active && raw === this._lastRaw) return;

        this.disconnect();
        this._lastRaw = raw;
        if (typeof feezal === 'undefined' || feezal.isEditor) return;

        this._rows = parseConditions(raw);
        if (this._rows.length === 0) return;

        this._matched = this._rows.map(() => false);
        this._capturePristine();
        this._active = true;

        this._rows.forEach((row, i) => {
            this._subs.push(feezal.connection.sub(row.subscribe, msg => {
                const payload = this.host.getProperty
                    ? this.host.getProperty(msg, row.property || 'payload')
                    : (msg && typeof msg === 'object' ? msg.payload : msg);
                this._matched[i] = evalCondition(row.operator, row.value, payload);
                this._apply();
            }));
        });
    }

    /** Stop: unsubscribe and revert every applied effect. */
    disconnect() {
        for (const sub of this._subs.splice(0)) {
            feezal.connection.unsubscribe(sub);
        }

        if (this._active) {
            // Revert to pristine so a re-connect (element moved in the DOM,
            // conditions edited) starts from a clean slate.
            this._matched = this._rows.map(() => false);
            this._apply();
        }

        this._rows = [];
        this._matched = [];
        this._pristine = null;
        this._active = false;
        this._lastRaw = undefined;
    }

    /** Record the element's pre-condition values for everything rows may touch. */
    _capturePristine() {
        const host = this.host;
        const p = {styles: {}, attrs: {}, display: null, visibility: null};

        for (const row of this._rows) {
            if (row.action === 'style' && row.style && typeof row.style === 'object') {
                for (const prop of Object.keys(row.style)) {
                    if (!(prop in p.styles)) p.styles[prop] = host.style.getPropertyValue(prop);
                }
            } else if (row.action === 'attribute' && row.attribute) {
                if (!(row.attribute in p.attrs)) {
                    p.attrs[row.attribute] = {
                        had: host.hasAttribute(row.attribute),
                        value: host.getAttribute(row.attribute),
                    };
                }
            } else if (row.action === 'show' || row.action === 'hide') {
                if (p.display === null) {
                    p.display = host.style.getPropertyValue('display');
                    p.visibility = host.style.getPropertyValue('visibility');
                }
            }
        }

        this._pristine = p;
    }

    /** Re-derive and apply the full effect state from the per-row match flags. */
    _apply() {
        const host = this.host;
        const p = this._pristine;

        // ── classes: add while matched, remove when unmatched (row order) ──
        this._rows.forEach((row, i) => {
            if (row.action === 'class' && row.class) {
                if (this._matched[i]) host.classList.add(row.class);
                else host.classList.remove(row.class);
            }
        });

        // ── visibility: AND-combine show/hide rows ──
        if (p.display !== null) {
            const visible = this._rows.every((row, i) => {
                if (row.action === 'show') return this._matched[i];
                if (row.action === 'hide') return !this._matched[i];
                return true;
            });
            const keepLayout = this._rows.some((row, i) =>
                (row.action === 'show' || row.action === 'hide') && row['keep-layout'] &&
                (row.action === 'show' ? !this._matched[i] : this._matched[i]));

            if (visible) {
                // Restore pristine inline values ('' removes the property).
                this._setOrRemoveStyle('display', p.display);
                this._setOrRemoveStyle('visibility', p.visibility);
            } else if (keepLayout) {
                this._setOrRemoveStyle('display', p.display);
                host.style.setProperty('visibility', 'hidden');
            } else {
                this._setOrRemoveStyle('visibility', p.visibility);
                host.style.setProperty('display', 'none');
            }
        }

        // ── styles: desired map from matching rows in order (later wins) ──
        const desiredStyles = {};
        this._rows.forEach((row, i) => {
            if (row.action === 'style' && this._matched[i] && row.style && typeof row.style === 'object') {
                Object.assign(desiredStyles, row.style);
            }
        });
        for (const [prop, pristineValue] of Object.entries(p.styles)) {
            if (prop in desiredStyles) {
                host.style.setProperty(prop, String(desiredStyles[prop]));
            } else {
                this._setOrRemoveStyle(prop, pristineValue);
            }
        }

        // ── attributes: desired map from matching rows in order (later wins) ──
        const desiredAttrs = {};
        this._rows.forEach((row, i) => {
            if (row.action === 'attribute' && this._matched[i] && row.attribute) {
                desiredAttrs[row.attribute] = row['attribute-value'] ?? '';
            }
        });
        for (const [name, pristine] of Object.entries(p.attrs)) {
            if (name in desiredAttrs) {
                host.setAttribute(name, String(desiredAttrs[name]));
            } else if (pristine.had) {
                host.setAttribute(name, pristine.value);
            } else {
                host.removeAttribute(name);
            }
        }
    }

    _setOrRemoveStyle(prop, value) {
        if (value) {
            this.host.style.setProperty(prop, value);
        } else {
            this.host.style.removeProperty(prop);
        }
    }
}

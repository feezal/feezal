import {html, css} from 'lit';

/**
 * E135 — Homematic fault / sabotage decoding (shared).
 *
 * Two encodings, per the OpenCCU-Base research:
 *  - **Classic BidCoS/HM**: ONE integer enum datapoint — `FAULT_REPORTING` (TRV)
 *    or `ERROR` (Keymatic, contact). The meaning of the number is
 *    **device-family-specific** (value 7 = valve-mount error on a TRV but
 *    SABOTAGE on a contact), so the enum table is keyed by device type. Over
 *    MQTT the value arrives as the integer option index; feezal owns the text.
 *  - **HmIP**: many *named boolean* `ERROR_*` datapoints (the flag NAME is the
 *    message), plus a dedicated `SABOTAGE` / `SABOTAGE_STICKY` boolean.
 *
 * The number arrives live over MQTT, so decoding is a client-side render-time
 * concern; the recognizer only wires the topic + the device-type hint.
 */

// Classic enum tables, keyed by device type. `0` (and any unlisted value that
// maps to no fault) means OK. `sabotage` marks the value that is a tamper event.
export const HM_FAULT_ENUMS = {
    'HM-CC-RT-DN': {
        datapoint: 'FAULT_REPORTING',
        text: {1: 'Valve tight', 2: 'Adjusting range too large', 3: 'Adjusting range too small', 4: 'Communication error', 6: 'Low battery', 7: 'Valve mounting error'},
    },
    'HM-Sec-Key': {
        datapoint: 'ERROR',
        text: {1: 'Clutch failure', 2: 'Motor aborted'},
    },
    'HM-Sec-SC': {
        datapoint: 'ERROR',
        text: {7: 'Sabotage'},
        sabotage: 7,   // classic contacts encode sabotage as ERROR == 7
    },
};

// HmIP named fault-flag → text. The flag name IS the actionable message.
export const HMIP_FAULT_FLAGS = {
    ERROR_JAMMED: 'Jammed',
    ERROR_LOAD_TOO_LOW: 'Load too low',
    ERROR_NO_END_STOP_LOCK: 'No end stop (lock)',
    ERROR_NO_END_STOP_UNLOCK: 'No end stop (unlock)',
    ERROR_OVERHEAT: 'Overheating',
    ERROR_UNDERVOLTAGE: 'Undervoltage',
    ERROR_COPROCESSOR: 'Coprocessor error',
    ERROR_DEGRADED_CHAMBER: 'Smoke chamber degraded',
    ERROR_BUS_CONFIG_MISMATCH: 'Bus config mismatch',
    ERROR_DALI_BUS: 'DALI bus error',
};

const asNum = v => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
    return null;
};
const asBool = v => v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';

/**
 * Decode a fault value to human text ('' = no fault). `deviceType` selects the
 * classic enum table; unknown families fall back to "nonzero = fault, raw code".
 * A bare HmIP flag name (`ERROR_JAMMED`) is decoded to its text.
 */
export function decodeHmFault(deviceType, value) {
    if (value === null || value === undefined || value === '') return '';
    // HmIP: a flag name delivered as a truthy boolean — the datapoint is the message.
    if (typeof value === 'string' && value.startsWith('ERROR_')) return hmipFlagText(value);
    const spec = HM_FAULT_ENUMS[deviceType];
    const n = asNum(value);
    if (spec) {
        if (n === null || n === 0) return '';
        return spec.text[n] || `Fault ${n}`;
    }
    // Unknown family: nonzero numeric = fault (raw code); truthy string = as-is.
    if (n !== null) return n ? `Fault ${n}` : '';
    return asBool(value) ? String(value) : '';
}

/** Whether a classic-enum fault value is a SABOTAGE event for this device type. */
export function isHmSabotageValue(deviceType, value) {
    const spec = HM_FAULT_ENUMS[deviceType];
    const n = asNum(value);
    return !!(spec && spec.sabotage != null && n === spec.sabotage);
}

/** HmIP flag name → text (e.g. ERROR_JAMMED → "Jammed"). */
export function hmipFlagText(flag) {
    return HMIP_FAULT_FLAGS[flag] || String(flag).replace(/^ERROR_/, '').replace(/_/g, ' ').toLowerCase();
}

/** Interpret a sabotage signal: classic `ERROR == 7` (encoding 'error7') or an
 *  HmIP boolean `SABOTAGE`/`SABOTAGE_STICKY` (encoding 'bool'). Returns boolean. */
export function isSabotageActive(value, encoding, deviceType) {
    if (value === null || value === undefined || value === '') return false;
    if (encoding === 'error7' || (deviceType && HM_FAULT_ENUMS[deviceType] && HM_FAULT_ENUMS[deviceType].sabotage != null)) {
        return asNum(value) === (HM_FAULT_ENUMS[deviceType] ? HM_FAULT_ENUMS[deviceType].sabotage : 7);
    }
    return asBool(value);
}

/**
 * E135 shared attribute fragment — spread into a card's `feezal.attributes` so
 * a device's fault (`FAULT_REPORTING`/`ERROR`) and sabotage (`SABOTAGE`, or
 * classic `ERROR == 7`) signals auto-stamp and render as badges. Presence-checked
 * like the E124 battery contract — only stamped when the device exposes them.
 */
export const faultSabotageAttributes = [
    {name: 'subscribe-error', type: 'mqttTopic', help: 'Optional device fault topic (Homematic FAULT_REPORTING / ERROR). A warning badge shows the decoded fault text.'},
    {name: 'message-property-error', type: 'string', help: 'Property path within fault messages. Defaults to message-property.'},
    {name: 'error-device-type', type: 'string', help: 'Homematic device type (e.g. HM-CC-RT-DN) — selects the fault-code text table. Blank = show the raw code.'},
    {name: 'subscribe-sabotage', type: 'mqttTopic', help: 'Optional sabotage/tamper topic (HmIP SABOTAGE, or classic contacts via ERROR). Shows an alarm-grade badge.'},
    {name: 'message-property-sabotage', type: 'string', help: 'Property path within sabotage messages. Defaults to message-property.'},
    {name: 'sabotage-encoding', type: 'select', options: ['bool', 'error7'], default: 'bool', help: 'How sabotage is encoded: a boolean (HmIP SABOTAGE), or classic contacts where ERROR == 7 is sabotage.'},
];

/** Attribute names of the E135 fragment (for parity-set derivation). */
export const FAULT_SABOTAGE_ATTRIBUTES = faultSabotageAttributes.map(a => a.name);

/**
 * Wire a card's fault + sabotage subscriptions off its HOST attributes and
 * decode them. `onError(text)` receives the decoded fault text ('' = no fault);
 * `onSabotage(active)` a boolean. Mirrors the E124 battery wiring shape.
 */
export function subscribeFaultSabotage(host, {onError, onSabotage} = {}) {
    const attr = n => { const v = host.getAttribute(n); return v === null ? '' : v; };
    const prop = (msg, specific) => host.getProperty(msg, attr(specific) || attr('message-property') || 'payload');
    const err = attr('subscribe-error');
    if (err && onError) {
        host.addSubscription(err, msg => onError(decodeHmFault(attr('error-device-type'), prop(msg, 'message-property-error'))));
    }
    const sab = attr('subscribe-sabotage');
    if (sab && onSabotage) {
        host.addSubscription(sab, msg => onSabotage(isSabotageActive(prop(msg, 'message-property-sabotage'), attr('sabotage-encoding'), attr('error-device-type'))));
    }
}

/** Signature fragment for rewire-on-edit (join into the controller's signature). */
export function faultSabotageSignature(host) {
    return ['subscribe-error', 'subscribe-sabotage'].map(n => host.getAttribute(n) || '').join('|');
}

// E135 badge styles — sabotage is alarm-grade (error colour, prominent); fault
// is the warning tier. Bottom-left by default (battery owns bottom-right).
export const feezalFaultStyles = css`
    .feezal-sabotage-badge, .feezal-fault-badge {
        position: absolute;
        bottom: var(--feezal-fault-bottom, 6px);
        left: var(--feezal-fault-left, 6px);
        width: var(--feezal-fault-size, 18px); height: var(--feezal-fault-size, 18px);
        pointer-events: none; z-index: 2;
    }
    .feezal-sabotage-badge { color: var(--error-color, #d32f2f); opacity: 1; }
    .feezal-fault-badge { color: var(--warning-color, #f0a30a); opacity: 0.95; }
    .feezal-sabotage-badge svg, .feezal-fault-badge svg { width: 100%; height: 100%; display: block; }
`;

/** Alarm-grade sabotage badge — a shield with an exclamation. Renders nothing when inactive. */
export function sabotageBadge(active) {
    return active ? html`<span class="feezal-sabotage-badge" title="Sabotage / tamper"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3zm-1 5h2v6h-2V7zm0 8h2v2h-2v-2z"/>
    </svg></span>` : '';
}

/** Warning-tier fault badge — a triangle; the decoded text is the tooltip. '' = none. */
export function faultBadge(text) {
    return text ? html`<span class="feezal-fault-badge" title="${text}"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
    </svg></span>` : '';
}

/** The device-health board's wildcard datapoint set (classic + HmIP + N31/E124). */
export const HM_HEALTH_DATAPOINTS = {
    fault:    ['FAULT_REPORTING', 'ERROR'],
    sabotage: ['SABOTAGE', 'SABOTAGE_STICKY'],
    battery:  ['LOWBAT', 'LOW_BAT'],
    unreach:  ['UNREACH'],
    // HmIP named fault flags (collected as their own booleans).
    hmipFlags: Object.keys(HMIP_FAULT_FLAGS),
};

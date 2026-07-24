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

/** The device-health board's wildcard datapoint set (classic + HmIP + N31/E124). */
export const HM_HEALTH_DATAPOINTS = {
    fault:    ['FAULT_REPORTING', 'ERROR'],
    sabotage: ['SABOTAGE', 'SABOTAGE_STICKY'],
    battery:  ['LOWBAT', 'LOW_BAT'],
    unreach:  ['UNREACH'],
    // HmIP named fault flags (collected as their own booleans).
    hmipFlags: Object.keys(HMIP_FAULT_FLAGS),
};

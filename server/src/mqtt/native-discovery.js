'use strict';

/**
 * Native device self-discovery (E108).
 *
 * A generic "recognizer" framework layered onto the same MQTT firehose the
 * bridge already feeds through discovery.js. Where a device ecosystem does NOT
 * emit Home-Assistant discovery configs (Homematic via hm2mqtt / RedMatic, and
 * WLED with its HA-sync interface disabled), these recognizers watch the native
 * topic patterns and synthesize the exact same normalized entity shape the HA
 * discovery path produces ({discovery_id, component, config, availability_normalized}).
 *
 * A recognizer is:
 *   {
 *     id:    string,
 *     state: <private accumulator>,
 *     match(topic)            → parsed | null   // cheap topic test + parse
 *     accumulate(state, parsed, value, payload) → channelState | null
 *         // `payload` is the full parsed JSON-Extended object (or null) so a
 *         // recognizer can read the CCU metadata in payload.hm.
 *     promote(channelState)   → entity | null   // null until signature complete
 *     reset()                                    // clear accumulator
 *   }
 *
 * handleNativeMessage(topic, payloadOrBuf) runs every recognizer; promoted
 * entities are kept in a namespaced Map exposed via getNativeEntities().
 *
 * Homematic payloads follow the MQTT-Smarthome "JSON Extended" convention
 * ({"val":…,"ts":…}); the framework extracts `.val` as the value. Guarded so a
 * non-JSON / malformed payload never throws.
 */

// ── A30: per-source recognizer modules ───────────────────────────────────────
// Each vendor/source lives in recognizers/<source>.js; this file stays the
// orchestrator + framework. Homematic owns its shared `hm` infrastructure and
// the B65 `:0` correlation (imported read-time helpers below); wled/evcc are
// standalone. The import is one-directional (framework → recognizers).
const hm = require('./recognizers/homematic');
const {wledRecognizer} = require('./recognizers/wled');
const {evccRecognizer} = require('./recognizers/evcc');

// ── Framework ─────────────────────────────────────────────────────────────────
// Registry order preserved exactly: climate, wled, contact, cover, light,
// switch, sensor, lock, evcc (recognizer precedence is behavioural).
const recognizers = [hm.hmRecognizers[0], wledRecognizer, ...hm.hmRecognizers.slice(1), evccRecognizer];

/** @type {Map<string, object>} discovery_id → promoted native entity */
const nativeEntities = new Map();

/** @type {Map<string, number>} discovery_id → newest datapoint ts (liveness),
 *  used by the read-time climate staleness filter in getNativeEntities(). */
const nativeEntityTs = new Map();


/**
 * Extract a value from a raw MQTT payload. MQTT-Smarthome "JSON Extended"
 * ({"val":…}) → `.val`; other JSON → the parsed object; otherwise the string.
 * Guarded — never throws.
 */
function extractValue(payloadOrBuf) {
    const str = Buffer.isBuffer(payloadOrBuf)
        ? payloadOrBuf.toString()
        : (payloadOrBuf == null ? '' : String(payloadOrBuf));
    if (str.length && (str[0] === '{' || str[0] === '[')) {
        try {
            const j = JSON.parse(str);
            if (j && typeof j === 'object' && !Array.isArray(j) && 'val' in j) return j.val;
            return j;
        } catch { /* fall through to raw */ }
    }
    return str;
}

/**
 * Parse a raw MQTT payload into its full JSON object (MQTT-Smarthome JSON-Extended
 * — {"val":…,"ts":…,"hm":{…}}), so a recognizer can read the rich CCU metadata in
 * `payload.hm`. Returns null for non-object / non-JSON payloads. Guarded — never
 * throws. WLED and other non-JSON-Extended payloads simply get null here.
 */
function parsePayload(payloadOrBuf) {
    const str = Buffer.isBuffer(payloadOrBuf)
        ? payloadOrBuf.toString()
        : (payloadOrBuf == null ? '' : String(payloadOrBuf));
    if (str.length && str[0] === '{') {
        try {
            const j = JSON.parse(str);
            if (j && typeof j === 'object' && !Array.isArray(j)) return j;
        } catch { /* not JSON */ }
    }
    return null;
}

/**
 * Run every recognizer over one MQTT message. Cheap: each recognizer's match()
 * does a startsWith/suffix guard before any work. A throwing recognizer is
 * isolated so it can never break the others (or the HA path that calls this).
 *
 * @param {string} topic
 * @param {Buffer|string} payloadOrBuf
 */
function handleNativeMessage(topic, payloadOrBuf) {
    // B65: index every device's :0 MAINTENANCE topic segment (keyed by
    // hm.device) so availability/battery can resolve the :0 channel at read
    // time even when output channels are custom-named (RedMatic name-mode).
    try { hm.indexMaintenance(topic, parsePayload(payloadOrBuf)); } catch { /* ignore */ }

    for (const rec of recognizers) {
        let parsed;
        try { parsed = rec.match(topic); } catch { parsed = null; }
        if (!parsed) continue;

        let value;
        try { value = extractValue(payloadOrBuf); } catch { value = undefined; }

        // Full parsed JSON-Extended object (or null) so a recognizer can read the
        // authoritative CCU metadata in payload.hm. Parsed once, guarded.
        let payload;
        try { payload = parsePayload(payloadOrBuf); } catch { payload = null; }

        let channelState;
        try { channelState = rec.accumulate(rec.state, parsed, value, payload); } catch { continue; }
        if (!channelState) continue;

        let entity;
        try { entity = rec.promote(channelState); } catch { continue; }
        if (entity && entity.discovery_id) {
            nativeEntities.set(entity.discovery_id, entity);
            // Stamp the device's newest ts for the read-time staleness filter.
            if (channelState && typeof channelState.lastTs === 'number') {
                nativeEntityTs.set(entity.discovery_id, channelState.lastTs);
            }
        }
    }
}

/** All promoted native entities, same shape as discovery.js entities. Climate
 *  entities older than the configured grace window are filtered out here (the
 *  ghost-topic filter); event-driven types are always kept. */
function getNativeEntities() {
    // B64: drop stale HmIP-group entities (superseded run-leaders). B65: resolve
    // :0 availability/battery now — the whole retained burst (incl. the :0
    // MAINTENANCE channel) has been seen by read time.
    const staleMs = hm.getClimateStaleMs();
    const now = staleMs ? Date.now() : 0;
    return [...nativeEntities.values()]
        .filter(e => !hm.isStaleHmGroup(e))
        .filter(e => {
            if (!staleMs || e.component !== 'climate') return true;
            const ts = nativeEntityTs.get(e.discovery_id);
            return !ts || (now - ts) <= staleMs;
        })
        .map(hm.applyHmAvailability);
}

/** One promoted native entity by discovery_id, or null. */
function getNativeEntity(id) {
    const e = nativeEntities.get(id);
    if (!e || hm.isStaleHmGroup(e)) return null;   // B64: skip superseded run-leaders
    return hm.applyHmAvailability(e);              // B65: resolve :0 availability at read time
}

/** Clear promoted entities AND every recognizer's accumulator. */
function clearNativeEntities() {
    nativeEntities.clear();
    nativeEntityTs.clear();
    hm.clearHmMaintenance();
    for (const rec of recognizers) {
        try { rec.reset(); } catch { /* ignore */ }
    }
}

module.exports = {
    handleNativeMessage,
    getNativeEntities,
    getNativeEntity,
    clearNativeEntities,
    // Homematic config — re-exported from recognizers/homematic.js (unchanged API).
    setHomematicPrefix: hm.setHomematicPrefix,
    setHomematicClimateStaleMs: hm.setHomematicClimateStaleMs,
    setHomematicClimateStale: hm.setHomematicClimateStale,
    // exported for tests / reuse
    extractValue,
    parsePayload,
    buildHmModes: hm.buildHmModes,
    recognizers,
};

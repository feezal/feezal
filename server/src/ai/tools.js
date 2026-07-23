'use strict';

/**
 * AI assistant tools (U26) — read-only lookups over the live MQTT caches so the
 * model can ground its answers instead of guessing topics/payloads.
 *
 *   search_topics(query)      — keyword search over the flat topic list
 *   get_topic_payload(topic)  — last-known payload for an exact topic
 *   search_discovery(query)   — fuzzy name search over the autodiscovery registry
 *
 * The matchers are pure (data injected) so they can be unit-tested without a
 * live broker; the exported tool functions bind them to the bridge singleton.
 */

const bridge = require('../mqtt/bridge.js');

// ── Matching primitives (pure) ──────────────────────────────────────────────

/**
 * Fuzzy score of `needle` against `hay` (both matched case-insensitively).
 * Contiguous substring scores highest (earlier = better); otherwise a
 * subsequence match scores by tightness of span. Returns -1 for no match.
 */
function fuzzyScore(needle, hay) {
    const n = String(needle || '').toLowerCase();
    const h = String(hay || '').toLowerCase();
    if (!n) return 0;
    const idx = h.indexOf(n);
    if (idx >= 0) return 1000 - idx;
    let ni = 0, first = -1, last = -1;
    for (let hi = 0; hi < h.length && ni < n.length; hi++) {
        if (h[hi] === n[ni]) {
            if (first < 0) first = hi;
            last = hi;
            ni++;
        }
    }
    if (ni < n.length) return -1;
    return 500 - (last - first + 1);
}

/** True if any full slash-bounded segment of `topic` equals `seg` (case-insensitive). */
function hasSegment(topic, seg) {
    const s = String(seg || '').toLowerCase();
    return String(topic || '').split('/').some(p => p.toLowerCase() === s);
}

/** Lowercase and strip every non-alphanumeric char (slashes, spaces, hyphens, …). */
function normAlnum(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Parse the topic query grammar. keyword1 may be **multiple words** (fuzzy,
 * order/separator-independent). An optional segment filter is introduced by a
 * comma and/or a standalone `NOT`; everything before it is keyword1.
 *   "keller licht"            → {kw1:"keller licht", kw2:null}
 *   "keller licht, set"       → {kw1:"keller licht", kw2:"set", negate:false}
 *   "keller licht, NOT set"   → {kw1:"keller licht", kw2:"set", negate:true}
 *   "keller NOT set"          → {kw1:"keller",       kw2:"set", negate:true}
 */
function parseTopicQuery(query) {
    const raw = String(query || '').trim();
    if (!raw) return null;
    const firstWord = s => (String(s).trim().split(/\s+/)[0] || null);

    // A standalone NOT (word-bounded) takes precedence and negates the filter.
    const notMatch = raw.match(/(^|[\s,])NOT([\s]|$)/i);
    if (notMatch) {
        const notPos = notMatch.index + notMatch[1].length;
        const kw1 = raw.slice(0, notPos).replace(/[,\s]+$/, '').trim();
        return kw1 ? {kw1, kw2: firstWord(raw.slice(notPos + 3)), negate: true} : null;
    }
    // Otherwise a comma introduces a positive segment filter.
    const commaIdx = raw.indexOf(',');
    if (commaIdx >= 0) {
        const kw1 = raw.slice(0, commaIdx).trim();
        return kw1 ? {kw1, kw2: firstWord(raw.slice(commaIdx + 1)), negate: false} : null;
    }
    // No delimiter → the whole query is keyword1.
    return {kw1: raw, kw2: null, negate: false};
}

/**
 * Pure topic matcher. keyword1 is split into words and each word must fuzzy-match
 * the topic with all separators removed — so word order and separators (`/`, `-`,
 * spaces, none) don't matter ("keller licht" matches "licht/keller",
 * "keller-licht", "kellerlicht"). The optional kw2 must (or, when negated, must
 * NOT) appear as a full topic segment. Returns topics ranked best-first.
 */
function matchTopics(topics, query, limit = 30) {
    const q = parseTopicQuery(query);
    if (!q) return [];
    const words = q.kw1.split(/[^a-z0-9]+/i).filter(Boolean);
    if (!words.length) return [];
    const out = [];
    for (const topic of topics) {
        const flat = normAlnum(topic);
        let total = 0, ok = true;
        for (const w of words) {
            const s = fuzzyScore(w, flat);
            if (s < 0) { ok = false; break; }
            total += s;
        }
        if (!ok) continue;
        if (q.kw2) {
            const seg = hasSegment(topic, q.kw2);
            if (q.negate ? seg : !seg) continue;
        }
        out.push({topic, score: total});
    }
    out.sort((a, b) => b.score - a.score || String(a.topic).localeCompare(String(b.topic)));
    return out.slice(0, limit).map(s => s.topic);
}

/**
 * Pure element matcher — fuzzy over each element's tag/name/category. Every
 * keyword word must fuzzy-match. Returns real catalogue entries so the model can
 * only ever pick a tag that exists.
 */
function matchElements(elements, query, limit = 12) {
    const words = String(query || '').split(/[^a-z0-9]+/i).filter(Boolean);
    if (!words.length) return [];
    const out = [];
    for (const e of (elements || [])) {
        if (!e || !e.tag) continue;
        const hay = normAlnum([e.tag, e.name, e.category].filter(Boolean).join(' '));
        let total = 0, ok = true;
        for (const w of words) {
            const s = fuzzyScore(w, hay);
            if (s < 0) { ok = false; break; }
            total += s;
        }
        if (!ok) continue;
        out.push({e, score: total});
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, limit).map(({e}) => ({
        tag: e.tag, name: e.name, category: e.category, attributes: e.attributes || [],
    }));
}

/** Pure discovery matcher — fuzzy by entity name (and device name). */
function matchDiscovery(entities, query, limit = 20) {
    const q = String(query || '').trim();
    if (!q) return [];
    const out = [];
    for (const e of entities) {
        const nameScore = fuzzyScore(q, e.name);
        const devScore  = fuzzyScore(q, e.config && e.config.device && e.config.device.name);
        const score = Math.max(nameScore, devScore >= 0 ? devScore - 50 : -1);
        if (score < 0) continue;
        out.push({e, score});
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, limit).map(({e}) => ({
        discovery_id:  e.discovery_id,
        name:          e.name,
        component:     e.component,
        device:        (e.config && e.config.device && e.config.device.name) || null,
        state_topic:   (e.config && e.config.state_topic) || null,
        command_topic: (e.config && e.config.command_topic) || null,
        device_class:  (e.config && e.config.device_class) || null,
        payload_on:    e.config && e.config.payload_on,
        payload_off:   e.config && e.config.payload_off,
    }));
}

// ── Bridge-bound tools ──────────────────────────────────────────────────────

function searchTopics(query) {
    return {query, topics: matchTopics(bridge.getAllTopics(), query)};
}

function getTopicPayload(topic) {
    const rec = bridge.getLastPayload(topic);
    if (!rec) return {topic, found: false};
    return {topic, found: true, payload: rec.payload, raw: rec.raw, retained: rec.retain, ts: rec.ts};
}

function searchDiscovery(query) {
    return {query, results: matchDiscovery(bridge.getDiscoveredEntities(), query)};
}

function searchElements(query, elements) {
    return {query, elements: matchElements(elements || [], query)};
}

// ── Provider-agnostic tool specs + dispatcher ───────────────────────────────

const TOOL_SPECS = [
    {
        name: 'search_topics',
        description:
            'Search known MQTT topics. keyword1 may be several words and matches ' +
            'fuzzily regardless of word order or separators — "keller licht" matches ' +
            'licht/keller, keller-licht, kellerlicht. An optional segment filter, ' +
            'written after a COMMA (or after NOT), matches a full topic segment ' +
            '(between slashes) exactly and may be negated. Examples: "keller licht, ' +
            'set" → command topics (wire to publish); "keller licht, NOT set" → state ' +
            'topics (wire to subscribe). Returns matching topic strings, best first.',
        parameters: {
            type: 'object',
            properties: {
                query: {type: 'string', description: 'e.g. "keller licht", "keller licht, set", "keller licht, NOT set"'},
            },
            required: ['query'],
        },
    },
    {
        name: 'search_elements',
        description:
            'Fuzzy-search the available feezal element catalogue by keyword. Returns ' +
            'real element {tag, name, category, attributes}. You MUST pick element ' +
            'tags ONLY from results of this tool (or the catalogue) — never invent a ' +
            'tag. E.g. "switch" → feezal-element-material-switch / ' +
            'feezal-element-paper-switch; "light" → feezal-element-circle-light.',
        parameters: {
            type: 'object',
            properties: {
                query: {type: 'string', description: 'a control/widget kind, e.g. "switch", "light", "gauge", "slider"'},
            },
            required: ['query'],
        },
    },
    {
        name: 'get_topic_payload',
        description:
            'Return the last-known payload of an exact MQTT topic so you can see its ' +
            'shape before configuring an element: JSON object (pick a key for ' +
            'message-property-*), or a scalar/enum (use the real on/off values for ' +
            'payload-on/payload-off, e.g. ON/OFF, true/false, open/closed). May be ' +
            'absent or stale.',
        parameters: {
            type: 'object',
            properties: {
                topic: {type: 'string', description: 'the exact topic string'},
            },
            required: ['topic'],
        },
    },
    {
        name: 'search_discovery',
        description:
            'Fuzzy-search the MQTT auto-discovery registry (Home Assistant / ' +
            'zigbee2mqtt) by device/entity name. Returns matching entities with their ' +
            'component type and resolved state_topic/command_topic, so you can wire a ' +
            'named device without the user pasting topics.',
        parameters: {
            type: 'object',
            properties: {
                query: {type: 'string', description: 'a device or entity name, e.g. "kitchen light"'},
            },
            required: ['query'],
        },
    },
];

/**
 * Execute a tool by name; always resolves to a JSON-serialisable result.
 * `ctx.elements` (the request's element catalogue) backs search_elements.
 */
async function executeTool(name, args = {}, ctx = {}) {
    try {
        switch (name) {
            case 'search_topics':     return searchTopics(String(args.query || ''));
            case 'get_topic_payload': return getTopicPayload(String(args.topic || ''));
            case 'search_discovery':  return searchDiscovery(String(args.query || ''));
            case 'search_elements':   return searchElements(String(args.query || ''), ctx.elements);
            default:                  return {error: 'unknown tool: ' + name};
        }
    } catch (err) {
        return {error: err.message};
    }
}

module.exports = {
    // pure (tested)
    fuzzyScore, hasSegment, normAlnum, parseTopicQuery, matchTopics, matchDiscovery, matchElements,
    // bound tools
    searchTopics, getTopicPayload, searchDiscovery, searchElements,
    // provider integration
    TOOL_SPECS, executeTool,
};

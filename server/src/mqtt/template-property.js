'use strict';

/**
 * A simple "{{ value_json.X }}" template → feezal message-property path
 * ("payload.X"). zigbee2mqtt emits the BRACKET form for some entities
 * ({{ value_json["battery_low"] }}, E124) — both forms are accepted. Anything
 * that computes (a condition, a filter, a table) has no single property and
 * yields undefined.
 */
function templateToProperty(tpl) {
    const m = /\{\{\s*value_json(?:\.(\w+)|\[\s*["'](\w+)["']\s*\])\s*\}\}/.exec(String(tpl || ''));
    return m ? 'payload.' + (m[1] || m[2]) : undefined;
}

module.exports = {templateToProperty};

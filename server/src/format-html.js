'use strict'

const prettier = require('prettier')

// Shared prettier settings for feezal site HTML — used by deploy (socket hub),
// the editor's /format route and anywhere else HTML is pretty-printed, so the
// saved views.html and the source view always match.
const FORMAT_OPTIONS = {parser: 'html', tabWidth: 4, printWidth: 120, bracketSameLine: true}

/**
 * Pretty-print feezal site HTML with prettier's HTML printer.
 *
 * Formatting is purely cosmetic, so this NEVER throws: on any failure the raw
 * input is returned unchanged (the same DOM, just not indented) so a deploy or
 * a format request is never lost. Returns `{html, error}` — `error` is the
 * caught error (or null) so callers can log a diagnostic.
 */
async function formatHtml(html) {
    try {
        return {html: await prettier.format(html, FORMAT_OPTIONS), error: null}
    } catch (error) {
        return {html, error}
    }
}

module.exports = {formatHtml, FORMAT_OPTIONS}

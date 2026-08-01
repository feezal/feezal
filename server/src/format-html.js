'use strict'

const prettier = require('prettier')

// Shared prettier settings for feezal site HTML — used by deploy (socket hub),
// the editor's /format route and anywhere else HTML is pretty-printed, so the
// saved views.html and the source view always match.
//
// B105 — htmlWhitespaceSensitivity: 'ignore'.
// Custom elements have no known CSS display, so prettier treats them as inline
// and under the default 'css' setting refuses to introduce whitespace around
// their tags. That is what produced the reported
//
//     …></feezal-element-glass-light></feezal-view
//     ><feezal-view
//
// — a line break INSIDE a closing tag with the '>' hugging the next opening
// tag. 'ignore' formats every element as a block, so closing tags land on their
// own lines. Attribute formatting (one per line past printWidth) is unaffected;
// what 'ignore' DOES affect is text content, which is why templates are
// shielded below.
const FORMAT_OPTIONS = {
    parser: 'html',
    tabWidth: 4,
    printWidth: 120,
    bracketSameLine: true,
    htmlWhitespaceSensitivity: 'ignore',
}

// <template> contents are stamped into the DOM verbatim, so whitespace there is
// USER CONTENT, not formatting. Under 'ignore' prettier reflows it, and
// reflowing inline markup that has no whitespace between its parts changes what
// renders: `<b>bold</b>glued` becomes `<b>bold</b>\nglued`, which the browser
// collapses to "bold glued" — a space that was not there before. Measured, not
// assumed. So template bodies are lifted out before formatting and put back
// byte-for-byte afterwards.
const TEMPLATE_BLOCK = /(<template\b[^>]*>)([\s\S]*?)(<\/template>)/gi
const placeholder = i => `__FEEZAL_TEMPLATE_BODY_${i}__`

/** Replace every <template> body with an opaque token; returns the bodies. */
function shieldTemplates(html) {
    const bodies = []
    const shielded = html.replace(TEMPLATE_BLOCK, (_match, open, body, close) => {
        bodies.push(body)
        return `${open}${placeholder(bodies.length - 1)}${close}`
    })
    return {shielded, bodies}
}

/**
 * Put the bodies back. The token may have been indented onto its own line, so
 * the whitespace prettier added around it is consumed with it and the body is
 * restored exactly as it came in. The replacement is a function so `$&`-style
 * sequences inside user markup are never interpreted.
 */
function unshieldTemplates(html, bodies) {
    return bodies.reduce((acc, body, i) => {
        const token = new RegExp(`\\s*${placeholder(i)}\\s*`)
        return acc.replace(token, () => body)
    }, html)
}

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
        const {shielded, bodies} = shieldTemplates(html)
        const formatted = await prettier.format(shielded, FORMAT_OPTIONS)
        return {html: unshieldTemplates(formatted, bodies), error: null}
    } catch (error) {
        return {html, error}
    }
}

module.exports = {formatHtml, FORMAT_OPTIONS}

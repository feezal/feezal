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

// ── post-pass ───────────────────────────────────────────────────────────────
// Two shapes prettier cannot be configured into, applied to its output. Both
// run on the SHIELDED text, so template bodies are never touched by them.

const TAB = FORMAT_OPTIONS.tabWidth

/**
 * U92 — which attributes identify an element, in the order they should lead.
 * Monaco's fold shows only an element's FIRST line, so with the bare opening
 * tag there every collapsed element looks identical.
 */
const IDENTIFYING = {
    // U92: a view is identified by its name, not by label/subscribe.
    'feezal-view': ['name'],
    // U96 — elements with NO `label`, whose fold would otherwise show a bare
    // tag. Audited by listing every element without a `label` attribute and
    // keeping only those that have something genuinely identifying; the ones
    // that merely have `subscribe` need no entry, since the default already
    // ends in `subscribe`.
    'feezal-element-basic-icon': ['icon', 'subscribe'],
    'feezal-element-basic-icon-value': ['icon', 'subscribe'],
    'feezal-element-material-icon-button': ['icon', 'subscribe'],
    'feezal-element-basic-image': ['src', 'subscribe'],
    'feezal-element-basic-svg': ['src', 'subscribe'],
    'feezal-element-system-script': ['name', 'subscribe'],
    'feezal-element-circle-plant': ['name', 'subscribe'],
    // the dialog-view family embeds a view — which one it is IS its identity
    'feezal-element-eink-dialog-view': ['view', 'subscribe'],
    'feezal-element-glass-dialog-view': ['view', 'subscribe'],
    'feezal-element-material-dialog-view': ['view', 'subscribe'],
    'feezal-element-paper-dialog-view': ['view', 'subscribe'],
}
const IDENTIFYING_DEFAULT = ['label', 'subscribe']
const MAX_JOINED = 2

const OPEN_TAG_ALONE = /^(\s*)<([a-zA-Z][\w-]*)$/
const ATTRIBUTE_LINE = /^\s*([a-zA-Z_:][\w:.-]*)=/

/**
 * U92 — pull the identifying attributes up onto the opening-tag line.
 *
 * Prettier's HTML printer knows exactly two shapes: everything on one line, or
 * the tag alone with EVERY attribute on its own line. There is no "keep the
 * first N attributes beside the tag", hence this join.
 *
 * Deliberately not width-aware: the identifying line may run past printWidth,
 * which is the entire point — it is what you read when the element is folded.
 * Only attributes that are already FIRST are joined; the pass never reorders
 * (serialization does that), so hand-written source with `label` further down
 * is left exactly as written.
 */
function joinIdentifyingAttributes(lines) {
    const out = []
    for (let i = 0; i < lines.length; i++) {
        const open = OPEN_TAG_ALONE.exec(lines[i])
        if (!open) {
            out.push(lines[i])
            continue
        }
        const wanted = IDENTIFYING[open[2]] || IDENTIFYING_DEFAULT
        let joined = lines[i]
        let count = 0
        while (count < MAX_JOINED && i + 1 < lines.length) {
            const next = lines[i + 1]
            const attr = ATTRIBUTE_LINE.exec(next)
            // Stop at the first non-identifying attribute, and never swallow the
            // line that CLOSES the opening tag — that would change its shape.
            if (!attr || !wanted.includes(attr[1]) || next.trimEnd().endsWith('>')) break
            joined += ' ' + next.trim()
            i++
            count++
        }
        out.push(joined)
    }
    return out
}

// B107 — an attribute line ending `></tag>`: prettier parks the `>` on the last
// attribute line (bracketSameLine) and, for an EMPTY element, glues the closer
// straight onto it. Group 2 must start with a non-`<` character so a compact
// one-line element (`<tag a="1"></tag>`) is left alone — only a continuation
// line is split.
const GLUED_CLOSE = /^(\s*)([^<\s].*?)><\/([a-zA-Z][\w-]*)>\s*$/

/**
 * B107 — put the closing tag of a multi-line empty element on its own line.
 *
 * The closer is indented one level out from the attribute lines, which is where
 * the opening tag sits — no need to track it, prettier's indentation is
 * regular.
 */
function splitGluedClosingTag(lines) {
    const out = []
    for (const line of lines) {
        const glued = GLUED_CLOSE.exec(line)
        if (!glued) {
            out.push(line)
            continue
        }
        const [, indent, body, tag] = glued
        out.push(`${indent}${body}>`)
        out.push(`${' '.repeat(Math.max(0, indent.length - TAB))}</${tag}>`)
    }
    return out
}

/**
 * Both passes are idempotent, which is what keeps formatting a fixed point:
 * a joined opening tag no longer matches OPEN_TAG_ALONE, and a split closing
 * tag no longer matches GLUED_CLOSE.
 */
function postProcess(html) {
    let lines = html.split('\n')
    lines = joinIdentifyingAttributes(lines)
    lines = splitGluedClosingTag(lines)
    return lines.join('\n')
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
        // Post-process while still shielded, so the passes cannot reach into
        // template bodies either.
        return {html: unshieldTemplates(postProcess(formatted), bodies), error: null}
    } catch (error) {
        return {html, error}
    }
}

module.exports = {formatHtml, FORMAT_OPTIONS, IDENTIFYING, IDENTIFYING_DEFAULT}

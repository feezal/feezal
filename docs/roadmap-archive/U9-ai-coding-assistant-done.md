# U9 — AI coding assistant ✅ done

*Archived roadmap item — Editor UX. Open items: [../ROADMAP.md](../ROADMAP.md) · Index: [README.md](README.md)*

> **Status: 🔨 Phases 1–3 done.** Phases 1 & 2 (design + source mode, OpenAI-compatible / Ollama / Anthropic providers, server-side conversations + history, file context) and Phase 3 (agent/tools mode — archived U26/U27; new-view creation via the `<!-- @new-view: Name -->` directive) are implemented. The template-editor sparkle button was **dropped** (not wanted). Minor Phase-2 polish remains deferred (Monaco diff-overlay, whole-document source scope, context-window ring). See [Phasing](#phasing).

An AI chat assistant integrated into the feezal editor, inspired by [hobbyquaker/she](https://github.com/hobbyquaker/she)'s Monaco-based assistant. Unlike she (which is source-only), feezal's assistant works in **both** editing modes:

- **Design mode (live canvas)** — the default. The assistant edits the view's HTML under the hood; the user never sees raw HTML. Before applying, it asks for a simple **confirmation** ("Changing the current view…") and then applies the change straight to the canvas.
- **Source mode (Monaco, N15)** — proposals are shown as a Monaco diff overlay, as in she.

The model contract is identical in both modes (it always returns the full proposed view HTML); only the *presentation and apply* differ by mode.

> **Prerequisite:** U7 (Monaco bundled + `feezal-monaco-loader.js`) and N15 (source view) are required for source-mode diffs. Design mode depends only on the editor canvas and works without the source view.

#### Entry point — toolbar button (config-gated)

A single **icon-button** toggles the assistant:

- **Position:** rightmost in the editor top bar, after the sidebar-tab icon row in `#menu-right` (the last control in the [feezal-app-editor.js](../../www/src/feezal-app-editor.js) toolbar).
- **Icon:** a small **android** glyph (`android` Material Icons ligature), using the existing `.icon-btn` + `<span class="material-icons">` style — same size, hover, and `.active` treatment as the Inspector / Theme / Palette buttons — so it reads as a native toolbar control.
- **Conditional visibility:** the button renders **only when an AI backend is configured** in the Editor Settings tab. With no provider/key set it is hidden entirely (discoverability comes from the settings panel, not a dead button). Visibility reacts live to a `feezal:ai-config-changed` event, so enabling a backend reveals the button without a reload.
- **Active state:** while the panel is open the button shows the standard `.active` highlight.

#### Panel layout & UX

The assistant is a **resizable panel docked to the right window edge**, overlaying the right-sidebar region (never the canvas), with a drag handle on its left border (min ~320 px, max ~640 px; width persisted to `localStorage`). A single `feezal-ai-chat` Lit element is reused unchanged in both modes.

Visual design takes cues from **Claude Code / Claude's chat UI** — calm, content-first:

- Vertical message stream: user turns right-aligned in a subtle bubble; assistant turns full-width plain text with comfortable line-height; generous spacing; monospace only inside code / indicator blocks.
- Slim header: conversation title, model selector, new-conversation (＋) and history (🕘) actions.
- Bottom **composer**: auto-growing textarea, an animated "thinking" affordance while streaming, and a stop (■) button that replaces send during a request.
- In design mode a proposal shows a compact **confirmation card** (see Apply flow) rather than walls of code.
- **Dark/bright mode:** the panel inherits the editor theme. All colours route through the existing feezal CSS custom properties (`--feezal-bg`, `--feezal-color`, `--feezal-border`, `--sl-color-*`) and the `:host(.dark)` propagation already used for the other editor panels — no hardcoded hex. Code blocks and the Monaco diff use the matching light/dark theme. Verify both themes before shipping (element-spec §8.2 discipline).

```
┌───────── editor top bar ──────[Inspector][Theme]…[Editor][🤖]┐
├──────────────────────────────────────────┬──────────────────┤
│                                           │ 🤖 Assistant   ＋🕘│
│   Canvas (design mode)                    │──────────────────│
│   — or — Monaco (source mode)             │   …user…         │
│                                           │   …assistant…    │
│                                       ⟷ ◀│  ┌─ confirm ────┐ │  ← drag handle
│                                       drag │  │ Change view? │ │
│                                           │  │  ✓ Accept  ✕ │ │
│                                           │  └──────────────┘ │
│                                           │──────────────────│
│                                           │ context chips    │
│                                           │ [ textarea ] ▶/■ │
└───────────────────────────────────────────┴──────────────────┘
```

#### Context sent to the model

A **context chips row** sits above the composer (she-parity):

| Context piece | Source | Control |
|---|---|---|
| Target view HTML | design: the active canvas view (implicit). source: a view chosen via the target-view selector (see below) | toggle / view-scope chip |
| Feezal element catalogue | `feezal.elements` + each `static get feezal()` (name, attributes, defaultStyle) | toggle (default on) |
| Known MQTT topics | `/api/topics/completions` topic trie | toggle (default on) |
| Element-spec reference | bundled `docs/element-spec.md` excerpt | toggle (default off) |
| Extra files | user-added other views' HTML, element sources, arbitrary text/markdown | per-file chip |

Adding files matches she exactly: a **"+" button** opens a hidden `<input type="file" multiple>`, **drag-and-drop** onto the panel adds files, and each becomes a removable chip `{name, content}` with a language badge. The current-view chip can be toggled off to ask general questions without sending the view.

A **prompt-size indicator** shows the estimated request size (bytes + rough token count). When the active model's context window is known (e.g. via Ollama model info), a small **context-usage ring** visualises `promptBytes / contextWindow`, as in she.

The element catalogue is serialised as compact JSON in the system prompt so the model emits valid element tags, attribute names, and defaults without hallucinating APIs.

#### View scope (source mode has no active view)

Unlike design mode — where the active canvas tab *is* the working view — source mode loads the **entire site** into Monaco (`feezal.site.outerHTML`, every view — see [feezal-app-editor.js:1295](../../www/src/feezal-app-editor.js#L1295)), so there is **no implicit current view**. Therefore, in source mode:

- The context row shows a **target-view selector** listing the document's `<feezal-view name>`s plus a **"Whole document"** option.
- If the user sends an edit request **without** having picked a target, the assistant **asks first** — *"Which view should I work on?"* — and lists the available views, rather than guessing.
- The chosen view's `<feezal-view>` block is what gets sent as context and what the model's reply replaces. Splicing is keyed by the view's **`name` attribute** (unique within a site); the prompt instructs the model to **preserve `name`** and not rename or reorder views, so the target block is unambiguous. If a scoped reply's `name` does not match the target (model renamed/dropped it), the apply is **rejected** rather than guessed.
- **"Whole document"** scope is reserved for genuine cross-view edits (e.g. renaming an MQTT topic across every view); the reply must echo **every** `<feezal-view>` back, and the Monaco diff is the safety net for that larger change.

#### System prompt & output contract

The system prompt is the contract that makes wholesale view replacement safe (there is no `data-fid` reconciliation — an omitted element is a deleted element). It is kept as a **server-side template** (tunable without a client release), stamped with the feezal version, and assembled per request. It must specify:

**Role & domain.** "You edit feezal *views*: HTML made of absolutely-positioned `<feezal-element-*>` custom elements driven by MQTT. Position/size live in inline `style` (`position:absolute; top/left/width/height`)."

**Output contract (load-bearing):**
- Return the **complete** HTML for the working scope — never a fragment. The editor **replaces the whole scope** with the reply, so any element you omit is **deleted**. Echo unchanged elements **verbatim** (same tags, attributes, inline styles, order).
- Make the **minimal** change the request needs.
- Emit exactly **one** ```` ```html ```` fenced block; prose/explanation goes **outside** it.
- Scope boundary: design mode → the view's **inner** elements only (no `<feezal-view>` wrapper); source mode → the chosen `<feezal-view name="…">…</feezal-view>` block(s) intact (see View scope).
- **Edit vs. answer:** for questions ("what does this view do?") reply in prose with **no** code block — the *absence* of a block is the signal not to apply.

**Element rules (ground truth = the injected catalogue):**
- Use only element tags and **kebab-case attributes present in the catalogue** — never invent elements or attributes.
- Wire MQTT via `subscribe` / `publish` / `message-property`; honour each element's `defaultStyle` / `restrict` minimums when adding.
- Prefer topics from the **Known MQTT topics** list; if you must guess a topic, say so in prose.

**Reliability aid:** include one tiny **few-shot example** (a small view + a request + the correct full-HTML reply) — the cheapest way to lock the output format.

The prompt is **mode-agnostic** (identical for design and source); only the client-side *apply* differs.

#### Output validation & safety (client-side)

The system prompt asks for clean output, but the client **must not trust it** — model HTML is injected into the live DOM and persisted into saved views. Before applying (both modes), the editor parses and **validates** the proposed HTML and **rejects** it with an error card if it contains any of: a non-`feezal-element-*` / non-whitelisted tag, `<script>` / `<iframe>` / `<object>`, any `on*` event-handler attribute, `javascript:` URLs, or an element tag not present in the catalogue. Inline `style` is constrained to a safe property set. A rejected proposal shows "Can't apply — `<reason>`" with the raw HTML available in the expander; it is **never** silently applied.

#### Apply flow — branches by editor mode

**Design mode (confirmation, no HTML shown):**

1. The model's HTML code block is parsed (`parseBlocks()`, ```` ```html ```` fences) but **never rendered as text**.
2. A simple **confirmation card** appears in the chat — *"Changing the current view…"* — with actions **Accept** · **Discard** · **Always accept** (session flag, per she's auto-apply). No per-element diff is computed or shown.
3. **Accept** applies the proposed HTML to the canvas via the existing N15 apply path (the inspector already rewrites `feezal-view.innerHTML` and rebinds interact.js — see [feezal-sidebar-inspector.js:398](../../www/src/feezal-sidebar-inspector.js#L398)), then calls `feezal.app.change()` **exactly once**, which pushes a single whole-site `innerHTML` snapshot onto the editor undo stack (`_history`) — so one Ctrl+Z reverts the entire change. *(Caveat: that stack is shallow — ≈5 entries, shared with manual edits — so AI changes do not get unlimited undo depth.)* A toast confirms ("View updated").
4. Optional **"view as HTML"** expander (collapsed by default) for power users who do want to see the raw diff.

> **Apply timing & failures:** the code block is parsed only **after** the stream completes (no apply on partial output). If an *edit* request yields no code block, the assistant treats the reply as an answer and shows no card; if a reply fails [Output validation](#output-validation--safety-client-side), it surfaces the error card instead of applying.

**Source mode (Monaco diff, she-style):**

0. **Establish the target view first.** Monaco holds the whole site, so if no target view is selected the assistant asks which view to work on before proposing changes (see *View scope* above); "Whole document" is allowed for cross-view edits.
1. The model returns the proposed HTML for the chosen scope (the target `<feezal-view>` block, or the whole document). An **Apply** button opens a `MonacoDiffEditor` overlay: left = current buffer, right = proposed — the editor splices a view-scoped reply back into the correct `<feezal-view>` block before diffing.
2. Toolbar: **Accept** (writes to the Monaco model) · **Discard** · **Always accept**.
3. After accepting, the user saves normally (Ctrl+S).

Both modes also support a **new-view directive** ✅ — the model begins its `html` block with `<!-- @new-view: Name -->` to create a new view instead of editing the current one (feezal's take on she's `// @new-file:` hint).

#### Template editor integration (U7 follow-up)

A simpler **sparkle button** (✨) appears next to the template textarea / Monaco editor in the attribute inspector. Clicking it opens a compact prompt popup: "Describe what the template should display" → calls the AI with the element's `subscribe` topic and last known payload as context → streams the generated template string directly into the editor. No diff view — the result replaces the current template immediately (the user can Ctrl+Z to undo).

#### Backend & providers

A server endpoint proxies AI requests and streams responses:

```
POST /api/ai/chat        { messages, context, model } → SSE text/event-stream (token stream)
GET  /api/ai/config      → { configured, provider, model }   (never returns the API key)
GET  /api/ai/models      → available models for the configured provider
GET  /api/ai/model-info  → context window / params (Ollama), when available
```

The server builds the full system prompt (context injection) and streams tokens so the panel shows partial output live, with a stop button (AbortController) that saves the partial reply.

**Supported providers** (configured in server config, she-parity selection UX):

| Provider | Auth | Notes |
|---|---|---|
| OpenAI | `apiKey` | `gpt-4o`, `gpt-4.1`, … |
| Anthropic | `apiKey` | `claude-sonnet-4-5`, … |
| Ollama (local) | none | `http://localhost:11434` — fully offline; exposes context-window info |
| OpenAI-compatible | `apiKey` (optional) | LM Studio, llama.cpp, vLLM, … |

- The panel header has a **model dropdown** populated from `/api/ai/models`, with the choice persisted to `localStorage` (`feezal:selectedModel`).
- Config is **global per server** (not per-site). The API key / endpoint are stored in the server config and **never** sent to the browser or written into `views.html`.
- The **Editor Settings tab** (`feezal-sidebar-editor.js`, `build` icon) gains an **AI** section: provider select, API key / endpoint inputs, model select, and a "Test connection" button. Saving emits `feezal:ai-config-changed`, which both reloads the panel's config and toggles the toolbar android button's visibility live.

#### Conversations

Following she, conversations persist **server-side** so history survives reloads and is browsable:

```
POST   /api/ai/conversations          save { id, title, messages }
GET    /api/ai/conversations          list { id, title, updatedAt }[]
GET    /api/ai/conversations/:id      load full message log
DELETE /api/ai/conversations/:id      delete
```

- A `conversationId` (generated client-side) is kept in `localStorage`; the title is the first user message (truncated).
- The panel header exposes **New conversation** (＋) and a **history** (🕘) timeline of past conversations, with delete.
- Context (current view + extra files) refreshes automatically when the user switches views or editing modes.

> Supersedes the earlier "localStorage-only, no server persistence" idea — she-parity (browsable history) requires server-side conversations.

#### Phasing

The full spec is large; build incrementally so each phase ships value and de-risks the next.

- ✅ **Phase 1 (MVP) — done:** design mode; OpenAI-compatible + Ollama providers; `localStorage` conversations; element-catalogue + known-topics context; confirmation-card apply with client-side **output validation** and the server-built **system-prompt contract**; config-gated android toolbar button + right-docked resizable panel + AI settings section.
- ✅ **Phase 2 — done:** source mode (target-view selector + Monaco-buffer context + splice-apply via `executeEdits`); Anthropic native provider; **server-side** conversations + history timeline; file-context chips (＋ / drag-drop) + prompt-size (token) estimate.
  - *Deferred within Phase 2:* the separate **Monaco diff-overlay**, the **"Whole document"** source scope, and the **context-window usage ring** (needs a provider model-info endpoint).
- ✅ **Phase 3 — done:** agent / tools mode (archived [**U26**](U26.md) / [**U27**](U27.md)) and new-view creation (via the `<!-- @new-view: Name -->` output directive). *(Template-editor sparkle button dropped — not wanted.)*

Phases 1–2 shipped across commits (`2220abd`, `529e85a`, `4fe798b`, `5912450`, `ef56757`, `37fddff`). The Scope list below is the full feature.

#### Scope
1. `server/src/routes/api.js` — `/api/ai/chat` (SSE), `/api/ai/config`, `/api/ai/models`, `/api/ai/model-info`, and `/api/ai/conversations` CRUD.
2. `server/src/app.js` — AI config loading (`config.ai: { provider, apiKey, model, endpoint }`) + conversation store (flat files under `<dataDir>/ai/`).
3. `www/src/feezal-ai-chat.js` — new Lit element: right-docked resizable panel, message stream, streaming + stop, context chips (+ add / drag-drop), model dropdown, prompt-size / context ring, dual-mode apply (design confirmation / source Monaco diff), conversation history. Claude-Code-inspired styling; full dark/bright support via feezal CSS vars.
4. `www/src/feezal-app-editor.js` — rightmost **android** `.icon-btn` in the top bar, gated on AI-configured; mount `feezal-ai-chat`; single-undo apply integration.
5. `www/src/feezal-sidebar-editor.js` — **AI** settings section (provider / key / model / endpoint, test) emitting `feezal:ai-config-changed`.
6. ~~`www/src/feezal-template-editor.js` — sparkle button for template generation~~ — **dropped** (not wanted).

#### Out of scope (MVP)
- AI in the viewer (the assistant is editor-only).
- **Agent / tools mode** — letting the model query live MQTT values / last payloads to ground its answers (feezal's analog of she's `ctxTools`). ✅ **Done** — see archived [**U26**](U26.md).
- ~~`// @new-file:` → new-view creation~~ — ✅ done (via the `<!-- @new-view: Name -->` directive).
- Per-site AI configuration — one global config per server is enough.

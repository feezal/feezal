# Script element (`feezal-element-system-script`)

Client-side scripting glue — the feezal answer to vis's bindings and HA's
Jinja templating, but MQTT-native and deliberately minimal. A script
subscribes to topics, computes, and publishes the result **page-locally**
(or to the broker); any plain display element bound to that topic shows it.
Conversely, a slider publishing locally becomes script input.

It is glue, **not an automation engine**: logic that must run reliably 24/7
belongs in [she](https://github.com/hobbyquaker/she) or Node-RED. Scripts run
per open viewer page, and only while that page is open.

## Quick start

1. Drag **Script** (System category) onto the canvas — position and size
   don't matter; the viewer shows nothing.
2. Write the script in the inspector's Monaco editor (completions for the
   `fzl` API included).
3. Deploy, then **reload the viewer** — script edits apply on the next page
   load (publish anything to `<site>/reload` to push a reload to all
   connected viewers).

```js
// Average of two sensors, recomputed on every message:
let kitchen, living;
fzl.sub('home/kitchen/temp', p => { kitchen = Number(p); update(); });
fzl.sub('home/living/temp',  p => { living  = Number(p); update(); });
function update() {
    if (kitchen === undefined || living === undefined) return;
    fzl.pub('avg-temp', ((kitchen + living) / 2).toFixed(1));
}
// Any element subscribed to "avg-temp" now shows the average.
```

## The `fzl` API

| Call | Effect |
|---|---|
| `fzl.sub(topic, (payload, topic) => {})` | Subscribe (MQTT wildcards allowed). Origin-agnostic — receives broker messages and page-local publishes alike. Returns an **unsubscribe function**. |
| `fzl.pub(topic, value)` | Publish **page-locally**: only elements/scripts on this page receive it. Nothing reaches the broker, nothing is retained. |
| `fzl.mqtt.pub(topic, value, {retain})` | Publish to the **broker**. |
| `fzl.onViewChange(view => {})` | Fires with the current view name immediately on registration and on every view switch (nav element, swipe, hash, MQTT). |
| `fzl.log(...)` | `console.log` prefixed with the element's `name`. |

Plain `setTimeout` / `setInterval`, `fetch`, `document`, `window` and the
`feezal.*` globals are all simply available — the element isolates nothing.

**Payload convention** (both directions): JSON **objects/arrays only**. A
payload starting with `{` or `[` arrives parsed (raw string if unparseable);
numbers, booleans and bare strings arrive as **strings** — deliberately
avoiding the `"1.5"` vs `1.5` ambiguity. Publishing mirrors this:
objects/arrays are stringified, everything else passes through `String()`.

## Execution model

- **Viewer only.** Scripts never run in the editor — the editor serializes
  the page DOM on save, so script-made DOM changes would be persisted into
  the dashboard. Test in a viewer tab.
- **Once per page load**, after the connection is up, on the **main thread
  with full DOM access** — no sandbox. Scripts are trusted code (dashboard
  authors hold the editor password); they debug natively in the browser
  devtools.
- Each script element runs in its **own function scope** — top-level
  `const`/`let` don't collide between script elements. Deliberate sharing
  goes through `window` or locally published topics.
- Subscriptions register directly with the connection — they are **not**
  gated by view visibility / `dynamic-subscriptions`.
- Uncaught errors (sync, async and in callbacks) are logged to the console
  prefixed with the element name.
- The source is stored inside the element as
  `<script type="text/feezal">…</script>` — visible and editable in source
  view as part of the page HTML.

## Caveats — read before scripting

- **Per-client broker publishes:** the script runs in *every open viewer*.
  A `setInterval` calling `fzl.mqtt.pub` fires **once per connected client**.
  Page-local `fzl.pub` is unaffected (it never leaves the page).
- **No last-value replay for local topics:** a late subscriber (element on a
  view activated later, or a freshly loaded page) has no value until the
  script's next publish — exactly like any non-retained broker topic.
  Scripts that need sticky values republish on a timer or target a
  broker-retained topic.
- **Dual-source topics:** the same topic name can carry broker *and* local
  messages. Feature (simulate/override device values during development) and
  footgun — there is no origin flag.
- **A busy loop freezes the page.** No watchdog — trusted code.
- **Strict CSP:** script execution uses `new Function`, which requires
  `script-src 'unsafe-eval'`. Relevant when hosting static exports behind a
  hardened CSP.
- **DOM changes are per-client and ephemeral** — gone on reload, never
  persisted.

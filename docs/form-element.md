# Form element (`feezal-element-system-form`)

A **view as a web form**. The Form element embeds one of your views (the same
live-clone mechanism as `layout-view`) and turns its members into fields:
every element inside that carries a **`feezal-id`** becomes a field, keyed by
that id. Pressing the submit button runs a small script — by default it
publishes all values as **one JSON object** to the form's `publish` topic.

```
{ "name": "Ada", "email": "ada@example.org", "newsletter": true }
```

## Quick start

1. Create a view for the form body — e.g. `contact` — and drop some inputs
   on it (Material/Carbon **input**, **select**, **slider**, **checkbox**,
   **radio**, **switch**) plus a **button**.
2. Give each input a **`feezal-id`** in the inspector (`name`, `email`, …).
   Elements without one are not part of the payload — opt-in, not magic.
3. Give the button the feezal-id **`submit`**.
4. On another view, drag **Form** (System category) onto the canvas, pick the
   `contact` view, set `publish` to e.g. `forms/contact`, size the box.
5. Deploy and open the viewer: fill the form, press the button → one JSON
   message on `forms/contact`.

Without a member button carrying the submit-id, the form renders its **own**
submit button under the embedded view (`submit-label`).

## Attributes

| Attribute | Default | Meaning |
|---|---|---|
| `view` | — | The view embedded as the form body. |
| `publish` | — | Topic the default script publishes to (`form.topic` in the script). |
| `submit-id` | `submit` | feezal-id of the member button that submits. No member with it → the form's own button. |
| `submit-label` | `Submit` | Label of the form's own button. |
| `label` | — | Editor-only placeholder label (never shown in the viewer). |

Members keep their own behaviour: an input with its own `publish` topic still
publishes on every change — the form only **reads** values. Leave a member's
publish topic empty to keep it quiet.

## The script

Always a script, edited in the inspector's Monaco editor, prefilled with:

```js
fzl.mqtt.pub(form.topic, form.values());
```

It runs **on every submit**, in the viewer only, with the full `fzl` API
(see [script-element.md](script-element.md)) plus a `form` object:

| Call | Effect |
|---|---|
| `form.values()` | `{feezalId: value, …}` over the embedded view's members. |
| `form.topic` | The form's `publish` attribute. |
| `form.attr(name)` | Any attribute of the form element. |
| `form.publish(obj?, {retain})` | One-liner: publish `obj` (default `form.values()`) as JSON to `form.topic`. |
| `form.reset()` | Restore every member to the value it had when the form was shown. |
| `form.el(id)` / `form.val(id, value?)` | A member by feezal-id, scoped to **this** form (not the whole page — `fzl.el` does that). |

### Cookbook

**Validate before publishing** — not publishing IS the validation:

```js
const v = form.values();
if (!v.name || !/@/.test(v.email)) { fzl.log('incomplete'); return; }
form.publish();
form.reset();
```

**Webhook instead of MQTT** — replace the publish with a `fetch`. The site's
CSP must allow the host: add it to **`connect-src`** in the Site Settings
security section, or the browser blocks the request.

```js
await fetch('https://hooks.example.org/contact', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(form.values()),
});
fzl.view('thanks');   // button-triggered view switch
```

**Retain the last submission** so a late viewer sees it:

```js
form.publish(form.values(), {retain: true});
```

## Caveats

- **`feezal-id` is resolution, not uniqueness.** Layout-app keeps warm clones
  of visited views and component instances stamp copies. Inside a form the
  lookup is scoped to the embedded clone, so this rarely matters — but two
  members sharing an id yield one key (the first in document order).
- The form embeds a **clone**; the original view is untouched. Editing the
  source view in the editor changes the next deploy, not the live form.
- The editor shows a placeholder only — nothing is embedded or run on the
  canvas.
- Scripts use `new Function` → `script-src 'unsafe-eval'` under a strict CSP,
  same as the Script element.

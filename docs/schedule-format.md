# feezal schedule JSON format

The contract between the schedule editor element
(`feezal-element-material-schedule`) and whatever **executes** the schedule —
a [she](https://github.com/hobbyquaker/she) script, a Node-RED flow, a
thermostat adapter. feezal only *edits* schedules: the element renders the
retained schedule JSON from its subscribe topic and publishes the edited
schedule (retained) to its publish topic on **Save**. Executing it is the
consumer's job.

## Shape

```json
{
    "type": "boolean",
    "week": {
        "mon": [ {"from": "06:30", "to": "08:00", "value": true} ],
        "tue": [], "wed": [], "thu": [], "fri": [],
        "sat": [ {"from": "08:00", "to": "10:00", "value": true} ],
        "sun": []
    },
    "default": false,
    "exceptions": []
}
```

| Field | Meaning |
|---|---|
| `type` | `"boolean"` (on/off) or `"number"` (setpoint per block, e.g. `21.5`). |
| `week` | One array of blocks per weekday key `mon`…`sun`. Missing keys = no blocks. Blocks must not overlap; the editor keeps them sorted by `from`. |
| `from` / `to` | `"HH:MM"` — half-open interval `[from, to)`. `"24:00"` is a valid `to`. |
| `value` | The value that applies inside the block (`true`/`false` or a number). |
| `default` | The value that applies **outside** all blocks. |
| `exceptions` | **Reserved** for date exceptions / holiday calendars (a later tier). Consumers must tolerate — and editors must preserve — whatever it contains; the current editor passes it through verbatim and ignores it. |

## Time semantics — wall clock, no timezone

Times are **naive wall-clock strings**. `"06:30"` means 06:30 on the
**consumer's** clock, whatever timezone that machine is in. There is no
timezone field and no UTC conversion anywhere — this is deliberate: human
schedules ("wake at 6:30") are wall-clock by nature, and DST needs no
handling ("06:30" stays 06:30 through every change). If the editing browser
and the consumer are in different timezones, the consumer's zone wins.

## Consuming the schedule

Pseudo-code for an executor evaluating the schedule at local time `now`:

```js
const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const blocks = schedule.week[days[now.getDay()]] || [];
const hhmm = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const min = now.getHours() * 60 + now.getMinutes();
const block = blocks.find(b => hhmm(b.from) <= min && min < hhmm(b.to));
const value = block ? block.value : schedule.default;
// … apply `value` (publish to the device, set the thermostat, …)
```

Recommended consumer behaviour:

- **Subscribe to the schedule topic** (the editor publishes retained, so the
  latest schedule replays on connect) and re-evaluate on every change plus
  once a minute (or at each block boundary).
- **Tolerate unknown fields** — the format may grow (`exceptions`,
  per-schedule metadata). Never fail on extra keys.
- Treat a malformed document as "no schedule" (apply `default` if known,
  otherwise do nothing) rather than crashing.

## Editor behaviour (for reference)

- Edits are local until **Save** — one retained publish of the whole
  document. **Revert** restores the last received payload.
- A remote schedule update arriving while the editor holds unsaved changes
  is **not** applied silently; the element shows a "changed remotely" hint
  and the user decides (Save overwrites, Revert adopts).
- The `type` attribute on the element selects the editing mode for new
  schedules; a typed incoming payload wins over the attribute for rendering.

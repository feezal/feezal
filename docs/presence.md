# Viewer presence & per-client control topics

Every feezal viewer announces itself on the site's MQTT topic tree and listens
for per-client commands there. This is pure topic convention — no new
protocol, no extra service: anything the editor's Clients panel can do, any
MQTT automation can do too.

Presence is **on by default** and requires a site *Publish Topic*
(`<publish>` below) — the status is state the viewer *publishes*. Per-client
commands additionally need the site *Subscribe Topic* (`<subscribe>` below);
with only a Publish Topic set, viewers announce themselves but take no
commands (monitoring-only). Disable presence in the editor under **Viewer
Settings → Site → Viewer presence** (sets `presence="off"` on
`<feezal-site>`).

**Connection toasts (U48).** The transient "Connected as …" / renamed pop-ups
can be silenced without turning presence off — **Viewer Settings → Site →
Viewer presence → "Show connection toasts"** (sets `presence-toasts="off"` on
`<feezal-site>`). Presence, status publishing and per-client commands all keep
working; only the on-screen notifications go quiet. The sticky "already online
in another browser" warning is never suppressed — it flags a real
misconfiguration. Handy on a wall-mounted panel that reloads often.

## Client identity

On first run a viewer generates a random client ID (`viewer-x7k2` style) and
persists it in the browser's `localStorage` (`feezal-client-id`). The ID is
per **browser profile**, not per tab — two tabs share one identity. A
dismissible corner toast ("Connected as \"viewer-x7k2\"") shows the ID on
connect so you can find the entry in the editor's Clients panel.

Friendly names (`hallway-panel`) are assigned by **renaming from the editor**
(or by publishing to the `rename` topic, see below) — there is no viewer-side
prompt. IDs must be topic-safe: `[A-Za-z0-9][A-Za-z0-9_-]*`.

## Topic convention

Topics follow the direction of the two site attributes — outgoing state under
the publish topic, incoming commands under the subscribe topic:

```
<publish>/clients/<id>/status        retained status JSON; cleared on disconnect

<subscribe>/clients/<id>/view        per-client commands mirroring the
<subscribe>/clients/<id>/reload      site-wide control-topic set …
<subscribe>/clients/<id>/theme
<subscribe>/clients/<id>/playlist
<subscribe>/clients/<id>/addclass
<subscribe>/clients/<id>/removeclass
<subscribe>/clients/<id>/rename      … plus rename (per-client only)
```

- Presence of *all* clients is one subscription: `<publish>/clients/+/status`.
- The split matches directional broker ACLs (e.g. Tasmota-style
  `cmnd`/`stat` trees): viewers only ever *write* into the publish tree and
  *read* from the subscribe tree — a viewer needs no write access to the
  command tree.
- Sites that set subscribe and publish to the same topic get the classic
  single `<site>/clients/<id>/#` subtree per client.
- The **site-wide control topics** (`<subscribe>/view`, `<subscribe>/reload`,
  …) remain and keep controlling **all** running instances — the per-client
  subtree is additive.

## Status payload

Published retained on connect and republished on every view change:

```json
{
    "view": "Kitchen",
    "connectedSince": "2026-07-09T18:31:04.512Z",
    "lastChange": "2026-07-09T18:42:11.007Z",
    "connection": "direct",
    "userAgent": "Mozilla/5.0 (…)"
}
```

- `connection` is `direct` (viewer speaks MQTT-WS itself) or `bridge` (viewer
  goes through the feezal server's Socket.IO bridge).
- **Offline = cleared topic** (empty retained publish). There is no heartbeat:
  - *Direct-MQTT viewers* register a broker **LWT** (last-will) that clears
    the status on ungraceful disconnect. An explicitly configured LWT in the
    connection settings takes precedence over the presence will.
  - *Bridge viewers* register their status topic with the server, which
    publishes the retained clear when the socket disconnects.

## Commands

Publish to `<subscribe>/clients/<id>/<command>`; payloads are identical to
the site-wide control topics. Commands require the site Subscribe Topic —
without it, viewers are announce-only:

| Command | Payload |
|---|---|
| `view` | view name to switch to |
| `reload` | anything — triggers `location.reload()` |
| `theme` | theme name (`feezal-theme-dark-mint` or just `dark-mint`) |
| `playlist` | `on` / `off` / `pause` / `next` / `prev` |
| `addclass` / `removeclass` | CSS class to add/remove on `<feezal-site>` |
| `rename` | new client ID (topic-safe, see above) |

On `rename` the viewer clears its old retained status, persists the new ID,
re-subscribes its command subtree and republishes its status under the new
ID. Note: a direct-MQTT viewer's broker LWT still points at the *old* status
topic until the next page load — firing it clears an already-empty topic,
which is harmless.

**Collisions:** if another instance is already online under the same ID
(e.g. a cloned `localStorage`), the viewer shows a warning toast but
proceeds — status is last-writer-wins and both instances obey the shared
command subtree. IDs are never auto-suffixed, because broker ACLs may be
keyed to the name.

## Editor Clients panel

The **Clients** tab in the editor sidebar lists all online viewers live from
`<publish>/clients/+/status` — ID, current view, connection type,
online-since, user agent — with per-client actions **Switch view / Set theme
/ Reload / Rename**, each just publishing to the client's command subtree
under `<subscribe>` (the actions are disabled while the site has no
Subscribe Topic).

## Privacy

While a viewer is connected, its status JSON — **current view, connect/change
timestamps, and browser user agent** — sits **retained on the MQTT broker**,
readable by anyone who may subscribe to `<publish>/clients/#`. If that is not
acceptable, switch presence off (Viewer Settings → Site → Viewer presence) or
restrict the subtree with broker ACLs.

## Automation examples

With `subscribe = home/dash/cmnd` and `publish = home/dash/stat`:

```
# Is anyone looking at a dashboard right now?
subscribe home/dash/stat/clients/+/status      # any retained payload = someone online

# Send the hallway panel to the Alarm view
publish home/dash/cmnd/clients/hallway-panel/view  →  Alarm

# Reload every viewer (site-wide topic, unchanged)
publish home/dash/cmnd/reload  →  1
```

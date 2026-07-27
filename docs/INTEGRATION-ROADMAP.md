# feezal Integration Roadmap — embedding feezal in other ecosystems

**Status: she = active work; everything else = research (July 2026).**

- **[she](#she) is the priority** and the only target with committed work — it is the strategic pairing (same author, complementary layers: she automates, feezal displays) and the green field where the "special elements" adapter pattern below gets built first.
- **Home Assistant, Node-RED and ioBroker remain future ideas.** The research below stands and is worth keeping, but none of it is scheduled. Do not let it pull work away from the she track.

Nothing outside the she section is committed work. This document collects the research and design directions for making feezal comfortably installable *from within* other smart-home platforms: Home Assistant, Node-RED, she, and ioBroker. Companion to [ROADMAP.md](ROADMAP.md) (feature roadmap) — items here reference roadmap IDs where they interact (A19, N24, E52, …).

---

## Guiding principles

1. **MQTT is the integration bus.** Feezal already interoperates with every platform below *today*, with zero integration code, wherever an MQTT broker sits in the middle. Integrations are therefore **packaging, hosting, configuration and discovery conveniences** — never a second data plane.
2. **One architecture.** Feezal 0.x lived inside Node-RED with a msg-based data plane and a `/feezal/` path prefix; feezal 2.0 deliberately dismantled that (the Node-RED backend was removed, A6 removed the prefix). Integrations must not fork the architecture again: no per-platform connection protocols in the viewer unless a platform earns it (see ioBroker Shape B, the one candidate exception).
3. **Auth stays delegated.** The `--trust-proxy-auth` header mechanism and the A19 "lean on the broker" direction are the two auth stories. Platform integrations plug into these (HA ingress headers, ioBroker web auth, reverse proxies) rather than growing per-platform user systems.
4. **The static export is an integration feature too.** Several platforms have a "just serve files" slot (HA `config/www` + Webpage dashboard, ioBroker `onlyWWW` adapters, any reverse proxy). The export is the zero-server integration tier and should be mentioned in every platform's docs.

5. **Neither side may become required.** feezal must stay fully usable with **no she**, and she must stay fully usable with **no feezal** — the integration is user-friendliness, never a dependency. Concretely: every capability reachable *through* an integration must have a path that does not use it; integration UI appears only when the other side is actually detected (no dead buttons on a standalone install); and no element, view or feature may be authored in a way that only works when the partner is present. **The adapter-script work below is where this rule is easiest to break** — see the note there.

---

## Cross-cutting platform work (prerequisites)

These serve multiple targets and should land before/alongside the first integration package.

### I1 — Base-path / relative-URL support ⚠️ the big one

Feezal currently assumes it is served at `/`. HA ingress serves add-ons at `/api/hassio_ingress/<token>/`, and a Node-RED hosting node would mount at `{httpNodeRoot}/<path>/`. Required:

- **Vite builds with relative base** (`base: './'`) for editor and viewer; audit `fetch()`/asset/router URLs for absolute paths.
- **Socket.IO client path derivation** from `location.pathname` (HA's ingress strips the prefix before proxying, so the *server* keeps its default `/socket.io` path — only the client needs the prefixed path). Alternative/addition: server injects the externally visible base (from the `X-Ingress-Path` request header) into `index.html` as `window.__BASE_PATH__`.
- Cookie paths (editor session) must be prefix-safe; note HA ingress's known single-`Set-Cookie` quirk.
- This partially reverses A6 ("remove the `/feezal/` prefix") — the difference: the prefix becomes *externally imposed and runtime-derived*, never hardcoded. uibuilder's documented proxy pain shows client-side path discovery is the fragile part; prefer server-injected base where a header is available.

### I2 — Container & headless-config hardening

- Env-var config exists (`FEEZAL_PORT`, `FEEZAL_DATA`, `FEEZAL_EDITOR_PASSWORD`) — extend to cover **MQTT connection pre-seeding** (`FEEZAL_MQTT_URL`, `FEEZAL_MQTT_USER`, `FEEZAL_MQTT_PASSWORD` → default site `config.connection`), so a wrapper script can wire auto-discovered broker credentials without touching the UI.
- **Auth-disable switch** (`FEEZAL_AUTH=none`) for deployments where the platform authenticates upstream (HA ingress, ioBroker web adapter). Optionally auto-relax when requests carry `X-Ingress-Path` / originate from the ingress gateway.
- **Source-IP allowlist option** (HA add-ons must accept connections only from the Supervisor's ingress gateway `172.30.32.2`).
- **Published multi-arch image** (amd64 + aarch64) on GHCR. The `Dockerfile` exists; CI publishing does not. HA add-ons, ioBroker docker users, and docker-compose pairings with she all consume the same image — build once.

### I3 — Proxy-auth user attribution

`--trust-proxy-auth` already trusts a configurable header. Extend the documented mapping to HA ingress's `X-Remote-User-Id` / `X-Remote-User-Name` / `X-Remote-User-Display-Name` headers (precedent: Music Assistant auto-login). Interacts with A19 (roles) and N24 (client identity).

### I4 — Housekeeping (cheap, do first)

- **~30 `www/packages/@feezal/*/package.json` files** still point `repository`/`homepage`/`bugs` at the defunct `github.com/feezal/node-red-contrib-feezal` — fix.
- The **stale Flow Library entry** [flows.nodered.org/node/feezal](https://flows.nodered.org/node/feezal) (v0.8.1, 2021) still advertises the old Node-RED node. Refresh or retire it deliberately as part of the Node-RED decision below — don't leave it rotting.

---

## Home Assistant

### Mechanism (research summary)

- Add-ons were renamed **"Apps"** in HA 2026.2 — pure rename, Supervisor mechanism unchanged. Apps are Docker containers installed from a git "app repository" (`repository.yaml` + one folder per app with `config.yaml`); they get a sidebar panel, **ingress** (authenticated reverse proxy at `/api/hassio_ingress/<token>/`, websocket-capable, session cookie enforced by the Supervisor), options UI (`options`/`schema` → `/data/options.json`), watchdog, and backups.
- **Apps only exist on HA OS / Supervised installs.** Container/Core users get docs: same Docker image + a "Webpage" dashboard (successor of `panel_iframe`); the community `hass_ingress` custom integration re-implements ingress for them (mention, don't depend on).
- **MQTT service discovery**: `services: ["mqtt:want"]` + bashio (`bashio::services mqtt "host"|"username"|…`) hands the app auto-created credentials for the Mosquitto add-on — zero MQTT config for the user. Precedent: Zigbee2MQTT.
- **Auth**: ingress *is* the auth layer — apps must not show their own login on the ingress port; identity arrives via `X-Remote-User-*` headers. Direct-port exposure (wall panels!) stays optional (`ports: null` by default) with feezal's own auth active there — the two-door model ESPHome (`leave_front_door_open`) and Grafana (`grafana_ingress_user`) use.
- **HACS is not applicable** to server software (it installs integrations/frontend resources only). Possible niche: distributing the *static export* into `config/www`.
- Closest overall model: **Zigbee2MQTT's add-on** (Node.js + MQTT discovery + websocket frontend through ingress + prebuilt GHCR multi-arch images).

### Recommended shape

A **`feezal/hassio-addon` repository** wrapping the standard feezal image:

- `config.yaml`: `ingress: true`, `ingress_stream: true`, `init: false`, `panel_icon: mdi:view-dashboard`, `services: ["mqtt:want"]`, `ports: {"3000/tcp": null}` (direct port opt-in for wall panels), `webui`, `watchdog`, `map: [addon_config:rw]`.
- ~20-line bashio `run.sh`: options + discovered MQTT credentials → `FEEZAL_*` env vars (I2), `FEEZAL_DATA=/data`, `FEEZAL_AUTH=none` on the ingress port + source-IP check (I2), then `exec node`.
- Viewer connection default in add-on mode: **server-bridged** (Socket.IO through ingress). Direct-to-broker websocket MQTT cannot pass through ingress — viewers on wall tablets use the direct port and the broker's websocket listener instead; document both.
- Multi-arch image via `home-assistant/builder` GitHub Actions; own repo with the one-click `my.home-assistant.io` add-repository badge (community add-ons org doesn't take submissions).

### Work items

1. I1 + I2 + I3 (prerequisites — ingress is the forcing function for all three).
2. Add-on repo: config.yaml, run.sh, DOCS.md, icon, builder CI.
3. Docs page for Container/Core users (docker-compose + Webpage dashboard + `hass_ingress` pointer; static export into `config/www` as the zero-server tier).

### Open questions

- Editor behind ingress in an iframe: drag/resize (interact.js) and keyboard shortcuts need verification inside HA's panel iframe.
- Map `X-Remote-User-*` to N24 client identity? (A viewer opened via ingress could default its client ID to the HA username.)
- Whether to request inclusion in the community add-ons org later vs. staying self-hosted permanently.

---

## Node-RED

### History (research finding — worth remembering)

Feezal **was born as a Node-RED node**: `node-red-contrib-feezal` (Nov 2018) → renamed `feezal` (0.5.0–0.8.1, Jan 2021), mounted on `RED.httpNode`, Socket.IO on `RED.server` under `/feezal/socket.io`, **msg-based data plane** (the node cached last values per topic and replayed to viewers; element events left the node as msgs). Lineage: DashUI/yahui → node-red-contrib-polymer → feezal. **Feezal 2.0 (July 2026) deleted the Node-RED backend entirely** — "Only the mqtt backend remains". The old package is still listed on the Flow Library (see I4).

### Mechanisms (research summary)

- Embedding surfaces: `RED.httpNode` (runtime web apps, covered by `httpNodeAuth`), `RED.httpAdmin` (editor concerns — custom routes are **not** auto-protected; each needs `RED.auth.needsPermission()`), `RED.server` (attach websockets at a unique path — this is official practice), editor sidebar plugins.
- Incumbents: **Dashboard 2.0** serves its Vite build on `httpNode` + Socket.IO on `RED.server` at `{path}/socket.io`, msg-based with a server-side datastore; **uibuilder** optionally runs its *own Express server on a separate port* as a proxy-friendly escape hatch, and its clients demonstrably struggle to auto-discover socket paths behind prefixes; **worldmap** is the "node hosts an external web app" precedent (static mount + socket on `RED.server`).
- Websocket upgrades on `RED.server` bypass `httpNodeAuth` — socket auth is always the package's own problem.
- **MQTT-native hosting has precedent**: TotallyInformation's live-updates example (browser speaks MQTT-over-websocket directly, no flow round-trip); **`node-red-contrib-aedes`** runs a broker inside Node-RED and can bind its MQTT-websocket listener to a *path on Node-RED's own HTTP server* — single process, single port, broker + flows + dashboard.
- Packaging: scoped name (`@feezal/node-red-…`), `node-red` keyword, manual Flow Library submission, scorecard (`node-red-dev validate`), example flows expected. Shipping a prebuilt `dist/` is normal.

### Recommended shape: side-by-side now, hosting-only node later if demand shows

**Shape A — full re-embed with a msg data plane: rejected.** It is exactly what 2.0 dismantled — it would resurrect a second connection backend, a server-side replay store duplicating MQTT retain, dual persistence, and the path-prefix pain, for an architecture the project deliberately left behind.

**Shape C — side-by-side (do now, mostly documentation):**
- A **"Using feezal with Node-RED" docs page + example flows**: driving elements from core mqtt nodes, feezal's site control topics (`<site>/view|theme|reload|addclass`), N24 per-client topics once shipped, and the **aedes recipe** (broker inside Node-RED, feezal viewers connect to its websocket path — no separate broker to run).
- Optionally a **thin convenience package** (`@feezal/node-red-feezal-tools` or similar): typed nodes pre-wired for feezal's control-topic conventions + packaged example flows + an editor sidebar link/iframe to the feezal editor. Cheap Flow Library presence; must ship real convenience or skip it (a links-only node scores poorly).

**Shape B — hosting-only node (build if palette-install distribution proves valuable):** a config node that mounts the **built viewer bundle** (editor optional, later) on `RED.httpNode` at a configurable path, worldmap-style — while data stays MQTT (external broker or aedes). Requires I1 (the mount path is a base-path problem). Explicitly *not* Shape A: no msg data plane, no flow round-trip.

### Work items

1. I4 housekeeping (stale Flow Library entry + repo URLs) — independent of everything else.
2. Docs page + example flows (Shape C) — no code changes needed.
3. Decide on the convenience package after the docs page exists.
4. Shape B only after I1 lands and only on demonstrated demand.

### Open questions

- Reclaim the npm name `feezal`'s old 0.8.1 listing (refresh to point at feezal 2.x as *related software*) vs. request delisting?
- Does the convenience package register node types (scorecard wants unique type names — not bare `feezal`)?

---

## she

### Mechanism (research summary)

- she (`smart-home-engine` on npm, same author) is a **single Node.js daemon**: sandboxed JS scripts over MQTT, Express 5 + ws + Svelte web UI (Monaco IDE with AI assistance), Matter controller, sheDB document store, node-schedule + suncalc scheduling. Install: `npm i -g` + `she --install` (dedicated system user + systemd unit) or Docker; config in `~/.she/config.json` (CLI > `SHE_*` env > file), runtime-readable/writable via `GET/PUT /she/config`.
- **There is no plugin system** — and the philosophy doesn't want one. Extension surfaces: user scripts (hot-reloaded, full Node privileges), npm packages in the data dir, script-registered HTTP routes (`/api/<script>/…`), and a full HTTP API (notably `PUT /she/scripts/<name>` — a script can be installed remotely with one call). A "system scripts" concept exists only as an explicitly doubted BACKLOG entry.
- **MQTT conventions feezal can consume directly**: mqtt-smarthome `logic/connected` retained status (`"2"`/LWT `"0"`); variables as retained JSON `{val, ts, lc}` on `var/status/<name>`; **sheDB views publishable retained to MQTT** (`publish: true, retain: true`) — a ready-made producer for feezal's planned history-in-payload convention; `she.influx.getLast/getRange` for series; lat/lon + suncalc for astro topics.
- Very young public project (May 2026) but extremely active, dogfooded, and the successor to the author's 12-year-old mqtt-scripts. No existing dashboard pairing — green field.

### Recommended shape: sibling service + shared broker config + a bridge-script bundle

"she plugin installs feezal" decomposes into three cheap, philosophy-matching pieces (a she script *spawning* the feezal server was evaluated and rejected — hot-reload orphans children, she is not a process supervisor):

1. **Install**: feezal mirrors she's own pattern — `feezal --install` creating a dedicated user + systemd unit (precedent: `she --install`), plus a documented docker-compose pairing. The "plugin" is then one documented command (or a one-shot she script that shells out to it).
2. **Shared broker config**: the feezal installer reads she's `config.json` (same host, file-level access — robust regardless of she's auth mode) to pre-seed `FEEZAL_MQTT_URL` etc. (I2). One broker config for the pair.
3. **Bridge-script bundle — the actual integration**: a small set of she scripts, installable via `PUT /she/scripts/…` (or copy-paste; she has no script-package format):
   - **Schedule consumer** — subscribes to feezal's E52 retained schedule topic, re-registers `she.schedule()` entries on change (hot-reload teardown makes this natural). *Research resolves an E52 open question: she has **no serialized schedule format** — feezal defines the contract, she consumes it. Solar events must be representable (`{"pattern": "sunset", "shift": -1620}`).*
   - **History publisher** — `she.influx.getRange` → retained JSON series per topic (the history-in-payload convention consumer/producer pair with E69/E70/E30).
   - **Astro publisher** — retained sunrise/sunset/phase topics daily (feeds a future astro element; keeps feezal dumb).
   - Later: a **per-viewer credential provisioner** using she's Mosquitto dynsec API (`she.broker.*`) — a concrete enabler for A19's broker-ACL model and N24's per-client credentials.
4. **UI level**: plain links between the two UIs (nginx example exists in she's docs). No embedding — neither side has UI extension points; don't invent them. *Refined below in "UI integration": deep links to a specific script are the good version of this rule; embedding stays rejected.*


### Special elements — element-shipped adapter scripts

**The problem weather exposes.** Every element feezal ships renders something a broker *already* carries: Homematic, zigbee2mqtt, ESPHome and evcc all publish themselves. **Weather does not exist on MQTT until somebody puts it there.** Drop the card on a dashboard and there is nothing to subscribe to — the element is a demo until the user solves an unrelated problem. The same is true of any REST-only source: energy prices, pollen and air quality, transit departures, and the astro publisher already planned above.

**The shape.** A "special" element ships its own **she adapter script**. feezal offers to deploy it when the element is added; the script fetches over HTTP and publishes to MQTT **as Home-Assistant discovery**, so the resulting data arrives through feezal's *existing* discovery machinery — ⚡ picker, Generate wizard, device grouping — with no new data path. feezal itself never speaks HTTP to a weather API; the adapter does.

#### Decided (07/2026)

**1. Deployment: feezal's server calls `PUT /she/scripts/<name>`.** she's HTTP API already supports installing a script in one call. This needs a she base-URL setting, credentials, and sane failure handling (she unreachable, auth rejected, script rejected) — and it does mean feezal grows an **outbound HTTP client**, which is a deliberate exception to "MQTT is the integration bus": the bus principle governs the *data plane*, and this is provisioning. Worth stating plainly in the settings UI so nobody is surprised that feezal talks to she directly.

*Alternative considered:* an MQTT-mediated installer (feezal publishes a request, a small resident she script performs the local install) would have kept feezal transport-pure at the cost of a one-off manual bootstrap. Rejected in favour of the simpler direct call — recorded here because the trade-off may look different once a second engine wants the same treatment.

**2. Scripts publish standard HA discovery — plain `sensor` entities sharing one `device`.** No invented component, no squatting on the `homeassistant/` namespace with a `weather` type HA does not define (which would make a real HA instance on the same broker log errors it cannot act on). Consequences:
- the data is immediately useful to **other** consumers, HA included — the adapter is not feezal-only;
- feezal needs **one new, generally useful capability: wire a whole device group into a multi-topic element**. Today a card consumes one entity; a weather card consumes eight. **[E161](roadmap-archive/E161.md)** ✅ already supplies the grouping (`getDeviceGroups()`, `/api/discovery/device-groups`) — what is missing is the picker/Generate side that says *"wire this group into this element"*. That mechanism pays off beyond weather.

**3. Scripts live in the element package; parameters come from she where she already has them.** e.g. `feezal-element-material-weather/she/weather-yr.js`, keeping the element self-contained per the **A23/A24** externalization rule. **Location is not asked twice** — she already carries lat/lon in its own config (it uses them for suncalc/astro), so the script reads them from she rather than feezal prompting. feezal only collects what she cannot supply: provider choice, an API key where the provider needs one, units and poll interval.

#### she is a convenience here, not a requirement

Per **principle 5**, a "special" element must be **fully usable without she**. The adapter script is one way to fill its topics — not the definition of the element. That means:

- **the element's contract is the discovery/MQTT shape, not the script.** Any publisher satisfying it works: a Node-RED flow, a cron job, a shell script, Home Assistant itself, or a hand-wired set of topics. The script is the convenient default, and the reason the contract is *standard HA discovery* rather than something feezal-specific is precisely so it is not the only producer;
- **the copy-paste path stays**, for users who do not run she or who want to read the script before it runs;
- **the deploy affordance appears only when she is detected** — a standalone feezal shows the element, its topics and the script for copying, and no button that cannot work;
- **no element ships as "she-only".** If an element cannot be configured without deploying a script, it is mis-designed.

The same applies in reverse: nothing here should require a she user to run feezal.

#### The adapter-script contract

Requirements every element-shipped script must meet, so the deploy flow can be generic and the result is predictable:

| requirement | why |
|---|---|
| **Publishes HA MQTT discovery** (`homeassistant/<component>/…/config`, retained) | the whole point — data arrives through the existing pickers |
| **One `device` per adapter instance**, stable `unique_id`s | groups the entities, and makes re-deploy idempotent instead of duplicating |
| **Retained state topics** | a dashboard opened at 3am shows data immediately, not after the next poll (cf. **B40**) |
| **An availability topic** | feezal already consumes availability (**N31**) — an adapter that stops should grey its cards, not show stale numbers |
| **Idempotent, safe to re-run** | re-deploy on element re-add must not create a second copy |
| **Declared parameters** | the deploy dialog is generated from them; secrets marked as such |
| **Respects provider rate limits and ToS**, attribution included in the script | a copy-pasted script that quietly violates a provider's terms is a bad thing to hand someone |
| **Version + provenance stamp** | feezal can tell "deployed, current" from "deployed, outdated" |

#### Open questions

- **How does feezal know the script is deployed and healthy?** she publishes `logic/connected`; an adapter could publish its own availability topic (above) and feezal could show *deployed / running / stale* on the element. Needs a convention.
- **Discovery of she itself** — detect via `logic/connected` and only then offer deployment, or make it an explicit setting? Detection is friendlier; a setting is predictable.
- **Two feezal instances, one she.** Both may offer to deploy the same adapter. Stable script names make that idempotent rather than duplicating, but "who owns this script" is unresolved.
- **Un-deploy.** Removing the element should probably offer to remove the script — but not if another dashboard still uses its topics.

---

### UI integration — deep links, and sheDB views that feed a repeater

**Next step for the she track (07/2026).** Two ideas, and they need separating because one refines the standing principle and the other would overturn it.

#### Deep linking is in scope; embedding is still not

Principle 4 above says *"plain links between the two UIs. No embedding — neither side has UI extension points; don't invent them."* **Deep linking is the good version of that principle, not an exception to it:** an element whose adapter script feezal deployed already knows the script's name, and feezal will already know she's base URL (the deploy decision above requires it). So *"open this element's adapter in she"* is a link with a better target — no embedding, no extension point, nothing invented.

**Embedding stays rejected** on the original reasoning, which has not changed: neither side exposes UI extension points, and building one on both sides to host the other is a large, permanent coupling for a convenience. If that is ever revisited it should be its own decision, not a side effect of adding a link.

*Research needed:* she's editor URL scheme for a named script, and whether it is stable enough to link against.

#### sheDB views → repeater: the data path already works

**`layout-repeater` already does this.** It *"dynamically creates one child element per item in an MQTT JSON-array payload"*, with `subscribe`, `message-property`, `child-element`, `attribute-map`, `key-field` and `preview-count`. sheDB views can already publish retained JSON to MQTT (`publish: true, retain: true`). **So the end-to-end path exists today with zero new code** — a sheDB view feeding a repeater is a configuration exercise, not a feature.

What is missing is **ergonomics**, in two places:

1. **Finding the topic.** Today the user must know it. she could be asked over its HTTP API (the client the deploy decision introduces), or publish an index topic.
2. **Writing `attribute-map` by hand.** This is the real friction: the user must know the array's field names and hand-author a JSON mapping onto the child element's attributes.

#### Build the mapping UX against *any* array, not against sheDB

**feezal can already sample the shape without asking anyone:** the topic is retained, so subscribing yields an array whose first item's keys *are* the available fields. A mapping UI driven by that sample — pick a field, pick a child attribute — needs **no she API, no coupling, and works for every JSON-array publisher**, sheDB included.

That keeps the valuable part portable and reduces the she-specific work to a thin, optional convenience: *listing* the available views so the user picks one instead of typing a topic. Same reasoning as the adapter decision above — build on the open contract, add the vendor-specific layer only where it genuinely helps. It also means this work is not blocked on the she track at all.

#### Both ideas must degrade to nothing

Per **principle 5**: with no she present, the deep link simply is not rendered — not a disabled button — and the repeater mapping UI works exactly as well, because it reads the retained payload rather than asking she. Neither idea may become the only way to do something.

#### Open questions

- **Is she's script-editor URL stable and linkable?** The whole deep-link idea rests on it.
- **Where does the link live** — on the element (inspector), or in one "integrations" surface listing every deployed adapter and its health? The latter scales better once several elements ship adapters, and is the natural home for the *deployed / running / stale* state the section above already wants.
- **Does she list sheDB views over HTTP**, and are view topics discoverable enough to enumerate without it?
- **Reverse direction** — she linking back into a feezal dashboard or a specific element. Symmetrical and probably cheap, but needs a stable feezal deep-link scheme (a view is addressable via `#/<view>`; an individual element is not).

### Worked example — E20, the weather element

*Merged from `ROADMAP.md` (07/2026): the element spec and its data supply belong together, and this is the first adapter.*

#### Provider analysis

| provider | key needed | format | notes |
|---|---|---|---|
| **MET Norway / yr.no** | **no** | JSON (`locationforecast/2.0/compact`) | Best default: global, free, documented. **But** requires a descriptive `User-Agent` (generic ones are blocked) and honouring `Expires` / `If-Modified-Since` — polling too eagerly gets a client throttled. Attribution required. |
| **DWD via Bright Sky** | **no** | JSON | The practical DWD path: raw MOSMIX is KMZ/XML and miserable to parse in a small script. Germany-focused. |
| **OpenWeatherMap** | yes | JSON | Simplest API, global, but needs a key and has free-tier limits. The "I already have a key" option, not the default. |

**Ship yr.no first**, Bright Sky second, OWM third. Poll every 10–30 minutes and honour cache headers.

#### The element spec (as merged)

A wall-display-optimised weather card. Shows current conditions prominently and an N-day or N-hour forecast strip. Data is entirely MQTT-driven: each data point comes from a separate topic, making it compatible with any weather provider that publishes to MQTT (e.g. via a bridge from openweathermap, DWD, yr.no).

*Inspiration (awesome-web-components, July 2026):* **XWeather** — a set of web components implementing parts of the OpenWeatherMap API — is a useful reference for the condition/icon mapping and layout, even though feezal's element stays MQTT-driven rather than calling a weather API directly (keeps it provider-agnostic and credential-free).

**Visual concept:** top half — large animated SVG weather icon (sunny, partly cloudy, rainy, snowy, foggy, thunderstorm, etc.) with current temperature in a large typeface, and a secondary info row (feels-like, humidity, wind, UV index). Bottom half — a horizontal forecast strip: 5–7 slots, each with abbreviated day name, small weather icon, and high/low temperature bar.

**Animated weather icons:** SVG-based inline animations (clouds drifting, sun rays rotating, rain drops falling, snow drifting). Editor mode shows static icons.

**Current conditions topics:**

| Attribute | Description |
|---|---|
| `subscribe-condition` | Weather condition string (see condition map below) |
| `subscribe-temperature` | Current temperature |
| `subscribe-feels-like` | Apparent temperature |
| `subscribe-humidity` | Relative humidity (%) |
| `subscribe-wind-speed` | Wind speed |
| `subscribe-wind-direction` | Wind direction (degrees or cardinal string) |
| `subscribe-uv-index` | UV index (0–11+) |
| `subscribe-pressure` | Atmospheric pressure (hPa) |
| `subscribe-visibility` | Visibility (km) |

**Condition map** (configurable via `condition-map` JSON attribute to adapt non-standard payloads):
`sunny`, `partlycloudy`, `cloudy`, `fog`, `rainy`, `pouring`, `snowy`, `snowy-rainy`, `hail`, `lightning`, `lightning-rainy`, `windy`, `windy-variant`, `exceptional`, `clear-night`

**Forecast strip:** each of up to 7 forecast slots is configured as a JSON array topic. `subscribe-forecast` receives a JSON array payload:
```json
[
  {"day": "Mon", "condition": "sunny",       "high": 24, "low": 14},
  {"day": "Tue", "condition": "partlycloudy","high": 21, "low": 12},
  ...
]
```

**Display attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `unit` | `°C` \| `°F` | `°C` | Temperature unit |
| `wind-unit` | string | `km/h` | Wind speed unit label |
| `show-forecast` | boolean | `true` | Show forecast strip |
| `show-feels-like` | boolean | `true` | Show apparent temperature |
| `show-wind` | boolean | `true` | Show wind speed/direction |
| `show-humidity` | boolean | `true` | Show humidity |
| `show-uv` | boolean | `false` | Show UV index |
| `show-pressure` | boolean | `false` | Show pressure |
| `condition-map` | string | `{}` | JSON map of custom payload → standard condition string overrides |
| `location-label` | string | `""` | Optional location name shown above the icon |

**Default size:** 280×280 px (wider when forecast strip is enabled).

#### What the adapter publishes

Scalars as HA `sensor` entities under one `device` (temperature, feels-like, humidity, wind speed/direction, pressure, UV, visibility, condition). **The forecast array is the one thing HA discovery has no shape for** — publish it on the device's own topic and let the element's `subscribe-forecast` take it; the device grouping keeps it discoverable alongside the rest. This is the concrete case that will shape the group-wiring mechanism, so design it here rather than in the abstract.

### Work items

1. `feezal --install` (systemd self-install à la she) + compose pairing docs.
2. I2 (env pre-seeding) + config-adoption logic (read she's config.json when present).
3. The bridge-script bundle, shipped in feezal's repo (`integrations/she/` or similar) with install instructions — blocked on E52 (schedule contract) for the scheduler script; history/astro scripts are unblocked.

### Open questions

- Where does the bridge-script bundle live and version — feezal repo, she repo, or its own package? (If she's "system scripts" concept ever ships, these are prime candidates.)
- Should feezal's editor detect `logic/connected` and surface she's presence (topic autocomplete boost, status chip)?

---

## ioBroker

### Mechanism (research summary)

- Historical note (verified): hobbyquaker co-initiated ioBroker (successor of his CCU.IO) and wrote **DashUI**, the direct ancestor of vis. Homecoming angle available if wanted.
- Adapters are npm packages `iobroker.<name>` with `io-package.json`; UI-hosting shapes: **(1)** static `www/` served by the ioBroker.web adapter + data via socket adapters (vis-2, jarvis), **(2)** web *extensions* loaded into web's Express process (for lightweight route handlers — wrong fit for a stateful Socket.IO app; all major dashboards avoided it), **(3)** standalone daemon with its own port (lovelace — a full HA-frontend fork with its own server; the closest analog to feezal).
- **Data**: (a) `ioBroker.mqtt` adapter — server mode makes ioBroker *be* a broker (states↔topics, dots↔slashes, **websocket MQTT listener on port+1**), client mode mirrors states to an external broker; quirks: ack semantics ("send ack=true too" needed for device-confirmed values), set/get topic-split option, loop hazards, simulated retain. (b) **native socket layer** — `@iobroker/socket-classes` commands (`getState/setState/subscribe/getObjectView/…`, per-user ACLs) via `@iobroker/socket-client`; note it is **no longer real Socket.IO** (pure ws with simulated protocol). Inside an adapter process, plain adapter-core (`subscribeForeignStates`/`setForeignState`) is the natural API.
- **Distribution**: PR into ioBroker.repositories (latest → stable), automated repochecker + human review (jsonConfig admin UI required, `info.connection` state, `unload` cleanup, web attrs named `port/bind/secure/…`), `iobroker` npm org as package owner. Non-free licenses have precedent (vis-2 is CC-BY-NC + paid pro), so GPLv3 feezal is unproblematic.
- **Auth**: web-adapter-served UIs inherit ioBroker users/OAuth2 for free; a standalone-port adapter gets nothing automatically (lovelace had to hack its own).

### Recommended shape: standalone adapter first, native backend as the evolution

- **Phase 1 — `iobroker.feezal` daemon adapter wrapping the feezal server** (the lovelace model): jsonConfig admin dialog (port, data dir, MQTT settings), `localLinks` button to open the UI, `info.connection`, watchdog/restart handling. Data via the **documented `ioBroker.mqtt` pairing** (server mode: viewers can use its websocket listener directly; client mode: user's existing Mosquitto). Ships fast; feezal unchanged.
- **Phase 2 — native ioBroker connection backend** (the one justified per-platform backend, because it runs **server-side at one seam**): inside the adapter process, adapter-core feeds feezal's existing Socket.IO bridge — state IDs presented as topics (dots↔slashes, mirroring ioBroker.mqtt's mapping), commands as `setForeignState(id, val, ack:false)`. The browser side stays unchanged. This unlocks what MQTT-mode can't: **object metadata** (names, roles, units, min/max, rooms/enums) for a first-class binding picker, and ioBroker-user auth if the UI is additionally web-adapter-hosted.
- Explicitly avoid: web-extension embedding (wrong fit) and porting the viewer to `@iobroker/socket-client` (second client protocol in the browser — violates principle 2).

### Work items

1. Phase-1 adapter (scaffold via `@iobroker/create-adapter`, jsonConfig, spawn/supervise the server, docs for both mqtt-adapter modes incl. the set/get topic-split recommendation and ack pitfall).
2. Repositories submission (latest), review compliance, `iobroker` org ownership.
3. Phase 2: connection-backend abstraction at the server's MQTT seam (`server/src/mqtt/bridge.js`) + state↔topic mapping + ack semantics; evaluate topic-picker fed by `getObjectView` metadata.
4. Optional polish: serve the static viewer build via web adapter `www/` for its auth/cert handling.

### Open questions

- Phase 2 topic namespace: raw dots↔slashes only, or role-aware convenience topics? (Keep it mechanical first.)
- Editor persistence in a multihost setup — file DB vs. staying on the adapter host's filesystem.
- Compact mode for phase 1: likely no (own Express+Socket.IO stack); revisit if the server slims down.

---

## Comparison & sequencing

| Target | Effort to first ship | Feezal code changes needed | Distribution reach | Notes |
|---|---|---|---|---|
| **she** | Low (docs + scripts + `--install`) | I2 only | Small (young project, same audience overlap) | Green field; resolves an E52 question; strategic pairing (same author, complementary layers) |
| **Node-RED (Shape C)** | Low (docs + example flows) | None | Large (Flow Library) | I4 housekeeping regardless; Shape B only on demand |
| **Home Assistant** | Medium (add-on repo + I1/I2/I3) | I1 is real work | Largest | I1 is the gate; Zigbee2MQTT is the template |
| **ioBroker phase 1** | Medium (adapter + review process) | I2; none architecturally | Large (DE-centric) | Phase 2 is the only justified per-platform backend |

⚠️ **Superseded by the status note at the top: she first, the rest are ideas.** The ordering below is the research-phase view, kept for its reasoning.

**Suggested order:** I4 + I2 first (cheap, shared) → she + Node-RED docs tier (near-free wins) → I1 → HA add-on (the flagship, forces I1/I3 to be right) → ioBroker phase 1 → ioBroker phase 2 when the adapter proves demand.

---

## Global open questions

- **Repo layout**: integration wrappers in-tree (`integrations/hassio/`, `integrations/she/`, `integrations/iobroker/`, `integrations/node-red/`) vs. separate repos per platform (HA add-on repos must be standalone git repos with `repository.yaml` — that one is forced; the others are a choice).
- **Support surface**: each integration multiplies the QA matrix (TESTING.md sections per platform per the project's checklist rule) — decide how much of the matrix is "community supported" vs. maintained.
- **Version coupling**: wrappers pin a feezal image/npm version; define how wrapper releases track feezal releases (lockstep major, like element packages?).
- **N24/A19 interplay**: platform-provided identity (HA ingress headers, ioBroker users) vs. feezal's own client-ID and broker-ACL story — needs one coherent doc once both ship.

---

## Sources

Condensed from four research passes (July 2026). Key references:

- **HA**: [App config reference](https://developers.home-assistant.io/docs/apps/configuration/) · [Presentation/ingress](https://developers.home-assistant.io/docs/apps/presentation/) · [Security](https://developers.home-assistant.io/docs/apps/security/) · [Apps rename](https://frenck.dev/renaming-home-assistant-add-ons-to-apps/) · [Zigbee2MQTT add-on](https://github.com/zigbee2mqtt/hassio-zigbee2mqtt) · [Grafana add-on](https://github.com/hassio-addons/addon-grafana) · [Node-RED add-on](https://github.com/hassio-addons/addon-node-red) · [X-Ingress-Path usage](https://community.home-assistant.io/t/how-to-use-x-ingress-path-in-an-add-on/276905) · [hass_ingress](https://github.com/lovelylain/hass_ingress) · [builder](https://github.com/home-assistant/builder)
- **Node-RED**: [node-red-contrib-feezal npm history](https://registry.npmjs.org/node-red-contrib-feezal) · [feezal Flow Library entry](https://flows.nodered.org/node/feezal) · [module API](https://nodered.org/docs/api/modules/v/1.3/node-red.html) · [securing](https://nodered.org/docs/user-guide/runtime/securing-node-red) · [packaging](https://nodered.org/docs/creating-nodes/packaging) · [scorecard](https://nodered.org/blog/2022/01/31/introducing-scorecard) · [Dashboard 2.0 ui_base.js](https://github.com/FlowFuse/node-red-dashboard/blob/main/nodes/config/ui_base.js) · [uibuilder config](https://github.com/TotallyInformation/node-red-contrib-uibuilder/blob/main/docs/uib-configuration.md) · [worldmap](https://github.com/dceejay/RedMap/blob/master/worldmap.js) · [aedes](https://flows.nodered.org/node/node-red-contrib-aedes) · [MQTT-direct example](https://github.com/TotallyInformation/node-red-example-liveupdates)
- **she**: [repo](https://github.com/hobbyquaker/she) · [getting-started](https://github.com/hobbyquaker/she/blob/main/doc/getting-started.md) · [sandbox-api](https://github.com/hobbyquaker/she/blob/main/doc/sandbox-api.md) · [http-api](https://github.com/hobbyquaker/she/blob/main/doc/http-api.md) · [cli](https://github.com/hobbyquaker/she/blob/main/doc/cli.md) · [BACKLOG](https://github.com/hobbyquaker/she/blob/main/BACKLOG.md) · [npm: smart-home-engine](https://www.npmjs.com/package/smart-home-engine)
- **ioBroker**: [web extensions HOWTO](https://github.com/ioBroker/ioBroker.web/blob/master/WEB-EXTENSIONS-HOWTO.md) · [ioBroker.mqtt](https://github.com/ioBroker/ioBroker.mqtt) · [socket-classes](https://github.com/ioBroker/ioBroker.socket-classes) · [socket-client](https://github.com/ioBroker/socket-client) · [vis-2 io-package](https://github.com/ioBroker/ioBroker.vis-2) · [jarvis](https://github.com/Zefau/ioBroker.jarvis) · [lovelace adapter](https://github.com/ioBroker/ioBroker.lovelace) · [review checklist](https://github.com/ioBroker/ioBroker.repositories/blob/master/REVIEW_CHECKLIST.md) · [jsonConfig](https://github.com/ioBroker/ioBroker.admin/blob/master/packages/jsonConfig/README.md)

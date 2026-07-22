# feezal User Guide

## Table of contents

1. [Installation & first run](#1-installation--first-run)
2. [Editor overview](#2-editor-overview)
3. [Working with views](#3-working-with-views)
4. [Placing and configuring elements](#4-placing-and-configuring-elements)
5. [MQTT data binding patterns](#5-mqtt-data-binding-patterns)
6. [Themes](#6-themes)
7. [Connection settings](#7-connection-settings)
8. [Site topics](#8-site-topics)
9. [Site management](#9-site-management)
10. [Static export](#10-static-export)
11. [Assets](#11-assets)
12. [Keyboard shortcuts](#12-keyboard-shortcuts)
13. [Reverse proxy setup (nginx)](#13-reverse-proxy-setup-nginx)
14. [Privacy: what feezal contacts, and when](#14-privacy-what-feezal-contacts-and-when)

---

## 1. Installation & first run

```sh
docker pull ghcr.io/feezal/feezal:latest
docker run -d --name feezal -p 3000:3000 -v feezal-data:/data ghcr.io/feezal/feezal:latest
```

Then open `http://localhost:3000/editor/` in a browser.

**Updating to a new release**

Your dashboard data is stored in the named volume (`feezal-data`) and is never touched by the container itself, so updating is safe:

```sh
docker pull ghcr.io/feezal/feezal:latest
docker stop feezal
docker rm feezal
docker run -d --name feezal -p 3000:3000 -v feezal-data:/data ghcr.io/feezal/feezal:latest
```

**CLI flags**

| Flag | Default | Description |
|---|---|---|
| `--port` | `3000` | HTTP port |
| `--data` | `./data` | Directory where sites are stored |
| `--password` | *(none)* | Password to protect the editor |
| `--public-viewer` | `true` | Allow viewer access without a password |

**Optional Docker-powered features (opt-in via environment variables)**

These need the Docker socket mounted into the feezal container
(`-v /var/run/docker.sock:/var/run/docker.sock`). The socket is
root-equivalent on the host — only enable what you use:

| Env variable | Enables |
|---|---|
| `FEEZAL_DOCKER_BUILDS=1` | **Build APK on server** in the mobile-app export dialog (x86_64 hosts — see [MOBILE-APPS.md](MOBILE-APPS.md)) |
| `FEEZAL_DOCKER_SELFUPDATE=1` | **Restart** / **Update…** buttons in Editor Settings — update pulls the new image via a one-shot [watchtower](https://containrrr.dev/watchtower/) run and recreates the container with identical config |
| `FEEZAL_ALLOW_RESTART=1` | Restart button without Docker (bare metal) — feezal exits and relies on your supervisor (systemd `Restart=always`, pm2) to bring it back |

With self-update enabled, the manual update steps above turn into one click.

---

## 2. Editor overview

The editor is a single-page application divided into four areas:

```
┌──────────────────────────────────────────────────────────────┐
│  Toolbar  (site picker · undo/redo · copy/paste · settings)  │
├─────────────┬────────────────────────────────────┬───────────┤
│  Left       │                                    │  Right    │
│  sidebar    │           Canvas                   │  sidebar  │
│             │                                    │           │
│  Palette    │  feezal-view (current view)        │  Inspector│
│  Themes     │                                    │  (attrs + │
│  Assets     │                                    │   styles) │
│  Connection │                                    │           │
│  Editor cfg │                                    │           │
└─────────────┴────────────────────────────────────┴───────────┘
│  View tab bar  (view1 · view2 · + add ···)                   │
└──────────────────────────────────────────────────────────────┘
```

**Left sidebar tabs**

| Tab | Purpose |
|---|---|
| Palette | Drag elements onto the canvas |
| Themes | Switch the viewer theme |
| Assets | Upload and manage images / files |
| Connection | Configure the MQTT broker |
| Editor | Grid, snap, canvas, and MQTT-preview settings |

**Right sidebar** shows the Attribute and Style inspectors for whichever element(s) are selected. A small badge at the top-right of the tab strip shows what is selected (`view: view1`, `basic-number`, `3 elements`, etc.).

---

## 3. Working with views

Views are the pages of your dashboard. Each feezal site has one or more views; only one view is visible at a time in the viewer.

### Add a view

Click **+** at the right end of the view tab bar.

### Rename a view

Double-click the view's tab label. Press Enter to confirm, Escape to cancel.

### Reorder views

Drag a view tab left or right to change its position.

### Delete a view

Right-click the tab and choose **Delete view**, or select the view on the canvas (click the grey border) and press `Delete`.

### Navigate views in the viewer

The built-in tab bar is shown at the top of the viewer by default. For custom navigation, drop a **Navigation** element (`feezal-element-navigation`) onto the canvas and optionally set `hide-tabbar` to hide the built-in bar.

### Tip: keeping pseudo-elements out of your main views

Some elements are **invisible placeholders** — they have no visible canvas representation but listen to MQTT and act at runtime. Examples include **Connection Status** (`feezal-element-system-connection-status`), **Dialog** (`feezal-element-material-dialog`), and **Countdown Dialog** (`feezal-element-material-countdown-dialog`).

Dropping these onto your main views works, but they add coloured placeholder boxes that clutter the canvas. A cleaner approach is to create a dedicated view — call it **_system**, **_global**, or **hidden** — and place all pseudo-elements there. That view never appears in the viewer tab bar (set the Navigation element's `views` attribute to only list the real views), so the placeholders are invisible to end-users but still active site-wide.

### PIN Lock (`feezal-element-system-pin`) — casual guard, **not real security**

The **PIN Lock** element (System category) covers a view with a full-screen PIN keypad in the viewer until the correct PIN is entered — handy for a settings or admin page on a shared / kiosk display. Drop it onto the view you want to protect; because inactive views are hidden, the overlay only appears while that view is on screen. Options: `pin` (the required code), `prompt` (text above the keypad), and `remember` (stay unlocked for the rest of the browser session).

> ⚠️ **This is not real security.** The PIN is stored in plain text in the page source, and the overlay is just a `<div>` in the browser — anyone can read the PIN in the page source or remove the overlay with the browser's developer tools in seconds. Treat it purely as a *casual* speed-bump to stop a passer-by tapping the wrong screen. **Never** use it to protect anything sensitive; for that, put the dashboard (or the specific view) behind real server-side authentication (see [Reverse-proxy authentication](#reverse-proxy-authentication-authentik--authelia)).

---

## 4. Placing and configuring elements

### Dropping an element

Open the **Palette** tab on the left sidebar. Elements are grouped by category. Drag any element onto the canvas — it snaps to the grid and appears at the drop position.

### Selecting elements

- **Single click** — selects one element.
- **Ctrl+click** / **Shift+click** — adds to the current selection.
- **Rubber-band drag** on an empty area — selects all elements inside the drawn rectangle.
- **Ctrl+A** — select all elements in the current view.
- Clicking the view background (outside all elements) selects the view itself.

### Moving and resizing

Drag an element to move it. Drag the resize handle at the bottom-right corner to resize. Both operations snap to the grid.

Hold **Alt** while dragging to move without snapping.

### Right-click context menu

Right-clicking a selected element opens a context menu with:
- **Cut / Copy / Paste** (also `Ctrl+X/C/V`)
- **Duplicate** (`Ctrl+D`)
- **Copy to view…** / **Move to view…** — flyout submenu of all other views
- **Delete** (`Delete`)
- **Select All** (`Ctrl+A`)

### Attribute inspector

Select an element, then use the **Attributes** tab in the right sidebar. Each attribute is shown as a labelled input — the label is always the exact HTML attribute name. Hover the ℹ icon (where present) for a short description of the attribute.

### Style inspector

The **Styles** tab lets you set inline CSS properties for the selected element. The available set is defined by the element's `styles` list in its `static get feezal()` descriptor. At the bottom of the list, an autocomplete input lets you add additional properties.

---

## 5. MQTT data binding patterns

### Basic value display

Set the element's `subscribe` attribute to the MQTT topic that publishes the value:

```
subscribe = sensors/living-room/temperature
```

The payload is received as-is. For JSON payloads, set `messageProperty` to a dot-separated path to extract a nested value:

```
subscribe = home/sensor
messageProperty = payload.temperature
```

### Publishing on interaction

Elements that fire events (buttons, sliders, switches) use the `publish` attribute:

```
publish = lights/kitchen/set
```

On interaction the element publishes to that topic. The payload format depends on the element (e.g. `ON` / `OFF` for a switch, a numeric value for a slider).

### Runtime control topics

Beyond the primary `subscribe` topic, every element listens on a small set of **reserved control sub-topics**. Publishing to them changes the element's attributes, inline styles, or CSS classes live — without rebuilding the dashboard. The payload is read through `messageProperty` (default `payload`), just like the primary topic.

| Topic | Payload | Effect |
|---|---|---|
| `<subscribe>/setattribute` | object, e.g. `{ "icon": "wifi", "label": "Kitchen" }` | set each attribute |
| `<subscribe>/removeattribute` | `"icon"` or `["icon","label"]` | remove each attribute |
| `<subscribe>/setstyle` | object, e.g. `{ "color": "red", "opacity": "0.5" }` | merge into inline style |
| `<subscribe>/removestyle` | `"color"` or `["color","opacity"]` | remove each style property |
| `<subscribe>/addclass` | CSS class name | add a CSS class |
| `<subscribe>/removeclass` | CSS class name | remove a CSS class |

These are **exact** subscriptions — feezal does **not** subscribe to `<subscribe>/#`. Telemetry your device happens to publish on neighbouring topics (e.g. `<subscribe>/linkquality`, `<subscribe>/power`) is therefore ignored and never ends up on the element.

> **Editor preview.** By default these runtime changes apply only in the **viewer**, not while you edit. The *Editor → "Prevent MQTT element manipulation in editor"* setting (on by default) keeps live broker values from being written onto elements and accidentally saved. Turn it off if you want to preview live MQTT-driven changes inside the editor.

### Dynamic subscriptions

Set `dynamic-subscriptions` on an element to pause its MQTT subscription when the element's view is not currently visible. Useful for large dashboards where subscribing to every topic at once is wasteful.

### Patterns by use case

**Display a sensor reading**

| Attribute | Value |
|---|---|
| `subscribe` | `zigbee2mqtt/temp-sensor` |
| `messageProperty` | `payload.temperature` |

**Toggle a light**

| Attribute | Value |
|---|---|
| `subscribe` | `zigbee2mqtt/kitchen-light/state` |
| `publish` | `zigbee2mqtt/kitchen-light/set` |

**Chart last 60 readings**

| Attribute | Value |
|---|---|
| `subscribe` | `sensors/power/watts` |
| `history` | `60` |
| `fill` | *(checked)* |

**Navigate views on a button press**

Use a `feezal-element-navigation` element (preferred) or a standard button element with a `publish` topic that triggers view navigation from your automation.

---

## 6. Themes

Themes control the visual appearance of the viewer (background colours, text colours, accent colour). They do not affect the editor chrome.

Open the **Themes** tab on the left sidebar to switch the active theme. The change takes effect immediately in the editor preview and persists in the site's viewer config.

Built-in themes:

| Theme | Style |
|---|---|
| Blue Night | Dark, blue accent |
| Dark Mint | Dark, mint green accent |
| Dark Orange | Dark, orange accent |
| Gruvbox Dark | Warm retro dark |
| Gruvbox Light | Warm retro light |
| Light Orange | Light, orange accent |
| Midnight Blue | Very dark navy |
| Solarized Dark | Ethan Schoonover precision dark |
| Solarized Light | Ethan Schoonover precision light |

Custom themes can be installed as npm packages following the `@scope/feezal-theme-*` naming convention.

---

## 7. Connection settings

Open the **Connection** tab on the left sidebar.

| Field | Description |
|---|---|
| Protocol | `ws` / `wss` / `mqtt` / `mqtts` |
| Host | Broker hostname or IP |
| Port | Broker port (default `9001` for ws, `8883` for mqtts) |
| MQTT version | `3.1.1` (default) or `5.0` — used by the viewer and the server bridge |
| Connect via server | Route the viewer through the feezal server instead of connecting directly (see below) |
| Username / Password | Optional broker credentials |

Settings are stored in the site's `viewer.json`. The feezal **server** always connects to the broker with them (it powers the editor canvas, topic autocomplete, device discovery and the AI tools); the **viewer** additionally connects directly from the browser unless *Connect via server* is enabled.

The **Last Will** and **On Connect** sections let you configure the MQTT last-will message and a message to publish when the viewer first connects.

### Connection mode — via server or direct

The viewer can reach the broker two ways:

| | Via server (recommended) | Direct from browser |
|---|---|---|
| Data path | browser → feezal server → broker | browser → broker |
| Broker credentials | stay on the server — **never in the page source** | embedded in the viewer page source, readable by anyone who can open the viewer |
| TLS to the broker | terminated by the server — the uploaded CA / client certificate applies | terminated by the browser — only the device's certificate store applies |
| Protocols | all (`mqtt`, `mqtts`, `ws`, `wss`) | `ws` / `wss` only |
| Requires the feezal server at runtime | yes | no |

`mqtt://` and `mqtts://` always use the server — browsers can only open WebSockets. For `ws://`/`wss://` the toggle is yours: choose **via server** when the viewer is served by feezal anyway (credentials stay private, TLS is handled centrally); choose **direct** when viewers must keep working while the feezal server is down, or as a stepping stone to a static export (exports are always direct — but never contain credentials, see [Static export](#10-static-export)).

### TLS and self-signed brokers

Who does the TLS handshake decides which certificate store matters:

| Connection | TLS terminated by | A self-signed broker needs |
|---|---|---|
| Editor, bridged viewers, the server's own broker connection | the feezal **server** | the CA uploaded in **Connection → TLS** |
| Direct `wss://` viewers, every **static export** | the **browser** | the CA imported into each device's OS/browser trust store |

The browser side is a platform limit, not a feezal one — web pages cannot supply a CA programmatically.

**The easy way out:** put a publicly trusted certificate (e.g. **Let's Encrypt**) on your broker. Every device then connects with zero setup, and none of the steps below are needed.

**Manual CA import** (for direct viewers and exports with a private CA) — import the CA certificate on *every* device that opens the dashboard:

- **Windows:** double-click the certificate → *Install Certificate* → *Local Machine* → *Trusted Root Certification Authorities* (or `certmgr.msc`).
- **macOS:** double-click → *Keychain Access* → *System* keychain → set *Trust* to *Always Trust*.
- **Linux:** copy to `/usr/local/share/ca-certificates/` + `sudo update-ca-certificates` (Debian/Ubuntu) or `trust anchor` (Fedora/Arch); Chromium may also need `certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n broker-ca -i ca.pem`.
- **Firefox:** has its own store — Settings → *Privacy & Security* → *Certificates* → *Import* → tick *Trust this CA to identify websites*.
- **Android:** Settings → *Security* → *Encryption & credentials* → *Install a certificate* → *CA certificate*.
- **iOS:** install the profile (Settings → *General* → *VPN & Device Management*), then enable it under *General* → *About* → *Certificate Trust Settings*.

Static exports that use TLS material ship these instructions as a `TLS-SETUP.md` inside the ZIP.

### Client certificates (mTLS)

For brokers that require mutual TLS, upload the client certificate and private key under **Connection → Client certificate (mTLS)**. They are used by **server-side** connections only (the key never leaves the server — the API can store it but never returns it). Direct viewers and exports need the client certificate installed in the device's OS store instead (as a `.p12`/`.pfx`); the browser presents it automatically during the handshake. Exports include the setup steps in `TLS-SETUP.md`.

---

## 8. Site topics

The feezal server subscribes to a set of reserved MQTT subtopics under the **site subscribe topic** configured in Connection settings. Publishing to these topics lets any MQTT client control all viewers of a site in real time — useful for remote control from Node-RED, Home Assistant, or `mosquitto_pub`.

### Setting the site subscribe topic

1. Open the **Connection** tab in the editor sidebar.
2. Set the **Site subscribe** field (e.g. `feezal/myhome`).
3. Save the site.

All subtopics below are relative to this base topic.

### Available topics

| Topic | Payload | Effect |
|---|---|---|
| `<site>/reload` | any | All connected viewers reload the page |
| `<site>/view` | view name (string) | All connected viewers navigate to the named view |
| `<site>/theme` | theme name (string) | Switch the active theme on all viewers |
| `<site>/addclass` | CSS class name | Add a CSS class to `<body>` on all viewers |
| `<site>/removeclass` | CSS class name | Remove a CSS class from `<body>` on all viewers |
| `<site>/playlist` | `on` \| `off` \| `pause` \| `next` \| `prev` | Control the view playlist (see below) |

### Theme switching

The `theme` subtopic accepts either the full theme class name (e.g. `feezal-theme-dark-mint`) or just the suffix (e.g. `dark-mint`). The viewer removes all currently active `feezal-theme-*` classes and applies the new one. The switch is **ephemeral** — it resets on page reload.

### View playlist (signage rotation)

The viewer can cycle through a configured list of views automatically — turning any feezal site into digital signage for wall displays. Configure it in **Site Settings → Site → View playlist**:

- **Rotate views** — enables the rotation (the steady state; a viewer starts rotating right after load).
- **Views** — comma-separated view names, in rotation order. Append `:seconds` to override the dwell time per view: `overview:30, energy, weather:15`.
- **Dwell** — default seconds per view (`10` when empty).
- **Resume after** — idle seconds before rotation resumes after an interruption (`60` when empty).
- **Transition** — `none` or `fade` (fades views in on every switch).

**Interaction pause:** any user interaction (touch, mouse, keyboard, scroll) pauses the rotation; it resumes automatically after the idle timeout. A direct `<site>/view` command or in-dashboard navigation pauses it the same way.

**Runtime control** via `<site>/playlist`: `on` / `off` switch rotation (publish retained to define the steady state), `pause` suspends until the idle timeout, `next` / `prev` jump within the playlist immediately.

The playlist runs entirely client-side, so it works identically in the live viewer and in **static exports**. In the editor it never rotates.

```sh
# Stop rotation on all viewers (retained → survives reloads)
mosquitto_pub -h localhost -t feezal/myhome/playlist -m off -r

# Jump to the next playlist view
mosquitto_pub -h localhost -t feezal/myhome/playlist -m next
```

### Example: navigate all viewers via command line

```sh
# Navigate all viewers to the "living-room" view
mosquitto_pub -h localhost -t feezal/myhome/view -m living-room

# Switch all viewers to the dark-mint theme
mosquitto_pub -h localhost -t feezal/myhome/theme -m dark-mint

# Reload all viewers
mosquitto_pub -h localhost -t feezal/myhome/reload -m 1
```

---

## 9. Site management

feezal can host multiple independent dashboards (sites) on one server.

The **site picker** in the toolbar shows the current site name. Click it to:

- **Switch** to another site (navigates to its editor URL).
- **New site** — prompts for a name; optionally copies connection settings from an existing site.
- **Duplicate** — copies all views and config from the current site to a new name.
- **Rename** — renames the current site.
- **Delete** — permanently deletes the current site (with confirmation).

The editor URL follows the pattern `http://localhost:3000/editor/#/<siteName>`. Bookmarking it returns you directly to that site.

---

## 10. Static export

A static export packages the entire viewer into a **single self-contained `index.html`** file (all JavaScript inlined). The result works from a `file://` URL and on any static file host — no server required.

**How to export**

1. Open the site in the editor.
2. Click the **Export** button in the toolbar (⬇ icon).
3. A `.zip` file is downloaded containing `index.html` plus any site assets.

**What is included**

- The feezal viewer application bundle.
- All element packages used in the site.
- The MQTT connection configuration — broker URL only, **never credentials** (see below).
- All site assets (images, etc.) referenced in the views, copied alongside `index.html`.
- `TLS-SETUP.md` with per-platform certificate instructions, when the site uses TLS material.

**Credentials — the runtime prompt**

An exported `index.html` is a plain file: anything baked into it can be read by whoever holds it. feezal therefore **strips the broker username and password from every export**. If your broker requires authentication, the exported dashboard shows a small **login dialog on first load**:

- **Broker URL** (pre-filled, editable — handy when the broker is reachable under a different address than from the editor), **Username**, **Password**.
- Credentials are kept in the browser's **session storage** by default — gone when the tab closes. Tick **Remember on this device** to keep them in local storage across reloads (kiosk/wall-panel setups: enter once, done).
- Wrong credentials? The dialog reappears with an error after the broker rejects them.
- To make a device forget remembered credentials, clear the site's browser data (or use a private window for one-off access).

Exports without configured credentials connect straight away, no dialog.

**Notes**

- The exported dashboard still requires a reachable MQTT broker at runtime — only the feezal server is eliminated. Exports always connect **directly from the browser** (the *Connect via server* mode does not apply — there is no server).
- If your broker requires WSS (WebSocket over TLS), the exported file must be served from HTTPS (browser security restriction) or opened in a native WebSocket context.
- **HTTPS → WSS requirement** — if the exported `index.html` is served over `https://`, the broker connection **must** use `wss://`. Browsers block mixed-content connections: a page loaded from HTTPS cannot open a plain (non-TLS) WebSocket to a `ws://` broker. Make sure your broker URL uses `wss://` whenever the dashboard is hosted on HTTPS.
- Global assets (shared across sites) are also bundled.
- **TLS certificates are never part of an export.** The CA / client certificate you uploaded in the Connection settings is server-side material; exports do TLS in the browser. For self-signed/private-CA brokers (and mTLS), each device needs the certificates in its OS/browser store — the ZIP's `TLS-SETUP.md` walks through it per platform, and [TLS and self-signed brokers](#tls-and-self-signed-brokers) has the background. The painless alternative remains a publicly trusted certificate (Let's Encrypt) on the broker.

---

## 11. Assets

The **Assets** tab on the left sidebar provides a file manager for images and other static files.

Assets are split into two categories:

| Category | Path in HTML | Storage location |
|---|---|---|
| **Global** | `assets/global/<filename>` | Shared across all sites; included in every export |
| **Site** | `assets/<filename>` | Specific to the current site; included only in that site's export |

**Uploading**

Drag files onto the Assets panel or click the upload button. Folders are supported.

The feezal server accepts uploads up to **50 MB** per file. If you run feezal **behind a reverse proxy** and an upload fails with `Request Entity Too Large` (HTTP 413), the proxy — not feezal — is rejecting it: nginx caps request bodies at **1 MB by default**. Raise it with `client_max_body_size` (see [§13 Reverse proxy setup](#13-reverse-proxy-setup-nginx)).

**Using an asset**

Copy the path shown in the asset tile and paste it into an element attribute (e.g. the `src` attribute of a `feezal-element-basic-image` element).

**Drag to canvas**

Drag an image tile from the Asset panel directly onto the canvas. feezal creates a `feezal-element-basic-image` element at the drop position with the `src` attribute pre-filled.

**Organising assets**

Use the folder tree on the left of the Assets panel to navigate directories. Drag files or folders to move them. Right-click for rename and delete options.

---

## 12. Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Z` | Undo |
| `Ctrl+C` | Copy selected elements |
| `Ctrl+X` | Cut selected elements |
| `Ctrl+V` | Paste |
| `Ctrl+D` | Duplicate selected elements |
| `Ctrl+A` | Select all elements in current view |
| `Delete` | Delete selected elements |
| `Escape` | Deselect all |
| `Arrow keys` | Nudge selected elements by 1 px |
| `Shift+Arrow` | Nudge by grid size |

---

## 13. Reverse proxy setup (nginx)

Running feezal behind nginx lets you add HTTPS, a custom domain, and (optionally) upstream authentication.

The key requirements are:
- **WebSocket upgrade** — feezal uses Socket.IO over WebSockets; `Upgrade` and `Connection` headers must be forwarded.
- **`proxy_http_version 1.1`** — required for WebSocket support.
- **`Host` header forwarding** — feezal uses the host for generating correct URLs.
- **`client_max_body_size`** — raise it for asset uploads. nginx defaults to **1 MB**, so anything larger fails with `413 Request Entity Too Large` *before it reaches feezal*. Set it to at least the largest asset you upload (feezal's server accepts up to 50 MB).

### Minimal HTTPS example

```nginx
server {
    listen 443 ssl;
    server_name feezal.example.com;

    ssl_certificate     /etc/letsencrypt/live/feezal.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/feezal.example.com/privkey.pem;

    # Asset uploads: nginx defaults to 1 MB, which causes 413 errors.
    # Raise it to at least your largest asset (feezal accepts up to 50 MB).
    client_max_body_size 20m;

    # Redirect requests that arrive with a different Host header
    if ($host != $server_name) {
        return 301 $scheme://$server_name$request_uri;
    }

    location / {
        proxy_set_header Host              $http_host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Required for Socket.IO / WebSocket
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_pass http://localhost:3000/;
    }
}
```

Replace `feezal.example.com` with your actual domain and adjust the certificate paths accordingly. If you use Certbot, it will manage the certificate lines automatically.

### Reverse-proxy authentication (Authentik / Authelia)

If your nginx setup forwards an authenticated user header (e.g. `X-Auth-User`), start feezal with `--trust-proxy-auth` to accept it:

```sh
docker run -d --name feezal -p 3000:3000 -v feezal-data:/data \
  ghcr.io/feezal/feezal:latest --trust-proxy-auth
```

feezal will read the `X-Auth-User` header and treat its value as the authenticated username. **Only enable this when feezal is not directly reachable from the internet** — the header must always be set by the trusted proxy, never by an end user.

## 14. Privacy: what feezal contacts, and when

**Policy (A25): feezal makes no third-party network request you did not explicitly configure.** All UI assets — fonts (Roboto, Material Icons), Shoelace component icons, Leaflet map images and CSS — are bundled and served by your feezal instance; the editor, the live viewer, static exports and mobile builds all work fully offline. A restrictive `Content-Security-Policy` on every server response enforces this structurally: third-party scripts, styles and fonts are blocked by the browser, and a CI test fails if a CDN reference ever reappears in the code.

The **complete** list of outbound connections, all user-controlled:

| Connection | When | Configured where |
|---|---|---|
| Your **MQTT broker** | always (that's the point) | Site Settings → Connection |
| **AI assistant** provider (`api.anthropic.com` / `api.openai.com` / your own Ollama URL) | only when you use the assistant, only if configured | Editor Settings → AI |
| `registry.npmjs.org` | package **search** (typing a query) and the **"Check for updates"** button — never automatically | Packages sidebar |
| `tile.openstreetmap.org` | only if a dashboard contains a **map element** with the default tile server | element's `tile-url` attribute (point it at your own tile server for full offline) |
| URLs **you put in elements** (camera feeds, `basic-svg`/`basic-image` sources, `basic-iframe` pages) | as your dashboard loads them | the respective element attributes |
| `raw.githubusercontent.com` | **never at runtime** — only when a maintainer refreshes the Material-Icons codepoint list with `FEEZAL_FETCH_ICON_CODEPOINTS=1` | environment variable, development only |

feezal contains **no telemetry, no analytics, no crash reporting, and no install-time hooks**. There is nothing to opt out of.

**Per-site CSP configuration (A28):** Site Settings → **Security** lets you tune the viewer's Content-Security-Policy per site — tighten the open content directives (images/cameras, iframes, network connections) down to exactly the hosts your dashboard uses, or (with a prominent warning) allow additional script/style/font origins. feezal's own baseline tokens and your broker origin can never be removed — the header builder enforces the invariants, not the UI. The viewer page reports blocked requests to a **same-origin endpoint on your feezal server** (`/api/csp-report/<site>`); these reports stay in a small local in-memory buffer to power the tab's one-click "allow" suggestions — nothing leaves your instance.

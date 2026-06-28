# feezal User Guide

## Table of contents

1. [Installation & first run](#1-installation--first-run)
2. [Editor overview](#2-editor-overview)
3. [Working with views](#3-working-with-views)
4. [Placing and configuring elements](#4-placing-and-configuring-elements)
5. [MQTT data binding patterns](#5-mqtt-data-binding-patterns)
6. [Themes](#6-themes)
7. [Connection settings](#7-connection-settings)
8. [Site management](#8-site-management)
9. [Static export](#9-static-export)
10. [Assets](#10-assets)
11. [Keyboard shortcuts](#11-keyboard-shortcuts)
12. [Reverse proxy setup (nginx)](#12-reverse-proxy-setup-nginx)

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
| Editor | Grid, snap, and canvas settings |

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

### Wildcard subscriptions

feezal uses `<topic>/#` internally so a single subscription covers the topic and all sub-topics. For example, subscribing to `home/device` also receives messages on `home/device/state`, `home/device/power`, etc. The `messageProperty` path resolves from the full message object `{topic, payload}`.

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
| Username / Password | Optional broker credentials |

Settings are stored in the site's `viewer.json` and are sent to the viewer on load. They are **not** used by the editor itself — only the viewer connects to the broker.

The **Last Will** and **On Connect** sections (collapsed by default) let you configure the MQTT last-will message and a message to publish when the viewer first connects.

---

## 8. Site management

feezal can host multiple independent dashboards (sites) on one server.

The **site picker** in the toolbar shows the current site name. Click it to:

- **Switch** to another site (navigates to its editor URL).
- **New site** — prompts for a name; optionally copies connection settings from an existing site.
- **Duplicate** — copies all views and config from the current site to a new name.
- **Rename** — renames the current site.
- **Delete** — permanently deletes the current site (with confirmation).

The editor URL follows the pattern `http://localhost:3000/editor/#/<siteName>`. Bookmarking it returns you directly to that site.

---

## 9. Static export

A static export packages the entire viewer into a **single self-contained `index.html`** file (all JavaScript inlined). The result works from a `file://` URL and on any static file host — no server required.

**How to export**

1. Open the site in the editor.
2. Click the **Export** button in the toolbar (⬇ icon).
3. A `.zip` file is downloaded containing `index.html` plus any site assets.

**What is included**

- The feezal viewer application bundle.
- All element packages used in the site.
- The MQTT connection configuration (broker URL, credentials).
- All site assets (images, etc.) referenced in the views, copied alongside `index.html`.

**Notes**

- The exported dashboard still requires a reachable MQTT broker at runtime — only the feezal server is eliminated.
- If your broker requires WSS (WebSocket over TLS), the exported file must be served from HTTPS (browser security restriction) or opened in a native WebSocket context.
- **HTTPS → WSS requirement** — if the exported `index.html` is served over `https://`, the broker connection **must** use `wss://`. Browsers block mixed-content connections: a page loaded from HTTPS cannot open a plain (non-TLS) WebSocket to a `ws://` broker. Make sure your broker URL uses `wss://` whenever the dashboard is hosted on HTTPS.
- Global assets (shared across sites) are also bundled.
- **TLS CA certificates** — any CA certificate you uploaded in the Connection settings is stored server-side and used only by the feezal server's MQTT bridge. It is **not** included in the export. If your `wss://` broker uses a self-signed or private CA certificate, you must install that CA certificate in the **OS or browser trust store** of every device that will open the exported dashboard. This is standard procedure for private TLS deployments.

---

## 10. Assets

The **Assets** tab on the left sidebar provides a file manager for images and other static files.

Assets are split into two categories:

| Category | Path in HTML | Storage location |
|---|---|---|
| **Global** | `assets/global/<filename>` | Shared across all sites; included in every export |
| **Site** | `assets/<filename>` | Specific to the current site; included only in that site's export |

**Uploading**

Drag files onto the Assets panel or click the upload button. Folders are supported.

**Using an asset**

Copy the path shown in the asset tile and paste it into an element attribute (e.g. the `src` attribute of a `feezal-element-basic-image` element).

**Drag to canvas**

Drag an image tile from the Asset panel directly onto the canvas. feezal creates a `feezal-element-basic-image` element at the drop position with the `src` attribute pre-filled.

**Organising assets**

Use the folder tree on the left of the Assets panel to navigate directories. Drag files or folders to move them. Right-click for rename and delete options.

---

## 11. Keyboard shortcuts

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

## 12. Reverse proxy setup (nginx)

Running feezal behind nginx lets you add HTTPS, a custom domain, and (optionally) upstream authentication.

The key requirements are:
- **WebSocket upgrade** — feezal uses Socket.IO over WebSockets; `Upgrade` and `Connection` headers must be forwarded.
- **`proxy_http_version 1.1`** — required for WebSocket support.
- **`Host` header forwarding** — feezal uses the host for generating correct URLs.

### Minimal HTTPS example

```nginx
server {
    listen 443 ssl;
    server_name feezal.example.com;

    ssl_certificate     /etc/letsencrypt/live/feezal.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/feezal.example.com/privkey.pem;

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

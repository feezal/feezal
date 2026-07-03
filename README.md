# feezal

<img src="www/favicon/apple-touch-icon.png" align="left"><br><h3>Dashboard editor powered by Web Components and MQTT</h3><br><br><br><br>


> [!WARNING]
> This project is a work in progress. Expect incomplete documentation, bugs, missing features and rough edges. Feedback and bug reports via the issue tracker are very welcome. See [Roadmap](docs/ROADMAP.md) for what's already planned.


---

## Quickstart

```sh
docker run -d --name feezal -p 3000:3000 -v feezal-data:/data ghcr.io/feezal/feezal:latest
```

Then open [http://localhost:3000/editor/](http://localhost:3000/editor/) and configure your MQTT broker in **Site Settings** (the remote-screen-icon in the right sidebar).


---

## Features

- **WYSIWYG editor** — drag elements from the palette onto the canvas, resize and position them with your mouse
- **Source editing** — edit the view's HTML directly in a built-in code editor, with formatting and live round-tripping back to the canvas
- **Real-time data binding** — topic-based message routing connects any element attribute to a mqtt subscription
- **MQTT support** — direct browser-to-broker WebSocket connection; no backend required for the viewer
- **MQTT auto-discovery** — automatically detects devices published by zigbee2mqtt, ESPHome, and compatible bridges; one click pre-wires all topics and attributes
- **Web Components element model** — every palette element is a standard Custom Element; the ecosystem is distributed as plain npm packages
- **Components (composable elements)** — turn a selection of elements into a named, reusable component with typed parameters: build once, instantiate many times, edit centrally and every instance follows
- **Multi-view dashboards** — organise your dashboard into multiple named views with instant switching
- **Responsive layouts** — layout elements (flex containers, responsive/app-shell wrappers, navbars) build fluid dashboards that adapt to any screen size, beyond fixed absolute positioning
- **Theme system** — swap the entire colour scheme at runtime via published theme packages
- **Static export** — one click produces a ZIP with a single `index.html` that has all JavaScript inlined; works on any static host or from `file://`
- **Progressive Web App** — installable, offline-capable dashboards that run full-screen and launch like a native app
- **Android & iOS apps** — export your dashboard as a Capacitor mobile-app project, with optional server-side Android APK builds
- **AI assistant** — a built-in chat that creates and edits dashboards for you; its agent tools search your live broker topics and discovered devices, so generated views arrive pre-wired to real data. Bring your own backend: Anthropic, OpenAI-compatible, or local Ollama



---

## Documentation

- [User Guide](docs/user-guide.md) — editor walkthrough, views, elements, MQTT patterns, themes, keyboard shortcuts and more
- [Development Guide](docs/development.md) — repo layout, dev setup, build pipeline, versioning and release process
- [Element Authoring Spec](docs/element-spec.md) — how to build and publish custom palette elements
- [Roadmap](docs/ROADMAP.md) — planned features and design specs
- [Roadmap Archive](docs/ROADMAP-ARCHIVE.md) — completed items

---

## License

feezal uses a two-tier licensing model:

- **Server and editor:** [AGPL-3.0-only](LICENSE) © Sebastian Raff
- **Element SDK (`@feezal/feezal-element`), all official elements and themes, and the
  viewer runtime bundled into static exports:** MIT

In practice: run feezal freely, self-host it, modify it — no strings attached beyond the
AGPL's share-alike terms. Your **exported dashboards are MIT-clean artifacts** you can
publish anywhere, and **community element packages are not affected by copyleft** — build
and distribute your own elements under any license you like
(see the [Element Authoring Spec](docs/element-spec.md)).

Contributions require signing the [FSFE Fiduciary License Agreement](CLA.md), which
contractually guarantees feezal will always remain Free Software — see
[CONTRIBUTING.md](CONTRIBUTING.md).

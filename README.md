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
- **Real-time data binding** — topic-based message routing connects any element attribute to a mqtt subscription
- **MQTT support** — direct browser-to-broker WebSocket connection; no backend required for the viewer
- **Web Components element model** — every palette element is a standard Custom Element; the ecosystem is distributed as plain npm packages
- **Multi-view dashboards** — organise your dashboard into multiple named views with instant switching
- **Theme system** — swap the entire colour scheme at runtime via published theme packages
- **Static export** — one click produces a ZIP with a single `index.html` that has all JavaScript inlined; works on any static host or from `file://`
- **MQTT auto-discovery** — automatically detects devices published by zigbee2mqtt, ESPHome, and compatible bridges; one click pre-wires all topics and attributes
- **Undo / history** — full undo and redo with a visual history sidebar showing every change made to the dashboard
- **Password-protected editor** — the live editor can be secured with a bcrypt-hashed password while the viewer remains public
- **Reverse-proxy auth** — optionally trust an upstream `X-Auth-User` header (e.g. Authentik / Authelia)

---

## Documentation

- [User Guide](docs/user-guide.md) — editor walkthrough, views, elements, MQTT patterns, themes, keyboard shortcuts and more
- [Development Guide](docs/development.md) — repo layout, dev setup, build pipeline, versioning and release process
- [Element Authoring Spec](docs/element-spec.md) — how to build and publish custom palette elements
- [Roadmap](docs/ROADMAP.md) — planned features and design specs
- [Roadmap Archive](docs/ROADMAP-ARCHIVE.md) — completed items

---

## License

GPLv3 © Sebastian Raff

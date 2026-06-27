# feezal

> WYSIWYG dashboard builder powered by Web Components and MQTT

> [!WARNING]
> This project is a work in progress. Expect breaking changes, missing features, and rough edges. Feedback and bug reports via the issue tracker are very welcome.

Feezal lets you build live dashboards in a drag-and-drop editor, connect them to a MQTT broker, and publish them — either served by the feezal backend or exported as a fully self-contained static website that runs from any web server or even a local `file://` URL.

---

## Features

- **WYSIWYG editor** — drag elements from the palette onto the canvas, resize and position them with your mouse
- **Real-time data binding** — topic-based message routing connects any element attribute to a mqtt subscription
- **MQTT support** — direct browser-to-broker WebSocket connection; no backend required for the viewer
- **Web Components element model** — every palette element is a standard Custom Element; the ecosystem is distributed as plain npm packages
- **Multi-view dashboards** — organise your dashboard into multiple named views with instant switching
- **Theme system** — swap the entire colour scheme at runtime via published theme packages
- **Static export** — one click produces a ZIP with a single `index.html` that has all JavaScript inlined; works on any static host or from `file://`
- **Password-protected editor** — the live editor can be secured with a bcrypt-hashed password while the viewer remains public
- **Reverse-proxy auth** — optionally trust an upstream `X-Auth-User` header (e.g. Authentik / Authelia)
- **Pluggable storage** — filesystem backend ships by default; the `StorageAdapter` interface makes it easy to add SQLite or a database backend

---

## Quickstart

```sh
docker pull ghcr.io/feezal/feezal:latest
docker run -d --name feezal -p 3000:3000 -v feezal-data:/data ghcr.io/feezal/feezal:latest
```

Then open [http://localhost:3000/editor/](http://localhost:3000/editor/).


---

## Data binding

Set a **topic** on any element to bind it to incoming messages.

Send a message to the feezal backend to update an element:

```json
{ "topic": "mybutton/disabled", "payload": true }
```

To update a style property:

```json
{ "topic": "mytemplate/style", "payload": { "color": "green" } }
```

Events fired by elements (clicks, value changes) are emitted as output messages:

```json
{ "topic": "mybutton/click", "payload": null }
```

---

## Element packages

Elements are standard npm packages that export a Custom Element class with a static `feezal` descriptor:

```js
static get feezal() {
    return {
        label: 'My Button',
        attributes: [
            { name: 'label', type: 'string', default: 'Click me' },
            { name: 'disabled', type: 'boolean', default: false }
        ]
    };
}
```

See [element-spec.md](element-spec.md) for the full specification.

---

## Documentation

- [User Guide](docs/user-guide.md) — editor walkthrough, views, elements, MQTT patterns, themes, keyboard shortcuts and more

---

## License

GPLv3 © Sebastian Raff

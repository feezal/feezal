# Agent instructions — feezal

## What this is

feezal is a browser-based editor and viewer for MQTT-driven apps and dashboards: a Node.js/Express
server (`server/`) and a Vite/Lit web front-end (`www/`), with the elements, themes and icon sets as
`@feezal/*` packages under `www/packages/`. It talks MQTT only. Releases are GitHub releases with a
Docker image (`ghcr.io/feezal/feezal`); the element packages are published to npm one by one.

The roadmap is kept in the maintainer's agents repository, checked out next to this one as
`../she-agent/roadmap-items/feezal/`.

## Rules

The agent rules already exist and stay where they are:

- [.claude/CLAUDE.md](.claude/CLAUDE.md) — shell conventions, project layout, element authoring,
  dependencies, test checklist maintenance.
- [docs/development.md](docs/development.md) — repository layout, development setup, build, versioning
  and the release process.
- [docs/TESTING.md](docs/TESTING.md) — the manual QA checklist; a new element or feature gets its entry
  in the same commit.
- [docs/element-spec.md](docs/element-spec.md) — read it before working on any element.

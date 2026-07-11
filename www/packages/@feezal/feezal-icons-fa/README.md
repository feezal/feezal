# @feezal/feezal-icons-fa

**Font Awesome Free** icon sets for feezal (N28) — the third bundled set after `mdi` and `knx-uf`, and the one users coming from the general web expect.

One package registers **three sets** (the styles are separate namespaces upstream):

| Set | Icons | Example value |
|---|---|---|
| `fa-solid` | ~2000 | `fa-solid:house` |
| `fa-regular` | ~270 | `fa-regular:heart` |
| `fa-brands` | ~600 | `fa-brands:github` |

The **brands** style fills a real gap: recognizable service logos (GitHub, Spotify, Home Assistant, …) for status boards and link tiles — MDI carries only a shrinking brand set.

## Mechanics

- **Inline SVG `render(name)` mode** (mandatory: FA's webfont is class+codepoint based, which cannot reach shadow DOM). SVG follows `currentColor`, so icons track the active theme. FA viewBoxes vary in width — `<feezal-icon>` sizes the unsized SVG to `1em`.
- **Per-site tree-shaking:** the full data modules (`icons-{solid,regular,brands}.js`, ~2 MB total) load **only in the editor**; viewer pages and static exports get server-generated registrations containing just the icons the site uses. Declared via the plural `feezal.sets` manifest field (see `docs/icons-spec.md` §1).
- **Regenerating** after an upstream bump:

  ```sh
  cd www && npm install --no-save @fortawesome/fontawesome-free
  node packages/@feezal/feezal-icons-fa/generate.mjs
  ```

## License

Icon artwork: **Font Awesome Free**, [CC BY 4.0](LICENSE.txt) — attribution: *Font Awesome by Fonticons, Inc.* (<https://fontawesome.com>). The generator strips the per-file license comments; this file and `LICENSE.txt` carry the attribution instead. Pro styles are not included (paid, not redistributable).

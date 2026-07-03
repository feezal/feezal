# @feezal/feezal-icons-knx-uf

The [KNX-User-Forum icon set](https://github.com/OpenAutomationProject/knx-uf-iconset) (~940 purpose-built home-automation icons — KNX, HVAC, blinds, sensors, audio, weather, …) as a [feezal](https://github.com/feezal/feezal) icon-set package.

Install through the feezal Package Manager; icons then appear in the icon picker under the **knx-uf** chip and are referenced as `knx-uf:<name>` with the upstream file names:

```
knx-uf:audio_audio
knx-uf:fts_sunblind
knx-uf:sani_heating
```

Icons render as inline SVG. The upstream set is drawn with fixed white strokes; this package maps them to `currentColor` at generation time, so the icons follow the active feezal theme.

## License & attribution

Icon artwork: **CC BY-SA 3.0 DE** by the KNX-User-Forum community — see [LICENSE.txt](LICENSE.txt) and [AUTHORS.txt](AUTHORS.txt). The attribution files ship with this package (and are copied alongside it on install). Note that dashboards **embedding these icons in static exports carry the attribution and share-alike terms for the icon artwork**.

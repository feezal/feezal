/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';
import '@feezal/feezal-element/feezal-topic-input.js';
import {LitElement} from 'lit';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/switch/switch.js';
import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/divider/divider.js';

/**
 * feezal-element-layout-app (E47)
 *
 * A full-bleed app shell: a top app bar + a collapsible left navigation drawer,
 * whose content area embeds a named view and swaps it as the user picks drawer
 * entries (the bar/drawer chrome persists). Modern MD3/Lit replacement for the
 * legacy paper-app-layout (removed), in the Layout category. The top bar can be
 * hidden entirely (hide-header) — a floating hamburger keeps the overlay drawer
 * reachable.
 *
 * Embed & swap: in the viewer the active entry's <feezal-view> is cloned into
 * the content pane (inactive display:none stripped); in the editor a placeholder
 * is shown (never a live nested render → no recursion). The drawer is persistent
 * above `breakpoint` (tracked by the element's OWN width via ResizeObserver, so
 * it's correct at any editor preview size) and an overlay + hamburger below it.
 */
class FeezalElementLayoutApp extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'App', category: 'Layout', color: '#4a7080', icon: 'space_dashboard'},
            description: 'A full-bleed app shell: top bar + navigation drawer whose entries swap the embedded ' +
                'content view. Drawer is persistent when wide, an overlay + hamburger when narrow; optional slim ' +
                'icon-rail that expands on hover/focus and autohide mode. Keyboard- and smart-TV-D-pad navigable. ' +
                'Themable via the --feezal-app-* style vars. Manage entries, title and actions in the inspector.',
            inspector: 'feezal-element-layout-app-inspector',
            attributes: [
                {name: 'items', type: 'json', default: '[]', help: 'Drawer entries [{label, icon, view}] (managed in the inspector). An entry may carry sub-entries in an "items" array of its own — it then acts as a SECTION (its pages are the sub-entries; one nesting level).'},
                {name: 'nav-style', type: 'select', options: ['groups', 'rail-panel', 'tabs'], default: 'groups',
                    help: 'Presentation of two-level navigation, once an entry has sub-entries: groups = accordion sections in one drawer; rail-panel = slim icon rail for the sections with an entry panel beside it; tabs = sections in the drawer, the active section\'s pages as a tab row under the top bar. A flat entry list renders the classic single-level drawer in every style. Below the breakpoint, rail-panel merges into one accordion overlay; the tab row scrolls.'},
                // U107: whether a section HEADER click toggles the accordion or
                // always navigates (collapse then only via the chevron). Default
                // chevron — decided with the reporter; the feature is days old,
                // so flipping the default is deliberate and documented here.
                {name: 'section-toggle', type: 'select', options: ['chevron', 'header'], default: 'chevron',
                    help: 'Groups mode: what a section header click does. chevron = the header always navigates to the section\'s landing page and only the chevron expands/collapses; header = the whole header toggles the section (and navigates when opening). Keyboard Left/Right on a focused header works in both modes.'},
                {name: 'tab-sections', type: 'select', options: ['drawer', 'row'], default: 'drawer',
                    help: 'Tabs mode: where the sections (level 1) live. drawer = in the drawer as before; row = as a FIRST tab row above the pages row, so both levels sit in the tab-bar area (both rows scroll when narrow). The drawer keeps working either way.'},
                {name: 'breadcrumb', type: 'boolean', default: false,
                    help: 'Show the current location in the top bar as "Section / Page" instead of the plain page label; tapping the section segment opens the navigation.'},
                {name: 'title', type: 'string', default: '', help: 'Top-bar title.'},
                {name: 'header', type: 'select', options: ['always', 'small-only', 'never'], default: 'always',
                    help: 'When to show the top app bar: always; only on small screens (below the breakpoint, where the drawer collapses to a hamburger); or never (a floating hamburger keeps the overlay drawer reachable).'},
                {name: 'show-active-label', type: 'boolean', default: true,
                    help: 'Show the current page label in the top bar — right of the title, or right of the hamburger when the title is empty.'},
                {name: 'hide-header', type: 'boolean', default: false,
                    help: 'Deprecated — use header = never instead. Kept so older dashboards keep working; when on it forces the bar off.'},
                {name: 'subscribe-title', type: 'string', help: 'Optional — drive the title from an MQTT topic.'},
                {name: 'active-view', type: 'string', help: 'Initially selected content view (defaults to the first entry).'},
                {name: 'breakpoint', type: 'number', default: 768, help: 'Element width below which the drawer becomes an overlay.'},
                {name: 'drawer-persistent', type: 'boolean', default: true, help: 'If off, the drawer is always an overlay (hamburger at all sizes).'},
                {name: 'rail', type: 'select', options: ['off', 'slim', 'edge', 'auto'], default: 'off',
                    help: 'Persistent-drawer presentation above the breakpoint: off = full drawer; slim = icon-only rail; edge = thin edge; auto = a slim rail between the breakpoint and the rail breakpoint, a full drawer above it. No effect in overlay mode.'},
                {name: 'rail-breakpoint', type: 'number', default: 1024,
                    help: 'Only with rail = auto: at or above this element width the drawer is full; between the breakpoint and this it is a slim rail.'},
                {name: 'slim', type: 'boolean', default: false,
                    help: 'Deprecated — use rail = slim instead. Kept so older dashboards keep working.'},
                {name: 'autohide', type: 'boolean', default: false,
                    help: 'Deprecated — use rail = edge instead. Kept so older dashboards keep working.'},
                {name: 'rail-expand', type: 'select', options: ['overlay', 'push', 'never'], default: 'overlay',
                    help: 'How the rail reveals labels on hover / keyboard focus: overlay = draw the expanded panel OVER the content (content stays put); push = grow in place and push the content aside; never = never expand (labels only via the rail menu button). A pointer never expands the rail — only hover and keyboard focus do.'},
                {name: 'rail-menu-button', type: 'boolean', default: false,
                    help: 'Show a menu button at the top of the rail that opens the full drawer as an overlay — useful on touch, where hover cannot reveal the labels.'},
                {name: 'entry-style', type: 'select', options: ['pill', 'list'], default: 'pill',
                    help: 'Drawer entry look: "pill" = MD3 rounded chips with side inset; "list" = flat edge-to-edge rows, hover/active highlight the full drawer width.'},
                {name: 'actions', type: 'json', default: '[]', help: 'Top-bar action buttons [{icon, publish, payload}] (managed in the inspector).'},
                'subscribe',
                'publish',
            ],
            styles: ['background', 'border',
                {property: '--feezal-app-bar-bg', type: 'color', default: 'var(--primary-color)', help: 'Top app-bar background.'},
                {property: '--feezal-app-bar-color', type: 'color', default: '#fff', help: 'Top app-bar text/icon colour (on the primary-coloured bar).'},
                {property: '--feezal-app-drawer-bg', type: 'color', default: 'var(--divider-color)', help: 'Drawer background.'},
                {property: '--feezal-app-drawer-overlay-bg', type: 'color', default: 'var(--feezal-app-drawer-bg, var(--divider-color))', help: 'Narrow-mode (overlay) drawer COLOUR. Defaults to the drawer background. For see-through, use the opacity knob below rather than an rgba value.'},
                {property: '--feezal-app-drawer-overlay-opacity', default: '100', help: 'Narrow-mode (overlay) drawer TRANSPARENCY as a plain number 0–100: 100 = opaque, 60 = 60 % opaque (40 % see-through), 0 = fully transparent. Text/icons stay opaque.'},
                {property: '--feezal-app-drawer-color', type: 'color', default: 'var(--primary-text-color)', help: 'Drawer base text colour (icon/label default to this).'},
                {property: '--feezal-app-drawer-icon-color', type: 'color', default: 'var(--feezal-app-drawer-color, var(--primary-text-color))', help: 'Drawer entry icon colour.'},
                {property: '--feezal-app-drawer-label-color', type: 'color', default: 'var(--primary-text-color)', help: 'Drawer entry label colour.'},
                {property: '--feezal-app-active-indicator', type: 'color', default: 'var(--secondary-background-color)', help: 'Active drawer entry highlight.'},
                {property: '--feezal-app-active-color', type: 'color', default: 'var(--primary-color)', help: 'Active drawer entry text/icon colour.'},
                {property: '--feezal-app-drawer-width', type: 'string', default: '220px', help: 'Expanded drawer width.'},
                {property: '--feezal-app-panel-width', type: 'string', default: '200px', help: 'Width of the entry panel beside the icon rail (navigation style "rail + panel").'},
                {property: '--feezal-app-drawer-entry-inset', type: 'string', default: '8px',
                    help: 'Side gutter between the drawer edge and the entry rows — the space the hover/active highlight stops short of. Set "0" to let the highlight reach the drawer edge. Defaults to 8px with entry style "pill" and to 0 with "list". Applies to every drawer mode alike (full drawer, slim rail, expanded rail, overlay), so changing it never shifts the entries between modes.'},
                {property: '--feezal-app-content-padding', type: 'string', default: '0', help: 'Breathing room between the app bar / drawer and the embedded view. Full CSS padding shorthand, so per-side insets need no extra knobs: "16px", "8px 16px", "0 16px 24px". The embedded view\'s own background paints under it.'},
                {property: '--feezal-app-content-max-width', type: 'string', default: 'none', help: 'Caps the width of EVERY embedded view in one place and centres it — a phone/tablet column on a large monitor (e.g. "520px"). The content area\'s background fills the sides. Default none = full width.'},
                {property: '--feezal-app-scrollbar-color', type: 'color', default: 'var(--secondary-text-color)',
                    help: 'Thumb colour of the thin scrollbars on the drawer navigation and the content area. Defaults to the theme\'s secondary text colour, which reads on both light and dark drawer surfaces; set it explicitly if your drawer background needs more contrast.'},
            ],
            restrict: {move: false, resize: false, minWidth: 240, minHeight: 160},
            defaultStyle: {top: '0px', left: '0px', width: '100%', height: '100%'},
        };
    }

    static properties = {
        items:           {type: String,  reflect: true},
        navStyle:        {type: String,  reflect: true, attribute: 'nav-style'},
        sectionToggle:   {type: String,  reflect: true, attribute: 'section-toggle'},   // U107
        tabSections:     {type: String,  reflect: true, attribute: 'tab-sections'},     // U107
        breadcrumb:      {type: Boolean, reflect: true, converter: feezalBoolean},
        title:           {type: String,  reflect: true},
        header:          {type: String,  reflect: true},
        showActiveLabel: {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-active-label'},
        hideHeader:      {type: Boolean, reflect: true, attribute: 'hide-header'},
        subscribeTitle:  {type: String,  reflect: true, attribute: 'subscribe-title'},
        activeView:      {type: String,  reflect: true, attribute: 'active-view'},
        breakpoint:      {type: Number,  reflect: true},
        drawerPersistent:{type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'drawer-persistent'},
        rail:            {type: String,  reflect: true},
        railBreakpoint:  {type: Number,  reflect: true, attribute: 'rail-breakpoint'},
        railExpand:      {type: String,  reflect: true, attribute: 'rail-expand'},
        railMenuButton:  {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'rail-menu-button'},
        slim:            {type: Boolean, reflect: true},
        autohide:        {type: Boolean, reflect: true},
        entryStyle:      {type: String,  reflect: true, attribute: 'entry-style'},
        actions:         {type: String,  reflect: true},
        _active:         {state: true},
        _openSections:   {state: true},   // U103: expanded accordion sections (Set of slugs)
        _narrow:         {state: true},
        _railState:      {state: true},   // B84: '' | 'slim' | 'edge' — the derived persistent-mode rail
        _drawerOpen:     {state: true},
        _liveTitle:      {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host { display: block; box-sizing: border-box; overflow: hidden; container-type: inline-size; }

        /* B90 — ONE drawer geometry, per entry style, used by every drawer mode.
           The rail, its expanded panel and both overlays used to hardcode the
           pill numbers, so "list" gained an 8px gutter on expand and the icon
           moved 16 -> 19.5 -> 24px across the modes. Deriving them here is what
           keeps the icon still: the entry always starts at --_pad-x and its icon
           always at --_pad-x + --_epad-x, whatever mode the drawer is in.
           --_rail-w follows from those two so the rest icon is BOTH aligned with
           the expanded state and centred in the rail (64px for pill, as MD3). */
        :host {
            --_pad-x:  var(--feezal-app-drawer-entry-inset, 8px);
            --_epad-x: 12px;
            --_epad-y: 10px;
            --_radius: 24px;
            --_rail-w: calc(2 * (var(--_pad-x) + var(--_epad-x)) + 24px);
            /* U103: drawer surface composited over an opaque page backing —
               shared by the drawer, the rail and the entry panel so all three
               chrome surfaces stay identical (see the .drawer comment). */
            --_drawer-surface:
                linear-gradient(var(--feezal-app-drawer-bg, var(--divider-color)),
                                var(--feezal-app-drawer-bg, var(--divider-color))),
                var(--primary-background-color);
        }
        :host([entry-style="list"]) {
            --_pad-x:  var(--feezal-app-drawer-entry-inset, 0px);
            --_epad-x: 16px;
            --_epad-y: 11px;
            --_radius: 0;
        }
        .shell { display: flex; flex-direction: column; width: 100%; height: 100%; box-sizing: border-box;
            background: var(--primary-background-color); }
        .bar {
            flex: 0 0 auto; display: flex; align-items: center; gap: 8px; height: 56px; padding: 0 10px; box-sizing: border-box;
            background: var(--feezal-app-bar-bg, var(--primary-color));
            color: var(--feezal-app-bar-color, #fff);
            z-index: 2;
        }
        .bar .title { flex: 1; min-width: 0; font-size: 18px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        /* N39: current-page label — muted, inherits the bar text colour. */
        .bar .title .active-label { font-weight: 400; opacity: 0.8; }
        .bar .title .active-label .sep { opacity: 0.5; margin: 0 6px; }
        .bar .actions { display: flex; gap: 2px; }
        .iconbtn { border: none; background: none; color: inherit; cursor: pointer; width: 40px; height: 40px;
            border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .iconbtn:hover { background: rgba(255,255,255,0.16); }
        .iconbtn.dark:hover { background: rgba(0,0,0,0.08); }
        .mi { font-family: 'Material Icons'; font-style: normal; font-weight: normal; font-size: 22px; line-height: 1; }
        .body { flex: 1; min-height: 0; display: flex; position: relative; }
        .drawer {
            flex: 0 0 auto; width: var(--feezal-app-drawer-width, 220px); box-sizing: border-box;
            /* The drawer colour (default --divider-color) is usually SEMI-
               TRANSPARENT. As a flex sibling that is fine — the opaque .shell
               sits behind it. But a slim rail expands as an OVERLAY over the
               content (U64), where a translucent colour shows the view through
               it. Composite the drawer colour over an opaque page-background
               backing so every mode is opaque (the narrow overlay does the same
               via ::before). */
            background: var(--_drawer-surface);
            color: var(--feezal-app-drawer-color, var(--primary-text-color));
            border-right: 1px solid var(--divider-color);
            display: flex; flex-direction: column;
        }
        /* B129: the drawer is a NON-scrolling shell; the entries scroll in this
           inner column. Split because the narrow overlay paints its surface on
           an absolutely-positioned ::before — inside a scrolling element that
           pseudo sizes to ONE viewport of the drawer and scrolls away with the
           content, so everything below the first screenful had no background.
           The shell never scrolls → inset:0 covers everything visible. The
           entry inset/padding move here unchanged (B90: same rendered
           geometry), and the U94 thin scrollbar moves with the scroller. */
        .drawer-nav {
            flex: 1 1 auto; min-height: 0;
            padding: 8px var(--_pad-x); overflow-y: auto; overflow-x: hidden;
            display: flex; flex-direction: column; gap: 2px;
        }
        /* U94 — the app shell's two scroll surfaces (drawer + content).
           Shadow-DOM content gets the platform scrollbar, which on
           Chrome/Windows is the full-width native bar — far too heavy beside a
           navigation drawer — and whose default thumb colour vanishes against a
           themed drawer background (reported on midnight-blue: scrolling worked,
           the thumb was simply invisible).

           The thumb colour is a knob defaulting to a canonical theme variable,
           so it tracks the theme instead of being a fixed grey that works on
           exactly one background. The scrollbar-width / scrollbar-color pair covers
           Firefox; the ::-webkit- rules cover Chromium/Safari and are what give
           the thumb its rounded ends. */
        .drawer-nav, .content, .panel {
            scrollbar-width: thin;
            scrollbar-color: var(--feezal-app-scrollbar-color, var(--secondary-text-color)) transparent;
        }
        .drawer-nav::-webkit-scrollbar, .content::-webkit-scrollbar, .panel::-webkit-scrollbar { width: 8px; height: 8px; }
        .drawer-nav::-webkit-scrollbar-track, .content::-webkit-scrollbar-track, .panel::-webkit-scrollbar-track { background: transparent; }
        .drawer-nav::-webkit-scrollbar-thumb, .content::-webkit-scrollbar-thumb, .panel::-webkit-scrollbar-thumb {
            background: var(--feezal-app-scrollbar-color, var(--secondary-text-color));
            border-radius: 4px;
        }
        /* Chromium paints the corner where the two bars meet with its own
           default, which shows as a pale square against a dark drawer. */
        .drawer-nav::-webkit-scrollbar-corner, .content::-webkit-scrollbar-corner, .panel::-webkit-scrollbar-corner { background: transparent; }
        .entry {
            display: flex; align-items: center; gap: 12px; padding: var(--_epad-y) var(--_epad-x);
            border: none; background: none; cursor: pointer;
            color: inherit; font: inherit; text-align: left; border-radius: var(--_radius); width: 100%; box-sizing: border-box;
            white-space: nowrap;
        }
        .entry:hover { background: rgba(128,128,128,0.12); }
        /* Keyboard/TV focus is visible even without a pointer. */
        .entry:focus-visible { outline: 2px solid var(--feezal-app-active-color, var(--primary-color)); outline-offset: -2px; }
        .entry.active { background: var(--feezal-app-active-indicator, var(--secondary-background-color));
            font-weight: 600; }
        .entry .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            color: var(--feezal-app-drawer-label-color, var(--primary-text-color)); }
        /* A fixed 24px nav glyph (MD3). Load-bearing for the slim rail: the rest
           state centres the icon in the 64px rail and the expanded state left-
           aligns it at drawer-padding + entry-padding (8 + 12 = 20px). Those two
           positions coincide ONLY when the icon is 24px wide — inheriting the
           16px default made the icon jump sideways on every expand. */
        .entry feezal-icon { flex: 0 0 auto; font-size: 24px; width: 24px; height: 24px;
            color: var(--feezal-app-drawer-icon-color, var(--feezal-app-drawer-color, var(--primary-text-color))); }
        .entry.active .label, .entry.active feezal-icon {
            color: var(--feezal-app-active-color, var(--primary-color)); }

        /* entry-style="list": flat edge-to-edge rows — no pill radius, no side
           inset; hover/active highlight the full drawer width. The geometry
           itself lives in the :host block above (B90); only the row spacing is
           style-specific here. */
        :host([entry-style="list"]) .drawer-nav { gap: 0; }

        /* ── N36/B84: navigation rail (persistent mode only) ───────────────
           The presentation is derived to the rail-state host attribute by
           _recomputeNarrow() (slim = icon rail, edge = thin edge; unset = full
           drawer). U64 governs how the rest-to-expanded reveal behaves (overlay
           / push / never); the rest state and the label/entry collapse are
           shared. Icon-only / edge at rest, expand to icon+label on hover or
           keyboard focus (:has(:focus-visible) — a pointer must NOT expand it). */
        .drawer { transition: width 0.18s ease; }
        :host([rail-state="slim"]) .drawer { width: var(--_rail-w); }
        :host([rail-state="edge"]) .drawer { width: 8px; }
        :host([rail-state="edge"]) .drawer-nav { padding-left: 0; padding-right: 0; }
        /* rest: hide the labels (slim) / the whole entry (edge). The entry KEEPS
           its normal padding and stays left-aligned (B90) — centring it made the
           icon x depend on the rail width and on the entry style, so it landed
           somewhere different in every mode. Left-aligned it is at
           --_pad-x + --_epad-x in all of them, and --_rail-w is derived from
           exactly those two, so the icon is centred in the rail as well.
           gap:0 keeps the zero-width label's 12px flex gap out of the row.
           :not(.rail-open) is load-bearing: these selectors are more specific
           than the .rail-open ones below, so without it the menu-button overlay
           kept the collapsed presentation whenever the pointer was not over the
           drawer — i.e. always, on touch, which is what that button is for. */
        :host([rail-state="slim"]) .drawer:not(.rail-open):not(:hover):not(:has(:focus-visible)) .entry { gap: 0; }
        :host([rail-state="slim"]) .drawer:not(.rail-open):not(:hover):not(:has(:focus-visible)) .label { opacity: 0; width: 0; }
        :host([rail-state="edge"]) .drawer:not(.rail-open):not(:hover):not(:has(:focus-visible)) .entry { opacity: 0; }

        /* U64: overlay expansion (default) — the rail is taken out of flow and
           the content reserves its rest width with a gutter, so expanding the
           rail draws OVER the content instead of pushing it. Applied only when
           rail-expand is overlay (the default; push keeps the old in-flow grow,
           never never expands). */
        :host([rail-state="slim"][rail-expand="overlay"]) .drawer,
        :host([rail-state="edge"][rail-expand="overlay"]) .drawer {
            position: absolute; top: 0; bottom: 0; left: 0; z-index: 2;
        }
        :host([rail-state="slim"][rail-expand="overlay"]) .content { margin-left: var(--_rail-w); }
        :host([rail-state="edge"][rail-expand="overlay"]) .content { margin-left: 8px; }
        :host([rail-state="slim"][rail-expand="overlay"]) .drawer:hover,
        :host([rail-state="slim"][rail-expand="overlay"]) .drawer:has(:focus-visible),
        :host([rail-state="edge"][rail-expand="overlay"]) .drawer:hover,
        :host([rail-state="edge"][rail-expand="overlay"]) .drawer:has(:focus-visible) {
            width: var(--feezal-app-drawer-width, 220px); padding: 8px var(--_pad-x);
            box-shadow: 2px 0 12px rgba(0,0,0,0.22);
        }

        /* U64: push expansion — the old behaviour, kept for anyone who wants it.
           The rail stays an in-flow flex sibling and its width grows on reveal,
           reflowing the content. */
        :host([rail-state="slim"][rail-expand="push"]) .drawer:hover,
        :host([rail-state="slim"][rail-expand="push"]) .drawer:has(:focus-visible),
        :host([rail-state="edge"][rail-expand="push"]) .drawer:hover,
        :host([rail-state="edge"][rail-expand="push"]) .drawer:has(:focus-visible) {
            width: var(--feezal-app-drawer-width, 220px); padding: 8px var(--_pad-x);
            box-shadow: 2px 0 12px rgba(0,0,0,0.18);
        }
        /* rail-expand="never": no :hover/:focus rule at all — the rail never
           grows; labels are reached only via the rail menu button (U64). */

        /* U64: rail-top menu button — opens the OVERLAY drawer (reuses the
           narrow-mode drawer wholesale). Shown when rail-menu-button is on and a
           rail is presented; sits at the top of the rail because the app bar is
           not guaranteed to exist (header: never / small-only). */
        .rail-menu {
            flex: 0 0 auto; align-self: center; margin: 4px 0 6px;
            width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer;
            background: none; color: var(--feezal-app-drawer-icon-color, var(--feezal-app-drawer-color, var(--primary-text-color)));
            display: flex; align-items: center; justify-content: center;
        }
        .rail-menu:hover { background: rgba(128,128,128,0.14); }
        /* When the rail menu button opens the drawer, present the drawer as a
           full overlay regardless of the rest rail width. */
        :host([rail-state]) .drawer.rail-open {
            position: absolute; top: 0; bottom: 0; left: 0; z-index: 4;
            width: var(--feezal-app-drawer-width, 220px); padding: 8px var(--_pad-x);
            box-shadow: 2px 0 12px rgba(0,0,0,0.25);
        }
        /* Entries/labels need no override here — the collapsed rules above
           exclude .rail-open, so the base presentation applies (B90). */
        :host([rail-state]) .drawer.rail-open .entry { opacity: 1; }
        /* U50: the content inset. PADDING, not margin — .content carries the
           embedded view's background, and a margin would sit outside it and
           leave an unpainted gutter between the drawer and the view.

           box-sizing is load-bearing: .content is "flex: 1" (flex-basis 0%),
           so under content-box the grown size is the CONTENT box and the
           padding is added on top — the item would overflow its container by
           exactly the padding and "overflow: auto" would turn into permanent
           scrollbars. #content's 100%/100% then resolves against the content
           box, so the embedded view fits the inset area rather than escaping
           it. */
        .content { flex: 1; min-width: 0; position: relative; overflow: auto;
            box-sizing: border-box;
            padding: var(--feezal-app-content-padding, 0); }
        /* U58 App mode: one central width cap for every embedded view — a
           phone/tablet column on a big monitor, no per-sub-view drift. */
        #content { width: 100%; height: 100%;
            max-width: var(--feezal-app-content-max-width, none); margin: 0 auto; }
        .ph { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
            color: var(--secondary-text-color); font-size: 13px;
            background-image:
                linear-gradient(45deg, rgba(128,128,128,0.06) 25%, transparent 25%, transparent 75%, rgba(128,128,128,0.06) 75%),
                linear-gradient(45deg, rgba(128,128,128,0.06) 25%, transparent 25%, transparent 75%, rgba(128,128,128,0.06) 75%);
            background-size: 20px 20px; background-position: 0 0, 10px 10px; }
        .scrim { position: absolute; inset: 0; background: rgba(0,0,0,0.4); z-index: 3; }

        /* ── U103: two-level navigation chrome ─────────────────────────────
           groups: accordion section headers + indented children in the one
           drawer. rail-panel: a dedicated icon rail (level 1) + entry panel
           (level 2) replace the drawer while persistent. tabs: the drawer
           lists sections; the active section's pages form a scrollable tab
           row under the top bar. */
        .ghead .chev { margin-left: auto; font-size: 20px; opacity: 0.7;
            transition: transform 0.15s ease; }
        .ghead.open .chev { transform: rotate(90deg); }
        .gkids { display: flex; flex-direction: column; gap: 2px; padding-left: 14px; }

        .rail {
            flex: 0 0 auto; width: var(--_rail-w); box-sizing: border-box;
            display: flex; flex-direction: column; align-items: center; gap: 4px;
            padding: 8px 0; overflow-y: auto; overflow-x: hidden;
            background: var(--_drawer-surface);
            color: var(--feezal-app-drawer-color, var(--primary-text-color));
            border-right: 1px solid var(--divider-color);
        }
        .rentry {
            flex: 0 0 auto; width: 44px; height: 44px; border: none; background: none; cursor: pointer;
            border-radius: 12px; display: flex; align-items: center; justify-content: center;
            color: var(--feezal-app-drawer-icon-color, var(--feezal-app-drawer-color, var(--primary-text-color)));
        }
        .rentry:hover { background: rgba(128,128,128,0.12); }
        .rentry:focus-visible { outline: 2px solid var(--feezal-app-active-color, var(--primary-color)); outline-offset: -2px; }
        .rentry.active { background: var(--feezal-app-active-indicator, var(--secondary-background-color));
            color: var(--feezal-app-active-color, var(--primary-color)); }
        .rentry feezal-icon { font-size: 24px; width: 24px; height: 24px; }

        .panel {
            flex: 0 0 auto; width: var(--feezal-app-panel-width, 200px); box-sizing: border-box;
            display: flex; flex-direction: column; gap: 2px;
            padding: 8px var(--_pad-x); overflow-y: auto; overflow-x: hidden;
            background: var(--_drawer-surface);
            color: var(--feezal-app-drawer-color, var(--primary-text-color));
            border-right: 1px solid var(--divider-color);
        }
        .panel-title { flex: 0 0 auto; font-size: 11px; font-weight: 600; opacity: 0.65;
            text-transform: uppercase; letter-spacing: 0.05em;
            padding: 6px var(--_epad-x) 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* U107 chevron mode: the chevron is its own control — give it a
           real hit area and hover feedback so it reads as one. */
        :host([section-toggle='chevron']) .ghead .chev,
        :host(:not([section-toggle])) .ghead .chev {
            padding: 6px; margin: -6px; border-radius: 6px; cursor: pointer;
        }
        :host([section-toggle='chevron']) .ghead .chev:hover,
        :host(:not([section-toggle])) .ghead .chev:hover {
            background: color-mix(in srgb, currentColor 14%, transparent);
        }

        .tabrow {
            flex: 0 0 auto; display: flex; overflow-x: auto; scrollbar-width: none;
            background: var(--feezal-app-bar-bg, var(--primary-color));
            color: var(--feezal-app-bar-color, #fff);
            z-index: 1;
        }
        .tabrow::-webkit-scrollbar { display: none; }
        /* U107: the sections row sits above the pages row — a hairline keeps
           the two rows readable as two levels of the same bar. */
        .tabrow.sects { box-shadow: inset 0 -1px 0 color-mix(in srgb, currentColor 25%, transparent); }
        .tabrow.sects .tab { font-weight: 600; }
        /* Edge-fade hint, toggled by _syncTabOverflow only while overflowing. */
        .tabrow.fade {
            -webkit-mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent);
            mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent);
        }
        .tab {
            flex: 0 0 auto; border: none; background: none; color: inherit; font: inherit; cursor: pointer;
            padding: 10px 16px; opacity: 0.75; border-bottom: 3px solid transparent; white-space: nowrap;
        }
        .tab:hover { opacity: 1; }
        .tab:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }
        .tab.active { opacity: 1; font-weight: 600; border-bottom-color: currentColor; }

        /* U103 breadcrumb (top bar): Section / Page, section segment tappable. */
        .crumb { font-weight: 400; opacity: 0.9; }
        .crumb .csep { opacity: 0.5; margin: 0 6px; }
        .crumb-sect { border: none; background: none; color: inherit; font: inherit; cursor: pointer;
            padding: 0; opacity: 0.85; text-decoration: underline; text-decoration-color: transparent; }
        .crumb-sect:hover { opacity: 1; text-decoration-color: currentColor; }

        /* hide-header: floating hamburger so the overlay drawer stays reachable */
        .fab-menu {
            position: absolute; top: 10px; left: 10px; z-index: 5;
            width: 42px; height: 42px; border-radius: 50%; border: none; cursor: pointer;
            background: var(--feezal-app-bar-bg, var(--primary-color));
            color: var(--feezal-app-bar-color, #fff);
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center;
        }

        /* Narrow: drawer becomes an overlay driven by the hamburger. Its colour
           is --feezal-app-drawer-overlay-bg (defaults to the drawer background)
           and its TRANSPARENCY is a plain 0–100 number in
           --feezal-app-drawer-overlay-opacity (100 = opaque, 60 = 60 % opaque /
           40 % see-through, 0 = fully transparent).
           The background lives on a ::before layer that composites the drawer
           colour OVER an opaque page-background backing — so opacity 100 is
           truly opaque even though the drawer colour (default --divider-color)
           is itself semi-transparent — and a real opacity fades the backing
           without touching the text/icons. */
        :host(.narrow) .drawer { position: absolute; top: 0; bottom: 0; left: 0; z-index: 4; transform: translateX(-100%);
            background: none;
            transition: transform 0.2s ease; box-shadow: 2px 0 12px rgba(0,0,0,0.25); }
        :host(.narrow) .drawer::before {
            content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
            background:
                linear-gradient(
                    var(--feezal-app-drawer-overlay-bg, var(--feezal-app-drawer-bg, var(--divider-color))),
                    var(--feezal-app-drawer-overlay-bg, var(--feezal-app-drawer-bg, var(--divider-color)))),
                var(--primary-background-color);
            opacity: calc(var(--feezal-app-drawer-overlay-opacity, 100) / 100);
        }
        :host(.narrow) .drawer.open { transform: translateX(0); }
    `];

    constructor() {
        super();
        this.items = '[]';
        this.navStyle = 'groups';
        this.breadcrumb = false;
        this._openSections = new Set();
        this.sectionToggle = 'chevron';   // U107 — see the attribute comment
        this.tabSections = 'drawer';
        // U103: per-session "last visited page per section" — activating a
        // section returns to where you were. Deliberately NOT persisted.
        this._sectionMemory = new Map();
        this.title = '';
        this.header = 'always';
        this.showActiveLabel = true;
        this.hideHeader = false;
        this.subscribeTitle = '';
        this.activeView = '';
        this.breakpoint = 768;
        this.drawerPersistent = true;
        this.rail = '';            // '' = unset → falls back to slim/autohide alias, else 'off'
        this.railBreakpoint = 1024;
        this.railExpand = 'overlay';
        this.railMenuButton = false;
        this.slim = false;
        this.autohide = false;
        this.entryStyle = 'pill';
        this.actions = '[]';
        this._active = '';
        this._narrow = false;
        this._drawerOpen = false;
        this._liveTitle = null;
        this._mounted = undefined;
    }

    _subscribe() {
        if (feezal.isEditor && feezal.preventEditorMqtt !== false) return;
        if (this.subscribeTitle) {
            this.addSubscription(this.subscribeTitle, msg => { this._liveTitle = String(this.getProperty(msg, this.messageProperty) ?? ''); });
        }
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => { const v = String(this.getProperty(msg, this.messageProperty) ?? ''); if (v) this._select(v, false); });
        }
    }

    /** U103: a section's route slug — derived from its label, stable and
     * hash-safe (umlauts survive; the browser percent-encodes them). */
    static _slugify(s) {
        return String(s || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '') || 'section';
    }

    /**
     * U103: parse `items` into the two-level nav model (cached per raw string):
     * {tree, leaves, sectionOf, hasSections}. `tree` keeps document order —
     * sections ({label, icon, slug, items: [leaf…]}) and childless leaves
     * ({label, icon, view}) mixed. ONE nesting level: grandchildren are
     * flattened into their grandparent section with a console warning. A
     * section's own `view` (if any) is ignored — a section is not a page.
     */
    _nav() {
        const raw = this.items || '[]';
        if (this.__navCache?.raw === raw) return this.__navCache;
        let list;
        try { const r = JSON.parse(raw); list = Array.isArray(r) ? r : []; } catch { list = []; }
        const tree = [];
        const leaves = [];
        const sectionOf = new Map();
        const slugs = new Set();
        for (const e of list) {
            if (!e) continue;
            if (Array.isArray(e.items)) {
                const kids = [];
                for (const k of e.items) {
                    if (!k) continue;
                    if (Array.isArray(k.items)) {
                        if (!this.__navWarned) {
                            console.warn('feezal-element-layout-app: navigation items nested deeper than one level — flattened');
                            this.__navWarned = true;
                        }
                        for (const g of k.items) if (g && g.view) kids.push({label: g.label, icon: g.icon, view: g.view});
                        continue;
                    }
                    if (k.view) kids.push({label: k.label, icon: k.icon, view: k.view});
                }
                if (!kids.length) continue;   // an empty section renders nothing
                const base = this.constructor._slugify(e.label);
                let slug = base, n = 2;
                while (slugs.has(slug)) slug = `${base}-${n++}`;
                slugs.add(slug);
                const sect = {label: e.label, icon: e.icon, slug, items: kids};
                tree.push(sect);
                for (const k of kids) { leaves.push(k); sectionOf.set(k.view, sect); }
            } else if (e.view) {
                const leaf = {label: e.label, icon: e.icon, view: e.view};
                tree.push(leaf);
                leaves.push(leaf);
            }
        }
        this.__navCache = {raw, tree, leaves, sectionOf, hasSections: tree.some(t => t.items)};
        return this.__navCache;
    }

    /** Flat page entries, in nav order — sections' children inlined. All the
     * single-level code paths (default active, flat render, routing) use this. */
    _entries() { return this._nav().leaves; }

    /** U103: the presentation actually in effect — a FLAT items list renders
     * the classic single-level drawer whatever `nav-style` says, so existing
     * apps are untouched until a section exists. */
    get _navStyleEffective() {
        if (!this._nav().hasSections) return 'flat';
        return this.navStyle === 'rail-panel' || this.navStyle === 'tabs' ? this.navStyle : 'groups';
    }
    _actions() {
        try { const r = JSON.parse(this.actions || '[]'); return (Array.isArray(r) ? r : []).filter(a => a && a.icon); }
        catch { return []; }
    }

    /**
     * N36: recompute overlay/persistent mode. Shared by the ResizeObserver
     * (width changes) AND updated() (drawer-persistent / breakpoint changes) —
     * previously only the RO recomputed it, so toggling the drawer mode had no
     * effect until a resize or full reload, and the overlay hamburger could
     * stay hidden (the burger bug).
     */
    /**
     * B84: the persistent-drawer presentation axis — the `rail` enum, with the
     * deprecated `slim`/`autohide` booleans mapped onto it. `rail` is '' (unset)
     * by default so an old dashboard's boolean still wins; an explicit `rail`
     * value (incl. 'off') overrides. Mutually exclusive by construction — the
     * old booleans could both be set, and CSS source order decided the winner.
     */
    get _railMode() {
        // U103: nav-style "rail-panel" IS a rail presentation with its own
        // panel — the rail knob family is ignored there (mutually exclusive,
        // per the U103 decision). Only once sections exist; flat lists keep
        // the legacy axis untouched.
        if (this._navStyleEffective === 'rail-panel') return 'off';
        if (this.rail && this.rail !== '') return this.rail;   // explicit enum wins
        if (this.autohide) return 'edge';                      // deprecated alias
        if (this.slim) return 'slim';                          // deprecated alias
        return 'off';
    }

    _recomputeNarrow() {
        const w = this.clientWidth;
        // B84: a width of 0 means "not laid out yet", NOT "wide". The old code
        // conflated the two, so an element inside a hidden view answered
        // "persistent" from a measurement that never happened — and could just
        // as easily clear a correct narrow state. Wait for a real width; the
        // ResizeObserver delivers one as soon as the element gains a box.
        // (drawer-persistent=false forces overlay mode regardless of width, so
        // that case still needs no measurement.)
        if (w === 0 && this.drawerPersistent !== false) return;

        const narrow = w > 0 && w < (Number(this.breakpoint) || 768);
        const nowNarrow = narrow || this.drawerPersistent === false;
        const changed = nowNarrow !== this._narrow;
        this._narrow = nowNarrow;
        // B84: write the class UNCONDITIONALLY. It used to live inside the
        // `changed` guard, so a first computation that happened to equal the
        // initial `_narrow` never established the class at all — state and DOM
        // could disagree with nothing to re-sync them. Idempotent now.
        this.classList.toggle('narrow', nowNarrow);

        // B84: derive the persistent-mode rail presentation (three zones) EVERY
        // time from the current width — never latched — and publish it to the
        // stylesheet as the `rail-state` host attribute (the CSS cannot express
        // two width breakpoints against the element's own size). Only set while
        // persistent; overlay mode owns the whole drawer.
        let railState = '';
        if (!nowNarrow) {
            const mode = this._railMode;
            if (mode === 'slim' || mode === 'edge') {
                railState = mode;
            } else if (mode === 'auto') {
                const rbp = Number(this.railBreakpoint) || 1024;
                // rbp ≤ breakpoint collapses the middle zone → behave as full.
                railState = (w > 0 && w < rbp && rbp > (Number(this.breakpoint) || 768)) ? 'slim' : '';
            }
            // 'off' → '' (full drawer, today's default)
        }
        this._railState = railState;
        if (railState) this.setAttribute('rail-state', railState);
        else this.removeAttribute('rail-state');

        // Side effect stays on a real transition: in persistent mode there is
        // no "open" to close, and doing this every ResizeObserver tick would
        // fight the user.
        if (changed && !nowNarrow) this._drawerOpen = false;
        // U103 tabs: a resize can flip the row in/out of overflow.
        this._syncTabOverflow(false);
    }

    connectedCallback() {
        super.connectedCallback();
        this._ro = new ResizeObserver(() => this._recomputeNarrow());
        this._ro.observe(this);
        // N30: register as a site "view router" so the site's active-view
        // contract (URL hash, <publish>/view, inbound <subscribe>/view) covers
        // the sub-view this shell shows. Viewer only — the editor never routes.
        if (!feezal.isEditor) feezal.site?.registerViewRouter?.(this);
    }
    disconnectedCallback() {
        this._ro?.disconnect();
        this._clearHideTimers();
        if (!feezal.isEditor) feezal.site?.unregisterViewRouter?.(this);
        super.disconnectedCallback();
    }

    // ── N30: view-router interface (consumed by feezal-site) ─────────────────
    /** Embedded paths this shell can show: every page's bare view name, plus
     * the U103 `section-slug/view` form for nested pages — so both the legacy
     * two-segment deep link and the full three-segment one resolve here. */
    routableViews() {
        const {leaves, sectionOf} = this._nav();
        const out = leaves.map(e => e.view);
        for (const e of leaves) {
            const s = sectionOf.get(e.view);
            if (s) out.push(`${s.slug}/${e.view}`);
        }
        return out;
    }
    /** The sub-view currently embedded (`section-slug/view` when nested), or null. */
    activeEmbedded() {
        if (!this._active) return null;
        const s = this._nav().sectionOf.get(this._active);
        return s ? `${s.slug}/${this._active}` : this._active;
    }
    /** Programmatic route from the site (inbound MQTT / deep-link) — no re-notify.
     * Accepts a bare view name OR `section/view` (U103); the section of a bare
     * nested view is derived — every view appears once in the tree.
     * Same-view routes no-op (B41): the drawer's own hash write fires hashchange,
     * which routes back here — without the guard every pick re-cloned the view. */
    routeToEmbedded(path) {
        if (!path) return;
        const slash = path.indexOf('/');
        const view = slash >= 0 ? path.slice(slash + 1) : path;
        if (!view || view === this._active) return;
        if (!this._nav().leaves.some(e => e.view === view)) return;
        this._active = view;
        this._afterNavigate(view);
        if (this._narrow) this._drawerOpen = false;
        this._embed(true);
    }

    /** U103: post-navigation bookkeeping — remember the page as its section's
     * "last visited" and make sure the section is expanded in accordion mode. */
    _afterNavigate(view) {
        const s = this._nav().sectionOf.get(view);
        if (!s) return;
        this._sectionMemory.set(s.slug, view);
        if (!this._openSections.has(s.slug)) this._openSections = new Set([...this._openSections, s.slug]);
    }

    /** U103: the page a section activation lands on — last visited, else first. */
    _sectionLanding(sect) {
        const mem = this._sectionMemory.get(sect.slug);
        return sect.items.some(k => k.view === mem) ? mem : sect.items[0].view;
    }

    firstUpdated() {
        this._initialized = true;
        // Keep an _active already set by an N30 deep-link route (registerViewRouter
        // → routeToEmbedded runs in connectedCallback, before this).
        if (!this._active) this._active = this.activeView || (this._entries()[0]?.view) || '';
        this._afterNavigate(this._active);
        this._embed(true);
        // Bug fix: the ResizeObserver's first delivery can race the initial
        // layout — a transient sub-breakpoint width would flip to overlay mode
        // and hide the persistent drawer until a manual resize. Re-measure once
        // layout has settled so a wide viewer shows the drawer immediately.
        requestAnimationFrame(() => this._recomputeNarrow());
    }
    updated(changed) {
        super.updated(changed);
        // N36: re-derive overlay mode when the config that drives it changes,
        // not only on resize — so switching drawer mode in the inspector / via
        // a deploy takes effect without a manual resize or hard reload.
        if (changed.has('drawerPersistent') || changed.has('breakpoint') ||
            changed.has('rail') || changed.has('railBreakpoint') ||
            changed.has('slim') || changed.has('autohide') ||
            changed.has('navStyle') || changed.has('items')) {
            // U103: nav-style / items can flip rail-panel exclusivity — the
            // derived rail-state must clear/return without a resize.
            this._recomputeNarrow();
        }
        // U103 tabs: the overflow fade + active-tab scroll track every render.
        this._syncTabOverflow(changed.has('_active'));
        if (!this._initialized) return;
        if (changed.has('items') && !this._entries().some(e => e.view === this._active)) {
            this._active = this.activeView || (this._entries()[0]?.view) || '';
        }
        if (changed.has('items') || changed.has('activeView')) this._embed(true);
    }

    /** U103 tabs: edge-fade hint only while the row actually overflows, and
     * keep the active tab scrolled into view when the page changes. */
    _syncTabOverflow(scrollActive) {
        // U107: with tab-sections=row there are TWO rows — treat each alike.
        for (const row of this.renderRoot?.querySelectorAll?.('.tabrow') || []) {
            row.classList.toggle('fade', row.scrollWidth > row.clientWidth + 1);
            if (scrollActive) row.querySelector('.tab.active')?.scrollIntoView?.({block: 'nearest', inline: 'nearest'});
        }
    }

    _select(view, closeDrawer = true) {
        if (!view) return;
        this._active = view;
        this._afterNavigate(view);
        // U64: close the overlay on select — narrow mode OR a rail-menu overlay.
        if (closeDrawer && this._drawerOpen) this._drawerOpen = false;
        this._embed(true);
        // N30: tell the site so it syncs the URL hash to #/<view>/<embedded>
        // and publishes the nested path on <publish>/view.
        if (!feezal.isEditor) feezal.site?.notifyRouterView?.(this);
        // Element-level publish kept for back-compat (deprecated in favour of
        // the site view contract; see N30).
        if (this.publish && !feezal.isEditor) feezal.connection?.pub?.(this.publish, view);
    }

    _embed(force) {
        const content = this.renderRoot && this.renderRoot.querySelector('#content');
        if (!content) return;
        if (feezal.isEditor) { content.replaceChildren(); return; }   // editor uses the .ph placeholder overlay
        const name = this._active;
        // Skip a redundant re-embed of the SAME view that is ALREADY mounted:
        // replaceChildren() below would tear down the live clone (disconnecting
        // its elements → unsubscribe) and rebuild it, causing subscribe →
        // unsubscribe → subscribe churn when _embed(true) fires several times on
        // init (items + activeView in updated(), plus N30 hash routing). `force`
        // no longer re-clones an already-shown view — the source view is
        // immutable in the viewer, and the editor path returned above.
        if (name === this._mounted && content.firstElementChild) return;
        this._mounted = name;
        if (!name || !feezal.site) { content.replaceChildren(); return; }
        const view = feezal.site.querySelector(`feezal-view[name="${name}"]`);
        if (!view) { this._clearHideTimers(); content.replaceChildren(); return; }
        // N40 keep-alive: keep visited sub-view clones MOUNTED (display toggled)
        // so their subscriptions stay warm across drawer switches. A hidden clone
        // is torn down (→ its elements disconnect → unsubscribe) ONLY after the
        // site's pause grace period, and ONLY when the site pauses hidden views —
        // otherwise it stays warm. So a switch never unsubscribes immediately;
        // the grace (N37, default 30s) is respected on sub-view switches too.
        // N36: the embedded view lays out as a BLOCK so its own width/height
        // apply (inside #content, an inline feezal-view collapses).
        let clone = [...content.children].find(c => c.__feezalViewName === name);
        if (!clone) {
            clone = view.cloneNode(true);
            clone.__feezalViewName = name;     // JS property (survives, not serialized)
            content.append(clone);
        }
        for (const child of [...content.children]) {
            if (child === clone) { child.style.display = 'block'; this._cancelHide(child); }
            else { child.style.display = 'none'; this._scheduleHide(child); }
        }
        // B50: per-view theme CSS lives in DOCUMENT stylesheets
        // (.feezal-theme-x { --vars… }) which cannot match the clone inside our
        // shadow root — mirror the matching rules in so the view's own theme
        // renders when embedded (in the editor/standalone viewer the view is
        // light DOM and needs nothing).
        this._syncEmbeddedThemeCss(clone);
        // N36: fill the content area with the embedded view's OWN background so
        // it shows even where the view is smaller than the shell — the same
        // contract feezal-site applies via --feezal-canvas-bg for top-level views.
        const box = this.renderRoot.querySelector('.content');
        if (box) {
            for (const p of ['background', 'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat']) {
                box.style.setProperty(p, view.style.getPropertyValue(p) || '');
            }
            // B62: with a gradient, the CLONE must not paint it as well. The
            // clone's box is one viewport tall while its flow content is
            // several viewports tall, so the band it paints scrolls away and
            // drags a moving seam across the identical gradient on .content
            // underneath. .content is the scroller and is exactly one viewport,
            // so its own background (attachment: scroll) is already
            // viewport-pinned — the clone only has to stop competing with it.
            // Same defect and same remedy as the site-level one in
            // feezal-site.js; measured in test-e2e/b62-sticky-background.test.js.
            // B83: the inline `background` shorthand getter returns '' when the
            // background is authored as longhands (what the background editor
            // writes) or via var()/theme CSS, so this test never fired on a
            // real site and the clone kept painting its own scrolling band.
            // The computed image sees every authoring form.
            const computedImage = getComputedStyle(view).backgroundImage;
            const bg = (computedImage && computedImage !== 'none' ? computedImage : '')
                || view.style.background || view.style.backgroundColor || '';
            if (/gradient\(/i.test(bg)) {
                clone.style.setProperty('background-image', 'none', 'important');
                box.style.setProperty('background-attachment', 'scroll');
                box.style.setProperty('background-size', 'cover');
                box.style.setProperty('background-repeat', 'no-repeat');
            }
        }
    }

    // ── N40: keep-alive of hidden sub-view clones (grace-period teardown) ──────

    /** A now-active clone is being shown: cancel any pending teardown. */
    _cancelHide(clone) {
        const t = this._hideTimers?.get(clone);
        if (t) { clearTimeout(t); this._hideTimers.delete(clone); }
    }

    /** A now-hidden clone: keep it warm, but — when the site pauses hidden views —
     * tear it down AFTER the pause grace period (N37), so a drawer switch never
     * unsubscribes immediately. With pause off it stays warm indefinitely. */
    _scheduleHide(clone) {
        if (!this._shouldPauseView(clone.__feezalViewName)) return;   // pause off → stay warm
        if (this._hideTimers?.has(clone)) return;                     // already scheduled
        if (!this._hideTimers) this._hideTimers = new Map();
        const drop = () => {
            this._hideTimers.delete(clone);
            if (clone.style.display !== 'none' || !clone.isConnected) return;   // shown again meanwhile
            clone.remove();   // → disconnectedCallback on its elements → unsubscribe
        };
        const ms = this._pauseGraceMs();
        if (ms <= 0) drop();
        else this._hideTimers.set(clone, setTimeout(drop, ms));
    }

    _clearHideTimers() {
        if (!this._hideTimers) return;
        for (const t of this._hideTimers.values()) clearTimeout(t);
        this._hideTimers.clear();
    }

    /** Whether a hidden clone of `name` should be paused/torn down — per-view
     * `pause-subscriptions` tri-state over the site's `pause-hidden-subscriptions`
     * default (mirrors FeezalVisibility._effective). */
    _shouldPauseView(name) {
        const v = feezal.site?.querySelector?.(`feezal-view[name="${name}"]`);
        const mode = v?.getAttribute('pause-subscriptions');
        if (mode === 'never') return false;
        if (mode === 'always') return true;
        return Boolean(feezal.site?.hasAttribute?.('pause-hidden-subscriptions'));
    }

    _pauseGraceMs() {
        const s = Number(feezal.site?.getAttribute?.('pause-grace-seconds'));
        return (Number.isFinite(s) && s >= 0 ? s : 30) * 1000;
    }

    /**
     * B50 — copy every document CSS rule that targets the embedded clone's
     * `feezal-theme-*` class into a <style> inside this shadow root. Document
     * stylesheets never match elements in a shadow tree, so without this the
     * embedded view silently renders in the shell's theme. Covers plain rules
     * and @media-wrapped ones (prefers-color-scheme); user-theme <link>s that
     * finish loading after embed re-sync once via their load event.
     */
    _syncEmbeddedThemeCss(clone) {
        const cls = clone ? [...clone.classList].find(c => c.startsWith('feezal-theme-')) : null;
        let styleEl = this.renderRoot.querySelector('#embedded-theme-css');
        if (!cls) { if (styleEl) styleEl.textContent = ''; return; }
        const needle = '.' + cls;
        let css = '';
        for (const sheet of document.styleSheets) {
            let rules;
            try { rules = sheet.cssRules; } catch { continue; }   // cross-origin
            for (const rule of rules) {
                if (rule.selectorText) {
                    if (rule.selectorText.includes(needle)) css += rule.cssText + '\n';
                } else if (rule.cssRules) {   // @media / @supports wrapper
                    for (const inner of rule.cssRules) {
                        if (inner.selectorText && inner.selectorText.includes(needle)) {
                            css += rule.cssText + '\n';
                            break;
                        }
                    }
                }
            }
        }
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'embedded-theme-css';
            this.renderRoot.append(styleEl);
        }
        styleEl.textContent = css;
        // A user theme's <link> may not have loaded yet — re-sync once it does.
        if (!css) {
            document.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
                if (l.__feezalThemeResync) return;
                l.__feezalThemeResync = true;
                l.addEventListener('load', () => this._syncEmbeddedThemeCss(
                    this.renderRoot.querySelector('#content feezal-view')), {once: true});
            });
        }
    }

    _doAction(a) {
        if (feezal.isEditor) return;
        if (a.publish) feezal.connection?.pub?.(a.publish, a.payload ?? '');
    }

    /**
     * N36: keyboard / smart-TV D-pad navigation between drawer entries.
     * Up/Down (and Left/Right for a horizontal remote feel) move focus; Home/End
     * jump to the ends; Escape closes an open overlay drawer. Enter/Space
     * activate natively (the entries are real buttons). Focus entering the
     * drawer also expands a slim/autohide rail via :focus-within (CSS).
     */
    _onDrawerKeydown(e) {
        // U64: Escape closes a narrow overlay OR a rail-menu overlay.
        if (e.key === 'Escape' && this._drawerOpen) {
            this._drawerOpen = false;
            return;
        }
        // U103 accordion (tree pattern): Right on a collapsed section opens it,
        // Left on an open section closes it, Left on a child jumps to its
        // section header. Only once sections exist — a flat drawer keeps the
        // Left/Right = previous/next remote feel below.
        if (this._nav().hasSections) {
            const f = this.renderRoot.activeElement;
            if (f?.classList?.contains('ghead')) {
                const slug = f.dataset.slug;
                if (e.key === 'ArrowRight' && !this._openSections.has(slug)) {
                    e.preventDefault();
                    this._openSections = new Set([...this._openSections, slug]);
                    return;
                }
                if (e.key === 'ArrowLeft' && this._openSections.has(slug)) {
                    e.preventDefault();
                    const s = new Set(this._openSections);
                    s.delete(slug);
                    this._openSections = s;
                    return;
                }
            } else if (f?.closest?.('.gkids') && e.key === 'ArrowLeft') {
                e.preventDefault();
                f.closest('.gkids').previousElementSibling?.focus();
                return;
            }
        }
        const nav = {ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1};
        const buttons = [...this.renderRoot.querySelectorAll('.drawer .entry')];
        if (!buttons.length) return;
        if (e.key === 'Home') { e.preventDefault(); buttons[0].focus(); return; }
        if (e.key === 'End') { e.preventDefault(); buttons[buttons.length - 1].focus(); return; }
        if (!(e.key in nav)) return;
        e.preventDefault();
        const idx = buttons.indexOf(this.renderRoot.activeElement);
        const from = idx < 0 ? (nav[e.key] > 0 ? -1 : 0) : idx;
        const next = (from + nav[e.key] + buttons.length) % buttons.length;
        buttons[next].focus();
    }

    /** U103 rail-panel: Up/Down cycle the rail; Right crosses into the panel. */
    _onRailKeydown(e) {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            this.renderRoot.querySelector('.panel .entry')?.focus();
            return;
        }
        const nav = {ArrowDown: 1, ArrowUp: -1};
        const btns = [...this.renderRoot.querySelectorAll('.rail .rentry')];
        if (!btns.length || !(e.key in nav)) return;
        e.preventDefault();
        const i = btns.indexOf(this.renderRoot.activeElement);
        btns[(Math.max(i, 0) + nav[e.key] + btns.length) % btns.length].focus();
    }

    /** U103 rail-panel: Up/Down cycle the panel; Left returns to the rail. */
    _onPanelKeydown(e) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            (this.renderRoot.querySelector('.rail .rentry.active')
                || this.renderRoot.querySelector('.rail .rentry'))?.focus();
            return;
        }
        const nav = {ArrowDown: 1, ArrowUp: -1};
        const btns = [...this.renderRoot.querySelectorAll('.panel .entry')];
        if (!btns.length || !(e.key in nav)) return;
        e.preventDefault();
        const i = btns.indexOf(this.renderRoot.activeElement);
        btns[(Math.max(i, 0) + nav[e.key] + btns.length) % btns.length].focus();
    }

    /** U103 tabs: Left/Right/Home/End move along the tab row. */
    _onTabKeydown(e) {
        // U107: scoped to the row the event came from — with tab-sections=row
        // the two rows are separate arrow groups (Tab crosses them).
        const btns = [...e.currentTarget.querySelectorAll('.tab')];
        if (!btns.length) return;
        if (e.key === 'Home') { e.preventDefault(); btns[0].focus(); return; }
        if (e.key === 'End') { e.preventDefault(); btns[btns.length - 1].focus(); return; }
        const nav = {ArrowRight: 1, ArrowLeft: -1};
        if (!(e.key in nav)) return;
        e.preventDefault();
        const i = btns.indexOf(this.renderRoot.activeElement);
        btns[(Math.max(i, 0) + nav[e.key] + btns.length) % btns.length].focus();
    }

    // ── U103: level-1 activation handlers (decision: navigate immediately) ────

    /** Accordion section header. U107: mode-aware —
     * `header`: closed → open + navigate; open → just collapse (the U103
     *           behaviour).
     * `chevron` (default): the header ALWAYS navigates to the section's
     *           landing page (opening it if needed) and never collapses —
     *           collapsing is the chevron's job (_sectionChevron). */
    _sectionHead(sect) {
        if (this.sectionToggle === 'header') {
            if (this._openSections.has(sect.slug)) {
                const s = new Set(this._openSections);
                s.delete(sect.slug);
                this._openSections = s;
                return;
            }
            this._openSections = new Set([...this._openSections, sect.slug]);
            this._select(this._sectionLanding(sect), false);
            return;
        }
        if (!this._openSections.has(sect.slug)) {
            this._openSections = new Set([...this._openSections, sect.slug]);
        }
        this._select(this._sectionLanding(sect), false);
    }

    /** U107 chevron mode: the chevron is the collapse control — a pure
     * toggle, no navigation. In header mode it does nothing of its own and
     * the click bubbles to the header. */
    _sectionChevron(e, sect) {
        if (this.sectionToggle === 'header') return;
        e.stopPropagation();
        if (this._openSections.has(sect.slug)) {
            const s = new Set(this._openSections);
            s.delete(sect.slug);
            this._openSections = s;
        } else {
            this._openSections = new Set([...this._openSections, sect.slug]);
        }
    }

    /** Rail / tabs-drawer section activation: navigate to the landing page. */
    _sectionPick(sect, closeDrawer = true) {
        this._select(this._sectionLanding(sect), closeDrawer);
    }

    /** Breadcrumb section segment: opens the level-1 surface — the overlay
     * when narrow, the accordion section when grouped; rail-panel/tabs already
     * show level 1 persistently (no-op there). */
    _crumbSection(sect) {
        if (this._narrow) { this._drawerOpen = true; return; }
        if (this._navStyleEffective === 'groups' && !this._openSections.has(sect.slug)) {
            this._openSections = new Set([...this._openSections, sect.slug]);
        }
    }

    /** N39: effective header mode — `hide-header` is a deprecated alias for `never`. */
    get _headerMode() {
        return this.hideHeader ? 'never' : (this.header || 'always');
    }

    /** N39: is the top bar shown right now? small-only → only in narrow mode. */
    get _showHeader() {
        const m = this._headerMode;
        return m === 'never' ? false : (m === 'small-only' ? this._narrow : true);
    }

    /** One page entry button — shared by the flat drawer, the accordion
     * children and the rail-panel entry list. */
    _entryBtn(e) {
        return html`
            <button class="entry ${e.view === this._active ? 'active' : ''}"
                title="${e.label || e.view}"
                aria-current="${e.view === this._active ? 'page' : 'false'}"
                @click="${() => this._select(e.view)}">
                ${e.icon ? html`<feezal-icon class="mi" name="${e.icon}"></feezal-icon>` : ''}
                <span class="label">${e.label || e.view}</span>
            </button>`;
    }

    /** U103: the drawer's inner rows for the current presentation. */
    _drawerRows(nav, mode, activeSect) {
        if (mode === 'accordion') {
            return nav.tree.map(node => node.items ? html`
                <button class="entry ghead ${this._openSections.has(node.slug) ? 'open' : ''}"
                    data-slug="${node.slug}" title="${node.label || node.slug}"
                    aria-expanded="${this._openSections.has(node.slug)}"
                    @click="${() => this._sectionHead(node)}">
                    ${node.icon ? html`<feezal-icon class="mi" name="${node.icon}"></feezal-icon>` : ''}
                    <span class="label">${node.label || node.slug}</span>
                    <span class="mi chev" @click="${e => this._sectionChevron(e, node)}">chevron_right</span>
                </button>
                ${this._openSections.has(node.slug) ? html`
                    <div class="gkids">${node.items.map(k => this._entryBtn(k))}</div>` : ''}`
            : this._entryBtn(node));
        }
        if (mode === 'sections') {   // tabs: level 1 only — pages live in the tab row
            return nav.tree.map(node => node.items ? html`
                <button class="entry ${activeSect === node ? 'active' : ''}"
                    title="${node.label || node.slug}"
                    aria-current="${activeSect === node ? 'true' : 'false'}"
                    @click="${() => this._sectionPick(node)}">
                    ${node.icon ? html`<feezal-icon class="mi" name="${node.icon}"></feezal-icon>` : ''}
                    <span class="label">${node.label || node.slug}</span>
                </button>`
            : this._entryBtn(node));
        }
        return nav.leaves.map(e => this._entryBtn(e));   // flat (pre-U103)
    }

    render() {
        const nav = this._nav();
        const entries = nav.leaves;
        const title = this._liveTitle != null ? this._liveTitle : (this.title || '');
        const showHam = this._narrow;
        // N39: the current page's label (falls back to the view name, matching the
        // drawer entries). In the editor `_active` is the first entry, so the
        // preview shows a real label.
        const activeEntry = entries.find(e => e.view === this._active);
        const activeSect = nav.sectionOf.get(this._active) || null;
        const activeLabel = this.showActiveLabel && activeEntry ? (activeEntry.label || activeEntry.view) : '';
        const showHeader = this._showHeader;
        // U103: effective presentation. Below the breakpoint rail-panel merges
        // into ONE accordion overlay; tabs keeps its (scrollable) row and the
        // overlay drawer lists the sections.
        const style = this._navStyleEffective;
        const railPanel = style === 'rail-panel' && !this._narrow;
        const tabs = style === 'tabs';
        const drawerMode = style === 'flat' ? 'flat'
            : tabs ? 'sections'
            : railPanel ? 'none'
            : 'accordion';   // groups, and narrow rail-panel
        // U103 breadcrumb: replaces the plain active-label when enabled.
        const crumb = this.breadcrumb && activeEntry ? {
            sect: activeSect,
            page: activeEntry.label || activeEntry.view,
        } : null;
        // U64: a rail is presented (slim/edge) — the rail-menu button opens the
        // drawer as an overlay (`rail-open`), reusing the narrow-mode chrome.
        const railPresented = !this._narrow && !!this._railState;
        const railOpen = railPresented && this._drawerOpen;
        const scrimShown = (this._narrow || railPresented) && this._drawerOpen;
        return html`
            <div class="shell">
                ${showHeader ? html`
                    <div class="bar">
                        ${showHam ? html`<button class="iconbtn" title="Menu" @click="${() => { this._drawerOpen = !this._drawerOpen; }}"><span class="mi">menu</span></button>` : ''}
                        <div class="title">
                            ${title ? html`<span class="app-title">${title}</span>` : ''}
                            ${crumb ? html`
                                <span class="crumb">${title ? html`<span class="sep">·</span>` : ''}${crumb.sect ? html`
                                    <button class="crumb-sect" @click="${() => this._crumbSection(crumb.sect)}">${crumb.sect.label || crumb.sect.slug}</button><span class="csep">/</span>` : ''}<span class="crumb-page">${crumb.page}</span></span>`
                            : activeLabel ? html`<span class="active-label">${title ? html`<span class="sep">·</span>` : ''}${activeLabel}</span>` : ''}
                        </div>
                        <div class="actions">
                            ${this._actions().map(a => html`<button class="iconbtn" title="${a.icon}" @click="${() => this._doAction(a)}"><feezal-icon class="mi" name="${a.icon}"></feezal-icon></button>`)}
                        </div>
                    </div>` : ''}
                ${tabs && this.tabSections === 'row' ? html`
                    <div class="tabrow sects" role="navigation" @keydown="${e => this._onTabKeydown(e)}">
                        ${nav.tree.map(node => node.items ? html`
                            <button class="tab ${activeSect === node ? 'active' : ''}"
                                aria-current="${activeSect === node ? 'true' : 'false'}"
                                @click="${() => this._sectionPick(node, false)}">${node.label || node.slug}</button>`
                        : html`
                            <button class="tab ${node.view === this._active ? 'active' : ''}"
                                aria-current="${node.view === this._active ? 'page' : 'false'}"
                                @click="${() => this._select(node.view, false)}">${node.label || node.view}</button>`)}
                    </div>` : ''}
                ${tabs && activeSect ? html`
                    <div class="tabrow" role="navigation" @keydown="${e => this._onTabKeydown(e)}">
                        ${activeSect.items.map(k => html`
                            <button class="tab ${k.view === this._active ? 'active' : ''}"
                                aria-current="${k.view === this._active ? 'page' : 'false'}"
                                @click="${() => this._select(k.view)}">${k.label || k.view}</button>`)}
                    </div>` : ''}
                <div class="body">
                    ${!showHeader && showHam && !this._drawerOpen ? html`
                        <button class="fab-menu" title="Menu" @click="${() => { this._drawerOpen = true; }}"><span class="mi">menu</span></button>` : ''}
                    ${railPanel ? html`
                        <div class="rail" role="navigation" @keydown="${e => this._onRailKeydown(e)}">
                            ${nav.tree.map(node => node.items ? html`
                                <button class="rentry ${activeSect === node ? 'active' : ''}"
                                    title="${node.label || node.slug}"
                                    @click="${() => this._sectionPick(node, false)}">
                                    <feezal-icon class="mi" name="${node.icon || 'folder'}"></feezal-icon>
                                </button>`
                            : html`
                                <button class="rentry ${node.view === this._active ? 'active' : ''}"
                                    title="${node.label || node.view}"
                                    @click="${() => this._select(node.view, false)}">
                                    <feezal-icon class="mi" name="${node.icon || 'circle'}"></feezal-icon>
                                </button>`)}
                        </div>
                        ${activeSect ? html`
                            <div class="panel" role="navigation" @keydown="${e => this._onPanelKeydown(e)}">
                                <div class="panel-title">${activeSect.label || activeSect.slug}</div>
                                ${activeSect.items.map(k => this._entryBtn(k))}
                            </div>` : ''}`
                    : html`
                        <div class="drawer ${this._drawerOpen ? 'open' : ''} ${railOpen ? 'rail-open' : ''}" role="navigation"
                            @keydown="${e => this._onDrawerKeydown(e)}">
                            ${railPresented && this.railMenuButton && !this._drawerOpen ? html`
                                <button class="rail-menu" title="Menu" @click="${() => { this._drawerOpen = true; }}"><span class="mi">menu</span></button>` : ''}
                            <div class="drawer-nav">
                                ${entries.length === 0
                                    ? html`<div style="opacity:.6;padding:10px;font-size:12px">${feezal.isEditor ? 'Add drawer entries in the inspector →' : ''}</div>`
                                    : this._drawerRows(nav, drawerMode, activeSect)}
                            </div>
                        </div>`}
                    ${scrimShown ? html`<div class="scrim" @click="${() => { this._drawerOpen = false; }}"></div>` : ''}
                    <div class="content">
                        <div id="content"></div>
                        ${feezal.isEditor ? html`<div class="ph">${this._active ? `View: ${this._active}` : '(no view selected)'}</div>` : ''}
                    </div>
                </div>
            </div>`;
    }
}

customElements.define('feezal-element-layout-app', FeezalElementLayoutApp);
export {FeezalElementLayoutApp};

// ─── N6 custom inspector ────────────────────────────────────────────────────────

// U47: sentinel value for the "create new view" entry in the per-entry view
// dropdown. Never written into `items` — picking it opens the create dialog.
// No spaces (Shoelace option values must be space-free) and namespaced so no
// real view name can collide with it.
const CREATE_VIEW_SENTINEL = '__feezal-create-new-view__';


/**
 * U107 — one drag-and-drop move on the entries tree. Pure: list in, new list
 * out, or null for an invalid/no-op move (the caller then saves nothing).
 *
 * `from` and `target` are paths ([i] top level, [i, j] sub-entry); `mode` is
 * 'before' | 'after' (reorder into the target's sibling list) or 'into'
 * (re-home onto a top-level row: a section appends the entry; a childless
 * item first CONVERTS to a section, exactly the _indent semantics — its own
 * view becomes its first child).
 *
 * Sections themselves only ever move at the top level: one nesting level is
 * the U103 data model, so a section into a section (or beside a sub-entry)
 * is invalid, not clamped — a drop that would change meaning silently is
 * worse than one that does nothing.
 */
export function moveEntry(list, from, target, mode) {
    const l = structuredClone(list);
    const at = (arr, path) => (path.length === 1 ? arr[path[0]] : arr[path[0]]?.items?.[path[1]]);
    const node = at(l, from);
    const dest = at(l, target);
    if (!node || !dest || node === dest) return null;
    const isSection = Array.isArray(node.items);
    // a section dragged onto/next to anything nested → invalid
    if (isSection && (mode === 'into' || target.length > 1)) return null;
    // dragging a section onto its own child cannot happen (paths), but a
    // childless 'into' its own section head is a no-op re-home:
    if (mode === 'into' && from.length === 2 && target[0] === from[0]) return null;

    // remove the source (by path — the clone made identities fresh)
    if (from.length === 1) l.splice(from[0], 1);
    else l[from[0]].items.splice(from[1], 1);

    // re-locate the destination by identity after the removal
    const findPath = () => {
        for (let i = 0; i < l.length; i++) {
            if (l[i] === dest) return [i];
            const kids = l[i].items;
            if (Array.isArray(kids)) {
                const j = kids.indexOf(dest);
                if (j !== -1) return [i, j];
            }
        }
        return null;
    };
    const where = findPath();
    if (!where) return null;

    if (mode === 'into') {
        if (where.length !== 1) return null;
        if (!Array.isArray(dest.items)) {
            // convert the childless target to a section (the indent semantics)
            dest.items = dest.view ? [{view: dest.view, label: dest.label}] : [];
            delete dest.view;
        }
        dest.items.push(node);
        return l;
    }
    const sibs = where.length === 1 ? l : l[where[0]].items;
    const idx = where[where.length - 1] + (mode === 'after' ? 1 : 0);
    sibs.splice(idx, 0, node);
    return l;
}

class FeezalElementLayoutAppInspector extends LitElement {
    static properties = {element: {attribute: false}, _tick: {state: true}, _createDlg: {state: true}};

    static styles = css`
        :host { display: block; font-size: 12px; color: var(--feezal-color, #333); }
        .section { border: 1px solid var(--feezal-border, #e0e0e0); border-radius: 6px; margin-bottom: 8px; }
        .sec-head { display: flex; align-items: center; gap: 8px; padding: 6px 8px; font-weight: 600;
            background: var(--feezal-bg-sub, #f5f5f5); border-radius: 6px 6px 0 0; }
        .sec-head .spacer { flex: 1; }
        .sec-body { padding: 8px; display: flex; flex-direction: column; gap: 8px; }
        .field { display: flex; flex-direction: column; gap: 2px; }
        .field > label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; }
        .row { display: flex; gap: 6px; align-items: center; }
        .row > .field { flex: 1; min-width: 0; }
        sl-input, sl-select { width: 100%; }
        sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        input { width: 100%; box-sizing: border-box; padding: 4px 6px; font: inherit; font-size: 12px;
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #333); border: 1px solid var(--feezal-border, #ccc); border-radius: 4px; }
        .hint { font-size: 10px; opacity: 0.6; line-height: 1.4; }
        .btn { border: 1px solid var(--feezal-border, #ccc); background: var(--feezal-bg, #fff); color: var(--feezal-color, #333);
            border-radius: 5px; padding: 3px 9px; font: inherit; font-size: 11px; cursor: pointer; }
        .btn:hover { background: var(--feezal-btn-hover, rgba(0,0,0,0.06)); }
        .item { border: 1px solid var(--feezal-border, #e0e0e0); border-radius: 6px; padding: 6px; }
        /* U103: sub-entry rows sit indented inside their section's item box. */
        .item.sub { margin: 6px 0 0 14px; }
        .item-head { display: flex; align-items: center; gap: 4px; position: relative; }
        /* U107: the drag handle — the pointer path for reorder/re-home; the
           arrow/indent buttons stay as the keyboard path. */
        .handle { flex: 0 0 auto; cursor: grab; opacity: 0.45; font-size: 14px;
            line-height: 1; padding: 2px 2px 2px 0; user-select: none; touch-action: none; }
        .handle:hover { opacity: 0.9; }
        .item-head.cue-before::before, .item-head.cue-after::after {
            content: ''; position: absolute; left: 0; right: 0; height: 2px;
            background: var(--primary-color); pointer-events: none;
        }
        .item-head.cue-before::before { top: -2px; }
        .item-head.cue-after::after { bottom: -2px; }
        .item-head.cue-into { outline: 2px solid var(--primary-color); outline-offset: -1px; border-radius: 4px; }
        .item-num { flex: 0 0 auto; width: 18px; height: 18px; border-radius: 50%; background: var(--primary-color);
            color: #fff; font-size: 11px; display: flex; align-items: center; justify-content: center; }
        .item-head sl-select { flex: 1; min-width: 0; }
        .ib { flex: 0 0 auto; width: 24px; height: 26px; border: none; background: none; cursor: pointer;
            color: var(--feezal-color, #555); border-radius: 4px; font-size: 14px; }
        .ib:hover { background: var(--feezal-btn-hover, rgba(0,0,0,0.07)); }
        .ib:disabled { opacity: 0.3; cursor: default; }
        .ib.danger:hover { color: #c62828; }
        .grid { display: flex; gap: 6px; margin-top: 6px; }
        .grid .field { flex: 1; min-width: 0; }
    `;

    constructor() { super(); this.element = null; this._tick = 0; this._createDlg = null; }

    _attr(n, d = '') { return this.element?.getAttribute(n) ?? d; }
    _emit(name, value) { this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {bubbles: true, composed: true, detail: {name, value}})); }

    /** B84: the effective rail value for the select — an explicit `rail` wins,
     * else the deprecated slim/autohide booleans map onto it, else off. */
    _railValue() {
        const r = this._attr('rail');
        if (r) return r;
        if (this.element.hasAttribute('autohide')) return 'edge';
        if (this.element.hasAttribute('slim')) return 'slim';
        return 'off';
    }

    /** Picking a rail value writes `rail` and clears the deprecated booleans so
     * the two axes can never conflict. */
    _onRailChange(value) {
        if (this.element.hasAttribute('slim')) this._emit('slim', false);
        if (this.element.hasAttribute('autohide')) this._emit('autohide', false);
        this._emit('rail', value);
    }

    /** N39: `header` supersedes the deprecated `hide-header` — clear it on pick. */
    _onHeaderChange(value) {
        if (this.element.hasAttribute('hide-header')) this._emit('hide-header', false);
        this._emit('header', value);
    }
    _viewNames() { return (window.feezal && feezal.site) ? [...feezal.site.querySelectorAll('feezal-view')].map(v => v.getAttribute('name')).filter(Boolean) : []; }
    _json(attr) { try { const r = JSON.parse(this._attr(attr, '[]')); return Array.isArray(r) ? r : []; } catch { return []; } }

    // Reuse E9/E45's synchronous-hide view creation.
    _createView(name) {
        const v = document.createElement('feezal-view');
        v.setAttribute('name', name);
        const current = feezal.site.querySelector(`feezal-view[name="${feezal.site.view}"]`);
        v.style.cssText = current ? current.style.cssText : 'width:100%;height:100%;background:white';
        v.style.display = 'none';
        v.visible = false;
        feezal.site.append(v);
        feezal.app.views = [...feezal.site.querySelectorAll('feezal-view')];
        feezal.site.updateVisibility?.();
        feezal.app.requestUpdate();
    }
    _uniqueViewName(base = 'page') { const used = new Set(this._viewNames()); let i = 1, n; do { n = base + i++; } while (used.has(n)); return n; }

    // ── entries (U103: one nesting level — an item with an `items` array is a
    // section; its sub-entries are the pages) ──
    _entries() {
        return this._json('items').map(e => Array.isArray(e.items)
            ? {label: e.label, icon: e.icon, items: e.items.map(k => ({label: k?.label, icon: k?.icon, view: k?.view}))}
            : {label: e.label, icon: e.icon, view: e.view});
    }
    _saveEntries(list) {
        this._emit('items', list.map(e => {
            if (Array.isArray(e.items)) {
                const o = {items: e.items.map(k => { const c = {view: k.view || ''}; if (k.label) c.label = k.label; if (k.icon) c.icon = k.icon; return c; })};
                if (e.label) o.label = e.label;
                if (e.icon) o.icon = e.icon;
                return o;
            }
            const o = {view: e.view || ''};
            if (e.label) o.label = e.label;
            if (e.icon) o.icon = e.icon;
            return o;
        }));
        this._tick++;
    }
    /** Resolve a [i] / [i, j] path (a bare index counts as [i]) to its
     * sibling list + index within it. */
    _at(list, path) {
        const p = Array.isArray(path) ? path : [path];
        return p.length === 2 ? {sibs: list[p[0]]?.items ?? [], idx: p[1]} : {sibs: list, idx: p[0]};
    }
    // U47: "+ add" no longer auto-creates a pageN view. The entry starts
    // unbound — the runtime's _entries() skips entries without a view, so an
    // unbound entry renders nothing in the drawer. Bind an existing view in
    // the dropdown, or pick "＋ Create new view…" there.
    _addEntry() { this._saveEntries([...this._entries(), {}]); }
    _setEntry(path, k, v) {
        const l = this._entries();
        const {sibs, idx} = this._at(l, path);
        if (!sibs[idx]) return;
        if (v === '' || v == null) delete sibs[idx][k];
        else sibs[idx][k] = v;
        this._saveEntries(l);
    }

    // ── U103: section structure editing ─────────────────────────────────────
    /** Add a sub-entry to item i. A childless item with a bound view converts
     * to a section by moving its view down into the first sub-entry (a section
     * itself is not a page); otherwise an unbound sub-entry is appended. */
    _addChild(i) {
        const l = this._entries();
        const it = l[i];
        if (!it) return;
        if (!Array.isArray(it.items)) {
            it.items = it.view ? [{view: it.view, label: it.label}] : [{}];
            delete it.view;
        } else {
            it.items.push({});
        }
        this._saveEntries(l);
    }
    /** Indent top-level item i: it becomes the last sub-entry of the previous
     * top-level item (converting that into a section). Sections themselves
     * cannot be indented — one nesting level. */
    _indent(i) {
        const l = this._entries();
        const it = l[i];
        const prev = l[i - 1];
        if (!it || !prev || Array.isArray(it.items)) return;
        if (!Array.isArray(prev.items)) {
            prev.items = prev.view ? [{view: prev.view, label: prev.label}] : [];
            delete prev.view;
        }
        prev.items.push(it);
        l.splice(i, 1);
        this._saveEntries(l);
    }
    /** Outdent sub-entry j of section i: it becomes a top-level item right
     * after its section. An emptied section stays (bind pages or remove it). */
    _outdent(i, j) {
        const l = this._entries();
        const kids = l[i]?.items;
        if (!kids || !kids[j]) return;
        const [k] = kids.splice(j, 1);
        l.splice(i + 1, 0, k);
        this._saveEntries(l);
    }

    // ── U47: per-entry view change + "create new view" dialog ──────────────
    _onEntryViewChange(path, ev) {
        const v = ev.target.value;
        if (v === CREATE_VIEW_SENTINEL) {
            // Never persist the sentinel — open the create dialog instead.
            // Create binds the real name; cancel restores the previous value.
            const l = this._entries();
            const {sibs, idx} = this._at(l, path);
            this._createDlg = {
                path,
                prev: sibs[idx]?.view || '',
                name: this._uniqueViewName('page'),
                select: ev.target,
            };
            return;
        }
        this._setEntry(path, 'view', v);
    }

    _createDlgSubmit() {
        const dlg = this._createDlg;
        if (!dlg) return;
        const name = (dlg.name || '').trim();
        if (!name || this._viewNames().includes(name)) return;   // button is disabled, belt-and-braces
        this._createView(name);
        const l = this._entries();
        const {sibs, idx} = this._at(l, dlg.path);
        if (sibs[idx]) {
            sibs[idx].view = name;
            if (!sibs[idx].label) sibs[idx].label = name;
            this._saveEntries(l);
        }
        this._createDlg = null;
    }

    _createDlgCancel() {
        const dlg = this._createDlg;
        if (!dlg) return;
        this._createDlg = null;
        // Shoelace keeps the picked (sentinel) value — put the previous view
        // back explicitly.
        if (dlg.select) dlg.select.value = dlg.prev;
        this._tick++;
    }
    _moveEntry(path, d) {
        const l = this._entries();
        const {sibs, idx} = this._at(l, path);
        const j = idx + d;
        if (j < 0 || j >= sibs.length) return;
        [sibs[idx], sibs[j]] = [sibs[j], sibs[idx]];
        this._saveEntries(l);
    }
    _removeEntry(path) {
        const l = this._entries();
        const {sibs, idx} = this._at(l, path);
        sibs.splice(idx, 1);
        this._saveEntries(l);
    }
    _editView(v) { if (v && feezal.app) feezal.app._setView(v); }

    // ── U107: drag-and-drop over the entry rows ─────────────────────────────
    /** Which drop the pointer is proposing right now (visual cue + drop). */
    _dropCue(path, mode) {
        const key = path.join('.') + ':' + mode;
        if (this.__cueKey === key) return;
        this.__cueKey = key;
        this._cue = {key: path.join('.'), mode};
        this._tick++;
    }

    _clearCue() {
        this.__cueKey = null;
        this._cue = null;
        this._tick++;
    }

    _dragStart(e, path) {
        this._dragFrom = path;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', path.join('.'));
    }

    /** Zone by pointer height: edges reorder, the middle band re-homes —
     *  but only rows that CAN take an 'into' offer one (top-level, and never
     *  for a dragged section). */
    _dragOver(e, path) {
        if (!this._dragFrom) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const r = e.currentTarget.getBoundingClientRect();
        const y = (e.clientY - r.top) / r.height;
        const draggedSection = this._dragFrom.length === 1 &&
            Array.isArray(this._entries()[this._dragFrom[0]]?.items);
        const canInto = path.length === 1 && !draggedSection;
        const mode = canInto
            ? (y < 0.3 ? 'before' : y > 0.7 ? 'after' : 'into')
            : (y < 0.5 ? 'before' : 'after');
        this._dropCue(path, mode);
    }

    _drop(e, path) {
        e.preventDefault();
        e.stopPropagation();
        const from = this._dragFrom;
        const mode = this._cue?.mode || 'before';
        this._dragFrom = null;
        this._clearCue();
        if (!from) return;
        const next = moveEntry(this._entries(), from, path, mode);
        if (next) this._saveEntries(next);
    }

    _dragEnd() {
        this._dragFrom = null;
        this._clearCue();
    }

    /** The per-row drag surface: handle + the head as a drop target. */
    _dragProps(path) {
        const key = path.join('.');
        const cue = this._cue?.key === key ? `cue-${this._cue.mode}` : '';
        return {key, cue};
    }

    // ── actions ──
    _acts() { return this._json('actions').map(a => ({icon: a.icon, publish: a.publish, payload: a.payload})); }
    _saveActs(list) { this._emit('actions', list.map(a => ({icon: a.icon || '', publish: a.publish || '', payload: a.payload ?? ''}))); this._tick++; }
    _addAct() { this._saveActs([...this._acts(), {icon: '', publish: '', payload: ''}]); }
    _setAct(i, k, v) { const l = this._acts(); if (!l[i]) return; l[i][k] = v; this._saveActs(l); }
    _removeAct(i) { const l = this._acts(); l.splice(i, 1); this._saveActs(l); }

    render() {
        if (!this.element) return html``;
        const entries = this._entries();
        const views = this._viewNames();
        const acts = this._acts();
        return html`
            <div class="section">
                <div class="sec-head">Top bar</div>
                <div class="sec-body">
                    <div class="field"><label>Title</label>
                        <input .value="${this._attr('title')}" @change="${e => this._emit('title', e.target.value)}"></div>
                    <div class="field"><label>Subscribe title (MQTT)</label>
                        <feezal-topic-input size="small" value="${this._attr('subscribe-title')}" placeholder="mqtt/topic" @sl-change="${e => this._emit('subscribe-title', e.target.value)}"></feezal-topic-input></div>
                    <div class="field"><label>Show top bar</label>
                        <sl-select size="small" value="${this.element.hasAttribute('hide-header') ? 'never' : (this._attr('header') || 'always')}"
                            @sl-change="${e => this._onHeaderChange(e.target.value)}">
                            <sl-option value="always">always</sl-option>
                            <sl-option value="small-only">only on small screens</sl-option>
                            <sl-option value="never">never (floating hamburger)</sl-option>
                        </sl-select></div>
                    <label style="display:flex;align-items:center;gap:8px;font-size:11px">
                        <sl-switch size="small" ?checked="${this._attr('show-active-label') !== 'false'}"
                            @sl-change="${e => this._emit('show-active-label', e.target.checked)}"></sl-switch>
                        Show the current page label in the bar
                    </label>
                    <label style="display:flex;align-items:center;gap:8px;font-size:11px">
                        <sl-switch size="small" ?checked="${this.element.hasAttribute('breadcrumb')}"
                            @sl-change="${e => this._emit('breadcrumb', e.target.checked)}"></sl-switch>
                        Breadcrumb (Section / Page) instead of the plain label
                    </label>
                    <div class="field"><label>Initial view</label>
                        <sl-select size="small" value="${this._attr('active-view') || ''}"
                            @sl-change="${e => this._emit('active-view', e.target.value)}">
                            <sl-option value="">(first entry)</sl-option>
                            ${views.map(v => html`<sl-option value="${v}">${v}</sl-option>`)}
                        </sl-select></div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Drawer entries <span class="spacer"></span><button class="btn" @click="${this._addEntry}">+ add</button></div>
                <div class="sec-body">
                    ${entries.length === 0
                        ? html`<div class="hint">No entries yet. “+ add” adds an entry — pick its view in the dropdown, or create a new view right there. “＋ sub” turns an entry into a section with sub-entries (two-level navigation). Drag the ⠿ handle to reorder; drop on a row's middle to move an entry into it.</div>`
                        : entries.map((e, i) => Array.isArray(e.items) ? html`
                            <div class="item">
<div class="item-head ${this._dragProps([i]).cue}"
                                    @dragover="${ev => this._dragOver(ev, [i])}"
                                    @drop="${ev => this._drop(ev, [i])}">
                                    <span class="handle" draggable="true" title="Drag to reorder; drop onto a row's middle to move it inside"
                                        @dragstart="${ev => this._dragStart(ev, [i])}"
                                        @dragend="${() => this._dragEnd()}">⠿</span>
                                    <span class="item-num">${i + 1}</span>
                                    <input style="flex:1;min-width:0" placeholder="Section label" .value="${e.label ?? ''}"
                                        @change="${ev => this._setEntry([i], 'label', ev.target.value)}">
                                    <button class="ib" title="Up" ?disabled="${i === 0}" @click="${() => this._moveEntry([i], -1)}">&#8593;</button>
                                    <button class="ib" title="Down" ?disabled="${i === entries.length - 1}" @click="${() => this._moveEntry([i], 1)}">&#8595;</button>
                                    <button class="ib" title="Add sub-entry" @click="${() => this._addChild(i)}">&#8627;+</button>
                                    <button class="ib danger" title="Remove section and its sub-entries" @click="${() => this._removeEntry([i])}">&times;</button>
                                </div>
                                <div class="grid">
                                    <div class="field"><label>icon</label>
                                        <feezal-icon-input .value="${e.icon ?? ''}" placeholder="e.g. weekend"
                                            @feezal-change="${ev => { ev.stopPropagation(); this._setEntry([i], 'icon', ev.detail.value); }}"></feezal-icon-input></div>
                                </div>
                                ${e.items.map((k, j) => html`
                                    <div class="item sub">
<div class="item-head ${this._dragProps([i, j]).cue}"
                                            @dragover="${ev => this._dragOver(ev, [i, j])}"
                                            @drop="${ev => this._drop(ev, [i, j])}">
                                            <span class="handle" draggable="true" title="Drag to reorder; drop onto a row's middle to move it inside"
                                                @dragstart="${ev => this._dragStart(ev, [i, j])}"
                                                @dragend="${() => this._dragEnd()}">⠿</span>
                                            <sl-select size="small" placeholder="pick a view…" value="${k.view || ''}"
                                                @sl-change="${ev => this._onEntryViewChange([i, j], ev)}">
                                                ${views.map(v => html`<sl-option value="${v}">${v}</sl-option>`)}
                                                <sl-divider></sl-divider>
                                                <sl-option value="${CREATE_VIEW_SENTINEL}">＋ Create new view…</sl-option>
                                            </sl-select>
                                            <button class="ib" title="Edit this view" @click="${() => this._editView(k.view)}">&#9998;</button>
                                            <button class="ib" title="Up" ?disabled="${j === 0}" @click="${() => this._moveEntry([i, j], -1)}">&#8593;</button>
                                            <button class="ib" title="Down" ?disabled="${j === e.items.length - 1}" @click="${() => this._moveEntry([i, j], 1)}">&#8595;</button>
                                            <button class="ib" title="Move out of the section" @click="${() => this._outdent(i, j)}">&#8676;</button>
                                            <button class="ib danger" title="Remove" @click="${() => this._removeEntry([i, j])}">&times;</button>
                                        </div>
                                        <div class="grid">
                                            <div class="field"><label>label</label>
                                                <input .value="${k.label ?? ''}" placeholder="${k.view || ''}" @change="${ev => this._setEntry([i, j], 'label', ev.target.value)}"></div>
                                            <div class="field"><label>icon</label>
                                                <feezal-icon-input .value="${k.icon ?? ''}" placeholder="e.g. home"
                                                    @feezal-change="${ev => { ev.stopPropagation(); this._setEntry([i, j], 'icon', ev.detail.value); }}"></feezal-icon-input></div>
                                        </div>
                                    </div>`)}
                            </div>` : html`
                            <div class="item">
<div class="item-head ${this._dragProps([i]).cue}"
                                    @dragover="${ev => this._dragOver(ev, [i])}"
                                    @drop="${ev => this._drop(ev, [i])}">
                                    <span class="handle" draggable="true" title="Drag to reorder; drop onto a row's middle to move it inside"
                                        @dragstart="${ev => this._dragStart(ev, [i])}"
                                        @dragend="${() => this._dragEnd()}">⠿</span>
                                    <span class="item-num">${i + 1}</span>
                                    <sl-select size="small" placeholder="pick a view…" value="${e.view || ''}"
                                        @sl-change="${ev => this._onEntryViewChange([i], ev)}">
                                        ${views.map(v => html`<sl-option value="${v}">${v}</sl-option>`)}
                                        <sl-divider></sl-divider>
                                        <sl-option value="${CREATE_VIEW_SENTINEL}">＋ Create new view…</sl-option>
                                    </sl-select>
                                    <button class="ib" title="Edit this view" @click="${() => this._editView(e.view)}">&#9998;</button>
                                    <button class="ib" title="Up" ?disabled="${i === 0}" @click="${() => this._moveEntry([i], -1)}">&#8593;</button>
                                    <button class="ib" title="Down" ?disabled="${i === entries.length - 1}" @click="${() => this._moveEntry([i], 1)}">&#8595;</button>
                                    <button class="ib" title="Make sub-entry of the previous item" ?disabled="${i === 0}" @click="${() => this._indent(i)}">&#8677;</button>
                                    <button class="ib" title="Add sub-entry (makes this a section)" @click="${() => this._addChild(i)}">&#8627;+</button>
                                    <button class="ib danger" title="Remove" @click="${() => this._removeEntry([i])}">&times;</button>
                                </div>
                                <div class="grid">
                                    <div class="field"><label>label</label>
                                        <input .value="${e.label ?? ''}" placeholder="${e.view || ''}" @change="${ev => this._setEntry([i], 'label', ev.target.value)}"></div>
                                    <div class="field"><label>icon</label>
                                        <feezal-icon-input .value="${e.icon ?? ''}" placeholder="e.g. home"
                                            @feezal-change="${ev => { ev.stopPropagation(); this._setEntry([i], 'icon', ev.detail.value); }}"></feezal-icon-input></div>
                                </div>
                            </div>`)}
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Actions <span class="spacer"></span><button class="btn" @click="${this._addAct}">+ add</button></div>
                <div class="sec-body">
                    ${acts.length === 0 ? html`<div class="hint">Top-bar icon buttons that publish a payload on tap.</div>` : ''}
                    ${acts.map((a, i) => html`
                        <div class="item">
                            <div class="grid" style="margin-top:0">
                                <div class="field"><label>icon</label>
                                    <feezal-icon-input .value="${a.icon ?? ''}" placeholder="e.g. refresh"
                                        @feezal-change="${e => { e.stopPropagation(); this._setAct(i, 'icon', e.detail.value); }}"></feezal-icon-input></div>
                                <div class="field"><label>publish topic</label><feezal-topic-input size="small" value="${a.publish ?? ''}" placeholder="mqtt/topic" @sl-change="${e => this._setAct(i, 'publish', e.target.value)}"></feezal-topic-input></div>
                                <div class="field"><label>payload</label><input .value="${a.payload ?? ''}" @change="${e => this._setAct(i, 'payload', e.target.value)}"></div>
                                <button class="ib danger" title="Remove" @click="${() => this._removeAct(i)}">&times;</button>
                            </div>
                        </div>`)}
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Drawer</div>
                <div class="sec-body">
                    <div class="field"><label>Entry style</label>
                        <sl-select size="small" value="${this._attr('entry-style', 'pill') === 'list' ? 'list' : 'pill'}"
                            @sl-change="${e => this._emit('entry-style', e.target.value)}">
                            <sl-option value="pill">pill — rounded chips with inset</sl-option>
                            <sl-option value="list">list — flat full-width rows</sl-option>
                        </sl-select></div>
                    <div class="field"><label>Navigation style (with sub-entries)</label>
                        <sl-select size="small" value="${this._attr('nav-style', 'groups') || 'groups'}"
                            @sl-change="${e => this._emit('nav-style', e.target.value)}">
                            <sl-option value="groups">groups — accordion sections in one drawer</sl-option>
                            <sl-option value="rail-panel">rail + panel — icon rail, entries beside it</sl-option>
                            <sl-option value="tabs">tabs — sections in the drawer, pages as tabs</sl-option>
                        </sl-select>
                        <div class="hint">Takes effect once an entry has sub-entries; a flat list renders the classic drawer.</div></div>
                    <div class="field"><label>Section header click (groups)</label>
                        <sl-select size="small" value="${this._attr('section-toggle', 'chevron') || 'chevron'}"
                            @sl-change="${e => this._emit('section-toggle', e.target.value)}">
                            <sl-option value="chevron">navigate — only the chevron collapses</sl-option>
                            <sl-option value="header">toggle — the whole header expands/collapses</sl-option>
                        </sl-select></div>
                    ${this._attr('nav-style', 'groups') === 'tabs' ? html`
                    <div class="field"><label>Sections (tabs mode)</label>
                        <sl-select size="small" value="${this._attr('tab-sections', 'drawer') || 'drawer'}"
                            @sl-change="${e => this._emit('tab-sections', e.target.value)}">
                            <sl-option value="drawer">in the drawer</sl-option>
                            <sl-option value="row">as a first tab row (both levels in the bar)</sl-option>
                        </sl-select></div>` : ''}
                    <div class="field"><label>Overlay breakpoint (px)</label>
                        <input type="number" .value="${this._attr('breakpoint', '768')}" @change="${e => this._emit('breakpoint', e.target.value)}"></div>
                    <label style="display:flex;align-items:center;gap:8px;font-size:11px">
                        <sl-switch size="small" ?checked="${this.element.hasAttribute('drawer-persistent') || this._attr('drawer-persistent') !== 'false'}"
                            @sl-change="${e => this._emit('drawer-persistent', e.target.checked)}"></sl-switch>
                        Persistent drawer when wide
                    </label>
                    ${this._attr('nav-style', 'groups') === 'rail-panel' ? html`
                        <div class="hint">Rail options don't apply here — “rail + panel” is itself a rail presentation with its own entry panel.</div>` : html`
                    <div class="field"><label>Rail (persistent drawer when wide)</label>
                        <sl-select size="small" value="${this._railValue()}"
                            @sl-change="${e => this._onRailChange(e.target.value)}">
                            <sl-option value="off">off — full drawer</sl-option>
                            <sl-option value="slim">slim — icon rail</sl-option>
                            <sl-option value="edge">edge — thin edge</sl-option>
                            <sl-option value="auto">auto — slim, full above the rail breakpoint</sl-option>
                        </sl-select></div>
                    ${this._railValue() === 'auto' ? html`
                        <div class="field"><label>Rail breakpoint (px)</label>
                            <input type="number" .value="${this._attr('rail-breakpoint', '1024')}" @change="${e => this._emit('rail-breakpoint', e.target.value)}"></div>` : ''}
                    ${this._railValue() !== 'off' ? html`
                        <div class="field"><label>Rail expand</label>
                            <sl-select size="small" value="${this._attr('rail-expand') || 'overlay'}"
                                @sl-change="${e => this._emit('rail-expand', e.target.value)}">
                                <sl-option value="overlay">overlay — draw over the content</sl-option>
                                <sl-option value="push">push — push the content aside</sl-option>
                                <sl-option value="never">never — icon rail only</sl-option>
                            </sl-select></div>
                        <label style="display:flex;align-items:center;gap:8px;font-size:11px">
                            <sl-switch size="small" ?checked="${this.element.hasAttribute('rail-menu-button')}"
                                @sl-change="${e => this._emit('rail-menu-button', e.target.checked)}"></sl-switch>
                            Rail menu button (opens the full drawer as an overlay — for touch)
                        </label>` : ''}`}
                </div>
            </div>

            <!-- U47: create-new-view dialog (opened from the entry dropdown) -->
            <sl-dialog label="Create new view" ?open="${!!this._createDlg}"
                @sl-request-close="${() => this._createDlgCancel()}">
                <sl-input label="View name" autocomplete="off"
                    .value="${this._createDlg?.name ?? ''}"
                    help-text="${this._createDlg && this._viewNames().includes((this._createDlg.name || '').trim())
                        ? 'A view with this name already exists.' : ''}"
                    @sl-input="${e => { this._createDlg = {...this._createDlg, name: e.target.value}; }}"
                    @keydown="${e => { if (e.key === 'Enter') this._createDlgSubmit(); }}"></sl-input>
                <sl-button slot="footer" variant="default" @click="${() => this._createDlgCancel()}">Cancel</sl-button>
                <sl-button slot="footer" variant="primary"
                    ?disabled="${!this._createDlg || !(this._createDlg.name || '').trim() || this._viewNames().includes((this._createDlg.name || '').trim())}"
                    @click="${() => this._createDlgSubmit()}">Create</sl-button>
            </sl-dialog>
        `;
    }
}

customElements.define('feezal-element-layout-app-inspector', FeezalElementLayoutAppInspector);
export {FeezalElementLayoutAppInspector};

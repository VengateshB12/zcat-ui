# zcat UI — Build Pages With These Components

This folder is the **zcat design system as code** — a dependency-free HTML/CSS/JS
component library generated from the Figma file "ZCat-AI Understandable"
(`ugOZk4O0g6XpviEBSN24mF`). Every colour, size, and state in `src/` was verified
against a Figma variable. When this folder is imported into a project and you are
asked to build UI, you build it **from these components — never from scratch**.

## The startup comment

> **This section is history.** The build prompt now lives in
> `docs/playground.html` (Getting Started → Copy prompt) and on the docs site.
> It asks which mode you are in, checks the page before the expensive gates,
> and runs four blocking gates — none of which is described below. Follow the
> current prompt; what follows is kept only because older chats reference it.

<details><summary>The superseded startup comment</summary>

```text
Build my requirement with the zcat UI component library in the zcat-ui/ folder.

BEFORE WRITING ANY CODE
1. Read zcat-ui/ONBOARDING.md fully — it is the contract. The component API
   tables there are authoritative; docs/playground.html render functions and the
   usage comments at the top of each src/components/*.css file are the reference
   markup. Do not invent markup shapes.
2. List back every screen and state you found in my requirement (a page usually
   implies an empty state and a create/edit flow) and confirm before building.
   If anything is ambiguous, ASK — do not guess.

HARD RULES (violating these is the failure mode)
- NEVER detach or restyle a component. You may put your own CONTENT inside a
  component (rows, labels, values), but its colour, border, radius, padding and
  typography stay exactly as shipped. If you need a different look, it is a
  STATE or a VARIANT on the component (data-state / data-variant / data-size) —
  if none exists, say so and ask. Concretely: never recolour a table cell,
  never override a card's border, never change a button's background.
- Include the library as-is: <link rel="stylesheet" href="zcat-ui/zcat.css?v=120">
  and <script src="zcat-ui/zcat.js?v=22" defer></script>. Never copy rules out of it,
  never restyle a zc-* class, never write a raw hex — every colour is a
  var(--zc-*) token from src/tokens/colors.css.
- No odd numbers for spacing/sizing/radius; use the --zc-space-* / --zc-radius-*
  tokens.
- Compose, don't duplicate: a search field is .zc-search-wrap, a button is
  .zc-btn, a menu is .zc-menu — even inside bigger things you build.
- Icons come only from zcat-ui/docs/icons/ (stroke icons bind to currentColor;
  recolor files via the .zc-mask-icon pattern). No other icon sets.
- The Empty State illustration follows the THEME on its own. Keep the
  <img src="…/Empty State Illustration.svg"> the template gives you; the library
  swaps the artwork in dark mode via --zc-empty-art. Never hand-swap it per page,
  and never point a page at the dark file directly — it would then stay dark in
  light mode.
- THE PAGE SPRITE IS A SUBSET. docs/template.html ships 27 <symbol> definitions;
  docs/icons/ holds 483 files. Referencing one that is not in the sprite gives
  you a <use> pointing at nothing, which renders as an EMPTY BOX with no error.
  To use another icon, copy its <symbol> into the page's sprite block first.
  The audit fails this as ICON SYMBOL NOT FOUND.
- Pages that belong to a product shell start from .zc-layout (the Catalyst
  layout) with .zc-sidemenu, .zc-layout__topbar, .zc-layout__subheader, and a
  .zc-layout__container holding .zc-cheader + content.
- Use realistic sample data (names, regions, dates) — never lorem ipsum in
  tables, lists, or titles.
- Page-level glue CSS (grid placement, demo heights) is allowed; component
  styling changes are not. Follow docs/template.html as the worked example.

WHEN DONE
Show me the page, list which zcat components you used where, and flag anything
my requirement needed that the library does not have — do not improvise a
lookalike component.
```

</details>

Then paste the requirement (text, screenshot, PRD). Everything below is the
reference the startup comment points to.

## Include

```html
<link rel="stylesheet" href="zcat-ui/zcat.css?v=120">
<script src="zcat-ui/zcat.js?v=22" defer></script>
```

`zcat.js` auto-initialises every interactive component (dropdowns, tooltips,
tabs, accordions, sidemenu, table menus, toasts, OTP, uploads…) and watches the
DOM, so markup added later is wired automatically. API: `zcat.init(root?)`,
`zcat.refresh()`. Events all bubble as `zcat:<component>:<action>`.

## Worked examples

- `docs/playground.html` — every component, interactive, with its markup in the
  code panel and honest notes in each Overview tab.
- `docs/template.html` — a full Catalyst page (shell + container header +
  stretch table + pagination) built exclusively from the components.

## Component API (authoritative summary)

Markup shapes live in the usage comment atop each owning CSS file (listed).

### Layout & shell — `src/components/shell.css`
| Component | Class + API |
|---|---|
| Catalyst Layout | `.zc-layout` > `__rail` (64px service rail; `.zc-layout__service` items, active gets the curved white tab) + `__shell` > `__topbar` (project switcher, 390px `.zc-search-wrap`, 32px avatar), `__main` > `.zc-sidemenu` + `__page` > `__subheader` (title + ghost Help `.zc-btn`) + `__body` > `__container` |
| Sub Header variants (Figma 1223:5865) | inside `__subheader`: `-left` group (gap 6, flex-1: round ghost 28px Back Nav `.zc-btn`, `-title`, info icon, round ghost Refresh, solid `.zc-badge` status) + `-right` group (small grey `.zc-btn`s, three-dot, ghost Help) + optional `-tabs` second row holding a full-width `.zc-tabs` `data-type="primary"` |
| Side Menu | `.zc-sidemenu` (`data-type="collapsed"`); `__service`, scrollable `__body` > `__section` > `__heading` + `__item` (`data-state="active"`), `__expand` toggle button |
| Container Side Menu | `.zc-csm`; `__header` (title + small fill `.zc-btn`), real `.zc-search-wrap`, `__list` > `__item` (`data-state="selected"`) |
| Container Header | `.zc-cheader`; `__left` (`__titlerow` + `__title`/`__desc`, or a 300px search, or secondary `.zc-tabs`), `__right` (Link Box, `__filter` selects, grey/outline/fill `.zc-btn`) |
| Card | `.zc-card` (`data-state="hover|selected|disabled"`); `.zc-card__check` badge appears when selected. No built-in padding — Figma defines none |
| Empty State | `.zc-empty`; `__art` (icons/Empty State Illustration.svg), `__heading`, `__desc`, `__actions` (outline + fill `.zc-btn`) |
| General Details | `.zc-gdetails`; `__title`, `__row` > `__label` (140px) + `__colon` + `__value` |

### Buttons, links, tooltips — `src/components/button.css`
`.zc-btn` — `data-variant="fill|outline|grey|ghost|ghost-grey"`,
`data-color="primary|grey|success|danger"`, `data-size="large|small|xs"`
(default 36px; large 50, small 28, xs 24), `data-content="icon"` (square),
`data-radius="rounded"` (pill). Icon: inline svg `.zc-btn__icon`.
`.zc-link` (sizes/states), `.zc-tooltip` + floating tooltips via
`data-tooltip` / `data-tooltip-side` on any element.

### Inputs — `src/components/input.css`
`.zc-input-group` > `.zc-label` (+`__optional`, info icon w/ tooltip) +
`.zc-input-wrap` (`data-size="small|xs"`, `data-state="hover|active|disabled|error"`)
> `.zc-input`. Specialisations: `.zc-search-wrap` (icon + clear),
password reveal `.zc-input__reveal`, number `.zc-numstepper`, `.zc-textarea`
(+`.zc-textarea-count`), OTP `.zc-otp`, `.zc-linkbox` (+copy), `.zc-doublefield`,
`.zc-kvfield` (add/remove/drag), `.zc-inline-edit`, `.zc-upload` (picker + drop),
`.zc-autocomplete`. Dropdown = `.zc-select-shell` > `.zc-select-wrap` trigger +
`.zc-menu` (`data-size`, `.zc-menu__item`, optional search/heading/multi);
`data-menu="action"` on the shell makes it a command menu (no persisted tick).
Chips: `.zc-chip` (+`__close`), overflow helpers.

### Selection controls — `src/components/checkbox-radio-toggle.css`
`.zc-checkbox` / `.zc-radio` / `.zc-toggle`: `__row` > `__input` (native input;
checkbox supports `data-indeterminate`) + `__box`/`__circle`/`__track` +
`__label`, optional `__desc`. All states style themselves from the input.

### Date picker — `src/components/datepicker.css`
`.zc-datepicker`; `__header`/`__heading`, `__months` > `__month` > `__nav`
(round ghost-grey `.zc-btn` + `__nav-select`), `__weekdays`, `__week` >
`__day` (`data-state="selected|range|today|disabled"`), `__footer`
(Reset ghost / Close grey / Apply fill `.zc-btn`). Flyout: `.zc-timepicker`.

### Navigation — `src/components/tabs-accordion-breadcrumbs.css`, `src/components/widgets.css`
| Component | API |
|---|---|
| Tabs | `.zc-tabs` `data-type="primary|secondary"` (+`data-size="small|xs"` for secondary) > `.zc-tab` (`data-state="active"`, `:disabled`, `.zc-tab__icon`, real `.zc-badge` inside) — click-to-switch is built in |
| Breadcrumbs | `.zc-breadcrumbs` > `.zc-breadcrumb` (`data-state="active|disabled"`, `__icon`) + `__sep` ("/") |
| Stepper | `.zc-stepper` > `__step` (`data-state="default|active|completed|disabled"`) > `__number` + `__content` (`__label`, `__sub`); `__divider` (`data-state` colours the dash) — `src/components/organisms.css` |
| Profile Menu | `.zc-profilemenu`; hero section (`[data-hero]`), theme cards, accent swatches, resources grid, ghost-danger sign out |
| Notifications | `.zc-notifications`; `__tabsbar` (primary tabs + count badges), `__filters`, `__item` rows |

### Data — `src/components/table.css`, `src/components/widgets.css`
| Component | API |
|---|---|
| Table | `.zc-table-wrap` (`data-style="stretch|boxy"`) > `.zc-table` > `__th`/`__td` (+`--checkbox`/`--actions` 44px cols, `__user` avatar cell, badges in cells); three-dot row menu = `.zc-table__menushell` action menu |
| Pagination | `.zc-pagination`; `__info` (`__range`/`__total`), `__rows` + `__pershell` pager (menu drops up), `__divider`, `__nav` (round ghost-grey `.zc-btn` + `__page`) |
| Code Block | `.zc-codeblock` (`data-type="editor"`); `__lines` gutter, `__code`, syntax spans `.zc-code-k/i/s/s2/c`, `__copy` |
| Timeline | `.zc-timeline` > `__entry` > `__dot` (`data-color="green|blue|orange|red|grey"`, `data-type="icon"`) + `__content` |

### Feedback — `src/components/feedback.css`, `badge-tag-avatar.css`
| Component | API |
|---|---|
| Badge | `.zc-badge` `data-type="secondary"`, `data-color="success|danger|warning|info|purple|grey|disabled"`, `data-size="small|dot"` |
| Avatar | `.zc-avatar` (`data-size="small|large"`, types men/women/initials/icon, `__status` dot); `.zc-avatar-group` (+`__more`) |
| Toast | `.zc-toast` `data-color` + `data-type="heading|message"`; `__bar`, `__icon`, `__content`, `__actions`; `[data-toast-close]` dismisses |
| Attention Box | `.zc-attention` `data-color="info|success|warning|danger|default"` + `data-type="alert|message"`; `__action` slot for a ghost `.zc-btn` |
| Progress Bar | `.zc-progress` > `__fill` (inline width) |
| Skeleton | `.zc-skeleton` (`data-variant="secondary"`) > `__bar` per line |
| Spinner | `.zc-spinner` (`data-size="small|default|large"` = 24/32/48, base 16; `data-color="dark|white"`) — put the Loading icon svg inside |
| Carousel Dot | `.zc-carousel` > `__dot` (`data-state="active"`) — click-to-activate built in |
| Rating | `.zc-rating` (interactive stars) — no Figma source, flagged |

> **Copy the markup; do not rebuild it from this page.** Everything below is a
> class REFERENCE — what the classes are called and what they do. It is not a
> build spec. The real, gate-passing markup for the popup, empty state, loading,
> Sub Header, Container Header, Container Side Menu, table and General Details
> lives in `docs/snippets.html`. Reconstructing a component from the prose here
> is what makes popups and detail views come out subtly wrong.

### Overlays — `src/components/overlay.css`
`.zc-popup` (`data-size="small"` 414px, `[data-scroll]` shadows); `__header`
(`__title`, `__desc` — **no close X, per Figma**), `__body` (real inputs),
`__footer` (grey + fill `.zc-btn`). `.zc-popup-scrim` fixed overlay.
`.zc-fullpopup` (Figma 548:9060) — full-page popup: fixed overlay on the
tinted header bg; `__header` (42px bar: `__service` = 24px icon + `__title`
H6, then a round ghost-grey icon `.zc-btn` as the close X — this popup DOES
close from the header) + `__sheet` (white content surface, 26px curved top
corners, scrollable — put page content or a `.zc-empty` inside).
`.zc-accordion` (`data-state="open"`, click-to-toggle built in) and
`.zc-accordion-link`. `.zc-tour` (+`__arrow`, carousel dots, small buttons)
and `.zc-blink` beacon.

## Icons

All icons live in `docs/icons/`. Stroke icons: inline the `<path>` with
`stroke="currentColor"` (stroke-width 1.3) or reference via an SVG sprite —
see the `<symbol>` block in `docs/template.html`. To recolor a file-based icon:
`<span class="zc-mask-icon" style="--icon:url('<path-to>/icons/Name.svg')"></span>`
(inherits `currentColor`; use a root-absolute or correctly page-relative URL —
mask URLs resolve against the stylesheet otherwise).

## JS events

`zcat:dropdown:change|open|close`, `zcat:menu:action`, `zcat:chip:remove`,
`zcat:tab:select`, `zcat:accordion:toggle`, `zcat:toast:close`,
`zcat:carousel:select`, `zcat:sidemenu:select|toggle`, `zcat:csm:select`,
`zcat:layout:service`, `zcat:rating:change`, `zcat:upload:select|remove`,
`zcat:keyvalue:add|remove|reorder`, `zcat:autocomplete:input|select|create`,
`zcat:inline:change|cancel`, `zcat:linkbox:copy`, `zcat:otp:change`,
`zcat:password:toggle`, `zcat:search:clear`, `zcat:number:change`.

## Verification status (NOT an availability list)

Corrected 2026-08-29. The earlier wording here said these components were
"known gaps — do not improvise", which read as *they do not exist*. **They all
exist and ship in the CSS.** What some of them lack is a Figma source to have
been verified against — that is a review question, not an availability one.

**Built and Figma-verified — use normally:** everything not listed below.

**Built, but with NO Figma source** (invented or legacy; the markup and tokens
are real and stable, the DESIGN itself is unreviewed — use them, and tell the
user the design is unverified):

| Component | Class | Lives in |
|---|---|---|
| Slider | `.zc-slider` + `__fill` + `__thumb` | `organisms.css` |
| Progress Circle | `.zc-progress-circle` (3 sizes) | `feedback.css` |
| Shimmer | `.zc-shimmer` (text / rect / circle) | `feedback.css` |
| Container / Stack / Divider | `.zc-container-el` / `.zc-stack` / `.zc-divider` | `layouts.css` |

**Built AND Figma-sourced, with one approximated detail:**

| Component | Class | Note |
|---|---|---|
| Code Tab | `.zc-tabs[data-type="code"]` + `.zc-tab-code` | Figma set `2951:10610`; tokens bound verbatim. Only the slanted right edge is rebuilt as a 31° skew (22px run / 36px rise) pending the exact vector export. |

**Genuinely not built:** nothing in this list. If you need a component that truly
has no class in `src/components/`, say so instead of building a lookalike.

Slider is the one component that is NOT surfaced in `playground.html`, so the
designer has never seen it — flag that when you use it.

Dark mode ships for every token but is pending the designer's sign-off.

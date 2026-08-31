# /zcat-code — Build Pages From zcat UI Components (HTML/CSS/JS)

This is the CODE twin of the Figma design skill (`AI Automation/.claude/skills/zcat.md`).
The design decisions are the SAME — only the implementation medium changes:
instead of importing Figma components by key, you write markup using the
`zc-*` classes from `zcat-ui/`.

**Trigger:** the user gives a wireframe, screenshot, PRD, or text requirement and
asks to DEVELOP / BUILD / CODE a page or screen (HTML/CSS output), or types
"/zcat-code". If they ask to design in FIGMA instead, use the AI Automation
workflow, not this file.

---

## THE TWO NON-NEGOTIABLES (everything else serves these)

1. **The wireframe is ONLY a feature list — NEVER the design.** A wireframe is a
   low-fi capture of WHAT must exist (tabs, fields, columns, actions). Its
   layout, proportions, grouping, and visuals are throwaway. You are a DESIGNER:
   extract the features, then compose a creative, polished UI from zcat
   components — hierarchy, card recipes, multi-column layouts, spacing rhythm.
   If the wireframe and your page look like the same layout side by side, the
   build FAILED and must be recomposed.
2. **EVERY screen starts from the developed Layout component (`.zc-layout`).**
   Step 1 of every screen build is copying the Catalyst shell structure from
   `docs/template.html` — service rail, topbar, sidemenu, subheader, container.
   Never hand-assemble a shell from divs, never build a page as a floating
   card outside the shell (exception: a screen the user explicitly says has no
   shell, e.g. a landing page). Content goes inside `.zc-layout__container`
   without modifying how the shell looks.

---

## SOURCES OF TRUTH (read in this order — and what NEVER to read)

1. `zcat-ui/ONBOARDING.md` — the component API contract. AUTHORITATIVE. Read fully, every build.
2. Usage comments at the top of each `zcat-ui/src/components/*.css` file — the reference markup shapes for the components you will use.
3. `zcat-ui/docs/playground.html` render functions and `zcat-ui/docs/template.html` — worked examples (template.html is a full verified Catalyst page).
4. `AI Automation/references/decision-rules/_index.md` — design decision rules, per topic (see DECISION RULES BRIDGE below). If the AI Automation folder is not present in this project, rely on the HARD RULES inlined in this file.
5. `AI Automation/references/sample-data.md` — realistic sample data. Never lorem ipsum.

**STALE — NEVER read or follow these:**
- `zcat-ui/COMPONENTS.md` — predates the verified library; documents removed markup (`.zc-modal` with a close X, token/currency inputs, etc.). Following it is a known failure mode.
- `zcat-ui/docs/index.html` — older long-scroll docs, superseded, stale markup APIs.
- Figma-implementation sections inside the AI Automation files (component keys, `use_figma`, `setProperties`, detach rules, auto-layout API) — take the DESIGN decision from those files, ignore the Figma mechanics.

---

## HARD RULES (never break these; they are the failure mode)

### Library integrity
- Include the library as-is:
  `<link rel="stylesheet" href="<path>/zcat-ui/zcat.css">` and
  `<script src="<path>/zcat-ui/zcat.js" defer></script>`.
  Never copy rules out of it, never edit any file inside `zcat-ui/`.
- **NEVER restyle a `zc-*` class.** Page-level glue CSS (grid placement, page-specific column widths, demo heights) is allowed; changing how a component looks is not. Glue CSS selectors must be page-scoped classes (e.g. `.db-overview-grid`), never `zc-*` selectors.
- **ZERO raw colors.** Every `color`, `background`, `border-color`, `fill`, `stroke` in glue CSS must be `var(--zc-*)` from `src/tokens/colors.css`. Even black text (`--zc-body-text-primary`), even white card backgrounds (`--zc-cards-bg-primary`). Raw hex is the #1 cause of dark-mode breakage.
- **No odd numbers** for spacing/padding/gap/sizing/radius. Use `--zc-space-*` / `--zc-radius-*` tokens (spacing: 2,4,6,8,10,12,14,16,20,24,32,48,64…; radius: 2,4,6,10,14,18,20,full).
- **Typography via classes, never raw font rules.** Headings/values use `.zc-h1`–`.zc-h6`, `.zc-subtitle-1/2/3` (Semi Bold); body text `.zc-body-1`–`.zc-body-5`; code `.zc-code-body`. Color via `.zc-text-*` utilities or a `--zc-body-text-*` var. NEVER write `font-size`/`font-weight`/`font-family` in glue CSS. A larger Regular size is NOT hierarchy — emphasis means a Subtitle/Headline class. Minimum text size 10px.
- **Compose, don't duplicate.** A search field is `.zc-search-wrap`, a button is `.zc-btn`, a menu is `.zc-menu` — even inside bigger things you build. If you catch yourself hand-drawing a button/input/badge/toggle out of divs, STOP and use the component.
- **Never assume a component doesn't exist.** Check ONBOARDING.md's API tables first. The library covers virtually every UI pattern (General Details, Code Block, Attention Box, Timeline, Container Header, Empty State, Stepper, Chips, Tour…). Commonly skipped, don't skip them.
- **Icons only from `zcat-ui/docs/icons/`.** Stroke icons: inline `<path>` with `stroke="currentColor"` (stroke-width 1.3) or the SVG sprite pattern from template.html; file-based recolor via `.zc-mask-icon`. NEVER emoji (🚀), NEVER Unicode glyphs (▶ ✕ ▾ ●), NEVER other icon sets. Wireframe icons are placeholders — map each to the closest zcat icon; if none is close, use the most relevant one and tell the user.
- **Verification status is NOT an availability list (corrected 2026-08-29).** This line previously read "Known gaps — do not improvise lookalikes: Slider, Progress Circle, Shimmer, Code Tab", which made agents refuse components that **exist and ship in the CSS**. All four are built:
  - `.zc-slider` + `__fill` + `__thumb` — `organisms.css`
  - `.zc-progress-circle` (3 sizes) — `feedback.css`
  - `.zc-shimmer` (text / rect / circle) — `feedback.css`
  - `.zc-tabs[data-type="code"]` + `.zc-tab-code` — `tabs-accordion-breadcrumbs.css`, and this one **is Figma-sourced** (set `2951:10610`, tokens bound verbatim); only its slanted right edge is a 31° skew approximation pending the exact vector.

  **Use all of them.** Slider, Progress Circle and Shimmer have no Figma source — the markup and tokens are real, but the DESIGN is unreviewed, so say so in your build summary. Slider is additionally not surfaced in `playground.html`, so the designer has never seen it — flag that explicitly.
- **Genuinely missing components:** check `ONBOARDING.md`'s status table and `grep` `src/components/` before claiming anything doesn't exist. If a class truly has no rule, SAY SO and ask — never improvise a lookalike.
- **PAUSE AND ASK on build problems.** If a needed component/pattern doesn't exist or the markup contract seems to not fit, stop and ask — never improvise a lookalike or burn effort on a failing approach.

### Design philosophy (identical to Figma mode)
- **Components are building material, not the design.** Think "how should this screen be designed?" THEN "which zc components implement it" — never the reverse. Card exists ≠ everything becomes a card.
- **NEVER copy-paste wireframe layout.** Wireframes define WHAT features appear, not HOW they look. Extract the feature list, then compose creatively: visual hierarchy, multi-column layouts, card recipes, spacing rhythm. If the wireframe and the final page look like the same layout side-by-side, you failed.
- **100% wireframe feature coverage.** EVERY tab, menu item, button, field, column, section, copy icon, and action link from the wireframe MUST appear. Reposition/restyle freely; NEVER silently drop. Removing a required feature needs explicit user APPROVAL first, not a mention afterwards.
- **Design beyond wireframes.** Flat lists → proper components with badges/icons; empty action bars → add Search/filters/heading; lonely right-aligned button → add a supporting left element. Eliminate duplicate information (same data shown twice → merge, tell the user).
- **Same design language, different compositions.** A list page, detail page, dashboard, and settings page share tokens/components/spacing but should each look distinct. Never apply one formula to every screen.

### Composition rules (the ones violated most often)
- **CTA hierarchy: AT MOST ONE fill (primary) button per visible screen** — count every `.zc-btn[data-variant="fill"]` on the page including popups' triggers; demote the rest to outline/grey/ghost. (Popup footer's own fill button is within the popup state, that's fine.)
- **Same size within a group** — buttons, dropdowns, inputs in one action bar/form row all use the same `data-size`.
- **Label:Value displays are HORIZONTAL** → `.zc-gdetails` (label left, colon, value right). Never stack label above value for read-only info. `.zc-kvfield` is an EDITABLE input — never use it for read-only display.
- **Section heading + its content live in ONE card** — the heading is the card's title, never a separate sibling card.
- **Detail/settings pages are READ-ONLY.** Values shown via General Details / stat cards / read-only text + an "Edit" button opening a popup. Never editable inputs directly in a detail page body (toggles OK only for instant-apply flags). Destructive actions → "Danger Zone" at the bottom or in a three-dot menu.
- **Create/Edit = popup** (`.zc-popup` + `.zc-popup-scrim`), per the Catalyst pattern — even if the wireframe drew it as a page. Escalate to a full-page popup only for genuine need (>~8 fields, wizard with Stepper, embedded tables/editors).
- **Popup anatomy:** NO close X anywhere (per Figma). Footer buttons: simple form = Cancel (grey, left) + Create (fill, right); wizard = Back (outline, far left) + spacer + Cancel (grey) + Continue (fill, right). Stepper/tabs go directly below the title in the header area, full width — never in the body. All form controls inside stretch to the popup body width.
- **Empty states** → `.zc-empty` (illustration + heading + desc + actions). No Container Header, no search/filters above it, two buttons must have different labels.
- **Tables:** `.zc-table-wrap` `data-style="stretch"` (full-bleed list pages) or `"boxy"` (inside cards/popups — popups are ALWAYS boxy). Column typing follows the data:
  - Avatar cell (`__user`) ONLY for people (would a face make sense? No → don't).
  - Entities (databases, functions, APIs, files) = stroke icon + text — never avatars, never badges.
  - `.zc-badge` ONLY for varying categorical status (<10 distinct values, meanings differ). All rows same value → plain text. In tables always `data-type="secondary"`, colors SEMANTIC (success=green/active, danger=failed, warning=pending, info=processing, grey=inactive) — never one color for all statuses.
  - ONE line per cell. Stacked info in a wireframe cell → two columns. 3+ lines never.
  - Three-dot row actions = `.zc-table__menushell` action menu with real menu items.
  - Pagination `.zc-pagination` sits at the container bottom; hide it when rows ≤ page size.
- **Bulk actions are contextual:** checkbox tables get THREE states — default (normal header), single-select ("Selected : 1" bar replacing the table header area, full single-row actions), multi-select (narrowed actions, Delete = danger). No checkboxes → no bulk bar.
- **Exactly ONE active tab** (`data-state="active"`) matching the visible content; each tab shows only its own content — split combined wireframe sections into their proper tabs and say so.
- **Filters showing a default-all value ("All Types") render as filled/selected**, not placeholder-empty. Every dropdown shows a realistic selected value — never "Select List".
- **Dynamic content is capped:** timelines/feeds show ~5 items + "View All" or "Showing 5 of 23" — never unlimited rows pushing the viewport.
- **Master-detail (list left, detail right)** → `.zc-csm` (Container Side Menu) beside the detail area — never a hand-built side panel.
- **Multi-state screens:** where `zcat.js` interactivity covers the state change (tabs, accordions, dropdowns, sidemenu), make it genuinely work. Where it doesn't (empty vs populated, bulk-select states, popup open), build each state as a separate reachable page/state (e.g. `functions-empty.html`, `functions.html`, `functions-create.html` or a query-param toggle) — never only one state.

### Catalyst page shell
- Product pages start from `.zc-layout`: `__rail` (service rail) + `__shell` > `__topbar` + `__main` > `.zc-sidemenu` + `__page` > `__subheader` + `__body` > `__container`. Follow `docs/template.html` — never modify the shell's look.
- **TAB PLACEMENT (designer-confirmed rule).** If a page has tabs, they MUST be
  Sub Header tabs: a full-width `.zc-tabs` `data-type="primary"` inside the
  `.zc-layout__subheader-tabs` second row — never a tabs bar floating in the
  container. If a page has TWO tab levels: primary level = Sub Header tabs,
  secondary level = the Container Header's tab variant (`.zc-tabs`
  `data-type="secondary"` in `.zc-cheader`). A detail page with back
  navigation uses the Sub Header's Back Nav variant (round ghost 28px icon
  Button) in the `-left` group, with the plain title + status badge beside it.
  Buttons: no tabs → Container Header action bar; tabs with a common action →
  Sub Header `-right` group; tab-specific actions → Container Header.
- **Container Header (`.zc-cheader`) IS the action bar** — search/filters left, buttons right. Never a hand-built action-bar frame.
- **No page title inside the container** — the Sub Header already shows it.
- Content inset from card/container edge is 16px; container gap 16px; use the template's spacing rather than inventing new rhythm.
- Sidemenu/current-nav item shows `data-state="active"` matching the page.

---

## WORKFLOW (follow every step in order)

### STEP 0 — Read the contract
Read `zcat-ui/ONBOARDING.md` fully. Note the components you'll likely need and open the usage comments of their owning CSS files. Never invent markup shapes.

### STEP 1 — Input collection
Accept wireframe images, screenshots, PRDs, or text. Screenshots/existing designs are REFERENCE ONLY — understand patterns and intent, never copy exact visuals.

### STEP 2 — Flow analysis → screen inventory (MANDATORY, needs user confirmation)
List back every screen AND state implied by the requirement. A "list page" usually implies: empty state, populated state, create popup, and often detail page + edit popup + delete confirmation. Output the inventory as a table (screen, states, key features found in the wireframe — count tabs, columns, buttons, links, copy icons). If anything is ambiguous, ASK. **Do not build before the user confirms the inventory.**

### STEP 3 — Composition direction (per screen)
Before writing markup, decide and record: layout (columns, card recipe, density), what improves on the wireframe, table column typing, badge color map (every status value → semantic color), CTA winner (the ONE fill button), popup structure. Consult the DECISION RULES BRIDGE below for the topic files. State notable decisions in your build summary ("think and decide, then inform") — don't ask about every small choice.

### STEP 4 — Component mapping
List every UI element → its `zc-*` component (use the TRANSLATION TABLE below). Anything with no component match is either composed from existing pieces or flagged to the user — never improvised as a lookalike.

### STEP 5 — Build
- Pages live in the consuming project folder (or a `pages/` folder next to `zcat-ui/`) — NEVER inside `zcat-ui/` or `AI Automation/`.
- One HTML file per screen; states per the multi-state rule.
- Include zcat.css + zcat.js (relative paths); glue CSS in a `<style>` block or page CSS file, page-scoped selectors only.
- Realistic sample data from `AI Automation/references/sample-data.md` (or equivalent realism if absent) — real names, regions, dates, storage sizes. Never lorem ipsum, never repeated placeholder rows.
- Icons per the icon rule; `zcat.js` wires interactivity automatically (dropdowns, tabs, accordions, menus, toasts…) — use its markup contracts so behavior works for free.

### STEP 6 — Post-Build Validation (MANDATORY — the code port of zcat.md step 4f)

**If ANY check fails, fix it BEFORE proceeding — never show a broken screen.**

**Live enforcement (5 layers — see `.claude/hooks/README.md`).**
FIRST: the gates render in a real browser, and `node_modules` is not in the
repo. On a fresh clone run `npm run setup` (npm install + playwright chromium)
and confirm `node .claude/hooks/zcat-render-audit.js zcat-ui/docs/template.html`
prints PASS before building anything. If it cannot run, STOP and say so —
building unguarded is the failure this toolchain exists to prevent.

1. **Static hook** runs on EVERY Write, Edit **and Bash** file change and blocks
   with the exact violations. It also AUTO-FIXES raw hex → tokens, off-scale
   spacing/radius, raw font rules, missing includes, and the glue `?v=` bump —
   those are design changes, so read `.zcat-state/autofix.log`.
2. **Rendered audit** — `node .claude/hooks/zcat-render-audit.js <page>` renders
   the page in Chromium and measures real geometry: alignment, overflow, overlap,
   collapsed boxes, uneven rows, contrast (light + dark), CTA count, tab state,
   tabs-in-container, hand-built controls, and "assembled not composed".
3. **Feature coverage** — `python3 .claude/hooks/zcat-features.py <page> --json
   '{...}'` — declare every tab, column, action and field the requirement
   contained plus the states you built; each is matched against the page, so a
   feature cannot be dropped quietly. `dropped` must be empty unless it records
   the user's prior approval; `states` cannot be empty, because a wireframe only
   ever draws the happy path.
4. **Design score** — `python3 .claude/hooks/zcat-design-score.py <page>` —
   scores composition, emphasis, component use, CTA restraint and card variety.
   Pass is **75 AND no dimension may be 0**. It measures whether the screen was
   COMPOSED or ASSEMBLED, not whether it is beautiful — a pass does not make a
   screen good, but a fail means it is not. If it fails, redesign the layout;
   adding a heading class to lift the number is gaming it.
5. **Stop gate** — you CANNOT finish while a page you touched lacks ALL FOUR:
   a passing rendered audit, a feature-coverage receipt, a passing design score,
   and a design review — each recorded after the page's last edit.

Do not argue with these or work around them. When zcat-ui is imported into
another project, copy `.claude/hooks/` and the `.claude/settings.json` hook
entries too.

**6a. Automated checks** — run these on every built page (not on zcat-ui itself):
```bash
# raw colors in built pages (should output nothing)
grep -nE '#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(|hsl\(' <page files> | grep -v 'var(--zc-'
# odd pixel values in glue CSS (should output nothing; 1px borders excluded)
grep -nE '\b(3|5|7|9|11|13|15|17|19|21|23|25)px' <page files>
# restyling zc-* classes in page CSS (should output nothing)
grep -nE '^\s*\.zc-[a-z-]+' <page css / style blocks>
# emoji/unicode icons (should output nothing)
grep -nE '[🚀⚡📁▶✕▾●←→✓✗]' <page files>
# raw font rules in glue CSS (should output nothing)
grep -nE 'font-size|font-weight|font-family' <page css / style blocks>
```

**6b. Structural checks** (the code equivalents of the Figma validation script):
- **Manual UI elements = ZERO.** Search the page for styled divs acting as buttons/inputs/badges/toggles. Every interactive element must carry its `zc-*` component class.
- **Component usage count.** A real screen uses many `zc-*` components (typically 10+ distinct ones). A page that is mostly bare divs was built manually — rebuild from components.
- **Shell present.** The page starts from `.zc-layout` with sidemenu/subheader/container (per non-negotiable #2) and the shell markup matches template.html.
- **Typography hierarchy.** The page must contain Semi Bold classes (`.zc-subtitle-*` / `.zc-h*`) on headings and emphasized values — a page whose authored text is entirely `.zc-body-*` Regular FAILS (no hierarchy).
- **Spacing on scale.** Every gap/padding in glue CSS uses `--zc-space-*` values.
- **Semantic naming.** Page-scoped glue classes carry meaningful names (`.fn-stats-grid`), not `.box1`/`.wrapper2`.

**6c. Browser verify** — start the dev server (serve the folder that contains both the pages and `zcat-ui/`), open each page:
- zero console errors, zero 404s (check network requests, not console history);
- interactions genuinely work (dropdown opens, tabs switch, popup opens/closes, table menu fires);
- screenshot at 1440×900; also flip `document.documentElement.setAttribute('data-theme','dark')` and screenshot (dark is unaudited upstream — flag breakage, don't hand-fix zcat-ui).

### STEP 7 — Screen Polish & SENIOR DESIGNER REVIEW (COMPULSORY — NO EXEMPTIONS)

**This gate runs after EVERY change that alters rendered UI — initial builds,
fix rounds, designer-correction rounds, component swaps, shell rebuilds, and
migrations alike.** "It was only a correction" or "I only changed one thing"
is NOT an exemption: correctness checks (DOM asserts, hook, load tests) answer
"does it work?", never "is it good?" — a screen is not done until the CURRENT
rendered screenshot has passed a fresh cold critique. Skipping this gate on a
rework round is itself a rule violation. (This is the code port of zcat.md
step 4g.)

Read `AI Automation/references/decision-rules/rules-design-composition.md`
"Screen Polish Patterns" and "Card Composition Recipes" for the improvement
reference. Then run the loop on the RENDERED SCREENSHOT:

```
Screenshot → Audit → issues? → Fix bugs + Enhance composition → Re-screenshot
→ still issues? → fix again (max 2 rounds) → Show to user
```

**Audit inch by inch:** (1) structural — nothing overflows/collapses, cards
content-driven height, containers stretch; (2) components — colors all tokens,
button sizes consistent per group, ONE fill button per PAGE, Cancel=grey,
badge colors semantic, table columns match data, exactly one active tab,
sidemenu active state, three-dot menus real; (3) completeness — COUNT every
tab/button/field/column/copy-icon against the inventory, every dropdown filled
with real data, zero placeholder text; (4) design quality — production look,
card recipe matches content, spacing rhythm, balance, density fits screen type.

**SENIOR DESIGNER REVIEW (blocking — a judgment loop, not a checklist).**
Technical validation answers "is this correct?"; this answers "is this actually
good?" — different questions. Set your composition plan aside and ask:

> *"If another designer handed me this finished screen, what would I redesign?"*

FORBIDDEN reasoning: "my composition decision was correct, therefore the screen
is good." Review the screenshot cold, in prose:
1. **First impression** — what does a user understand in 3 seconds? What does
   the eye hit first, and is that the most important thing?
2. **Hierarchy, honestly** — name primary/secondary/supporting info and the
   primary action; does the visual design actually communicate that ordering
   (scale, position, whitespace, grouping, contrast — not font size alone)?
3. **Composition as rendered** — proportions, alignment, whitespace, density,
   rhythm, balance, viewport usage. Space in proportion to importance?
4. **Designed or assembled?** Does it feel intentionally designed, or like
   zcat components stacked into a page? If assembled, say exactly why.

Check the two repeat offenders explicitly: **uniformity of same-role elements**
(every section heading identical style; every card in a row identical padding)
and **container purpose** (each card must earn its existence — merge or remove
ones that don't).

Judge against the task, not novelty: dashboard → hierarchy + scanning ·
logs/monitoring → density · form → clarity · detail → relationships ·
empty state → guidance + action. Never force creativity where simplicity wins.

**Then force a decision — output up to 3 highest-impact improvements as:**
```
TOP DESIGN ISSUE
Why it matters
Proposed improvement
Expected UX/design benefit
```
**If meaningful improvements exist you MUST apply them** — describing them is
not completing this step. Re-screenshot, re-critique (BEFORE → CRITIQUE →
CHANGES → AFTER), max 2 rounds. If the screen is genuinely strong, record
verbatim: *"No meaningful design improvement identified; keeping the current
composition."* — but "everything passed" is not available if you have not named
the weakest thing on the screen.

### STEP 8 — Show the user
Show the page(s) with the final screenshot, list which zcat components were
used where, state the design decisions and the senior-designer improvements
you applied (or the verbatim no-improvement line), and flag anything the
requirement needed that the library does not have. Then present the remaining
open design questions to the user the way a senior designer would ("I'd also
consider X — want me to?"). If fixes are requested, make targeted edits, never
rebuild from scratch.

---

## DECISION RULES BRIDGE (AI Automation → code)

For design decisions, read the matching file from
`AI Automation/references/decision-rules/` (pick via `_index.md`, read ONLY the
file you need). Apply the DESIGN decision; SKIP the Figma mechanics
(keys, `setProperties`, detach, instance swap, auto-layout API). Translate:

| Figma concept in the rules | Code equivalent |
|---|---|
| `layoutSizingHorizontal = FILL` | `width: 100%` / `flex: 1` / grid stretch |
| Height HUG, never fixed | content-driven height — never fixed height on cards/containers |
| Detach to extend (more tabs/items than the component supports) | just add more items — markup has no limits; keep the same classes |
| Instance-swap a Table AI column type | choose the cell markup: text / icon+text / `__user` / `.zc-badge` / date / three-dot menu |
| Import variable by key | `var(--zc-*)` token |
| Text style by key (`Headlines/H5`, `Body/Subtitle 2`…) | `.zc-h5`, `.zc-subtitle-2`, … typography classes |
| Popup Blur backdrop | `.zc-popup-scrim` |
| Frame-overlap / page-grid rules | one screen per HTML file — not applicable |

## FIGMA COMPONENT → CODE CLASS TABLE

| Figma component | Code |
|---|---|
| Layout (Catalyst) | `.zc-layout` (rail/topbar/sidemenu/subheader/container) |
| Side Menu | `.zc-sidemenu` (`data-type="collapsed"`) |
| Container Side Menu | `.zc-csm` |
| Container Header | `.zc-cheader` |
| Sub Header | `.zc-layout__subheader` |
| Table AI + Pagination | `.zc-table-wrap` + `.zc-table` / `.zc-pagination` |
| Buttons | `.zc-btn` (`data-variant`, `data-color`, `data-size`, `data-content="icon"`) |
| Text Box / inputs | `.zc-input-group` > `.zc-label` + `.zc-input-wrap` > `.zc-input` |
| Drop down / Menu List | `.zc-select-shell` > `.zc-select-wrap` + `.zc-menu` |
| Search | `.zc-search-wrap` |
| Check Box / Radio / Toggle | `.zc-checkbox` / `.zc-radio` / `.zc-toggle` |
| Badges | `.zc-badge` |
| Chip | `.zc-chip` |
| Tabs | `.zc-tabs` > `.zc-tab` |
| Breadcrumbs | `.zc-breadcrumbs` |
| Accordion / Bordered | `.zc-accordion` / `.zc-accordion-link` |
| Stepper | `.zc-stepper` |
| Popup + Popup Blur | `.zc-popup` + `.zc-popup-scrim` |
| Toast (Alerts) | `.zc-toast` |
| Attention Box | `.zc-attention` |
| Card BG | `.zc-card` (no built-in padding — add via glue) |
| Empty State | `.zc-empty` |
| General Details | `.zc-gdetails` |
| Key Value Pair (editable) | `.zc-kvfield` |
| Avatar / Group | `.zc-avatar` / `.zc-avatar-group` |
| Tooltip | `data-tooltip` / `.zc-tooltip` |
| Loader / Spinner | `.zc-spinner` |
| Progress Bar / Skeleton | `.zc-progress` / `.zc-skeleton` |
| Code Block / Editor | `.zc-codeblock` (`data-type="editor"`) |
| Date Picker / Time Picker | `.zc-datepicker` / `.zc-timepicker` |
| Timeline | `.zc-timeline` |
| Profile Menu / Notifications | `.zc-profilemenu` / `.zc-notifications` |
| Carousel Dot / Tour / Blink | `.zc-carousel` / `.zc-tour` / `.zc-blink` |
| Link / Link Box | `.zc-link` / `.zc-linkbox` |
| File Upload | `.zc-upload` |
| Divider / Stack / Row / Grid | `.zc-stack` / `.zc-row` / layout utilities in `src/layouts/layouts.css` |

Exact markup shapes: ONBOARDING.md + the owning CSS file's usage comment. Do not guess attributes.

## LEARNED TRAPS (from the first real build — designer-corrected, do not repeat)

- **LAYOUT SHELL IS SACRED (designer rule).** Copy the shell from
  `docs/template.html` VERBATIM — the service rail (its five services, their
  dual `--icon`/`--icon-active` logos, active state) and the topbar (the
  `zc-ghostdd` Dropdown Ghost project switcher + 390px search + avatar) NEVER
  change. The ONLY parts a page may change: the Sub Header, the container
  content, and the SIDE MENU's content — its service name, section
  headings/items, and item icons. The sidemenu service header logo must be an
  existing `*-color.svg` from `docs/icons/` (if the service has no logo in the
  set, use the closest one and tell the user — never a plain stroke icon file).
- **Side Menu item icons (v66+): stroke icons WITH `class="zc-icon-stroke"`.**
  `.zc-sidemenu__item svg` defaults to `fill: currentColor` (for logo glyphs
  like `#i-slate`); a stroke icon without the `zc-icon-stroke` class renders as
  a solid blob. Per-item stroke icons are the current template pattern:
  `<svg class="zc-icon-stroke" viewBox="0 0 16 16"><use href="#i-database"/></svg>`.
- **Search-type Container Header: use the `zc-cheader__left--row` modifier**
  (v66+) instead of inline `flex-direction:row` + custom glue.
- **Icon backgrounds: sanctioned on CARDS, banned in TABLES/logos.** Recipe A
  (rules-design-composition.md) DEFINES stat cards with a 40x40 radius-10 icon
  BG in varied badge-subtle token fills + 12px secondary label + 24px SemiBold
  value (`.zc-h3`) — flat text-only stat cards are the "assembled, not
  designed" failure. Recipe I/J selection cards take a 48px icon circle.
  But NEVER put icon chips in TABLE CELLS (entity cells are PLAIN TEXT — not
  `.zc-link` either; status badges are the only colored element; row click +
  three-dot "View Details" navigate) and NEVER use a plain icon file as a
  service LOGO (logos come from the `*-color.svg` set).
- **Button variant combos must exist in button.css.** `outline` pairs only
  with primary/success/danger — there is NO outline+grey; an undefined combo
  renders as an unstyled bare button. The grey secondary button is
  `data-variant="grey"` (wizard Back and Cancel are both grey).
- **Toasts appear TOP CENTER** (product convention, designer-confirmed) —
  a fixed, centered stack at the top of the viewport, never bottom-right.
- **Card selection is built in.** Put `<span class="zc-card__check"></span>`
  inside a `.zc-card` and toggle `data-state="selected"` — the blue corner
  check shows automatically. Never compose a custom radio/indicator onto cards.
- **Never widen the Popup.** Component widths are 550px (default) / 414px
  (`data-size="small"`) — do not set a custom width even for wizards. All form
  fields inside stretch full width (no max-width on input groups).
- **Back navigation** = the Sub Header title itself as a link reading
  `‹ item-name` (Catalyst pattern) — never a custom round icon button, never
  breadcrumb frames.

- **Badge palette has NO blue.** Colors: success · danger · warning ·
  info (PINK in this DS) · purple · grey · disabled. Processing/provisioning
  states map to `info` — do not hunt for a blue badge.
- **Bash-edited files skip the enforcement hook** (it fires on Write/Edit tool
  calls only) — after any scripted bulk edit, run
  `.claude/hooks/zcat-validate.py` manually on the touched pages.
- **Cache-bust page glue CSS too** (`./page.css?v=N`, bump on every edit) —
  the library's `?v=` ritual applies to your own stylesheets as well; a stale
  cached glue file makes an applied fix look like it did nothing.

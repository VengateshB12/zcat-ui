<!-- Shipped with the library so the rules travel with the clone.
     Source of truth is the zcat Figma project; re-copy if they diverge.
     These are DESIGN decisions and apply in both modes. Where a file
     mentions Figma mechanics (component keys, auto-layout,
     setProperties), take the decision and ignore the mechanism —
     none of it exists in code. -->

# Spacing & Layout Reference

## Master Spacing Rules

**Only these values are valid:**
0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 128

No other values. No odd numbers. No 18, 22, 36, 44.

## Container Padding — THE #1 AGENT MISTAKE

Agents consistently get Container padding wrong because they default to "16px all sides" for every layout. **The padding changes based on the layout type.** This table is the ONLY source of truth — follow it exactly.

| Layout type | paddingTop | paddingRight | paddingBottom | paddingLeft | When to use |
|-------------|-----------|-------------|--------------|------------|-------------|
| **Stretch table** | 16 | 0 | 0 | 0 | List page with full-width table (most common Catalyst page) |
| **Boxy / Cards view** | 16 | 16 | 16 | 16 | Card grid, grouped sections, non-table content |
| **Empty state** | 0 | 0 | 0 | 0 | Page with no data — Empty State component fills the space |
| **Dashboard** | 16-24 | 16-24 | 16-24 | 16-24 | Dashboard with Card BG sections on grey background |

### Why Stretch Tables Use 0 Left/Right

A stretch table bleeds edge-to-edge inside the Container — its rows touch both sides of the white card. This is by design: the table header and data rows use their own internal cell padding (12-16px) to provide horizontal spacing. Setting Container paddingLeft/Right = 16 on top of that creates a visible 16px white gutter between the table edges and the card border — the table looks like it doesn't fill the card.

**The Container Header (action bar) still needs visual inset**, even when the Container has 0 left/right padding. See "Container Header Horizontal Inset" below for how to handle this.

### Decision Flow

1. Does the Container hold a full-width Table AI? → **Stretch** (16/0/0/0)
2. Does the Container show an Empty State? → **Empty** (0/0/0/0)
3. Does the Container show cards/sections on grey bg? → **Dashboard** (16-24 all sides)
4. Everything else (mixed content, settings, forms) → **Boxy** (16 all sides)

### Common Container Padding Mistakes

| Wrong | Right | Why it breaks |
|-------|-------|---------------|
| Stretch table with 16px all sides | 16/0/0/0 | Table doesn't fill the card — 16px white gaps on left/right |
| Boxy content with 0 padding | 16 all sides | Content touches card edges — no breathing room |
| Empty state with 16px padding | 0/0/0/0 | Empty State component handles its own centering |
| Stretch table with 0 top | 16/0/0/0 | No gap between Sub Header/Body edge and Container Header |
| All padding zeroed ("clearing to rebuild") | Keep Layout defaults, only adjust per table above | Zeroing strips correct values; dead space + wrong fills result |

### NEVER "Clear" Container to Rebuild

After Layout detach, the Container already has correct:
- **Fill:** `CARDS/Bg Default/Primary` (white card)
- **Stroke:** `CARDS/Borders/Default`
- **Corner radius:** design-system default
- **Auto-layout:** VERTICAL, width FIXED (1259px or 1489px)
- **Vertical sizing:** `layoutSizingVertical = "FILL"` — fills remaining Body height

**Only adjust:** padding (per stretch/boxy table above), itemSpacing, and children (add/remove content). NEVER zero out all properties and rebuild from scratch.

### Container Vertical Sizing = FILL

Container MUST use `layoutSizingVertical = "FILL"` — it fills the remaining vertical space in the Body frame. The white card extends from below the action bar to the viewport bottom. If Container uses HUG instead of FILL, dead space between the Container bottom and the viewport shows the Body's dark background as a black strip. After Layout detach, verify this is preserved.

---

## Legacy Container Spacing (quick reference)

| Context | Padding | Gap |
|---------|---------|-----|
| Standard page | 16px all sides | 16-24px vertical |
| Stretch table page | 16 top, 0 right/bottom/left | 0 |
| Boxy table page | 16px all sides | 16-24px vertical |
| Dashboard card grid | 16-24px all sides | 16px between cards |
| Settings popup | 0 or 16px | 0 (panels manage own padding) |

## Component Internal Spacing

| Component | Padding | Gap |
|-----------|---------|-----|
| Action bar / Container Header | H depends on Container (see Inset rule below), 12px V | 8-12px |
| Card BG (stat tile) | 16-20px | 8-12px label↔value |
| Accordion (open) | 16px | 12-16px |
| Sidebar List Panel | 0 top, 12-16px H | 0-4px items |
| Table header row | 12-16px cell | — |
| Table body row | 12-16px cell | — |
| Form field group | — | 16-20px fields |
| Modal / Popup body | 20-24px | 16-20px sections |
| Tab bar | 0 left | 0 (tabs manage own) |

## Section Spacing

| Between | Gap |
|---------|-----|
| Container Header → first content | 16px |
| Section heading → content | 8-12px |
| Section → next section | 20-24px |
| Card row → next card row | 16px |
| Table → pagination | 12-16px |
| Stat cards → next section | 20-24px |
| Attention Box → next content | 16px |
| Breadcrumbs → page content | 12-16px |

## Text Spacing

| Context | Gap |
|---------|-----|
| Heading → body text | 4-8px |
| Paragraphs | 8-12px |
| Label → input field | 4-6px |
| Helper text below input | 4px |
| Badge next to text | 6-8px horizontal |
| Icon next to text | 4-6px |

## Same-Size-In-Group Rule

Buttons, dropdowns, and text boxes in the same visual group (action bar, form row, filter bar, modal footer) MUST all use the **same Size variant**. Never mix Default + Small in one group.

## Common Mistakes

1. **Arbitrary gaps** — 15, 18, 22 are not on the scale
2. **Inconsistent section gaps** — 24px A→B but 16px B→C on same page
3. **Missing padding on manual frames** — dividers need 16px to align
4. **Too-tight card grids** — less than 12px. Default 16px
5. **Uneven form fields** — always 16-20px between fields
6. **Table cell padding inconsistency** — all cells same horizontal padding

---

## BODY vs CARDS Variables — Critical Disambiguation

Agents confuse these two namespaces and apply the wrong one to the Container. They are NOT interchangeable.

| Namespace | Purpose | Light mode | Dark mode | Use on |
|-----------|---------|-----------|-----------|--------|
| `BODY/Background/Static/Body Bg` | Page-level backdrop | `#EFF2FA` (grey) | `#151516` (dark) | The Body frame behind Container |
| `BODY/Background/Static/Container Bg` | Misleading name — still a BODY-level variable | `#FFFFFF` | `#1A1B1D` | Avoid — use CARDS instead |
| `CARDS/Bg Default/Primary` | White card surface | `#FFFFFF` | `#1A1B1D` | Container, Card BG, popups, content cards |
| `CARDS/Bg Default/Body Bg` | Grey card variant | `#F7FAFF` | `#1F2022` | Dashboard container with card grid on grey |
| `CARDS/Borders/Default` | Card border | `#EBEEF6` | `#2F3136` | Container stroke, Card BG borders |

### The Rule

**Content surfaces (Container, Card BG, popups) = `CARDS/*` variables.**
**Page backdrops (Body frame, full-page backgrounds) = `BODY/Background/*` variables.**

The Layout component pre-binds Container to `CARDS/Bg Default/Primary` and `CARDS/Borders/Default`. After detaching Layout, **NEVER change Container's fill or stroke** — they are already correct. Only modify padding and children.

### Why Agents Get This Wrong

`BODY/Background/Static/Container Bg` sounds like it should go on the Container — it has "Container" in the name. But in zcat's variable taxonomy, `BODY/*` is the page-level namespace. The Container widget itself is a CARD that sits on the body, so it uses `CARDS/*`. The naming is confusing, but the rule is absolute: **Container fill = `CARDS/Bg Default/Primary`**.

---

## Container Content Patterns

### Standard White Container vs Dashboard Card Grid

**Standard White:** List page, detail page, form, single cohesive block.

**Dashboard Card Grid:** Dashboard/analytics/overview. Independent sections. Each section as card on gray background.

**Dashboard build:**
1. Container fill → `CARDS/Bg Default/Body Bg` (gray)
2. Padding 16-24px all sides
3. Layout → vertical auto-layout, gap 16px
4. Each section → **Card BG** (White variant), detach for content
5. Side-by-side → horizontal frame, gap 16px, FILL width children

```
Container (fill: CARDS/Bg Default/Body Bg, padding: 16-24px, gap: 16px, VERTICAL)
├── Card BG — "Event Chart" (full width)
├── Card BG — "Event Statistics" (full width)
└── Row frame (HORIZONTAL, gap: 16px)
    ├── Card BG — "Top Publishers" (FILL)
    └── Card BG — "Most Failures" (FILL)
```

Card headings: 14px SemiBold or 16px SemiBold, `BODY/Text/Static/Primary`.

---

## Layout & Composite Components

### Layout: Default vs No Left Menu

**Default** (1259px container): Page has multiple sub-features to navigate. Most Catalyst pages.

**No Left Menu** (1489px container): Single-purpose, no sub-navigation. Overview/dashboard/settings without sidebar.

Import: component_set key `c321d468b0231e052b921026407ff896bdf2c55e`.

### Container Header vs Manual Action Bar

**Container Header (PREFERRED):** Has boolean toggles for title, search, tabs, filters (1-3), buttons, link box, badge, info icon, description. Types: Feature Name, Search, Tab.

**Detach when:** Need element not available as toggle, 4+ filters, custom widgets.

**Manual (last resort):** Completely non-standard layout. ALL fills use variables, ALL spacing from scale.

Import: component_set key `c1e72c452cc937aa5dfc80c6308008c5038bc10f`.

### Sidebar List Panel vs Manual Side Menu

**Sidebar List Panel (PREFERRED):** Standard title + search + grouped menu items. 300px, 3 pre-built sections.

**Detach:** More/fewer than 3 sections. Keep shell styling.

**Manual (Recipe 4):** Non-standard content (cards, tree view, custom widgets).

Import: component key `c042e030f9a1755279cd389302cf6f3f693f6707`.

---

## Feedback Components

### Toast vs Alert Banner vs Inline Message

**Toast:** Transient success, auto-dismiss 3-5 seconds, completed action feedback.

**Alert Banner:** Page-level persistent message, may require action (upgrade, verify), severity matters.

**Inline Message:** Field/section-specific, validation, position-dependent.

### Skeleton vs Shimmer vs Spinner

**Shimmer:** First-load, known layout, 1-3 seconds.

**Skeleton:** Subsequent loads of cached layouts.

**Spinner:** Brief/unpredictable loading, small sections.

### Empty State: Illustration vs Simple Text

**Illustration + CTA:** Primary page, first-time, key onboarding moment.

**Simple Text:** Nested/secondary section, temporary (no search results).

### Progress Bar vs Progress Circle

**Progress Bar:** Section-level, full width, multiple stacked indicators.

**Progress Circle:** Compact, inline, alongside other content.

---

## Stretch Table Pagination Placement

For Stretch tables, pagination MUST NOT be built into Table AI (`Show Pagination = false`). Instead:

1. Add the standalone **Pagination** component as the **last child of Container**
2. Set Container `primaryAxisAlignItems = "SPACE_BETWEEN"` (or insert a FILL spacer between the table and pagination) so pagination pins to the Container bottom edge
3. Table AI hugs its rows; pagination anchors at the bottom — no dead white space between
4. **Hide pagination entirely when total rows ≤ page size** — "1–4 of 4" is noise

### Container Header Horizontal Inset

The visual inset from the card edge to Container Header content is ALWAYS **16px**. But the implementation depends on the Container's own padding:

| Layout type | Container padding L/R | Container Header padding L/R | Why |
|-------------|----------------------|------------------------------|-----|
| **Stretch table** | 0 | 16 | Container has no inset, so Header provides it |
| **Boxy / Cards** | 16 | 0 | Container already provides 16px inset |

- Gap below Container Header: Container `itemSpacing = 16`
- In stretch layout, the table bleeds edge-to-edge (Container L/R = 0) while the action bar content sits inset (Header L/R = 16)
- In boxy/cards layout, everything is inset by the Container's own 16px padding, so the Header needs no additional padding

---

## Frame Layout on Figma Page

All screen frames on a Figma page MUST follow a consistent grid:

- **Horizontal pitch**: uniform spacing between columns (e.g., 100px gutters)
- **Vertical pitch**: uniform spacing between rows
- **NO overlapping**: no two top-level frames may share any bounding-box area
- **Component samples** (overflow menus, popups, drawers) go in a separate labelled "Samples" section outside the screen grid — never dropped next to a screen where they can overlap

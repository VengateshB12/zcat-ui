<!-- Copied from the zcat Figma project's reference set so the rules travel
     with this clone. These are DESIGN decisions and apply in both modes;
     where a file mentions Figma mechanics (component keys, auto-layout,
     setProperties), take the decision and ignore the mechanism — none of
     it exists in code. Source of truth is the Figma project; re-copy if
     they diverge. -->

# Data Display Rules

## THE #1 DISPLAY MISTAKE: Editable Form vs Read-Only Display

**If the wireframe shows DATA VALUES (not empty inputs), it is a READ-ONLY display, NOT an editable form.**

### How to Tell the Difference

| Wireframe shows | It means | Use |
|-----------------|----------|-----|
| Label + actual value text (e.g., "Host: some-server.example.com") | READ-ONLY display | General Details component |
| Empty input field with placeholder ("Enter value...") | EDITABLE form input | Text Box component |
| Value + Copy button/icon | READ-ONLY with copy action | General Details or manual bordered field + Copy icon |
| Value + Edit button/link | READ-ONLY, click-to-edit | General Details + edit link, NOT pre-filled form |

### Any Section Showing Label:Value Pairs with Real Data

This applies to ANY product — server configs, API credentials, account settings, billing info, service endpoints, integration details. If you see real values in the wireframe:

**CORRECT:** General Details component (key `6dd180e6490c68971c8c9b5cc963349b711a5e5d`, type `component`). Import → detach → customize rows. Label on LEFT, value on RIGHT. Wrap in Card BG or bordered frame.

**WRONG:** Text Box inputs, Dropdown selects, or any editable control. That turns a read-only info display into an editable form — completely wrong interaction model.

**The rule:** Real values in fields → read-only (General Details). Empty fields with placeholders → editable form (Text Box / Dropdown).

---

## WARNING: Key Value Pair Component Renders with Editable Inputs

**Key Value Pair** (key `2d82f5c0a6c24ab0370c320d0044cc8346666077`) renders with a text input + dropdown ("Select List") — it is an EDITABLE component, NOT a read-only display. **Do NOT use it for read-only data.**

### Component Decision Table

| Display type | Use | NOT |
|-------------|-----|-----|
| Read-only info section (config, metadata, credentials) | **General Details** (detach for custom rows) | Key Value Pair (renders as form) |
| Read-only copyable fields | General Details or manual bordered frames + Copy icon | Text Box (editable input) |
| Editable form with label + input | Key Value Pair OR Text Box with label | General Details (read-only) |
| Inline metadata (1-3 facts) | Manual label + value text | — |

**CRITICAL: Label:Value alignment is ALWAYS horizontal** for read-only displays. Label LEFT, value RIGHT, same row. NEVER stack vertically.

---

## Activity Feed / Event List Pattern

When ANY screen shows a list of events, logs, or activity with timestamps:

**Each item MUST have a colored status dot.** The dot color indicates the event type:

| Event type | Dot color |
|------------|-----------|
| Success / completion (completed, deployed, enabled) | Green |
| Info / change (modified, created, updated, promoted) | Blue |
| Warning / degradation (degraded, expiring, throttled) | Amber |
| Historical / neutral (archived, scheduled) | Grey |
| Error / failure (failed, crashed, timed out) | Red |

**Build as:** VERTICAL auto-layout inside a Card BG, each item is a HORIZONTAL row:
```
Row (HORIZONTAL, gap: 12, center-aligned)
├── Status dot (8×8 circle, fill: semantic color variable)
├── VERTICAL auto-layout, gap: 2
│   ├── Event text (Body/Regular/14, BODY/Text/Static/Primary)
│   └── Timestamp (Body/Regular/12, BODY/Text/Static/Disable)
```

**NEVER drop the status dots.** They communicate event severity. An activity feed without dots is just a plain text list and looks unfinished.

---

## Table vs Cards vs List vs Side Menu

**Use Table when:** Data has 4+ comparable columns, users need to scan/sort/filter, data is uniform, bulk actions needed.

**Use Cards when:** Items have a visual element (thumbnail, icon), 3 or fewer key attributes, items are browsed not compared.

**Use List when:** Items are simple (one primary line + optional secondary), space is constrained, items scanned sequentially.

**Use Side Menu (inside Container) when:** Selecting an item updates a detail view elsewhere — master-detail pattern. 8+ items with short labels.

**Default:** Table for 4+ columns. Cards for ≤3 attributes with visual emphasis. List for simple items. Side Menu when selection drives a detail view.

---

## Building a Card (Card BG)

**Component:** key `f94642162a404b4dd9b0c2c9e8c7e3d1a8ba330e`, component_set. Bind every fill/stroke to zcat variables. Detach to add content; keep padding, radius, color binding.

**Three roles — pick by purpose:**

1. **Stat tile / info card** — **neutral** Card BG. When the value already carries semantic color (green success rate, red error count), a colored background competes with that signal. Let the card be neutral; let the value's color do the signaling.

2. **Catalog / directory card** (browsable items in a grid) — **themed** Card BG, one color per item. Distinct tint helps differentiate.

3. **Selectable option tile** (wizard step picker) — **neutral** tile. The icon carries brand color, not the card. Add selection state (border highlight) when chosen.

---

## Two-Column Card Row Height — Use STRETCH, Not Fixed

When two or more cards sit side by side:

**CORRECT:** Parent row uses `counterAxisAlignItems = "STRETCH"`. Both cards grow to match the tallest one's content height naturally.

**WRONG approaches:**
- Setting the parent row to HUG → cards collapse to minimum height, shorter card looks broken
- Setting a FIXED pixel height (e.g., 320px) on the row → arbitrary, breaks when content changes

```
Row (HORIZONTAL auto-layout, gap: 16px)
  counterAxisAlignItems = "STRETCH"  ← CORRECT
  layoutSizingHorizontal = "FILL"
├── Left Card (FILL width, HUG height) — stretches via parent STRETCH
└── Right Card (FILL width, HUG height) — stretches via parent STRETCH
```

---

## Card Grid Layout (Catalog / Directory Pages)

**Container structure:**
```
Container (VERTICAL, padding 16/0/16/0, itemSpacing 10)
├── Container Header (Search + filters + Create button)
└── Cards Container (FILL horizontal, VERTICAL, 16px padding left+right)
    ├── Cards Row 1 (horizontal, 16px gap, 3 cards FILL width)
    └── Cards Row 2 (same)
```

**Individual card:**
```
Card frame (FILL width, Card BG fills, 16px padding, 6px radius)
├── Icon BG (40x40, cornerRadius 10, subtle color fill)
│   └── Stroke icon (18x18, centered)
├── Badge (top-RIGHT, positioned absolutely)
├── Title (Body/SemiBold/16, BODY/Text/Static/Primary)
├── Subtitle (Body/Regular/14, BODY/Text/Static/Secondary)
└── Timestamp (Body/Regular/12, BODY/Text/Static/Disable)
```

**Rules:** Badge at TOP-RIGHT. 3 cards per row, all FILL width. All text uses zcat styles.

---

## List Item Selection: Highlight vs Checkbox

**Highlight-only (NO checkboxes) when:** Single-select — clicking shows detail. No batch operations.

**Checkboxes when (rare):** Batch operations on multiple items. Position at leading edge. Add "Select All" at top.

---

## KPI/Stats Cards vs Inline Metrics

**KPI/Stats Cards when:** Metrics are the hero content of dashboard/overview. 3-6 key metrics to highlight.

**Inline Metrics when:** Metrics provide context within a section. 1-2 secondary metrics.

**Default:** KPI Cards for dashboard headers. Inline for contextual data within sections.

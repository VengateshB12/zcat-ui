<!-- Shipped with the library so the rules travel with the clone.
     Source of truth is the zcat Figma project; re-copy if they diverge.
     These are DESIGN decisions and apply in both modes. Where a file
     mentions Figma mechanics (component keys, auto-layout,
     setProperties), take the decision and ignore the mechanism —
     none of it exists in code. -->

# Design Uniforms — Mandatory Specs for All Screens

Fixed visual specs that EVERY screen must use for uniform, polished output.

## Consistency Across Screens

**Same pattern for same screen type.** When building multiple screens:
- If one list page uses stretch table + search + filter + create → ALL list pages use that layout
- If one detail page has stat cards at top → ALL detail pages show stat cards
- Sidebar menu structure, Sub Header format, table styling, card dimensions, section headings, action bar layout, and pagination must be consistent
- Build screen 1, get approval, replicate patterns for subsequent screens
- Only deviate when screen type is genuinely different (list vs detail vs settings vs wizard)

**Component usage does NOT decay across screens.** If screen 1 uses Button, Text Box, Badge, Table AI, Card BG, then screens 2-10 MUST also use these. Re-read the component checklist before each screen.

## Standard Page Compositions

**List Page (stretch table):**
```
Container (padding: 0)
└── Action bar (padding: 16px top/left/right, 0 bottom)
    ├── Search (left) + Filter/Refresh icons (center)
    └── Primary button "+ Create X" (right)
└── Table (full width, edge-to-edge)
└── Pagination bar (bottom)
```

**Detail Page with Tabs (boxy, multi-section):**
```
Sub Header (INSTANCE — title + tabs + common actions)
Body (padding 14px)
└── Container (padding ~10/16/16/0, gap 10)
    ├── Container Header (section title + description + filters)
    └── Content Frame (padding 0/16/16/16, gap 16)
        ├── Stat cards row (HORIZONTAL, gap 16)
        ├── Two-column row (HORIZONTAL, gap 16)
        └── Full-width section (Card BG or bordered)
```

**Detail Page without Tabs:**
```
Container (padding: 16px all sides, gap: 16)
├── Stat cards row (HORIZONTAL, gap 16, all FILL width)
├── Two-column row (HORIZONTAL, gap 16)
│   ├── Left (FILL) — Card BG (KV pairs, connection info)
│   └── Right (FILL) — Card BG (activity feed, related data)
└── Full-width section — Card BG (table, chart, progress)
```

**Settings Page (two-column):**
```
Container (padding: 16px, gap: 20-24px)
├── Two-column (HORIZONTAL, gap 24)
│   ├── Left (~60%) — form fields + "Apply" button
│   └── Right (~40%) — toggle rows + credentials section
└── Danger zone (Attention Box Error or red-bordered frame)
```

**Wizard (popup):**
```
Popup Blur (full page backdrop)
└── Popup (~500-700px wide)
    ├── Title
    ├── Stepper (step indicators)
    ├── Step content (varies per step)
    └── Footer (Back outline + Cancel ghost + Continue fill)
```

## Card Specs

| Property | Value |
|----------|-------|
| Background | Card BG component (`CARDS/Bg Default/Primary`) |
| Border radius | 6px (component default) |
| Internal padding | 16px all sides |
| Gap label → value | 8px |
| Stat value font | 24px SemiBold, `BODY/Text/Static/Primary` |
| Stat label font | 12px Regular, `BODY/Text/Static/Secondary` |
| Cards in row gap | 16px |
| Cards in row width | All FILL (equal) |

## Section Container Specs

| Property | Value |
|----------|-------|
| Background | `CARDS/Bg Default/Primary` |
| Border | 1px solid, `CARDS/Borders/Default` |
| Border radius | 6px |
| Internal padding | 16px all sides |
| Heading → content gap | 12px |
| Between items | 12-16px |

## Shadows and Elevation

- Card BG provides its own subtle shadow — don't add manual shadows
- Popup gets shadow from the Popup component
- No manual `effects` array shadows on frames

## Layout Alignment

| Rule | Spec |
|------|------|
| Container children | `layoutSizingHorizontal = "FILL"` |
| Multi-column rows | HORIZONTAL auto-layout, gap 16px, each FILL |
| Column ratios | FILL+FILL for 50/50, fixed+FILL for 40/60 |
| Vertical stacking | VERTICAL, `counterAxisAlignItems = "MIN"` |
| Center-aligned | Only for empty states and popup content |

## Spacing Rhythm

| Between... | Gap |
|------------|-----|
| Major sections | 24px |
| Sub-sections within card | 16px |
| Section heading → content | 12px |
| Form fields (vertical) | 16px |
| Label → input | 4px |
| Cards in row | 16px |
| Container children | 10px (Container itemSpacing) |
| Toggle/checkbox rows | 12px |
| Help text below control | 4px |

## Text Styles

| Role | Size | Weight | Color |
|------|------|--------|-------|
| Section heading | 16px | SemiBold | `BODY/Text/Static/Primary` |
| Sub-section heading | 14px | SemiBold | `BODY/Text/Static/Primary` |
| Body / table cell | 14px | Regular | `BODY/Text/Static/Primary` |
| Form label | 14px | Medium | `BODY/Text/Static/Primary` |
| Caption / metadata | 12px | Regular | `BODY/Text/Static/Secondary` |
| Help text | 12px | Regular | `BODY/Text/Static/Disable` |
| Stat card value | 24px | SemiBold | `BODY/Text/Static/Primary` |
| Stat card label | 12px | Regular | `BODY/Text/Static/Secondary` |
| Badge text | Component default |

## Button Placement

| Context | Alignment |
|---------|-----------|
| Action bar | Search left, buttons right. `SPACE_BETWEEN` |
| Form footer | Right. Cancel (outline) left of Save (fill) |
| Popup footer | Right. Back (outline) left of Continue (fill) |
| Danger zone | Left-aligned within section |

## Danger Zone Spec

| Property | Value |
|----------|-------|
| Wrapper | Attention Box (Error) or 1px `CARDS/Borders/Default` frame |
| Padding | 16px |
| Heading | 14px SemiBold, `BODY/Text/Static/Primary` |
| Description | 12px Regular, `BODY/Text/Static/Disable` |
| Gap from content above | 24px minimum |

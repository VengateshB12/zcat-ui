<!-- Shipped with the library so the rules travel with the clone.
     Source of truth is the zcat Figma project; re-copy if they diverge.
     These are DESIGN decisions and apply in both modes. Where a file
     mentions Figma mechanics (component keys, auto-layout,
     setProperties), take the decision and ignore the mechanism —
     none of it exists in code. -->

# Navigation, Actions & Structure

## THE #1 TAB MISTAKE: Sub Header Has a Tab Limit — DETACH to Add More

**The Sub Header component supports a LIMITED number of tabs (typically 5).** If the wireframe shows MORE tabs than the component supports:

1. Import the Sub Header as normal
2. **DETACH it** (Sub Header is on the detach whitelist — but ONLY for adding tabs, not for restyling)
3. Find the existing tab instances inside the detached frame
4. **Duplicate** the last tab instance to create additional tabs
5. Update the text on each duplicated tab
6. Ensure ALL tabs from the wireframe are present — NEVER drop tabs to fit the component limit

**The component is a starting point, not a ceiling.** If a wireframe shows 7 tabs and the component only holds 5, you MUST add the remaining 2 by detaching. NEVER silently drop features.

**CRITICAL:** Count the tabs in the wireframe BEFORE building. Compare to what the component supports. Plan the detach in advance.

---

## CTA Hierarchy — ONE Primary Per PAGE (THE #1 BUTTON MISTAKE)

**AT MOST ONE Fill (primary) button on the entire visible page.** Not per action group — per PAGE. 99.9% of screens have exactly ONE primary action. Two primary buttons on the same screen is almost always wrong.

### The Rule

| Button count on page | Pattern |
|---------------------|---------|
| 1 action | Fill (primary) |
| 2 actions | Fill (primary) + Outline (secondary) |
| 3 actions | Fill (primary) + Outline (secondary) + Ghost (tertiary) |
| 4+ actions | Fill (primary) + Outline (secondary) + Ghost (tertiary) + overflow menu for the rest |

### How to Decide Which Action is Primary

Pick the ONE action across the ENTIRE screen that is:
- The most common user action on this screen
- The action with the most consequence (create, submit, save)
- The action the user came to this page to do

Everything else is secondary (Outline) or tertiary (Ghost). If there are buttons in the Container Header AND in a card section AND in a footer — still only ONE Fill total across all of them.

### The 0.1% Exception

Two Fill buttons are acceptable ONLY when two actions are truly equal in importance AND the user must choose between them (e.g., Accept vs Reject on an approval page). This requires **explicit justification** in the build summary — never a silent decision.

### Common Mistakes

| Screen type | WRONG | CORRECT |
|-------------|-------|---------|
| Query editor | Save Query (Fill) + History (Fill) + Run (Fill) + Export (Fill) — 4 primaries | Run (Fill) + Save Query (Outline) + History (Ghost) + Export (Ghost) |
| Backup list | Restore (Fill) + Create Backup (Fill) — 2 primaries | Create Backup (Fill) + Restore (Outline) |
| Settings page | Save (Fill) + Reset (Fill) — 2 primaries | Save (Fill) + Reset (Ghost) |
| User list | Add User (Fill) + Import (Fill) — 2 primaries | Add User (Fill) + Import (Outline) |
| Detail page with tabs | "Add Replica" (Fill) in section + "Create Backup" (Fill) in another section | Only the section visible on the active tab gets the Fill; other tab's button is Outline if visible |

**Self-check:** After building, screenshot the full screen. Count every Fill button visible. If the count is > 1 → demote the less important ones. No exceptions without explicit justification.

---

## Empty State Button Labels — NEVER Duplicate

**When an empty state has two buttons (primary Fill + secondary Outline), they MUST have DIFFERENT labels and different actions.**

### The Rule

The primary button = the main action to resolve the empty state.
The secondary button = an alternative or less common path.

**WRONG:** "Create Item" (Outline) + "Create Item" (Fill) — identical labels, confusing.

**CORRECT examples:**
| Empty state | Primary (Fill) | Secondary (Outline) |
|-------------|---------------|---------------------|
| No backups | Create Backup | Enable Auto-Backup |
| No users | Add User | Import Users |
| No projects | Create Project | Browse Templates |
| No connections | Add Connection | Learn More |
| No data | Upload Data | Connect Source |

**If there is genuinely only ONE action**, use the Empty State component with `Show Outline Button = false`. Don't invent a second button with the same label.

**ALSO:** The Empty State component (key `03321dc06395aa6b94783d0289637de8ddc82de0`) has boolean properties: Show Illustration, Show Heading, Show Description, Show Primary Button, Show Outline Button. Use them — don't manually build empty states.

---

## Tabs vs Sidebar Nav vs Accordion

**Tabs:** 2-7 peer sections, frequent switching, one viewed at a time, short labels.

**Sidebar Nav:** 8+ sections, grouped into categories, dedicated settings/config area.

**Accordion:** Sections expanded independently (FAQ, grouped details), multiple visible simultaneously, varying content length.

**Default:** Tabs for 2-7. Sidebar Nav for 8+. Accordion for independently expandable.

### Accordion with Custom Detail Content

Detach to add real content inside open panels. Keep the shell styling (padding, gaps, colors, radius).

**Three content shapes:**
1. **Table with mini action bar** — Search + action link, then Table below (Stretch pattern scoped to accordion)
2. **Single editable value** — description + "Edit" link + bordered/monospace box
3. **Key Value Pair rows** — sub-heading + "Edit" link + stacked label:value rows

---

## Inline Edit vs Detail Page vs Modal Edit

**Inline Edit:** 1-2 fields, quick, stays in context. Field visible in table row/card.

**Detail Page:** Full record with many fields, sub-sections, tabs. URL-based navigation useful.

**Modal Edit:** 3-6 fields as logical group. User sees list behind for context. Secondary action.

**Default:** Inline for 1-2. Modal for 3-6. Detail Page for complex records.

---

## Breadcrumbs: When to Show vs Hide

**Show:** 3+ navigation levels, hierarchical (folders, categories), reached via drill-down.

**Hide:** Top-level views, 1-2 levels (back button suffices), linear flows (wizards), overlays.

---

## Single Column vs Two Column vs Three Column

**Single Column:** Form or linear reading flow, wizard, focused task. Max ~720px content width.

**Two Column:** Primary + sidebar (detail + properties, list + preview), master-detail, settings with sidebar nav. Split: 2/3 + 1/3 or 3/4 + 1/4.

**Three Column:** Communication tools (sidebar + list + detail), high density desktop-only.

**Default:** Single for forms. Two for content + sidebar. Three only for communication/productivity apps.

---

## Cards Grid vs Table for Listings

**Cards Grid:** Items have visual element, 2-4 attributes, browsable, reflows across breakpoints.

**Table:** 5+ attributes, sorting/filtering by columns, data dense and uniform.

---

## Sidebar Layout vs Tab Layout for Settings

**Sidebar:** 6+ categories, grouped into sections, frequently navigated.

**Tab:** 2-5 flat categories, occasionally accessed.

---

## Inline Action vs Toolbar vs Context Menu

**Inline:** 1-3 primary actions per item, frequently used, one-click access.

**Toolbar:** Actions apply to selected items (bulk). 3-5 uniform actions. Contextual toolbar.

**Context Menu:** 4+ actions per item, secondary/infrequent, varies by item type.

**Default:** Inline for 1-3 frequent. Context menu (three-dot) for 4+. Toolbar for bulk/multi-select.

### Building Overflow (Three-Dot) Menu

1. Import **Icon Button**, swap icon to three-dot/overflow via "Change Icon" property
2. Import **Dropdown Menu** (key `ba5cf29d43170458cbdf49ea186e6ff6e50579e0`)
3. Detach Dropdown Menu to set real items — keep shell styling
4. Every menu item gets correct semantic icon (edit→pencil, delete→trash)
5. Position menu absolutely when inside auto-layout (`layoutPositioning = "ABSOLUTE"`)
6. Trigger state = **Pressed** while menu is open

---

## Confirmation Dialog vs Inline Confirm vs Toast

**Confirmation Dialog:** Destructive/irreversible (delete permanently). Significant consequences. Name the specific item.

**Inline Confirm:** Mildly risky but reversible (archive). Quick "Are you sure?" replaces button.

**Toast:** Action succeeded, needs acknowledgement. Easily reversible (with Undo link). No blocking.

**Default:** Dialog for destructive. Toast with Undo for reversible. Inline for moderate-risk.

---

## Single CTA vs Split Button vs Button Group

**Single CTA:** One clear primary action (Save, Submit, Create). Secondary actions use plain buttons.

**Split Button:** One primary with variations (Save & Close, Save & New). Primary most used, alternatives via dropdown.

**Button Group:** 2-4 distinct peer actions of similar importance (Approve, Reject, Defer).

**Default:** Single CTA for forms. Split for action variants. Button Group for peer-level actions.

---

## Control scope — page-level vs section-level

**The question to ask before placing ANY Search, filter, tab or button:**
*what exactly does this act on?* If you cannot name the dataset or destination,
the control is in the wrong place — or should not exist.

### Count the datasets in the Container

| Container holds | Where controls go |
|---|---|
| **ONE dataset** (a single list/table page) | Container Header is the action bar: Search + filters left, Export/Create right. The classic list page |
| **MULTIPLE sections** (two tables, table + chart, card grid + list) | Container Header carries only **page-level** things: heading, page-wide filters (e.g. a time range), page-level actions. Each section owns its own controls in its **section header** |

### Why this matters

A Search placed in the Container Header of a multi-section page **looks like it
filters everything below it**. It usually doesn't — it filters one of them, or
nothing. This is invisible in a static mock: a search box renders identically
whether it filters one table, both, or nothing at all. No amount of screenshot
review catches it. Only asking "what does this act on?" does.

This has shipped: a dashboard with *Top Endpoints* and *Recent Errors* side by
side had a single "Search endpoints…" in the page action bar. Its label scoped it
to endpoints; its placement implied it governed both. The fix was placement, not
deletion — move it into the *Top Endpoints* section header.

### Section header anatomy

A section header is a horizontal auto-layout, `SPACE_BETWEEN`:

```
[ Section heading ]                    [ section controls: Search / filter / View All ]
```

- Heading on the left — **`Headlines/H5` (18px Semi Bold) minimum** when the section
  contains a Table AI, whose own header row is 12px Semi Bold. A 14px heading over a
  12px table header is not a hierarchy
- Controls on the right, scoped to that section only
- Use the **same** heading style for every section on the page. Two sections with
  different heading treatments is a defect

### Time-range filters are the common exception

A period selector ("Last 24 hours") legitimately belongs at page level on a
dashboard, because it genuinely re-scopes every section. Page-level filters are
fine when they really are page-wide — the test is the same: name what it acts on.

---

## Bulk Actions — Contextual, Not Permanent

### The Catalyst Production Pattern

Tables with checkboxes support row selection. Bulk action buttons appear **only after rows are selected** — they replace the **table header row**, not the Container Header action bar above.

The Container Header (with Search, filters, Create/Upload) stays visible throughout — it is unaffected by selection.

### Three States to Design (each as a separate Figma frame)

**State 1 — No rows selected (default):**
```
Container Header: Search + filters + Create/Upload (normal)
Table:
├── Header Row: [☐] Object Name | Modified Time | Size
├── Row 1: [☐] api-gateway.html | Aug 24 | 124 KB
├── Row 2: [☐] catalyst.json | Aug 24 | 151 bytes
└── ...
```
No bulk actions visible. Checkboxes are present but unchecked.

**State 2 — Single row selected:**
```
Container Header: Search + filters + Create/Upload (unchanged)
Table:
├── Bulk Action Bar (replaces header row):
│   [▪] Selected : 1  ↗Move  📋Copy To  ✏Rename  🔗Copy URL  ⬇Download  🗑Delete  ‹
├── Row 1: [☑] api-gateway.html | Aug 24 | 124 KB  ← selected row highlighted
├── Row 2: [☐] catalyst.json | Aug 24 | 151 bytes
└── ...
```
Full set of single-item actions: Move, Copy To, Rename, Copy Object URL, Download, Delete. Each action is icon + text label (Ghost-style buttons). A collapse chevron (‹) on the right to dismiss the bar.

**State 3 — Multiple rows selected:**
```
Container Header: Search + filters + Create/Upload (unchanged)
Table:
├── Bulk Action Bar (replaces header row):
│   [▪] Selected : 2  🗑Delete  ‹
├── Row 1: [☑] api-gateway.html | ...  ← selected
├── Row 2: [☑] catalyst-debug.log | ...  ← selected
├── Row 3: [☐] catalyst.json | ...
└── ...
```
**Action set NARROWS for multi-select** — only actions that work on multiple items survive (Delete, Move). Actions like Rename (single-item only) disappear.

### Decision Questions

| Question | Answer → Action |
|----------|----------------|
| Does the table have a checkbox column? | NO → no bulk actions; actions live in three-dot per row or Container Header |
| Single-select: what actions apply? | Full set: Move, Copy, Rename, Download, Delete, etc. |
| Multi-select: which actions survive? | Only batch-capable: Delete, Move, Export. Drop single-item: Rename, Copy URL |
| Is Export page-level or row-level? | Page-level (exports all) → stays in Container Header permanently. Row-level → in bulk bar |

### Figma Build Approach

Build **three separate Figma frames** on the same page:
1. **Default state** — all checkboxes unchecked, normal table header visible
2. **Single-select state** — 1 row checked + highlighted, bulk bar replaces table header
3. **Multi-select state** — 2+ rows checked + highlighted, narrower bulk bar

For the bulk action bar:
- It sits in the **table header row position**, same width as the table
- Background: subtle brand/selection tint (or use the table header background variable)
- Left side: indeterminate checkbox (▪) + "Selected : N" count in `Body/Subtitle 2` (14px Semi Bold)
- Actions: icon + text label pairs, Ghost-style (no button chrome), regular spacing
- Delete: Danger color (red text + icon)
- Right side: collapse chevron (‹) to deselect all / dismiss the bar
- Selected rows get a subtle highlight background (selection row highlight variable)

### Common Mistakes

| Wrong | Right |
|-------|-------|
| Bulk bar replaces Container Header | Bulk bar replaces TABLE HEADER ROW; Container Header stays |
| Same actions for single and multi-select | Multi-select narrows to batch-only actions |
| Delete as a prominent Fill button | Delete as icon+text Ghost with Danger color |
| No selection count shown | Always show "Selected : N" with indeterminate checkbox |
| Bulk actions permanently visible in Container Header | Appear only after checkbox selection |
| Only one "selected" frame built | Build all three states: default, single-select, multi-select |

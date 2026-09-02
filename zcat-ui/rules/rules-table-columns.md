<!-- Copied from the zcat Figma project's reference set so the rules travel
     with this clone. These are DESIGN decisions and apply in both modes;
     where a file mentions Figma mechanics (component keys, auto-layout,
     setProperties), take the decision and ignore the mechanism — none of
     it exists in code. Source of truth is the Figma project; re-copy if
     they diverge. -->

# Table AI Configuration

## Table AI Variant: Stretch vs Boxy

**ALWAYS use Table AI** (key `f3a77aaa2d8b332d2c86a9cb77ed6a4f92305c07`), NEVER legacy Table. Zero-detach — configure via `setProperties()`.

**Stretch:** Container's content is a list page (action bar + table, nothing else). The table IS the whole point — fills edge to edge with no side padding.

**Boxy:** Page has multiple sections besides the table — detail view with info card, stats, and table of related records. Table has padding/spacing on all 4 sides.

**Default:** Stretch for single-context list pages. Boxy for detail/multi-section pages.

### Table Inside Popup — ALWAYS Boxy

**Tables inside popups MUST use Boxy style.** A popup body contains multiple elements (title, description, chips, table, footer) — the table is ONE section among many, surrounded by padding on all sides. This is exactly what Boxy is for.

**NEVER use Stretch inside a popup** — Stretch removes side padding and goes edge-to-edge, which breaks the popup's internal spacing.

### Table Style Decision

| Context | Style | Why |
|---------|-------|-----|
| List page (table is the main content) | **Stretch** | Table fills the entire container edge-to-edge |
| Detail page (table + stat cards + info sections) | **Boxy** | Table is one section among many |
| Popup/dialog (table inside a modal) | **Boxy** | Table has padding, surrounded by other content |
| Accordion panel (table inside expandable) | **Boxy** | Table is nested content |
| Side panel / drawer | **Boxy** | Table is one section in constrained space |

**CRITICAL: Table AI MUST be responsive** — `layoutSizingHorizontal = "FILL"`. A non-stretching table is a broken layout.

---

## ROOT CAUSE: Table AI Default Column Types Are WRONG for Your Data

**Table AI ships with DEFAULT column types: Column 1 = AvatarName, Column 2 = Badge.** If you import Table AI and DON'T swap the column types, EVERY table will have:
- Column 1: person avatar + 2 text lines (even on rule names, database names, API keys)
- Column 2: blue badge pills (even on identifiers, events, api_names)

**This is why EVERY table the agent builds looks identical.** The agent imports Table AI, fills in text, and ships the DEFAULTS.

### THE FIX: You MUST Swap Column Types for EVERY Column

After importing Table AI, you MUST:
1. Decide the correct column type for EACH column based on its DATA
2. Import the correct column type component
3. Swap each column using instance swap (`Col 1`, `Col 2`, etc.)
4. NEVER leave the default AvatarName/Badge if the data doesn't match

**If you find yourself with AvatarName on column 1 and Badge on column 2, you probably forgot to swap columns.**

---

## Column Order is FLEXIBLE — Match Data, Not Defaults

**Table AI column positions (Col 1, Col 2, Col 3…) can hold ANY column type.** You are NOT locked into AvatarName on Col 1 or Badge on Col 2. Swap column types into ANY position via instance swap to match the wireframe and data requirements:

- Badge can be Col 3 or Col 5 — put it where status appears in the wireframe
- Name/entity can be Col 1 or Col 4 — put it where the wireframe shows it
- IconText can be Col 1 for entity-first tables, or Col 2 after a checkbox

**All column reordering is done via instance swap on `Col 1` through `Col 8` — NEVER detach Table AI to rearrange columns.**

---

## Entity Columns MUST Use IconText — NOT AvatarName, NOT Badge

**For non-person entities (databases, functions, services, APIs, files), ALWAYS use the IconText column type.** IconText renders an icon + text — exactly right for entity data that has a natural icon representation.

**NEVER use AvatarName for entities** — AvatarName renders a person's avatar photo. Databases, functions, and APIs are not people and should not have face photos next to them.

**NEVER use Badge for entity names** — Badge is for status/category values only. Entity names like "orders-prod" or "cache-redis" are identifiers, not statuses.

| Entity data | WRONG column type | CORRECT column type |
|-------------|-------------------|---------------------|
| "orders-prod" (database) | AvatarName (face photo) | **IconText** (database icon) |
| "cache-redis" (cache) | AvatarName (face photo) | **IconText** (database icon) |
| "processOrder" (function) | AvatarName or Badge | **IconText** (function icon) |
| "user-auth-service" (API) | AvatarName or Badge | **IconText** (API icon) |
| "report-2024.pdf" (file) | AvatarName | **IconText** (file icon) |

---

## Column Type Decision — Ask These Questions for EVERY Column

### Question 1: "Would a PERSON'S FACE make sense next to this data?"

| Data | Person's face? | Type |
|------|---------------|------|
| "John Smith" (user name) | YES — it's a person | **AvatarName** |
| "Notify Internal" (rule name) | NO — rules don't have faces | **Text** |
| "orders-prod" (database name) | NO — databases don't have faces | **IconText** |
| "CRMCustomModPub1" (publisher ID) | NO — system identifiers don't have faces | **Text** |
| "INV-1042" (invoice number) | NO — numbers don't have faces | **Text** |

**If NO → do NOT use AvatarName.** Use Text or IconText.

### Question 2: "Does this column have a FINITE SET of values (< 10) where each value means something DIFFERENT?"

| Data | Finite meaningful set? | Type |
|------|----------------------|------|
| "Active", "Inactive", "Pending" (status) | YES — 3 values, each means something | **Badge** with semantic colors |
| "Custom Module" (same value in every row) | NO — same value everywhere = zero info | **Text** (Badge adds nothing when all values are identical) |
| "CustomModule1_approved" (event identifier) | NO — these are unique identifiers, not categories | **Text** |
| "$1,240.00" (amount) | NO — open-ended numeric values | **Text** |
| "2026-08-10" (date) | NO — unique per row | **Date** |
| "us-east-1" (region) | MAYBE — if 3-5 regions, could be Badge; if many, use Text | **Text** or **Badge** depending on count |

**If NO → do NOT use Badge.** Use Text or the appropriate type.

### Question 3: "When ALL values in a column are the SAME, should I use Badge?"

**NO.** If every row shows "Custom Module" in a blue pill, Badge adds ZERO information — it's visual noise. When a column has only one distinct value across all rows, use **Text**. Badge is for columns where values VARY and each variation carries semantic meaning.

### Question 4: "Does this non-person entity need an icon?"

| Entity type | Has a natural icon? | Type |
|-------------|-------------------|------|
| Database/table | YES (database icon) | **IconText** |
| Function/service | YES (function/code icon) | **IconText** |
| File/document | YES (file type icon) | **IconText** |
| Rule/config name | NO (rules are abstract) | **Text** |
| Publisher ID | NO (system identifier) | **Text** |
| API key name | NO (string identifier) | **Text** |

---

## Two-Line Cells: When Line 2 is WRONG

AvatarName forces 2 text lines on every cell. This is WRONG when:

| Line 2 content | Problem | Fix |
|----------------|---------|-----|
| SAME as line 1 ("Notify Internal" / "Notify Internal") | Duplicate text, looks broken | Change to **Text** (1 line) |
| Data from another column ("CRMCustomModPub1" / "Redis 7.2") | Cross-column data leak | Change to **Text** |
| Meaningless filler | Wasted space | Change to **Text** |
| Empty/blank | Wasted row height | Change to **Text** |

**Line 2 is CORRECT only when:**
- Person name + their email/role ("John Smith" / "john@company.com") — ONLY with AvatarName

**In Catalyst, one line per cell is the default.** If a wireframe shows two pieces of information stacked in a single cell (e.g., database name + engine type), ALWAYS split them into TWO SEPARATE COLUMNS instead of cramming both into one cell. Two-line cells are allowed ONLY for person name + email/role (AvatarName) and description text with "View More" truncation — nothing else. Do NOT use two-line format for entity names — "orders-prod" does NOT need "Aurora MySQL 3.0" as a subtitle in the same cell. Put engine type in its own column.

**If you see an avatar photo next to a non-person item (database name, function name, rule name), the column type is WRONG.** Avatars are faces — databases don't have faces. Switch to Text or IconText.

### Maximum Lines Per Cell — STRICT LIMIT

**NO table cell should have more than 2 lines of text.** Three-line or multi-line cells break table row height consistency and make the table look messy.

| Cell type | Max lines | Rule |
|-----------|-----------|------|
| Name/ID/label | **1 line** | Single-line Text — the default |
| Person name + email/role | **2 lines** | AvatarName ONLY — rare in Catalyst |
| Description/long text | **2 lines + "View More"** | Truncate to 2 lines, show "View More" link. Clicking expands to show full content |
| Status/badge | **1 line** | Badge pill is always single-line |
| Date | **1 line** | Formatted date is always single-line |

**Description columns with long content:** Truncate at 2 lines with text overflow ellipsis. Add a "View More" text link (`BRANDING ICON/Icon Color/Blue`) that expands the cell to show the full description. By default, only 2 lines are visible — the rest is hidden until the user clicks "View More".

**NEVER allow 3+ lines in any table cell.** If a cell needs more than 2 lines, it needs truncation + expand, not more row height.

---

## Complete Column Type Reference

| Data kind | Column Type | Renders as | When to use |
|-----------|-------------|------------|-------------|
| **Person** (user, owner, assignee, contact) | **AvatarName** | Avatar circle + name + subtitle | ONLY for human beings |
| **Entity with icon** (database, function, file, service) | **IconText** | Icon + text | Non-person items that have a natural icon |
| **Plain text** (name, label, ID, code, amount, region, publisher, event, target) | **Text** | Single-line text | DEFAULT for most columns — when in doubt, use Text |
| **Status/category** (finite set, < 10 values, each value has semantic meaning, values VARY across rows) | **Badge** | Colored pill | ONLY when values vary AND each value means something different |
| **Date/timestamp** | **Date** | Formatted date | Any date or time value |
| **Operational state** (running, stopped, deploying) | **ExecutionStatus** | Colored dot + text | Live system state |
| **Row actions** | **Threedot** | Three-dot overflow menu | Actions per row |
| **Row selection** | **Checkbox** | Checkbox | Bulk selection |

---

## Badge Type in Tables — ALWAYS Secondary

**In table cells, ALWAYS use Badge Type="Secondary" (subtle/muted).** Type="Primary" creates bold filled pills that are too visually heavy for table rows — they compete with the data instead of supporting it.

- **Tables:** Type="Secondary", Style="Subtle" — ALWAYS
- **Outside tables (hero stats, standalone alerts, callouts):** Type="Primary" is acceptable but still RARE — use only for strong emphasis

If every badge in a table looks like a bold colored pill, you're using Primary — switch to Secondary.

---

## Badge Color Rules — MANDATORY Semantic Mapping

**Badges MUST use different colors based on meaning. All badges the same color = broken design.**

| Status meaning | Badge Color | Examples |
|---------------|-------------|----------|
| Success / active / paid / available / enabled / completed / live | **Green** | "Paid", "Active", "Available", "Completed", "Live", "Enabled" |
| Error / failed / overdue / critical / deleted / expired | **Red** | "Failed", "Overdue", "Critical", "Expired", "Deleted", "Error" |
| Warning / pending / modifying / expiring / degraded | **Amber/Yellow** | "Pending", "Warning", "Modifying", "Expiring Soon", "Degraded" |
| Info / processing / in progress / provisioning / draft | **Blue** | "Processing", "In Progress", "Provisioning", "Draft", "Queued" |
| Neutral / unknown / N/A / archived / inactive | **Grey** | "Archived", "Inactive", "N/A", "Unknown", "Paused" |

**NEVER use the same badge color for ALL rows.** If a table has "Active" on every row, they're ALL green — that's fine (same status = same color). But if a column has "Paid", "Pending", AND "Overdue", each gets its OWN color.

**When ALL values in a Badge column are identical** (e.g., every row says "Active"), consider whether Badge is even needed — if every row has the same status, that status is not distinguishing information and might be better as plain Text, or filtered out entirely.

---

## Table Variety — Every Table MUST Look Different

**The test: show 5 tables side by side — can you tell them apart instantly?**

### CORRECT: Each table matches its data

| Page | Col 1 | Col 2 | Col 3 | Col 4 | Col 5 |
|------|-------|-------|-------|-------|-------|
| Users | AvatarName (person) | Text (role) | Date (joined) | Badge (status) | Threedot |
| Rules | Text (rule name) | Text (event) | Text (publisher) | Text (target) | Threedot |
| Invoices | Text (invoice #) | AvatarName (customer) | Text (amount) | Badge (status) | Threedot |
| Databases | IconText (db name) | Text (engine) | Text (size) | Badge (status) | Threedot |
| Publishers | Text (publisher name) | Text (type) | Badge (status) | — | Threedot |

### WRONG: Every table looks identical (DEFAULT COLUMN TYPES not swapped)

| Page | Col 1 | Col 2 | Col 3 | Col 4 | Col 5 |
|------|-------|-------|-------|-------|-------|
| Users | AvatarName | Badge | Text | Text | Threedot |
| Rules | AvatarName | Badge | Text | Text | Threedot |
| Invoices | AvatarName | Badge | Text | Text | Threedot |
| Databases | AvatarName | Badge | Text | Text | Threedot |
| Publishers | AvatarName | Badge | Text | Text | Threedot |

**If your tables all look like the WRONG example, you forgot to swap column types from the defaults.**

---

## Header-Column Match — MANDATORY Verification

**Every column header MUST match the data in its cells.** If the header says "Rule Name", every cell in that column MUST contain a rule name — not an avatar, not a subtitle, not data from another column.

**Common mismatches to catch:**
| Header | Wrong cell content | Fix |
|--------|-------------------|-----|
| "Rule Name" | AvatarName with photo + name + subtitle | Swap to Text — rules don't have faces or subtitles |
| "Database" | AvatarName with random avatar photo | Swap to IconText (database icon) or Text |
| "Amount" | Badge pill instead of number | Swap to Text — amounts are not statuses |
| "Created Date" | Text showing a name | Data is in the wrong column — fix the text mapping |
| Any header | Cell shows data from a different column | Text updates were applied to wrong nodes — remap |

**If a column has unwanted elements (avatars on non-person data, two-line format where single line is enough, badge on non-status data), rework it:**
1. Swap the column type to match the data
2. Update text content to show only what the header describes
3. Remove/hide subtitle lines if they add no value
4. Screenshot and re-verify the column reads correctly top to bottom

---

## Self-Check After Building Any Table

Run through EVERY column and verify:

1. **Column 1 is AvatarName?** → Is this column about a PERSON? Would a face icon make sense? If NO → swap to IconText (for entities with natural icons) or Text (for plain identifiers)
2. **Column 2 is Badge?** → Is this a STATUS column with varying semantic values? If NO → swap to Text
3. **Any column has Badge?** → Do the values VARY across rows? Does each value have a DIFFERENT meaning? Are the colors DIFFERENT per value? If all same color → fix colors or change to Text
4. **AvatarName has 2 text lines?** → Is line 2 different from line 1? Is it genuinely useful? In Catalyst, two-line cells are RARE — only person name + email/role. If the subtitle adds nothing, swap to single-line Text
5. **Status column exists but is plain Text?** → Swap to Badge (Type=Secondary) with semantic colors
6. **Data aligned correctly?** → Read each row left to right — does each cell match its column header? If ANY cell contains data that belongs in a different column, the text mapping is broken — fix it
7. **Badge Type?** → Must be Type=Secondary (subtle) in tables. If badges look like bold filled pills, switch from Primary to Secondary
8. **Column order matches wireframe?** → Column positions are flexible. Badge doesn't have to be Col 2. Reorder via instance swap to match the wireframe layout
9. **Any cell has 3+ lines?** → MAX 2 lines per cell. Descriptions get 2-line truncation + "View More" link. NEVER allow 3+ line cells
10. **Entity columns using AvatarName?** → Databases, functions, APIs, files MUST use IconText, NEVER AvatarName

---

## Table AI Properties

| Property | Values |
|----------|--------|
| `Style` | "Stretch" or "Boxy" |
| `Columns` | "3", "4", "5", "6", "7", "8" |
| `Show Checkbox` | boolean (default false) |
| `Show Threedot` | boolean (default true) |
| `Show Pagination` | boolean (default true) |
| `Col 1` through `Col 8` | instance swap (component node ID, NOT key) |

## Table AI Internal Structure — COLUMN-Based, NOT Row-Based

Table AI uses a **column-first** layout. Each column is a vertical stack containing a header cell and data cells:

```
Table AI (INSTANCE)
├── Col 1 (INSTANCE — e.g. AvatarName by default)
│   ├── Header cell (FRAME)
│   │   └── TEXT node ("Column 1")
│   ├── Data cell 1 (FRAME)
│   │   └── TEXT node ("Row 1 data")
│   ├── Data cell 2 (FRAME)
│   │   └── TEXT node ("Row 2 data")
│   ├── Data cell 3
│   ├── Data cell 4
│   └── Data cell 5
├── Col 2 (INSTANCE — e.g. Badge by default)
│   ├── Header cell
│   ├── Data cell 1
│   └── ...
├── Col 3, Col 4, ... (same pattern)
├── Checkbox column (optional, leftmost)
└── Threedot column (optional, rightmost)
```

### How to Update Text Content (NEVER DETACH)

1. **Find all TEXT nodes:** `const texts = table.findAll(n => n.type === 'TEXT')`
2. **Load fonts:** `for (const t of texts) await figma.loadFontAsync(t.fontName)`
3. **Navigate by column:** Each `Col N` instance contains cells top-to-bottom. First TEXT child = header, rest = data cells
4. **Set characters:** `textNode.characters = "New Value"`
5. **Hide unused rows:** Set `.visible = false` on data cell frames you don't need

### How to Clear Default Data

Table AI ships with dummy data ("orders-prod", "Aurora MySQL 3.0", "us-east-1", etc.). You MUST overwrite ALL text content with your actual data from sample-data.md. For unused rows, hide the entire data cell frame (not just clear the text).

```js
// Pattern: update all cells in a column
const col = table.findOne(n => n.name === 'Col 1');
const textNodes = col.findAll(n => n.type === 'TEXT');
// textNodes[0] = header, textNodes[1..N] = data cells
for (const t of textNodes) await figma.loadFontAsync(t.fontName);
textNodes[0].characters = "Rule Name";      // header
textNodes[1].characters = "Auto Archive";    // row 1
textNodes[2].characters = "Notify Assignee"; // row 2
// ... etc
```

## Structural Differences by Style

**Stretch:**
```
Container (VERTICAL, padding 16/0/0/0, itemSpacing 16)
├── Container Header (FIXED width, HUG height, padding 6/16/6/16 — L/R=16 because Container L/R=0)
├── Table AI (Stretch, FILL horizontal, FILL vertical, Show Pagination = false)
└── Pagination (FILL horizontal, FIXED vertical, padding 6/16/6/16)
```
Body frame: padding 14px all sides, itemSpacing 10.

**Boxy:**
```
Container (VERTICAL, padding 16/16/16/16, itemSpacing 16)
├── Container Header (FIXED width, HUG height, padding 6/0/6/0 — L/R=0 because Container L/R=16)
├── Cards / content
└── ...
```
Visual result: Container Header content is always 16px from card edge in both layouts.

**Cards view:** Container padding 16/0/16/0, itemSpacing 10.

**Empty state:** Container padding 0 all sides, itemSpacing 0.

---

## Filter Overflow: Inline vs Filter Icon

**Inline dropdowns:** 1-3 filters, each shown as dropdown next to Search.

**Filter icon + menu:** 4+ filters — collapse behind a single Filter icon button.

**Applied filters:** Show as removable **Chip** (key `521cb36aff97e00dc59f5c37b5f04a684b475930`) below action bar. Text "Label: Value", `Removable = true`. Add "Clear All" link when any filter is active.

**Alternate style — always-active chip bar:** For always-set query parameters (Log Type, Resources, Time Period). Same Chip component but `Removable = false`. Each chip clickable to change value, not remove.

**Pick by:** Optional filters → dropdown bar (Removable: true). Always-active query state → chip bar (Removable: false).

---

## Checkbox Column & Bulk Actions

### When to include a checkbox column

| Question | Answer |
|----------|--------|
| Can the user act on multiple rows at once? (Delete 5 items, Move 3 files) | YES → checkbox column |
| Are all row actions single-item only? (Edit, View Details, Rename) | YES → no checkbox, use three-dot menu |
| Is Export page-level (all data) or row-level (selected rows)? | Page-level → no checkbox needed. Row-level → checkbox |

### Checkbox column position

Always **column 1** (leftmost). The table header row shows a "select all" checkbox. Data rows show individual checkboxes.

### Bulk action bar placement

The bulk action bar **replaces the table header row** when rows are selected — it does NOT go in the Container Header action bar above. The Container Header (Search, filters, Create) stays visible and unchanged.

### Three selection states

Build each as a **separate Figma frame**:

1. **Default** — checkboxes unchecked, normal table header row visible
2. **Single-select** — 1 row checked, bulk bar replaces header: "Selected : 1" + full single-item actions (Move, Copy To, Rename, Download, Delete) + collapse chevron
3. **Multi-select** — 2+ rows checked, bulk bar narrows: "Selected : N" + batch-only actions (Delete, Move). Single-item actions (Rename, Copy URL) disappear

### Bulk bar anatomy

```
[▪ indeterminate checkbox] "Selected : N"  [action icon+text] [action icon+text] ... [‹ collapse]
```
- Actions are icon + text label pairs, Ghost-style (no button chrome)
- Delete uses Danger color (red text + icon)
- Collapse chevron on the right dismisses the bar / deselects all
- Selected rows get a subtle highlight background

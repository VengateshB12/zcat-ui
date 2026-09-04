<!-- Shipped with the library so the rules travel with the clone.
     Source of truth is the zcat Figma project; re-copy if they diverge.
     These are DESIGN decisions and apply in both modes. Where a file
     mentions Figma mechanics (component keys, auto-layout,
     setProperties), take the decision and ignore the mechanism —
     none of it exists in code. -->

# Detail Page & Master-Detail Rules

## Building a Master-Detail Layout — Use Layout `Container left Menu`

**ALWAYS use the Layout component's `Container left Menu = true` boolean property** for master-detail layouts. This activates the built-in **Container Side Menu** component inside the Container — NEVER manually build a side panel from frames.

### How to Build

1. Import the Layout component_set (key `c321d468b0231e052b921026407ff896bdf2c55e`)
2. Set `Container left Menu = true` **BEFORE detaching** (boolean toggles don't work after detach)
3. Also set other needed booleans (`Show Sub Header`, etc.) before detaching
4. Detach the Layout instance
5. Find the **Container Side Menu** child inside the Container
6. Customize its content: update item text, swap icons, set selected state on the active item

### Container Side Menu Properties

| Property | Type | Purpose |
|----------|------|---------|
| Show Header | boolean | Title row (heading text + primary button) |
| Show Search | boolean | Search field below header |
| Show Headings | boolean | Section group headings |
| Show Section 1 | boolean | First collapsible item group |
| Show Section 2 | boolean | Second collapsible item group |
| Show Section 3 | boolean | Third collapsible item group |

Menu items use the **_Menu Item** child component with states: Default, Hover, Selected, Disabled. Boolean properties: Show Icon (left icon), Show Arrow (right expand arrow).

### Structure After Detach

```
Container (HORIZONTAL auto-layout)
├── Container Side Menu (300px fixed width, right border)
│   ├── Header: "Tables List" + [+ Create] button
│   ├── Search (scoped to list items only)
│   └── Menu List: _Menu Item instances (icon + label, selected state)
├── Divider (vertical, FILL height) — built into the Layout variant
└── Detail Panel (FILL width, 16px padding)
    └── Selected item's content
```

### Search Scope in Master-Detail

**The list panel search searches the LIST items ONLY.** It does NOT search the detail panel content. This is because the list panel is a navigation selector — the search helps users find an item in the list to select.

If the detail panel also needs its own search (e.g., searching within columns of a selected table, searching inside a code editor), add a **separate scoped search** inside the detail panel. Each search must clearly indicate what it acts on.

| Search location | What it searches | Example |
|----------------|------------------|---------|
| List panel search | List items (table names, function names, API endpoints) | "Search tables..." |
| Detail panel search | Content of the selected item | "Search columns..." |
| Neither | If neither panel needs search, don't add one just for balance | — |

### Layout Rules

- **Container Side Menu width:** 300px fixed — do NOT resize unless content requires it
- **Divider is built in** — the Layout variant includes the vertical separator between panels
- **Detail panel:** FILL width (~16px padding), shows selected item's content
- **Primary tabs are scope-relative:** Page-level tabs go in Sub Header. Detail view tabs (e.g., "Schema View | Data View") are primary tabs built inside the detail panel
- **Stretch vs Boxy still applies** — scoped to the detail panel's content
- **Extends to three panels** when there's a separate output area (e.g., API tester: endpoints → config → Code Editor response). Build the third panel as a manual FILL frame after the detail panel
- **No checkboxes** in the list panel — this is single-select navigation, not multi-select

### Customizing _Menu Item Content

**Default _Menu Item is single-line:** icon + label text. This covers most cases (table names, function names, API endpoints).

**Two-line menu items** (name + subtitle, e.g., "users_table" + "PostgreSQL · 24 columns"): if the content genuinely needs a second line, you CAN detach the Container Side Menu and customize the item layout. But **mostly avoid detaching** — single-line items are cleaner and scan faster.

| Need | Approach |
|------|----------|
| Single-line items (name only) | Use _Menu Item as-is — icon + label, no detach needed |
| Two-line items (name + subtitle) | Detach Container Side Menu, duplicate _Menu Item frames, add a second text line (12px Secondary) below each label. Keep the shell: 300px width, right border, 16px padding, 4px item gap, selected state highlight |
| Grouped sections with headings | Use Show Headings + Show Section 1/2/3 booleans — no detach needed |
| More items than sections support | Detach and duplicate section groups. Keep heading style + item style consistent |

**When detaching Container Side Menu:**
1. Maintain the 300px width, 16px padding, right border, and background variable
2. Keep the selected item highlight (`cards-bg-selected-primary` background + brand-color text)
3. Keep the 4px gap between items, 36px item height, 12px horizontal padding inside items
4. Keep icon + text alignment (8px gap between icon and label)
5. Do NOT restyle the shell — only add or modify content inside items

### Common Mistakes

| Wrong | Right |
|-------|-------|
| Manually building a side panel with frames | Use Layout `Container left Menu = true` |
| Setting `Container left Menu` after detaching | Set ALL booleans BEFORE detaching Layout |
| List panel search that implies it searches everything | Label clearly: "Search tables…", not just "Search" |
| Using Nav Button for list items | Use the built-in _Menu Item with icon/arrow/state |
| Missing selected state on active list item | Set exactly ONE _Menu Item to Selected state |
| Missing divider between panels | Divider is built into the variant — verify it's visible after detach |
| Detaching Container Side Menu for simple single-line items | Use _Menu Item as-is — detach only when two-line or extra content is genuinely needed |

---

## Empty State Pages

**ALWAYS use the Empty State component** (key `03321dc06395aa6b94783d0289637de8ddc82de0`, type `component`). NEVER manually build empty state UI.

**Properties:**
| Property | Default | Purpose |
|----------|---------|---------|
| Show Illustration | true | Illustration at top |
| Show Heading | true | Title (e.g. "No Database Yet") |
| Show Description | true | Subtitle text |
| Show Primary Button | true | Fill CTA button |
| Show Outline Button | true | Secondary button |

**Rules:**
1. **NO Container Header** — nothing to search/filter
2. **NO duplicate CTAs** — if empty state has "Create X", don't also put it in Sub Header
3. **Sub Header stays simple** — title + Help only (instance, not detached)
4. **Container padding = 0**, `itemSpacing = 0`

**Structure:**
```
Sub Header (INSTANCE — title + Help only, NO buttons)
Body (padding 14px)
└── Container (padding 0/0/0/0, itemSpacing 0)
    └── Empty State Area (FRAME, FILL both, center both axes)
        └── Empty State (INSTANCE — component key 03321dc0...)
```

---

## Inline Empty State (section-level)

When a section within a page has no data (but the page itself is NOT empty):
- Small illustration centered in the section
- Simple text: "No Event in progress"
- NO buttons, NO CTA
- Section still has its heading with action (e.g., "Refresh")

Use full Empty State component only for WHOLE-PAGE empty states. For individual sections, use simple centered illustration + text.

---

## Detail & Settings Pages — Read-Only View, Edit in Popup

This is a **common Catalyst pattern**, not specific to any one screen. ANY page that shows configuration, connection details, resource specifications, metadata, or current settings is a **read-only detail view**. The user sees current values, then clicks Edit to change them in a popup.

This applies to: Settings tabs, Overview tabs showing config, Connection Details pages, Resource Configuration pages, any page showing "current state" of something the user can change.

### What goes on the page (read-only display)
- **General Details** or **Key-Value pairs** showing current values (read-only text, not inputs)
- **Stat cards** showing numeric summaries (storage used, connections, compute specs)
- **Toggles** ONLY for instant-apply on/off flags (feature toggles, enable/disable) — NOT for config that needs Save
- **Section headings** grouping related information (Configuration, Credentials, Danger Zone)
- **Edit button** per section (top-right of each card, or in Container Header)

### What does NOT go on the page (inputs belong in popup)
- **Text Box, Dropdown, or any editable input** — these belong in the Edit popup, never on the page
- **Sliders, pickers, steppers for changing values** — show the current value as read-only text, edit via popup
- **Direct compute/storage/scaling controls** — show "2 vCPU / 8 GB" as text, not as a picker
- **Multiple primary (Fill) buttons** — one Edit button per section maximum; only ONE primary on the entire page

### Danger Zone pattern
Destructive actions (Delete database, Reset config, Revoke access) go in a clearly separated section at the **bottom** of the settings page:
- Section heading: "Danger Zone" or similar warning label
- Attention Box (Color=Danger) explaining the consequence
- Single destructive button: Outline variant with Danger color, NOT a Fill primary button
- OR: place the destructive action behind a three-dot overflow menu if it's rarely used

**NEVER** show a "Delete" button as a standalone primary action alongside configuration settings.

### Edit popup structure
```
Popup (Type: Default or With Scroll)
├── Header: "Edit [Section Name]"
├── Body: editable fields matching the read-only values on the page
└── Footer: Cancel (Outline) + Save (Fill)
```

---

## Tab Content Scope

Each tab on a detail page shows ONLY content that belongs to that tab's topic.

| Tab | Shows | Does NOT show |
|-----|-------|---------------|
| Overview | Summary stats, quick info, recent activity | Full backup list, replica management |
| Backups | Backup list, backup config, restore options | Replica table, monitoring charts |
| Replicas | Replica list, replication stats, add replica | Backup info, settings toggles |
| Settings | Read-only config, edit buttons, danger zone | Tables of data, monitoring, backups |
| Monitoring | Charts, metrics, alert config | Backup list, replica management |

**If a wireframe groups unrelated sections under one tab (e.g., "Backups & Replicas" showing both), check whether the production UI has them as separate tabs.** If yes, split them. If the wireframe explicitly combines them as one tab, keep the combination but treat them as distinct sections with clear headings.

---

## Stat Cards Above Tables (Detail Pages)

Stat cards at the top of a detail section provide at-a-glance summary before the detailed table below. Rules:

1. **Cards FILL the container width** — use a horizontal auto-layout row with equal FILL children
2. **Cards must have supporting content** — a label, a value, and optionally a subtitle or icon. NEVER copy flat wireframe cards without proper hierarchy (label as secondary text, value as large SemiBold, subtitle as description)
3. **Icons or colored badges in stat cards are optional** — use them when they add meaning (a green dot for "healthy", a warning icon for degraded). NEVER add decorative icons just to avoid flat cards
4. **AT MOST ONE primary action button** in the section — if there's "+ Add Read Replica" as Fill, don't also make "Refresh" or "Restore" a Fill button. One Fill, rest Outline

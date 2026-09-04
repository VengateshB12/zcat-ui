<!-- Shipped with the library so the rules travel with the clone.
     Source of truth is the zcat Figma project; re-copy if they diverge.
     These are DESIGN decisions and apply in both modes. Where a file
     mentions Figma mechanics (component keys, auto-layout,
     setProperties), take the decision and ignore the mechanism —
     none of it exists in code. -->

# Build Reference — Token Optimization, Errors & Figma Quirks

## Token Optimization — Build Efficiently

**Target: 2-3 use_figma scripts per screen, not 10+.**

### Script Batching

**BAD (10+ scripts):** One script per component import/update.

**GOOD (3 scripts):**
1. Import layout → configure → detach → update sidebar + sub header
2. Build entire Container content — action bar + table + pagination — ALL in one
3. Validation

### Skip search_design_system for Known Components

Use `componentKeyMap` from component-manifest.json directly:
```javascript
const btnSet = await figma.importComponentSetByKeyAsync("1e04478db049373eb096060a60ee7bbbc4da4e9a");
```
ONLY search for icons and components not in the manifest.

### Pre-Plan Before Building

List everything needed before the first use_figma call:
```
Screen: DirectDB List View
Layout: Default (key: c321d468b0...)
Components: Search, Button, Table AI, Badge, Pagination, Dropdown
Scripts: 3 total (layout, content, validation)
```

### Read Only What You Need

- **componentKeyMap only** — ~100 lines, not full components array (~5000 lines)
- **Specific component entries** — just what you need
- **Decision rules** — only the relevant topic file
- **layout-info.md** — read once per session

---

## Build Error Recovery — Pause and Ask

**NEVER burn tokens on a failing approach.**

**STOP and ASK when:**
- Component import fails or returns unexpected results
- `setProperties()` throws — don't guess alternative names
- Table component doesn't match wireframe schema
- Layout breaks or content overflows
- Any script fails more than once for same reason
- About to detach a non-whitelist component
- Unsure if tabs go in Sub Header or Container

**How to ask:** Tell user what you tried, what failed, propose 2 options. One question saves thousands of tokens.

---

## Figma Runtime Quirks

### 1. setProperties() is all-or-nothing
Throws on ANY invalid property combo and prevents ALL from applying. Verify valid combos via `componentSet.children` variant names, or set one at a time with try/catch. Common: `setProperties({Type: 'Ghost'})` throws — Ghost is a Variant, not a Type.

### 2. Page context doesn't persist
Every script starts with no page context. Always `await figma.setCurrentPageAsync(targetPage)` at the start.

### 3. detachInstance() returns a new node
Pre-detach ID is invalid. Always: `const detached = instance.detachInstance();`

### 4. Instance visibility breaks sibling IDs
Setting `.visible = false` can invalidate sibling node IDs. Read all needed IDs BEFORE toggling.

### 5. Script atomicity
If a script throws anywhere, earlier mutations may not persist. Keep scripts focused.

### 6. Sub Header tabs inside Layout
Primary Tabs child may NOT exist on the instance inside Layout. Check first, fall back to Container.

### 7. FILL sizing before appendChild
`layoutSizingHorizontal = 'FILL'` throws if node is NOT a child of auto-layout parent. Always `appendChild` first, THEN set FILL.

### 8. Table column minWidth locked at 250px
Set `col.minWidth = null` on each column after detaching.

### 9. Table cell avatars
Cell template includes avatar by default. Hide/remove for non-Name columns.

### 10. Font loading mandatory
Any text mutation requires `await figma.loadFontAsync(node.fontName)` first. Forgetting one crashes entire script.

### 11. Sidebar node IDs change after detach
Use `findAll()` or `findOne()` instead of `getNodeById()`. Wrap text operations in try/catch.

### 12. Text layers aren't semantically named
Text nodes named after default copy ("Text Field"), not generic ("Label"). Navigate by parent frame name + first TEXT child.

---

## Table Component vs Manual Build

**FIRST PREFERENCE: ALWAYS use Table AI component.**

**Manual ONLY when:** Schema fundamentally different from any column type (permissions matrix, structured column grid). ASK the user before choosing manual.

**Manual rules:**
- Auto-layout frames for rows, `layoutSizingHorizontal = FILL`
- Use zcat atoms INSIDE rows: Badges, Checkbox, Buttons
- ALL fills/strokes bound to variables
- Header: weight 500, `BODY/Text/Static/Secondary`
- Data rows: weight 400, `BODY/Text/Static/Primary`
- Row height: 44-48px Default, 36px Compact
- SURFACE this as a decision to the user

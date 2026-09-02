<!-- Copied from the zcat Figma project's reference set so the rules travel
     with this clone. These are DESIGN decisions and apply in both modes;
     where a file mentions Figma mechanics (component keys, auto-layout,
     setProperties), take the decision and ignore the mechanism — none of
     it exists in code. Source of truth is the Figma project; re-copy if
     they diverge. -->

# Popup & Dialog Rules

## Popup Modal vs Full-Page Modal vs Drawer

**Popup Modal:** Short form/confirmation (400-600px). Quick, focused action. 1-5 fields.

**Full-Page Modal:** Multi-step flow or long form. Full viewport. 6+ fields or multiple sections.

**Drawer:** Supplementary detail (preview, properties). User needs to see page behind it. Frequent open/close.

**Default:** Popup for confirmations/quick forms. Drawer for detail panels. Full-Page for complex creation flows.

---

## Popup Component — MANDATORY Structure

**Close is in FOOTER, NEVER in header.** The zcat Popup has NO X close button in header.

### Simple Form (no stepper)
```
Footer: Cancel (Outline/Grey secondary, LEFT) ———————— Create (Fill, RIGHT)
```
Cancel is ALWAYS a grey secondary button (Outline variant), NEVER Fill (primary blue). Cancel in primary blue makes a dismiss action look like the main action — dangerous and confusing.

### Informational / Blocking Notice Popup
```
Footer: Close (Outline/Grey, LEFT) ———————— Action (Fill, RIGHT)     ← with action
Footer: ——————————————————————————— Close (Outline/Grey, RIGHT)       ← notice only
```
**Every popup MUST have a dismiss path.** Even informational popups (deprecation warnings, upload-blocked notices, feature announcements) need a way to close WITHOUT taking the action. If the popup has an action button ("Go to Stratus", "Migrate Now"), add a "Close" / "Dismiss" / "Cancel" button (Outline) alongside it. If it's a pure notice with no action, a single "Got it" or "Close" button is enough. NEVER build a popup where the only exit is clicking the action — users must be able to dismiss and return to the page.

**External link buttons in popup footer** — if a popup footer has a button that navigates to an external page or docs ("Learn about Stratus"), it is ALWAYS Outline with external link icon (↗). The primary Fill is reserved for the in-app action ("Go to Stratus", "Migrate Now").

### Wizard with Stepper
```
Footer: Back (Outline, LEFT) ————————————— Cancel (Outline/Grey, RIGHT) + Continue (Fill, RIGHT)
         ↑ left side                                                    ↑ right side (grouped)
```
**Back/Previous is ALWAYS on the LEFT.** Cancel and Continue are ALWAYS on the RIGHT. A spacer pushes them apart — Back and Cancel must NOT sit adjacent without visual separation.

- First step: no Back → just Cancel (right-ish) + Continue (far right)
- Middle steps: Back (left) + [spacer] + Cancel (right) + Continue (far right)
- Last step: Back (left) + [spacer] + Cancel (right) + Create/Submit (far right)

### CRITICAL: Cancel Button Variant

**Cancel is ALWAYS Outline variant (grey secondary).** NEVER use Fill (primary blue) for Cancel.

| Button | Variant | Why |
|--------|---------|-----|
| Create / Save / Submit / Continue / Mark As Resolved | **Fill** (primary blue) | This is the action the user came to do |
| Cancel / Close / Dismiss | **Outline** (grey secondary) | This dismisses — it must NOT compete with the primary action |
| Back (in wizard) | **Outline** (grey secondary) | Navigation, not primary action |

**If Cancel is blue/Fill, it looks like a second primary action — the user can't tell which button does what at a glance.**

### Correct Structure
```
Popup
├── Header: Title only, NO close button
├── Description text (optional)
├── [Stepper if wizard — FILL width, in HEADER area below title]
├── Content (form fields, selections)
└── Footer: buttons per pattern above
```

---

## THE #1 POPUP MISTAKE: Header, Body, Footer Width Mismatch

**ALL three sections (Header, Body, Footer) MUST stretch to the FULL popup width.**

### The Rule

After importing and detaching the Popup component, verify:
1. **Header frame:** `layoutSizingHorizontal = "FILL"` — stretches to popup width
2. **Body/Content frame:** `layoutSizingHorizontal = "FILL"` — stretches to popup width
3. **Footer frame:** `layoutSizingHorizontal = "FILL"` — stretches to popup width
4. **Popup itself:** VERTICAL auto-layout with consistent padding (typically 24px left/right, 20px top/bottom)

### Common Width Mistakes

| Problem | What it looks like | Fix |
|---------|-------------------|-----|
| Body narrower than header | Form fields don't reach edges, wasted space on sides | Set body `layoutSizingHorizontal = "FILL"` |
| Footer narrower than body | Buttons float in center, don't align with content | Set footer `layoutSizingHorizontal = "FILL"` |
| Stepper narrower than header | Stepper steps cramped in center of wide popup | Set stepper `layoutSizingHorizontal = "FILL"` |
| Form fields fixed width | Narrow inputs inside a wide popup body | Set EVERY input `layoutSizingHorizontal = "FILL"` |

**Self-check after building any popup:** Screenshot it. Do ALL sections (header, stepper, body, footer) reach the same left and right edges? If not → fix the FILL sizing.

---

## Stepper in Popup — Placement and Sizing

### Placement: ALWAYS in Header Area

The Stepper component goes **directly below the popup title**, inside the header area. NEVER place it in the content body.

```
Popup
├── Header area
│   ├── Title text ("Create Item")
│   └── Stepper (FILL width) ← HERE, not in body
├── Body / Content
│   └── Form fields for current step
└── Footer
    └── Back + Cancel + Continue buttons
```

### Sizing: FILL Width

- Stepper `layoutSizingHorizontal = "FILL"` — stretches to full popup width
- This ensures step labels are evenly spaced across the popup
- NEVER leave the stepper at a fixed narrow width — it will look cramped in a wide popup

### Use the Stepper Component — NEVER Draw Manually

- Use the Stepper component from zcat — NEVER draw numbered circles + connecting lines manually
- The component handles spacing, numbering, active/completed states
- If more steps are needed than the component supports, detach and duplicate step instances

### Step States

| Step | State |
|------|-------|
| Current step | Active (brand color, filled circle) |
| Completed steps | Completed (checkmark or filled) |
| Future steps | Default (grey, outline circle) |

---

## Tables Inside Popups — ALWAYS Boxy

If a popup contains a Table AI, it MUST use **Boxy** style. A popup body has padding on all sides and contains multiple elements — the table is one section among many. Stretch style removes side padding and goes edge-to-edge, which breaks the popup's internal layout.

---

## Popup Sizing & Responsiveness

- Default 548px wide, 500-700px for wizard flows
- ALL components inside Popup (Text Box, Dropdown, Radio Button) MUST use `layoutSizingHorizontal = FILL`
- NEVER leave narrow fixed-width controls in a wide popup
- Form labels go ABOVE fields (inside popups)

### Required Layers

1. **Popup Blur** (key `825e3c4aa551ccd56ec61d6f5059dda1e92abbc5`) — backdrop, sized to full page (1582×860)
2. **Popup** component — the actual dialog

NEVER create manual frames with hardcoded black/opacity for overlay.

---

## Footer Button Layout — Alignment Rules

### Simple Form Footer
```
Footer (HORIZONTAL auto-layout, FILL width, padding 16px)
├── Cancel button (Outline variant, grey secondary, LEFT aligned)
├── Spacer (FILL width) — pushes primary to right
└── Create/Save button (Fill variant, primary blue, RIGHT aligned)
```

### Wizard Footer (with Back)
```
Footer (HORIZONTAL auto-layout, FILL width, padding 16px)
├── Back button (Outline variant, LEFT side)
├── Spacer (FILL width) — pushes remaining buttons to right
├── Cancel button (Outline variant, grey secondary, RIGHT side)
└── Continue button (Fill variant, primary blue, far RIGHT)
```

**CRITICAL:** Back/Previous is ALWAYS on the LEFT side. Cancel and Continue are ALWAYS on the RIGHT side. A FILL spacer separates the two groups — Back and Cancel must NOT sit adjacent. Cancel is NEVER Fill — it must be grey/Outline to visually separate it from the primary action. NEVER center all buttons together.

---

## Grouping Fields Inside Modal/Form

**Bordered sub-panel (neutral Card BG) + sub-heading when:** 3+ fields configure one conceptual thing (conditions, criteria, frequency).

**Plain sub-heading, no border, when:** Single field or repeatable list (e.g., email list + "+" Icon Button to add more).

**Default:** Ungrouped for primary identity fields (name, type). Bordered sub-panel for configuration clusters. Plain sub-heading for single/repeatable fields.

**Optional/rarely-needed fields:** Collapse behind "Show Advanced Settings" / "Hide Advanced Settings" link with chevron, collapsed by default.

**Secondary tabs inside grouped panel:** When tabs switch sub-views of one group (e.g., "Params | Headers"), they sit inside that group's bordered panel, scoped to it.

---

## Popup & Dialog Overlay Pattern

**Required layers (bottom to top):**
1. **Popup Blur** — bare backdrop rectangle with blur/dim. NOT a dialog. Size to full page.
2. **Popup** — actual dialog with header, body, actions.

**NEVER:** Create manual overlay frames. Skip Popup Blur. Set overlay to white.

**Popup sizing:** Default 548px. For wider content, detach and resize (Popup is on detach whitelist).

---

## Popup/Dialog as Own Top-Level Frame

**A popup screen MUST be its own top-level Figma frame** — it is NOT a child of the screen it overlays.

### Why

Placing a popup as a child of the screen frame:
- Breaks the screen's auto-layout (popup is an absolute-positioned child disrupting the flow)
- Makes the popup unmeasurable in screenshot validation (it's clipped or layered wrong)
- Prevents independent resizing — the popup inherits the screen's constraints

### Correct Structure

```
Figma page
├── Screen 1: "Databases – List" (top-level frame, 1582×860)
├── Screen 2: "Databases – Delete Popup" (top-level frame, 1582×860)
│   ├── Popup Blur (backdrop, full page size)
│   └── Popup (centered, 400-600px wide)
├── Screen 3: "Databases – Create Wizard Step 1" (top-level frame)
│   ├── Popup Blur
│   └── Popup (with Stepper in header)
└── ...
```

### Rules

1. **Every popup/dialog is a separate top-level frame** with a full-page Popup Blur backdrop behind it
2. **The background behind the blur is the screen the popup appears over** — either a flattened screenshot or a dimmed clone of the screen. If building from scratch, the Popup Blur component handles the dimming
3. **Popup frames follow the same page grid** as other screens — consistent gutters, no overlaps
4. **Name the frame descriptively** — "Delete Database Popup", "Create Wizard Step 1", not just "Popup"
5. **The popup uses the Popup component** — header/body/footer structure. NEVER build a freestanding Card BG with manual buttons as a dialog

<!-- Copied from the zcat Figma project's reference set so the rules travel
     with this clone. These are DESIGN decisions and apply in both modes;
     where a file mentions Figma mechanics (component keys, auto-layout,
     setProperties), take the decision and ignore the mechanism — none of
     it exists in code. Source of truth is the Figma project; re-copy if
     they diverge. -->

# Input Selection Rules

## Dropdown vs Radio Group vs Segmented Control

**Dropdown:** 6+ options, space limited, dynamic list, rarely changed after selection.

**Radio Group:** 2-5 options, all visible without interaction, options have descriptions.

**Segmented Control:** 2-4 options as view modes/filters, immediate content switch, short labels.

**Default:** Dropdown for 6+. Radio for 2-5 in forms. Segmented for view/filter toggles.

---

## Text Input vs Textarea vs Rich Editor

**Text Input:** Single line, under 100 chars (name, email, URL, search).

**Textarea:** Multi-line plain text, 1-5 paragraphs (description, notes, comments). No formatting needed.

**Rich Editor:** Formatting needed (bold, lists, links). Long-form content rendered as HTML elsewhere.

**Default:** Text Input for labels. Textarea for descriptions. Rich Editor only when formatting explicitly needed.

---

## Checkboxes vs Multi-Select Dropdown vs Token Input

**Checkboxes:** 2-7 options, all visible, independent selections.

**Multi-Select Dropdown:** 8+ predefined options, space constrained, selections shown as tags.

**Token Input:** Very large/dynamic option set, searchable, options created on the fly.

**Default:** Checkboxes for 2-7. Multi-Select for 8+ fixed. Token for searchable/dynamic.

---

## Toggle vs Checkbox for Boolean

**Toggle:** Setting takes effect immediately (no Save button). On/off state (notifications, feature flags). Settings/config panel.

**Checkbox:** Value submitted as part of form with Save. Agreement/selection ("I agree", "Remember me"). Alongside other form fields.

**Default:** Toggle for instant-apply settings. Checkbox for form-submitted values.

---

## Number Input vs Text Input with Validation

**Number Input (Stepper):** Small range (1-100), users adjust ±1, whole numbers.

**Text Input with Validation:** Large values (phone, prices), paste/type full value, format mask needed.

**Default:** Number Input for small-range integers. Text Input for large numbers, decimals, formatted.

---

## Filter Dropdown State

A Dropdown used as a **filter** (in Container Header / action bar) follows different state rules from a form Dropdown:

| Situation | State | Why |
|-----------|-------|-----|
| Filter shows "All Types" (default-all) | **Filled** | A default-all selection IS a selection — the user can change it |
| Filter shows a specific value ("MySQL") | **Filled** | Clearly selected |
| Filter has no selection yet (rare) | **Default** | Only when genuinely unset |

**A filter should NEVER show `State: Default` when it displays a value.** Default state renders the text as grey placeholder, which reads as "nothing selected" even though the filter is active. Set `State: Filled` on every filter Dropdown that displays any value, including the default-all option.

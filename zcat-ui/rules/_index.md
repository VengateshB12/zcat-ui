<!-- Shipped with the library so the rules travel with the clone.
     Source of truth is the zcat Figma project; re-copy if they diverge.
     These are DESIGN decisions and apply in both modes. Where a file
     mentions Figma mechanics (component keys, auto-layout,
     setProperties), take the decision and ignore the mechanism —
     none of it exists in code. -->

# Decision Rules — Topic Index

Pick the file that matches your current question. Read ONLY that file, not all
of them. The sizes below are real — they were wrong by up to 10x, which meant
a file listed as "~6k" cost 15k tokens to open. Budget from these.

| Question | File | Size |
|----------|------|------|
| Which component should I use? / Search before build | `rules-which-component.md` | ~6k |
| How to compose a polished design from wireframe? | `rules-design-composition.md` | ~56k |
| What are the visual standards / design uniforms? | `rules-design-uniforms.md` | ~5k |
| How to display data (table vs cards vs list)? | `rules-data-display.md` | ~7k |
| How to configure Table AI columns? | `rules-table-columns.md` | ~22k |
| How to build detail page / master-detail / empty state? | `rules-detail-page.md` | ~11k |
| Which input component (dropdown vs radio vs toggle)? | `rules-input-selection.md` | ~3k |
| How to build a popup / dialog / footer layout? | `rules-popup-footer.md` | ~11k |
| Tabs vs sidebar vs accordion / actions / navigation? | `rules-navigation-actions.md` | ~15k |
| Spacing values / layout rules / container patterns? | `rules-spacing-layout.md` | ~12k |
| Token optimization / error recovery / Figma quirks? | `rules-build-reference.md` | ~4k |

## Topic Keywords → File Mapping

- **component, search, which, skip** → `rules-which-component.md`
- **wireframe, composition, hierarchy, anti-pattern, stat card, polish** → `rules-design-composition.md`
- **uniform, consistency, page layout, card spec, text style, spacing rhythm** → `rules-design-uniforms.md`
- **table, cards, list, card grid, kv, key-value, general details, kpi** → `rules-data-display.md`
- **table ai, column, stretch, boxy, filter, chip** → `rules-table-columns.md`
- **detail page, master-detail, side menu, empty state** → `rules-detail-page.md`
- **input, dropdown, radio, checkbox, toggle, textarea** → `rules-input-selection.md`
- **popup, modal, dialog, footer, stepper, drawer, form grouping** → `rules-popup-footer.md`
- **tabs, sidebar, accordion, breadcrumb, edit, action, overflow, context menu, confirmation, toast, button group** → `rules-navigation-actions.md`
- **spacing, padding, gap, column layout, container pattern, dashboard, composite, feedback, loading, progress** → `rules-spacing-layout.md`
- **token, optimization, batch, error, recovery, quirk, figma runtime, manual table** → `rules-build-reference.md`

# Component Development — Mode Router

This workspace holds the zcat design system in TWO forms, each with its own
automation workflow. Before any UI task, decide which mode the user wants and
load THAT workflow. The design rules are shared; only the output medium differs.

## The two modes

| Mode | Output | Workflow file (read it FIRST, follow every step) |
|---|---|---|
| **Figma design** | Screens in a Figma file via the Figma MCP | `AI Automation/CLAUDE.md` → `AI Automation/.claude/skills/zcat.md` |
| **Code development** | HTML/CSS/JS pages built from the `zcat-ui/` component library | `zcat-ui/.claude/skills/zcat-code.md` |

## Routing

- "design", "in Figma", a figma.com URL, "/zcat" → **Figma mode**.
- "develop", "build the page", "code", "HTML", "using the developed components",
  "/zcat-code" → **Code mode**.
- A wireframe/PRD/screenshot with no medium stated → **ASK which mode** (one
  question: "Design this in Figma, or develop it as HTML pages from zcat-ui?").
  Never assume.

Both modes share the same design decision rules in
`AI Automation/references/decision-rules/` and the same sample data in
`AI Automation/references/sample-data.md`. In code mode, apply the design
decisions from those files but implement with `zc-*` components — the
translation table is in `zcat-code.md`.

## Hard boundaries

- `AI Automation/` is **READ-ONLY** — never modify, create, or delete files there.
- `zcat-ui/` is the component library — never edit it during a page build; pages
  go in a separate folder (e.g. `pages/`). Library maintenance happens only via
  `HANDOFF.md` sessions.
- In code mode, `zcat-ui/ONBOARDING.md` is the component API contract.
  `zcat-ui/COMPONENTS.md` and `zcat-ui/docs/index.html` are STALE — never read
  them for markup.

## Other references

- `HANDOFF.md` — library build history, verified facts, traps, and current state.
  Read it before any zcat-ui library maintenance work.

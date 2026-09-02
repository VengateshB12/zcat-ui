# zcat UI

The ZCat (Zoho Catalyst) design system as code — dependency-free HTML, CSS and
JS. Every colour, size and state comes from the Figma design system.

No build step. No dependencies. Drop it in and use it.

---

## Quick start

```bash
git clone https://github.com/VengateshB12/zcat-ui.git
cd zcat-ui
npm run setup     # installs playwright + chromium, which the gates need
```

The clone gives you `zcat-ui/zcat-ui/` — the repo and the library folder share a
name. The **outer** folder is your working root: it holds `.claude/` (the
gates), `reference-screenshots/` and the library. Never copy the inner folder
out on its own; that discards the gates.

Link the two files in your page, unmodified:

```html
<link rel="stylesheet" href="zcat-ui/zcat.css?v=109">
<script src="zcat-ui/zcat.js?v=16" defer></script>
```

Keep the `?v=` on both. `zcat.css` is a list of `@import`s: the imports carry
their own version, but if the page asks for `zcat.css` itself without one, the
browser serves a cached copy of that file — old import list and all — so a
library fix never reaches your page. Copy the two lines from
`zcat-ui/docs/template.html`, which always carries the current version.

`zcat.js` initialises every component automatically, including markup you inject
later. There is nothing else to wire up.

To browse the components:

```bash
python3 -m http.server 8790
```

Then open **http://localhost:8790/zcat-ui/docs/playground.html**

---

## What's in here

| Path | What it is |
|---|---|
| `zcat-ui/zcat.css` · `zcat.js` | the library — link these two |
| `zcat-ui/src/tokens/` | every colour, spacing, radius and text style, in light **and** dark |
| `zcat-ui/src/components/` | the component CSS; each file opens with the markup shapes it expects |
| `zcat-ui/docs/icons/` | 485 design-system icons — **the only icons you may use** |
| `zcat-ui/docs/playground.html` | the component explorer: live preview, properties, markup |
| `zcat-ui/docs/template.html` | a complete, verified Catalyst page to copy from |
| `zcat-ui/ONBOARDING.md` | **the component API contract — authoritative** |
| `reference-screenshots/` | 24 production screens: the quality bar to design against |
| `zcat-ui/rules/` | the design decision rules — read `_index.md`, then the one topic you need |
| `.claude/` | the AI build workflow and enforcement hooks |

---

## Building screens with an AI agent

This repo is set up so an AI coding agent builds screens that actually follow
the design system rather than approximating it.

**1. Connect the zcat MCP** — the live source of the design rules:

```
https://zcat.catalystappsail.in/mcp
```

It serves the hard rules, the design decision rules by topic, realistic sample
data, the design tokens, and component/icon search. It is updated centrally, so
you always get the current rules without pulling this repo again.

**2. The hooks enforce the rules.** A hook runs on every change to a page file.
It auto-fixes raw hex colours, off-scale spacing and raw font rules, then blocks
on anything needing judgement — hand-built controls, tabs in the wrong place,
missing hierarchy, a screen that is assembled rather than composed.

Before a screen can be called done, **four gates must pass**, and all four go
stale the moment the page is edited again:

| Gate | Proves |
|---|---|
| `zcat-render-audit.js` | it renders correctly — real geometry, contrast, no hand-built controls |
| `zcat-features.py` | it contains everything the requirement asked for; nothing dropped quietly |
| `zcat-design-score.py` | it was **composed**, not assembled — 75+ with no zero dimension |
| `zcat-review.py` | a real design review against a production reference |

Run all four with one command — never one on its own:

```bash
npm run gate -- pages/my-page.html
```

It re-runs the two live gates every time and rejects a receipt written before
your last edit, so you cannot fix a failure and re-check only the cheap gate.

**The library and the gates are read-only to an AI agent.** A screen build
writes pages and nothing else. The component library, the prompt, the skill and
the gates themselves are shared by everyone building screens, so a change to any
of them changes what every future build is allowed to do — and an agent halfway
through one screen is the worst position from which to make that call. Writes
are refused before they happen, by Write/Edit and by Bash alike.

The designer unlocks for a maintenance session, and locks again after:

```bash
touch .zcat-unlock
```

Don't work around them. What they block is what the designer would reject.
The design score is honest about its limits: it measures composition, not
taste. Passing it does not make a screen good; failing it means it is not.

**3. The rules that get broken most.** Full set in
`zcat-ui/.claude/skills/zcat-code.md`:

- Every screen starts from the Catalyst shell (`.zc-layout`) — never a floating card
- A wireframe is a **feature list, not a design**. Every feature survives; the layout must not
- Primary tabs live in the **Sub Header**, never floating in the container
- At most **one** primary (fill) button per screen
- Label:value is horizontal (`.zc-gdetails`) — never stacked
- Create and edit are **popups**, not pages. Detail pages are read-only
- Every colour is a `var(--zc-*)` token — **never** a raw hex
- Typography is `.zc-h*` / `.zc-subtitle-*` / `.zc-body-*` classes — never raw font rules
- Icons only from `zcat-ui/docs/icons/` — never emoji, never another icon set
- Real data, never lorem ipsum

---

## Before you hand-build anything

Check `zcat-ui/ONBOARDING.md` first. The library covers ~65 components including
many people assume are missing — General Details, Container Side Menu, Empty
State, Attention Box, Timeline, Stepper, Tour, Code Block, Key Value fields.

If you catch yourself building a button, input, badge, tab, toggle or menu out of
`<div>`s, stop and use the component.

---

## Status

Components are verified against the Figma design system, but only a subset have
been through designer sign-off. Each component's **Overview** tab in the
playground states honestly what was verified and what is still pending — read it
before relying on a component.

A few components have **no Figma source** and were invented or are legacy —
Slider, Progress Circle, Shimmer, and the Container/Stack/Divider primitives.
They work and are safe to use, but their design is unreviewed. The Code Tab's
slanted edge is a CSS approximation of the Figma vector.

Dark mode ships for every token and is pending a designer audit.

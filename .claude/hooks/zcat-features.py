#!/usr/bin/env python3
"""Wireframe → build feature-coverage receipt.

The rendered audit proves a page is CORRECT. It cannot prove the page contains
everything the requirement asked for, because it has never seen the wireframe.
This closes that hole: the agent declares what the requirement contained, and
this script checks each declared item actually appears in the built page.

    python3 .claude/hooks/zcat-features.py <page.html> --json '{
      "source":  "what the features were read from (wireframe file, PRD, …)",
      "tabs":    ["Overview", "Settings"],
      "columns": ["Name", "Status"],
      "actions": ["Create Database", "Refresh"],
      "fields":  ["Database name", "Region"],
      "other":   ["copy icon on host", "three-dot row menu"],
      "states":  ["populated", "empty", "create popup"],
      "dropped": [],
      "furniture": {
        "empty":    "Empty State component when no databases exist",
        "loading":  "shimmer rows while the list loads",
        "error":    "Attention Box, type=message, on fetch failure",
        "confirm":  "Delete opens a confirm popup naming the database",
        "feedback": "Toast on create and on delete success",
        "overflow": "pagination at 25/page plus search over the list",
        "access":   "n/a: this console has no per-row permission model"
      }
    }'

Rules enforced here:
  * every declared tab / column / action / field must be findable in the page
  * "dropped" must be empty unless each entry records the user's approval
  * "states" must name what was built beyond the happy path

Written next to the page's audit as <slug>.features.json; the Stop gate refuses
to finish without a current one.
"""
import json
import os
import re
import sys

HOOKS = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.abspath(os.path.join(HOOKS, "..", ".."))
STATE = os.path.join(HOOKS, ".zcat-state")

LISTS = ("tabs", "columns", "actions", "fields", "other")

# Every wireframe omits the same category of things: the unglamorous parts of a
# real product. A drawing shows one happy path with data already in it, because
# that is what communicates the idea. It does not draw the screen before the
# data arrives, when it fails to arrive, when there is none, when the list grows
# past one page, or when the user is one click from destroying something.
#
# So this checklist is the SAME for every page, and asking it of every page is
# the whole point — it is not derived from any one wireframe, and it does not
# grow each time a new wireframe exposes a gap. Each item is answered with how
# it was handled, or "n/a: <reason>". A bare "n/a" is refused: deciding that an
# item does not apply is itself a design decision and has to carry its reason.
FURNITURE = {
    "empty":    "what the screen shows when there is no data yet",
    "loading":  "what it shows while data is arriving",
    "error":    "what it shows when data fails to arrive",
    "confirm":  "what happens before a destructive action completes",
    "feedback": "how the user knows an action succeeded",
    "overflow": "what happens when a list or a value grows long "
                "(pagination, search, truncation)",
    "access":   "what a user without permission sees",
}


def slug(rel):
    """Same slug the render audit and the gate use: path separators to __,
    .html dropped, everything else left alone."""
    return rel.replace("/", "__").replace("\\", "__")[:-5]


def norm(s):
    """Compare loosely: case, punctuation and whitespace should not matter."""
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def main():
    if len(sys.argv) < 4 or sys.argv[2] != "--json":
        print(__doc__)
        sys.exit(1)
    rel = os.path.relpath(os.path.abspath(sys.argv[1]), PROJECT)
    abs_p = os.path.join(PROJECT, rel)
    if not os.path.exists(abs_p):
        print(f"ERROR: no such page: {rel}")
        sys.exit(1)
    try:
        d = json.loads(sys.argv[3])
    except Exception as e:
        print(f"ERROR: --json is not valid JSON ({e})")
        sys.exit(1)

    errs = []
    if not (d.get("source") or "").strip():
        errs.append('"source" is missing — name what you read the features from '
                    '(the wireframe file, the PRD, my message)')

    declared = {k: [x for x in (d.get(k) or []) if str(x).strip()] for k in LISTS}
    total = sum(len(v) for v in declared.values())
    if total == 0:
        errs.append("no features declared — list the tabs, columns, actions and "
                    "fields you found in the requirement; a screen always has some")

    # Match on what a user can actually read. Tag stripping alone would lose
    # placeholder / aria-label / title / alt / value text, which is real visible
    # content — a Search field's placeholder IS the feature.
    raw = open(abs_p, encoding="utf-8", errors="replace").read()
    text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", raw, flags=re.S | re.I)
    attrs = " ".join(re.findall(
        r'(?:placeholder|aria-label|title|alt|value|data-tooltip)\s*=\s*"([^"]*)"',
        text, flags=re.I))
    hay = norm(re.sub(r"<[^>]+>", " ", text) + " " + attrs)

    missing = []
    for kind, items in declared.items():
        for it in items:
            n = norm(it)
            # short labels ("ID") would match anything; require 3+ chars
            if len(n) >= 3 and n not in hay:
                label = {"other": "other"}.get(kind, kind[:-1])
                missing.append(f"{label}: {it}")

    if missing:
        errs.append("DECLARED BUT NOT FOUND IN THE PAGE — you dropped these, or "
                    "renamed them without saying so:\n      - " +
                    "\n      - ".join(missing[:15]) +
                    (f"\n      (+{len(missing) - 15} more)" if len(missing) > 15 else ""))

    dropped = d.get("dropped") or []
    if dropped:
        unapproved = [x for x in dropped if "approved" not in str(x).lower()]
        if unapproved:
            errs.append("features are listed as dropped without recorded approval: " +
                        "; ".join(str(x) for x in unapproved[:5]) +
                        ". Removing a required feature needs the user's YES first — "
                        "ask, then record it here as approved.")

    states = [s for s in (d.get("states") or []) if str(s).strip()]
    if not states:
        errs.append('"states" is empty — a wireframe shows one happy path. Name the '
                    'states you built (empty, loading, error, selection) or say '
                    'explicitly which do not apply and why')

    # ── the furniture checklist — identical for every page ──────────────
    f = d.get("furniture")
    if not isinstance(f, dict):
        errs.append('"furniture" is missing. It is the same checklist for every '
                    "page, because every wireframe leaves out the same things — "
                    "answer each of: " + ", ".join(FURNITURE) +
                    '. Give how you handled it, or "n/a: <reason>".')
    else:
        for k, what in FURNITURE.items():
            v = str(f.get(k) or "").strip()
            if not v:
                errs.append('furniture."%s" is unanswered — %s. Say how you '
                            'handled it, or "n/a: <reason>".' % (k, what))
            elif re.fullmatch(r"(n/?a|none|no|-{1,2})\.?", v, re.I):
                errs.append('furniture."%s" says "%s" with no reason. Deciding '
                            "that %s does not apply is a design decision — "
                            'write "n/a: <why>".' % (k, v, what))
            elif len(v) < 12:
                errs.append('furniture."%s" is too short to be an answer ("%s"). '
                            "Say what you actually built for: %s." % (k, v, what))

    if errs:
        print(f"FEATURE COVERAGE REJECTED for {rel}:")
        for e in errs:
            print("  - " + e)
        sys.exit(1)

    os.makedirs(STATE, exist_ok=True)
    out = os.path.join(STATE, slug(rel) + ".features.json")
    d["_checked"] = total
    d["_page_mtime"] = os.path.getmtime(abs_p)
    json.dump(d, open(out, "w"), indent=1)
    print(f"FEATURE COVERAGE RECORDED for {rel} — {total} feature(s) verified "
          f"present, {len(states)} state(s) built, {len(FURNITURE)} furniture "
          f"item(s) accounted for")


if __name__ == "__main__":
    main()

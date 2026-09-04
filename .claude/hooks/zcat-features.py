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
import html
import html as html_mod
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


# The gate's original weakness: it only ever checked what the agent DECLARED,
# and the declaration is written AFTER the build — so an agent declares what it
# built, not what the requirement asked for. "dropped": [] is then trivially
# true, because you cannot drop what you never wrote down. A whole Database
# section (Schema Visualiser, Queries, Functions, Triggers, Indexes,
# Extensions, and every per-table detail) vanished into a single table listing
# and the gate passed it.
#
# When the requirement is something we can actually READ — a local file, or a
# URL — we no longer have to take the agent's word for it. Pull the structural
# labels out of the requirement itself and diff them against the built page.
# Structural only: nav and menu items, tab labels, headings, buttons. Body
# prose is not a feature list and would only add noise.
STRUCTURAL = re.compile(
    r'<(?:h[1-6]|button|a|summary|legend)\b[^>]*>(.*?)</(?:h[1-6]|button|a|summary|legend)>'
    r'|role="(?:tab|menuitem|option)"[^>]*>(.*?)<',
    re.I | re.S)


def read_source(src):
    """Return the requirement's raw text, or None if we cannot reach it."""
    src = (src or "").strip()
    m = re.search(r'https?://[^\s"\'<>)]+', src)
    if m:
        try:
            import urllib.request
            req = urllib.request.Request(m.group(0), headers={"User-Agent": "zcat-gate"})
            with urllib.request.urlopen(req, timeout=12) as r:
                return r.read().decode("utf-8", "replace")
        except Exception:
            return None
    for tok in re.findall(r'[\w./\\-]+\.(?:html?|md|txt|json)', src):
        for base in (PROJECT, os.getcwd()):
            f = os.path.join(base, tok)
            if os.path.exists(f):
                return open(f, encoding="utf-8", errors="replace").read()
    return None


def source_labels(raw):
    """Structural labels the requirement contains, de-duplicated."""
    out, seen = [], set()
    for groups in STRUCTURAL.findall(raw):
        for g in groups:
            t = re.sub(r"<[^>]+>", " ", g or "")
            t = html_mod.unescape(t)
            t = re.sub(r"\s+", " ", t).strip()
            # a feature label is short and wordy; skip prose, code and symbols
            if not (2 <= len(t.split()) <= 5 or (t and len(t) >= 4 and " " not in t)):
                continue
            if len(t) > 40 or not re.search(r"[A-Za-z]", t):
                continue
            k = norm(t)
            if len(k) >= 4 and k not in seen:
                seen.add(k)
                out.append(t)
    return out


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
    # Entities must be decoded first. Without this, "Access & Roles" is written
    # in the page as "Access &amp; Roles", normalises to "accessamproles", and
    # the gate reports a feature that is plainly on screen as missing — which
    # teaches the agent that the gate is unreliable, the worst thing it can do.
    hay = norm(html.unescape(re.sub(r"<[^>]+>", " ", text) + " " + attrs))

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

    # ── diff against the requirement, when we can read it ───────────────
    raw_src = read_source(d.get("source"))
    if raw_src:
        absent = [t for t in source_labels(raw_src) if norm(t) not in hay]
        # anything the agent already owned up to does not count again
        owned = norm(" ".join(str(x) for x in (d.get("dropped") or [])))
        absent = [t for t in absent if norm(t) not in owned]
        if len(absent) > 3:
            errs.append(
                f"THE REQUIREMENT CONTAINS {len(absent)} LABELS YOUR PAGE DOES NOT.\n"
                "      I read the source you named, so this is not a guess:\n      - " +
                "\n      - ".join(absent[:20]) +
                (f"\n      (+{len(absent) - 20} more)" if len(absent) > 20 else "") +
                "\n      Each one is a section, tab, action or heading the requirement "
                "has and you do not. Build them, or list them in \"dropped\" with my "
                "recorded approval. Declaring only what you built is how a whole "
                "section disappears without anyone noticing.")
    elif (d.get("source") or "").strip():
        d["_source_unread"] = True

    # ── which mode was agreed ───────────────────────────────────────────
    mode = str(d.get("mode") or "").strip().lower()
    if mode not in ("redesign", "match"):
        errs.append('"mode" must be "redesign" or "match", and it is the user\'s '
                    "call, not yours. REDESIGN treats the requirement as a feature "
                    "list and runs the design score and review. MATCH reproduces the "
                    "given design and runs zcat-match.js against the reference URL "
                    "instead. Ask before building; if the requirement is already a "
                    "considered design, say so and recommend matching it.")

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

#!/usr/bin/env python3
"""Run ALL FOUR gates on a page and return one verdict.

Why this exists: the gates used to be four separate commands, so an agent could
run the easy one, make a cosmetic change, and never re-run the one that would
have caught it. That is exactly what happened — a page was edited to fix a
failing design score, only the rendered audit was re-run, and the build was
reported as complete while the score still said FAIL.

This closes that. One command, one verdict, and a receipt is only counted if it
was written AFTER the page's last edit — so touching the page invalidates every
gate at once and they must all be earned again.

    python3 .claude/hooks/zcat-gate-all.py <page.html>
    npm run gate -- <page.html>

Exit 0 only when all four are green and current. Anything else exits 1.
The two receipt-based gates need their --json payloads recorded first:
    python3 .claude/hooks/zcat-features.py <page> --json '{...}'
    python3 .claude/hooks/zcat-review.py   <page> --json '{...}'
"""
import json
import os
import subprocess
import sys

HOOKS = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.abspath(os.path.join(HOOKS, "..", ".."))
STATE = os.path.join(HOOKS, ".zcat-state")


def slug(rel):
    return rel.replace("/", "__").replace("\\", "__")[:-5]


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    rel = os.path.relpath(os.path.abspath(sys.argv[1]), PROJECT)
    abs_p = os.path.join(PROJECT, rel)
    if not os.path.exists(abs_p):
        print(f"ERROR: no such page: {rel}")
        sys.exit(1)
    page_mtime = os.path.getmtime(abs_p)
    sl = slug(rel)

    print(f"GATES — {rel}\n")
    problems = []

    # 1 & 3 are re-run every time: they are cheap and must reflect the page as
    # it stands right now, not as it stood before the last edit.
    print("  [1/4] rendered audit …")
    r = subprocess.run(["node", os.path.join(HOOKS, "zcat-render-audit.js"), abs_p],
                       capture_output=True, text=True)
    print("        " + (r.stdout.strip().splitlines() or ["(no output)"])[0])
    if r.returncode != 0:
        for ln in r.stdout.strip().splitlines()[1:9]:
            print("        " + ln.strip())
        problems.append("rendered audit failed")

    print("  [2/4] feature coverage …")
    f = os.path.join(STATE, sl + ".features.json")
    if not os.path.exists(f):
        problems.append("no feature-coverage receipt — record one with "
                        f"zcat-features.py \"{rel}\" --json '{{...}}'")
        print("        MISSING")
    elif os.path.getmtime(f) < page_mtime:
        problems.append("the feature-coverage receipt predates your last edit — "
                        "re-record it")
        print("        STALE")
    else:
        print(f"        OK ({json.load(open(f)).get('_checked', '?')} features verified)")

    # Which gates apply depends on the mode the user chose.
    mode = "redesign"
    if os.path.exists(f):
        try:
            mode = (json.load(open(f)).get("mode") or "redesign").lower()
        except Exception:
            pass

    if mode == "match":
        # The score and the review exist to reward divergence; in match mode
        # divergence IS the failure, so they are the wrong instrument. The
        # visual match gate replaces both.
        print("  [3/4] visual match (match mode) …")
        m = os.path.join(STATE, sl + ".match.json")
        if not os.path.exists(m):
            problems.append("no visual-match receipt — this page is in MATCH mode, so "
                            "run: node .claude/hooks/zcat-match.js "
                            f'"{rel}" <reference-url>')
            print("        MISSING")
        elif os.path.getmtime(m) < page_mtime:
            problems.append("the visual-match receipt predates your last edit — re-run it")
            print("        STALE")
        else:
            d2 = json.load(open(m))
            ok = d2.get("pass")
            print(f"        {'OK' if ok else 'FAILED'} — {d2.get('content')}% content, "
                  f"{d2.get('layout')}% layout vs {d2.get('reference')}")
            if not ok:
                problems.append(f"the visual match is only {d2.get('content')}% — you were "
                                "asked to reproduce this design, not improve it")
        print("  [4/4] design review … SKIPPED (match mode: reproducing, not composing)")
        print()
        if problems:
            print(f"GATES FAILED — {len(problems)} not green:")
            for pr in problems:
                print(f"  - {pr}")
            sys.exit(1)
        print("GATES PASSED — all green against the current version of this page.")
        sys.exit(0)

    print("  [3/4] design score …")
    r = subprocess.run([sys.executable, os.path.join(HOOKS, "zcat-design-score.py"), abs_p],
                       capture_output=True, text=True)
    out = r.stdout.strip().splitlines() or ["(no output)"]
    print("        " + out[0])
    if r.returncode != 0:
        for ln in out[1:7]:
            print("        " + ln.strip())
        problems.append("design score failed")

    print("  [4/4] design review …")
    v = os.path.join(STATE, sl + ".review.json")
    if not os.path.exists(v):
        problems.append("no design review — record one with "
                        f"zcat-review.py \"{rel}\" --json '{{...}}'")
        print("        MISSING")
    elif os.path.getmtime(v) < page_mtime:
        problems.append("the design review predates your last edit — re-record it")
        print("        STALE")
    else:
        print("        OK")

    print()
    if problems:
        print(f"GATES FAILED — {len(problems)} of 4 not green:")
        for p in problems:
            print(f"  - {p}")
        print("\nThe page is NOT ready to show. Fix the cause, then run this same")
        print("command again — editing the page invalidates every gate, so all four")
        print("have to come back green together. Do not re-run one gate in")
        print("isolation and report the page as done.")
        sys.exit(1)

    print("GATES PASSED — all four green against the current version of this page.")
    sys.exit(0)


if __name__ == "__main__":
    main()

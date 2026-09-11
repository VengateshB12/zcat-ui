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
import io
import json
import os
import re
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

    f = os.path.join(STATE, sl + ".features.json")

    # Which gates apply depends on the mode the user chose. THE PAGE'S OWN
    # DECLARATION WINS, then the receipt — the same precedence as
    # zcat-render-audit.js and zcat_checks.py. This used to read the receipt
    # only, so a page declaring data-zcat-mode="match" in its HTML (which the
    # save-time check and the rendered audit both honour) still got the
    # REDESIGN gate path here whenever its receipt was missing or said
    # otherwise. Three readers, one answer.
    mode = "redesign"
    try:
        with io.open(abs_p, encoding="utf-8") as fh:
            if re.search(r'data-zcat-mode\s*=\s*["\']match["\']', fh.read(), re.I):
                mode = "match"
    except OSError:
        pass
    if mode != "match" and os.path.exists(f):
        try:
            mode = (json.load(open(f)).get("mode") or "redesign").lower()
        except Exception:
            pass
    # MATCH runs five gates, REDESIGN four. Decide the mode BEFORE printing any
    # step, so the numbering tells the truth from the first line.
    N = 5 if mode == "match" else 4

    print(f"GATES — {rel}   [{mode.upper()} mode]\n")
    problems = []

    # 1 & 3 are re-run every time: they are cheap and must reflect the page as
    # it stands right now, not as it stood before the last edit.
    print(f"  [1/{N}] rendered audit …")
    r = subprocess.run(["node", os.path.join(HOOKS, "zcat-render-audit.js"), abs_p],
                       capture_output=True, text=True)
    print("        " + (r.stdout.strip().splitlines() or ["(no output)"])[0])
    if r.returncode != 0:
        for ln in r.stdout.strip().splitlines()[1:9]:
            print("        " + ln.strip())
        problems.append("rendered audit failed")

    print(f"  [2/{N}] feature coverage …")
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


    if mode == "match":
        # The score and the review exist to reward divergence; in match mode
        # divergence IS the failure, so they are the wrong instrument. The
        # visual match gate replaces both.
        print(f"  [3/{N}] visual match …")
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
            # 'layout' used to be printed here as a percentage. It is an
            # advisory grid comparison, not a score, and printing 34% beside a
            # passing 90% made every report look like a failure.
            print(f"        {'OK' if ok else 'FAILED'} — {d2.get('content')}% content "
                  f"(shape {d2.get('shape', 'n/a')}) vs {d2.get('reference')}"
                  + ("  [captured]" if d2.get("captured") else ""))
            if not ok:
                problems.append(f"the visual match is only {d2.get('content')}% — you were "
                                "asked to reproduce this design, not improve it")
        # The visual match gate counts whether the reference's TEXT survived.
        # It cannot see a fill button built as a ghost one, a 260px field built
        # at 480px, or a toolbar broken onto two rows — all three scored a
        # perfect match. zcat-compare.js measures both sides and diffs them.
        print(f"  [4/{N}] measured compare (look / size / placement) …")
        cmp_f = os.path.join(STATE, sl + ".compare.json")
        fdata = {}
        if os.path.exists(f):
            try:
                fdata = json.load(open(f))
            except Exception:
                fdata = {}
        shot_only = bool(fdata.get("referenceScreenshotOnly"))
        if not os.path.exists(cmp_f):
            if shot_only:
                print("        SKIPPED — the feature receipt says the reference is "
                      "screenshot-only")
                print("        (so look, size and placement rest entirely on the "
                      "STEP 7-M scorecard)")
            else:
                problems.append(
                    "no measured-compare receipt — run: node "
                    f'.claude/hooks/zcat-compare.js "{rel}" <reference> '
                    "--ref-scope=<selector>.  If the reference genuinely cannot be "
                    "rendered, say so explicitly by recording "
                    '"referenceScreenshotOnly": true in the feature receipt')
                print("        MISSING")
        elif os.path.getmtime(cmp_f) < page_mtime:
            problems.append("the measured-compare receipt predates your last edit — re-run it")
            print("        STALE")
        else:
            d3 = json.load(open(cmp_f))
            n = len(d3.get("findings") or [])
            print(f"        {'OK' if d3.get('pass') else 'FAILED'} — "
                  f"{d3.get('paired')} elements paired, {n} measured difference(s)")
            if not d3.get("pass"):
                for fd in (d3.get("findings") or [])[:6]:
                    print(f"          {fd.get('kind')} {fd.get('what')} of "
                          f"\"{fd.get('label')}\": ours {fd.get('mine')}, "
                          f"reference {fd.get('theirs')}")
                problems.append(f"{n} measured difference(s) from the reference "
                                "(look / size / placement)")

        print(f"  [5/{N}] design review … SKIPPED (match mode: reproducing, not composing)")
        print()
        if problems:
            print(f"GATES FAILED — {len(problems)} not green:")
            for pr in problems:
                print(f"  - {pr}")
            sys.exit(1)
        print("GATES PASSED — all green against the current version of this page.")
        sys.exit(0)

    print(f"  [3/{N}] design score …")
    r = subprocess.run([sys.executable, os.path.join(HOOKS, "zcat-design-score.py"), abs_p],
                       capture_output=True, text=True)
    out = r.stdout.strip().splitlines() or ["(no output)"]
    print("        " + out[0])
    if r.returncode != 0:
        for ln in out[1:7]:
            print("        " + ln.strip())
        problems.append("design score failed")

    print(f"  [4/{N}] design review …")
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

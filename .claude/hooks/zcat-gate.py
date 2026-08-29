#!/usr/bin/env python3
"""Stop hook — the finish line.

An agent may not end its turn while any page it touched is unproven. For every
touched page it demands, in order:

  1. a RENDERED audit that PASSES (real geometry: alignment, overflow, overlap,
     collapsed boxes, contrast, CTA count, tab state) — re-run automatically if
     the page changed since the last audit;
  2. a DESIGN REVIEW receipt with real evidence — not a boolean.

Without both, stopping is blocked and the agent is told exactly what is missing.
"""
import json
import os
import subprocess
import sys

HOOKS = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.abspath(os.path.join(HOOKS, "..", ".."))
STATE = os.path.join(HOOKS, ".zcat-state")

slug = lambda rel: rel.replace("/", "__").replace("\\", "__")[:-5]  # drop .html


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}

    # Never loop: if we already blocked once for this stop, let it through.
    if data.get("stop_hook_active"):
        return

    tf = os.path.join(STATE, "touched.json")
    if not os.path.exists(tf):
        return
    try:
        touched = json.load(open(tf))
    except Exception:
        return
    touched = [t for t in touched if os.path.exists(os.path.join(PROJECT, t))]
    if not touched:
        return

    problems, need_audit = [], []
    for rel in touched:
        abs_p = os.path.join(PROJECT, rel)
        audit_f = os.path.join(STATE, slug(rel) + ".json")
        if (not os.path.exists(audit_f) or
                os.path.getmtime(audit_f) < os.path.getmtime(abs_p)):
            need_audit.append(abs_p)

    if need_audit:
        try:
            subprocess.run(
                ["node", os.path.join(HOOKS, "zcat-render-audit.js")] + need_audit,
                cwd=PROJECT, capture_output=True, timeout=180)
        except Exception as e:
            problems.append(f"could not run the rendered audit ({e}) — "
                            f"run it yourself: node .claude/hooks/zcat-render-audit.js <page>")

    for rel in touched:
        abs_p = os.path.join(PROJECT, rel)
        audit_f = os.path.join(STATE, slug(rel) + ".json")
        rev_f = os.path.join(STATE, slug(rel) + ".review.json")

        if not os.path.exists(audit_f):
            problems.append(f"{rel}: never rendered/audited")
            continue
        try:
            a = json.load(open(audit_f))
        except Exception:
            problems.append(f"{rel}: audit file unreadable — re-run the audit")
            continue

        if not a.get("ok"):
            problems.append(f"{rel}: RENDERED AUDIT FAILED ({len(a['fails'])} issue(s)):")
            for f in a["fails"][:8]:
                problems.append(f"     - {f['rule']}: {f['msg']}  @ {f['sel']}")
            if len(a["fails"]) > 8:
                problems.append(f"     - (+{len(a['fails']) - 8} more in {os.path.relpath(audit_f, PROJECT)})")
            continue

        if (not os.path.exists(rev_f) or
                os.path.getmtime(rev_f) < os.path.getmtime(abs_p)):
            problems.append(
                f"{rel}: no DESIGN REVIEW for the current version of this page.\n"
                f"     Look at .claude/hooks/.zcat-state/shots/{slug(rel)}-light.png,\n"
                f"     then record the review:\n"
                f"       python3 .claude/hooks/zcat-review.py \"{rel}\"")

    if problems:
        print(json.dumps({"decision": "block", "reason":
            "You cannot finish yet — these screens are not proven.\n\n"
            + "\n".join(f"  {p}" for p in problems)
            + "\n\nMechanical correctness is not design quality. Fix the rendered "
              "failures, then record a real design review (it requires a reference "
              "screenshot, 3 specific differences from it, and 2 structural ways your "
              "layout diverges from the wireframe). Re-run until this gate is silent."}))
        sys.exit(0)

    # Everything proven — reset for the next screen.
    try:
        os.remove(tf)
    except OSError:
        pass


if __name__ == "__main__":
    main()

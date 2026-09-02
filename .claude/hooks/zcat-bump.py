#!/usr/bin/env python3
"""Raise the cache-busting ?v= everywhere, in one step.

zcat.css is a list of @imports, so a library change only becomes visible once
the version moves — and it has to move in EVERY file that references it, or the
browser keeps serving a cached copy and the page renders against rules that no
longer exist. That is not hypothetical: it is why a Sub Header's buttons
appeared left-aligned when the CSS had said flex-end for weeks.

Bumping by hand missed files twice. The pages sat on ?v=83 for twenty-five
versions, and then on ?v=109 while the library was already on 113. Hence this.

    npm run bump            # report: what is stale
    npm run bump -- --next  # raise everything to the next version
"""
import glob
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# zcat.js carries its OWN version, unrelated to the library's. Only the css
# version tracks the library — comparing the two together reported every
# correct file as stale.
CSS_V = re.compile(r"zcat\.css\?v=(\d+)")
ANY_CSS_V = re.compile(r"(zcat\.css\?v=)(\d+)")
IMPORT_V = re.compile(r"(\.css\?v=)(\d+)")

TARGETS = ["zcat-ui/zcat.css", "zcat-ui/docs/playground.html",
           "zcat-ui/docs/template.html", "README.md"]


def files():
    out = [os.path.join(ROOT, t) for t in TARGETS]
    out += glob.glob(os.path.join(ROOT, "pages", "**", "*.html"), recursive=True)
    return [f for f in out if os.path.exists(f)]


def current():
    s = open(os.path.join(ROOT, "zcat-ui", "zcat.css"), encoding="utf-8").read()
    return max(int(v) for v in re.findall(r"\?v=(\d+)", s))


def main():
    cur = current()
    if "--next" not in sys.argv:
        print(f"library is at ?v={cur}")
        stale = 0
        for f in files():
            s = open(f, encoding="utf-8", errors="replace").read()
            vs = sorted({int(v) for v in CSS_V.findall(s)})
            if vs and vs != [cur]:
                stale += 1
                print(f"  STALE  {os.path.relpath(f, ROOT)} — links ?v={vs[0]}")
        if not stale:
            print("  every file is current")
        print("\nrun `npm run bump -- --next` to raise everything to "
              f"?v={cur + 1}")
        return

    new = cur + 1
    for f in files():
        s = open(f, encoding="utf-8", errors="replace").read()
        n = IMPORT_V.sub(lambda m: m.group(1) + str(new), s)
        n = ANY_CSS_V.sub(lambda m: m.group(1) + str(new), n)
        if n != s:
            open(f, "w", encoding="utf-8").write(n)
            print("bumped", os.path.relpath(f, ROOT))
    print(f"\nnow at ?v={new} — rebuild and redeploy for it to take effect")


if __name__ == "__main__":
    main()

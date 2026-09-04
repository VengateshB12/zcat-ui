#!/usr/bin/env python3
"""Generate docs/snippets.html — the page an agent copies component markup from.

WHY THIS IS GENERATED AND NOT WRITTEN BY HAND
An agent asked to build a popup used to be handed a SENTENCE describing one:
"__header (__title, __desc, no close X), __body, __footer (grey + fill)". It
would type markup from that. Class names came out right, structure came out
invented, and every gate passed because the gates check class names. That is
why popups, empty states and detail views were wrong every single time, and
wrong differently each time.

The fix is to give it the real block to copy. But a hand-maintained file of
component markup is exactly what COMPONENTS.md was, and that went stale and
started teaching markup the library no longer had. So this file is rebuilt from
the real pages on every docs build, and:

  * it only reads pages that pass all four gates,
  * it REFUSES anything that is JavaScript source rather than markup (the
    playground builds its components in JS, so extracting from it yields
    template literals — that shipped once and was visible junk),
  * a component with no reference implementation is OMITTED and reported,
    never invented. If it is missing here, the honest finding is that no real
    page uses it.
"""
import re, os, html, sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Real pages only. NOT playground.html — it generates its components in JS.
SOURCES = ["zcat-ui/docs/template.html",
           "pages/directdb/databases.html",
           "pages/directdb/database-detail.html",
           "pages/directdb/databases-empty.html",
           "pages/samples/pipelines-fullpopup.html",
           "pages/samples/controls.html"]

JS_TELLS = ("${", " r += ", "function(", "){", "=>")

def extract(cls, cap=4200):
    """First balanced element carrying `cls` that is real markup."""
    for path in SOURCES:
        try: s = open(path, encoding="utf-8").read()
        except OSError: continue
        pat = r'<(\w+)([^>]*\bclass="[^"]*\b' + re.escape(cls) + r'\b[^"]*")[^>]*>'
        for m in re.finditer(pat, s):
            tag, i, depth = m.group(1), m.start(), 0
            for t in re.finditer(r"</?" + tag + r"\b[^>]*?(/?)>", s[i:]):
                if t.group(0).startswith("</"): depth -= 1
                elif not t.group(1): depth += 1
                if depth == 0:
                    b = s[i:i + t.end()]
                    if any(j in b for j in JS_TELLS):
                        break                      # JS source, not markup
                    L = b.split("\n")
                    ind = min((len(l) - len(l.lstrip()) for l in L[1:] if l.strip()),
                              default=0)
                    b = "\n".join([L[0]] + [l[ind:] if len(l) > ind else l.lstrip()
                                            for l in L[1:]])
                    if len(b) > cap:
                        b = b[:cap].rsplit("\n", 1)[0] + f"\n<!-- … full block in {path} -->"
                    return b, path
                    break
    return None, None

def glue_for(block, path):
    """The page-glue CSS a block needs to render.

    A snippet that quietly depends on the page it came from is not copyable.
    The create/edit popup uses seven .tpl-* classes defined in template.html's
    own <style>; lifted without them the selection cards lose their sizing and
    a 16px engine icon renders as a 466px illustration — the exact trap our
    rules warn about, produced by our own snippet. So ship the glue with the
    block and say plainly that it is page CSS, not library CSS."""
    names = sorted({c for m in re.findall(r'class="([^"]+)"', block)
                      for c in m.split() if not c.startswith("zc-")})
    if not names: return "", []
    try: src = open(path, encoding="utf-8").read()
    except OSError: return "", []
    css = "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", src, re.S))
    rules = []
    for n in names:
        for m in re.finditer(r"(^|\n)\s*(\.[^\n{]*\b" + re.escape(n) + r"\b[^\n{]*)\{([^}]*)\}", css):
            rules.append(f"{m.group(2).strip()} {{{m.group(3).rstrip()} }}")
    seen, out = set(), []
    for r in rules:
        if r in seen: continue
        seen.add(r); out.append(r)
    return "\n".join(out), names


def variants(cls):
    """The data-* values the CSS actually defines — so 'change the variant'
       is a lookup rather than a guess."""
    out = set()
    d = "zcat-ui/src/components"
    for f in os.listdir(d):
        s = open(os.path.join(d, f), encoding="utf-8").read()
        for m in re.finditer(re.escape("." + cls) + r'\[([a-z-]+)="([a-z0-9-]+)"\]', s):
            out.add(f'{m.group(1)}="{m.group(2)}"')
    return sorted(out)

SPEC = [
 ("EVERYDAY CONTROLS", [
  ("Label", "zc-label", "Wraps its text in a <span>. Never a bare <label>."),
  ("Text field", "zc-input-wrap", "The input always sits inside .zc-input-wrap — a bare <input> loses its focus ring, its states and dark mode."),
  ("Button", "zc-btn", "ONE fill button per screen. Per-row actions are links or ghost buttons."),
  ("Badge", "zc-badge", "Every table status is a Badge. Map each status value to a semantic colour."),
  ("Checkbox", "zc-checkbox", "Label weight: SemiBold when the label is the thing being chosen, Regular when it qualifies something else."),
  ("Chip", "zc-chip", "For filters and multi-select values."),
  ("Key Value field", "zc-kvfield", "Editing in place. Not a form — a form belongs in a popup."),
  ("Radio", "zc-radio", "Label weight: SemiBold when the label is the thing being chosen, Regular when it qualifies something else."),
  ("Toggle", "zc-toggle", "For instant-apply flags. A toggle that needs a Save button should be a checkbox."),
  ("Select", "zc-select-shell", "Never a bare <select>."),
  ("Tabs", "zc-tabs", "Exactly ONE tab is active and the visible content is that tab's. Sub Header tabs carry NO icons."),
  ("Link box", "zc-linkbox", "Copy icon shows a Copy tooltip on hover, Link copied on click."),
  ("Three-dot menu", "zc-menu", "The real menu component, not a hand-made dropdown. It flips up when it would be clipped."),
  ("Attention box", "zc-attention", "A warning or note inside a page. Not a toast."),
 ]),
 ("OVERLAYS", [
  ("Popup — create / edit", "zc-popup-scrim", "The ONLY correct shape for create and edit. NO close X. Footer: Cancel grey left, action fill right. Every control stretches to the body width. Tabs or a Stepper go in the header, under the title — never in the body."),
  ("Full-page popup", "zc-fullpopup", "Only for >8 fields, a wizard, or an embedded table. Unlike the small popup this one DOES close from its header. Page content goes inside __sheet."),
 ]),
 ("STATES", [
  ("Empty state", "zc-empty", "Icon, heading, one line of help, one action. Never a bare 'No data'. Every list page needs one, drawn in the wireframe or not."),
 ]),
 ("PAGE FURNITURE", [
  ("Sub Header", "zc-layout__subheader", "Back Nav + entity name + status badge. Primary tabs live HERE, never floating in the container, and carry no icons."),
  ("Container Header", "zc-cheader", "Goes above ANY content block the requirement calls for — a table, a card grid, a list, a chart panel — not just tables. Heading, Search or filters left; actions right. Never leave an action button floating alone."),
  ("Container Side Menu", "zc-csm", "ONE per page. A second vertical list is RECORDS — a table or card list, not navigation."),
 ]),
 ("DATA", [
  ("Table", "zc-table-wrap", 'The WHOLE ROW clicks: data-rowlink on the <tr>, entity cell plain text. Status is a Badge. data-style="stretch" when the table is alone, "boxy" when it shares the page or sits in a popup.'),
  ("General Details", "zc-gdetails", "Detail pages are READ-ONLY. Values display here; an Edit button opens a popup."),
 ]),
]

sections, missing, count = [], [], 0
for name, items in SPEC:
    rows = []
    for title, cls, note in items:
        b, path = extract(cls)
        if not b:
            missing.append((title, cls)); continue
        count += 1
        v = variants(cls)
        vline = (f'<p class="zc-body-4 src">variants: <code>{html.escape(" ".join(v[:10]))}</code></p>'
                 if v else "")
        gcss, gnames = glue_for(b, path)
        gblock = (f'<p class="zc-body-3 glue-note">This block also needs {len(gnames)} '
                  f'page-glue class(es) — <code>{html.escape(", ".join(gnames))}</code>. '
                  'They are PAGE CSS, not library CSS: copy them into your page\'s '
                  '&lt;style&gt; too, or the block will not lay out.</p>'
                  f'<pre class="glue"><code>{html.escape(gcss)}</code></pre>') if gcss else ""
        rows.append(f'''<section class="snip">
  <h3 class="zc-h6">{html.escape(title)}</h3>
  <p class="zc-body-3 note">{html.escape(note)}</p>
  <p class="zc-body-4 src">verified in <code>{path}</code></p>{vline}
  <div class="live"><style>{gcss}</style>{b}</div>
  <pre><code>{html.escape(b)}</code></pre>
  {gblock}
</section>''')
    if rows:
        sections.append(f'<h2 class="zc-h4 sec">{name}</h2>\n' + "\n".join(rows))

# The icon sprite, merged from EVERY source page. Without it a <use href="#i-…">
# renders an EMPTY BOX — the trap our own rules warn about, which this page fell
# into twice: first with no sprite at all, then with only the template's 27
# symbols while blocks lifted from other pages referenced symbols those pages
# carried. Each page ships the subset it needs, so the union is what this needs.
symbols, seen = [], set()
for path in SOURCES:
    try: txt = open(path, encoding="utf-8").read()
    except OSError: continue
    for sm in re.finditer(r'<symbol\b[^>]*\bid="([^"]+)"[^>]*>.*?</symbol>', txt, re.S):
        if sm.group(1) in seen: continue
        seen.add(sm.group(1)); symbols.append(sm.group(0))
sprite = ('<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
          + "".join(symbols) + "</defs></svg>") if symbols else ""

DOC = f'''<!DOCTYPE html>
<html lang="en" data-theme="light">
<head><meta charset="utf-8">
<title>zcat UI — copy these</title>
<link rel="stylesheet" href="../zcat.css?v=118">
<style>
  body {{ margin:0; padding:32px; background:var(--zc-bg-page);
         color:var(--zc-text-primary); font-family:var(--zc-font); }}
  .wrap {{ max-width:1000px; margin:0 auto; }}
  .sec {{ margin:40px 0 8px; padding-bottom:8px;
          border-bottom:1px solid var(--zc-border-subtle); }}
  .snip {{ margin:24px 0; padding:20px; background:var(--zc-bg-container);
           border:1px solid var(--zc-border-subtle); border-radius:8px; }}
  .note {{ margin:6px 0 4px; color:var(--zc-text-secondary); }}
  .src  {{ margin:0 0 4px; color:var(--zc-text-tertiary); }}
  .live {{ padding:16px; margin:12px 0; background:var(--zc-bg-page);
           border:1px dashed var(--zc-border-subtle); border-radius:6px; }}
  .live > * {{ max-width:100%; }}
  /* A popup scrim is position:fixed, so dropped into a preview box it escapes
     and covers the viewport — which stretched the selection card until its
     16px icon rendered as a 200px illustration, the exact trap our own rules
     warn about. Pin it back into the box for the preview only. */
  .live .zc-popup-scrim {{ position:static; inset:auto; background:none;
                           display:block; padding:0; }}
  .live .zc-popup {{ max-width:414px; margin:0; }}
  .live .zc-fullpopup {{ position:static; inset:auto; }}
  pre {{ margin:0; padding:14px; overflow-x:auto; background:var(--zc-bg-page);
         border:1px solid var(--zc-border-subtle); border-radius:6px; }}
  code {{ font-family:ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size:12px; line-height:20px; }}
  .glue-note {{ margin:14px 0 6px; color:var(--zc-text-secondary); }}
  pre.glue {{ background:var(--zc-bg-container); }}
  .lede {{ padding:16px 20px; background:var(--zc-bg-container);
           border:1px solid var(--zc-border-subtle); border-radius:8px; }}
</style></head><body>
{sprite}
<div class="wrap">
<h1 class="zc-h2">Copy these</h1>
<p class="zc-body-1 lede">Every block below is real markup lifted from a page
that passes all four gates, and this file is REGENERATED on every docs build so
it cannot drift from the library. <strong>Copy the block, rename the content,
change the variant.</strong> Do not rebuild a component from a written
description — that is how popups, empty states and detail views come out subtly
wrong every time, with every class name perfectly correct. If what you need is
not here, copy the closest sibling page and delete what you do not need.</p>
''' + "\n".join(sections) + "\n</div></body></html>\n"

open("zcat-ui/docs/snippets.html", "w", encoding="utf-8").write(DOC)
print(f"snippets.html: {count} components, {sprite.count('<symbol')} icon symbols, "
      f"{len(DOC)} chars (~{len(DOC)/4000:.1f}K tokens)")
if missing:
    print("\nNO REFERENCE IMPLEMENTATION — omitted rather than invented:")
    for t, c in missing:
        print(f"  {t:20s} .{c}  — no real page uses it")

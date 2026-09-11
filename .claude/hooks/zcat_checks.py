#!/usr/bin/env python3
"""Static (text) checks for zcat page files. Extracted so both the PostToolUse
hook and the Stop gate run exactly the same rules."""
import glob
import io
import os
import re

# ── every --zc-* custom property the library actually defines ────────────────
# An UNDEFINED custom property fails SILENTLY in CSS: the whole declaration is
# dropped and the element renders as if the line were never written. That is
# how `--zc-cards-bg-default` shipped — a name invented from the pattern of the
# real ones, which resolved to nothing, so a selected table row had no
# background at all and every gate stayed green. Nothing else in this toolchain
# can see it: the value is not a raw hex, the class names are right, and the
# rendered result just looks like a missing style.
#
# Read from src/ rather than hard-coded, so the list cannot drift, and from ALL
# of src/ rather than only tokens/ because a few properties are declared beside
# the component that consumes them.
_TOKENS = None


def known_tokens():
    global _TOKENS
    if _TOKENS is None:
        root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        names = set()
        pat = os.path.join(root, "zcat-ui", "src", "**", "*.css")
        for p in glob.glob(pat, recursive=True):
            try:
                with io.open(p, encoding="utf-8") as fh:
                    names |= set(re.findall(r"(--zc-[A-Za-z0-9_-]+)\s*:", fh.read()))
            except OSError:
                pass
        _TOKENS = names
    return _TOKENS

RE_RAWCOLOR = re.compile(
    r'(?:color|background(?:-color)?|border(?:-[a-z]+)?-?color|border|fill|'
    r'stroke|box-shadow|outline|caret-color|text-decoration-color)'
    r'\s*[:=]\s*["\']?[^;"\'{}<>]*'
    r'(#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\()', re.I)
RE_SVGCOLOR = re.compile(r'(?:fill|stroke)="(#[0-9a-fA-F]{3,8})"')
RE_ODDPX = re.compile(r'(?<![0-9.])(3|5|7|9|1[13579]|2[13579]|3[13579])px\b')
RE_ZC_RESTYLE = re.compile(r'^\s*\.zc-[A-Za-z0-9_-]+[^{}]*\{')
RE_STATE_OPACITY = re.compile(
    r"(?::hover|:active|:focus|:disabled|\[data-state|\.is-)[^{]*\{[^}]*"
    r"opacity:\s*(?:0?\.\d+|0\.\d+)", re.I)
RE_FONT = re.compile(r'\bfont-(?:size|weight|family)\s*:', re.I)
RE_EMOJI = re.compile('[\U0001F000-\U0001FAFF☀-➿←-⇿■-◿⬀-⯿]')
RE_SIDEMENU_STROKE = re.compile(
    r'zc-sidemenu__item(?:(?!zc-icon-stroke).)*?(fill="none"|stroke-width)')
RE_POPUP_W_CSS = re.compile(r'\.zc-popup[^{}]*\{[^}]*\bwidth\s*:')
RE_POPUP_W_INLINE = re.compile(r'class="[^"]*zc-popup[^"]*"[^>]*style="[^"]*width\s*:')
RE_GROUP_MAXW = re.compile(r'class="[^"]*zc-input-group[^"]*"[^>]*style="[^"]*max-width')


RE_MATCH_MODE = re.compile(r'data-zcat-mode\s*=\s*["\']match["\']', re.I)


def static_issues(path, text, match_mode=None):
    """Return a list of 'line N: RULE -> snippet' strings.

    match_mode: True/False to force it; None (default) means read the page's own
    `data-zcat-mode="match"` declaration. It is declared IN THE PAGE, not in a
    receipt, because this runs on every save — long before any receipt exists —
    and a save-time check cannot consult a document that the build writes at the
    end. It is also visible to anyone opening the file, which a receipt is not.
    """
    lines = text.splitlines()
    is_css = path.lower().endswith(".css")
    if match_mode is None:
        match_mode = bool(RE_MATCH_MODE.search(text))
    issues = []

    def add(n, rule, snip):
        snip = snip.strip()
        if len(snip) > 90:
            snip = snip[:90] + "…"
        issues.append(f"line {n}: {rule} -> {snip}")

    css_line = [is_css] * len(lines)
    if not is_css:
        inside = False
        for i, ln in enumerate(lines):
            if re.search(r"<style\b", ln, re.I):
                inside = True
            css_line[i] = inside or ("style=" in ln)
            if re.search(r"</style>", ln, re.I):
                inside = False

    for i, ln in enumerate(lines, 1):
        idx = i - 1
        if RE_SIDEMENU_STROKE.search(ln):
            add(i, "SIDEMENU STROKE ICON — use class=\"zc-icon-stroke\" (shell.css) or the fill-based glyph", ln)
        if css_line[idx] and RE_POPUP_W_CSS.search(ln):
            add(i, "POPUP WIDTH OVERRIDE — Popup is 550px / 414px (data-size=\"small\"); never widen it", ln)
        if RE_POPUP_W_INLINE.search(ln):
            add(i, "POPUP WIDTH OVERRIDE — Popup is 550px / 414px (data-size=\"small\"); never widen it", ln)
        if RE_GROUP_MAXW.search(ln):
            add(i, "CONSTRAINED FORM FIELD — input groups inside popups stretch full width; drop the max-width", ln)
        m = RE_RAWCOLOR.search(ln)
        if m and "var(--zc-" not in ln[max(0, m.start() - 5):m.end() + 40]:
            add(i, "RAW COLOR — every color must be var(--zc-*)", ln)
        if RE_SVGCOLOR.search(ln) and "currentColor" not in ln:
            add(i, "SVG hex fill/stroke — icons bind to currentColor / var(--zc-*)", ln)
        if css_line[idx]:
            m = RE_ODDPX.search(ln)
            if m:
                add(i, f"ODD PIXEL VALUE {m.group(0)} — use even --zc-space-* tokens", ln)
            if RE_FONT.search(ln):
                add(i, "RAW FONT RULE — use .zc-h*/.zc-subtitle-*/.zc-body-* classes", ln)
            # A state is a COLOUR, never a fade. Opacity dims everything at once
            # — border, focus ring, the lot — cannot be themed light/dark, and
            # silently drops contrast below the 4.5:1 this system enforces.
            if RE_STATE_OPACITY.search(ln):
                add(i, "OPACITY USED FOR A STATE — use a colour token "
                       "(--zc-body-icon-disabled, --zc-*-text-disabled, a hover/active "
                       "bg). Opacity cannot be themed and quietly fails contrast", ln)
        # RESTYLING IS SANCTIONED IN MATCH MODE — the designer's call, 2026-09-09:
        # "Match mode u can restyle as per the given match screens, it should
        # match 100 percentage of size, container, placement alignment and all."
        # In REDESIGN mode the rule stands: a page has no business redefining a
        # shared component. In MATCH mode the given design is the authority and
        # a component default that disagrees with it has to be overridden, so
        # blocking here would make a 100% match impossible.
        # The boundary that remains: the override must live in the PAGE (its own
        # <style> or page CSS), never in zcat-ui/, so no other page inherits it.
        # That is enforced by the read-only guard, not by this rule.
        if RE_ZC_RESTYLE.match(ln) and not match_mode:
            add(i, "RESTYLED zc-* CLASS — never redefine library classes; use "
                   "page-scoped glue classes. (Allowed in MATCH mode: declare "
                   "data-zcat-mode=\"match\" on <html>)", ln)
        m = RE_EMOJI.search(ln)
        if m:
            add(i, f"EMOJI/UNICODE GLYPH '{m.group(0)}' used as icon — use zcat-ui/docs/icons/ stroke icons", ln)

    # UNDEFINED TOKEN — reported once per name, not once per use.
    known = known_tokens()
    if known:
        declared_here = set(re.findall(r"(--zc-[A-Za-z0-9_-]+)\s*:", text))
        seen = set()
        for i, ln in enumerate(lines, 1):
            for name in re.findall(r"var\(\s*(--zc-[A-Za-z0-9_-]+)", ln):
                if name in known or name in declared_here or name in seen:
                    continue
                seen.add(name)
                add(i, "UNDEFINED TOKEN %s — no such custom property anywhere in "
                       "zcat-ui/src/. An undefined var() fails SILENTLY: the whole "
                       "declaration is dropped and the element renders unstyled. Pick "
                       "the token by its VALUE from src/tokens/colors.css, never by "
                       "guessing a name that fits the pattern" % name, ln)

    if re.search(r"lorem\s+ipsum", text, re.I):
        issues.append("LOREM IPSUM found — use realistic sample data "
                      "(AI Automation/references/sample-data.md)")
    if path.lower().endswith(".html") and "zcat.css" not in text:
        issues.append("PAGE DOES NOT INCLUDE zcat.css — pages must load the library as-is")
    return issues

#!/usr/bin/env python3
"""The library, the rules and the gates are read-only to an AI agent.

Screen development writes ONE kind of file: a page. Everything else in this
repo — the component library, the prompt, the skill, the gates themselves — is
shared by everyone building screens, and a change to any of it silently changes
what every future build is allowed to do. An agent halfway through a screen is
the worst possible position from which to make that call: it has one page's
worth of context and a deadline, so "the gate is wrong" always looks more
likely than "my page is wrong".

So an agent may not edit them. The designer may, and does, by unlocking.

This runs at PreToolUse, so the write is PREVENTED rather than reported after
the fact. It covers Write/Edit/MultiEdit and the Bash equivalents (redirects,
sed -i, cp, mv, rm).

To unlock for a maintenance session, the DESIGNER creates the marker:

    touch .zcat-unlock          # then: rm .zcat-unlock when done

That is deliberately a thing a human does at a terminal, not something an agent
should do for itself. This is a guard rail, not a lock: an agent that decided to
remove the marker could. The point is that doing so is a visible, deliberate act
rather than an edit that slips by inside a screen build.
"""
import json
import os
import re
import sys

HOOKS = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.abspath(os.path.join(HOOKS, "..", ".."))
UNLOCK = os.path.join(PROJECT, ".zcat-unlock")

# Read-only to an agent. Anything not listed here is fair game — which in
# practice means pages/, the scratchpad and the generated slate-docs/ build.
PROTECTED = [
    ("zcat-ui/",       "the component library, the prompt and the skill"),
    (".claude/hooks/", "the gates — the thing that decides whether a build passes"),
    (".claude/settings.json", "the hook wiring"),
    ("AI Automation/", "the Figma design project (a separate project entirely)"),
    ("CLAUDE.md",      "the mode router"),
    ("HANDOFF.md",     "the library's build history"),
    ("README.md",      "the published README"),
    ("package.json",   "the project's scripts"),
    ("build-docs-site.sh", "the docs build"),
    ("catalyst.json",  "the deploy config"),
]

# Deciding whether a Bash command WRITES to a protected path is the whole job,
# and looking for "a write verb somewhere and the path somewhere" is not it.
# That blunt test refused three legitimate things in a row: a `find` whose
# "2>/dev/null" read as a redirect, `./build-docs-site.sh` (running a protected
# script is not writing to it), and a `grep` whose quoted PATTERN happened to
# contain "rm -rf".
#
# So we look at the command word. A shell line is split into segments on | ; &&
# ||, and only a segment whose FIRST word is a write command counts — words
# inside a quoted argument never do. Redirects are checked separately, since
# `> file` writes whatever the command word is.
NOISE = re.compile(r"\d?>>?\s*(/dev/null|&\d)")      # 2>/dev/null, 2>&1, >&2
WRITE_VERBS = {"tee", "cp", "mv", "rm", "install", "truncate", "dd", "mkdir",
               "touch", "chmod", "chown", "ln", "rsync", "unlink", "rmdir"}


def segments(cmd):
    """Split a shell line into command segments on | ; && || and newlines."""
    return [x for x in re.split(r"\|\||&&|[|;\n]", cmd) if x.strip()]


def command_word(seg):
    """First real word of a segment: skip env assignments, sudo, and `then`
    style keywords. Returns '' if the segment starts with a quote."""
    for tok in seg.strip().split():
        if re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", tok):     # FOO=bar prefix
            continue
        if tok in ("sudo", "command", "exec", "then", "do", "else", "!"):
            continue
        return tok.strip("\\").split("/")[-1]
    return ""


def writes_to(seg, token):
    """Does this ONE segment write to the path matching `token`?"""
    if re.search(r">>?\s*['\"]?" + token, seg):           # > path / >> path
        return True
    verb = command_word(seg)
    if verb == "sed" and not re.search(r"\s-i\b|\s-\w*i\w*\b", seg):
        return False                                        # sed without -i reads
    if verb == "git":
        if not re.search(r"\bgit\s+(checkout|restore|apply|reset|clean)\b", seg):
            return False
    elif verb != "sed" and verb not in WRITE_VERBS:
        return False
    return bool(re.search(token, seg))


def deny(reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": reason}}))
    sys.exit(0)


def protected_for(path):
    """Return the (prefix, description) this path falls under, or None."""
    try:
        rel = os.path.relpath(os.path.abspath(path), PROJECT)
    except ValueError:
        return None
    if rel.startswith(".."):
        return None                      # outside the project — not ours to guard
    rel = rel.replace(os.sep, "/")
    for prefix, what in PROTECTED:
        if rel == prefix.rstrip("/") or rel.startswith(prefix):
            return (prefix, what)
    return None


def refuse(prefix, what, how):
    deny(
        f"READ-ONLY TO AI: {prefix} is {what}.\n\n"
        f"{how}\n\n"
        "Screen development writes pages and nothing else. These files are shared "
        "by everyone building screens, so changing one changes what every future "
        "build is allowed to do — that is the designer's call, not a call to make "
        "from inside a single page build.\n\n"
        "If you believe one of these files is genuinely wrong, STOP and say so, "
        "with the evidence. Do not work around it, and do not remove the unlock "
        "marker's absence by creating it yourself. The designer unlocks with:\n"
        "    touch .zcat-unlock")


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return                            # never break the session on bad input

    if os.path.exists(UNLOCK):
        return                            # designer has unlocked this session

    tool = data.get("tool_name") or ""
    ti = data.get("tool_input") or {}

    if tool in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
        fp = ti.get("file_path") or ti.get("notebook_path") or ""
        hit = protected_for(fp) if fp else None
        if hit:
            refuse(hit[0], hit[1], f"Refused: {tool} on {fp}")

    elif tool == "Bash":
        probe = NOISE.sub(" ", ti.get("command") or "")
        for seg in segments(probe):
            for prefix, what in PROTECTED:
                token = re.escape(prefix.rstrip("/")).replace(r"\ ", r"[ _]")
                if writes_to(seg, token):
                    refuse(prefix, what,
                           "Refused: a Bash command that writes into it.")


if __name__ == "__main__":
    main()

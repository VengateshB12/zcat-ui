#!/usr/bin/env node
/* MATCH COMPARATOR — does the build actually look like the reference?
 *
 *   node .claude/hooks/zcat-compare.js <page.html> <reference> \
 *        [--scope=<sel>] [--ref-scope=<sel>]
 *
 * The gap this closes, in the designer's words: "our gate should verify that
 * everything is placed in the same size and the same place."
 *
 * Nothing did. zcat-match.js counts whether the reference's TEXT survived, and
 * its grid comparison is coarse and explicitly not scored. So a solid blue
 * `data-variant="fill"` button where the reference has a pale ghost one scored
 * a perfect match, because both say "Add Index". A 520px search field where the
 * reference has 440px scored a perfect match. A search box sharing a row with
 * the button, where the reference puts it on its own row, scored a perfect
 * match. Three real defects, all invisible, all reported green.
 *
 * zcat-extract.js measures ONE side and hands you a spec to build from. This
 * measures BOTH and diffs them. It uses that file's probe and token tables by
 * require, deliberately: two copies of a measurement drift, and an extractor
 * and a comparator that disagree about the same page is worse than neither.
 *
 * HOW ELEMENTS ARE PAIRED. Not by selector — two different documents share
 * none. By visible TEXT. A label is the one thing the same element carries on
 * both sides, so "Add Index" in the build is compared against "Add Index" in
 * the reference. Text present on one side only is reported as unmatched and
 * left to zcat-match.js, which is the tool for absence.
 *
 * WHAT IS COMPARED, and why these and not pixels:
 *   LOOK   background, text colour, border width and colour, radius. This is
 *          what catches fill-vs-ghost, which no other check can see.
 *   SIZE   height, width, font size and weight.
 *   PLACE  relationally, never in absolute coordinates. Two documents differ in
 *          height, chrome and content length, so absolute positions disagree
 *          for reasons that have nothing to do with the design. What does carry
 *          over is how elements sit relative to EACH OTHER:
 *            ROW      do these two share a row here but not there?
 *            ALIGN    are these two left-aligned here but not there?
 *            ORDER    has their reading order flipped?
 *          Those three are exactly the "same place" the designer means, and
 *          they survive a reference that is a different size from the build.
 *
 * Exit 0 when every paired element matches within tolerance, 1 otherwise.
 */
const fs = require("fs"), path = require("path");
const X = require("./zcat-extract.js");

const HOOKS = __dirname;
const PROJECT = path.resolve(HOOKS, "..", "..");
const STATE = path.join(HOOKS, ".zcat-state");

/* Tolerances. Each is set at the point where a DESIGNER would call it a
   difference, then checked against a page compared with itself, which must
   come back with zero findings. A tolerance tuned any tighter reports font
   hinting and sub-pixel layout as defects, which is how a gate loses its
   authority. */
const TOL = {
  color: 8,      // RGB distance. Our own token steps are far wider than this.
  size: 2,       // px, heights
  width: 8,      // px, widths move with content and scrollbars
  radius: 1,     // px
  border: 0.6,   // px
  font: 0.6,     // px
  weight: 50,    // CSS weight steps are 100 apart
  align: 3,      // px, "left edges line up"
};

const norm = s => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/* A reference spec writes colours as #RRGGBB; a rendered page reports
   rgb(...). Accept both so one diff serves both sources. */
const toHex = v => {
  if (typeof v !== "string") return null;
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toUpperCase();
  if (/^transparent$/i.test(v)) return "transparent";
  return X.hex(v);
};
const slug = f => path.relative(PROJECT, f).replace(/[\/\\]/g, "__").replace(/\.html$/, "");

/* anchors: the elements a layout is actually built out of */
const isAnchor = e => e.btn || e.input || (e.leaf && e.txt && e.fs >= 12);

function sameRow(a, b) {
  const ac = a.y + a.h / 2, bc = b.y + b.h / 2;
  return Math.abs(ac - bc) <= Math.max(6, Math.min(a.h, b.h) / 2);
}

(async () => {
  const argv = process.argv.slice(2);
  const flags = argv.filter(a => a.startsWith("--"));
  const [pageArg, refArg] = argv.filter(a => !a.startsWith("--"));
  const flag = n => { const f = flags.find(a => a.startsWith("--" + n + "=")); return f ? f.slice(n.length + 3) : null; };
  if (!pageArg || (!refArg && !argv.some(a => a.startsWith("--ref-spec=")))) {
    console.log(fs.readFileSync(__filename, "utf8").split("*/")[0].replace(/^\/\*\s?/, ""));
    process.exit(1);
  }
  const abs = path.resolve(pageArg);
  const rel = path.relative(PROJECT, abs);
  if (!fs.existsSync(abs)) { console.log(`ERROR: no such page: ${rel}`); process.exit(1); }

  /* THREE KINDS OF REFERENCE, one comparison.
     A design does not always arrive as a web page. Sometimes it is Figma.
     Figma cannot be rendered by this script, and it does not need to be: it
     already holds the DESIGN values, which are better evidence than a
     browser's computed ones. So the agent reads Figma through the Figma MCP
     and writes a normalised spec file, and this script diffs the build against
     THAT. The comparison logic is identical either way; only where the
     reference numbers come from changes.
       --ref-spec=<file.json>   a spec written from Figma (or by hand)
       <reference> as a URL     a live page
       <reference> as .html     a page saved into this repo (past a login)
     Spec shape: { source, scope, elements: [ { label, kind, bg, fg,
     borderWidth, borderColor, radius, w, h, fontSize, fontWeight, padding:
     [t,r,b,l], gap, x, y } ] }. Every field is optional except label —
     whatever you supply is what gets compared, and nothing else is invented. */
  const specPath = flag("ref-spec");
  let refUrl = refArg, refLocal = null;
  if (specPath) {
    refUrl = null;
  } else if (!/^https?:\/\//.test(refArg)) {
    const rabs = path.resolve(refArg);
    const inside = !path.relative(PROJECT, rabs).startsWith("..");
    if (!/\.html?$/i.test(rabs) || !fs.existsSync(rabs) || !inside) {
      console.log("ERROR: the reference must be a URL, or a captured .html saved inside\n" +
                  "this repo. A screenshot has no computed styles, so there is nothing to\n" +
                  "compare — save the page instead, or score it by eye in STEP 7-M.");
      process.exit(1);
    }
    refLocal = rabs;
  }

  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch (e) { console.log("ERROR: playwright missing — run: npm run setup"); process.exit(1); }

  const buildScope = flag("scope") || ".zc-layout__container";
  const refScope = flag("ref-scope") || flag("scope") || "body";

  const srv = await X.serve(PROJECT);
  const port = srv.address().port;
  const browser = await chromium.launch();

  /* The pages stay OPEN: the state pass has to drive hover and focus on them,
     and a resting-only comparison is how the shared row-hover band shipped
     missing. */
  async function look(url, scope) {
    const p = await browser.newPage({ viewport: X.VIEWPORT });
    await p.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(1200);
    const d = await p.evaluate(X.PROBE.replace(/__ZC_SCOPE__/g, JSON.stringify(scope)));
    return { d, p };
  }

  /* A spec's numbers are plain values; the probe's are CSS strings. Normalise
     the spec into the probe's shape once, here, so every diff below is written
     against one record type and cannot drift between the two sources. */
  const px = v => (v === undefined || v === null) ? undefined : `${v}px`;
  function fromSpec(file) {
    const raw = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
    const els = (raw.elements || []).map((e, i) => ({
      pid: i + 1, tag: e.kind === "field" ? "input" : (e.kind || "div"),
      role: "", txt: e.label || "", leaf: true,
      btn: e.kind === "button", input: e.kind === "field",
      ph: e.placeholder || "", type: e.kind === "field" ? "text" : "",
      surface: true,
      x: e.x, y: e.y, sw: raw.width, sh: raw.height,
      w: e.w, h: e.h,
      bg: e.bg, fg: e.fg, bc: e.borderColor,
      bw: px(e.borderWidth), bwl: px(e.borderWidth),
      bs: "solid", radius: px(e.radius),
      pad: Array.isArray(e.padding) ? e.padding.map(v => `${v}px`).join(" ") : undefined,
      /* undefined, NOT "" — an omitted gap means "not specified", and "" was
         being read as a positive claim of "no gap", which reported every
         component's real gap as a difference. */
      gap: e.gap === undefined ? undefined : `${e.gap}px`,
      display: "block", dir: "row",
      fs: e.fontSize, fw: e.fontWeight, lh: px(e.lineHeight),
      bgImage: "",
    }));
    return { raw, els };
  }

  let A, B, pageA, pageB, specMeta = null;
  try {
    const ra = await look(`http://localhost:${port}/${rel.split(path.sep).join("/")}`, buildScope);
    A = ra.d; pageA = ra.p;
    if (specPath) {
      const sp = fromSpec(specPath);
      B = sp.els; specMeta = sp.raw; pageB = null;
    } else {
      const refTarget = refLocal
        ? `http://localhost:${port}/${path.relative(PROJECT, refLocal).split(path.sep).join("/")}`
        : refUrl;
      const rb = await look(refTarget, refScope);
      B = rb.d; pageB = rb.p;
    }
  } catch (e) {
    console.log("ERROR reading the reference: " + e.message);
    await browser.close(); srv.close(); process.exit(1);
  }

  const findingsPre = [];

  /* ── pair by visible text; keep the FIRST of any repeated label ────────── */
  const index = list => {
    const m = new Map();
    for (const e of list) {
      if (!e.txt) continue;
      const k = norm(e.txt);
      if (k.length < 2) continue;
      if (!m.has(k)) m.set(k, e);
    }
    return m;
  };
  const ia = index(A), ib = index(B);
  const pairs = [];
  for (const [k, b] of ib) if (ia.has(k)) pairs.push({ k, a: ia.get(k), b, label: b.txt });

  /* FIELDS have no textContent to pair on — their visible words are a
     placeholder, and the two sides often word it differently ("Search indexes"
     vs "Search"). Pairing on that would miss the field whenever the wording
     differs, which is exactly when someone also got the SIZE wrong. So fields
     pair POSITIONALLY: the nth field of a given type in reading order. If the
     two sides carry different numbers of fields, say so and pair the overlap
     rather than silently comparing a field against the wrong one. */
  const fields = list => list.filter(e => e.input && e.type !== "hidden")
    .sort((p, q) => (p.y - q.y) || (p.x - q.x));
  const fa = fields(A), fb = fields(B);
  /* Same reasoning: a spec listing only buttons makes no claim about fields.
     Only compare the count when the reference actually enumerates them. */
  if (fa.length !== fb.length && (!specMeta || fb.length > 0))
    findingsPre.push({ kind: "SIZE", label: "(field count)", what: "number of fields",
                       mine: fa.length, theirs: fb.length });
  for (let i = 0; i < Math.min(fa.length, fb.length); i++)
    pairs.push({ k: "field#" + i, a: fa[i], b: fb[i],
                 label: `field ${i + 1} of ${fb.length}` +
                        (fb[i].ph ? ` ("${fb[i].ph}")` : "") });

  const findings = findingsPre;
  const add = (kind, label, what, mine, theirs) =>
    findings.push({ kind, label, what, mine: String(mine), theirs: String(theirs) });

  /* ── LOOK and SIZE, per paired element ────────────────────────────────── */
  for (const { a, b, label } of pairs) {
    const c = (x, y) => {
      if (x === undefined || y === undefined) return 0;   // spec omitted it
      const hx = toHex(x), hy = toHex(y);
      if (!hx || !hy) return 0;
      if (hx === "transparent" || hy === "transparent") return hx === hy ? 0 : 99;
      return X.dist(hx, hy);
    };
    const show = v => toHex(v) || v;
    if (c(a.bg, b.bg) > TOL.color) add("LOOK", label, "background", show(a.bg), show(b.bg));
    if (c(a.fg, b.fg) > TOL.color) add("LOOK", label, "text colour", show(a.fg), show(b.fg));
    if (Math.abs(parseFloat(a.bw) - parseFloat(b.bw)) > TOL.border)
      add("LOOK", label, "border width", a.bw, b.bw);
    else if (parseFloat(b.bw) > 0 && c(a.bc, b.bc) > TOL.color)
      add("LOOK", label, "border colour", show(a.bc), show(b.bc));
    if (Math.abs(parseFloat(a.radius) - parseFloat(b.radius)) > TOL.radius)
      add("LOOK", label, "radius", a.radius, b.radius);
    if (Math.abs(a.h - b.h) > TOL.size) add("SIZE", label, "height", a.h + "px", b.h + "px");
    if ((a.btn || a.input) && Math.abs(a.w - b.w) > TOL.width)
      add("SIZE", label, "width", a.w + "px", b.w + "px");
    if (a.ph !== b.ph && (a.ph || b.ph))
      add("LOOK", label, "placeholder", `"${a.ph}"`, `"${b.ph}"`);
    if (Math.abs(a.fs - b.fs) > TOL.font) add("SIZE", label, "font size", a.fs + "px", b.fs + "px");
    if (Math.abs(a.fw - b.fw) > TOL.weight) add("SIZE", label, "font weight", a.fw, b.fw);
    if (parseFloat(a.lh) && parseFloat(b.lh) &&
        Math.abs(parseFloat(a.lh) - parseFloat(b.lh)) > TOL.font)
      add("SIZE", label, "line height", a.lh, b.lh);
    /* Padding and gap decide whether a component sits at the right density,
       and they are the values a build inherits from a component default
       without ever checking them against the reference. */
    /* Every spec field is optional. An omitted field means "not specified",
       which must compare as SILENT — never as a difference, and never as a
       crash. A spec that lists only button colours should report only button
       colours. */
    if (a.pad && b.pad && a.pad !== b.pad) {
      const pa = a.pad.split(" ").map(parseFloat), pb = b.pad.split(" ").map(parseFloat);
      if (pa.some((v, i) => isFinite(pb[i]) && Math.abs(v - pb[i]) > TOL.size))
        add("SIZE", label, "padding", a.pad, b.pad);
    }
    if (b.gap !== undefined && (a.gap || b.gap) &&
        Math.abs((parseFloat(a.gap) || 0) - (parseFloat(b.gap) || 0)) > TOL.size)
      add("SIZE", label, "gap", a.gap || "none", b.gap || "none");
  }

  /* ── PLACE, relationally, over the structural anchors only ────────────── */
  /* Anchors in the REFERENCE's reading order, not in pairing order. Field
     pairs are appended after the text pairs, so an insertion-order cap dropped
     every field — and the fields are the whole point of a placement check.
     That bug made this section report "clean" on a page whose toolbar had
     visibly broken onto two rows. 60 anchors is 1,770 comparisons, which costs
     nothing; the cap only exists so a huge page cannot blow up. */
  /* Placement needs coordinates on BOTH sides. A Figma-sourced spec that
     omits x/y is simply not making a placement claim, and inventing one from
     NaN would report every pair as misplaced. */
  const anchors = pairs
    .filter(p => isAnchor(p.b) && isFinite(p.b.x) && isFinite(p.b.y) &&
                 isFinite(p.a.x) && isFinite(p.a.y))
    .sort((p, q) => (p.b.y - q.b.y) || (p.b.x - q.b.x))
    .slice(0, 60);
  for (let i = 0; i < anchors.length; i++) {
    for (let j = i + 1; j < anchors.length; j++) {
      const p = anchors[i], q = anchors[j];
      const rowA = sameRow(p.a, q.a), rowB = sameRow(p.b, q.b);
      if (rowA !== rowB)
        add("PLACE", `${p.label} / ${q.label}`, "share a row",
            rowA ? "same row" : "different rows", rowB ? "same row" : "different rows");
      else if (!rowB) {
        const alA = Math.abs(p.a.x - q.a.x) <= TOL.align, alB = Math.abs(p.b.x - q.b.x) <= TOL.align;
        if (alA !== alB)
          add("PLACE", `${p.label} / ${q.label}`, "left edges",
              alA ? "aligned" : "not aligned", alB ? "aligned" : "not aligned");
      }
      const ordA = (p.a.y - q.a.y) || (p.a.x - q.a.x);
      const ordB = (p.b.y - q.b.y) || (p.b.x - q.b.x);
      if (ordA !== 0 && ordB !== 0 && Math.sign(ordA) !== Math.sign(ordB))
        add("PLACE", `${p.label} / ${q.label}`, "reading order", "reversed", "as referenced");
    }
  }

  /* ── STATE MATRIX — resting is not the screen ─────────────────────────── */
  /* A build once shipped without the hover band that spans each key row,
     because only resting states were ever captured. Nothing measured a state
     nobody had triggered. This drives hover and focus on the SAME element on
     both pages and diffs what changed. */
  const STATE_CAP = 20;
  const stateful = pairs
    .filter(p => p.b.btn || p.b.input || p.b.tag === "tr" || p.b.tag === "a")
    .slice(0, STATE_CAP);

  async function stateOf(pg, pid, how) {
    const sel = `[data-zc-probe="${pid}"]`;
    try {
      if (how === "hover") await pg.hover(sel, { timeout: 2500 });
      else await pg.$eval(sel, el => el.focus && el.focus());
      await pg.waitForTimeout(140);
      return await pg.$eval(sel, el => {
        const c = getComputedStyle(el);
        return { bg: c.backgroundColor, fg: c.color, bc: c.borderTopColor,
                 bw: c.borderTopWidth, sh: c.boxShadow, ol: c.outlineColor };
      });
    } catch (e) { return null; }
  }

  /* Hover and focus can only be driven on a rendered page. A Figma file has
     no interaction states in it, so with a spec reference this pass is skipped
     and SAID to be skipped — those states then rest on the scorecard. */
  const canDoStates = !!pageB;
  if (!flags.includes("--no-states") && canDoStates) {
    for (const how of ["hover", "focus"]) {
      for (const { a, b, label } of stateful) {
        const sa = await stateOf(pageA, a.pid, how);
        const sb2 = await stateOf(pageB, b.pid, how);
        if (!sa || !sb2) continue;
        const cd = (x, y) => {
          const hx = X.hex(x), hy = X.hex(y);
          if (!hx || !hy) return 0;
          if (hx === "transparent" || hy === "transparent") return hx === hy ? 0 : 99;
          return X.dist(hx, hy);
        };
        const show = v => X.hex(v) || v;
        if (cd(sa.bg, sb2.bg) > TOL.color)
          add("STATE", label, `${how} background`, show(sa.bg), show(sb2.bg));
        if (cd(sa.fg, sb2.fg) > TOL.color)
          add("STATE", label, `${how} text colour`, show(sa.fg), show(sb2.fg));
        if (parseFloat(sb2.bw) > 0 && cd(sa.bc, sb2.bc) > TOL.color)
          add("STATE", label, `${how} border colour`, show(sa.bc), show(sb2.bc));
        if ((sa.sh === "none") !== (sb2.sh === "none"))
          add("STATE", label, `${how} shadow`, sa.sh === "none" ? "none" : "present",
              sb2.sh === "none" ? "none" : "present");
      }
      await pageA.mouse.move(0, 0); await pageB.mouse.move(0, 0);
    }
  }

  await browser.close(); srv.close();

  /* ── report ───────────────────────────────────────────────────────────── */
  const onlyRef = [...ib.keys()].filter(k => !ia.has(k)).length;
  console.log(`MATCH COMPARE — ${rel}`);
  console.log(`  reference: ${specMeta
    ? `${specPath} (spec` + (specMeta.source ? ` from ${specMeta.source}` : "") + ")"
    : refLocal ? path.relative(PROJECT, refLocal) + " (captured)" : refUrl}`);
  if (specMeta && !canDoStates)
    console.log("  states   : NOT CHECKED — a spec has no hover or focus to drive; " +
                "score them by eye in STEP 7-M");
  console.log(`  scope    : build ${buildScope}  vs  reference ${refScope}`);
  console.log(`  paired   : ${pairs.length} elements by visible text` +
              (onlyRef ? `  (${onlyRef} reference labels not in the build — that is zcat-match.js's job)` : ""));
  console.log("");

  const byKind = k => findings.filter(f => f.kind === k);
  for (const kind of ["LOOK", "SIZE", "PLACE", "STATE"]) {
    if (kind === "STATE" && (!canDoStates || flags.includes("--no-states"))) continue;
    const fs2 = byKind(kind);
    const title = { LOOK: "LOOK — colour, border, radius", SIZE: "SIZE — height, width, type",
                    PLACE: "PLACE — row grouping, alignment, order",
                    STATE: `STATE — hover and focus, ${stateful.length} interactive element(s)` }[kind];
    console.log(`  ${title}: ${fs2.length ? fs2.length + " difference(s)" : "clean"}`);
    for (const f of fs2.slice(0, 14))
      console.log(`     ${f.what} of "${f.label}": ours ${f.mine}, reference ${f.theirs}`);
    if (fs2.length > 14) console.log(`     (+${fs2.length - 14} more)`);
  }
  console.log("");

  fs.mkdirSync(STATE, { recursive: true });
  fs.writeFileSync(path.join(STATE, slug(abs) + ".compare.json"), JSON.stringify({
    reference: refLocal ? path.relative(PROJECT, refLocal) : refUrl,
    buildScope, refScope, paired: pairs.length, unmatchedInReference: onlyRef,
    findings, pass: findings.length === 0, _page_mtime: fs.statSync(abs).mtimeMs,
  }, null, 1));

  if (findings.length) {
    console.log(`COMPARE FAILED — ${findings.length} measured difference(s) from the reference.`);
    console.log("Each line is a value read off both pages, not an opinion. Fix the build,");
    console.log("or record the difference as deliberate on the STEP 7-M scorecard row.");
    process.exit(1);
  }
  console.log("COMPARE PASSED — every paired element matches in look, size and placement.");
  console.log("It can only check elements it could PAIR by text: run zcat-match.js for what");
  console.log("is missing entirely, and still look at both screenshots.");
})();

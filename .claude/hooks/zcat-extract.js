#!/usr/bin/env node
/* REFERENCE EXTRACTOR — for MATCH mode, and it runs BEFORE the build.
 *
 *   node .claude/hooks/zcat-extract.js <reference> [--scope=<sel>] [--out=<file>]
 *
 *   <reference>  a URL, or a captured .html saved inside this repo
 *                (File > Save Page As, for a screen behind a login)
 *
 * Why this exists. MATCH mode kept producing screens whose class names were all
 * correct and whose pixels were not: 32px fields built at 36, a 1px border
 * missing, a fill button built as outline, an 8px radius built at 6. The agent
 * had the reference open and DID look at it, then built from what it remembered
 * seeing. Every one of those is invisible in isolation and obvious side by side.
 *
 * Looking is not measuring. This reads the reference's own computed styles and
 * writes down every distinct recipe on the page — surface, border, radius,
 * padding, gap, type, and every button variant — with the `--zc-*` token that
 * each raw value maps to. The build then has numbers to hit instead of a memory
 * to reconstruct, and STEP 7-M has something to check against.
 *
 * It maps to OUR token layer on purpose. A raw hex is not the deliverable: the
 * page has to be built from zcat tokens, so anything the scales cannot express
 * is called out as NO TOKEN MATCH rather than quietly rounded. That is the one
 * case MATCH mode must escalate instead of deciding.
 *
 * Exit 0 always when it renders — this is an instrument, not a gate.
 */
const fs = require("fs"), path = require("path"), http = require("http");

const HOOKS = __dirname;
const PROJECT = path.resolve(HOOKS, "..", "..");
const SRC = path.join(PROJECT, "zcat-ui", "src");
const VIEWPORT = { width: 1440, height: 900 };

/* ── the token layer, read from the CSS so it can never drift ────────────── */
function lightBlock(file) {
  const s = fs.readFileSync(file, "utf8");
  const i = s.indexOf("@media (prefers-color-scheme: dark)");
  return i > 0 ? s.slice(0, i) : s;
}
function decls(css, re) {
  const out = {};
  for (const m of css.matchAll(re)) if (!(m[1] in out)) out[m[1]] = m[2];
  return out;
}
const COLORS = decls(lightBlock(path.join(SRC, "tokens", "colors.css")),
  /^\s*(--zc-[a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})\s*;/gm);
const SPACE = decls(fs.readFileSync(path.join(SRC, "tokens", "spacing.css"), "utf8"),
  /^\s*(--zc-space-[0-9]+)\s*:\s*([0-9.]+)px\s*;/gm);
const RADIUS = decls(fs.readFileSync(path.join(SRC, "tokens", "spacing.css"), "utf8"),
  /^\s*(--zc-radius-[a-z0-9]+)\s*:\s*([0-9.]+)px\s*;/gm);
const BORDER = decls(fs.readFileSync(path.join(SRC, "tokens", "spacing.css"), "utf8"),
  /^\s*(--zc-border-[a-z]+)\s*:\s*([0-9.]+)px\s*;/gm);

/* type scale: class -> size/weight, straight out of typography.css */
const TYPE = (() => {
  const css = fs.readFileSync(path.join(SRC, "tokens", "typography.css"), "utf8");
  const out = [];
  for (const m of css.matchAll(/^\.(zc-[a-z0-9-]+)\s*\{([^}]*)\}/gm)) {
    const b = m[2];
    const size = /font-size:\s*([0-9.]+)px/.exec(b);
    const weight = /font-weight:\s*([0-9]+)/.exec(b);
    if (size) out.push({ cls: m[1], size: +size[1], weight: weight ? +weight[1] : 400 });
  }
  return out;
})();

/* ── mapping raw values onto the scales ─────────────────────────────────── */
const hex = rgb => {
  const m = /rgba?\(([0-9.]+),\s*([0-9.]+),\s*([0-9.]+)(?:,\s*([0-9.]+))?\)/.exec(rgb || "");
  if (!m) return null;
  if (m[4] !== undefined && +m[4] === 0) return "transparent";
  return "#" + [1, 2, 3].map(i => (+m[i]).toString(16).padStart(2, "0")).join("").toUpperCase();
};
const dist = (a, b) => {
  const p = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
  const [x, y, z] = p(a), [u, v, w] = p(b);
  return Math.sqrt((x - u) ** 2 + (y - v) ** 2 + (z - w) ** 2);
};
const NO_MATCH = [];
function colorToken(rgb, what) {
  const h = hex(rgb);
  if (!h || h === "transparent") return h === "transparent" ? "transparent" : null;
  let best = null, bd = Infinity;
  for (const [name, val] of Object.entries(COLORS)) {
    const d = dist(h, val.toUpperCase());
    if (d < bd) { bd = d; best = name; }
  }
  if (bd === 0) return `${h} = ${best}`;
  if (bd <= 8) return `${h} ~ ${best} (off by ${bd.toFixed(0)})`;
  NO_MATCH.push(`${what}: ${h} — nearest token ${best} is ${bd.toFixed(0)} away`);
  return `${h} NO TOKEN MATCH (nearest ${best})`;
}
function stepToken(px, table, what) {
  const v = parseFloat(px);
  if (!isFinite(v)) return null;
  if (v === 0) return "0";
  let best = null, bd = Infinity;
  for (const [name, val] of Object.entries(table)) {
    const d = Math.abs(v - parseFloat(val));
    if (d < bd) { bd = d; best = name; }
  }
  if (bd === 0) return `${v}px = ${best}`;
  if (bd <= 1) return `${v}px ~ ${best}`;
  NO_MATCH.push(`${what}: ${v}px — nearest step ${best}`);
  return `${v}px OFF SCALE (nearest ${best})`;
}
function typeClass(size, weight) {
  let best = null, bd = Infinity;
  for (const t of TYPE) {
    const d = Math.abs(t.size - size) * 10 + Math.abs(t.weight - weight) / 100;
    if (d < bd) { bd = d; best = t; }
  }
  return best ? `.${best.cls}` : "(no class)";
}

/* ── what to read off every visible element ─────────────────────────────── */
const PROBE = `(() => {
  const scopeEl = document.querySelector(__ZC_SCOPE__) || document.body;
  const vis = el => {
    const r = el.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) return false;
    const c = getComputedStyle(el);
    return c.visibility !== "hidden" && c.display !== "none" && c.opacity !== "0";
  };
  const out = [];
  const sb = scopeEl.getBoundingClientRect();
  let probeId = 0;
  for (const el of scopeEl.querySelectorAll("*")) {
    if (!vis(el)) continue;
    /* Stamp an addressable id so a later pass can drive hover and focus on
       this exact element. Two documents share no selectors, so without a
       stamp there is no way to say "this one, on both pages". It only ever
       exists in the headless render. */
    const pid = ++probeId;
    el.setAttribute("data-zc-probe", String(pid));
    const c = getComputedStyle(el), r = el.getBoundingClientRect();
    /* Position is recorded RELATIVE to the scope box. Absolute page
       coordinates are useless across two different documents; what carries
       over is where a thing sits inside the region being matched. */
    const x = Math.round(r.left - sb.left), y = Math.round(r.top - sb.top);
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role") || "";
    const txt = (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 40);
    const leaf = !el.children.length;
    const btn = tag === "button" || role === "button" ||
                (tag === "a" && /(^|\\s)(btn|button)/i.test(el.className || ""));
    const input = ["input", "select", "textarea"].includes(tag);
    const painted = c.backgroundColor && !/rgba\\(0, 0, 0, 0\\)/.test(c.backgroundColor);
    const bordered = parseFloat(c.borderTopWidth) > 0 || parseFloat(c.borderLeftWidth) > 0;
    out.push({
      pid, tag, role, txt, leaf, btn, input,
      /* An input's visible words are its PLACEHOLDER, not its textContent, so
         a text-keyed comparison never saw a single field. That is precisely
         the "32px built as 36px" class of defect. */
      ph: el.placeholder || "", type: el.type || "",
      surface: painted || bordered,
      x, y, sw: Math.round(sb.width), sh: Math.round(sb.height),
      w: Math.round(r.width), h: Math.round(r.height),
      bg: c.backgroundColor, fg: c.color,
      bw: c.borderTopWidth, bwl: c.borderLeftWidth, bc: c.borderTopColor, bs: c.borderTopStyle,
      radius: c.borderTopLeftRadius,
      pad: [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft].join(" "),
      gap: c.gap && c.gap !== "normal" ? c.gap : "",
      display: c.display, dir: c.flexDirection,
      fs: parseFloat(c.fontSize), fw: parseInt(c.fontWeight, 10) || 400, lh: c.lineHeight,
      bgImage: c.backgroundImage && c.backgroundImage !== "none" ? "yes" : "",
    });
  }
  return out;
})()`;

function serve(root) {
  return new Promise(res => {
    const s = http.createServer((q, rq) => {
      try {
        const f = path.join(root, decodeURIComponent(q.url.split("?")[0]));
        const e = path.extname(f);
        rq.writeHead(200, { "Content-Type":
          e === ".svg" ? "image/svg+xml" : e === ".css" ? "text/css" :
          e === ".js" ? "text/javascript" : e === ".png" ? "image/png" : "text/html" });
        rq.end(fs.readFileSync(f));
      } catch (x) { rq.writeHead(404); rq.end(); }
    }).listen(0, () => res(s));
  });
}

/* ── button variant, INFERRED from the recipe and flagged as such ───────── */
function btnVariant(e) {
  const bg = hex(e.bg), bw = parseFloat(e.bw) || 0;
  if (e.bgImage === "yes") return 'data-variant="gradient"';
  if (bg === "transparent" || bg === null) return bw > 0 ? 'data-variant="outline"' : 'data-variant="ghost" or "ghost-grey"';
  const d = bg ? dist(bg, (COLORS["--zc-body-bg-theme"] || "#2A65F0").toUpperCase()) : 99;
  if (d <= 24) return 'data-variant="fill" data-color="primary"';
  return 'data-variant="grey" (a pale fill — confirm against snippets)';
}
const SIZES = { 50: "large", 36: "default", 28: "small", 24: "xs" };
function btnSize(h) {
  let best = null, bd = Infinity;
  for (const k of Object.keys(SIZES)) {
    const d = Math.abs(h - +k);
    if (d < bd) { bd = d; best = k; }
  }
  return bd <= 3 ? `${h}px = ${SIZES[best]}` : `${h}px OFF the 50/36/28/24 button scale`;
}

const rows = (head, body) =>
  body.length ? [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...body].join("\n")
              : "_(none found)_";

/* Exported so zcat-compare.js uses THE SAME probe and the same token mapping.
   Two copies of a measurement drift, and then the extractor and the comparator
   disagree about the same page, which is worse than having neither. */
module.exports = {
  PROBE, COLORS, SPACE, RADIUS, BORDER, TYPE,
  hex, dist, colorToken, stepToken, typeClass, btnVariant, btnSize, serve, VIEWPORT,
};

if (require.main !== module) return;

(async () => {
  const argv = process.argv.slice(2);
  const flags = argv.filter(a => a.startsWith("--"));
  const [refArg] = argv.filter(a => !a.startsWith("--"));
  const flag = n => { const f = flags.find(a => a.startsWith("--" + n + "=")); return f ? f.slice(n.length + 3) : null; };
  if (!refArg) {
    console.log(fs.readFileSync(__filename, "utf8").split("*/")[0].replace(/^\/\*\s?/, ""));
    process.exit(1);
  }

  let refUrl = refArg, refLocal = null;
  if (!/^https?:\/\//.test(refArg)) {
    const abs = path.resolve(refArg);
    const inside = !path.relative(PROJECT, abs).startsWith("..");
    if (!/\.html?$/i.test(abs) || !fs.existsSync(abs) || !inside) {
      console.log("ERROR: the reference must be a URL, or a captured .html saved inside\n" +
                  "this repo. A screenshot has no computed styles to read, which is the\n" +
                  "whole point of this step — save the page instead.");
      process.exit(1);
    }
    refLocal = abs;
  }

  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch (e) { console.log("ERROR: playwright missing — run: npm run setup"); process.exit(1); }

  const scope = flag("scope") || "body";
  const srv = await serve(PROJECT);
  const port = srv.address().port;
  const target = refLocal
    ? `http://localhost:${port}/${path.relative(PROJECT, refLocal).split(path.sep).join("/")}`
    : refUrl;

  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: VIEWPORT });
  await p.goto(target, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const els = await p.evaluate(PROBE.replace(/__ZC_SCOPE__/g, JSON.stringify(scope)));
  await browser.close(); srv.close();

  const uniq = (list, key) => {
    const m = new Map();
    for (const e of list) {
      const k = key(e);
      if (!m.has(k)) m.set(k, { e, n: 0, txt: new Set() });
      const rec = m.get(k); rec.n++;
      if (e.txt) rec.txt.add(e.txt);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  };

  const L = [];
  L.push(`# REFERENCE SPEC`, "");
  L.push(`reference: ${refLocal ? path.relative(PROJECT, refLocal) + " (captured)" : refUrl}`);
  L.push(`scope: \`${scope}\` · viewport ${VIEWPORT.width}x${VIEWPORT.height} · ${els.length} visible elements`, "");
  L.push("Every value below is MEASURED off the reference, with the `--zc-*` token it maps to.");
  L.push("Build from this table, not from the screenshot. `NO TOKEN MATCH` and `OFF SCALE`");
  L.push("are the cases to raise with the designer rather than round silently.", "");

  /* buttons */
  L.push("## BUTTONS — every distinct recipe on the page", "");
  L.push(rows(["n", "labels", "background", "border", "text", "height", "radius", "build with (inferred)"],
    uniq(els.filter(e => e.btn), e => [e.bg, e.bc, e.bw, e.fg, e.h, e.radius, e.bgImage].join("|"))
      .map(({ e, n, txt }) => `| ${n} | ${[...txt].slice(0, 3).map(t => `"${t}"`).join(", ") || "—"} | ` +
        `${colorToken(e.bg, "button bg") || "transparent"} | ` +
        `${parseFloat(e.bw) ? `${stepToken(e.bw, BORDER, "button border")} ${colorToken(e.bc, "button border") || ""}` : "none"} | ` +
        `${colorToken(e.fg, "button text") || "—"} | ${btnSize(e.h)} | ${stepToken(e.radius, RADIUS, "button radius")} | ` +
        `${btnVariant(e)} |`)), "");

  /* surfaces */
  L.push("## SURFACES — backgrounds, borders, radii, padding", "");
  L.push(rows(["n", "what", "background", "border", "radius", "padding", "gap"],
    uniq(els.filter(e => e.surface && !e.btn && !e.input && !e.leaf),
         e => [e.bg, e.bc, e.bw, e.radius, e.pad, e.gap].join("|"))
      .slice(0, 30)
      .map(({ e, n }) => `| ${n} | \`${e.tag}\` ${e.w}x${e.h} | ${colorToken(e.bg, "surface bg") || "transparent"} | ` +
        `${parseFloat(e.bw) ? `${stepToken(e.bw, BORDER, "surface border")} ${colorToken(e.bc, "surface border") || ""}` : "none"} | ` +
        `${stepToken(e.radius, RADIUS, "surface radius")} | ${e.pad.split(" ").map(v => stepToken(v, SPACE, "padding")).join(" · ")} | ` +
        `${e.gap ? stepToken(e.gap, SPACE, "gap") : "—"} |`)), "");

  /* inputs */
  L.push("## FIELDS — the heights that get guessed wrong", "");
  L.push(rows(["n", "tag", "height", "background", "border", "radius", "padding"],
    uniq(els.filter(e => e.input), e => [e.tag, e.h, e.bg, e.bc, e.bw, e.radius, e.pad].join("|"))
      .map(({ e, n }) => `| ${n} | \`${e.tag}\` | **${e.h}px** | ${colorToken(e.bg, "field bg") || "transparent"} | ` +
        `${parseFloat(e.bw) ? `${stepToken(e.bw, BORDER, "field border")} ${colorToken(e.bc, "field border") || ""}` : "none"} | ` +
        `${stepToken(e.radius, RADIUS, "field radius")} | ${e.pad.split(" ").map(v => stepToken(v, SPACE, "padding")).join(" · ")} |`)), "");

  /* type */
  L.push("## TEXT — size and weight, mapped to the type scale", "");
  L.push(rows(["n", "sample", "measured", "use class", "colour"],
    uniq(els.filter(e => e.leaf && e.txt), e => [e.fs, e.fw, e.fg].join("|"))
      .slice(0, 20)
      .map(({ e, n, txt }) => `| ${n} | "${[...txt][0] || ""}" | ${e.fs}px / ${e.fw} / ${e.lh} | ` +
        `${typeClass(e.fs, e.fw)} | ${colorToken(e.fg, "text") || "—"} |`)), "");

  /* spacing census */
  const gaps = {};
  for (const e of els) if (e.gap) gaps[e.gap] = (gaps[e.gap] || 0) + 1;
  L.push("## GAPS between blocks, most used first", "");
  L.push(rows(["n", "gap", "token"],
    Object.entries(gaps).sort((a, b) => b[1] - a[1]).slice(0, 15)
      .map(([g, n]) => `| ${n} | ${g} | ${stepToken(g, SPACE, "gap")} |`)), "");

  if (NO_MATCH.length) {
    const seen = [...new Set(NO_MATCH)];
    L.push("## NO TOKEN MATCH / OFF SCALE — raise these, do not round them", "");
    L.push("A colour with no token is a change to the design system, not to a page. An");
    L.push("off-scale size usually means the nearest step is correct and the reference is");
    L.push("using a raw value — but say which you chose and why.", "");
    for (const m of seen.slice(0, 40)) L.push(`- ${m}`);
    if (seen.length > 40) L.push(`- (+${seen.length - 40} more)`);
    L.push("");
  }

  const out = L.join("\n");
  const dest = flag("out");
  if (dest) { fs.writeFileSync(path.resolve(dest), out); console.log(`written: ${dest}  (${out.length} chars)`); }
  else console.log(out);
})();

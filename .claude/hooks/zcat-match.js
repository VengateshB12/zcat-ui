#!/usr/bin/env node
/* Visual match gate — for MATCH mode only.
 *
 *   node .claude/hooks/zcat-match.js <page.html> <reference-url>
 *
 * There are two ways to build a screen and they need opposite gates.
 *
 * In REDESIGN mode the requirement is a feature list. The design score and the
 * design review both reward DIVERGING from it — the review literally refuses a
 * receipt that cannot name two structural changes.
 *
 * In MATCH mode the requirement is the design. Diverging is the failure. So
 * those two gates are the wrong instrument entirely, and this one replaces
 * them: render the built page and the reference side by side and ask how much
 * of the reference actually survived.
 *
 * It compares STRUCTURE, not pixels. A pixel diff fails on different sample
 * data, a different font hinting, a scrollbar — noise that has nothing to do
 * with whether the design matches. Instead:
 *
 *   1. every visible text label in the reference, and whether the build has it
 *   2. the major layout blocks of each, as a coarse grid, and where they differ
 *
 * Exit 0 when the match is close enough (see PASS_MARK), 1 otherwise.
 */
const fs = require("fs"), path = require("path"), http = require("http");

const HOOKS = __dirname;
const PROJECT = path.resolve(HOOKS, "..", "..");
const STATE = path.join(HOOKS, ".zcat-state");
const SHOTS = path.join(STATE, "shots");

const PASS_MARK = 85;      // % of the reference's labels that must be present
const VIEWPORT = { width: 1440, height: 900 };

function slug(rel) {
  return rel.replace(/[/\\]/g, "__").replace(/\.html$/, "");
}

const norm = s => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/* Text a person can actually read, plus the coarse shape of the page.
   SCOPED, because the shell is not part of the match. `__ZC_SCOPE__` is
   replaced with a selector before this runs; everything outside it is ignored.
   Why: our shell is copied from template.html and ships 5 services on the rail,
   while the reference console ships 10. Those 5 names are reference labels our
   build can never contain, and the rail is untouchable by rule, so they were
   costing ~15% of a score whose pass mark is 85% — the gate was arithmetically
   almost unable to pass, for the one part of the page nobody is allowed to
   change. */
const PROBE = `(() => {
  const scopeEl = document.querySelector(__ZC_SCOPE__) || document.body;
  const within = el => scopeEl.contains(el);
  const vis = el => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const c = getComputedStyle(el);
    return c.visibility !== "hidden" && c.display !== "none" && c.opacity !== "0";
  };
  const labels = [];
  for (const el of scopeEl.querySelectorAll("*")) {
    if (el.children.length || !vis(el) || !within(el)) continue;
    const t = (el.textContent || "").trim().replace(/\\s+/g, " ");
    if (t && t.length <= 60) labels.push(t);
  }
  // coarse 12x8 occupancy grid: where is there ink at all
  const W = innerWidth, H = Math.min(document.body.scrollHeight, 4000);
  const grid = Array.from({ length: 8 }, () => Array(12).fill(0));
  for (const el of scopeEl.querySelectorAll("*")) {
    if (!vis(el) || !within(el)) continue;
    const c = getComputedStyle(el);
    const rr = el.getBoundingClientRect();
    // wrappers cover the whole page and tell us nothing: every grid came back
    // identical, so the layout score read 100% for two unrelated designs.
    if (rr.width * rr.height > W * H * 0.35) continue;
    const painted = (c.backgroundColor && !/rgba\\(0, 0, 0, 0\\)/.test(c.backgroundColor))
                 || (el.textContent || "").trim();
    if (!painted) continue;
    const r = el.getBoundingClientRect();
    const y = r.top + scrollY;
    for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 12; gx++) {
      const cx = (gx + 0.5) * W / 12, cy = (gy + 0.5) * H / 8;
      if (cx >= r.left && cx <= r.right && cy >= y && cy <= y + r.height) grid[gy][gx] = 1;
    }
  }
  return { labels: [...new Set(labels)], grid, scope: scopeEl === document.body ? "body" : __ZC_SCOPE__ };
})()`;

const probeFor = sel => PROBE.replace(/__ZC_SCOPE__/g, JSON.stringify(sel));

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

(async () => {
  const argv = process.argv.slice(2);
  const flags = argv.filter(a => a.startsWith("--"));
  const [pageArg, refArg] = argv.filter(a => !a.startsWith("--"));
  const flag = n => {
    const f = flags.find(a => a.startsWith("--" + n + "="));
    return f ? f.slice(n.length + 3) : null;
  };
  if (!pageArg || !refArg) {
    console.log(fs.readFileSync(__filename, "utf8").split("*/")[0].replace(/^\/\*\s?/, ""));
    process.exit(1);
  }
  const abs = path.resolve(pageArg);
  const rel = path.relative(PROJECT, abs);
  if (!fs.existsSync(abs)) { console.log(`ERROR: no such page: ${rel}`); process.exit(1); }
  /* THE REFERENCE: a URL, or a CAPTURED page saved inside this repo.
     A login-walled console cannot be fetched. Pointed at one, this gate
     rendered the Zoho sign-in page and scored the build against THAT, and a
     docs URL handed it 131 site-navigation labels. Both scored something and
     neither meant anything. So a saved copy of the reference is now a
     first-class input: File > Save Page As from the real console, dropped
     under `reference/`, keeps the DOM this gate needs.
     A SCREENSHOT still cannot be used — there is nothing to compare
     structurally — which is what STEP 7-M's side-by-side is for. */
  let refUrl = refArg, refLocal = null;
  if (!/^https?:\/\//.test(refArg)) {
    const abs = path.resolve(refArg);
    const inside = !path.relative(PROJECT, abs).startsWith("..");
    if (!/\.html?$/i.test(abs) || !fs.existsSync(abs) || !inside) {
      console.log("ERROR: the reference must be one of two things.\n\n" +
        "  1. a URL this gate can open and render, or\n" +
        "  2. a CAPTURED page saved inside this repo as .html\n" +
        "     (File > Save Page As on the real screen — use this when the\n" +
        "      reference is behind a login, which a fetch cannot pass)\n\n" +
        "A screenshot cannot be compared structurally. Score it by eye in\n" +
        "STEP 7-M instead, which is the half of the job that can see.");
      process.exit(1);
    }
    refLocal = abs;
  }

  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch (e) { console.log("ERROR: playwright missing — run: npm run setup"); process.exit(1); }

  const srv = await serve(PROJECT);
  const port = srv.address().port;
  const browser = await chromium.launch();
  fs.mkdirSync(SHOTS, { recursive: true });

  async function look(url, shotName, scope) {
    const p = await browser.newPage({ viewport: VIEWPORT });
    await p.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(1200);
    const data = await p.evaluate(probeFor(scope));
    await p.screenshot({ path: path.join(SHOTS, shotName), fullPage: true }).catch(() => {});
    await p.close();
    return data;
  }

  /* Our side is always scoped to the container: the shell is common to every
     page, is copied from template.html, and is not part of the match. The
     reference's own container has whatever selector its authors chose, so it
     has to be given. Without it we compare their WHOLE page to our container,
     which is the ~15% chrome penalty all over again — so say so loudly. */
  const BUILD_SCOPE = flag("build-scope") || ".zc-layout__container";
  const refScope = flag("scope");
  if (!refScope)
    console.log("NOTE: no --scope=<selector> for the reference, so its shell chrome\n" +
                "      counts as content our build is missing. Pass the reference's\n" +
                "      own content selector to compare like with like.\n");

  let build, ref;
  try {
    const refTarget = refLocal
      ? `http://localhost:${port}/${path.relative(PROJECT, refLocal).split(path.sep).join("/")}`
      : refUrl;
    build = await look(`http://localhost:${port}/${rel.split(path.sep).join("/")}`,
                       slug(rel) + "-match-build.png", BUILD_SCOPE);
    ref = await look(refTarget, slug(rel) + "-match-reference.png", refScope || "body");
  } catch (e) {
    console.log("ERROR rendering: " + e.message); browser.close(); srv.close(); process.exit(1);
  }
  await browser.close(); srv.close();

  const haveSet = new Set(build.labels.map(norm).filter(Boolean));
  const wanted = ref.labels.filter(t => norm(t).length >= 3);
  const missing = wanted.filter(t => !haveSet.has(norm(t)));
  const score = wanted.length ? Math.round(100 * (wanted.length - missing.length) / wanted.length) : 0;

  let cells = 0;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++)
    if (build.grid[y][x] !== ref.grid[y][x]) cells++;
  const layout = Math.round(100 * (96 - cells) / 96);

  /* The layout number is NOT a score and must never be printed as one.
     It read 34-60% while content read 85-97%, so every report looked like a
     failure on a passing page. It is a 12x8 occupancy grid over two pages that
     legitimately differ in height, sample data and row count, so a percentage
     implies a precision it does not have. Printed as a coarse word now, and
     it has never been part of pass/fail. */
  const shape = cells <= 12 ? "close" : cells <= 32 ? "roughly similar" : "different";
  console.log(`VISUAL MATCH — ${rel}`);
  console.log(`  reference: ${refLocal ? path.relative(PROJECT, refLocal) + " (captured)" : refUrl}`);
  console.log(`  scope     build ${build.scope}  vs  reference ${ref.scope}`);
  console.log(`  content   ${score}%  (${wanted.length - missing.length} of ${wanted.length} labels present)  <- this is the score`);
  console.log(`  shape     ${shape}  (${cells} of 96 coarse grid cells differ; advisory, not scored)`);
  console.log(`  shots     ${path.relative(PROJECT, SHOTS)}/${slug(rel)}-match-{build,reference}.png`);

  if (missing.length) {
    console.log(`\n  IN THE REFERENCE, NOT IN YOUR BUILD (${missing.length}):`);
    for (const t of missing.slice(0, 25)) console.log("    - " + t);
    if (missing.length > 25) console.log(`    (+${missing.length - 25} more)`);
  }

  const pass = score >= PASS_MARK;
  fs.mkdirSync(STATE, { recursive: true });
  fs.writeFileSync(path.join(STATE, slug(rel) + ".match.json"), JSON.stringify({
    reference: refLocal ? path.relative(PROJECT, refLocal) : refUrl,
    captured: !!refLocal, buildScope: build.scope, refScope: ref.scope,
    content: score, shapeCells: cells, shape, missing: missing.slice(0, 60),
    pass, _page_mtime: fs.statSync(abs).mtimeMs
  }, null, 1));

  console.log("");
  if (!pass) {
    console.log(`MATCH FAILED — ${score}% of the reference's content is present, ` +
                `and match mode needs ${PASS_MARK}%.`);
    console.log("You were asked to reproduce this design, not to improve it. Open both");
    console.log("screenshots above side by side and put the missing pieces back.");
    process.exit(1);
  }
  console.log(`MATCH PASSED — ${score}% of the reference's content is present, ` +
              `shape ${shape}.\nThis gate counts what is PRESENT; it cannot see whether it looks right. ` +
              "STEP 7-M is\nthe half that can — open both screenshots side by side and score them.");
})();

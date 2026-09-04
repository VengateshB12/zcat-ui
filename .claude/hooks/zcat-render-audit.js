#!/usr/bin/env node
/* Renders page files in headless Chromium and runs the geometry audit.
 * Usage: node zcat-render-audit.js <file.html> [more.html ...]
 * Writes .claude/hooks/.zcat-state/<slug>.json  (+ screenshots)
 * Exit 0 = clean, 1 = FAILs found, 2 = could not run.
 */
const fs = require("fs"), path = require("path"), http = require("http");
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (e) {
  // A fresh clone has the gate scripts but not node_modules — say exactly how
  // to fix it rather than failing with "Cannot find module 'playwright'".
  console.error("The rendered audit needs a browser and none is installed.");
  console.error("");
  console.error("  npm run setup      # npm install && npx playwright install chromium");
  console.error("");
  console.error("Run that from the repo root, then re-run this audit. Do NOT build");
  console.error("pages until it prints PASS — an unguarded build is the failure mode");
  console.error("this whole toolchain exists to prevent.");
  process.exit(2);
}
const { __zcatAudit } = require("./zcat-audit-core.js");

const HOOKS = __dirname;
const PROJECT = path.resolve(HOOKS, "..", "..");
const STATE = path.join(HOOKS, ".zcat-state");
const SHOTS = path.join(STATE, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".json": "application/json", ".woff2": "font/woff2", ".ico": "image/x-icon" };

function serve() {
  return new Promise(res => {
    const s = http.createServer((req, rq) => {
      const clean = decodeURIComponent(req.url.split("?")[0]);
      const f = path.join(PROJECT, clean);
      if (!f.startsWith(PROJECT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        rq.writeHead(404); return rq.end("404");
      }
      rq.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(rq);
    });
    s.listen(0, "127.0.0.1", () => res(s));
  });
}

const slug = f => path.relative(PROJECT, f).replace(/[\/\\]/g, "__").replace(/\.html$/, "");

(async () => {
  const files = process.argv.slice(2).filter(f => f.endsWith(".html") && fs.existsSync(f));
  if (!files.length) process.exit(0);

  const server = await serve();
  const port = server.address().port;
  let browser;
  try { browser = await chromium.launch(); }
  catch (e) { console.error("PLAYWRIGHT UNAVAILABLE: " + e.message); process.exit(2); }

  let anyFail = false;
  for (const file of files) {
    const abs = path.resolve(file);
    const url = `http://127.0.0.1:${port}/${path.relative(PROJECT, abs).split(path.sep).join("/")}`;
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [], notFound = [];
    page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
    page.on("pageerror", e => errors.push("JS ERROR: " + String(e).slice(0, 200)));
    page.on("response", r => { if (r.status() === 404) notFound.push(r.url().replace(/^http:\/\/[^/]+/, "")); });

    const out = { page: path.relative(PROJECT, abs), fails: [], warns: [], stats: {} };
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(350);   // let zcat.js wire itself

      const src = fs.readFileSync(path.join(HOOKS, "zcat-audit-core.js"), "utf8")
        .replace(/if \(typeof module[\s\S]*$/, "");

      /* ASSET PATHS ARE CHECKED ON DISK, NOT IN THE BROWSER.
         Over HTTP a browser CLAMPS a leading "../.." at the server root, so a
         page asking for ../../docs/icons/x.svg from pages/ quietly resolves to
         /docs/icons/x.svg and looks fine to the audit — while the same page
         opened from disk, which is how a designer reviews it, resolves the ..
         for real, finds nothing, and renders blank squares. That is exactly how
         a service rail with five broken logos passed every gate.
         So resolve what the page DECLARES against the page's own folder. */
      const declared = [];
      {
        const raw = fs.readFileSync(abs, "utf8");
        /* Only src= and href= ATTRIBUTES. A url() inside a CSS custom property
           resolves against the stylesheet that CONSUMES it, not the HTML — the
           rail's ../../docs/icons/ is written for src/components/*.css and is
           correct there. Checking those against the page's folder reported the
           template's own working rail as broken. */
        const re = /(?:src|href)\s*=\s*["']([^"'>]+)["']/g;
        let m;
        while ((m = re.exec(raw))) {
          const u = (m[1] || "").trim();
          if (!u || /^(https?:|data:|#|mailto:|javascript:)/i.test(u)) continue;
          declared.push(u.split("?")[0].split("#")[0]);
        }
      }
      const missing = [...new Set(declared)].filter(u => {
        const base = u.startsWith("/") ? PROJECT : path.dirname(abs);
        const f = path.resolve(base, u.replace(/^\//, ""));
        return !fs.existsSync(decodeURIComponent(f));
      });
      if (missing.length)
        out.fails.push({ rule: "ASSET PATH DOES NOT RESOLVE",
          msg: `${missing.length} file(s) this page links do not exist at the path ` +
               `it asks for: ${missing.slice(0, 4).join(", ")}` +
               (missing.length > 4 ? ` (+${missing.length - 4} more)` : "") +
               ". Over a server the browser can clamp a stray ../ and hide this; " +
               "opened from disk the images and icons simply do not appear",
          sel: "(assets)" });

      /* WAS THE SHELL COPIED, OR RETYPED?
         "Copy the shell verbatim" has been a written rule for a long time and
         it keeps getting broken — Codex rebuilt a simplified rail from memory,
         another build re-pointed every logo path and shipped five blank chips.
         A rule nobody can check is a rule that gets skipped, so check it.

         The template is the source of truth. A page that copied it has the same
         services in the same order and the same icon symbols. A page that typed
         its own shell will differ somewhere, and that difference is the whole
         signal — it does not matter WHERE it differs. */
      try {
        const tpl = fs.readFileSync(path.join(PROJECT, "zcat-ui/docs/template.html"), "utf8");
        const raw = fs.readFileSync(abs, "utf8");
        const isPage = /zc-layout__rail/.test(raw);
        if (isPage) {
          // service names, in order, exactly as the rail renders them
          const names = h => [...h.matchAll(/class="zc-layout__service-name"[^>]*>([^<]*)</g)]
                              .map(m => m[1].trim());
          // the logo asset each chip points at, filename only (paths get rewritten on copy)
          const logos = h => [...h.matchAll(/--icon(?:-active)?:\s*url\(['"]?([^'")]+)/g)]
                              .map(m => m[1].split("/").pop().trim());

          const tN = names(tpl), pN = names(raw);
          if (tN.length && pN.join("|") !== tN.join("|"))
            out.fails.push({ rule: "SHELL NOT COPIED",
              msg: `the service rail does not match docs/template.html — it has ` +
                   `[${pN.join(", ")}] where the template has [${tN.join(", ")}]. ` +
                   "The rail is copied verbatim and never edited; retyping it is how " +
                   "services go missing and logos go blank",
              sel: ".zc-layout__rail" });

          const tL = logos(tpl).sort().join("|"), pL = logos(raw).sort().join("|");
          if (tL && pL !== tL)
            out.fails.push({ rule: "SHELL NOT COPIED",
              msg: "the rail's logo assets differ from docs/template.html — you " +
                   "re-pointed artwork you had no reason to touch. Copy the rail and " +
                   "leave its logos exactly as they are",
              sel: ".zc-layout__service-chip" });

        }
      } catch (e) { /* no template to compare against: not this check's problem */ }

      /* A SEARCH BOX THAT DOES NOTHING.
         Every page here has to search, and the rule has said so for a while —
         but it was words only, so a build shipped a search field you could type
         into that never filtered and never said "no results". Nothing static
         can see that: you have to type. */
      try {
        const searchProbe = await page.evaluate(async () => {
          // The shell's own search (topbar, service finder) is not a filter for
          // the page's rows — it searches the product. Only page-level searches
          // are held to this.
          const wraps = [...document.querySelectorAll(".zc-search-wrap")]
            .filter(w => w.getBoundingClientRect().height > 0)
            .filter(w => !w.closest(".zc-layout__topbar, .zc-layout__rail, .zc-sidemenu"));
          const out = [];
          for (const w of wraps) {
            const input = w.querySelector(".zc-input");
            if (!input) continue;
            const rowsOf = () => [...document.querySelectorAll(
              ".zc-table__row, .zc-card, .zc-csm__item")].filter(
              e => e.getBoundingClientRect().height > 0).length;
            const before = rowsOf();
            if (before === 0) continue;              // nothing to filter yet
            const prev = input.value;
            input.value = "zzqqxx-no-such-thing";
            input.dispatchEvent(new Event("input", { bubbles: true }));
            await new Promise(r => setTimeout(r, 120));
            const after = rowsOf();
            const empty = [...document.querySelectorAll(
              ".zc-empty, [data-empty-for]")].some(
              e => e.getBoundingClientRect().height > 0);
            input.value = prev;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            await new Promise(r => setTimeout(r, 60));
            out.push({ before, after, empty,
                       label: input.getAttribute("placeholder") || "search" });
          }
          return out;
        });
        for (const r of searchProbe) {
          if (r.after === r.before)
            out.fails.push({ rule: "SEARCH DOES NOT FILTER",
              msg: `typing into "${r.label}" changed nothing — ${r.before} items ` +
                   "before and after a query that matches none of them. A search " +
                   'box that does not search is worse than none. Point it at its ' +
                   'rows with data-filter="<selector>"',
              sel: ".zc-search-wrap" });
          else if (!r.empty)
            out.fails.push({ rule: "NO SEARCH EMPTY STATE",
              msg: `"${r.label}" filters correctly but a query matching nothing ` +
                   "leaves a blank panel — no message, no way back. Add a " +
                   'no-results block with data-empty-for="<the list>"',
              sel: ".zc-search-wrap" });
        }
      } catch (e) { /* probing must never break the audit */ }

      const light = await page.evaluate(src + "; __zcatAudit()");
      out.fails.push(...light.fails); out.warns.push(...light.warns); out.stats = light.stats;
      await page.screenshot({ path: path.join(SHOTS, slug(abs) + "-light.png"), fullPage: true });

      // dark mode: only contrast + collapse matter here, geometry is shared
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
      await page.waitForTimeout(200);
      const dark = await page.evaluate(src + "; __zcatAudit()");
      for (const f of dark.fails)
        if (f.rule === "CONTRAST") out.fails.push({ ...f, rule: "CONTRAST (DARK)" });
      await page.screenshot({ path: path.join(SHOTS, slug(abs) + "-dark.png"), fullPage: true });

      for (const u of [...new Set(notFound)])
        out.fails.push({ rule: "404", msg: `page requests a file that does not exist: ${u}`, sel: "(network)" });
      for (const e of [...new Set(errors)])
        out.fails.push({ rule: "CONSOLE ERROR", msg: e, sel: "(console)" });
    } catch (e) {
      out.fails.push({ rule: "RENDER FAILED", msg: String(e).slice(0, 300), sel: "(page)" });
    }
    await page.close();

    out.ok = out.fails.length === 0;
    out.ts = new Date().toISOString();
    fs.writeFileSync(path.join(STATE, slug(abs) + ".json"), JSON.stringify(out, null, 2));
    if (!out.ok) anyFail = true;

    const tag = out.ok ? "PASS" : "FAIL";
    console.log(`${tag}  ${out.page}  (${out.fails.length} fail, ${out.warns.length} warn, ${out.stats.components || 0} components)`);
    for (const f of out.fails.slice(0, 25)) console.log(`   FAIL ${f.rule}: ${f.msg}\n        at ${f.sel}`);
    for (const w of out.warns.slice(0, 10)) console.log(`   warn ${w.rule}: ${w.msg}\n        at ${w.sel}`);
  }

  await browser.close(); server.close();
  process.exit(anyFail ? 1 : 0);
})();

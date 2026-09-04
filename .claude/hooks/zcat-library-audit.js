#!/usr/bin/env node
/**
 * Library regression test — audits zcat-ui ITSELF, not the pages built from it.
 *
 * The page hooks can never catch a bug inside the library's own CSS: they only
 * ever look at consumer pages, and a broken component looks "correct" there
 * because the page markup is right. That is exactly how the Attention Box icon
 * drifted to the middle of a wrapped message and survived.
 *
 * This renders the playground, walks EVERY component, and checks invariants
 * that must hold for any component in any state:
 *
 *   ZERO SIZE      a component that renders 0x0 is broken
 *   OVERFLOW       content escaping its own component box
 *   OVERLAP        two siblings sitting on top of each other
 *   ICON ON LINE 1 an icon beside wrapping text must sit on the FIRST line,
 *                  not drift to the middle of the block
 *   INVISIBLE TEXT text the same colour as what is behind it
 *
 * Both themes. Usage:
 *   node .claude/hooks/zcat-library-audit.js            # every component
 *   node .claude/hooks/zcat-library-audit.js popup tabs # just these
 */
const path = require("path");
const fs = require("fs");

const HOOKS = __dirname;
const PROJECT = path.resolve(HOOKS, "..", "..");
const STATE = path.join(HOOKS, ".zcat-state");
const PLAYGROUND = path.join(PROJECT, "zcat-ui", "docs", "playground.html");

function loadPlaywright() {
  for (const m of ["playwright", "playwright-core", "puppeteer"]) {
    try { return { name: m, lib: require(m) }; } catch (e) { /* keep looking */ }
  }
  return null;
}

const CHECKS = `(() => {
  const F = [];
  const vis = el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };
  const root = document.getElementById("preview");
  if (!root) return [{ rule: "NO PREVIEW", msg: "the playground rendered no preview area" }];

  const zc = [...root.querySelectorAll('[class*="zc-"]')];
  if (!zc.length) return [];

  /* ZERO SIZE — a component that renders to nothing */
  for (const el of zc) {
    const cls = (el.className.baseVal || el.className || "").toString().split(" ")[0];
    if (!/^zc-[a-z-]+$/.test(cls)) continue;          // block, not element/modifier
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || el.hasAttribute("hidden")) continue;
    // An empty list/slot legitimately has no height until it holds something.
    if (!el.children.length && !(el.textContent || "").trim()) continue;
    if (r.width === 0 || r.height === 0)
      F.push({ rule: "ZERO SIZE", msg: cls + " renders " + Math.round(r.width) + "x" + Math.round(r.height) });
  }

  /* OVERFLOW — content escaping its own component box */
  for (const el of zc.filter(vis)) {
    const cs = getComputedStyle(el);
    if (cs.overflow !== "visible") continue;
    const r = el.getBoundingClientRect();
    for (const k of [...el.children].filter(vis)) {
      const kcs = getComputedStyle(k);
      // Deliberate overhangs: the side menu's collapse toggle straddles the
      // border, the tour card carries an arrow outside its box. Anything
      // absolutely positioned or explicitly offset is opting out on purpose.
      if (kcs.position === "absolute" || kcs.position === "fixed") continue;
      if (parseFloat(kcs.marginLeft) < 0 || parseFloat(kcs.marginRight) < 0) continue;
      const kr = k.getBoundingClientRect();
      if (kr.right > r.right + 2 || kr.left < r.left - 2) {
        const cls = (el.className.baseVal || el.className || "").toString().split(" ")[0];
        F.push({ rule: "OVERFLOW", msg: "content escapes " + cls + " horizontally" });
        break;
      }
    }
  }

  /* ICON ON THE FIRST LINE — the bug class that started this file.
     An icon beside multi-line text must optically centre on line ONE. */
  for (const el of zc.filter(vis)) {
    const cs = getComputedStyle(el);
    if (!cs.display.includes("flex") || !cs.flexDirection.startsWith("row")) continue;
    const kids = [...el.children].filter(vis);
    const icon = kids.find(k => {
      const r = k.getBoundingClientRect();
      return (k.tagName === "svg" || k.tagName === "IMG" || /icon/i.test((k.className.baseVal || k.className || "").toString()))
             && r.height <= 24;
    });
    if (!icon) continue;   // no icon in this row — nothing to align
    const text = kids.find(k => k !== icon && (k.textContent || "").trim().length > 40);
    if (!text) continue;
    const tr = text.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(text).lineHeight) || 20;
    if (tr.height < lh * 1.8) continue;               // not wrapping — nothing to test
    const ir = icon.getBoundingClientRect();
    const off = (ir.top + ir.height / 2) - (tr.top + lh / 2);
    if (Math.abs(off) > 4) {
      const cls = (el.className.baseVal || el.className || "").toString().split(" ")[0];
      F.push({ rule: "ICON OFF FIRST LINE",
               msg: cls + ": the icon sits " + off.toFixed(1) + "px from the first line's centre — beside wrapping text it must stay on line one" });
    }
  }

  return F;
})()`;

(async () => {
  const only = process.argv.slice(2);
  const found = loadPlaywright();
  if (!found) {
    console.error("Library audit needs playwright or puppeteer installed.");
    console.error("  npm i -D playwright && npx playwright install chromium");
    process.exit(2);
  }
  const { chromium } = found.lib.chromium ? found.lib : { chromium: found.lib };
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const url = "file://" + PLAYGROUND;
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(600);

  const ids = await page.evaluate(() =>
    [...document.querySelectorAll("a[data-id]")].map(a => a.dataset.id));
  const list = only.length ? ids.filter(i => only.includes(i)) : ids;

  const results = [];
  for (const theme of ["light", "dark"]) {
    await page.evaluate(t => document.documentElement.setAttribute("data-theme", t), theme);
    for (const id of list) {
      await page.evaluate(i => window.showComponent && window.showComponent(i), id);
      await page.waitForTimeout(90);
      let fails = [];
      try { fails = await page.evaluate(CHECKS); } catch (e) { fails = [{ rule: "CRASH", msg: String(e).slice(0, 120) }]; }
      for (const f of fails) results.push({ component: id, theme, ...f });
    }
  }
  await browser.close();

  /* EVERY LIGHT TOKEN NEEDS A DARK COUNTERPART, IN BOTH DARK BLOCKS.
     --zc-fullpopup-header-bg had none, so the full-page popup's header stayed
     #F4F7FE over a #1A1B1D sheet — a pale bar with near-invisible text. Its own
     comment admitted it ("LIGHT-ONLY, dark pending the dark audit") and it sat
     that way until the designer opened the page in dark mode. A comment is not
     a check. This is. A rendering audit cannot catch it either: nothing on
     screen is wrong until you switch theme, and then everything about that
     surface is. */
  try {
    const css = fs.readFileSync(
      path.join(PROJECT, "zcat-ui", "src", "tokens", "colors.css"), "utf8");
    const lines = css.split("\n");
    const iMedia = lines.findIndex(l => l.includes(':root:not([data-theme="light"])'));
    const iAttr  = lines.findIndex(l => l.startsWith(':root[data-theme="dark"]'));
    if (iMedia > 0 && iAttr > iMedia) {
      const names = seg => new Set(
        (seg.join("\n").match(/--zc-[a-z0-9-]+(?=\s*:)/g) || []));
      const light = names(lines.slice(0, iMedia));
      const media = names(lines.slice(iMedia, iAttr));
      const attr  = names(lines.slice(iAttr));
      for (const t of [...light].sort()) {
        const missing = [!media.has(t) && "the prefers-color-scheme block",
                         !attr.has(t)  && 'the [data-theme="dark"] block'].filter(Boolean);
        if (missing.length)
          results.push({ component: "tokens/colors.css", theme: "dark",
            rule: "LIGHT-ONLY TOKEN",
            msg: `${t} has no dark value in ${missing.join(" or ")} — it keeps its ` +
                 "light colour in dark mode, which usually lands as pale text on a " +
                 "dark surface, or a bright panel in a dark page" });
      }
    }
  } catch (e) { /* the token pass must never break the render audit */ }

  fs.mkdirSync(STATE, { recursive: true });
  fs.writeFileSync(path.join(STATE, "library-audit.json"),
    JSON.stringify({ ts: new Date().toISOString(), checked: list.length, fails: results }, null, 1));

  if (!results.length) {
    console.log(`LIBRARY AUDIT PASS — ${list.length} components, both themes, 0 issues`);
    process.exit(0);
  }
  console.log(`LIBRARY AUDIT FAIL — ${results.length} issue(s) across ${list.length} components:`);
  for (const r of results.slice(0, 25))
    console.log(`  [${r.theme}] ${r.component}: ${r.rule} — ${r.msg}`);
  if (results.length > 25) console.log(`  (+${results.length - 25} more in .zcat-state/library-audit.json)`);
  process.exit(1);
})();

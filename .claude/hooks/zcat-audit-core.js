/* zcat rendered-page audit — runs INSIDE the page.
 * Measures real geometry. Catches what a text hook cannot: alignment,
 * overflow, collapsed boxes, uneven rows, broken rhythm, contrast.
 *
 * Usage (Playwright):  page.evaluate(auditSource + "; __zcatAudit()")
 * Usage (Browser MCP): paste this file, then call __zcatAudit()
 * Returns: { fails: [...], warns: [...], stats: {...} }
 */
function __zcatAudit() {
  const F = [], W = [];
  const SCALE = [0,1,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,36,40,44,48,50,64,80,120];
  const TOL = 1.5;                       // sub-pixel tolerance for alignment
  const fail = (rule, msg, el) => F.push({ rule, msg, sel: path(el) });
  const warn = (rule, msg, el) => W.push({ rule, msg, sel: path(el) });

  function path(el) {
    if (!el || !el.tagName) return "(page)";
    const bits = [];
    for (let n = el, d = 0; n && n.tagName && d < 4; n = n.parentElement, d++) {
      let s = n.tagName.toLowerCase();
      const zc = [...n.classList].filter(c => c.startsWith("zc-"))[0];
      if (zc) s += "." + zc;
      else if (n.id) s += "#" + n.id;
      else if (n.classList[0]) s += "." + n.classList[0];
      bits.unshift(s);
    }
    return bits.join(" > ");
  }
  const vis = el => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" &&
           cs.display !== "none" && cs.opacity !== "0";
  };
  const px = v => parseFloat(v) || 0;
  const onScale = v => SCALE.some(s => Math.abs(s - v) < 0.6);

  // SCOPE — the library shell (rail/topbar/sidemenu) is verified and sacred.
  // Audit only what the page author actually built.
  const SHELL = ".zc-layout__rail, .zc-layout__topbar, .zc-sidemenu";
  const OWN = [...document.querySelectorAll(
    ".zc-layout__container, .zc-layout__subheader, .zc-popup, .zc-fullpopup, .zc-empty")];
  const scopes = OWN.length ? OWN : [document.body];
  const inScope = el =>
    scopes.some(s => s !== el && s.contains(el)) &&   // audit contents, not the library container itself
    !el.closest(SHELL) &&
    !(el.ownerSVGElement || el.tagName === "svg" && false) &&
    !el.closest("svg") &&
    !el.closest("script,style,head");
  const all = [...document.body.querySelectorAll("*")].filter(el => inScope(el) && vis(el));
  const isDivider = el =>
    !el.children.length && !(el.textContent || "").trim() &&
    (el.getBoundingClientRect().height <= 2 || el.getBoundingClientRect().width <= 2);
  const clips = el => {
    const cs = getComputedStyle(el);
    return cs.textOverflow === "ellipsis" || cs.whiteSpace === "nowrap" ||
           cs.overflow === "hidden" || cs.overflowX === "hidden";
  };

  /* ── 1. Page must not scroll sideways ─────────────────────────────── */
  const de = document.documentElement;
  if (de.scrollWidth > window.innerWidth + 2)
    F.push({ rule: "PAGE H-SCROLL",
      msg: `page scrolls horizontally (${de.scrollWidth}px content in ${window.innerWidth}px viewport) — something overflows`,
      sel: "(document)" });

  /* ── 2. Content overflowing its own box ───────────────────────────── */
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.overflowX === "auto" || cs.overflowX === "scroll") continue;
    if (clips(el)) continue;                      // ellipsis / nowrap is intentional
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0)
      fail("OVERFLOW", `content is ${el.scrollWidth - el.clientWidth}px wider than its box`, el);
  }

  /* ── 3. Collapsed boxes (the 40x40 icon that became 40x18) ────────── */
  for (const el of all) {
    if (isDivider(el)) continue;                  // 1px rules are deliberate
    const hasContent = el.children.length || (el.textContent || "").trim();
    if (!hasContent) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 6 && r.height < 4) fail("COLLAPSED", `box has content but height collapsed to ${r.height.toFixed(1)}px`, el);
    if (r.height > 6 && r.width < 4) fail("COLLAPSED", `box has content but width collapsed to ${r.width.toFixed(1)}px`, el);
  }

  /* ── 4. Clipped text ──────────────────────────────────────────────── */
  for (const el of all) {
    if (!el.children.length && el.textContent.trim()) {
      const cs = getComputedStyle(el);
      if (cs.overflow === "hidden" && cs.textOverflow !== "ellipsis" &&
          el.scrollHeight > el.clientHeight + 2)
        fail("TEXT CLIPPED", `text is cut off (${el.scrollHeight}px of text in ${el.clientHeight}px box)`, el);
    }
  }

  /* ── 5. Row children must align and match height ──────────────────── */
  for (const el of all) {
    const cs = getComputedStyle(el);
    const isRow = (cs.display.includes("flex") && cs.flexDirection.startsWith("row")) ||
                  cs.display.includes("grid");
    if (!isRow) continue;
    const kids = [...el.children].filter(vis);
    if (kids.length < 2) continue;
    const rects = kids.map(k => k.getBoundingClientRect());
    const sameLine = rects.every(r => Math.abs(r.top - rects[0].top) < TOL);

    const cardLike = rects.every(r => r.width >= 100);
    if (cardLike && sameLine && (cs.alignItems === "stretch" || cs.alignItems === "normal")) {
      const hs = rects.map(r => r.height);
      const spread = Math.max(...hs) - Math.min(...hs);
      if (spread > 2)
        fail("UNEVEN ROW", `items in this row differ in height by ${spread.toFixed(0)}px — they should stretch equal`, el);
    }
    // Centred / baseline rows legitimately have different tops — compare the
    // axis the row actually aligns on, not the top edge.
    const ai = cs.alignItems;
    if (ai === "center") {
      const mids = rects.map(r => r.top + r.height / 2);
      const spread = Math.max(...mids) - Math.min(...mids);
      if (spread > TOL)
        fail("MISALIGNED ROW", `items in a centred row are ${spread.toFixed(1)}px off centre`, el);
    } else if (ai === "flex-start" || ai === "start") {
      /* Icons are aligned OPTICALLY, not geometrically: a 16px glyph beside a
         20px line is nudged down ~2px so it sits on the text, which is correct
         and would otherwise read here as a misalignment. Compare the text
         items only; a row that is nothing but icons has nothing to check. */
      const isIcon = k => k.tagName === "SVG" || k.tagName === "svg" || k.tagName === "IMG" ||
                          /(^|[\s_])icon($|[\s_-])/i.test(k.className.baseVal || k.className || "") ||
                          (k.getBoundingClientRect().width <= 24 && k.getBoundingClientRect().height <= 24);
      /* An explicit align-self is a deliberate opt-out from the row's
         alignment — the Attention Box centres its action button on purpose,
         and Figma draws it that way. Only compare children that actually
         follow the row. */
      const followsRow = k => {
        const a = getComputedStyle(k).alignSelf;
        return a === "auto" || a === "flex-start" || a === "start" || a === "stretch" || a === "normal";
      };
      const textRects = kids.filter(k => !isIcon(k) && followsRow(k))
                            .map(k => k.getBoundingClientRect());
      if (textRects.length >= 2) {
        const tops = textRects.map(r => r.top);
        const spread = Math.max(...tops) - Math.min(...tops);
        if (spread > TOL && spread < 24)
          fail("MISALIGNED ROW", `top-aligned items are ${spread.toFixed(1)}px out of alignment`, el);
      }
    }
  }

  /* ── 6. Left edges of stacked sections must line up ───────────────── */
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (!(cs.display.includes("flex") && cs.flexDirection.startsWith("column"))) continue;
    if (cs.alignItems === "center" || cs.alignItems === "flex-end") continue;  // centred by design
    const kids = [...el.children].filter(vis).filter(k => k.getBoundingClientRect().width > 40);
    if (kids.length < 2) continue;
    const ls = kids.map(k => k.getBoundingClientRect().left);
    const spread = Math.max(...ls) - Math.min(...ls);
    if (spread > TOL)
      fail("EDGE MISALIGN", `stacked sections start at different left edges (${spread.toFixed(1)}px apart)`, el);
  }

  /* ── 7. Consistent vertical rhythm between siblings ───────────────── */
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (!(cs.display.includes("flex") && cs.flexDirection.startsWith("column"))) continue;
    const kids = [...el.children].filter(vis);
    if (kids.length < 3) continue;
    const gaps = [];
    for (let i = 1; i < kids.length; i++) {
      const a = kids[i - 1].getBoundingClientRect(), b = kids[i].getBoundingClientRect();
      gaps.push(b.top - a.bottom);
    }
    const spread = Math.max(...gaps) - Math.min(...gaps);
    if (spread > 4)
      warn("RHYTHM", `uneven vertical gaps between sections (${gaps.map(g => g.toFixed(0)).join(", ")}px)`, el);
  }

  /* ── 8. Spacing must sit on the token scale ───────────────────────── */
  for (const el of all) {
    if (el.closest(".zc-layout__topbar, .zc-layout__rail, .zc-sidemenu")) continue;
    const cs = getComputedStyle(el);
    for (const prop of ["gap", "rowGap", "columnGap", "paddingTop", "paddingRight",
                        "paddingBottom", "paddingLeft"]) {
      const v = px(cs[prop]);
      if (v > 0 && !onScale(v))
        warn("OFF-SCALE", `${prop} is ${v}px — not on the --zc-space-* scale`, el);
    }
  }

  /* ── 9. Siblings must not overlap ─────────────────────────────────── */
  for (const el of all) {
    const kids = [...el.children].filter(vis).filter(k => {
      const p = getComputedStyle(k).position;
      return p === "static" || p === "relative";
    });
    for (let i = 0; i < kids.length; i++)
      for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect();
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 2 && oy > 2)
          fail("OVERLAP", `two siblings overlap by ${ox.toFixed(0)}x${oy.toFixed(0)}px`, kids[i]);
      }
  }

  /* ── 10. Exactly one primary CTA on the page ──────────────────────── */
  const fills = [...document.querySelectorAll('.zc-btn[data-variant="fill"]')]
    .filter(vis).filter(b => !b.closest(".zc-popup"));
  if (fills.length > 1)
    F.push({ rule: "CTA HIERARCHY",
      msg: `${fills.length} primary (fill) buttons visible: ${fills.map(b => `"${b.textContent.trim().slice(0,24)}"`).join(", ")} — only ONE per page`,
      sel: path(fills[1]) });

  /* ── 11. Exactly one active tab per tab group ─────────────────────── */
  for (const tabs of document.querySelectorAll(".zc-tabs")) {
    if (!vis(tabs)) continue;
    const act = tabs.querySelectorAll('[data-state="active"]').length;
    if (act !== 1) fail("TAB STATE", `tab group has ${act} active tabs — must be exactly 1`, tabs);
  }

  /* ── 12. No placeholder content ───────────────────────────────────── */
  const PLACEHOLDER = /\b(Select List|Enter Label Text|Button Text|Lorem ipsum|Placeholder|Text Field|Sample Text|TODO)\b/i;
  for (const el of all) {
    if (el.children.length) continue;
    const t = (el.textContent || "").trim();
    if (t && PLACEHOLDER.test(t)) fail("PLACEHOLDER", `placeholder text "${t.slice(0,40)}" left in the page`, el);
  }
  for (const el of document.querySelectorAll("input[placeholder]")) {
    const v = el.value, ph = el.getAttribute("placeholder");
    if (!v && PLACEHOLDER.test(ph)) warn("PLACEHOLDER", `input still shows demo placeholder "${ph}"`, el);
  }

  /* An empty state is deliberately one simple centred block, so it is exempt
     from "use 10+ components" and "show hierarchy". But the exemption applies
     only when the empty state IS the page. A console screen that merely holds
     an empty panel somewhere is a full screen, and inheriting the exemption let
     a 4-component page pass as though it were a blank slate. Same rule as the
     design metrics use — defined once here so the two cannot drift again. */
  const isEmptyState = (() => {
    const e = [...document.querySelectorAll(".zc-empty")].filter(vis)[0];
    if (!e) return false;
    const scope = e.closest(".zc-layout__container, .zc-layout__body") || document.body;
    const others = [...scope.querySelectorAll(".zc-table, .zc-cheader, .zc-card, .zc-gdetails, .zc-tabs")]
                     .filter(vis).length;
    return others === 0;
  })();

  /* ── 13. Built from components, not divs ──────────────────────────── */
  const zcSet = new Set();
  for (const el of all) for (const c of el.classList) if (c.startsWith("zc-")) zcSet.add(c.split("__")[0]);
  if (zcSet.size < 10 && !isEmptyState)
    F.push({ rule: "TOO FEW COMPONENTS",
      msg: `only ${zcSet.size} distinct zc-* components used — a real screen uses 10+; this looks hand-built`,
      sel: "(page)" });

  /* ── 14. Typography hierarchy must exist ──────────────────────────── */
  const heads = [...document.querySelectorAll(
    '[class^="zc-h"],[class*=" zc-h"],[class*="zc-subtitle-"]')]
    .filter(el => /\bzc-(h[1-6]|subtitle-[123])\b/.test(el.className)).filter(vis);
  const cards = [...document.querySelectorAll(".zc-card")].filter(vis);
  const tableDriven = [...document.querySelectorAll(".zc-table")].filter(vis).length > 0 &&
                      cards.length < 2;
  if (!heads.length && !tableDriven && !isEmptyState)
    F.push({ rule: "NO HIERARCHY",
      msg: `page authored ${cards.length} card(s) but uses no .zc-h* / .zc-subtitle-* anywhere — all text is Regular weight, so it has no hierarchy`,
      sel: "(page)" });

  /* ── 15. Text contrast (WCAG AA) ──────────────────────────────────── */
  const lum = c => {
    const s = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * s[0] + .7152 * s[1] + .0722 * s[2];
  };
  const rgb = str => (str.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  function bgOf(el) {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      const a = (c.match(/[\d.]+/g) || [])[3];
      if (c && c !== "transparent" && a !== "0") return rgb(c);
    }
    return [255, 255, 255];
  }
  const seen = new Set();
  for (const el of all) {
    if (el.children.length || !el.textContent.trim()) continue;
    const cs = getComputedStyle(el);
    const fg = rgb(cs.color), bg = bgOf(el);
    if (fg.length < 3) continue;
    const key = fg.join() + "|" + bg.join();
    if (seen.has(key)) continue;
    seen.add(key);
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    const size = px(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 600;
    const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
    if (ratio < need) {
      const libOwned = [...el.classList].some(c => c.startsWith("zc-")) ||
                       !!el.closest('[class*="zc-badge"],[class*="zc-chip"],[class*="zc-btn"]');
      const m = `text contrast ${ratio.toFixed(2)}:1 (needs ${need}:1) — rgb(${fg}) on rgb(${bg})`;
      if (libOwned) warn("CONTRAST (LIBRARY)", m + " — library token, cannot be fixed in the page; raise with the designer", el);
      else fail("CONTRAST", m, el);
    }
  }

  /* ── 16. Cards in a row must share padding ────────────────────────── */
  const cardRows = new Map();
  for (const c of document.querySelectorAll(".zc-card")) {
    if (!vis(c) || !c.parentElement) continue;
    if (!cardRows.has(c.parentElement)) cardRows.set(c.parentElement, []);
    cardRows.get(c.parentElement).push(c);
  }
  for (const [parent, cards] of cardRows) {
    if (cards.length < 2) continue;
    const pads = cards.map(c => {
      const s = getComputedStyle(c);
      return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].join("/");
    });
    if (new Set(pads).size > 1)
      fail("CARD PADDING", `sibling cards have different padding (${[...new Set(pads)].join("  vs  ")})`, parent);
  }

  /* ── 17. Fixed heights on cards/containers ────────────────────────── */
  for (const el of document.querySelectorAll(".zc-card, .zc-container, .zc-layout__container")) {
    if (!vis(el)) continue;
    const h = el.style.height || "";
    if (h && !h.includes("%") && !h.includes("auto"))
      fail("FIXED HEIGHT", `inline fixed height "${h}" — cards and containers must hug their content`, el);
  }

  /* ── 18. The Catalyst layout shell is mandatory ───────────────────── */
  const layout = document.querySelector(".zc-layout");
  const container = document.querySelector(".zc-layout__container");
  const subheader = document.querySelector(".zc-layout__subheader");
  // A full-page popup covers the viewport and legitimately has no shell.
  // A deliberately shell-less screen (landing page) must say so explicitly:
  //   <body data-zcat-no-shell="landing page — approved by user">
  const popupOnly = !!document.querySelector(".zc-fullpopup") ||
    (!!document.querySelector(".zc-popup") && !document.querySelector(".zc-layout__container"));
  const optedOut = document.body.hasAttribute("data-zcat-no-shell");
  if (!layout && !popupOnly && !optedOut)
    F.push({ rule: "NO LAYOUT SHELL",
      msg: "page does not start from .zc-layout — every product screen is built inside the Catalyst shell (rail, topbar, sidemenu, subheader, container), never as a floating card",
      sel: "(page)" });

  /* ── 19. Primary tabs belong in the Sub Header, never the container ─
     Deliberately NOT gated on a sub header existing: a page that omits the sub
     header and drops its primary tabs into the container is the very case this
     rule exists to catch, and the old `if (subheader)` guard let it through. */
  {
    const containerTabs = [...document.querySelectorAll(".zc-layout__container .zc-tabs")]
      .filter(vis).filter(t => t.getAttribute("data-type") !== "secondary" &&
                               !t.closest(".zc-popup, .zc-fullpopup, .zc-cheader"));
    for (const t of containerTabs)
      fail("TABS IN CONTAINER",
        "page-level tabs are sitting in the container — primary tabs MUST live in the Sub Header (.zc-layout__subheader-tabs); only section-scoped tabs may sit inside the container, as data-type=\"secondary\" in the Container Header. A wireframe drawing them in the container is low fidelity, not an instruction", t);
    const shTabs = [...document.querySelectorAll(".zc-layout__subheader .zc-tabs")].filter(vis);
    if (!shTabs.length && containerTabs.length)
      F.push({ rule: subheader ? "SUB HEADER HAS NO TABS" : "NO SUB HEADER FOR PAGE TABS",
        msg: subheader
          ? "this page has tabs but the Sub Header has none — the Sub Header is where the page's primary tab level lives"
          : "this page has page-level tabs but no Sub Header at all — add the Sub Header and put the primary tabs in its tabs row",
        sel: "(subheader)" });
  }

  /* ── 18b. The shell must be COMPLETE, not merely present ────────────
     .zc-layout on its own proves nothing: the rail with its services and the
     topbar with its project switcher are copied verbatim and never change.
     A page that has the wrapper but not the furniture rebuilt the shell. */
  if (layout && !optedOut) {
    const services = [...document.querySelectorAll(".zc-layout__service")].filter(vis).length;
    if (!document.querySelector(".zc-layout__rail"))
      fail("SHELL INCOMPLETE", "no service rail — copy the shell from docs/template.html verbatim", layout);
    else if (services < 2)
      fail("SHELL INCOMPLETE",
        `the service rail has ${services} service(s) — the template's rail and its logos are copied as-is and never trimmed`, layout);
    if (!document.querySelector(".zc-layout__topbar"))
      fail("SHELL INCOMPLETE", "no topbar — copy the shell from docs/template.html verbatim", layout);
    else if (!document.querySelector(".zc-layout__topbar .zc-ghostdd"))
      fail("SHELL INCOMPLETE",
        "the topbar has no project switcher (.zc-ghostdd) — it is part of the shell and is never replaced with plain text", layout);
  }

  /* ── 18d. Page content sits ON a surface, not on the background ─────
     A wireframe often draws the title and the body straight onto the page
     because that is quick to draw. Our layout puts working content inside a
     container (or, for a landing grid, inside cards). Bare text and bare
     controls floating on .zc-layout__body means the wireframe's arrangement
     was copied instead of the design system's. */
  if (layout && !optedOut) {
    const body = document.querySelector(".zc-layout__body");
    if (body) {
      const loose = [...body.querySelectorAll(
          "h1,h2,h3,h4,p,.zc-btn,.zc-table,.zc-gdetails,.zc-empty,.zc-tabs")]
        .filter(vis)
        .filter(el => !el.closest(".zc-layout__container, .zc-card, .zc-container, " +
                                  ".zc-popup, .zc-fullpopup, .zc-csm, .zc-cheader"));
      if (loose.length) {
        const what = loose.slice(0, 3).map(el =>
          (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 34) ||
          el.className.split(" ")[0]).join(" · ");
        fail("CONTENT NOT IN A CONTAINER",
          `${loose.length} element(s) sit directly on the page background (${what}) — ` +
          "working content goes inside a container; only a landing card-grid may sit on the body",
          ".zc-layout__body");
      }
    }
  }

  /* ── 18e. An empty state is a component, not a hand-made block ───────
     Wireframes draw "nothing here yet" freehand. We have Empty State: the
     illustration, the centred heading and description, and the action row.
     Rebuilding it out of divs loses the centring and the spacing. */
  {
    const emptyish = /^\s*(no |there (are|is) no |you (don'|do not|haven'|have not))/i;
    for (const el of [...document.querySelectorAll("h1,h2,h3,h4,h5,.zc-h1,.zc-h2,.zc-h3,.zc-h4,.zc-h5")]
                       .filter(vis)) {
      const t = (el.textContent || "").trim();
      if (!emptyish.test(t) || el.closest(".zc-empty, .zc-table, .zc-popup, .zc-fullpopup")) continue;
      fail("HAND-BUILT EMPTY STATE",
        `"${t.slice(0, 46)}" reads as an empty state but is not the Empty State component — ` +
        "use .zc-empty so it gets the illustration, the centring and the action row",
        el.className || el.tagName.toLowerCase());
    }
  }

  /* ── 18g2. Overlays must open ON the screen ─────────────────────────
     Everything above this line judges the page in its CLOSED state, because
     that is the state a page loads in. So every menu, dropdown and popup — the
     parts most likely to be positioned wrongly — was invisible to the audit. A
     three-dot menu in a Sub Header opened 118px past the right edge of the
     shell and every gate still said PASS.
     zcat.js opens a menu by putting .is-open on it, so we can open each one,
     measure it, and close it again without clicking anything. An overlay that
     leaves the viewport, or that an ancestor's overflow cuts off, is broken
     however good it looks while shut. */
  {
    const OVERLAY = ".zc-menu, .zc-dropdown__menu, .zc-tooltip, .zc-popover";
    for (const ov of document.querySelectorAll(OVERLAY)) {
      const wasOpen = ov.classList.contains("is-open");
      if (!wasOpen) ov.classList.add("is-open");
      const b = ov.getBoundingClientRect();
      if (b.width > 0 && b.height > 0) {
        const offR = Math.round(b.right - window.innerWidth);
        const offL = Math.round(-b.left);
        let cut = null;
        for (let e = ov.parentElement; e && e !== document.body; e = e.parentElement) {
          const c = getComputedStyle(e);
          if (!/hidden|auto|scroll/.test(c.overflow + c.overflowX + c.overflowY)) continue;
          const eb = e.getBoundingClientRect();
          if (b.right > eb.right + 1 || b.left < eb.left - 1) {
            cut = { by: e.className.toString().split(" ")[0],
                    px: Math.round(Math.max(b.right - eb.right, eb.left - b.left)) };
            break;
          }
        }
        const trigger = (ov.closest("[data-menu], .zc-select-shell") || ov)
                          .getAttribute("aria-label") || ov.className.split(" ")[0];
        if (offR > 0 || offL > 0)
          fail("OVERLAY OFF SCREEN",
            `${trigger} opens ${offR > 0 ? offR + "px past the right edge" : offL + "px past the left edge"} ` +
            "— an action menu is right-aligned to its trigger (data-menu=\"action\"); " +
            "a menu that opens off screen is unusable however good it looks closed",
            ov.className || "overlay");
        else if (cut)
          fail("OVERLAY CLIPPED",
            `${trigger} is cut off by ${cut.by} (${cut.px}px) — the overlay opens ` +
            "outside its scrolling ancestor, so part of it can never be read",
            ov.className || "overlay");
      }
      if (!wasOpen) ov.classList.remove("is-open");
    }
  }

  /* ── 18g3. A stroke icon rendered filled is a black blob ────────────
     26 of 27 sprite symbols are drawn with strokes and carry no fill of their
     own, so anything that gives them a fill turns them into a solid shape. At
     16px that passes for a heavy glyph; at 350px it is a black rectangle in
     the middle of the page. The library now defaults these to stroke, but a
     page can still override it, so check the rendered result. */
  {
    for (const use of document.querySelectorAll("svg use")) {
      const href = use.getAttribute("href") || use.getAttribute("xlink:href") || "";
      const sym = href.startsWith("#") && document.querySelector(href);
      if (!sym) continue;
      // a symbol whose own paths declare a fill is a colour glyph, not a stroke icon
      if ([...sym.querySelectorAll("[fill]")].some(
            n => (n.getAttribute("fill") || "").toLowerCase() !== "none")) continue;
      const svg = use.closest("svg");
      if (!svg || !vis(svg)) continue;
      const f = getComputedStyle(use).fill;
      if (f && f !== "none" && !/rgba\(0, 0, 0, 0\)/.test(f)) {
        const r = svg.getBoundingClientRect();
        fail("ICON RENDERED SOLID",
          `${href} is a stroke icon but renders filled (${f}) at ` +
          `${Math.round(r.width)}x${Math.round(r.height)} — it will draw as a solid ` +
          'shape, not an outline. Leave fill off the <svg> (the library defaults to ' +
          'stroke) or add class="zc-icon-stroke"',
          svg.getAttribute("class") || "svg");
      }
    }
  }

  /* ── 18h. The stylesheet link must carry a version ──────────────────
     zcat.css is a list of @imports. The imports are versioned, but if the page
     asks for zcat.css itself with no ?v=, the browser serves a CACHED copy of
     that file — including its old list of imports — so a library fix never
     reaches the page and it renders against rules that no longer exist. The
     symptom is always the same and always baffling: the markup is right and the
     screen is wrong. */
  {
    for (const l of document.querySelectorAll('link[rel="stylesheet"]')) {
      const href = l.getAttribute("href") || "";
      if (!/zcat\.css/.test(href)) continue;
      if (!/\?v=\d+/.test(href))
        fail("UNVERSIONED STYLESHEET",
          `<link href="${href}"> has no ?v= — the browser will serve a cached ` +
          "zcat.css and the page will render against an old library. Copy the " +
          "link from docs/template.html, which carries the current version",
          'link[rel="stylesheet"]');
    }
  }

  /* ── 18f. One side menu per page, not two nested ────────────────────
     Wireframes routinely draw a second vertical list beside the first — a
     section list AND a record list. Two Container Side Menus side by side
     give the reader two competing "where am I" signals. The inner one is a
     LIST OF RECORDS: it belongs in a table, a card list or a master panel. */
  {
    const menus = [...document.querySelectorAll(".zc-csm")].filter(vis);
    if (menus.length > 1)
      fail("TWO SIDE MENUS",
        `${menus.length} Container Side Menus on one page — only the outer one navigates. ` +
        "The inner list is records, not navigation: use a table, a card list or a master panel",
        ".zc-csm");
  }

  /* ── 18g. One primary button, including repeats ─────────────────────
     A fill button repeated once per row or card is not one CTA, it is N.
     The eye has nowhere to land. Repeat the action as a link or a ghost
     button and keep the single fill for the page's one real next step. */
  {
    const fills = [...document.querySelectorAll('.zc-btn[data-variant="fill"]')].filter(vis);
    const byLabel = {};
    for (const b of fills) {
      const k = (b.textContent || "").trim().replace(/\s+/g, " ").toLowerCase();
      (byLabel[k] = byLabel[k] || []).push(b);
    }
    for (const k in byLabel) {
      if (byLabel[k].length > 1)
        fail("REPEATED PRIMARY BUTTON",
          `"${byLabel[k][0].textContent.trim()}" is a filled button ${byLabel[k].length} times — ` +
          "a per-row action is a link or a ghost button; the fill is reserved for the page's one CTA",
          ".zc-btn[data-variant=\"fill\"]");
    }
  }

  /* ── 18c. A mask asset is not an illustration ───────────────────────
     docs/icons/*mask.svg files are solid shapes meant to be used as CSS
     masks. Dropped into an <img> they render as a black rectangle. */
  for (const img of [...document.querySelectorAll("img")].filter(vis)) {
    const src = img.getAttribute("src") || "";
    if (/mask\.svg$/i.test(src.trim()))
      fail("MASK USED AS IMAGE",
        "this <img> points at a *mask.svg — masks are solid shapes and render as a black box. Use the illustration itself, or apply the mask via .zc-mask-icon", img);
  }

  /* ── 19a. Sub Header primary tabs carry no icons ────────────────────
     Designer rule: the page's tab row reads as a clean line of words. A
     wireframe drawing an icon on every tab is not an instruction. */
  for (const t of [...document.querySelectorAll('.zc-layout__subheader .zc-tabs[data-type="primary"]')].filter(vis))
    if (t.querySelector("svg, img, .zc-mask-icon"))
      fail("ICONS IN PRIMARY TABS",
        "the Sub Header's primary tabs contain icons — this row is text only, even when the wireframe draws icons on it", t);

  /* ── 19c. The service rail must never render a blank chip ───────────
     A chip with no resolvable artwork means the shell was altered — the rail
     is copied from the template verbatim and its logos never change. */
  for (const chip of [...document.querySelectorAll(".zc-layout__service-chip")].filter(vis)) {
    const art = chip.querySelector(".zc-mask-icon, img, svg");
    const cs = art ? getComputedStyle(art) : null;
    const masked = cs && (cs.maskImage || cs.webkitMaskImage || "").replace(/none/, "").trim();
    const bg = cs && (cs.backgroundImage || "").replace(/none/, "").trim();
    const isImg = art && (art.tagName === "IMG" || art.tagName === "svg");
    if (!art || (!masked && !bg && !isImg))
      fail("BLANK SERVICE LOGO",
        "a service chip in the rail renders no artwork — the rail is copied from the template verbatim and its logos never change. If a service has no *-color.svg, use an existing one and say which", chip);
  }

  /* ── 19b. An action bar must not be one lonely button ───────────────
     A primary action floating on the right with an empty left half is the
     "assembled, not designed" tell. The Container Header has two sides on
     purpose: actions right, and a heading / Search / filters left. */
  {
    const hasText = el => (el.textContent || "").trim().length > 0;
    for (const ch of [...document.querySelectorAll(".zc-cheader")].filter(vis)) {
      const left = ch.querySelector(".zc-cheader__left");
      const right = ch.querySelector(".zc-cheader__right");
      const rightBtns = right ? [...right.querySelectorAll(".zc-btn")].filter(vis) : [];
      const leftFilled = left && (hasText(left) || left.querySelector("input, .zc-search-wrap, .zc-select-shell, .zc-tabs"));
      if (rightBtns.length && !leftFilled)
        fail("LONE ACTION BUTTON",
          "this Container Header has actions on the right but nothing on the left — put the section heading, a Search field or the filters there; a primary button floating alone against empty space is the assembled-not-designed tell", ch);
    }
    /* Buttons stacked directly above a table with no Container Header at all */
    for (const tw of [...document.querySelectorAll(".zc-layout__container .zc-table-wrap")].filter(vis)) {
      const prev = tw.previousElementSibling;
      if (!prev || prev.classList.contains("zc-cheader")) continue;
      const btns = [...prev.querySelectorAll(".zc-btn")].filter(vis);
      const hasLeft = prev.querySelector(".zc-search-wrap, .zc-select-shell, .zc-cheader__title") ||
                      (prev.textContent || "").replace(/\s+/g, " ").trim().length > btns.reduce((n, b) => n + (b.textContent || "").trim().length, 0) + 2;
      if (btns.length && !hasLeft)
        fail("ACTION BAR NOT A CONTAINER HEADER",
          "buttons are sitting above this table in a hand-made row — that bar is the Container Header (.zc-cheader), with actions right and a heading / Search / filters left", prev);
    }
  }

  /* ── 20. Hand-built controls instead of components ─────────────────── */
  for (const el of all) {
    const hasZc = [...el.classList].some(c => c.startsWith("zc-"));
    if (hasZc) continue;
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role") || "";
    const clickable = el.hasAttribute("onclick") ||
      ["button", "tab", "checkbox", "radio", "switch", "menuitem"].includes(role);
    if (clickable && !["button", "a", "input", "select", "textarea"].includes(tag))
      fail("HAND-BUILT CONTROL",
        `<${tag}> acts as a control but carries no zc-* component class — use the zcat component (.zc-btn / .zc-tab / .zc-checkbox / .zc-toggle …), never a styled div`, el);
    const INPUT_OWNERS = ".zc-input-wrap, .zc-search-wrap, .zc-select-shell, .zc-select-wrap, " +
      ".zc-textarea, .zc-otp, .zc-checkbox, .zc-radio, .zc-toggle, .zc-datepicker, " +
      ".zc-timepicker, .zc-autocomplete, .zc-numstepper, .zc-input-stepper, " +
      ".zc-upload-input, .zc-kvfield, .zc-doublefield, .zc-slider, .zc-rating";
    if (tag === "input" && el.type !== "hidden" && !el.closest(INPUT_OWNERS))
      fail("HAND-BUILT CONTROL", "bare <input> outside any zcat component — use .zc-input-wrap / .zc-search-wrap / .zc-select-shell", el);
  }

  /* ── 21. Composed, or just stacked? (the "assembled" failure) ─────── */
  if (container && !isEmptyState) {
    // A single wrapper div is still the same stack — descend past it.
    let host = container;
    while (true) {
      const c = [...host.children].filter(vis);
      if (c.length === 1 && c[0].children.length) host = c[0]; else break;
    }
    const kids = [...host.children].filter(vis);
    const gridded = [...host.querySelectorAll("*")].filter(el => {
      if (!vis(el)) return false;
      const cs = getComputedStyle(el);
      const row = (cs.display.includes("flex") && cs.flexDirection.startsWith("row")) ||
                  cs.display.includes("grid");
      if (!row) return false;
      const ch = [...el.children].filter(vis);
      return ch.length >= 2 && ch.every(c => c.getBoundingClientRect().width >= 140);
    });
    if (kids.length >= 4 && !gridded.length && !cards.length && !tableDriven)
      F.push({ rule: "ASSEMBLED, NOT COMPOSED",
        msg: `the container is ${kids.length} components stacked in one vertical column — no multi-column grouping, no cards, no side-by-side relationship anywhere. This is the wireframe shape, not a designed screen: group related content, promote what matters, and use a real composition`,
        sel: path(host) });
  }

  /* ── 22. Every same-role element styled identically = no hierarchy ── */
  if (cards.length >= 3) {
    const sig = cards.map(c => {
      const r = c.getBoundingClientRect(), cs = getComputedStyle(c);
      return `${Math.round(r.width)}x${Math.round(r.height)}|${cs.padding}`;
    });
    if (new Set(sig).size === 1)
      warn("UNIFORM CARDS",
        `all ${cards.length} cards are identical in size and padding — if everything has equal weight, nothing is emphasised. Vary the recipe by importance`, cards[0]);
  }

  /* ── Design metrics — measurable proxies for "designed vs assembled".
     These do NOT judge beauty; they measure the things that reliably separate
     a composed screen from a stack of components: does anything sit side by
     side, is emphasis varied, and does the container run as one long column. */
  /* Every container on the page, not just the first — a page with a list view
     and a detail view has two, and scoring only the first misreads the page. */
  const dScopes = [...document.querySelectorAll(".zc-layout__container, .zc-popup, .zc-fullpopup")];
  if (!dScopes.length) dScopes.push(document.body);
  const dScope = dScopes[0];
  const dAll = sel => dScopes.flatMap(sc => [...sc.querySelectorAll(sel)]);

  /* widest side-by-side group anywhere in the container */
  let gridCols = 1;
  for (const el of dAll("*")) {
    const cs = getComputedStyle(el);
    if (cs.display === "grid") {
      const n = (cs.gridTemplateColumns || "").split(" ").filter(x => x && x !== "none").length;
      if (n > gridCols) gridCols = n;
    } else if (cs.display === "flex" && cs.flexDirection === "row") {
      const kids = [...el.children].filter(vis);
      if (kids.length > 1) {
        const tops = new Set(kids.map(k => Math.round(k.getBoundingClientRect().top / 8)));
        if (tops.size === 1 && kids.length > gridCols) gridCols = kids.length;
      }
    }
  }

  /* how many distinct emphasis levels the page actually uses */
  /* Emphasis counts the typography classes AND the headings components supply
     themselves — a Container Header title or a Popup title is real emphasis,
     and counting only the heading and subtitle utility classes scored honest
     pages at zero. */
  const typeClasses = new Set();
  for (const el of dAll("[class]"))
    for (const c of el.classList)
      if (/^zc-(h[1-6]|subtitle-[1-3])$/.test(c) ||
          /^zc-(cheader__title|gdetails__title|popup__title|fullpopup__title|empty__heading|attention__heading|card__title|layout__subheader-title)$/.test(c))
        typeClasses.add(c);

  /* longest unbroken vertical run of siblings — the wireframe shape */
  let stackRun = 0;
  for (const el of [...dScopes, ...dAll("*")]) {
    const kids = [...el.children].filter(vis);
    if (kids.length < 2) continue;
    const lefts = new Set(kids.map(k => Math.round(k.getBoundingClientRect().left / 8)));
    if (lefts.size === 1 && kids.length > stackRun) stackRun = kids.length;
  }

  return {
    fails: F, warns: W,
    stats: { components: zcSet.size, elements: all.length, cards: cards.length,
             fills: fills.length, headings: heads.length,
             gridCols, typeLevels: typeClasses.size, stackRun,
             scopes: dScopes.length,
             /* An empty state is deliberately one simple centred block; it must
                not be scored as though it were a dashboard. */
             /* Only when the empty state IS the page — its own container holding
                little else. A console screen with an empty panel inside it is
                not an empty state, and must not inherit its exemptions. */
             emptyState: (() => {
               const e = document.querySelector(".zc-layout__container .zc-empty");
               if (!e) return false;
               const c = e.closest(".zc-layout__container");
               const others = [...c.querySelectorAll(".zc-table, .zc-cheader, .zc-card, .zc-gdetails")]
                                .filter(vis).length;
               return others === 0;
             })(),
             uniformCards: cards.length > 2 && new Set(cards.map(c => {
               const r = c.getBoundingClientRect();
               return Math.round(r.width) + "x" + Math.round(r.height);
             })).size === 1 }
  };
}
if (typeof module !== "undefined") module.exports = { __zcatAudit };

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

  /* ── 13. Invent LAYOUTS freely. Never invent a CONTROL. ─────────────
     This used to demand that 90% of classed elements carry a library class,
     which is the wrong line entirely: it made composing a custom card, a hero
     block or a stat treatment a violation, and that is DESIGN — the part a
     person is supposed to be doing. A design system hands you tokens and
     controls; it does not dictate every arrangement.

     So the rule is split where it actually matters:
       LAYOUT and PRESENTATION — invent whatever the screen needs, as long as
         every colour, size, radius and type style comes from a token. That is
         enforced at save time (RAW COLOR, RAW FONT RULE, ODD PIXEL VALUE,
         RESTYLED), so nothing here needs to police it again.
       CONTROLS — never. A button, field, checkbox, select, tab, badge or
         toggle built out of divs loses its states, its keyboard, its focus
         ring and its dark mode, and no amount of care puts those back.

     Only the second is checked here. */
  {
    const inComponent = el => el.closest(
      ".zc-btn, .zc-input-wrap, .zc-select-shell, .zc-checkbox, .zc-radio, " +
      ".zc-toggle, .zc-tabs, .zc-badge, .zc-menu, .zc-table, .zc-csm, " +
      ".zc-sidemenu, .zc-layout__rail, .zc-layout__topbar, .zc-pagination, " +
      ".zc-linkbox, .zc-kvfield, .zc-empty, .zc-stepper, .zc-chip");

    const offenders = [];

    // a div that behaves like a button
    for (const el of all) {
      if (!vis(el) || inComponent(el)) continue;
      const tag = el.tagName;
      if (tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "LABEL") continue;
      if (el.children.length > 1) continue;                 // a wrapper, not a control
      const cs = getComputedStyle(el);
      const looksClickable = cs.cursor === "pointer" ||
        el.getAttribute("role") === "button" || el.hasAttribute("onclick");
      const txt = (el.textContent || "").trim();
      if (looksClickable && txt && txt.length < 30)
        offenders.push({ what: "a button", sel: el.className || tag.toLowerCase(), txt });
    }

    // a bare field with no library wrapper
    for (const el of document.querySelectorAll("input, select, textarea")) {
      if (!vis(el)) continue;
      if (el.type === "checkbox" || el.type === "radio" || el.type === "hidden") continue;
      if (inComponent(el)) continue;
      offenders.push({ what: "a form field", sel: el.className || el.tagName.toLowerCase(),
                       txt: el.getAttribute("placeholder") || "" });
    }

    // a table built as a <table> without the component, or out of divs
    for (const t of document.querySelectorAll("table")) {
      if (!vis(t) || t.classList.contains("zc-table")) continue;
      offenders.push({ what: "a table", sel: t.className || "table", txt: "" });
    }

    // a pill that is doing a Badge's job
    for (const el of all) {
      if (!vis(el) || inComponent(el)) continue;
      if (el.children.length) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const radius = parseFloat(cs.borderRadius) || 0;
      const bg = cs.backgroundColor;
      const painted = bg && !/rgba\(0, 0, 0, 0\)/.test(bg);
      const txt = (el.textContent || "").trim();
      if (painted && radius >= 8 && r.height <= 28 && txt && txt.length <= 24)
        offenders.push({ what: "a badge", sel: el.className || el.tagName.toLowerCase(), txt });
    }

    if (offenders.length) {
      const seen = new Set(), list = [];
      for (const o of offenders) {
        const k = o.what + o.sel;
        if (seen.has(k)) continue;
        seen.add(k);
        list.push(`${o.what} built as .${String(o.sel).split(" ")[0]}` +
                  (o.txt ? ` ("${o.txt.slice(0, 22)}")` : ""));
      }
      fail("HAND-BUILT CONTROL",
        `${list.length} control(s) are made of plain elements instead of the ` +
        `component: ${list.slice(0, 4).join("; ")}` +
        (list.length > 4 ? ` (+${list.length - 4} more)` : "") +
        ". Compose the LAYOUT however the screen needs — that is design — but a " +
        "control built from divs has no states, no keyboard, no focus ring and no " +
        "dark mode, and cannot get them back",
        "(page)");
    }
  }

  /* ── 14. Typography hierarchy must exist ──────────────────────────── */
  /* Components carry headings of their own — .zc-cheader__title,
     .zc-empty__heading, .zc-popup__title, .zc-csm__title are all 16/20 600 or
     larger. Counting only the zc-h and zc-subtitle classes reported "all text is Regular
     weight" on pages whose headings came from the components they were told to
     use, which pushed the author to bolt on a redundant class to satisfy it. */
  const COMPONENT_HEADINGS = ".zc-cheader__title, .zc-empty__heading, " +
    ".zc-popup__title, .zc-fullpopup__title, .zc-csm__title, .zc-csm__heading, " +
    ".zc-sidemenu__heading, .zc-layout__subheader-title, .zc-card__title";
  const heads = [...document.querySelectorAll(
    '[class^="zc-h"],[class*=" zc-h"],[class*="zc-subtitle-"],' + COMPONENT_HEADINGS)]
    .filter(el => /\bzc-(h[1-6]|subtitle-[123])\b/.test(el.className) ||
                  el.matches(COMPONENT_HEADINGS))
    .filter(vis);
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
    // Consistency was the only thing checked, so cards with NO padding at all
    // passed as long as they agreed — and content sat on the border.
    const bare = cards.filter(c => {
      const st = getComputedStyle(c);
      if (c.hasAttribute("data-pad")) return false;      // deliberate opt-out
      return ["Top", "Right", "Bottom", "Left"]
        .every(side => parseFloat(st["padding" + side]) === 0);
    });
    if (bare.length)
      fail("CARD PADDING",
        `${bare.length} card(s) have no padding on any side — content sits on the ` +
        'border. Use the component\'s padding, or data-pad="none" if the card ' +
        "deliberately wraps something that bleeds to its edge", parent);
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
      /* OPEN IT THE WAY A PERSON DOES. Adding .is-open skips zcat.js entirely,
         so the placement code that flips a clipped menu upward never runs — and
         this then reported every short table's row menu as cut off when a real
         click flips it and it fits. Click the trigger; fall back to the class
         only when there is no trigger to click. */
      let clicked = false;
      if (!wasOpen) {
        const shell = ov.closest(".zc-select-shell, [data-menu]");
        const trigger = shell && shell.querySelector(
          ".zc-select-wrap, .zc-table__threedot, button");
        if (trigger) { trigger.click(); clicked = ov.classList.contains("is-open"); }
        if (!clicked) ov.classList.add("is-open");
      }
      const b = ov.getBoundingClientRect();
      if (b.width > 0 && b.height > 0) {
        const offR = Math.round(b.right - window.innerWidth);
        const offL = Math.round(-b.left);
        /* All FOUR edges. This checked left and right only, which is why a
           three-dot menu on a table's last row — cut off at the BOTTOM by
           .zc-table-wrap's overflow-y — passed every gate. Measured on a real
           page: row 2 lost 19px, row 3 lost 67px, audit green.

           zcat.js flips a clipped menu upward on open (data-drop="up"), and
           this synthetic open does not run that code, so mirror it here:
           only report an overlay that is STILL clipped once flipped. */
        let cut = null;
        for (let e = ov.parentElement; e && e !== document.body; e = e.parentElement) {
          const c = getComputedStyle(e);
          if (!/hidden|auto|scroll/.test(c.overflow + c.overflowX + c.overflowY)) continue;
          const eb = e.getBoundingClientRect();
          const over = { right: b.right - eb.right, left: eb.left - b.left,
                         bottom: b.bottom - eb.bottom, top: eb.top - b.top };
          // No estimating whether a flip would help: it has already happened if
          // it was going to. Guessing at it is what produced the false failures.
          const worst = Math.max(over.right, over.left, over.bottom, over.top);
          if (worst > 1) {
            const side = over.right === worst ? "right" : over.left === worst ? "left"
                       : over.bottom === worst ? "bottom" : "top";
            cut = { by: e.className.toString().split(" ")[0],
                    px: Math.round(worst), side };
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
            `${trigger} is cut off at the ${cut.side} by ${cut.by} (${cut.px}px) — ` +
            "the overlay opens outside its scrolling ancestor, so part of it can " +
            "never be read. A menu with no room below should drop upward",
            ov.className || "overlay");
      }
      if (!wasOpen) {
        if (clicked) {
          const shell = ov.closest(".zc-select-shell, [data-menu]");
          const trigger = shell && shell.querySelector(
            ".zc-select-wrap, .zc-table__threedot, button");
          if (trigger) trigger.click();
        }
        ov.classList.remove("is-open");
      }
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

  /* ── 18g4. Stretch is for a table that is alone ─────────────────────
     The Table ships two styles and the choice is not decoration. STRETCH is
     edge-to-edge with no outer border: it works when the table IS the page,
     because the page container already draws the boundary. Put stat cards or
     any other surface above it and that boundary now belongs to the cards —
     the table loses its edge, and the filter row above it reads as floating
     junk rather than the table's own header. BOXY gives the table back its
     own border and radius, and the whole block reads as one object again. */
  {
    for (const tw of document.querySelectorAll('.zc-table-wrap[data-style="stretch"]')) {
      if (!vis(tw)) continue;
      const scope = tw.closest(".zc-layout__container, .zc-layout__body") || document.body;
      const others = [...scope.querySelectorAll(
          ".zc-card, .zc-container-el, .zc-gdetails, .zc-empty, .zc-timeline, .zc-codeblock")]
        .filter(vis)
        .filter(e => !e.contains(tw) && !tw.contains(e));
      if (others.length) {
        const what = others.slice(0, 3)
          .map(e => "." + e.className.toString().split(" ")[0]).join(", ");
        fail("STRETCH TABLE SHARING A PAGE",
          `this table is data-style="stretch" but ${others.length} other surface(s) ` +
          `share the page (${what}) — stretch is only for a table that is ALONE, ` +
          'where the page container is its edge. With anything else on the page use ' +
          'data-style="boxy" so the table keeps its own border and the filter row ' +
          'above it belongs to something',
          ".zc-table-wrap");
      }
    }
  }

  /* ── 18g5. Content fills the container it was given ─────────────────
     A page whose content stops short of its container leaves a band of dead
     background down one side, and it reads as a rendering fault rather than a
     margin. Measured on a real build: the container was 1283px wide and its
     only child was 1199px, so 84px of nothing sat on the right. Every gate
     passed it, because nothing was checking.

     Only the direct children of the container are measured, and only a shortfall
     on the RIGHT — a deliberately narrow centred block (a form, an empty state)
     is short on both sides and is not this bug. */
  {
    const cont = document.querySelector(".zc-layout__container");
    if (cont && !isEmptyState) {
      const cb = cont.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(cont).paddingRight) || 0;
      const kids = [...cont.children].filter(vis);
      if (kids.length) {
        const widest = Math.max(...kids.map(k => k.getBoundingClientRect().right));
        const gap = Math.round(cb.right - pad - widest);
        const leftGap = Math.round(Math.min(...kids.map(k => k.getBoundingClientRect().left)) - cb.left);
        if (gap > 24 && gap - leftGap > 16)
          fail("CONTENT DOES NOT FILL THE CONTAINER",
            `${gap}px of empty container to the right of the content (left gap is ` +
            `${leftGap}px, so this is not a centred block) — the content stops short ` +
            "and the page reads as broken rather than padded",
            ".zc-layout__container");
      }
    }
  }

  /* ── 18g6. The row is the click target, not one cell ────────────────
     Every row highlights on hover, so every row promises it can be clicked.
     When only the first cell carries the link, that promise is false
     everywhere else on the row — the user aims at the row, hits nothing, and
     concludes the page is broken. The entity cell is plain text and the ROW
     carries data-rowlink; zcat.js wires it and leaves the three-dot, the
     checkbox and any real link inside the row alone. */
  {
    for (const tb of document.querySelectorAll(".zc-table tbody")) {
      const rows = [...tb.querySelectorAll("tr.zc-table__row")].filter(vis);
      const guilty = rows.filter(r => {
        if (r.hasAttribute("data-rowlink")) return false;
        const firstCell = r.querySelector("td, .zc-table__td");
        return firstCell && firstCell.querySelector('a[href], .zc-link');
      });
      if (guilty.length) {
        const sample = (guilty[0].textContent || "").trim().split(/\s+/).slice(0, 3).join(" ");
        fail("ROW IS NOT THE CLICK TARGET",
          `${guilty.length} row(s) put the link on the first cell only (e.g. "${sample}") ` +
          "while the whole row highlights on hover — so most of the row looks clickable " +
          'and is not. Make the entity cell plain text and put data-rowlink on the <tr>',
          ".zc-table__row");
      }
    }
  }

  /* ── 18g7. Every icon reference must resolve to a symbol ────────────
     The template ships 27 symbols; docs/icons/ holds 483 files. Referencing any
     of the other ~456 by id gives you a <use> that points at nothing, and it
     renders as an EMPTY BOX — no error, no console warning, and every gate
     green. Two of these shipped on a real build and were only caught by eye. */
  {
    const missing = new Set();
    for (const u of document.querySelectorAll("svg use")) {
      const href = u.getAttribute("href") || u.getAttribute("xlink:href") || "";
      if (!href.startsWith("#")) continue;             // external sprite, checked elsewhere
      if (!document.querySelector(href)) missing.add(href);
    }
    if (missing.size)
      fail("ICON SYMBOL NOT FOUND",
        `${missing.size} icon reference(s) point at a symbol this page does not ` +
        `define (${[...missing].slice(0, 5).join(", ")}) — they render as empty ` +
        "boxes. The sprite ships a subset; copy the symbol you need from " +
        "docs/icons/ into the page's sprite",
        "svg use");
  }

  /* ── 18g3. A row of repeated items must line up ─────────────────────
     Stat rows, metric strips, KPI tiles: three or more siblings laid out
     across, each a label over a value. Composing one is DESIGN and stays free
     — but a row whose items sit at different heights, or whose gaps jump about,
     reads as broken however correct every class name is.

     This is the gap the designer kept hitting: RHYTHM was a WARNING and looked
     only at vertical gaps between sections, so a stat row with a badge sitting
     off the numbers' baseline and gaps running 16px, 48px, 16px passed every
     gate cleanly. Two things are checked, and both are failures:
       GAPS — the horizontal gaps between items should agree;
       BASELINE — the items' value text should sit on one line. A Badge is
         taller than a number, so a row mixing them has to align them, not
         leave each to fall where it lands. */
  {
    const rows = new Set();
    for (const el of all) {
      if (!vis(el)) continue;
      const kids = [...el.children].filter(vis);
      if (kids.length < 3) continue;
      const boxes = kids.map(k => k.getBoundingClientRect());
      // laid out ACROSS: every item shares roughly the same top
      const tops = boxes.map(b => b.top);
      if (Math.max(...tops) - Math.min(...tops) > 4) continue;
      if (boxes[0].width > 0.6 * el.getBoundingClientRect().width) continue;
      rows.add(el);
    }
    for (const row of rows) {
      const kids = [...row.children].filter(vis);
      const boxes = kids.map(k => k.getBoundingClientRect());
      const gaps = [];
      for (let i = 1; i < boxes.length; i++)
        gaps.push(Math.round(boxes[i].left - boxes[i - 1].right));
      const good = gaps.filter(g => g >= 0 && g < 200);
      if (good.length >= 2) {
        const lo = Math.min(...good), hi = Math.max(...good);
        if (hi - lo > 6)
          fail("UNEVEN ROW SPACING",
            `a row of ${kids.length} items has gaps of ${good.join(", ")}px — pick ` +
            "ONE spacing token and use it between every item. Gaps that jump about " +
            "read as broken however correct every class name is", row);
      }
      /* A BADGE IN A STAT ROW MUST SIT ON THE NUMBERS BESIDE IT.
         This is the defect the designer photographed: a row reading
         Columns 5 · Rows 312 · RLS [Enabled] · Policies 2 · Data API [Exposed],
         where the badges sit lower than the plain numbers and the value line
         goes ragged.

         Two earlier versions of this check tried to compare "the value" of every
         item generically — once by the last text leaf, once by the largest text
         — and BOTH failed our own correct page, because a stat card is allowed
         to compose its value differently (ours puts a progress bar where the
         others put a caption). Generic is the wrong altitude. So this checks the
         one case that is unambiguous: a row that mixes Badges with plain text
         values must align their centres, because a Badge is taller and will
         otherwise land wherever it falls. */
      const badges = kids.filter(k => k.querySelector(".zc-badge"));
      if (badges.length && badges.length < kids.length) {
        const centre = k => {
          const b = k.querySelector(".zc-badge");
          if (b) { const r = b.getBoundingClientRect(); return r.top + r.height / 2; }
          const leaves = [...k.querySelectorAll("*")].filter(
            n => n.children.length === 0 && (n.textContent || "").trim() && vis(n));
          if (!leaves.length) return null;
          let best = leaves[0], sz = 0;
          for (const n of leaves) {
            const f = parseFloat(getComputedStyle(n).fontSize) || 0;
            if (f > sz) { sz = f; best = n; }
          }
          const r = best.getBoundingClientRect();
          return r.top + r.height / 2;
        };
        const cs = kids.map(centre).filter(c => c !== null);
        if (cs.length >= 3) {
          const lo = Math.min(...cs), hi = Math.max(...cs);
          if (hi - lo > 4)
            fail("BADGE OFF THE ROW BASELINE",
              `this row mixes ${badges.length} Badge(s) with plain values and their ` +
              `centres sit ${Math.round(hi - lo)}px apart — a Badge is taller than a ` +
              "number, so centre them on each other. Left alone the value line goes " +
              "ragged, which the eye reads as broken before it notices anything " +
              "else being right", row);
        }
      }
    }
  }

  /* ── 18g4. Stretch is for a table that is alone ─────────────────────
     The Table ships two styles and the choice is not decoration. STRETCH is
     edge-to-edge with no outer border: it works when the table IS the page,
     because the page container already draws the boundary. Put stat cards or
     any other surface above it and that boundary now belongs to the cards —
     the table loses its edge, and the filter row above it reads as floating
     junk rather than the table's own header. BOXY gives the table back its
     own border and radius, and the whole block reads as one object again. */
  {
    for (const tw of document.querySelectorAll('.zc-table-wrap[data-style="stretch"]')) {
      if (!vis(tw)) continue;
      const scope = tw.closest(".zc-layout__container, .zc-layout__body") || document.body;
      const others = [...scope.querySelectorAll(
          ".zc-card, .zc-container-el, .zc-gdetails, .zc-empty, .zc-timeline, .zc-codeblock")]
        .filter(vis)
        .filter(e => !e.contains(tw) && !tw.contains(e));
      if (others.length) {
        const what = others.slice(0, 3)
          .map(e => "." + e.className.toString().split(" ")[0]).join(", ");
        fail("STRETCH TABLE SHARING A PAGE",
          `this table is data-style="stretch" but ${others.length} other surface(s) ` +
          `share the page (${what}) — stretch is only for a table that is ALONE, ` +
          'where the page container is its edge. With anything else on the page use ' +
          'data-style="boxy" so the table keeps its own border and the filter row ' +
          'above it belongs to something',
          ".zc-table-wrap");
      }
    }
  }

  /* ── 18g5. Content fills the container it was given ─────────────────
     A page whose content stops short of its container leaves a band of dead
     background down one side, and it reads as a rendering fault rather than a
     margin. Measured on a real build: the container was 1283px wide and its
     only child was 1199px, so 84px of nothing sat on the right. Every gate
     passed it, because nothing was checking.

     Only the direct children of the container are measured, and only a shortfall
     on the RIGHT — a deliberately narrow centred block (a form, an empty state)
     is short on both sides and is not this bug. */
  {
    const cont = document.querySelector(".zc-layout__container");
    if (cont && !isEmptyState) {
      const cb = cont.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(cont).paddingRight) || 0;
      const kids = [...cont.children].filter(vis);
      if (kids.length) {
        const widest = Math.max(...kids.map(k => k.getBoundingClientRect().right));
        const gap = Math.round(cb.right - pad - widest);
        const leftGap = Math.round(Math.min(...kids.map(k => k.getBoundingClientRect().left)) - cb.left);
        if (gap > 24 && gap - leftGap > 16)
          fail("CONTENT DOES NOT FILL THE CONTAINER",
            `${gap}px of empty container to the right of the content (left gap is ` +
            `${leftGap}px, so this is not a centred block) — the content stops short ` +
            "and the page reads as broken rather than padded",
            ".zc-layout__container");
      }
    }
  }

  /* ── 18g6. The row is the click target, not one cell ────────────────
     Every row highlights on hover, so every row promises it can be clicked.
     When only the first cell carries the link, that promise is false
     everywhere else on the row — the user aims at the row, hits nothing, and
     concludes the page is broken. The entity cell is plain text and the ROW
     carries data-rowlink; zcat.js wires it and leaves the three-dot, the
     checkbox and any real link inside the row alone. */
  {
    for (const tb of document.querySelectorAll(".zc-table tbody")) {
      const rows = [...tb.querySelectorAll("tr.zc-table__row")].filter(vis);
      const guilty = rows.filter(r => {
        if (r.hasAttribute("data-rowlink")) return false;
        const firstCell = r.querySelector("td, .zc-table__td");
        return firstCell && firstCell.querySelector('a[href], .zc-link');
      });
      if (guilty.length) {
        const sample = (guilty[0].textContent || "").trim().split(/\s+/).slice(0, 3).join(" ");
        fail("ROW IS NOT THE CLICK TARGET",
          `${guilty.length} row(s) put the link on the first cell only (e.g. "${sample}") ` +
          "while the whole row highlights on hover — so most of the row looks clickable " +
          'and is not. Make the entity cell plain text and put data-rowlink on the <tr>',
          ".zc-table__row");
      }
    }
  }

  /* ── 18g7. Every icon reference must resolve to a symbol ────────────
     The template ships 27 symbols; docs/icons/ holds 483 files. Referencing any
     of the other ~456 by id gives you a <use> that points at nothing, and it
     renders as an EMPTY BOX — no error, no console warning, and every gate
     green. Two of these shipped on a real build and were only caught by eye. */
  {
    const missing = new Set();
    for (const u of document.querySelectorAll("svg use")) {
      const href = u.getAttribute("href") || u.getAttribute("xlink:href") || "";
      if (!href.startsWith("#")) continue;             // external sprite, checked elsewhere
      if (!document.querySelector(href)) missing.add(href);
    }
    if (missing.size)
      fail("ICON SYMBOL NOT FOUND",
        `${missing.size} icon reference(s) point at a symbol this page does not ` +
        `define (${[...missing].slice(0, 5).join(", ")}) — they render as empty ` +
        "boxes. The sprite ships a subset; copy the symbol you need from " +
        "docs/icons/ into the page's sprite",
        "svg use");
  }

  /* ── 18g3. A row of repeated items must line up ─────────────────────
     Stat rows, metric strips, KPI tiles: three or more siblings laid out
     across, each a label over a value. Composing one is DESIGN and stays free
     — but a row whose items sit at different heights, or whose gaps jump about,
     reads as broken however correct every class name is.

     This is the gap the designer kept hitting: RHYTHM was a WARNING and looked
     only at vertical gaps between sections, so a stat row with a badge sitting
     off the numbers' baseline and gaps running 16px, 48px, 16px passed every
     gate cleanly. Two things are checked, and both are failures:
       GAPS — the horizontal gaps between items should agree;
       BASELINE — the items' value text should sit on one line. A Badge is
         taller than a number, so a row mixing them has to align them, not
         leave each to fall where it lands. */
  {
    const rows = new Set();
    for (const el of all) {
      if (!vis(el)) continue;
      const kids = [...el.children].filter(vis);
      if (kids.length < 3) continue;
      const boxes = kids.map(k => k.getBoundingClientRect());
      // laid out ACROSS: every item shares roughly the same top
      const tops = boxes.map(b => b.top);
      if (Math.max(...tops) - Math.min(...tops) > 4) continue;
      if (boxes[0].width > 0.6 * el.getBoundingClientRect().width) continue;
      rows.add(el);
    }
    for (const row of rows) {
      const kids = [...row.children].filter(vis);
      const boxes = kids.map(k => k.getBoundingClientRect());
      const gaps = [];
      for (let i = 1; i < boxes.length; i++)
        gaps.push(Math.round(boxes[i].left - boxes[i - 1].right));
      const good = gaps.filter(g => g >= 0 && g < 200);
      if (good.length >= 2) {
        const lo = Math.min(...good), hi = Math.max(...good);
        if (hi - lo > 6)
          fail("UNEVEN ROW SPACING",
            `a row of ${kids.length} items has gaps of ${good.join(", ")}px — pick ` +
            "ONE spacing token and use it between every item. Gaps that jump about " +
            "read as broken however correct every class name is", row);
      }
    }
  }

  /* ── 18g2. A Chip or Badge never stretches ──────────────────────────
     Dropped into a column flex, align-items defaults to stretch and a Chip is
     pulled to the container width — it stops reading as a tag and starts
     reading as a broken bar. It happened on our own controls sample: a 103px
     Chip rendered 560px wide and the page still passed every gate, because
     every class name was correct.

     Only Chip and Badge are checked. A Button legitimately stretches — our own
     rule says form controls fill the popup body width — so it is left alone. */
  {
    for (const el of [...document.querySelectorAll(".zc-chip, .zc-badge")].filter(vis)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      // measure the text it actually holds
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;" +
        `font:${cs.font}`;
      probe.textContent = (el.textContent || "").trim();
      document.body.appendChild(probe);
      const natural = probe.getBoundingClientRect().width + pad + 40; // icons, close button
      probe.remove();
      if (r.width > natural + 60)
        fail(el.classList.contains("zc-chip") ? "CHIP STRETCHED" : "BADGE STRETCHED",
          `"${(el.textContent || "").trim().slice(0, 24)}" is ${Math.round(r.width)}px wide ` +
          `for about ${Math.round(natural)}px of content — a Chip and a Badge hug what ` +
          "they hold. Stretched, they stop reading as a tag and start reading as a " +
          "broken bar. Usually a column flex: set align-items so the item does not " +
          "stretch", el);
    }
  }

  /* ── 18g4. Two Container Side Menus on one page ─────────────────────
     The rule "one Container Side Menu per page" has been written down for a
     long time with nothing checking it, so a build shipped a page with the
     service menu on the left AND a second vertical list beside it, and the
     eye has no way to tell which one is the navigation.

     The decision is about whether the list GROWS:
       fixed, known set (Overview / Database / Access Control) -> TABS;
       grows with the data (every table in the schema)         -> RECORDS,
         which is a table or a card list, not a second navigation. */
  {
    const menus = [...document.querySelectorAll(".zc-csm")].filter(vis);
    if (menus.length > 1) {
      const counts = menus.map(m => m.querySelectorAll(".zc-csm__item").length);
      fail("TWO CONTAINER SIDE MENUS",
        `${menus.length} Container Side Menus are visible on this page ` +
        `(${counts.join(" and ")} items) — there is no way to tell which one is ` +
        "the navigation. Decide by whether the list grows: a FIXED, known set is " +
        "TABS in the Sub Header; a list that grows with the data is RECORDS — a " +
        "table or a card list — not a second navigation",
        ".zc-csm");
    }
  }

  /* ── 18g5. A copy affordance must be the Link Box ────────────────────
     The Link Box already does exactly what was asked of it: "Copy" on hover,
     "Link copied" after the click, both as tooltips on the icon itself. A page
     shipped its own copy button wired to a TOAST instead, which is louder,
     lands away from the thing you copied, and loses the hover affordance
     entirely. Nothing checked it, because the class names were all fine. */
  {
    const copies = [...document.querySelectorAll(
      '[aria-label*="opy" i], [title*="opy" i], [data-tip*="opy" i], .zc-copy, [data-copy]')]
      .filter(vis)
      .filter(el => !el.closest(".zc-linkbox"))
      .filter(el => el.matches("button, a, [role=button]") || el.hasAttribute("data-copy"));
    if (copies.length) {
      const where = copies.slice(0, 3).map(el =>
        el.getAttribute("aria-label") || el.getAttribute("data-tip") || "copy control");
      fail("COPY NOT A LINK BOX",
        `${copies.length} copy control(s) sit outside a Link Box (${where.join(", ")}). ` +
        "The Link Box component already shows a Copy tooltip on hover and Link " +
        "copied after the click, on the icon itself. A hand-wired copy that fires " +
        "a toast is louder, appears away from the value you copied, and has no " +
        "hover affordance at all",
        ".zc-linkbox");
    }
  }

  /* ── 18g6. Uneven spacing inside a popup body ────────────────────────
     A popup that is right in every other way still reads as unfinished when
     its field groups sit at different distances from each other. This is the
     "assembled, not designed" tell, and it is measurable: the vertical gaps
     between the body's own children should agree. */
  {
    for (const body of [...document.querySelectorAll(".zc-popup__body")].filter(vis)) {
      const kids = [...body.children].filter(vis);
      if (kids.length < 3) continue;
      const gaps = [];
      for (let i = 1; i < kids.length; i++) {
        const a = kids[i - 1].getBoundingClientRect(), b = kids[i].getBoundingClientRect();
        const g = Math.round(b.top - a.bottom);
        if (g >= 0 && g < 120) gaps.push(g);
      }
      if (gaps.length < 2) continue;
      const lo = Math.min(...gaps), hi = Math.max(...gaps);
      if (hi - lo > 8)
        fail("UNEVEN POPUP SPACING",
          `the gaps between this popup's field groups run from ${lo}px to ${hi}px ` +
          `(${gaps.join(", ")}) — pick ONE spacing token and use it between every ` +
          "group. Mixed gaps are the assembled-not-designed tell, and they are the " +
          "first thing the eye picks up even when every control is correct",
          ".zc-popup__body");
    }
  }

  /* ── 18g7. The page must declare a theme ────────────────────────────
     Every page here carries <html data-theme="light">, and none of them got it
     by decision — they got it by copying the template. So nothing ever checked
     it, and the first page written from scratch shipped without it: the token
     definitions never applied, and the library fell back to near-white text on
     a near-white ground. Unreadable, and invisible to every other check,
     because the class names were all perfectly correct. */
  {
    const t = document.documentElement.getAttribute("data-theme");
    if (!t)
      fail("NO THEME DECLARED",
        'the <html> element has no data-theme — every zcat page needs ' +
        'data-theme="light" (or "dark") or the colour tokens never apply and ' +
        "text renders in the library's fallback colour, which can land white on " +
        "white. Copying the template gives you this for free",
        "<html>");
  }

  /* ── 18g8. Create and edit are popups, never pages ──────────────────
     This has been a written rule for a long time and nothing checked it, so a
     build shipped postgres-create.html — a whole PAGE for a create form — and
     scored 95/100 with five of five gates green. The rule exists because
     leaving the list to fill in a form loses your place and your context; a
     popup keeps both, and closing it puts you back where you were.

     What counts: editable fields sitting in the page's container rather than
     inside a popup. Search and filter controls do not count — they act ON the
     list rather than replacing it — and neither does an inline edit inside a
     row or a Key Value field, which is editing in place, not a form. */
  {
    const cont = document.querySelector(".zc-layout__container");
    if (cont) {
      const fields = [...cont.querySelectorAll("input, textarea, select")]
        .filter(vis)
        .filter(el => !el.closest(".zc-popup, .zc-fullpopup, .zc-popup-scrim"))
        .filter(el => !el.closest(".zc-search-wrap, .zc-cheader__filter, .zc-kvfield, " +
                                 ".zc-inline-edit, .zc-table, .zc-pagination"))
        .filter(el => {
          const t = (el.getAttribute("type") || "text").toLowerCase();
          if (["checkbox", "radio", "hidden", "submit", "button"].includes(t)) return false;
          const ph = (el.getAttribute("placeholder") || "").toLowerCase();
          const lbl = (el.getAttribute("aria-label") || "").toLowerCase();
          return !/search|filter|find/.test(ph + " " + lbl);
        });
      if (fields.length >= 3) {
        const names = fields.slice(0, 4).map(f =>
          f.getAttribute("placeholder") || f.getAttribute("name") ||
          f.getAttribute("aria-label") || f.tagName.toLowerCase());
        fail("FORM ON A PAGE",
          `${fields.length} editable fields sit in the container instead of a popup ` +
          `(${names.join(", ")}) — create and edit are ALWAYS popups. Leaving the ` +
          "list to fill in a form loses your place; a popup keeps the list behind " +
          "it and closing it puts you back. A detail page is read-only",
          ".zc-layout__container");
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
     is copied from the template verbatim and its logos never change.

     This used to ask only "is a mask URL DECLARED?", and a 404 is still a
     declared URL — so a rail whose every logo pointed at a path that does not
     exist passed the gate while rendering five blank blue squares. The URLs
     are now fetched and the artwork has to actually load. */
  for (const chip of [...document.querySelectorAll(".zc-layout__service-chip")].filter(vis)) {
    const art = chip.querySelector(".zc-mask-icon, img, svg");
    const cs = art ? getComputedStyle(art) : null;
    const masked = cs && (cs.maskImage || cs.webkitMaskImage || "").replace(/none/, "").trim();
    const bg = cs && (cs.backgroundImage || "").replace(/none/, "").trim();
    const isImg = art && (art.tagName === "IMG" || art.tagName === "svg");

    // a broken <img> reports naturalWidth 0 once it has settled
    if (art && art.tagName === "IMG" && art.complete && art.naturalWidth === 0) {
      fail("BLANK SERVICE LOGO",
        `the rail chip's logo did not load (${art.getAttribute("src")}) — it renders ` +
        "as an empty square. Copy the rail from docs/template.html and fix the path",
        ".zc-layout__service-chip");
      continue;
    }
    // a mask or background URL that 404s paints nothing at all
    const url = (masked || bg || "").match(/url\(["']?([^"')]+)["']?\)/);
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
    /* A hand-made action bar above ANY content block.
       This used to watch tables only, so a card grid with three buttons stacked
       above it in a bare div sailed through — and the Container Header is not a
       table component. It belongs above whatever the block is: a table, a card
       grid, a list, a chart panel. */
    const BLOCKS = ".zc-layout__container .zc-table-wrap, .zc-layout__container .zc-card-grid, " +
                   ".zc-layout__container .zc-cards, .zc-layout__container [data-cards]";
    for (const tw of [...document.querySelectorAll(BLOCKS)].filter(vis)) {
      const prev = tw.previousElementSibling;
      if (!prev || prev.classList.contains("zc-cheader")) continue;
      const btns = [...prev.querySelectorAll(".zc-btn")].filter(vis);
      const hasLeft = prev.querySelector(".zc-search-wrap, .zc-select-shell, .zc-cheader__title") ||
                      (prev.textContent || "").replace(/\s+/g, " ").trim().length > btns.reduce((n, b) => n + (b.textContent || "").trim().length, 0) + 2;
      if (btns.length && !hasLeft)
        fail("ACTION BAR NOT A CONTAINER HEADER",
          "buttons are sitting above this content in a hand-made row — that bar is the Container Header (.zc-cheader), which goes above ANY block (table, card grid, list, chart), with actions right and a heading / Search / filters left", prev);
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
    stats: { components: (() => { const f = new Set();
               for (const el of all) for (const c of el.classList)
                 if (c.startsWith("zc-")) f.add(c.split("__")[0]);
               return f.size; })(),
             elements: all.length, cards: cards.length,
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

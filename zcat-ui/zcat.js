/* =============================================================================
   zcat.js — behaviour layer for the zcat Design System
   No dependencies. Pair with zcat.css.

     <link rel="stylesheet" href="zcat.css">
     <script src="zcat.js" defer></script>

   Auto-initialises on DOMContentLoaded and watches for DOM changes, so markup
   added later (modals, AJAX, framework renders) is wired automatically.

   Manual control:
     zcat.init()            // wire the whole document
     zcat.init(element)     // wire one subtree
     zcat.refresh()         // re-run (safe, idempotent)

   Every handler is idempotent — elements are tagged once and never re-bound.
   ============================================================================= */
(function (global) {
  'use strict';

  var FLAG = '__zcatBound';

  /* Icon paths used when swapping state (design-system icons) */
  var ICON = {
    eye: 'M1.61342 8.47543C1.52262 8.33167 1.47723 8.25979 1.45182 8.14892C1.43273 8.06565 1.43273 7.93431 1.45182 7.85104C1.47723 7.74017 1.52262 7.66829 1.61341 7.52453C2.36369 6.33654 4.59693 3.33331 8.00027 3.33331C11.4036 3.33331 13.6369 6.33654 14.3871 7.52453C14.4779 7.66829 14.5233 7.74017 14.5487 7.85104C14.5678 7.93431 14.5678 8.06565 14.5487 8.14892C14.5233 8.25979 14.4779 8.33167 14.3871 8.47543C13.6369 9.66342 11.4036 12.6666 8.00027 12.6666C4.59693 12.6666 2.36369 9.66342 1.61342 8.47543ZM10 8C10 9.10457 9.10461 10 8.00004 10C6.89547 10 6.00004 9.10457 6.00004 8C6.00004 6.89543 6.89547 6 8.00004 6C9.10461 6 10 6.89543 10 8Z',
    eyeOff: 'M7.16196 3.39488C7.4329 3.35482 7.7124 3.33333 8.00028 3.33333C11.4036 3.33333 13.6369 6.33656 14.3871 7.52455C14.4779 7.66833 14.5233 7.74023 14.5488 7.85112C14.5678 7.93439 14.5678 8.06578 14.5487 8.14905C14.5233 8.25993 14.4776 8.3323 14.3861 8.47705C14.1862 8.79343 13.8814 9.23807 13.4777 9.7203M4.48288 4.47669C3.0415 5.45447 2.06297 6.81292 1.61407 7.52352C1.52286 7.66791 1.47725 7.74011 1.45183 7.85099C1.43273 7.93426 1.43272 8.06563 1.45181 8.14891C1.47722 8.25979 1.52262 8.33168 1.61342 8.47545C2.36369 9.66344 4.59694 12.6667 8.00028 12.6667C9.37255 12.6667 10.5546 12.1784 11.5259 11.5177M2.00028 2L14.0003 14M6.58606 6.58579C6.22413 6.94772 6.00028 7.44772 6.00028 8C6.00028 9.10457 6.89571 10 8.00028 10C8.55256 10 9.05256 9.77614 9.41449 9.41421',
    x: 'M12 4L4 12M4 4L12 12',
    check: 'M13.3333 4L6 11.3333L2.66667 8',
    folder: 'M8.66671 4.66667L7.92301 3.17928C7.70898 2.7512 7.60195 2.53715 7.44229 2.38078C7.30109 2.24249 7.13092 2.13732 6.94409 2.07261C6.73278 1.99947 6.49989 1.99947 6.03412 1.99947H3.46671C2.71997 1.99947 2.3466 1.99947 2.06139 2.1448C1.8105 2.27263 1.60653 2.4766 1.4787 2.72749C1.33337 3.0127 1.33337 3.38607 1.33337 4.13281V11.8661C1.33337 12.6129 1.33337 12.9862 1.4787 13.2715C1.60653 13.5223 1.8105 13.7263 2.06139 13.8541C2.3466 13.9995 2.71997 13.9995 3.46671 13.9995H12.5334C13.2801 13.9995 13.6535 13.9995 13.9387 13.8541C14.1896 13.7263 14.3936 13.5223 14.5214 13.2715C14.6667 12.9862 14.6667 12.6129 14.6667 11.8661V6.79948C14.6667 6.05274 14.6667 5.67937 14.5214 5.39416C14.3936 5.14327 14.1896 4.9393 13.9387 4.81147C13.6535 4.66614 13.2801 4.66614 12.5334 4.66614H8.66671Z'
  };

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function each(root, sel, fn) {
    var list = root.querySelectorAll(sel);
    for (var i = 0; i < list.length; i++) {
      if (list[i][FLAG]) continue;
      list[i][FLAG] = true;
      fn(list[i]);
    }
  }
  function emit(el, name, detail) {
    el.dispatchEvent(new CustomEvent('zcat:' + name, { bubbles: true, detail: detail || {} }));
  }
  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }
  function svgIcon(d, cls) {
    return '<svg' + (cls ? ' class="' + cls + '"' : '') +
      ' viewBox="0 0 16 16" fill="none"><path d="' + d + '"/></svg>';
  }

  /* ── Search: clear button appears only once text is entered ──────────── */
  function initSearch(root) {
    each(root, '.zc-search-wrap', function (wrap) {
      var input = wrap.querySelector('.zc-input');
      var clear = wrap.querySelector('.zc-input__clear');
      if (!input) return;
      function sync() { wrap.classList.toggle('is-filled', input.value.length > 0); }
      input.addEventListener('input', sync);
      if (clear) clear.addEventListener('click', function () {
        input.value = '';
        sync();
        input.focus();
        emit(wrap, 'search:clear');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      sync();
    });
  }

  /* ── Password: reveal toggle ─────────────────────────────────────────── */
  function initPassword(root) {
    each(root, '.zc-input__reveal', function (eye) {
      eye.addEventListener('click', function () {
        var wrap = eye.closest('.zc-input-wrap');
        var input = wrap && wrap.querySelector('.zc-input');
        if (!input) return;
        var reveal = input.type === 'password';
        input.type = reveal ? 'text' : 'password';
        var path = eye.querySelector('path');
        if (path) path.setAttribute('d', reveal ? ICON.eyeOff : ICON.eye);
        eye.setAttribute('aria-pressed', String(reveal));
        emit(input, 'password:toggle', { visible: reveal });
      });
    });
  }

  /* ── Number: our stepper drives the value (native spinner is hidden) ─── */
  function initStepper(root) {
    each(root, '.zc-numstepper', function (stepper) {
      var wrap = stepper.closest('.zc-input-wrap');
      var input = wrap && wrap.querySelector('.zc-input');
      var btns = stepper.querySelectorAll('.zc-numstepper__btn');
      if (!input) return;

      function step(dir) {
        if (input.disabled || input.readOnly) return;
        var inc = parseFloat(input.step) || 1;
        var cur = parseFloat(input.value);
        var next = (isNaN(cur) ? 0 : cur) + dir * inc;
        var min = input.min !== '' ? parseFloat(input.min) : null;
        var max = input.max !== '' ? parseFloat(input.max) : null;
        if (min !== null && next < min) next = min;
        if (max !== null && next > max) next = max;
        next = parseFloat(next.toFixed(10)); // kill float drift
        input.value = next;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        emit(input, 'number:change', { value: next });
      }
      if (btns[0]) btns[0].addEventListener('click', function (e) { e.preventDefault(); step(1); });
      if (btns[1]) btns[1].addEventListener('click', function (e) { e.preventDefault(); step(-1); });

      // Arrow keys mirror the buttons
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowUp') { e.preventDefault(); step(1); }
        if (e.key === 'ArrowDown') { e.preventDefault(); step(-1); }
      });
    });
  }

  /* ── Table wrap: clip horizontally only when the table overflows ─────
     Clipping unconditionally cut off row menus, because a horizontal overflow
     forces the vertical axis to clip as well. */
  function initTableWrap(root) {
    each(root, '.zc-table-wrap', function (wrap) {
      var table = wrap.querySelector('.zc-table');
      if (!table) return;
      function measure() {
        var needs = table.scrollWidth > wrap.clientWidth + 1;
        if (needs) wrap.setAttribute('data-scrollx', '');
        else wrap.removeAttribute('data-scrollx');
      }
      measure();
      requestAnimationFrame(measure);
      if (global.ResizeObserver) new ResizeObserver(measure).observe(wrap);
    });
  }

  /* ── Table rows: the whole row is one click target ───────────────────
     A row that highlights on hover but only responds on its first cell is a
     broken affordance. Controls INSIDE the row keep their own behaviour —
     without that exclusion this would swallow every three-dot menu. */
  function initTableRows(root) {
    var CONTROLS = 'a, button, input, select, textarea, label, summary, ' +
                   '.zc-select-shell, .zc-menu, [data-menu], .zc-checkbox, ' +
                   '.zc-radio, .zc-toggle, .zc-table__threedot';
    each(root, '.zc-table__row[data-rowlink]', function (row) {
      if (row.getAttribute('data-rowlink-bound')) return;
      row.setAttribute('data-rowlink-bound', '1');
      if (!row.hasAttribute('tabindex')) row.setAttribute('tabindex', '0');
      if (!row.hasAttribute('role')) row.setAttribute('role', 'link');

      function go(e) {
        if (e.target.closest && e.target.closest(CONTROLS)) return;
        emit(row, 'row:click');
        var href = row.getAttribute('data-rowlink');
        if (href) window.location.href = href;
      }
      row.addEventListener('click', go);
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          if (e.target !== row) return;
          e.preventDefault();
          go(e);
        }
      });
    });
  }

  /* ── Dropdown: open/close, select, keyboard, outside click ───────────── */
  function initDropdown(root) {
    each(root, '.zc-select-shell', function (shell) {
      var trigger = shell.querySelector('.zc-select-wrap');
      var menu = shell.querySelector('.zc-menu');
      var value = shell.querySelector('.zc-select__value');
      if (!trigger || !menu) return;

      function isDisabled() { return trigger.getAttribute('data-state') === 'disabled'; }
      /* Drop upward when there is no room below. The clipper is usually
         .zc-table-wrap, which needs overflow-x for wide tables and therefore
         clips vertically too; without this the last rows' menus are cut off. */
      function placeMenu() {
        menu.removeAttribute('data-drop');
        var m = menu.getBoundingClientRect();
        if (!m.height) return;
        var limit = window.innerHeight;
        for (var e = menu.parentElement; e && e !== document.body; e = e.parentElement) {
          var c = getComputedStyle(e);
          if (/hidden|auto|scroll/.test(c.overflow + c.overflowX + c.overflowY)) {
            limit = Math.min(limit, e.getBoundingClientRect().bottom);
            break;
          }
        }
        if (m.bottom > limit + 1) menu.setAttribute('data-drop', 'up');
      }

      function open() {
        if (isDisabled()) return;
        closeAll();
        menu.classList.add('is-open');
        placeMenu();
        trigger.setAttribute('data-open', 'true');
        trigger.setAttribute('aria-expanded', 'true');
        emit(shell, 'dropdown:open');
      }
      function close() {
        if (!menu.classList.contains('is-open')) return;
        menu.classList.remove('is-open');
        trigger.removeAttribute('data-open');
        trigger.setAttribute('aria-expanded', 'false');
        emit(shell, 'dropdown:close');
      }
      shell.__zcatClose = close;

      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');
      if (!trigger.hasAttribute('tabindex')) trigger.setAttribute('tabindex', '0');

      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        menu.classList.contains('is-open') ? close() : open();
      });
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); open(); }
        if (e.key === 'Escape') close();
      });

      menu.addEventListener('click', function (e) {
        var item = e.target.closest('.zc-menu__item');
        if (!item || item.getAttribute('aria-disabled') === 'true') return;
        e.stopPropagation();
        select(item);
      });

      var isMulti = menu.classList.contains('zc-menu--multi');

      function select(item) {
        var val = item.getAttribute('data-value') || item.textContent.trim();
        if (isMulti) {
          // Toggle, keep the menu open, reflect every selection in the field
          var on = item.getAttribute('aria-selected') !== 'true';
          item.setAttribute('aria-selected', String(on));
          syncMulti();
          emit(shell, 'dropdown:change', { value: val, selected: on, values: selectedValues(), item: item });
          return;
        }
        /* Action menus (three-dot etc.) fire and close without keeping a
           selected state — the menu is a list of commands, not options. */
        if (shell.getAttribute('data-menu') === 'action') {
          close();
          emit(shell, 'menu:action', { value: val, item: item });
          return;
        }
        var items = menu.querySelectorAll('.zc-menu__item');
        for (var i = 0; i < items.length; i++) items[i].setAttribute('aria-selected', 'false');
        item.setAttribute('aria-selected', 'true');
        if (value) {
          value.textContent = val;
          value.classList.remove('zc-select__value--placeholder');
        }
        close();
        emit(shell, 'dropdown:change', { value: val, item: item });
      }

      function selectedValues() {
        return Array.prototype.map.call(
          menu.querySelectorAll('.zc-menu__item[aria-selected="true"]'),
          function (i) { return i.getAttribute('data-value') || i.textContent.trim(); });
      }

      /* Reflect multi-select into the trigger: chips or comma text */
      function syncMulti() {
        var vals = selectedValues();
        var strip = trigger.querySelector('.zc-chips');
        var comma = trigger.querySelector('.zc-select__value--comma');

        if (comma) { comma.textContent = vals.join(', '); return; }
        if (!strip) {
          if (value) {
            value.textContent = vals.length ? vals.join(', ') : (value.dataset.placeholder || value.textContent);
            value.classList.toggle('zc-select__value--placeholder', !vals.length);
          }
          return;
        }
        var more = strip.querySelector('.zc-chip--more');
        strip.querySelectorAll('.zc-chip:not(.zc-chip--more)').forEach(function (c) { c.remove(); });
        vals.forEach(function (v) {
          var chip = document.createElement('span');
          chip.className = 'zc-chip';
          chip.innerHTML = '<span class="zc-chip__label"></span>' +
            '<button class="zc-chip__close" type="button" aria-label="Remove">' + svgIcon(ICON.x) + '</button>';
          chip.querySelector('.zc-chip__label').textContent = v;
          chip.querySelector('.zc-chip__close').addEventListener('click', function (e) {
            e.stopPropagation();
            var opt = menu.querySelector('.zc-menu__item[data-value="' + v.replace(/"/g, '\\\\"') + '"]');
            if (opt) opt.setAttribute('aria-selected', 'false');
            syncMulti();
            emit(shell, 'chip:remove', { value: v });
          });
          more ? strip.insertBefore(chip, more) : strip.appendChild(chip);
        });
        if (trigger.__zcatMeasureChips) trigger.__zcatMeasureChips();
      }
      shell.__zcatSyncMulti = syncMulti;

      /* Search box inside the menu filters the options live */
      var filter = menu.querySelector('.zc-menu__filter');
      if (filter) {
        filter.addEventListener('click', function (e) { e.stopPropagation(); });
        filter.addEventListener('input', function () {
          applyFilter(menu, filter.value);
        });
      }
    });

    // One document-level listener closes any open menu
    if (!document[FLAG + 'Dropdown']) {
      document[FLAG + 'Dropdown'] = true;
      document.addEventListener('click', closeAll);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });
    }
  }
  function closeAll() {
    var shells = document.querySelectorAll('.zc-select-shell');
    for (var i = 0; i < shells.length; i++) {
      if (shells[i].__zcatClose) shells[i].__zcatClose();
    }
  }

  /* ── Shared: filter a menu's options, toggle the no-result state ─────── */
  function applyFilter(menu, query) {
    var q = (query || '').trim().toLowerCase();
    var items = menu.querySelectorAll('.zc-menu__item');
    var shown = 0;
    for (var i = 0; i < items.length; i++) {
      var label = items[i].querySelector('.zc-menu__label');
      var text = (label ? label.textContent : items[i].textContent).toLowerCase();
      var hit = !q || text.indexOf(q) > -1;
      items[i].style.display = hit ? '' : 'none';
      if (hit) shown++;
    }
    menu.classList.toggle('is-empty', shown === 0);

    // Empty 2 / create-new footer: only while searching with no match
    var create = menu.querySelector('.zc-menu__footer--create');
    if (create) {
      var show = q.length > 0 && shown === 0;
      create.hidden = !show;
      var em = create.querySelector('em');
      if (em) em.textContent = show ? '“' + query + '”' : '';
    }
    return shown;
  }

  /* ── Autocomplete: type to filter, create-new on no match ────────────── */
  function initAutocomplete(root) {
    each(root, '.zc-autocomplete', function (box) {
      var input = box.querySelector('.zc-autocomplete__input');
      var menu = box.querySelector('.zc-menu');
      var clear = box.querySelector('.zc-input__clear');
      var wrap = box.querySelector('.zc-input-wrap');
      if (!input || !menu) return;

      function open() { menu.classList.add('is-open'); }
      function close() { menu.classList.remove('is-open'); }

      function sync() {
        if (wrap) wrap.classList.toggle('is-filled', input.value.length > 0);
        applyFilter(menu, input.value);
        open();
      }

      input.addEventListener('focus', sync);
      input.addEventListener('input', function () { sync(); emit(box, 'autocomplete:input', { value: input.value }); });
      input.addEventListener('click', function (e) { e.stopPropagation(); });
      input.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

      if (clear) clear.addEventListener('click', function () {
        input.value = '';
        sync();
        input.focus();
      });

      menu.addEventListener('click', function (e) {
        var item = e.target.closest('.zc-menu__item');
        if (item) {
          e.stopPropagation();
          var val = item.getAttribute('data-value') || item.textContent.trim();
          input.value = val;
          menu.querySelectorAll('.zc-menu__item').forEach(function (o) { o.setAttribute('aria-selected', 'false'); });
          item.setAttribute('aria-selected', 'true');
          applyFilter(menu, '');
          close();
          emit(box, 'autocomplete:select', { value: val });
          return;
        }
        var create = e.target.closest('.zc-menu__create-inline');
        if (create) {
          e.stopPropagation();
          emit(box, 'autocomplete:create', { value: input.value });
          close();
        }
      });

      document.addEventListener('click', function (e) {
        if (!box.contains(e.target)) close();
      });
    });
  }

  /* ── Chip: standalone close button (chips inside a Dropdown are handled
     by initDropdown / initChipOverflow, which own the selection state) ── */
  function initChips(root) {
    each(root, '.zc-chip__close', function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var chip = btn.closest('.zc-chip');
        if (!chip) return;
        // Leave chips owned by a dropdown/overflow strip to their own handlers
        if (chip.closest('.zc-chips')) return;
        var label = chip.querySelector('.zc-chip__label');
        var value = label ? label.textContent : chip.textContent.trim();
        chip.remove();
        emit(document.body, 'chip:remove', { value: value });
      });
    });
  }

  /* ── Rating: click (or keyboard) to set the value ── */
  function initRating(root) {
    each(root, '.zc-rating[data-interactive="true"]', function (rate) {
      var stars = rate.querySelectorAll('.zc-rating__star');
      var out = rate.querySelector('.zc-rating__value');

      function paint(n) {
        for (var i = 0; i < stars.length; i++) {
          stars[i].setAttribute('data-filled', String(i < n));
        }
        rate.setAttribute('data-value', n);
        if (out) out.textContent = n + ' of 5';
      }

      Array.prototype.forEach.call(stars, function (star, i) {
        star.setAttribute('tabindex', '0');
        star.setAttribute('role', 'radio');
        star.addEventListener('click', function () {
          var n = i + 1;
          // Clicking the current value clears it
          if (parseInt(rate.getAttribute('data-value'), 10) === n) n = 0;
          paint(n);
          emit(rate, 'rating:change', { value: n });
        });
        star.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); star.click(); }
        });
        star.addEventListener('mouseenter', function () {
          for (var j = 0; j < stars.length; j++) stars[j].setAttribute('data-filled', String(j <= i));
        });
      });
      rate.addEventListener('mouseleave', function () {
        paint(parseInt(rate.getAttribute('data-value'), 10) || 0);
      });
    });
  }

  /* ── Tooltip on hover/focus for any [data-tooltip] element ──
     Uses the real Tooltip component, appended to <body> and positioned fixed so
     it can never be clipped by an ancestor's overflow.
  */
  function initTooltips(root) {
    each(root, '[data-tooltip]', function (host) {
      var tip = null;

      function show() {
        if (tip) return;
        var text = host.getAttribute('data-tooltip');
        if (!text) return;
        var side = host.getAttribute('data-tooltip-side') || 'top';

        // data-side names which edge the ARROW sits on, which is the opposite
        // of where the tooltip is placed relative to its host.
        var arrowSide = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[side] || 'bottom';
        tip = document.createElement('span');
        tip.className = 'zc-tooltip zc-tooltip--floating';
        tip.setAttribute('data-side', arrowSide);
        tip.setAttribute('role', 'tooltip');
        var content = document.createElement('span');
        content.className = 'zc-tooltip__content';
        content.textContent = text;
        tip.appendChild(content);
        document.body.appendChild(tip);

        var h = host.getBoundingClientRect();
        var t = tip.getBoundingClientRect();
        var gap = 8, x, y;
        if (side === 'top')         { x = h.left + h.width / 2 - t.width / 2; y = h.top - t.height - gap; }
        else if (side === 'bottom') { x = h.left + h.width / 2 - t.width / 2; y = h.bottom + gap; }
        else if (side === 'left')   { x = h.left - t.width - gap; y = h.top + h.height / 2 - t.height / 2; }
        else                        { x = h.right + gap; y = h.top + h.height / 2 - t.height / 2; }

        // Keep it on screen
        x = Math.max(8, Math.min(x, window.innerWidth - t.width - 8));
        y = Math.max(8, Math.min(y, window.innerHeight - t.height - 8));
        tip.style.left = Math.round(x) + 'px';
        tip.style.top = Math.round(y) + 'px';
      }

      function hide() {
        if (tip) { tip.remove(); tip = null; }
      }

      host.addEventListener('mouseenter', show);
      host.addEventListener('mouseleave', hide);
      host.addEventListener('focus', show);
      host.addEventListener('blur', hide);
      if (!host.hasAttribute('tabindex')) host.setAttribute('tabindex', '0');
    });
  }

  /* ── Inline edit ──
     Hover reveals the pencil. Clicking it swaps in a bordered field plus
     save / cancel icon buttons (Enter = save, Escape = cancel).
  */
  function initInlineEdit(root) {
    each(root, '.zc-inline', function (el) {
      function bind(node) { node.addEventListener('click', start); }

      function start() {
        if (el.classList.contains('is-editing')) return;
        var text = el.querySelector('.zc-inline__text');
        if (!text) return;
        var original = text.textContent;

        var field = document.createElement('span');
        field.className = 'zc-inline__field';
        var input = document.createElement('input');
        input.className = 'zc-inline__input';
        input.value = original;
        field.appendChild(input);

        var actions = document.createElement('span');
        actions.className = 'zc-inline__actions';
        actions.innerHTML =
          '<button class="zc-btn zc-inline__cancel" data-variant="grey" data-content="icon" data-size="small" data-radius="rounded" type="button" aria-label="Cancel">' +
            svgIcon(ICON.x, 'zc-btn__icon') + '</button>' +
          '<button class="zc-btn zc-inline__save" data-variant="grey" data-content="icon" data-size="small" data-radius="rounded" type="button" aria-label="Save">' +
            svgIcon(ICON.check, 'zc-btn__icon') + '</button>';

        text.replaceWith(field);
        el.appendChild(actions);
        el.classList.add('is-editing');
        input.focus();
        input.select();
        emit(el, 'inline:edit', { value: original });

        var done = false;
        function commit(save) {
          if (done) return;
          done = true;
          var span = document.createElement('span');
          span.className = 'zc-inline__text';
          span.textContent = save ? (input.value || original) : original;
          field.replaceWith(span);
          actions.remove();
          el.classList.remove('is-editing');
          bind(span);
          if (save && span.textContent !== original) {
            emit(el, 'inline:change', { value: span.textContent, previous: original });
          } else if (!save) {
            emit(el, 'inline:cancel', { value: original });
          }
        }

        actions.querySelectorAll('.zc-btn').forEach(function (b) {
          b.addEventListener('mousedown', function (e) { e.preventDefault(); });
        });
        actions.querySelector('.zc-inline__save').addEventListener('click', function () { commit(true); });
        actions.querySelector('.zc-inline__cancel').addEventListener('click', function () { commit(false); });

        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); commit(true); }
          if (e.key === 'Escape') { e.preventDefault(); commit(false); }
        });
      }

      var text = el.querySelector('.zc-inline__text');
      if (text) bind(text);
      var pencil = el.querySelector('.zc-inline__icon');
      if (pencil) pencil.addEventListener('click', start);
    });
  }

  /* ── File upload: picker, drag & drop, file list ─────────────────────── */
  function initUpload(root) {
    each(root, '.zc-upload-trigger', function (trigger) {
      var scope = trigger.closest('.zc-input-group') || trigger.parentElement;
      if (!scope) return;
      var input = scope.querySelector('.zc-upload-input');
      var list = scope.querySelector('.zc-upload-list');
      if (!input) return;

      trigger.addEventListener('click', function () { input.click(); });
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
      });
      trigger.addEventListener('dragover', function (e) {
        e.preventDefault();
        trigger.setAttribute('data-state', 'hover');
      });
      trigger.addEventListener('dragleave', function () { trigger.removeAttribute('data-state'); });
      trigger.addEventListener('drop', function (e) {
        e.preventDefault();
        trigger.removeAttribute('data-state');
        if (e.dataTransfer && e.dataTransfer.files.length) render(e.dataTransfer.files);
      });
      input.addEventListener('change', function () { render(input.files); });

      function render(files) {
        emit(trigger, 'upload:select', { files: files });
        if (!list) return;
        if (!input.multiple) list.innerHTML = '';
        Array.prototype.forEach.call(files, function (file) {
          var row = document.createElement('div');
          row.className = 'zc-upload-file';
          row.innerHTML =
            svgIcon(ICON.folder, 'zc-upload-file__icon') +
            '<span class="zc-upload-file__name"></span>' +
            '<span class="zc-upload-file__meta">' + formatBytes(file.size) + '</span>' +
            '<button class="zc-upload-file__remove" type="button" aria-label="Remove">' +
              svgIcon(ICON.x) + '</button>';  /* styled by .zc-upload-file__remove svg */
          row.querySelector('.zc-upload-file__name').textContent = file.name;
          row.querySelector('.zc-upload-file__remove').addEventListener('click', function () {
            row.remove();
            emit(trigger, 'upload:remove', { name: file.name });
          });
          list.appendChild(row);
        });
      }
    });
  }

  /* ── Key Value: add / remove / drag to reorder ───────────────────────── */
  function initKeyValue(root) {
    each(root, '.zc-kvfield-group', function (group) {
      function rows() { return group.querySelectorAll('.zc-kvfield'); }

      function sync() {
        var list = rows();
        for (var i = 0; i < list.length; i++) {
          var minus = list[i].querySelector('.zc-kvfield__minus');
          // The last remaining row cannot be removed
          if (minus) minus.disabled = list.length <= 1;
        }
      }

      group.addEventListener('click', function (e) {
        var add = e.target.closest('.zc-kvfield__add');
        var del = e.target.closest('.zc-kvfield__minus');
        if (add && !add.disabled) {
          var src = add.closest('.zc-kvfield');
          var copy = src.cloneNode(true);
          copy.querySelectorAll('input').forEach(function (i) { i.value = ''; });
          // cloned nodes must be re-wired
          copy.querySelectorAll('*').forEach(function (n) { n[FLAG] = false; });
          copy[FLAG] = false;
          src.after(copy);
          sync();
          init(group);
          emit(group, 'keyvalue:add', { row: copy });
        } else if (del && !del.disabled) {
          var row = del.closest('.zc-kvfield');
          var next = row.nextElementSibling;
          if (next && next.classList.contains('zc-helper')) next.remove();
          row.remove();
          sync();
          emit(group, 'keyvalue:remove');
        }
      });

      // Drag to reorder, by the handle only
      var dragged = null;
      group.addEventListener('dragstart', function (e) {
        var handle = e.target.closest('.zc-kvfield__drag');
        if (!handle) { e.preventDefault(); return; }
        dragged = handle.closest('.zc-kvfield');
        dragged.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
      });
      group.addEventListener('dragover', function (e) {
        if (!dragged) return;
        e.preventDefault();
        var over = e.target.closest('.zc-kvfield');
        if (!over || over === dragged) return;
        clearMarkers();
        over.classList.add('is-dragover');
      });
      group.addEventListener('drop', function (e) {
        if (!dragged) return;
        e.preventDefault();
        var over = e.target.closest('.zc-kvfield');
        clearMarkers();
        if (over && over !== dragged) {
          var list = Array.prototype.slice.call(rows());
          if (list.indexOf(dragged) < list.indexOf(over)) over.after(dragged);
          else over.before(dragged);
          emit(group, 'keyvalue:reorder', { row: dragged });
        }
      });
      group.addEventListener('dragend', function () {
        if (dragged) dragged.classList.remove('is-dragging');
        clearMarkers();
        dragged = null;
      });
      function clearMarkers() {
        var list = rows();
        for (var i = 0; i < list.length; i++) list[i].classList.remove('is-dragover');
      }

      sync();
    });
  }

  /* One removable row inside an overflow tooltip */
  function buildOverflowRow(list, chip, wrap, remeasure) {
    var label = chip.querySelector('.zc-chip__label');
    var text = label ? label.textContent : chip.textContent.trim();
    var row = document.createElement('div');
    row.className = 'zc-chip-overflow__item';
    row.innerHTML = '<span class="zc-chip-overflow__label"></span>' +
      '<button class="zc-overflow-close" type="button" aria-label="Remove">' + svgIcon(ICON.x) + '</button>';
    row.querySelector('.zc-chip-overflow__label').textContent = text;
    row.querySelector('.zc-overflow-close').addEventListener('click', function (e) {
      e.stopPropagation();
      chip.remove();
      emit(wrap, 'chip:remove', { value: text });
      if (remeasure) remeasure();
    });
    list.appendChild(row);
  }

  /* Comma-separated overflow: truncate + hover tooltip listing every value */
  function initCommaOverflow(root) {
    each(root, '.zc-comma-wrap', function (box) {
      var value = box.querySelector('.zc-select__value--comma');
      var list = box.querySelector('.zc-chip-overflow');
      if (!value) return;

      function rebuild() {
        box.classList.toggle('is-clipped', value.scrollWidth > value.clientWidth + 1);
        if (!list) return;
        list.innerHTML = '';
        var parts = value.textContent.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
        parts.forEach(function (text) {
          var row = document.createElement('div');
          row.className = 'zc-chip-overflow__item';
          row.innerHTML = '<span class="zc-chip-overflow__label"></span>' +
            '<button class="zc-overflow-close" type="button" aria-label="Remove">' + svgIcon(ICON.x) + '</button>';
          row.querySelector('.zc-chip-overflow__label').textContent = text;
          row.querySelector('.zc-overflow-close').addEventListener('click', function (e) {
            e.stopPropagation();
            var left = parts.filter(function (p) { return p !== text; });
            value.textContent = left.join(', ');
            parts = left;
            emit(box, 'chip:remove', { value: text, values: left });
            rebuild();
          });
          list.appendChild(row);
        });
      }
      rebuild();
      requestAnimationFrame(rebuild);
      if (global.ResizeObserver) new ResizeObserver(rebuild).observe(box);
      box.__zcatRebuildComma = rebuild;
    });
  }

  /* ── Chip overflow: collapse chips that don't fit into a "+N" chip ───── */
  function initChipOverflow(root) {
    each(root, '.zc-select-wrap--chips[data-overflow="count"]', function (wrap) {
      var strip = wrap.querySelector('.zc-chips');
      if (!strip) return;

      function measure() {
        var chips = strip.querySelectorAll('.zc-chip:not(.zc-chip--more)');
        var more = strip.querySelector('.zc-chip--more');
        if (!chips.length) return;

        // Reset, then hide from the end until everything fits
        for (var i = 0; i < chips.length; i++) chips[i].classList.remove('is-hidden');
        if (more) more.hidden = true;

        var avail = strip.clientWidth;
        if (!avail) return;

        var gap = parseFloat(getComputedStyle(strip).gap) || 4;
        var used = 0, visible = 0;
        for (var j = 0; j < chips.length; j++) {
          var w = chips[j].offsetWidth + (j ? gap : 0);
          if (used + w <= avail) { used += w; visible++; } else break;
        }

        var hidden = chips.length - visible;
        if (hidden > 0 && more) {
          // Reserve room for the +N chip itself
          more.hidden = false;
          var moreW = more.offsetWidth + gap;
          while (visible > 0 && used + moreW > avail) {
            visible--;
            used -= chips[visible].offsetWidth + (visible ? gap : 0);
          }
          hidden = chips.length - visible;

          for (var k = visible; k < chips.length; k++) chips[k].classList.add('is-hidden');

          var count = more.querySelector('.zc-chip__label');
          if (count) count.textContent = '+' + hidden + ' more';

          var list = more.querySelector('.zc-chip-overflow');
          if (list) {
            list.innerHTML = '';
            for (var m = visible; m < chips.length; m++) {
              buildOverflowRow(list, chips[m], wrap, measure);
            }
          }
        }
      }

      measure();
      requestAnimationFrame(measure);
      if (global.ResizeObserver) new ResizeObserver(measure).observe(wrap);
      wrap.__zcatMeasureChips = measure;

      // Removing a chip re-measures
      strip.addEventListener('click', function (e) {
        var close = e.target.closest('.zc-chip__close');
        if (!close) return;
        var chip = close.closest('.zc-chip');
        if (chip) {
          var value = chip.querySelector('.zc-chip__label');
          chip.remove();
          emit(wrap, 'chip:remove', { value: value ? value.textContent : '' });
          measure();
        }
      });
    });
  }

  /* ── Link Box: shadow only when the text is actually clipped ─────────── */
  function initLinkBox(root) {
    each(root, '.zc-linkbox', function (box) {
      var text = box.querySelector('.zc-linkbox__text');
      var copy = box.querySelector('.zc-linkbox__copy');
      if (!text) return;

      function check() {
        box.classList.toggle('is-clipped', text.scrollWidth > text.clientWidth + 1);
      }
      check();
      requestAnimationFrame(check);
      if (text.getAttribute('data-overflow') === 'scroll') text.addEventListener('scroll', check);
      if (global.ResizeObserver) new ResizeObserver(check).observe(box);

      /* The icon carries its own label: "Copy" on hover, "Link copied" after. */
      var TIP_IDLE = copy && (copy.getAttribute('data-tip-idle') || 'Copy');
      var TIP_DONE = copy && (copy.getAttribute('data-tip-done') || 'Link copied');
      if (copy && !copy.getAttribute('data-tip')) copy.setAttribute('data-tip', TIP_IDLE);
      if (copy && !copy.getAttribute('aria-label')) copy.setAttribute('aria-label', TIP_IDLE);

      if (copy) copy.addEventListener('click', function () {
        var value = text.textContent.trim();
        var done = function () {
          copy.classList.add('is-copied');
          copy.setAttribute('data-tip', TIP_DONE);
          emit(box, 'linkbox:copy', { value: value });
          setTimeout(function () {
            copy.classList.remove('is-copied');
            copy.setAttribute('data-tip', TIP_IDLE);
          }, 1500);
        };
        /* Feedback is not conditional on the clipboard succeeding. The old
           code called done() only on success and swallowed the failure, so
           over http, without permission, or in an older browser the user
           clicked and NOTHING happened — no tooltip, no class, no event. The
           textarea fallback covers most of those; either way the person is
           told what happened. */
        var ok = function () { done(); };
        var fallback = function () {
          try {
            var ta = document.createElement('textarea');
            ta.value = value;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          } catch (e) { /* nothing more we can do */ }
          done();
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(value).then(ok).catch(fallback);
        } else {
          fallback();
        }
      });
    });
  }

  /* ── OTP: auto-advance, backspace, paste ─────────────────────────────── */
  function initOtp(root) {
    each(root, '.zc-otp', function (otp) {
      var boxes = otp.querySelectorAll('.zc-otp__box');
      Array.prototype.forEach.call(boxes, function (box, i) {
        box.addEventListener('input', function () {
          box.value = box.value.replace(/\D/g, '').slice(0, 1);
          if (box.value && boxes[i + 1]) boxes[i + 1].focus();
          emitCode();
        });
        box.addEventListener('keydown', function (e) {
          if (e.key === 'Backspace' && !box.value && boxes[i - 1]) boxes[i - 1].focus();
          if (e.key === 'ArrowLeft' && boxes[i - 1]) boxes[i - 1].focus();
          if (e.key === 'ArrowRight' && boxes[i + 1]) boxes[i + 1].focus();
        });
        box.addEventListener('paste', function (e) {
          e.preventDefault();
          var digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
          for (var j = 0; j < digits.length && i + j < boxes.length; j++) {
            boxes[i + j].value = digits[j];
          }
          var last = Math.min(i + digits.length, boxes.length - 1);
          boxes[last].focus();
          emitCode();
        });
      });
      function emitCode() {
        var code = Array.prototype.map.call(boxes, function (b) { return b.value; }).join('');
        emit(otp, 'otp:change', { value: code, complete: code.length === boxes.length });
      }
    });
  }

  /* ── Textarea character count ────────────────────────────────────────── */
  function initCharCount(root) {
    each(root, '.zc-textarea', function (ta) {
      var group = ta.closest('.zc-input-group');
      var counter = group && group.querySelector('.zc-textarea-count');
      if (!counter) return;
      var max = ta.getAttribute('maxlength') || (counter.textContent.split('/')[1] || '').trim();
      function sync() { counter.textContent = ta.value.length + '/' + max; }
      ta.addEventListener('input', sync);
      sync();
    });
  }

  /* ── Shell: Side Menu, Container Side Menu, Layout rail ────────────────
     One-of selection within each group + sidemenu expand/collapse toggle. */
  function initShell(root) {
    function bindGroup(sel, groupSel, stateAttr, eventName) {
      each(root, sel, function (item) {
        item.addEventListener('click', function () {
          var group = item.closest(groupSel);
          if (!group) return;
          var items = group.querySelectorAll(sel);
          for (var i = 0; i < items.length; i++) items[i].removeAttribute('data-state');
          item.setAttribute('data-state', stateAttr);
          emit(group, eventName, {
            value: (item.textContent || '').trim(), item: item
          });
        });
      });
    }
    bindGroup('.zc-sidemenu__item', '.zc-sidemenu', 'active', 'sidemenu:select');
    bindGroup('.zc-csm__item', '.zc-csm', 'selected', 'csm:select');
    bindGroup('.zc-layout__service', '.zc-layout__services', 'active', 'layout:service');
    bindGroup('.zc-tab:not(:disabled)', '.zc-tabs', 'active', 'tab:select');
    bindGroup('.zc-carousel__dot', '.zc-carousel', 'active', 'carousel:select');

    /* Accordion: header click toggles open state */
    each(root, '.zc-accordion__header', function (head) {
      head.addEventListener('click', function () {
        var acc = head.closest('.zc-accordion');
        if (!acc) return;
        var open = acc.getAttribute('data-state') === 'open';
        if (open) acc.removeAttribute('data-state');
        else acc.setAttribute('data-state', 'open');
        emit(acc, 'accordion:toggle', { open: !open });
      });
    });
    each(root, '.zc-accordion-link', function (link) {
      link.addEventListener('click', function () {
        var open = link.getAttribute('data-state') === 'open';
        if (open) link.removeAttribute('data-state');
        else link.setAttribute('data-state', 'open');
        emit(link, 'accordion:toggle', { open: !open });
      });
    });

    /* Checkbox indeterminate: property can't be set from markup */
    each(root, '.zc-checkbox__input[data-indeterminate]', function (input) {
      input.indeterminate = true;
    });

    /* Toast: element marked data-toast-close dismisses its toast */
    each(root, '[data-toast-close]', function (btn) {
      btn.addEventListener('click', function () {
        var toast = btn.closest('.zc-toast');
        if (!toast) return;
        toast.style.display = 'none';
        emit(toast, 'toast:close', {});
      });
    });

    each(root, '.zc-sidemenu__expand', function (btn) {
      btn.addEventListener('click', function () {
        var menu = btn.closest('.zc-sidemenu');
        if (!menu) return;
        var collapsed = menu.getAttribute('data-type') === 'collapsed';
        if (collapsed) menu.removeAttribute('data-type');
        else menu.setAttribute('data-type', 'collapsed');
        emit(menu, 'sidemenu:toggle', { collapsed: !collapsed });
      });
    });
  }

  /* ── public API ──────────────────────────────────────────────────────── */
  function init(root) {
    root = root || document;
    initTooltips(root);
    initChips(root);
    initRating(root);
    initSearch(root);
    initPassword(root);
    initStepper(root);
    initDropdown(root);
    initTableWrap(root);
    initTableRows(root);
    initAutocomplete(root);
    initInlineEdit(root);
    initUpload(root);
    initKeyValue(root);
    initChipOverflow(root);
    initCommaOverflow(root);
    initLinkBox(root);
    initOtp(root);
    initCharCount(root);
    initShell(root);
    return root;
  }

  function refresh() { return init(document); }

  var zcat = { init: init, refresh: refresh, version: '1.0.0' };
  global.zcat = zcat;
  if (typeof module === 'object' && module.exports) module.exports = zcat;

  /* Auto-init, and pick up markup added later */
  function boot() {
    init(document);
    if (global.MutationObserver) {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].addedNodes.length) { init(document); return; }
        }
      }).observe(document.body, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(typeof window !== 'undefined' ? window : this);

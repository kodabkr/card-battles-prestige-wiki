/* Card Battles: Prestige Wiki — site behaviour.
   Navigation, search, sounds, card tilt/flip, sortable tables, scroll reveal.
   No eval, no inline code, no network requests except this site's own files. */
(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function iconSvg(name) {
    return '<svg class="i" aria-hidden="true" focusable="false"><use href="' + root.getAttribute('data-icons') + '#i-' + name + '"></use></svg>';
  }

  /* ---------------- Sounds (off until the visitor turns them on) ---------------- */
  var Sound = (function () {
    var KEY = 'cbp-sound';
    var on = false;
    var urls = {};
    var cache = {};
    var last = {};
    var VOL = { page: 0.32, tick: 0.16, flip: 0.38, chime: 0.3 };
    try { urls = JSON.parse(root.getAttribute('data-audio') || '{}'); } catch (e) {}
    try { on = localStorage.getItem(KEY) === 'on'; } catch (e) {}
    function get(name) {
      if (!cache[name] && urls[name]) {
        cache[name] = new Audio(urls[name]);
        cache[name].preload = 'auto';
      }
      return cache[name];
    }
    function play(name) {
      if (!on) return;
      var now = Date.now();
      if (last[name] && now - last[name] < 80) return;
      last[name] = now;
      var a = get(name);
      if (!a) return;
      var node = a.paused ? a : a.cloneNode();
      node.volume = VOL[name] || 0.3;
      try { node.currentTime = 0; } catch (e) {}
      var p = node.play();
      if (p && p.catch) p.catch(function () {});
    }
    function update() {
      $$('.sound-toggle').forEach(function (b) {
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.title = 'Sound effects: ' + (on ? 'on' : 'off');
      });
    }
    function set(v) {
      on = v;
      try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch (e) {}
      update();
      if (v) {
        Object.keys(urls).forEach(get);
        play('tick');
      }
    }
    update();
    if (on) Object.keys(urls).forEach(get);
    return { play: play, set: set, isOn: function () { return on; } };
  })();

  $$('.sound-toggle').forEach(function (b) {
    b.addEventListener('click', function () {
      Sound.set(!Sound.isOn());
      toast(Sound.isOn() ? 'Sound effects on' : 'Sound effects off', Sound.isOn() ? 'sound-on' : 'sound-off');
    });
  });

  // Subtle hover ticks, and a chime when pointing at a rare item.
  doc.addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse') return;
    var el = e.target.closest('.quick, .gcard, .pager__link, .nav-group a, .item[data-rare="1"]');
    if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
    if (el.matches('.item[data-rare="1"]')) {
      if (!el.hasAttribute('data-chimed')) {
        el.setAttribute('data-chimed', '');
        Sound.play('chime');
      }
      return;
    }
    Sound.play('tick');
  });

  /* ---------------- Toast ---------------- */
  var toastTimer;
  function toast(msg, ic) {
    var t = $('.toast');
    if (!t) return;
    t.innerHTML = iconSvg(ic || 'check') + '<span>' + esc(msg) + '</span>';
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 1800);
  }

  /* ---------------- Copy heading links ---------------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.className = 'sr-copy';
      doc.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = doc.execCommand('copy'); } catch (e) {}
      doc.body.removeChild(ta);
      ok ? resolve() : reject();
    });
  }
  doc.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-copy]');
    if (!a) return;
    e.preventDefault();
    var hash = a.getAttribute('href');
    var url = location.origin + location.pathname + hash;
    history.replaceState(null, '', hash);
    var target = doc.getElementById(hash.slice(1));
    if (target) target.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
    copyText(url).then(
      function () { toast('Link copied'); },
      function () { toast('Link is in the address bar', 'link'); }
    );
  });

  /* ---------------- Page transitions + page-turn sound ---------------- */
  doc.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if ((a.target && a.target !== '_self') || a.hasAttribute('download') || a.hasAttribute('data-lightbox')) return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (/\.(webp|avif|png|jpe?g|gif|mp4|webm|json|wav)$/i.test(url.pathname)) return;
    if (url.pathname === location.pathname) return; // same-page anchor
    Sound.play('page');
    if (root.classList.contains('vt') || reduce.matches) return; // native view transition
    e.preventDefault();
    root.classList.add('is-leaving');
    setTimeout(function () { location.href = url.href; }, 150);
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) root.classList.remove('is-leaving');
  });

  /* ---------------- Mobile navigation drawer ---------------- */
  var menuBtn = $('.menu-btn');
  function setNav(open) {
    root.classList.toggle('nav-open', open);
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    if (open) {
      var first = $('#sidebar a');
      if (first) first.focus({ preventScroll: true });
    }
  }
  if (menuBtn) menuBtn.addEventListener('click', function () { setNav(!root.classList.contains('nav-open')); });
  $$('[data-close-nav]').forEach(function (el) { el.addEventListener('click', function () { setNav(false); }); });
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && root.classList.contains('nav-open')) {
      setNav(false);
      if (menuBtn) menuBtn.focus();
    }
  });
  // Keep the current page visible in the sidebar.
  var sidebar = $('.sidebar');
  var current = $('.sidebar [aria-current="page"]');
  if (sidebar && current) sidebar.scrollTop = Math.max(0, current.offsetTop - sidebar.clientHeight / 2);

  /* ---------------- Reveal on scroll, ladders, progress bars ---------------- */
  $$('.progress[data-value]').forEach(function (p) {
    var v = parseFloat(p.getAttribute('data-value'));
    var m = parseFloat(p.getAttribute('data-max'));
    p.style.setProperty('--p', Math.max(0, Math.min(1, v / m)).toFixed(4));
  });
  $$('.ladder').forEach(function (l) {
    $$('.ladder__step', l).forEach(function (s, i) { s.style.setProperty('--i', String(Math.min(i, 14))); });
  });
  var reveals = $$('.reveal');
  if (!('IntersectionObserver' in window) || reduce.matches) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    // Stagger siblings that appear together (grids of cards etc.).
    var seen = new Map();
    reveals.forEach(function (el) {
      var parent = el.parentElement;
      var n = seen.get(parent) || 0;
      seen.set(parent, n + 1);
      el.style.setProperty('--d', String(Math.min(n, 6) * 60));
    });
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('is-in');
            io.unobserve(en.target);
          }
        });
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 }
    );
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- Card tilt + shine ---------------- */
  function tilt(el, max) {
    var frame = 0;
    el.addEventListener('pointermove', function (e) {
      if (!finePointer.matches || reduce.matches || e.pointerType !== 'mouse') return;
      var r = el.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width;
      var y = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(function () {
        el.classList.add('is-tilting');
        el.style.setProperty('--ry', ((x - 0.5) * max * 2).toFixed(2) + 'deg');
        el.style.setProperty('--rx', ((0.5 - y) * max * 2).toFixed(2) + 'deg');
        el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      });
    });
    el.addEventListener('pointerleave', function () {
      cancelAnimationFrame(frame);
      el.classList.remove('is-tilting');
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  }
  $$('.gcard').forEach(function (el) { tilt(el, 6); });
  $$('.tilt').forEach(function (el) { tilt(el, 4); });

  /* ---------------- Card flip ---------------- */
  $$('.gcard').forEach(function (card) {
    card.addEventListener('click', function () {
      var flipped = card.classList.toggle('is-flipped');
      card.setAttribute('aria-pressed', flipped ? 'true' : 'false');
      var back = $('.gcard__back', card);
      var front = $('.gcard__front', card);
      if (back) back.setAttribute('aria-hidden', flipped ? 'false' : 'true');
      if (front) front.setAttribute('aria-hidden', flipped ? 'true' : 'false');
      Sound.play('flip');
      if (flipped && card.getAttribute('data-rare') === '1') setTimeout(function () { Sound.play('chime'); }, 160);
    });
  });

  /* ---------------- Sortable tables ---------------- */
  var MULT = { k: 1e3, m: 1e6, b: 1e9, t: 1e12, qa: 1e15 };
  function parseNum(s) {
    var m = String(s).replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)\s*(qa|k|m|b|t)?\b/i);
    if (!m) return null;
    return parseFloat(m[1]) * (m[2] ? MULT[m[2].toLowerCase()] : 1);
  }
  function cellKey(row, col) {
    var c = row.cells[col];
    if (!c) return '';
    var v = c.getAttribute('data-sort');
    if (v !== null) return v;
    if (c.querySelector('.soon') && !c.textContent.replace(/Details coming soon/g, '').trim()) return '';
    return c.textContent.trim();
  }
  function sortTable(table, col, dir) {
    var tb = table.tBodies[0];
    var rows = Array.prototype.slice.call(tb.rows);
    rows.sort(function (a, b) {
      var x = cellKey(a, col);
      var y = cellKey(b, col);
      if (x === '' && y === '') return 0;
      if (x === '') return 1;
      if (y === '') return -1;
      var nx = parseNum(x);
      var ny = parseNum(y);
      if (nx !== null && ny !== null && nx !== ny) return (nx - ny) * dir;
      return x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
    rows.forEach(function (r) { tb.appendChild(r); });
  }
  $$('table.sortable').forEach(function (table) {
    var head = table.tHead && table.tHead.rows[0];
    if (!head || !table.tBodies[0] || table.tBodies[0].rows.length < 2) return;
    var ths = Array.prototype.slice.call(head.cells);
    ths.forEach(function (th, col) {
      var btn = doc.createElement('button');
      btn.type = 'button';
      while (th.firstChild) btn.appendChild(th.firstChild);
      th.appendChild(btn);
      btn.addEventListener('click', function () {
        var dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
        ths.forEach(function (h) { h.removeAttribute('aria-sort'); });
        th.setAttribute('aria-sort', dir);
        sortTable(table, col, dir === 'ascending' ? 1 : -1);
        Sound.play('tick');
      });
    });
  });

  /* ---------------- "On this page" highlight ---------------- */
  var tocLinks = $$('.toc a');
  if (tocLinks.length) {
    var heads = tocLinks
      .map(function (a) { return { a: a, el: doc.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))) }; })
      .filter(function (h) { return h.el; });
    var ticking = false;
    var spy = function () {
      ticking = false;
      var y = 140;
      var active = heads[0];
      for (var i = 0; i < heads.length; i++) {
        if (heads[i].el.getBoundingClientRect().top <= y) active = heads[i];
        else break;
      }
      if (window.innerHeight + window.scrollY >= doc.body.scrollHeight - 4) active = heads[heads.length - 1];
      tocLinks.forEach(function (a) { a.classList.toggle('is-active', active && a === active.a); });
    };
    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(spy);
      }
    }, { passive: true });
    spy();
  }
  $$('.toc-inline a').forEach(function (a) {
    a.addEventListener('click', function () { var d = a.closest('details'); if (d) d.open = false; });
  });

  /* ---------------- Lightbox ---------------- */
  var lb = $('#lightbox');
  if (lb && lb.showModal) {
    var lbImg = $('img', lb);
    var lbCap = $('.lightbox__cap', lb);
    doc.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-lightbox]');
      if (!a) return;
      e.preventDefault();
      var img = $('img', a);
      lbImg.src = a.getAttribute('href');
      lbImg.alt = img ? img.alt : '';
      lbImg.hidden = false;
      lbCap.textContent = a.getAttribute('data-caption') || '';
      lb.showModal();
      Sound.play('flip');
    });
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.closest('[data-lightbox-close]')) lb.close();
    });
  }

  /* ---------------- Card Database filters ---------------- */
  $$('[data-browser]').forEach(function (box) {
    var grid = $('[data-grid]', box);
    var cards = $$('.gcard-wrap', grid);
    var countEl = $('[data-count]', box);
    var emptyEl = $('[data-empty]', box);
    var resetBtn = $('[data-reset]', box);
    var f = {};
    $$('[data-f]', box).forEach(function (el) { f[el.getAttribute('data-f')] = el; });
    var chips = $$('[data-role]', box);
    var num = function (el, k) { var v = el.getAttribute('data-' + k); return v === '' ? null : parseFloat(v); };

    function selectedRoles() {
      return chips.filter(function (c) { return c.getAttribute('aria-pressed') === 'true'; }).map(function (c) { return c.getAttribute('data-role'); });
    }
    function apply(skipUrl) {
      var q = f.q.value.trim().toLowerCase();
      var terms = q ? q.split(/\s+/) : [];
      var type = f.type.value, origin = f.origin.value, trait = f.trait.value, sort = f.sort.value;
      var roles = selectedRoles();
      var mainOnly = f.mainonly.checked;
      var shown = 0;
      cards.forEach(function (el) {
        var hay = el.getAttribute('data-name') + ' ' + el.getAttribute('data-text');
        var ok = terms.every(function (t) { return hay.indexOf(t) > -1; });
        if (ok && type) ok = el.getAttribute('data-type') === type;
        if (ok && origin) ok = el.getAttribute('data-origin') === origin;
        if (ok && trait) ok = (' ' + el.getAttribute('data-traits') + ' ').indexOf(' ' + trait + ' ') > -1;
        if (ok && roles.length) {
          if (mainOnly) ok = roles.indexOf(el.getAttribute('data-main')) > -1;
          else {
            var have = ' ' + el.getAttribute('data-roles') + ' ';
            ok = roles.every(function (r) { return have.indexOf(' ' + r + ' ') > -1; });
          }
        }
        el.hidden = !ok;
        el.classList.add('is-in');
        if (ok) shown++;
      });
      var key = sort.split('-')[0], dir = sort.indexOf('-asc') > -1 ? 1 : -1;
      cards.slice().sort(function (a, b) {
        if (key === 'name') return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'));
        var x = num(a, key), y = num(b, key);
        if (x === null && y === null) return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'));
        if (x === null) return 1;
        if (y === null) return -1;
        return (x - y) * dir;
      }).forEach(function (el) { grid.appendChild(el); });
      countEl.textContent = shown === cards.length ? cards.length + ' cards' : 'Showing ' + shown + ' of ' + cards.length + ' cards';
      emptyEl.hidden = shown > 0;
      resetBtn.hidden = !(q || type || origin || trait || roles.length || mainOnly || sort !== 'name');
      if (!skipUrl) {
        var params = new URLSearchParams();
        if (q) params.set('q', q);
        if (type) params.set('type', type);
        if (origin) params.set('origin', origin);
        if (trait) params.set('trait', trait);
        if (roles.length) params.set('roles', roles.join(','));
        if (mainOnly) params.set('main', '1');
        if (sort !== 'name') params.set('sort', sort);
        var qs = params.toString();
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
      }
    }
    // Restore filters from the link, so a filtered view can be shared.
    var p = new URLSearchParams(location.search);
    if (p.get('q')) f.q.value = p.get('q');
    ['type', 'origin', 'trait', 'sort'].forEach(function (k) { if (p.get(k)) f[k].value = p.get(k); });
    if (p.get('main')) f.mainonly.checked = true;
    (p.get('roles') || '').split(',').filter(Boolean).forEach(function (r) {
      chips.forEach(function (c) { if (c.getAttribute('data-role') === r) c.setAttribute('aria-pressed', 'true'); });
    });

    var timer;
    f.q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { apply(); }, 80); });
    ['type', 'origin', 'trait', 'sort', 'mainonly'].forEach(function (k) {
      f[k].addEventListener('change', function () { apply(); Sound.play('tick'); });
    });
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
        apply();
        Sound.play('tick');
      });
    });
    resetBtn.addEventListener('click', function () {
      f.q.value = ''; f.type.value = ''; f.origin.value = ''; f.trait.value = ''; f.sort.value = 'name'; f.mainonly.checked = false;
      chips.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
      apply();
    });
    if (p.toString()) apply(true);
  });

  /* ---------------- Search ---------------- */
  var dlg = $('#search-dialog');
  var input = $('#search-input');
  var list = $('#search-results');
  var index = null;
  var loading = null;
  var results = [];
  var sel = 0;

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9%+.]+/g, ' ')
      .trim();
  }
  function load() {
    if (index || loading) return;
    loading = fetch(root.getAttribute('data-search'), { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        index = j.items.map(function (it) {
          it._t = norm(it.t);
          it._w = it._t.split(' ');
          it._s = norm(it.s);
          it._x = norm(it.x);
          return it;
        });
        render();
      })
      .catch(function () {
        list.innerHTML = '<li class="search__empty">Search could not load. Try reloading the page.</li>';
      });
  }
  function score(it, terms, q) {
    var s = 0;
    if (it._t === q) s += 1000;
    else if (it._t.indexOf(q) === 0) s += 500;
    else if (it._t.indexOf(q) > -1) s += 240;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      var word = false;
      for (var j = 0; j < it._w.length; j++) if (it._w[j].indexOf(t) === 0) { word = true; break; }
      if (word) s += 60;
      else if (it._t.indexOf(t) > -1) s += 30;
      else if (it._s.indexOf(t) > -1) s += 12;
      else if (it._x.indexOf(t) > -1) s += 4;
      else return 0;
    }
    if (it.k === 'Page') s += 8;
    if (it.k === 'Section') s -= 4;
    return s;
  }
  function highlight(text, terms) {
    if (!terms.length) return esc(text);
    var re = new RegExp('(' + terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'ig');
    return String(text)
      .split(re)
      .map(function (part, i) { return i % 2 ? '<mark>' + esc(part) + '</mark>' : esc(part); })
      .join('');
  }
  function render() {
    if (!list) return;
    if (!index) {
      list.innerHTML = '<li class="search__empty">Loading…</li>';
      return;
    }
    var q = norm(input.value);
    var terms = q ? q.split(' ').filter(Boolean) : [];
    if (!terms.length) {
      results = index.filter(function (it) { return it.k === 'Page'; }).slice(0, 8);
    } else {
      results = index
        .map(function (it) { return { it: it, s: score(it, terms, q) }; })
        .filter(function (r) { return r.s > 0; })
        .sort(function (a, b) { return b.s - a.s || a.it.t.length - b.it.t.length; })
        .slice(0, 30)
        .map(function (r) { return r.it; });
    }
    sel = 0;
    if (!results.length) {
      list.innerHTML = '<li class="search__empty">Nothing found for “' + esc(input.value) + '”. Try a shorter word.</li>';
      return;
    }
    list.innerHTML = results
      .map(function (it, i) {
        return '<li role="none"><a role="option" id="sr-' + i + '" href="' + esc(it.u) + '" aria-selected="' + (i === sel) + '">' +
          '<span class="r-kind">' + esc(it.k) + '</span><span class="r-title">' + highlight(it.t, terms) + '</span>' +
          '<span class="r-sub">' + esc(it.k === 'Section' ? 'in ' + it.s : it.s || '') + '</span></a></li>';
      })
      .join('');
    input.setAttribute('aria-activedescendant', 'sr-0');
  }
  function move(d) {
    if (!results.length) return;
    sel = (sel + d + results.length) % results.length;
    $$('a[role="option"]', list).forEach(function (a, i) { a.setAttribute('aria-selected', i === sel ? 'true' : 'false'); });
    var cur = $('#sr-' + sel);
    if (cur) cur.scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', 'sr-' + sel);
  }
  function openSearch() {
    if (!dlg || !dlg.showModal) return;
    if (!dlg.open) dlg.showModal();
    setNav(false);
    input.focus();
    input.select();
    load();
    render();
  }
  function go(url) {
    dlg.close();
    var u = new URL(url, location.href);
    Sound.play('page');
    if (u.pathname === location.pathname) {
      location.hash = u.hash;
      return;
    }
    location.href = u.href;
  }
  if (dlg && input) {
    $$('[data-search-open]').forEach(function (b) { b.addEventListener('click', openSearch); });
    $$('[data-search-close]').forEach(function (b) { b.addEventListener('click', function () { dlg.close(); }); });
    input.addEventListener('input', render);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter' && results[sel]) { e.preventDefault(); go(results[sel].u); }
    });
    list.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      go(a.getAttribute('href'));
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    doc.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openSearch(); }
      else if (e.key === '/' && !typing) { e.preventDefault(); openSearch(); }
    });
  }
})();

/* Graphics gallery: project grid, project pages and zoomable viewer.
   Reads assets/graphics/projects.json (made by scripts/build_graphics.py). */
(function () {
  'use strict';

  var BASE = '../assets/graphics/';
  var DATA_URL = BASE + 'projects.json';
  var SITE_NAME = 'Avalon Corporate Solutions';

  var state = {
    projects: [],
    filter: 'All',
    shown: '',          // slug of the project currently on screen ('' = grid)
    scrollY: 0,
    lbPushed: false,    // true when the viewer was opened by a click (has its own history entry)
    opener: null
  };

  var homeEl = document.getElementById('gx-home');
  var projectEl = document.getElementById('gx-project');
  var gridEl = document.getElementById('gx-grid');
  var filtersEl = document.getElementById('gx-filters');
  var countEl = document.getElementById('gx-count');
  var baseTitle = document.title;

  /* ---------- small helpers ---------- */
  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v; // only used with our own static icon strings
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    (kids || []).forEach(function (kid) { if (kid) node.appendChild(kid); });
    return node;
  }

  function assetUrl(project, file) {
    return BASE + encodeURIComponent(project.slug) + '/' + encodeURIComponent(file);
  }

  function find(slug) {
    for (var i = 0; i < state.projects.length; i++) {
      if (state.projects[i].slug === slug) return state.projects[i];
    }
    return null;
  }

  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  var ICON = {
    back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
    expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
    zoomIn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg>',
    zoomOut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3M8 11h6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
    fullscreen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
    zoomHint: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg>'
  };

  /* ---------- scroll reveal ---------- */
  var io = null;

  // After the entrance animation, drop the helper classes so hover effects feel instant.
  function settle(node) {
    setTimeout(function () {
      node.classList.remove('gx-reveal', 'gx-in');
      node.style.transitionDelay = '';
    }, 1100);
  }

  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('gx-in');
          settle(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -40px 0px', threshold: 0.05 });
  }
  function reveal(node, index) {
    node.classList.add('gx-reveal');
    node.style.transitionDelay = ((index % 6) * 60) + 'ms';
    if (io) {
      io.observe(node);
    } else {
      node.classList.add('gx-in');
      settle(node);
    }
  }

  /* ---------- grid view ---------- */
  function categories() {
    var counts = {};
    state.projects.forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });
    return counts;
  }

  function renderFilters() {
    filtersEl.textContent = '';
    var counts = categories();
    var names = Object.keys(counts).sort();
    if (names.length < 2) {
      filtersEl.parentNode.parentNode.hidden = true;
      return;
    }
    filtersEl.parentNode.parentNode.hidden = false;
    var all = ['All'].concat(names);
    all.forEach(function (name) {
      var n = name === 'All' ? state.projects.length : counts[name];
      var btn = el('button', {
        'class': 'gx-pill',
        type: 'button',
        'aria-pressed': String(state.filter === name)
      }, [document.createTextNode(name), el('span', { text: String(n) })]);
      btn.addEventListener('click', function () {
        state.filter = name;
        renderFilters();
        renderGrid();
      });
      filtersEl.appendChild(btn);
    });
  }

  function renderGrid() {
    gridEl.textContent = '';
    var list = state.projects.filter(function (p) {
      return state.filter === 'All' || p.category === state.filter;
    });

    list.forEach(function (p, i) {
      var cover = p.pages[0];
      var img = el('img', {
        src: assetUrl(p, cover.thumb),
        alt: p.title + ' - cover',
        width: cover.w,
        height: cover.h,
        decoding: 'async',
        loading: i < 4 ? 'eager' : 'lazy'
      });
      var media = el('div', { 'class': 'gx-card-media' }, [
        el('div', { 'class': 'gx-card-art' }, [img]),
        el('span', { 'class': 'gx-badge', text: p.category }),
        el('span', { 'class': 'gx-pages-chip', text: plural(p.pages.length, 'page') })
      ]);
      media.style.background = 'color-mix(in srgb, ' + cover.color + ' 14%, #f1f5f9)';

      var meta = [p.year, (p.tools || []).slice(0, 2).join(', ')].filter(Boolean).join('  ·  ');
      var card = el('a', {
        'class': 'gx-card',
        href: '#' + encodeURIComponent(p.slug),
        'aria-label': p.title + ', ' + plural(p.pages.length, 'page')
      }, [
        media,
        el('div', { 'class': 'gx-card-body' }, [
          el('h3', { 'class': 'gx-card-title', text: p.title }),
          el('p', { 'class': 'gx-card-meta', text: meta || p.category })
        ])
      ]);
      reveal(card, i);
      gridEl.appendChild(card);
    });
  }

  function renderEmpty(title, text) {
    gridEl.textContent = '';
    filtersEl.parentNode.parentNode.hidden = true;
    gridEl.appendChild(el('div', { 'class': 'gx-empty', style: 'grid-column:1/-1' }, [
      el('h2', { text: title }),
      el('p', { text: text })
    ]));
  }

  function renderCount() {
    var pages = state.projects.reduce(function (sum, p) { return sum + p.pages.length; }, 0);
    countEl.textContent = '';
    if (!state.projects.length) return;
    countEl.appendChild(el('strong', { text: String(state.projects.length) }));
    countEl.appendChild(document.createTextNode(state.projects.length === 1 ? ' project   ' : ' projects   '));
    countEl.appendChild(document.createTextNode('·   '));
    countEl.appendChild(el('strong', { text: String(pages) }));
    countEl.appendChild(document.createTextNode(pages === 1 ? ' page' : ' pages'));
  }

  /* ---------- project view ---------- */
  function showGrid() {
    var was = state.shown;
    state.shown = '';
    projectEl.hidden = true;
    projectEl.textContent = '';
    homeEl.hidden = false;
    document.title = baseTitle;
    if (was) window.scrollTo(0, state.scrollY || 0);
  }

  function showProject(p) {
    if (state.shown === p.slug) return;
    if (!state.shown) state.scrollY = window.scrollY;
    state.shown = p.slug;

    homeEl.hidden = true;
    projectEl.hidden = false;
    projectEl.textContent = '';
    document.title = p.title + ' | Graphics | ' + SITE_NAME;

    var chips = el('div', { 'class': 'gx-chips' }, [
      el('span', { 'class': 'gx-chip gx-chip-green', text: p.category }),
      p.year ? el('span', { 'class': 'gx-chip', text: p.year }) : null,
      el('span', { 'class': 'gx-chip', text: plural(p.pages.length, 'page') })
    ].concat((p.tools || []).map(function (t) { return el('span', { 'class': 'gx-chip', text: t }); })));

    var viewBtn = el('button', { 'class': 'gx-btn gx-btn-primary', type: 'button' }, []);
    viewBtn.innerHTML = ICON.expand;
    viewBtn.appendChild(document.createTextNode('View in full screen'));
    viewBtn.addEventListener('click', function () { openFrom(p, 0, viewBtn); });

    var actions = el('div', { 'class': 'gx-actions' }, [viewBtn]);

    var back = el('a', { 'class': 'gx-back', href: '#' });
    back.innerHTML = ICON.back;
    back.appendChild(document.createTextNode('All graphics'));

    var head = el('div', { 'class': 'gx-wrap gx-project-head' }, [
      back,
      el('h2', { text: p.title }),
      chips,
      p.description ? el('p', { 'class': 'gx-desc', text: p.description }) : null,
      actions
    ]);

    var pages = el('div', { 'class': 'gx-wrap gx-pages' });
    p.pages.forEach(function (pg, i) {
      var btn = el('button', {
        'class': 'gx-page',
        type: 'button',
        'aria-label': 'Open page ' + (i + 1) + ' of ' + p.pages.length
      }, [
        el('img', {
          src: assetUrl(p, pg.thumb),
          alt: p.title + ' - page ' + (i + 1),
          width: pg.w,
          height: pg.h,
          decoding: 'async',
          loading: i < 6 ? 'eager' : 'lazy'
        }),
        el('span', { 'class': 'gx-page-zoom', html: ICON.zoomHint }),
        el('span', { 'class': 'gx-page-num', text: String(i + 1) })
      ]);
      btn.style.aspectRatio = pg.w + ' / ' + pg.h;
      btn.style.background = pg.color;
      btn.addEventListener('click', function () { openFrom(p, i, btn); });
      reveal(btn, i);
      pages.appendChild(btn);
    });

    projectEl.appendChild(head);
    projectEl.appendChild(pages);
    window.scrollTo(0, 0);
  }

  /* ---------- routing (#slug and #slug/3) ---------- */
  function parseHash() {
    var raw = location.hash.replace(/^#\/?/, '');
    try { raw = decodeURIComponent(raw); } catch (e) { /* keep raw */ }
    var parts = raw.split('/');
    return { slug: parts[0] || '', page: parts[1] ? parseInt(parts[1], 10) : 0 };
  }

  function route() {
    var r = parseHash();
    var p = r.slug ? find(r.slug) : null;
    if (!p) {
      lb.close(true);
      showGrid();
      return;
    }
    showProject(p);
    if (r.page >= 1 && r.page <= p.pages.length) {
      lb.open(p, r.page - 1);
    } else {
      lb.close(true);
    }
  }

  function openFrom(p, index, opener) {
    state.opener = opener || null;
    state.lbPushed = true;
    location.hash = encodeURIComponent(p.slug) + '/' + (index + 1);
  }

  /* ---------- viewer ---------- */
  var lb = (function () {
    var root, stage, img, spinner, titleEl, subEl, strip, prevBtn, nextBtn, hint, fsBtn;
    var project = null, index = 0;
    var scale = 1, tx = 0, ty = 0;
    var isOpen = false;
    var pointers = {};
    var gesture = null;
    var lastTap = { t: 0, x: 0, y: 0 };
    var hintShown = false;

    function button(cls, label, icon, onClick) {
      var b = el('button', { 'class': cls, type: 'button', 'aria-label': label, title: label, html: icon });
      b.addEventListener('click', onClick);
      return b;
    }

    function build() {
      if (root) return;
      titleEl = el('strong');
      subEl = el('span');
      prevBtn = button('gx-icon-btn gx-nav gx-prev', 'Previous page', ICON.prev, function () { go(index - 1); });
      nextBtn = button('gx-icon-btn gx-nav gx-next', 'Next page', ICON.next, function () { go(index + 1); });
      fsBtn = button('gx-icon-btn gx-hide-sm', 'Toggle full screen', ICON.fullscreen, toggleFullscreen);
      if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) fsBtn.hidden = true;

      var tools = el('div', { 'class': 'gx-lb-tools' }, [
        button('gx-icon-btn', 'Zoom out', ICON.zoomOut, function () { zoomBy(1 / 1.5); }),
        button('gx-icon-btn', 'Zoom in', ICON.zoomIn, function () { zoomBy(1.5); }),
        fsBtn,
        button('gx-icon-btn', 'Close viewer', ICON.close, requestClose)
      ]);

      var bar = el('div', { 'class': 'gx-lb-bar' }, [
        el('div', { 'class': 'gx-lb-title' }, [titleEl, subEl]),
        tools
      ]);

      img = el('img', { alt: '', draggable: 'false' });
      spinner = el('div', { 'class': 'gx-spinner' });
      hint = el('div', { 'class': 'gx-hint', text: 'Scroll or pinch to zoom · drag to move · arrow keys to browse' });
      stage = el('div', { 'class': 'gx-stage' }, [img, spinner, prevBtn, nextBtn, hint]);
      strip = el('div', { 'class': 'gx-strip', role: 'tablist' });

      root = el('div', { 'class': 'gx-lb', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Image viewer' }, [bar, stage, strip]);
      document.body.appendChild(root);

      stage.addEventListener('pointerdown', onDown);
      stage.addEventListener('pointermove', onMove);
      stage.addEventListener('pointerup', onUp);
      stage.addEventListener('pointercancel', onUp);
      stage.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('resize', function () { if (isOpen) { fit(); clamp(); apply(false); } });
      document.addEventListener('keydown', onKey);
      document.addEventListener('fullscreenchange', function () { if (isOpen) { fit(); clamp(); apply(false); } });
    }

    // Size the page so it fits inside the stage with a little breathing room.
    function fit() {
      if (!project || !stage) return;
      var pg = project.pages[index];
      var pad = stage.clientWidth < 640 ? 10 : 28;
      var aw = Math.max(60, stage.clientWidth - pad * 2);
      var ah = Math.max(60, stage.clientHeight - pad * 2);
      var ratio = pg.w / pg.h;
      var w = Math.min(aw, ah * ratio);
      img.style.width = Math.round(w) + 'px';
      img.style.height = Math.round(w / ratio) + 'px';
    }

    function maxScale() {
      var fitW = img.clientWidth || 1;
      var natural = img.naturalWidth || fitW;
      return Math.min(8, Math.max(3, (natural / fitW) * 1.6));
    }

    function clamp() {
      if (scale <= 1.001) { scale = 1; tx = 0; ty = 0; return; }
      var maxX = Math.max(0, (img.clientWidth * scale - stage.clientWidth) / 2);
      var maxY = Math.max(0, (img.clientHeight * scale - stage.clientHeight) / 2);
      tx = Math.min(maxX, Math.max(-maxX, tx));
      ty = Math.min(maxY, Math.max(-maxY, ty));
    }

    function apply(animate) {
      img.classList.toggle('gx-animate', !!animate);
      img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
      stage.classList.toggle('gx-zoomed', scale > 1.001);
    }

    function zoomAt(newScale, cx, cy, animate) {
      newScale = Math.min(maxScale(), Math.max(1, newScale));
      var ratio = newScale / scale;
      tx = cx - (cx - tx) * ratio;
      ty = cy - (cy - ty) * ratio;
      scale = newScale;
      clamp();
      apply(animate);
    }

    function zoomBy(factor) { zoomAt(scale * factor, 0, 0, true); }

    function reset() { scale = 1; tx = 0; ty = 0; apply(false); }

    function stagePoint(e) {
      var r = stage.getBoundingClientRect();
      return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
    }

    /* mouse, touch and pen all come through pointer events */
    function onDown(e) {
      if (e.target.closest && e.target.closest('.gx-nav')) return;
      stage.setPointerCapture(e.pointerId);
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: Date.now() };
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        gesture = {
          type: 'pinch',
          dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          scale: scale
        };
      } else if (ids.length === 1) {
        gesture = { type: 'one', tx: tx, ty: ty, moved: false };
        stage.classList.add('gx-grabbing');
      }
    }

    function onMove(e) {
      var p = pointers[e.pointerId];
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      var ids = Object.keys(pointers);
      if (gesture && gesture.type === 'pinch' && ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        var r = stage.getBoundingClientRect();
        var mx = (a.x + b.x) / 2 - r.left - r.width / 2;
        var my = (a.y + b.y) / 2 - r.top - r.height / 2;
        var target = Math.min(maxScale(), Math.max(1, gesture.scale * d / gesture.dist));
        var ratio = target / scale;
        tx = mx - (mx - tx) * ratio;
        ty = my - (my - ty) * ratio;
        scale = target;
        clamp();
        apply(false);
      } else if (gesture && gesture.type === 'one') {
        var dx = e.clientX - p.sx, dy = e.clientY - p.sy;
        if (Math.abs(dx) + Math.abs(dy) > 6) gesture.moved = true;
        if (scale > 1.001) {
          tx = gesture.tx + dx;
          ty = gesture.ty + dy;
          clamp();
          apply(false);
        }
      }
    }

    function onUp(e) {
      var p = pointers[e.pointerId];
      if (!p) return;
      delete pointers[e.pointerId];
      stage.classList.remove('gx-grabbing');
      var remaining = Object.keys(pointers).length;

      if (gesture && gesture.type === 'one' && remaining === 0) {
        var dx = e.clientX - p.sx, dy = e.clientY - p.sy;
        var dt = Date.now() - p.t;
        if (scale <= 1.001 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 700) {
          go(dx < 0 ? index + 1 : index - 1);
        } else if (!gesture.moved && dt < 350) {
          var now = Date.now();
          if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
            var pt = stagePoint(e);
            if (scale > 1.001) { scale = 1; tx = 0; ty = 0; apply(true); }
            else zoomAt(Math.min(2.6, maxScale()), pt.x, pt.y, true);
            lastTap.t = 0;
          } else {
            lastTap = { t: now, x: e.clientX, y: e.clientY };
          }
        }
      }
      if (remaining < 2 && gesture && gesture.type === 'pinch') {
        gesture = null;
        var left = Object.keys(pointers)[0];
        if (left) {
          var q = pointers[left];
          q.sx = q.x; q.sy = q.y; q.t = Date.now();
          gesture = { type: 'one', tx: tx, ty: ty, moved: true };
        }
      } else if (remaining === 0) {
        gesture = null;
      }
    }

    function onWheel(e) {
      e.preventDefault();
      var pt = stagePoint(e);
      var k = e.ctrlKey ? 0.012 : 0.0016;
      zoomAt(scale * Math.exp(-e.deltaY * k), pt.x, pt.y, false);
    }

    function onKey(e) {
      if (!isOpen) return;
      switch (e.key) {
        case 'Escape': e.preventDefault(); requestClose(); break;
        case 'ArrowRight': e.preventDefault(); go(index + 1); break;
        case 'ArrowLeft': e.preventDefault(); go(index - 1); break;
        case 'Home': e.preventDefault(); go(0); break;
        case 'End': e.preventDefault(); go(project.pages.length - 1); break;
        case '+': case '=': e.preventDefault(); zoomBy(1.4); break;
        case '-': case '_': e.preventDefault(); zoomBy(1 / 1.4); break;
        case '0': e.preventDefault(); reset(); break;
        case 'f': case 'F': if (!fsBtn.hidden) { e.preventDefault(); toggleFullscreen(); } break;
        case 'Tab': trapFocus(e); break;
      }
    }

    function trapFocus(e) {
      var items = root.querySelectorAll('button:not([hidden]), a[href]');
      var list = Array.prototype.filter.call(items, function (n) { return n.offsetParent !== null && !n.disabled; });
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!root.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }

    function toggleFullscreen() {
      var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      try {
        if (fsEl) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
      } catch (err) { /* not supported, ignore */ }
    }

    function buildStrip() {
      strip.textContent = '';
      project.pages.forEach(function (pg, i) {
        var t = el('button', {
          'class': 'gx-thumb',
          type: 'button',
          role: 'tab',
          'aria-label': 'Page ' + (i + 1),
          'aria-current': 'false'
        }, [el('img', { src: assetUrl(project, pg.thumb), alt: '', loading: 'lazy', decoding: 'async' })]);
        t.addEventListener('click', function () { go(i); });
        strip.appendChild(t);
      });
      strip.hidden = project.pages.length < 2;
    }

    function preload(i) {
      if (i < 0 || i >= project.pages.length) return;
      var im = new Image();
      im.src = assetUrl(project, project.pages[i].full);
    }

    function show(i) {
      index = i;
      var pg = project.pages[i];
      var fullUrl = assetUrl(project, pg.full);
      fit();
      reset();

      titleEl.textContent = project.title;
      subEl.textContent = 'Page ' + (i + 1) + ' of ' + project.pages.length;
      img.alt = project.title + ', page ' + (i + 1);
      prevBtn.disabled = i === 0;
      nextBtn.disabled = i === project.pages.length - 1;
      prevBtn.hidden = nextBtn.hidden = project.pages.length < 2;

      Array.prototype.forEach.call(strip.children, function (node, n) {
        node.setAttribute('aria-current', String(n === i));
        if (n === i && node.scrollIntoView) {
          node.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
        }
      });

      // Show the small image straight away, then swap to the HD one when ready.
      img.classList.add('gx-loading');
      img.src = assetUrl(project, pg.thumb);
      spinner.classList.add('gx-on');
      var loader = new Image();
      loader.onload = function () {
        if (index !== i || !isOpen) return;
        img.src = fullUrl;
        img.classList.remove('gx-loading');
        spinner.classList.remove('gx-on');
        preload(i + 1);
        preload(i - 1);
      };
      loader.onerror = function () {
        if (index !== i) return;
        img.classList.remove('gx-loading');
        spinner.classList.remove('gx-on');
      };
      loader.src = fullUrl;

      // keep the address bar in step without adding history entries
      try { history.replaceState(null, '', '#' + encodeURIComponent(project.slug) + '/' + (i + 1)); } catch (e) { /* ignore */ }
    }

    function go(i) {
      if (!project || i < 0 || i >= project.pages.length || i === index) return;
      show(i);
    }

    function open(p, i) {
      build();
      if (isOpen && project && project.slug === p.slug) { go(i); return; }
      project = p;
      buildStrip();
      isOpen = true;
      root.classList.add('gx-open');
      document.documentElement.style.overflow = 'hidden';
      requestAnimationFrame(function () { root.classList.add('gx-visible'); });
      show(i);
      var closeBtn = root.querySelector('button[aria-label="Close viewer"]');
      if (closeBtn) closeBtn.focus({ preventScroll: true });
      if (!hintShown) {
        hintShown = true;
        var seen = false;
        try { seen = sessionStorage.getItem('gx-hint') === '1'; sessionStorage.setItem('gx-hint', '1'); } catch (e) { /* ignore */ }
        if (!seen) {
          hint.classList.add('gx-show');
          setTimeout(function () { hint.classList.remove('gx-show'); }, 3800);
        }
      }
    }

    // quietly = the route already changed (back button, link), so touch nothing in history
    function close(quietly) {
      if (!isOpen) return;
      isOpen = false;
      pointers = {};
      gesture = null;
      var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fsEl) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* ignore */ } }
      root.classList.remove('gx-visible');
      document.documentElement.style.overflow = '';
      setTimeout(function () { if (!isOpen) { root.classList.remove('gx-open'); img.removeAttribute('src'); } }, 300);
      state.lbPushed = false;
      var op = state.opener;
      state.opener = null;
      if (op && document.body.contains(op)) { try { op.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }

    function requestClose() {
      if (!isOpen) return;
      if (state.lbPushed) {
        history.back();            // route() will close the viewer
      } else {
        try { history.replaceState(null, '', '#' + encodeURIComponent(project.slug)); } catch (e) { /* ignore */ }
        close(true);
      }
    }

    return { open: open, close: close };
  })();

  /* ---------- mobile menu (same as the other pages) ---------- */
  window.toggleMobileMenu = function () {
    var menu = document.getElementById('mobile-menu');
    if (menu) menu.classList.toggle('hidden');
  };

  /* ---------- start ---------- */
  function start() {
    fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        state.projects = (data.projects || []).filter(function (p) { return p.pages && p.pages.length; });
        renderCount();
        if (!state.projects.length) {
          renderEmpty('New work is on the way', 'Graphic designs will appear here soon. Please check back shortly.');
        } else {
          renderFilters();
          renderGrid();
        }
        route();
      })
      .catch(function () {
        renderEmpty('The gallery could not load', 'Please refresh the page. If you opened this file straight from your computer, view it through the live website or a local server instead.');
      });
  }

  window.addEventListener('hashchange', function () { if (state.projects.length) route(); });
  start();
})();

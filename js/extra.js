/* Extra features: counters, live preview, forms, testimonials, before/after slider */
(function () {
  'use strict';
  var WA = '256745652778';
  var MAIL = 'arthurshon@gmail.com';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function esc(t) { var d = document.createElement('div'); d.textContent = t == null ? '' : String(t); return d.innerHTML; }
  function getJSON(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }

  /* ---- counters ---- */
  function runCount(el) {
    var end = parseInt(el.getAttribute('data-count'), 10) || 0;
    if (reduce || !end) { el.textContent = end; return; }
    var t0 = null, dur = 1100;
    function step(t) {
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counters = $$('[data-count]');
  if (counters.length) {
    var gp = $('[data-count-gfx]');
    var ready = Promise.resolve();
    if (gp) {
      ready = getJSON('../assets/graphics/projects.json').then(function (d) {
        var n = 0; (d.projects || []).forEach(function (p) { n += (p.pages || []).length; });
        if (n) gp.setAttribute('data-count', n);
      }).catch(function () { /* keep the printed number */ });
    }
    ready.then(function () {
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) { runCount(e.target); io.unobserve(e.target); } });
        }, { threshold: .4 });
        counters.forEach(function (c) { io.observe(c); });
      } else counters.forEach(runCount);
    });
  }

  /* ---- live preview when hovering a project screenshot ---- */
  if (window.matchMedia && matchMedia('(hover: hover)').matches) {
    $$('a.sx-proj-shot[href^="http"]').forEach(function (a) {
      var frame = null, timer = null;
      var live = document.createElement('span'); live.className = 'ex-live'; live.textContent = 'Live preview'; a.appendChild(live);
      function fit() { if (frame) frame.style.transform = 'scale(' + (a.clientWidth / 1280) + ')'; }
      a.addEventListener('mouseenter', function () {
        timer = setTimeout(function () {
          if (frame) return;
          frame = document.createElement('iframe');
          frame.className = 'ex-prevframe'; frame.src = a.href; frame.title = 'Live preview'; frame.tabIndex = -1;
          frame.setAttribute('aria-hidden', 'true'); frame.setAttribute('referrerpolicy', 'no-referrer'); frame.loading = 'lazy';
          frame.addEventListener('load', function () { frame.classList.add('on'); });
          a.insertBefore(frame, a.firstChild); fit();
        }, 350);
      });
      a.addEventListener('mouseleave', function () { clearTimeout(timer); if (frame) { frame.remove(); frame = null; } });
      window.addEventListener('resize', fit);
    });
  }

  /* ---- forms: open WhatsApp or email with the message ready ---- */
  var form = $('#ex-form');
  if (form) {
    var kind = form.getAttribute('data-kind');
    var qs = new URLSearchParams(location.search);
    ['service', 'project'].forEach(function (k) {
      var f = form.elements[k]; var v = qs.get(k);
      if (f && v) { for (var i = 0; i < f.options.length; i++) if (f.options[i].value === v) f.selectedIndex = i; }
    });
    var val = function (n) { return form.elements[n] ? String(form.elements[n].value).trim() : ''; };
    var build = function () {
      var L = [];
      if (kind === 'project') {
        L.push('Hello Avalon Corporate Solutions, I would like to start a project.', '');
        L.push('Name: ' + val('name'));
        if (val('phone')) L.push('Phone / WhatsApp: ' + val('phone'));
        if (val('email')) L.push('Email: ' + val('email'));
        L.push('I need: ' + val('service'));
        if (val('budget')) L.push('Budget: ' + val('budget'));
        if (val('deadline')) L.push('When I need it: ' + val('deadline'));
        L.push('', 'About the project:', val('details'));
      } else {
        L.push('Hello Avalon Corporate Solutions, here is my review of your work.', '');
        L.push('Name: ' + val('name'));
        if (val('role')) L.push('Role / business: ' + val('role'));
        if (val('project')) L.push('Project: ' + val('project'));
        L.push('', 'My review:', '"' + val('message') + '"', '');
        L.push('Yes, you may publish my name and review on your website.');
        L.push('(I can send my photo here on WhatsApp if I want it shown.)');
      }
      return L.join('\n');
    };
    var subject = kind === 'project' ? 'New project request' : 'My review for Avalon Corporate Solutions';
    var status = $('#ex-status');
    function go(how) {
      if (!form.reportValidity()) return;
      var text = build();
      if (how === 'wa') window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
      else location.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
      if (status) status.textContent = how === 'wa' ? 'WhatsApp is opening with your message ready. Press send there.' : 'Your email app is opening with your message ready. Press send there.';
    }
    $$('[data-send]', form).forEach(function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-send')); }); });
    form.addEventListener('submit', function (e) { e.preventDefault(); go('wa'); });
  }

  /* ---- testimonials ---- */
  var tbox = $('#ex-testi-list');
  if (tbox) {
    getJSON('../assets/testimonials.json').then(function (d) {
      var list = (d && d.testimonials) || [];
      if (!list.length) return;
      tbox.innerHTML = list.map(function (t) {
        var ini = (t.name || '?').split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
        var av = t.photo ? '<img src="' + esc(t.photo) + '" alt="" loading="lazy">' : esc(ini);
        return '<figure class="ex-t"><blockquote>' + esc(t.message) + '</blockquote><figcaption class="ex-who"><span class="ex-av">' + av + '</span><span><strong>' + esc(t.name) + '</strong><small>' + esc(t.role || '') + '</small></span></figcaption></figure>';
      }).join('');
      var sec = $('#ex-testi'); if (sec) sec.hidden = false;
    }).catch(function () { /* no reviews yet */ });
  }

  /* ---- before / after slider ---- */
  var cmp = $('#gx-compare');
  if (cmp) {
    getJSON('../assets/graphics/compare.json').then(function (d) {
      var pairs = (d && d.pairs) || [];
      if (!pairs.length) return;
      var box = $('#gx-compare-grid', cmp);
      box.innerHTML = pairs.map(function (p, i) {
        var base = '../assets/graphics/compare/';
        return '<figure class="ex-cmp"><div class="ex-cmpbox" data-i="' + i + '"><img src="' + base + esc(p.after) + '" alt="After: ' + esc(p.title) + '" loading="lazy">' +
          '<div class="ex-cmpbefore"><img src="' + base + esc(p.before) + '" alt="Before: ' + esc(p.title) + '" loading="lazy"></div>' +
          '<span class="ex-tag l">Before</span><span class="ex-tag r">After</span>' +
          '<input type="range" min="0" max="100" value="50" aria-label="Drag to compare before and after: ' + esc(p.title) + '"><span class="ex-cmpline"></span></div>' +
          '<figcaption><strong>' + esc(p.title) + '</strong>' + esc(p.note || '') + '</figcaption></figure>';
      }).join('');
      $$('.ex-cmpbox', box).forEach(function (b) {
        var r = $('input', b), before = $('.ex-cmpbefore', b), line = $('.ex-cmpline', b);
        function set() { var v = r.value; before.style.clipPath = 'inset(0 ' + (100 - v) + '% 0 0)'; line.style.left = v + '%'; }
        r.addEventListener('input', set); set();
      });
      cmp.hidden = false;
    }).catch(function () { /* no pairs yet */ });
  }
})();

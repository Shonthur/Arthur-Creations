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

  /* ---- testimonials (reviews file + approved online reviews) ---- */
  var tbox = $('#ex-testi-list');
  if (tbox) {
    var fromFile = getJSON('../assets/testimonials.json').then(function (d) { return (d && d.testimonials) || []; }).catch(function () { return []; });
    var fromWeb = (window.AVReviews && AVReviews.enabled()) ? AVReviews.approved().catch(function () { return []; }) : Promise.resolve([]);
    Promise.all([fromWeb, fromFile]).then(function (a) {
      var list = a[0].concat(a[1]);
      if (!list.length) return;
      tbox.innerHTML = list.map(function (t) { return AVReviews.card(t); }).join('');
      var sec = $('#ex-testi'); if (sec) sec.hidden = false;
    });
  }

  /* ---- review page: private link (?c=code), stars, words, optional round photo ---- */
  var app = $('#rv-app');
  if (app) {
    var code = (new URLSearchParams(location.search).get('c') || '').trim().toLowerCase();
    var say = function (t, bad) { var m = $('#rv-msg'); m.textContent = t; m.style.color = bad ? '#e11d48' : ''; };
    var lock = function () { $('#rv-load').hidden = true; $('#rv-locked').hidden = false; };
    if (!/^[a-z0-9]{12,40}$/.test(code) || !(window.AVReviews && AVReviews.enabled())) lock();
    else {
      var inv = null, photo = '';
      var done = function (txt) { $('#rv-main').hidden = false; $('#rv-form').hidden = true; $('#rv-done').hidden = false; if (txt) $('#rv-donetext').textContent = txt; };
      Promise.all([AVReviews.invite(code), AVReviews.review(code)]).then(function (a) {
        inv = a[0]; $('#rv-load').hidden = true;
        if (!inv) { lock(); return; }
        $('#rv-main').hidden = false;
        $('#rv-hello').textContent = 'Hello ' + inv.name.split(/\s+/)[0] + ', how did we do?';
        $('#rv-proj').textContent = inv.project ? 'Project: ' + inv.project : '';
        if (inv.image) { var b = $('#rv-banner'); b.src = inv.image; b.alt = inv.project || 'Finished work'; b.hidden = false; }
        $('#rv-form').elements.name.value = inv.name;
        if (a[1]) done(a[1].status === 'approved' ? 'Your review is already published on the website. Thank you!' : 'Your review was already received. It shows on the website after I check it. Thank you!');
      }).catch(function () { lock(); });

      var words = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
      $$('input[name=rating]').forEach(function (r) { r.addEventListener('change', function () { $('#rv-ratetext').textContent = r.value + ' out of 5: ' + words[r.value - 1]; }); });
      var ta = $('#rv-form').elements.message;
      ta.addEventListener('input', function () { $('#rv-count').textContent = ta.value.length + ' / 800'; });

      var agree = $('#rv-agree'), pick = $('#rv-pick'), file = $('#rv-file'), av = $('#rv-av'), note = $('#rv-photonote'), un = $('#rv-unpick');
      var NOTE_OFF = 'Tick the box above to add a photo. You can also skip this step.';
      var NOTE_ON = 'Use your Google picture, or upload a clear photo of your face. It is cropped to a circle for you.';
      var gbtn = $('#rv-google');
      agree.addEventListener('change', function () { pick.disabled = gbtn.disabled = !agree.checked; note.textContent = agree.checked ? NOTE_ON : NOTE_OFF; });
      pick.addEventListener('click', function () { file.click(); });
      file.addEventListener('change', function () {
        var f = file.files[0]; if (!f) return;
        if (!/^image\//.test(f.type)) { note.textContent = 'Please choose an image file.'; return; }
        AVReviews.shrink(f, 160, 0.82, true).then(function (d) {
          photo = d; av.textContent = ''; var im = new Image(); im.src = d; im.alt = 'Your photo'; av.appendChild(im);
          un.hidden = false; note.textContent = 'This is how your photo will appear. It is used only with your review, never for anything illegal or anything else.';
        }).catch(function () { note.textContent = 'That photo could not be read. Please try another one.'; });
      });
      gbtn.addEventListener('click', function () {
        note.textContent = 'Opening Google...';
        AVReviews.googlePhoto().then(function (r) {
          photo = r.photo; av.textContent = ''; var im = new Image(); im.src = photo; im.alt = 'Your photo'; im.referrerPolicy = 'no-referrer'; av.appendChild(im);
          un.hidden = false; note.textContent = 'Your Google picture will be shown like this. It is used only with your review, never for anything illegal or anything else. Google gives me only your name and picture, never your password.';
        }).catch(function () { note.textContent = 'Google sign-in did not finish. Please try again, or upload a photo instead.'; });
      });
      un.addEventListener('click', function () { photo = ''; file.value = ''; av.textContent = '?'; un.hidden = true; note.textContent = agree.checked ? NOTE_ON : NOTE_OFF; });

      $('#rv-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = e.target, text = f.elements.message.value.trim(), rating = +((f.querySelector('input[name=rating]:checked') || {}).value || 0);
        if (!rating) { say('Please tap a star to rate the work.', true); return; }
        if (!f.elements.name.value.trim()) { say('Please type your name.', true); return; }
        if (text.length < 10) { say('Please write a little more (at least 10 characters).', true); return; }
        if (!$('#rv-ok').checked) { say('Please tick the box to allow publishing.', true); return; }
        var btn = $('#rv-send'); btn.disabled = true; say('Sending...');
        AVReviews.submit(code, { name: f.elements.name.value.trim(), role: f.elements.role.value.trim(), project: inv.project, rating: rating, message: text, photo: photo, image: inv.image || '' })
          .then(function () { say(''); done(); window.scrollTo({ top: 0, behavior: 'smooth' }); })
          .catch(function () { btn.disabled = false; say('Could not send your review. Please check your internet and try again, or message me on WhatsApp.', true); });
      });
    }
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

/* ---- chat widget open/close ---- */
(function () {
  var open = document.getElementById('sx-chat-open'), panel = document.getElementById('sx-chat-panel'), x = document.getElementById('sx-chat-x');
  if (!open || !panel) return;
  function set(v) { panel.hidden = !v; open.setAttribute('aria-expanded', v ? 'true' : 'false'); open.hidden = v && window.innerWidth <= 620; if (v) panel.querySelector('a').focus(); else open.focus(); }
  open.addEventListener('click', function () { set(panel.hidden); });
  x.addEventListener('click', function () { set(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) set(false); });
})();

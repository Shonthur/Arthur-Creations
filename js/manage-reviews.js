/* Owner page: approve or remove client reviews. */
(function () {
  'use strict';
  var R = window.AVReviews;
  var $ = function (id) { return document.getElementById(id); };
  var box = $('mr-app');
  if (!box) return;

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function avatar(r) {
    var a = el('span', 'ex-av');
    if (r.photo) { var i = new Image(); i.src = r.photo; i.alt = ''; i.referrerPolicy = 'no-referrer'; a.appendChild(i); }
    else a.textContent = (r.name || '?').split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    return a;
  }
  function msg(t, bad) { var m = $('mr-msg'); m.textContent = t; m.style.color = bad ? '#e11d48' : ''; }

  function card(r, pending) {
    var c = el('div', 'ex-t');
    c.appendChild(el('blockquote', '', r.message));
    var who = el('div', 'ex-who'); who.appendChild(avatar(r));
    var s = el('span'); s.appendChild(el('strong', '', r.name)); s.appendChild(el('small', '', r.role || ''));
    who.appendChild(s); c.appendChild(who);
    var row = el('div', 'ex-send');
    if (pending) {
      var ok = el('button', 'sx-btn sx-btn-sm', 'Approve and publish'); ok.type = 'button';
      ok.addEventListener('click', function () { ok.disabled = true; R.approve(r.id).then(function () { msg('Approved. It shows on the website now.'); load(); }).catch(fail); });
      row.appendChild(ok);
    }
    var no = el('button', 'sx-btn sx-btn-sm sx-btn-ghost', pending ? 'Reject' : 'Remove from website'); no.type = 'button';
    no.addEventListener('click', function () {
      if (!confirm(pending ? 'Reject and delete this review?' : 'Remove this review from the website?')) return;
      no.disabled = true; R.remove(r.id).then(function () { msg('Done.'); load(); }).catch(fail);
    });
    row.appendChild(no); c.appendChild(row);
    return c;
  }
  function fail(e) { msg('Something went wrong: ' + (e && e.message ? e.message : e), true); }
  function fill(id, list, pending, empty) {
    var t = $(id); t.textContent = '';
    if (!list.length) { t.appendChild(el('p', 'sx-note', empty)); return; }
    list.forEach(function (r) { t.appendChild(card(r, pending)); });
  }
  function load() {
    Promise.all([R.pending(), R.approved()]).then(function (a) {
      fill('mr-pending', a[0], true, 'No reviews waiting.');
      fill('mr-approved', a[1], false, 'No published reviews yet.');
    }).catch(fail);
  }

  if (!R.enabled()) { $('mr-off').hidden = false; return; }
  $('mr-in').hidden = false;
  $('mr-signin').addEventListener('click', function () { R.signIn().catch(function (e) { msg('Sign-in failed: ' + e.message, true); }); });
  $('mr-signout').addEventListener('click', function () { R.signOut(); });
  R.onUser(function (u) {
    var owner = u && u.email && u.email.toLowerCase() === R.owner;
    $('mr-signin').hidden = !!u; $('mr-signout').hidden = !u;
    $('mr-list').hidden = !owner;
    if (u && !owner) msg('This page is only for the owner. You are signed in as ' + u.email + '.', true);
    else msg('');
    if (owner) load();
  });
})();

/* Owner page: create private review links, approve or remove reviews. */
(function () {
  'use strict';
  var R = window.AVReviews;
  var $ = function (id) { return document.getElementById(id); };
  if (!$('mr-app')) return;
  function msg(t, bad) { var m = $('mr-msg'); m.textContent = t; m.style.color = bad ? '#e11d48' : ''; }
  function fail(e) { msg('Something went wrong: ' + (e && e.message ? e.message : e), true); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function linkFor(code) { return new URL('leave_review.html?c=' + code, location.href).href; }

  function reviewBlock(r, pending) {
    var w = el('div'); w.innerHTML = R.card(r);
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
    row.appendChild(no);
    var fig = w.firstChild; fig.appendChild(row);
    return fig;
  }
  function fill(id, list, pending, empty) {
    var t = $(id); t.textContent = '';
    if (!list.length) { t.appendChild(el('p', 'sx-note', empty)); return; }
    list.forEach(function (r) { t.appendChild(reviewBlock(r, pending)); });
  }
  function inviteRows(list, reviewed) {
    var t = $('mr-invites'); t.textContent = '';
    if (!list.length) { t.appendChild(el('p', 'sx-note', 'No links yet.')); return; }
    list.forEach(function (i) {
      var row = el('div', 'rv-inv');
      var s = el('span'); s.appendChild(el('strong', '', i.name)); s.appendChild(el('small', '', ' ' + i.project + (reviewed[i.id] ? ' - review received' : ' - waiting for the client')));
      row.appendChild(s);
      var cp = el('button', 'sx-btn sx-btn-sm sx-btn-ghost', 'Copy link'); cp.type = 'button';
      cp.addEventListener('click', function () { copy(linkFor(i.id)); msg('Link copied.'); });
      var del = el('button', 'sx-btn sx-btn-sm sx-btn-ghost', 'Delete'); del.type = 'button';
      del.addEventListener('click', function () { if (confirm('Delete this link? The client will no longer be able to use it.')) R.deleteInvite(i.id).then(load).catch(fail); });
      row.appendChild(cp); row.appendChild(del); t.appendChild(row);
    });
  }
  function copy(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {});
    else { var a = $('mr-link'); a.select(); document.execCommand('copy'); }
  }
  function load() {
    Promise.all([R.pending(), R.approved(), R.invites()]).then(function (a) {
      fill('mr-pending', a[0], true, 'No reviews waiting.');
      fill('mr-approved', a[1], false, 'No published reviews yet.');
      var got = {}; a[0].concat(a[1]).forEach(function (r) { got[r.id] = 1; });
      inviteRows(a[2], got);
    }).catch(fail);
  }

  if (!R.enabled()) { $('mr-off').hidden = false; return; }
  $('mr-in').hidden = false;
  $('mr-signin').addEventListener('click', function () { R.signIn().catch(function (e) { msg('Sign-in failed: ' + e.message, true); }); });
  $('mr-signout').addEventListener('click', function () { R.signOut(); });
  $('mr-copy').addEventListener('click', function () { copy($('mr-link').value); msg('Link copied.'); });

  $('mr-make').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, name = f.elements.name.value.trim(), project = f.elements.project.value.trim();
    if (!name || !project) { msg('Please type the client name and the project.', true); return; }
    var btn = $('mr-create'); btn.disabled = true; msg('Creating...');
    var file = f.elements.image.files[0];
    (file ? R.shrink(file, 1000, 0.78, false) : Promise.resolve(''))
      .then(function (img) { return R.createInvite({ name: name, project: project, image: img }); })
      .then(function (code) {
        var link = linkFor(code); f.reset();
        $('mr-link').value = link; $('mr-result').hidden = false;
        var text = 'Hello ' + name + ', thank you for choosing Avalon Corporate Solutions for ' + project + '. Could you please share a short review? It takes about one minute: ' + link;
        $('mr-wa').href = 'https://wa.me/?text=' + encodeURIComponent(text);
        msg('Link created.'); load();
      }).catch(fail).then(function () { btn.disabled = false; });
  });

  R.onUser(function (u) {
    var owner = u && u.email && u.email.toLowerCase() === R.owner;
    $('mr-signin').hidden = !!u; $('mr-signout').hidden = !u;
    $('mr-list').hidden = !owner;
    if (u && !owner) msg('This page is only for the owner. You are signed in as ' + u.email + '.', true); else msg('');
    if (owner) load();
  });
})();

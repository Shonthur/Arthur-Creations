/* Owner tool: add or remove client testimonials (saved in assets/testimonials.json).
   Works after you connect on this page with your GitHub token. */
(function () {
  'use strict';
  var OWNER = 'Shonthur', REPO = 'Arthur-Creations', BRANCH = 'main', FILE = 'assets/testimonials.json';
  var panel = document.getElementById('ex-admin');
  if (!panel) return;
  var $ = function (id) { return document.getElementById(id); };
  var data = { testimonials: [] }, sha = null;

  function say(text, bad) { var m = $('ex-msg'); m.textContent = text; m.style.color = bad ? '#e11d48' : ''; }
  function url() { return 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + FILE; }
  function headers() { return { 'Authorization': 'Bearer ' + window.GX_TOKEN, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' }; }
  function b64(text) { var bytes = new TextEncoder().encode(text), s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); }
  function unb64(t) { var bin = atob(t.replace(/\s/g, '')), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new TextDecoder().decode(a); }

  function render() {
    var ul = $('ex-tl'); ul.textContent = '';
    if (!data.testimonials.length) { var li = document.createElement('li'); li.textContent = 'No testimonials yet.'; ul.appendChild(li); return; }
    data.testimonials.forEach(function (t, i) {
      var li = document.createElement('li'), d = document.createElement('div'), b = document.createElement('button');
      var s = document.createElement('strong'); s.textContent = t.name + (t.role ? ' (' + t.role + ')' : '');
      var sm = document.createElement('small'); sm.textContent = t.message.length > 110 ? t.message.slice(0, 110) + '...' : t.message;
      d.appendChild(s); d.appendChild(sm); b.type = 'button'; b.textContent = 'Remove';
      b.addEventListener('click', function () {
        if (!confirm('Remove this testimonial from the website?')) return;
        data.testimonials.splice(i, 1); save('Testimonial removed.');
      });
      li.appendChild(d); li.appendChild(b); ul.appendChild(li);
    });
  }

  function load() {
    say('Loading...');
    return fetch(url() + '?ref=' + BRANCH + '&t=' + Date.now(), { headers: headers() }).then(function (r) {
      if (r.status === 404) { sha = null; data = { testimonials: [] }; return; }
      if (!r.ok) throw new Error('GitHub answered ' + r.status);
      return r.json().then(function (j) { sha = j.sha; data = JSON.parse(unb64(j.content)); if (!data.testimonials) data.testimonials = []; });
    }).then(function () { render(); say(''); }).catch(function (e) { say('Could not load: ' + e.message, true); });
  }

  function save(okText) {
    say('Saving...');
    var body = { message: 'Update testimonials', branch: BRANCH, content: b64(JSON.stringify(data, null, 2) + '\n') };
    if (sha) body.sha = sha;
    return fetch(url(), { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(function (r) {
      if (!r.ok) throw new Error('GitHub answered ' + r.status);
      return r.json();
    }).then(function (j) { sha = j.content.sha; render(); say(okText + ' It shows on the website in about a minute.'); })
      .catch(function (e) { say('Could not save: ' + e.message, true); load(); });
  }

  $('ex-add').addEventListener('click', function () {
    var name = $('ex-n').value.trim(), msg = $('ex-m').value.trim();
    if (!name || !msg) { say('Enter the client name and the message.', true); return; }
    if (!$('ex-ok').checked) { say('Tick the box to confirm the client allowed you to publish this.', true); return; }
    var t = { name: name, role: $('ex-r').value.trim(), message: msg, added: new Date().toISOString().slice(0, 10) };
    var ph = $('ex-p').value.trim(); if (ph) t.photo = ph;
    data.testimonials.unshift(t);
    save('Testimonial added.').then(function () { $('ex-n').value = $('ex-r').value = $('ex-m').value = $('ex-p').value = ''; $('ex-ok').checked = false; });
  });

  document.addEventListener('gx-connected', function () { panel.hidden = false; load(); });
  document.addEventListener('gx-disconnected', function () { panel.hidden = true; });
})();

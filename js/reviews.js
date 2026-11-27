/* Client reviews through private invite links (Firebase Firestore).
   Nothing loads from Firebase unless js/firebase-config.js is filled in. */
(function () {
  'use strict';
  var V = '10.12.2';
  var BASE = 'https://www.gstatic.com/firebasejs/' + V + '/';
  var OWNER = 'arthurshon@gmail.com';
  var cfg = window.AV_FIREBASE;
  var ready = null;

  function enabled() { return !!(cfg && cfg.apiKey && cfg.projectId); }
  function init() {
    if (!enabled()) return Promise.reject(new Error('not-configured'));
    if (ready) return ready;
    ready = Promise.all([
      import(BASE + 'firebase-app.js'),
      import(BASE + 'firebase-auth.js'),
      import(BASE + 'firebase-firestore.js')
    ]).then(function (m) {
      var app = m[0].initializeApp(cfg);
      return { A: m[1], F: m[2], auth: m[1].getAuth(app), db: m[2].getFirestore(app) };
    });
    return ready;
  }
  function rows(snap) {
    var out = [];
    snap.forEach(function (d) {
      var v = d.data(); v.id = d.id;
      v._t = v.created && v.created.toMillis ? v.created.toMillis() : 0;
      out.push(v);
    });
    out.sort(function (a, b) { return b._t - a._t; });
    return out;
  }
  function byStatus(status) {
    return init().then(function (x) {
      return x.F.getDocs(x.F.query(x.F.collection(x.db, 'reviews'), x.F.where('status', '==', status)));
    }).then(rows);
  }
  function one(coll, id) {
    return init().then(function (x) { return x.F.getDoc(x.F.doc(x.db, coll, id)); })
      .then(function (d) { return d.exists() ? d.data() : null; });
  }
  function makeCode() {
    var al = 'abcdefghjkmnpqrstuvwxyz23456789', a = new Uint8Array(20), s = '';
    crypto.getRandomValues(a);
    for (var i = 0; i < a.length; i++) s += al[a[i] % al.length];
    return s;
  }

  /* shrink a photo in the browser: square crop (profile) or fit width (banner) -> small JPEG */
  function shrink(file, size, quality, square) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var sw = im.naturalWidth, sh = im.naturalHeight, c = document.createElement('canvas'), g = c.getContext('2d');
        if (square) {
          var m = Math.min(sw, sh);
          c.width = c.height = size;
          g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
          g.drawImage(im, (sw - m) / 2, (sh - m) / 2, m, m, 0, 0, size, size);
        } else {
          var k = Math.min(1, size / sw);
          c.width = Math.round(sw * k); c.height = Math.round(sh * k);
          g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
          g.drawImage(im, 0, 0, c.width, c.height);
        }
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', quality));
      };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('bad-image')); };
      im.src = url;
    });
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeImg(u) { return typeof u === 'string' && /^(data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+|https:\/\/[^\s"'<>]+|[\w.\/-]+)$/.test(u) ? u : ''; }
  /* one review card (HTML string): banner, stars, words, round photo */
  function card(t) {
    var n = Math.max(0, Math.min(5, Math.round(Number(t.rating) || 0)));
    var ini = (t.name || '?').split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    var ph = safeImg(t.photo), im = safeImg(t.image);
    var av = ph ? '<img src="' + esc(ph) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : esc(ini);
    var sub = [t.role, t.project].filter(Boolean).map(esc).join(' &middot; ');
    return '<figure class="ex-t">' +
      (im ? '<img class="ex-t-img" src="' + esc(im) + '" alt="' + esc(t.project || 'Finished work') + '" loading="lazy">' : '') +
      (n ? '<div class="ex-stars" role="img" aria-label="' + n + ' out of 5 stars"><span>' + '&#9733;'.repeat(n) + '</span><i>' + '&#9733;'.repeat(5 - n) + '</i></div>' : '') +
      '<blockquote>' + esc(t.message) + '</blockquote>' +
      '<figcaption class="ex-who"><span class="ex-av">' + av + '</span><span><strong>' + esc(t.name) + '</strong><small>' + sub + '</small></span></figcaption></figure>';
  }

  window.AVReviews = {
    enabled: enabled, owner: OWNER, shrink: shrink, makeCode: makeCode, card: card, esc: esc,
    onUser: function (cb) { return init().then(function (x) { return x.A.onAuthStateChanged(x.auth, cb); }); },
    signIn: function () { return init().then(function (x) { return x.A.signInWithPopup(x.auth, new x.A.GoogleAuthProvider()); }).then(function (r) { return r.user; }); },
    signOut: function () { return init().then(function (x) { return x.A.signOut(x.auth); }); },
    /* client side: open with the private code */
    invite: function (code) { return one('invites', code); },
    review: function (code) { return one('reviews', code); },
    submit: function (code, d) {
      return init().then(function (x) {
        return x.F.setDoc(x.F.doc(x.db, 'reviews', code), {
          code: code,
          name: String(d.name || 'Client').slice(0, 80),
          role: String(d.role || '').slice(0, 80),
          project: String(d.project || '').slice(0, 100),
          rating: d.rating,
          message: d.message,
          photo: d.photo || '',
          image: d.image || '',
          status: 'pending',
          created: x.F.serverTimestamp()
        });
      });
    },
    /* owner side */
    createInvite: function (d) {
      var code = makeCode();
      return init().then(function (x) {
        return x.F.setDoc(x.F.doc(x.db, 'invites', code), {
          name: String(d.name).slice(0, 80), project: String(d.project).slice(0, 100), image: d.image || '', created: x.F.serverTimestamp()
        });
      }).then(function () { return code; });
    },
    invites: function () { return init().then(function (x) { return x.F.getDocs(x.F.collection(x.db, 'invites')); }).then(rows); },
    deleteInvite: function (code) { return init().then(function (x) { return x.F.deleteDoc(x.F.doc(x.db, 'invites', code)); }); },
    approved: function () { return byStatus('approved'); },
    pending: function () { return byStatus('pending'); },
    approve: function (id) { return init().then(function (x) { return x.F.updateDoc(x.F.doc(x.db, 'reviews', id), { status: 'approved' }); }); },
    remove: function (id) { return init().then(function (x) { return x.F.deleteDoc(x.F.doc(x.db, 'reviews', id)); }); }
  };
})();

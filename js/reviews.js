/* Client reviews through Firebase (Google sign-in + Firestore).
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

  window.AVReviews = {
    enabled: enabled,
    owner: OWNER,
    onUser: function (cb) { return init().then(function (x) { return x.A.onAuthStateChanged(x.auth, cb); }); },
    signIn: function () {
      return init().then(function (x) { return x.A.signInWithPopup(x.auth, new x.A.GoogleAuthProvider()); }).then(function (r) { return r.user; });
    },
    signOut: function () { return init().then(function (x) { return x.A.signOut(x.auth); }); },
    mine: function (uid) {
      return init().then(function (x) { return x.F.getDoc(x.F.doc(x.db, 'reviews', uid)); })
        .then(function (d) { return d.exists() ? d.data() : null; });
    },
    submit: function (user, role, message) {
      return init().then(function (x) {
        return x.F.setDoc(x.F.doc(x.db, 'reviews', user.uid), {
          uid: user.uid,
          name: (user.displayName || 'Client').slice(0, 80),
          role: String(role || '').slice(0, 80),
          message: message,
          photo: user.photoURL || '',
          status: 'pending',
          created: x.F.serverTimestamp()
        });
      });
    },
    approved: function () { return byStatus('approved'); },
    pending: function () { return byStatus('pending'); },
    approve: function (id) {
      return init().then(function (x) { return x.F.updateDoc(x.F.doc(x.db, 'reviews', id), { status: 'approved' }); });
    },
    remove: function (id) {
      return init().then(function (x) { return x.F.deleteDoc(x.F.doc(x.db, 'reviews', id)); });
    }
  };
})();

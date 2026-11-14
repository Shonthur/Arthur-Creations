/* Owner-only upload page.

   How it works:
   1. Your browser reads the PDF and draws every page as an HD image (pdf.js, kept in js/vendor/pdfjs).
   2. Only those images (a few MB) are sent to GitHub, using a token you paste in this browser.
   3. They are saved in ONE commit, together with the updated projects.json.
   The big PDF itself never has to be uploaded, so this works on slow connections. */
(function () {
  'use strict';

  var OWNER = 'Shonthur';
  var REPO = 'Arthur-Creations';
  var BRANCH = 'main';
  var API = window.GX_API_BASE || 'https://api.github.com';
  var OUT_DIR = 'assets/graphics';
  var FULL_EDGE = 2600;        // pixels on the longest side of each HD page
  var THUMB_EDGE = 720;        // pixels for the small preview
  var FULL_QUALITY = 0.9;
  var THUMB_QUALITY = 0.82;
  var MAX_PDF_MB = 150;        // biggest PDF this page will open
  var MAX_PAGES = 80;
  var TOKEN_KEY = 'gx-upload-token';
  var PDFJS_BASE = new URL('../js/vendor/pdfjs/', location.href).href;

  var token = '';
  var items = [];
  var busy = false;
  var cancelled = false;
  var active = [];             // running requests, so Cancel can stop them

  var $ = function (id) { return document.getElementById(id); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function slugify(name) {
    var s = name.replace(/\.pdf$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s || 'design';
  }

  function niceTitle(name) {
    var t = name.replace(/\.pdf$/i, '').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Untitled';
  }

  function mb(bytes) { return (bytes / 1048576).toFixed(1) + ' MB'; }

  function timeText(sec) {
    if (!isFinite(sec) || sec < 0) return '';
    if (sec < 60) return 'less than a minute';
    var m = Math.round(sec / 60);
    return 'about ' + m + (m === 1 ? ' minute' : ' minutes');
  }

  function sentence(text) { return /[.!?]$/.test(text) ? text : text + '.'; }

  function cancelError() { var e = new Error('Upload cancelled.'); e.cancelled = true; return e; }
  function checkCancel() { if (cancelled) throw cancelError(); }

  /* ---------- GitHub requests (XMLHttpRequest so uploads can show progress) ---------- */
  function request(method, path, body, onUpload) {
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      active.push(x);
      function finish() { var i = active.indexOf(x); if (i > -1) active.splice(i, 1); }
      x.open(method, API + path);
      x.setRequestHeader('Accept', 'application/vnd.github+json');
      x.setRequestHeader('Authorization', 'Bearer ' + token);
      x.setRequestHeader('X-GitHub-Api-Version', '2022-11-28');
      if (body) x.setRequestHeader('Content-Type', 'application/json');
      x.timeout = 10 * 60 * 1000;
      if (onUpload && x.upload) {
        x.upload.onprogress = function (e) { if (e.lengthComputable) onUpload(e.loaded, e.total); };
      }
      x.onload = function () {
        finish();
        var data = null;
        try { data = x.responseText ? JSON.parse(x.responseText) : null; } catch (e) { data = null; }
        resolve({ status: x.status, ok: x.status >= 200 && x.status < 300, data: data });
      };
      x.onerror = function () {
        finish();
        var e = new Error('The connection to GitHub dropped. Check your internet.');
        e.network = true;
        reject(e);
      };
      x.ontimeout = function () {
        finish();
        var e = new Error('GitHub took too long to answer.');
        e.network = true;
        reject(e);
      };
      x.onabort = function () { finish(); reject(cancelError()); };
      x.send(body ? JSON.stringify(body) : null);
    });
  }

  function apiError(res) {
    var msg = (res.data && res.data.message) || ('GitHub said error ' + res.status);
    if (res.status === 401) msg = 'GitHub no longer accepts your token. It may have expired or been changed.';
    var e = new Error(msg);
    e.status = res.status;
    return e;
  }

  // Tries again for network trouble and busy-server answers. Never retries 401, 404 or a cancel.
  async function api(method, path, body, onUpload) {
    var lastErr;
    for (var attempt = 0; attempt < 4; attempt++) {
      checkCancel();
      try {
        var res = await request(method, path, body, onUpload);
        if (res.ok) return res.data;
        var busyAnswer = res.status >= 500 || res.status === 429 ||
          (res.status === 403 && res.data && /rate limit|abuse/i.test(res.data.message || ''));
        lastErr = apiError(res);
        lastErr.res = res;
        if (!busyAnswer) throw lastErr;
      } catch (e) {
        if (e.cancelled || !e.network) throw e;
        lastErr = e;
      }
      await sleep(1500 * (attempt + 1));
    }
    throw lastErr;
  }

  function repoPath(rest) { return '/repos/' + OWNER + '/' + REPO + rest; }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(new Error('Could not read an image.')); };
      r.readAsDataURL(blob);
    });
  }

  function decodeBase64Utf8(b64) {
    var bin = atob(b64.replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function encodeBase64Utf8(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  /* ---------- step 1: connect ---------- */
  function setConnectMsg(text, kind) {
    var m = $('up-connect-msg');
    m.textContent = text;
    m.className = 'up-msg' + (kind ? ' up-' + kind : '');
  }

  function connect() {
    var value = $('up-token').value.trim();
    if (!value) { setConnectMsg('Paste your token first.', 'bad'); return; }
    token = value;
    setConnectMsg('Checking...', '');
    $('up-connect').disabled = true;

    request('GET', repoPath('')).then(function (res) {
      $('up-connect').disabled = false;
      if (res.status === 401) throw new Error('GitHub did not accept this token. Check that you copied all of it, and that it has not expired.');
      if (res.status === 404) throw new Error('This token cannot see the ' + REPO + ' repository. When you made the token, choose "Only select repositories" and pick ' + REPO + '.');
      if (!res.ok) throw new Error('GitHub said error ' + res.status + '.');
      if (res.data && res.data.permissions && res.data.permissions.push === false) {
        throw new Error('This token can read the repository but not change it. Set "Contents" to "Read and write" and try again.');
      }
      try {
        if ($('up-remember').checked) localStorage.setItem(TOKEN_KEY, value);
        else localStorage.removeItem(TOKEN_KEY);
      } catch (e) { /* storage blocked, token just stays for this visit */ }
      $('up-token').value = '';
      showConnected(res.data && res.data.full_name);
    }).catch(function (err) {
      $('up-connect').disabled = false;
      token = '';
      setConnectMsg(err.network ? err.message : (err.message || 'Something went wrong. Please try again.'), 'bad');
    });
  }

  function showConnected(name) {
    $('up-step-connect').hidden = true;
    $('up-step-upload').hidden = false;
    $('up-who').textContent = name || (OWNER + '/' + REPO);
    loadCategories();
  }

  function forgetToken() {
    token = '';
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
  }

  function disconnect() {
    forgetToken();
    items = [];
    $('up-list').textContent = '';
    updateButtons();
    $('up-step-upload').hidden = true;
    $('up-step-connect').hidden = false;
    setConnectMsg('Token removed from this browser.', '');
  }

  // GitHub said the token is no good. Go back to step 1 but keep the chosen files.
  function authLost() {
    forgetToken();
    cancelled = true;
    $('up-step-upload').hidden = true;
    $('up-step-connect').hidden = false;
    setConnectMsg('GitHub no longer accepts your token. Paste a new one below. Your chosen files and details are kept.', 'bad');
    window.scrollTo(0, 0);
  }

  function tryRemembered() {
    var saved = '';
    try { saved = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { saved = ''; }
    if (!saved) return;
    token = saved;
    $('up-remember').checked = true;
    request('GET', repoPath('')).then(function (res) {
      if (res.ok) showConnected(res.data && res.data.full_name);
      else { forgetToken(); }
    }).catch(function () { token = ''; });
  }

  function loadCategories() {
    fetch('../assets/graphics/projects.json?cb=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : { projects: [] }; })
      .then(function (d) {
        var seen = {};
        var list = $('up-cats');
        list.textContent = '';
        ['Calendars', 'Posters', 'Flyers', 'Brochures', 'Logos', 'Social media', 'Packaging']
          .concat((d.projects || []).map(function (p) { return p.category; }))
          .forEach(function (c) {
            if (!c || seen[c.toLowerCase()]) return;
            seen[c.toLowerCase()] = true;
            list.appendChild(el('option', { value: c }));
          });
      })
      .catch(function () { /* suggestions are optional */ });
  }

  /* ---------- step 2: choose files ---------- */
  function addFiles(fileList) {
    var notes = [];
    Array.prototype.forEach.call(fileList, function (file) {
      var isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
      if (!isPdf) { notes.push(file.name + ' is not a PDF, so it was skipped.'); return; }
      if (file.size > MAX_PDF_MB * 1048576) { notes.push(file.name + ' is ' + mb(file.size) + '. The limit here is ' + MAX_PDF_MB + ' MB.'); return; }
      var slug = slugify(file.name);
      if (items.some(function (i) { return i.slug === slug; })) { notes.push(file.name + ' is already in the list.'); return; }
      items.push(buildItem(file, slug));
    });
    $('up-notes').textContent = notes.join(' ');
    updateButtons();
  }

  function field(label, input, wide) {
    return el('label', { 'class': 'up-field' + (wide ? ' up-wide' : '') }, [el('span', { text: label }), input]);
  }

  function buildItem(file, slug) {
    var title = el('input', { type: 'text', value: niceTitle(file.name), maxlength: '80' });
    var category = el('input', { type: 'text', list: 'up-cats', placeholder: 'e.g. Calendars', maxlength: '40' });
    var year = el('input', { type: 'text', inputmode: 'numeric', placeholder: 'e.g. 2027', maxlength: '4' });
    var tools = el('input', { type: 'text', placeholder: 'e.g. Adobe Illustrator', maxlength: '80' });
    var desc = el('textarea', { rows: '2', placeholder: 'One or two sentences about this design (optional)', maxlength: '400' });

    var status = el('p', { 'class': 'up-status', 'aria-live': 'polite' });
    var bar = el('div', { 'class': 'up-bar' }, [el('i')]);
    var remove = el('button', { type: 'button', 'class': 'up-x', 'aria-label': 'Remove ' + file.name, text: '×' });

    var node = el('li', { 'class': 'up-item' }, [
      el('div', { 'class': 'up-item-head' }, [
        el('div', {}, [el('strong', { text: file.name }), el('span', { text: '  ·  ' + mb(file.size) })]),
        remove
      ]),
      el('div', { 'class': 'up-grid' }, [
        field('Title', title, true),
        field('Category', category),
        field('Year', year),
        field('Tools', tools, true),
        field('Description', desc, true)
      ]),
      bar,
      status
    ]);

    var item = {
      file: file, slug: slug, node: node, status: status, bar: bar,
      fields: { title: title, category: category, year: year, tools: tools, description: desc },
      done: false
    };
    remove.addEventListener('click', function () {
      if (busy) return;
      items = items.filter(function (i) { return i !== item; });
      node.remove();
      updateButtons();
    });
    $('up-list').appendChild(node);
    return item;
  }

  function updateButtons() {
    var pending = items.filter(function (i) { return !i.done; }).length;
    $('up-send').disabled = busy || pending === 0;
    $('up-send').textContent = busy ? 'Working...' : (pending > 1 ? 'Upload ' + pending + ' designs' : 'Upload design');
    $('up-cancel').hidden = !busy;
    $('up-empty').hidden = items.length > 0;
  }

  function setStatus(item, text, kind, pct) {
    item.status.textContent = text;
    item.status.className = 'up-status' + (kind ? ' up-' + kind : '');
    if (typeof pct === 'number') item.bar.firstChild.style.width = pct + '%';
    item.bar.classList.toggle('up-bar-on', typeof pct === 'number');
  }

  function metaFor(item) {
    var f = item.fields;
    var meta = {};
    meta.title = f.title.value.trim() || niceTitle(item.file.name);
    meta.category = f.category.value.trim() || 'Design';
    meta.year = f.year.value.replace(/\D/g, '');
    meta.tools = f.tools.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    meta.description = f.description.value.trim();
    return meta;
  }

  /* ---------- turning the PDF into images (in the browser) ---------- */
  var pdfjsPromise = null;
  function loadPdfjs() {
    if (!pdfjsPromise) {
      pdfjsPromise = import(PDFJS_BASE + 'pdf.min.js').then(function (lib) {
        lib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.js';
        return lib;
      }).catch(function () {
        pdfjsPromise = null;
        throw new Error('This browser is too old to read PDFs here. Please update Chrome, Edge, Firefox or Safari and try again.');
      });
    }
    return pdfjsPromise;
  }

  function canvasToImage(canvas, quality) {
    return new Promise(function (resolve, reject) {
      function fail() { reject(new Error('Could not make an image from a page. The page may be too large for this device.')); }
      canvas.toBlob(function (b) {
        if (!b) return fail();
        if (b.type === 'image/webp') return resolve({ blob: b, ext: 'webp' });
        // Some browsers cannot make WebP, so use JPEG there.
        canvas.toBlob(function (j) { return j ? resolve({ blob: j, ext: 'jpg' }) : fail(); }, 'image/jpeg', Math.max(quality, 0.92));
      }, 'image/webp', quality);
    });
  }

  function averageColor(canvas) {
    var c = document.createElement('canvas');
    c.width = 1; c.height = 1;
    var ctx = c.getContext('2d');
    ctx.drawImage(canvas, 0, 0, 1, 1);
    var d = ctx.getImageData(0, 0, 1, 1).data;
    return '#' + [d[0], d[1], d[2]].map(function (n) { return ('0' + n.toString(16)).slice(-2); }).join('');
  }

  async function renderPdf(item, onPage) {
    var lib = await loadPdfjs();
    checkCancel();
    var buffer = await item.file.arrayBuffer();
    var pdf;
    try {
      pdf = await lib.getDocument({
        data: new Uint8Array(buffer),
        standardFontDataUrl: PDFJS_BASE + 'standard_fonts/',
        wasmUrl: PDFJS_BASE + 'wasm/',
        iccUrl: PDFJS_BASE + 'iccs/'
      }).promise;
    } catch (e) {
      if (e && e.name === 'PasswordException') throw new Error('This PDF is password protected. Remove the password and try again.');
      throw new Error('This file could not be read as a PDF. It may be damaged.');
    }
    if (pdf.numPages > MAX_PAGES) throw new Error('This PDF has ' + pdf.numPages + ' pages. The limit here is ' + MAX_PAGES + '.');

    var pages = [];
    var canvas = document.createElement('canvas');
    var thumbCanvas = document.createElement('canvas');
    for (var n = 1; n <= pdf.numPages; n++) {
      checkCancel();
      onPage(n, pdf.numPages);
      var page = await pdf.getPage(n);
      var base = page.getViewport({ scale: 1 });
      var viewport = page.getViewport({ scale: FULL_EDGE / Math.max(base.width, base.height) });
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      await page.render({ canvas: canvas, viewport: viewport }).promise;

      var ratio = Math.min(1, THUMB_EDGE / Math.max(canvas.width, canvas.height));
      thumbCanvas.width = Math.max(1, Math.round(canvas.width * ratio));
      thumbCanvas.height = Math.max(1, Math.round(canvas.height * ratio));
      var tctx = thumbCanvas.getContext('2d');
      tctx.imageSmoothingQuality = 'high';
      tctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

      var full = await canvasToImage(canvas, FULL_QUALITY);
      var thumb = await canvasToImage(thumbCanvas, THUMB_QUALITY);
      var num = ('0' + n).slice(-2);
      pages.push({
        fullName: 'p' + num + '.' + full.ext, fullBlob: full.blob,
        thumbName: 't' + num + '.' + thumb.ext, thumbBlob: thumb.blob,
        w: canvas.width, h: canvas.height, color: averageColor(thumbCanvas)
      });
      page.cleanup();
    }
    canvas.width = canvas.height = thumbCanvas.width = thumbCanvas.height = 1;
    if (pdf.destroy) pdf.destroy();
    return pages;
  }

  /* ---------- saving to GitHub (one commit) ---------- */
  async function uploadBlobs(files, onBytes) {
    var total = files.reduce(function (s, f) { return s + f.blob.size; }, 0);
    var sent = files.map(function () { return 0; });
    var next = 0;
    var failure = null;

    function report() {
      var s = sent.reduce(function (a, b) { return a + b; }, 0);
      onBytes(s, total);
    }

    async function worker() {
      while (!failure && next < files.length) {
        var i = next++;
        var f = files[i];
        try {
          var b64 = await blobToBase64(f.blob);
          var data = await api('POST', repoPath('/git/blobs'), { content: b64, encoding: 'base64' }, function (loaded, size) {
            sent[i] = size ? (loaded / size) * f.blob.size : 0;
            report();
          });
          f.sha = data.sha;
          sent[i] = f.blob.size;
          report();
        } catch (e) {
          failure = failure || e;
        }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (failure) throw failure;
  }

  async function readProjects() {
    var res = await request('GET', repoPath('/contents/' + OUT_DIR + '/projects.json?ref=' + BRANCH));
    if (res.status === 404) return { projects: [] };
    if (res.status === 401) throw apiError(res);
    if (!res.ok || !res.data || typeof res.data.content !== 'string') throw apiError(res);
    try {
      var parsed = JSON.parse(decodeBase64Utf8(res.data.content));
      if (!parsed.projects) parsed.projects = [];
      return parsed;
    } catch (e) {
      throw new Error('The gallery list (projects.json) on GitHub could not be read, so nothing was changed.');
    }
  }

  async function commitAll(item, files, entry) {
    for (var attempt = 0; attempt < 5; attempt++) {
      checkCancel();
      var ref = await api('GET', repoPath('/git/ref/heads/' + BRANCH));
      var headSha = ref.object.sha;
      var headCommit = await api('GET', repoPath('/git/commits/' + headSha));
      var index = await readProjects();

      // Put the new project in the list (replace it if the same name was uploaded before).
      var existingAt = -1;
      index.projects.forEach(function (p, i) { if (p.slug === entry.slug) existingAt = i; });
      var existing = existingAt > -1 ? index.projects[existingAt] : null;
      if (existing) entry.order = existing.order || 0;
      var added = (existing && existing.added) || new Date().toISOString().slice(0, 10);
      entry.added = added;
      if (existing) {
        index.projects[existingAt] = entry;
      } else {
        var at = index.projects.findIndex(function (p) { return !p.order; });
        if (at < 0) at = index.projects.length;
        index.projects.splice(at, 0, entry);
      }
      var indexText = JSON.stringify({ projects: index.projects }, null, 2) + '\n';
      var indexBlob = await api('POST', repoPath('/git/blobs'), { content: encodeBase64Utf8(indexText), encoding: 'base64' });

      var folder = OUT_DIR + '/' + entry.slug + '/';
      var treeItems = files.map(function (f) {
        return { path: folder + f.name, mode: '100644', type: 'blob', sha: f.sha };
      });
      treeItems.push({ path: OUT_DIR + '/projects.json', mode: '100644', type: 'blob', sha: indexBlob.sha });

      // Remove files of an older version of this same project that are no longer used.
      if (existing) {
        var keep = {};
        files.forEach(function (f) { keep[f.name] = true; });
        var old = [];
        (existing.pages || []).forEach(function (p) { old.push(p.full, p.thumb); });
        if (existing.pdf) old.push(existing.pdf);
        old.forEach(function (name) {
          if (name && !keep[name]) treeItems.push({ path: folder + name, mode: '100644', type: 'blob', sha: null });
        });
      }

      var tree = await api('POST', repoPath('/git/trees'), { base_tree: headCommit.tree.sha, tree: treeItems });
      var commit = await api('POST', repoPath('/git/commits'), {
        message: 'Add design: ' + entry.title,
        tree: tree.sha,
        parents: [headSha]
      });
      var upd = await request('PATCH', repoPath('/git/refs/heads/' + BRANCH), { sha: commit.sha, force: false });
      if (upd.ok) return;
      if (upd.status === 422 || upd.status === 409) { await sleep(1200); continue; }  // the site changed while we worked, so try again
      throw apiError(upd);
    }
    throw new Error('The website kept changing while saving. Please try again in a minute.');
  }

  function waitForLive(item, liveToken) {
    var tries = 0;
    function check() {
      tries++;
      if (cancelled) return Promise.resolve(false);   // already saved, so Cancel just stops waiting
      return fetch('../assets/graphics/projects.json?cb=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; })
        .then(function (d) {
          var found = d && (d.projects || []).some(function (p) { return p.slug === item.slug && p.hash === liveToken; });
          if (found) return true;
          if (tries >= 40) return false;
          setStatus(item, 'Saved. Publishing to the website... this takes about a minute.', '', Math.min(98, 92 + tries / 6));
          return sleep(5000).then(check);
        });
    }
    return check();
  }

  async function sendOne(item) {
    var meta = metaFor(item);

    // 1. Make the images
    setStatus(item, 'Opening the PDF...', '', 3);
    var started = Date.now();
    var pages = await renderPdf(item, function (n, total) {
      var secs = (Date.now() - started) / 1000;
      var text = 'Making HD images: page ' + n + ' of ' + total;
      if (n > 2 && secs > 5) text += '  ·  ' + timeText((secs / (n - 1)) * (total - n + 1)) + ' left';
      setStatus(item, text, '', 5 + (n - 1) / total * 40);
    });
    checkCancel();

    // 2. Collect everything to send
    var files = [];
    pages.forEach(function (p) {
      files.push({ name: p.fullName, blob: p.fullBlob });
      files.push({ name: p.thumbName, blob: p.thumbBlob });
    });

    // 3. Upload
    var upStart = Date.now();
    await uploadBlobs(files, function (sent, total) {
      var secs = (Date.now() - upStart) / 1000;
      var text = 'Uploading images: ' + mb(sent) + ' of ' + mb(total) + ' (' + Math.round(total ? sent / total * 100 : 0) + '%)';
      if (secs > 6 && sent > 0) text += '  ·  ' + timeText((total - sent) / (sent / secs)) + ' left';
      setStatus(item, text, '', 45 + (total ? sent / total : 0) * 40);
    });
    checkCancel();

    // 4. Save in one commit
    setStatus(item, 'Saving to your website...', '', 88);
    var liveToken = Date.now().toString(36);
    var entry = {
      slug: item.slug,
      title: meta.title,
      category: meta.category,
      year: meta.year,
      tools: meta.tools,
      description: meta.description,
      order: 0,
      pdf: null,
      pages: pages.map(function (p) { return { full: p.fullName, thumb: p.thumbName, w: p.w, h: p.h, color: p.color }; }),
      hash: liveToken,
      build: 0,
      added: '',
      source: 'browser'
    };
    await commitAll(item, files, entry);

    // 5. Wait until visitors can see it
    setStatus(item, 'Saved. Publishing to the website...', '', 92);
    var live = await waitForLive(item, liveToken);
    item.done = true;
    item.bar.classList.remove('up-bar-on');
    item.status.className = 'up-status up-ok';
    item.status.textContent = live ? 'Done! ' : 'Saved. The site can take a few more minutes to update. ';
    item.status.appendChild(el('a', { href: 'graphics.html#' + encodeURIComponent(item.slug), text: 'View it on the Graphics page' }));
    item.node.classList.add('up-item-done');
  }

  function sendAll() {
    if (busy) return;
    var todo = items.filter(function (i) { return !i.done; });
    if (!todo.length) return;
    busy = true;
    cancelled = false;
    updateButtons();
    var chain = Promise.resolve();
    todo.forEach(function (item) {
      chain = chain.then(function () {
        if (cancelled) return null;
        return sendOne(item).catch(function (err) {
          if (err && err.status === 401) { setStatus(item, 'Stopped: ' + sentence(err.message), 'bad', null); authLost(); return; }
          if (err && err.cancelled) {
            cancelled = true;
            setStatus(item, 'Cancelled. Nothing was changed on your website. Press Upload to try again.', 'bad', null);
            return;
          }
          setStatus(item, 'Problem: ' + sentence((err && err.message) || 'upload failed') + ' You can press Upload to try again.', 'bad', null);
        });
      });
    });
    chain.then(function () {
      busy = false;
      updateButtons();
    });
  }

  /* ---------- wire up ---------- */
  function init() {
    $('up-connect').addEventListener('click', connect);
    $('up-token').addEventListener('keydown', function (e) { if (e.key === 'Enter') connect(); });
    $('up-disconnect').addEventListener('click', disconnect);
    $('up-send').addEventListener('click', sendAll);
    $('up-cancel').addEventListener('click', function () {
      cancelled = true;
      active.slice().forEach(function (x) { x.abort(); });
    });
    $('up-file').addEventListener('change', function (e) { addFiles(e.target.files); e.target.value = ''; });

    var drop = $('up-drop');
    ['dragenter', 'dragover'].forEach(function (t) {
      drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('up-over'); });
    });
    ['dragleave', 'drop'].forEach(function (t) {
      drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('up-over'); });
    });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer) addFiles(e.dataTransfer.files); });
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); });
    window.addEventListener('beforeunload', function (e) {
      if (busy) { e.preventDefault(); e.returnValue = ''; }
    });

    window.toggleMobileMenu = function () {
      var menu = $('mobile-menu');
      if (menu) menu.classList.toggle('hidden');
    };

    updateButtons();
    tryRemembered();
  }

  init();
})();

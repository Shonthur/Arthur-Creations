/* Owner-only upload page.
   Sends PDFs to the graphics-src folder on GitHub using a personal access token that
   you paste in this browser. GitHub then builds the HD images by itself. */
(function () {
  'use strict';

  var OWNER = 'Shonthur';
  var REPO = 'Arthur-Creations';
  var BRANCH = 'main';
  var DIR = 'graphics-src';
  var API = 'https://api.github.com';
  var MAX_MB = 50;
  var TOKEN_KEY = 'gx-upload-token';

  var token = '';
  var items = [];      // {id, file, slug, node, fields}
  var busy = false;

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
    var base = name.replace(/\.pdf$/i, '');
    var s = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s || 'design';
  }

  function niceTitle(name) {
    var t = name.replace(/\.pdf$/i, '').replace(/[_\-]+/g, ' ').trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Untitled';
  }

  function mb(bytes) { return (bytes / 1048576).toFixed(1) + ' MB'; }

  /* ---------- GitHub calls ---------- */
  function gh(path, opts) {
    opts = opts || {};
    var headers = {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch(API + path, { method: opts.method || 'GET', headers: headers, body: opts.body })
      .then(function (res) {
        return res.text().then(function (txt) {
          var data = null;
          try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
          return { status: res.status, ok: res.ok, data: data };
        });
      });
  }

  function repoPath(rest) { return '/repos/' + OWNER + '/' + REPO + rest; }

  function readBase64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(new Error('Could not read the file.')); };
      r.readAsDataURL(file);
    });
  }

  function textToBase64(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function putFile(path, base64, message) {
    return gh(repoPath('/contents/' + path.split('/').map(encodeURIComponent).join('/') + '?ref=' + BRANCH))
      .then(function (existing) {
        var body = { message: message, content: base64, branch: BRANCH };
        if (existing.status === 200 && existing.data && existing.data.sha) body.sha = existing.data.sha;
        return gh(repoPath('/contents/' + path.split('/').map(encodeURIComponent).join('/')), {
          method: 'PUT',
          body: JSON.stringify(body)
        });
      })
      .then(function (res) {
        if (!res.ok) {
          var msg = (res.data && res.data.message) || ('GitHub said error ' + res.status);
          throw new Error(msg);
        }
        return res.data;
      });
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

    gh(repoPath('')).then(function (res) {
      $('up-connect').disabled = false;
      if (res.status === 401) throw new Error('GitHub did not accept this token. Check that you copied all of it, and that it has not expired.');
      if (res.status === 404) throw new Error('This token cannot see the ' + REPO + ' repository. When you made the token, choose "Only select repositories" and pick ' + REPO + '.');
      if (!res.ok) throw new Error('GitHub said error ' + res.status + '.');
      if (res.data && res.data.permissions && res.data.permissions.push === false) {
        throw new Error('This token can read the repository but not change it. Set "Contents" to "Read and write" and try again.');
      }
      var remember = $('up-remember').checked;
      try {
        if (remember) localStorage.setItem(TOKEN_KEY, value);
        else localStorage.removeItem(TOKEN_KEY);
      } catch (e) { /* storage blocked, token just stays for this visit */ }
      $('up-token').value = '';
      showConnected(res.data && res.data.full_name);
    }).catch(function (err) {
      $('up-connect').disabled = false;
      token = '';
      setConnectMsg(err.message || 'Something went wrong. Please try again.', 'bad');
    });
  }

  function showConnected(name) {
    $('up-step-connect').hidden = true;
    $('up-step-upload').hidden = false;
    $('up-who').textContent = name || (OWNER + '/' + REPO);
    loadCategories();
  }

  function disconnect() {
    token = '';
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
    items = [];
    $('up-list').textContent = '';
    updateButtons();
    $('up-step-upload').hidden = true;
    $('up-step-connect').hidden = false;
    setConnectMsg('Token removed from this browser.', '');
  }

  function tryRemembered() {
    var saved = '';
    try { saved = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { saved = ''; }
    if (!saved) return;
    token = saved;
    $('up-remember').checked = true;
    gh(repoPath('')).then(function (res) {
      if (res.ok) showConnected(res.data && res.data.full_name);
      else { token = ''; try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } }
    }).catch(function () { token = ''; });
  }

  /* ---------- categories for the suggestion list ---------- */
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
      if (file.size > MAX_MB * 1048576) { notes.push(file.name + ' is ' + mb(file.size) + '. The limit here is ' + MAX_MB + ' MB.'); return; }
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
    $('up-send').textContent = busy ? 'Uploading...' : (pending > 1 ? 'Upload ' + pending + ' designs' : 'Upload design');
    $('up-empty').hidden = items.length > 0;
  }

  /* ---------- step 3: upload ---------- */
  function setStatus(item, text, kind, pct) {
    item.status.textContent = text;
    item.status.className = 'up-status' + (kind ? ' up-' + kind : '');
    if (typeof pct === 'number') item.bar.firstChild.style.width = pct + '%';
    item.bar.classList.toggle('up-bar-on', typeof pct === 'number');
  }

  function metaFor(item) {
    var f = item.fields;
    var meta = {};
    var title = f.title.value.trim();
    if (title) meta.title = title;
    if (f.category.value.trim()) meta.category = f.category.value.trim();
    var yr = f.year.value.replace(/\D/g, '');
    if (yr) meta.year = parseInt(yr, 10);
    var tl = f.tools.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (tl.length) meta.tools = tl;
    if (f.description.value.trim()) meta.description = f.description.value.trim();
    return meta;
  }

  function waitForBuild(sha, item) {
    var run = null;
    var tries = 0;
    function find() {
      if (run || tries >= 20) return Promise.resolve();
      tries++;
      return gh(repoPath('/actions/runs?head_sha=' + sha + '&per_page=10')).then(function (res) {
        var runs = (res.data && res.data.workflow_runs) || [];
        run = runs.filter(function (r) { return /build-graphics/.test(r.path || ''); })[0] || null;
        return run ? null : sleep(3000).then(find);
      });
    }
    function poll(n) {
      return gh(repoPath('/actions/runs/' + run.id)).then(function (res) {
        var d = res.data || {};
        if (d.status === 'completed') return d.conclusion;
        if (n > 90) return 'timeout';
        setStatus(item, 'Making the HD images... this takes about a minute.', '', 70 + Math.min(20, n));
        return sleep(4000).then(function () { return poll(n + 1); });
      });
    }
    return find().then(function () {
      if (!run) return 'unknown';
      return poll(0);
    });
  }

  function waitForLive(item) {
    var tries = 0;
    function check() {
      tries++;
      return fetch('../assets/graphics/projects.json?cb=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; })
        .then(function (d) {
          var found = d && (d.projects || []).some(function (p) { return p.slug === item.slug; });
          if (found) return true;
          if (tries >= 40) return false;
          return sleep(5000).then(check);
        });
    }
    return check();
  }

  function sendOne(item) {
    var meta = metaFor(item);
    var hasMeta = Object.keys(meta).length > 0;
    var pdfPath = DIR + '/' + item.slug + '.pdf';
    var jsonPath = DIR + '/' + item.slug + '.json';
    var pdfCommit = null;

    setStatus(item, 'Reading the file...', '', 5);
    return readBase64(item.file).then(function (b64) {
      // The settings file goes first so the build already knows the title and category.
      var step = hasMeta
        ? (setStatus(item, 'Saving the details...', '', 15),
           putFile(jsonPath, textToBase64(JSON.stringify(meta, null, 2) + '\n'), 'Add details for ' + item.slug))
        : Promise.resolve();
      return step.then(function () {
        setStatus(item, 'Uploading the PDF (' + mb(item.file.size) + ')...', '', 35);
        return putFile(pdfPath, b64, 'Add design: ' + (meta.title || item.slug));
      });
    }).then(function (res) {
      pdfCommit = res && res.commit && res.commit.sha;
      setStatus(item, 'Uploaded. Waiting for GitHub to start the build...', '', 60);
      return pdfCommit ? waitForBuild(pdfCommit, item) : 'unknown';
    }).then(function (result) {
      if (result === 'failure' || result === 'cancelled' || result === 'timed_out') {
        throw new Error('The build did not finish. Open the Actions tab on GitHub to see why.');
      }
      setStatus(item, 'Images are ready. Publishing to the website...', '', 92);
      return waitForLive(item);
    }).then(function (live) {
      item.done = true;
      item.bar.classList.remove('up-bar-on');
      item.status.className = 'up-status up-ok';
      item.status.textContent = '';
      var link = el('a', { href: 'graphics.html#' + encodeURIComponent(item.slug), text: 'View it on the Graphics page' });
      item.status.appendChild(document.createTextNode(live ? 'Done! ' : 'Uploaded. The site can take a few more minutes to update. '));
      item.status.appendChild(link);
      item.node.classList.add('up-item-done');
    });
  }

  function sendAll() {
    if (busy) return;
    var todo = items.filter(function (i) { return !i.done; });
    if (!todo.length) return;
    busy = true;
    updateButtons();
    todo.reduce(function (chain, item) {
      return chain.then(function () {
        return sendOne(item).catch(function (err) {
          setStatus(item, 'Problem: ' + (err.message || 'upload failed') + ' You can press Upload to try again.', 'bad', null);
        });
      });
    }, Promise.resolve()).then(function () {
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

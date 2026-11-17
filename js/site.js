/* Avalon Corporate Solutions - shared site script: mobile menu, reveal on scroll, price calculator */
(function () {
  var root = document.documentElement;
  root.classList.add("js");

  var burger = document.getElementById("sx-burger");
  var menu = document.getElementById("sx-menu");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = menu.classList.toggle("sx-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("sx-open")) {
        menu.classList.remove("sx-open");
        burger.setAttribute("aria-expanded", "false");
        burger.focus();
      }
    });
  }

  var items = document.querySelectorAll(".sx-reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("sx-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add("sx-in"); });
  }

  var yr = document.getElementById("sx-yr"); if (yr) yr.textContent = new Date().getFullYear();
  var year = document.getElementById("sx-year");
  if (year) year.textContent = new Date().getFullYear();

  /* Price calculator (services page) */
  var calc = document.getElementById("sx-calc");
  if (calc) {
    var fmt = function (n) { return "UGX " + n.toLocaleString("en-US"); };
    var out = document.getElementById("sx-sum");
    var lines = document.getElementById("sx-lines");
    var quote = document.getElementById("sx-quote");
    var update = function () {
      var base = calc.querySelector("#sx-base");
      var baseOpt = base.options[base.selectedIndex];
      var custom = baseOpt.dataset.price === "custom";
      var basePrice = custom ? 0 : parseInt(baseOpt.dataset.price, 10);
      var add = 0, names = [];
      calc.querySelectorAll("input[type=checkbox]:checked").forEach(function (c) {
        add += parseInt(c.dataset.price, 10); names.push(c.dataset.name);
      });
      var pages = parseInt(calc.querySelector("#sx-pages").value, 10) || 0;
      var rush = parseFloat(calc.querySelector("#sx-rush").value) || 0;
      var subtotal = basePrice + add + pages;
      var total = Math.round(subtotal * (1 + rush));
      if (custom) {
        out.textContent = "Custom quote";
        lines.textContent = "Large projects are priced after we talk about the scope.";
      } else {
        out.textContent = fmt(total);
        lines.textContent = "Base " + fmt(basePrice) + (add ? " + add-ons " + fmt(add) : "") +
          (pages ? " + extra pages " + fmt(pages) : "") + (rush ? " + " + Math.round(rush * 100) + "% faster delivery" : "");
      }
      var msg = "Hello Arthur, I would like a quote.\nPackage: " + baseOpt.text.split(" - ")[0] +
        (names.length ? "\nAdd-ons: " + names.join(", ") : "") +
        (pages ? "\nExtra pages: yes" : "") + "\nEstimate: " + out.textContent;
      quote.href = "mailto:arthurshon@gmail.com?subject=" + encodeURIComponent("Website quote request") + "&body=" + encodeURIComponent(msg);
    };
    calc.addEventListener("change", update);
    update();
  }
})();

/* YouTube videos load only after a click (faster page, more privacy) */
(function () {
  document.querySelectorAll("[data-yt]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + btn.dataset.yt + "?autoplay=1&rel=0&modestbranding=1";
      f.title = "Video player";
      f.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
      f.allowFullscreen = true;
      f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      btn.parentNode.replaceChild(f, btn);
    });
  });
})();

/* Case studies: tabs (Web projects / Graphics) and graphics cases from projects.json */
(function () {
  var tabs = document.querySelectorAll(".cs-tablist [data-tab]");
  if (!tabs.length) return;
  function show(name) {
    if (name !== "graphics") name = "web";
    tabs.forEach(function (t) { t.setAttribute("aria-selected", t.dataset.tab === name ? "true" : "false"); });
    document.getElementById("cs-web").hidden = name !== "web";
    document.getElementById("cs-graphics").hidden = name !== "graphics";
    document.querySelectorAll("#cs-web .sx-reveal, #cs-graphics .sx-reveal").forEach(function (e) { e.classList.add("sx-in"); });
  }
  tabs.forEach(function (t) {
    t.addEventListener("click", function () { history.replaceState(null, "", "#" + t.dataset.tab); show(t.dataset.tab); });
  });
  show(location.hash.replace("#", ""));
  window.addEventListener("hashchange", function () { show(location.hash.replace("#", "")); });

  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
  var box = document.getElementById("sx-gfx-cases");
  fetch("../assets/graphics/projects.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (data) {
    var list = (data && data.projects) || [];
    if (!list.length) { box.innerHTML = '<p class="sx-note">Graphics projects will appear here soon.</p>'; return; }
    box.innerHTML = list.map(function (p) {
      var n = p.pages.length;
      var desc = p.description || (esc(p.category) + " design, " + n + (n === 1 ? " page." : " pages."));
      var tools = (p.tools || []).map(esc).join(", ");
      var img = "../assets/graphics/" + encodeURIComponent(p.slug) + "/" + p.pages[0].thumb;
      return '<article class="sx-case sx-in"><div class="sx-case-shot"><img class="sx-gfx-img" src="' + img + '" alt="' + esc(p.title) + ' preview" loading="lazy"></div>' +
        '<div><span class="sx-tag">' + esc(p.category) + '</span><h2>' + esc(p.title) + '</h2><p>' + esc(desc) + '</p>' +
        '<dl>' + (p.year ? '<dt>Year</dt><dd>' + esc(p.year) + '</dd>' : '') + '<dt>Pages</dt><dd>' + n + '</dd>' + (tools ? '<dt>Made with</dt><dd>' + tools + '</dd>' : '') + '</dl>' +
        '<a class="sx-link" href="graphics.html#' + encodeURIComponent(p.slug) + '">View the full project <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div></article>';
    }).join("");
  }).catch(function () { box.innerHTML = '<p class="sx-note">Could not load the graphics projects. Please open the <a href="graphics.html">Graphics page</a>.</p>'; });
})();

/* Light / dark theme toggle (remembered in this browser) */
(function () {
  var root = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  function apply(t) {
    if (t === "dark") root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
    if (meta) meta.setAttribute("content", t === "dark" ? "#0b0b0d" : "#1a365d");
    document.querySelectorAll(".sx-theme").forEach(function (b) {
      b.setAttribute("aria-label", t === "dark" ? "Switch to light theme" : "Switch to dark theme");
      b.setAttribute("aria-pressed", t === "dark" ? "true" : "false");
    });
  }
  apply(root.getAttribute("data-theme") === "dark" ? "dark" : "light");
  document.querySelectorAll(".sx-theme").forEach(function (b) {
    b.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      apply(next);
      try { localStorage.setItem("sx-theme", next); } catch (e) {}
    });
  });
})();

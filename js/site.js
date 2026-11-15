/* Arthur Creations - shared site script: mobile menu, reveal on scroll, price calculator */
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

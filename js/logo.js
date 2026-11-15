/* Avalon logo animations. Every 5 seconds the logo plays one calm effect.
   Effects take turns: 1 text slides into the A, 2 arrow launches, 3 letters cascade, 4 logo rebuilds.
   Turned off for people who prefer reduced motion. */
(function () {
  var EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";
  var PERIOD = 5000;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !Element.prototype.animate) return;

  function parts(root) {
    var tx = root.querySelector(".av-tx");
    var b = tx && tx.querySelector("b");
    if (b && !b.querySelector(".av-l")) {
      var word = b.textContent;
      b.setAttribute("aria-hidden", "true");
      b.innerHTML = word.split("").map(function (c) { return '<span class="av-l" style="display:inline-block">' + c + "</span>"; }).join("");
    }
    return {
      peak: root.querySelector(".av-peak"), swoosh: root.querySelector(".av-swoosh"), leg: root.querySelector(".av-leg"),
      tx: tx, letters: root.querySelectorAll(".av-l"), sub: tx && tx.querySelector("i")
    };
  }
  function go(el, frames, opts) {
    if (!el) return;
    opts.easing = opts.easing || EASE;
    var a = el.animate(frames, opts);
    a.onfinish = function () { a.cancel(); };
  }

  var effects = [
    /* 1. The words slide into the A, then slide back out */
    function (p) {
      go(p.tx, [
        { transform: "none", offset: 0 },
        { transform: "translateX(-118%)", offset: 0.36 },
        { transform: "translateX(-118%)", offset: 0.48 },
        { transform: "none", offset: 1 }
      ], { duration: 2000 });
    },
    /* 2. The arrow launches up and returns from below */
    function (p) {
      go(p.swoosh, [
        { transform: "none", opacity: 1, offset: 0 },
        { transform: "translate(90px,-90px)", opacity: 0, offset: 0.35 },
        { transform: "translate(-110px,110px)", opacity: 0, offset: 0.42 },
        { transform: "none", opacity: 1, offset: 1 }
      ], { duration: 1900 });
      go(p.peak, [
        { transform: "none", offset: 0 }, { transform: "none", offset: 0.55 },
        { transform: "translateY(-12px)", offset: 0.75 }, { transform: "none", offset: 1 }
      ], { duration: 1900 });
    },
    /* 3. The letters rise one after another */
    function (p) {
      Array.prototype.forEach.call(p.letters, function (l, i) {
        go(l, [
          { opacity: 1, transform: "none", offset: 0 },
          { opacity: 0, transform: "translateY(35%)", offset: 0.18 },
          { opacity: 0, transform: "translateY(35%)", offset: 0.22 },
          { opacity: 1, transform: "none", offset: 1 }
        ], { duration: 1500, delay: i * 90 });
      });
      go(p.sub, [
        { opacity: 1, transform: "none", offset: 0 },
        { opacity: 0, transform: "translateY(60%)", offset: 0.2 },
        { opacity: 0, transform: "translateY(60%)", offset: 0.5 },
        { opacity: 1, transform: "none", offset: 1 }
      ], { duration: 1700 });
    },
    /* 4. The mark rebuilds piece by piece */
    function (p) {
      var f = function (dx, dy) {
        return [
          { opacity: 1, transform: "none", offset: 0 },
          { opacity: 0, transform: "translate(" + dx / 3 + "px," + dy / 3 + "px)", offset: 0.2 },
          { opacity: 0, transform: "translate(" + dx + "px," + dy + "px)", offset: 0.25 },
          { opacity: 1, transform: "none", offset: 1 }
        ];
      };
      go(p.peak, f(0, -90), { duration: 1700 });
      go(p.leg, f(0, 90), { duration: 1700, delay: 150 });
      go(p.swoosh, f(-110, 110), { duration: 1700, delay: 320 });
    }
  ];

  function start(root, firstDelay) {
    var p = parts(root), i = 0, timer;
    function tick() {
      if (!document.hidden) effects[i++ % effects.length](p);
      timer = setTimeout(tick, PERIOD);
    }
    timer = setTimeout(tick, firstDelay);
  }

  document.querySelectorAll(".av-lock, [data-avlogo]").forEach(function (el) {
    start(el, el.hasAttribute("data-avlogo") ? 2900 : PERIOD);
  });
})();

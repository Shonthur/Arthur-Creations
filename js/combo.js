/* Combo calculator: designs UGX 25,000 each.
   4+ designs: 15% off the total. 2+ designs with 1+ website: 15% off the total.
   2+ websites: 3 designs free. Offers do not add up: the best one applies. */
(function () {
  'use strict';
  var box = document.getElementById('cb-calc');
  if (!box) return;
  var DESIGN = 25000;
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return 'UGX ' + Math.round(n).toLocaleString('en-US'); };
  function calc(d, w, price) {
    var sub = d * DESIGN + w * price, best = { save: 0, name: '' };
    function offer(save, name) { if (save > best.save) best = { save: save, name: name }; }
    if (d >= 4) offer(sub * 0.15, '15% off for 4 or more designs');
    if (d >= 2 && w >= 1) offer(sub * 0.15, '15% off for 2 or more designs with a website');
    if (w >= 2 && d >= 1) offer(Math.min(d, 3) * DESIGN, Math.min(d, 3) + ' design' + (Math.min(d, 3) > 1 ? 's' : '') + ' free with 2 websites');
    return { sub: sub, save: best.save, name: best.name, total: sub - best.save };
  }
  function hints(d, w, r) {
    var h = [];
    if (r.save) return h;
    if (d >= 1 && d < 4) h.push('Add ' + (4 - d) + ' more design' + (4 - d > 1 ? 's' : '') + ' to get 15% off.');
    if (d >= 2 && w === 0) h.push('Add a website to get 15% off.');
    if (w === 1) h.push('Add another website to get 3 designs free.');
    return h;
  }
  function update() {
    var d = +$('cb-d').value, w = +$('cb-w').value, price = +$('cb-p').value;
    $('cb-p').disabled = w === 0;
    var r = calc(d, w, w ? price : 0), L = [];
    if (d) L.push(d + ' design' + (d > 1 ? 's' : '') + ': ' + fmt(d * DESIGN));
    if (w) L.push(w + ' website' + (w > 1 ? 's' : '') + ': ' + fmt(w * price) + (price === 300000 ? ' (Pro, from price)' : ''));
    if (r.save) L.push('Offer: ' + r.name + ' (you save ' + fmt(r.save) + ')');
    hints(d, w, r).forEach(function (t) { L.push(t); });
    $('cb-sum').textContent = fmt(r.total);
    var p = $('cb-lines'); p.textContent = '';
    if (!L.length) p.textContent = 'Choose what you need.';
    L.forEach(function (t, i) { if (i) p.appendChild(document.createElement('br')); p.appendChild(document.createTextNode(t)); });
    var msg = 'Hello Avalon Corporate Solutions, I would like to order: ' + (L.length ? L.slice(0, 3).filter(function (t) { return !/^Add /.test(t); }).join('; ') : 'a design') + '. Estimated total: ' + fmt(r.total) + '.';
    $('cb-quote').href = 'https://wa.me/256745652778?text=' + encodeURIComponent(msg);
  }
  ['cb-d', 'cb-w', 'cb-p'].forEach(function (id) { $(id).addEventListener('change', update); });
  update();
})();

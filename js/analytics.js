/* Visit statistics (optional).
   To turn on Google Analytics, paste your Measurement ID between the quotes, like "G-ABC123XYZ".
   Leave it empty to keep the site free of any tracking. */
(function () {
  var ID = '';
  if (!ID) return;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ID);
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag('js', new Date());
  gtag('config', ID, { anonymize_ip: true });
})();

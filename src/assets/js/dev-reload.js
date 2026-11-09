// Development only: reloads the page when the wiki is rebuilt. Not included in `npm run build`.
(function () {
  if (!window.EventSource) return;
  var es = new EventSource('/__reload');
  es.onmessage = function () { location.reload(); };
})();

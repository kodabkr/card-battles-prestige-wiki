/* Runs before first paint: flags that JS is on and whether the browser can do
   native page transitions. Kept tiny on purpose. */
(function () {
  var d = document.documentElement;
  d.classList.add('js');
  try {
    if (window.CSS && CSS.supports('view-transition-name: a') && 'onpagereveal' in window) d.classList.add('vt');
  } catch (e) {}
})();

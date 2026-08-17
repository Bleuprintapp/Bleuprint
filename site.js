(function () {
  var rule = document.getElementById("bp-rule");
  if (!rule) return;
  function paint() {
    var sy = window.scrollY || 0;
    var docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    rule.style.width = Math.min(100, (sy / docH) * 100) + "%";
  }
  window.addEventListener("scroll", paint, { passive: true });
  window.addEventListener("resize", paint);
  paint();
})();

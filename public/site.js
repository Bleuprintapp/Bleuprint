(function () {
  var rule = document.getElementById("bp-rule");
  function paintProgress() {
    if (!rule) return;
    var scrollY = window.scrollY || 0;
    var documentHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    rule.style.width = Math.min(100, (scrollY / documentHeight) * 100) + "%";
  }
  window.addEventListener("scroll", paintProgress, { passive: true });
  window.addEventListener("resize", paintProgress);
  paintProgress();

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(pointer: fine)").matches;

  if (!reduceMotion) {
    var revealTargets = document.querySelectorAll("main section, .metric-card, .service-list > div, .phone-frame, .portal-window");
    revealTargets.forEach(function (element) { element.classList.add("reveal-ready"); });
    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -6%" });
      revealTargets.forEach(function (element) { observer.observe(element); });
    } else {
      revealTargets.forEach(function (element) { element.classList.add("is-visible"); });
    }
  }

  if (!reduceMotion && finePointer) {
    var blob = document.createElement("div");
    blob.className = "ambient-blob";
    blob.setAttribute("aria-hidden", "true");
    document.body.prepend(blob);
    var targetX = window.innerWidth * 0.72;
    var targetY = window.innerHeight * 0.25;
    var currentX = targetX;
    var currentY = targetY;
    window.addEventListener("pointermove", function (event) {
      targetX = event.clientX;
      targetY = event.clientY;
    }, { passive: true });
    function drift() {
      currentX += (targetX - currentX) * 0.055;
      currentY += (targetY - currentY) * 0.055;
      blob.style.transform = "translate3d(" + (currentX - 210) + "px," + (currentY - 210) + "px,0) rotate(" + ((currentX + currentY) * 0.012) + "deg)";
      window.requestAnimationFrame(drift);
    }
    drift();
  }

})();

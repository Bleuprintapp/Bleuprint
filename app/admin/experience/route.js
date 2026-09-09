import { readFile } from "node:fs/promises";
import { getServerMember } from "../../../lib/server-member";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const campaignLauncher = `<script>
window.addEventListener("DOMContentLoaded", function () {
  function norm(value) { return (value || "").replace(/\\s+/g, " ").trim(); }
  function button(text) {
    return Array.from(document.querySelectorAll("button")).find(function (item) {
      return Array.from(item.querySelectorAll("span")).some(function (span) {
        return !span.querySelector("span") && norm(span.textContent) === text;
      }) || norm(item.textContent) === text;
    });
  }
  function activate(text, next) {
    var attempts = 0;
    var timer = window.setInterval(function () {
      var target = button(text);
      attempts += 1;
      if (target) {
        window.clearInterval(timer);
        target.click();
        if (next) window.setTimeout(next, 1050);
      } else if (attempts > 30) window.clearInterval(timer);
    }, 150);
  }
  window.setTimeout(function () {
    activate("Content", function () {
      activate("Five bounds", function () {
        activate("Generate the campaign");
      });
    });
  }, 700);
});
</script>`;

const portalBridge = `<script>
window.addEventListener("DOMContentLoaded", function () {
  function norm(value) { return (value || "").replace(/\\s+/g, " ").trim(); }
  function leafLabels(button) {
    return Array.from(button.querySelectorAll("span")).filter(function (span) { return !span.querySelector("span"); }).map(function (span) { return norm(span.textContent); });
  }
  function nodeButton(label) {
    return Array.from(document.querySelectorAll("button")).find(function (button) { return leafLabels(button).includes(label); });
  }
  function applyPortalFixes() {
    Array.from(document.querySelectorAll("button")).filter(function (button) { return norm(button.textContent).includes("Ask Bleuprint"); }).forEach(function (button) { button.style.setProperty("display", "none", "important"); });
    var execution = nodeButton("Execution");
    if (execution) {
      var x = parseFloat(execution.style.left), y = parseFloat(execution.style.top);
      var graph = Array.from(document.querySelectorAll("svg")).find(function (svg) { return svg.querySelector("line"); });
      if (graph && Number.isFinite(x) && Number.isFinite(y)) Array.from(graph.querySelectorAll("line")).forEach(function (line) {
        function near(attribute, coordinate) { return Math.abs(parseFloat(line.getAttribute(attribute)) - coordinate) < .75; }
        if ((near("x1", x) && near("y1", y)) || (near("x2", x) && near("y2", y))) line.style.setProperty("display", "none", "important");
      });
      execution.setAttribute("aria-hidden", "true"); execution.tabIndex = -1; execution.style.setProperty("display", "none", "important");
    }
    var readMorning = Array.from(document.querySelectorAll("em")).find(function (element) { return norm(element.textContent) === "read this morning."; });
    var center = readMorning && readMorning.parentElement && readMorning.parentElement.parentElement;
    if (center) {
      center.dataset.bpCenter = "";
      var orientation = Array.from(center.children).find(function (element) { var text = norm(element.textContent); return text.includes("What is true") && text.includes("What changed"); });
      if (orientation) orientation.dataset.bpOrientation = "";
    }
  }
  var style = document.createElement("style");
  style.textContent = "@media (min-width:760px) and (max-height:820px){[data-bp-orientation]{display:none!important}}";
  document.head.appendChild(style);
  applyPortalFixes();
  new MutationObserver(applyPortalFixes).observe(document.body, { childList: true, subtree: true });

  document.addEventListener("click", function (event) {
    var target = event.target.closest && event.target.closest("button");
    if (!target || window.parent === window) return;
    var labels = leafLabels(target), panel = null;
    if (labels.includes("Live memory") || labels.includes("Memory")) panel = "memory";
    else if (labels.includes("Roadmap") || labels.includes("Build map")) panel = "roadmap";
    else if (labels.includes("Content")) panel = "content";
    else if (labels.includes("Performance") || labels.includes("Signals") || labels.includes("Attention")) panel = "performance";
    else if (labels.includes("Compare") || labels.includes("Issues")) panel = "issues";
    else if (labels.includes("Archive")) panel = "archive";
    else if (labels.includes("Just update") || labels.some(function (label) { return label.indexOf("Hand to ") === 0; })) panel = "issues";
    else if (labels.includes("Post")) panel = "issues";
    if (!panel) return;
    event.preventDefault(); event.stopImmediatePropagation();
    window.parent.postMessage({ type: "bleuprint:open-panel", panel: panel }, window.location.origin);
  }, true);

  var nativeSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    nativeSetItem.apply(this, arguments);
    if (this === window.localStorage && key === "bleuprint.passport.calendar" && window.parent !== window) {
      window.parent.postMessage({ type: "bleuprint:state-changed", key: key, value: value }, window.location.origin);
    }
  };
});
</script>`;

const portalReliability = `<script>
window.addEventListener("DOMContentLoaded", function () {
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    var close = Array.from(document.querySelectorAll("button")).find(function (button) { return button.offsetParent && (button.textContent.trim() === "×" || button.textContent.trim() === "Done"); });
    if (close) close.click();
  });
  document.addEventListener("click", function (event) {
    var button = event.target.closest && event.target.closest("button");
    if (!button) return;
    if ((button.getAttribute("title") || "").startsWith("Back to")) { event.preventDefault(); event.stopImmediatePropagation(); window.location.reload(); }
  }, true);
});
</script>`;

export async function GET(request) {
  const member = await getServerMember();
  if (!member) return new Response("Not authorized", { status: 403 });
  const source = await readFile(new URL("./portal.html", import.meta.url), "utf8");
  const openCampaign = new URL(request.url).searchParams.get("open") === "campaign";
  const additions = `${portalReliability}${portalBridge}${openCampaign ? campaignLauncher : ""}`;
  const html = source.replace("</body>", `${additions}</body>`);
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  });
}

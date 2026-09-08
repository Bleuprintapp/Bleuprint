import { readFile } from "node:fs/promises";
import { getServerMember } from "../../../lib/server-member";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const campaignLauncher = `<script>
window.addEventListener("DOMContentLoaded", function () {
  function button(text) {
    return Array.from(document.querySelectorAll("button")).find(function (item) {
      return item.textContent.trim() === text || item.textContent.includes(text);
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
    if (button.textContent.includes("Ask Bleuprint")) {
      event.preventDefault(); event.stopImmediatePropagation(); window.top.location.href = "/content-studio?tab=intelligence";
    }
  }, true);
});
</script>`;

export async function GET(request) {
  const member = await getServerMember();
  if (!member) return new Response("Not authorized", { status: 403 });
  const source = await readFile(new URL("./portal.html", import.meta.url), "utf8");
  const openCampaign = new URL(request.url).searchParams.get("open") === "campaign";
  const additions = `${portalReliability}${openCampaign ? campaignLauncher : ""}`;
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

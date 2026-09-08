import { currentUser } from "@clerk/nextjs/server";
import { readFile } from "node:fs/promises";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function primaryEmail(user) {
  return user?.emailAddresses
    .find((email) => email.id === user.primaryEmailAddressId)
    ?.emailAddress?.toLowerCase() || "";
}

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

export async function GET(request) {
  if (process.env.NODE_ENV !== "development") {
    const user = await currentUser();
    if (primaryEmail(user) !== "kalenagardner07@gmail.com") {
      return new Response("Not found", { status: 404 });
    }
  }

  const source = await readFile(new URL("./portal.html", import.meta.url), "utf8");
  const openCampaign = new URL(request.url).searchParams.get("open") === "campaign";
  const html = openCampaign ? source.replace("</body>", `${campaignLauncher}</body>`) : source;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  });
}

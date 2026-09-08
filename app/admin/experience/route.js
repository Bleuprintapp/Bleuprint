import { currentUser } from "@clerk/nextjs/server";
import { readFile } from "node:fs/promises";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function primaryEmail(user) {
  return user?.emailAddresses
    .find((email) => email.id === user.primaryEmailAddressId)
    ?.emailAddress?.toLowerCase() || "";
}

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    const user = await currentUser();
    if (primaryEmail(user) !== "kalenagardner07@gmail.com") {
      return new Response("Not found", { status: 404 });
    }
  }

  const html = await readFile(new URL("./portal.html", import.meta.url), "utf8");
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  });
}

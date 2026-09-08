import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ACCESS_HASH = "e226a951e38948ae98181a9d9e1f5c93f4b447c667ce4c4143d1ed6ba4cccd6a";

function digest(value) {
  return createHash("sha256").update(value).digest();
}

export async function POST(request) {
  const form = await request.formData();
  const passphrase = String(form.get("passphrase") || "");
  const next = String(form.get("next") || "/admin");
  const expected = Buffer.from(ACCESS_HASH, "hex");
  const valid = passphrase && timingSafeEqual(digest(passphrase), expected);
  const destination = valid && next.startsWith("/") && !next.startsWith("//") ? next : `/sign-in?error=1&next=${encodeURIComponent(next)}`;
  const response = NextResponse.redirect(new URL(destination, request.url), 303);
  if (valid) {
    response.cookies.set("bleuprint_access", passphrase, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerMember } from "../../../../lib/server-member";
import { authorizeUrl, configState } from "../../../../lib/microsoft";

export const dynamic = "force-dynamic";

export async function GET() {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = configState();
  if (!config.ready) {
    return NextResponse.json(
      { error: "Microsoft is not configured yet", missing: config.missing },
      { status: 400 },
    );
  }

  // The state value ties this redirect to this browser, so a callback that
  // did not start here is rejected rather than trusted.
  const state = randomBytes(24).toString("base64url");
  const jar = await cookies();
  jar.set("bleuprint_ms_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(authorizeUrl({ state }));
}

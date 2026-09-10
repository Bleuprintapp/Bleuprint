import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "../../../../lib/db";
import { getServerMember } from "../../../../lib/server-member";
import { CONNECTOR, WORKSPACE, exchangeCode, graphFetch, safeCompare, saveTokens } from "../../../../lib/microsoft";

export const dynamic = "force-dynamic";

const back = (request, params) => {
  const url = new URL("/admin", request.url);
  url.searchParams.set("open", "memory");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
};

export async function GET(request) {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const query = new URL(request.url).searchParams;

  // Microsoft reports a declined consent screen here rather than as an error status.
  if (query.get("error")) {
    return back(request, {
      microsoft: "failed",
      reason: (query.get("error_description") || query.get("error")).slice(0, 200),
    });
  }

  const code = query.get("code");
  const state = query.get("state");
  const jar = await cookies();
  const expected = jar.get("bleuprint_ms_state")?.value;
  jar.delete("bleuprint_ms_state");

  if (!code) return back(request, { microsoft: "failed", reason: "Microsoft did not return an authorization code" });
  if (!safeCompare(state, expected)) {
    return back(request, { microsoft: "failed", reason: "This sign-in did not start from Bleuprint, so it was not accepted" });
  }

  try {
    const tokens = await exchangeCode(code);

    // Record which account actually consented, so the portal can say so
    // rather than assuming it was the person who clicked connect.
    let accountLabel = null;
    let accountId = null;
    try {
      const profile = await graphFetch(tokens.access_token, "/me?$select=id,displayName,userPrincipalName");
      accountLabel = profile.userPrincipalName || profile.displayName || null;
      accountId = profile.id || null;
    } catch {
      // A missing profile is not a reason to throw away a working token.
    }

    await ensureSchema();
    const sql = getSql();
    await saveTokens(sql, { memberEmail: member.email, tokens, accountLabel, accountId });
    await sql`
      INSERT INTO bleuprint_audit_events (workspace_id, actor_email, event_type, source_name, detail)
      VALUES (${WORKSPACE}, ${member.email}, 'connector.authorized', ${CONNECTOR},
              ${JSON.stringify({ account: accountLabel, scope: tokens.scope || null })}::jsonb)
    `;

    return back(request, { microsoft: "connected" });
  } catch (error) {
    return back(request, { microsoft: "failed", reason: String(error.message).slice(0, 200) });
  }
}

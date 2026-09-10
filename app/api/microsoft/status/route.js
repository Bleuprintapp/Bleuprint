import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "../../../../lib/db";
import { getServerMember } from "../../../../lib/server-member";
import { CONNECTOR, WORKSPACE, SCOPES, accessTokenFor, configState, connectionRow, ensureConnectorSchema } from "../../../../lib/microsoft";

export const dynamic = "force-dynamic";

export async function GET() {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = configState();
  await ensureSchema();
  const sql = getSql();
  await ensureConnectorSchema(sql);

  const row = await connectionRow(sql, member.email);
  const folders = await sql`
    SELECT folder_name, folder_path, selected_by, selected_at, last_synced_at
    FROM bleuprint_connector_folders
    WHERE workspace_id = ${WORKSPACE} AND connector = ${CONNECTOR}
    ORDER BY selected_at DESC
  `;

  if (!config.ready) {
    return NextResponse.json({
      state: "needs-app-credentials",
      detail: "The Microsoft app credentials are not set on this deployment yet.",
      missing: config.missing,
      scopes: SCOPES,
      folders: [],
    });
  }
  if (!row) {
    return NextResponse.json({
      state: "ready-to-authorize",
      detail: "Credentials are in place. Nobody has authorized a Microsoft account yet.",
      scopes: SCOPES,
      folders: [],
    });
  }

  // Prove the stored token still works rather than reporting "connected"
  // because a row exists. A revoked consent looks identical in the database.
  const token = await accessTokenFor(sql, member.email);
  if (!token) {
    return NextResponse.json({
      state: "needs-reauthorization",
      detail: row.last_error || "The stored Microsoft authorization is no longer valid. Connect again.",
      account: row.account_label,
      scopes: SCOPES,
      folders,
    });
  }

  return NextResponse.json({
    state: "authorized",
    detail: folders.length
      ? "Authorized. A folder is selected. Nothing syncs until a sync is run."
      : "Authorized. No canonical folder has been selected yet, so nothing is being watched.",
    account: row.account_label,
    connectedAt: row.connected_at,
    expiresAt: row.expires_at,
    scopes: String(row.scope || "").split(" ").filter(Boolean),
    folders,
  });
}
